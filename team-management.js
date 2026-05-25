(function () {
  'use strict';

  async function loadTeamMembers() {
    const body = document.getElementById('teamMembersTableBody');

    if (!body) return;

    try {
      const data = await aiTrustApiGet('/organization/users');
      const users = data.users || [];

      if (!users.length) {
        body.innerHTML = `
          <tr>
            <td colspan="4">No team members found.</td>
          </tr>
        `;
        return;
      }

      body.innerHTML = users.map(function (user) {
        const statusClass = user.is_active
          ? 'team-status-active'
          : 'team-status-inactive';

        const statusText = user.is_active
          ? 'Active'
          : 'Inactive';

        return `
          <tr>
            <td>${user.full_name || 'Unnamed User'}</td>
            <td>${user.email}</td>
            <td><span class="team-role-badge">${user.role}</span></td>
            <td class="${statusClass}">${statusText}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="4">Failed to load team members.</td>
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
      const invitations = data.invitations || [];

      if (!invitations.length) {
        body.innerHTML = `
          <tr>
            <td colspan="4">No pending invitations.</td>
          </tr>
        `;
        return;
      }

      body.innerHTML = invitations.map(function (invite) {
        return `
          <tr>
            <td>${invite.email}</td>
            <td><span class="team-role-badge">${invite.role}</span></td>
            <td>${invite.status}</td>
            <td>${invite.invited_by_email || 'Unknown'}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="4">Failed to load invitations.</td>
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
      const sessions = data.sessions || [];

      let activeSessions = 0;
      let trustedSessions = 0;
      let highRiskSessions = 0;

      if (!sessions.length) {
        body.innerHTML = `
          <tr>
            <td colspan="12">No login sessions found.</td>
          </tr>
        `;

        updateSessionSummary(0, 0, 0, 0);
        return;
      }

      body.innerHTML = sessions.map(function (session) {
        const statusClass = session.is_active
          ? 'team-status-active'
          : 'team-status-inactive';

        const statusText = session.is_active
          ? 'Active'
          : 'Inactive';

          let lifecycleStatus = session.lifecycle_status || 'Active';
let sessionRisk = session.risk_level || 'Trusted';
let sessionRiskClass = 'team-status-active';
let detectedThreat = session.detected_threat || 'Normal User Session';
let securityRecommendation = session.security_recommendation || 'Allow Session';
let riskScore = session.risk_score || 12;

        const userAgent = String(session.user_agent || '').toLowerCase();
        const ipAddress = String(session.ip_address || '');

        if (session.is_active) {
          activeSessions += 1;
        }

        if (sessionRisk === 'High Risk') {
          sessionRiskClass = 'team-status-inactive';
          highRiskSessions += 1;
        } else if (sessionRisk === 'Review') {
          sessionRiskClass = 'team-role-badge';
        } else {
          sessionRiskClass = 'team-status-active';
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
            <td class="${sessionRiskClass}">${sessionRisk}</td>
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
          </tr>
        `;
      }).join('');

      updateSessionSummary(
        sessions.length,
        activeSessions,
        trustedSessions,
        highRiskSessions
      );

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="12">Failed to load sessions.</td>
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

  document.addEventListener('DOMContentLoaded', function () {
  const clearInactiveSessionsBtn = document.getElementById('clearInactiveSessionsBtn');

if (clearInactiveSessionsBtn) {
  clearInactiveSessionsBtn.addEventListener('click', async function () {
    if (!confirm('Clear all inactive sessions?')) {
      return;
    }

    try {
      const response = await fetch(
        'https://sherguard-api.onrender.com/organization/sessions/inactive',
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('aiTrustToken')
          }
        }
      );

      const result = await response.json();

      alert(result.message || 'Inactive sessions cleared.');

      loadTeamSessions();

    } catch (error) {
      alert('Failed to clear inactive sessions.');
      console.error('Clear inactive sessions failed:', error);
    }
  });
}
    loadTeamMembers();
    loadTeamInvitations();
    loadTeamSessions();
  });
})();