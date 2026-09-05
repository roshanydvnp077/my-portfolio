(function () {
  'use strict';

  const client = window.supabaseClient;
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.main');
  const overlay = document.getElementById('overlay');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');
  const bucket = 'bank-qr';
  const accountTypes = ['Savings', 'Current', 'Other'];
  const state = { user: null, view: null, row: null, qrUrl: '', revealed: false };
  if (!client || !nav || !main) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
  const toast = (text, error) => { const node = document.getElementById('toast'); if (!node) return; node.textContent = text; node.className = error ? 'error' : ''; node.hidden = false; window.setTimeout(() => { node.hidden = true; }, 3500); };
  const safeError = () => 'Could not complete the Bank Details request.';
  const errorMessage = error => error?.message || error?.details || error?.hint || safeError();
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

  async function currentAdmin() {
    const result = await client.auth.getUser();
    const user = result.data?.user;
    if (result.error || !user) return null;
    const admin = await client.rpc('is_admin');
    return admin.error || admin.data !== true ? null : user;
  }

  function addNavigation() {
    if (nav.querySelector('[data-bank-details-view]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'bank-details';
    button.dataset.bankDetailsView = 'true';
    button.textContent = 'Bank Details 🏦';
    nav.appendChild(button);
  }

  function activate() {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view !== state.view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'bank-details'));
    document.getElementById('title').textContent = 'Bank Details';
    document.getElementById('side')?.classList.remove('open');
  }

  function closeDialog() {
    const active = document.activeElement;
    if (active && overlay?.contains(active)) active.blur();
    if (overlay) overlay.hidden = true;
  }

  function openDialog(title, html) {
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    overlay.hidden = false;
  }

  const typeOptions = selected => accountTypes.map(type => '<option value="' + type + '"' + (type === selected ? ' selected' : '') + '>' + type + '</option>').join('');
  const field = (name, label, value, type = 'text', required = false) => '<label class="bank-field">' + label + (required ? ' *' : '') + '<input class="field" name="' + name + '" type="' + type + '" value="' + escape(value) + '"' + (required ? ' required' : '') + '></label>';

  function bankForm(row) {
    openDialog(row ? 'Edit Bank Details' : 'Add Bank Details', '<form class="form bank-form" data-bank-form>' + field('bank_name', 'Bank Name', row?.bank_name, 'text', true) + field('account_holder_name', 'Account Holder Name', row?.account_holder_name, 'text', true) + field('account_number', 'Account Number', '', 'text', true) + '<label class="bank-field">Account Type<select class="field" name="account_type">' + typeOptions(row?.account_type || 'Other') + '</select></label><label class="bank-field bank-field-wide">QR Code Image<input class="field" name="qr" type="file" accept="image/png,image/jpeg,image/webp"><small class="muted">PNG, JPG, JPEG or WEBP up to 5 MB.</small></label><p class="status full" data-bank-form-message role="status"></p><div class="family-form-actions bank-form-actions"><button type="button" class="button" data-bank-cancel>Cancel</button><button type="submit" class="button primary" data-bank-save>Save Bank Details</button></div></form>');
    const form = dialogBody.querySelector('[data-bank-form]');
    form.elements.account_number.value = row?.account_number || '';
    form.querySelector('[data-bank-cancel]').onclick = closeDialog;
    form.onsubmit = event => saveBank(event, row);
  }

  async function saveBank(event, row) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('[data-bank-form-message]');
    const button = form.querySelector('[data-bank-save]');
    const data = new FormData(form);
    const bankName = String(data.get('bank_name') || '').trim();
    const holder = String(data.get('account_holder_name') || '').trim();
    const accountNumber = String(data.get('account_number') || '').trim();
    const file = data.get('qr');
    if (!bankName || !holder || !accountNumber) { message.textContent = 'Bank Name, Account Holder Name and Account Number are required.'; message.className = 'status full error'; return; }
    if (file?.name && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { message.textContent = 'Choose a PNG, JPG or WEBP image up to 5 MB.'; message.className = 'status full error'; return; }
    button.disabled = true;
    button.textContent = 'Saving...';
    let uploadedPath = '';
    try {
      const user = await currentAdmin();
      if (!user) { window.location.replace('../index.html#admin-login'); return; }
      let qrPath = row?.qr_storage_path || null;
      if (file?.name) {
        uploadedPath = user.id + '/qr/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
        const upload = await client.storage.from(bucket).upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (upload.error) throw upload.error;
        qrPath = uploadedPath;
      }
      const payload = { user_id: user.id, bank_name: bankName, account_holder_name: holder, account_number: accountNumber, account_type: String(data.get('account_type') || 'Other'), qr_storage_path: qrPath };
      const result = row ? await client.from('bank_details').update(payload).eq('id', row.id).eq('user_id', user.id) : await client.from('bank_details').insert(payload).select().single();
      if (result.error) throw result.error;
      if (row?.qr_storage_path && qrPath !== row.qr_storage_path) await client.storage.from(bucket).remove([row.qr_storage_path]);
      closeDialog();
      await loadBank();
      toast(row ? 'Bank Details updated.' : 'Bank Details saved.');
    } catch (error) {
      console.error('Bank Details save failed:', error);
      if (uploadedPath) await client.storage.from(bucket).remove([uploadedPath]);
      message.textContent = errorMessage(error);
      message.className = 'status full error';
      button.disabled = false;
      button.textContent = 'Save Bank Details';
    }
  }

  function maskedAccount() {
    const value = String(state.row?.account_number || '');
    return value.length > 4 ? '••••••' + value.slice(-4) : '••••';
  }

  function paint() {
    if (!state.view) return;
    if (!state.row) {
      state.view.innerHTML = '<div class="bank-page"><div class="bank-empty"><div class="bank-empty-icon">🏦</div><h2>No Bank Details Added</h2><p class="muted">Add private bank information for your admin account.</p><button class="button primary" type="button" data-bank-add>＋ Add Bank Details</button></div></div>';
      activate();
      return;
    }
    const row = state.row;
    const account = state.revealed ? escape(row.account_number) : maskedAccount();
    const qr = state.qrUrl ? '<img class="bank-qr-image" src="' + escape(state.qrUrl) + '" alt="Private bank QR code">' : '<div class="bank-qr-empty">No bank QR uploaded</div>';
    state.view.innerHTML = '<div class="bank-page"><div class="bank-header"><div><span class="eyebrow">Private admin area</span><h2>Bank Details</h2><p class="muted">Visible only to the authenticated admin account.</p></div><button class="button primary" type="button" data-bank-edit>✏️ Edit</button></div><div class="bank-grid"><section class="bank-card"><div class="bank-card-title"><span>🏦</span><h3>Bank Information</h3></div><dl class="bank-details"><div><dt>Bank Name</dt><dd>' + escape(row.bank_name) + '</dd></div><div><dt>Account Holder Name</dt><dd>' + escape(row.account_holder_name) + '</dd></div><div><dt>Account Number</dt><dd class="bank-account-value">' + account + '</dd><div class="bank-account-actions"><button class="button" type="button" data-bank-toggle>' + (state.revealed ? '🙈 Hide' : '👁 Show') + '</button><button class="button" type="button" data-bank-copy>📋 Copy Account Number</button></div></div><div><dt>Account Type</dt><dd>' + escape(row.account_type || 'Other') + '</dd></div></dl><button class="button danger bank-delete-record" type="button" data-bank-delete>🗑 Delete Bank Details</button></section><section class="bank-card bank-qr-card"><div class="bank-card-title"><span>▦</span><h3>Bank QR Code</h3></div>' + qr + '<div class="bank-qr-actions"><button class="button" type="button" data-bank-upload>📤 Upload QR</button>' + (state.qrUrl ? '<button class="button danger" type="button" data-bank-delete-qr>🗑️ Delete QR</button>' : '') + '</div></section></div></div>';
    activate();
  }

  async function loadBank() {
    const user = await currentAdmin();
    if (!user) { state.row = null; state.qrUrl = ''; state.revealed = false; if (state.view) state.view.hidden = true; window.location.replace('../index.html#admin-login'); return; }
    state.user = user;
    const result = await client.from('bank_details').select('id,user_id,bank_name,account_holder_name,account_number,account_type,qr_storage_path,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (result.error) { toast('Could not load Bank Details.', true); return; }
    state.row = result.data || null;
    state.revealed = false;
    state.qrUrl = '';
    if (state.row?.qr_storage_path) {
      const signed = await client.storage.from(bucket).createSignedUrl(state.row.qr_storage_path, 120);
      if (!signed.error) state.qrUrl = signed.data.signedUrl;
    }
    paint();
  }

  async function copyAccount() {
    if (!state.row?.account_number || !navigator.clipboard?.writeText) { toast('Clipboard is unavailable on this device.', true); return; }
    try { await navigator.clipboard.writeText(state.row.account_number); toast('Account number copied.'); } catch { toast('Could not copy the account number.', true); }
  }

  async function deleteQr() {
    if (!state.row?.qr_storage_path || !window.confirm('Are you sure you want to delete this bank QR?')) return;
    const user = await currentAdmin();
    if (!user) { window.location.replace('../index.html#admin-login'); return; }
    const removed = await client.storage.from(bucket).remove([state.row.qr_storage_path]);
    if (removed.error) { toast('Could not delete the bank QR.', true); return; }
    const updated = await client.from('bank_details').update({ qr_storage_path: null }).eq('id', state.row.id).eq('user_id', user.id);
    if (updated.error) { toast('QR was removed, but Bank Details could not be updated.', true); return; }
    await loadBank();
    toast('Bank QR deleted.');
  }

  async function deleteBank() {
    if (!state.row || !window.confirm('Are you sure you want to delete all Bank Details?')) return;
    const user = await currentAdmin();
    if (!user) { window.location.replace('../index.html#admin-login'); return; }
    const result = await client.from('bank_details').delete().eq('id', state.row.id).eq('user_id', user.id);
    if (result.error) { toast('Could not delete Bank Details.', true); return; }
    if (state.row.qr_storage_path) await client.storage.from(bucket).remove([state.row.qr_storage_path]);
    state.row = null;
    state.qrUrl = '';
    state.revealed = false;
    paint();
    toast('Bank Details deleted.');
  }

  function show() {
    if (!state.view) { state.view = document.createElement('section'); state.view.id = 'bankDetailsView'; state.view.className = 'view'; main.appendChild(state.view); }
    activate();
    state.view.innerHTML = '<div class="bank-page"><div class="family-loading">Loading Bank Details...</div></div>';
    loadBank();
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-bank-details-view], [data-bank-add], [data-bank-edit], [data-bank-toggle], [data-bank-copy], [data-bank-upload], [data-bank-delete-qr], [data-bank-delete]');
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action.matches('[data-bank-details-view]')) return show();
    if (action.matches('[data-bank-add]') || action.matches('[data-bank-edit]')) return bankForm(state.row);
    if (action.matches('[data-bank-toggle]')) { state.revealed = !state.revealed; paint(); return; }
    if (action.matches('[data-bank-copy]')) return copyAccount();
    if (action.matches('[data-bank-upload]')) return bankForm(state.row);
    if (action.matches('[data-bank-delete-qr]')) return deleteQr();
    if (action.matches('[data-bank-delete]')) return deleteBank();
  }, true);

  client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) { state.row = null; state.qrUrl = ''; state.revealed = false; if (state.view) state.view.hidden = true; } });
  addNavigation();
  if (window.location.hash === '#bank-details') show();
}());
