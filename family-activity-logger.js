/**
 * Family Activity Logger Utility
 * Centralized activity logging for Family Member Portal
 * 
 * SECURITY RULES:
 * - NEVER log passwords or sensitive credentials
 * - NEVER log access tokens or secret keys
 * - Only log actions that actually occur
 * - Actor is always derived from auth.uid() server-side
 */

(function (global) {
  'use strict';

  /**
   * Activity Action Types (must match database constraint)
   */
  const ACTION_TYPES = {
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
    GALLERY_UPDATED: 'gallery_updated',
    GALLERY_DELETED: 'gallery_deleted',
    
    // Documents
    DOCUMENT_VIEWED: 'document_viewed',
    DOCUMENT_DOWNLOADED: 'document_downloaded',
    DOCUMENT_UPLOADED: 'document_uploaded',
    DOCUMENT_UPDATED: 'document_updated',
    DOCUMENT_DELETED: 'document_deleted',
    
    // Events
    EVENT_VIEWED: 'event_viewed',
    EVENT_CREATED: 'event_created',
    EVENT_UPDATED: 'event_updated',
    EVENT_DELETED: 'event_deleted',
    
    // Achievements
    ACHIEVEMENT_VIEWED: 'achievement_viewed',
    ACHIEVEMENT_CREATED: 'achievement_created',
    ACHIEVEMENT_UPDATED: 'achievement_updated',
    ACHIEVEMENT_DELETED: 'achievement_deleted',
    
    // Notifications
    NOTIFICATION_VIEWED: 'notification_viewed',
    NOTIFICATION_READ: 'notification_read',
    NOTIFICATION_DELETED: 'notification_deleted',
    
    // Settings
    SETTINGS_VIEWED: 'settings_viewed',
    SETTINGS_UPDATED: 'settings_updated',
    
    // Account
    ACCOUNT_VIEWED: 'account_viewed',
    ACCOUNT_DEACTIVATION_REQUESTED: 'account_deactivation_requested',
    ACCOUNT_DELETION_REQUESTED: 'account_deletion_requested',
    
    // Admin Actions
    MEMBER_CREATED: 'member_created',
    MEMBER_UPDATED: 'member_updated',
    MEMBER_DELETED: 'member_deleted',
    MEMBER_ENABLED: 'member_enabled',
    MEMBER_DISABLED: 'member_disabled',
    MEMBER_AUTH_CREATED: 'member_auth_created',
    MEMBER_AUTH_DISABLED: 'member_auth_disabled',
    MEMBER_AUTH_ENABLED: 'member_auth_enabled',
  };

  /**
   * Get device info (non-sensitive)
   */
  function getDeviceInfo() {
    try {
      const ua = navigator.userAgent;
      let deviceType = 'Desktop';
      
      if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
        deviceType = 'Mobile';
      } else if (/Tablet|iPad/i.test(ua)) {
        deviceType = 'Tablet';
      }
      
      let browser = 'Unknown';
      if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
      else if (ua.indexOf('Safari') > -1) browser = 'Safari';
      else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
      else if (ua.indexOf('Edge') > -1) browser = 'Edge';
      
      return `${deviceType} - ${browser}`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Main logging function using database function
   * This uses the secure log_member_activity() database function
   * which verifies auth.uid() server-side
   */
  async function logActivity(client, options) {
    if (!client) {
      console.warn('Supabase client not provided to logActivity');
      return { success: false, error: 'No client' };
    }

    const {
      familyMemberId,
      actionType,
      actionDescription = null,
      targetType = null,
      targetId = null,
      metadata = null,
      status = 'success',
    } = options;

    // Validate required fields
    if (!familyMemberId) {
      console.error('familyMemberId is required for logging activity');
      return { success: false, error: 'Missing familyMemberId' };
    }

    if (!actionType) {
      console.error('actionType is required for logging activity');
      return { success: false, error: 'Missing actionType' };
    }

    // Validate actionType is in allowed list
    const validActionTypes = Object.values(ACTION_TYPES);
    if (!validActionTypes.includes(actionType)) {
      console.error(`Invalid actionType: ${actionType}`);
      return { success: false, error: 'Invalid actionType' };
    }

    try {
      const deviceInfo = getDeviceInfo();
      
      // Call the secure database function
      const { data, error } = await client.rpc('log_member_activity', {
        p_family_member_id: familyMemberId,
        p_action_type: actionType,
        p_action_description: actionDescription,
        p_target_type: targetType,
        p_target_id: targetId,
        p_metadata: metadata,
        p_status: status,
        p_device_info: deviceInfo,
        p_ip_address: null, // IP address should be captured server-side if needed
      });

      if (error) {
        console.error('Failed to log activity:', error);
        return { success: false, error: error.message };
      }

      return { success: true, activityId: data };
    } catch (error) {
      console.error('Exception logging activity:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Direct insert method (fallback if RPC not available)
   * LESS SECURE: Relies on RLS policies, actor_user_id from client
   */
  async function logActivityDirect(client, options) {
    if (!client) {
      console.warn('Supabase client not provided to logActivityDirect');
      return { success: false, error: 'No client' };
    }

    const {
      familyMemberId,
      actionType,
      actionDescription = null,
      targetType = null,
      targetId = null,
      metadata = null,
      status = 'success',
    } = options;

    if (!familyMemberId || !actionType) {
      return { success: false, error: 'Missing required fields' };
    }

    try {
      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const deviceInfo = getDeviceInfo();

      const { data, error } = await client
        .from('member_activity_log')
        .insert({
          family_member_id: familyMemberId,
          actor_user_id: user.id,
          action_type: actionType,
          action_description: actionDescription,
          target_type: targetType,
          target_id: targetId,
          metadata: metadata,
          status: status,
          device_info: deviceInfo,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to log activity (direct):', error);
        return { success: false, error: error.message };
      }

      return { success: true, activityId: data.id };
    } catch (error) {
      console.error('Exception logging activity (direct):', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Log successful login
   */
  async function logLogin(client, familyMemberId) {
    return await logActivity(client, {
      familyMemberId,
      actionType: ACTION_TYPES.LOGIN_SUCCESS,
      actionDescription: 'Member logged in successfully',
      status: 'success',
    });
  }

  /**
   * Helper: Log logout
   */
  async function logLogout(client, familyMemberId) {
    return await logActivity(client, {
      familyMemberId,
      actionType: ACTION_TYPES.LOGOUT,
      actionDescription: 'Member logged out',
      status: 'success',
    });
  }

  /**
   * Helper: Log profile update
   */
  async function logProfileUpdate(client, familyMemberId, changes = []) {
    const description = changes.length > 0
      ? `Updated profile fields: ${changes.join(', ')}`
      : 'Profile updated';
    
    return await logActivity(client, {
      familyMemberId,
      actionType: ACTION_TYPES.PROFILE_UPDATED,
      actionDescription: description,
      targetType: 'profile',
      targetId: familyMemberId,
      metadata: { changes },
      status: 'success',
    });
  }

  /**
   * Helper: Log password change
   */
  async function logPasswordChange(client, familyMemberId) {
    return await logActivity(client, {
      familyMemberId,
      actionType: ACTION_TYPES.PASSWORD_CHANGED,
      actionDescription: 'Password changed successfully',
      status: 'success',
    });
  }

  /**
   * Helper: Log profile photo change
   */
  async function logProfilePhotoChange(client, familyMemberId, action = 'uploaded') {
    const actionMap = {
      uploaded: ACTION_TYPES.PROFILE_PHOTO_UPLOADED,
      changed: ACTION_TYPES.PROFILE_PHOTO_CHANGED,
      deleted: ACTION_TYPES.PROFILE_PHOTO_DELETED,
    };

    const descriptionMap = {
      uploaded: 'Profile photo uploaded',
      changed: 'Profile photo changed',
      deleted: 'Profile photo deleted',
    };

    return await logActivity(client, {
      familyMemberId,
      actionType: actionMap[action] || ACTION_TYPES.PROFILE_PHOTO_CHANGED,
      actionDescription: descriptionMap[action] || 'Profile photo changed',
      targetType: 'profile',
      targetId: familyMemberId,
      status: 'success',
    });
  }

  /**
   * Fetch activity logs for a member
   */
  async function getActivityLogs(client, familyMemberId, options = {}) {
    if (!client) {
      return { data: null, error: 'No client provided' };
    }

    const {
      limit = 50,
      offset = 0,
      actionType = null,
      status = null,
    } = options;

    try {
      let query = client
        .from('member_activity_log')
        .select('*')
        .eq('family_member_id', familyMemberId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch activity logs:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching activity logs:', error);
      return { data: null, error: error.message };
    }
  }

  /**
   * Format activity for display
   */
  function formatActivity(activity) {
    if (!activity) return null;

    const date = new Date(activity.created_at);
    const formattedDate = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      id: activity.id,
      type: activity.action_type,
      description: activity.action_description || activity.action_type.replace(/_/g, ' '),
      date: formattedDate,
      time: formattedTime,
      datetime: date.toISOString(),
      status: activity.status || 'success',
      device: activity.device_info || 'Unknown',
      targetType: activity.target_type,
      targetId: activity.target_id,
    };
  }

  // Export API
  const FamilyActivityLogger = {
    ACTION_TYPES,
    logActivity,
    logActivityDirect,
    logLogin,
    logLogout,
    logProfileUpdate,
    logPasswordChange,
    logProfilePhotoChange,
    getActivityLogs,
    formatActivity,
    getDeviceInfo,
  };

  // Make available globally
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FamilyActivityLogger;
  }

  global.FamilyActivityLogger = FamilyActivityLogger;
})(typeof globalThis !== 'undefined' ? globalThis : this);
