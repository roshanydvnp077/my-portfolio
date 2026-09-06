(function () {
  'use strict';
  const adminRoot = window.location.pathname.replace(/[^/]*$/, '');
  let restoring = false;
  const viewFromUrl = () => new URLSearchParams(window.location.search).get('view') || '';
  const urlFor = view => { const url = new URL(window.location.href); if (view) url.searchParams.set('view', view); else url.searchParams.delete('view'); url.hash = ''; return url.pathname + (url.search ? url.search : ''); };
  const findButton = view => Array.from(document.querySelectorAll('.nav [data-view]')).find(button => button.dataset.view === view);
  const showDashboard = () => { const button = findButton('dashboard'); if (button) { restoring = true; button.click(); restoring = false; return true; } return false; };
  const restore = (attempt = 0) => { const view = viewFromUrl(); const button = view ? findButton(view) : null; if (button) { restoring = true; button.click(); restoring = false; return; } if (!view && showDashboard()) return; if (attempt < 40) window.setTimeout(() => restore(attempt + 1), 50); };
  if (!window.history.state?.adminDashboard) window.history.replaceState({ adminDashboard: true, view: viewFromUrl() || 'dashboard' }, '', urlFor(viewFromUrl()));
  document.addEventListener('click', event => { const button = event.target.closest('.nav [data-view]'); if (!button) return; const view = button.dataset.view; if (!view || restoring) return; const current = viewFromUrl(); if (current === view) return; window.history.pushState({ adminDashboard: true, view }, '', urlFor(view)); }, true);
  window.addEventListener('popstate', event => { if (event.state?.adminDashboard || viewFromUrl()) restore(); });
  window.setTimeout(() => restore(), 0);
}());
