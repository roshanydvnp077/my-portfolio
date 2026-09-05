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
    view.innerHTML = `<div class="panel"><div class="toolbar"><h2>${title(key)}</h2><button class="button primary" data-cms-add="${key}">Add ${title(key).slice(0, -1)}</button></div><div class="table"><table><thead><tr>${modules[key].slice(0, 5).map(field => `<th>${escape(field[1])}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${state.rows[key].map(row => `<tr>${modules[key].slice(0, 5).map(([name,,type]) => `<td>${escape(type === 'checkbox' ? (row[name] ? 'Yes' : 'No') : (row[name] || '-'))}</td>`).join('')}<td class="row-actions"><button data-cms-edit="${key}" data-id="${row.id}">Edit</button><button data-cms-delete="${key}" data-id="${row.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No records yet.</div></td></tr>'}</tbody></table></div></div>`;
  }
  function openEditor(key, row) {
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
  async function renderVisibility() {
    const view = viewFor('visibility');
    const result = await client.from('section_settings').select('*').order('sort_order');
    if (result.error) { view.innerHTML = `<div class="panel"><p class="status error">${escape(result.error.message)}</p></div>`; return; }
    view.innerHTML = `<div class="panel"><div class="toolbar"><h2>Homepage visibility</h2><span class="muted">Changes apply to the public site immediately.</span></div><div class="settings-section">${(result.data || []).map(row => `<label class="toggle-row"><span>${escape(row.label || row.key)}</span><input type="checkbox" data-section="${escape(row.key)}" ${row.is_visible ? 'checked' : ''}><b>${row.is_visible ? 'Visible' : 'Hidden'}</b></label>`).join('')}</div></div>`;
    view.querySelectorAll('[data-section]').forEach(input => input.onchange = async () => { const update = await client.from('section_settings').update({ is_visible: input.checked, updated_by: state.user.id }).eq('key', input.dataset.section); if (update.error) { input.checked = !input.checked; message(update.error.message); return; } input.nextElementSibling.textContent = input.checked ? 'Visible' : 'Hidden'; await log('update', 'section_settings', { key: input.dataset.section, is_visible: input.checked }); });
  }
  async function renderActivity() {
    const view = viewFor('activity');
    const result = await client.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
    view.innerHTML = `<div class="panel"><div class="toolbar"><h2>Activity log</h2><span class="muted">Latest 100 administrative events</span></div><div class="table"><table><thead><tr><th>Action</th><th>Module</th><th>Details</th><th>Date</th></tr></thead><tbody>${(result.data || []).map(row => `<tr><td>${escape(row.action)}</td><td>${escape(row.module)}</td><td>${escape(JSON.stringify(row.details))}</td><td>${escape(new Date(row.created_at).toLocaleString())}</td></tr>`).join('') || '<tr><td colspan="4">No activity recorded.</td></tr>'}</tbody></table></div></div>`;
  }
  async function renderSystem() {
    const view = viewFor('system');
    const checks = await Promise.all([client.from('site_settings').select('id').limit(1), client.from('section_settings').select('key').limit(1), client.storage.listBuckets()]);
    view.innerHTML = `<div class="panel"><h2>System status</h2><div class="stats"><div class="stat"><span>Database</span><b>${checks[0].error ? 'Error' : 'Online'}</b></div><div class="stat"><span>Visibility table</span><b>${checks[1].error ? 'Error' : 'Online'}</b></div><div class="stat"><span>Storage</span><b>${checks[2].error ? 'Error' : 'Online'}</b></div></div><p class="muted">Checked ${new Date().toLocaleString()}</p></div>`;
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
    const nav = event.target.closest('[data-view]')?.dataset.view; if (['dashboard','testimonials','certificates','visibility','activity','system'].includes(nav)) { event.preventDefault(); event.stopPropagation(); await show(nav); }
  }, true);
  (async () => { state.user = await isAdmin(); if (!state.user || !app) return; addNav('testimonials', 'Testimonials'); addNav('certificates', 'Certificates'); addNav('visibility', 'Homepage'); addNav('activity', 'Activity Logs'); addNav('system', 'System Status'); client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) location.replace('../index.html#admin-login'); }); })();
})();
