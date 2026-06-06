(function () {
  'use strict';

  /*
    SherGuard Payment Fraud Intelligence
    Backend-first module.

    Risk events, transaction profile, signals, breakdown, activity log,
    insights, copy, and export now read from backend dashboard events.

    LocalStorage remains only for safe UI preferences:
    - Scenario selector
    - Auto Action toggle
  */

  var SCENARIO_KEY = aiTrustScopedKey('aiTrustOsPaymentFraudScenario');
  var AUTO_ACTION_KEY = aiTrustScopedKey('aiTrustOsPaymentFraudAutoAction');

  var state = {
    latestTransaction: null,
    latestResult: null,
    backendActivity: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(id, value) {
    var element = byId(id);
    if (!element) return;
    element.textContent = String(value);
  }

  function safeHtml(id, value) {
    var element = byId(id);
    if (!element) return;
    element.innerHTML = value;
  }

  function safeValue(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback || 'Unknown';
    }

    return String(value);
  }

  function toNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatDate(timestamp) {
    if (!timestamp) return '—';

    var date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString();
  }

  function parserLayer() {
    var amounts = [9.99, 19.99, 49.99, 99.99, 249.99, 499.99, 999.99, 1499.99];
    var currencies = ['USD', 'EUR', 'GBP', 'SAR'];
    var methods = ['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay', 'PayPal'];
    var countries = ['US', 'GB', 'DE', 'FR', 'SA', 'AE', 'IN', 'PK'];
    var velocities = ['Low', 'Normal', 'Elevated', 'High', 'Extreme'];
    var chargebacks = ['None', 'Previous Dispute', 'Multiple Disputes', 'High Chargeback Merchant Pattern'];
    var trustLevels = ['Trusted', 'Unknown', 'Suspicious', 'High Risk'];

    var scenarioSelect = byId('paymentScenarioSelect');
    var selectedScenario = scenarioSelect ? scenarioSelect.value : 'random';

    var transaction = {
      id: 'PAY-' + Date.now(),
      timestamp: nowIso(),
      scenario: selectedScenario,
      amount: randomFrom(amounts),
      currency: randomFrom(currencies),
      method: randomFrom(methods),
      cardCountry: randomFrom(countries),
      billingCountry: randomFrom(countries),
      shippingCountry: randomFrom(countries),
      ipCountry: randomFrom(countries),
      velocity: randomFrom(velocities),
      chargebackPattern: randomFrom(chargebacks),
      deviceTrust: randomFrom(trustLevels),
      emailTrust: randomFrom(trustLevels),
      cardBin: '000000',
      failedAttempts: 0,
      vpnDetected: false,
      proxyDetected: false
    };

    if (selectedScenario === 'normal') {
      transaction.amount = 49.99;
      transaction.velocity = 'Low';
      transaction.chargebackPattern = 'None';
      transaction.deviceTrust = 'Trusted';
      transaction.emailTrust = 'Trusted';
      transaction.cardCountry = 'US';
      transaction.billingCountry = 'US';
      transaction.shippingCountry = 'US';
      transaction.ipCountry = 'US';
      transaction.method = 'Visa';
      transaction.cardBin = '424242';
      transaction.failedAttempts = 0;
    }

    if (selectedScenario === 'stolen-card') {
      transaction.amount = 999.99;
      transaction.velocity = 'High';
      transaction.deviceTrust = 'Suspicious';
      transaction.emailTrust = 'Unknown';
      transaction.cardCountry = 'US';
      transaction.billingCountry = 'PK';
      transaction.shippingCountry = 'AE';
      transaction.ipCountry = 'IN';
      transaction.chargebackPattern = 'Multiple Disputes';
      transaction.method = 'Mastercard';
      transaction.cardBin = '400000';
      transaction.failedAttempts = 7;
      transaction.vpnDetected = true;
      transaction.proxyDetected = false;
    }

    if (selectedScenario === 'card-testing') {
      transaction.amount = 9.99;
      transaction.velocity = 'Extreme';
      transaction.deviceTrust = 'Suspicious';
      transaction.emailTrust = 'Unknown';
      transaction.cardCountry = 'SA';
      transaction.billingCountry = 'AE';
      transaction.shippingCountry = 'US';
      transaction.ipCountry = 'GB';
      transaction.chargebackPattern = 'Previous Dispute';
      transaction.method = 'Visa';
      transaction.cardBin = '400000';
      transaction.failedAttempts = 12;
      transaction.vpnDetected = true;
      transaction.proxyDetected = true;
    }

    if (selectedScenario === 'chargeback') {
      transaction.amount = 499.99;
      transaction.velocity = 'Elevated';
      transaction.chargebackPattern = 'Previous Dispute';
      transaction.deviceTrust = 'Trusted';
      transaction.emailTrust = 'Unknown';
      transaction.cardCountry = 'GB';
      transaction.billingCountry = 'IN';
      transaction.shippingCountry = 'DE';
      transaction.ipCountry = 'US';
      transaction.method = 'PayPal';
      transaction.cardBin = '520000';
      transaction.failedAttempts = 4;
      transaction.vpnDetected = false;
      transaction.proxyDetected = true;
    }

    if (selectedScenario === 'high-velocity') {
      transaction.amount = 249.99;
      transaction.velocity = 'High';
      transaction.deviceTrust = 'Unknown';
      transaction.emailTrust = 'Unknown';
      transaction.cardCountry = 'FR';
      transaction.billingCountry = 'DE';
      transaction.shippingCountry = 'US';
      transaction.ipCountry = 'FR';
      transaction.method = 'Amex';
      transaction.cardBin = '370000';
      transaction.failedAttempts = 9;
      transaction.vpnDetected = false;
      transaction.proxyDetected = true;
    }

    if (selectedScenario === 'proxy-vpn') {
      transaction.amount = 249.99;
      transaction.velocity = 'High';
      transaction.ipCountry = 'PK';
      transaction.billingCountry = 'US';
      transaction.shippingCountry = 'US';
      transaction.cardCountry = 'US';
      transaction.deviceTrust = 'Suspicious';
      transaction.emailTrust = 'Unknown';
      transaction.chargebackPattern = 'None';
      transaction.method = 'Apple Pay';
      transaction.cardBin = '400000';
      transaction.failedAttempts = 6;
      transaction.vpnDetected = true;
      transaction.proxyDetected = true;
    }

    if (selectedScenario === 'account-takeover') {
      transaction.amount = 1499.99;
      transaction.velocity = 'High';
      transaction.deviceTrust = 'High Risk';
      transaction.emailTrust = 'High Risk';
      transaction.chargebackPattern = 'Previous Dispute';
      transaction.cardCountry = 'PK';
      transaction.billingCountry = 'GB';
      transaction.shippingCountry = 'DE';
      transaction.ipCountry = 'DE';
      transaction.method = 'Visa';
      transaction.cardBin = '400000';
      transaction.failedAttempts = 10;
      transaction.vpnDetected = true;
      transaction.proxyDetected = true;
    }

    if (selectedScenario === 'ai-fraud') {
      transaction.amount = 999.99;
      transaction.velocity = 'Extreme';
      transaction.deviceTrust = 'High Risk';
      transaction.emailTrust = 'High Risk';
      transaction.chargebackPattern = 'Multiple Disputes';
      transaction.cardCountry = 'US';
      transaction.billingCountry = 'FR';
      transaction.shippingCountry = 'AE';
      transaction.ipCountry = 'PK';
      transaction.method = 'Google Pay';
      transaction.cardBin = '400000';
      transaction.failedAttempts = 8;
      transaction.vpnDetected = true;
      transaction.proxyDetected = true;
    }

    return transaction;
  }

  function getAutoActionEnabled() {
    var toggle = byId('paymentAutoActionToggle');
    var enabled = toggle ? toggle.checked : false;

    if (
      window.aiAgentConfig &&
      (
        window.aiAgentConfig.masterEnabled === false ||
        window.aiAgentConfig.autoAction === false
      )
    ) {
      enabled = false;
    }

    return !!enabled;
  }

  function getAction(riskLevel, decision) {
    if (!getAutoActionEnabled()) {
      return {
        action: decision || 'Suggested',
        actionSource: 'Backend'
      };
    }

    if (riskLevel === 'High Risk') {
      return {
        action: 'Blocked',
        actionSource: 'AI'
      };
    }

    if (riskLevel === 'Medium Risk') {
      return {
        action: 'Challenged',
        actionSource: 'AI'
      };
    }

    return {
      action: 'Approved',
      actionSource: 'AI'
    };
  }

  function getDecisionFromRisk(riskLevel) {
    if (riskLevel === 'High Risk') return 'Block / Manual Review';
    if (riskLevel === 'Medium Risk') return 'Review / 3DS Challenge';
    return 'Approve';
  }

  function getBehaviorPattern(transaction, riskLevel, score) {
    if (
      score >= 90 &&
      (
        transaction.deviceTrust === 'High Risk' ||
        transaction.emailTrust === 'High Risk' ||
        transaction.chargebackPattern === 'Multiple Disputes'
      )
    ) {
      return 'Extreme Coordinated Fraud Pattern';
    }

    if (transaction.velocity === 'Extreme' || transaction.velocity === 'High') {
      return 'Velocity Abuse Pattern';
    }

    if (transaction.chargebackPattern && transaction.chargebackPattern !== 'None') {
      return 'Chargeback Risk Pattern';
    }

    if (
      transaction.cardCountry !== transaction.billingCountry ||
      transaction.billingCountry !== transaction.ipCountry
    ) {
      return 'Location Mismatch Pattern';
    }

    if (riskLevel === 'High Risk') {
      return 'High-Risk Payment Pattern';
    }

    if (riskLevel === 'Medium Risk') {
      return 'Payment Review Pattern';
    }

    return 'Normal Checkout';
  }

  function buildBackendRules(reasons, transaction, result) {
    var severity =
      result.riskLevel === 'High Risk'
        ? 'High'
        : result.riskLevel === 'Medium Risk'
        ? 'Medium'
        : 'Low';

    var rules = [];

    if (Array.isArray(reasons) && reasons.length) {
      reasons.forEach(function (reason, index) {
        var lower = String(reason).toLowerCase();

        rules.push({
          rule: reason,
          group:
            lower.includes('amount') || lower.includes('transaction')
              ? 'Transaction Signals'
              : lower.includes('velocity') || lower.includes('attempt')
              ? 'Velocity Signals'
              : lower.includes('card') || lower.includes('bin')
              ? 'Card Signals'
              : lower.includes('billing') ||
                lower.includes('shipping') ||
                lower.includes('country') ||
                lower.includes('ip')
              ? 'Location Signals'
              : lower.includes('chargeback') || lower.includes('dispute')
              ? 'Chargeback Signals'
              : lower.includes('device') || lower.includes('email')
              ? 'Risk Engine Signals'
              : 'Risk Engine Signals',
          severity: severity,
          impact: index === 0 ? 'Score ' + result.score + '/100' : '0',
          reason: reason,
          scoreImpact: index === 0 ? result.score : 0
        });
      });
    }

    rules.push({
      rule: 'Backend payment risk score',
      group: 'Risk Engine Signals',
      severity: severity,
      impact: 'Score ' + result.score + '/100',
      reason: 'Backend returned final payment fraud risk score.',
      scoreImpact: result.score
    });

    rules.push({
      rule: 'Backend payment decision',
      group: 'Risk Engine Signals',
      severity:
        result.decision === 'Block / Manual Review' ||
        result.decision === 'Block'
          ? 'High'
          : result.decision &&
            String(result.decision).toLowerCase().includes('review')
          ? 'Medium'
          : 'Low',
      impact: result.decision,
      reason: 'Backend returned final payment decision: ' + result.decision + '.',
      scoreImpact: 0
    });

    return rules;
  }

  function getBackendPaymentEvents() {
    var records = Array.isArray(window.latestDashboardRecords)
      ? window.latestDashboardRecords
      : [];

    return records
      .filter(function (record) {
        var moduleName = String(
          record.moduleName ||
          record.module ||
          record.module_key ||
          ''
        ).toLowerCase();

        return moduleName.includes('payment');
      })
      .map(mapBackendPaymentEvent)
      .filter(Boolean)
      .sort(function (a, b) {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
  }

  function mapBackendPaymentEvent(record) {
    if (!record || typeof record !== 'object') return null;

    var raw = record.raw_event || record.rawEvent || record;
    var signals = raw.signals || record.signals || {};

    var transaction = {
      id:
        raw.transaction_id ||
        raw.id ||
        record.id ||
        'PAY-' + Date.now(),
      timestamp:
        raw.timestamp ||
        record.timestamp ||
        nowIso(),
      scenario:
        raw.scenario ||
        record.scenario ||
        'backend-payment-event',
      amount:
        toNumber(signals.amount || raw.amount || record.amount, 0),
      currency:
        signals.currency ||
        raw.currency ||
        record.currency ||
        'USD',
      method:
        signals.payment_method ||
        raw.payment_method ||
        raw.method ||
        record.method ||
        'Card',
      cardCountry:
        signals.card_country ||
        raw.card_country ||
        raw.cardCountry ||
        record.cardCountry ||
        'Unknown',
      billingCountry:
        signals.billing_country ||
        raw.billing_country ||
        raw.billingCountry ||
        record.billingCountry ||
        'Unknown',
      shippingCountry:
        signals.shipping_country ||
        raw.shipping_country ||
        raw.shippingCountry ||
        record.shippingCountry ||
        'Unknown',
      ipCountry:
        signals.ip_country ||
        raw.ip_country ||
        raw.ipCountry ||
        record.ipCountry ||
        'Unknown',
      velocity:
        signals.velocity ||
        raw.velocity ||
        record.velocity ||
        inferVelocity(raw, signals),
      chargebackPattern:
        signals.chargeback_pattern ||
        raw.chargeback_pattern ||
        raw.chargebackPattern ||
        record.chargebackPattern ||
        'Backend/API Required',
      deviceTrust:
        signals.device_trust ||
        raw.device_trust ||
        raw.deviceTrust ||
        record.deviceTrust ||
        'Backend/API Required',
      emailTrust:
        signals.email_trust ||
        raw.email_trust ||
        raw.emailTrust ||
        record.emailTrust ||
        'Backend/API Required',
      cardBin:
        signals.card_bin ||
        raw.card_bin ||
        raw.cardBin ||
        record.cardBin ||
        '000000',
      failedAttempts:
        toNumber(
          signals.failed_attempts ||
          raw.failed_attempts ||
          raw.failedAttempts ||
          record.failedAttempts,
          0
        ),
      vpnDetected:
        signals.vpn_detected === true ||
        raw.vpn_detected === true ||
        raw.vpnDetected === true ||
        record.vpnDetected === true,
      proxyDetected:
        signals.proxy_detected === true ||
        raw.proxy_detected === true ||
        raw.proxyDetected === true ||
        record.proxyDetected === true
    };

    var riskLevel =
      raw.risk_level ||
      record.risk_level ||
      record.riskLevel ||
      record.riskLabel ||
      'Low Risk';

    var score =
      toNumber(raw.score || record.score || record.riskScore, 0);

    var decision =
      raw.decision ||
      record.decision ||
      getDecisionFromRisk(riskLevel);

    var confidence =
      raw.confidence === 'High' ||
      record.confidence === 'High'
        ? 95
        : raw.confidence === 'Medium' ||
          record.confidence === 'Medium'
        ? 75
        : toNumber(raw.confidence || record.confidence, 75);

    var actionData = getAction(riskLevel, decision);

    var reasons = Array.isArray(raw.reasons)
      ? raw.reasons
      : Array.isArray(record.reasons)
      ? record.reasons
      : Array.isArray(record.riskReasons)
      ? record.riskReasons
      : [];

    var result = {
      score: score,
      riskLevel: riskLevel,
      decision: decision,
      confidence: confidence,
      action: actionData.action,
      actionSource: actionData.actionSource,
      behaviorPattern:
        raw.behavior_pattern ||
        raw.behaviorPattern ||
        record.behaviorPattern ||
        getBehaviorPattern(transaction, riskLevel, score),
      rules: [],
      event_id:
        raw.event_id ||
        record.event_id ||
        record.id,
      backendModule:
        'Payment Fraud Intelligence',
      backendSynced:
        true,
      riskReasons:
        reasons
    };

    result.rules = buildBackendRules(reasons, transaction, result);

    return {
      id:
        String(
          result.event_id ||
          record.event_id ||
          record.id ||
          transaction.id
        ),
      timestamp:
        transaction.timestamp,
      amount:
        transaction.amount.toFixed(2),
      currency:
        transaction.currency,
      method:
        transaction.method,
      cardCountry:
        transaction.cardCountry,
      billingCountry:
        transaction.billingCountry,
      shippingCountry:
        transaction.shippingCountry,
      ipCountry:
        transaction.ipCountry,
      velocity:
        transaction.velocity,
      chargebackPattern:
        transaction.chargebackPattern,
      deviceTrust:
        transaction.deviceTrust,
      emailTrust:
        transaction.emailTrust,
      cardBin:
        transaction.cardBin,
      failedAttempts:
        transaction.failedAttempts,
      vpnDetected:
        transaction.vpnDetected,
      proxyDetected:
        transaction.proxyDetected,
      riskLevel:
        result.riskLevel,
      score:
        result.score,
      decision:
        result.decision,
      confidence:
        result.confidence,
      action:
        result.action,
      actionSource:
        result.actionSource,
      behaviorPattern:
        result.behaviorPattern,
      rules:
        result.rules,
      riskReasons:
        result.riskReasons,
      transaction:
        transaction,
      result:
        result,
      backendModule:
        'Payment Fraud Intelligence',
      backendSynced:
        true
    };
  }

  function inferVelocity(raw, signals) {
    var failedAttempts = toNumber(
      signals.failed_attempts ||
      raw.failed_attempts ||
      raw.failedAttempts,
      0
    );

    if (failedAttempts >= 10) return 'Extreme';
    if (failedAttempts >= 6) return 'High';
    if (failedAttempts >= 3) return 'Elevated';

    return 'Normal';
  }

  function getBackendPaymentActivity() {
    state.backendActivity = getBackendPaymentEvents();
    return state.backendActivity;
  }

  function setCurrentFromLatestBackend() {
    var activity = getBackendPaymentActivity();
    var latest = activity.length ? activity[0] : null;

    if (!latest) {
      state.latestTransaction = null;
      state.latestResult = null;
      return null;
    }

    state.latestTransaction = latest.transaction;
    state.latestResult = latest.result;

    return latest;
  }

  function renderer() {
    var latest = setCurrentFromLatestBackend();

    if (!latest || !state.latestTransaction || !state.latestResult) {
      resetSimulation(false);
      renderActivityLog([]);
      renderInsights([]);
      return;
    }

    var t = state.latestTransaction;
    var r = state.latestResult;

    safeText('paymentScoreValue', r.score);
    safeText('paymentRiskLevelText', r.riskLevel);
    safeText('paymentDecisionText', r.decision);
    safeText('paymentConfidencePill', 'Confidence: ' + r.confidence + '%');
    safeText('paymentAmountText', Number(t.amount || 0).toFixed(2));
    safeText('paymentCurrencyText', t.currency);
    safeText('paymentMethodText', t.method);
    safeText('paymentCardCountryText', t.cardCountry);
    safeText('paymentBillingCountryText', t.billingCountry);
    safeText('paymentShippingCountryText', t.shippingCountry);
    safeText('paymentIpCountryText', t.ipCountry);
    safeText('paymentVelocityText', t.velocity);
    safeText('paymentChargebackPatternText', t.chargebackPattern);
    safeText('paymentBehaviorPattern', r.behaviorPattern);

    var ring = byId('paymentScoreRing');

    if (ring) {
      var degrees = Math.round((r.score / 100) * 360);
      var color = '#22c55e';

      if (r.score >= 80) {
        color = '#ef4444';
      } else if (r.score >= 50) {
        color = '#f59e0b';
      }

      ring.style.background =
        'conic-gradient(' +
        color +
        ' ' +
        degrees +
        'deg, rgba(51, 65, 85, 0.75) ' +
        degrees +
        'deg)';
    }

    renderSignals();
    renderBreakdown();
    renderActivityLog(getBackendPaymentActivity());
    renderInsights(getBackendPaymentActivity());
  }

  function renderSignals() {
    var t = state.latestTransaction;
    var r = state.latestResult;

    if (!t || !r) {
      safeHtml('paymentSignalsPanel', '');
      return;
    }

    var groups = [
      {
        title: 'Transaction Signals',
        rows: [
          ['Amount', Number(t.amount || 0).toFixed(2) + ' ' + t.currency],
          ['Payment Method', t.method],
          ['Failed Attempts', t.failedAttempts]
        ]
      },
      {
        title: 'Card Signals',
        rows: [
          ['Card BIN', t.cardBin],
          ['Card Country', t.cardCountry],
          ['Billing Country', t.billingCountry]
        ]
      },
      {
        title: 'Location Signals',
        rows: [
          ['Shipping Country', t.shippingCountry],
          ['IP Country', t.ipCountry],
          ['VPN Detected', t.vpnDetected ? 'Yes' : 'No'],
          ['Proxy Detected', t.proxyDetected ? 'Yes' : 'No']
        ]
      },
      {
        title: 'Velocity Signals',
        rows: [
          ['Transaction Velocity', t.velocity],
          ['Failed Attempts', t.failedAttempts]
        ]
      },
      {
        title: 'Chargeback Signals',
        rows: [
          ['Chargeback Pattern', t.chargebackPattern]
        ]
      },
      {
        title: 'Risk Engine Signals',
        rows: [
          ['Device Trust', t.deviceTrust],
          ['Email Trust', t.emailTrust],
          ['Final Score', r.score + '/100'],
          ['Decision', r.decision],
          ['Action', r.action]
        ]
      }
    ];

    var html = groups.map(function (group) {
      var rows = group.rows.map(function (row) {
        return (
          '<div class="payment-fraud-signal">' +
            '<span>' + row[0] + '</span>' +
            '<strong>' + row[1] + '</strong>' +
          '</div>'
        );
      }).join('');

      return (
        '<div class="payment-fraud-signal-group">' +
          '<h4>' + group.title + '</h4>' +
          rows +
        '</div>'
      );
    }).join('');

    safeHtml('paymentSignalsPanel', html);
  }

  function renderBreakdown() {
    var r = state.latestResult;

    if (!r || !r.rules || r.rules.length === 0) {
      safeHtml(
        'paymentBreakdownBody',
        '<tr><td colspan="5">No backend payment analysis yet.</td></tr>'
      );
      return;
    }

    var html = r.rules.map(function (item) {
      return (
        '<tr>' +
          '<td>' + safeValue(item.rule, 'Backend rule') + '</td>' +
          '<td>' + safeValue(item.group, 'Risk Engine Signals') + '</td>' +
          '<td><span class="payment-fraud-badge">' + safeValue(item.severity, 'Low') + '</span></td>' +
          '<td>' + safeValue(item.impact, '0') + '</td>' +
          '<td>' + safeValue(item.reason, 'Backend payment event.') + '</td>' +
        '</tr>'
      );
    }).join('');

    safeHtml('paymentBreakdownBody', html);
  }

  function renderActivityLog(activity) {
    var records = Array.isArray(activity)
      ? activity
      : getBackendPaymentActivity();

    if (!records.length) {
      safeHtml(
        'paymentActivityBody',
        '<tr><td colspan="13">No backend payment activity yet.</td></tr>'
      );
      return;
    }

    var html = records.map(function (item) {
      return (
        '<tr>' +
          '<td>' + formatDate(item.timestamp) + '</td>' +
          '<td>' + item.amount + ' ' + item.currency + '</td>' +
          '<td>' + safeValue(item.method, 'Card') + '</td>' +
          '<td>' + safeValue(item.cardCountry, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.billingCountry, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.shippingCountry, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.ipCountry, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.riskLevel, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.score, 0) + '</td>' +
          '<td>' + safeValue(item.decision, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.action, 'Backend') + '</td>' +
          '<td>' + safeValue(item.actionSource, 'Backend') + '</td>' +
          '<td>' + safeValue(item.behaviorPattern, '--') + '</td>' +
        '</tr>'
      );
    }).join('');

    safeHtml('paymentActivityBody', html);
  }

  function renderInsights(activity) {
    var records = Array.isArray(activity)
      ? activity
      : getBackendPaymentActivity();

    var total = records.length;

    safeText('paymentTotalChecks', total);

    if (!total) {
      safeText('paymentHighRiskCount', 0);
      safeText('paymentMediumRiskCount', 0);
      safeText('paymentLowRiskCount', 0);
      safeText('paymentBlockedCount', 0);
      safeText('paymentAvgRiskScore', 0);
      safeText('paymentHighRiskPercent', '0%');
      safeText('paymentMostCommonMethod', '--');
      safeText('paymentMostCommonPattern', '--');
      safeText('paymentLastDecision', '--');
      return;
    }

    var high = records.filter(function (item) {
      return item.riskLevel === 'High Risk';
    }).length;

    var medium = records.filter(function (item) {
      return item.riskLevel === 'Medium Risk';
    }).length;

    var low = records.filter(function (item) {
      return item.riskLevel === 'Low Risk';
    }).length;

    var blocked = records.filter(function (item) {
      return (
        item.action === 'Blocked' ||
        item.action === 'Challenged' ||
        String(item.decision || '').toLowerCase().includes('block') ||
        String(item.decision || '').toLowerCase().includes('review')
      );
    }).length;

    var scoreTotal = records.reduce(function (sum, item) {
      return sum + Number(item.score || 0);
    }, 0);

    safeText('paymentHighRiskCount', high);
    safeText('paymentMediumRiskCount', medium);
    safeText('paymentLowRiskCount', low);
    safeText('paymentBlockedCount', blocked);
    safeText('paymentAvgRiskScore', Math.round(scoreTotal / total));
    safeText('paymentHighRiskPercent', Math.round((high / total) * 100) + '%');
    safeText('paymentMostCommonMethod', mostCommon(records, 'method'));
    safeText('paymentMostCommonPattern', mostCommon(records, 'behaviorPattern'));
    safeText('paymentLastDecision', records[0].decision);
  }

  function mostCommon(list, key) {
    var counts = {};
    var winner = '--';
    var max = 0;

    list.forEach(function (item) {
      var value = item[key] || '--';

      counts[value] = (counts[value] || 0) + 1;

      if (counts[value] > max) {
        max = counts[value];
        winner = value;
      }
    });

    return winner;
  }

  async function analyzePayment() {
    var transaction = parserLayer();

    var backendResult = await aiTrustApiPost('/analyze/payment-fraud', {
      amount: Number(transaction.amount || 0),
      currency: String(transaction.currency || 'USD'),
      payment_method: String(transaction.method || 'Card'),
      billing_country: String(transaction.billingCountry || 'Unknown'),
      shipping_country: String(transaction.shippingCountry || 'Unknown'),
      card_bin: String(transaction.cardBin || '000000'),
      failed_attempts: Number(transaction.failedAttempts || 0),
      vpn_detected: Boolean(transaction.vpnDetected),
      proxy_detected: Boolean(transaction.proxyDetected)
    });

    var mapped = mapBackendPaymentEvent({
      moduleName: 'Payment Fraud Intelligence',
      module: 'Payment Fraud Intelligence',
      timestamp: backendResult.timestamp || nowIso(),
      raw_event: backendResult,
      risk_level: backendResult.risk_level,
      score: backendResult.score,
      decision: backendResult.decision,
      confidence: backendResult.confidence,
      reasons: backendResult.reasons,
      signals: {
        amount: transaction.amount,
        currency: transaction.currency,
        payment_method: transaction.method,
        card_country: transaction.cardCountry,
        billing_country: transaction.billingCountry,
        shipping_country: transaction.shippingCountry,
        ip_country: transaction.ipCountry,
        velocity: transaction.velocity,
        chargeback_pattern: transaction.chargebackPattern,
        device_trust: transaction.deviceTrust,
        email_trust: transaction.emailTrust,
        card_bin: transaction.cardBin,
        failed_attempts: transaction.failedAttempts,
        vpn_detected: transaction.vpnDetected,
        proxy_detected: transaction.proxyDetected
      }
    });

    if (mapped) {
      state.latestTransaction = mapped.transaction;
      state.latestResult = mapped.result;
    }

    renderer();

    window.dispatchEvent(
      new CustomEvent('aiTrustOsActivityUpdated', {
        detail: {
          module: 'Payment Fraud',
          storageKey: null,
          backendSynced: true,
          riskLabel: backendResult.risk_level,
          score: backendResult.score,
          decision: backendResult.decision,
          timestamp: backendResult.timestamp || nowIso(),
          riskReasons: backendResult.reasons || []
        }
      })
    );

    window.dispatchEvent(
      new CustomEvent('sherguardPaymentFraudAnalyzed', {
        detail: {
          result: mapped,
          backendResult: backendResult
        }
      })
    );
  }

  function resetSimulation(renderEverything) {
    state.latestTransaction = null;
    state.latestResult = null;

    safeText('paymentScoreValue', 0);
    safeText('paymentRiskLevelText', 'Not analyzed');
    safeText('paymentDecisionText', '--');
    safeText('paymentConfidencePill', 'Confidence: --');
    safeText('paymentAmountText', '--');
    safeText('paymentCurrencyText', '--');
    safeText('paymentMethodText', '--');
    safeText('paymentCardCountryText', '--');
    safeText('paymentBillingCountryText', '--');
    safeText('paymentShippingCountryText', '--');
    safeText('paymentIpCountryText', '--');
    safeText('paymentVelocityText', '--');
    safeText('paymentChargebackPatternText', '--');
    safeText('paymentBehaviorPattern', '--');

    var ring = byId('paymentScoreRing');

    if (ring) {
      ring.style.background =
        'conic-gradient(#38bdf8 0deg, rgba(51, 65, 85, 0.75) 0deg)';
    }

    safeHtml('paymentSignalsPanel', '');
    safeHtml(
      'paymentBreakdownBody',
      '<tr><td colspan="5">No backend payment analysis yet.</td></tr>'
    );

    if (renderEverything !== false) {
      renderInsights([]);
      renderActivityLog([]);
    }
  }

  function exportCsv() {
    var records = getBackendPaymentActivity();

    if (!records.length) {
      alert('No backend payment activity to export yet.');
      return;
    }

    var headers = [
      'Timestamp',
      'Amount',
      'Currency',
      'Method',
      'Card Country',
      'Billing Country',
      'Shipping Country',
      'IP Country',
      'Risk Level',
      'Score',
      'Decision',
      'Action',
      'Action Source',
      'Behavior Pattern'
    ];

    var rows = records.map(function (item) {
      return [
        item.timestamp,
        item.amount,
        item.currency,
        item.method,
        item.cardCountry,
        item.billingCountry,
        item.shippingCountry,
        item.ipCountry,
        item.riskLevel,
        item.score,
        item.decision,
        item.action,
        item.actionSource,
        item.behaviorPattern
      ];
    });

    var csv = [headers].concat(rows).map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');

    var blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });

    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');

    link.href = url;
    link.download = 'payment-fraud-backend-activity.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  function copyResult() {
    var latest = getBackendPaymentActivity()[0];

    if (!latest) {
      alert('No backend payment result to copy yet.');
      return;
    }

    var t = latest.transaction;
    var r = latest.result;

    var report = [
      'SherGuard — Payment Fraud Intelligence Report',
      '--------------------------------',
      'Timestamp: ' + formatDate(t.timestamp),
      'Amount: ' + Number(t.amount || 0).toFixed(2) + ' ' + t.currency,
      'Payment Method: ' + t.method,
      'Card Country: ' + t.cardCountry,
      'Billing Country: ' + t.billingCountry,
      'Shipping Country: ' + t.shippingCountry,
      'IP Country: ' + t.ipCountry,
      'Velocity: ' + t.velocity,
      'Chargeback Pattern: ' + t.chargebackPattern,
      'Device Trust: ' + t.deviceTrust,
      'Email Trust: ' + t.emailTrust,
      'Risk Score: ' + r.score,
      'Risk Level: ' + r.riskLevel,
      'Decision: ' + r.decision,
      'Action: ' + r.action,
      'Action Source: ' + r.actionSource,
      'Reasons:',
      Array.isArray(r.riskReasons) && r.riskReasons.length
        ? r.riskReasons.map(function (reason) {
            return '- ' + reason;
          }).join('\n')
        : '- No backend reasons recorded.'
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(function () {
        alert('Payment result copied.');
      }).catch(function () {
        alert(report);
      });
    } else {
      alert(report);
    }
  }

  async function clearLog() {
    if (!window.confirm('Clear backend dashboard activity? This clears organization security events, not only Payment Fraud.')) {
      return;
    }

    try {
      await fetch('https://sherguard-api.onrender.com/events', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('aiTrustToken')
        }
      });

      state.backendActivity = [];
      state.latestTransaction = null;
      state.latestResult = null;
      window.latestDashboardRecords = [];

      resetSimulation();

      window.dispatchEvent(
        new CustomEvent('aiTrustOsActivityUpdated', {
          detail: {
            module: 'Payment Fraud',
            cleared: true,
            backendSynced: true,
            timestamp: nowIso()
          }
        })
      );

    } catch (error) {
      console.error('Payment Fraud backend clear failed:', error);
      alert('Backend clear failed. Use main dashboard Clear Activity if needed.');
    }
  }

  function bindEvents() {
    var analyzeBtn = byId('paymentAnalyzeBtn');
    var resetBtn = byId('paymentResetBtn');
    var copyBtn = byId('paymentCopyResultBtn');
    var exportBtn = byId('paymentExportCsvBtn');
    var clearBtn = byId('paymentClearLogBtn');
    var scenarioSelect = byId('paymentScenarioSelect');
    var autoActionToggle = byId('paymentAutoActionToggle');

    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzePayment);

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetSimulation();
      });
    }

    if (copyBtn) copyBtn.addEventListener('click', copyResult);
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
    if (clearBtn) clearBtn.addEventListener('click', clearLog);

    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', function () {
        localStorage.setItem(SCENARIO_KEY, scenarioSelect.value);
      });
    }

    if (autoActionToggle) {
      autoActionToggle.addEventListener('change', function () {
        localStorage.setItem(
          AUTO_ACTION_KEY,
          autoActionToggle.checked ? 'true' : 'false'
        );
        renderer();
      });
    }

    window.addEventListener('sherguardDashboardEventsSynced', function () {
      renderer();
    });

    window.addEventListener('aiTrustOsActivityUpdated', function () {
      setTimeout(function () {
        renderer();
      }, 500);
    });
  }

  function loadPreferences() {
    var scenarioSelect = byId('paymentScenarioSelect');
    var savedScenario = localStorage.getItem(SCENARIO_KEY);

    if (scenarioSelect && savedScenario) {
      scenarioSelect.value = savedScenario;
    }

    var autoActionToggle = byId('paymentAutoActionToggle');
    var savedAutoAction = localStorage.getItem(AUTO_ACTION_KEY);

    if (autoActionToggle && savedAutoAction !== null) {
      autoActionToggle.checked = savedAutoAction === 'true';
    }
  }

  function init() {
    if (!document.getElementById('paymentFraudModule')) return;

    loadPreferences();
    bindEvents();
    renderer();

    setTimeout(function () {
      renderer();
    }, 250);
  }

  window.SherGuardPaymentFraud = {
    analyze: analyzePayment,
    getBackendPaymentEvents: getBackendPaymentEvents,
    render: renderer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();