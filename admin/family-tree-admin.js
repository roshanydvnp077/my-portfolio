/**
 * Family Tree Admin Manager
 * Manages family_members table for the Family Tree feature
 * Only accessible by admin users
 */

(function () {
  'use strict';

  const client = window.supabaseClient;
  const app = document.getElementById('app');
  const nav = document.querySelector('.nav');
  const main = document.querySelector('.main');
  const overlay = document.getElementById('overlay');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogBody = document.getElementById('dialogBody');

  const BRANCHES = ['paternal', 'maternal', 'core', 'extended'];
  const RELATIONSHIPS = [
    'Grandfather', 'Grandmother', 
    'Father', 'Mother', 
    'Son', 'Daughter', 
    'Brother', 'Sister',
    'Uncle', 'Aunt', 
    'Nephew', 'Niece',
    'Cousin', 'Spouse', 
    'Grandson', 'Granddaughter',
    'Other'
  ];
  const GENDERS = ['Male', 'Female', 'Other'];
  const LIVING_STATUS = ['living', 'deceased'];

  const state = { 
    members: [], 
    user: null, 
    view: null, 
    objectUrl: '',
    adminUsers: [] 
  };

  if (!client || !app || !main || !nav) return;

  // Utility Functions
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => 
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])
  );

  const makeUuid = () => {
    const crypto = window.crypto || globalThis.crypto;
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  };

  const formatDate = value => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const message = (text, type) => 
    `<p class="family-message ${type || ''}" role="status">${escape(text)}</p>`;

  // Authorization
  async function authorizedUser() {
    const session = await client.auth.getSession();
    const user = session.data.session?.user;
    if (!user) return null;
    
    const check = await client
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    return check.error || !check.data ? null : user;
  }

  // Navigation
  function addNavigation() {
    if (nav.querySelector('[data-familytree-view]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'familytree';
    button.dataset.familytreeView = 'true';
    button.textContent = '🌳 Family Tree';
    nav.appendChild(button);
  }

  function activateView() {
    document.querySelectorAll('.view').forEach(v => { 
      v.hidden = v !== state.view; 
    });
    document.querySelectorAll('[data-view]').forEach(btn => 
      btn.classList.toggle('active', btn.dataset.view === 'familytree')
    );
    document.getElementById('title').textContent = 'Family Tree Manager';
    document.getElementById('side')?.classList.remove('open');
  }

  // Filtering
  function visibleMembers() {
    const query = String(state.view?.querySelector('[data-tree-search]')?.value || '')
      .trim().toLowerCase();
    const branch = state.view?.querySelector('[data-tree-branch]')?.value || '';
    const relationship = state.view?.querySelector('[data-tree-relationship]')?.value || '';
    
    return state.members.filter(m => {
      if (branch && m.branch !== branch) return false;
      if (relationship && m.relationship !== relationship) return false;
      if (query) {
        const searchable = [
          m.full_name, m.nickname, m.relationship, 
          m.branch, m.email, m.phone, m.occupation
        ].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }

  // Member Card HTML with Clickable Photo
  function memberCard(member) {
    const initials = (member.full_name || 'FM')
      .split(' ')
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    
    // Use signed URL if available, otherwise fallback to initials
    const photoUrl = member.signedPhotoUrl || member.profile_photo;
    const avatar = photoUrl && (photoUrl.startsWith('http') || photoUrl.includes('/'))
      ? `<img src="${escape(photoUrl)}" alt="${escape(member.full_name)}" class="family-avatar" style="cursor:pointer;" data-tree-view-photo="${escape(member.id)}">`
      : `<div class="family-avatar family-avatar-fallback" style="cursor:pointer;" data-tree-view-photo="${escape(member.id)}">${escape(initials)}</div>`;
    
    const details = [
      ['Relationship', member.relationship],
      ['Branch', member.branch],
      ['Gender', member.gender],
      ['Born', formatDate(member.date_of_birth)],
      ['Phone', member.phone],
      ['Email', member.email],
      ['Occupation', member.occupation]
    ]
      .filter(([, val]) => val)
      .map(([label, val]) => 
        `<div class="family-detail">
          <span>${escape(label)}</span>
          <strong>${escape(val)}</strong>
        </div>`
      )
      .join('');
    
    const statusBadge = member.living_status === 'deceased' 
      ? '<span class="badge-deceased">In Memory</span>' 
      : '';
    
    const accountBadge = member.auth_user_id
      ? '<span class="badge-connected" title="Account connected">🔗 Linked</span>'
      : '<span class="badge-unconnected" title="No account">○ No Login</span>';
    
    return `
      <article class="family-card">
        <div class="family-card-head">
          ${avatar}
          <div>
            <h3 style="cursor:pointer;" data-tree-view="${escape(member.id)}">${escape(member.full_name || 'Unknown')}</h3>
            <p>${escape(member.relationship || 'Family Member')} ${statusBadge} ${accountBadge}</p>
          </div>
        </div>
        <div class="family-details">${details}</div>
        <div class="family-actions">
          <button type="button" data-tree-view="${escape(member.id)}">View Profile</button>
          <button type="button" data-tree-edit="${escape(member.id)}">Edit</button>
          <button type="button" data-tree-connect="${escape(member.id)}">Account</button>
          <button type="button" data-tree-delete="${escape(member.id)}">Delete</button>
        </div>
      </article>
    `;
  }

  // Paint UI
  function paint() {
    const list = state.view.querySelector('[data-tree-list]');
    const members = visibleMembers();
    
    state.view.querySelector('[data-tree-count]').textContent = 
      `${state.members.length} member${state.members.length === 1 ? '' : 's'}`;
    
    if (!members.length) {
      list.innerHTML = `
        <div class="family-empty">
          <h3>${state.members.length ? 'No matching members' : 'No family members yet'}</h3>
          <p>${state.members.length 
            ? 'Try a different search or filter.' 
            : 'Add family members to build your family tree.'
          }</p>
          <button class="button primary" type="button" data-tree-add>
            ${state.members.length ? 'Add Member' : 'Add First Member'}
          </button>
        </div>
      `;
      return;
    }
    
    list.innerHTML = members.map(memberCard).join('');
  }

  // Fetch Members with Signed Photo URLs
  async function fetchMembers() {
    const stateEl = state.view.querySelector('[data-tree-state]');
    stateEl.innerHTML = '<div class="family-loading">Loading family tree members...</div>';
    
    const result = await client
      .from('family_members')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (result.error) {
      stateEl.innerHTML = `
        <div class="family-error">
          Unable to load family members. 
          <button class="button" type="button" data-tree-refresh>Retry</button>
        </div>
      `;
      console.error('[Family Tree Admin] Error:', result.error);
      return;
    }
    
    // Load photos with signed URLs
    const members = result.data || [];
    state.members = await Promise.all(members.map(async (member) => {
      if (member.profile_photo && !member.profile_photo.startsWith('http')) {
        try {
          const { data: signedData, error: signedError } = await client.storage
            .from('family-photos')
            .createSignedUrl(member.profile_photo, 3600); // 1 hour expiry
          
          if (!signedError && signedData) {
            member.signedPhotoUrl = signedData.signedUrl;
          }
        } catch (err) {
          console.warn('[Family Tree] Photo load error:', member.full_name, err);
        }
      } else if (member.profile_photo && member.profile_photo.startsWith('http')) {
        // Already a URL
        member.signedPhotoUrl = member.profile_photo;
      }
      return member;
    }));
    
    stateEl.innerHTML = '<div data-tree-list class="family-grid"></div>';
    paint();
  }

  // Dialog
  function closeDialog() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = '';
    if (overlay) overlay.hidden = true;
  }

  function openDialog(title, html) {
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    overlay.hidden = false;
  }

  // Form Field Helpers
  const field = (name, label, value = '', type = 'text', required = false) => `
    <label class="family-field">
      ${label}${required ? ' *' : ''}
      <input 
        class="field" 
        name="${name}" 
        type="${type}" 
        value="${escape(value)}"
        ${required ? 'required' : ''}
      >
    </label>
  `;

  const select = (name, label, options, value = '', required = false) => `
    <label class="family-field">
      ${label}${required ? ' *' : ''}
      <select class="field" name="${name}" ${required ? 'required' : ''}>
        <option value="">Select ${label.toLowerCase()}</option>
        ${options.map(opt => 
          `<option value="${opt}"${value === opt ? ' selected' : ''}>${opt}</option>`
        ).join('')}
      </select>
    </label>
  `;

  const area = (name, label, value = '') => `
    <label class="family-field family-wide">
      ${label}
      <textarea class="field" name="${name}">${escape(value)}</textarea>
    </label>
  `;

  const uploadField = (name, label, currentValue = '') => `
    <label class="family-field family-wide">
      ${label}
      <input 
        class="field" 
        name="${name}" 
        type="file" 
        accept="image/jpeg,image/jpg,image/png,image/webp"
        data-upload-field="${name}"
      >
      <small class="muted">
        ${currentValue 
          ? `Current: ${escape(currentValue.split('/').pop())} • Upload new to replace` 
          : 'JPG, PNG or WEBP up to 5 MB'}
      </small>
      <div class="upload-preview" data-preview="${name}" style="display:none;margin-top:12px;">
        <img src="" alt="Preview" style="max-width:200px;height:auto;border-radius:8px;border:2px solid var(--line);">
      </div>
    </label>
  `;

  // Form Markup
  function formMarkup(member) {
    return `
      <form class="form family-form" data-tree-form>
        <div class="family-form-grid">
          ${field('full_name', 'Full Name', member?.full_name, 'text', true)}
          ${field('nickname', 'Nickname', member?.nickname)}
          ${select('relationship', 'Relationship', RELATIONSHIPS, member?.relationship, true)}
          ${select('branch', 'Branch', BRANCHES, member?.branch, true)}
          ${select('gender', 'Gender', GENDERS, member?.gender)}
          ${select('living_status', 'Status', LIVING_STATUS, member?.living_status || 'living')}
          ${field('date_of_birth', 'Date of Birth', member?.date_of_birth, 'date')}
          ${field('marriage_date', 'Marriage Date', member?.marriage_date, 'date')}
          ${field('phone', 'Phone', member?.phone, 'tel')}
          ${field('email', 'Email', member?.email, 'email')}
          ${field('occupation', 'Occupation', member?.occupation)}
          ${field('education', 'Education', member?.education)}
          ${field('blood_group', 'Blood Group', member?.blood_group)}
          ${field('father_name', 'Father Name', member?.father_name)}
          ${field('mother_name', 'Mother Name', member?.mother_name)}
          ${field('spouse_name', 'Spouse Name', member?.spouse_name)}
          ${area('address', 'Address', member?.address)}
          ${area('biography', 'Biography', member?.biography)}
          ${area('hobbies', 'Hobbies', member?.hobbies)}
          ${uploadField('profile_photo', 'Profile Photo', member?.profile_photo)}
          ${field('generation', 'Generation', member?.generation, 'number')}
        </div>
        <p data-tree-form-message></p>
        <div class="family-form-actions">
          <button type="button" class="button" data-tree-cancel>Cancel</button>
          <button type="submit" class="button primary" data-tree-save>
            Save Member
          </button>
        </div>
      </form>
    `;
  }

  // Open Form
  function openForm(member) {
    openDialog(
      member ? 'Edit Family Member' : 'Add Family Member', 
      formMarkup(member)
    );
    
    const form = dialogBody.querySelector('[data-tree-form]');
    form.querySelector('[data-tree-cancel]').onclick = closeDialog;
    form.onsubmit = event => saveForm(event, member);
    
    // Add file preview functionality
    const fileInput = form.querySelector('[data-upload-field="profile_photo"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = form.querySelector('[data-preview="profile_photo"]');
        const img = preview?.querySelector('img');
        
        if (file && img) {
          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
          if (!allowedTypes.includes(file.type)) {
            alert('Please select a JPG, PNG or WEBP image.');
            fileInput.value = '';
            return;
          }
          
          // Validate file size (5MB)
          if (file.size > 5 * 1024 * 1024) {
            alert('Image must be under 5 MB.');
            fileInput.value = '';
            return;
          }
          
          // Show preview
          const reader = new FileReader();
          reader.onload = (event) => {
            img.src = event.target.result;
            preview.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else if (!file && preview) {
          preview.style.display = 'none';
        }
      });
    }
  }

  // Save Form
  async function saveForm(event, member) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[data-tree-save]');
    const status = form.querySelector('[data-tree-form-message]');
    const data = new FormData(form);
    
    const full_name = String(data.get('full_name') || '').trim();
    const relationship = String(data.get('relationship') || '').trim();
    const branch = String(data.get('branch') || '').trim();
    
    if (!full_name || !relationship || !branch) {
      status.innerHTML = message('Name, relationship, and branch are required.', 'error');
      return;
    }
    
    button.disabled = true;
    button.textContent = 'Saving...';
    
    try {
      const user = await authorizedUser();
      if (!user) throw new Error('Admin authorization required.');
      
      // Build payload - NEVER include auth_user_id in add/edit
      const payload = {
        full_name,
        relationship,
        branch
      };
      
      // Add optional fields only if they have values
      const nickname = String(data.get('nickname') || '').trim();
      if (nickname) payload.nickname = nickname;
      
      const gender = data.get('gender');
      if (gender) payload.gender = gender;
      
      const living_status = data.get('living_status') || 'living';
      payload.living_status = living_status;
      
      const date_of_birth = data.get('date_of_birth');
      if (date_of_birth) payload.date_of_birth = date_of_birth;
      
      const marriage_date = data.get('marriage_date');
      if (marriage_date) payload.marriage_date = marriage_date;
      
      const phone = String(data.get('phone') || '').trim();
      if (phone) payload.phone = phone;
      
      const email = String(data.get('email') || '').trim();
      if (email) payload.email = email;
      
      const occupation = String(data.get('occupation') || '').trim();
      if (occupation) payload.occupation = occupation;
      
      const education = String(data.get('education') || '').trim();
      if (education) payload.education = education;
      
      const blood_group = String(data.get('blood_group') || '').trim();
      if (blood_group) payload.blood_group = blood_group;
      
      const father_name = String(data.get('father_name') || '').trim();
      if (father_name) payload.father_name = father_name;
      
      const mother_name = String(data.get('mother_name') || '').trim();
      if (mother_name) payload.mother_name = mother_name;
      
      const spouse_name = String(data.get('spouse_name') || '').trim();
      if (spouse_name) payload.spouse_name = spouse_name;
      
      const address = String(data.get('address') || '').trim();
      if (address) payload.address = address;
      
      const biography = String(data.get('biography') || '').trim();
      if (biography) payload.bio = biography; // Note: using 'bio' to match your schema
      
      const hobbies = String(data.get('hobbies') || '').trim();
      if (hobbies) payload.hobbies = hobbies;
      
      // Handle profile photo file upload
      const photoFile = data.get('profile_photo');
      if (photoFile && photoFile.size > 0) {
        // Validate file
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(photoFile.type)) {
          throw new Error('Profile photo must be JPG, PNG or WEBP format.');
        }
        if (photoFile.size > 5 * 1024 * 1024) {
          throw new Error('Profile photo must be under 5 MB.');
        }
        
        // Upload to Supabase storage
        const bucket = 'family-photos';
        const fileName = `${user.id}/${Date.now()}-${photoFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`;
        
        const { data: uploadData, error: uploadError } = await client.storage
          .from(bucket)
          .upload(fileName, photoFile, {
            contentType: photoFile.type,
            upsert: false
          });
        
        if (uploadError) {
          console.error('[Family Tree Admin] Upload error:', uploadError);
          throw new Error('Failed to upload profile photo: ' + uploadError.message);
        }
        
        // Delete old photo if updating
        if (member?.profile_photo && !member.profile_photo.startsWith('http')) {
          await client.storage.from(bucket).remove([member.profile_photo]);
        }
        
        payload.profile_photo = fileName;
      } else if (member?.profile_photo) {
        // Keep existing photo if no new upload
        payload.profile_photo = member.profile_photo;
      }
      
      const generation = parseInt(data.get('generation'));
      if (!isNaN(generation)) payload.generation = generation;
      
      // CRITICAL: Only set created_by for new members, never auth_user_id
      if (!member) {
        payload.created_by = user.id;
        // auth_user_id stays NULL until explicitly connected
      }
      
      const result = member
        ? await client.from('family_members').update(payload).eq('id', member.id)
        : await client.from('family_members').insert(payload);
      
      if (result.error) {
        console.error('[Family Tree Admin] Supabase error:', result.error);
        
        // User-friendly error messages
        if (result.error.code === '23505' && result.error.message.includes('auth_user_id')) {
          throw new Error('This Supabase account is already connected to another family member.');
        } else if (result.error.code === '42501') {
          throw new Error('You are not authorized to modify family members.');
        } else {
          throw new Error(result.error.message || 'Database error occurred.');
        }
      }
      
      closeDialog();
      await fetchMembers();
      toast(member ? 'Member updated successfully!' : 'Member added successfully!');
    } catch (error) {
      console.error('[Family Tree Admin] Save error:', error);
      status.innerHTML = message('Could not save member. ' + error.message, 'error');
      button.disabled = false;
      button.textContent = 'Save Member';
    }
  }

  // Connect Account to Member
  async function connectAccount(member) {
    // Load available auth users
    const { data: authUsers, error: authError } = await client.auth.admin.listUsers();
    
    if (authError || !authUsers) {
      toast('Could not load auth users. Check admin permissions.', true);
      console.error('[Family Tree Admin] Auth users error:', authError);
      return;
    }
    
    // Filter out already connected users
    const connectedUserIds = state.members
      .filter(m => m.auth_user_id)
      .map(m => m.auth_user_id);
    
    const availableUsers = authUsers.users.filter(u => !connectedUserIds.includes(u.id));
    
    const userOptions = availableUsers.length > 0
      ? availableUsers.map(u => 
          `<option value="${u.id}">${u.email || u.id}</option>`
        ).join('')
      : '<option value="">No available accounts</option>';
    
    const currentAccount = member.auth_user_id 
      ? `<p class="muted">Current: ${member.auth_user_id}</p>`
      : '<p class="muted">No account connected</p>';
    
    openDialog(
      'Connect Account: ' + member.full_name,
      `<form class="form" data-connect-form>
        ${currentAccount}
        <label class="family-field">
          Select Supabase Auth Account
          <select class="field" name="user_id" required>
            <option value="">Choose account...</option>
            ${userOptions}
          </select>
        </label>
        <p data-connect-message></p>
        <div class="family-form-actions">
          <button type="button" class="button" data-tree-cancel>Cancel</button>
          ${member.auth_user_id 
            ? '<button type="button" class="button" data-disconnect>Disconnect Current</button>' 
            : ''}
          <button type="submit" class="button primary">Connect Account</button>
        </div>
      </form>`
    );
    
    const connectForm = dialogBody.querySelector('[data-connect-form]');
    const disconnectBtn = dialogBody.querySelector('[data-disconnect]');
    
    dialogBody.querySelector('[data-tree-cancel]').onclick = closeDialog;
    
    if (disconnectBtn) {
      disconnectBtn.onclick = async () => {
        if (!confirm('Disconnect account? Member will no longer be able to login.')) return;
        
        try {
          const { error } = await client
            .from('family_members')
            .update({ auth_user_id: null })
            .eq('id', member.id);
          
          if (error) throw error;
          
          closeDialog();
          await fetchMembers();
          toast('Account disconnected successfully.');
        } catch (error) {
          console.error('[Family Tree Admin] Disconnect error:', error);
          toast('Could not disconnect account.', true);
        }
      };
    }
    
    connectForm.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(connectForm);
      const userId = formData.get('user_id');
      const statusEl = connectForm.querySelector('[data-connect-message]');
      
      if (!userId) {
        statusEl.innerHTML = message('Please select an account.', 'error');
        return;
      }
      
      try {
        // Check if account is already connected
        const { data: existing, error: checkError } = await client
          .from('family_members')
          .select('id, full_name')
          .eq('auth_user_id', userId)
          .maybeSingle();
        
        if (checkError) {
          console.error('[Family Tree Admin] Check error:', checkError);
          throw new Error('Could not verify account availability.');
        }
        
        if (existing && existing.id !== member.id) {
          statusEl.innerHTML = message(
            `This account is already connected to ${existing.full_name}.`, 
            'error'
          );
          return;
        }
        
        // Connect account
        const { error: updateError } = await client
          .from('family_members')
          .update({ auth_user_id: userId })
          .eq('id', member.id);
        
        if (updateError) {
          console.error('[Family Tree Admin] Connect error:', updateError);
          throw new Error(updateError.message);
        }
        
        closeDialog();
        await fetchMembers();
        toast('Account connected successfully!');
      } catch (error) {
        console.error('[Family Tree Admin] Connect account error:', error);
        statusEl.innerHTML = message('Could not connect account. ' + error.message, 'error');
      }
    };
  }

  // Show Details with Large Photo
  function showDetails(member) {
    const fields = [
      ['Full Name', member.full_name],
      ['Nickname', member.nickname],
      ['Relationship', member.relationship],
      ['Branch', member.branch],
      ['Gender', member.gender],
      ['Status', member.living_status],
      ['Date of Birth', formatDate(member.date_of_birth)],
      ['Marriage Date', formatDate(member.marriage_date)],
      ['Phone', member.phone],
      ['Email', member.email],
      ['Occupation', member.occupation],
      ['Education', member.education],
      ['Blood Group', member.blood_group],
      ['Father', member.father_name],
      ['Mother', member.mother_name],
      ['Spouse', member.spouse_name],
      ['Address', member.address],
      ['Generation', member.generation],
      ['Biography', member.biography],
      ['Hobbies', member.hobbies]
    ]
      .filter(([, val]) => val)
      .map(([label, val]) => 
        `<p><strong>${label}</strong><span>${escape(val)}</span></p>`
      )
      .join('');
    
    // Use signed URL for photo
    const photoUrl = member.signedPhotoUrl || member.profile_photo;
    const photo = photoUrl && (photoUrl.startsWith('http') || photoUrl.includes('/'))
      ? `<img class="family-detail-photo" src="${escape(photoUrl)}" alt="${escape(member.full_name)}" style="max-width:300px;height:auto;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">`
      : '';
    
    openDialog(
      member.full_name,
      `<div class="family-detail-dialog">
        ${photo}
        <h3>${escape(member.full_name)}</h3>
        <p class="muted">${escape(member.relationship || 'Family Member')} • ${escape(member.branch || 'N/A')}</p>
        <div class="family-detail-list" style="max-height:400px;overflow-y:auto;margin:20px 0;">${fields}</div>
        <div class="family-form-actions">
          <button type="button" class="button" data-tree-cancel>Close</button>
          <button type="button" class="button primary" data-tree-edit="${escape(member.id)}">Edit</button>
        </div>
      </div>`
    );
    
    dialogBody.querySelector('[data-tree-cancel]').onclick = closeDialog;
  }

  // Delete Member
  async function deleteMember(member) {
    if (!confirm(`Delete ${member.full_name}?\n\nThis action cannot be undone.`)) return;
    
    const result = await client.from('family_members').delete().eq('id', member.id);
    
    if (result.error) {
      toast('Could not delete member.', true);
      console.error('[Family Tree Admin] Delete error:', result.error);
      return;
    }
    
    await fetchMembers();
    toast('Member deleted successfully.');
  }

  // Show Main View
  async function showFamilyTree() {
    const user = await authorizedUser();
    if (!user) {
      window.location.replace('../index.html#admin-login');
      return;
    }
    
    state.user = user;
    
    if (!state.view) {
      state.view = document.createElement('section');
      state.view.id = 'familyTreeView';
      state.view.className = 'view';
      main.appendChild(state.view);
    }
    
    state.view.innerHTML = `
      <div class="family-page">
        <div class="family-toolbar">
          <div>
            <span class="eyebrow">Family Tree Management</span>
            <h2>Family Members</h2>
            <p class="muted">Manage family tree members - visible in member portal</p>
          </div>
          <button class="button primary" type="button" data-tree-add>
            Add Member
          </button>
        </div>
        <div class="family-controls">
          <strong data-tree-count>0 members</strong>
          <input 
            class="field" 
            data-tree-search 
            type="search" 
            placeholder="Search members" 
            aria-label="Search members"
          >
          <select class="field" data-tree-branch aria-label="Filter by branch">
            <option value="">All Branches</option>
            ${BRANCHES.map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
          <select class="field" data-tree-relationship aria-label="Filter by relationship">
            <option value="">All Relationships</option>
            ${RELATIONSHIPS.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
          <button class="button" type="button" data-tree-refresh>Refresh</button>
        </div>
        <div data-tree-state>
          <div class="family-loading">Loading family tree members...</div>
        </div>
      </div>
    `;
    
    activateView();
    
    state.view.querySelector('[data-tree-search]').oninput = paint;
    state.view.querySelector('[data-tree-branch]').onchange = paint;
    state.view.querySelector('[data-tree-relationship]').onchange = paint;
    
    await fetchMembers();
  }

  // Clear State
  function clearFamilyTree() {
    state.members = [];
    if (state.view) {
      state.view.innerHTML = '';
      state.view.hidden = true;
    }
  }

  // Toast Notification
  function toast(text, error) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = text;
    node.className = error ? 'error' : '';
    node.hidden = false;
    setTimeout(() => { node.hidden = true; }, 3500);
  }

  // Event Delegation
  document.addEventListener('click', event => {
    const viewBtn = event.target.closest('[data-familytree-view]');
    const add = event.target.closest('[data-tree-add]');
    const edit = event.target.closest('[data-tree-edit]');
    const view = event.target.closest('[data-tree-view]');
    const viewPhoto = event.target.closest('[data-tree-view-photo]'); // NEW: Photo click
    const connect = event.target.closest('[data-tree-connect]');
    const remove = event.target.closest('[data-tree-delete]');
    const refresh = event.target.closest('[data-tree-refresh]');
    
    if (!viewBtn && !add && !edit && !view && !viewPhoto && !connect && !remove && !refresh) return;
    
    event.preventDefault();
    event.stopImmediatePropagation();
    
    if (viewBtn) {
      window.location.hash = 'familytree';
      showFamilyTree();
      return;
    }
    
    if (add) {
      openForm();
      return;
    }
    
    if (refresh) {
      fetchMembers();
      return;
    }
    
    const memberId = edit?.dataset.treeEdit || view?.dataset.treeView || viewPhoto?.dataset.treeViewPhoto || connect?.dataset.treeConnect || remove?.dataset.treeDelete;
    const member = state.members.find(m => m.id === memberId);
    
    if (!member) return;
    
    if (edit) openForm(member);
    else if (view || viewPhoto) showDetails(member); // Photo click bhi profile khol degi
    else if (connect) connectAccount(member);
    else deleteMember(member);
  }, true);

  // Auth State Changes
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) clearFamilyTree();
  });

  // Initialize
  addNavigation();
  if (window.location.hash === '#familytree') showFamilyTree();

  console.log('[Family Tree Admin] Module loaded');
}());
