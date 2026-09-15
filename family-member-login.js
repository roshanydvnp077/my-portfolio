document.addEventListener('DOMContentLoaded', async function () {
  const client = window.supabaseClient;
  const form = document.getElementById('familyMemberLoginForm');
  const emailInput = document.getElementById('familyMemberEmail');
  const passwordInput = document.getElementById('familyMemberPassword');
  const loginButton = document.getElementById('loginButton');
  const statusEl = document.getElementById('statusMessage');

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = 'status-message' + (type ? ' ' + type : '');
    if (message) {
      statusEl.classList.add('show');
    } else {
      statusEl.classList.remove('show');
    }
  }

  function setLoading(isLoading) {
    if (!loginButton) return;
    loginButton.disabled = isLoading;
    if (isLoading) {
      loginButton.innerHTML = '<span class="spinner"></span> Signing in...';
    } else {
      loginButton.textContent = 'Sign In to Portal';
    }
  }

  async function redirectIfAlreadyLinked() {
    if (!client) return false;
    const sessionResult = await client.auth.getSession();
    const user = sessionResult.data?.session?.user;
    if (!user) return false;
    
    const linked = await window.FamilyAuthUtils.findLinkedFamilyMember(client, user.id, user.email);
    if (linked && linked.data) {
      // Check account status
      if (linked.data.account_status === 'disabled') {
        await client.auth.signOut();
        setStatus('Your family account is currently disabled. Please contact the administrator.', 'error');
        return false;
      }
      
      window.location.href = 'family-member-portal.html';
      return true;
    }
    await client.auth.signOut();
    return false;
  }

  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      setStatus('', '');
      
      if (!client) {
        setStatus('Supabase is not configured yet.', 'error');
        return;
      }

      const email = String(emailInput.value || '').trim().toLowerCase();
      const password = String(passwordInput.value || '');
      
      if (!email || !password) {
        setStatus('Email and password are required.', 'error');
        return;
      }

      setLoading(true);
      setStatus('Signing in...', 'info');

      try {
        // Sign in with password
        const result = await client.auth.signInWithPassword({ email, password });
        
        if (result.error) {
          setStatus(result.error.message || 'Unable to sign in. Please check your credentials.', 'error');
          setLoading(false);
          
          // Try to log failed login attempt if we can identify the member
          const linkedMember = await window.FamilyAuthUtils.findLinkedFamilyMember(client, null, email);
          if (linkedMember && linkedMember.data && window.FamilyActivityLogger) {
            try {
              await window.FamilyActivityLogger.logActivityDirect(client, {
                familyMemberId: linkedMember.data.id,
                actionType: window.FamilyActivityLogger.ACTION_TYPES.LOGIN_FAILED,
                actionDescription: 'Failed login attempt',
                status: 'failed',
              });
            } catch (logError) {
              console.error('Failed to log failed login:', logError);
            }
          }
          return;
        }

        // Find linked family member
        const linked = await window.FamilyAuthUtils.findLinkedFamilyMember(
          client, 
          result.data.user.id, 
          result.data.user.email
        );
        
        if (!linked || !linked.data) {
          await client.auth.signOut();
          setStatus('Your account is not linked to a family member profile. Please contact the administrator.', 'error');
          setLoading(false);
          return;
        }

        const memberData = linked.data;

        // Check account status
        if (memberData.account_status === 'disabled') {
          await client.auth.signOut();
          setStatus('Your family account is currently disabled. Please contact the administrator.', 'error');
          setLoading(false);
          return;
        }

        if (memberData.account_status === 'pending') {
          await client.auth.signOut();
          setStatus('Your account is pending approval. Please contact the administrator.', 'error');
          setLoading(false);
          return;
        }

        // Update last_login timestamp
        try {
          await client.rpc('update_member_last_login', {
            p_member_id: memberData.id
          });
        } catch (updateError) {
          console.error('Failed to update last login:', updateError);
        }

        // Log successful login
        if (window.FamilyActivityLogger) {
          try {
            await window.FamilyActivityLogger.logLogin(client, memberData.id);
          } catch (logError) {
            console.error('Failed to log successful login:', logError);
            // Don't block login if logging fails
          }
        }

        setStatus('Login successful! Redirecting...', 'success');
        
        // Redirect to portal
        setTimeout(() => {
          window.location.href = 'family-member-portal.html';
        }, 500);
        
      } catch (error) {
        console.error('Login error:', error);
        setStatus('An unexpected error occurred. Please try again.', 'error');
        setLoading(false);
      }
    });
  }

  // Focus email input on load
  if (emailInput) {
    emailInput.focus();
  }

  // Check if already logged in
  setStatus('', '');
  redirectIfAlreadyLinked().catch(function (error) {
    console.error('Could not check the active family member session.', error);
  });
});
