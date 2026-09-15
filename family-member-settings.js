/**
 * Family Member Settings Page
 * Handles account settings, password change, and preferences
 */

(function (global) {
  'use strict';

  const client = window.supabaseClient;

  /**
   * Load and render settings page
   */
  async function loadSettings(container, member) {
    if (!container || !member) return;

    container.innerHTML = `
      <div class="hero-section" style="margin-bottom: 32px;">
        <div style="max-width: 800px;">
          <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 12px; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            Settings
          </h1>
          <p style="color: var(--muted); font-size: 16px;">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      <div style="max-width: 800px;">
        <!-- Security Section -->
        <div class="section-card" style="margin-bottom: 24px;">
          <div class="section-header">
            <h2 class="section-title">🔐 Security</h2>
          </div>
          
          <form id="passwordChangeForm">
            <div style="display: grid; gap: 20px; margin-bottom: 24px;">
              <div class="form-group">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                  New Password *
                </label>
                <div style="position: relative;">
                  <input 
                    type="password" 
                    name="newPassword" 
                    id="newPassword"
                    class="form-input" 
                    required
                    minlength="6"
                    placeholder="Enter new password (min 6 characters)"
                    style="padding-right: 44px;"
                  >
                  <button 
                    type="button" 
                    class="toggle-password" 
                    data-target="newPassword"
                    style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
                <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                  Must be at least 6 characters long
                </p>
              </div>

              <div class="form-group">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500;">
                  Confirm New Password *
                </label>
                <div style="position: relative;">
                  <input 
                    type="password" 
                    name="confirmPassword" 
                    id="confirmPassword"
                    class="form-input" 
                    required
                    minlength="6"
                    placeholder="Confirm your new password"
                    style="padding-right: 44px;"
                  >
                  <button 
                    type="button" 
                    class="toggle-password" 
                    data-target="confirmPassword"
                    style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>

              <div id="passwordStrength" style="display: none; padding: 12px; border-radius: 10px; font-size: 13px;">
                <!-- Password strength indicator -->
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; padding-top: 16px; border-top: 1px solid var(--line);">
              <button type="button" class="button" id="cancelPasswordButton">
                Cancel
              </button>
              <button type="submit" class="button button-primary" id="changePasswordButton">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Change Password
              </button>
            </div>
          </form>
        </div>

        <!-- Status Message -->
        <div id="settingsStatusMessage" class="status-message" style="display: none; padding: 16px; border-radius: 12px; margin-bottom: 24px;"></div>

        <!-- Account Status -->
        <div class="section-card" style="margin-bottom: 24px;">
          <div class="section-header">
            <h2 class="section-title">👤 Account Status</h2>
          </div>
          
          <div style="display: grid; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; background: ${member.account_status === 'active' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 146, 60, 0.1)'}; border: 1px solid var(--line);">
              <div>
                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Account Status</div>
                <div style="font-size: 13px; color: var(--muted);">
                  ${member.account_status === 'active' ? 'Your account is active and fully functional' : 'Your account status is: ' + member.account_status}
                </div>
              </div>
              <div style="padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; text-transform: uppercase; background: ${member.account_status === 'active' ? 'var(--green)' : 'var(--orange)'}; color: #fff;">
                ${escapeHtml(member.account_status || 'active')}
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
              <div>
                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Email Address</div>
                <div style="font-size: 13px; color: var(--muted);">
                  ${escapeHtml(member.email || 'Not set')}
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--green);">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
              <div>
                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Last Login</div>
                <div style="font-size: 13px; color: var(--muted);">
                  ${member.last_login ? new Date(member.last_login).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
              <div>
                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Member Since</div>
                <div style="font-size: 13px; color: var(--muted);">
                  ${member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Not available'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Preferences -->
        <div class="section-card" style="margin-bottom: 24px;">
          <div class="section-header">
            <h2 class="section-title">⚙️ Preferences</h2>
          </div>
          
          <div style="display: grid; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
              <div>
                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Theme</div>
                <div style="font-size: 13px; color: var(--muted);">
                  Current theme: <span id="currentTheme">Dark</span>
                </div>
              </div>
              <button class="button" id="toggleThemeButton">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                Toggle Theme
              </button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
              <div>
                <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Language</div>
                <div style="font-size: 13px; color: var(--muted);">
                  English (US)
                </div>
              </div>
              <div style="padding: 6px 12px; border-radius: 6px; background: rgba(96, 165, 250, 0.1); color: var(--blue); font-size: 12px; font-weight: 600;">
                DEFAULT
              </div>
            </div>
          </div>
        </div>

        <!-- Family Tree Settings -->
        <div class="section-card" style="margin-bottom: 24px;">
          <div class="section-header">
            <h2 class="section-title">🌳 Family Tree Settings</h2>
          </div>
          
          <form id="familyTreeSettingsForm">
            <div style="display: grid; gap: 16px;">
              
              <!-- Default Tree View -->
              <div style="padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
                <label style="display: block; font-weight: 600; color: var(--text); margin-bottom: 8px;">
                  Default Tree View
                </label>
                <select name="default_tree_view" id="defaultTreeView" class="form-input">
                  <option value="my_family">My Family</option>
                  <option value="full_tree">Full Family Tree</option>
                </select>
                <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                  Choose how the family tree displays by default
                </p>
              </div>

              <!-- Show Relationship Labels -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
                <div>
                  <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Show Relationship Labels</div>
                  <div style="font-size: 13px; color: var(--muted);">
                    Display relationship types (Father, Mother, etc.)
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" name="show_relationship_labels" id="showRelationshipLabels">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Show Generation Numbers -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
                <div>
                  <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Show Generation Numbers</div>
                  <div style="font-size: 13px; color: var(--muted);">
                    Display generation levels in the tree
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" name="show_generation_number" id="showGenerationNumber">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Show Spouse Connections -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
                <div>
                  <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Show Spouse Connections</div>
                  <div style="font-size: 13px; color: var(--muted);">
                    Display lines connecting spouses
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" name="show_spouse_connections" id="showSpouseConnections">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Show Parent-Child Connections -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
                <div>
                  <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Show Parent-Child Connections</div>
                  <div style="font-size: 13px; color: var(--muted);">
                    Display lines connecting parents and children
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" name="show_parent_child_connections" id="showParentChildConnections">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Center Tree Automatically -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
                <div>
                  <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Center Tree Automatically</div>
                  <div style="font-size: 13px; color: var(--muted);">
                    Auto-center the tree on selected member
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" name="center_tree_automatically" id="centerTreeAutomatically">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Remember Tree Zoom -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 10px; border: 1px solid var(--line);">
                <div>
                  <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Remember Tree Zoom</div>
                  <div style="font-size: 13px; color: var(--muted);">
                    Save your preferred zoom level
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" name="remember_tree_zoom" id="rememberTreeZoom">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <!-- Save Button -->
              <button type="submit" class="button button-primary" style="width: 100%; justify-content: center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save Family Tree Settings
              </button>

              <div id="familyTreeSettingsStatus" style="display: none; padding: 12px; border-radius: 8px; font-size: 14px;"></div>
            </div>
          </form>
        </div>

        <!-- Danger Zone -->
        <div class="section-card" style="border-color: rgba(239, 68, 68, 0.3);">
          <div class="section-header">
            <h2 class="section-title" style="color: #ef4444;">⚠️ Danger Zone</h2>
          </div>
          
          <div style="padding: 16px; border-radius: 10px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2);">
            <div style="font-weight: 600; color: var(--text); margin-bottom: 8px;">Account Deactivation</div>
            <div style="font-size: 13px; color: var(--muted); margin-bottom: 16px;">
              If you need to deactivate your account, please contact the family administrator. This action requires admin approval.
            </div>
            <button class="button" id="requestDeactivationButton" style="border-color: #ef4444; color: #ef4444;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Request Deactivation
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('familyTreeSettingsForm')?.closest('.section-card')?.remove();

    // Setup event listeners
    setupSettingsEventListeners(member);
    
    await loadThemePreference(member);
    updateThemeDisplay();
  }

  function setupSettingsEventListeners(member) {
    // Password change form
    const passwordForm = document.getElementById('passwordChangeForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => handlePasswordChange(e, member));
    }

    // Password visibility toggles
    document.querySelectorAll('.toggle-password').forEach(button => {
      button.addEventListener('click', function() {
        const targetId = this.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Password strength indicator
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
      newPasswordInput.addEventListener('input', updatePasswordStrength);
    }

    // Cancel password change
    const cancelButton = document.getElementById('cancelPasswordButton');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        document.getElementById('passwordChangeForm').reset();
        document.getElementById('passwordStrength').style.display = 'none';
      });
    }

    // Theme toggle
    const toggleThemeButton = document.getElementById('toggleThemeButton');
    if (toggleThemeButton) {
      toggleThemeButton.addEventListener('click', async () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        await saveThemePreference(member, newTheme);
        updateThemeDisplay();
        showStatus('Theme changed to ' + newTheme, 'success');
      });
    }

    // Request deactivation
    const deactivationButton = document.getElementById('requestDeactivationButton');
    if (deactivationButton) {
      deactivationButton.addEventListener('click', () => handleDeactivationRequest(member));
    }

    // Family Tree Settings Form
    const familyTreeForm = document.getElementById('familyTreeSettingsForm');
    if (familyTreeForm) {
      familyTreeForm.addEventListener('submit', (e) => handleFamilyTreeSettingsSave(e, member));
    }

  }

  function updatePasswordStrength() {
    const password = document.getElementById('newPassword').value;
    const strengthEl = document.getElementById('passwordStrength');
    
    if (!password) {
      strengthEl.style.display = 'none';
      return;
    }

    let strength = 0;
    let feedback = [];

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    if (password.length < 6) {
      feedback.push('Too short (minimum 6 characters)');
    }
    if (!/\d/.test(password)) {
      feedback.push('Add numbers');
    }
    if (!/[A-Z]/.test(password)) {
      feedback.push('Add uppercase letters');
    }

    let strengthText = 'Weak';
    let strengthColor = '#ef4444';
    
    if (strength >= 4) {
      strengthText = 'Strong';
      strengthColor = 'var(--green)';
    } else if (strength >= 2) {
      strengthText = 'Medium';
      strengthColor = 'var(--orange)';
    }

    strengthEl.style.display = 'block';
    strengthEl.style.background = `${strengthColor}22`;
    strengthEl.style.border = `1px solid ${strengthColor}44`;
    strengthEl.style.color = strengthColor;
    strengthEl.innerHTML = `
      <strong>Password Strength: ${strengthText}</strong>
      ${feedback.length > 0 ? '<br><span style="font-size: 12px;">Suggestions: ' + feedback.join(', ') + '</span>' : ''}
    `;
  }

  async function handlePasswordChange(e, member) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const changeButton = document.getElementById('changePasswordButton');
    
    const newPassword = formData.get('newPassword').trim();
    const confirmPassword = formData.get('confirmPassword').trim();

    // Validation
    if (newPassword.length < 6) {
      showStatus('Password must be at least 6 characters long', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showStatus('Passwords do not match', 'error');
      return;
    }

    // Disable button
    if (changeButton) {
      changeButton.disabled = true;
      changeButton.textContent = 'Changing Password...';
    }

    try {
      // Update password using Supabase Auth
      const { error } = await client.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Log activity (NEVER log the password itself)
      await window.FamilyActivityLogger.logPasswordChange(client, member.id);

      showStatus('Password changed successfully!', 'success');

      // Clear form
      form.reset();
      document.getElementById('passwordStrength').style.display = 'none';

      // Notify user to re-login after a delay
      setTimeout(() => {
        if (confirm('Password changed! For security, please login again.')) {
          client.auth.signOut();
          window.location.href = 'family-member-login.html';
        }
      }, 2000);

    } catch (error) {
      console.error('Password change failed:', error);
      showStatus(error.message || 'Failed to change password', 'error');
    } finally {
      if (changeButton) {
        changeButton.disabled = false;
        changeButton.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Change Password
        `;
      }
    }
  }

  async function handleDeactivationRequest(member) {
    const confirmed = confirm(
      'Are you sure you want to request account deactivation?\n\n' +
      'This will notify the administrator. Your account will remain active until approved.'
    );

    if (!confirmed) return;

    try {
      // Log deactivation request
      await window.FamilyActivityLogger.logActivity(client, {
        familyMemberId: member.id,
        actionType: window.FamilyActivityLogger.ACTION_TYPES.ACCOUNT_DEACTIVATION_REQUESTED,
        actionDescription: 'Member requested account deactivation',
        status: 'success',
      });

      showStatus('Deactivation request sent to administrator', 'success');
      
      alert('Your deactivation request has been sent to the administrator. You will be notified once it is reviewed.');

    } catch (error) {
      console.error('Failed to request deactivation:', error);
      showStatus('Failed to send request. Please contact admin directly.', 'error');
    }
  }

  function updateThemeDisplay() {
    const currentThemeEl = document.getElementById('currentTheme');
    if (currentThemeEl) {
      const theme = document.documentElement.getAttribute('data-theme');
      currentThemeEl.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    }
  }

  async function loadThemePreference(member) {
    const settingsUserId = member?.auth_user_id || member?.user_id;
    if (!settingsUserId) return;

    try {
      const result = await client
        .from('family_member_settings')
        .select('theme')
        .eq('user_id', settingsUserId)
        .maybeSingle();
      const savedTheme = result.data?.theme;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', savedTheme);
        localStorage.setItem('theme', savedTheme);
      }
    } catch (error) {
      console.warn('Could not load theme preference:', error);
    }
  }

  function showStatus(message, type) {
    const statusEl = document.getElementById('settingsStatusMessage');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = 'status-message ' + type;
    statusEl.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Load Family Tree Settings from Supabase
   */
  async function loadFamilyTreeSettings(member) {
    if (!member) return;
    const settingsUserId = member.auth_user_id || member.user_id;
    if (!settingsUserId) {
      console.warn('Cannot load family settings: member is not linked to an auth user.');
      return;
    }

    try {
      const { data, error } = await client
        .from('family_member_settings')
        .select('default_tree_view, show_relationship_labels, show_generation_number, show_spouse_connections, show_parent_child_connections, center_tree_automatically, remember_tree_zoom')
        .eq('user_id', settingsUserId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load family tree settings:', error);
        return;
      }

      // If settings exist, populate form
      if (data) {
        document.getElementById('defaultTreeView').value = data.default_tree_view || 'my_family';
        document.getElementById('showRelationshipLabels').checked = data.show_relationship_labels !== false;
        document.getElementById('showGenerationNumber').checked = data.show_generation_number !== false;
        document.getElementById('showSpouseConnections').checked = data.show_spouse_connections !== false;
        document.getElementById('showParentChildConnections').checked = data.show_parent_child_connections !== false;
        document.getElementById('centerTreeAutomatically').checked = data.center_tree_automatically !== false;
        document.getElementById('rememberTreeZoom').checked = data.remember_tree_zoom === true;
      } else {
        // Set defaults if no settings exist
        document.getElementById('showRelationshipLabels').checked = true;
        document.getElementById('showGenerationNumber').checked = true;
        document.getElementById('showSpouseConnections').checked = true;
        document.getElementById('showParentChildConnections').checked = true;
        document.getElementById('centerTreeAutomatically').checked = true;
        document.getElementById('rememberTreeZoom').checked = false;
      }

    } catch (error) {
      console.error('Error loading family tree settings:', error);
    }
  }

  /**
   * Save Family Tree Settings to Supabase
   */
  async function handleFamilyTreeSettingsSave(e, member) {
    e.preventDefault();

    const statusEl = document.getElementById('familyTreeSettingsStatus');
    const submitButton = e.target.querySelector('button[type="submit"]');
    const settingsUserId = member.auth_user_id || member.user_id;

    if (!settingsUserId) {
      statusEl.textContent = 'Your portal account is not linked to settings yet.';
      statusEl.style.display = 'block';
      statusEl.style.color = '#ef4444';
      return;
    }

    try {
      submitButton.disabled = true;
      submitButton.innerHTML = `
        <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Saving...
      `;

      const settings = {
        user_id: settingsUserId,
        default_tree_view: document.getElementById('defaultTreeView').value,
        show_relationship_labels: document.getElementById('showRelationshipLabels').checked,
        show_generation_number: document.getElementById('showGenerationNumber').checked,
        show_spouse_connections: document.getElementById('showSpouseConnections').checked,
        show_parent_child_connections: document.getElementById('showParentChildConnections').checked,
        center_tree_automatically: document.getElementById('centerTreeAutomatically').checked,
        remember_tree_zoom: document.getElementById('rememberTreeZoom').checked,
      };

      const result = await client
        .from('family_member_settings')
        .upsert(settings, { onConflict: 'user_id' });

      if (result.error) throw result.error;

      // Show success
      statusEl.textContent = '✅ Family tree settings saved successfully!';
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(34, 197, 94, 0.1)';
      statusEl.style.border = '1px solid rgba(34, 197, 94, 0.3)';
      statusEl.style.color = 'var(--green)';

      // Log activity
      if (window.FamilyActivityLogger) {
        await window.FamilyActivityLogger.logActivity(client, {
          familyMemberId: member.id,
          actionType: 'SETTINGS_UPDATED',
          actionDescription: 'Updated family tree settings',
          status: 'success',
          metadata: settings
        });
      }

      // Hide after 3 seconds
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 3000);

    } catch (error) {
      console.error('Failed to save family tree settings:', error);
      
      statusEl.textContent = '❌ Failed to save settings. Please try again.';
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
      statusEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      statusEl.style.color = '#ef4444';

    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Save Family Tree Settings
      `;
    }
  }

  async function saveThemePreference(member, theme) {
    const settingsUserId = member?.auth_user_id || member?.user_id;
    if (!settingsUserId) return;
    const result = await client
      .from('family_member_settings')
      .upsert({ user_id: settingsUserId, theme, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (result.error) console.warn('Could not persist theme preference:', result.error);
  }

  // Export
  global.FamilyMemberSettings = {
    loadSettings,
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
