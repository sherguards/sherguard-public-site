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
  
      const data = await response.json();
  
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
  
    window.SherGuardAffiliateAdmin = {
      API_BASE_URL: API_BASE_URL,
      getToken: getToken,
      requireOwnerSession: requireOwnerSession,
      request: request,
      logout: logout,
      money: money,
      formatDate: formatDate
    };
  
    window.addEventListener('DOMContentLoaded', function () {
      const logoutButton = document.getElementById('logoutButton');
  
      if (logoutButton) {
        logoutButton.addEventListener('click', logout);
      }
    });
  })();