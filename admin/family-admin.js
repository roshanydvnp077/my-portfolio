(function () {
  'use strict';

  const client = window.supabaseClient;
  const app = document.getElementById('app');
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.main');
  const overlay = document.getElementById('overlay');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');
  const FAMILY_BUCKET = 'family-private';
  const RELATIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Cousin', 'Spouse', 'Child', 'Other'];
  const state = { rows: [], user: null, view: null, objectUrl: '' };

  if (!client || !app || !main || !nav) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
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
  const errorText = error => [error?.message, error?.details, error?.hint].filter(Boolean).join(' | ') || 'The Family request could not be completed.';
  const dateText = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value + (value.length === 10 ? 'T00:00:00' : ''))) : '';
  const field = (name, label, value, type = 'text', required = false) => '<label class="family-field">' + label + (required ? ' *' : '') + '<input class="field" name="' + name + '" type="' + type + '" value="' + escape(value) + '"' + (required ? ' required' : '') + '></label>';
  const area = (name, label, value) => '<label class="family-field family-wide">' + label + '<textarea class="field" name="' + name + '">' + escape(value) + '</textarea></label>';
  const message = (text, type) => '<p class="family-message ' + (type || '') + '" role="status">' + escape(text) + '</p>';

  async function authorizedUser() {
    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (!user) return null;
    const rpc = await client.rpc('is_admin');
    return rpc.error || rpc.data !== true ? null : user;
  }

  function addNavigation() {
    if (nav.querySelector('[data-family-view]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'family';
    button.dataset.familyView = 'true';
    button.textContent = 'Family 👨‍👩‍👧‍👦';
    nav.appendChild(button);
  }

  function activateView() {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view !== state.view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'family'));
    document.getElementById('title').textContent = 'Family';
    document.getElementById('side')?.classList.remove('open');
  }

  function visibleRows() {
    const query = String(state.view?.querySelector('[data-family-search]')?.value || '').trim().toLowerCase();
    const relation = state.view?.querySelector('[data-family-relation]')?.value || '';
    return state.rows.filter(row => (!relation || row.relation === relation) && (!query || [row.name, row.relation, row.phone, row.email].join(' ').toLowerCase().includes(query)));
  }

  function card(row) {
    const image = row.signedPhoto ? '<img src="' + escape(row.signedPhoto) + '" alt="" class="family-avatar">' : '<div class="family-avatar family-avatar-fallback" aria-hidden="true">' + escape((row.name || '?').trim().charAt(0).toUpperCase()) + '</div>';
    const details = [['relation', row.relation], ['date', dateText(row.date_of_birth)], ['phone', row.phone], ['email', row.email], ['address', row.address], ['occupation', row.occupation], ['notes', row.notes]]
      .filter(item => item[1]).map(item => '<div class="family-detail"><span>' + escape(item[0] === 'date' ? 'Date of birth' : item[0]) + '</span><strong>' + escape(item[1]) + '</strong></div>').join('');
    return '<article class="family-card"><div class="family-card-head">' + image + '<div><h3>' + escape(row.name) + '</h3><p>' + escape(row.relation || 'Family member') + '</p></div></div><div class="family-details">' + details + '</div><div class="family-actions"><button type="button" data-family-view-member="' + escape(row.id) + '">View</button><button type="button" data-family-edit="' + escape(row.id) + '">Edit</button><button type="button" data-family-delete="' + escape(row.id) + '">Delete</button></div></article>';
  }

  function paint() {
    const list = state.view.querySelector('[data-family-list]');
    const rows = visibleRows();
    state.view.querySelector('[data-family-count]').textContent = state.rows.length + (state.rows.length === 1 ? ' member' : ' members');
    if (!rows.length) { list.innerHTML = '<div class="family-empty"><h3>' + (state.rows.length ? 'No matching family members' : 'No family members yet') + '</h3><p>' + (state.rows.length ? 'Try a different search or relation.' : 'Add a family member to keep private details together.') + '</p><button class="button primary" type="button" data-family-add>' + (state.rows.length ? 'Add Family Member' : 'Add Your First Family Member') + '</button></div>'; return; }
    list.innerHTML = rows.map(card).join('');
  }

  async function fetchRows() {
    state.view.querySelector('[data-family-state]').innerHTML = '<div class="family-loading">Loading Family Details...</div>';
    const result = await client.from('family_details').select('*').order('created_at', { ascending: false });
    if (result.error) { state.view.querySelector('[data-family-state]').innerHTML = '<div class="family-error">Unable to load Family Details. Please run the migration, then try again.<button class="button" type="button" data-family-refresh>Retry</button></div>'; return; }
    state.rows = await Promise.all((result.data || []).map(async row => {
      if (!row.photo_url) return row;
      const signed = await client.storage.from(FAMILY_BUCKET).createSignedUrl(row.photo_url, 300);
      return { ...row, signedPhoto: signed.error ? '' : signed.data.signedUrl };
    }));
    state.view.querySelector('[data-family-state]').innerHTML = '<div data-family-list class="family-grid"></div>';
    paint();
  }

  function closeDialog() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = '';
    if (overlay) overlay.hidden = true;
  }

  function openDialog(title, html) {
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    overlay.hidden = false;
  }

  function formMarkup(row) {
    const relationOptions = ['<option value="">Select relation</option>'].concat(RELATIONS.map(item => '<option value="' + item + '"' + (row?.relation === item ? ' selected' : '') + '>' + item + '</option>')).join('');
    const photo = row?.signedPhoto ? '<img class="family-photo-preview" data-family-photo-preview src="' + escape(row.signedPhoto) + '" alt="Current family photo">' : '<div class="family-photo-preview family-photo-empty" data-family-photo-preview>No photo selected</div>';
    return '<form class="form family-form" data-family-form><div class="family-form-grid">' + field('name', 'Name', row?.name, 'text', true) + '<label class="family-field">Relation *<select class="field" name="relation" required>' + relationOptions + '</select></label>' + field('date_of_birth', 'Date of Birth', row?.date_of_birth, 'date') + field('phone', 'Phone', row?.phone, 'tel') + field('email', 'Email', row?.email, 'email') + field('occupation', 'Occupation', row?.occupation) + area('address', 'Address', row?.address) + area('notes', 'Notes', row?.notes) + '<label class="family-field family-wide">Photo<input class="field" name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="muted">Private image, up to 5 MB.</small></label><div class="family-photo-wrap family-wide">' + photo + (row?.photo_url ? '<button type="button" class="button" data-family-remove-photo>Remove Photo</button>' : '') + '</div></div><p data-family-form-message></p><div class="family-form-actions"><button type="button" class="button" data-family-cancel>Cancel</button><button type="submit" class="button primary" data-family-save>Save Family Member</button></div></form>';
  }

  function openForm(row) {
    openDialog(row ? 'Edit Family Member' : 'Add Family Member', formMarkup(row));
    const form = dialogBody.querySelector('[data-family-form]');
    const input = form.elements.photo;
    const preview = form.querySelector('[data-family-photo-preview]');
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { form.querySelector('[data-family-form-message]').innerHTML = message('Choose a PNG, JPG, WEBP or GIF image up to 5 MB.', 'error'); input.value = ''; return; }
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = URL.createObjectURL(file);
      preview.outerHTML = '<img class="family-photo-preview" data-family-photo-preview src="' + state.objectUrl + '" alt="Selected family photo">';
    });
    form.querySelector('[data-family-cancel]').onclick = closeDialog;
    form.querySelector('[data-family-remove-photo]')?.addEventListener('click', () => { form.dataset.removePhoto = 'true'; preview.outerHTML = '<div class="family-photo-preview family-photo-empty" data-family-photo-preview>No photo selected</div>'; });
    form.onsubmit = event => saveForm(event, row);
  }

  async function saveForm(event, row) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[data-family-save]');
    const status = form.querySelector('[data-family-form-message]');
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const relation = String(data.get('relation') || '').trim();
    if (!name || !relation) { status.innerHTML = message('Name and relation are required.', 'error'); return; }
    if (data.get('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get('email')))) { status.innerHTML = message('Enter a valid email address.', 'error'); return; }
    button.disabled = true; button.textContent = 'Saving...';
    let photoPath = row?.photo_url || null;
    let uploadedPath = '';
    try {
      const user = await authorizedUser();
      if (!user) throw new Error('Admin authorization required.');
      const file = data.get('photo');
      if (file?.name) { uploadedPath = user.id + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const upload = await client.storage.from(FAMILY_BUCKET).upload(uploadedPath, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error; photoPath = uploadedPath; }
      if (form.dataset.removePhoto === 'true') photoPath = null;
      const payload = { name, relation, date_of_birth: data.get('date_of_birth') || null, phone: String(data.get('phone') || '').trim() || null, email: String(data.get('email') || '').trim() || null, address: String(data.get('address') || '').trim() || null, occupation: String(data.get('occupation') || '').trim() || null, notes: String(data.get('notes') || '').trim() || null, photo_url: photoPath };
      const result = row ? await client.from('family_details').update(payload).eq('id', row.id) : await client.from('family_details').insert({ ...payload, created_by: user.id });
      if (result.error) throw result.error;
      if (row?.photo_url && photoPath !== row.photo_url) await client.storage.from(FAMILY_BUCKET).remove([row.photo_url]);
      closeDialog(); await fetchRows(); toast(row ? 'Family member updated.' : 'Family member added.');
    } catch (error) { if (uploadedPath) await client.storage.from(FAMILY_BUCKET).remove([uploadedPath]); status.innerHTML = message('Could not save Family Details.', 'error'); console.error(error); button.disabled = false; button.textContent = 'Save Family Member'; }
  }

  function showDetails(row) {
    openDialog(row.name, '<div class="family-detail-dialog">' + (row.signedPhoto ? '<img class="family-detail-photo" src="' + escape(row.signedPhoto) + '" alt="' + escape(row.name) + '">' : '') + '<h3>' + escape(row.name) + '</h3><p class="muted">' + escape(row.relation || 'Family member') + '</p><div class="family-detail-list">' + [['Date of Birth', dateText(row.date_of_birth)], ['Phone', row.phone], ['Email', row.email], ['Address', row.address], ['Occupation', row.occupation], ['Notes', row.notes]].filter(item => item[1]).map(item => '<p><strong>' + item[0] + '</strong><span>' + escape(item[1]) + '</span></p>').join('') + '</div><div class="family-form-actions"><button type="button" class="button" data-family-cancel>Close</button><button type="button" class="button primary" data-family-edit="' + escape(row.id) + '">Edit</button></div></div>');
    dialogBody.querySelector('[data-family-cancel]').onclick = closeDialog;
  }

  async function deleteRow(row) {
    if (!window.confirm('Delete Family Member?\n\nAre you sure you want to delete this family member? This action cannot be undone.')) return;
    const result = await client.from('family_details').delete().eq('id', row.id);
    if (result.error) { toast('Could not delete Family Details.', true); return; }
    if (row.photo_url) await client.storage.from(FAMILY_BUCKET).remove([row.photo_url]);
    await fetchRows(); toast('Family member deleted.');
  }

  async function showFamily() {
    const user = await authorizedUser();
    if (!user) { window.location.replace('../index.html#admin-login'); return; }
    state.user = user;
    if (!state.view) { state.view = document.createElement('section'); state.view.id = 'familyView'; state.view.className = 'view'; main.appendChild(state.view); }
    state.view.innerHTML = '<div class="family-page"><div class="family-toolbar"><div><span class="eyebrow">Private admin area</span><h2>Family Details</h2><p class="muted">Manage private family information securely.</p></div><button class="button primary" type="button" data-family-add>Add Family Member</button></div><div class="family-controls"><strong data-family-count>0 members</strong><input class="field" data-family-search type="search" placeholder="Search family members" aria-label="Search family members"><select class="field" data-family-relation aria-label="Filter by relation"><option value="">All Relations</option>' + RELATIONS.map(item => '<option>' + item + '</option>').join('') + '</select><button class="button" type="button" data-family-refresh>Refresh</button></div><div data-family-state><div class="family-loading">Loading Family Details...</div></div></div>';
    activateView();
    state.view.querySelector('[data-family-search]').oninput = paint;
    state.view.querySelector('[data-family-relation]').onchange = paint;
    await fetchRows();
  }

  function clearFamily() { state.rows = []; if (state.view) { state.view.innerHTML = ''; state.view.hidden = true; } }
  function toast(text, error) { const node = document.getElementById('toast'); if (!node) return; node.textContent = text; node.className = error ? 'error' : ''; node.hidden = false; window.setTimeout(() => { node.hidden = true; }, 3500); }

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-family-view]');
    const add = event.target.closest('[data-family-add]');
    const edit = event.target.closest('[data-family-edit]');
    const view = event.target.closest('[data-family-view-member]');
    const remove = event.target.closest('[data-family-delete]');
    const refresh = event.target.closest('[data-family-refresh]');
    if (!viewButton && !add && !edit && !view && !remove && !refresh) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (viewButton) { window.location.hash = 'family'; showFamily(); return; }
    if (add) { openForm(); return; }
    if (refresh) { fetchRows(); return; }
    const row = state.rows.find(item => item.id === (edit || view || remove).dataset.familyEdit || (view && view.dataset.familyViewMember) || (remove && remove.dataset.familyDelete));
    if (!row) return;
    if (edit) openForm(row); else if (view) showDetails(row); else deleteRow(row);
  }, true);

  client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) clearFamily(); });
  addNavigation();
  if (window.location.hash === '#family') showFamily();
}());
