(function () {
  'use strict';

  const client = window.supabaseClient;
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.main');
  const overlay = document.getElementById('overlay');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');
  const bucket = 'family-vault';

  const state = {
    user: null,
    view: null,
    members: [],
    selectedMember: null,
    events: [],
    achievements: [],
    notifications: [],
    gallery: [],
    documents: [],
    activeTab: 'events'
  };

  if (!client || !nav || !main) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const makeUuid = () => {
    const cryptoApi = window.crypto || globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
      const random = Math.random() * 16 | 0;
      const value = character === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  };

  const dateText = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value + (value.length === 10 ? 'T00:00:00' : ''))) : '';
  const errorText = error => [error?.message, error?.details, error?.hint].filter(Boolean).join(' | ') || 'The request failed.';
  const toast = (text, error) => { const node = document.getElementById('toast'); if (!node) return; node.textContent = text; node.className = error ? 'error' : ''; node.hidden = false; setTimeout(() => { node.hidden = true; }, 3500); };

  async function admin() {
    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (!user) return null;
    const result = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    return result.error || !result.data ? null : user;
  }

  function addNav() {
    if (nav.querySelector('[data-family-vault-admin-view]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'family-vault-admin';
    button.dataset.familyVaultAdminView = 'true';
    button.textContent = 'Family Vault Admin';
    nav.appendChild(button);
  }

  function activate() {
    document.querySelectorAll('.view').forEach(view => { view.hidden = view !== state.view; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'family-vault-admin'));
    document.getElementById('title').textContent = 'Family Vault Admin';
    document.getElementById('side')?.classList.remove('open');
  }

  async function loadMembers() {
    const result = await client.from('family_members').select('*').order('full_name');
    if (result.error) throw result.error;
    state.members = result.data || [];
  }

  async function loadMemberData(memberId) {
    if (!memberId) return;

    const [eventsResult, achievementsResult, notificationsResult, galleryResult, documentsResult] = await Promise.all([
      client.from('family_events').select('*').eq('family_member_id', memberId).order('event_date', { ascending: false }),
      client.from('achievements').select('*').eq('family_member_id', memberId).order('achievement_date', { ascending: false }),
      client.from('member_notifications').select('*').eq('family_member_id', memberId).order('created_at', { ascending: false }),
      client.from('family_gallery').select('*').eq('family_member_id', memberId).order('created_at', { ascending: false }),
      client.from('family_documents').select('*').eq('family_member_id', memberId).order('created_at', { ascending: false })
    ]);

    state.events = eventsResult.data || [];
    state.achievements = achievementsResult.data || [];
    state.notifications = notificationsResult.data || [];
    state.gallery = galleryResult.data || [];
    state.documents = documentsResult.data || [];
  }

  function renderMemberSelector() {
    const options = state.members.map(m => 
      `<option value="${escape(m.id)}"${state.selectedMember?.id === m.id ? ' selected' : ''}>${escape(m.full_name)} - ${escape(m.relation || 'Family Member')}</option>`
    ).join('');
    
    return `<div class="panel">
      <h3>Select Family Member</h3>
      <div class="form">
        <label class="full">
          <span>Family Member</span>
          <select class="field" id="memberSelector" ${state.members.length === 0 ? 'disabled' : ''}>
            <option value="">-- Select a family member --</option>
            ${options}
          </select>
        </label>
      </div>
    </div>`;
  }

  function renderMemberProfile() {
    if (!state.selectedMember) return '';

    const member = state.selectedMember;
    return `<div class="panel">
      <h3>Member Profile</h3>
      <div class="family-details vault-info">
        <div class="family-detail"><span>Name</span><strong>${escape(member.full_name)}</strong></div>
        <div class="family-detail"><span>Email</span><strong>${escape(member.email || '—')}</strong></div>
        <div class="family-detail"><span>Member ID</span><strong>${escape(member.id)}</strong></div>
        <div class="family-detail"><span>Auth Status</span><strong>${member.auth_user_id ? 'Linked' : 'Not Linked'}</strong></div>
      </div>
    </div>`;
  }

  function renderTabs() {
    if (!state.selectedMember) return '';

    const tabs = [
      { key: 'events', label: 'Important Dates' },
      { key: 'achievements', label: 'Achievements' },
      { key: 'notifications', label: 'Notifications' },
      { key: 'gallery', label: 'Gallery' },
      { key: 'documents', label: 'Documents' }
    ];

    return `<div class="vault-admin-tabs">
      ${tabs.map(tab => 
        `<button type="button" class="vault-admin-tab${state.activeTab === tab.key ? ' active' : ''}" data-tab="${tab.key}">${tab.label}</button>`
      ).join('')}
    </div>`;
  }

  function renderEventsTab() {
    const html = `<div class="panel">
      <div class="toolbar">
        <h3>Important Dates</h3>
        <button type="button" class="button primary" data-add-event>Add Event</button>
      </div>
      <div data-events-list>
        ${state.events.length === 0 
          ? '<div class="empty-state">No events yet. Click "Add Event" to create one.</div>'
          : `<table><thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Actions</th></tr></thead><tbody>${state.events.map(event => 
              `<tr>
                <td>${escape(event.title)}</td>
                <td>${escape(event.event_type)}</td>
                <td>${dateText(event.event_date)}</td>
                <td class="row-actions">
                  <button type="button" data-edit-event="${escape(event.id)}">Edit</button>
                  <button type="button" data-delete-event="${escape(event.id)}">Delete</button>
                </td>
              </tr>`
            ).join('')}</tbody></table>`
        }
      </div>
    </div>`;
    return html;
  }

  function renderAchievementsTab() {
    const html = `<div class="panel">
      <div class="toolbar">
        <h3>Achievements</h3>
        <button type="button" class="button primary" data-add-achievement>Add Achievement</button>
      </div>
      <div data-achievements-list>
        ${state.achievements.length === 0 
          ? '<div class="empty-state">No achievements yet. Click "Add Achievement" to create one.</div>'
          : `<table><thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Actions</th></tr></thead><tbody>${state.achievements.map(achievement => 
              `<tr>
                <td>${escape(achievement.title)}</td>
                <td>${escape(achievement.category || '—')}</td>
                <td>${dateText(achievement.achievement_date)}</td>
                <td class="row-actions">
                  <button type="button" data-edit-achievement="${escape(achievement.id)}">Edit</button>
                  <button type="button" data-delete-achievement="${escape(achievement.id)}">Delete</button>
                </td>
              </tr>`
            ).join('')}</tbody></table>`
        }
      </div>
    </div>`;
    return html;
  }

  function renderNotificationsTab() {
    const html = `<div class="panel">
      <div class="toolbar">
        <h3>Notifications</h3>
        <button type="button" class="button primary" data-add-notification>Send Notification</button>
      </div>
      <div data-notifications-list>
        ${state.notifications.length === 0 
          ? '<div class="empty-state">No notifications yet. Click "Send Notification" to create one.</div>'
          : `<table><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>${state.notifications.map(notif => 
              `<tr>
                <td>${escape(notif.title)}</td>
                <td>${escape(notif.notification_type || 'info')}</td>
                <td>${notif.is_read ? 'Read' : 'Unread'}</td>
                <td>${dateText(notif.created_at)}</td>
                <td class="row-actions">
                  <button type="button" data-edit-notification="${escape(notif.id)}">Edit</button>
                  <button type="button" data-delete-notification="${escape(notif.id)}">Delete</button>
                </td>
              </tr>`
            ).join('')}</tbody></table>`
        }
      </div>
    </div>`;
    return html;
  }

  async function renderGalleryTab() {
    const signedGallery = await Promise.all(state.gallery.map(async item => {
      if (!item.file_path) return { ...item, signedUrl: '' };
      const normalized = String(item.file_path).replace(/^\/+/, '');
      const fileName = normalized.split('/').pop();
      const directory = normalized.split('/').slice(0, -1).join('/');
      const listing = await client.storage.from(bucket).list(directory, { limit: 100, search: fileName });
      if (listing.error || !(listing.data || []).some(file => file.name === fileName)) {
        return { ...item, signedUrl: '' };
      }
      const signed = await client.storage.from(bucket).createSignedUrl(normalized, 300);
      if (signed.error) return { ...item, signedUrl: '' };
      return { ...item, signedUrl: signed.data.signedUrl };
    }));

    const html = `<div class="panel">
      <div class="toolbar">
        <h3>Gallery</h3>
        <button type="button" class="button primary" data-add-gallery>Upload Image</button>
      </div>
      <div data-gallery-list>
        ${signedGallery.length === 0 
          ? '<div class="empty-state">No gallery items yet. Click "Upload Image" to add one.</div>'
          : `<div class="cards">${signedGallery.map(item => 
              `<div class="card">
                ${item.signedUrl ? `<img src="${escape(item.signedUrl)}" alt="${escape(item.title || 'Gallery item')}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';">` : ''}<div style="aspect-ratio:16/9;background:#111827;display:grid;place-items:center;${item.signedUrl ? 'display:none;' : ''}color:#64748b;">📷 Image Unavailable</div>
                <h4>${escape(item.title || 'Untitled')}</h4>
                <div class="row-actions">
                  <button type="button" data-edit-gallery="${escape(item.id)}">Edit</button>
                  <button type="button" data-delete-gallery="${escape(item.id)}">Delete</button>
                </div>
              </div>`
            ).join('')}</div>`
        }
      </div>
    </div>`;
    return html;
  }

  async function renderDocumentsTab() {
    const html = `<div class="panel">
      <div class="toolbar">
        <h3>Documents</h3>
        <button type="button" class="button primary" data-add-document>Upload Document</button>
      </div>
      <div data-documents-list>
        ${state.documents.length === 0 
          ? '<div class="empty-state">No documents yet. Click "Upload Document" to add one.</div>'
          : `<table><thead><tr><th>Title</th><th>Type</th><th>Size</th><th>Date</th><th>Actions</th></tr></thead><tbody>${state.documents.map(doc => 
              `<tr>
                <td>${escape(doc.document_title)}</td>
                <td>${escape(doc.document_type)}</td>
                <td>${doc.file_size ? Math.round(doc.file_size / 1024) + ' KB' : '—'}</td>
                <td>${dateText(doc.created_at)}</td>
                <td class="row-actions">
                  <button type="button" data-view-document="${escape(doc.id)}">View</button>
                  <button type="button" data-edit-document="${escape(doc.id)}">Edit</button>
                  <button type="button" data-delete-document="${escape(doc.id)}">Delete</button>
                </td>
              </tr>`
            ).join('')}</tbody></table>`
        }
      </div>
    </div>`;
    return html;
  }

  async function renderContent() {
    let tabContent = '';
    if (state.selectedMember) {
      switch (state.activeTab) {
        case 'events': tabContent = renderEventsTab(); break;
        case 'achievements': tabContent = renderAchievementsTab(); break;
        case 'notifications': tabContent = renderNotificationsTab(); break;
        case 'gallery': tabContent = await renderGalleryTab(); break;
        case 'documents': tabContent = await renderDocumentsTab(); break;
      }
    }

    const container = state.view.querySelector('[data-content-area]');
    if (container) {
      container.innerHTML = `
        ${renderMemberProfile()}
        ${renderTabs()}
        ${tabContent}
      `;
    }
  }

  async function show() {
    const user = await admin();
    if (!user) {
      location.replace('../index.html#admin-login');
      return;
    }

    state.user = user;

    if (!state.view) {
      state.view = document.createElement('section');
      state.view.id = 'familyVaultAdminView';
      state.view.className = 'view';
      main.appendChild(state.view);
    }

    state.view.innerHTML = `
      <div class="vault-admin-page">
        <div class="family-toolbar">
          <div>
            <span class="eyebrow">Admin Control Panel</span>
            <h2>Family Vault Admin</h2>
            <p class="muted">Manage member data, events, achievements, notifications, gallery, and documents.</p>
          </div>
        </div>
        <div data-loading-state>Loading members...</div>
      </div>
    `;

    activate();

    try {
      await loadMembers();
      state.view.querySelector('[data-loading-state]').outerHTML = `
        ${renderMemberSelector()}
        <div data-content-area></div>
      `;
      attachEventListeners();
    } catch (error) {
      console.error('Failed to load members:', error);
      state.view.querySelector('[data-loading-state]').innerHTML = `<div class="error">Failed to load members: ${errorText(error)}<br><button class="button" onclick="location.reload()">Retry</button></div>`;
    }
  }

  function attachEventListeners() {
    const selector = document.getElementById('memberSelector');
    if (selector) {
      selector.onchange = async (e) => {
        const memberId = e.target.value;
        if (!memberId) {
          state.selectedMember = null;
          state.activeTab = 'events';
          await renderContent();
          return;
        }
        state.selectedMember = state.members.find(m => m.id === memberId);
        state.activeTab = 'events';
        await loadMemberData(memberId);
        await renderContent();
      };
    }
  }

  function closeDialog() {
    if (overlay) overlay.hidden = true;
  }

  function openDialog(title, html) {
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    overlay.hidden = false;
  }

  // Event Management
  function openEventForm(event = null) {
    const typeOptions = ['birthday', 'anniversary', 'memorial', 'family_event', 'other'].map(type => 
      `<option value="${type}"${event?.event_type === type ? ' selected' : ''}>${type}</option>`
    ).join('');

    openDialog(event ? 'Edit Event' : 'Add Event', `
      <form class="form" data-event-form>
        <label class="full">
          <span>Title *</span>
          <input class="field" name="title" value="${escape(event?.title || '')}" required>
        </label>
        <label class="full">
          <span>Description</span>
          <textarea class="field" name="description">${escape(event?.description || '')}</textarea>
        </label>
        <label>
          <span>Event Type *</span>
          <select class="field" name="event_type" required>${typeOptions}</select>
        </label>
        <label>
          <span>Event Date *</span>
          <input class="field" name="event_date" type="date" value="${event?.event_date || ''}" required>
        </label>
        <label class="full">
          <span>Image (Optional)</span>
          <input class="field" name="image" type="file" accept="image/*">
        </label>
        <p data-form-message></p>
        <div class="actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Save Event</button>
        </div>
      </form>
    `);

    const form = dialogBody.querySelector('[data-event-form]');
    form.querySelector('[data-cancel]').onclick = closeDialog;
    form.onsubmit = (e) => saveEvent(e, event);
  }

  async function saveEvent(e, existingEvent) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = form.querySelector('[data-form-message]');
    const data = new FormData(form);

    const payload = {
      family_member_id: state.selectedMember.id,
      title: data.get('title'),
      description: data.get('description') || null,
      event_type: data.get('event_type'),
      event_date: data.get('event_date')
    };

    const file = data.get('image');
    let imagePath = existingEvent?.image_path || null;
    let uploadedImagePath = '';

    try {
      if (file?.name) {
        const path = `events/${state.selectedMember.id}/${makeUuid()}-${file.name}`;
        const upload = await client.storage.from(bucket).upload(path, file);
        if (upload.error) throw upload.error;
        imagePath = path;
        uploadedImagePath = path;
      }

      let result = existingEvent
        ? await client.from('family_events').update(payload).eq('id', existingEvent.id)
        : await client.from('family_events').insert(payload);

      if (result.error && /column|schema cache|image_path|PGRST204|42703/i.test(String(result.error.message) + ' ' + String(result.error.code || ''))) {
        const { image_path, ...compatiblePayload } = payload;
        result = existingEvent
          ? await client.from('family_events').update(compatiblePayload).eq('id', existingEvent.id)
          : await client.from('family_events').insert(compatiblePayload);
      }

      if (result.error) throw result.error;

      if (uploadedImagePath) {
        await client.storage.from(bucket).remove([uploadedImagePath]);
      }

      closeDialog();
      await loadMemberData(state.selectedMember.id);
      await renderContent();
      toast(existingEvent ? 'Event updated.' : 'Event added.');
    } catch (error) {
      message.textContent = errorText(error);
      message.className = 'error';
    }
  }

  async function deleteEvent(eventId) {
    if (!confirm('Delete this event?')) return;
    const result = await client.from('family_events').delete().eq('id', eventId);
    if (result.error) {
      toast('Failed to delete event.', true);
      return;
    }
    await loadMemberData(state.selectedMember.id);
    await renderContent();
    toast('Event deleted.');
  }

  // Achievement Management
  function openAchievementForm(achievement = null) {
    openDialog(achievement ? 'Edit Achievement' : 'Add Achievement', `
      <form class="form" data-achievement-form>
        <label class="full">
          <span>Title *</span>
          <input class="field" name="title" value="${escape(achievement?.title || '')}" required>
        </label>
        <label class="full">
          <span>Description</span>
          <textarea class="field" name="description">${escape(achievement?.description || '')}</textarea>
        </label>
        <label>
          <span>Category</span>
          <input class="field" name="category" value="${escape(achievement?.category || '')}">
        </label>
        <label>
          <span>Achievement Date</span>
          <input class="field" name="achievement_date" type="date" value="${achievement?.achievement_date || ''}">
        </label>
        <label class="full">
          <span>Image (Optional)</span>
          <input class="field" name="image" type="file" accept="image/*">
        </label>
        <label class="full">
          <span>Certificate (Optional)</span>
          <input class="field" name="certificate" type="file" accept="image/*,application/pdf">
        </label>
        <p data-form-message></p>
        <div class="actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Save Achievement</button>
        </div>
      </form>
    `);

    const form = dialogBody.querySelector('[data-achievement-form]');
    form.querySelector('[data-cancel]').onclick = closeDialog;
    form.onsubmit = (e) => saveAchievement(e, achievement);
  }

  async function saveAchievement(e, existingAchievement) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = form.querySelector('[data-form-message]');
    const data = new FormData(form);

    const payload = {
      family_member_id: state.selectedMember.id,
      title: data.get('title'),
      description: data.get('description') || null,
      category: data.get('category') || null,
      achievement_date: data.get('achievement_date') || null
    };

    try {
      const imageFile = data.get('image');
      const certFile = data.get('certificate');

      if (imageFile?.name) {
        const path = `achievements/${state.selectedMember.id}/${makeUuid()}-${imageFile.name}`;
        const upload = await client.storage.from(bucket).upload(path, imageFile);
        if (upload.error) throw upload.error;
        payload.image_path = path;
      } else if (existingAchievement?.image_path) {
        payload.image_path = existingAchievement.image_path;
      }

      if (certFile?.name) {
        const path = `achievements/${state.selectedMember.id}/certificates/${makeUuid()}-${certFile.name}`;
        const upload = await client.storage.from(bucket).upload(path, certFile);
        if (upload.error) throw upload.error;
        payload.certificate_path = path;
      } else if (existingAchievement?.certificate_path) {
        payload.certificate_path = existingAchievement.certificate_path;
      }

      const result = existingAchievement 
        ? await client.from('achievements').update(payload).eq('id', existingAchievement.id)
        : await client.from('achievements').insert(payload);

      if (result.error) throw result.error;

      closeDialog();
      await loadMemberData(state.selectedMember.id);
      await renderContent();
      toast(existingAchievement ? 'Achievement updated.' : 'Achievement added.');
    } catch (error) {
      message.textContent = errorText(error);
      message.className = 'error';
    }
  }

  async function deleteAchievement(achievementId) {
    if (!confirm('Delete this achievement?')) return;
    const result = await client.from('achievements').delete().eq('id', achievementId);
    if (result.error) {
      toast('Failed to delete achievement.', true);
      return;
    }
    await loadMemberData(state.selectedMember.id);
    await renderContent();
    toast('Achievement deleted.');
  }

  // Notification Management
  function openNotificationForm(notification = null) {
    const typeOptions = ['info', 'warning', 'success', 'alert'].map(type => 
      `<option value="${type}"${(notification?.type || notification?.notification_type) === type ? ' selected' : ''}>${type}</option>`
    ).join('');

    openDialog(notification ? 'Edit Notification' : 'Send Notification', `
      <form class="form" data-notification-form>
        <label class="full">
          <span>Title *</span>
          <input class="field" name="title" value="${escape(notification?.title || '')}" required>
        </label>
        <label class="full">
          <span>Message *</span>
          <textarea class="field" name="message" required>${escape(notification?.message || '')}</textarea>
        </label>
        <label>
          <span>Type</span>
          <select class="field" name="notification_type">${typeOptions}</select>
        </label>
        <label>
          <span>Status</span>
          <select class="field" name="is_read">
            <option value="false"${notification?.is_read === false ? ' selected' : ''}>Unread</option>
            <option value="true"${notification?.is_read === true ? ' selected' : ''}>Read</option>
          </select>
        </label>
        <p data-form-message></p>
        <div class="actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">${notification ? 'Update' : 'Send'} Notification</button>
        </div>
      </form>
    `);

    const form = dialogBody.querySelector('[data-notification-form]');
    form.querySelector('[data-cancel]').onclick = closeDialog;
    form.onsubmit = (e) => saveNotification(e, notification);
  }

  async function saveNotification(e, existingNotification) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = form.querySelector('[data-form-message]');
    const data = new FormData(form);

    const payload = {
      family_member_id: state.selectedMember.id,
      title: data.get('title'),
      message: data.get('message'),
      type: data.get('notification_type'), // Column name is 'type' in database
      is_read: data.get('is_read') === 'true'
    };

    try {
      const result = existingNotification 
        ? await client.from('member_notifications').update(payload).eq('id', existingNotification.id)
        : await client.from('member_notifications').insert(payload);

      if (result.error) throw result.error;

      closeDialog();
      await loadMemberData(state.selectedMember.id);
      await renderContent();
      toast(existingNotification ? 'Notification updated.' : 'Notification sent.');
    } catch (error) {
      message.textContent = errorText(error);
      message.className = 'error';
    }
  }

  async function deleteNotification(notificationId) {
    if (!confirm('Delete this notification?')) return;
    const result = await client.from('member_notifications').delete().eq('id', notificationId);
    if (result.error) {
      toast('Failed to delete notification.', true);
      return;
    }
    await loadMemberData(state.selectedMember.id);
    await renderContent();
    toast('Notification deleted.');
  }

  // Gallery Management
  function openGalleryForm(galleryItem = null) {
    openDialog(galleryItem ? 'Edit Gallery Item' : 'Upload Image', `
      <form class="form" data-gallery-form>
        <label class="full">
          <span>Title</span>
          <input class="field" name="title" value="${escape(galleryItem?.title || '')}">
        </label>
        <label class="full">
          <span>Description</span>
          <textarea class="field" name="description">${escape(galleryItem?.description || '')}</textarea>
        </label>
        ${!galleryItem ? `<label class="full">
          <span>Image *</span>
          <input class="field" name="image" type="file" accept="image/*" required>
        </label>` : ''}
        <p data-form-message></p>
        <div class="actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Save</button>
        </div>
      </form>
    `);

    const form = dialogBody.querySelector('[data-gallery-form]');
    form.querySelector('[data-cancel]').onclick = closeDialog;
    form.onsubmit = (e) => saveGallery(e, galleryItem);
  }

  async function saveGallery(e, existingGallery) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = form.querySelector('[data-form-message]');
    const data = new FormData(form);

    const payload = {
      family_member_id: state.selectedMember.id,
      title: data.get('title') || null,
      description: data.get('description') || null
    };

    try {
      const file = data.get('image');
      
      if (file?.name) {
        const path = `gallery/${state.selectedMember.id}/${makeUuid()}-${file.name}`;
        const upload = await client.storage.from(bucket).upload(path, file);
        if (upload.error) throw upload.error;
        payload.file_path = path;
      } else if (existingGallery?.file_path) {
        payload.file_path = existingGallery.file_path;
      }

      const result = existingGallery 
        ? await client.from('family_gallery').update(payload).eq('id', existingGallery.id)
        : await client.from('family_gallery').insert(payload);

      if (result.error) throw result.error;

      closeDialog();
      await loadMemberData(state.selectedMember.id);
      await renderContent();
      toast(existingGallery ? 'Gallery item updated.' : 'Image uploaded.');
    } catch (error) {
      message.textContent = errorText(error);
      message.className = 'error';
    }
  }

  async function deleteGallery(galleryId) {
    if (!confirm('Delete this gallery item?')) return;
    const item = state.gallery.find(g => g.id === galleryId);
    const result = await client.from('family_gallery').delete().eq('id', galleryId);
    if (result.error) {
      toast('Failed to delete gallery item.', true);
      return;
    }
    if (item?.file_path) {
      await client.storage.from(bucket).remove([item.file_path]);
    }
    await loadMemberData(state.selectedMember.id);
    await renderContent();
    toast('Gallery item deleted.');
  }

  // Document Management
  function openDocumentForm(document = null) {
    const types = ['Citizenship','Passport','Birth Certificate','Marriage Certificate','Education Certificate','Driving License','National ID','Medical Document','Insurance Document','Property Document','Bank Document','Other'];
    const typeOptions = types.map(type => 
      `<option value="${type}"${document?.document_type === type ? ' selected' : ''}>${type}</option>`
    ).join('');

    openDialog(document ? 'Edit Document' : 'Upload Document', `
      <form class="form" data-document-form>
        <label>
          <span>Document Type *</span>
          <select class="field" name="document_type" required>${typeOptions}</select>
        </label>
        <label>
          <span>Document Title *</span>
          <input class="field" name="document_title" value="${escape(document?.document_title || '')}" required>
        </label>
        <label>
          <span>Document Number</span>
          <input class="field" name="document_number" value="${escape(document?.document_number || '')}">
        </label>
        <label>
          <span>Issue Date</span>
          <input class="field" name="issue_date" type="date" value="${document?.issue_date || ''}">
        </label>
        <label>
          <span>Expiry Date</span>
          <input class="field" name="expiry_date" type="date" value="${document?.expiry_date || ''}">
        </label>
        ${!document ? `<label class="full">
          <span>File *</span>
          <input class="field" name="file" type="file" accept="image/*,application/pdf" required>
        </label>` : ''}
        <label class="full">
          <span>Notes</span>
          <textarea class="field" name="notes">${escape(document?.notes || '')}</textarea>
        </label>
        <p data-form-message></p>
        <div class="actions full">
          <button type="button" class="button" data-cancel>Cancel</button>
          <button type="submit" class="button primary">Save Document</button>
        </div>
      </form>
    `);

    const form = dialogBody.querySelector('[data-document-form]');
    form.querySelector('[data-cancel]').onclick = closeDialog;
    form.onsubmit = (e) => saveDocument(e, document);
  }

  async function saveDocument(e, existingDocument) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = form.querySelector('[data-form-message]');
    const data = new FormData(form);

    const payload = {
      family_member_id: state.selectedMember.id,
      document_type: data.get('document_type'),
      document_title: data.get('document_title'),
      document_number: data.get('document_number') || null,
      issue_date: data.get('issue_date') || null,
      expiry_date: data.get('expiry_date') || null,
      notes: data.get('notes') || null
    };

    try {
      const file = data.get('file');
      
      if (file?.name) {
        const path = `documents/${state.selectedMember.id}/${makeUuid()}-${file.name}`;
        const upload = await client.storage.from(bucket).upload(path, file);
        if (upload.error) throw upload.error;
        payload.file_path = path;
        payload.mime_type = file.type;
        payload.file_size = file.size;
        payload.uploaded_by = state.user.id;
      } else if (existingDocument) {
        payload.file_path = existingDocument.file_path;
        payload.mime_type = existingDocument.mime_type;
        payload.file_size = existingDocument.file_size;
      }

      const result = existingDocument 
        ? await client.from('family_documents').update(payload).eq('id', existingDocument.id)
        : await client.from('family_documents').insert(payload);

      if (result.error) throw result.error;

      closeDialog();
      await loadMemberData(state.selectedMember.id);
      await renderContent();
      toast(existingDocument ? 'Document updated.' : 'Document uploaded.');
    } catch (error) {
      message.textContent = errorText(error);
      message.className = 'error';
    }
  }

  async function viewDocument(documentId) {
    const doc = state.documents.find(d => d.id === documentId);
    if (!doc) return;
    const signed = await client.storage.from(bucket).createSignedUrl(doc.file_path, 300);
    if (signed.error) {
      toast('Failed to load document.', true);
      return;
    }
    window.open(signed.data.signedUrl, '_blank');
  }

  async function deleteDocument(documentId) {
    if (!confirm('Delete this document?')) return;
    const doc = state.documents.find(d => d.id === documentId);
    const result = await client.from('family_documents').delete().eq('id', documentId);
    if (result.error) {
      toast('Failed to delete document.', true);
      return;
    }
    if (doc?.file_path) {
      await client.storage.from(bucket).remove([doc.file_path]);
    }
    await loadMemberData(state.selectedMember.id);
    await renderContent();
    toast('Document deleted.');
  }

  // Event Delegation
  document.addEventListener('click', async (event) => {
    const target = event.target;
    
    if (target.matches('[data-view="family-vault-admin"]')) {
      event.preventDefault();
      show();
      return;
    }

    if (!state.selectedMember) return;

    // Tab switching
    if (target.matches('[data-tab]')) {
      state.activeTab = target.dataset.tab;
      await renderContent();
      return;
    }

    // Events
    if (target.matches('[data-add-event]')) { openEventForm(); return; }
    if (target.matches('[data-edit-event]')) {
      const event = state.events.find(e => e.id === target.dataset.editEvent);
      openEventForm(event);
      return;
    }
    if (target.matches('[data-delete-event]')) { deleteEvent(target.dataset.deleteEvent); return; }

    // Achievements
    if (target.matches('[data-add-achievement]')) { openAchievementForm(); return; }
    if (target.matches('[data-edit-achievement]')) {
      const achievement = state.achievements.find(a => a.id === target.dataset.editAchievement);
      openAchievementForm(achievement);
      return;
    }
    if (target.matches('[data-delete-achievement]')) { deleteAchievement(target.dataset.deleteAchievement); return; }

    // Notifications
    if (target.matches('[data-add-notification]')) { openNotificationForm(); return; }
    if (target.matches('[data-edit-notification]')) {
      const notif = state.notifications.find(n => n.id === target.dataset.editNotification);
      openNotificationForm(notif);
      return;
    }
    if (target.matches('[data-delete-notification]')) { deleteNotification(target.dataset.deleteNotification); return; }

    // Gallery
    if (target.matches('[data-add-gallery]')) { openGalleryForm(); return; }
    if (target.matches('[data-edit-gallery]')) {
      const item = state.gallery.find(g => g.id === target.dataset.editGallery);
      openGalleryForm(item);
      return;
    }
    if (target.matches('[data-delete-gallery]')) { deleteGallery(target.dataset.deleteGallery); return; }

    // Documents
    if (target.matches('[data-add-document]')) { openDocumentForm(); return; }
    if (target.matches('[data-edit-document]')) {
      const doc = state.documents.find(d => d.id === target.dataset.editDocument);
      openDocumentForm(doc);
      return;
    }
    if (target.matches('[data-view-document]')) { viewDocument(target.dataset.viewDocument); return; }
    if (target.matches('[data-delete-document]')) { deleteDocument(target.dataset.deleteDocument); return; }
  }, true);

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      state.selectedMember = null;
      state.members = [];
      if (state.view) {
        state.view.innerHTML = '';
        state.view.hidden = true;
      }
    }
  });

  addNav();
  if (location.hash === '#family-vault-admin') show();
}());
