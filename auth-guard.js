(function () {
  'use strict';

  const API_BASE_URL =
    'https://sherguard-api.onrender.com';

  const IDLE_TIMEOUT_MS =
    30 * 60 * 1000;

  let idleTimer = null;

  const token =
    localStorage.getItem('aiTrustToken');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  function clearAuthAndRedirect(reason) {
    localStorage.removeItem(
      'aiTrustToken'
    );

    localStorage.removeItem(
      'aiTrustUser'
    );

    if (reason) {
      sessionStorage.setItem(
        'sherGuardLogoutReason',
        reason
      );
    }

    window.location.href =
      'login.html';
  }

  function resetIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    idleTimer = setTimeout(function () {
      clearAuthAndRedirect(
        'Your session was logged out after 30 minutes of inactivity.'
      );
    }, IDLE_TIMEOUT_MS);
  }

  function bindIdleEvents() {
    [
      'click',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart'
    ].forEach(function (eventName) {
      window.addEventListener(
        eventName,
        resetIdleTimer,
        {
          passive: true
        }
      );
    });

    resetIdleTimer();
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

      const result =
  await response.json();

const user =
  result && result.user
    ? result.user
    : result;

localStorage.setItem(
  'aiTrustUser',
  JSON.stringify(user)
);

applyModuleVisibility(user);

    } catch (error) {
      clearAuthAndRedirect(
        'Your session expired. Please log in again.'
      );
    }
  }

  function applyModuleVisibility(user) {
    const enabledModules = (
      user.enabled_modules ||
      'email_risk,device_risk,bot_detection,api_abuse,payment_fraud'
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

  bindIdleEvents();
  validateSession();
})();