(function () {
  'use strict';

  const API_BASE_URL =
    'https://sherguard-api.onrender.com';

  const token =
    localStorage.getItem('aiTrustToken');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  async function validateSession() {
    try {
      const response = await fetch(
        API_BASE_URL + '/auth/me',
        {
          method: 'GET',
          headers: {
            'Authorization':
              'Bearer ' + token,
            'Content-Type':
              'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Session expired');
      }

      const user =
        await response.json();

      localStorage.setItem(
        'aiTrustUser',
        JSON.stringify(user)
      );

      applyModuleVisibility(user);

    } catch (error) {
      localStorage.removeItem(
        'aiTrustToken'
      );

      localStorage.removeItem(
        'aiTrustUser'
      );

      window.location.href =
        'login.html';
    }
  }

  function applyModuleVisibility(user) {
    const enabledModules = (
      user.enabled_modules || ''
    ).split(',');

    const moduleVisibilityMap = {
      email_risk: 'email-risk',
      device_risk: 'device-risk-module',
      bot_detection: 'bot-detection',
      api_abuse: 'api-abuse',
      payment_fraud: 'payment-fraud'
    };

    Object.keys(
      moduleVisibilityMap
    ).forEach(function (moduleKey) {

      const sectionId =
        moduleVisibilityMap[moduleKey];

      const navButton =
        document.querySelector(
          '[data-scroll-target="' +
          sectionId +
          '"]'
        );

      const section =
        document.getElementById(
          sectionId
        );

      const enabled =
        enabledModules.includes(
          moduleKey
        );

      if (!enabled) {
        if (navButton) {
          navButton.style.display =
            'none';
        }

        if (section) {
          section.style.display =
            'none';
        }
      }
    });
  }

  validateSession();
})();