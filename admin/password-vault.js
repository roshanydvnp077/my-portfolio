(function () {
  'use strict';

  const client = window.supabaseClient;
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.main');
  const overlay = document.getElementById('overlay');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');
  const categories = ['Email', 'Social', 'Website', 'Developer', 'Hosting', 'Other'];
  const state = { user: null, view: null, rows: [], revealed: new Set() };

  if (!client || !nav || !main) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
  const toast = (text, error) => { const node = document.getElementById('toast'); if (!node) return; node.textContent = text; node.className = error ? 'error' : ''; node.hidden = false; window.setTimeout(() => { node.hidden = true; }, 3500); };
  const safeError = () => 'The Password Vault request could not be completed.';

  async function currentAdmin() {
    const result = await client.auth.getUser();
    const user = result.data?.user;
    if (result.error || !user) return null;
    const admin = await client.rpc('is_admin');
    return admin.error || admin.data !== true ? null : user;
  }

  function addNavigation() {
    if (nav.querySelector('[data-password-vault-view]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'password-vault';
    button.dataset.passwordVaultView = 'true';
    button.textContent = 'Password Vault 🔐';
    nav.appendChild(button);
  }

  function activate() {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view !== state.view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'password-vault'));
    document.getElementById('title').textContent = 'Password Vault';
    document.getElementById('side')?.classList.remove('open');
  }

  function closeDialog() {
    if (!overlay) return;
    const active = document.activeElement;
    if (active && overlay.contains(active)) active.blur();
    overlay.hidden = true;
  }

  function openDialog(title, html) {
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    overlay.hidden = false;
  }

  function categoryOptions(selected) {
    return categories.map(category => '<option value="' + category + '"' + (category === selected ? ' selected' : '') + '>' + category + '</option>').join('');
  }

  function field(name, label, value, type = 'text', required = false) {
    return '<label class="vault-field">' + label + (required ? ' *' : '') + '<input class="field" name="' + name + '" type="' + type + '" value="' + escape(value) + '"' + (required ? ' required' : '') + '></label>';
  }

  function textarea(name, label, value) {
    return '<label class="vault-field vault-field-wide">' + label + '<textarea class="field" name="' + name + '">' + escape(value) + '</textarea></label>';
  }

  function passwordForm(row) {
    openDialog(row ? 'Edit Credential' : 'Add Credential', '<form class="form vault-form" data-password-form>' + field('title', 'Title', row?.title, 'text', true) + field('username', 'Username / ID', row?.username) + field('password', 'Password', '', 'password', true) + field('website', 'Website', row?.website, 'url') + '<label class="vault-field">Category<select class="field" name="category">' + categoryOptions(row?.category || 'Other') + '</select></label>' + textarea('notes', 'Notes', row?.notes) + '<p class="status full" data-password-form-message role="status"></p><div class="family-form-actions vault-form-actions"><button type="button" class="button" data-password-cancel>Cancel</button><button type="submit" class="button primary" data-password-save>Save Credential</button></div></form>');
    const form = dialogBody.querySelector('[data-password-form]');
    form.elements.password.value = row?.password || '';
    form.querySelector('[data-password-cancel]').onclick = closeDialog;
    form.onsubmit = event => saveCredential(event, row);
  }

  async function saveCredential(event, row) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('[data-password-form-message]');
    const button = form.querySelector('[data-password-save]');
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const password = String(data.get('password') || '').trim();
    if (!title || !password) { message.textContent = 'Title and Password are required.'; message.className = 'status full error'; return; }
    button.disabled = true;
    button.textContent = 'Saving...';
    try {
      const user = await currentAdmin();
      if (!user) { window.location.replace('../index.html#admin-login'); return; }
      const payload = { user_id: user.id, title, username: String(data.get('username') || '').trim() || null, password, website: String(data.get('website') || '').trim() || null, category: String(data.get('category') || 'Other').trim() || 'Other', notes: String(data.get('notes') || '').trim() || null };
      const result = row
        ? await client.from('password_vault').update(payload).eq('id', row.id).eq('user_id', user.id)
        : await client.from('password_vault').insert(payload);
      if (result.error) throw result.error;
      closeDialog();
      await loadVault();
      toast(row ? 'Credential updated.' : 'Credential saved.');
    } catch (error) {
      message.textContent = safeError();
      message.className = 'status full error';
      button.disabled = false;
      button.textContent = 'Save Credential';
    }
  }

  function maskedPassword() { return '••••••••••'; }

  function card(row) {
    const revealed = state.revealed.has(row.id);
    const websiteUrl = String(row.website || '').trim();
    const website = websiteUrl ? (/^https?:\/\//i.test(websiteUrl) ? '<a href="' + escape(websiteUrl) + '" target="_blank" rel="noopener noreferrer">' + escape(websiteUrl) + '</a>' : escape(websiteUrl)) : '<span class="muted">No website</span>';
    return '<article class="password-card"><div class="password-card-heading"><div><span class="password-category">' + escape(row.category || 'Other') + '</span><h3>' + escape(row.title) + '</h3></div><button class="password-icon-button" type="button" data-password-edit="' + row.id + '" aria-label="Edit credential">✏️</button></div><dl class="password-details"><div><dt>Username / ID</dt><dd>' + escape(row.username || 'Not provided') + '</dd></div><div><dt>Website</dt><dd>' + website + '</dd></div><div><dt>Password</dt><dd class="password-value">' + (revealed ? escape(row.password) : maskedPassword()) + '</dd></div></dl><div class="password-actions"><button type="button" class="button" data-password-toggle="' + row.id + '">' + (revealed ? '🙈 Hide' : '👁 Show') + '</button><button type="button" class="button" data-password-copy="' + row.id + '">📋 Copy</button><button type="button" class="button" data-password-edit="' + row.id + '">✏️ Edit</button><button type="button" class="button danger" data-password-delete="' + row.id + '">🗑 Delete</button></div></article>';
  }

  function paint() {
    const list = state.view.querySelector('[data-password-list]');
    const query = String(state.view.querySelector('[data-password-search]').value || '').trim().toLowerCase();
    const category = state.view.querySelector('[data-password-category]').value;
    const rows = state.rows.filter(row => {
      const matchesCategory = !category || row.category === category;
      const searchable = [row.title, row.username, row.website, row.category].filter(Boolean).join(' ').toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
    list.innerHTML = rows.length ? rows.map(card).join('') : '<div class="password-empty"><div class="password-empty-icon">🔐</div><h3>' + (state.rows.length ? 'No credentials found.' : 'Your Password Vault is empty.') + '</h3><p>' + (state.rows.length ? 'Try another search or category.' : 'Add your first credential securely.') + '</p><button class="button primary" type="button" data-password-add>＋ Add Credential</button></div>';
  }

  async function loadVault() {
    const user = await currentAdmin();
    if (!user) { state.rows = []; state.revealed.clear(); if (state.view) state.view.hidden = true; window.location.replace('../index.html#admin-login'); return; }
    state.user = user;
    const result = await client.from('password_vault').select('id,user_id,title,username,password,website,category,notes,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false });
    if (result.error) { toast('Could not load Password Vault.', true); return; }
    state.rows = result.data || [];
    state.revealed.clear();
    paint();
  }

  async function copyPassword(id) {
    const row = state.rows.find(item => item.id === id);
    if (!row) return;
    if (!navigator.clipboard?.writeText) { toast('Clipboard is unavailable on this device.', true); return; }
    try { await navigator.clipboard.writeText(row.password); toast('Password copied.'); } catch { toast('Could not copy the password.', true); }
  }

  async function deleteCredential(id) {
    if (!window.confirm('Are you sure you want to delete this credential?')) return;
    const user = await currentAdmin();
    if (!user) { window.location.replace('../index.html#admin-login'); return; }
    const result = await client.from('password_vault').delete().eq('id', id).eq('user_id', user.id);
    if (result.error) { toast('Could not delete this credential.', true); return; }
    await loadVault();
    toast('Credential deleted.');
  }

  function show() {
    if (!state.view) { state.view = document.createElement('section'); state.view.id = 'passwordVaultView'; state.view.className = 'view'; main.appendChild(state.view); }
    state.view.innerHTML = '<div class="password-vault-page"><div class="password-vault-header"><div><span class="eyebrow">Private admin area</span><h2>Password Vault</h2><p class="muted">Secure credentials for your personal accounts.</p></div><button class="button primary" type="button" data-password-add>＋ Add Credential</button></div><div class="password-vault-controls"><input class="field" data-password-search type="search" placeholder="Search credentials..." aria-label="Search credentials"><select class="field" data-password-category aria-label="Filter by category"><option value="">All</option>' + categoryOptions() + '</select></div><div data-password-list class="password-grid"></div></div>';
    activate();
    state.view.querySelector('[data-password-search]').addEventListener('input', paint);
    state.view.querySelector('[data-password-search]').addEventListener('search', paint);
    state.view.querySelector('[data-password-category]').addEventListener('change', paint);
    loadVault();
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-password-vault-view], [data-password-add], [data-password-toggle], [data-password-copy], [data-password-edit], [data-password-delete]');
    if (!action) return;
    if (action.matches('[data-password-vault-view]')) { event.preventDefault(); event.stopImmediatePropagation(); show(); return; }
    if (action.matches('[data-password-add]')) { event.preventDefault(); event.stopImmediatePropagation(); passwordForm(); return; }
    const id = action.dataset.passwordToggle || action.dataset.passwordCopy || action.dataset.passwordEdit || action.dataset.passwordDelete;
    const row = state.rows.find(item => item.id === id);
    if (!row) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action.matches('[data-password-toggle]')) { state.revealed.has(id) ? state.revealed.delete(id) : state.revealed.add(id); paint(); }
    else if (action.matches('[data-password-copy]')) copyPassword(id);
    else if (action.matches('[data-password-edit]')) passwordForm(row);
    else if (action.matches('[data-password-delete]')) deleteCredential(id);
  }, true);

  client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) { state.rows = []; state.revealed.clear(); if (state.view) state.view.hidden = true; } });
  addNavigation();
  if (window.location.hash === '#password-vault') show();
}());
