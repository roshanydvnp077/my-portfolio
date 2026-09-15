/**
 * Admin Activity Logs Dashboard
 * Allows admins to view all family member activities
 */

(function () {
  'use strict';

  const client = window.supabaseClient;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    setupAdminActivityDashboard();
  });

  function setupAdminActivityDashboard() {
    // Add navigation button if not exists
    const nav = document.querySelector('.nav');
    if (nav && !document.querySelector('[data-view="activity-logs"]')) {
      const activityButton = document.createElement('button');
      activityButton.setAttribute('data-view', 'activity-logs');
      activityButton.textContent = 'Activity Logs';
      activityButton.className = 'nav-button';
      nav.appendChild(activityButton);
    }

    // Listen for activity logs view
    document.addEventListener('click', async function(e) {
      if (e.target.closest('[data-view="activity-logs"]')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        await renderActivityLogsView();
      }
    }, true);
  }

  async function renderActivityLogsView() {
    // Get or create view container
    let view = document.getElementById('activityLogsView');
    if (!view) {
      view = document.createElement('section');
      view.id = 'activityLogsView';
      view.className = 'view';
      document.querySelector('.main').appendChild(view);
    }

    // Hide all views
    document.querySelectorAll('.view').forEach(v => {
      v.hidden = v !== view;
    });

    // Update active nav
    document.querySelectorAll('[data-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.view === 'activity-logs');
    });

    // Update title
    const titleEl = document.getElementById('title');
    if (titleEl) titleEl.textContent = 'Activity Logs';

    // Render content
    view.innerHTML = `
      <div class="panel" style="margin-bottom: 20px;">
        <div class="toolbar">
          <div>
            <span class="eyebrow">Family member monitoring</span>
            <h2>Activity Logs</h2>
          </div>
          <span class="muted">Monitor all family member activities</span>
        </div>

        <!-- Filters -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 20px;">
          <select id="adminMemberFilter" class="field">
            <option value="">All Members</option>
          </select>

          <select id="adminActionFilter" class="field">
            <option value="">All Actions</option>
            <option value="login_success">Login</option>
            <option value="logout">Logout</option>
            <option value="profile_updated">Profile Updated</option>
            <option value="profile_photo_uploaded">Photo Uploaded</option>
            <option value="profile_photo_deleted">Photo Deleted</option>
            <option value="password_changed">Password Changed</option>
            <option value="gallery_viewed">Gallery Viewed</option>
            <option value="document_viewed">Document Viewed</option>
          </select>

          <select id="adminStatusFilter" class="field">
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="warning">Warning</option>
          </select>

          <input type="date" id="adminDateFilter" class="field" placeholder="Filter by date">

          <button class="button primary" id="applyAdminFilters" style="grid-column: span 1;">
            Apply Filters
          </button>

          <button class="button" id="clearAdminFilters" style="grid-column: span 1;">
            Clear Filters
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="toolbar" style="margin-bottom: 16px;">
          <h3>Activity Records</h3>
          <span id="adminActivityCount" class="muted">Loading...</span>
        </div>

        <div id="adminActivityContainer">
          <div style="text-align: center; padding: 40px; color: var(--muted);">
            <div class="spinner" style="margin: 0 auto 16px;"></div>
            <div>Loading activities...</div>
          </div>
        </div>

        <div id="adminLoadMoreContainer" style="display: none; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--line);">
          <button class="button" id="adminLoadMore">Load More</button>
        </div>
      </div>
    `;

    // Load members for filter
    await loadMembersFilter();

    // Setup event listeners
    setupAdminActivityListeners();

    // Load initial data
    await loadAdminActivityData({});
  }

  async function loadMembersFilter() {
    try {
      const { data, error } = await client
        .from('family_members')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });

      if (error) throw error;

      const select = document.getElementById('adminMemberFilter');
      if (!select) return;

      data.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.full_name || 'Unknown'} (${member.email || 'No email'})`;
        select.appendChild(option);
      });

    } catch (error) {
      console.error('Failed to load members:', error);
    }
  }

  function setupAdminActivityListeners() {
    const applyButton = document.getElementById('applyAdminFilters');
    const clearButton = document.getElementById('clearAdminFilters');
    const loadMoreButton = document.getElementById('adminLoadMore');

    if (applyButton) {
      applyButton.addEventListener('click', () => {
        const filters = getAdminFilters();
        loadAdminActivityData(filters);
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        document.getElementById('adminMemberFilter').value = '';
        document.getElementById('adminActionFilter').value = '';
        document.getElementById('adminStatusFilter').value = '';
        document.getElementById('adminDateFilter').value = '';
        loadAdminActivityData({});
      });
    }

    if (loadMoreButton) {
      loadMoreButton.addEventListener('click', () => {
        const filters = getAdminFilters();
        const currentCount = document.querySelectorAll('.admin-activity-row').length;
        loadAdminActivityData(filters, currentCount);
      });
    }
  }

  function getAdminFilters() {
    return {
      memberId: document.getElementById('adminMemberFilter')?.value || null,
      actionType: document.getElementById('adminActionFilter')?.value || null,
      status: document.getElementById('adminStatusFilter')?.value || null,
      date: document.getElementById('adminDateFilter')?.value || null,
    };
  }

  async function loadAdminActivityData(filters, offset = 0) {
    const container = document.getElementById('adminActivityContainer');
    const countEl = document.getElementById('adminActivityCount');
    const loadMoreContainer = document.getElementById('adminLoadMoreContainer');

    if (!container) return;

    if (offset === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--muted);">
          <div class="spinner" style="margin: 0 auto 16px;"></div>
          <div>Loading activities...</div>
        </div>
      `;
    }

    try {
      const limit = 50;
      
      // Build query
      let query = client
        .from('member_activity_log')
        .select(`
          *,
          family_members!member_activity_log_family_member_id_fkey (
            id,
            full_name,
            email,
            relationship
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters.memberId) {
        query = query.eq('family_member_id', filters.memberId);
      }
      if (filters.actionType) {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.date) {
        const startOfDay = new Date(filters.date);
        const endOfDay = new Date(filters.date);
        endOfDay.setDate(endOfDay.getDate() + 1);
        query = query
          .gte('created_at', startOfDay.toISOString())
          .lt('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        if (offset === 0) {
          container.innerHTML = `
            <div class="empty">
              <span style="font-size: 48px; display: block; margin-bottom: 16px;">📊</span>
              <p>No activity logs found</p>
              <p style="font-size: 14px; color: var(--muted); margin-top: 8px;">
                ${Object.values(filters).some(f => f) ? 'Try changing your filters' : 'Activity logs will appear here'}
              </p>
            </div>
          `;
        }
        if (loadMoreContainer) {
          loadMoreContainer.style.display = 'none';
        }
        return;
      }

      // Render table
      if (offset === 0) {
        container.innerHTML = `
          <div class="table">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Date/Time</th>
                  <th>Status</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody id="adminActivityTableBody">
              </tbody>
            </table>
          </div>
        `;
      }

      const tbody = document.getElementById('adminActivityTableBody');
      if (!tbody) return;

      data.forEach(activity => {
        const row = createAdminActivityRow(activity);
        tbody.appendChild(row);
      });

      // Update count
      if (countEl) {
        const totalCount = offset + data.length;
        countEl.textContent = `${totalCount} ${totalCount === 1 ? 'record' : 'records'}`;
      }

      // Show/hide load more
      if (loadMoreContainer) {
        loadMoreContainer.style.display = data.length === limit ? 'block' : 'none';
      }

    } catch (error) {
      console.error('Failed to load activity logs:', error);
      if (offset === 0) {
        container.innerHTML = `
          <div class="empty">
            <p class="status error">Failed to load activity logs</p>
            <p style="font-size: 14px; margin-top: 8px;">${escapeHtml(error.message)}</p>
          </div>
        `;
      }
    }
  }

  function createAdminActivityRow(activity) {
    const tr = document.createElement('tr');
    tr.className = 'admin-activity-row';
    tr.style.cursor = 'pointer';

    const member = activity.family_members;
    const memberName = member?.full_name || 'Unknown Member';
    const memberEmail = member?.email || '';

    const statusColors = {
      success: '#34d399',
      failed: '#ef4444',
      warning: '#fb923c',
    };
    const statusColor = statusColors[activity.status] || '#60a5fa';

    const date = new Date(activity.created_at);
    const formattedDate = date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    tr.innerHTML = `
      <td>
        <div style="font-weight: 600;">${escapeHtml(memberName)}</div>
        <div style="font-size: 12px; color: var(--muted);">${escapeHtml(memberEmail)}</div>
      </td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(formatActionType(activity.action_type))}</div>
        ${activity.action_description ? `<div style="font-size: 12px; color: var(--muted);">${escapeHtml(activity.action_description)}</div>` : ''}
      </td>
      <td>
        ${activity.target_type ? `<span style="padding: 4px 8px; border-radius: 6px; background: rgba(96,165,250,0.1); color: var(--blue); font-size: 12px;">${escapeHtml(activity.target_type)}</span>` : '—'}
      </td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(formattedDate)}</div>
        <div style="font-size: 12px; color: var(--muted);">${escapeHtml(formattedTime)}</div>
      </td>
      <td>
        <span style="display: inline-flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
          <span style="font-weight: 600; text-transform: uppercase; color: ${statusColor}; font-size: 12px;">${escapeHtml(activity.status)}</span>
        </span>
      </td>
      <td style="font-size: 12px; color: var(--muted);">
        ${escapeHtml(activity.device_info || '—')}
      </td>
    `;

    // Click to view details
    tr.addEventListener('click', () => {
      showActivityDetail(activity, member);
    });

    return tr;
  }

  function showActivityDetail(activity, member) {
    const date = new Date(activity.created_at);
    const metadata = activity.metadata || {};
    const metadataStr = Object.keys(metadata).length > 0 
      ? JSON.stringify(metadata, null, 2)
      : 'No additional metadata';

    const detailHtml = `
      <div style="display: grid; gap: 16px;">
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Member</div>
          <div style="font-weight: 600;">${escapeHtml(member?.full_name || 'Unknown')}</div>
          <div style="font-size: 13px; color: var(--muted);">${escapeHtml(member?.email || '')}</div>
        </div>
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Action</div>
          <div style="font-weight: 600;">${escapeHtml(formatActionType(activity.action_type))}</div>
        </div>
        ${activity.action_description ? `
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Description</div>
          <div>${escapeHtml(activity.action_description)}</div>
        </div>
        ` : ''}
        ${activity.target_type ? `
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Target</div>
          <div>${escapeHtml(activity.target_type)}</div>
        </div>
        ` : ''}
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Date & Time</div>
          <div>${date.toLocaleString()}</div>
        </div>
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Status</div>
          <div style="text-transform: uppercase; font-weight: 600;">${escapeHtml(activity.status)}</div>
        </div>
        ${activity.device_info ? `
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Device</div>
          <div>${escapeHtml(activity.device_info)}</div>
        </div>
        ` : ''}
        ${activity.ip_address ? `
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">IP Address</div>
          <div>${escapeHtml(activity.ip_address)}</div>
        </div>
        ` : ''}
        <div>
          <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Metadata</div>
          <pre style="background: rgba(148,163,184,0.1); padding: 12px; border-radius: 8px; font-size: 12px; overflow-x: auto;">${escapeHtml(metadataStr)}</pre>
        </div>
      </div>
    `;

    // Use existing overlay if available
    const overlay = document.getElementById('overlay');
    const dialogTitle = document.getElementById('dialogTitle');
    const dialogBody = document.getElementById('dialogBody');

    if (overlay && dialogTitle && dialogBody) {
      dialogTitle.textContent = 'Activity Details';
      dialogBody.innerHTML = detailHtml;
      overlay.hidden = false;
    } else {
      alert('Activity ID: ' + activity.id + '\n' + JSON.stringify(activity, null, 2));
    }
  }

  function formatActionType(actionType) {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

})();
