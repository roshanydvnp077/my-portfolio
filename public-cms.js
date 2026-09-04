(() => {
  'use strict';
  const client = window.supabaseClient;
  if (!client) return;
  const knownSections = ['hero','about','skills','projects','services','journey','testimonials','certificates','contact','resume','hire_me'];
  const resolveUrl = (bucket, path) => path && (/^https?:\/\//i.test(path) ? path : client.storage.from(bucket).getPublicUrl(path).data.publicUrl);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  function hideSections(rows) {
    const visible = new Set(rows.filter(row => row.is_visible).map(row => row.key));
    knownSections.forEach(key => {
      if (visible.has(key)) return;
      const node = document.getElementById(key) || document.querySelector(`[data-section="${key}"]`);
      if (node) node.hidden = true;
    });
  }
  function maintenance(settings) {
    if (!settings?.maintenance_mode) return;
    const overlay = document.createElement('main');
    overlay.id = 'maintenanceMode';
    overlay.innerHTML = `<div><h1>${escape(settings.website_title || 'Website maintenance')}</h1><p>${escape(settings.maintenance_message || 'Website is currently under maintenance. Please check back soon.')}</p></div>`;
    Object.assign(overlay.style, { position:'fixed', inset:'0', zIndex:'99999', display:'grid', placeItems:'center', padding:'2rem', background:'#0b1220', color:'#f8fafc', textAlign:'center' });
    overlay.firstElementChild.style.maxWidth = '34rem';
    overlay.querySelector('h1').style.fontSize = 'clamp(2rem, 6vw, 4rem)';
    overlay.querySelector('p').style.color = '#cbd5e1';
    document.body.replaceChildren(overlay);
  }
  function renderCollection(table, selector, renderer) {
    const target = document.querySelector(selector);
    if (!target) return;
    client.from(table).select('*').eq('is_published', true).order('sort_order').then(result => {
      if (result.error || !result.data?.length) return;
      target.querySelectorAll(`[data-cms-content="${table}"]`).forEach(node => node.remove());
      target.insertAdjacentHTML('beforeend', result.data.map(renderer).join(''));
    });
  }
  async function load() {
    const [sections, settings] = await Promise.all([client.from('section_settings').select('*'), client.from('site_settings').select('*').eq('is_published', true).order('created_at', { ascending:false }).limit(1)]);
    const sectionRows = sections.error ? [] : sections.data || [];
    if (sectionRows.some(row => Object.prototype.hasOwnProperty.call(row, 'key') && Object.prototype.hasOwnProperty.call(row, 'is_visible'))) hideSections(sectionRows);
    if (!settings.error) maintenance(settings.data?.[0]);
    renderCollection('testimonials', '#testimonials .testimonials-grid, #testimonials .testimonials-track', row => `<article data-cms-content="testimonials" class="testimonial-card"><p>${escape(row.message)}</p><strong>${escape(row.name)}</strong><small>${escape(row.position)}</small></article>`);
    renderCollection('certificates', '#certificates .certificates-grid, #certificates .certificates-list', row => `<article data-cms-content="certificates" class="certificate-card"><h3>${escape(row.title)}</h3><p>${escape(row.issuer || row.description)}</p>${row.credential_url ? `<a href="${escape(row.credential_url)}" target="_blank" rel="noopener">View credential</a>` : ''}</article>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
