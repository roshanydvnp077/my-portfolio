(() => {
  'use strict';
  const client = window.supabaseClient;
  if (!client) return;
  const app = document.getElementById('app');
  const state = { user: null, rows: {} };
  const modules = {
    testimonials: [['name','Name','text',true],['position','Position','text'],['message','Message','textarea',true],['rating','Rating (1-5)','number'],['sort_order','Sort order','number'],['is_published','Visible','checkbox']],
    certificates: [['title','Certificate name','text',true],['issuer','Issuer','text'],['issue_date','Issue date','date'],['credential_id','Credential ID','text'],['credential_url','Credential URL','url'],['sort_order','Sort order','number'],['is_published','Visible','checkbox']]
  };
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const title = key => key[0].toUpperCase() + key.slice(1);
  function openDialog(dialogTitle, html) { const overlay = $('overlay'); if (!overlay) return; $('dialogTitle').textContent = dialogTitle; $('dialogBody').innerHTML = html; overlay.hidden = false; }
  function closeDialog() { const overlay = $('overlay'); if (overlay) overlay.hidden = true; }
  const message = text => { const node = $('toast'); if (!node) return; node.textContent = text; node.className = 'error'; node.hidden = false; setTimeout(() => { node.hidden = true; }, 3500); };
  const formField = ([name, label, type, required], row) => {
    const value = row?.[name] ?? '';
    if (type === 'checkbox') return `<label>${escape(label)}<input name="${name}" type="checkbox" ${value ? 'checked' : ''}></label>`;
    const tag = type === 'textarea' ? 'textarea' : 'input';
    return `<label>${escape(label)}<${tag} class="field" name="${name}" type="${type}" ${required ? 'required' : ''}>${tag === 'textarea' ? escape(value) + `</${tag}>` : '</input>'}</label>`;
  };
  async function isAdmin() {
    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (!user) return null;
    const result = await client.from('admin_users').select('user_id,role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    return result.data ? user : null;
  }
  async function log(action, module, details = {}) { await client.from('activity_logs').insert({ admin_id: state.user.id, action, module, details }); }
  function viewFor(key) {
    let view = $(key + 'View');
    if (!view) { view = document.createElement('section'); view.id = key + 'View'; view.className = 'view'; document.querySelector('.main').appendChild(view); }
    return view;
  }
  async function renderModule(key) {
    const view = viewFor(key);
    const result = await client.from(key).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    if (result.error) { view.innerHTML = `<div class="panel"><p class="status error">${escape(result.error.message)}</p></div>`; return; }
    state.rows[key] = result.data || [];
    if (key === 'certificates') {
      view.innerHTML = `<div class="panel"><div class="toolbar"><h2>Certificates</h2><button class="button primary" data-cms-add="certificates">Add Certificate</button></div><div class="table certificate-table"><table><thead><tr><th>Certificate Name</th><th>Issuer</th><th>Category</th><th>Certificate File</th><th>Actions</th></tr></thead><tbody>${state.rows[key].map(row => `<tr><td><strong>${escape(row.title || '-')}</strong></td><td>${escape(row.issuer || '-')}</td><td>${escape(row.category || 'Education')}</td><td>${(row.file_path || row.credential_url) ? `<button class="button" data-certificate-view="${row.id}">📄 View</button>` : '<span class="muted">No file</span>'}</td><td class="row-actions"><button data-cms-edit="certificates" data-id="${row.id}">Edit</button><button data-cms-delete="certificates" data-id="${row.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">No certificates yet.</div></td></tr>'}</tbody></table></div></div>`;
      return;
    }
    view.innerHTML = `<div class="panel"><div class="toolbar"><h2>${title(key)}</h2><button class="button primary" data-cms-add="${key}">Add ${title(key).slice(0, -1)}</button></div><div class="table"><table><thead><tr>${modules[key].slice(0, 5).map(field => `<th>${escape(field[1])}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${state.rows[key].map(row => `<tr>${modules[key].slice(0, 5).map(([name,,type]) => `<td>${escape(type === 'checkbox' ? (row[name] ? 'Yes' : 'No') : (row[name] || '-'))}</td>`).join('')}<td class="row-actions"><button data-cms-edit="${key}" data-id="${row.id}">Edit</button><button data-cms-delete="${key}" data-id="${row.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No records yet.</div></td></tr>'}</tbody></table></div></div>`;
  }
  function openEditor(key, row) {
    if (key === 'certificates') return openCertificateEditor(row);
    const view = viewFor(key);
    view.innerHTML = `<div class="panel"><div class="toolbar"><h2>${row ? 'Edit' : 'Add'} ${title(key).slice(0, -1)}</h2><button class="button" data-cms-cancel="${key}">Back</button></div><form id="cmsForm" class="form">${modules[key].map(field => formField(field, row)).join('')}<p class="status full" id="cmsStatus"></p><button class="button primary full" type="submit">Save</button></form></div>`;
    $('cmsForm').onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget), payload = {};
      modules[key].forEach(([name,,type]) => { payload[name] = type === 'checkbox' ? data.has(name) : type === 'number' ? Number(data.get(name) || 0) : String(data.get(name) || '').trim(); });
      if (!row) payload.created_by = state.user.id;
      const result = row ? await client.from(key).update(payload).eq('id', row.id) : await client.from(key).insert(payload);
      if (result.error) { $('cmsStatus').textContent = result.error.message; $('cmsStatus').className = 'status full error'; return; }
      await log(row ? 'update' : 'insert', key, { id: row?.id });
      await renderModule(key);
    };
  }
  function openCertificateEditor(row) {
    const filePath = row?.file_path || row?.credential_url || '';
    openDialog((row ? 'Edit' : 'Add') + ' Certificate', '<form id="certificateForm" class="form certificate-editor"><p class="certificate-intro">Basic details only</p><section class="certificate-section"><h3>Certificate Information</h3><p class="muted">Add the certificate details and supporting file.</p><div class="certificate-grid"><label>Certificate Name *<input class="field" name="title" value="' + escape(row?.title) + '" placeholder="e.g. Full Stack Web Development" required></label><label>Issuing Organization *<input class="field" name="issuer" value="' + escape(row?.issuer) + '" placeholder="e.g. Coursera" required></label><label>Certificate ID<input class="field" name="credential_id" value="' + escape(row?.credential_id) + '" placeholder="Optional credential number"></label><label>Category *<select class="field" name="category" required><option value="Education"' + (row?.category === 'Education' || !row?.category ? ' selected' : '') + '>Education</option><option value="Professional"' + (row?.category === 'Professional' ? ' selected' : '') + '>Professional</option><option value="Training"' + (row?.category === 'Training' ? ' selected' : '') + '>Training</option><option value="Other"' + (row?.category === 'Other' ? ' selected' : '') + '>Other</option></select></label><label>Issue Date<input class="field" name="issue_date" type="date" value="' + escape(row?.issue_date) + '"></label><label>Display Order<input class="field" name="sort_order" type="number" min="0" value="' + Number(row?.sort_order || 0) + '"></label></div></section><section class="certificate-section"><h3>Upload Certificate</h3><label class="certificate-dropzone"><input name="file" type="file" accept="application/pdf,image/jpeg,image/png"><span class="certificate-upload-icon">⇧</span><strong>Drop PDF, JPG or PNG here</strong><small>or click to browse</small><button type="button" class="button primary">Choose File</button><em data-certificate-file>' + escape(row?.file_name || (filePath ? 'Current certificate file' : 'No file selected')) + '</em></label></section><section class="certificate-section"><h3>Notes</h3><textarea class="field" name="description" placeholder="Add short description...">' + escape(row?.description) + '</textarea></section><label class="certificate-publish"><input name="is_published" type="checkbox"' + (row?.is_published !== false ? ' checked' : '') + '> Publish certificate</label><p class="status full" id="certificateStatus"></p><div class="certificate-actions"><button type="button" class="button" data-certificate-cancel>Cancel</button><button type="submit" class="button primary">Save Certificate</button></div></form>');
    const form = $('certificateForm'); const fileInput = form.elements.file; const fileLabel = form.querySelector('[data-certificate-file]');
    form.querySelector('[data-certificate-cancel]').onclick = closeDialog;
    fileInput.onchange = () => { fileLabel.textContent = fileInput.files[0]?.name || 'No file selected'; };
    form.onsubmit = async event => { event.preventDefault(); const button = form.querySelector('button[type="submit"]'); const status = $('certificateStatus'); const file = fileInput.files[0]; if (file && (!['application/pdf','image/jpeg','image/png'].includes(file.type) || file.size > 20 * 1024 * 1024)) { status.textContent = 'Choose a PDF, JPG or PNG file up to 20 MB.'; status.className = 'status full error'; return; } button.disabled = true; button.textContent = 'Saving...'; let path = row?.file_path || row?.credential_url || null; try { if (file) { path = state.user.id + '/certificates/' + Date.now() + '-' + file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const upload = await client.storage.from('portfolio-documents').upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error; } const payload = { title: form.elements.title.value.trim(), issuer: form.elements.issuer.value.trim(), credential_id: form.elements.credential_id.value.trim() || null, credential_url: path, description: form.elements.description.value.trim(), issue_date: form.elements.issue_date.value || null, sort_order: Number(form.elements.sort_order.value || 0), is_published: form.elements.is_published.checked, category: form.elements.category.value, file_path: path, file_name: file?.name || row?.file_name || null, file_type: file?.type || row?.file_type || null, file_size: file?.size || row?.file_size || null }; let result = row ? await client.from('certificates').update(payload).eq('id', row.id) : await client.from('certificates').insert({ ...payload, created_by: state.user.id }); if (result.error && /column .* does not exist|schema cache|PGRST204/i.test(result.error.message || '')) { delete payload.category; delete payload.file_path; delete payload.file_name; delete payload.file_type; delete payload.file_size; result = row ? await client.from('certificates').update(payload).eq('id', row.id) : await client.from('certificates').insert({ ...payload, created_by: state.user.id }); } if (result.error) throw result.error; closeDialog(); toast('Certificate saved successfully.'); await show('certificates'); } catch (error) { status.textContent = 'Could not save certificate. Please try again.'; status.className = 'status full error'; button.disabled = false; button.textContent = 'Save Certificate'; console.error(error); } };
  }
  async function renderVisibility() {
    const view = viewFor('visibility');
    const result = await client.from('section_settings').select('*').order('sort_order');
    if (result.error) { view.innerHTML = `<div class="panel"><p class="status error">${escape(result.error.message)}</p></div>`; return; }
    view.innerHTML = `<div class="panel"><div class="toolbar"><h2>Homepage visibility</h2><span class="muted">Changes apply to the public site immediately.</span></div><div class="settings-section">${(result.data || []).map(row => `<label class="toggle-row"><span>${escape(row.label || row.key)}</span><input type="checkbox" data-section="${escape(row.key)}" ${row.is_visible ? 'checked' : ''}><b>${row.is_visible ? 'Visible' : 'Hidden'}</b></label>`).join('')}</div></div>`;
    view.querySelectorAll('[data-section]').forEach(input => input.onchange = async () => { const update = await client.from('section_settings').update({ is_visible: input.checked, updated_by: state.user.id }).eq('key', input.dataset.section); if (update.error) { input.checked = !input.checked; message(update.error.message); return; } input.nextElementSibling.textContent = input.checked ? 'Visible' : 'Hidden'; await log('update', 'section_settings', { key: input.dataset.section, is_visible: input.checked }); });
  }
  const activityActions = { insert: ['Added', 'added', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'], update: ['Updated', 'updated', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1 4 4-1L19 8l-3-3L5 16Zm9-9 3 3"/></svg>'], delete: ['Deleted', 'deleted', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 13h10l1-13"/></svg>'], select: ['Viewed', 'viewed', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>'] };
  const activityModules = { certificates: 'Certificates', projects: 'Projects', gallery: 'Gallery', documents: 'Documents', messages: 'Messages', password_vault: 'Password Vault' };
  const singularActivityModules = { certificates: 'Certificate', projects: 'Project', gallery: 'Gallery', documents: 'Document', messages: 'Message', password_vault: 'Password Vault' };
  const readableActivityModule = value => activityModules[value] || String(value || 'Unknown').replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  const redactActivityDetails = value => {
    const sensitive = /password|token|secret|service[_-]?role|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token/i;
    if (Array.isArray(value)) return value.map(redactActivityDetails);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[redacted]' : redactActivityDetails(item)]));
  };
  const shortActivityId = value => { const text = String(value || ''); return text.length > 18 ? text.slice(0, 14) + '...' : text; };
  const activitySummary = row => {
    const action = activityActions[row.action]?.[1] || readableActivityModule(row.action).toLowerCase();
    const module = readableActivityModule(row.module);
    const details = redactActivityDetails(row.details || {});
    const label = details.title || details.name || details.label;
    const singular = singularActivityModules[row.module] || module;
    if (label) return `${escape(singular)} "${escape(label)}" ${action}`;
    if (details.id) return `${escape(singular)} ${action}<span class="activity-id">ID: ${escape(shortActivityId(details.id))}</span>`;
    return `${module} ${action}`;
  };
  async function renderActivity() {
    const view = viewFor('activity');
    const result = await client.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (result.error) { view.innerHTML = `<div class="panel"><p class="status error">${escape(result.error.message)}</p></div>`; return; }
    state.activityRows = result.data || [];
    view.innerHTML = `<div class="panel activity-log-panel"><div class="toolbar"><div><h2>Activity Log</h2><span class="muted">Latest 100 administrative events</span></div></div><div class="table activity-log-table"><table><thead><tr><th>Action</th><th>Module</th><th>Details</th><th>Date</th></tr></thead><tbody>${state.activityRows.map((row, index) => { const action = activityActions[row.action] || [title(row.action || 'Unknown'), String(row.action || 'unknown').toLowerCase(), '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>']; return `<tr><td data-label="Action"><span class="activity-action ${escape(row.action || 'unknown')}">${action[2]}<span>${escape(action[0])}</span></span></td><td data-label="Module"><span class="activity-module">${escape(readableActivityModule(row.module))}</span></td><td data-label="Details"><button type="button" class="activity-detail-button" data-activity-detail="${index}"><span>${activitySummary(row)}</span><small>View details</small></button></td><td data-label="Date"><time datetime="${escape(row.created_at)}">${escape(new Date(row.created_at).toLocaleString())}</time></td></tr>`; }).join('') || '<tr><td colspan="4"><div class="empty">No activity recorded.</div></td></tr>'}</tbody></table></div></div>`;
  }
  function openActivityDetails(index) {
    const row = state.activityRows?.[index];
    if (!row) return;
    const action = activityActions[row.action]?.[0] || title(row.action || 'Unknown');
    const details = redactActivityDetails(row.details || {});
    openDialog(`${action} ${readableActivityModule(row.module)}`, `<div class="activity-detail-dialog"><p class="activity-detail-summary">${activitySummary(row)}</p><pre>${escape(JSON.stringify(details, null, 2))}</pre><button type="button" class="button primary" data-activity-close>Close</button></div>`);
  }
  async function renderSystem() {
    const view = viewFor('system');
    const services = [{ label: 'Database', icon: '▦', detail: 'Connected', offline: 'Connection failed' }, { label: 'Visibility', icon: '◉', detail: 'Working', offline: 'Unavailable' }, { label: 'Storage', icon: '☁', detail: 'Connected', offline: 'Connection failed' }, { label: 'Authentication', icon: '◆', detail: 'Secure', offline: 'Auth unavailable' }];
    const checking = service => '<div class="system-status-card checking"><div class="system-status-card-top"><span class="system-status-icon">' + service.icon + '</span><span class="system-status-dot"></span></div><h3>Checking...</h3><strong>' + service.label + '</strong><p>Please wait</p></div>';
    view.innerHTML = '<div class="panel system-status-panel"><div class="system-status-heading"><div><span class="eyebrow">Infrastructure health</span><h2>System Status</h2></div><span class="muted">Live service checks</span></div><div class="system-status-grid">' + services.map(checking).join('') + '</div><div class="system-status-footer"><span class="muted" data-system-checked>Checking services...</span><button class="button" type="button" data-system-refresh aria-label="Check system status again">↻ Check Again</button></div></div>';
    const check = async (service, task) => { try { const result = await task(); if (result?.error) { console.error(service.label + ' health check failed:', result.error); return { ...service, status: 'Offline', detail: service.offline }; } return { ...service, status: 'Online', detail: service.detail }; } catch (error) { console.error(service.label + ' health check failed:', error); return { ...service, status: 'Offline', detail: service.offline }; } };
    const runChecks = async () => { const refresh = view.querySelector('[data-system-refresh]'); refresh.disabled = true; view.querySelector('.system-status-grid').innerHTML = services.map(checking).join(''); view.querySelector('[data-system-checked]').textContent = 'Checking services...'; const results = await Promise.all([check(services[0], () => client.from('site_settings').select('id').limit(1)), check(services[1], () => client.from('section_settings').select('key').limit(1)), check(services[2], () => client.storage.listBuckets()), check(services[3], () => client.auth.getSession())]); view.querySelector('.system-status-grid').innerHTML = results.map(result => '<div class="system-status-card ' + result.status.toLowerCase() + '"><div class="system-status-card-top"><span class="system-status-icon">' + result.icon + '</span><span class="system-status-dot"></span></div><h3>' + result.status + '</h3><strong>' + result.label + '</strong><p>' + result.detail + '</p></div>').join(''); view.querySelector('[data-system-checked]').textContent = 'Last checked: ' + new Date().toLocaleString(); refresh.disabled = false; };
    view.querySelector('[data-system-refresh]').onclick = runChecks;
    await runChecks();
  }
  async function renderDashboard() {
    const view = viewFor('dashboard');
    const tables = ['projects', 'skills', 'services', 'journey', 'testimonials', 'certificates', 'contact_messages', 'gallery', 'documents'];
    const results = await Promise.all(tables.map(table => client.from(table).select(table === 'contact_messages' ? 'id' : 'id,is_published')));
    const failed = results.find(result => result.error);
    if (failed) { view.innerHTML = `<div class="panel"><p class="status error">Failed to load dashboard: ${escape(failed.error.message)}</p></div>`; return; }
    const counts = results.map(result => result.data || []);
    const total = counts.slice(0, 8).reduce((sum, rows) => sum + rows.length, 0);
    const published = counts.slice(0, 6).reduce((sum, rows) => sum + rows.filter(row => row.is_published).length, 0);
    const activity = await client.from('activity_logs').select('action,module,created_at').order('created_at', { ascending: false }).limit(5);
    view.innerHTML = `<div class="stats">${[['Projects',counts[0].length],['Skills',counts[1].length],['Services',counts[2].length],['Journey',counts[3].length],['Testimonials',counts[4].length],['Certificates',counts[5].length],['Messages',counts[6].length],['Gallery files',counts[7].length],['Published',published],['Hidden',Math.max(0, total - published)]].map(item => `<div class="stat"><span>${item[0]}</span><b>${item[1]}</b></div>`).join('')}</div><div class="panel"><div class="toolbar"><h2>Recent activity</h2><button class="button" data-view="activity">View all</button></div>${activity.error ? `<p class="status error">${escape(activity.error.message)}</p>` : `<div class="table"><table><thead><tr><th>Action</th><th>Module</th><th>Date</th></tr></thead><tbody>${(activity.data || []).map(row => `<tr><td>${escape(row.action)}</td><td>${escape(row.module)}</td><td>${escape(new Date(row.created_at).toLocaleString())}</td></tr>`).join('') || '<tr><td colspan="3">No activity recorded yet.</td></tr>'}</tbody></table></div>`}</div>`;
  }
  async function show(key) {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== key + 'View'; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === key));
    const render = key === 'dashboard' ? renderDashboard : key === 'visibility' ? renderVisibility : key === 'activity' ? renderActivity : key === 'system' ? renderSystem : () => renderModule(key);
    await render();
  }
  function addNav(key, label) { if (document.querySelector(`[data-view="${key}"]`)) return; const button = document.createElement('button'); button.dataset.view = key; button.textContent = label; document.querySelector('.nav')?.appendChild(button); }
  document.addEventListener('click', async event => {
    const add = event.target.closest('[data-cms-add]'); if (add) return openEditor(add.dataset.cmsAdd);
    const edit = event.target.closest('[data-cms-edit]'); if (edit) return openEditor(edit.dataset.cmsEdit, state.rows[edit.dataset.cmsEdit].find(row => row.id === edit.dataset.id));
    const cancel = event.target.closest('[data-cms-cancel]'); if (cancel) return show(cancel.dataset.cmsCancel);
    const del = event.target.closest('[data-cms-delete]'); if (del && confirm('Are you sure you want to delete this record? This action cannot be undone.')) { const result = await client.from(del.dataset.cmsDelete).delete().eq('id', del.dataset.id); if (result.error) message(result.error.message); else { await log('delete', del.dataset.cmsDelete, { id: del.dataset.id }); await renderModule(del.dataset.cmsDelete); } }
    const certificateView = event.target.closest('[data-certificate-view]'); if (certificateView) { const row = state.rows.certificates.find(item => item.id === certificateView.dataset.certificateView); const path = row?.file_path || row?.credential_url; if (path) { const result = await client.storage.from('portfolio-documents').createSignedUrl(path, 60); if (result.error) message('Unable to open certificate file.'); else window.open(result.data.signedUrl, '_blank', 'noopener'); } return; }
    const nav = event.target.closest('[data-view]')?.dataset.view; if (nav === 'testimonials') return; if (['dashboard','certificates','visibility','activity','system'].includes(nav)) { event.preventDefault(); event.stopPropagation(); await show(nav); }
  }, true);
  document.addEventListener('click', event => {
    const detail = event.target.closest('[data-activity-detail]');
    if (detail) { event.preventDefault(); openActivityDetails(detail.dataset.activityDetail); return; }
    if (event.target.closest('[data-activity-close]')) closeDialog();
  });
  (async () => { state.user = await isAdmin(); if (!state.user || !app) return; addNav('certificates', 'Certificates'); addNav('visibility', 'Homepage'); addNav('activity', 'Activity Logs'); addNav('system', 'System Status'); client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) location.replace('../index.html#admin-login'); }); })();
})();
