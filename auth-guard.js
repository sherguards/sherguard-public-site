(function () {
  const token = localStorage.getItem('aiTrustToken');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const userData = localStorage.getItem('aiTrustUser');

  if (!userData) {
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(userData);

  const enabledModules = (
    user.enabled_modules || ''
  ).split(',');

  const moduleVisibilityMap = {
    'email_risk': 'email-risk',
    'device_risk': 'device-risk-module',
    'bot_detection': 'bot-detection',
    'api_abuse': 'api-abuse',
    'payment_fraud': 'payment-fraud'
  };

  Object.keys(moduleVisibilityMap).forEach(function (moduleKey) {
    const sectionId = moduleVisibilityMap[moduleKey];

    const navButton = document.querySelector(
      '[data-scroll-target="' + sectionId + '"]'
    );

    const section = document.getElementById(sectionId);

    const enabled = enabledModules.includes(moduleKey);

    if (!enabled) {
      if (navButton) {
        navButton.style.display = 'none';
      }

      if (section) {
        section.style.display = 'none';
      }
    }
  });
})();