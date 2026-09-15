/**
 * Family Member Profile Editor
 * Handles profile viewing and editing with activity logging
 */

(function (global) {
  'use strict';

  const client = window.supabaseClient;

  /**
   * Load and render profile editing page
   */
  async function loadProfileEditor(container, member) {
    if (!container || !member) return;

    container.innerHTML = `
      <style>
        /* Profile-specific responsive styles */
        .profile-container {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 0;
        }

        .profile-hero {
          margin-bottom: clamp(20px, 4vw, 32px);
        }

        .profile-hero h1 {
          font-size: clamp(24px, 5vw, 32px);
          font-weight: 700;
          margin-bottom: 12px;
          background: var(--gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          overflow-wrap: break-word;
        }

        .profile-hero p {
          color: var(--muted);
          font-size: clamp(14px, 2.5vw, 16px);
          line-height: 1.5;
        }

        .profile-photo-section {
          display: flex;
          align-items: flex-start;
          gap: clamp(16px, 3vw, 24px);
          flex-wrap: wrap;
        }

        .profile-photo-preview {
          width: clamp(100px, 20vw, 120px);
          height: clamp(100px, 20vw, 120px);
          min-width: 100px;
          min-height: 100px;
          border-radius: 16px;
          overflow: hidden;
          background: var(--gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: clamp(32px, 8vw, 48px);
          font-weight: 700;
          flex-shrink: 0;
        }

        .profile-photo-controls {
          flex: 1;
          min-width: min(100%, 200px);
        }

        .profile-button-group {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .profile-button-group .button {
          min-width: 0;
          white-space: nowrap;
        }

        .profile-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          gap: clamp(16px, 3vw, 20px);
          margin-bottom: 24px;
        }

        .profile-form-group {
          min-width: 0;
        }

        .profile-form-group.full-width {
          grid-column: 1 / -1;
        }

        .profile-form-input {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1px solid rgba(215, 235, 228, 0.16);
          border-radius: 10px;
          background: rgba(8, 24, 26, 0.58);
          color: var(--text);
          font: inherit;
          color-scheme: dark;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .profile-form-input:focus,
        .profile-form-textarea:focus {
          border-color: var(--blue);
          background: rgba(8, 24, 26, 0.78);
          box-shadow: 0 0 0 3px rgba(99, 197, 184, 0.14);
        }

        .profile-form-input::placeholder,
        .profile-form-textarea::placeholder {
          color: var(--muted);
          opacity: 0.9;
        }

        :root[data-theme="light"] .profile-form-input,
        :root[data-theme="light"] .profile-form-textarea {
          border-color: rgba(20, 45, 47, 0.16);
          background: rgba(255, 255, 255, 0.82);
          color: var(--text);
          color-scheme: light;
        }

        :root[data-theme="light"] .profile-form-input:focus,
        :root[data-theme="light"] .profile-form-textarea:focus {
          background: #fff;
        }

        .profile-form-textarea {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          resize: vertical;
          min-height: 100px;
          padding: 12px 14px;
          border: 1px solid rgba(215, 235, 228, 0.16);
          border-radius: 10px;
          background: rgba(8, 24, 26, 0.58);
          color: var(--text);
          font: inherit;
          color-scheme: dark;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .profile-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--line);
          flex-wrap: wrap;
        }

        .profile-account-grid {
          display: grid;
          gap: 16px;
        }

        .profile-account-item {
          min-width: 0;
        }

        .profile-account-label {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 4px;
        }

        .profile-account-value {
          font-weight: 500;
          color: var(--text);
          word-wrap: break-word;
          overflow-wrap: anywhere;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .profile-photo-section {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .profile-photo-controls {
            width: 100%;
            text-align: center;
          }

          .profile-button-group {
            justify-content: center;
          }

          .profile-button-group .button {
            flex: 1;
            min-width: 120px;
          }

          .profile-form-grid {
            grid-template-columns: 1fr;
          }

          .profile-form-actions {
            flex-direction: column-reverse;
          }

          .profile-form-actions .button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .profile-form-grid {
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          }
        }
      </style>

      <div class="profile-container">
        <div class="profile-hero">
          <h1>My Profile</h1>
          <p>Update your personal information and profile settings</p>
        </div>

        <!-- Profile Photo Section -->
        <div class="section-card" style="margin-bottom: 24px;">
          <div class="section-header">
            <h2 class="section-title">Profile Photo</h2>
          </div>
          <div class="profile-photo-section">
            <div id="profilePhotoPreview" class="profile-photo-preview">
              ${getInitials(member.full_name)}
            </div>
            <div class="profile-photo-controls">
              <input type="file" id="profilePhotoInput" accept="image/*" style="display: none;">
              <div class="profile-button-group">
                <button class="button button-primary" id="uploadPhotoButton">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Upload Photo
                </button>
                <button class="button" id="deletePhotoButton" ${!member.profile_photo ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete Photo
                </button>
              </div>
              <p style="font-size: 13px; color: var(--muted); margin-top: 8px;">
                JPG, PNG or GIF. Max size 5MB.
              </p>
            </div>
          </div>
        </div>

        <!-- Profile Form -->
        <form id="profileForm" class="section-card" style="margin-bottom: 24px;">
          <div class="section-header">
            <h2 class="section-title">Personal Information</h2>
          </div>
          
          <div class="profile-form-grid">
            <div class="profile-form-group">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Full Name *
              </label>
              <input 
                type="text" 
                name="full_name" 
                class="form-input profile-form-input" 
                value="${escapeHtml(member.full_name || '')}"
                required
                readonly
                style="background: rgba(148, 163, 184, 0.05); cursor: not-allowed; opacity: 0.7;"
                title="Contact admin to change your name"
              >
              <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                Contact admin to change
              </p>
            </div>

            <div class="profile-form-group">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Email *
              </label>
              <input 
                type="email" 
                name="email" 
                class="form-input profile-form-input" 
                value="${escapeHtml(member.email || '')}"
                required
                readonly
                style="background: rgba(148, 163, 184, 0.05); cursor: not-allowed; opacity: 0.7;"
                title="Contact admin to change your email"
              >
              <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                Contact admin to change
              </p>
            </div>

            <div class="profile-form-group">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Nickname
              </label>
              <input 
                type="text" 
                name="nickname" 
                class="form-input profile-form-input" 
                value="${escapeHtml(member.nickname || '')}"
                placeholder="Your preferred name"
              >
            </div>

            <div class="profile-form-group">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Phone
              </label>
              <input 
                type="tel" 
                name="phone" 
                class="form-input profile-form-input" 
                value="${escapeHtml(member.phone || '')}"
                placeholder="+1 (555) 123-4567"
              >
            </div>

            <div class="profile-form-group">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Date of Birth
              </label>
              <input 
                type="date" 
                name="date_of_birth" 
                class="form-input profile-form-input" 
                value="${member.date_of_birth || ''}"
              >
            </div>

            <div class="profile-form-group">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Occupation
              </label>
              <input 
                type="text" 
                name="occupation" 
                class="form-input profile-form-input" 
                value="${escapeHtml(member.occupation || '')}"
                placeholder="Your occupation"
              >
            </div>

            <div class="profile-form-group full-width">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Address
              </label>
              <input 
                type="text" 
                name="address" 
                class="form-input profile-form-input" 
                value="${escapeHtml(member.address || '')}"
                placeholder="Your address"
              >
            </div>

            <div class="profile-form-group full-width">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                About / Biography
              </label>
              <textarea 
                name="biography" 
                class="form-input profile-form-textarea" 
                rows="4"
                placeholder="Tell us about yourself..."
              >${escapeHtml(member.biography || '')}</textarea>
            </div>

            <div class="profile-form-group full-width">
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                Hobbies & Interests
              </label>
              <input 
                type="text" 
                name="hobbies" 
                class="form-input profile-form-input" 
                value="${escapeHtml(member.hobbies || '')}"
                placeholder="Reading, Photography, Cooking..."
              >
            </div>
          </div>

          <div class="profile-form-actions">
            <button type="button" class="button" id="cancelProfileButton">
              Cancel
            </button>
            <button type="submit" class="button button-primary" id="saveProfileButton">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Save Changes
            </button>
          </div>
        </form>

        <!-- Status Message -->
        <div id="profileStatusMessage" class="status-message" style="display: none; padding: 16px; border-radius: 12px; margin-bottom: 24px;"></div>

        <!-- Read-only Information -->
        <div class="section-card">
          <div class="section-header">
            <h2 class="section-title">Account Information</h2>
          </div>
          <div class="profile-account-grid">
            <div class="profile-account-item">
              <div class="profile-account-label">Relationship</div>
              <div class="profile-account-value">${escapeHtml(member.relationship || 'Not specified')}</div>
            </div>
            <div class="profile-account-item">
              <div class="profile-account-label">Member Since</div>
              <div class="profile-account-value">${member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Not available'}</div>
            </div>
            <div class="profile-account-item">
              <div class="profile-account-label">Last Login</div>
              <div class="profile-account-value">${member.last_login ? new Date(member.last_login).toLocaleString() : 'Never'}</div>
            </div>
            <div class="profile-account-item">
              <div class="profile-account-label">Account Status</div>
              <div class="profile-account-value" style="color: ${member.account_status === 'active' ? 'var(--green)' : 'var(--orange)'};">
                ${escapeHtml(member.account_status || 'active').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load current profile photo using shared utility
    const preview = document.getElementById('profilePhotoPreview');
    if (preview && window.FamilyProfile) {
      console.log('[ProfileEditor] Initial load - painting avatar for member:', member.id);
      console.log('[ProfileEditor] Member photo data:', {
        profile_photo: member.profile_photo,
        profile_photo_path: member.profile_photo_path,
        profile_image_url: member.profile_image_url
      });
      await window.FamilyProfile.paintAvatar(preview, member, 'large');
    } else if (member.profile_photo || member.profile_photo_path || member.profile_image_url) {
      // Fallback if utility not available
      const photoPath = member.profile_photo_path || member.profile_image_url || member.profile_photo;
      console.log('[ProfileEditor] Using fallback photo load with path:', photoPath);
      loadProfilePhoto(photoPath);
    } else {
      console.log('[ProfileEditor] No profile photo found for member');
    }

    // Setup event listeners
    setupProfileEventListeners(member);
  }

  function setupProfileEventListeners(member) {
    // Photo upload
    const uploadButton = document.getElementById('uploadPhotoButton');
    const photoInput = document.getElementById('profilePhotoInput');
    const deleteButton = document.getElementById('deletePhotoButton');

    if (uploadButton && photoInput) {
      uploadButton.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', () => handlePhotoUpload(member));
    }

    if (deleteButton) {
      deleteButton.addEventListener('click', () => handlePhotoDelete(member));
    }

    // Form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => handleProfileSubmit(e, member));
    }

    // Cancel button
    const cancelButton = document.getElementById('cancelProfileButton');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        if (confirm('Discard changes?')) {
          location.reload();
        }
      });
    }
  }

  function loadProfilePhoto(photoPath) {
    const preview = document.getElementById('profilePhotoPreview');
    if (!preview) return;

    console.log('[ProfileEditor] loadProfilePhoto called with path:', photoPath);

    // Use shared utility if available
    if (window.FamilyProfile && photoPath) {
      // Create a temporary member object with the photo path
      const tempMember = { 
        profile_photo_path: photoPath, 
        profile_image_url: photoPath,
        full_name: preview.textContent || 'User'
      };
      window.FamilyProfile.paintAvatar(preview, tempMember, 'large');
      console.log('[ProfileEditor] Using shared utility paintAvatar');
    } else if (photoPath) {
      // Fallback to old method
      const photoUrl = getPhotoUrl(photoPath);
      console.log('[ProfileEditor] Using fallback with URL:', photoUrl);
      preview.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;" onerror="console.error('[ProfileEditor] Image failed to load:', this.src)">`;
    } else {
      console.log('[ProfileEditor] No photo path provided, showing initials');
    }
  }

  async function handlePhotoUpload(member) {
    const input = document.getElementById('profilePhotoInput');
    const file = input.files[0];
    
    if (!file) return;

    console.log('[ProfileEditor] Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Use shared utility for validation
    if (!window.FamilyProfile) {
      showStatus('Profile utilities not loaded. Please refresh the page.', 'error');
      console.error('[ProfileEditor] window.FamilyProfile not available');
      return;
    }

    const validation = window.FamilyProfile.validateImageFile(file);
    if (!validation.ok) {
      showStatus(validation.message, 'error');
      console.warn('[ProfileEditor] Validation failed:', validation.message);
      return;
    }

    try {
      showStatus('Uploading photo...', 'info');
      console.log('[ProfileEditor] Starting upload for member:', member.id);

      // Use shared utility to upload
      const result = await window.FamilyProfile.uploadProfileImage(file, (progress) => {
        console.log('[ProfileEditor] Upload progress:', progress + '%');
      });

      if (result.error) {
        throw result.error;
      }

      console.log('[ProfileEditor] Upload successful. Result:', result);

      // Log activity
      if (window.FamilyActivityLogger) {
        const action = member.profile_photo || member.profile_photo_path || member.profile_image_url ? 'changed' : 'uploaded';
        await window.FamilyActivityLogger.logProfilePhotoChange(client, member.id, action);
      }

      // Update member object with new data from upload result
      if (result.member) {
        Object.assign(member, result.member);
        console.log('[ProfileEditor] Member updated with:', {
          profile_photo_path: member.profile_photo_path,
          profile_image_url: member.profile_image_url
        });
      } else if (result.path) {
        member.profile_photo_path = result.path;
        member.profile_image_url = result.path;
        console.log('[ProfileEditor] Member updated with path:', result.path);
      }

      // Update UI immediately using shared utility
      const preview = document.getElementById('profilePhotoPreview');
      if (preview && window.FamilyProfile) {
        console.log('[ProfileEditor] Refreshing avatar preview');
        await window.FamilyProfile.paintAvatar(preview, member, 'large');
      }

      // Enable delete button
      const deleteButton = document.getElementById('deletePhotoButton');
      if (deleteButton) {
        deleteButton.disabled = false;
        deleteButton.style.opacity = '1';
        deleteButton.style.cursor = 'pointer';
      }

      showStatus('Profile photo updated successfully!', 'success');
      
      // Reload page after delay to update all instances
      setTimeout(() => {
        console.log('[ProfileEditor] Reloading page to refresh all avatars');
        location.reload();
      }, 1500);

    } catch (error) {
      console.error('[ProfileEditor] Photo upload failed:', error);
      showStatus(error.message || 'Failed to upload photo', 'error');
    }
  }

  async function handlePhotoDelete(member) {
    const hasPhoto = member.profile_photo || member.profile_photo_path || member.profile_image_url;
    if (!hasPhoto) return;

    if (!confirm('Are you sure you want to delete your profile photo?')) {
      return;
    }

    try {
      showStatus('Deleting photo...', 'info');
      console.log('[ProfileEditor] Deleting photo for member:', member.id);

      // Use shared utility if available
      if (window.FamilyProfile && window.FamilyProfile.removeProfileImage) {
        const result = await window.FamilyProfile.removeProfileImage();
        if (result.error) throw result.error;
        console.log('[ProfileEditor] Photo deleted successfully via shared utility');
      } else {
        // Fallback to direct deletion
        console.warn('[ProfileEditor] FamilyProfile utility not available, using fallback');
        const photoPath = member.profile_photo_path || member.profile_photo;
        
        if (photoPath) {
          // Try profile-images bucket first, then family-photos
          const buckets = ['profile-images', 'family-photos'];
          for (const bucket of buckets) {
            try {
              await client.storage.from(bucket).remove([photoPath]);
              console.log('[ProfileEditor] Deleted from bucket:', bucket);
            } catch (err) {
              console.log('[ProfileEditor] Could not delete from bucket:', bucket, err.message);
            }
          }
        }

        // Update member record - clear all photo columns
        const { error: updateError } = await client
          .from('family_members')
          .update({ 
            profile_photo: null,
            profile_photo_path: null,
            profile_image_url: null
          })
          .eq('id', member.id);

        if (updateError) throw updateError;
      }

      // Log activity
      if (window.FamilyActivityLogger) {
        await window.FamilyActivityLogger.logProfilePhotoChange(client, member.id, 'deleted');
      }

      showStatus('Profile photo deleted successfully!', 'success');
      console.log('[ProfileEditor] Photo deletion complete, reloading page');
      
      // Reload page
      setTimeout(() => location.reload(), 1500);

    } catch (error) {
      console.error('[ProfileEditor] Photo delete failed:', error);
      showStatus(error.message || 'Failed to delete photo', 'error');
    }
  }

  async function handleProfileSubmit(e, member) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const saveButton = document.getElementById('saveProfileButton');

    // Disable button
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
    }

    try {
      // Build update payload (only editable fields)
      const updates = {
        nickname: formData.get('nickname')?.trim() || null,
        phone: formData.get('phone')?.trim() || null,
        date_of_birth: formData.get('date_of_birth') || null,
        occupation: formData.get('occupation')?.trim() || null,
        address: formData.get('address')?.trim() || null,
        biography: formData.get('biography')?.trim() || null,
        hobbies: formData.get('hobbies')?.trim() || null,
      };

      // Track changes
      const changes = [];
      for (const [key, value] of Object.entries(updates)) {
        if (value !== member[key]) {
          changes.push(key);
        }
      }

      if (changes.length === 0) {
        showStatus('No changes to save', 'info');
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save Changes
          `;
        }
        return;
      }

      // Update database
      const { error } = await client
        .from('family_members')
        .update(updates)
        .eq('id', member.id);

      if (error) throw error;

      // Log activity
      await window.FamilyActivityLogger.logProfileUpdate(client, member.id, changes);

      showStatus('Profile updated successfully!', 'success');

      // Update member object
      Object.assign(member, updates);

      // Reload after delay
      setTimeout(() => location.reload(), 1500);

    } catch (error) {
      console.error('Profile update failed:', error);
      showStatus(error.message || 'Failed to update profile', 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Changes
        `;
      }
    }
  }

  function showStatus(message, type) {
    const statusEl = document.getElementById('profileStatusMessage');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = 'status-message ' + type;
    statusEl.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  }

  function getPhotoUrl(filePath) {
    if (!filePath) return '';
    const trimmed = String(filePath).trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }

    const normalized = trimmed.replace(/^\/+/, '');
    const bucketCandidates = ['profile-images', 'family-photos', 'family-vault', 'family-private'];

    if (client && client.storage) {
      for (const bucket of bucketCandidates) {
        try {
          const { data } = client.storage.from(bucket).getPublicUrl(normalized);
          if (data && data.publicUrl) return data.publicUrl;
        } catch (error) {
          console.warn('[ProfileEditor] Public URL lookup failed for bucket', bucket, error);
        }
      }
    }

    if (client && client.supabaseUrl) {
      return `${client.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucketCandidates[0]}/${encodeURIComponent(normalized)}`;
    }

    return normalized;
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Export
  global.FamilyProfileEditor = {
    loadProfileEditor,
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
