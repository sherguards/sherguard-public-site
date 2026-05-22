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

  async function loadApiKeys() {
    const body = document.getElementById('apiKeysTableBody');

    if (!body) return;

    try {
      const data = await aiTrustApiGet('/api-keys');

      const keys = data.keys || [];
      const usageText = document.getElementById('apiKeyUsageText');

      const activeKeys = keys.filter(function (key) {
        return key.is_active;
      }).length;

      if (usageText) {
        usageText.textContent =
          activeKeys + ' / 5 active API keys used';
      }

      const createBtn = document.getElementById('createApiKeyBtn');

      if (createBtn) {
        if (activeKeys >= 5) {
          createBtn.disabled = true;
          createBtn.textContent = 'Limit Reached';
        } else {
          createBtn.disabled = false;
          createBtn.textContent = 'Create API Key';
        }
      }

      if (!keys.length) {
        body.innerHTML = `
          <tr>
            <td colspan="8">No API keys created yet.</td>
          </tr>
        `;
        return;
      }

      body.innerHTML = keys.map(function (key) {
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
    const usageText = document.getElementById('apiKeyUsageText');

    if (
      usageText &&
      usageText.textContent.trim().startsWith('5 / 5')
    ) {
      alert('API key limit reached for this plan.');
      return;
    }

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
        'http://127.0.0.1:8000/api-keys/' + apiKeyId,
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