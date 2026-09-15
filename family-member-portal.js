/**
 * Family Member Portal - Main Dashboard Logic
 * Handles authentication, navigation, data loading, and activity logging
 */

(function () {
  'use strict';

  const client = window.supabaseClient;
  const state = {
    user: null,
    member: null,
    currentPage: 'dashboard',
  };

  // ============================================
  // INITIALIZATION
  // ============================================

  document.addEventListener('DOMContentLoaded', async function () {
    if (!client) {
      showError('Supabase client not configured');
      return;
    }

    // Check authentication
    await checkAuthentication();

    // Setup event listeners
    setupEventListeners();

    // Load dashboard data
    await loadDashboard();
  });

  // ============================================
  // AUTHENTICATION
  // ============================================

  async function checkAuthentication() {
    try {
      const { data: { session }, error } = await client.auth.getSession();
      
      if (error || !session) {
        redirectToLogin();
        return;
      }

      state.user = session.user;

      // Find linked family member
      const linked = await window.FamilyAuthUtils.findLinkedFamilyMember(
        client,
        state.user.id,
        state.user.email
      );

      if (!linked || !linked.data) {
        await client.auth.signOut();
        alert('Your account is not linked to a family member profile. Please contact the administrator.');
        redirectToLogin();
        return;
      }

      state.member = linked.data;

      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');

      // Check account status
      if (state.member.account_status === 'disabled') {
        await client.auth.signOut();
        alert('Your family account is currently disabled. Please contact the administrator.');
        redirectToLogin();
        return;
      }

      // Update UI with member info
      updateUserInfo();

    } catch (error) {
      console.error('Authentication check failed:', error);
      redirectToLogin();
    }
  }

  function redirectToLogin() {
    window.location.href = 'family-member-login.html';
  }

  function updateUserInfo() {
    if (!state.member) return;

    console.log('[Portal] updateUserInfo called for member:', state.member.id);
    console.log('[Portal] Member photo data:', {
      profile_photo: state.member.profile_photo,
      profile_photo_path: state.member.profile_photo_path,
      profile_image_url: state.member.profile_image_url
    });

    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    const heroAvatar = document.getElementById('heroAvatar');
    const heroTitle = document.getElementById('heroTitle');

    if (userName) {
      userName.textContent = state.member.full_name || 'Family Member';
    }

    if (userRole) {
      userRole.textContent = state.member.relationship || 'Family Member';
    }

    if (userAvatar) {
      // Use shared utility if available
      if (window.FamilyProfile && window.FamilyProfile.paintAvatar) {
        console.log('[Portal] Using FamilyProfile.paintAvatar for user avatar');
        window.FamilyProfile.paintAvatar(userAvatar, state.member, 'medium');
      } else {
        // Fallback to old method
        console.log('[Portal] FamilyProfile not available, using fallback avatar rendering');
        const photoPath = state.member.profile_photo_path || state.member.profile_image_url || state.member.profile_photo;
        if (photoPath) {
          const photoUrl = getPhotoUrl(photoPath, state.member.profile_photo_path ? 'family-vault' : state.member.profile_photo ? 'family-photos' : 'profile-images');
          console.log('[Portal] Avatar photo URL:', photoUrl);
          userAvatar.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(state.member.full_name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="console.error('[Portal] Avatar image failed to load:', this.src); this.parentNode.textContent = '${getInitials(state.member.full_name)}'">`;
        } else {
          const initials = getInitials(state.member.full_name);
          console.log('[Portal] No photo found, using initials:', initials);
          userAvatar.textContent = initials;
        }
      }
    }

    if (heroAvatar) {
      if (window.FamilyProfile && window.FamilyProfile.paintAvatar) {
        window.FamilyProfile.paintAvatar(heroAvatar, state.member, 'large');
      } else {
        const photoPath = state.member.profile_photo_path || state.member.profile_image_url || state.member.profile_photo;
        heroAvatar.innerHTML = photoPath
          ? `<img src="${escapeHtml(getPhotoUrl(photoPath, state.member.profile_photo_path ? 'family-vault' : state.member.profile_photo ? 'family-photos' : 'profile-images'))}" alt="${escapeHtml(state.member.full_name || 'Family member')}" onerror="this.remove(); this.parentNode.textContent='${escapeHtml(getInitials(state.member.full_name))}'">`
          : escapeHtml(getInitials(state.member.full_name));
      }
    }

    if (heroTitle) {
      const greeting = getGreeting();
      heroTitle.textContent = `${greeting}, ${state.member.full_name?.split(' ')[0] || 'Member'}`;
    }
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void handleGlobalSearch(searchInput);
        }
      });
    }

    // Navigation
    document.querySelectorAll('[data-page]').forEach(element => {
      element.addEventListener('click', async function (e) {
        e.preventDefault();
        const page = this.dataset.page;
        await navigateToPage(page);
      });
    });

    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
      const openProfile = () => { void navigateToPage('profile'); };
      userMenu.addEventListener('click', openProfile);
      userMenu.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProfile();
        }
      });
    }

    const notificationsButton = document.getElementById('notificationsButton');
    if (notificationsButton) {
      notificationsButton.addEventListener('click', () => { void navigateToPage('notifications'); });
    }

    // Logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Mobile menu
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const sidebar = document.getElementById('sidebar');
    if (mobileMenuButton && sidebar) {
      mobileMenuButton.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        document.body.classList.toggle('nav-open', sidebar.classList.contains('open'));
      });

      // Close sidebar when clicking outside
      document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !mobileMenuButton.contains(e.target)) {
          sidebar.classList.remove('open');
          document.body.classList.remove('nav-open');
        }
      });
    }

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  async function handleGlobalSearch(searchInput) {
    const query = String(searchInput.value || '').trim();
    if (!query) return;

    searchInput.disabled = true;
    const originalPlaceholder = searchInput.placeholder;
    searchInput.placeholder = 'Searching family...';

    try {
      const { data, error } = await client
        .from('family_members')
        .select('id, full_name, relationship, branch, is_visible')
        .eq('is_visible', true)
        .or(`full_name.ilike.%${query}%,relationship.ilike.%${query}%,branch.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;

      if (!data || data.length === 0) {
        showError(`No family member found for "${query}".`);
        return;
      }

      await navigateToPage('family-tree');
      const treeSearch = document.getElementById('familyTreeSearch');
      if (treeSearch) {
        treeSearch.value = query;
        treeSearch.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (error) {
      console.error('Global family search failed:', error);
      showError('Search is unavailable right now. Please try again.');
    } finally {
      searchInput.disabled = false;
      searchInput.placeholder = originalPlaceholder;
    }
  }

  async function handleLogout(e) {
    e.preventDefault();
    
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    try {
      // Log logout activity
      if (state.member && window.FamilyActivityLogger) {
        await window.FamilyActivityLogger.logLogout(client, state.member.id);
      }

      // Sign out
      await client.auth.signOut();
      
      // Redirect to login
      redirectToLogin();
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Logout failed. Please try again.');
    }
  }

  function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  // ============================================
  // NAVIGATION
  // ============================================

  async function navigateToPage(page) {
    state.currentPage = page;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.dataset.page === page) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Hide all views
    document.querySelectorAll('[id$="View"]').forEach(view => {
      view.hidden = true;
    });

    // Show selected view
    const viewId = page.replace(/-/g, '') + 'View';
    const view = document.getElementById(viewId);
    if (view) {
      view.hidden = false;
    }

    // Load page-specific data
    switch (page) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'profile':
        await loadProfile();
        break;
      case 'family-tree':
        await loadFamilyTree();
        break;
      case 'gallery':
        await loadGallery();
        break;
      case 'documents':
        await loadDocuments();
        break;
      case 'dates':
        await loadDates();
        break;
      case 'achievements':
        await loadAchievements();
        break;
      case 'notifications':
        await loadNotifications();
        break;
      case 'activity':
        await loadActivity();
        break;
      case 'settings':
        await loadSettings();
        break;
    }

    // Close mobile menu
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
      document.body.classList.remove('nav-open');
    }
  }

  // ============================================
  // DASHBOARD DATA LOADING
  // ============================================

  async function loadDashboard() {
    if (!state.member) return;

    try {
      // Load statistics
      await Promise.all([
        loadStatistics(),
        loadRecentPhotos(),
        loadUpcomingDates(),
        loadRecentAchievements(),
        loadRecentActivity(),
      ]);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }

  async function loadStatistics() {
    try {
      // Load family members count
      const { count: membersCount } = await client
        .from('family_members')
        .select('*', { count: 'exact', head: true })
        .eq('is_visible', true);

      // Load photos count
      const { count: photosCount } = await client
        .from('family_gallery')
        .select('*', { count: 'exact', head: true });

      // Load upcoming events count
      const today = new Date().toISOString().split('T')[0];
      const { count: eventsCount } = await client
        .from('family_events')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', today);

      // Load achievements count
      const { count: achievementsCount } = await client
        .from('achievements')
        .select('*', { count: 'exact', head: true })
        .eq('family_member_id', state.member.id);

      // Update UI
      updateStat('statMembers', membersCount || 0);
      updateStat('statPhotos', photosCount || 0);
      updateStat('statEvents', eventsCount || 0);
      updateStat('statAchievements', achievementsCount || 0);

    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  function updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  async function loadRecentPhotos() {
    const container = document.getElementById('recentPhotosContent');
    if (!container) return;

    try {
      const { data, error } = await client
        .from('family_gallery')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📸</div><div>No photos yet</div></div>';
        return;
      }

      container.innerHTML = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;"></div>';
      const grid = container.firstChild;

      const photoUrls = new Map(await Promise.all(data.map(async photo => [
        photo.id,
        await resolveGalleryPhotoUrl(photo.file_path, photo.storage_bucket || 'family-vault', state.member.id)
      ])));

      data.forEach(photo => {
        const photoUrl = photoUrls.get(photo.id) || '';
        const photoCard = document.createElement('div');
        photoCard.style.cssText = 'aspect-ratio: 1; border-radius: 12px; overflow: hidden; cursor: pointer; position: relative;';
        photoCard.innerHTML = `
          ${photoUrl
            ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(photo.title || 'Photo')}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">`
            : '<div style="width:100%;height:100%;display:grid;place-items:center;background:rgba(20,125,130,0.1);color:var(--muted);font-size:2rem;">📷</div>'}
          <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); color: #fff; font-size: 12px;">
            ${escapeHtml(photo.title || 'Untitled')}
          </div>
        `;
        grid.appendChild(photoCard);
      });

    } catch (error) {
      console.error('Failed to load recent photos:', error);
      container.innerHTML = '<div class="empty-state"><div>Failed to load photos</div></div>';
    }
  }

  async function loadUpcomingDates() {
    const container = document.getElementById('upcomingDatesContent');
    if (!container) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await client
        .from('family_events')
        .select('*')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div>No upcoming dates</div></div>';
        return;
      }

      container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 12px;"></div>';
      const list = container.firstChild;

      data.forEach(event => {
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString(undefined, { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });

        const eventCard = document.createElement('div');
        eventCard.style.cssText = 'display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 10px; background: rgba(96, 165, 250, 0.05); border: 1px solid var(--line);';
        eventCard.innerHTML = `
          <div style="width: 48px; height: 48px; border-radius: 8px; background: var(--gradient); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;">
            <div style="font-size: 18px; font-weight: 700; line-height: 1;">${eventDate.getDate()}</div>
            <div style="font-size: 10px; text-transform: uppercase;">${eventDate.toLocaleString('default', { month: 'short' })}</div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: var(--text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(event.title)}
            </div>
            <div style="font-size: 13px; color: var(--muted);">
              ${escapeHtml(event.event_type || 'Event')}
            </div>
          </div>
        `;
        list.appendChild(eventCard);
      });

    } catch (error) {
      console.error('Failed to load upcoming dates:', error);
      container.innerHTML = '<div class="empty-state"><div>Failed to load dates</div></div>';
    }
  }

  async function loadRecentAchievements() {
    const container = document.getElementById('achievementsContent');
    if (!container) return;

    try {
      const { data, error } = await client
        .from('achievements')
        .select('*')
        .eq('family_member_id', state.member.id)
        .order('achievement_date', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏆</div><div>No achievements yet</div></div>';
        return;
      }

      container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 12px;"></div>';
      const list = container.firstChild;

      data.forEach(achievement => {
        const achievementCard = document.createElement('div');
        achievementCard.style.cssText = 'padding: 12px; border-radius: 10px; background: rgba(52, 211, 153, 0.05); border: 1px solid var(--line);';
        achievementCard.innerHTML = `
          <div style="display: flex; align-items: start; gap: 12px;">
            <div style="font-size: 24px; flex-shrink: 0;">🏆</div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">
                ${escapeHtml(achievement.title)}
              </div>
              <div style="font-size: 13px; color: var(--muted);">
                ${achievement.achievement_date ? new Date(achievement.achievement_date).toLocaleDateString() : 'No date'}
              </div>
            </div>
          </div>
        `;
        list.appendChild(achievementCard);
      });

    } catch (error) {
      console.error('Failed to load achievements:', error);
      container.innerHTML = '<div class="empty-state"><div>Failed to load achievements</div></div>';
    }
  }

  async function loadRecentActivity() {
    const container = document.getElementById('recentActivityContent');
    if (!container) return;

    try {
      const { data, error } = await window.FamilyActivityLogger.getActivityLogs(
        client,
        state.member.id,
        { limit: 5 }
      );

      if (error) throw new Error(error);

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div>No activity yet</div></div>';
        return;
      }

      container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 12px;"></div>';
      const list = container.firstChild;

      data.forEach(activity => {
        const formatted = window.FamilyActivityLogger.formatActivity(activity);
        const activityCard = document.createElement('div');
        activityCard.style.cssText = 'padding: 12px; border-radius: 10px; background: rgba(168, 139, 250, 0.05); border: 1px solid var(--line);';
        activityCard.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; color: var(--text); margin-bottom: 4px;">
                ${escapeHtml(formatted.description)}
              </div>
              <div style="font-size: 12px; color: var(--muted);">
                ${escapeHtml(formatted.date)} at ${escapeHtml(formatted.time)}
              </div>
            </div>
            <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; margin-top: 6px;"></div>
          </div>
        `;
        list.appendChild(activityCard);
      });

    } catch (error) {
      console.error('Failed to load recent activity:', error);
      container.innerHTML = '<div class="empty-state"><div>Failed to load activity</div></div>';
    }
  }

  // ============================================
  // STUB FUNCTIONS FOR OTHER PAGES
  // ============================================

  async function loadProfile() {
    const view = document.getElementById('profileView');
    if (!view || !state.member) return;
    
    if (window.FamilyProfileEditor) {
      await window.FamilyProfileEditor.loadProfileEditor(view, state.member);
    } else {
      view.innerHTML = '<div class="hero-section"><h1>My Profile</h1><p>Profile editor loading...</p></div>';
    }
  }

  async function loadFamilyTree() {
    const view = document.getElementById('familytreeView');
    if (!view || !state.member) return;

    view.innerHTML = `
      <div class="family-tree-page" style="padding: 24px;">
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
          <div>
            <h1 class="page-title" style="margin:0 0 8px; font-size:2rem;">Family Tree</h1>
            <p class="page-description" style="margin:0; color: var(--muted);">Explore your family connections and genealogy</p>
          </div>
          <input id="familyTreeSearch" type="search" placeholder="Search family member..." style="width:min(420px,100%); padding: 12px 16px; border-radius: 12px; border:1px solid rgba(148,163,184,0.35); background: rgba(15,23,42,0.02); color: var(--text); font-size: 1rem;" />
        </div>

        <div id="familyTreeBoard" style="position:relative; min-height:420px; padding: 12px; border:1px solid rgba(148,163,184,0.22); border-radius:18px; background: rgba(255,255,255,0.02); overflow: hidden;">
          <svg id="familyTreeSvg" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; z-index:0;"></svg>
          <div id="familyTreeGrid" style="position:relative; z-index:1; display:grid; gap: 32px; align-items: start;"></div>
        </div>
        <div id="familyTreeDetail" style="display:none; margin-top: 24px; padding: 22px; border-radius: 18px; background: rgba(15,23,42,0.03); border: 1px solid rgba(148,163,184,0.25);"></div>
      </div>
    `;

    const board = document.getElementById('familyTreeBoard');
    const grid = document.getElementById('familyTreeGrid');
    const svg = document.getElementById('familyTreeSvg');
    const detailBox = document.getElementById('familyTreeDetail');
    const searchInput = document.getElementById('familyTreeSearch');

    async function showMemberDetails(member) {
      if (!member || !detailBox) return;

      const photoUrl = await resolveMemberPhotoUrl(member);
      const fields = [
        ['Relationship', member.relationship],
        ['Gender', member.gender],
        ['Date of Birth', member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString() : null],
        ['Email', member.email],
        ['Phone', member.phone],
        ['Occupation', member.occupation],
        ['Branch', member.branch || member.family_branch || null],
        ['Status', member.living_status],
        ['Address', member.address],
        ['Education', member.education],
        ['Blood Group', member.blood_group],
        ['Father', member.father_name || null],
        ['Mother', member.mother_name || null],
        ['Spouse', member.spouse_name || null],
      ].filter(([, value]) => value && String(value).trim() !== '');

      detailBox.style.display = 'block';
      detailBox.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(2, 6, 23, 0.72); backdrop-filter: blur(6px); z-index: 2000; display:flex; align-items:center; justify-content:center; padding: 24px;">
          <div class="family-member-detail-modal" style="position: relative; width: min(820px, 94vw); max-height: 92vh; overflow:auto; background: linear-gradient(145deg, #f8fbf7, #eef5f1); border:1px solid rgba(20,45,47,0.16); border-top: 5px solid #ef6f4e; border-radius: 22px; box-shadow:0 30px 80px rgba(15,23,42,0.55); padding: 26px; color: #173337;">
            <button type="button" id="closeFamilyDetail" style="position: absolute; top: 18px; right: 18px; border:none; background: rgba(239,68,68,0.12); color:#fca5a5; padding:10px 16px; border-radius: 12px; cursor:pointer; font-weight:700;">Close</button>

            <div style="display:flex; gap:22px; align-items:center; flex-wrap:wrap; margin-bottom: 24px; padding-bottom: 22px; border-bottom: 1px dashed rgba(20,45,47,0.2);">
              <div style="width: 112px; height: 112px; border-radius: 20px; overflow:hidden; background:linear-gradient(135deg,#16a34a,#22c55e); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:2.4rem; border: 2px solid rgba(255,255,255,0.7); box-shadow: 0 10px 24px rgba(20,45,47,0.16);">
                ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(member.full_name || 'Member')}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.parentNode.textContent='${escapeHtml((member.full_name || 'M').charAt(0).toUpperCase())}'">` : escapeHtml((member.full_name || 'M').charAt(0).toUpperCase())}
              </div>

              <div style="flex:1; min-width:220px;">
                <div style="font-size: 11px; color: #637b7d; letter-spacing: 0.14em; font-weight: 800; margin-bottom: 8px;">FAMILY ID CARD</div>
                <div style="font-size: clamp(2rem, 4vw, 3rem); font-weight: 800; line-height:1.1; margin-bottom: 8px; color: var(--text);">${escapeHtml(member.full_name || 'Family Member')}</div>
                <div style="font-size: 1.15rem; color: var(--muted); margin-bottom: 10px;">${escapeHtml(member.relationship || 'Family Member')}</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                  <span style="display:inline-block; padding:8px 12px; border-radius: 999px; background: rgba(96,165,250,0.12); color: var(--text); border:1px solid rgba(96,165,250,0.22); font-size: 0.8rem; font-weight:600;">${escapeHtml(member.gender || 'Not specified')}</span>
                  <span style="display:inline-block; padding:8px 12px; border-radius: 999px; background: rgba(52,211,153,0.12); color: #a7f3d0; border:1px solid rgba(52,211,153,0.22); font-size: 0.8rem; font-weight:600;">${escapeHtml(member.living_status || 'Status')}</span>
                  ${member.branch ? `<span style="display:inline-block; padding:8px 12px; border-radius: 999px; background: rgba(168,139,250,0.12); color: #ddd6fe; border:1px solid rgba(168,139,250,0.22); font-size: 0.8rem; font-weight:600;">${escapeHtml(member.branch)}</span>` : ''}
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 20px;">
              ${fields.map(([label, value]) => `
                <div style="padding: 14px 16px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(148,163,184,0.18);">
                  <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">${escapeHtml(label)}</div>
                  <div style="font-size: 0.98rem; color: var(--text); font-weight: 600; line-height:1.5; word-break: break-word;">${escapeHtml(value)}</div>
                </div>
              `).join('') || '<div style="color: var(--muted);">No additional profile details available.</div>'}
            </div>

            ${(member.bio || member.notes || member.achievements || member.hobbies) ? `
              <div style="display:grid; gap: 18px;">
                ${member.bio ? `
                  <div style="padding: 18px; border-radius: 18px; background: rgba(255,255,255,0.03); border:1px solid rgba(148,163,184,0.18);">
                    <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Bio</div>
                    <div style="font-size: 0.98rem; color: var(--text); line-height:1.7;">${escapeHtml(member.bio)}</div>
                  </div>
                ` : ''}
                ${member.achievements ? `
                  <div style="padding: 18px; border-radius: 18px; background: rgba(255,255,255,0.03); border:1px solid rgba(148,163,184,0.18);">
                    <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Achievements</div>
                    <div style="font-size: 0.98rem; color: var(--text); line-height:1.7;">${escapeHtml(member.achievements)}</div>
                  </div>
                ` : ''}
                ${member.hobbies ? `
                  <div style="padding: 18px; border-radius: 18px; background: rgba(255,255,255,0.03); border:1px solid rgba(148,163,184,0.18);">
                    <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Hobbies</div>
                    <div style="font-size: 0.98rem; color: var(--text); line-height:1.7;">${escapeHtml(member.hobbies)}</div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;

      const closeButton = document.getElementById('closeFamilyDetail');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          detailBox.style.display = 'none';
          detailBox.innerHTML = '';
        });
      }
    }

    function buildRelationshipEdges(members) {
      const edges = [];
      const memberMap = new Map(members.map(member => [member.id, member]));

      members.forEach(member => {
        if (member.father_id && memberMap.has(member.father_id)) {
          edges.push([member.id, member.father_id, 'parent']);
        }
        if (member.mother_id && memberMap.has(member.mother_id)) {
          edges.push([member.id, member.mother_id, 'parent']);
        }
        if (member.spouse_id && memberMap.has(member.spouse_id)) {
          edges.push([member.id, member.spouse_id, 'spouse']);
        }
      });

      return edges;
    }

    function collectRelatedMemberIds(rootId, allMembers) {
      const memberMap = new Map(allMembers.map(member => [member.id, member]));
      const relatedIds = new Set([rootId]);
      const queue = [rootId];
      const rootMember = memberMap.get(rootId);
      const rootBranch = String(rootMember?.branch || '').trim().toLowerCase();

      while (queue.length) {
        const currentId = queue.shift();
        const currentMember = memberMap.get(currentId);
        if (!currentMember) continue;

        const spouseId = currentMember.spouse_id;
        const directParentIds = [currentMember.father_id, currentMember.mother_id].filter(Boolean);
        const childIds = allMembers
          .filter(member => member.father_id === currentId || member.mother_id === currentId)
          .map(member => member.id);

        const siblingIds = allMembers
          .filter(member => {
            if (member.id === currentId) return false;
            const sameFather = currentMember.father_id && member.father_id && member.father_id === currentMember.father_id;
            const sameMother = currentMember.mother_id && member.mother_id && member.mother_id === currentMember.mother_id;
            return sameFather || sameMother;
          })
          .map(member => member.id);

        [...directParentIds, spouseId, ...childIds, ...siblingIds].filter(Boolean).forEach(nextId => {
          if (!relatedIds.has(nextId)) {
            relatedIds.add(nextId);
            queue.push(nextId);
          }
        });
      }

      if (rootBranch) {
        allMembers.forEach(member => {
          const memberBranch = String(member.branch || '').trim().toLowerCase();
          if (member.id !== rootId && memberBranch === rootBranch) {
            relatedIds.add(member.id);
          }
        });
      }

      return [...relatedIds];
    }

    function computeGenerationMap(rootId, allMembers) {
      const memberMap = new Map(allMembers.map(member => [member.id, member]));
      const generationalMap = new Map([[rootId, 0]]);
      const queue = [{ id: rootId, generation: 0 }];

      while (queue.length) {
        const current = queue.shift();
        const currentMember = memberMap.get(current.id);
        if (!currentMember) continue;

        const parentIds = [currentMember.father_id, currentMember.mother_id].filter(Boolean);
        const childIds = allMembers
          .filter(member => member.father_id === current.id || member.mother_id === current.id)
          .map(member => member.id);
        const siblingIds = allMembers
          .filter(member => {
            if (member.id === current.id) return false;
            const sameFather = currentMember.father_id && member.father_id && member.father_id === currentMember.father_id;
            const sameMother = currentMember.mother_id && member.mother_id && member.mother_id === currentMember.mother_id;
            return sameFather || sameMother;
          })
          .map(member => member.id);

        const neighbors = [
          ...parentIds.map(id => ({ id, generation: current.generation + 1 })),
          ...childIds.map(id => ({ id, generation: current.generation + 1 })),
          ...(currentMember.spouse_id ? [{ id: currentMember.spouse_id, generation: current.generation }] : []),
          ...siblingIds.map(id => ({ id, generation: current.generation }))
        ];

        neighbors.forEach(neighbor => {
          const currentGen = generationalMap.get(neighbor.id);
          if (currentGen === undefined || neighbor.generation < currentGen) {
            generationalMap.set(neighbor.id, neighbor.generation);
            queue.push({ id: neighbor.id, generation: neighbor.generation });
          }
        });
      }

      return generationalMap;
    }

    function getRelationshipLabel(member, rootMember) {
      if (member.id === rootMember.id) return 'You';
      if (member.id === rootMember.father_id) return 'Father';
      if (member.id === rootMember.mother_id) return 'Mother';
      if (member.id === rootMember.spouse_id) return 'Spouse';
      if (member.father_id === rootMember.id || member.mother_id === rootMember.id) {
        if (member.gender === 'Male') return 'Son';
        if (member.gender === 'Female') return 'Daughter';
        return 'Child';
      }
      if (rootMember.father_id && member.father_id === rootMember.father_id) return 'Brother';
      if (rootMember.mother_id && member.mother_id === rootMember.mother_id) return 'Sister';
      if (member.relationship) return member.relationship;
      return 'Family Member';
    }

    function getParentIds(rootMember, members) {
      const explicitIds = [rootMember?.father_id, rootMember?.mother_id].filter(Boolean);
      const inferredIds = members
        .filter(member => member.id !== rootMember?.id)
        .filter(member => ['father', 'mother', 'parent'].includes(String(member.relationship || '').trim().toLowerCase()))
        .map(member => member.id);
      return [...new Set([...explicitIds, ...inferredIds])];
    }

    try {
      const { data: members, error } = await client
        .from('family_members')
        .select('*')
        .eq('is_visible', true)
        .order('full_name', { ascending: true });

      if (error) throw error;

      const allMembers = (members || []).map(member => {
        const isCurrentMember = member.id === state.member.id || (state.user?.id && member.auth_user_id === state.user.id);
        if (!isCurrentMember) return member;
        return {
          ...member,
          profile_photo_path: member.profile_photo_path || state.member.profile_photo_path,
          profile_image_url: member.profile_image_url || state.member.profile_image_url,
          profile_photo: member.profile_photo || state.member.profile_photo,
          photo_url: member.photo_url || state.member.photo_url,
          photo: member.photo || state.member.photo
        };
      });
      if (!allMembers.some(member => member.id === state.member.id)) {
        allMembers.push({ ...state.member, is_visible: true });
      }
      const familyMap = new Map(allMembers.map(member => [member.id, member]));
      const relevantIds = new Set(collectRelatedMemberIds(state.member.id, allMembers));
      const searchValue = (searchInput.value || '').trim().toLowerCase();

      const visibleIds = searchValue
        ? new Set([...relevantIds].filter(memberId => {
            const member = familyMap.get(memberId);
            if (!member) return false;
            const searchable = [member.full_name, member.relationship, member.gender, member.branch || '', member.occupation || ''].join(' ').toLowerCase();
            return searchable.includes(searchValue);
          }))
        : relevantIds;

      const familyMembers = allMembers.filter(member => visibleIds.has(member.id));
      const rootMember = familyMap.get(state.member.id) || familyMembers[0] || null;
      const generationMap = rootMember ? computeGenerationMap(rootMember.id, allMembers) : new Map();
      const edges = buildRelationshipEdges(familyMembers);

      const rows = [];
      const maxGeneration = familyMembers.length ? Math.max(...familyMembers.map(member => generationMap.get(member.id) ?? 0), 0) : 0;
      for (let generation = 0; generation <= maxGeneration; generation += 1) {
        const generationMembers = familyMembers.filter(member => (generationMap.get(member.id) ?? 0) === generation)
          .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        if (generationMembers.length) {
          rows.push({ generation, members: generationMembers });
        }
      }

      if (!rows.length) {
        grid.innerHTML = `
          <div style="padding: 40px 18px; border: 1px dashed rgba(148,163,184,0.45); border-radius: 18px; color: var(--muted); text-align:center; width:100%;">
            <div style="font-size: 2rem; margin-bottom: 12px;">🌳</div>
            <div style="font-size: 1.1rem; font-weight: 600;">No family relationships added yet.</div>
            <div style="margin-top: 8px;">Your family relationships have not been added yet.</div>
          </div>
        `;
        return;
      }

      function drawConnections() {
        const boardRect = board.getBoundingClientRect();
        const boardWidth = Math.max(board.clientWidth, 300);
        const boardHeight = Math.max(board.clientHeight, grid.scrollHeight + 90, 420);

        board.style.minHeight = `${boardHeight}px`;
        svg.setAttribute('viewBox', `0 0 ${boardWidth} ${boardHeight}`);
        svg.setAttribute('width', boardWidth);
        svg.setAttribute('height', boardHeight);
        svg.innerHTML = '';

        const cards = Array.from(grid.querySelectorAll('[data-member-id]'));
        if (cards.length < 2) return;

        const cardPoint = (card, edge) => {
          const rect = card.getBoundingClientRect();
          return {
            left: rect.left - boardRect.left,
            right: rect.right - boardRect.left,
            top: rect.top - boardRect.top,
            bottom: rect.bottom - boardRect.top,
            centerX: rect.left - boardRect.left + rect.width / 2,
            centerY: rect.top - boardRect.top + rect.height / 2
          };
        };
        const addPath = (d, color, width = 3) => {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', d);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', color);
          path.setAttribute('stroke-width', width);
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          path.setAttribute('opacity', '0.88');
          svg.appendChild(path);
        };

        const parentIds = getParentIds(root, familyMembers);
        const parentCards = parentIds.map(id => grid.querySelector(`[data-member-id="${id}"]`)).filter(Boolean);
        const parentPoints = parentCards.map(card => cardPoint(card));
        const lowerCards = cards.filter(card => !parentIds.includes(card.dataset.memberId));
        const lowerPoints = lowerCards.map(card => cardPoint(card));

        if (parentPoints.length >= 2) {
          const first = parentPoints[0];
          const last = parentPoints[parentPoints.length - 1];
          const spouseY = (first.centerY + last.centerY) / 2;
          addPath(`M ${first.right} ${spouseY} L ${last.left} ${spouseY}`, '#60a5fa', 3.5);
        }

        if (parentPoints.length && lowerPoints.length) {
          const parentBottom = Math.max(...parentPoints.map(point => point.bottom));
          const childTop = Math.min(...lowerPoints.map(point => point.top));
          const railY = parentBottom + Math.max(18, (childTop - parentBottom) / 2);
          const parentCenterX = parentPoints.reduce((sum, point) => sum + point.centerX, 0) / parentPoints.length;
          const firstChildX = Math.min(...lowerPoints.map(point => point.centerX));
          const lastChildX = Math.max(...lowerPoints.map(point => point.centerX));
          addPath(`M ${parentCenterX} ${parentBottom} L ${parentCenterX} ${railY}`, '#34d399');
          addPath(`M ${firstChildX} ${railY} L ${lastChildX} ${railY}`, '#34d399');
          lowerPoints.forEach(point => addPath(`M ${point.centerX} ${railY} L ${point.centerX} ${point.top}`, '#34d399'));
        } else {
          edges.forEach(([fromId, toId, relationType]) => {
            const fromCard = grid.querySelector(`[data-member-id="${fromId}"]`);
            const toCard = grid.querySelector(`[data-member-id="${toId}"]`);
            if (!fromCard || !toCard) return;
            const from = cardPoint(fromCard);
            const to = cardPoint(toCard);
            const midY = (from.centerY + to.centerY) / 2;
            addPath(`M ${from.centerX} ${from.centerY} L ${from.centerX} ${midY} L ${to.centerX} ${midY} L ${to.centerX} ${to.centerY}`, relationType === 'spouse' ? '#60a5fa' : '#34d399', relationType === 'spouse' ? 3.5 : 3);
          });
        }
      }

      async function renderTree(filter = '') {
        const term = filter.trim().toLowerCase();
        const filteredIds = term
          ? new Set([...relevantIds].filter(memberId => {
              const member = familyMap.get(memberId);
              if (!member) return false;
              const searchable = [member.full_name, member.relationship, member.gender, member.branch || '', member.occupation || ''].join(' ').toLowerCase();
              return searchable.includes(term);
            }))
          : relevantIds;

        const visibleMembers = allMembers.filter(member => filteredIds.has(member.id));
        const root = rootMember || visibleMembers[0] || null;
        const activeRows = root && visibleMembers.length
          ? (() => {
              const parentIds = getParentIds(root, visibleMembers);
              const parents = visibleMembers
                .filter(member => parentIds.includes(member.id))
                .sort((first, second) => {
                  const rank = member => String(member.relationship || '').trim().toLowerCase() === 'father' ? 0 : 1;
                  return rank(first) - rank(second);
                });
              const lowerMembers = visibleMembers.filter(member => !parentIds.includes(member.id));
              const nextRows = [];
              if (parents.length) nextRows.push({ generation: 0, members: parents });
              if (lowerMembers.length) nextRows.push({ generation: 1, members: lowerMembers });
              return nextRows.map(row => ({
                ...row,
                members: row.members.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
              }));
            })()
          : rows;

        const memberPhotoUrls = new Map(await Promise.all(visibleMembers.map(async member => {
          const photoMember = member.id === state.member.id ? { ...member, ...state.member } : member;
          return [member.id, await resolveMemberPhotoUrl(photoMember)];
        })));

        grid.innerHTML = activeRows.map(row => `
          <div style="display:flex; flex-direction:column; align-items:center; gap:14px; width:100%;">
            <div style="display:flex; justify-content:center; align-items:center; gap: 18px; flex-wrap:wrap; width:100%; position:relative;">
              ${row.members.map(member => {
                const initials = (member.full_name || 'F').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
                const isSelected = root && member.id === root.id;
                const relationLabel = root ? getRelationshipLabel(member, root) : (member.relationship || 'Family Member');
                const photoUrl = memberPhotoUrls.get(member.id) || '';
                const imageHtml = photoUrl
                  ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(member.full_name || 'Member')}" style="width:100%; height:100%; object-fit:cover;" loading="eager" onerror="this.style.display='none'; this.parentNode.textContent='${escapeHtml(initials || 'F')}'">`
                  : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#2563eb,#7c3aed); color:#fff; font-weight:800; font-size:1.1rem;">${escapeHtml(initials || 'F')}</div>`;

                return `
                  <div data-member-id="${member.id}" tabindex="0" role="button" style="background: ${isSelected ? 'rgba(96,165,250,0.12)' : 'rgba(15,23,42,0.03)'}; border: 1px solid ${isSelected ? 'rgba(96,165,250,0.65)' : 'rgba(148,163,184,0.35)'}; border-radius: 18px; padding: 14px; min-height: 160px; width: min(210px, 100%); box-shadow: ${isSelected ? '0 0 0 2px rgba(96,165,250,0.2)' : '0 10px 30px rgba(15, 23, 42, 0.04)'}; cursor:pointer; transition: transform 0.2s ease, border-color 0.2s ease; text-align:left;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px;">
                      <div style="width: 46px; height: 46px; border-radius: 50%; overflow:hidden; background: rgba(148,163,184,0.12); border: 1px solid rgba(148,163,184,0.25);">${imageHtml}</div>
                      <span style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em;">${escapeHtml(relationLabel || 'Member')}</span>
                    </div>
                    <div style="font-size: 1.04rem; font-weight: 700; margin-bottom: 8px; color: var(--text); line-height: 1.3;">${escapeHtml(member.full_name || 'Family Member')}</div>
                    <div style="font-size: 0.8rem; color: var(--muted); line-height: 1.55;">
                      ${member.gender ? `${escapeHtml(member.gender)} • ` : ''}${member.living_status ? escapeHtml(member.living_status) : 'Family Member'}
                    </div>
                    ${member.branch ? `<div style="margin-top: 10px; font-size: 0.72rem; color: var(--muted);">Branch: ${escapeHtml(member.branch)}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('') || `<div style="padding: 28px; border:1px dashed rgba(148,163,184,0.5); border-radius:16px; color: var(--muted); text-align:center; width:100%;">No family members match your search.</div>`;

        grid.querySelectorAll('[data-member-id]').forEach(card => {
          const memberId = card.getAttribute('data-member-id');
          const memberData = familyMap.get(memberId);
          if (!memberData) return;

          card.addEventListener('click', () => { void showMemberDetails(memberData); });
          card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void showMemberDetails(memberData);
            }
          });
        });

        requestAnimationFrame(drawConnections);
      }

      renderTree(searchInput.value);
      searchInput.addEventListener('input', event => renderTree(event.target.value));

      if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => renderTree(searchInput.value));
        resizeObserver.observe(board);
      } else {
        window.addEventListener('resize', () => renderTree(searchInput.value));
      }
    } catch (error) {
      console.error('Failed to load family tree:', error);
      view.innerHTML = `
        <div class="hero-section">
          <h1>Family Tree</h1>
          <p style="color: #ef4444;">Unable to load this family tree.</p>
        </div>
      `;
    }
  }

  async function loadGallery() {
    const view = document.getElementById('galleryView');
    if (!view || !state.member) return;
    
    console.log('Loading Gallery...', 'FamilyPortalGallery available:', !!window.FamilyPortalGallery);
    
    if (window.FamilyPortalGallery) {
      await window.FamilyPortalGallery.loadGallery(view, state.member);
    } else {
      console.error('FamilyPortalGallery not loaded!');
      view.innerHTML = `
        <div class="hero-section">
          <h1>Gallery</h1>
          <p style="color: #ef4444;">Feature script not loaded. Check browser console for errors.</p>
        </div>`;
    }
  }

  async function loadDocuments() {
    const view = document.getElementById('documentsView');
    if (!view || !state.member) return;
    
    console.log('Loading Documents...', 'FamilyPortalDocuments available:', !!window.FamilyPortalDocuments);
    
    if (window.FamilyPortalDocuments) {
      await window.FamilyPortalDocuments.loadDocuments(view, state.member);
    } else {
      console.error('FamilyPortalDocuments not loaded!');
      view.innerHTML = `
        <div class="hero-section">
          <h1>Documents</h1>
          <p style="color: #ef4444;">Feature script not loaded. Check browser console for errors.</p>
        </div>`;
    }
  }

  async function loadDates() {
    const view = document.getElementById('datesView');
    if (!view || !state.member) return;
    
    console.log('Loading Dates...', 'FamilyPortalDates available:', !!window.FamilyPortalDates);
    
    if (window.FamilyPortalDates) {
      await window.FamilyPortalDates.loadDates(view, state.member);
    } else {
      console.error('FamilyPortalDates not loaded!');
      view.innerHTML = `
        <div class="hero-section">
          <h1>Important Dates</h1>
          <p style="color: #ef4444;">Feature script not loaded. Check browser console for errors.</p>
        </div>`;
    }
  }

  async function loadAchievements() {
    const view = document.getElementById('achievementsView');
    if (!view || !state.member) return;
    
    console.log('Loading Achievements...', 'FamilyPortalAchievements available:', !!window.FamilyPortalAchievements);
    
    if (window.FamilyPortalAchievements) {
      await window.FamilyPortalAchievements.loadAchievements(view, state.member);
    } else {
      console.error('FamilyPortalAchievements not loaded!');
      view.innerHTML = `
        <div class="hero-section">
          <h1>Achievements</h1>
          <p style="color: #ef4444;">Feature script not loaded. Check browser console for errors.</p>
        </div>`;
    }
  }

  async function loadNotifications() {
    const view = document.getElementById('notificationsView');
    if (!view || !state.member) return;
    
    console.log('Loading Notifications...', 'FamilyPortalNotifications available:', !!window.FamilyPortalNotifications);
    
    if (window.FamilyPortalNotifications) {
      await window.FamilyPortalNotifications.loadNotifications(view, state.member);
    } else {
      console.error('FamilyPortalNotifications not loaded!');
      view.innerHTML = `
        <div class="hero-section">
          <h1>Notifications</h1>
          <p style="color: #ef4444;">Feature script not loaded. Check browser console for errors.</p>
        </div>`;
    }
  }

  async function loadActivity() {
    const view = document.getElementById('activityView');
    if (!view || !state.member) return;
    
    if (window.FamilyActivityViewer) {
      await window.FamilyActivityViewer.loadActivityViewer(view, state.member);
    } else {
      view.innerHTML = '<div class="hero-section"><h1>My Activity</h1><p>Activity viewer loading...</p></div>';
    }
  }

  async function loadSettings() {
    const view = document.getElementById('settingsView');
    if (!view || !state.member) return;
    
    if (window.FamilyMemberSettings) {
      await window.FamilyMemberSettings.loadSettings(view, state.member);
    } else {
      view.innerHTML = '<div class="hero-section"><h1>Settings</h1><p>Settings page loading...</p></div>';
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function getPhotoUrl(filePath, bucket = 'profile-images') {
    const emptyPlaceholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="18"%3ENo Image%3C/text%3E%3C/svg%3E';

    if (!filePath || filePath === 'null' || filePath === 'undefined') return emptyPlaceholder;
    if (typeof filePath !== 'string') return emptyPlaceholder;
    const trimmed = filePath.trim();
    if (!trimmed) return emptyPlaceholder;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }

    const normalized = trimmed.replace(/^\/+/, '');
    if (client && client.storage) {
      try {
        const publicUrl = client.storage.from(bucket).getPublicUrl(normalized);
        if (publicUrl && publicUrl.data && publicUrl.data.publicUrl) {
          return publicUrl.data.publicUrl;
        }
      } catch (error) {
        console.warn('[Portal] Public URL lookup failed for bucket', bucket, error);
      }
    }

    if (client && client.supabaseUrl) {
      return `${client.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeURIComponent(normalized)}`;
    }

    return normalized;
  }

  async function resolvePhotoUrl(filePath, bucket = 'profile-images') {
    if (!filePath || typeof filePath !== 'string') return '';
    const trimmed = filePath.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    if (/^(https?:\/\/|data:)/i.test(trimmed)) return trimmed;

    const normalized = trimmed.replace(/^\/+/, '');
    const buckets = [bucket, 'profile-images', 'family-photos', 'family-vault', 'family-private']
      .filter((value, index, list) => list.indexOf(value) === index);
    if (client && client.storage) {
      for (const candidateBucket of buckets) {
        try {
          const signed = await client.storage.from(candidateBucket).createSignedUrl(normalized, 3600);
          if (!signed.error && signed.data && signed.data.signedUrl) return signed.data.signedUrl;
        } catch (error) {
          console.warn('[Portal] Signed photo URL lookup failed for bucket', candidateBucket, error);
        }
      }
    }

    return '';
  }

  async function resolveMemberPhotoUrl(member) {
    if (!member) return '';
    if (window.FamilyProfile?.resolvePhotoUrl) {
      const sharedUrl = await window.FamilyProfile.resolvePhotoUrl(member);
      if (sharedUrl) return sharedUrl;
    }
    const candidates = [
      [member.profile_photo_path, 'family-vault'],
      [member.profile_image_url, 'profile-images'],
      [member.profile_photo, 'family-photos'],
      [member.photo_url, 'profile-images'],
      [member.photo, 'family-photos']
    ];

    for (const [value, bucket] of candidates) {
      const url = await resolvePhotoUrl(value, bucket);
      if (url) return url;
    }
    return '';
  }

  async function resolveGalleryPhotoUrl(filePath, bucket, memberId) {
    if (!filePath || typeof filePath !== 'string') return '';
    const trimmed = filePath.trim();
    if (/^(https?:\/\/|data:)/i.test(trimmed)) return trimmed;

    const normalized = trimmed.replace(/^\/+/, '');
    const fileName = normalized.split('/').pop();
    const buckets = [bucket, 'family-vault', 'family-photos', 'family-private', 'profile-images']
      .filter((value, index, list) => list.indexOf(value) === index);
    const directoryCandidates = [
      normalized.split('/').slice(0, -1).join('/'),
      memberId ? `${memberId}/gallery` : '',
      memberId ? `gallery/${memberId}` : '',
      ''
    ].filter((value, index, list) => list.indexOf(value) === index);

    for (const candidateBucket of buckets) {
      for (const directory of directoryCandidates) {
        const listing = await client.storage.from(candidateBucket).list(directory, {
          limit: 100,
          search: fileName
        });
        if (listing.error) continue;
        const match = (listing.data || []).find(item => item.name === fileName);
        if (!match) continue;
        const actualPath = directory ? `${directory}/${match.name}` : match.name;
        const signed = await client.storage.from(candidateBucket).createSignedUrl(actualPath, 3600);
        if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
      }
    }
    return '';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showError(message) {
    alert(message);
  }

})();
