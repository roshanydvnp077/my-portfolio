(function () {
  'use strict';
  const client = window.supabaseClient;
  const bucket = 'family-vault';
  const types = ['Citizenship','Citizenship Front','Citizenship Back','Passport','Birth Certificate','Marriage Certificate','Education Certificate','Driving License','National ID','PAN / Tax Document','Medical Document','Insurance Document','Property Document','Bank Document','Other'];
  if (!client) return;

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
  const overlay = () => document.getElementById('overlay');
  const body = () => document.getElementById('dialogBody');
  const title = () => document.getElementById('dialogTitle');
  const close = () => { if (overlay()) overlay().hidden = true; };
  const options = value => types.map(item => '<option' + (item === value ? ' selected' : '') + '>' + item + '</option>').join('');

  async function admin() {
    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (!user) return null;
    const result = await client.rpc('is_admin');
    return result.error || result.data !== true ? null : user;
  }

  function injectButtons() {
    document.querySelectorAll('.vault-document').forEach(card => {
      const deleteButton = card.querySelector('[data-vault-delete-doc]');
      if (!deleteButton || card.querySelector('[data-vault-edit-doc]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.vaultEditDoc = deleteButton.dataset.vaultDeleteDoc;
      button.textContent = 'Edit';
      deleteButton.parentElement.insertBefore(button, deleteButton);
    });
    document.querySelectorAll('.family-card').forEach(card => {
      const openButton = card.querySelector('[data-vault-open]');
      const actions = card.querySelector('.family-actions');
      if (!openButton || !actions || card.querySelector('[data-vault-download-member]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.vaultDownloadMember = openButton.dataset.vaultOpen;
      button.textContent = 'Download Details';
      actions.appendChild(button);
      const view = document.createElement('button');
      view.type = 'button';
      view.dataset.vaultViewMemberDetails = openButton.dataset.vaultOpen;
      view.textContent = 'View Details';
      actions.appendChild(view);
      const print = document.createElement('button');
      print.type = 'button';
      print.dataset.vaultPrintMember = openButton.dataset.vaultOpen;
      print.textContent = 'Print Details';
      actions.appendChild(print);
    });
  }

  async function getMemberDetails(id) {
    const user = await admin();
    if (!user) { location.replace('../index.html#admin-login'); return null; }
    const [memberResult, documentsResult] = await Promise.all([
      client.from('family_members').select('*').eq('id', id).maybeSingle(),
      client.from('family_documents').select('document_title,document_type,document_number,issue_date,expiry_date,mime_type,file_size,notes,created_at').eq('family_member_id', id).order('created_at', { ascending: false })
    ]);
    if (memberResult.error || documentsResult.error || !memberResult.data) return null;
    return { member: memberResult.data, documents: documentsResult.data || [] };
  }

  async function downloadMemberDetails(id) {
    const details = await getMemberDetails(id);
    if (!details) return;
    const { member, documents } = details;
    const lines = ['FAMILY VAULT PROFILE', '', 'Full Name: ' + (member.full_name || ''), 'Relation: ' + (member.relation || ''), 'Gender: ' + (member.gender || ''), 'Date of Birth: ' + (member.date_of_birth || ''), 'Blood Group: ' + (member.blood_group || ''), 'Phone: ' + (member.phone || ''), 'Email: ' + (member.email || ''), 'Address: ' + (member.address || ''), 'Occupation: ' + (member.occupation || ''), 'Notes: ' + (member.notes || ''), '', 'DOCUMENTS'];
    documents.forEach(doc => lines.push('', 'Title: ' + doc.document_title, 'Type: ' + doc.document_type, 'Number: ' + (doc.document_number || ''), 'Issue Date: ' + (doc.issue_date || ''), 'Expiry Date: ' + (doc.expiry_date || ''), 'File Type: ' + (doc.mime_type || ''), 'Size: ' + (doc.file_size || ''), 'Notes: ' + (doc.notes || '')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = (member.full_name || 'family-member').replace(/[^a-z0-9_-]+/gi, '-') + '-details.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function viewMemberDetails(id) {
    const details = await getMemberDetails(id);
    if (!details) return;
    const { member, documents } = details;
    const dialog = document.getElementById('overlay');
    const dialogTitle = document.getElementById('dialogTitle');
    const dialogBody = document.getElementById('dialogBody');
    if (!dialog || !dialogTitle || !dialogBody) return;
    dialogTitle.textContent = member.full_name || 'Family Details';
    dialogBody.innerHTML = '<div class="family-detail-dialog"><h3>' + escape(member.full_name) + '</h3><p class="muted">' + escape(member.relation || 'Family member') + '</p><div class="family-detail-list">' + [['Gender',member.gender],['Date of Birth',member.date_of_birth],['Blood Group',member.blood_group],['Phone',member.phone],['Email',member.email],['Address',member.address],['Occupation',member.occupation],['Notes',member.notes]].filter(item => item[1]).map(item => '<p><strong>' + item[0] + '</strong><span>' + escape(item[1]) + '</span></p>').join('') + '</div><p><strong>Documents</strong><span>' + documents.length + '</span></p><div class="family-form-actions"><button type="button" class="button" data-vault-close-details>Close</button><button type="button" class="button primary" data-vault-print-member="' + member.id + '">Print</button></div></div>';
    dialog.hidden = false;
    dialogBody.querySelector('[data-vault-close-details]').onclick = () => { dialog.hidden = true; };
  }

  async function printMemberDetails(id) {
    const details = await getMemberDetails(id);
    if (!details) return;
    const { member, documents } = details;
    const rows = [['Full Name',member.full_name],['Relation',member.relation],['Gender',member.gender],['Date of Birth',member.date_of_birth],['Blood Group',member.blood_group],['Phone',member.phone],['Email',member.email],['Address',member.address],['Occupation',member.occupation],['Notes',member.notes]].filter(item => item[1]).map(item => '<p><b>' + escape(item[0]) + ':</b> ' + escape(item[1]) + '</p>').join('');
    const docs = documents.map(doc => '<li>' + escape(doc.document_title) + ' (' + escape(doc.document_type) + ')</li>').join('');
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=760,height=700');
    if (!printWindow) return;
    printWindow.document.write('<!doctype html><html><head><title>Family Details - ' + escape(member.full_name) + '</title><style>body{font:16px Arial,sans-serif;color:#111;padding:32px;max-width:760px;margin:auto}h1{font-size:24px;border-bottom:2px solid #111;padding-bottom:10px}p{line-height:1.5}li{margin:8px 0}</style></head><body><h1>Family Details</h1>' + rows + '<h2>Documents</h2><ul>' + (docs || '<li>No documents</li>') + '</ul><script>window.onload=function(){window.print();}</script></body></html>');
    printWindow.document.close();
  }

  async function openEdit(id) {
    const user = await admin();
    if (!user) return location.replace('../index.html#admin-login');
    const result = await client.from('family_documents').select('*').eq('id', id).maybeSingle();
    if (result.error || !result.data) return;
    const doc = result.data;
    title().textContent = 'Edit Document';
    body().innerHTML = '<form class="form family-form" data-edit-document-form><div class="family-form-grid"><label class="family-field">Document Type<select class="field" name="document_type" required>' + options(doc.document_type) + '</select></label><label class="family-field">Document Title<input class="field" name="document_title" required value="' + escape(doc.document_title) + '"></label><label class="family-field">Document Number<input class="field" name="document_number" value="' + escape(doc.document_number) + '"></label><label class="family-field">Issue Date<input class="field" name="issue_date" type="date" value="' + escape(doc.issue_date) + '"></label><label class="family-field">Expiry Date<input class="field" name="expiry_date" type="date" value="' + escape(doc.expiry_date) + '"></label><label class="family-field family-wide">Replace File<input class="field" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small class="muted">Optional. JPG, PNG, WEBP or PDF up to 10 MB.</small></label><label class="family-field family-wide">Private Notes<textarea class="field" name="notes">' + escape(doc.notes) + '</textarea></label></div><p data-edit-message></p><div class="family-form-actions"><button type="button" class="button" data-edit-cancel>Cancel</button><button type="submit" class="button primary">Save Document</button></div></form>';
    overlay().hidden = false;
    const form = body().querySelector('[data-edit-document-form]');
    form.querySelector('[data-edit-cancel]').onclick = close;
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const message = form.querySelector('[data-edit-message]');
      const data = new FormData(form);
      const file = data.get('file');
      if (file?.name && (!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024)) { message.textContent = 'Unsupported file type or file size exceeds 10 MB.'; return; }
      button.disabled = true; button.textContent = 'Saving...';
      let replacement = '';
      try {
        let path = doc.file_path;
        if (file?.name) {
          replacement = user.id + '/' + doc.family_member_id + '/' + String(data.get('document_type')).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
          const upload = await client.storage.from(bucket).upload(replacement, file, { contentType: file.type, upsert: false });
          if (upload.error) throw upload.error;
          path = replacement;
        }
        const update = await client.from('family_documents').update({ document_type: data.get('document_type'), document_title: String(data.get('document_title')).trim(), document_number: String(data.get('document_number') || '').trim() || null, issue_date: data.get('issue_date') || null, expiry_date: data.get('expiry_date') || null, file_path: path, mime_type: file?.name ? file.type : doc.mime_type, file_size: file?.name ? file.size : doc.file_size, notes: String(data.get('notes') || '').trim() || null }).eq('id', doc.id);
        if (update.error) throw update.error;
        if (replacement) await client.storage.from(bucket).remove([doc.file_path]);
        close();
        document.querySelector('[data-vault-open="' + doc.family_member_id + '"]')?.click();
      } catch (error) { if (replacement) await client.storage.from(bucket).remove([replacement]); message.textContent = error.message || 'Could not update document.'; button.disabled = false; button.textContent = 'Save Document'; }
    };
  }

  document.addEventListener('click', event => { const button = event.target.closest('[data-vault-edit-doc], [data-vault-download-member], [data-vault-view-member-details], [data-vault-print-member]'); if (!button) return; event.preventDefault(); event.stopImmediatePropagation(); if (button.hasAttribute('data-vault-edit-doc')) openEdit(button.dataset.vaultEditDoc); else if (button.hasAttribute('data-vault-download-member')) downloadMemberDetails(button.dataset.vaultDownloadMember); else if (button.hasAttribute('data-vault-view-member-details')) viewMemberDetails(button.dataset.vaultViewMemberDetails); else printMemberDetails(button.dataset.vaultPrintMember); }, true);
  new MutationObserver(injectButtons).observe(document.body, { childList: true, subtree: true });
  injectButtons();
}());
