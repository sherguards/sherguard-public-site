(function () {
    'use strict';
  
    var API_BASE_URL = 'https://sherguard-api.onrender.com';
  
    function token() {
      return localStorage.getItem('aiTrustToken');
    }
  
    function setText(id, value) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = value || '—';
    }
  
    function apiGet(path) {
      return fetch(API_BASE_URL + path, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token()
        }
      }).then(function (response) {
        return response.json();
      });
    }
  
    function apiPost(path, body) {
      return fetch(API_BASE_URL + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token()
        },
        body: JSON.stringify(body)
      }).then(function (response) {
        return response.json();
      });
    }
  
    function apiDelete(path) {
      return fetch(API_BASE_URL + path, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token()
        }
      }).then(function (response) {
        return response.json();
      });
    }
  
    function getLocalUser() {
      try {
        var raw = localStorage.getItem('aiTrustUser');
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        return parsed.user || parsed || {};
      } catch {
        return {};
      }
    }
  
    async function loadProfile() {
        var user = getLocalUser();
      
        try {
          var me = await apiGet('/auth/me');
      
          if (me && me.user) {
            user = me.user;
            localStorage.setItem('aiTrustUser', JSON.stringify(user));
          }
        } catch (error) {
          console.error('Settings /auth/me failed:', error);
        }
      
        setText('settingsFullName', user.full_name || user.name || 'SherGuard User');
        setText('settingsEmail', user.email || 'Unavailable');
        setText('settingsRole', user.role || 'admin');
        setText('settingsAccountStatus', user.is_active === false ? 'Disabled' : 'Active');
        setText('settingsEmailVerified', user.is_verified === false ? 'Not Verified' : 'Verified');
        setText(
          'settingsMemberSince',
          user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'
        );
      
        try {
          var org = await apiGet('/organization/profile');
      
          var organizationName = 'SherGuard Organization';
          var planName = 'free';
      
          if (org && org.organization && typeof org.organization === 'object') {
            organizationName =
              org.organization.name ||
              org.organization.organization_name ||
              organizationName;
      
            planName =
              org.organization.plan ||
              planName;
          }
      
          setText('settingsOrganization', organizationName);
          setText('settingsPlan', planName);
      
        } catch (error) {
          console.error('Settings organization failed:', error);
          setText('settingsOrganization', 'Current Organization');
          setText('settingsPlan', 'free');
        }
      }
  
    function togglePassword(inputId, btn) {
      var input = document.getElementById(inputId);
      if (!input || !btn) return;
  
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Hide';
      } else {
        input.type = 'password';
        btn.textContent = 'Show';
      }
    }
  
    async function changePassword() {
      var currentPassword = document.getElementById('settingsCurrentPassword')?.value || '';
      var newPassword = document.getElementById('settingsNewPassword')?.value || '';
      var confirmPassword = document.getElementById('settingsConfirmPassword')?.value || '';
      var message = document.getElementById('settingsSecurityMessage');
  
      if (!currentPassword || !newPassword || !confirmPassword) {
        message.textContent = 'Please fill all password fields.';
        message.style.color = '#dc2626';
        return;
      }
  
      if (newPassword.length < 8) {
        message.textContent = 'New password must be at least 8 characters.';
        message.style.color = '#dc2626';
        return;
      }
  
      if (newPassword !== confirmPassword) {
        message.textContent = 'New password and confirmation do not match.';
        message.style.color = '#dc2626';
        return;
      }
  
      try {
        var result = await apiPost('/auth/change-password', {
          current_password: currentPassword,
          new_password: newPassword
        });
  
        if (!result.success) {
          message.textContent = result.message || 'Password change failed.';
          message.style.color = '#dc2626';
          return;
        }
  
        document.getElementById('settingsCurrentPassword').value = '';
        document.getElementById('settingsNewPassword').value = '';
        document.getElementById('settingsConfirmPassword').value = '';
  
        message.textContent = 'Password changed successfully.';
        message.style.color = '#16a34a';
  
      } catch (error) {
        message.textContent = 'Password change request failed.';
        message.style.color = '#dc2626';
        console.error('Password change failed:', error);
      }
    }
  
    function viewActiveSessions() {
      var sessionsBody = document.getElementById('teamSessionsTableBody');
      var section = document.querySelector('.team-management-card');
  
      if (section) {
        section.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
  
        section.classList.add('section-highlight');
  
        setTimeout(function () {
          section.classList.remove('section-highlight');
        }, 1600);
      }
  
      if (sessionsBody) {
        sessionsBody.closest('.team-invitations-block')?.classList.add('section-highlight');
      }
    }
  
    async function forceLogoutAllSessions() {
      var message = document.getElementById('settingsSessionMessage');
  
      if (!confirm('This will force logout all active sessions for your organization. Continue?')) {
        return;
      }
  
      try {
        var result = await apiDelete('/organization/sessions/force-logout-all');
  
        message.textContent = result.message || 'All sessions logged out.';
        message.style.color = '#16a34a';
  
      } catch (error) {
        message.textContent = 'Failed to force logout sessions.';
        message.style.color = '#dc2626';
        console.error('Force logout failed:', error);
      }
    }
  
    function bindSettingsEvents() {
      document.addEventListener('click', function (event) {
        if (event.target.id === 'showCurrentPasswordBtn') {
          togglePassword('settingsCurrentPassword', event.target);
        }
  
        if (event.target.id === 'showNewPasswordBtn') {
          togglePassword('settingsNewPassword', event.target);
        }
  
        if (event.target.id === 'showConfirmPasswordBtn') {
          togglePassword('settingsConfirmPassword', event.target);
        }
  
        if (event.target.id === 'settingsChangePasswordBtn') {
          changePassword();
        }
  
        if (event.target.id === 'settingsViewSessionsBtn') {
          viewActiveSessions();
        }
  
        if (event.target.id === 'settingsForceLogoutBtn') {
          forceLogoutAllSessions();
        }
      });
    }
  
    function initSettings() {
      bindSettingsEvents();
      loadProfile();
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSettings);
    } else {
      initSettings();
    }
  })();