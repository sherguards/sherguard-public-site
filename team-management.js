(function () {
  'use strict';

  /*
    SherGuard Team Management
    Backend-first module.

    - Team members load from backend /organization/users.
    - Invitations load from backend /team-invitations.
    - Sessions load from backend /organization/sessions.
    - Audit logs load from backend /organization/audit-logs.
    - No team data is stored in localStorage.
    - All actions are backend actions.
  */

  let teamUsers = [];
  let teamInvites = [];
  let teamSessions = [];
  let auditLogs = [];

  let userPage = 1;
  const pageSize = 5;

  function apiFetch(path, options) {
    return fetch('https://sherguard-api.onrender.com' + path, {
      ...(options || {}),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + localStorage.getItem('aiTrustToken'),
        ...((options && options.headers) || {})
      }
    }).then(async function (response) {
      const data = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(data.message || data.detail || 'Backend request failed.');
      }

      return data;
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'Unknown';

    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  }

  function setMessage(message, isError) {
    const el = document.getElementById('teamInviteMessage');
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? '#dc2626' : '#2563eb';
  }

  function ensureToolbar() {
    const tableWrap = document.querySelector('.team-management-card > .team-table-wrap');

    if (!tableWrap || document.getElementById('teamUserSearchInput')) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'team-management-toolbar';
    toolbar.innerHTML = `
      <input id="teamUserSearchInput" type="search" placeholder="Search users..." />
      <select id="teamUserRoleFilter">
        <option value="all">All roles</option>
        <option value="admin">Admin</option>
        <option value="analyst">Analyst</option>
        <option value="viewer">Viewer</option>
      </select>
      <select id="teamUserStatusFilter">
        <option value="all">All status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    `;

    tableWrap.insertAdjacentElement('beforebegin', toolbar);

    const pagination = document.createElement('div');
    pagination.id = 'teamUserPagination';
    pagination.className = 'team-pagination';
    tableWrap.insertAdjacentElement('afterend', pagination);

    toolbar.addEventListener('input', function () {
      userPage = 1;
      renderTeamMembers();
    });

    toolbar.addEventListener('change', function () {
      userPage = 1;
      renderTeamMembers();
    });
  }

  function ensureForceLogoutButton() {
    const header = document.querySelector('.team-session-header');

    if (!header || document.getElementById('forceLogoutSessionsBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'forceLogoutSessionsBtn';
    btn.type = 'button';
    btn.className = 'team-action-btn danger';
    btn.textContent = 'Force Logout All';

    header.appendChild(btn);
  }

  function ensureClearCancelledInvitesButton() {
    const invitationsBlock =
      document.getElementById('teamInvitationsTableBody')
        ?.closest('.team-invitations-block');

    if (!invitationsBlock || document.getElementById('clearCancelledInvitesBtn')) {
      return;
    }

    const title = invitationsBlock.querySelector('h4');

    if (!title) {
      return;
    }

    const header = document.createElement('div');
    header.className = 'team-session-header';

    title.parentNode.insertBefore(header, title);
    header.appendChild(title);

    const button = document.createElement('button');
    button.id = 'clearCancelledInvitesBtn';
    button.className = 'team-action-btn warning';
    button.type = 'button';
    button.textContent = 'Clear Cancelled Invitations';

    header.appendChild(button);
  }

  function getFilteredUsers() {
    const search = (
      document.getElementById('teamUserSearchInput')?.value || ''
    ).toLowerCase();

    const role = document.getElementById('teamUserRoleFilter')?.value || 'all';
    const status = document.getElementById('teamUserStatusFilter')?.value || 'all';

    return teamUsers.filter(function (user) {
      const matchesSearch =
        String(user.email || '').toLowerCase().includes(search) ||
        String(user.full_name || '').toLowerCase().includes(search);

      const matchesRole = role === 'all' || user.role === role;

      const matchesStatus =
        status === 'all' ||
        (status === 'active' && user.is_active) ||
        (status === 'inactive' && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  function renderTeamMembers() {
    const body = document.getElementById('teamMembersTableBody');

    if (!body) return;

    const filtered = getFilteredUsers();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    userPage = Math.min(userPage, totalPages);

    const start = (userPage - 1) * pageSize;
    const pageUsers = filtered.slice(start, start + pageSize);

    if (!pageUsers.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5">No team members found.</td>
        </tr>
      `;
      renderPagination(totalPages);
      return;
    }

    body.innerHTML = pageUsers.map(function (user) {
      const statusBadge = user.is_active
        ? '<span class="team-status-badge active">Active</span>'
        : '<span class="team-status-badge disabled">Disabled</span>';

      return `
        <tr>
          <td>${escapeHtml(user.full_name || 'Unnamed User')}</td>
          <td>${escapeHtml(user.email || 'Unknown')}</td>
          <td>
            <select class="team-role-select team-user-role-select" data-user-id="${user.id}">
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="analyst" ${user.role === 'analyst' ? 'selected' : ''}>Analyst</option>
              <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            </select>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="team-action-buttons">
              <button
                class="team-action-btn warning team-user-toggle-btn"
                data-user-id="${user.id}"
                data-active="${user.is_active ? 'false' : 'true'}"
              >
                ${user.is_active ? 'Disable' : 'Enable'}
              </button>

              <button
                class="team-action-btn danger team-user-remove-btn"
                data-user-id="${user.id}"
              >
                Remove
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const el = document.getElementById('teamUserPagination');

    if (!el) return;

    el.innerHTML = `
      <button class="team-action-btn primary" id="teamPrevPageBtn" ${userPage <= 1 ? 'disabled' : ''}>Previous</button>
      <span style="align-self:center;font-size:13px;font-weight:700;">Page ${userPage} of ${totalPages}</span>
      <button class="team-action-btn primary" id="teamNextPageBtn" ${userPage >= totalPages ? 'disabled' : ''}>Next</button>
    `;
  }

  async function loadTeamMembers() {
    const body = document.getElementById('teamMembersTableBody');

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="5">Loading team members from backend...</td>
      </tr>
    `;

    try {
      const data = await aiTrustApiGet('/organization/users');
      teamUsers = Array.isArray(data.users) ? data.users : [];

      ensureToolbar();
      renderTeamMembers();

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="5">Failed to load team members from backend.</td>
        </tr>
      `;

      console.error('Team members load failed:', error);
    }
  }

  async function loadTeamInvitations() {
    const body = document.getElementById('teamInvitationsTableBody');

    if (!body) return;

    ensureClearCancelledInvitesButton();

    body.innerHTML = `
      <tr>
        <td colspan="5">Loading invitations from backend...</td>
      </tr>
    `;

    try {
      const data = await aiTrustApiGet('/team-invitations');
      teamInvites = Array.isArray(data.invitations) ? data.invitations : [];

      if (!teamInvites.length) {
        body.innerHTML = `
          <tr>
            <td colspan="5">No invitations found.</td>
          </tr>
        `;
        return;
      }

      body.innerHTML = teamInvites.map(function (invite) {
        const canCancel = invite.status === 'pending';

        return `
          <tr>
            <td>${escapeHtml(invite.email || 'Unknown')}</td>
            <td><span class="team-role-badge">${escapeHtml(invite.role || 'viewer')}</span></td>
            <td><span class="team-status-badge pending">${escapeHtml(invite.status || 'pending')}</span></td>
            <td>${escapeHtml(invite.invited_by_email || 'Unknown')}</td>
            <td>
              ${
                canCancel
                  ? `
                    <button
                      class="team-action-btn danger team-cancel-invite-btn"
                      data-invite-id="${invite.id}"
                    >
                      Cancel
                    </button>
                  `
                  : '<span class="team-muted-action">No action</span>'
              }
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="5">Failed to load invitations from backend.</td>
        </tr>
      `;

      console.error('Invitation load failed:', error);
    }
  }

  async function loadTeamSessions() {
    const body = document.getElementById('teamSessionsTableBody');

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="13">Loading sessions from backend...</td>
      </tr>
    `;

    try {
      const data = await aiTrustApiGet('/organization/sessions');
      teamSessions = Array.isArray(data.sessions) ? data.sessions : [];

      let activeSessions = 0;
      let trustedSessions = 0;
      let highRiskSessions = 0;

      if (!teamSessions.length) {
        body.innerHTML = `
          <tr>
            <td colspan="13">No login sessions found.</td>
          </tr>
        `;

        updateSessionSummary(0, 0, 0, 0);
        return;
      }

      body.innerHTML = teamSessions.map(function (session) {
        const statusClass = session.is_active
          ? 'team-status-active'
          : 'team-status-inactive';

        const statusText = session.is_active ? 'Active' : 'Inactive';

        const lifecycleStatus = session.lifecycle_status || 'Active';
        const sessionRisk = session.risk_level || 'Trusted';
        const detectedThreat = session.detected_threat || 'Normal User Session';
        const securityRecommendation = session.security_recommendation || 'Allow Session';
        const riskScore = session.risk_score || 12;

        let riskClass = 'trusted';

        if (session.is_active) activeSessions += 1;

        if (sessionRisk === 'High Risk') {
          riskClass = 'high';
          highRiskSessions += 1;
        } else if (sessionRisk === 'Review') {
          riskClass = 'review';
        } else {
          trustedSessions += 1;
        }

        const userAgent = session.user_agent || 'Unknown';

        return `
          <tr>
            <td>${escapeHtml(session.email || 'Unknown')}</td>
            <td>${escapeHtml(session.ip_address || 'Unknown')}</td>
            <td title="${escapeHtml(userAgent)}">
              ${escapeHtml(userAgent.slice(0, 55))}${userAgent.length > 55 ? '...' : ''}
            </td>
            <td>${escapeHtml(session.login_method || 'Unknown')}</td>
            <td class="${statusClass}">${statusText}</td>
            <td>${escapeHtml(lifecycleStatus)}</td>
            <td><span class="team-risk-badge ${riskClass}">${escapeHtml(sessionRisk)}</span></td>
            <td>${escapeHtml(riskScore)}</td>
            <td>${escapeHtml(detectedThreat)}</td>
            <td>${escapeHtml(securityRecommendation)}</td>
            <td>${escapeHtml(session.last_activity_age || 'Unknown activity')}</td>
            <td>${formatDate(session.last_seen_at)}</td>
            <td>
              <div class="team-action-buttons">
                <button
                  class="team-action-btn danger team-session-revoke-btn"
                  type="button"
                  data-session-id="${session.id}"
                  ${session.is_active ? '' : 'disabled'}
                >
                  Revoke
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      updateSessionSummary(
        teamSessions.length,
        activeSessions,
        trustedSessions,
        highRiskSessions
      );

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="13">Failed to load sessions from backend.</td>
        </tr>
      `;

      console.error('Sessions load failed:', error);
    }
  }

  function updateSessionSummary(total, active, trusted, highRisk) {
    const totalSessionsText = document.getElementById('teamTotalSessions');
    const activeSessionsText = document.getElementById('teamActiveSessions');
    const trustedSessionsText = document.getElementById('teamTrustedSessions');
    const highRiskSessionsText = document.getElementById('teamHighRiskSessions');

    if (totalSessionsText) totalSessionsText.textContent = total;
    if (activeSessionsText) activeSessionsText.textContent = active;
    if (trustedSessionsText) trustedSessionsText.textContent = trusted;
    if (highRiskSessionsText) highRiskSessionsText.textContent = highRisk;
  }

  async function sendInvite() {
    const emailInput = document.getElementById('teamInviteEmailInput');
    const roleSelect = document.getElementById('teamInviteRoleSelect');

    const email = emailInput ? emailInput.value.trim() : '';
    const role = roleSelect ? roleSelect.value : 'viewer';

    if (!email) {
      setMessage('Enter an email address.', true);
      return;
    }

    try {
      const result = await aiTrustApiPost('/team-invitations', {
        email: email,
        role: role
      });

      if (!result.success) {
        setMessage(result.message || 'Invite failed.', true);
        return;
      }

      setMessage('Invitation sent successfully.', false);

      if (emailInput) emailInput.value = '';

      await loadTeamInvitations();
      await loadAuditLogs();

    } catch (error) {
      setMessage('Failed to send invitation.', true);
      console.error('Invite failed:', error);
    }
  }

  async function loadAuditLogs() {
    const body = document.getElementById('teamAuditLogsTableBody');

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="5">Loading audit logs from backend...</td>
      </tr>
    `;

    try {
      const data = await aiTrustApiGet('/organization/audit-logs');
      auditLogs = Array.isArray(data.logs) ? data.logs : [];

      if (!auditLogs.length) {
        body.innerHTML = `
          <tr>
            <td colspan="5">No audit logs yet.</td>
          </tr>
        `;
        return;
      }

      body.innerHTML = auditLogs.slice(0, 25).map(function (log) {
        const details = log.details
          ? JSON.stringify(log.details)
          : 'No details';

        return `
          <tr>
            <td>${formatDate(log.timestamp)}</td>
            <td>${escapeHtml(log.email || 'Unknown')}</td>
            <td><span class="team-role-badge">${escapeHtml(log.role || 'admin')}</span></td>
            <td><strong>${escapeHtml(log.action || 'Unknown action')}</strong></td>
            <td>${escapeHtml(details)}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="5">Failed to load audit logs from backend.</td>
        </tr>
      `;

      console.error('Audit logs load failed:', error);
    }
  }

  async function refreshTeamManagement() {
    await Promise.all([
      loadTeamMembers(),
      loadTeamInvitations(),
      loadTeamSessions(),
      loadAuditLogs()
    ]);
  }

  function bindEvents() {
    ensureForceLogoutButton();

    const inviteBtn = document.getElementById('teamInviteBtn');

    if (inviteBtn) {
      inviteBtn.addEventListener('click', sendInvite);
    }

    const clearAuditLogsBtn = document.getElementById('clearAuditLogsBtn');

    if (clearAuditLogsBtn) {
      clearAuditLogsBtn.addEventListener('click', async function () {
        if (!confirm('Clear all audit logs? One final clear_audit_logs record will remain.')) return;

        try {
          const result = await apiFetch('/organization/audit-logs', {
            method: 'DELETE'
          });

          alert(result.message || 'Audit logs cleared.');
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to clear audit logs.');
          console.error('Clear audit logs failed:', error);
        }
      });
    }

    const clearInactiveSessionsBtn = document.getElementById('clearInactiveSessionsBtn');

    if (clearInactiveSessionsBtn) {
      clearInactiveSessionsBtn.addEventListener('click', async function () {
        if (!confirm('Clear all inactive sessions?')) return;

        try {
          const result = await apiFetch('/organization/sessions/inactive', {
            method: 'DELETE'
          });

          alert(result.message || 'Inactive sessions cleared.');
          await loadTeamSessions();
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to clear inactive sessions.');
          console.error('Clear inactive sessions failed:', error);
        }
      });
    }

    document.addEventListener('click', async function (event) {
      const prevBtn = event.target.closest('#teamPrevPageBtn');
      const nextBtn = event.target.closest('#teamNextPageBtn');

      if (prevBtn) {
        userPage -= 1;
        renderTeamMembers();
        return;
      }

      if (nextBtn) {
        userPage += 1;
        renderTeamMembers();
        return;
      }

      const removeBtn = event.target.closest('.team-user-remove-btn');

      if (removeBtn) {
        const userId = removeBtn.getAttribute('data-user-id');

        if (!confirm('Remove this user from the organization?')) return;

        try {
          const result = await apiFetch('/organization/users/' + userId, {
            method: 'DELETE'
          });

          alert(result.message || 'User removed.');
          await loadTeamMembers();
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to remove user.');
          console.error('Remove user failed:', error);
        }

        return;
      }

      const toggleBtn = event.target.closest('.team-user-toggle-btn');

      if (toggleBtn) {
        const userId = toggleBtn.getAttribute('data-user-id');
        const isActive = toggleBtn.getAttribute('data-active') === 'true';

        try {
          const result = await apiFetch('/organization/users/' + userId + '/status', {
            method: 'PATCH',
            body: JSON.stringify({
              is_active: isActive
            })
          });

          alert(result.message || 'User status updated.');
          await loadTeamMembers();
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to update user status.');
          console.error('Update user status failed:', error);
        }

        return;
      }

      const clearCancelledInvitesBtn = event.target.closest('#clearCancelledInvitesBtn');

      if (clearCancelledInvitesBtn) {
        if (!confirm('Clear all cancelled invitations?')) return;

        try {
          const result = await apiFetch('/team-invitations/cancelled', {
            method: 'DELETE'
          });

          alert(result.message || 'Cancelled invitations cleared.');
          await loadTeamInvitations();
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to clear cancelled invitations.');
          console.error('Clear cancelled invitations failed:', error);
        }

        return;
      }

      const cancelInviteBtn = event.target.closest('.team-cancel-invite-btn');

      if (cancelInviteBtn) {
        const inviteId = cancelInviteBtn.getAttribute('data-invite-id');

        if (!confirm('Cancel this invitation?')) return;

        try {
          const result = await apiFetch('/team-invitations/' + inviteId, {
            method: 'DELETE'
          });

          alert(result.message || 'Invitation cancelled.');
          await loadTeamInvitations();
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to cancel invitation.');
          console.error('Cancel invitation failed:', error);
        }

        return;
      }

      const revokeBtn = event.target.closest('.team-session-revoke-btn');

      if (revokeBtn) {
        const sessionId = revokeBtn.getAttribute('data-session-id');

        if (!confirm('Revoke this login session?')) return;

        try {
          const result = await apiFetch('/organization/sessions/' + sessionId + '/status', {
            method: 'PATCH',
            body: JSON.stringify({
              is_active: false
            })
          });

          alert(result.message || 'Session revoked.');
          await loadTeamSessions();
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to revoke session.');
          console.error('Revoke session failed:', error);
        }

        return;
      }

      const forceBtn = event.target.closest('#forceLogoutSessionsBtn');

      if (forceBtn) {
        if (!confirm('Force logout all active sessions?')) return;

        try {
          const result = await apiFetch('/organization/sessions/force-logout-all', {
            method: 'DELETE'
          });

          alert(result.message || 'All sessions logged out.');
          await loadTeamSessions();
          await loadAuditLogs();

        } catch (error) {
          alert(error.message || 'Failed to force logout sessions.');
          console.error('Force logout failed:', error);
        }
      }
    });

    document.addEventListener('change', async function (event) {
      const roleSelect = event.target.closest('.team-user-role-select');

      if (!roleSelect) return;

      const userId = roleSelect.getAttribute('data-user-id');
      const role = roleSelect.value;

      try {
        const result = await apiFetch('/organization/users/' + userId + '/role', {
          method: 'PATCH',
          body: JSON.stringify({
            role: role
          })
        });

        alert(result.message || 'User role updated.');
        await loadTeamMembers();
        await loadAuditLogs();

      } catch (error) {
        alert(error.message || 'Failed to update user role.');
        console.error('Update user role failed:', error);
        await loadTeamMembers();
      }
    });

    window.addEventListener('aiTrustOsActivityUpdated', function () {
      setTimeout(function () {
        refreshTeamManagement();
      }, 500);
    });
  }

  function init() {
    if (!document.getElementById('teamMembersTableBody')) {
      return;
    }

    bindEvents();
    refreshTeamManagement();
  }

  window.SherGuardTeamManagement = {
    refresh: refreshTeamManagement,
    loadTeamMembers: loadTeamMembers,
    loadTeamInvitations: loadTeamInvitations,
    loadTeamSessions: loadTeamSessions,
    loadAuditLogs: loadAuditLogs
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();