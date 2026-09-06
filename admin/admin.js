const adminHistoryScript = document.createElement('script');
adminHistoryScript.src = 'admin-history.js?v=20261003';
document.head.appendChild(adminHistoryScript);
const projectEditorScript = document.createElement('script');
projectEditorScript.src = 'project-editor.js?v=20261004';
document.head.appendChild(projectEditorScript);
const cmsScript = document.createElement('script');
cmsScript.src = 'cms.js?v=20260927';
document.head.appendChild(cmsScript);
const testimonialsScript = document.createElement('script');
testimonialsScript.src = 'testimonials.js?v=20260921';
document.head.appendChild(testimonialsScript);
const documentUploadScript = document.createElement('script');
documentUploadScript.src = 'document-upload.js?v=20260928';
document.head.appendChild(documentUploadScript);
const documentListScript = document.createElement('script');
documentListScript.src = 'document-list.js?v=20260929';
document.head.appendChild(documentListScript);
const galleryUploadScript = document.createElement('script');
galleryUploadScript.src = 'gallery-upload-v2.js?v=20261001';
document.head.appendChild(galleryUploadScript);
const galleryListScript = document.createElement('script');
galleryListScript.src = 'gallery-list.js?v=20261002';
document.head.appendChild(galleryListScript);
const responsiveStyles = document.createElement('link');
responsiveStyles.rel = 'stylesheet';
responsiveStyles.href = 'responsive.css?v=20260905';
document.head.appendChild(responsiveStyles);
const privateGalleryScript = document.createElement('script');
privateGalleryScript.src = 'private-gallery.js?v=20260905';
document.head.appendChild(privateGalleryScript);
const familyVaultScript = document.createElement('script');
familyVaultScript.src = 'family-vault.js?v=20260912';
document.head.appendChild(familyVaultScript);
const familyVaultEditScript = document.createElement('script');
familyVaultEditScript.src = 'family-vault-edit.js?v=20260910';
document.head.appendChild(familyVaultEditScript);
const passwordVaultScript = document.createElement('script');
passwordVaultScript.src = 'password-vault.js?v=20260922';
document.head.appendChild(passwordVaultScript);
const bankDetailsScript = document.createElement('script');
bankDetailsScript.src = 'bank-details.js?v=20260906';
document.head.appendChild(bankDetailsScript);
const adminFavicon = document.createElement('link');
adminFavicon.rel = 'icon';
adminFavicon.href = '../icons/favicon-32x32.png';
document.head.appendChild(adminFavicon);
(function () {
  'use strict';
  const client = window.supabaseClient;
  const get = id => document.getElementById(id);
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
  const field = (name, label, value, type = 'text') => '<label>' + label + '<input class="field" name="' + name + '" type="' + type + '" value="' + escape(value) + '"></label>';
  const uploadField = (name, label, value) => '<label>' + label + '<input class="field" name="' + name + '" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="muted">' + (value ? 'Current file: ' + escape(value) : 'No file uploaded') + '</small></label>';
  const area = (name, label, value) => '<label class="full">' + label + '<textarea class="field" name="' + name + '">' + escape(value) + '</textarea></label>';
  const group = (title, content) => '<section class="settings-section"><div class="toolbar"><h3>' + title + '</h3></div><div class="settings-grid">' + content + '</div></section>';
  async function renderSettings() {
    document.getElementById('side')?.classList.remove('open'); document.getElementById('adminMenuBackdrop')?.classList.remove('open'); document.body.classList.remove('admin-menu-open');
    let view = get('settingsView');
    if (!view) { view = document.createElement('section'); view.id = 'settingsView'; view.className = 'view'; document.querySelector('.main').appendChild(view); }
    document.querySelectorAll('.view').forEach(item => { item.hidden = item !== view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'settings'));
    get('title').textContent = 'Settings';
    const [siteResult, profileResult] = await Promise.all([client.from('site_settings').select('*').order('created_at', { ascending:false }).limit(1).maybeSingle(), client.from('profile').select('*').order('created_at', { ascending:false }).limit(1).maybeSingle()]);
    if (siteResult.error || profileResult.error) { view.innerHTML = '<div class="panel"><p class="status error">Unable to load settings.</p></div>'; return; }
    const site = siteResult.data || {}, profile = profileResult.data || {}, currentLoadingImage = site.appearance?.loading_image_url || '';
    view.innerHTML = '<div class="panel settings-panel"><div class="toolbar"><div><span class="eyebrow">Manage your portfolio</span><h2>Settings</h2></div><span class="muted">Changes apply to the public site immediately.</span></div><form id="portfolioSettingsForm" class="form">' +
      group('General', field('website_title', 'Website name', site.website_title) + field('hero_description', 'Tagline', site.hero_description) + uploadField('logo_url', 'Logo', site.logo_url) + uploadField('favicon_url', 'Favicon', site.favicon_url) + uploadField('profile_image', 'Profile image', profile.profile_image)) +
      group('Profile', field('name', 'Name', profile.name) + field('short_bio', 'Title', profile.short_bio) + field('location', 'Location', profile.location) + field('email', 'Email', profile.email, 'email') + area('about_text', 'Bio', profile.about_text) + field('resume', 'Resume URL', profile.resume)) +
      group('Social Links', field('github', 'GitHub', profile.github, 'url') + field('linkedin', 'LinkedIn', profile.linkedin, 'url') + field('instagram', 'Instagram', profile.instagram, 'url') + field('facebook', 'Facebook', profile.facebook, 'url') + field('other_links', 'Other links', profile.other_links)) +
      group('Homepage', field('hero_heading', 'Hero heading', site.hero_heading) + field('primary_button_text', 'Primary button', site.primary_button_text) + field('secondary_button_text', 'Secondary button', site.secondary_button_text) + field('og_image_url', 'Background image URL', site.og_image_url) + area('contact_availability', 'Availability', site.contact_availability)) +
      group('SEO', field('meta_title', 'Browser title', site.meta_title) + area('meta_description', 'Meta description', site.meta_description) + field('canonical_url', 'Canonical URL', site.canonical_url) + field('keywords', 'Keywords', site.keywords)) +
      '<div class="settings-actions"><p class="status" id="portfolioSettingsStatus"></p><button class="button primary" type="submit">Save Changes</button></div></form><div class="settings-links"><button class="button" data-view="skills">Manage Skills</button><button class="button" data-view="projects">Manage Projects</button><button class="button" data-view="visibility">Homepage Sections</button></div><section class="settings-section security-section"><div class="toolbar"><h3>Security</h3></div><form id="changePasswordForm" class="form"><label>Current Password<input class="field" name="current_password" type="password" autocomplete="current-password" required></label><label>New Password<input class="field" name="new_password" type="password" autocomplete="new-password" required></label><label>Confirm New Password<input class="field" name="confirm_password" type="password" autocomplete="new-password" required></label><div class="settings-actions"><p class="status" id="passwordStatus" role="status" aria-live="polite"></p><button class="button primary" type="submit">Change Password</button></div></form></section></div>';
    get('portfolioSettingsForm').onsubmit = async event => {
      event.preventDefault(); const form = event.currentTarget, data = new FormData(form), button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Saving...';
      const read = names => Object.fromEntries(names.map(name => [name, String(data.get(name) || '').trim()]));
      const siteFields = ['website_title','hero_description','logo_url','favicon_url','hero_heading','primary_button_text','secondary_button_text','og_image_url','contact_availability','meta_title','meta_description','canonical_url','keywords'];
      const profileFields = ['profile_image','name','short_bio','location','email','about_text','resume','github','linkedin','instagram','facebook','other_links'];
      const upload = async (name, current) => { const file = data.get(name); if (!file || !file.name) return current || ''; const path = state.user.id + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const result = await client.storage.from('portfolio-images').upload(path, file, { contentType:file.type, upsert:false }); if (result.error) throw result.error; return path; };
      let sitePayload = read(siteFields), profilePayload = read(profileFields);
      try { sitePayload.logo_url = await upload('logo_url', site.logo_url); sitePayload.favicon_url = await upload('favicon_url', site.favicon_url); profilePayload.profile_image = await upload('profile_image', profile.profile_image); } catch (error) { const status = get('portfolioSettingsStatus'); status.textContent = error.message; status.className = 'status error'; button.disabled = false; button.textContent = 'Save Changes'; return; }
      const save = (table, row, payload) => row.id ? client.from(table).update(payload).eq('id', row.id) : client.from(table).insert([{ ...payload, created_by: state.user.id }]);
      const results = await Promise.all([save('site_settings', site, sitePayload), save('profile', profile, profilePayload)]);
      const failed = results.find(result => result.error), status = get('portfolioSettingsStatus');
      status.textContent = failed ? failed.error.message : 'Saved successfully.'; status.className = failed ? 'status error' : 'status'; button.disabled = false; button.textContent = 'Save Changes';
    };
    const form = get('portfolioSettingsForm');
    const loadingImageUrl = value => value ? (/^https?:\/\//i.test(value) ? value : client.storage.from('portfolio-images').getPublicUrl(value).data.publicUrl) : 'loadingimg.jpeg';
    form.insertAdjacentHTML('afterend', '<section class="panel settings-section loading-screen-settings"><div class="toolbar"><div><span class="eyebrow">Splash screen</span><h3>Loading Screen</h3></div><span class="muted">Choose the image shown while the portfolio loads.</span></div><div class="settings-image"><img id="loadingImagePreview" alt="Current loading screen" src="' + escape(loadingImageUrl(currentLoadingImage)) + '"><div><form id="loadingImageForm" class="form"><label>Change Image<input class="field" name="loading_image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="muted">PNG, JPG, WEBP or GIF up to 5 MB.</small></label><div class="settings-actions"><p class="status" id="loadingImageStatus" role="status" aria-live="polite"></p><button class="button primary" type="submit">Save Changes</button><button class="button" id="removeLoadingImage" type="button" ' + (currentLoadingImage ? '' : 'hidden') + '>Remove Image</button></div></form></div></div></section>');
    const saveButton = (name, label) => { const input = form.elements[name]; const button = document.createElement('button'); button.type = 'submit'; button.dataset.saveSetting = name; button.className = 'button primary'; button.textContent = label; input.parentElement.appendChild(button); };
    form.querySelector('button[type="submit"]').hidden = true;
    saveButton('website_title', 'Save Website Name'); saveButton('logo_url', 'Save Logo'); saveButton('profile_image', 'Save Profile Image');
    form.addEventListener('submit', async event => {
      const name = event.submitter?.dataset.saveSetting;
      if (!name) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      event.preventDefault(); event.stopImmediatePropagation();
      const button = event.submitter, session = await client.auth.getSession(), user = session.data.session?.user;
      button.disabled = true; button.textContent = 'Saving...';
      try {
        let value = String(new FormData(form).get(name) || '').trim();
        if (name === 'logo_url' || name === 'profile_image') {
          const file = form.elements[name].files[0];
          if (!file) throw new Error('Choose a file first.');
          const path = user.id + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
          const upload = await client.storage.from('portfolio-images').upload(path, file, { contentType:file.type, upsert:false });
          if (upload.error) throw upload.error;
          value = path;
        }
        const table = name === 'profile_image' ? 'profile' : 'site_settings';
        const row = name === 'profile_image' ? profileResult.data : siteResult.data;
        const result = row?.id ? await client.from(table).update({ [name]: value }).eq('id', row.id) : await client.from(table).insert([{ [name]: value, created_by: user.id }]);
        if (result.error) throw result.error;
        button.textContent = 'Saved';
      } catch (error) { button.textContent = error.message || 'Save failed'; }
      button.disabled = false;
    }, true);
    get('changePasswordForm').addEventListener('submit', async event => {
      event.preventDefault();
      const passwordForm = event.currentTarget;
      const data = new FormData(passwordForm);
      const currentPassword = String(data.get('current_password') || '');
      const newPassword = String(data.get('new_password') || '');
      const confirmPassword = String(data.get('confirm_password') || '');
      const button = passwordForm.querySelector('button[type="submit"]');
      const status = get('passwordStatus');
      const clear = () => passwordForm.reset();
      const report = (message, error) => { status.textContent = message; status.className = error ? 'status error' : 'status'; };
      if (!currentPassword || !newPassword || !confirmPassword) { report('All password fields are required.', true); clear(); return; }
      if (newPassword !== confirmPassword) { report('New password and confirmation do not match.', true); clear(); return; }
      if (!newPassword.trim()) { report('New password cannot be empty.', true); clear(); return; }
      button.disabled = true; button.textContent = 'Changing...'; report('', false);
      try {
        const sessionResult = await client.auth.getSession();
        const user = sessionResult.data.session?.user;
        if (!user?.email) throw new Error('Your Admin session has expired. Please sign in again.');
        const verification = await client.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (verification.error || verification.data.user?.id !== user.id) throw new Error('Current password is incorrect.');
        const update = await client.auth.updateUser({ password: newPassword });
        if (update.error) throw update.error;
        report('Password changed successfully.', false);
      } catch (error) {
        report(error.message || 'Could not change password.', true);
      } finally {
        clear(); button.disabled = false; button.textContent = 'Change Password';
      }
    });
    const loadingForm = get('loadingImageForm'), loadingInput = loadingForm.elements.loading_image, loadingPreview = get('loadingImagePreview'), loadingStatus = get('loadingImageStatus'), removeLoadingImage = get('removeLoadingImage');
    let previewObjectUrl = '';
    loadingInput.addEventListener('change', () => { const file = loadingInput.files[0]; if (!file) return; if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = URL.createObjectURL(file); loadingPreview.src = previewObjectUrl; loadingStatus.textContent = ''; loadingStatus.className = 'status'; });
    loadingForm.addEventListener('submit', async event => {
      event.preventDefault();
      const file = loadingInput.files[0], button = loadingForm.querySelector('button[type="submit"]');
      if (!file) { loadingStatus.textContent = 'Choose an image first.'; loadingStatus.className = 'status error'; return; }
      if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { loadingStatus.textContent = 'Use a PNG, JPG, WEBP or GIF image up to 5 MB.'; loadingStatus.className = 'status error'; return; }
      button.disabled = true; removeLoadingImage.disabled = true; button.textContent = 'Uploading...'; loadingStatus.textContent = 'Uploading image...'; loadingStatus.className = 'status';
      try {
        const session = await client.auth.getSession(), user = session.data.session?.user; if (!user) throw new Error('Admin session expired.');
        const path = user.id + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
        const upload = await client.storage.from('portfolio-images').upload(path, file, { contentType:file.type, upsert:false }); if (upload.error) throw upload.error;
        const appearance = { ...(site.appearance || {}), loading_image_url:path };
        const result = site.id ? await client.from('site_settings').update({ appearance }).eq('id', site.id) : await client.from('site_settings').insert([{ appearance, created_by:user.id }]); if (result.error) throw result.error;
        if (currentLoadingImage && !/^https?:\/\//i.test(currentLoadingImage)) await client.storage.from('portfolio-images').remove([currentLoadingImage]);
        site.appearance = appearance; loadingPreview.src = loadingImageUrl(path); removeLoadingImage.hidden = false; loadingStatus.textContent = 'Loading image saved successfully.'; loadingStatus.className = 'status'; loadingInput.value = '';
      } catch (error) { loadingStatus.textContent = error.message || 'Could not save the loading image.'; loadingStatus.className = 'status error'; }
      button.disabled = false; removeLoadingImage.disabled = false; button.textContent = 'Save Changes';
    });
    removeLoadingImage.addEventListener('click', async () => {
      if (!currentLoadingImage) return; const button = loadingForm.querySelector('button[type="submit"]'); removeLoadingImage.disabled = true; button.disabled = true; loadingStatus.textContent = 'Removing image...'; loadingStatus.className = 'status';
      try { const appearance = { ...(site.appearance || {}), loading_image_url:null }; const result = site.id ? await client.from('site_settings').update({ appearance }).eq('id', site.id) : { error:null }; if (result.error) throw result.error; site.appearance = appearance; loadingPreview.src = 'loadingimg.jpeg'; removeLoadingImage.hidden = true; loadingStatus.textContent = 'Custom loading image removed.'; if (!/^https?:\/\//i.test(currentLoadingImage)) await client.storage.from('portfolio-images').remove([currentLoadingImage]); } catch (error) { loadingStatus.textContent = error.message || 'Could not remove the loading image.'; loadingStatus.className = 'status error'; } finally { removeLoadingImage.disabled = false; button.disabled = false; }
    });
  }
  document.addEventListener('click', event => { if (!event.target.closest('[data-view="settings"]')) return; event.preventDefault(); event.stopImmediatePropagation(); renderSettings(); }, true);
}());
(function () {
  'use strict';
  const client = window.supabaseClient;
  const app = document.getElementById('app');
  const state = { user: null, rows: {} };
  const modules = {
    projects: [['title','Title','text',true],['slug','Slug','text',true],['short_description','Short description','text',true],['full_description','Full description','textarea',true],['category','Category','text'],['technologies','Technologies','text'],['live_url','Live demo URL','url'],['github_url','GitHub URL','url'],['is_published','Visibility','checkbox']],
    skills: [['name','Skill name','text',true],['category','Category','text',true],['icon','Icon','text'],['level','Level','number'],['sort_order','Sort order','number'],['is_published','Published','checkbox']],
    services: [['title','Title','text',true],['description','Description','textarea',true],['icon','Icon','text'],['features','Features','textarea'],['sort_order','Sort order','number'],['is_published','Published','checkbox']],
    journey: [['title','Title','text'],['organization','Organization','text'],['type','Type','text'],['start_date','Start date','date'],['end_date','End date','date'],['description','Description','textarea'],['location','Location','text'],['sort_order','Sort order','number'],['is_published','Published','checkbox']]
  };
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const date = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '-';
  function showError(error) { console.error('Supabase error:', error); return [error.message, error.details, error.hint].filter(Boolean).join(' | '); }
  function toast(message, error) { const node = $('toast'); node.textContent = message; node.className = error ? 'error' : ''; node.hidden = false; setTimeout(() => { node.hidden = true; }, 3500); }
  function openDialog(title, html) { $('dialogTitle').textContent = title; $('dialogBody').innerHTML = html; $('overlay').hidden = false; }
  function closeDialog() { $('overlay').hidden = true; }
  async function requireAdmin() { const session = await client.auth.getSession(); const user = session.data.session?.user; if (!user) return null; const check = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(); return check.error || !check.data ? null : user; }
  async function fetchRows(table) { const result = await client.from(table).select('*').order('created_at', { ascending:false }); if (result.error) { if (table === 'projects') state.projectFetchError = result.error; console.error('Admin request failed for ' + table + ':', result.error); return []; } if (table === 'projects') state.projectFetchError = null; return result.data || []; }
  async function fetchRowsSafe(table) { try { return await fetchRows(table); } catch (error) { console.error('Admin dashboard request failed for ' + table + ':', error); return []; } }
  function fieldMarkup(field, row) { const [name, label, type, required] = field; const value = row?.[name] ?? ''; if (type === 'checkbox') return '<label>' + label + '<input name="' + name + '" type="checkbox" ' + (value ? 'checked' : '') + '></label>'; const tag = type === 'textarea' ? 'textarea' : 'input'; return '<label>' + label + '<' + tag + ' class="field" name="' + name + '" type="' + type + '" ' + (required ? 'required' : '') + '>' + (tag === 'textarea' ? escape(value) + '</textarea>' : '</input>') + '</label>'; }
  function normalizeArrayField(value) { if (Array.isArray(value)) return value; return String(value || '').split(',').map(item => item.trim()).filter(Boolean); }
  function createFieldValue(row, name, type, data) { if (type === 'checkbox') return !row && name === 'is_published' ? true : data.has(name); if (type === 'number') return Number(data.get(name) || 0); return String(data.get(name) || '').trim(); }
  async function showIndependentSettings() { let view = $('settingsView'); if (!view) { view = document.createElement('section'); view.id = 'settingsView'; view.className = 'view'; document.querySelector('.main').appendChild(view); } activateSettingsView(); const siteResult = await client.from('site_settings').select('*').order('created_at', { ascending:false }).limit(1).maybeSingle(); const profileResult = await client.from('profile').select('*').order('created_at', { ascending:false }).limit(1).maybeSingle(); if (siteResult.error || profileResult.error) { view.innerHTML = '<div class="panel"><p class="status error">' + escape(showError(siteResult.error || profileResult.error)) + '</p></div>'; return; } const site = siteResult.data || {}; const profile = profileResult.data || {}; const url = (bucket, value) => value ? (/^https?:\/\//i.test(value) ? value : client.storage.from(bucket).getPublicUrl(value).data.publicUrl) : ''; view.innerHTML = '<div class="panel"><h2>General settings</h2><div class="settings-section"><h3>Website name</h3><form id="siteNameForm"><input class="field" name="name" value="' + escape(site.website_title || '') + '" required><p class="status" id="siteNameStatus"></p><button class="button primary" type="submit">Save Website Name</button></form></div><div class="settings-section"><h3>Logo</h3><form id="logoForm"><img id="logoPreview" alt="Current logo" src="' + escape(url('portfolio-images', site.logo_url)) + '" ' + (site.logo_url ? '' : 'hidden') + '><input class="field" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><p class="status" id="logoStatus"></p><button class="button primary" type="submit">Save Logo</button></form></div><div class="settings-section"><h3>Profile image</h3><form id="profileImageForm"><img id="profilePreview" alt="Current profile image" src="' + escape(url('portfolio-images', profile.profile_image)) + '" ' + (profile.profile_image ? '' : 'hidden') + '><input class="field" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><p class="status" id="profileStatus"></p><button class="button primary" type="submit">Save Profile Image</button></form></div></div>'; const validate = file => !file ? 'Select an image first.' : (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) ? 'Use a PNG, JPEG, WebP, or GIF image up to 10 MB.' : ''; const bindPreview = (form, image) => form.file.onchange = () => { const error = validate(form.file.files[0]); if (error) { setStatus($(image === 'logoPreview' ? 'logoStatus' : 'profileStatus'), error, 'error'); form.file.value = ''; return; } $(image).src = URL.createObjectURL(form.file.files[0]); $(image).hidden = false; }; bindPreview($('logoForm'), 'logoPreview'); bindPreview($('profileImageForm'), 'profilePreview'); const save = async (form, statusId, button, table, id, field, kind, oldValue) => { const file = form.file.files[0]; const error = validate(file); if (error) { setStatus($(statusId), error, 'error'); return; } button.disabled = true; button.textContent = 'Saving...'; setStatus($(statusId), '', ''); const path = state.user.id + '/settings-' + kind + '-' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); try { const upload = await client.storage.from('portfolio-images').upload(path, file, { contentType:file.type, upsert:false }); if (upload.error) throw upload.error; const result = await client.from(table).update({ [field]: path }).eq('id', id); if (result.error) { await client.storage.from('portfolio-images').remove([path]); throw result.error; } if (oldValue && !/^https?:\/\//i.test(oldValue)) await client.storage.from('portfolio-images').remove([oldValue]); setStatus($(statusId), 'Saved successfully.', 'success'); } catch (saveError) { setStatus($(statusId), showError(saveError), 'error'); } finally { button.disabled = false; button.textContent = button.dataset.label; } }; $('siteNameForm').onsubmit = async event => { event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.dataset.label = button.textContent; button.disabled = true; button.textContent = 'Saving...'; const status = $('siteNameStatus'); try { if (!site.id) throw new Error('Site settings row is missing.'); const result = await client.from('site_settings').update({ website_title: event.currentTarget.name.value.trim() }).eq('id', site.id); if (result.error) throw result.error; setStatus(status, 'Saved successfully.', 'success'); } catch (error) { setStatus(status, showError(error), 'error'); } finally { button.disabled = false; button.textContent = button.dataset.label; } }; $('logoForm').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.dataset.label = button.textContent; return save(form, 'logoStatus', button, 'site_settings', site.id, 'logo_url', 'logo', site.logo_url); }; $('profileImageForm').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.dataset.label = button.textContent; return save(form, 'profileStatus', button, 'profile', profile.id, 'profile_image', 'profile', profile.profile_image); }; }
  function activateSettingsView() { document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== 'settingsView'; }); document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'settings')); $('title').textContent = 'Settings'; $('side').classList.remove('open'); }
  async function saveModule(key, row, event) { const button = event.currentTarget.querySelector('button[type="submit"]'); const data = new FormData(event.currentTarget); const payload = {}; button.disabled = true; button.textContent = 'Saving...'; modules[key].forEach(([name,,type]) => { payload[name] = type === 'checkbox' ? (!row && name === 'is_published' ? true : data.has(name)) : type === 'number' ? Number(data.get(name) || 0) : String(data.get(name) || '').trim(); }); if (key === 'projects') payload.technologies = normalizeArrayField(payload.technologies); if (key === 'services') payload.features = normalizeArrayField(payload.features); for (const url of ['live_url','github_url']) if (payload[url] && !/^https?:\/\//i.test(payload[url])) { $('formStatus').textContent = 'URLs must begin with http:// or https://.'; button.disabled = false; button.textContent = 'Save'; return; } if (key === 'projects' && !row) { const duplicate = await client.from('projects').select('id').eq('slug', payload.slug).maybeSingle(); if (duplicate.error) { $('formStatus').textContent = showError(duplicate.error); button.disabled = false; button.textContent = 'Save'; return; } if (duplicate.data) { $('formStatus').textContent = 'That slug already exists.'; button.disabled = false; button.textContent = 'Save'; return; } } const result = row ? await client.from(key).update(payload).eq('id', row.id) : await client.from(key).insert([{ ...payload, created_by: state.user.id }]).select().single(); if (result.error) { $('formStatus').textContent = showError(result.error); $('formStatus').className = 'status full error'; button.disabled = false; button.textContent = 'Save'; return; } closeDialog(); toast('Saved successfully.'); await show(key); }
  function openModule(key, row) { openDialog((row ? 'Edit ' : 'Add ') + key, '<form id="moduleForm" class="form">' + modules[key].map(field => fieldMarkup(field, row)).join('') + '<p class="status full" id="formStatus"></p><button class="button primary full" type="submit">Save</button></form>'); $('moduleForm').addEventListener('submit', event => { event.preventDefault(); saveModule(key, row, event); }); }
  async function showModule(key) { let view = $(key + 'View'); if (!view) { view = document.createElement('section'); view.id = key + 'View'; view.className = 'view'; document.querySelector('.main').appendChild(view); } state.rows[key] = await fetchRows(key); const rows = state.rows[key]; view.innerHTML = '<div class="panel"><div class="toolbar"><h2>' + key + '</h2><button class="button primary" data-add="' + key + '">Add</button></div><div class="table"><table><thead><tr>' + modules[key].slice(0,5).map(field => '<th>' + field[1] + '</th>').join('') + '<th>Actions</th></tr></thead><tbody>' + rows.map(row => '<tr>' + modules[key].slice(0,5).map(field => '<td>' + escape(field[2] === 'checkbox' ? (row[field[0]] ? 'Yes' : 'No') : (row[field[0]] || '-')) + '</td>').join('') + '<td><div class="row-actions"><button data-edit="' + key + '" data-id="' + row.id + '">Edit</button><button data-delete="' + key + '" data-id="' + row.id + '">Delete</button></div></td></tr>').join('') + '</tbody></table></div>' + (rows.length ? '' : '<div class="empty">No records yet.</div>') + '</div>'; }
  async function showFiles(key) { const rows = await fetchRows(key); state.rows[key] = rows; const bucket = key === 'gallery' ? 'portfolio-images' : 'portfolio-documents'; $(key + 'View').innerHTML = '<div class="panel"><div class="toolbar"><h2>' + key + '</h2><button class="button primary" data-upload="' + key + '">Upload</button></div><div class="cards">' + rows.map(row => '<article class="card">' + (key === 'gallery' ? '<img src="' + escape(client.storage.from(bucket).getPublicUrl(row.file_path).data.publicUrl) + '" alt="' + escape(row.title) + '" onerror="this.alt=\'Image unavailable\'">' : '') + '<h3>' + escape(row.title) + '</h3><p class="muted">' + escape(row.description) + '</p><p class="muted">' + escape(row.category || '') + ' · ' + date(row.created_at) + '</p><div class="row-actions"><button data-preview="' + key + '" data-id="' + row.id + '">Preview</button><button data-edit-file="' + key + '" data-id="' + row.id + '">Edit</button><button data-file-delete="' + key + '" data-id="' + row.id + '">Delete</button></div></article>').join('') + '</div>' + (rows.length ? '' : '<div class="empty">No ' + key + ' yet.</div>') + '</div>'; }
  async function showSettings() { let view = $('settingsView'); if (!view) { view = document.createElement('section'); view.id = 'settingsView'; view.className = 'view'; document.querySelector('.main').appendChild(view); } const siteResult = await client.from('site_settings').select('*').order('created_at', { ascending:false }).limit(1).maybeSingle(); const profileResult = await client.from('profile').select('*').order('created_at', { ascending:false }).limit(1).maybeSingle(); if (siteResult.error || profileResult.error) { view.innerHTML = '<div class="panel"><p class="status error">' + escape(showError(siteResult.error || profileResult.error)) + '</p></div>'; return; } const site = siteResult.data || {}; const profile = profileResult.data || {}; const publicUrl = (bucket, value) => value ? (/^https?:\/\//i.test(value) ? value : client.storage.from(bucket).getPublicUrl(value).data.publicUrl) : ''; view.innerHTML = '<div class="panel"><h2>General settings</h2><form id="settingsForm" class="form"><label>Website name<input class="field" name="website_title" value="' + escape(site.website_title || '') + '" required></label><div class="settings-image"><label>Logo<input class="field" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><img id="settingsLogoPreview" alt="Current logo" src="' + escape(publicUrl('portfolio-images', site.logo_url)) + '" ' + (site.logo_url ? '' : 'hidden') + '><button type="button" data-settings-remove="logo" ' + (site.logo_url ? '' : 'hidden') + '>Remove logo</button></div><div class="settings-image"><label>Profile image<input class="field" name="profile_image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><img id="settingsProfilePreview" alt="Current profile image" src="' + escape(publicUrl('portfolio-images', profile.profile_image)) + '" ' + (profile.profile_image ? '' : 'hidden') + '><button type="button" data-settings-remove="profile" ' + (profile.profile_image ? '' : 'hidden') + '>Remove profile image</button></div><p class="status" id="settingsStatus" role="status" aria-live="polite"></p><button class="button primary" type="submit">Save changes</button></form></div>'; const form = $('settingsForm'); const status = $('settingsStatus'); const pending = { logo: site.logo_url || null, profile: profile.profile_image || null, removeLogo: false, removeProfile: false }; const files = { logo: null, profile: null }; const preview = (input, image, kind) => { const file = input.files[0]; if (!file) return; if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) { setStatus(status, 'Use a PNG, JPEG, WebP, or GIF image up to 10 MB.', 'error'); input.value = ''; return; } files[kind] = file; image.src = URL.createObjectURL(file); image.hidden = false; pending[kind === 'profile' ? 'removeProfile' : 'removeLogo'] = false; form.querySelector('[data-settings-remove="' + kind + '"]').hidden = false; }; form.logo.onchange = () => preview(form.logo, $('settingsLogoPreview'), 'logo'); form.profile_image.onchange = () => preview(form.profile_image, $('settingsProfilePreview'), 'profile'); form.querySelectorAll('[data-settings-remove]').forEach(button => button.onclick = () => { const kind = button.dataset.settingsRemove; files[kind] = null; form[kind === 'profile' ? 'profile_image' : 'logo'].value = ''; pending[kind === 'profile' ? 'removeProfile' : 'removeLogo'] = true; $(kind === 'profile' ? 'settingsProfilePreview' : 'settingsLogoPreview').hidden = true; button.hidden = true; }); form.onsubmit = async event => { event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true; setStatus(status, 'Saving...', ''); try { const name = form.website_title.value.trim(); if (site.id && name !== (site.website_title || '')) { const result = await client.from('site_settings').update({ website_title: name }).eq('id', site.id); if (result.error) throw result.error; } const saveImage = async (kind, table, id, field, bucket, remove) => { const file = files[kind]; if (!file && !remove) return; let path = null; if (file) { path = state.user.id + '/settings-' + kind + '-' + crypto.randomUUID() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const upload = await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert:false }); if (upload.error) throw upload.error; } if (!id) { const insert = await client.from(table).insert([{ [field]: path, created_by: state.user.id }]).select().single(); if (insert.error) { if (path) await client.storage.from(bucket).remove([path]); throw insert.error; } return; } const result = await client.from(table).update({ [field]: path }).eq('id', id); if (result.error) { if (path) await client.storage.from(bucket).remove([path]); throw result.error; } if (file && pending[kind] && !/^https?:\/\//i.test(pending[kind])) await client.storage.from(bucket).remove([pending[kind]]); }; await saveImage('logo', 'site_settings', site.id, 'logo_url', 'portfolio-images', pending.removeLogo); await saveImage('profile', 'profile', profile.id, 'profile_image', 'portfolio-images', pending.removeProfile); toast('Settings saved successfully.'); await showSettings(); } catch (error) { setStatus(status, showError(error), 'error'); button.disabled = false; } }; }
  document.addEventListener('click', event => { const settings = event.target.closest('[data-view="settings"]'); if (!settings) return; event.preventDefault(); event.stopPropagation(); Object.keys(modules).filter(key => !document.querySelector('[data-view="' + key + '"]')).forEach(key => { const button = document.createElement('button'); button.dataset.view = key; button.textContent = key[0].toUpperCase() + key.slice(1); document.querySelector('.nav').appendChild(button); }); showIndependentSettings(); }, true);
  function upload(key) { const gallery = key === 'gallery'; openDialog('Upload ' + (gallery ? 'Gallery Image' : 'Document'), '<form id="uploadForm" class="form"><label>Title<input class="field" name="title" required></label><label>Category<input class="field" name="category"></label><label class="full">Description<textarea class="field" name="description"></textarea></label><label class="full">File<input class="field" name="file" type="file" accept="' + (gallery ? 'image/*' : '.pdf,.doc,.docx,image/*') + '" required></label><p class="status full" id="formStatus"></p><button class="button primary full" type="submit">Upload</button></form>'); $('uploadForm').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, file = form.file.files[0], button = form.querySelector('button'), max = gallery ? 10 * 1024 * 1024 : 20 * 1024 * 1024, allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']; if (!file || file.size > max || (!gallery && !allowed.includes(file.type)) || (gallery && !file.type.startsWith('image/'))) { $('formStatus').textContent = 'Choose a supported file within the size limit.'; $('formStatus').className = 'status full error'; return; } button.disabled = true; button.textContent = 'Uploading...'; const bucket = gallery ? 'portfolio-images' : 'portfolio-documents'; const path = state.user.id + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const uploadResult = await client.storage.from(bucket).upload(path, file, { contentType:file.type, upsert:false }); if (uploadResult.error) { $('formStatus').textContent = showError(uploadResult.error); $('formStatus').className = 'status full error'; button.disabled = false; button.textContent = 'Upload'; return; } const insert = await client.from(key).insert({ title:form.title.value.trim(), description:form.description.value.trim(), category:form.category.value.trim(), file_path:path, file_name:file.name, file_type:file.type, file_size:file.size, is_public:gallery, is_published:gallery, is_featured:false, sort_order:0, created_by:state.user.id }); if (insert.error) { await client.storage.from(bucket).remove([path]); $('formStatus').textContent = showError(insert.error); $('formStatus').className = 'status full error'; button.disabled = false; button.textContent = 'Upload'; return; } closeDialog(); toast(gallery ? 'Gallery image uploaded successfully' : 'Document uploaded successfully'); await showFiles(key); }); }
  async function showMessages() { const rows = await fetchRows('contact_messages'); state.rows.messages = rows; $('messagesView').innerHTML = '<div class="panel"><div class="toolbar"><h2>Messages</h2><input class="field" id="messageSearch" type="search" placeholder="Search messages"></div><div class="table"><table><thead><tr><th>Sender</th><th>Subject</th><th>Message</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody id="messageRows"></tbody></table></div></div>'; const paint = () => { const q = String($('messageSearch').value || '').trim().toLowerCase(); $('messageRows').innerHTML = rows.filter(row => [row.name,row.email,row.subject,row.message].filter(Boolean).join(' ').toLowerCase().includes(q)).map(row => '<tr><td>' + escape(row.name) + '<br><span class="muted">' + escape(row.email) + '</span></td><td>' + escape(row.subject || '-') + '</td><td>' + escape(row.message) + '</td><td>' + date(row.created_at) + '</td><td>' + row.status + (row.is_starred ? ' / starred' : '') + '</td><td><div class="row-actions"><button data-message="' + row.id + '">Open</button><a class="button" href="mailto:' + encodeURIComponent(row.email) + '?subject=' + encodeURIComponent('Re: ' + (row.subject || 'Your message')) + '">Reply</a><button data-toggle="' + row.id + '">' + (row.status === 'unread' ? 'Read' : 'Unread') + '</button><button data-star="' + row.id + '">' + (row.is_starred ? 'Unstar' : 'Star') + '</button><button data-message-delete="' + row.id + '">Delete</button></div></td></tr>').join('') || '<tr><td colspan="6"><div class="empty">No messages.</div></td></tr>'; }; $('messageSearch').addEventListener('input', paint); $('messageSearch').addEventListener('search', paint); paint(); }
  async function show(key) { document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== key + 'View'; }); document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === key)); $('title').textContent = key[0].toUpperCase() + key.slice(1); $('side').classList.remove('open'); if (key === 'dashboard') { const results = await Promise.all(['contact_messages','projects','gallery','documents'].map(fetchRows)); $('dashboardView').innerHTML = '<div class="stats">' + [['Messages',results[0].length],['Unread',results[0].filter(row => row.status === 'unread').length],['Projects',results[1].length],['Published',results[1].filter(row => row.is_published).length],['Gallery',results[2].length],['Documents',results[3].length]].map(item => '<div class="stat"><span>' + item[0] + '</span><b>' + item[1] + '</b></div>').join('') + '</div><div class="panel"><h2>Quick actions</h2><div class="actions"><button class="button primary" data-add="projects">Add Project</button><button class="button" data-upload="gallery">Upload Gallery Image</button><button class="button" data-upload="documents">Upload Document</button><button class="button" data-view="messages">View Messages</button></div></div>'; } else if (key === 'messages') await showMessages(); else if (modules[key]) await showModule(key); else if (key === 'gallery' || key === 'documents') await showFiles(key); else { const table = key === 'profile' ? 'profile' : 'site_settings'; const rows = await fetchRows(table), row = rows[0] || {}; const fields = key === 'profile' ? [['name','Name','text',true],['short_bio','Short bio','textarea'],['about_text','About text','textarea'],['email','Email','email',true],['phone','Phone','text'],['location','Location','text'],['github','GitHub URL','url'],['linkedin','LinkedIn URL','url'],['instagram','Instagram URL','url']] : [['website_title','Website title','text',true],['hero_heading','Hero heading','text'],['hero_description','Hero description','textarea'],['contact_email','Contact email','email'],['contact_phone','Phone','text'],['contact_location','Location','text'],['meta_title','Meta title','text'],['meta_description','Meta description','textarea'],['og_image_url','Open Graph image URL','url']]; $('' + key + 'View').innerHTML = '<div class="panel"><h2>' + key + '</h2><form id="simpleForm" class="form">' + fields.map(field => fieldMarkup(field,row)).join('') + '<p class="status full" id="formStatus"></p><button class="button primary full">Save changes</button></form></div>'; $('simpleForm').onsubmit = async event => { event.preventDefault(); const button = event.currentTarget.querySelector('button'), data = new FormData(event.currentTarget), payload = {}; button.disabled = true; button.textContent = 'Saving...'; fields.forEach(([name,,type]) => { payload[name] = String(data.get(name) || '').trim(); }); const result = row.id ? await client.from(table).update(payload).eq('id',row.id) : await client.from(table).insert({ ...payload, created_by:state.user.id }); if (result.error) { $('formStatus').textContent = showError(result.error); button.disabled = false; button.textContent = 'Save changes'; return; } toast('Changes saved.'); await show(key); }; } }
  document.addEventListener('click', async event => { const view = event.target.closest('[data-view]')?.dataset.view; if (view) return show(view); const add = event.target.closest('[data-add]'); if (add) return openModule(add.dataset.add); const uploadButton = event.target.closest('[data-upload]'); if (uploadButton) return upload(uploadButton.dataset.upload); const edit = event.target.closest('[data-edit]'); if (edit) return openModule(edit.dataset.edit, state.rows[edit.dataset.edit].find(row => row.id === edit.dataset.id)); const del = event.target.closest('[data-delete]'); if (del && confirm('Delete this record permanently?')) { const result = await client.from(del.dataset.delete).delete().eq('id',del.dataset.id); if (result.error) toast(showError(result.error),true); else { toast('Deleted.'); await show(del.dataset.delete); } } const fileDelete = event.target.closest('[data-file-delete]'); if (fileDelete && confirm('Delete this file permanently?')) { const key=fileDelete.dataset.fileDelete,row=state.rows[key].find(item=>item.id===fileDelete.dataset.id),bucket=key==='gallery'?'portfolio-images':'portfolio-documents',result=await client.from(key).delete().eq('id',row.id); if(result.error){toast(showError(result.error),true);return} const removed=await client.storage.from(bucket).remove([row.file_path]); if(removed.error)toast(showError(removed.error),true); else toast('Deleted.'); await showFiles(key); } const preview=event.target.closest('[data-preview]'); if(preview){const key=preview.dataset.preview,row=state.rows[key].find(item=>item.id===preview.dataset.id),bucket=key==='gallery'?'portfolio-images':'portfolio-documents',result=key==='gallery'?{data:{signedUrl:client.storage.from(bucket).getPublicUrl(row.file_path).data.publicUrl}}:await client.storage.from(bucket).createSignedUrl(row.file_path,60); if(result.error){toast(showError(result.error),true);return} window.open(result.data.signedUrl,'_blank','noopener');} const message=event.target.closest('[data-message]'); if(message){const row=state.rows.messages.find(item=>item.id===message.dataset.message); openDialog(row.subject||'Message','<p class="muted">'+escape(row.name)+' &lt;'+escape(row.email)+'&gt; · '+date(row.created_at)+'</p><p style="white-space:pre-wrap;margin-top:16px">'+escape(row.message)+'</p>');} const toggle=event.target.closest('[data-toggle]'); if(toggle){const row=state.rows.messages.find(item=>item.id===toggle.dataset.toggle);const result=await client.from('contact_messages').update({status:row.status==='unread'?'read':'unread',read_at:row.status==='unread'?new Date().toISOString():null}).eq('id',row.id);if(result.error)toast(showError(result.error),true);else await showMessages();} const star=event.target.closest('[data-star]'); if(star){const row=state.rows.messages.find(item=>item.id===star.dataset.star);const result=await client.from('contact_messages').update({is_starred:!row.is_starred}).eq('id',row.id);if(result.error)toast(showError(result.error),true);else await showMessages();} const messageDelete=event.target.closest('[data-message-delete]'); if(messageDelete&&confirm('Delete this message permanently?')){const result=await client.from('contact_messages').delete().eq('id',messageDelete.dataset.messageDelete);if(result.error)toast(showError(result.error),true);else await showMessages();} });
  $('dialogClose').onclick = closeDialog; $('overlay').onclick = event => { if (event.target === $('overlay')) closeDialog(); };
  const menu = $('menu'), side = $('side');
  const menuBackdrop = document.createElement('div'); menuBackdrop.id = 'adminMenuBackdrop'; menuBackdrop.setAttribute('aria-hidden', 'true'); document.body.appendChild(menuBackdrop);
  function isMobileMenu() { return window.matchMedia('(max-width: 1023px)').matches; }
  function closeMenu() { side.classList.remove('open'); menuBackdrop.classList.remove('open'); document.body.classList.remove('admin-menu-open'); menu?.setAttribute('aria-expanded', 'false'); menuBackdrop?.setAttribute('aria-hidden', 'true'); }
  function openMenu() { if (!isMobileMenu()) return; side.classList.add('open'); menuBackdrop.classList.add('open'); document.body.classList.add('admin-menu-open'); menu?.setAttribute('aria-expanded', 'true'); menuBackdrop?.setAttribute('aria-hidden', 'false'); }
  function toggleMenu() { if (!isMobileMenu()) return; side.classList.contains('open') ? closeMenu() : openMenu(); }
  menu.hidden = false; menu.type = 'button'; menu.setAttribute('aria-controls', 'side'); menu.setAttribute('aria-expanded', 'false'); menu.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); toggleMenu(); }); menuBackdrop.onclick = closeMenu;
  let navigationInProgress = false;
  const coreViews = new Set(['dashboard', 'messages', 'projects', 'gallery', 'documents', 'skills', 'services', 'journey', 'profile']);
  const handleNavClick = event => {
    const button = event.target.closest('.nav button[data-view]');
    if (!button || !coreViews.has(button.dataset.view) || navigationInProgress) return;
    event.preventDefault();
    event.stopPropagation();
    navigationInProgress = true;
    closeMenu();
    Promise.resolve(show(button.dataset.view)).finally(() => { navigationInProgress = false; });
  };
  side.querySelector('.nav')?.addEventListener('click', handleNavClick);
  side.querySelector('.side-bottom')?.addEventListener('click', event => {
    if (event.target.closest('a, button')) closeMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => { if (!isMobileMenu()) closeMenu(); });
  document.addEventListener('click', event => { if (isMobileMenu() && side.classList.contains('open') && !side.contains(event.target) && !menu?.contains(event.target)) closeMenu(); }, true);
  closeMenu();
  $('logout').onclick = async () => { closeMenu(); await client.auth.signOut(); location.replace('../index.html'); };
  let knownUnreadMessageIds = null;
  async function checkUnreadMessages() {
    const result = await client.from('contact_messages').select('id,status').eq('status', 'unread');
    if (result.error) return;
    const unread = result.data || [];
    const button = document.querySelector('[data-view="messages"]');
    if (button) button.textContent = unread.length ? 'Messages (' + unread.length + ')' : 'Messages';
    document.title = unread.length ? '(' + unread.length + ') Portfolio Admin' : 'Portfolio Admin';
    const currentIds = unread.map(row => row.id).sort().join(',');
    if (knownUnreadMessageIds !== null && currentIds !== knownUnreadMessageIds) {
      toast('New contact message received.');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('New contact message', { body: 'Open Portfolio Admin to read it.' });
    }
    knownUnreadMessageIds = currentIds;
  }
  async function editFile(key, id) {
    const row = state.rows[key]?.find(item => item.id === id); if (!row) return;
    const bucket = key === 'gallery' ? 'portfolio-images' : 'portfolio-documents';
    openDialog('Edit ' + key, '<form id="fileEditForm" class="form"><label>Title<input class="field" name="title" value="' + escape(row.title) + '" required></label><label>Category<input class="field" name="category" value="' + escape(row.category || '') + '"></label><label class="full">Description<textarea class="field" name="description">' + escape(row.description || '') + '</textarea></label><label class="full">Replace file<input class="field" name="file" type="file" accept="' + (key === 'gallery' ? 'image/*' : '.pdf,.doc,.docx,image/*') + '"></label><p class="status full" id="fileEditStatus"></p><button class="button primary full" type="submit">Save Changes</button></form>');
    $('fileEditForm').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, file = form.file.files[0], button = form.querySelector('button'), status = $('fileEditStatus'); button.disabled = true; let newPath = ''; try { if (file) { newPath = state.user.id + '/' + makeUuid() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const upload = await client.storage.from(bucket).upload(newPath, file, { contentType:file.type, upsert:false }); if (upload.error) throw upload.error; } const changes = { title:form.title.value.trim(), category:form.category.value.trim(), description:form.description.value.trim() }; if (newPath) Object.assign(changes, { file_path:newPath, file_name:file.name, file_type:file.type, file_size:file.size }); const result = await client.from(key).update(changes).eq('id', id); if (result.error) throw result.error; if (newPath && row.file_path) await client.storage.from(bucket).remove([row.file_path]); closeDialog(); await showFiles(key); } catch (error) { if (newPath) await client.storage.from(bucket).remove([newPath]); status.textContent = showError(error); status.className = 'status full error'; button.disabled = false; } });
  }
  document.addEventListener('click', event => { const editButton = event.target.closest('[data-edit-file]'); if (!editButton) return; event.preventDefault(); event.stopImmediatePropagation(); editFile(editButton.dataset.editFile, editButton.dataset.id); }, true);
  function decorateProjects() {
    const view = $('projectsView');
    const rows = state.rows.projects || [];
    const table = view?.querySelector('table');
    if (!table || view?.querySelector('[data-project-cms]') || table.dataset.visibilityDecorated || table.querySelectorAll('tbody tr').length !== rows.length) return;
    table.dataset.visibilityDecorated = 'true';
    table.querySelector('thead tr')?.insertAdjacentHTML('beforeend', '<th>Visibility</th>');
    table.querySelectorAll('tbody tr').forEach((tableRow, index) => {
      const row = rows[index];
      tableRow.insertAdjacentHTML('beforeend', '<td><span class="project-visibility-badge ' + (row.is_published ? 'visible' : 'hidden') + '">' + (row.is_published ? '🟢 Visible' : '⚪ Hidden') + '</span><button class="project-visibility-action" data-project-visibility-id="' + escape(row.id) + '">' + (row.is_published ? 'Hide' : 'Unhide') + '</button></td>');
    });
  }
  const projectListObserver = new MutationObserver(decorateProjects);
  projectListObserver.observe($('projectsView') || app, { childList: true, subtree: true });
  const projectImageBucket = 'portfolio-images';
  const getProjectImageUrl = imagePath => {
    if (typeof imagePath !== 'string') return '';
    const value = imagePath.trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return client.storage.from(projectImageBucket).getPublicUrl(value).data.publicUrl || '';
  };
  const normalizedProject = row => ({ ...row, title: String(row?.title || ''), slug: String(row?.slug || ''), short_description: String(row?.short_description || ''), full_description: String(row?.full_description || ''), category: String(row?.category || ''), image_url: typeof row?.image_url === 'string' ? row.image_url : '', is_published: Boolean(row?.is_published), is_featured: Boolean(row?.is_featured) });
  const projectImageMarkup = row => {
    const url = getProjectImageUrl(row.image_url);
    return '<button type="button" class="project-thumbnail-button" data-project-preview="' + escape(row.id) + '" aria-label="Preview ' + escape(row.title || 'project image') + '"><span class="project-thumbnail">' + (url ? '<img src="' + escape(url) + '" alt="' + escape(row.title || 'Project image') + '" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false;console.error(\'Project image failed to load:\',this.src)">' : '') + '<span class="project-thumbnail-fallback"' + (url ? ' hidden' : '') + '>No image</span></span></button>';
  };
  function renderProjectsCms() {
    const view = $('projectsView');
    if (!view || !state.rows.projects) return;
    if (state.projectFetchError) { view.innerHTML = '<div class="panel projects-cms-panel"><div class="toolbar"><div><h2>Projects</h2><span class="muted">Manage portfolio projects</span></div></div><div class="projects-error-state"><strong>Could not load projects.</strong><span>' + escape(showError(state.projectFetchError)) + '</span><button class="button primary" data-project-retry>Retry</button></div></div>'; return; }
    const rows = state.rows.projects.map(normalizedProject).sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
    state.rows.projects = rows;
    view.innerHTML = '<div class="panel projects-cms-panel" data-project-cms><div class="toolbar"><div><h2>Projects</h2><span class="muted">Manage portfolio projects</span></div><button class="button primary" data-add="projects">+ Add Project</button></div>' + (rows.length ? '<div class="table projects-cms-table"><table><thead><tr><th>Image</th><th>Title</th><th>Slug</th><th>Category</th><th>Status</th><th>Featured</th><th>Created Date</th><th>Actions</th></tr></thead><tbody>' + rows.map(row => '<tr data-project-view="' + escape(row.id) + '"><td data-label="Image">' + projectImageMarkup(row) + '</td><td data-label="Title"><strong>' + escape(row.title || '-') + '</strong></td><td data-label="Slug"><span class="project-table-text">' + escape(row.slug || '-') + '</span></td><td data-label="Category"><span class="project-category-badge">' + escape(row.category || '-') + '</span></td><td data-label="Status"><span class="project-status-badge ' + (row.is_published ? 'published' : 'hidden') + '">' + (row.is_published ? 'Published' : 'Draft') + '</span></td><td data-label="Featured"><span class="project-featured-badge ' + (row.is_featured ? 'featured' : '') + '">' + (row.is_featured ? 'Yes' : 'No') + '</span></td><td data-label="Created Date"><time>' + escape(date(row.created_at)) + '</time></td><td data-label="Actions"><div class="row-actions"><button data-project-view-button="' + escape(row.id) + '">View</button><button data-edit="projects" data-id="' + escape(row.id) + '">Edit</button><button data-project-delete="' + escape(row.id) + '">Delete</button></div></td></tr>').join('') + '</tbody></table></div>' : '<div class="projects-empty-state"><strong>No projects found</strong><button class="button primary" data-add="projects">+ Add Project</button></div>') + '</div>';
    ensureProjectRealtime();
  }
  let projectRealtimeChannel;
  function ensureProjectRealtime() {
    if (projectRealtimeChannel) return;
    projectRealtimeChannel = client.channel('admin-projects-cms').on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
      const incoming = payload.new ? normalizedProject(payload.new) : null;
      const current = state.rows.projects || [];
      if (payload.eventType === 'INSERT' && incoming && !current.some(row => row.id === incoming.id)) current.push(incoming);
      if (payload.eventType === 'UPDATE' && incoming) { const index = current.findIndex(row => row.id === incoming.id); if (index >= 0) current[index] = incoming; else current.push(incoming); }
      if (payload.eventType === 'DELETE') state.rows.projects = current.filter(row => row.id !== payload.old?.id);
      if (document.querySelector('#projectsView [data-project-cms]')) renderProjectsCms();
    }).subscribe(status => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('Projects realtime subscription:', status); });
  }
  const projectsCmsObserver = new MutationObserver(() => { const view = $('projectsView'); if (view && !view.querySelector('[data-project-cms]') && state.rows.projects) renderProjectsCms(); });
  projectsCmsObserver.observe($('projectsView') || app, { childList: true, subtree: true });
  function openProjectDetails(row) {
    const url = getProjectImageUrl(row.image_url);
    openDialog('Project Details', '<div class="project-details-dialog">' + (url ? '<img class="project-details-image" src="' + escape(url) + '" alt="' + escape(row.title || 'Project image') + '" onerror="this.hidden=true;this.nextElementSibling.hidden=false;console.error(\'Project details image failed to load:\',this.src)"><span class="project-details-fallback" hidden>Image unavailable</span>' : '<span class="project-details-fallback">No image available</span>') + '<div class="project-details-copy"><h3>' + escape(row.title || '-') + '</h3><dl><dt>Slug</dt><dd>' + escape(row.slug || '-') + '</dd><dt>Short description</dt><dd>' + escape(row.short_description || '-') + '</dd><dt>Full description</dt><dd>' + escape(row.full_description || '-') + '</dd><dt>Category</dt><dd>' + escape(row.category || '-') + '</dd><dt>Status</dt><dd>' + (row.is_published ? 'Published' : 'Draft') + '</dd><dt>Featured</dt><dd>' + (row.is_featured ? 'Yes' : 'No') + '</dd><dt>Created date</dt><dd>' + escape(date(row.created_at)) + '</dd></dl></div><button type="button" class="button" data-project-details-close>Close</button></div>');
  }
  document.addEventListener('click', async event => {
    const retry = event.target.closest('[data-project-retry]');
    if (retry) { event.preventDefault(); await show('projects'); return; }
    const preview = event.target.closest('[data-project-preview]');
    if (preview) { const row = state.rows.projects?.find(item => item.id === preview.dataset.projectPreview); const url = getProjectImageUrl(row?.image_url); if (url) openDialog('Project Image', '<div class="project-image-dialog"><img src="' + escape(url) + '" alt="' + escape(row?.title || 'Project image') + '" onerror="this.hidden=true;console.error(\'Project image preview failed to load:\',this.src)"><button type="button" class="button" data-project-preview-close>Close</button></div>'); return; }
    if (event.target.closest('[data-project-preview-close]')) { closeDialog(); return; }
    const viewButton = event.target.closest('[data-project-view-button]');
    const rowElement = event.target.closest('[data-project-view]');
    if (viewButton || (rowElement && !event.target.closest('button,a'))) { const row = state.rows.projects?.find(item => item.id === (viewButton?.dataset.projectViewButton || rowElement.dataset.projectView)); if (row) openProjectDetails(row); return; }
    if (event.target.closest('[data-project-details-close]')) { closeDialog(); return; }
    const deleteButton = event.target.closest('[data-project-delete]');
    if (!deleteButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const row = state.rows.projects?.find(item => item.id === deleteButton.dataset.projectDelete);
    if (!row || !confirm('Delete this project permanently?')) return;
    deleteButton.disabled = true;
    const result = await client.from('projects').delete().eq('id', row.id);
    if (result.error) { toast(showError(result.error), true); deleteButton.disabled = false; return; }
    if (row.image_url && !/^https?:\/\//i.test(row.image_url)) await client.storage.from(projectImageBucket).remove([row.image_url]);
    state.rows.projects = state.rows.projects.filter(item => item.id !== row.id);
    renderProjectsCms();
    toast('Project deleted.');
  }, true);
  window.addEventListener('beforeunload', () => { if (projectRealtimeChannel) client.removeChannel(projectRealtimeChannel); });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-view="projects"]')) return;
    const view = $('projectsView');
    if (view) view.innerHTML = '<div class="panel projects-cms-panel"><div class="toolbar"><h2>Projects</h2></div><div class="projects-loading-state">Loading projects...</div></div>';
  }, true);
  (async () => { state.user = await requireAdmin(); if (!state.user) return location.replace('../index.html#admin-login'); $('account').textContent = state.user.email || ''; app.hidden = false; await show('dashboard'); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); await checkUnreadMessages(); window.setInterval(checkUnreadMessages, 30000); client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) location.replace('../index.html'); }); })();
}());
