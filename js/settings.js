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
        console.error('Settings profile sync failed:', error);
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
  
      setText('settingsFullName', user.full_name || user.name || 'Unnamed User');
      setText('settingsEmail', user.email || 'No email available');
      setText('settingsRole', user.role || 'admin');
      setText('settingsAccountStatus', user.is_active === false ? 'Disabled' : 'Active');
      setText('settingsEmailVerified', user.is_verified === false ? 'Not Verified' : 'Verified');
      setText(
        'settingsMemberSince',
        user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'
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
  
          setText('settingsPlan', organization.plan || 'free');
        }
      } catch (error) {
        setText('settingsOrganization', 'Current Organization');
        setText('settingsPlan', 'free');
  
        console.error('Settings organization sync failed:', error);
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
              'Authorization': 'Bearer ' + localStorage.getItem('aiTrustToken')
            }
          }
        ).then(function (response) {
          return response.json();
        });
  
        if (message) {
          message.textContent = result.message || 'All sessions were logged out.';
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
  
        console.error('Settings force logout failed:', error);
      }
    }
  
    async function changePassword() {
      const currentPassword =
        document.getElementById('settingsCurrentPassword')?.value || '';
  
      const newPassword =
        document.getElementById('settingsNewPassword')?.value || '';
  
      const confirmPassword =
        document.getElementById('settingsConfirmPassword')?.value || '';
  
      const message =
        document.getElementById('settingsSecurityMessage');
  
      if (!currentPassword || !newPassword || !confirmPassword) {
        if (message) {
          message.textContent = 'Please fill all password fields.';
          message.style.color = '#dc2626';
        }
        return;
      }
  
      if (newPassword.length < 8) {
        if (message) {
          message.textContent = 'New password must be at least 8 characters.';
          message.style.color = '#dc2626';
        }
        return;
      }
  
      if (newPassword !== confirmPassword) {
        if (message) {
          message.textContent = 'New password and confirmation do not match.';
          message.style.color = '#dc2626';
        }
        return;
      }
  
      try {
        const result = await aiTrustApiPost('/auth/change-password', {
          current_password: currentPassword,
          new_password: newPassword
        });
  
        if (!result.success) {
          if (message) {
            message.textContent = result.message || 'Password change failed.';
            message.style.color = '#dc2626';
          }
          return;
        }
  
        document.getElementById('settingsCurrentPassword').value = '';
        document.getElementById('settingsNewPassword').value = '';
        document.getElementById('settingsConfirmPassword').value = '';
  
        if (message) {
          message.textContent = 'Password changed successfully.';
          message.style.color = '#16a34a';
        }
  
      } catch (error) {
        if (message) {
          message.textContent = 'Password change request failed.';
          message.style.color = '#dc2626';
        }
  
        console.error('Password change failed:', error);
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
        changePasswordBtn.addEventListener('click', changePassword);
      }
  
      if (viewSessionsBtn) {
        viewSessionsBtn.addEventListener('click', scrollToSessions);
      }
  
      if (forceLogoutBtn) {
        forceLogoutBtn.addEventListener('click', forceLogoutAllSessions);
      }
  
      loadSettingsProfile();
    }
  
    document.addEventListener('DOMContentLoaded', initSettings);
  })();