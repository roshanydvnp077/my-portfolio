/**
 * Family Portal Features - Complete Implementation
 * Implements: Gallery, Documents, Notifications, Dates, Achievements, Family Tree
 */

(function () {
  'use strict';

  const client = window.supabaseClient;

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getPhotoUrl(filePath, bucket = 'family-photos') {
    if (!filePath) return getPlaceholderImage();
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    const { data } = client.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl || filePath;
  }

  function getPlaceholderImage() {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="18"%3ENo Image%3C/text%3E%3C/svg%3E';
  }

  async function resolveGalleryPhotoUrl(filePath, memberId) {
    if (!filePath || typeof filePath !== 'string') return '';
    const trimmed = filePath.trim();
    if (/^(https?:\/\/|data:)/i.test(trimmed)) return trimmed;

    const normalized = trimmed.replace(/^\/+/, '');
    const fileName = normalized.split('/').pop();
    const buckets = ['family-vault', 'family-photos', 'family-private', 'profile-images'];
    const directories = [
      normalized.split('/').slice(0, -1).join('/'),
      memberId ? `${memberId}/gallery` : '',
      memberId ? `gallery/${memberId}` : '',
      ''
    ].filter((value, index, list) => list.indexOf(value) === index);

    for (const bucket of buckets) {
      for (const directory of directories) {
        try {
          const listing = await client.storage.from(bucket).list(directory, {
            limit: 100,
            search: fileName
          });
          if (listing.error) continue;
          const match = (listing.data || []).find(item => item.name === fileName);
          if (!match) continue;
          const actualPath = directory ? `${directory}/${match.name}` : match.name;
          const signed = await client.storage.from(bucket).createSignedUrl(actualPath, 3600);
          if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
        } catch (error) {
          console.warn('[Gallery] Could not resolve image:', bucket, directory, error);
        }
      }
    }
    return '';
  }

  async function resolveAchievementPhotoUrl(filePath, memberId) {
    if (!filePath || typeof filePath !== 'string') return '';
    const trimmed = filePath.trim();
    if (/^(https?:\/\/|data:)/i.test(trimmed)) return trimmed;

    const normalized = trimmed.replace(/^\/+/, '');
    const fileName = normalized.split('/').pop();
    const directories = [
      normalized.split('/').slice(0, -1).join('/'),
      memberId ? `achievements/${memberId}` : '',
      ''
    ].filter((value, index, list) => list.indexOf(value) === index);

    for (const directory of directories) {
      try {
        const listing = await client.storage.from('family-vault').list(directory, {
          limit: 100,
          search: fileName
        });
        if (listing.error) continue;
        const match = (listing.data || []).find(item => item.name === fileName);
        if (!match) continue;
        const actualPath = directory ? `${directory}/${match.name}` : match.name;
        const signed = await client.storage.from('family-vault').createSignedUrl(actualPath, 3600);
        if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
      } catch (error) {
        console.warn('[Achievements] Could not resolve image:', directory, error);
      }
    }
    return '';
  }

  function formatDate(dateString) {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 400px;
      font-size: 14px;
      font-weight: 500;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function showLoading(container) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px;">
        <div class="spinner" style="width: 48px; height: 48px; border: 4px solid rgba(96, 165, 250, 0.2); border-top-color: #60a5fa; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <div style="margin-top: 16px; color: var(--muted); font-size: 14px;">Loading...</div>
      </div>
    `;
  }

  function showError(container, message, onRetry) {
    container.innerHTML = `
      <div class="error-state" style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h3 style="color: var(--text); margin-bottom: 8px; font-size: 18px;">Something went wrong</h3>
        <p style="color: var(--muted); margin-bottom: 24px; font-size: 14px;">${escapeHtml(message)}</p>
        ${onRetry ? '<button class="btn-primary" id="retryButton">Try Again</button>' : ''}
      </div>
    `;
    if (onRetry) {
      const retryBtn = container.querySelector('#retryButton');
      if (retryBtn) retryBtn.addEventListener('click', onRetry);
    }
  }

  function showEmpty(container, icon, message) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.5;">${icon}</div>
        <h3 style="color: var(--text); margin-bottom: 8px; font-size: 18px;">Nothing here yet</h3>
        <p style="color: var(--muted); font-size: 14px;">${escapeHtml(message)}</p>
      </div>
    `;
  }

  // ============================================
  // 1. GALLERY IMPLEMENTATION
  // ============================================

  window.FamilyPortalGallery = {
    currentLightboxIndex: 0,
    galleryImages: [],
    selectedFile: null,
    currentMember: null,
    currentContainer: null,

    async loadGallery(container, member) {
      if (!container || !member) return;

      showLoading(container);

      try {
        const { data, error } = await client
          .from('family_gallery')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Store images even if empty
        this.galleryImages = data || [];
        
        if (!data || data.length === 0) {
          // Show empty state WITH upload button
          this.renderEmptyGallery(container, member);
          return;
        }

        await this.renderGallery(container, data, member);

      } catch (error) {
        console.error('Failed to load gallery:', error);
        showError(container, 'Unable to load gallery. Please try again.', () => this.loadGallery(container, member));
      }
    },

    renderEmptyGallery(container, member) {
      container.innerHTML = `
        <div class="gallery-header" style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 8px;">Family Gallery</h1>
            <p style="color: var(--muted); font-size: 16px;">Shared memories and moments</p>
          </div>
          <button id="uploadPhotoBtn" class="button button-primary" style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Photo
          </button>
        </div>
        
        <input type="file" id="photoFileInput" accept="image/jpeg,image/jpg,image/png,image/webp" style="display: none;">
        
        <div id="uploadProgress" style="display: none; margin-bottom: 20px; padding: 16px; background: var(--panel); border-radius: 12px; border: 1px solid var(--line);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 500; color: var(--text); margin-bottom: 4px;">Uploading...</div>
              <div style="height: 6px; background: var(--line); border-radius: 3px; overflow: hidden;">
                <div id="progressBar" style="height: 100%; background: var(--gradient); width: 0%; transition: width 0.3s;"></div>
              </div>
            </div>
            <div id="progressText" style="font-size: 14px; color: var(--muted); min-width: 50px; text-align: right;">0%</div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-gallery-state" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
          background: var(--panel);
          border-radius: 20px;
          border: 2px dashed var(--line);
        ">
          <div style="font-size: 80px; margin-bottom: 24px; opacity: 0.5;">📸</div>
          <h2 style="font-size: 24px; font-weight: 600; color: var(--text); margin-bottom: 12px;">
            No Photos Yet
          </h2>
          <p style="color: var(--muted); font-size: 16px; margin-bottom: 32px; max-width: 400px;">
            Start building your family gallery by uploading your first photo. Share special moments and memories with your family.
          </p>
          <button id="emptyUploadBtn" class="button button-primary" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 32px;
            font-size: 16px;
            box-shadow: 0 8px 24px var(--glow);
          ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Your First Photo
          </button>
        </div>

        <div id="lightbox" class="lightbox" style="display: none;"></div>
      `;

      // Setup upload buttons (both header and empty state)
      const uploadBtn = container.querySelector('#uploadPhotoBtn');
      const emptyUploadBtn = container.querySelector('#emptyUploadBtn');
      const fileInput = container.querySelector('#photoFileInput');
      
      // Store member and container for later use
      this.currentMember = member;
      this.currentContainer = container;
      
      const openFilePicker = () => fileInput.click();
      
      uploadBtn.addEventListener('click', openFilePicker);
      emptyUploadBtn.addEventListener('click', openFilePicker);
      fileInput.addEventListener('change', (e) => this.handleFileSelection(e, fileInput, member, container));
    },

    async renderGallery(container, images, member) {
      container.innerHTML = `
        <div class="gallery-header" style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 8px;">Family Gallery</h1>
            <p style="color: var(--muted); font-size: 16px;">Shared memories and moments</p>
          </div>
          <button id="uploadPhotoBtn" class="button button-primary" style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Photo
          </button>
        </div>
        
        <input type="file" id="photoFileInput" accept="image/jpeg,image/jpg,image/png,image/webp" style="display: none;">
        
        <div id="uploadProgress" style="display: none; margin-bottom: 20px; padding: 16px; background: var(--panel); border-radius: 12px; border: 1px solid var(--line);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 500; color: var(--text); margin-bottom: 4px;">Uploading...</div>
              <div style="height: 6px; background: var(--line); border-radius: 3px; overflow: hidden;">
                <div id="progressBar" style="height: 100%; background: var(--gradient); width: 0%; transition: width 0.3s;"></div>
              </div>
            </div>
            <div id="progressText" style="font-size: 14px; color: var(--muted); min-width: 50px; text-align: right;">0%</div>
          </div>
        </div>

        <div class="gallery-grid" id="galleryGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;"></div>
        <div id="lightbox" class="lightbox" style="display: none;"></div>
      `;

      // Setup upload button
      const uploadBtn = container.querySelector('#uploadPhotoBtn');
      const fileInput = container.querySelector('#photoFileInput');
      
      // Store member and container for later use
      this.currentMember = member;
      this.currentContainer = container;
      
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileSelection(e, fileInput, member, container));

      const grid = container.querySelector('#galleryGrid');
      const photoUrls = new Map(await Promise.all(images.map(async image => [
        image.id,
        await resolveGalleryPhotoUrl(image.file_path, member.id)
      ])));
      
      images.forEach((image, index) => {
        const photoUrl = photoUrls.get(image.id) || getPlaceholderImage();
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.style.cssText = `
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          background: var(--card);
          border: 1px solid var(--line);
        `;
        card.innerHTML = `
          <div style="aspect-ratio: 1; overflow: hidden;">
            <img src="${escapeHtml(photoUrl)}" 
                 alt="${escapeHtml(image.title || 'Photo')}" 
                 style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;"
                 loading="lazy">
          </div>
          <div style="padding: 16px;">
            <h3 style="font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(image.title || 'Untitled')}
            </h3>
            ${image.description ? `<p style="font-size: 13px; color: var(--muted); margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(image.description)}</p>` : ''}
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted);">
              <span>📅 ${formatDate(image.created_at)}</span>
              ${image.category ? `<span>•</span><span>🏷️ ${escapeHtml(image.category)}</span>` : ''}
            </div>
          </div>
        `;
        
        card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-4px)';
          card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          const img = card.querySelector('img');
          if (img) img.style.transform = 'scale(1.05)';
        });
        
        card.addEventListener('mouseleave', () => {
          card.style.transform = 'translateY(0)';
          card.style.boxShadow = 'none';
          const img = card.querySelector('img');
          if (img) img.style.transform = 'scale(1)';
        });
        
        card.addEventListener('click', () => this.openLightbox(index));
        
        grid.appendChild(card);
      });
    },

    async openLightbox(index) {
      this.currentLightboxIndex = index;
      const lightbox = document.getElementById('lightbox');
      if (!lightbox) return;

      const image = this.galleryImages[index];
      const photoUrl = await resolveGalleryPhotoUrl(image.file_path, this.currentMember?.id) || getPlaceholderImage();

      lightbox.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.3s ease;
      `;

      lightbox.innerHTML = `
        <button class="lightbox-close" style="position: absolute; top: 20px; right: 20px; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer; backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; transition: background 0.2s;">×</button>
        ${this.galleryImages.length > 1 ? `
          <button class="lightbox-prev" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer; backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center;">‹</button>
          <button class="lightbox-next" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 24px; cursor: pointer; backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center;">›</button>
        ` : ''}
        <div style="max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center;">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(image.title || 'Photo')}" style="max-width: 100%; max-height: calc(90vh - 100px); object-fit: contain; border-radius: 8px;">
          <div style="margin-top: 20px; text-align: center; color: white; max-width: 600px;">
            <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">${escapeHtml(image.title || 'Untitled')}</h2>
            ${image.description ? `<p style="font-size: 16px; opacity: 0.8; margin-bottom: 8px;">${escapeHtml(image.description)}</p>` : ''}
            <p style="font-size: 14px; opacity: 0.6;">${formatDate(image.created_at)}${image.category ? ` • ${escapeHtml(image.category)}` : ''}</p>
          </div>
        </div>
      `;

      const closeBtn = lightbox.querySelector('.lightbox-close');
      const prevBtn = lightbox.querySelector('.lightbox-prev');
      const nextBtn = lightbox.querySelector('.lightbox-next');

      if (closeBtn) closeBtn.addEventListener('click', () => this.closeLightbox());
      if (prevBtn) prevBtn.addEventListener('click', () => this.navigateLightbox(-1));
      if (nextBtn) nextBtn.addEventListener('click', () => this.navigateLightbox(1));

      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) this.closeLightbox();
      });

      document.addEventListener('keydown', this.handleKeyPress);
    },

    closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      if (lightbox) {
        lightbox.style.display = 'none';
      }
      document.removeEventListener('keydown', this.handleKeyPress);
    },

    navigateLightbox(direction) {
      this.currentLightboxIndex += direction;
      if (this.currentLightboxIndex < 0) {
        this.currentLightboxIndex = this.galleryImages.length - 1;
      } else if (this.currentLightboxIndex >= this.galleryImages.length) {
        this.currentLightboxIndex = 0;
      }
      this.openLightbox(this.currentLightboxIndex);
    },

    handleFileSelection(event, fileInput, member, container) {
      const file = fileInput.files[0];
      
      if (!file) return;
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        showToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
        fileInput.value = '';
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast('File size exceeds 10MB. Please select a smaller image.', 'error');
        fileInput.value = '';
        return;
      }
      
      // Store selected file
      this.selectedFile = file;
      
      // Show preview modal
      this.showPreviewModal(file, member, container, fileInput);
    },

    showPreviewModal(file, member, container, fileInput) {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.id = 'photoPreviewModal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.3s ease;
        overflow-y: auto;
      `;

      // Create preview from file
      const reader = new FileReader();
      reader.onload = (e) => {
        const imagePreviewUrl = e.target.result;
        const today = new Date().toISOString().split('T')[0];
        const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
        
        modal.innerHTML = `
          <div class="preview-modal-content" style="
            background: var(--panel-solid);
            border-radius: 20px;
            max-width: 700px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid var(--line);
          ">
            <!-- Modal Header -->
            <div style="
              padding: 24px;
              border-bottom: 1px solid var(--line);
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <div>
                <h2 style="font-size: 24px; font-weight: 700; color: var(--text); margin-bottom: 4px;">
                  Upload Photo
                </h2>
                <p style="font-size: 14px; color: var(--muted);">
                  Preview and add details before uploading
                </p>
              </div>
              <button id="modalCloseBtn" style="
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 1px solid var(--line);
                background: var(--panel);
                color: var(--muted);
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
              " title="Close">×</button>
            </div>

            <!-- Modal Body -->
            <div style="padding: 24px;">
              <!-- Image Preview -->
              <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Photo Preview
                </label>
                <div id="imagePreviewContainer" style="
                  width: 100%;
                  max-height: 300px;
                  border-radius: 12px;
                  overflow: hidden;
                  background: var(--bg);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 1px solid var(--line);
                ">
                  <img id="previewImage" src="${imagePreviewUrl}" alt="Preview" style="
                    max-width: 100%;
                    max-height: 300px;
                    object-fit: contain;
                  ">
                </div>
              </div>

              <!-- Photo Title -->
              <div style="margin-bottom: 20px;">
                <label for="photoTitle" style="display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Photo Title <span style="color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0;">(optional)</span>
                </label>
                <input 
                  type="text" 
                  id="photoTitle" 
                  value="${escapeHtml(defaultTitle)}"
                  placeholder="Family Picnic 2026"
                  style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: 1px solid var(--line);
                    background: var(--panel);
                    color: var(--text);
                    font-size: 14px;
                    font-family: inherit;
                    transition: all 0.2s;
                  "
                >
              </div>

              <!-- Description -->
              <div style="margin-bottom: 20px;">
                <label for="photoDescription" style="display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Description <span style="color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0;">(optional)</span>
                </label>
                <textarea 
                  id="photoDescription" 
                  rows="3"
                  placeholder="Family gathering memories"
                  style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: 1px solid var(--line);
                    background: var(--panel);
                    color: var(--text);
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                    transition: all 0.2s;
                  "
                ></textarea>
              </div>

              <!-- Category -->
              <div style="margin-bottom: 20px;">
                <label for="photoCategory" style="display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Category
                </label>
                <select 
                  id="photoCategory"
                  style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: 1px solid var(--line);
                    background: var(--panel);
                    color: var(--text);
                    font-size: 14px;
                    font-family: inherit;
                    cursor: pointer;
                    transition: all 0.2s;
                  "
                >
                  <option value="Family">Family</option>
                  <option value="Events">Events</option>
                  <option value="Memories">Memories</option>
                  <option value="Travel">Travel</option>
                  <option value="Festivals">Festivals</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <!-- Photo Date -->
              <div style="margin-bottom: 20px;">
                <label for="photoDate" style="display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Photo Date <span style="color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0;">(optional)</span>
                </label>
                <input 
                  type="date" 
                  id="photoDate"
                  value="${today}"
                  style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: 1px solid var(--line);
                    background: var(--panel);
                    color: var(--text);
                    font-size: 14px;
                    font-family: inherit;
                    cursor: pointer;
                    transition: all 0.2s;
                  "
                >
              </div>

              <!-- Uploaded By (Read-only) -->
              <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Uploaded By
                </label>
                <div style="
                  padding: 12px 16px;
                  border-radius: 10px;
                  background: rgba(96, 165, 250, 0.05);
                  border: 1px solid var(--line);
                  color: var(--text);
                  font-size: 14px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                ">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--blue);">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span style="font-weight: 500;">${escapeHtml(member.full_name || 'Unknown Member')}</span>
                </div>
              </div>

              <!-- Upload Progress (Hidden by default) -->
              <div id="modalUploadProgress" style="display: none; margin-bottom: 20px; padding: 16px; background: rgba(96, 165, 250, 0.05); border-radius: 12px; border: 1px solid var(--line);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                  <div style="flex: 1;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 6px;">Uploading photo...</div>
                    <div style="height: 8px; background: var(--line); border-radius: 4px; overflow: hidden;">
                      <div id="modalProgressBar" style="height: 100%; background: var(--gradient); width: 0%; transition: width 0.3s;"></div>
                    </div>
                  </div>
                  <div id="modalProgressText" style="font-size: 14px; font-weight: 600; color: var(--blue); min-width: 50px; text-align: right;">0%</div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div style="
              padding: 20px 24px;
              border-top: 1px solid var(--line);
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
            ">
              <button id="modalCancelBtn" class="modal-btn" style="
                flex: 1;
                min-width: 120px;
                padding: 12px 20px;
                border-radius: 10px;
                border: 1px solid var(--line);
                background: var(--panel);
                color: var(--text);
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
              ">Cancel</button>
              
              <button id="modalChangePhotoBtn" class="modal-btn" style="
                flex: 1;
                min-width: 140px;
                padding: 12px 20px;
                border-radius: 10px;
                border: 1px solid var(--blue);
                background: rgba(96, 165, 250, 0.1);
                color: var(--blue);
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Change Photo
              </button>
              
              <button id="modalUploadBtn" class="modal-btn" style="
                flex: 1;
                min-width: 140px;
                padding: 12px 20px;
                border-radius: 10px;
                border: none;
                background: var(--gradient);
                color: white;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 12px var(--glow);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload Photo
              </button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        const closeBtn = modal.querySelector('#modalCloseBtn');
        const cancelBtn = modal.querySelector('#modalCancelBtn');
        const changePhotoBtn = modal.querySelector('#modalChangePhotoBtn');
        const uploadBtn = modal.querySelector('#modalUploadBtn');

        // Add hover effects
        const modalBtns = modal.querySelectorAll('.modal-btn');
        modalBtns.forEach(btn => {
          btn.addEventListener('mouseenter', () => {
            if (btn.id !== 'modalUploadBtn') {
              btn.style.transform = 'translateY(-2px)';
              btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            } else {
              btn.style.transform = 'translateY(-2px)';
              btn.style.boxShadow = '0 8px 20px var(--glow)';
            }
          });
          btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            if (btn.id !== 'modalUploadBtn') {
              btn.style.boxShadow = 'none';
            } else {
              btn.style.boxShadow = '0 4px 12px var(--glow)';
            }
          });
        });

        // Add focus styles for inputs
        const inputs = modal.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--blue)';
            input.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
          });
          input.addEventListener('blur', () => {
            input.style.borderColor = 'var(--line)';
            input.style.boxShadow = 'none';
          });
        });

        // Close modal
        const closeModal = () => {
          modal.remove();
          fileInput.value = '';
          this.selectedFile = null;
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeModal();
          }
        });

        // Close on Escape key
        const handleEscape = (e) => {
          if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
          }
        };
        document.addEventListener('keydown', handleEscape);

        // Change photo button
        changePhotoBtn.addEventListener('click', () => {
          // Trigger file input again but keep modal open with filled data
          fileInput.click();
          
          // Update file input handler to update preview
          const handleFileChange = () => {
            const newFile = fileInput.files[0];
            if (newFile) {
              // Validate new file
              const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
              if (!validTypes.includes(newFile.type.toLowerCase())) {
                showToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
                fileInput.value = '';
                return;
              }
              
              const maxSize = 10 * 1024 * 1024;
              if (newFile.size > maxSize) {
                showToast('File size exceeds 10MB. Please select a smaller image.', 'error');
                fileInput.value = '';
                return;
              }

              // Update selected file
              this.selectedFile = newFile;

              // Update preview image
              const newReader = new FileReader();
              newReader.onload = (e) => {
                const previewImg = modal.querySelector('#previewImage');
                if (previewImg) {
                  previewImg.src = e.target.result;
                }
                showToast('Photo updated', 'success');
              };
              newReader.readAsDataURL(newFile);
            }
            fileInput.removeEventListener('change', handleFileChange);
          };
          
          fileInput.addEventListener('change', handleFileChange, { once: true });
        });

        // Upload button
        uploadBtn.addEventListener('click', () => {
          this.uploadPhotoFromModal(modal, member, container, fileInput);
        });
      };

      reader.readAsDataURL(file);
    },

    async uploadPhotoFromModal(modal, member, container, fileInput) {
      if (!this.selectedFile) {
        showToast('No file selected', 'error');
        return;
      }

      // Get form values
      const title = modal.querySelector('#photoTitle').value.trim();
      const description = modal.querySelector('#photoDescription').value.trim();
      const category = modal.querySelector('#photoCategory').value;
      const photoDate = modal.querySelector('#photoDate').value;

      // Disable buttons during upload
      const uploadBtn = modal.querySelector('#modalUploadBtn');
      const cancelBtn = modal.querySelector('#modalCancelBtn');
      const changePhotoBtn = modal.querySelector('#modalChangePhotoBtn');
      const closeBtn = modal.querySelector('#modalCloseBtn');

      uploadBtn.disabled = true;
      cancelBtn.disabled = true;
      changePhotoBtn.disabled = true;
      closeBtn.disabled = true;

      uploadBtn.style.opacity = '0.6';
      uploadBtn.style.cursor = 'not-allowed';
      cancelBtn.style.opacity = '0.6';
      changePhotoBtn.style.opacity = '0.6';

      // Show progress
      const progressDiv = modal.querySelector('#modalUploadProgress');
      const progressBar = modal.querySelector('#modalProgressBar');
      const progressText = modal.querySelector('#modalProgressText');

      progressDiv.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.textContent = '0%';

      try {
        // Simulate initial progress
        progressBar.style.width = '10%';
        progressText.textContent = '10%';

        // Upload to storage
        const fileExt = this.selectedFile.name.split('.').pop().toLowerCase();
        const fileName = `gallery/${member.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        progressBar.style.width = '30%';
        progressText.textContent = '30%';

        const { data: uploadData, error: uploadError } = await client.storage
          .from('family-photos')
          .upload(fileName, this.selectedFile, {
            contentType: this.selectedFile.type,
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        progressBar.style.width = '70%';
        progressText.textContent = '70%';

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user?.id) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        // Create database record with all metadata
        const insertData = {
          family_member_id: member.id,
          created_by: authData.user.id,
          file_path: uploadData.path,
          is_public: true,
          title: title || this.selectedFile.name.replace(/\.[^/.]+$/, ''),
          category: category
        };

        // Add optional fields if provided
        if (description) {
          insertData.description = description;
        }
        if (photoDate) {
          insertData.photo_date = photoDate;
        }

        const { error: dbError } = await client
          .from('family_gallery')
          .insert(insertData);

        if (dbError) {
          // Rollback: delete uploaded file
          console.error('DB insert failed, rolling back storage upload...');
          await client.storage.from('family-photos').remove([uploadData.path]);
          throw new Error(`Failed to save photo details: ${dbError.message}`);
        }

        progressBar.style.width = '100%';
        progressText.textContent = '100%';

        // Success!
        showToast('Photo uploaded successfully!', 'success');

        // Wait a moment then close modal
        setTimeout(() => {
          modal.remove();
          fileInput.value = '';
          this.selectedFile = null;

          // Refresh gallery
          this.loadGallery(container, member);
        }, 800);

      } catch (error) {
        console.error('Upload failed:', error);
        showToast(error.message || 'Upload failed. Please try again.', 'error');

        // Re-enable buttons
        uploadBtn.disabled = false;
        cancelBtn.disabled = false;
        changePhotoBtn.disabled = false;
        closeBtn.disabled = false;

        uploadBtn.style.opacity = '1';
        uploadBtn.style.cursor = 'pointer';
        cancelBtn.style.opacity = '1';
        changePhotoBtn.style.opacity = '1';

        // Hide progress
        progressDiv.style.display = 'none';
      }
    },

    async handlePhotoUpload(fileInput, member, container) {
      // This method is now deprecated and replaced by handleFileSelection
      // Keeping for backward compatibility but redirecting to new flow
      this.handleFileSelection({ target: fileInput }, fileInput, member, container);
    },

    handleKeyPress: function(e) {
      if (e.key === 'Escape') {
        window.FamilyPortalGallery.closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        window.FamilyPortalGallery.navigateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        window.FamilyPortalGallery.navigateLightbox(1);
      }
    }
  };

  // ============================================
  // 2. DOCUMENTS IMPLEMENTATION
  // ============================================

  window.FamilyPortalDocuments = {
    currentCategory: 'all',
    currentSort: 'newest',

    async loadDocuments(container, member) {
      if (!container || !member) return;

      showLoading(container);

      try {
        const { data, error } = await client
          .from('family_documents')
          .select('*')
          .eq('family_member_id', member.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.renderDocuments(container, data || [], member);

      } catch (error) {
        console.error('Failed to load documents:', error);
        showError(container, 'Unable to load documents. Please try again.', () => this.loadDocuments(container, member));
      }
    },

    renderDocuments(container, documents, member) {
      const categories = ['all', ...new Set(documents.map(d => d.category).filter(Boolean))];

      container.innerHTML = `
        <div class="documents-header" style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 8px;">My Documents</h1>
            <p style="color: var(--muted); font-size: 16px;">Personal documents and files</p>
          </div>
          <button id="uploadDocBtn" class="button button-primary" style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Document
          </button>
        </div>
        
        <input type="file" id="docFileInput" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" multiple style="display: none;">
        
        <div id="docUploadProgress" style="display: none; margin-bottom: 20px; padding: 16px; background: var(--panel); border-radius: 12px; border: 1px solid var(--line);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 500; color: var(--text); margin-bottom: 4px;">Uploading...</div>
              <div style="height: 6px; background: var(--line); border-radius: 3px; overflow: hidden;">
                <div id="docProgressBar" style="height: 100%; background: var(--gradient); width: 0%; transition: width 0.3s;"></div>
              </div>
            </div>
            <div id="docProgressText" style="font-size: 14px; color: var(--muted); min-width: 50px; text-align: right;">0%</div>
          </div>
        </div>
        
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; align-items: center;">
          <input type="text" id="documentSearch" placeholder="Search documents..." 
                 style="flex: 1; min-width: 200px; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
          <select id="categoryFilter" style="padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
            ${categories.map(cat => `<option value="${cat}">${cat === 'all' ? 'All Categories' : escapeHtml(cat)}</option>`).join('')}
          </select>
          <select id="sortFilter" style="padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        <div id="documentsGrid" style="display: flex; flex-direction: column; gap: 12px;"></div>
      `;

      // Setup upload button
      const uploadBtn = container.querySelector('#uploadDocBtn');
      const fileInput = container.querySelector('#docFileInput');
      
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => this.handleDocumentUpload(fileInput, member, container));

      const searchInput = container.querySelector('#documentSearch');
      const categoryFilter = container.querySelector('#categoryFilter');
      const sortFilter = container.querySelector('#sortFilter');
      const grid = container.querySelector('#documentsGrid');

      const renderFiltered = async () => {
        const searchTerm = searchInput.value.toLowerCase();
        const category = categoryFilter.value;
        const sort = sortFilter.value;

        let filtered = documents.filter(doc => {
          const matchesSearch = !searchTerm || 
            doc.title.toLowerCase().includes(searchTerm) ||
            (doc.description && doc.description.toLowerCase().includes(searchTerm));
          const matchesCategory = category === 'all' || doc.category === category;
          return matchesSearch && matchesCategory;
        });

        if (sort === 'newest') {
          filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sort === 'oldest') {
          filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else if (sort === 'name') {
          filtered.sort((a, b) => a.title.localeCompare(b.title));
        }

        if (filtered.length === 0) {
          showEmpty(grid, '📄', searchTerm || category !== 'all' ? 'No documents match your filters.' : 'No documents available yet.');
          return;
        }

        grid.innerHTML = '';
        filtered.forEach(doc => {
          const card = this.createDocumentCard(doc);
          grid.appendChild(card);
        });
      };

      searchInput.addEventListener('input', renderFiltered);
      categoryFilter.addEventListener('change', renderFiltered);
      sortFilter.addEventListener('change', renderFiltered);

      renderFiltered();
    },

    createDocumentCard(doc) {
      const fileIcon = this.getFileIcon(doc.file_type);
      
      const card = document.createElement('div');
      card.style.cssText = `
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border-radius: 12px;
        background: var(--card);
        border: 1px solid var(--line);
        transition: all 0.2s ease;
        cursor: pointer;
      `;
      
      card.innerHTML = `
        <div style="width: 48px; height: 48px; border-radius: 10px; background: rgba(96, 165, 250, 0.1); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">
          ${fileIcon}
        </div>
        <div style="flex: 1; min-width: 0;">
          <h3 style="font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(doc.title)}
          </h3>
          <p style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">
            ${doc.category ? escapeHtml(doc.category) + ' • ' : ''}${formatFileSize(doc.file_size)} • ${formatDate(doc.created_at)}
          </p>
          ${doc.description ? `<p style="font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(doc.description)}</p>` : ''}
        </div>
        <button class="btn-icon" style="padding: 8px 16px; border-radius: 8px; background: var(--gradient); color: white; border: none; cursor: pointer; font-size: 14px; font-weight: 500; white-space: nowrap;">
          View
        </button>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateX(4px)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateX(0)';
        card.style.boxShadow = 'none';
      });

      card.addEventListener('click', () => this.viewDocument(doc));

      return card;
    },

    getFileIcon(fileType) {
      if (!fileType) return '📄';
      if (fileType.includes('pdf')) return '📕';
      if (fileType.includes('image')) return '🖼️';
      if (fileType.includes('word') || fileType.includes('document')) return '📘';
      if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📗';
      if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📙';
      if (fileType.includes('zip') || fileType.includes('archive')) return '📦';
      return '📄';
    },

    async viewDocument(doc) {
      try {
        const normalized = String(doc.file_path || '').replace(/^\/+/, '');
        const fileName = normalized.split('/').pop();
        const directories = [
          normalized.split('/').slice(0, -1).join('/'),
          doc.family_member_id ? `${doc.family_member_id}/documents` : '',
          doc.family_member_id ? `documents/${doc.family_member_id}` : '',
          ''
        ].filter((value, index, list) => list.indexOf(value) === index);
        const buckets = ['family-documents', 'family-vault', 'family-private'];

        for (const bucket of buckets) {
          for (const directory of directories) {
            const listing = await client.storage.from(bucket).list(directory, { limit: 100, search: fileName });
            if (listing.error || !(listing.data || []).some(file => file.name === fileName)) continue;
            const actualPath = directory ? `${directory}/${fileName}` : fileName;
            const signed = await client.storage.from(bucket).createSignedUrl(actualPath, 3600);
            if (!signed.error && signed.data?.signedUrl) {
              window.open(signed.data.signedUrl, '_blank');
              return;
            }
          }
        }
        showToast('Document file is unavailable in storage', 'error');
      } catch (error) {
        console.error('Failed to view document:', error);
        showToast('Failed to open document', 'error');
      }
    },

    async handleDocumentUpload(fileInput, member, container) {
      const files = fileInput.files;
      if (!files || files.length === 0) return;

      const progressDiv = container.querySelector('#docUploadProgress');
      const progressBar = container.querySelector('#docProgressBar');
      const progressText = container.querySelector('#docProgressText');
      
      progressDiv.style.display = 'block';
      let uploadedCount = 0;
      const totalFiles = files.length;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          // Validate size
          if (file.size > 50 * 1024 * 1024) {
            alert(`${file.name} is too large (max 50MB)`);
            continue;
          }

          // Upload to storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${member.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await client.storage
            .from('family-documents')
            .upload(fileName, file, {
              contentType: file.type,
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            alert(`Failed to upload ${file.name}`);
            continue;
          }

          // Create database record
          const { error: dbError } = await client
            .from('family_documents')
            .insert({
              family_member_id: member.id,
              document_type: 'General',
              document_title: file.name.replace(/\.[^/.]+$/, ''),
              file_path: uploadData.path,
              mime_type: file.type,
              file_size: file.size,
              is_private: true,
              category: 'Personal',
              notes: `Uploaded on ${new Date().toLocaleDateString()}`
            });

          if (dbError) {
            console.error('DB error:', dbError);
            // Delete uploaded file if DB insert fails
            await client.storage.from('family-documents').remove([uploadData.path]);
            alert(`Failed to save ${file.name}`);
            continue;
          }

          uploadedCount++;
          const progress = Math.round((uploadedCount / totalFiles) * 100);
          progressBar.style.width = `${progress}%`;
          progressText.textContent = `${progress}%`;
        }

        // Success
        setTimeout(() => {
          progressDiv.style.display = 'none';
          progressBar.style.width = '0%';
          progressText.textContent = '0%';
          fileInput.value = '';
          
          if (uploadedCount > 0) {
            alert(`Successfully uploaded ${uploadedCount} document(s)!`);
            // Reload documents
            this.loadDocuments(container.parentElement, member);
          }
        }, 500);

      } catch (error) {
        console.error('Upload failed:', error);
        alert('Upload failed. Please try again.');
        progressDiv.style.display = 'none';
      }
    }
  };

  // ============================================
  // 3. NOTIFICATIONS IMPLEMENTATION
  // ============================================

  window.FamilyPortalNotifications = {
    async loadNotifications(container, member) {
      if (!container || !member) return;

      showLoading(container);

      try {
        const { data, error } = await client
          .from('member_notifications')
          .select('*')
          .eq('family_member_id', member.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.renderNotifications(container, data || [], member);

      } catch (error) {
        console.error('Failed to load notifications:', error);
        showError(container, 'Unable to load notifications. Please try again.', () => this.loadNotifications(container, member));
      }
    },

    renderNotifications(container, notifications, member) {
      const unreadCount = notifications.filter(n => !n.is_read).length;

      container.innerHTML = `
        <div class="notifications-header" style="margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h1 style="font-size: 32px; font-weight: 700; color: var(--text);">Notifications</h1>
            ${unreadCount > 0 ? `
              <button id="markAllReadBtn" class="btn-secondary" style="padding: 10px 20px; border-radius: 8px; background: rgba(96, 165, 250, 0.1); color: var(--primary); border: 1px solid var(--primary); cursor: pointer; font-size: 14px; font-weight: 500;">
                Mark All Read
              </button>
            ` : ''}
          </div>
          <p style="color: var(--muted); font-size: 16px;">
            ${unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up!'}
          </p>
        </div>

        <div id="notificationsList" style="display: flex; flex-direction: column; gap: 12px;"></div>
      `;

      const list = container.querySelector('#notificationsList');
      const markAllBtn = container.querySelector('#markAllReadBtn');

      if (markAllBtn) {
        markAllBtn.addEventListener('click', () => this.markAllRead(member));
      }

      if (notifications.length === 0) {
        showEmpty(list, '🔔', 'No notifications yet.');
        return;
      }

      notifications.forEach(notif => {
        const card = this.createNotificationCard(notif, member);
        list.appendChild(card);
      });
    },

    createNotificationCard(notif, member) {
      const typeColors = {
        info: 'rgba(96, 165, 250, 0.1)',
        success: 'rgba(52, 211, 153, 0.1)',
        warning: 'rgba(251, 191, 36, 0.1)',
        error: 'rgba(239, 68, 68, 0.1)'
      };

      const typeIcons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
      };

      // Support both 'type' and 'notification_type' column names
      const notifType = notif.type || notif.notification_type || 'info';

      const card = document.createElement('div');
      card.style.cssText = `
        display: flex;
        gap: 16px;
        padding: 16px;
        border-radius: 12px;
        background: ${notif.is_read ? 'var(--card)' : typeColors[notifType] || typeColors.info};
        border: 1px solid ${notif.is_read ? 'var(--line)' : 'rgba(96, 165, 250, 0.3)'};
        transition: all 0.2s ease;
        cursor: pointer;
        position: relative;
      `;

      card.innerHTML = `
        ${!notif.is_read ? '<div style="position: absolute; top: 16px; right: 16px; width: 8px; height: 8px; border-radius: 50%; background: var(--primary);"></div>' : ''}
        <div style="font-size: 24px; flex-shrink: 0;">
          ${typeIcons[notifType] || typeIcons.info}
        </div>
        <div style="flex: 1; min-width: 0;">
          <h3 style="font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 4px;">
            ${escapeHtml(notif.title)}
          </h3>
          <p style="font-size: 14px; color: var(--muted); margin-bottom: 8px; line-height: 1.5;">
            ${escapeHtml(notif.message)}
          </p>
          <p style="font-size: 12px; color: var(--muted);">
            ${formatDate(notif.created_at)}
          </p>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateX(4px)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateX(0)';
        card.style.boxShadow = 'none';
      });

      card.addEventListener('click', () => this.handleNotificationClick(notif, member));

      return card;
    },

    async handleNotificationClick(notif, member) {
      if (!notif.is_read) {
        await this.markAsRead(notif.id, member);
      }

      if (notif.link_url) {
        // Handle internal navigation
        if (notif.link_url.startsWith('#')) {
          const page = notif.link_url.substring(1);
          if (window.navigateToPage) {
            window.navigateToPage(page);
          }
        }
      }
    },

    async markAsRead(notificationId, member) {
      try {
        const { error } = await client.rpc('mark_notification_read', {
          p_notification_id: notificationId
        });

        if (error) throw error;

        showToast('Notification marked as read', 'success');
        
        // Reload notifications
        const container = document.querySelector('[id$="notificationsView"]');
        if (container) {
          await this.loadNotifications(container, member);
        }

      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        showToast('Failed to update notification', 'error');
      }
    },

    async markAllRead(member) {
      try {
        const { data, error } = await client.rpc('mark_all_notifications_read', {
          p_member_id: member.id
        });

        if (error) throw error;

        showToast(`${data || 0} notification(s) marked as read`, 'success');
        
        // Reload notifications
        const container = document.querySelector('[id$="notificationsView"]');
        if (container) {
          await this.loadNotifications(container, member);
        }

      } catch (error) {
        console.error('Failed to mark all as read:', error);
        showToast('Failed to update notifications', 'error');
      }
    }
  };

  // Add styles for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn-primary, .btn-secondary {
      transition: all 0.2s ease;
    }
    .btn-primary:hover, .btn-secondary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  `;
  document.head.appendChild(style);

  // ============================================
  // 4. IMPORTANT DATES IMPLEMENTATION
  // ============================================

  window.FamilyPortalDates = {
    async loadDates(container, member) {
      if (!container || !member) return;

      showLoading(container);

      try {
        const { data, error } = await client
          .from('family_events')
          .select('*')
          .order('event_date', { ascending: true });

        if (error) throw error;

        this.renderDates(container, data || []);

      } catch (error) {
        console.error('Failed to load dates:', error);
        showError(container, 'Unable to load important dates. Please try again.', () => this.loadDates(container, member));
      }
    },

    renderDates(container, events) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = events.filter(e => new Date(e.event_date) >= today);
      const past = events.filter(e => new Date(e.event_date) < today);

      container.innerHTML = `
        <div class="dates-header" style="margin-bottom: 32px;">
          <h1 style="font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 8px;">Important Dates</h1>
          <p style="color: var(--muted); font-size: 16px;">Family birthdays, anniversaries, and special events</p>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 24px;">
          <input type="text" id="datesSearch" placeholder="Search dates..." 
                 style="flex: 1; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
          <select id="typeFilter" style="padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
            <option value="all">All Types</option>
            <option value="birthday">Birthdays</option>
            <option value="anniversary">Anniversaries</option>
            <option value="memorial">Memorial Dates</option>
            <option value="other">Other</option>
          </select>
        </div>

        ${upcoming.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h2 style="font-size: 20px; font-weight: 600; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <span>📅</span> Upcoming Events
            </h2>
            <div id="upcomingDates" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>
        ` : ''}

        ${past.length > 0 ? `
          <div>
            <h2 style="font-size: 20px; font-weight: 600; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <span>📜</span> Past Events
            </h2>
            <div id="pastDates" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>
        ` : ''}
      `;

      const searchInput = container.querySelector('#datesSearch');
      const typeFilter = container.querySelector('#typeFilter');
      const upcomingContainer = container.querySelector('#upcomingDates');
      const pastContainer = container.querySelector('#pastDates');

      const renderFiltered = async () => {
        const searchTerm = searchInput.value.toLowerCase();
        const type = typeFilter.value;

        const filterEvents = (evts) => evts.filter(evt => {
          const matchesSearch = !searchTerm || 
            evt.title.toLowerCase().includes(searchTerm) ||
            (evt.description && evt.description.toLowerCase().includes(searchTerm));
          const matchesType = type === 'all' || evt.event_type === type;
          return matchesSearch && matchesType;
        });

        const filteredUpcoming = filterEvents(upcoming);
        const filteredPast = filterEvents(past);

        if (upcomingContainer) {
          if (filteredUpcoming.length === 0) {
            upcomingContainer.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No upcoming events.</p>';
          } else {
            upcomingContainer.innerHTML = '';
            filteredUpcoming.forEach(evt => {
              upcomingContainer.appendChild(this.createDateCard(evt, true));
            });
          }
        }

        if (pastContainer) {
          if (filteredPast.length === 0) {
            pastContainer.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No past events.</p>';
          } else {
            pastContainer.innerHTML = '';
            filteredPast.slice(0, 10).forEach(evt => {
              pastContainer.appendChild(this.createDateCard(evt, false));
            });
          }
        }

        if (filteredUpcoming.length === 0 && filteredPast.length === 0) {
          if (searchTerm || type !== 'all') {
            const emptyContainer = upcomingContainer || pastContainer || container;
            showEmpty(emptyContainer, '🔍', 'No dates match your filters.');
          } else {
            showEmpty(container, '📅', 'No important dates added yet.');
          }
        }
      };

      searchInput.addEventListener('input', renderFiltered);
      typeFilter.addEventListener('change', renderFiltered);

      renderFiltered();
    },

    createDateCard(event, isUpcoming) {
      const eventDate = new Date(event.event_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = eventDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const isToday = diffDays === 0;
      const isTomorrow = diffDays === 1;

      const typeIcons = {
        birthday: '🎂',
        anniversary: '💝',
        memorial: '🕊️',
        other: '📌'
      };

      const typeColors = {
        birthday: 'rgba(251, 191, 36, 0.1)',
        anniversary: 'rgba(236, 72, 153, 0.1)',
        memorial: 'rgba(148, 163, 184, 0.1)',
        other: 'rgba(96, 165, 250, 0.1)'
      };

      const card = document.createElement('div');
      card.style.cssText = `
        display: flex;
        gap: 16px;
        padding: 16px;
        border-radius: 12px;
        background: ${isToday ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 146, 60, 0.2))' : typeColors[event.event_type] || typeColors.other};
        border: 1px solid ${isToday ? 'rgba(251, 191, 36, 0.5)' : 'var(--line)'};
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      `;

      if (isToday) {
        card.innerHTML += `<div style="position: absolute; top: 8px; right: 8px; padding: 4px 8px; background: rgba(251, 191, 36, 0.9); color: white; border-radius: 6px; font-size: 11px; font-weight: 600;">TODAY</div>`;
      }

      const dayName = eventDate.toLocaleDateString(undefined, { weekday: 'short' });
      const monthName = eventDate.toLocaleDateString(undefined, { month: 'short' });

      card.innerHTML += `
        <div style="width: 64px; height: 64px; border-radius: 12px; background: var(--gradient); display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; flex-shrink: 0; box-shadow: 0 4px 12px rgba(96, 165, 250, 0.3);">
          <div style="font-size: 11px; text-transform: uppercase; opacity: 0.8;">${monthName}</div>
          <div style="font-size: 24px; font-weight: 700; line-height: 1;">${eventDate.getDate()}</div>
          <div style="font-size: 10px; opacity: 0.8;">${dayName}</div>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 20px;">${typeIcons[event.event_type] || typeIcons.other}</span>
            <h3 style="font-size: 16px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(event.title)}
            </h3>
          </div>
          ${event.description ? `<p style="font-size: 14px; color: var(--muted); margin-bottom: 8px; line-height: 1.4;">${escapeHtml(event.description)}</p>` : ''}
          <div style="display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--muted);">
            <span>🏷️ ${escapeHtml(event.event_type || 'Event')}</span>
            ${isUpcoming ? `
              <span>•</span>
              <span>${isToday ? 'Today' : isTomorrow ? 'Tomorrow' : `In ${diffDays} days`}</span>
            ` : ''}
          </div>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateX(4px)';
        card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateX(0)';
        card.style.boxShadow = 'none';
      });

      return card;
    }
  };

  // ============================================
  // 5. ACHIEVEMENTS IMPLEMENTATION
  // ============================================

  window.FamilyPortalAchievements = {
    async loadAchievements(container, member) {
      if (!container || !member) return;

      showLoading(container);

      try {
        const { data, error } = await client
          .from('achievements')
          .select('*')
          .eq('family_member_id', member.id)
          .order('achievement_date', { ascending: false });

        if (error) throw error;

        this.renderAchievements(container, data || []);

      } catch (error) {
        console.error('Failed to load achievements:', error);
        showError(container, 'Unable to load achievements. Please try again.', () => this.loadAchievements(container, member));
      }
    },

    renderAchievements(container, achievements) {
      const categories = ['all', ...new Set(achievements.map(a => a.category).filter(Boolean))];

      container.innerHTML = `
        <div class="achievements-header" style="margin-bottom: 32px;">
          <h1 style="font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 8px;">My Achievements</h1>
          <p style="color: var(--muted); font-size: 16px;">Milestones and accomplishments</p>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
          <input type="text" id="achievementSearch" placeholder="Search achievements..." 
                 style="flex: 1; min-width: 200px; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
          <select id="achievementCategory" style="padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
            ${categories.map(cat => `<option value="${cat}">${cat === 'all' ? 'All Categories' : escapeHtml(cat)}</option>`).join('')}
          </select>
          <select id="achievementSort" style="padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        <div id="achievementsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;"></div>
      `;

      const searchInput = container.querySelector('#achievementSearch');
      const categoryFilter = container.querySelector('#achievementCategory');
      const sortFilter = container.querySelector('#achievementSort');
      const grid = container.querySelector('#achievementsGrid');

      const renderFiltered = async () => {
        const searchTerm = searchInput.value.toLowerCase();
        const category = categoryFilter.value;
        const sort = sortFilter.value;

        let filtered = achievements.filter(ach => {
          const matchesSearch = !searchTerm || 
            ach.title.toLowerCase().includes(searchTerm) ||
            (ach.description && ach.description.toLowerCase().includes(searchTerm));
          const matchesCategory = category === 'all' || ach.category === category;
          return matchesSearch && matchesCategory;
        });

        if (sort === 'newest') {
          filtered.sort((a, b) => new Date(b.achievement_date || b.created_at) - new Date(a.achievement_date || a.created_at));
        } else {
          filtered.sort((a, b) => new Date(a.achievement_date || a.created_at) - new Date(b.achievement_date || b.created_at));
        }

        if (filtered.length === 0) {
          showEmpty(grid, '🏆', searchTerm || category !== 'all' ? 'No achievements match your filters.' : 'No achievements recorded yet.');
          return;
        }

        grid.innerHTML = '';
        for (const ach of filtered) {
          const card = await this.createAchievementCard(ach);
          grid.appendChild(card);
        }
      };

      searchInput.addEventListener('input', renderFiltered);
      categoryFilter.addEventListener('change', renderFiltered);
      sortFilter.addEventListener('change', renderFiltered);

      renderFiltered();
    },

    async createAchievementCard(achievement) {
      const hasImage = achievement.image_path;
      const imageUrl = hasImage ? await resolveAchievementPhotoUrl(achievement.image_path, achievement.family_member_id) : null;

      const card = document.createElement('div');
      card.style.cssText = `
        border-radius: 16px;
        overflow: hidden;
        background: var(--card);
        border: 1px solid var(--line);
        transition: all 0.3s ease;
        cursor: pointer;
        display: flex;
        flex-direction: column;
      `;

      card.innerHTML = `
        ${imageUrl ? `
          <div style="aspect-ratio: 16/9; overflow: hidden; background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(168, 85, 247, 0.1));">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(achievement.title)}" 
                 style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;"
                 loading="lazy">
          </div>
        ` : `
          <div style="aspect-ratio: 16/9; background: linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(251, 191, 36, 0.2)); display: flex; align-items: center; justify-content: center;">
            <div style="font-size: 64px;">🏆</div>
          </div>
        `}
        <div style="padding: 20px; flex: 1; display: flex; flex-direction: column;">
          <h3 style="font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px; line-height: 1.3;">
            ${escapeHtml(achievement.title)}
          </h3>
          ${achievement.description ? `
            <p style="font-size: 14px; color: var(--muted); margin-bottom: 12px; line-height: 1.5; flex: 1;">
              ${escapeHtml(achievement.description)}
            </p>
          ` : ''}
          <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: auto; font-size: 12px; color: var(--muted);">
            ${achievement.achievement_date ? `<span>📅 ${formatDate(achievement.achievement_date)}</span>` : ''}
            ${achievement.category ? `
              ${achievement.achievement_date ? '<span>•</span>' : ''}
              <span style="padding: 4px 8px; background: rgba(96, 165, 250, 0.1); border-radius: 6px; color: var(--primary); font-weight: 500;">
                ${escapeHtml(achievement.category)}
              </span>
            ` : ''}
          </div>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
        const img = card.querySelector('img');
        if (img) img.style.transform = 'scale(1.05)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
        const img = card.querySelector('img');
        if (img) img.style.transform = 'scale(1)';
      });

      card.addEventListener('click', () => this.showAchievementDetail(achievement));

      return card;
    },

    async showAchievementDetail(achievement) {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        animation: fadeIn 0.3s ease;
      `;

      const hasImage = achievement.image_path;
      const imageUrl = hasImage ? await resolveAchievementPhotoUrl(achievement.image_path, achievement.family_member_id) : null;

      modal.innerHTML = `
        <div style="background: var(--card); border-radius: 16px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative;">
          <button style="position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.5); border: none; color: white; font-size: 20px; cursor: pointer; z-index: 1; backdrop-filter: blur(10px);">×</button>
          ${imageUrl ? `
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(achievement.title)}" 
                 style="width: 100%; max-height: 300px; object-fit: cover;">
          ` : `
            <div style="width: 100%; height: 200px; background: linear-gradient(135deg, rgba(52, 211, 153, 0.3), rgba(251, 191, 36, 0.3)); display: flex; align-items: center; justify-content: center;">
              <div style="font-size: 80px;">🏆</div>
            </div>
          `}
          <div style="padding: 24px;">
            <h2 style="font-size: 24px; font-weight: 700; color: var(--text); margin-bottom: 12px;">
              ${escapeHtml(achievement.title)}
            </h2>
            ${achievement.description ? `
              <p style="font-size: 16px; color: var(--muted); line-height: 1.6; margin-bottom: 16px;">
                ${escapeHtml(achievement.description)}
              </p>
            ` : ''}
            <div style="display: flex; flex-wrap: wrap; gap: 12px; padding-top: 16px; border-top: 1px solid var(--line);">
              ${achievement.achievement_date ? `
                <div style="flex: 1;">
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Date</div>
                  <div style="font-size: 14px; color: var(--text); font-weight: 500;">${formatDate(achievement.achievement_date)}</div>
                </div>
              ` : ''}
              ${achievement.category ? `
                <div style="flex: 1;">
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Category</div>
                  <div style="font-size: 14px; color: var(--text); font-weight: 500;">${escapeHtml(achievement.category)}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('button');
      closeBtn.addEventListener('click', () => modal.remove());
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    }
  };

  // ============================================
  // 6. FAMILY TREE IMPLEMENTATION - CONNECTION VIEW
  // ============================================

  window.FamilyPortalTree = {
    currentData: null,
    selectedMember: null,

    async loadFamilyTree(container, member) {
      if (!container || !member) return;

      showLoading(container);

      try {
        const { data: members, error: membersError } = await client
          .from('family_members')
          .select('*')
          .eq('is_visible', true)
          .order('created_at', { ascending: true });

        if (membersError) throw membersError;

        const { data: relationships, error: relError} = await client
          .from('family_relationships')
          .select('*');

        const rels = relError ? [] : (relationships || []);

        // Cache data
        this.currentData = {
          members: members || [],
          relationships: rels,
          memberMap: this.buildMemberMap(members || [], rels),
          currentUser: member
        };

        this.renderFamilyTree(container);

      } catch (error) {
        console.error('Failed to load family tree:', error);
        showError(container, 'Unable to load family tree. Please try again.', () => this.loadFamilyTree(container, member));
      }
    },

    buildMemberMap(members, relationships) {
      const memberMap = new Map();
      
      // Initialize all members
      members.forEach(m => {
        memberMap.set(m.id, {
          ...m,
          parents: [],
          children: [],
          spouse: null,
          siblings: []
        });
      });

      // Process relationships
      relationships.forEach(rel => {
        const from = memberMap.get(rel.from_member_id);
        const to = memberMap.get(rel.to_member_id);
        if (!from || !to) return;

        const type = rel.relationship_type.toLowerCase();
        
        if (type === 'parent' || type === 'father' || type === 'mother') {
          if (!to.parents.find(p => p.id === from.id)) to.parents.push(from);
          if (!from.children.find(c => c.id === to.id)) from.children.push(to);
        } else if (type === 'child' || type === 'son' || type === 'daughter') {
          if (!from.parents.find(p => p.id === to.id)) from.parents.push(to);
          if (!to.children.find(c => c.id === from.id)) to.children.push(from);
        } else if (type === 'spouse' || type === 'husband' || type === 'wife' || type === 'partner') {
          from.spouse = to;
          to.spouse = from;
        } else if (type === 'sibling' || type === 'brother' || type === 'sister') {
          if (!from.siblings.find(s => s.id === to.id)) from.siblings.push(to);
          if (!to.siblings.find(s => s.id === from.id)) to.siblings.push(from);
        }
      });

      return memberMap;
    },

    renderFamilyTree(container) {
      const { members, memberMap, currentUser } = this.currentData;

      if (members.length === 0) {
        showEmpty(container, '🌳', 'No family members to display.');
        return;
      }

      container.innerHTML = `
        <style>
          .family-tree-wrapper {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .family-selector {
            background: var(--card);
            border-radius: 16px;
            padding: 20px;
            border: 1px solid var(--line);
          }
          .family-selector-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--muted);
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .family-member-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .member-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--panel);
            border: 2px solid var(--line);
            border-radius: 24px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
            font-weight: 500;
            color: var(--text);
          }
          .member-chip:hover {
            border-color: var(--purple);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102,126,234,0.2);
          }
          .member-chip.selected {
            background: var(--gradient);
            color: white;
            border-color: var(--purple);
            box-shadow: 0 4px 16px rgba(102,126,234,0.3);
          }
          .member-chip-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--gradient);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
          }
          .member-chip img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .connection-view {
            background: var(--card);
            border-radius: 16px;
            padding: 32px;
            border: 1px solid var(--line);
            min-height: 500px;
          }
          .connection-header {
            text-align: center;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 2px solid var(--line);
          }
          .connection-title {
            font-size: 24px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 8px;
          }
          .connection-subtitle {
            font-size: 14px;
            color: var(--muted);
          }
          .family-connection-grid {
            display: grid;
            gap: 24px;
          }
          .family-section {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .family-section-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .family-section-label::before {
            content: '';
            width: 30px;
            height: 2px;
            background: var(--gradient);
            border-radius: 2px;
          }
          .family-members-row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            justify-content: center;
          }
          .family-member-card {
            background: var(--panel);
            border: 2px solid var(--line);
            border-radius: 16px;
            padding: 20px;
            width: 200px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
          }
          .family-member-card:hover {
            transform: translateY(-4px);
            border-color: var(--purple);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          }
          .family-member-card.selected {
            background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15));
            border-color: var(--purple);
            box-shadow: 0 0 0 3px rgba(102,126,234,0.2);
          }
          .family-member-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin: 0 auto 12px;
            border: 3px solid var(--line);
            overflow: hidden;
          }
          .family-member-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .family-member-initials {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--gradient);
            color: white;
            font-size: 28px;
            font-weight: 700;
          }
          .family-member-name {
            font-size: 16px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 4px;
          }
          .family-member-relation {
            font-size: 13px;
            color: var(--muted);
          }
          .family-member-badge {
            display: inline-block;
            margin-top: 8px;
            padding: 4px 12px;
            background: var(--gradient);
            color: white;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
          }
          .detail-modal {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: fadeIn 0.3s ease;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .detail-content {
            background: var(--card);
            border-radius: 20px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.4s ease;
          }
          .detail-header {
            padding: 32px;
            text-align: center;
            border-bottom: 1px solid var(--line);
            position: relative;
          }
          .detail-close {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0,0,0,0.05);
            border: 1px solid var(--line);
            color: var(--text);
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          .detail-close:hover {
            background: rgba(0,0,0,0.1);
            transform: rotate(90deg);
          }
          .detail-avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            overflow: hidden;
            margin: 0 auto 20px;
            border: 4px solid var(--line);
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          }
          .detail-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .detail-body {
            padding: 32px;
          }
          .detail-field {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--line);
          }
          .detail-field:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .detail-label {
            font-size: 12px;
            color: var(--muted);
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .detail-value {
            font-size: 15px;
            color: var(--text);
            font-weight: 500;
            word-wrap: break-word;
          }
          @media (max-width: 768px) {
            .family-member-card {
              width: 160px;
              padding: 16px;
            }
            .family-member-avatar {
              width: 60px;
              height: 60px;
            }
            .family-member-initials {
              font-size: 22px;
            }
            .connection-view {
              padding: 20px;
            }
            .detail-header, .detail-body {
              padding: 24px;
            }
          }
          @media (max-width: 480px) {
            .family-member-card {
              width: 140px;
              padding: 12px;
            }
            .family-member-avatar {
              width: 50px;
              height: 50px;
            }
            .family-member-initials {
              font-size: 18px;
            }
            .family-member-name {
              font-size: 14px;
            }
            .family-member-relation {
              font-size: 12px;
            }
          }
        </style>

        <div class="hero-section" style="margin-bottom: 24px;">
          <h1 style="font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 8px;">Family Tree</h1>
          <p style="color: var(--muted); font-size: 16px;">Explore family connections and relationships</p>
        </div>

        <div class="family-tree-wrapper">
          <div class="family-selector">
            <div class="family-selector-title">Select Family Member</div>
            <div class="family-member-chips" id="memberChips"></div>
          </div>
          
          <div class="connection-view" id="connectionView">
            <div style="display: flex; align-items: center; justify-content: center; height: 300px; color: var(--muted);">
              Select a family member to view their connections
            </div>
          </div>
        </div>

        <div id="detailModal"></div>
      `;

      // Render member chips
      this.renderMemberChips(container);

      // Auto-select current user
      this.selectMember(currentUser.id);
    },

    renderMemberChips(container) {
      const { members, currentUser } = this.currentData;
      const chipsContainer = container.querySelector('#memberChips');

      members.forEach(member => {
        const isCurrentUser = member.id === currentUser.id;
        const photoUrl = member.profile_photo ? getPhotoUrl(member.profile_photo) : null;

        const chip = document.createElement('div');
        chip.className = 'member-chip';
        chip.dataset.memberId = member.id;

        chip.innerHTML = `
          <div class="member-chip-avatar">
            ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(member.full_name)}">` : getInitials(member.full_name)}
          </div>
          <span>${escapeHtml(member.full_name)}</span>
          ${isCurrentUser ? ' <span style="opacity: 0.7;">(You)</span>' : ''}
        `;

        chip.addEventListener('click', () => this.selectMember(member.id));
        chipsContainer.appendChild(chip);
      });
    },

    selectMember(memberId) {
      this.selectedMember = this.currentData.memberMap.get(memberId);
      if (!this.selectedMember) return;

      // Update chip selection
      document.querySelectorAll('.member-chip').forEach(chip => {
        chip.classList.toggle('selected', chip.dataset.memberId === memberId);
      });

      // Render connection view
      this.renderConnectionView();
    },

    renderConnectionView() {
      const member = this.selectedMember;
      const { currentUser } = this.currentData;
      const container = document.querySelector('#connectionView');

      // Build family connection data
      const connection = {
        selected: member,
        grandparents: this.getGrandparents(member),
        parents: member.parents,
        siblings: this.getSiblings(member),
        spouse: member.spouse,
        children: member.children,
        grandchildren: this.getGrandchildren(member)
      };

      container.innerHTML = `
        <style>
          .tree-section {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0;
          }
          .tree-row {
            display: flex;
            justify-content: center;
            gap: 40px;
            flex-wrap: wrap;
            position: relative;
            z-index: 2;
          }
          .tree-connector-vertical {
            width: 2px;
            height: 40px;
            background: linear-gradient(to bottom, var(--purple), var(--cyan));
            margin: 0 auto;
            position: relative;
            z-index: 1;
          }
          .tree-connector-horizontal {
            position: absolute;
            height: 2px;
            background: linear-gradient(to right, var(--purple), var(--cyan));
            top: 50%;
            transform: translateY(-50%);
            z-index: 0;
          }
          .tree-connector-t {
            position: absolute;
            width: 2px;
            height: 50%;
            background: linear-gradient(to bottom, var(--purple), var(--cyan));
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            z-index: 0;
          }
          .tree-connector-branch {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 100%;
            pointer-events: none;
          }
          .spouse-connector {
            position: relative;
            width: 60px;
            height: 2px;
            background: linear-gradient(to right, var(--purple), var(--pink));
            align-self: center;
            margin: 0 20px;
          }
          .spouse-connector::before {
            content: '💑';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--card);
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 16px;
          }
        </style>

        <div class="connection-header">
          <div class="connection-title">${escapeHtml(member.full_name)}'s Family</div>
          <div class="connection-subtitle">Complete family connections with relationship lines</div>
        </div>

        <div class="family-connection-grid">
          ${connection.grandparents.length > 0 ? `
            <div class="family-section">
              <div class="family-section-label">👴👵 Grandparents</div>
              <div class="tree-row">
                ${connection.grandparents.map(gp => this.renderMemberCard(gp, 'Grandparent')).join('')}
              </div>
            </div>
            <div class="tree-connector-vertical"></div>
          ` : ''}

          ${connection.parents.length > 0 ? `
            <div class="family-section">
              <div class="family-section-label">👨‍👩 Parents</div>
              <div class="tree-row" style="position: relative;">
                ${connection.parents.length > 1 ? `
                  <div class="tree-connector-horizontal" style="left: 25%; right: 25%; width: 50%;"></div>
                ` : ''}
                ${connection.parents.map(p => this.renderMemberCard(p, this.getParentLabel(p))).join('')}
              </div>
            </div>
            <div class="tree-connector-vertical"></div>
          ` : ''}

          <div class="family-section">
            <div class="family-section-label">⭐ Selected Member ${connection.spouse ? '& Spouse' : ''}</div>
            <div style="display: flex; align-items: center; justify-content: center;">
              ${this.renderMemberCard(member, member.relation || 'Family Member', true, member.id === currentUser.id)}
              ${connection.spouse ? `
                <div class="spouse-connector"></div>
                ${this.renderMemberCard(connection.spouse, 'Spouse')}
              ` : ''}
            </div>
          </div>

          ${connection.siblings.length > 0 ? `
            <div class="family-section" style="margin-top: 24px;">
              <div class="family-section-label">👫 Siblings</div>
              <div class="tree-row" style="position: relative;">
                ${connection.siblings.length > 1 ? `
                  <div class="tree-connector-horizontal" style="left: 20%; right: 20%; width: 60%;"></div>
                ` : ''}
                ${connection.siblings.map(s => this.renderMemberCard(s, this.getSiblingLabel(s))).join('')}
              </div>
            </div>
          ` : ''}

          ${connection.children.length > 0 ? `
            <div class="tree-connector-vertical"></div>
            <div class="family-section">
              <div class="family-section-label">👶 Children</div>
              <div class="tree-row" style="position: relative;">
                ${connection.children.length > 1 ? `
                  <div class="tree-connector-horizontal" style="left: 25%; right: 25%; width: 50%;"></div>
                ` : ''}
                ${connection.children.map(c => this.renderMemberCard(c, this.getChildLabel(c))).join('')}
              </div>
            </div>
          ` : ''}

          ${connection.grandchildren.length > 0 ? `
            <div class="tree-connector-vertical"></div>
            <div class="family-section">
              <div class="family-section-label">👶👶 Grandchildren</div>
              <div class="tree-row" style="position: relative;">
                ${connection.grandchildren.length > 1 ? `
                  <div class="tree-connector-horizontal" style="left: 20%; right: 20%; width: 60%;"></div>
                ` : ''}
                ${connection.grandchildren.map(gc => this.renderMemberCard(gc, 'Grandchild')).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      // Add click handlers
      container.querySelectorAll('.family-member-card').forEach(card => {
        const memberId = card.dataset.memberId;
        card.addEventListener('click', (e) => {
          if (e.target.closest('.detail-trigger')) {
            this.showMemberDetail(memberId);
          } else {
            this.selectMember(memberId);
          }
        });
      });
    },

    renderMemberCard(member, relationLabel, isSelected = false, isCurrentUser = false) {
      const photoUrl = member.profile_photo ? getPhotoUrl(member.profile_photo) : null;

      return `
        <div class="family-member-card${isSelected ? ' selected' : ''}" data-member-id="${member.id}">
          <div class="family-member-avatar">
            ${photoUrl ? `
              <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(member.full_name)}">
            ` : `
              <div class="family-member-initials">${getInitials(member.full_name)}</div>
            `}
          </div>
          <div class="family-member-name">${escapeHtml(member.full_name)}</div>
          <div class="family-member-relation">${escapeHtml(relationLabel)}</div>
          ${member.date_of_birth ? `<div class="family-member-relation" style="margin-top: 4px;">🎂 ${formatDate(member.date_of_birth)}</div>` : ''}
          ${isCurrentUser ? '<div class="family-member-badge">YOU</div>' : ''}
          ${isSelected ? '<div class="family-member-badge">SELECTED</div>' : ''}
        </div>
      `;
    },

    getGrandparents(member) {
      const grandparents = [];
      const seen = new Set();

      member.parents.forEach(parent => {
        parent.parents.forEach(gp => {
          if (!seen.has(gp.id)) {
            seen.add(gp.id);
            grandparents.push(gp);
          }
        });
      });

      return grandparents;
    },

    getSiblings(member) {
      const siblings = new Set();
      
      // Get siblings through shared parents
      member.parents.forEach(parent => {
        parent.children.forEach(child => {
          if (child.id !== member.id && !siblings.has(child.id)) {
            siblings.add(child.id);
          }
        });
      });

      // Add explicitly defined siblings
      member.siblings.forEach(sib => {
        siblings.add(sib.id);
      });

      return Array.from(siblings).map(id => this.currentData.memberMap.get(id)).filter(Boolean);
    },

    getGrandchildren(member) {
      const grandchildren = [];
      const seen = new Set();

      member.children.forEach(child => {
        child.children.forEach(gc => {
          if (!seen.has(gc.id)) {
            seen.add(gc.id);
            grandchildren.push(gc);
          }
        });
      });

      return grandchildren;
    },

    getParentLabel(parent) {
      const rel = (parent.relation || '').toLowerCase();
      if (rel.includes('father')) return 'Father';
      if (rel.includes('mother')) return 'Mother';
      return 'Parent';
    },

    getSiblingLabel(sibling) {
      const rel = (sibling.relation || '').toLowerCase();
      if (rel.includes('brother')) return 'Brother';
      if (rel.includes('sister')) return 'Sister';
      return 'Sibling';
    },

    getChildLabel(child) {
      const rel = (child.relation || '').toLowerCase();
      if (rel.includes('son')) return 'Son';
      if (rel.includes('daughter')) return 'Daughter';
      return 'Child';
    },

    showMemberDetail(memberId) {
      const member = this.currentData.memberMap.get(memberId);
      if (!member) return;

      const modal = document.getElementById('detailModal');
      const photoUrl = member.profile_photo ? getPhotoUrl(member.profile_photo) : null;
      const fields = [];

      if (member.nickname) fields.push({ icon: '😊', label: 'Nickname', value: member.nickname });
      if (member.date_of_birth) fields.push({ icon: '🎂', label: 'Date of Birth', value: formatDate(member.date_of_birth) });
      if (member.gender) fields.push({ icon: '👤', label: 'Gender', value: member.gender });
      if (member.phone && member.phone_visibility !== false) fields.push({ icon: '📞', label: 'Phone', value: member.phone });
      if (member.email && member.email_visibility !== false) fields.push({ icon: '✉️', label: 'Email', value: member.email });
      if (member.occupation) fields.push({ icon: '💼', label: 'Occupation', value: member.occupation });
      if (member.address && member.address_visibility !== false) fields.push({ icon: '📍', label: 'Address', value: member.address });
      if (member.citizenship) fields.push({ icon: '🌍', label: 'Citizenship', value: member.citizenship });
      if (member.biography) fields.push({ icon: '📝', label: 'About', value: member.biography });
      if (member.hobbies) fields.push({ icon: '🎯', label: 'Hobbies', value: member.hobbies });

      modal.innerHTML = `
        <div class="detail-modal">
          <div class="detail-content">
            <div class="detail-header">
              <button class="detail-close">×</button>
              <div class="detail-avatar">
                ${photoUrl ? `
                  <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(member.full_name)}">
                ` : `
                  <div class="family-member-initials" style="width: 100%; height: 100%; font-size: 48px;">
                    ${getInitials(member.full_name)}
                  </div>
                `}
              </div>
              <h2 style="font-size: 28px; font-weight: 700; color: var(--text); margin-bottom: 8px;">
                ${escapeHtml(member.full_name)}
              </h2>
              ${member.relation ? `
                <p style="font-size: 16px; color: var(--muted); font-weight: 500;">
                  ${escapeHtml(member.relation)}
                </p>
              ` : ''}
            </div>
            <div class="detail-body">
              ${fields.length > 0 ? fields.map(field => `
                <div class="detail-field">
                  <div class="detail-label">
                    <span>${field.icon}</span>
                    <span>${field.label}</span>
                  </div>
                  <div class="detail-value">${escapeHtml(field.value)}</div>
                </div>
              `).join('') : '<p style="color: var(--muted); text-align: center;">No additional information available.</p>'}
            </div>
          </div>
        </div>
      `;

      const closeBtn = modal.querySelector('.detail-close');
      const modalBg = modal.querySelector('.detail-modal');

      closeBtn.addEventListener('click', () => {
        modal.innerHTML = '';
      });

      modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
          modal.innerHTML = '';
        }
      });
    }
  };

  console.log('✅ Family Portal Features loaded: Gallery, Documents, Notifications, Dates, Achievements, Family Tree');

})();
