(function () {
    'use strict';
  
    function setText(id, value) {
      const el = document.getElementById(id);
  
      if (!el) {
        return;
      }
  
      el.textContent = value || '—';
    }
  
    function getStoredUser() {
      try {
        const raw = localStorage.getItem('aiTrustUser');
  
        if (!raw) {
          return null;
        }
  
        const data = JSON.parse(raw);
  
        if (data && data.user) {
          return data.user;
        }
  
        return data;
      } catch {
        return null;
      }
    }
  
    async function loadSettingsProfile() {
      let user = getStoredUser();
  
      try {
        const me = await aiTrustApiGet('/auth/me');
  
        if (me && me.user) {
          user = me.user;
  
          localStorage.setItem(
            'aiTrustUser',
            JSON.stringify(user)
          );
        }
      } catch (error) {
        console.error(
          'Settings profile sync failed:',
          error
        );
      }
  
      if (!user) {
        setText('settingsFullName', 'Unavailable');
        setText('settingsEmail', 'Unavailable');
        setText('settingsRole', 'Unavailable');
        setText('settingsOrganization', 'Unavailable');
        setText('settingsPlan', 'Unavailable');
        setText('settingsAccountStatus', 'Unavailable');
        setText('settingsEmailVerified', 'Unavailable');
        setText('settingsMemberSince', 'Unavailable');
        return;
      }
  
      setText(
        'settingsFullName',
        user.full_name || user.name || 'Unnamed User'
      );
  
      setText(
        'settingsEmail',
        user.email || 'No email available'
      );
  
      setText(
        'settingsRole',
        user.role || 'admin'
      );
  
      setText(
        'settingsAccountStatus',
        user.is_active === false ? 'Disabled' : 'Active'
      );
  
      setText(
        'settingsEmailVerified',
        user.is_verified === false ? 'Not Verified' : 'Verified'
      );
  
      setText(
        'settingsMemberSince',
        user.created_at
          ? new Date(user.created_at).toLocaleDateString()
          : '—'
      );
  
      try {
        const organization = await aiTrustApiGet('/organization/profile');
  
        if (organization) {
          setText(
            'settingsOrganization',
            organization.organization_name ||
            organization.name ||
            organization.organization ||
            'SherGuard Organization'
          );
  
          setText(
            'settingsPlan',
            organization.plan || 'free'
          );
        }
      } catch (error) {
        setText('settingsOrganization', 'Current Organization');
        setText('settingsPlan', 'free');
  
        console.error(
          'Settings organization sync failed:',
          error
        );
      }
    }
  
    function scrollToSessions() {
      const section = document.querySelector('.team-management-card');
  
      if (!section) {
        return;
      }
  
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
  
      section.classList.add('section-highlight');
  
      setTimeout(function () {
        section.classList.remove('section-highlight');
      }, 1600);
    }
  
    async function forceLogoutAllSessions() {
      const message = document.getElementById('settingsSessionMessage');
  
      if (!confirm('Force logout all active sessions for this organization?')) {
        return;
      }
  
      try {
        const result = await fetch(
          'https://sherguard-api.onrender.com/organization/sessions/force-logout-all',
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization':
                'Bearer ' + localStorage.getItem('aiTrustToken')
            }
          }
        ).then(function (response) {
          return response.json();
        });
  
        if (message) {
          message.textContent =
            result.message || 'All sessions were logged out.';
          message.style.color = '#16a34a';
        }
  
        setTimeout(function () {
          window.location.reload();
        }, 900);
  
      } catch (error) {
        if (message) {
          message.textContent = 'Failed to force logout sessions.';
          message.style.color = '#dc2626';
        }
  
        console.error(
          'Settings force logout failed:',
          error
        );
      }
    }
  
    function initSettings() {
      const changePasswordBtn =
        document.getElementById('settingsChangePasswordBtn');
  
      const viewSessionsBtn =
        document.getElementById('settingsViewSessionsBtn');
  
      const forceLogoutBtn =
        document.getElementById('settingsForceLogoutBtn');
  
      if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function () {
          const message =
            document.getElementById('settingsSecurityMessage');
  
          if (message) {
            message.textContent =
              'Change Password will be enabled in the next backend phase.';
            message.style.color = '#2563eb';
          }
        });
      }
  
      if (viewSessionsBtn) {
        viewSessionsBtn.addEventListener('click', scrollToSessions);
      }
  
      if (forceLogoutBtn) {
        forceLogoutBtn.addEventListener(
          'click',
          forceLogoutAllSessions
        );
      }
  
      loadSettingsProfile();
    }
  
    document.addEventListener('DOMContentLoaded', initSettings);
  })();