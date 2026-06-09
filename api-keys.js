(function () {
  'use strict';

  /*
    SherGuard API Key Management
    Backend-first module.

    - API keys are loaded only from backend /api-keys.
    - API key creation uses backend /api-keys.
    - API key revoke uses backend /api-keys/{id}.
    - Plan/limit display uses backend /organization/profile.
    - No local API key activity/history/revoked-key hiding is used.
    - LocalStorage is used only for JWT token through existing auth system.
  */

  function formatApiKeyDate(value) {
    if (!value) {
      return 'Never';
    }

    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  }

  function formatScopeLabel(scope) {
    const labels = {
      email_risk: 'Email Risk',
      device_risk: 'Device Risk',
      bot_detection: 'Bot Detection',
      api_abuse: 'API Abuse',
      payment_fraud: 'Payment Fraud'
    };

    return labels[scope] || scope;
  }

  function getHiddenRevokedApiKeyIds() {
    try {
      const raw = localStorage.getItem('sherGuardHiddenRevokedApiKeys');

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];

    } catch (error) {
      return [];
    }
  }

  function saveHiddenRevokedApiKeyIds(ids) {
    localStorage.setItem(
      'sherGuardHiddenRevokedApiKeys',
      JSON.stringify(ids)
    );
  }

  function getSelectedScopes() {
    const checkboxes = document.querySelectorAll(
      'input[name="apiKeyScopes"]:checked'
    );

    return Array.prototype.slice.call(checkboxes).map(function (checkbox) {
      return checkbox.value;
    });
  }

  function getApiKeyLimitByPlan(plan) {
    const apiKeyLimitsByPlan = {
      free: 1,
      starter: 3,
      growth: 10,
      business: 50,
      enterprise: 999999,
      owner: 999999
    };

    return apiKeyLimitsByPlan[plan] || apiKeyLimitsByPlan.free;
  }

  async function getCurrentOrganizationPlan() {
    try {
      const organizationProfile = await aiTrustApiGet('/organization/profile');

      if (
        organizationProfile &&
        organizationProfile.organization &&
        organizationProfile.organization.plan
      ) {
        return String(
          organizationProfile.organization.plan || 'free'
        ).toLowerCase();
      }

      if (
        organizationProfile &&
        organizationProfile.plan
      ) {
        return String(
          organizationProfile.plan || 'free'
        ).toLowerCase();
      }

    } catch (error) {
      console.error('API key plan lookup failed:', error);
    }

    return 'free';
  }

  function renderUsageAndLimit(keys, plan) {
    const usageText = document.getElementById('apiKeyUsageText');
    const createBtn = document.getElementById('createApiKeyBtn');

    const activeKeys = keys.filter(function (key) {
      return key.is_active;
    }).length;

    const apiKeyLimit = getApiKeyLimitByPlan(plan);

    if (usageText) {
      if (apiKeyLimit >= 999999) {
        usageText.textContent =
          activeKeys + ' / Unlimited active API keys used';
      } else {
        usageText.textContent =
          activeKeys + ' / ' + apiKeyLimit + ' active API keys used';
      }
    }

    if (!createBtn) {
      return;
    }

    let limitMessage = document.getElementById('apiKeyLimitMessage');

    if (!limitMessage) {
      limitMessage = document.createElement('p');
      limitMessage.id = 'apiKeyLimitMessage';
      limitMessage.className = 'api-key-limit-message';
      createBtn.insertAdjacentElement('afterend', limitMessage);
    }

    if (activeKeys >= apiKeyLimit) {
      createBtn.disabled = true;
      createBtn.textContent = 'Limit Reached';

      limitMessage.textContent =
        'API key limit reached for your current plan. Upgrade your plan to create more API keys.';

      limitMessage.classList.remove('hidden');
    } else {
      createBtn.disabled = false;
      createBtn.textContent = 'Create API Key';

      limitMessage.textContent = '';
      limitMessage.classList.add('hidden');
    }
  }

  function renderApiKeysTable(keys) {
    const body = document.getElementById('apiKeysTableBody');
    const clearBtn = document.getElementById('clearRevokedApiKeysBtn');
    const hiddenRevokedIds = getHiddenRevokedApiKeyIds();

    if (!body) {
      return;
    }

    const revokedKeys = keys.filter(function (key) {
      return !key.is_active;
    });

    if (clearBtn) {
      if (revokedKeys.length) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    const visibleKeys = keys.filter(function (key) {
      return !hiddenRevokedIds.includes(String(key.id));
    });

    if (!visibleKeys.length) {
      body.innerHTML = `
        <tr>
          <td colspan="8">No visible API keys. Removed revoked keys are hidden.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = visibleKeys.map(function (key) {
      const statusClass = key.is_active
        ? 'api-key-status-active'
        : 'api-key-status-revoked';

      const statusText = key.is_active
        ? 'Active'
        : 'Revoked';

      const scopes = Array.isArray(key.scopes)
        ? key.scopes
        : [];

      const scopeHtml = scopes.length
        ? scopes.map(function (scope) {
            return '<span class="api-key-scope-pill">' +
              formatScopeLabel(scope) +
            '</span>';
          }).join(' ')
        : '<span class="api-key-scope-pill">All Modules</span>';

      return `
        <tr>
          <td>${key.name || 'Primary API Key'}</td>
          <td>${key.key_prefix || '—'}</td>
          <td>${scopeHtml}</td>
          <td class="${statusClass}">${statusText}</td>
          <td>${key.request_count || 0}</td>
          <td>${formatApiKeyDate(key.last_used_at)}</td>
          <td>${key.created_by_email || 'Unknown'}</td>
          <td>
            <button
              class="api-key-revoke-btn"
              data-api-key-id="${key.id}"
              ${key.is_active ? '' : 'disabled'}
            >
              ${key.is_active ? 'Revoke' : 'Revoked'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadApiKeys() {
    const body = document.getElementById('apiKeysTableBody');

    if (!body) {
      return;
    }

    body.innerHTML = `
      <tr>
        <td colspan="8">Loading API keys from backend...</td>
      </tr>
    `;

    try {
      const data = await aiTrustApiGet('/api-keys');
      const keys = Array.isArray(data.keys) ? data.keys : [];
      const currentPlan = await getCurrentOrganizationPlan();

      renderUsageAndLimit(keys, currentPlan);
      renderApiKeysTable(keys);

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="8">Failed to load API keys from backend.</td>
        </tr>
      `;

      console.error('API keys load failed:', error);
    }
  }

  async function createApiKey() {
    const input = document.getElementById('apiKeyNameInput');
    const box = document.getElementById('newApiKeyBox');
    const value = document.getElementById('newApiKeyValue');

    const name = input && input.value
      ? input.value.trim()
      : 'Primary API Key';

    if (name.length < 2) {
      alert('API key name must be at least 2 characters.');
      return;
    }

    if (name.length > 80) {
      alert('API key name must be 80 characters or fewer.');
      return;
    }

    const scopes = getSelectedScopes();

    if (!scopes.length) {
      alert('Select at least one API module scope.');
      return;
    }

    try {
      const data = await aiTrustApiPost('/api-keys', {
        name: name,
        scopes: scopes
      });

      if (data.success === false) {
        alert(data.message || 'Unable to create API key.');
        return;
      }

      if (
        data.api_key &&
        data.api_key.success === false
      ) {
        alert(data.api_key.message || 'Unable to create API key.');
        return;
      }

      if (box && value && data.api_key && data.api_key.api_key) {
        value.textContent = data.api_key.api_key;
        box.classList.remove('hidden');
      }

      if (input) {
        input.value = '';
      }

      await loadApiKeys();

    } catch (error) {
      alert('Failed to create API key.');
      console.error('Create API key failed:', error);
    }
  }

  async function clearRevokedApiKeys() {
    const data = await aiTrustApiGet('/api-keys');
    const keys = Array.isArray(data.keys) ? data.keys : [];

    const revokedIds = keys
      .filter(function (key) {
        return !key.is_active;
      })
      .map(function (key) {
        return String(key.id);
      });

    saveHiddenRevokedApiKeyIds(revokedIds);

    await loadApiKeys();
  }

  async function revokeApiKey(apiKeyId) {
    if (!confirm('Revoke this API key? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        'https://sherguard-api.onrender.com/api-keys/' + apiKeyId,
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('aiTrustToken')
          }
        }
      );

      if (!response.ok) {
        alert('Failed to revoke API key.');
        return;
      }

      await loadApiKeys();

    } catch (error) {
      alert('Failed to revoke API key.');
      console.error('Revoke API key failed:', error);
    }
  }

  function bindEvents() {
    const createBtn = document.getElementById('createApiKeyBtn');

    if (createBtn) {
      createBtn.addEventListener('click', createApiKey);
    }

    const clearRevokedBtn = document.getElementById('clearRevokedApiKeysBtn');

    if (clearRevokedBtn) {
      clearRevokedBtn.addEventListener('click', clearRevokedApiKeys);
    }

    const copyBtn = document.getElementById('copyNewApiKeyBtn');

    if (copyBtn) {
      copyBtn.addEventListener('click', async function () {
        const value = document.getElementById('newApiKeyValue');

        if (!value) {
          return;
        }

        try {
          await navigator.clipboard.writeText(
            value.textContent
          );

          copyBtn.textContent = 'Copied';

          const box = document.getElementById('newApiKeyBox');

          if (box) {
            setTimeout(function () {
              box.classList.add('hidden');
            }, 4000);
          }

          setTimeout(function () {
            copyBtn.textContent = 'Copy';
          }, 1500);

        } catch (error) {
          console.error('Copy failed:', error);
        }
      });
    }

    document.addEventListener('click', function (event) {
      const revokeBtn = event.target.closest('.api-key-revoke-btn');

      if (!revokeBtn) {
        return;
      }

      const apiKeyId = revokeBtn.getAttribute('data-api-key-id');

      if (apiKeyId) {
        revokeApiKey(apiKeyId);
      }
    });

    window.addEventListener('aiTrustOsActivityUpdated', function () {
      setTimeout(function () {
        loadApiKeys();
      }, 500);
    });
  }

  function init() {
    if (!document.getElementById('apiKeysTableBody')) {
      return;
    }

    bindEvents();
    loadApiKeys();
  }

  window.SherGuardApiKeys = {
    load: loadApiKeys,
    create: createApiKey,
    revoke: revokeApiKey
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();