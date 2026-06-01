(function () {
  'use strict';

  let teamUsers = [];
  let teamInvites = [];
  let teamSessions = [];

  let userPage = 1;
  const pageSize = 5;

  function apiFetch(path, options) {
    return fetch('https://sherguard-api.onrender.com' + path, {
      ...(options || {}),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('aiTrustToken'),
        ...((options && options.headers) || {})
      }
    }).then(function (response) {
      return response.json();
    });
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
          <td>${user.full_name || 'Unnamed User'}</td>
          <td>${user.email}</td>
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

    try {
      const data = await aiTrustApiGet('/organization/users');
      teamUsers = data.users || [];

      ensureToolbar();
      renderTeamMembers();

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="5">Failed to load team members.</td>
        </tr>
      `;

      console.error('Team members load failed:', error);
    }
  }

  async function loadTeamInvitations() {
    const body = document.getElementById('teamInvitationsTableBody');

    if (!body) return;

    try {
      const data = await aiTrustApiGet('/team-invitations');
      teamInvites = data.invitations || [];

      if (!teamInvites.length) {
        body.innerHTML = `
          <tr>
            <td colspan="5">No pending invitations.</td>
          </tr>
        `;
        return;
      }

      body.innerHTML = teamInvites.map(function (invite) {
        const canCancel = invite.status === 'pending';

        return `
          <tr>
            <td>${invite.email}</td>
            <td><span class="team-role-badge">${invite.role}</span></td>
            <td><span class="team-status-badge pending">${invite.status}</span></td>
            <td>${invite.invited_by_email || 'Unknown'}</td>
            <td>
              <button
                class="team-action-btn danger team-cancel-invite-btn"
                data-invite-id="${invite.id}"
                ${canCancel ? '' : 'disabled'}
              >
                Cancel
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="5">Failed to load invitations.</td>
        </tr>
      `;

      console.error('Invitation load failed:', error);
    }
  }

  async function loadTeamSessions() {
    const body = document.getElementById('teamSessionsTableBody');

    if (!body) return;

    try {
      const data = await aiTrustApiGet('/organization/sessions');
      teamSessions = data.sessions || [];

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

        return `
          <tr>
            <td>${session.email || 'Unknown'}</td>
            <td>${session.ip_address || 'Unknown'}</td>
            <td title="${session.user_agent || 'Unknown'}">
              ${(session.user_agent || 'Unknown').slice(0, 55)}...
            </td>
            <td>${session.login_method || 'Unknown'}</td>
            <td class="${statusClass}">${statusText}</td>
            <td>${lifecycleStatus}</td>
            <td><span class="team-risk-badge ${riskClass}">${sessionRisk}</span></td>
            <td>${riskScore}</td>
            <td>${detectedThreat}</td>
            <td>${securityRecommendation}</td>
            <td>${session.last_activity_age || 'Unknown activity'}</td>
            <td>
              ${
                session.last_seen_at
                  ? new Date(session.last_seen_at).toLocaleString()
                  : 'Unknown'
              }
            </td>
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
          <td colspan="13">Failed to load sessions.</td>
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

      loadTeamInvitations();

    } catch (error) {
      setMessage('Failed to send invitation.', true);
      console.error('Invite failed:', error);
    }
  }

  async function loadAuditLogs() {
    const body = document.getElementById('teamAuditLogsTableBody');

    if (!body) return;

    try {
      const data = await aiTrustApiGet('/organization/audit-logs');
      const logs = data.logs || [];

      if (!logs.length) {
        body.innerHTML = `
          <tr>
            <td colspan="5">No audit logs yet.</td>
          </tr>
        `;
        return;
      }

      body.innerHTML = logs.slice(0, 25).map(function (log) {
        const details = log.details
          ? JSON.stringify(log.details)
          : 'No details';

        return `
          <tr>
            <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown'}</td>
            <td>${log.email || 'Unknown'}</td>
            <td><span class="team-role-badge">${log.role || 'admin'}</span></td>
            <td><strong>${log.action || 'Unknown action'}</strong></td>
            <td>${details}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="5">Failed to load audit logs.</td>
        </tr>
      `;

      console.error('Audit logs load failed:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
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
      loadAuditLogs();

    } catch (error) {
      alert('Failed to clear audit logs.');
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
          loadTeamSessions();

        } catch (error) {
          alert('Failed to clear inactive sessions.');
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

        const result = await apiFetch('/organization/users/' + userId, {
          method: 'DELETE'
        });

        alert(result.message || 'User removed.');
        loadTeamMembers();
        return;
      }

      const toggleBtn = event.target.closest('.team-user-toggle-btn');

      if (toggleBtn) {
        const userId = toggleBtn.getAttribute('data-user-id');
        const isActive = toggleBtn.getAttribute('data-active') === 'true';

        const result = await apiFetch('/organization/users/' + userId + '/status', {
          method: 'PATCH',
          body: JSON.stringify({
            is_active: isActive
          })
        });

        alert(result.message || 'User status updated.');
        loadTeamMembers();
        return;
      }

      const cancelInviteBtn = event.target.closest('.team-cancel-invite-btn');

      if (cancelInviteBtn) {
        const inviteId = cancelInviteBtn.getAttribute('data-invite-id');

        if (!confirm('Cancel this invitation?')) return;

        const result = await apiFetch('/team-invitations/' + inviteId, {
          method: 'DELETE'
        });

        alert(result.message || 'Invitation cancelled.');
        loadTeamInvitations();
        return;
      }

      const revokeBtn = event.target.closest('.team-session-revoke-btn');

      if (revokeBtn) {
        const sessionId = revokeBtn.getAttribute('data-session-id');

        if (!confirm('Revoke this login session?')) return;

        const result = await apiFetch('/organization/sessions/' + sessionId + '/status', {
          method: 'PATCH',
          body: JSON.stringify({
            is_active: false
          })
        });

        alert(result.message || 'Session revoked.');
        loadTeamSessions();
        return;
      }

      const forceBtn = event.target.closest('#forceLogoutSessionsBtn');

      if (forceBtn) {
        if (!confirm('Force logout all active sessions?')) return;

        const result = await apiFetch('/organization/sessions/force-logout-all', {
          method: 'DELETE'
        });

        alert(result.message || 'All sessions logged out.');
        loadTeamSessions();
      }
    });

    document.addEventListener('change', async function (event) {
      const roleSelect = event.target.closest('.team-user-role-select');

      if (!roleSelect) return;

      const userId = roleSelect.getAttribute('data-user-id');
      const role = roleSelect.value;

      const result = await apiFetch('/organization/users/' + userId + '/role', {
        method: 'PATCH',
        body: JSON.stringify({
          role: role
        })
      });

      alert(result.message || 'User role updated.');
      loadTeamMembers();
    });

    loadTeamMembers();
    loadTeamInvitations();
    loadTeamSessions();
    loadAuditLogs();
  });
})();