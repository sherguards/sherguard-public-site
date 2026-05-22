/* Main dashboard navigation and shared UI interactions for AI Trust OS. */
(function () {
  window.aiAgentConfig = {
    masterEnabled: true,
    strictMode: false,
    autoAction: false,
    approvalRequired: true,
    riskTolerance: 'medium',
    enforcement: 'soft'
  };

  const navItems = Array.prototype.slice.call(
    document.querySelectorAll('.nav-item')
  );

  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      navItems.forEach(function (navItem) {
        navItem.classList.remove('active');
      });

      item.classList.add('active');

      const targetId = item.getAttribute('data-scroll-target');

      if (!targetId) {
        return;
      }

      const targetSection = document.getElementById(targetId);

      if (!targetSection) {
        return;
      }

      targetSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      targetSection.classList.add('section-highlight');

      window.setTimeout(function () {
        targetSection.classList.remove('section-highlight');
      }, 1500);
    });
  });

  const logoutBtn = document.getElementById('logoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('aiTrustToken');
      localStorage.removeItem('aiTrustUser');

      window.location.href = 'login.html';
    });
  }

  async function loadOrganizationProfile() {
    try {
      const result = await aiTrustApiGet(
        '/organization/profile'
      );

      if (!result.success) {
        return;
      }

      const organization = result.organization;

      const orgNameText =
        document.getElementById('orgNameText');

      const orgPlanText =
        document.getElementById('orgPlanText');

      if (orgNameText) {
        orgNameText.textContent =
          organization.name;
      }

      if (orgPlanText) {
        orgPlanText.textContent =
          (
            organization.plan || 'free'
          ).toUpperCase() + ' PLAN';
      }

    } catch (error) {
      console.error(
        'Organization profile load failed',
        error
      );
    }
  }

  loadOrganizationProfile();

  async function loadOrganizationUsage() {
    try {
      const result = await aiTrustApiGet('/organization/usage');
  
      const usageSummaryText = document.getElementById('usageSummaryText');
  
      if (!usageSummaryText || !result.success) {
        return;
      }
  
      const totalUsed = result.usage.reduce(function (sum, item) {
        return sum + item.used_today;
      }, 0);
  
      const totalLimit = result.usage.reduce(function (sum, item) {
        return sum + item.daily_limit;
      }, 0);
  
      usageSummaryText.textContent =
        totalUsed + ' / ' + totalLimit + ' checks used today';
  
    } catch (error) {
      console.error('Usage load failed', error);
    }
  }
  
  loadOrganizationUsage();
})();