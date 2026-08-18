(function () {
  'use strict';

  var API_BASE_URL =
    'https://sherguard-api.onrender.com';

  function getToken() {

    return localStorage.getItem(
      'sherguard_affiliate_token'
    ) || '';

  }

  function setSession(
    token,
    affiliate
  ) {

    localStorage.setItem(
      'sherguard_affiliate_token',
      token
    );

    localStorage.setItem(
      'sherguard_affiliate',
      JSON.stringify(
        affiliate || {}
      )
    );

  }

  function clearSession() {

    localStorage.removeItem(
      'sherguard_affiliate_token'
    );

    localStorage.removeItem(
      'sherguard_affiliate'
    );

  }

  async function request(
    path,
    options
  ) {

    var token = getToken();

    var headers = {
      'Content-Type':
        'application/json'
    };

    if (token) {

      headers.Authorization =
        'Bearer ' + token;

    }

    var response =
      await fetch(
        API_BASE_URL + path,
        {
          method:
            options && options.method
              ? options.method
              : 'GET',

          headers: headers,

          body:
            options && options.body
              ? JSON.stringify(
                options.body
              )
              : undefined
        }
      );

    var data;

    try {

      data = await response.json();

    } catch (error) {

      throw new Error(
        'The server returned an invalid response.'
      );

    }

    if (
      !response.ok
      || data.success === false
    ) {

      throw new Error(
        data.detail
        || data.message
        || 'Request failed.'
      );

    }

    return data;

  }

  window.PartnerAPI = {

    getToken: getToken,

    setSession: setSession,

    clearSession: clearSession,

    getDashboard: function () {

      return request(
        '/affiliate/dashboard'
      );

    },

    getPayoutSettings: function () {

      return request(
        '/affiliate/payout-settings'
      );

    },

    savePayoutSettings: function (
      payoutMethod,
      payoutDetails
    ) {

      return request(
        '/affiliate/payout-settings',
        {
          method: 'POST',

          body: {
            payout_method:
              payoutMethod,

            payout_details:
              payoutDetails
          }
        }
      );

    },

    getPayoutSummary: function () {

      return request(
        '/affiliate/payout-summary'
      );

    },

    requestPayout: function () {

      return request(
        '/affiliate/request-payout',
        {
          method: 'POST'
        }
      );

    },

    logout: function () {

      clearSession();

      window.location.href =
        '../affiliate-login.html';

    }

  };

})();