(function () {
    'use strict';
  
    function $(id) {
      return document.getElementById(id);
    }
  
    function money(value) {
      return '$' + Number(value || 0).toFixed(2);
    }
  
    function formatDate(value) {
      if (!value) {
        return '—';
      }
  
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return '—';
      }
    }
  
    function renderEmpty(message) {
      return '<div class="empty-state">' + message + '</div>';
    }
  
    function renderReferrals(referrals) {
  
      var wrap = $('referralsTableWrap');
  
      if (!wrap) {
        return;
      }
  
      if (!referrals || referrals.length === 0) {
        wrap.innerHTML = renderEmpty('No referrals yet.');
        return;
      }
  
      wrap.innerHTML =
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Email</th>' +
        '<th>Status</th>' +
        '<th>Date</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
  
        referrals.map(function (item) {
  
          return (
            '<tr>' +
            '<td>' + (item.customer_email || '—') + '</td>' +
            '<td>' + (item.status || '—') + '</td>' +
            '<td>' + formatDate(item.created_at) + '</td>' +
            '</tr>'
          );
  
        }).join('') +
  
        '</tbody>' +
        '</table>';
    }
  
    function renderCommissions(commissions) {
  
      var wrap = $('commissionsTableWrap');
  
      if (!wrap) {
        return;
      }
  
      if (!commissions || commissions.length === 0) {
        wrap.innerHTML = renderEmpty('No commissions yet.');
        return;
      }
  
      wrap.innerHTML =
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Plan</th>' +
        '<th>Revenue</th>' +
        '<th>Commission</th>' +
        '<th>Status</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
  
        commissions.map(function (item) {
  
          return (
            '<tr>' +
            '<td>' + (item.plan || '—') + '</td>' +
            '<td>' + money(item.amount) + '</td>' +
            '<td>' + money(item.commission_amount) + '</td>' +
            '<td>' + (item.status || '—') + '</td>' +
            '</tr>'
          );
  
        }).join('') +
  
        '</tbody>' +
        '</table>';
    }
  
    function renderPayouts(payouts) {
  
      var wrap = $('payoutsTableWrap');
  
      if (!wrap) {
        return;
      }
  
      if (!payouts || payouts.length === 0) {
        wrap.innerHTML = renderEmpty('No payouts yet.');
        return;
      }
  
      wrap.innerHTML =
        '<table>' +
        '<thead>' +
        '<tr>' +
        '<th>Amount</th>' +
        '<th>Status</th>' +
        '<th>Date</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
  
        payouts.map(function (item) {
  
          return (
            '<tr>' +
            '<td>' + money(item.amount) + '</td>' +
            '<td>' + (item.status || '—') + '</td>' +
            '<td>' + formatDate(item.created_at) + '</td>' +
            '</tr>'
          );
  
        }).join('') +
  
        '</tbody>' +
        '</table>';
    }
  
    async function loadDashboard() {
  
      if (!window.PartnerAPI.getToken()) {
        location.href = '../affiliate-login.html';
        return;
      }
  
      try {
  
        const result =
          await window.PartnerAPI.getDashboard();
  
        const affiliate =
          result.affiliate || {};
  
        const metrics =
          result.metrics || {};
  
        if ($('welcomeTitle')) {
  
          $('welcomeTitle').textContent =
            'Welcome, ' +
            (affiliate.full_name || 'Affiliate');
  
        }
  
        var fields = {
  
          referralCode:
            metrics.referral_code,
  
          referralLink:
            metrics.referral_link,
  
          clicks:
            metrics.clicks,
  
          signups:
            metrics.signups,
  
          customers:
            metrics.customers,
  
          activeSubscriptions:
            metrics.active_subscriptions
  
        };
  
        Object.keys(fields).forEach(function (key) {
  
          if ($(key)) {
  
            $(key).textContent =
              fields[key] || 0;
  
          }
  
        });
  
        if ($('mrrGenerated'))
          $('mrrGenerated').textContent =
            money(metrics.mrr_generated);
  
        if ($('pendingCommission'))
          $('pendingCommission').textContent =
            money(metrics.pending_commission);
  
        if ($('paidCommission'))
          $('paidCommission').textContent =
            money(metrics.paid_commission);
  
        if ($('revenueMrr'))
          $('revenueMrr').textContent =
            money(metrics.mrr_generated);
  
        if ($('revenuePending'))
          $('revenuePending').textContent =
            money(metrics.pending_commission);
  
        if ($('revenuePaid'))
          $('revenuePaid').textContent =
            money(metrics.paid_commission);
  
        renderReferrals(
          result.referrals || []
        );
  
        renderCommissions(
          result.commissions || []
        );
  
        renderPayouts(
          result.payouts || []
        );
  
      } catch (error) {
  
        alert(
          error.message ||
          'Dashboard could not be loaded.'
        );
  
      }
  
    }
  
    async function savePayout() {
  
      var method =
        document.querySelector(
          'input[name="payoutMethod"]:checked'
        );
  
      var reference =
        $('payoutReference');
  
      if (!method || !reference) {
        return;
      }
  
      try {
  
        await window.PartnerAPI.savePayoutSettings(
  
          method.value,
  
          reference.value.trim()
  
        );
  
        alert(
          'Payout settings saved successfully.'
        );
  
      } catch (error) {
  
        alert(
          error.message ||
          'Unable to save payout settings.'
        );
  
      }
  
    }
  
    function copyReferralLink() {
  
      var input =
        $('referralLink');
  
      if (!input) {
        return;
      }
  
      navigator.clipboard
        .writeText(input.value)
        .then(function () {
  
          alert(
            'Referral link copied.'
          );
  
        });
  
    }
  
    window.addEventListener(
  
      'DOMContentLoaded',
  
      function () {
  
        loadDashboard();
  
        if ($('logoutButton')) {
  
          $('logoutButton').addEventListener(
  
            'click',
  
            function () {
  
              window.PartnerAPI.logout();
  
            }
  
          );
  
        }
  
        if ($('copyLinkButton')) {
  
          $('copyLinkButton').addEventListener(
  
            'click',
  
            copyReferralLink
  
          );
  
        }
  
        if ($('copyReferralButton')) {
  
          $('copyReferralButton').addEventListener(
  
            'click',
  
            copyReferralLink
  
          );
  
        }
  
        if ($('savePayoutButton')) {
  
          $('savePayoutButton').addEventListener(
  
            'click',
  
            savePayout
  
          );
  
        }
  
      }
  
    );
  
  })();