(function () {
    'use strict';
  
    const API_BASE_URL = 'https://sherguard-api.onrender.com';
  
    function setText(id, value) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value || '—';
    }
  
    function getToken() {
      return localStorage.getItem('aiTrustToken');
    }
  
    async function apiGet(path) {
      const response = await fetch(API_BASE_URL + path, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        }
      });
  
      return response.json();
    }
  
    async function apiPost(path, body) {
      const response = await fetch(API_BASE_URL + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify(body)
      });
  
      return response.json();
    }
  
    function normalizeUser(data) {
      if (!data) return null;
      if (data.user) return data.user;
      return data;
    }
  
    async function loadSettingsProfile() {
      try {
        const meData = await apiGet('/auth/me');
        const user = normalizeUser(meData);
  
        setText('settingsFullName', user.full_name || user.name || 'SherGuard User');
        setText('settingsEmail', user.email || 'No email available');
        setText('settingsRole', user.role || 'admin');
        setText('settingsAccountStatus', user.is_active === false ? 'Disabled' : 'Active');
        setText('settingsEmailVerified', user.is_verified === false ? 'Not Verified' : 'Verified');
        setText(
          'settingsMemberSince',
          user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'
        );
  
        localStorage.setItem('aiTrustUser', JSON.stringify(user));
  
      } catch (error) {
        console.error('Settings user load failed:', error);
  
        const stored = JSON.parse(localStorage.getItem('aiTrustUser') || '{}');
  
        setText('settingsFullName', stored.full_name || 'SherGuard User');
        setText('settingsEmail', stored.email || 'Unavailable');
        setText('settingsRole', stored.role || 'admin');
        setText('settingsAccountStatus', 'Active');
        setText('settingsEmailVerified', 'Verified');
        setText('settingsMemberSince', '—');
      }
  
      try {
        const orgData = await apiGet('/organization/profile');
  
        setText(
          'settingsOrganization',
          orgData.organization_name ||
          orgData.name ||
          orgData.organization ||
          'SherGuard Organization'
        );
  
        setText('settingsPlan', orgData.plan || 'free');
  
      } catch (error) {
        console.error('Settings organization load failed:', error);
        setText('settingsOrganization', 'Current Organization');
        setText('settingsPlan', 'free');
      }
    }
  
    function togglePasswordVisibility(buttonId, inputId) {
      const btn = document.getElementById(buttonId);
      const input = document.getElementById(inputId);
  
      if (!btn || !input) return;
  
      btn.addEventListener('click', function () {
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
      });
    }
  
    async function changePassword() {
      const currentPassword = document.getElementById('settingsCurrentPassword')?.value || '';
      const newPassword = document.getElementById('settingsNewPassword')?.value || '';
      const confirmPassword = document.getElementById('settingsConfirmPassword')?.value || '';
      const message = document.getElementById('settingsSecurityMessage');
  
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
        const result = await apiPost('/auth/change-password', {
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
  
    function scrollToSessions() {
      const section = document.querySelector('.team-management-card');
      if (!section) return;
  
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.classList.add('section-highlight');
  
      setTimeout(function () {
        section.classList.remove('section-highlight');
      }, 1600);
    }
  
    function initSettings() {
      const changePasswordBtn = document.getElementById('settingsChangePasswordBtn');
      const viewSessionsBtn = document.getElementById('settingsViewSessionsBtn');
  
      if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', changePassword);
      }
  
      if (viewSessionsBtn) {
        viewSessionsBtn.addEventListener('click', scrollToSessions);
      }
  
      togglePasswordVisibility('showCurrentPasswordBtn', 'settingsCurrentPassword');
      togglePasswordVisibility('showNewPasswordBtn', 'settingsNewPassword');
      togglePasswordVisibility('showConfirmPasswordBtn', 'settingsConfirmPassword');
  
      loadSettingsProfile();
    }
  
    document.addEventListener('DOMContentLoaded', initSettings);
  })();