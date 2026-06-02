(function () {
    'use strict';
  
    if (typeof Paddle === 'undefined') {
      console.error('Paddle.js is not loaded.');
      return;
    }
  
    if (typeof PADDLE_CLIENT_TOKEN === 'undefined' || !PADDLE_CLIENT_TOKEN) {
      console.error('Paddle client-side token is missing.');
      return;
    }
  
    Paddle.Initialize({
      token: PADDLE_CLIENT_TOKEN
    });
  
    const PADDLE_PRICE_IDS = {
      starter: 'pri_01kt2gwa19c5s5g2xrqmg8873t',
      growth: 'pri_01kt2hawf64tf26w93hyme55bh',
      business: 'pri_01kt2hp4qa9y7zsyn6h9b8k8vn',
  
      email_limited: 'pri_01kt2jkkexkh0fjjnw2fsx9n9f',
      email_unlimited: 'pri_01kt2js4kerrvyt31gz1gmwbmg',
  
      device_limited: 'pri_01kt2jxxx7880zrmma196vbv1x',
      device_unlimited: 'pri_01kt2k39rm8tymxhe8t5bqyh1t',
  
      bot_limited: 'pri_01kt2k8hvnnf1vs54bftep2z01',
      bot_unlimited: 'pri_01kt2kd2ww0ze2t1xe0y734z3z',
  
      api_abuse_limited: 'pri_01kt2kj8rcpp0zc6kxsfqhhjg0',
      api_abuse_unlimited: 'pri_01kt2kpvs1grgdvhcx7dw0z4nx',
  
      payment_fraud_limited: 'pri_01kt2kvvtfrfsrgp5y4tz8vywy',
      payment_fraud_unlimited: 'pri_01kt2m0jqa7e2p85h50kfcnbh3'
    };
  
    function getOrganizationId() {
      try {
        const user = JSON.parse(
          localStorage.getItem('sherguard_user') ||
          localStorage.getItem('aiTrustUser') ||
          '{}'
        );
  
        return (
          user.organization_id ||
          user.organizationId ||
          user.organization ||
          null
        );
      } catch {
        return null;
      }
    }
  
    function openCheckout(planKey) {
      const priceId = PADDLE_PRICE_IDS[planKey];
  
      if (!priceId) {
        alert('Plan is not available yet.');
        return;
      }
  
      const organizationId = getOrganizationId();
  
      if (!organizationId) {
        window.location.href = 'login.html';
        return;
      }
  
      Paddle.Checkout.open({
        items: [
          {
            priceId: priceId,
            quantity: 1
          }
        ],
        customData: {
          organization_id: String(organizationId),
          plan_key: planKey
        },
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          successUrl: 'https://sherguard.com/dashboard.html?billing=success'
        }
      });
    }
  
    window.openSherGuardCheckout = openCheckout;
  })();