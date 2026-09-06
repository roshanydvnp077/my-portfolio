(function () {
  'use strict';

  const client = window.supabaseClient;
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.main');
  const overlay = document.getElementById('overlay');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');
  const bucket = 'portfolio-images';
  const state = { user: null, view: null, rows: [], query: '', filter: 'all', sort: 'order' };
  if (!client || !nav || !main) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
  const toast = (text, error) => { const node = document.getElementById('toast'); if (!node) return; node.textContent = text; node.className = error ? 'error' : ''; node.hidden = false; window.setTimeout(() => { node.hidden = true; }, 3500); };
  const uuid = () => window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const imageUrl = value => value ? (/^https?:\/\//i.test(value) ? value : client.storage.from(bucket).getPublicUrl(value).data.publicUrl) : '';
  const normalized = row => ({ ...row, full_name: row.full_name || row.name || '', profile_image: row.profile_image || row.photo || '', role: row.role || row.position || '', review: row.review || row.message || '', display_order: Number(row.display_order ?? row.sort_order ?? 0), is_featured: Boolean(row.is_featured), is_published: Boolean(row.is_published) });
  const currentAdmin = async () => { const session = await client.auth.getSession(); const user = session.data.session?.user; if (!user) return null; const result = await client.rpc('is_admin'); return result.error || result.data !== true ? null : user; };
  const close = () => { if (overlay) overlay.hidden = true; };
  const schemaError = error => error?.code === 'PGRST204' || error?.code === '42703' || /column .* does not exist|schema cache/i.test(error?.message || '');

  function addNavigation() {
    if (nav.querySelector('[data-testimonials-view]')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.view = 'testimonials'; button.dataset.testimonialsView = 'true'; button.textContent = 'Testimonials'; nav.appendChild(button);
  }

  function activate() {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view !== state.view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'testimonials'));
    document.getElementById('title').textContent = 'Testimonials';
    document.getElementById('side')?.classList.remove('open');
  }

  function formField(name, label, value, type = 'text', required = false) { return '<label class="testimonial-field">' + label + (required ? ' *' : '') + '<input class="field" name="' + name + '" type="' + type + '" value="' + escape(value) + '"' + (required ? ' required' : '') + '></label>'; }
  function rowAvatar(row, large = false) { const url = imageUrl(row.profile_image); return url ? '<img class="testimonial-avatar' + (large ? ' large' : '') + '" src="' + escape(url) + '" alt="">' : '<span class="testimonial-avatar testimonial-avatar-fallback' + (large ? ' large' : '') + '">' + escape(initials(row.full_name)) + '</span>'; }
  function stars(rating) { return '<span class="testimonial-stars" aria-label="' + rating + ' out of 5 stars">' + '★'.repeat(Math.max(0, Math.min(5, Number(rating || 0)))) + '<span>' + '★'.repeat(Math.max(0, 5 - Number(rating || 0))) + '</span></span>'; }

  function filteredRows() {
    const query = state.query.toLowerCase();
    const rows = state.rows.filter(row => {
      const matchesQuery = !query || [row.full_name, row.role, row.company, row.review].join(' ').toLowerCase().includes(query);
      const matchesFilter = state.filter === 'all' || state.filter === 'published' && row.is_published || state.filter === 'hidden' && !row.is_published || state.filter === 'featured' && row.is_featured || state.filter === 'not-featured' && !row.is_featured;
      return matchesQuery && matchesFilter;
    });
    return rows.sort((left, right) => state.sort === 'newest' ? new Date(right.created_at) - new Date(left.created_at) : state.sort === 'name' ? left.full_name.localeCompare(right.full_name) : left.display_order - right.display_order || new Date(right.created_at) - new Date(left.created_at));
  }

  function card(row) {
    return '<article class="testimonial-admin-card"><div class="testimonial-admin-head">' + rowAvatar(row) + '<div class="testimonial-admin-identity"><h3>' + escape(row.full_name) + '</h3><p>' + escape([row.role, row.company].filter(Boolean).join(' · ') || 'No role or company') + '</p></div><div class="testimonial-admin-badges"><span class="testimonial-status ' + (row.is_published ? 'published' : 'hidden') + '">' + (row.is_published ? 'Published' : 'Hidden') + '</span>' + (row.is_featured ? '<span class="testimonial-featured">Featured</span>' : '') + '</div></div><div class="testimonial-admin-rating">' + stars(row.rating) + '</div><p class="testimonial-preview">' + escape(row.review) + '</p><div class="testimonial-admin-meta"><span>' + escape(row.location || 'No location') + '</span><span>Order ' + row.display_order + '</span></div><div class="testimonial-admin-actions"><button class="button" data-testimonial-view="' + row.id + '">View</button><button class="button" data-testimonial-edit="' + row.id + '">Edit</button><button class="button" data-testimonial-publish="' + row.id + '">' + (row.is_published ? 'Hide' : 'Publish') + '</button><button class="button" data-testimonial-feature="' + row.id + '">' + (row.is_featured ? 'Unfeature' : 'Feature') + '</button><button class="button danger" data-testimonial-delete="' + row.id + '">Delete</button></div></article>';
  }

  function paint() {
    const list = state.view.querySelector('[data-testimonial-list]');
    const rows = filteredRows();
    state.view.querySelector('[data-testimonial-total]').textContent = state.rows.length;
    state.view.querySelector('[data-testimonial-published]').textContent = state.rows.filter(row => row.is_published).length;
    state.view.querySelector('[data-testimonial-hidden]').textContent = state.rows.filter(row => !row.is_published).length;
    state.view.querySelector('[data-testimonial-featured]').textContent = state.rows.filter(row => row.is_featured).length;
    list.innerHTML = rows.length ? rows.map(card).join('') : '<div class="testimonial-empty"><span>✦</span><h3>' + (state.rows.length ? 'No testimonials found' : 'No Testimonials Yet') + '</h3><p>' + (state.rows.length ? 'Try another search or filter.' : 'Add your first testimonial to showcase client feedback.') + '</p><button class="button primary" data-testimonial-add>＋ Add Testimonial</button></div>';
  }

  async function load() {
    state.view.querySelector('[data-testimonial-list]').innerHTML = '<div class="testimonial-loading">Loading testimonials...</div>';
    const result = await client.from('testimonials').select('*').order('display_order', { ascending: true }).order('created_at', { ascending: false });
    if (result.error) { state.view.querySelector('[data-testimonial-list]').innerHTML = '<div class="testimonial-error">Unable to load testimonials. Please try again.</div>'; return; }
    state.rows = (result.data || []).map(normalized); paint();
  }

  function openForm(row) {
    const image = row?.profile_image ? '<img class="testimonial-form-preview" data-testimonial-preview src="' + escape(imageUrl(row.profile_image)) + '" alt="Current profile photo">' : '<span class="testimonial-form-preview testimonial-avatar-fallback" data-testimonial-preview>' + escape(initials(row?.full_name)) + '</span>';
    dialogTitle.textContent = row ? 'Edit Testimonial' : 'Add Testimonial';
    dialogBody.innerHTML = '<form class="form testimonial-form" data-testimonial-form><p class="testimonial-form-intro">' + (row ? 'Update the client feedback shown in your portfolio.' : 'Add client feedback to your portfolio.') + '</p><section class="testimonial-form-section"><h3>Client Information</h3><div class="testimonial-form-photo"><div>' + image + '</div><label class="testimonial-field">Profile Photo<input class="field" name="profile_image" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted">JPG, PNG or WEBP up to 5 MB.</small></label></div><div class="testimonial-form-grid">' + formField('full_name','Full Name',row?.full_name,'text',true) + formField('role','Job Title / Role',row?.role) + formField('company','Company / Organization',row?.company) + formField('location','Location',row?.location) + formField('website_url','Website URL',row?.website_url,'url') + formField('linkedin_url','LinkedIn URL',row?.linkedin_url,'url') + '</div></section><section class="testimonial-form-section"><h3>Testimonial</h3><div class="testimonial-form-grid"><label class="testimonial-field testimonial-field-wide">Review / Message *<textarea class="field" name="review" required>' + escape(row?.review) + '</textarea></label><label class="testimonial-field">Rating *<select class="field" name="rating" required>' + [1,2,3,4,5].map(value => '<option value="' + value + '"' + (Number(row?.rating || 5) === value ? ' selected' : '') + '>' + value + ' Star' + (value === 1 ? '' : 's') + '</option>').join('') + '</select></label></div></section><section class="testimonial-form-section"><h3>Display Settings</h3><div class="testimonial-form-grid"><label class="testimonial-toggle"><input name="is_published" type="checkbox"' + (row?.is_published !== false ? ' checked' : '') + '><span>Published</span></label><label class="testimonial-toggle"><input name="is_featured" type="checkbox"' + (row?.is_featured ? ' checked' : '') + '><span>Featured</span></label>' + formField('display_order','Display Order',row?.display_order || 0,'number') + '</div></section><p class="status full" data-testimonial-form-message role="status"></p><div class="family-form-actions testimonial-form-actions"><button type="button" class="button" data-testimonial-cancel>Cancel</button><button type="submit" class="button primary">Save Testimonial</button></div></form>';
    overlay.hidden = false;
    const form = dialogBody.querySelector('[data-testimonial-form]');
    const preview = form.querySelector('[data-testimonial-preview]');
    form.elements.profile_image.onchange = () => { const file = form.elements.profile_image.files[0]; if (!file) return; if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { form.querySelector('[data-testimonial-form-message]').textContent = 'Choose a JPG, PNG or WEBP image up to 5 MB.'; form.elements.profile_image.value = ''; return; } preview.outerHTML = '<img class="testimonial-form-preview" data-testimonial-preview src="' + escape(URL.createObjectURL(file)) + '" alt="Selected profile photo">'; };
    form.querySelector('[data-testimonial-cancel]').onclick = close;
    form.onsubmit = event => save(event, row);
  }

  async function save(event, row) {
    event.preventDefault();
    const form = event.currentTarget; const data = new FormData(form); const message = form.querySelector('[data-testimonial-form-message]'); const button = form.querySelector('button[type="submit"]');
    const name = String(data.get('full_name') || '').trim(); const review = String(data.get('review') || '').trim(); const rating = Number(data.get('rating'));
    if (!name || !review || rating < 1 || rating > 5) { message.textContent = 'Full Name, Review and a rating from 1 to 5 are required.'; message.className = 'status full error'; return; }
    for (const field of ['website_url', 'linkedin_url']) { const value = String(data.get(field) || '').trim(); if (value) { try { new URL(value); } catch { message.textContent = 'Enter valid Website and LinkedIn URLs.'; message.className = 'status full error'; return; } } }
    button.disabled = true; button.textContent = 'Saving...'; let uploaded = '';
    try {
      const user = await currentAdmin(); if (!user) throw new Error('Admin session expired.');
      let photo = row?.profile_image || null; const file = data.get('profile_image');
      if (file?.name) { uploaded = user.id + '/testimonials/' + uuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const upload = await client.storage.from(bucket).upload(uploaded, file, { contentType: file.type, upsert: false }); if (upload.error) { console.warn('Testimonial photo upload skipped:', upload.error); uploaded = ''; } else photo = uploaded; }
      const payload = { name, full_name: name, position: String(data.get('role') || '').trim(), role: String(data.get('role') || '').trim(), company: String(data.get('company') || '').trim(), location: String(data.get('location') || '').trim(), message: review, review, rating, website_url: String(data.get('website_url') || '').trim() || null, linkedin_url: String(data.get('linkedin_url') || '').trim() || null, photo, profile_image: photo, sort_order: Number(data.get('display_order') || 0), display_order: Number(data.get('display_order') || 0), is_published: data.has('is_published'), is_featured: data.has('is_featured') };
      const legacyPayload = { person_name: name, name, position: [String(data.get('role') || '').trim(), String(data.get('company') || '').trim(), String(data.get('location') || '').trim()].filter(Boolean).join(' · '), message: review, review, rating, photo, sort_order: Number(data.get('display_order') || 0), is_published: data.has('is_published'), created_by: user.id };
      let result = row ? await client.from('testimonials').update(legacyPayload).eq('id', row.id) : await client.from('testimonials').insert(legacyPayload);
      if (result.error) throw result.error;
      const savedId = row?.id;
      if (savedId) {
        const canonical = await client.from('testimonials').update({ full_name: name, profile_image: photo, role: String(data.get('role') || '').trim(), company: String(data.get('company') || '').trim(), location: String(data.get('location') || '').trim(), review, website_url: String(data.get('website_url') || '').trim() || null, linkedin_url: String(data.get('linkedin_url') || '').trim() || null, is_featured: data.has('is_featured'), display_order: Number(data.get('display_order') || 0) }).eq('id', savedId);
        if (canonical.error && !schemaError(canonical.error)) throw canonical.error;
      }
      if (uploaded && row?.profile_image && row.profile_image !== uploaded) await client.storage.from(bucket).remove([row.profile_image]);
      close(); await load(); toast(row ? 'Testimonial updated successfully.' : 'Testimonial added successfully.');
    } catch (error) { if (uploaded) await client.storage.from(bucket).remove([uploaded]); const missingColumn = error?.code === 'PGRST204' || error?.code === '42703' || /column .* does not exist|schema cache/i.test(error?.message || ''); const storageFailure = /storage|bucket|object/i.test((error?.message || '') + (error?.details || '')); const detail = [error?.code, error?.message, error?.details].filter(Boolean).join(' | '); message.textContent = missingColumn ? 'Testimonials database columns are not ready. Run testimonials-migration.sql in Supabase SQL Editor, then refresh.' : storageFailure ? 'Profile image storage is not ready. Run storage-buckets-fix.sql in Supabase SQL Editor, then try again.' : 'Unable to save testimonial' + (detail ? ': ' + detail : '. Please try again.'); message.className = 'status full error'; button.disabled = false; button.textContent = 'Save Testimonial'; console.error('Testimonial save failed:', error); }
  }

  function viewRow(row) { dialogTitle.textContent = row.full_name; dialogBody.innerHTML = '<div class="testimonial-view"><div class="testimonial-view-head">' + rowAvatar(row, true) + '<div><h3>' + escape(row.full_name) + '</h3><p>' + escape([row.role, row.company, row.location].filter(Boolean).join(' · ')) + '</p>' + stars(row.rating) + '</div></div><blockquote>' + escape(row.review) + '</blockquote><div class="family-form-actions"><button type="button" class="button" data-testimonial-cancel>Close</button></div></div>'; overlay.hidden = false; dialogBody.querySelector('[data-testimonial-cancel]').onclick = close; }
  async function toggle(id, field) { const row = state.rows.find(item => item.id === id); if (!row) return; const value = !row[field]; const result = await client.from('testimonials').update({ [field]: value }).eq('id', id); if (result.error) { toast('Could not update testimonial.', true); return; } await load(); toast(field === 'is_published' ? (value ? 'Testimonial published.' : 'Testimonial hidden.') : (value ? 'Testimonial featured.' : 'Testimonial unfeatured.')); }
  async function deleteRow(row) { if (!window.confirm('Delete this testimonial?')) return; const result = await client.from('testimonials').delete().eq('id', row.id); if (result.error) { toast('Could not delete testimonial.', true); return; } if (row.profile_image) await client.storage.from(bucket).remove([row.profile_image]); await load(); toast('Testimonial deleted successfully.'); }

  async function show() { const user = await currentAdmin(); if (!user) { window.location.replace('../index.html#admin-login'); return; } state.user = user; if (!state.view) { state.view = document.createElement('section'); state.view.id = 'testimonialsView'; state.view.className = 'view'; main.appendChild(state.view); } state.view.innerHTML = '<div class="testimonials-admin-page"><div class="testimonials-admin-header"><div><span class="eyebrow">Manage client feedback</span><h2>Testimonials</h2><p class="muted">Curate the words people share about your work.</p></div><button class="button primary" data-testimonial-add>＋ Add Testimonial</button></div><div class="testimonials-admin-stats"><div><span>Total Testimonials</span><b data-testimonial-total>0</b></div><div><span>Published</span><b data-testimonial-published>0</b></div><div><span>Hidden</span><b data-testimonial-hidden>0</b></div><div><span>Featured</span><b data-testimonial-featured>0</b></div></div><div class="testimonials-admin-controls"><input class="field" data-testimonial-search type="search" placeholder="Search name, role, company or review" aria-label="Search testimonials"><select class="field" data-testimonial-filter aria-label="Filter testimonials"><option value="all">All</option><option value="published">Published</option><option value="hidden">Hidden</option><option value="featured">Featured</option><option value="not-featured">Not Featured</option></select><select class="field" data-testimonial-sort aria-label="Sort testimonials"><option value="order">Display Order</option><option value="newest">Newest</option><option value="name">Name</option></select></div><div data-testimonial-list class="testimonials-admin-grid"></div></div>'; activate(); state.view.querySelector('[data-testimonial-search]').oninput = event => { state.query = event.target.value; paint(); }; state.view.querySelector('[data-testimonial-filter]').onchange = event => { state.filter = event.target.value; paint(); }; state.view.querySelector('[data-testimonial-sort]').onchange = event => { state.sort = event.target.value; paint(); }; await load(); }

  document.addEventListener('click', event => { const action = event.target.closest('[data-testimonials-view], [data-testimonial-add], [data-testimonial-view], [data-testimonial-edit], [data-testimonial-publish], [data-testimonial-feature], [data-testimonial-delete]'); if (!action) return; event.preventDefault(); event.stopImmediatePropagation(); if (action.matches('[data-testimonials-view]')) return show(); if (action.matches('[data-testimonial-add]')) return openForm(); const row = state.rows.find(item => item.id === (action.dataset.testimonialView || action.dataset.testimonialEdit || action.dataset.testimonialPublish || action.dataset.testimonialFeature || action.dataset.testimonialDelete)); if (!row) return; if (action.matches('[data-testimonial-view]')) viewRow(row); else if (action.matches('[data-testimonial-edit]')) openForm(row); else if (action.matches('[data-testimonial-publish]')) toggle(row.id, 'is_published'); else if (action.matches('[data-testimonial-feature]')) toggle(row.id, 'is_featured'); else deleteRow(row); }, true);
  client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) { state.rows = []; if (state.view) state.view.hidden = true; } });
  addNavigation(); if (window.location.hash === '#testimonials') show();
}());
