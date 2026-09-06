(function () {
  'use strict';
  const client = window.supabaseClient;
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.main');
  const overlay = document.getElementById('overlay');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');
  const bucket = 'family-vault';
  const types = ['Citizenship','Citizenship Front','Citizenship Back','Passport','Birth Certificate','Marriage Certificate','Education Certificate','Driving License','National ID','PAN / Tax Document','Medical Document','Insurance Document','Property Document','Bank Document','Other'];
  const state = { user: null, view: null, members: [], documents: [], objectUrl: '', activeMember: null };
  if (!client || !nav || !main) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const makeUuid = () => {
    const cryptoApi = window.crypto || globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
      const random = Math.random() * 16 | 0;
      const value = character === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  };
  const dateText = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value + (value.length === 10 ? 'T00:00:00' : ''))) : '';
  const sizeText = value => value ? (value < 1024 * 1024 ? Math.ceil(value / 1024) + ' KB' : (value / 1024 / 1024).toFixed(1) + ' MB') : '';
  const errorText = error => [error?.message, error?.details, error?.hint].filter(Boolean).join(' | ') || 'The Family Vault request failed.';
  const toast = (text, error) => { const node = document.getElementById('toast'); if (!node) return; node.textContent = text; node.className = error ? 'error' : ''; node.hidden = false; setTimeout(() => { node.hidden = true; }, 3500); };
  const relationOptions = value => ['','Father','Mother','Brother','Sister','Grandfather','Grandmother','Uncle','Aunt','Cousin','Spouse','Child','Other'].map(item => '<option value="' + item + '"' + (item === value ? ' selected' : '') + '>' + (item || 'Select relation') + '</option>').join('');
  const typeOptions = value => types.map(item => '<option' + (item === value ? ' selected' : '') + '>' + item + '</option>').join('');

  async function admin() {
    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (!user) return null;
    const result = await client.rpc('is_admin');
    return result.error || result.data !== true ? null : user;
  }

  function addNav() {
    if (nav.querySelector('[data-vault-view]')) return;
    const button = document.createElement('button'); button.type = 'button'; button.dataset.view = 'family-vault'; button.dataset.vaultView = 'true'; button.textContent = 'Family Vault 🔒'; nav.appendChild(button);
  }

  function activate() {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view !== state.view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'family-vault'));
    document.getElementById('title').textContent = state.activeMember ? 'Family Vault' : 'Family Vault';
    document.getElementById('side')?.classList.remove('open');
  }

  function signed(path) { return path ? client.storage.from(bucket).createSignedUrl(path, 60) : Promise.resolve({ data: { signedUrl: '' } }); }
  async function hydrateMembers() {
    const [memberResult, documentResult] = await Promise.all([
      client.from('family_members').select('*').order('full_name'),
      client.from('family_documents').select('*').order('created_at', { ascending: false })
    ]);
    if (memberResult.error || documentResult.error) throw memberResult.error || documentResult.error;
    state.documents = documentResult.data || [];
    state.members = await Promise.all((memberResult.data || []).map(async member => { const image = await signed(member.profile_photo_path); return { ...member, signedPhoto: image.error ? '' : image.data.signedUrl }; }));
  }

  function docStatus(expiry) {
    if (!expiry) return '';
    const days = Math.ceil((new Date(expiry + 'T23:59:59') - new Date()) / 86400000);
    return days < 0 ? '<span class="vault-badge expired">Expired</span>' : days < 30 ? '<span class="vault-badge soon">Expiring Soon</span>' : '<span class="vault-badge valid">Valid</span>';
  }

  function memberCard(member) {
    const docs = state.documents.filter(doc => doc.family_member_id === member.id);
    const avatar = member.signedPhoto ? '<img class="family-avatar" src="' + escape(member.signedPhoto) + '" alt="">' : '<div class="family-avatar family-avatar-fallback">' + escape((member.full_name || '?')[0].toUpperCase()) + '</div>';
    return '<article class="family-card"><div class="family-card-head">' + avatar + '<div><h3>' + escape(member.full_name) + '</h3><p>' + escape(member.relation || 'Family member') + '</p></div></div><div class="family-details">' + (member.date_of_birth ? '<div class="family-detail"><span>Date of birth</span><strong>' + escape(dateText(member.date_of_birth)) + '</strong></div>' : '') + '<div class="family-detail"><span>Documents</span><strong>📄 ' + docs.length + '</strong></div>' + (member.phone ? '<div class="family-detail"><span>Phone</span><strong>' + escape(member.phone) + '</strong></div>' : '') + '</div><div class="family-actions"><button type="button" data-vault-open="' + member.id + '">Open Vault</button><button type="button" data-vault-edit="' + member.id + '">Edit</button><button type="button" data-vault-delete="' + member.id + '">Delete</button></div></article>';
  }

  function paintMembers() {
    const list = state.view.querySelector('[data-vault-list]');
    const query = state.view.querySelector('[data-vault-search]').value.trim().toLowerCase();
    const matches = state.members.filter(member => { const docs = state.documents.filter(doc => doc.family_member_id === member.id); return !query || [member.full_name, member.relation, ...docs.map(doc => doc.document_type + ' ' + doc.document_title)].join(' ').toLowerCase().includes(query); });
    state.view.querySelector('[data-vault-count]').textContent = state.members.length + (state.members.length === 1 ? ' member' : ' members');
    list.innerHTML = matches.length ? matches.map(memberCard).join('') : '<div class="family-empty"><h3>' + (state.members.length ? 'No matching family members' : 'No Family Vault members yet') + '</h3><p>Add a member to begin storing private family records.</p><button class="button primary" data-vault-add>Add Family Member</button></div>';
  }

  async function loadMembers() {
    state.view.querySelector('[data-vault-state]').innerHTML = '<div class="family-loading">Loading Family Vault...</div>';
    try { await hydrateMembers(); state.view.querySelector('[data-vault-state]').innerHTML = '<div data-vault-list class="family-grid"></div>'; paintMembers(); } catch (error) { state.view.querySelector('[data-vault-state]').innerHTML = '<div class="family-error">Unable to load Family Vault.<br><button class="button" data-vault-refresh>Retry</button></div>'; console.error(error); }
  }

  function formField(name, label, value, type = 'text', required = false) { return '<label class="family-field">' + label + (required ? ' *' : '') + '<input class="field" name="' + name + '" type="' + type + '" value="' + escape(value) + '"' + (required ? ' required' : '') + '></label>'; }
  function openDialog(title, html) { dialogTitle.textContent = title; dialogBody.innerHTML = html; overlay.hidden = false; }
  function closeDialog() { if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); state.objectUrl = ''; overlay.hidden = true; }

  function openMemberForm(member) {
    const avatar = member?.signedPhoto ? '<img class="family-photo-preview" data-vault-photo-preview src="' + escape(member.signedPhoto) + '" alt="Current photo">' : '<div class="family-photo-preview family-photo-empty" data-vault-photo-preview>No photo selected</div>';
    openDialog(member ? 'Edit Family Member' : 'Add Family Member', '<form class="form family-form" data-vault-member-form><div class="family-form-grid"><label class="family-field family-wide">Profile Photo<input class="field" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small class="muted">Private image, up to 10 MB.</small></label><div class="family-photo-wrap family-wide">' + avatar + (member?.profile_photo_path ? '<button type="button" class="button" data-vault-remove-photo>Remove Photo</button>' : '') + '</div>' + formField('full_name','Full Name',member?.full_name,'text',true) + '<label class="family-field">Relation<select class="field" name="relation">' + relationOptions(member?.relation) + '</select></label>' + '<label class="family-field">Gender<select class="field" name="gender"><option></option><option' + (member?.gender === 'Male' ? ' selected' : '') + '>Male</option><option' + (member?.gender === 'Female' ? ' selected' : '') + '>Female</option><option' + (member?.gender === 'Other' ? ' selected' : '') + '>Other</option></select></label>' + formField('date_of_birth','Date of Birth',member?.date_of_birth,'date') + formField('blood_group','Blood Group',member?.blood_group) + formField('phone','Phone',member?.phone,'tel') + formField('email','Email',member?.email,'email') + formField('occupation','Occupation',member?.occupation) + '<label class="family-field family-wide">Address<textarea class="field" name="address">' + escape(member?.address) + '</textarea></label><label class="family-field family-wide">Private Notes<textarea class="field" name="notes">' + escape(member?.notes) + '</textarea></label></div><p data-vault-form-message></p><div class="family-form-actions"><button type="button" class="button" data-vault-cancel>Cancel</button><button type="submit" class="button primary" data-vault-save>Save Family Member</button></div></form>');
    const form = dialogBody.querySelector('[data-vault-member-form]');
    form.elements.photo.onchange = () => { const file = form.elements.photo.files[0]; if (!file) return; if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) { form.querySelector('[data-vault-form-message]').textContent = 'Choose a supported image up to 10 MB.'; form.elements.photo.value = ''; return; } state.objectUrl = URL.createObjectURL(file); form.querySelector('[data-vault-photo-preview]').outerHTML = '<img class="family-photo-preview" data-vault-photo-preview src="' + state.objectUrl + '" alt="Selected photo">'; };
    form.querySelector('[data-vault-cancel]').onclick = closeDialog;
    form.querySelector('[data-vault-remove-photo]')?.addEventListener('click', () => { form.dataset.removePhoto = 'true'; form.querySelector('[data-vault-photo-preview]').outerHTML = '<div class="family-photo-preview family-photo-empty" data-vault-photo-preview>No photo selected</div>'; });
    form.onsubmit = event => saveMember(event, member);
  }

  async function saveMember(event, member) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[data-vault-save]');
    const message = form.querySelector('[data-vault-form-message]');
    const data = new FormData(form);
    const name = String(data.get('full_name') || '').trim();
    if (!name) { message.textContent = 'Full Name is required.'; return; }
    if (data.get('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.get('email'))) { message.textContent = 'Enter a valid email address.'; return; }
    button.disabled = true;
    button.textContent = 'Saving...';
    let uploaded = '';
    let createdMemberId = '';
    try {
      const user = await admin();
      if (!user) throw new Error('Admin session expired.');
      const payload = { full_name: name, relation: data.get('relation') || null, gender: data.get('gender') || null, date_of_birth: data.get('date_of_birth') || null, phone: String(data.get('phone') || '').trim() || null, email: String(data.get('email') || '').trim() || null, address: String(data.get('address') || '').trim() || null, occupation: String(data.get('occupation') || '').trim() || null, blood_group: data.get('blood_group') || null, notes: String(data.get('notes') || '').trim() || null, profile_photo_path: member?.profile_photo_path || null };
      let saved;
      if (member) {
        saved = await client.from('family_members').update(payload).eq('id', member.id).select().single();
      } else {
        saved = await client.from('family_members').insert({ ...payload, created_by: user.id }).select().single();
      }
      if (saved.error || !saved.data) throw saved.error || new Error('Family member was not saved.');
      if (!member) createdMemberId = saved.data.id;
      const file = data.get('photo');
      if (file?.name) {
        uploaded = saved.data.id + '/profile/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
        const upload = await client.storage.from(bucket).upload(uploaded, file, { contentType: file.type, upsert: false });
        if (upload.error) throw upload.error;
        const photoUpdate = await client.from('family_members').update({ profile_photo_path: uploaded }).eq('id', saved.data.id).select().single();
        if (photoUpdate.error) throw photoUpdate.error;
        if (member?.profile_photo_path) await client.storage.from(bucket).remove([member.profile_photo_path]);
      } else if (member && form.dataset.removePhoto === 'true') {
        const photoUpdate = await client.from('family_members').update({ profile_photo_path: null }).eq('id', member.id).select().single();
        if (photoUpdate.error) throw photoUpdate.error;
        if (member.profile_photo_path) await client.storage.from(bucket).remove([member.profile_photo_path]);
      }
      closeDialog();
      await loadMembers();
      toast(member ? 'Family member updated.' : 'Family member added.');
    } catch (error) {
      if (uploaded) await client.storage.from(bucket).remove([uploaded]);
      if (createdMemberId) await client.from('family_members').delete().eq('id', createdMemberId);
      message.textContent = error.message || 'Could not save Family Member.';
      console.error(error?.message, error?.details, error?.hint, error?.code);
      button.disabled = false;
      button.textContent = 'Save Family Member';
    }
  }

  function documentCard(doc) { return '<article class="vault-document"><div class="vault-document-icon">' + (doc.mime_type?.startsWith('image/') ? '🖼️' : '📄') + '</div><div class="vault-document-copy"><h4>' + escape(doc.document_title) + '</h4><p>' + escape(doc.document_type) + ' · ' + escape(doc.mime_type || 'File') + ' · ' + sizeText(doc.file_size) + '</p><small>' + escape(dateText(doc.created_at)) + ' ' + docStatus(doc.expiry_date) + '</small></div><div class="family-actions"><button data-vault-view-doc="' + doc.id + '">View</button><button data-vault-download-doc="' + doc.id + '">Download</button><button data-vault-edit-doc="' + doc.id + '">Edit</button><button data-vault-delete-doc="' + doc.id + '">Delete</button></div></article>'; }

  async function openVault(member) { state.activeMember = member; activate(); const docs = state.documents.filter(doc => doc.family_member_id === member.id); state.view.innerHTML = '<div class="vault-page"><div class="family-toolbar"><button class="button" data-vault-back>← Back to Family Vault</button><button class="button primary" data-vault-add-doc>Upload Document</button></div><div class="vault-profile">' + (member.signedPhoto ? '<img class="family-detail-photo" src="' + escape(member.signedPhoto) + '" alt="">' : '') + '<div><h2>' + escape(member.full_name) + '</h2><p class="muted">' + escape(member.relation || 'Family member') + '</p></div></div><div class="panel"><h3>Personal and Contact Information</h3><div class="family-details vault-info">' + [['Date of birth',dateText(member.date_of_birth)],['Phone',member.phone],['Email',member.email],['Address',member.address],['Occupation',member.occupation],['Blood group',member.blood_group],['Notes',member.notes]].filter(item => item[1]).map(item => '<div class="family-detail"><span>' + item[0] + '</span><strong>' + escape(item[1]) + '</strong></div>').join('') + '</div></div><div class="panel"><div class="toolbar"><h3>Documents</h3><span class="muted">Private files use short-lived signed links.</span></div><div class="vault-documents">' + (docs.length ? docs.map(documentCard).join('') : '<div class="family-empty">No documents uploaded yet.</div>') + '</div></div></div>'; activate(); }

  function openDocumentForm() { openDialog('Upload Secure Document', '<form class="form family-form" data-vault-document-form><div class="family-form-grid"><label class="family-field">Document Type *<select class="field" name="document_type" required>' + typeOptions() + '</select></label>' + formField('document_title','Document Title','', 'text', true) + formField('document_number','Document Number') + formField('issue_date','Issue Date','', 'date') + formField('expiry_date','Expiry Date','', 'date') + '<label class="family-field family-wide">File *<input class="field" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required><small class="muted">JPG, PNG, WEBP or PDF up to 10 MB.</small></label><label class="family-field family-wide">Notes<textarea class="field" name="notes"></textarea></label></div><p data-vault-form-message></p><div class="family-form-actions"><button type="button" class="button" data-vault-cancel>Cancel</button><button type="submit" class="button primary" data-vault-save>Upload Securely</button></div></form>'); const form = dialogBody.querySelector('[data-vault-document-form]'); form.querySelector('[data-vault-cancel]').onclick = closeDialog; form.onsubmit = saveDocument; }

  async function saveDocument(event) { event.preventDefault(); const form = event.currentTarget; const message = form.querySelector('[data-vault-form-message]'); const button = form.querySelector('[data-vault-save]'); const data = new FormData(form); const file = data.get('file'); const allowed = ['image/jpeg','image/png','image/webp','application/pdf']; if (!file?.name || !allowed.includes(file.type) || file.size > 10 * 1024 * 1024) { message.textContent = 'Choose a JPG, PNG, WEBP or PDF file up to 10 MB.'; return; } button.disabled = true; button.textContent = 'Uploading...'; let path = ''; try { const user = await admin(); if (!user || !state.activeMember) throw new Error('Admin session expired.'); path = user.id + '/' + state.activeMember.id + '/' + String(data.get('document_type')).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const upload = await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error; const insert = await client.from('family_documents').insert({ family_member_id: state.activeMember.id, document_type: data.get('document_type'), document_title: String(data.get('document_title')).trim(), document_number: String(data.get('document_number') || '').trim() || null, issue_date: data.get('issue_date') || null, expiry_date: data.get('expiry_date') || null, file_path: path, mime_type: file.type, file_size: file.size, notes: String(data.get('notes') || '').trim() || null, uploaded_by: user.id }); if (insert.error) throw insert.error; closeDialog(); await hydrateMembers(); state.activeMember = state.members.find(item => item.id === state.activeMember.id); await openVault(state.activeMember); toast('Document uploaded securely.'); } catch (error) { if (path) await client.storage.from(bucket).remove([path]); message.textContent = 'Could not upload the document.'; console.error(error); button.disabled = false; button.textContent = 'Upload Securely'; } }

  async function deleteMember(member) { if (!confirm('Delete this family member and all associated documents?\n\nThis action cannot be undone.')) return; const result = await client.from('family_members').delete().eq('id', member.id); if (result.error) { toast('Could not delete Family Member.', true); return; } if (member.profile_photo_path) await client.storage.from(bucket).remove([member.profile_photo_path]); for (const doc of state.documents.filter(item => item.family_member_id === member.id)) await client.storage.from(bucket).remove([doc.file_path]); await loadMembers(); toast('Family member deleted.'); }
  async function fileAction(doc, download) { const user = await admin(); if (!user) { clearVault(); return; } const result = await signed(doc.file_path); if (result.error) { toast('Could not create a secure link.', true); return; } if (download) { const link = document.createElement('a'); link.href = result.data.signedUrl; link.download = doc.document_title; link.click(); } else window.open(result.data.signedUrl, '_blank', 'noopener'); }
  async function deleteDocument(doc) { if (!confirm('Delete this document?\n\nThis action cannot be undone.')) return; const result = await client.from('family_documents').delete().eq('id', doc.id); if (result.error) { toast('Could not delete document.', true); return; } await client.storage.from(bucket).remove([doc.file_path]); await hydrateMembers(); state.activeMember = state.members.find(item => item.id === state.activeMember.id); await openVault(state.activeMember); toast('Document deleted.'); }

  async function show() { const user = await admin(); if (!user) { location.replace('../index.html#admin-login'); return; } state.user = user; state.activeMember = null; if (!state.view) { state.view = document.createElement('section'); state.view.id = 'familyVaultView'; state.view.className = 'view'; main.appendChild(state.view); } state.view.innerHTML = '<div class="vault-page"><div class="family-toolbar"><div><span class="eyebrow">Private admin area</span><h2>Family Vault</h2><p class="muted">Secure family information and important personal documents.</p></div><button class="button primary" data-vault-add>Add Family Member</button></div><div class="family-controls"><strong data-vault-count>0 members</strong><input class="field" data-vault-search type="search" placeholder="Search family or documents" aria-label="Search Family Vault"><button class="button" data-vault-refresh>Refresh</button></div><div data-vault-state><div class="family-loading">Loading Family Vault...</div></div></div>'; activate(); state.view.querySelector('[data-vault-search]').oninput = paintMembers; await loadMembers(); }
  function clearVault() { state.members = []; state.documents = []; state.activeMember = null; if (state.view) { state.view.innerHTML = ''; state.view.hidden = true; } }

  document.addEventListener('click', event => { const target = event.target; const action = target.closest('[data-vault-view], [data-vault-add], [data-vault-edit], [data-vault-open], [data-vault-delete], [data-vault-refresh], [data-vault-back], [data-vault-add-doc], [data-vault-view-doc], [data-vault-download-doc], [data-vault-delete-doc]'); if (!action) return; event.preventDefault(); event.stopImmediatePropagation(); const id = action.dataset.vaultOpen || action.dataset.vaultEdit || action.dataset.vaultDelete || action.dataset.vaultViewDoc || action.dataset.vaultDownloadDoc || action.dataset.vaultDeleteDoc; if (action.hasAttribute('data-vault-view')) return show(); if (action.hasAttribute('data-vault-add')) return openMemberForm(); if (action.hasAttribute('data-vault-refresh')) return loadMembers(); if (action.hasAttribute('data-vault-back')) return show(); if (action.hasAttribute('data-vault-add-doc')) return openDocumentForm(); if (action.hasAttribute('data-vault-edit')) return openMemberForm(state.members.find(item => item.id === id)); if (action.hasAttribute('data-vault-open')) return openVault(state.members.find(item => item.id === id)); if (action.hasAttribute('data-vault-delete')) return deleteMember(state.members.find(item => item.id === id)); const doc = state.documents.find(item => item.id === id); if (action.hasAttribute('data-vault-view-doc')) return fileAction(doc, false); if (action.hasAttribute('data-vault-download-doc')) return fileAction(doc, true); if (action.hasAttribute('data-vault-delete-doc')) return deleteDocument(doc); }, true);
  client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) clearVault(); });
  addNav(); if (location.hash === '#family-vault' || location.hash === '#family') show();
}());
