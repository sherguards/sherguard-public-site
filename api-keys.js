(function () {
  'use strict';

  function formatApiKeyDate(value) {
    if (!value) return 'Never';

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

  function getSelectedScopes() {
    const checkboxes = document.querySelectorAll(
      'input[name="apiKeyScopes"]:checked'
    );

    return Array.prototype.slice.call(checkboxes).map(function (checkbox) {
      return checkbox.value;
    });
  }

  function getHiddenRevokedApiKeyIds() {
    try {
      return JSON.parse(
        localStorage.getItem('sherguardHiddenRevokedApiKeys') || '[]'
      );
    } catch {
      return [];
    }
  }

  function saveHiddenRevokedApiKeyIds(ids) {
    localStorage.setItem(
      'sherguardHiddenRevokedApiKeys',
      JSON.stringify(ids)
    );
  }

  async function loadApiKeys() {
    const body = document.getElementById('apiKeysTableBody');

    if (!body) return;

    try {
      const data = await aiTrustApiGet('/api-keys');

      const keys = data.keys || [];
      const hiddenRevokedIds = getHiddenRevokedApiKeyIds();

      const visibleKeys = keys.filter(function (key) {
        return key.is_active || !hiddenRevokedIds.includes(String(key.id));
      });

      const revokedKeys = keys.filter(function (key) {
        return !key.is_active;
      });

      const usageText = document.getElementById('apiKeyUsageText');

      const activeKeys = keys.filter(function (key) {
        return key.is_active;
      }).length;

      const apiKeyLimitsByPlan = {
        free: 1,
        starter: 3,
        growth: 10,
        business: 50,
        enterprise: 999999,
        owner: 999999
      };

      let currentPlan = 'free';

      try {
        const organizationProfile = await aiTrustApiGet('/organization/profile');

        if (
          organizationProfile &&
          organizationProfile.organization &&
          organizationProfile.organization.plan
        ) {
          currentPlan = String(
            organizationProfile.organization.plan || 'free'
          ).toLowerCase();
        }
      } catch (error) {
        console.error('API key plan lookup failed:', error);
      }

      const apiKeyLimit =
        apiKeyLimitsByPlan[currentPlan] || apiKeyLimitsByPlan.free;

      if (usageText) {
        if (apiKeyLimit >= 999999) {
          usageText.textContent =
            activeKeys + ' / Unlimited active API keys used';
        } else {
          usageText.textContent =
            activeKeys + ' / ' + apiKeyLimit + ' active API keys used';
        }
      }

      const createBtn = document.getElementById('createApiKeyBtn');

      if (createBtn) {
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

      let clearRevokedBtn = document.getElementById('clearRevokedApiKeysBtn');
      const tableWrap = document.querySelector('.api-key-table-wrap');

      if (!clearRevokedBtn && tableWrap) {
        clearRevokedBtn = document.createElement('button');
        clearRevokedBtn.id = 'clearRevokedApiKeysBtn';
        clearRevokedBtn.type = 'button';
        clearRevokedBtn.className = 'api-key-clear-revoked-btn';
        clearRevokedBtn.textContent = 'Clear Revoked Keys';
        tableWrap.insertAdjacentElement('beforebegin', clearRevokedBtn);
      }

      if (clearRevokedBtn) {
        if (revokedKeys.length) {
          clearRevokedBtn.style.display = 'inline-flex';
        } else {
          clearRevokedBtn.style.display = 'none';
        }

        clearRevokedBtn.onclick = function () {
          const ids = getHiddenRevokedApiKeyIds();

          revokedKeys.forEach(function (key) {
            const id = String(key.id);

            if (!ids.includes(id)) {
              ids.push(id);
            }
          });

          saveHiddenRevokedApiKeyIds(ids);
          loadApiKeys();
        };
      }

      if (!visibleKeys.length) {
        body.innerHTML = `
          <tr>
            <td colspan="8">No API keys created yet.</td>
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
            <td>${key.name}</td>
            <td>${key.key_prefix}</td>
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
                Revoke
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      body.innerHTML = `
        <tr>
          <td colspan="8">Failed to load API keys.</td>
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
      : 'Default API Key';

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

      await loadApiKeys();

    } catch (error) {
      alert('Failed to create API key.');
      console.error('Create API key failed:', error);
    }
  }

  async function revokeApiKey(apiKeyId) {
    if (!confirm('Revoke this API key? This cannot be undone.')) {
      return;
    }

    try {
      await fetch(
        'https://sherguard-api.onrender.com/api-keys/' + apiKeyId,
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('aiTrustToken')
          }
        }
      );

      await loadApiKeys();

    } catch (error) {
      alert('Failed to revoke API key.');
      console.error('Revoke API key failed:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const createBtn = document.getElementById('createApiKeyBtn');

    if (createBtn) {
      createBtn.addEventListener('click', createApiKey);
    }

    const copyBtn = document.getElementById('copyNewApiKeyBtn');

    if (copyBtn) {
      copyBtn.addEventListener('click', async function () {
        const value = document.getElementById('newApiKeyValue');

        if (!value) return;

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

      if (!revokeBtn) return;

      const apiKeyId = revokeBtn.getAttribute('data-api-key-id');

      if (apiKeyId) {
        revokeApiKey(apiKeyId);
      }
    });

    loadApiKeys();
  });
})();