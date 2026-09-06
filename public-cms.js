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
  function renderTestimonials() {
    const target = document.querySelector('#testimonials .testimonials-grid');
    if (!target) return;
    const controls = document.querySelector('#testimonials .testimonials-carousel-controls');
    const dots = document.querySelector('#testimonials [data-testimonial-dots]');
    client.from('testimonials').select('*').eq('is_published', true).order('display_order', { ascending: true }).order('sort_order', { ascending: true }).order('created_at', { ascending: false }).then(result => {
      if (result.error) return;
      const rows = result.data || [];
      if (!rows.length) { target.innerHTML = '<div class="testimonials-empty">Testimonials will appear here as client feedback is published.</div>'; if (controls) controls.hidden = true; return; }
      let page = 0;
      const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
      const render = () => {
        const pageSize = rows.length > 3 ? 3 : rows.length;
        const pages = Math.ceil(rows.length / pageSize);
        const visible = rows.length > 3 ? rows.slice(page * pageSize, page * pageSize + pageSize) : rows;
        target.innerHTML = visible.map(row => { const name = row.full_name || row.name || ''; const image = resolveUrl('portfolio-images', row.profile_image || row.photo); const role = row.role || row.position || ''; const review = row.review || row.message || ''; const rating = Math.max(1, Math.min(5, Number(row.rating || 5))); return '<article data-cms-content="testimonials" class="testimonial-card"><span class="testimonial-quote-mark">“</span><p class="testimonial-review">' + escape(review) + '</p><div class="testimonial-stars" aria-label="' + rating + ' out of 5 stars">' + '★'.repeat(rating) + '<span>' + '★'.repeat(5 - rating) + '</span></div><div class="testimonial-client">' + (image ? '<img class="testimonial-client-avatar" src="' + escape(image) + '" alt="' + escape(name) + '" loading="lazy">' : '<span class="testimonial-client-avatar">' + escape(initials(name)) + '</span>') + '<div class="testimonial-client-info"><strong>' + escape(name) + '</strong><span>' + escape([role, row.company].filter(Boolean).join(' · ')) + '</span>' + (row.website_url || row.linkedin_url ? '<a href="' + escape(row.website_url || row.linkedin_url) + '" target="_blank" rel="noopener">View profile</a>' : '') + '</div></div></article>'; }).join('');
        if (controls) controls.hidden = rows.length <= 3;
        if (dots) dots.innerHTML = rows.length > 3 ? Array.from({ length: pages }, (_, index) => '<button type="button" class="' + (index === page ? 'active' : '') + '" data-testimonial-page="' + index + '" aria-label="Show testimonials ' + (index + 1) + '"></button>').join('') : '';
      };
      controls?.querySelector('[data-testimonial-prev]')?.addEventListener('click', () => { page = (page - 1 + Math.ceil(rows.length / 3)) % Math.ceil(rows.length / 3); render(); });
      controls?.querySelector('[data-testimonial-next]')?.addEventListener('click', () => { page = (page + 1) % Math.ceil(rows.length / 3); render(); });
      dots?.addEventListener('click', event => { const button = event.target.closest('[data-testimonial-page]'); if (button) { page = Number(button.dataset.testimonialPage); render(); } });
      render();
    });
  }
  async function load() {
    const [sections, settings] = await Promise.all([client.from('section_settings').select('*'), client.from('site_settings').select('*').eq('is_published', true).order('created_at', { ascending:false }).limit(1)]);
    const sectionRows = sections.error ? [] : sections.data || [];
    if (sectionRows.some(row => Object.prototype.hasOwnProperty.call(row, 'key') && Object.prototype.hasOwnProperty.call(row, 'is_visible'))) hideSections(sectionRows);
    if (!settings.error) maintenance(settings.data?.[0]);
    renderTestimonials();
    renderCollection('certificates', '#certificates .certificates-grid, #certificates .certificates-list', row => `<article data-cms-content="certificates" class="certificate-card"><h3>${escape(row.title)}</h3><p>${escape(row.issuer || row.description)}</p>${row.credential_url ? `<a href="${escape(row.credential_url)}" target="_blank" rel="noopener">View credential</a>` : ''}</article>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
