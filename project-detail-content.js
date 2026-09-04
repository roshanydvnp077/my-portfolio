(function () {
  'use strict';
  const client = window.supabaseClient;
  if (!client) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
  document.addEventListener('DOMContentLoaded', async () => {
    const slug = new URLSearchParams(window.location.search).get('slug') || 'life-link';
    const result = await client.from('projects').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    if (result.error || !result.data) return;
    const project = result.data;
    const title = document.querySelector('.project-title');
    const subtitle = document.querySelector('.project-subtitle');
    const description = document.querySelector('.description-text');
    const badges = document.querySelector('.tech-stack-badges');
    if (title) title.textContent = project.title;
    if (subtitle) subtitle.textContent = project.short_description;
    if (description) description.innerHTML = '<p>' + escape(project.full_description || project.short_description) + '</p>';
    if (badges) badges.innerHTML = (Array.isArray(project.technologies) ? project.technologies : []).map(item => '<div class="tech-badge"><span>' + escape(item) + '</span></div>').join('');
    const demo = document.querySelector('.demo-btn');
    const github = document.querySelector('.github-btn');
    if (demo && project.live_url) demo.href = project.live_url;
    if (github && project.github_url) github.href = project.github_url;
    document.title = project.title + ' | Roshan Yadav';
  });
}());
