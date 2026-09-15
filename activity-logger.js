/**
 * Activity Logger - Family Member Portal
 * Comprehensive activity logging for member actions
 * IMPORTANT: Never logs passwords or sensitive secrets
 */

(function(global) {
  'use strict';

  /**
   * Activity Types Enum
   */
  const ActivityType = {
    // Authentication
    LOGIN_SUCCESS: 'login_success',
    LOGIN_FAILED: 'login_failed',
    LOGOUT: 'logout',
    SESSION_EXPIRED: 'session_expired',
    
    // Profile
    PROFILE_VIEWED: 'profile_viewed',
    PROFILE_UPDATED: 'profile_updated',
    PROFILE_PHOTO_UPLOADED: 'profile_photo_uploaded',
    PROFILE_PHOTO_CHANGED: 'profile_photo_changed',
    PROFILE_PHOTO_DELETED: 'profile_photo_deleted',
    
    // Password & Security
    PASSWORD_CHANGED: 'password_changed',
    PASSWORD_RESET_REQUESTED: 'password_reset_requested',
    
    // Family Tree
    FAMILY_TREE_VIEWED: 'family_tree_viewed',
    FAMILY_MEMBER_VIEWED: 'family_member_viewed',
    
    // Gallery
    GALLERY_VIEWED: 'gallery_viewed',
    PHOTO_VIEWED: 'photo_viewed',
    GALLERY_UPLOADED: 'gallery_uploaded',
    GALLERY_DELETED: 'gallery_deleted',
    
    // Documents
    DOCUMENT_VIEWED: 'document_viewed',
    DOCUMENT_DOWNLOADED: 'document_downloaded',
    DOCUMENT_UPLOADED: 'document_uploaded',
    DOCUMENT_DELETED: 'document_deleted',
    
    // Events
    EVENT_VIEWED: 'event_viewed',
    
    // Achievements
    ACHIEVEMENT_VIEWED: 'achievement_viewed',
    
    // Notifications
    NOTIFICATION_VIEWED: 'notification_viewed',
    NOTIFICATION_READ: 'notification_read',
    
    // Settings
    SETTINGS_VIEWED: 'settings_viewed',
    SETTINGS_UPDATED: 'settings_updated',
    
    // Account
    ACCOUNT_VIEWED: 'account_viewed',
    ACCOUNT_DEACTIVATION_REQUESTED: 'account_deactivation_requested',
    ACCOUNT_DELETION_REQUESTED: 'account_deletion_requested'
  };

  /**
   * Get device information (non-sensitive)
   */
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let device = 'Desktop';
    let browser = 'Unknown';
    
    // Detect device
    if (/Mobile|Android|iPhone|iPad|iPod/.test(ua)) {
      device = 'Mobile';
    } else if (/Tablet|iPad/.test(ua)) {
      device = 'Tablet';
    }
    
    // Detect browser
    if (ua.indexOf('Firefox') > -1) {
      browser = 'Firefox';
    } else if (ua.indexOf('Chrome') > -1) {
      browser = 'Chrome';
    } else if (ua.indexOf('Safari') > -1) {
      browser = 'Safari';
    } else if (ua.indexOf('Edge') > -1) {
      browser = 'Edge';
    }
    
    return `${browser} on ${device}`;
  }

  /**
   * Log member activity
   * @param {Object} supabaseClient - Supabase client instance
   * @param {Object} options - Activity options
   * @param {string} options.familyMemberId - UUID of family member
   * @param {string} options.actionType - Type of action (use ActivityType enum)
   * @param {string} [options.actionDescription] - Human-readable description
   * @param {string} [options.targetType] - Type of target (profile, document, gallery, etc.)
   * @param {string} [options.targetId] - UUID of target
   * @param {Object} [options.metadata] - Additional non-sensitive metadata
   * @param {string} [options.status] - success, failed, warning
   * @returns {Promise<Object>} Activity log result
   */
  async function logActivity(supabaseClient, options) {
    if (!supabaseClient) {
      console.warn('Activity Logger: Supabase client not provided');
      return { success: false, error: 'No client' };
    }

    const {
      familyMemberId,
      actionType,
      actionDescription = null,
      targetType = null,
      targetId = null,
      metadata = null,
      status = 'success'
    } = options;

    // Validation
    if (!familyMemberId) {
      console.warn('Activity Logger: familyMemberId is required');
      return { success: false, error: 'Missing familyMemberId' };
    }

    if (!actionType) {
      console.warn('Activity Logger: actionType is required');
      return { success: false, error: 'Missing actionType' };
    }

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.warn('Activity Logger: User not authenticated', userError);
      return { success: false, error: 'Not authenticated' };
    }

    // Prepare activity data
    const activityData = {
      family_member_id: familyMemberId,
      actor_user_id: user.id,
      action_type: actionType,
      action_description: actionDescription,
      target_type: targetType,
      target_id: targetId,
      metadata: metadata,
      status: status,
      device_info: getDeviceInfo(),
      ip_address: null // Don't collect IP from frontend for privacy
    };

    try {
      // Insert activity log
      const { data, error } = await supabaseClient
        .from('member_activity_log')
        .insert(activityData)
        .select()
        .single();

      if (error) {
        console.error('Activity Logger: Failed to log activity', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Activity Logger: Exception', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log login success
   */
  async function logLogin(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.LOGIN_SUCCESS,
      actionDescription: 'Logged in successfully',
      status: 'success'
    });
  }

  /**
   * Log logout
   */
  async function logLogout(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.LOGOUT,
      actionDescription: 'Logged out',
      status: 'success'
    });
  }

  /**
   * Log profile update
   * @param {Object} changes - Object with changed fields (never include password!)
   */
  async function logProfileUpdate(supabaseClient, familyMemberId, changes) {
    const changedFields = Object.keys(changes || {});
    const description = changedFields.length > 0 
      ? `Updated: ${changedFields.join(', ')}`
      : 'Profile updated';

    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.PROFILE_UPDATED,
      actionDescription: description,
      targetType: 'profile',
      targetId: familyMemberId,
      metadata: { changed_fields: changedFields },
      status: 'success'
    });
  }

  /**
   * Log profile photo upload
   */
  async function logPhotoUpload(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.PROFILE_PHOTO_UPLOADED,
      actionDescription: 'Uploaded profile photo',
      targetType: 'profile',
      targetId: familyMemberId,
      status: 'success'
    });
  }

  /**
   * Log profile photo change
   */
  async function logPhotoChange(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.PROFILE_PHOTO_CHANGED,
      actionDescription: 'Changed profile photo',
      targetType: 'profile',
      targetId: familyMemberId,
      status: 'success'
    });
  }

  /**
   * Log profile photo delete
   */
  async function logPhotoDelete(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.PROFILE_PHOTO_DELETED,
      actionDescription: 'Deleted profile photo',
      targetType: 'profile',
      targetId: familyMemberId,
      status: 'success'
    });
  }

  /**
   * Log password change
   * IMPORTANT: NEVER log the actual password!
   */
  async function logPasswordChange(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.PASSWORD_CHANGED,
      actionDescription: 'Password changed',
      targetType: 'account',
      targetId: familyMemberId,
      status: 'success'
    });
  }

  /**
   * Log document view
   */
  async function logDocumentView(supabaseClient, familyMemberId, documentId, documentName) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.DOCUMENT_VIEWED,
      actionDescription: `Viewed document: ${documentName || 'Unknown'}`,
      targetType: 'document',
      targetId: documentId,
      status: 'success'
    });
  }

  /**
   * Log document download
   */
  async function logDocumentDownload(supabaseClient, familyMemberId, documentId, documentName) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.DOCUMENT_DOWNLOADED,
      actionDescription: `Downloaded document: ${documentName || 'Unknown'}`,
      targetType: 'document',
      targetId: documentId,
      status: 'success'
    });
  }

  /**
   * Log gallery view
   */
  async function logGalleryView(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.GALLERY_VIEWED,
      actionDescription: 'Viewed family gallery',
      targetType: 'gallery',
      status: 'success'
    });
  }

  /**
   * Log photo view
   */
  async function logPhotoView(supabaseClient, familyMemberId, photoId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.PHOTO_VIEWED,
      actionDescription: 'Viewed photo',
      targetType: 'gallery',
      targetId: photoId,
      status: 'success'
    });
  }

  /**
   * Log family tree view
   */
  async function logFamilyTreeView(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.FAMILY_TREE_VIEWED,
      actionDescription: 'Viewed family tree',
      targetType: 'family_tree',
      status: 'success'
    });
  }

  /**
   * Log settings update
   */
  async function logSettingsUpdate(supabaseClient, familyMemberId, settingType) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.SETTINGS_UPDATED,
      actionDescription: `Updated settings: ${settingType || 'general'}`,
      targetType: 'settings',
      status: 'success'
    });
  }

  /**
   * Log account deletion request
   */
  async function logDeletionRequest(supabaseClient, familyMemberId) {
    return await logActivity(supabaseClient, {
      familyMemberId,
      actionType: ActivityType.ACCOUNT_DELETION_REQUESTED,
      actionDescription: 'Requested account deletion',
      targetType: 'account',
      targetId: familyMemberId,
      status: 'success',
      metadata: { severity: 'important' }
    });
  }

  // Export API
  const ActivityLogger = {
    ActivityType,
    logActivity,
    logLogin,
    logLogout,
    logProfileUpdate,
    logPhotoUpload,
    logPhotoChange,
    logPhotoDelete,
    logPasswordChange,
    logDocumentView,
    logDocumentDownload,
    logGalleryView,
    logPhotoView,
    logFamilyTreeView,
    logSettingsUpdate,
    logDeletionRequest
  };

  // Expose to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActivityLogger;
  }
  global.ActivityLogger = ActivityLogger;

})(typeof globalThis !== 'undefined' ? globalThis : this);
