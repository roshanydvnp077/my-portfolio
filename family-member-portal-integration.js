// Family Member Portal - Full Integration Layer
// Connects UI to family-member-self-service.js API
// This file enhances the existing portal with full CRUD functionality

(async function() {
  'use strict';

  const client = window.supabaseClient;
  const selfService = window.FamilyMemberSelfService;

  if (!client) {
    console.error('Supabase client not initialized');
    return;
  }

  // Wait for self-service to initialize
  let initialized = false;
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    if (selfService) {
      initialized = await selfService.initialize();
      if (initialized) break;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (!initialized) {
    console.error('Could not initialize self-service');
    return;
  }

  const state = selfService.getState();
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  function formatDate(dateValue) {
    if (!dateValue) return '—';
    const d = new Date(dateValue + (String(dateValue).length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return dateValue;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
  }

  function showModal(title, bodyHtml, onSave) {
    const backdrop = document.createElement('div');
    backdrop.className = 'member-modal-backdrop open';
    backdrop.innerHTML = `
      <div class="member-modal">
        <h3>${escapeHtml(title)}</h3>
        ${bodyHtml}
      </div>
    `;

    const closeModal = () => backdrop.remove();
    
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal();
    });

    const form = backdrop.querySelector('form');
    if (form && onSave) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const success = await onSave(new FormData(form));
        if (success) closeModal();
      });
    }

    const cancelBtn = backdrop.querySelector('[data-cancel]');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    document.body.appendChild(backdrop);
  }

  // ============================================
  // QUICK ACTIONS INTEGRATION
  // ============================================

  function setupQuickActions() {
    // Upload Memory
    const uploadMemoryBtn = document.querySelector('[data-action="upload-memory"]');
    if (uploadMemoryBtn) {
      uploadMemoryBtn.addEventListener('click', () => openUploadGalleryDialog());
    }

    // Add Important Date
    const addDateBtn = document.querySelector('[data-action="add-date"]');
    if (addDateBtn) {
      addDateBtn.addEventListener('click', () => openAddEventDialog());
    }

    // Add Achievement
    const addAchievementBtn = document.querySelector('[data-action="add-achievement"]');
    if (addAchievementBtn) {
      addAchievementBtn.addEventListener('click', () => openAddAchievementDialog());
    }

    // Upload Document
    const uploadDocBtn = document.querySelector('[data-action="upload-document"]');
    if (uploadDocBtn) {
      uploadDocBtn.addEventListener('click', () => openUploadDocumentDialog());
    }
  }

  // ============================================
  // IMPORTANT DATES (Events) PAGE
  // ============================================

  async function loadEventsPage() {
    const container = document.getElementById('datesPanel');
    if (!container) return;

    try {
      const { data: events, error } = await client
        .from('family_events')
        .select('*')
        .eq('family_member_id', state.currentMember.id)
        .order('event_date', { ascending: false });

      if (error) throw error;

      const upcomingEvents = events.filter(e => new Date(e.event_date) >= new Date());
      const pastEvents = events.filter(e => new Date(e.event_date) < new Date());

      const html = `
        <div class="panel-header">
          <h3>Important Dates</h3>
          <button type="button" class="button primary" onclick="window.openAddEventDialog()">Add Date</button>
        </div>
        
        <div class="tabs" style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <button class="tab-btn active" data-tab="upcoming">Upcoming</button>
          <button class="tab-btn" data-tab="all">All</button>
          <button class="tab-btn" data-tab="past">Past</button>
        </div>

        <div class="tab-content" data-tab-content="upcoming">
          ${upcomingEvents.length === 0 
            ? '<div class="empty-state">No upcoming dates. Click "Add Date" to create one.</div>'
            : `<div class="date-list">${upcomingEvents.map(renderEventCard).join('')}</div>`
          }
        </div>

        <div class="tab-content portal-hidden" data-tab-content="all">
          ${events.length === 0
            ? '<div class="empty-state">No dates yet. Click "Add Date" to create one.</div>'
            : `<div class="date-list">${events.map(renderEventCard).join('')}</div>`
          }
        </div>

        <div class="tab-content portal-hidden" data-tab-content="past">
          ${pastEvents.length === 0
            ? '<div class="empty-state">No past dates.</div>'
            : `<div class="date-list">${pastEvents.map(renderEventCard).join('')}</div>`
          }
        </div>
      `;

      container.innerHTML = html;
      setupEventTabs();
      setupEventActions();
    } catch (error) {
      console.error('Failed to load events:', error);
      container.innerHTML = '<div class="error-state">Failed to load important dates. Please try again.</div>';
    }
  }

  function renderEventCard(event) {
    const daysUntil = Math.ceil((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24));
    const daysText = daysUntil === 0 ? 'Today!' : daysUntil > 0 ? `${daysUntil} days` : `${Math.abs(daysUntil)} days ago`;
    
    return `
      <div class="date-item">
        <div class="date-icon">${getEventIcon(event.event_type)}</div>
        <div class="date-copy">
          <strong>${escapeHtml(event.title)}</strong>
          <small>${escapeHtml(event.description || '')}</small>
        </div>
        <div class="date-tag">${formatDate(event.event_date)}<br><small>${daysText}</small></div>
        <div class="row-actions">
          <button type="button" onclick="window.editEvent('${event.id}')">Edit</button>
          <button type="button" onclick="window.deleteEvent('${event.id}', '${escapeHtml(event.title)}')">Delete</button>
        </div>
      </div>
    `;
  }

  function getEventIcon(type) {
    const icons = {
      birthday: '🎂',
      anniversary: '💍',
      memorial: '🕯️',
      family_event: '👨‍👩‍👧‍👦',
      other: '📅'
    };
    return icons[type] || '📅';
  }

  function setupEventTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('[data-tab-content]').forEach(content => {
          content.classList.toggle('portal-hidden', content.dataset.tabContent !== tabName);
        });
      });
    });
  }

  function setupEventActions() {
    // Actions are handled by global functions defined below
  }

  window.openAddEventDialog = function() {
    const html = `
      <form class="member-modal-grid">
        <label class="full">
          <span>Title *</span>
          <input type="text" name="title" required>
        </label>
        <label class="full">
          <span>Event Type *</span>
          <select name="event_type" required>
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
            <option value="memorial">Memorial</option>
            <option value="family_event">Family Event</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="full">
          <span>Event Date *</span>
          <input type="date" name="event_date" required>
        </label>
        <label class="full">
          <span>Description</span>
          <textarea name="description" rows="3"></textarea>
        </label>
        <div class="member-modal-actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Add Date</button>
        </div>
      </form>
    `;

    showModal('Add Important Date', html, async (formData) => {
      const eventData = {
        title: formData.get('title'),
        event_type: formData.get('event_type'),
        event_date: formData.get('event_date'),
        description: formData.get('description') || null
      };

      const result = await selfService.createEvent(eventData);
      if (result) {
        await loadEventsPage();
        return true;
      }
      return false;
    });
  };

  window.editEvent = async function(eventId) {
    const { data: event } = await client
      .from('family_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) return;

    const html = `
      <form class="member-modal-grid">
        <label class="full">
          <span>Title *</span>
          <input type="text" name="title" value="${escapeHtml(event.title)}" required>
        </label>
        <label class="full">
          <span>Event Type *</span>
          <select name="event_type" required>
            <option value="birthday" ${event.event_type === 'birthday' ? 'selected' : ''}>Birthday</option>
            <option value="anniversary" ${event.event_type === 'anniversary' ? 'selected' : ''}>Anniversary</option>
            <option value="memorial" ${event.event_type === 'memorial' ? 'selected' : ''}>Memorial</option>
            <option value="family_event" ${event.event_type === 'family_event' ? 'selected' : ''}>Family Event</option>
            <option value="other" ${event.event_type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </label>
        <label class="full">
          <span>Event Date *</span>
          <input type="date" name="event_date" value="${event.event_date}" required>
        </label>
        <label class="full">
          <span>Description</span>
          <textarea name="description" rows="3">${escapeHtml(event.description || '')}</textarea>
        </label>
        <div class="member-modal-actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Save Changes</button>
        </div>
      </form>
    `;

    showModal('Edit Important Date', html, async (formData) => {
      const updates = {
        title: formData.get('title'),
        event_type: formData.get('event_type'),
        event_date: formData.get('event_date'),
        description: formData.get('description') || null
      };

      const success = await selfService.updateEvent(eventId, updates);
      if (success) {
        await loadEventsPage();
        return true;
      }
      return false;
    });
  };

  window.deleteEvent = async function(eventId, eventTitle) {
    if (!confirm(`Delete "${eventTitle}"? This cannot be undone.`)) return;
    
    const success = await selfService.deleteEvent(eventId, eventTitle);
    if (success) {
      await loadEventsPage();
    }
  };

  // ============================================
  // ACHIEVEMENTS PAGE
  // ============================================

  async function loadAchievementsPage() {
    const container = document.getElementById('achievementPanel');
    if (!container) return;

    try {
      // Check if state and member are available
      if (!state.currentMember || !state.currentMember.id) {
        console.error('❌ Achievements: No member ID available');
        console.log('State:', state);
        container.innerHTML = '<div class="error-state">Member information not loaded. Please refresh the page.</div>';
        return;
      }

      console.log('🏆 Loading achievements for member:', state.currentMember.id);

      const { data: achievements, error } = await client
        .from('achievements')
        .select('*')
        .eq('family_member_id', state.currentMember.id)
        .order('achievement_date', { ascending: false });

      if (error) {
        console.error('❌ Achievements Supabase error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log(`✅ Achievements loaded: ${achievements.length} items`);

      const html = `
        <div class="panel-header">
          <h3>Achievements</h3>
          <button type="button" class="button primary" onclick="window.openAddAchievementDialog()">Add Achievement</button>
        </div>

        ${achievements.length === 0
          ? '<div class="empty-state">No achievements yet. Click "Add Achievement" to create one.</div>'
          : `<div class="cards">${achievements.map(renderAchievementCard).join('')}</div>`
        }
      `;

      container.innerHTML = html;
    } catch (error) {
      console.error('❌ Failed to load achievements:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error: error
      });
      container.innerHTML = '<div class="error-state">Failed to load achievements. Check console for details.</div>';
    }
  }

  function renderAchievementCard(achievement) {
    return `
      <div class="card">
        ${achievement.image_path 
          ? `<div class="card-image" style="background: linear-gradient(135deg, rgba(105,165,255,0.1), rgba(124,108,255,0.1)); padding: 20px; text-align: center; font-size: 3rem;">🏆</div>`
          : '<div class="card-image" style="background: linear-gradient(135deg, rgba(105,165,255,0.1), rgba(124,108,255,0.1)); padding: 20px; text-align: center; font-size: 3rem;">🏆</div>'
        }
        <div style="padding: 16px;">
          <h4>${escapeHtml(achievement.title)}</h4>
          <p style="color: var(--muted); font-size: 0.9rem; margin: 8px 0;">${escapeHtml(achievement.description || '')}</p>
          ${achievement.category ? `<span class="date-tag">${escapeHtml(achievement.category)}</span>` : ''}
          <small style="display: block; margin-top: 8px; color: var(--muted);">${formatDate(achievement.achievement_date)}</small>
          <div class="row-actions" style="margin-top: 12px;">
            <button type="button" onclick="window.editAchievement('${achievement.id}')">Edit</button>
            <button type="button" onclick="window.deleteAchievement('${achievement.id}', '${escapeHtml(achievement.title)}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  window.openAddAchievementDialog = function() {
    const html = `
      <form class="member-modal-grid">
        <label class="full">
          <span>Title *</span>
          <input type="text" name="title" required>
        </label>
        <label class="full">
          <span>Category</span>
          <input type="text" name="category" placeholder="e.g., Education, Career, Sports">
        </label>
        <label class="full">
          <span>Achievement Date</span>
          <input type="date" name="achievement_date">
        </label>
        <label class="full">
          <span>Description</span>
          <textarea name="description" rows="3"></textarea>
        </label>
        <label class="full">
          <span>Image</span>
          <input type="file" name="image" accept="image/*">
        </label>
        <label class="full">
          <span>Certificate (PDF/Image)</span>
          <input type="file" name="certificate" accept="image/*,application/pdf">
        </label>
        <div class="member-modal-actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Add Achievement</button>
        </div>
      </form>
    `;

    showModal('Add Achievement', html, async (formData) => {
      const achievementData = {
        title: formData.get('title'),
        category: formData.get('category') || null,
        achievement_date: formData.get('achievement_date') || null,
        description: formData.get('description') || null
      };

      const imageFile = formData.get('image');
      const certFile = formData.get('certificate');

      const result = await selfService.createAchievement(
        achievementData,
        imageFile?.size > 0 ? imageFile : null,
        certFile?.size > 0 ? certFile : null
      );

      if (result) {
        await loadAchievementsPage();
        return true;
      }
      return false;
    });
  };

  window.editAchievement = async function(achievementId) {
    const { data: achievement } = await client
      .from('achievements')
      .select('*')
      .eq('id', achievementId)
      .single();

    if (!achievement) return;

    const html = `
      <form class="member-modal-grid">
        <label class="full">
          <span>Title *</span>
          <input type="text" name="title" value="${escapeHtml(achievement.title)}" required>
        </label>
        <label class="full">
          <span>Category</span>
          <input type="text" name="category" value="${escapeHtml(achievement.category || '')}">
        </label>
        <label class="full">
          <span>Achievement Date</span>
          <input type="date" name="achievement_date" value="${achievement.achievement_date || ''}">
        </label>
        <label class="full">
          <span>Description</span>
          <textarea name="description" rows="3">${escapeHtml(achievement.description || '')}</textarea>
        </label>
        <div class="member-modal-actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Save Changes</button>
        </div>
      </form>
    `;

    showModal('Edit Achievement', html, async (formData) => {
      const updates = {
        title: formData.get('title'),
        category: formData.get('category') || null,
        achievement_date: formData.get('achievement_date') || null,
        description: formData.get('description') || null
      };

      const success = await selfService.updateAchievement(achievementId, updates);
      if (success) {
        await loadAchievementsPage();
        return true;
      }
      return false;
    });
  };

  window.deleteAchievement = async function(achievementId, achievementTitle) {
    if (!confirm(`Delete "${achievementTitle}"? This cannot be undone.`)) return;
    
    const success = await selfService.deleteAchievement(achievementId, achievementTitle);
    if (success) {
      await loadAchievementsPage();
    }
  };

  // ============================================
  // GALLERY PAGE
  // ============================================

  async function loadGalleryPage() {
    const container = document.getElementById('memoriesPanel');
    if (!container) return;

    try {
      // Check if state and member are available
      if (!state.currentMember || !state.currentMember.id) {
        console.error('❌ Gallery: No member ID available');
        console.log('State:', state);
        container.innerHTML = '<div class="error-state">Member information not loaded. Please refresh the page.</div>';
        return;
      }

      console.log('📷 Loading gallery for member:', state.currentMember.id);

      const { data: photos, error } = await client
        .from('family_gallery')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Gallery Supabase error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log(`✅ Gallery loaded: ${photos.length} photos`);

      const html = `
        <div class="panel-header">
          <h3>Gallery</h3>
          <button type="button" class="button primary" onclick="window.openUploadGalleryDialog()">Upload Memory</button>
        </div>

        ${photos.length === 0
          ? '<div class="empty-state">No memories yet. Click "Upload Memory" to add photos.</div>'
          : `<div class="gallery-row">${photos.map(renderGalleryCard).join('')}</div>`
        }
      `;

      container.innerHTML = html;
    } catch (error) {
      console.error('❌ Failed to load gallery:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error: error
      });
      container.innerHTML = '<div class="error-state">Failed to load gallery. Check console for details.</div>';
    }
  }

  function renderGalleryCard(photo) {
    const photoUrl = photo.file_path ? selfService.getPhotoUrl(photo.file_path) : '';
    const categoryIcon = {
      'Family': '👨‍👩‍👧‍👦',
      'Events': '🎉',
      'Memories': '💭',
      'Travel': '✈️',
      'Festivals': '🎊',
      'Other': '📷'
    }[photo.category] || '📷';

    return `
      <div class="memory-card" style="cursor: pointer;" onclick="window.viewGalleryPhoto('${photo.id}')">
        <div style="position: relative; height: 200px; background: var(--bg-secondary); overflow: hidden; border-radius: 12px 12px 0 0;">
          ${photoUrl 
            ? `<img src="${photoUrl}" alt="${escapeHtml(photo.title || 'Photo')}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div style="display: grid; place-items: center; height: 100%; font-size: 3rem;">${categoryIcon}</div>`
          }
          ${photo.category ? `<div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); padding: 4px 12px; border-radius: 20px; font-size: 12px; color: white;">${categoryIcon} ${escapeHtml(photo.category)}</div>` : ''}
        </div>
        <div class="memory-copy" style="padding: 12px;">
          <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${escapeHtml(photo.title || 'Untitled')}</strong>
          ${photo.description ? `<p style="font-size: 12px; color: var(--muted); margin: 4px 0; line-height: 1.4;">${escapeHtml(photo.description.substring(0, 80))}${photo.description.length > 80 ? '...' : ''}</p>` : ''}
          <div style="display: flex; gap: 12px; align-items: center; margin-top: 8px; font-size: 11px; color: var(--muted);">
            ${photo.photo_date ? `<span>📅 ${formatDate(photo.photo_date)}</span>` : ''}
            <span>⏰ ${formatDate(photo.created_at)}</span>
          </div>
          <div class="row-actions" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line);">
            <button type="button" onclick="event.stopPropagation(); window.deleteGalleryPhoto('${photo.id}', '${escapeHtml(photo.title || 'photo')}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  window.openUploadGalleryDialog = function() {
    let selectedFile = null;
    let previewUrl = null;

    const html = `
      <div class="upload-gallery-container">
        <!-- File Selection Screen -->
        <div id="fileSelectionScreen">
          <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📸</div>
            <p style="color: var(--muted); margin-bottom: 24px;">Select a photo to upload</p>
            <input type="file" id="photoFileInput" accept="image/jpeg,image/jpg,image/png,image/webp" style="display: none;">
            <button type="button" class="button primary" onclick="document.getElementById('photoFileInput').click()">
              Select Photo
            </button>
          </div>
        </div>

        <!-- Preview & Details Screen -->
        <div id="previewScreen" style="display: none;">
          <form id="uploadGalleryForm" class="member-modal-grid">
            <!-- Photo Preview -->
            <div class="full" style="margin-bottom: 20px;">
              <div style="position: relative; border-radius: 12px; overflow: hidden; background: var(--bg-secondary); aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center;">
                <img id="photoPreview" src="" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">
              </div>
            </div>

            <!-- Photo Details -->
            <label class="full">
              <span>Photo Title</span>
              <input type="text" name="title" placeholder="e.g., Family Picnic 2026" maxlength="100">
            </label>

            <label class="full">
              <span>Description</span>
              <textarea name="description" rows="3" placeholder="Share the story behind this photo..." maxlength="500"></textarea>
            </label>

            <label class="full">
              <span>Category *</span>
              <select name="category" required>
                <option value="Family">Family</option>
                <option value="Events">Events</option>
                <option value="Memories">Memories</option>
                <option value="Travel">Travel</option>
                <option value="Festivals">Festivals</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label class="full">
              <span>Photo Date</span>
              <input type="date" name="photo_date" value="${new Date().toISOString().split('T')[0]}">
            </label>

            <div class="full" style="padding: 12px; background: rgba(96, 165, 250, 0.1); border-radius: 8px; margin-top: 8px;">
              <div style="font-size: 13px; color: var(--text-secondary);">
                <strong>Uploaded by:</strong> ${state.currentMember?.full_name || 'You'}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="member-modal-actions full" style="margin-top: 20px;">
              <button type="button" class="button" data-cancel>Cancel</button>
              <button type="button" class="button" id="changePhotoBtn">Change Photo</button>
              <button type="submit" class="button primary" id="uploadPhotoBtn">
                <span id="uploadBtnText">Upload Photo</span>
                <span id="uploadBtnSpinner" style="display: none;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 0.8s linear infinite;">
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  Uploading...
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    const modal = showModal('Upload to Gallery', html, null);

    // File input handler
    const fileInput = document.getElementById('photoFileInput');
    const fileSelectionScreen = document.getElementById('fileSelectionScreen');
    const previewScreen = document.getElementById('previewScreen');
    const photoPreview = document.getElementById('photoPreview');
    const uploadForm = document.getElementById('uploadGalleryForm');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    const uploadBtnText = document.getElementById('uploadBtnText');
    const uploadBtnSpinner = document.getElementById('uploadBtnSpinner');

    function validateFile(file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!file) {
        selfService.toast('Please select a file', 'error');
        return false;
      }

      if (!validTypes.includes(file.type)) {
        selfService.toast('Please select a valid image (JPG, PNG, or WEBP)', 'error');
        return false;
      }

      if (file.size > maxSize) {
        selfService.toast('File size must be less than 10MB', 'error');
        return false;
      }

      return true;
    }

    function showPreview(file) {
      if (!validateFile(file)) {
        fileInput.value = '';
        return;
      }

      selectedFile = file;
      
      // Clean up old preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      // Create new preview
      previewUrl = URL.createObjectURL(file);
      photoPreview.src = previewUrl;

      // Show preview screen
      fileSelectionScreen.style.display = 'none';
      previewScreen.style.display = 'block';
    }

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        showPreview(file);
      }
    });

    changePhotoBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!selectedFile) {
        selfService.toast('Please select a photo', 'error');
        return;
      }

      // Disable buttons during upload
      uploadPhotoBtn.disabled = true;
      changePhotoBtn.disabled = true;
      uploadBtnText.style.display = 'none';
      uploadBtnSpinner.style.display = 'inline-flex';
      uploadBtnSpinner.style.alignItems = 'center';
      uploadBtnSpinner.style.gap = '8px';

      const formData = new FormData(uploadForm);
      const title = formData.get('title')?.trim() || '';
      const description = formData.get('description')?.trim() || '';
      const category = formData.get('category');
      const photoDate = formData.get('photo_date');

      try {
        const result = await selfService.uploadGalleryPhoto(
          selectedFile, 
          title, 
          description,
          category,
          photoDate
        );
        
        if (result) {
          // Clean up preview URL
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          
          await loadGalleryPage();
          
          // Close modal
          const cancelBtn = modal.querySelector('[data-cancel]');
          if (cancelBtn) cancelBtn.click();
        } else {
          // Re-enable buttons on failure
          uploadPhotoBtn.disabled = false;
          changePhotoBtn.disabled = false;
          uploadBtnText.style.display = 'inline';
          uploadBtnSpinner.style.display = 'none';
        }
      } catch (error) {
        console.error('Upload error:', error);
        selfService.toast('Failed to upload photo', 'error');
        
        // Re-enable buttons
        uploadPhotoBtn.disabled = false;
        changePhotoBtn.disabled = false;
        uploadBtnText.style.display = 'inline';
        uploadBtnSpinner.style.display = 'none';
      }
    });

    // Clean up on modal close
    const cancelBtn = modal.querySelector('[data-cancel]');
    if (cancelBtn) {
      const originalClick = cancelBtn.onclick;
      cancelBtn.onclick = function() {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        if (originalClick) originalClick.call(this);
      };
    }
  };

  window.deleteGalleryPhoto = async function(photoId, photoTitle) {
    if (!confirm(`Delete "${photoTitle}"? This cannot be undone.`)) return;
    
    const success = await selfService.deleteGalleryPhoto(photoId, photoTitle);
    if (success) {
      await loadGalleryPage();
    }
  };

  window.viewGalleryPhoto = async function(photoId) {
    try {
      const { data: photo, error } = await client
        .from('family_gallery')
        .select('*')
        .eq('id', photoId)
        .single();

      if (error) throw error;

      const photoUrl = photo.file_path ? selfService.getPhotoUrl(photo.file_path) : '';
      const categoryIcon = {
        'Family': '👨‍👩‍👧‍👦',
        'Events': '🎉',
        'Memories': '💭',
        'Travel': '✈️',
        'Festivals': '🎊',
        'Other': '📷'
      }[photo.category] || '📷';

      const html = `
        <div class="photo-viewer">
          <div style="margin-bottom: 20px;">
            <div style="position: relative; border-radius: 12px; overflow: hidden; background: var(--bg-secondary); max-height: 60vh; display: flex; align-items: center; justify-content: center;">
              ${photoUrl 
                ? `<img src="${photoUrl}" alt="${escapeHtml(photo.title || 'Photo')}" style="max-width: 100%; max-height: 60vh; object-fit: contain;">`
                : `<div style="display: grid; place-items: center; height: 300px; font-size: 4rem;">${categoryIcon}</div>`
              }
            </div>
          </div>

          <div style="padding: 20px; background: var(--panel); border-radius: 12px; margin-top: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 20px; color: var(--text);">
              ${escapeHtml(photo.title || 'Untitled Photo')}
            </h3>

            ${photo.description ? `
              <p style="margin: 12px 0; color: var(--text-secondary); line-height: 1.6;">
                ${escapeHtml(photo.description)}
              </p>
            ` : ''}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--line);">
              ${photo.category ? `
                <div>
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Category</div>
                  <div style="font-weight: 600; color: var(--text);">${categoryIcon} ${escapeHtml(photo.category)}</div>
                </div>
              ` : ''}

              ${photo.photo_date ? `
                <div>
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Photo Date</div>
                  <div style="font-weight: 600; color: var(--text);">📅 ${formatDate(photo.photo_date)}</div>
                </div>
              ` : ''}

              <div>
                <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Uploaded</div>
                <div style="font-weight: 600; color: var(--text);">⏰ ${formatDate(photo.created_at)}</div>
              </div>

              <div>
                <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Uploaded By</div>
                <div style="font-weight: 600; color: var(--text);">👤 ${state.currentMember?.full_name || 'You'}</div>
              </div>
            </div>
          </div>

          <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="button" data-cancel>Close</button>
            <button type="button" class="button" onclick="window.deleteGalleryPhoto('${photo.id}', '${escapeHtml(photo.title || 'photo')}'); document.querySelector('[data-cancel]').click();" style="background: #ef4444; color: white; border-color: #ef4444;">
              Delete Photo
            </button>
          </div>
        </div>
      `;

      showModal(photo.title || 'Photo', html, null);
    } catch (error) {
      console.error('Failed to load photo:', error);
      selfService.toast('Failed to load photo', 'error');
    }
  };

  // ============================================
  // DOCUMENTS PAGE
  // ============================================

  async function loadDocumentsPage() {
    const container = document.getElementById('documentsPanel');
    if (!container) return;

    try {
      const { data: documents, error } = await client
        .from('family_documents')
        .select('*')
        .eq('family_member_id', state.currentMember.id)
        .order('created_at', { ascending: false});

      if (error) throw error;

      const html = `
        <div class="panel-header">
          <h3>Documents</h3>
          <button type="button" class="button primary" onclick="window.openUploadDocumentDialog()">Upload Document</button>
        </div>

        ${documents.length === 0
          ? '<div class="empty-state">No documents yet. Click "Upload Document" to add one.</div>'
          : `<div class="date-list">${documents.map(renderDocumentCard).join('')}</div>`
        }
      `;

      container.innerHTML = html;
    } catch (error) {
      console.error('Failed to load documents:', error);
      container.innerHTML = '<div class="error-state">Failed to load documents. Please try again.</div>';
    }
  }

  function renderDocumentCard(doc) {
    return `
      <div class="date-item">
        <div class="date-icon">📄</div>
        <div class="date-copy">
          <strong>${escapeHtml(doc.document_title || 'Untitled')}</strong>
          <small>${escapeHtml(doc.document_type || '')} • ${formatDate(doc.created_at)}</small>
        </div>
        <div class="row-actions">
          <button type="button" onclick="window.viewDocument('${doc.id}')">View</button>
          <button type="button" onclick="window.deleteDocument('${doc.id}', '${escapeHtml(doc.document_title || 'document')}')">Delete</button>
        </div>
      </div>
    `;
  }

  window.openUploadDocumentDialog = function() {
    const html = `
      <form class="member-modal-grid">
        <label class="full">
          <span>Document File *</span>
          <input type="file" name="file" required>
        </label>
        <label class="full">
          <span>Document Title *</span>
          <input type="text" name="document_title" required>
        </label>
        <label class="full">
          <span>Document Type *</span>
          <select name="document_type" required>
            <option value="Citizenship">Citizenship</option>
            <option value="Passport">Passport</option>
            <option value="Birth Certificate">Birth Certificate</option>
            <option value="Marriage Certificate">Marriage Certificate</option>
            <option value="Education Certificate">Education Certificate</option>
            <option value="Medical Record">Medical Record</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label class="full">
          <span>Document Number</span>
          <input type="text" name="document_number">
        </label>
        <label>
          <span>Issue Date</span>
          <input type="date" name="issue_date">
        </label>
        <label>
          <span>Expiry Date</span>
          <input type="date" name="expiry_date">
        </label>
        <label class="full">
          <span>Notes</span>
          <textarea name="notes" rows="2"></textarea>
        </label>
        <div class="member-modal-actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Upload</button>
        </div>
      </form>
    `;

    showModal('Upload Document', html, async (formData) => {
      const file = formData.get('file');
      if (!file || file.size === 0) {
        selfService.toast('Please select a file', 'error');
        return false;
      }

      const documentData = {
        document_title: formData.get('document_title'),
        document_type: formData.get('document_type'),
        document_number: formData.get('document_number') || null,
        issue_date: formData.get('issue_date') || null,
        expiry_date: formData.get('expiry_date') || null,
        notes: formData.get('notes') || null
      };

      const result = await selfService.uploadDocument(file, documentData);
      if (result) {
        await loadDocumentsPage();
        return true;
      }
      return false;
    });
  };

  window.viewDocument = async function(docId) {
    const { data: doc } = await client
      .from('family_documents')
      .select('file_path')
      .eq('id', docId)
      .single();

    if (doc?.file_path) {
      const { data: signed } = await client.storage
        .from('family-vault')
        .createSignedUrl(doc.file_path, 3600);

      if (signed?.signedUrl) {
        window.open(signed.signedUrl, '_blank');
      }
    }
  };

  window.deleteDocument = async function(docId, docTitle) {
    if (!confirm(`Delete "${docTitle}"? This cannot be undone.`)) return;
    
    const success = await selfService.deleteDocument(docId, docTitle);
    if (success) {
      await loadDocumentsPage();
    }
  };

  // ============================================
  // MY ACTIVITY PAGE
  // ============================================

  async function loadActivityPage() {
    const container = document.getElementById('timelinePanel');
    if (!container) return;

    try {
      // Check if user ID is available
      if (!state.currentUserId) {
        console.error('❌ Activity: No user ID available');
        console.log('State:', state);
        container.innerHTML = '<div class="error-state">User information not loaded. Please refresh the page.</div>';
        return;
      }

      console.log('📋 Loading activity for user:', state.currentUserId);

      const { data: activities, error } = await client
        .from('member_activity_log')
        .select('*')
        .eq('actor_user_id', state.currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Activity Supabase error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log(`✅ Activity loaded: ${activities.length} entries`);

      const html = `
        <div class="panel-header">
          <h3>My Activity</h3>
        </div>

        ${activities.length === 0
          ? '<div class="empty-state">No activity yet.</div>'
          : `<div class="timeline-list">${activities.map(renderActivityItem).join('')}</div>`
        }
      `;

      container.innerHTML = html;
    } catch (error) {
      console.error('❌ Failed to load activity:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error: error
      });
      container.innerHTML = '<div class="error-state">Failed to load activity. Check console for details.</div>';
    }
  }

  function renderActivityItem(activity) {
    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="date-copy">
          <strong>${getActivityLabel(activity.action_type)}</strong>
          <small>${escapeHtml(activity.action_description || '')}</small>
          <small style="display: block; margin-top: 4px; opacity: 0.7;">${formatDate(activity.created_at)}</small>
        </div>
      </div>
    `;
  }

  function getActivityLabel(actionType) {
    const labels = {
      profile_updated: 'Profile Updated',
      profile_photo_changed: 'Profile Photo Changed',
      profile_photo_removed: 'Profile Photo Removed',
      event_created: 'Important Date Added',
      event_updated: 'Important Date Updated',
      event_deleted: 'Important Date Deleted',
      achievement_created: 'Achievement Added',
      achievement_updated: 'Achievement Updated',
      achievement_deleted: 'Achievement Deleted',
      gallery_uploaded: 'Gallery Photo Uploaded',
      gallery_deleted: 'Gallery Photo Deleted',
      document_uploaded: 'Document Uploaded',
      document_deleted: 'Document Deleted',
      notification_read: 'Notification Read',
      password_changed: 'Password Changed',
      settings_changed: 'Settings Updated'
    };
    return labels[actionType] || actionType;
  }

  // ============================================
  // PAGE NAVIGATION INTEGRATION
  // ============================================

  function enhancePageNavigation() {
    const originalHandler = window.handleSidebarNavigation;
    
    document.querySelectorAll('[data-nav]').forEach(button => {
      button.addEventListener('click', async () => {
        const page = button.getAttribute('data-nav');
        
        // Load page-specific content
        switch (page) {
          case 'dates':
            await loadEventsPage();
            break;
          case 'achievements':
            await loadAchievementsPage();
            break;
          case 'gallery':
            await loadGalleryPage();
            break;
          case 'documents':
            await loadDocumentsPage();
            break;
          case 'activity':
            await loadActivityPage();
            break;
        }
      });
    });
  }

  // ============================================
  // INITIALIZE
  // ============================================

  console.log('✅ Family Member Portal Integration Loaded');
  
  // Setup quick actions
  setupQuickActions();
  
  // Enhance navigation
  enhancePageNavigation();
  
  // Load initial page content
  await loadEventsPage();
  await loadAchievementsPage();
  await loadGalleryPage();
  await loadDocumentsPage();
  await loadActivityPage();

  console.log('✅ All pages initialized with self-service integration');

})();
