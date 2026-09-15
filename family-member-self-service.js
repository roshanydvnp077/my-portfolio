// Family Member Self-Service Portal Enhancement
// This extends the existing family-member.js with full CRUD capabilities

(function() {
  'use strict';

  const client = window.supabaseClient;
  if (!client) {
    console.error('Supabase client not initialized');
    return;
  }

  // State management
  const selfServiceState = {
    currentMember: null,
    currentUserId: null,
    uploading: false
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  
  const toast = (message, type = 'info') => {
    const toastDiv = document.createElement('div');
    toastDiv.className = `toast toast-${type}`;
    toastDiv.textContent = message;
    toastDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 14px 20px;
      background: ${type === 'error' ? 'rgba(255, 127, 157, 0.95)' : 'rgba(122, 224, 175, 0.95)'};
      color: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toastDiv);
    setTimeout(() => {
      toastDiv.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toastDiv.remove(), 300);
    }, 3000);
  };

  const makeUuid = () => {
    const cryptoApi = window.crypto || globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  };

  // ============================================
  // ACTIVITY LOGGING
  // ============================================

  async function logActivity(actionType, description, targetType, targetId, metadata = {}) {
    if (!selfServiceState.currentMember || !selfServiceState.currentUserId) return;

    try {
      await client.rpc('log_member_activity', {
        p_family_member_id: selfServiceState.currentMember.id,
        p_action_type: actionType,
        p_action_description: description || null,
        p_target_type: targetType || null,
        p_target_id: targetId || null,
        p_metadata: Object.keys(metadata).length > 0 ? metadata : null
      });
    } catch (error) {
      console.warn('Activity logging failed:', error);
      // Don't fail the main operation if logging fails
    }
  }

  // ============================================
  // INITIALIZE MEMBER SESSION
  // ============================================

  async function initializeSelfService() {
    try {
      const session = await client.auth.getSession();
      const user = session.data?.session?.user;
      
      if (!user) {
        console.error('No authenticated user');
        return false;
      }

      selfServiceState.currentUserId = user.id;

      // Find linked family member using ONLY auth_user_id
      const { data: member, error } = await client
        .from('family_members')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (error || !member) {
        console.error('Member not found for user:', user.id);
        return false;
      }

      selfServiceState.currentMember = member;
      return true;
    } catch (error) {
      console.error('Self-service initialization failed:', error);
      return false;
    }
  }

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  function createProfileEditForm() {
    const member = selfServiceState.currentMember;
    if (!member) return;

    const html = `
      <form id="profileEditForm" class="member-modal-grid">
        <label class="full">
          <span>Full Name *</span>
          <input type="text" name="full_name" value="${escape(member.full_name || '')}" required>
        </label>
        <label>
          <span>Nickname</span>
          <input type="text" name="nickname" value="${escape(member.nickname || '')}">
        </label>
        <label>
          <span>Gender</span>
          <select name="gender">
            <option value="">Not specified</option>
            <option value="Male" ${member.gender === 'Male' ? 'selected' : ''}>Male</option>
            <option value="Female" ${member.gender === 'Female' ? 'selected' : ''}>Female</option>
            <option value="Other" ${member.gender === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </label>
        <label>
          <span>Date of Birth</span>
          <input type="date" name="date_of_birth" value="${escape(member.date_of_birth || '')}">
        </label>
        <label>
          <span>Phone</span>
          <input type="tel" name="phone" value="${escape(member.phone || '')}">
        </label>
        <label>
          <span>Occupation</span>
          <input type="text" name="occupation" value="${escape(member.occupation || '')}">
        </label>
        <label class="full">
          <span>Address</span>
          <textarea name="address" rows="3">${escape(member.address || '')}</textarea>
        </label>
        <label class="full">
          <span>Bio</span>
          <textarea name="bio" rows="4">${escape(member.bio || '')}</textarea>
        </label>
        <div class="member-modal-actions full">
          <button type="button" class="button" onclick="document.getElementById('profileEditModal').classList.remove('open')">Cancel</button>
          <button type="submit" class="button primary">Save Changes</button>
        </div>
      </form>
    `;

    return html;
  }

  async function saveProfileChanges(formData) {
    if (!selfServiceState.currentMember) return;

    const updates = {
      full_name: formData.get('full_name'),
      nickname: formData.get('nickname') || null,
      gender: formData.get('gender') || null,
      date_of_birth: formData.get('date_of_birth') || null,
      phone: formData.get('phone') || null,
      occupation: formData.get('occupation') || null,
      address: formData.get('address') || null,
      bio: formData.get('bio') || null,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await client
        .from('family_members')
        .update(updates)
        .eq('auth_user_id', selfServiceState.currentUserId);

      if (error) throw error;

      // Log activity
      await logActivity('profile_updated', 'Updated profile information', 'profile', selfServiceState.currentMember.id);

      toast('Profile updated successfully!', 'success');
      
      // Refresh member data
      const { data: updated } = await client
        .from('family_members')
        .select('*')
        .eq('auth_user_id', selfServiceState.currentUserId)
        .single();
      
      if (updated) {
        selfServiceState.currentMember = updated;
      }

      return true;
    } catch (error) {
      console.error('Profile update failed:', error);
      toast('Failed to update profile: ' + error.message, 'error');
      return false;
    }
  }

  // ============================================
  // PROFILE PHOTO MANAGEMENT
  // ============================================

  async function uploadProfilePhoto(file) {
    if (!selfServiceState.currentMember || !file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast('Please upload a valid image file (JPG, PNG, WEBP, or GIF)', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast('Image must be less than 10MB', 'error');
      return;
    }

    selfServiceState.uploading = true;

    try {
      const memberId = selfServiceState.currentMember.id;
      const fileExt = file.name.split('.').pop();
      const fileName = `${memberId}/profile/${makeUuid()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await client.storage
        .from('family-vault')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update database
      const { error: updateError } = await client
        .from('family_members')
        .update({ 
          profile_photo_path: fileName,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', selfServiceState.currentUserId);

      if (updateError) throw updateError;

      // Delete old photo if exists
      if (selfServiceState.currentMember.profile_photo_path) {
        await client.storage
          .from('family-vault')
          .remove([selfServiceState.currentMember.profile_photo_path]);
      }

      // Log activity
      await logActivity('profile_photo_changed', 'Updated profile photo', 'profile_photo', memberId);

      toast('Profile photo updated successfully!', 'success');
      
      // Update state
      selfServiceState.currentMember.profile_photo_path = fileName;
      
      return true;
    } catch (error) {
      console.error('Photo upload failed:', error);
      toast('Failed to upload photo: ' + error.message, 'error');
      return false;
    } finally {
      selfServiceState.uploading = false;
    }
  }

  async function deleteProfilePhoto() {
    if (!selfServiceState.currentMember || !selfServiceState.currentMember.profile_photo_path) return;

    if (!confirm('Are you sure you want to remove your profile photo?')) return;

    try {
      const oldPath = selfServiceState.currentMember.profile_photo_path;

      // Update database
      const { error: updateError } = await client
        .from('family_members')
        .update({ 
          profile_photo_path: null,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', selfServiceState.currentUserId);

      if (updateError) throw updateError;

      // Delete from storage
      await client.storage
        .from('family-vault')
        .remove([oldPath]);

      // Log activity
      await logActivity('profile_photo_removed', 'Removed profile photo', 'profile_photo', selfServiceState.currentMember.id);

      toast('Profile photo removed successfully!', 'success');
      
      selfServiceState.currentMember.profile_photo_path = null;
      
      return true;
    } catch (error) {
      console.error('Photo deletion failed:', error);
      toast('Failed to remove photo: ' + error.message, 'error');
      return false;
    }
  }

  // ============================================
  // EVENT MANAGEMENT
  // ============================================

  async function createEvent(eventData) {
    if (!selfServiceState.currentMember) return;

    try {
      const { data, error } = await client
        .from('family_events')
        .insert({
          family_member_id: selfServiceState.currentMember.id,
          ...eventData
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity('event_created', `Created event: ${eventData.title}`, 'event', data.id, { title: eventData.title });

      toast('Event added successfully!', 'success');
      return data;
    } catch (error) {
      console.error('Event creation failed:', error);
      toast('Failed to create event: ' + error.message, 'error');
      return null;
    }
  }

  async function updateEvent(eventId, eventData) {
    if (!selfServiceState.currentMember) return;

    try {
      const { error } = await client
        .from('family_events')
        .update(eventData)
        .eq('id', eventId)
        .eq('family_member_id', selfServiceState.currentMember.id); // Ensure ownership

      if (error) throw error;

      await logActivity('event_updated', `Updated event: ${eventData.title || 'event'}`, 'event', eventId);

      toast('Event updated successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Event update failed:', error);
      toast('Failed to update event: ' + error.message, 'error');
      return false;
    }
  }

  async function deleteEvent(eventId, eventTitle) {
    if (!selfServiceState.currentMember) return;

    if (!confirm('Are you sure you want to delete this event?')) return false;

    try {
      const { error } = await client
        .from('family_events')
        .delete()
        .eq('id', eventId)
        .eq('family_member_id', selfServiceState.currentMember.id); // Ensure ownership

      if (error) throw error;

      await logActivity('event_deleted', `Deleted event: ${eventTitle || 'event'}`, 'event', eventId);

      toast('Event deleted successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Event deletion failed:', error);
      toast('Failed to delete event: ' + error.message, 'error');
      return false;
    }
  }

  // ============================================
  // ACHIEVEMENT MANAGEMENT
  // ============================================

  async function createAchievement(achievementData, imageFile, certFile) {
    if (!selfServiceState.currentMember) return;

    try {
      const memberId = selfServiceState.currentMember.id;
      let imagePath = null;

      // Upload image if provided
      if (imageFile) {
        const imageExt = imageFile.name.split('.').pop();
        imagePath = `${memberId}/achievements/${makeUuid()}.${imageExt}`;
        const { error: imgError } = await client.storage
          .from('family-vault')
          .upload(imagePath, imageFile);
        if (imgError) throw imgError;
      }

      // Note: Certificate upload removed - certificate_path column doesn't exist in table

      const { data, error } = await client
        .from('achievements')
        .insert({
          family_member_id: memberId,
          ...achievementData,
          image_path: imagePath
          // Note: certificate_path column doesn't exist in table
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity('achievement_created', `Created achievement: ${achievementData.title}`, 'achievement', data.id);

      toast('Achievement added successfully!', 'success');
      return data;
    } catch (error) {
      console.error('Achievement creation failed:', error);
      toast('Failed to create achievement: ' + error.message, 'error');
      return null;
    }
  }

  async function updateAchievement(achievementId, achievementData) {
    if (!selfServiceState.currentMember) return;

    try {
      const { error } = await client
        .from('achievements')
        .update(achievementData)
        .eq('id', achievementId)
        .eq('family_member_id', selfServiceState.currentMember.id);

      if (error) throw error;

      await logActivity('achievement_updated', `Updated achievement: ${achievementData.title || 'achievement'}`, 'achievement', achievementId);

      toast('Achievement updated successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Achievement update failed:', error);
      toast('Failed to update achievement: ' + error.message, 'error');
      return false;
    }
  }

  async function deleteAchievement(achievementId, achievementTitle) {
    if (!selfServiceState.currentMember) return;

    if (!confirm('Are you sure you want to delete this achievement?')) return false;

    try {
      // Get achievement to delete files
      const { data: achievement } = await client
        .from('achievements')
        .select('image_path, certificate_path')
        .eq('id', achievementId)
        .eq('family_member_id', selfServiceState.currentMember.id)
        .single();

      const { error } = await client
        .from('achievements')
        .delete()
        .eq('id', achievementId)
        .eq('family_member_id', selfServiceState.currentMember.id);

      if (error) throw error;

      // Delete files from storage
      if (achievement) {
        const filesToDelete = [achievement.image_path].filter(Boolean);
        if (filesToDelete.length > 0) {
          await client.storage.from('family-vault').remove(filesToDelete);
        }
      }

      await logActivity('achievement_deleted', `Deleted achievement: ${achievementTitle || 'achievement'}`, 'achievement', achievementId);

      toast('Achievement deleted successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Achievement deletion failed:', error);
      toast('Failed to delete achievement: ' + error.message, 'error');
      return false;
    }
  }

  // ============================================
  // GALLERY MANAGEMENT
  // ============================================

  async function uploadGalleryPhoto(file, title, description, category, photoDate) {
    if (!selfServiceState.currentMember || !file) return;

    try {
      const memberId = selfServiceState.currentMember.id;
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast('Please select a valid image (JPG, PNG, or WEBP)', 'error');
        return null;
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast('File size must be less than 10MB', 'error');
        return null;
      }
      
      // DEBUG: Log what we're trying to insert
      console.log('🔍 Upload Debug Info:');
      console.log('  Member ID:', memberId);
      console.log('  Current Member:', selfServiceState.currentMember);
      console.log('  File:', file.name, file.type, file.size);
      console.log('  Category:', category);
      console.log('  Photo Date:', photoDate);
      
      // Get current auth user to verify
      const { data: { user } } = await client.auth.getUser();
      console.log('  Supabase Auth User:', user);
      console.log('  Auth UID:', user?.id);
      if (!user?.id) throw new Error('Your Supabase session has expired. Please sign in again.');
      
      const fileExt = file.name.split('.').pop().toLowerCase();
      const timestamp = Date.now();
      const fileName = `${timestamp}-${makeUuid()}.${fileExt}`;
      const filePath = `${memberId}/gallery/${fileName}`;

      console.log('📤 Uploading to storage:', filePath);

      const { error: uploadError } = await client.storage
        .from('family-vault')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Storage upload successful');
      console.log('📤 Attempting database INSERT with family_member_id:', memberId);

      // Prepare database record
      const galleryData = {
        family_member_id: memberId,
        title: title || null,
        description: description || null,
        file_path: filePath,
        category: category || 'Family',
        photo_date: photoDate || null,
        is_public: true,
        visibility: 'private',  // By default private - only owner can see
        created_by: user.id,
        is_private: true
      };

      console.log('📊 Gallery data:', galleryData);

      const { data, error } = await client
        .from('family_gallery')
        .insert(galleryData)
        .select()
        .single();

      if (error) {
        console.error('❌ Database INSERT Error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // Rollback: Delete uploaded file
        console.log('🔄 Rolling back storage upload...');
        await client.storage
          .from('family-vault')
          .remove([filePath]);

        throw error;
      }

      console.log('✅ Database insert successful:', data);

      await logActivity('gallery_uploaded', `Uploaded photo: ${title || 'untitled'}`, 'gallery', data.id);

      toast('Photo uploaded successfully!', 'success');
      return data;
    } catch (error) {
      console.error('Gallery upload failed:', error);
      toast('Failed to upload photo: ' + error.message, 'error');
      return null;
    }
  }

  async function deleteGalleryPhoto(photoId, photoTitle) {
    if (!selfServiceState.currentMember) return;

    if (!confirm('Are you sure you want to delete this photo?')) return false;

    try {
      const { data: photo } = await client
        .from('family_gallery')
        .select('file_path')
        .eq('id', photoId)
        .eq('family_member_id', selfServiceState.currentMember.id)
        .single();

      const { error } = await client
        .from('family_gallery')
        .delete()
        .eq('id', photoId)
        .eq('family_member_id', selfServiceState.currentMember.id);

      if (error) throw error;

      if (photo?.file_path) {
        await client.storage.from('family-vault').remove([photo.file_path]);
      }

      await logActivity('gallery_deleted', `Deleted photo: ${photoTitle || 'photo'}`, 'gallery', photoId);

      toast('Photo deleted successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Gallery deletion failed:', error);
      toast('Failed to delete photo: ' + error.message, 'error');
      return false;
    }
  }

  // ============================================
  // DOCUMENT MANAGEMENT
  // ============================================

  async function uploadDocument(file, documentData) {
    if (!selfServiceState.currentMember || !file) return;

    try {
      const memberId = selfServiceState.currentMember.id;
      const fileExt = file.name.split('.').pop();
      const filePath = `${memberId}/documents/${makeUuid()}.${fileExt}`;

      const { error: uploadError } = await client.storage
        .from('family-vault')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data, error } = await client
        .from('family_documents')
        .insert({
          family_member_id: memberId,
          ...documentData,
          file_path: filePath,
          mime_type: file.type,
          file_size: file.size,
          uploaded_by: selfServiceState.currentUserId
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity('document_uploaded', `Uploaded document: ${documentData.document_title}`, 'document', data.id);

      toast('Document uploaded successfully!', 'success');
      return data;
    } catch (error) {
      console.error('Document upload failed:', error);
      toast('Failed to upload document: ' + error.message, 'error');
      return null;
    }
  }

  async function deleteDocument(documentId, documentTitle) {
    if (!selfServiceState.currentMember) return;

    if (!confirm('Are you sure you want to delete this document?')) return false;

    try {
      const { data: doc } = await client
        .from('family_documents')
        .select('file_path')
        .eq('id', documentId)
        .eq('family_member_id', selfServiceState.currentMember.id)
        .single();

      const { error } = await client
        .from('family_documents')
        .delete()
        .eq('id', documentId)
        .eq('family_member_id', selfServiceState.currentMember.id);

      if (error) throw error;

      if (doc?.file_path) {
        await client.storage.from('family-vault').remove([doc.file_path]);
      }

      await logActivity('document_deleted', `Deleted document: ${documentTitle || 'document'}`, 'document', documentId);

      toast('Document deleted successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Document deletion failed:', error);
      toast('Failed to delete document: ' + error.message, 'error');
      return false;
    }
  }

  // ============================================
  // NOTIFICATION MANAGEMENT
  // ============================================

  async function markNotificationAsRead(notificationId) {
    if (!selfServiceState.currentMember) return;

    try {
      const { error } = await client
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('family_member_id', selfServiceState.currentMember.id);

      if (error) throw error;

      await logActivity('notification_read', 'Marked notification as read', 'notification', notificationId);

      return true;
    } catch (error) {
      console.error('Notification update failed:', error);
      return false;
    }
  }

  // ============================================
  // PASSWORD CHANGE
  // ============================================

  async function changePassword(currentPassword, newPassword) {
    try {
      // Verify current password by attempting sign-in
      const { error: verifyError } = await client.auth.signInWithPassword({
        email: selfServiceState.currentMember.email,
        password: currentPassword
      });

      if (verifyError) {
        toast('Current password is incorrect', 'error');
        return false;
      }

      // Update password
      const { error: updateError } = await client.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      await logActivity('password_changed', 'Changed account password', 'security', selfServiceState.currentMember.id);

      toast('Password changed successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Password change failed:', error);
      toast('Failed to change password: ' + error.message, 'error');
      return false;
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

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
          console.warn('[SelfService] Public URL lookup failed for bucket', bucket, error);
        }
      }
    }

    if (client && client.supabaseUrl) {
      return `${client.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucketCandidates[0]}/${encodeURIComponent(normalized)}`;
    }

    return normalized;
  }

  // ============================================
  // EXPORT API
  // ============================================

  window.FamilyMemberSelfService = {
    initialize: initializeSelfService,
    getState: () => selfServiceState,
    
    // Utilities
    getPhotoUrl,
    
    // Profile
    saveProfile: saveProfileChanges,
    uploadPhoto: uploadProfilePhoto,
    deletePhoto: deleteProfilePhoto,
    
    // Events
    createEvent,
    updateEvent,
    deleteEvent,
    
    // Achievements
    createAchievement,
    updateAchievement,
    deleteAchievement,
    
    // Gallery
    uploadGalleryPhoto,
    deleteGalleryPhoto,
    
    // Documents
    uploadDocument,
    deleteDocument,
    
    // Notifications
    markNotificationAsRead,
    
    // Security
    changePassword,
    
    // Utility
    toast,
    logActivity
  };

  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', async () => {
    const initialized = await initializeSelfService();
    if (!initialized) {
      console.warn('Self-service could not initialize');
    } else {
      console.log('Self-service initialized for member:', selfServiceState.currentMember?.full_name);
    }
  });

})();
