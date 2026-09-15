/* ============================================
   FAMILY PROFILE IMAGE SYSTEM — Shared Utilities
   Reused by the member portal, profile settings, and family tree.
   Uses the existing Supabase client (window.supabaseClient).
   Storage: uses the dedicated private 'profile-images' bucket with the
   path {authenticated_user_id}/avatar.ext (signed URLs + initials
   fallback). Photos uploaded before this change stay in 'family-vault'
   and are still resolved transparently.
   ============================================ */
(function (global) {
  'use strict';

  const BUCKET = 'profile-images';
  const LEGACY_BUCKETS = ['family-vault', 'family-private'];
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

  function getClient() {
    return global.supabaseClient || null;
  }

  function getInitials(name) {
    const clean = String(name || '').trim();
    if (!clean) return 'U';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 1).toUpperCase() || 'U';
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function initialsMarkup(name, size) {
    const fontSize = size === 'large' ? '1.3rem' : size === 'small' ? '0.85rem' : '1rem';
    return '<div style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(135deg, rgba(105,165,255,0.18), rgba(124,108,255,0.18));font-weight:700;font-size:' + fontSize + ';">' + escapeHtml(getInitials(name)) + '</div>';
  }

  function imgMarkup(url, name) {
    return '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(name) + '" style="width:100%;height:100%;object-fit:cover;" onerror="if(window.FamilyProfile){FamilyProfile.handleImageError(this)}' + '" loading="lazy">';
  }

  function pickPhotoValue(member) {
    if (!member) return '';
    const keys = ['profile_photo_path', 'profile_image_url', 'photo_url', 'profile_photo', 'photo'];
    for (let i = 0; i < keys.length; i++) {
      const value = member[keys[i]];
      if (value && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  async function getCurrentUser() {
    const supabase = getClient();
    if (!supabase) return { user: null, error: new Error('Supabase is not configured yet.') };
    const { data, error } = await supabase.auth.getUser();
    return { user: data && data.user ? data.user : null, error };
  }

  async function getCurrentMember() {
    const supabase = getClient();
    if (!supabase) return { member: null, error: new Error('Supabase is not configured yet.') };
    const sessionResult = await supabase.auth.getSession();
    const user = sessionResult.data && sessionResult.data.session ? sessionResult.data.session.user : null;
    if (!user) return { member: null, error: new Error('You must be logged in.') };

    let { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!error && data) return { member: data, error: null };

    // Fallback for members linked by email only (auth_user_id may be unset).
    if (user.email) {
      const emailResult = await supabase
        .from('family_members')
        .select('*')
        .eq('email', String(user.email).trim().toLowerCase())
        .maybeSingle();
      if (!emailResult.error && emailResult.data) return { member: emailResult.data, error: null };
    }

    return { member: null, error: error || new Error('Family member profile not found.') };
  }

  async function resolvePhotoUrl(member) {
    const value = pickPhotoValue(member);
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const supabase = getClient();
    if (!supabase || !supabase.storage) return '';
    try {
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(value, 3600);
      if (!signed.error && signed.data && signed.data.signedUrl) return signed.data.signedUrl;
      if (signed.error) {
        console.warn('[ProfilePhoto] createSignedUrl failed in "' + BUCKET + '" for "' + value + '":', signed.error.message, '- check that the bucket and its storage RLS policies exist (run FAMILY_PROFILE_IMAGE_SYSTEM.sql).');
      }
    } catch (error) {
      console.warn('[FamilyProfile] Could not create signed URL for photo:', value, error);
    }
    // Legacy photos uploaded before the 'profile-images' bucket existed
    // live in 'family-vault'. Try those buckets before giving up.
    for (const bucket of LEGACY_BUCKETS) {
      try {
        const signed = await supabase.storage.from(bucket).createSignedUrl(value, 3600);
        if (!signed.error && signed.data && signed.data.signedUrl) return signed.data.signedUrl;
      } catch (error) {
        console.warn('[FamilyProfile] Could not create signed URL from legacy bucket ' + bucket, value, error);
      }
    }
    return '';
  }

  async function paintAvatar(element, member, size) {
    if (!element || !member) return;
    const name = member.full_name || member.name || 'Family Member';
    element.innerHTML = initialsMarkup(name, size || 'medium');
    let url = '';
    try {
      url = await resolvePhotoUrl(member);
    } catch (error) {
      console.warn('[FamilyProfile] Could not resolve photo:', error);
      url = '';
    }
    if (url) {
      element.innerHTML = imgMarkup(url, name);
    }
    console.log('[ProfilePhoto] paintAvatar(' + (element.id || element.className || 'avatar') + ') used URL:', url || '(none — initials fallback)');
  }

  function handleImageError(imgElement) {
    if (!imgElement || !imgElement.parentNode) return;
    console.warn('[ProfilePhoto] Profile image FAILED to load:', imgElement.getAttribute('src'), '- switching to initials fallback.');
    const name = imgElement.getAttribute('alt') || 'User';
    imgElement.parentNode.innerHTML = initialsMarkup(name, 'medium');
  }

  function validateImageFile(file) {
    if (!file) return { ok: false, message: 'Please select a valid image.' };
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      return { ok: false, message: 'Please select a JPG, PNG or WEBP image.' };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, message: 'Image must be less than 5 MB.' };
    }
    return { ok: true };
  }

  // Writes the photo reference. profile_image_url mirrors profile_photo_path
  // (the requested column). If that column is not migrated yet, falls back to
  // profile_photo_path only so uploads still work before the SQL is applied.
  // The family_members row is matched by member id first (bullet-proof, the
  // Edit Profile save uses the same column), falling back to auth_user_id.
  // A best-effort write is also attempted on public.profiles.profile_image_url
  // (the requested table) when it exists; project UI reads family_members.
  async function updateMemberPhoto(userId, photoPathValue, memberId) {
    const supabase = getClient();
    if (!supabase) return { error: new Error('Supabase is not configured yet.') };

    const stamp = new Date().toISOString();

    async function attempt(patch) {
      let lastError = null;
      if (memberId) {
        const result = await supabase
          .from('family_members')
          .update(patch)
          .eq('id', memberId)
          .select()
          .maybeSingle();
        if (!result.error && result.data) return result;
        lastError = result.error;
      }
      if (userId) {
        const result = await supabase
          .from('family_members')
          .update(patch)
          .eq('auth_user_id', userId)
          .select()
          .maybeSingle();
        if (!result.error && result.data) return result;
        lastError = result.error;
      }
      return { error: lastError || new Error('Could not match your family_members row.') };
    }

    const full = await attempt({
      profile_photo_path: photoPathValue,
      profile_image_url: photoPathValue,
      updated_at: stamp
    });

    if (!full.error) {
      await mirrorToProfiles(supabase, userId, photoPathValue, stamp);
      return full;
    }

    if (/(column|42703|PGRST204)/.test(String(full.error.message) + ' ' + String(full.error.code || ''))) {
      const minimal = await attempt({ profile_photo_path: photoPathValue, updated_at: stamp });
      if (!minimal.error) {
        await mirrorToProfiles(supabase, userId, photoPathValue, stamp);
      }
      return minimal;
    }

    return full;
  }

  // Optional mirror to public.profiles.profile_image_url. Never fails the
  // primary flow: it only logs a warning when that table/column is absent
  // or the policy blocks the write.
  async function mirrorToProfiles(supabase, userId, photoPathValue, stamp) {
    try {
      const result = await supabase
        .from('profiles')
        .update({ profile_image_url: photoPathValue, updated_at: stamp })
        .eq('id', userId);
      if (result.error) {
        console.warn('[FamilyProfile] Could not mirror photo to public.profiles:', result.error.message);
      }
    } catch (error) {
      console.warn('[FamilyProfile] public.profiles mirror skipped:', error && error.message ? error.message : error);
    }
  }

  async function uploadProfileImage(file, onProgress) {
    const supabase = getClient();
    if (!supabase) return { error: new Error('Supabase is not configured yet.') };

    const check = validateImageFile(file);
    if (!check.ok) return { error: new Error(check.message) };

    const { user } = await getCurrentUser();
    if (!user) return { error: new Error('You must be logged in.') };

    const { member, error: memberError } = await getCurrentMember();
    if (memberError || !member) {
      return { error: memberError || new Error('Family member profile not found.') };
    }

    const extensionMatch = String(file.name || '').match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'webp';
    // Stable per-user file name inside the authenticated user's own folder.
    // The 'profile-images' bucket RLS requires the FIRST folder to equal the
    // authenticated user's id, so the path is {user.id}/avatar.ext.
    const path = user.id + '/avatar.' + extension;

    const uploadOptions = { contentType: file.type, upsert: true };
    if (typeof onProgress === 'function') uploadOptions.onUploadProgress = onProgress;

    const upload = await supabase.storage.from(BUCKET).upload(path, file, uploadOptions);
    if (upload.error) {
      console.log("[ProfilePhoto] Upload to bucket '" + BUCKET + "' path '" + path + "' failed:", upload.error.message, '(run FAMILY_PROFILE_IMAGE_SYSTEM.sql to create the bucket + RLS policies)');
      return { error: upload.error };
    }
    console.log("[ProfilePhoto] Storage upload OK:", path);

    const update = await updateMemberPhoto(user.id, path, member.id);
    if (update.error) {
      console.log("[ProfilePhoto] Database photo update failed:", update.error.message);
      try {
        await supabase.storage.from(BUCKET).remove([path]);
      } catch (removeError) {
        console.warn('[FamilyProfile] Cleanup of failed upload failed:', removeError);
      }
      return { error: update.error };
    }

    console.log("[ProfilePhoto] Database profile_image_url saved:", update.data ? update.data.profile_image_url : path);

    const previous = pickPhotoValue(member);
    if (previous && previous !== path) {
      try {
        await supabase.storage.from(BUCKET).remove([previous]);
      } catch (removeError) {
        console.warn('[FamilyProfile] Could not remove previous photo:', removeError);
      }
    }

    return { member: update.data || member, path };
  }

  async function removeProfileImage() {
    const supabase = getClient();
    if (!supabase) return { error: new Error('Supabase is not configured yet.') };

    const { user } = await getCurrentUser();
    if (!user) return { error: new Error('You must be logged in.') };

    const { member, error: memberError } = await getCurrentMember();
    if (memberError || !member) {
      return { error: memberError || new Error('Family member profile not found.') };
    }

    const previous = pickPhotoValue(member);

    const update = await updateMemberPhoto(user.id, null, member.id);
    if (update.error) return { error: update.error };

    if (previous) {
      try {
        await supabase.storage.from(BUCKET).remove([previous]);
      } catch (removeError) {
        console.warn('[FamilyProfile] Could not remove photo:', removeError);
      }
    }

    return { member: update.data || member };
  }

  function refreshProfileUI(member) {
    document.dispatchEvent(new CustomEvent('family:profile-updated', { detail: member || null }));
  }

  const api = {
    BUCKET: BUCKET,
    ALLOWED_TYPES: ALLOWED_TYPES,
    MAX_BYTES: MAX_BYTES,
    getInitials: getInitials,
    escapeHtml: escapeHtml,
    initialsMarkup: initialsMarkup,
    imgMarkup: imgMarkup,
    pickPhotoValue: pickPhotoValue,
    getCurrentUser: getCurrentUser,
    getCurrentMember: getCurrentMember,
    resolvePhotoUrl: resolvePhotoUrl,
    paintAvatar: paintAvatar,
    handleImageError: handleImageError,
    validateImageFile: validateImageFile,
    updateMemberPhoto: updateMemberPhoto,
    uploadProfileImage: uploadProfileImage,
    removeProfileImage: removeProfileImage,
    refreshProfileUI: refreshProfileUI
  };

  global.FamilyProfile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);