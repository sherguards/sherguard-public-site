const AI_TRUST_API_BASE_URL = 'https://sherguard-api.onrender.com';


function getAuthHeaders() {
  const token = localStorage.getItem('aiTrustToken');

  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  return headers;
}


async function aiTrustApiGet(path) {
  const response = await fetch(
    AI_TRUST_API_BASE_URL + path,
    {
      headers: getAuthHeaders()
    }
  );

  if (response.status === 401) {
    localStorage.removeItem('aiTrustToken');
    localStorage.removeItem('aiTrustUser');

    window.location.href = 'login.html';

    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMessage =
      'Backend request failed: ' + response.status;
  
    try {
      const errorData = await response.json();
  
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
  
    } catch (e) {}
  
    throw new Error(errorMessage);
  }

  return response.json();
}


async function aiTrustApiPost(path, data) {
  const response = await fetch(
    AI_TRUST_API_BASE_URL + path,
    {
      method: 'POST',

      headers: getAuthHeaders(),

      body: JSON.stringify(data)
    }
  );

  if (response.status === 401) {
    localStorage.removeItem('aiTrustToken');
    localStorage.removeItem('aiTrustUser');

    window.location.href = 'login.html';

    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMessage =
      'Backend request failed: ' + response.status;
  
    try {
      const errorData = await response.json();
  
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
  
    } catch (e) {}
  
    throw new Error(errorMessage);
  }

  return response.json();
}

function aiTrustGetCurrentUserScope() {
  try {
    const user = JSON.parse(localStorage.getItem('aiTrustUser') || '{}');

    const organizationId =
      user.organization_id ||
      'unknown_org';

      const userId =
      user.user_id ||
      user.id ||
      'unknown_user';

    return 'org_' + organizationId + '_user_' + userId;

  } catch (error) {
    return 'org_unknown_user_unknown';
  }
}

function aiTrustScopedKey(baseKey) {
  return baseKey + '_' + aiTrustGetCurrentUserScope();
}