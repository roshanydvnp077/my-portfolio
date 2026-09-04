(function () {
  'use strict';

  const client = window.supabaseClient;
  const galleryBucket = 'portfolio-gallery';
  const legacyBucket = 'portfolio-images';
  if (!client) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
  const errorText = error => [error?.message, error?.details, error?.hint].filter(Boolean).join(' | ');
  const pathFor = file => file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');

  async function adminUser() {
    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (!user) return null;
    const check = await client.rpc('is_admin');
    return check.error || check.data !== true ? null : user;
  }

  async function migrateLegacyRows(user) {
    const result = await client.from('gallery').select('id,file_path').like('file_path', user.id + '/%');
    if (result.error) return;
    for (const row of result.data || []) {
      const source = client.storage.from(legacyBucket).getPublicUrl(row.file_path).data.publicUrl;
      const response = await fetch(source);
      if (!response.ok) continue;
      const blob = await response.blob();
      const upload = await client.storage.from(galleryBucket).upload(row.file_path, blob, { contentType: blob.type, upsert: false });
      if (upload.error) continue;
      const update = await client.from('gallery').update({ file_path: row.file_path }).eq('id', row.id);
      if (!update.error) await client.storage.from(legacyBucket).remove([row.file_path]);
    }
  }

  async function signedRows() {
    const result = await client.from('gallery').select('*').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    return Promise.all((result.data || []).map(async row => {
      const signed = await client.storage.from(galleryBucket).createSignedUrl(row.file_path, 300);
      return { ...row, signedUrl: signed.error ? '' : signed.data.signedUrl };
    }));
  }

  function closeDialog() {
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.hidden = true;
  }

  function openUpload() {
    const overlay = document.getElementById('overlay');
    const body = document.getElementById('dialogBody');
    const title = document.getElementById('dialogTitle');
    if (!overlay || !body || !title) return;
    title.textContent = 'Upload Gallery Image';
    body.innerHTML = '<form id="privateGalleryUpload" class="form"><label>Title<input class="field" name="title" required></label><label>Category<input class="field" name="category"></label><label class="full">Description<textarea class="field" name="description"></textarea></label><label class="full">File<input class="field" name="file" type="file" accept="image/*" required></label><p class="status full" id="privateGalleryStatus"></p><button class="button primary full" type="submit">Upload</button></form>';
    overlay.hidden = false;
    document.getElementById('privateGalleryUpload').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.file.files[0];
      const button = form.querySelector('button');
      const status = document.getElementById('privateGalleryStatus');
      const user = await adminUser();
      if (!user || !file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        status.textContent = 'Choose an image up to 10 MB.';
        status.className = 'status full error';
        return;
      }
      button.disabled = true;
      const path = user.id + '/' + crypto.randomUUID() + '-' + pathFor(file);
      const upload = await client.storage.from(galleryBucket).upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) { status.textContent = errorText(upload.error); status.className = 'status full error'; button.disabled = false; return; }
      const insert = await client.from('gallery').insert({ title: form.title.value.trim(), category: form.category.value.trim(), description: form.description.value.trim(), file_path: path, created_by: user.id });
      if (insert.error) { await client.storage.from(galleryBucket).remove([path]); status.textContent = errorText(insert.error); status.className = 'status full error'; button.disabled = false; return; }
      closeDialog();
      document.querySelector('[data-view="gallery"]')?.click();
    });
  }

  async function preview(id) {
    const rows = await signedRows();
    const row = rows.find(item => item.id === id);
    if (row?.signedUrl) window.open(row.signedUrl, '_blank', 'noopener');
  }

  async function remove(id) {
    const rows = await signedRows();
    const row = rows.find(item => item.id === id);
    if (!row || !window.confirm('Delete this file permanently?')) return;
    const deleted = await client.from('gallery').delete().eq('id', id);
    if (deleted.error) return window.alert(errorText(deleted.error));
    const removed = await client.storage.from(galleryBucket).remove([row.file_path]);
    if (removed.error) window.alert(errorText(removed.error));
    document.querySelector('[data-view="gallery"]')?.click();
  }

  async function refreshImages() {
    const view = document.getElementById('galleryView');
    if (!view || view.hidden) return;
    const rows = await signedRows();
    view.querySelectorAll('.card img').forEach((image, index) => { image.src = rows[index]?.signedUrl || ''; });
  }

  document.addEventListener('click', event => {
    const upload = event.target.closest('[data-upload="gallery"]');
    const previewButton = event.target.closest('[data-preview="gallery"]');
    const deleteButton = event.target.closest('[data-file-delete="gallery"]');
    if (!upload && !previewButton && !deleteButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (upload) openUpload();
    if (previewButton) preview(previewButton.dataset.id);
    if (deleteButton) remove(deleteButton.dataset.id);
  }, true);

  const observer = new MutationObserver(() => refreshImages().catch(() => {}));
  observer.observe(document.body, { childList: true, subtree: true });
}());
