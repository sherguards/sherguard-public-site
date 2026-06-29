(function () {
    'use strict';
  
    const API_BASE_URL = 'https://sherguard-api.onrender.com';
  
    function getToken() {
      return (
        localStorage.getItem('sherguard_token') ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        ''
      );
    }
  
    function requireOwnerSession() {
      const token = getToken();
  
      if (!token) {
        window.location.href = '../login.html';
        return false;
      }
  
      return true;
    }
  
    async function request(path, options) {
      const token = getToken();
  
      if (!token) {
        window.location.href = '../login.html';
        throw new Error('Owner login required.');
      }
  
      const response = await fetch(API_BASE_URL + path, {
        method: options && options.method ? options.method : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: options && options.body
          ? JSON.stringify(options.body)
          : undefined
      });
  
      let data = {};
  
      try {
        data = await response.json();
      } catch (error) {
        data = {};
      }
  
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          data.detail ||
          data.message ||
          'Owner permission required.'
        );
      }
  
      if (!response.ok || data.success === false) {
        throw new Error(
          data.detail ||
          data.message ||
          'Admin request failed.'
        );
      }
  
      return data;
    }
  
    function logout() {
      localStorage.removeItem('sherguard_token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      window.location.href = '../login.html';
    }
  
    function money(value) {
      return '$' + Number(value || 0).toFixed(2);
    }
  
    function formatDate(value) {
      if (!value) {
        return '—';
      }
  
      try {
        return new Date(value).toLocaleDateString();
      } catch (error) {
        return '—';
      }
    }
  
    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function statusBadge(status) {
      const safeStatus = escapeHtml(status || 'unknown');
  
      return '<span class="admin-status admin-status-' +
        safeStatus.toLowerCase() +
        '">' +
        safeStatus +
        '</span>';
    }
  
    function showError(message) {
      alert(message || 'Something went wrong.');
    }
  
    window.SherGuardAffiliateAdmin = {
      API_BASE_URL: API_BASE_URL,
      getToken: getToken,
      requireOwnerSession: requireOwnerSession,
      request: request,
      logout: logout,
      money: money,
      formatDate: formatDate,
      escapeHtml: escapeHtml,
      statusBadge: statusBadge,
      showError: showError,
  
      getDashboard: function () {
        return request('/affiliate-admin/dashboard');
      },
  
      getAffiliates: function () {
        return request('/affiliate-admin/affiliates');
      },
  
      updateAffiliateStatus: function (affiliateId, status) {
        return request('/affiliate-admin/affiliates/' + affiliateId, {
          method: 'PATCH',
          body: {
            status: status
          }
        });
      },
  
      getCommissions: function () {
        return request('/affiliate-admin/commissions');
      },
  
      updateCommissionStatus: function (commissionId, status) {
        return request('/affiliate-admin/commissions/' + commissionId, {
          method: 'PATCH',
          body: {
            status: status
          }
        });
      },
  
      getPayouts: function () {
        return request('/affiliate-admin/payouts');
      },
  
      updatePayoutStatus: function (payoutId, status) {
        return request('/affiliate-admin/payouts/' + payoutId, {
          method: 'PATCH',
          body: {
            status: status
          }
        });
      },
  
      getFraudReview: function () {
        return request('/affiliate-admin/fraud-review');
      }
    };
  
    window.addEventListener('DOMContentLoaded', function () {
      const logoutButton = document.getElementById('logoutButton');
  
      if (logoutButton) {
        logoutButton.addEventListener('click', logout);
      }
    });
  })();