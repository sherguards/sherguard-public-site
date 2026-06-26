(function () {
    'use strict';
  
    var API_BASE_URL = 'https://sherguard-api.onrender.com';
  
    function getReferralCodeFromUrl() {
      var params = new URLSearchParams(window.location.search);
      var ref = params.get('ref');
  
      if (!ref) {
        return '';
      }
  
      return String(ref).trim();
    }
  
    function saveReferralCode(referralCode) {
      if (!referralCode) {
        return;
      }
  
      localStorage.setItem('sherguard_affiliate_ref', referralCode);
    }
  
    function getSavedReferralCode() {
      return localStorage.getItem('sherguard_affiliate_ref') || '';
    }
  
    async function trackAffiliateClick(referralCode) {
      if (!referralCode) {
        return;
      }
  
      try {
        await fetch(API_BASE_URL + '/affiliate/click', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            affiliate_code: referralCode,
            page_url: window.location.href
          })
        });
      } catch (error) {}
    }
  
    var referralCode = getReferralCodeFromUrl();
  
    if (referralCode) {
      saveReferralCode(referralCode);
      trackAffiliateClick(referralCode);
    }
  
    window.sherguardAffiliateTracking = {
      getReferralCode: getSavedReferralCode,
      saveReferralCode: saveReferralCode
    };
  })();