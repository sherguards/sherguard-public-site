(function () {
    'use strict';
  
var STORAGE_KEY = aiTrustScopedKey('aiTrustOsPaymentFraudActivity');
var SCENARIO_KEY = aiTrustScopedKey('aiTrustOsPaymentFraudScenario');
var AUTO_ACTION_KEY = aiTrustScopedKey('aiTrustOsPaymentFraudAutoAction');
  
    var state = {
      latestTransaction: null,
      latestResult: null,
      activity: []
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
  
    function randomFrom(list) {
      return list[Math.floor(Math.random() * list.length)];
    }
  
    function clampScore(score) {
      return Math.max(0, Math.min(100, score));
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
        timestamp: new Date().toLocaleString(),
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
  
    function addRule(rules, rule, group, severity, impact, reason) {
      rules.push({
        rule: rule,
        group: group,
        severity: severity,
        impact: impact,
        reason: reason
      });
    }
  
    function ruleEngine(transaction) {
      var score = 10;
      var rules = [];
  
      if (transaction.amount >= 999.99) {
        score += 25;
        addRule(rules, 'Very High Amount', 'Transaction Signals', 'High', '+25', 'Large payment amount increases fraud and chargeback exposure.');
      } else if (transaction.amount >= 499.99) {
        score += 15;
        addRule(rules, 'High Amount', 'Transaction Signals', 'Medium', '+15', 'Higher than normal transaction value needs extra review.');
      } else if (transaction.amount <= 49.99) {
        score -= 10;
        addRule(rules, 'Low Amount', 'Transaction Signals', 'Low', '-10', 'Low order value normally reduces payment fraud risk.');
      }
  
      if (transaction.velocity === 'Extreme') {
        score += 30;
        addRule(rules, 'Extreme Velocity', 'Velocity Signals', 'High', '+30', 'Too many payment attempts in a short time window.');
      } else if (transaction.velocity === 'High') {
        score += 20;
        addRule(rules, 'High Velocity', 'Velocity Signals', 'High', '+20', 'Repeated checkout behavior suggests card testing or abuse.');
      } else if (transaction.velocity === 'Elevated') {
        score += 10;
        addRule(rules, 'Elevated Velocity', 'Velocity Signals', 'Medium', '+10', 'Payment activity is higher than normal.');
      }
  
      if (transaction.cardCountry !== transaction.billingCountry) {
        score += 8;
        addRule(rules, 'Card Billing Mismatch', 'Card Signals', 'Medium', '+8', 'Card country does not match billing country.');
      }
      
      if (transaction.billingCountry !== transaction.ipCountry) {
        score += 8;
        addRule(rules, 'Billing IP Mismatch', 'Location Signals', 'Medium', '+8', 'Billing country does not match IP country.');
      }
      if (
        transaction.billingCountry === transaction.shippingCountry &&
        transaction.billingCountry !== transaction.ipCountry
      ) {
        score += 18;
        addRule(
          rules,
          'Proxy / VPN Geo Anomaly',
          'Location Signals',
          'High',
          '+18',
          'Trusted billing/shipping countries do not match the active IP location.'
        );
      }
      
      if (transaction.shippingCountry !== transaction.billingCountry) {
        score += 6;
        addRule(rules, 'Shipping Billing Mismatch', 'Location Signals', 'Medium', '+6', 'Shipping destination differs from billing country.');
      }
  
      if (transaction.chargebackPattern === 'Multiple Disputes') {
        score += 28;
        addRule(rules, 'Multiple Disputes', 'Chargeback Signals', 'High', '+28', 'Customer or pattern has multiple previous disputes.');
      }
  
      if (transaction.chargebackPattern === 'Previous Dispute') {
        score += 16;
        addRule(rules, 'Previous Dispute', 'Chargeback Signals', 'Medium', '+16', 'Previous dispute history increases review priority.');
      }
  
      if (transaction.chargebackPattern === 'High Chargeback Merchant Pattern') {
        score += 24;
        addRule(rules, 'Merchant Chargeback Pattern', 'Chargeback Signals', 'High', '+24', 'Similar merchant pattern has elevated chargeback behavior.');
      }
  
      if (transaction.deviceTrust === 'High Risk') {
        score += 25;
        addRule(rules, 'High-Risk Device', 'Risk Engine Signals', 'High', '+25', 'Device trust layer marked this checkout as high risk.');
      } else if (transaction.deviceTrust === 'Suspicious') {
        score += 14;
        addRule(rules, 'Suspicious Device', 'Risk Engine Signals', 'Medium', '+14', 'Device shows suspicious trust signals.');
      }
  
      if (transaction.emailTrust === 'High Risk') {
        score += 22;
        addRule(rules, 'High-Risk Email', 'Risk Engine Signals', 'High', '+22', 'Email trust layer marked this customer as high risk.');
      } else if (transaction.emailTrust === 'Suspicious') {
        score += 14;
        addRule(rules, 'Suspicious Email', 'Risk Engine Signals', 'Medium', '+14', 'Email reputation or behavior needs review.');
      }
      if (transaction.scenario === 'ai-fraud') {
        score += 18;
        addRule(
          rules,
          'AI-Coordinated Fraud Pattern',
          'AI Fraud Signals',
          'High',
          '+18',
          'Transaction pattern suggests coordinated synthetic or AI-assisted fraud behavior.'
        );
      }
  
      if ((transaction.method === 'PayPal' || transaction.method === 'Apple Pay' || transaction.method === 'Google Pay') &&
        (transaction.velocity === 'Low' || transaction.velocity === 'Normal') &&
        transaction.chargebackPattern === 'None') {
        score -= 12;
        addRule(rules, 'Wallet Normal Signals', 'Risk Engine Signals', 'Low', '-12', 'Trusted wallet method with normal behavior lowers risk.');
      }
  
      if (transaction.deviceTrust === 'Trusted' && transaction.emailTrust === 'Trusted') {
        score -= 15;
        addRule(rules, 'Trusted Device And Email', 'Risk Engine Signals', 'Low', '-15', 'Both device and email trust layers show trusted signals.');
      }
  
      if (transaction.amount <= 49.99 &&
        transaction.cardCountry === transaction.billingCountry &&
        transaction.billingCountry === transaction.shippingCountry &&
        transaction.billingCountry === transaction.ipCountry) {
        score -= 15;
        addRule(rules, 'Low Amount Matching Countries', 'Location Signals', 'Low', '-15', 'Low-value transaction with matching countries reduces risk.');
      }

      if (
        window.aiAgentConfig &&
        window.aiAgentConfig.strictMode &&
        score >= 45
      ) {
        score += 8;
        addRule(
          rules,
          'Strict AI Policy Pressure',
          'AI Policy Signals',
          'Medium',
          '+8',
          'Strict AI mode is enabled, so elevated payment risk receives stronger enforcement pressure.'
        );
      }
  
      score = clampScore(score);

if (score > 0 && score < 12) {
  score = 12;
}

if (transaction.scenario === 'normal' && score < 18) {
  score = 18;
}
  
      if (rules.length === 0) {
        addRule(rules, 'Baseline Review', 'Risk Engine Signals', 'Low', '0', 'No major fraud indicators were detected.');
      }
  
      return {
        score: score,
        rules: rules
      };
    }

    function getPaymentConfidence(transaction, score) {
      var uncertainty = 0;
    
      if (transaction.deviceTrust === 'Unknown') {
        uncertainty += 1;
      }
    
      if (transaction.emailTrust === 'Unknown') {
        uncertainty += 1;
      }
    
      if (
        transaction.deviceTrust === 'High Risk' ||
        transaction.emailTrust === 'High Risk'
      ) {
        return 'High';
      }
    
      if (score >= 80 && uncertainty === 0) {
        return 'High';
      }
    
      if (score >= 50) {
        return 'Medium';
      }
    
      if (uncertainty >= 2) {
        return 'Medium';
      }
    
      return 'High';
    }
  
    function decisionEngine(transaction, engineResult) {
      var score = engineResult.score;
      var riskLevel = 'Low Risk';
      var decision = 'Approve';
      var confidence = getPaymentConfidence(transaction, score);

if (score >= 80) {
  riskLevel = 'High Risk';
  decision = 'Block / Manual Review';
} else if (score >= 50) {
  riskLevel = 'Medium Risk';

  if (
    window.aiAgentConfig &&
    window.aiAgentConfig.strictMode &&
    score >= 75
  ) {
    decision = 'Review / 3DS Challenge + Enhanced Monitoring';
  } else {
    decision = 'Review / 3DS Challenge';
  }
}
  
var autoToggle = byId('paymentAutoActionToggle');
var autoAction = autoToggle ? autoToggle.checked : false;

if (
  window.aiAgentConfig &&
  (
    window.aiAgentConfig.masterEnabled === false ||
    window.aiAgentConfig.autoAction === false
  )
) {
  autoAction = false;
}
  
      var action = 'Suggested';
      var actionSource = 'Manual';
  
      if (autoAction) {
        actionSource = 'AI';
  
        if (riskLevel === 'High Risk') {
          action = 'Blocked';
        } else if (riskLevel === 'Medium Risk') {
          action = 'Challenged';
        } else {
          action = 'Approved';
        }
      }
  
      var behaviorPattern = 'Normal Checkout';
  
      if (
        score >= 100 &&
        (
          transaction.deviceTrust === 'High Risk' ||
          transaction.emailTrust === 'High Risk' ||
          transaction.chargebackPattern === 'Multiple Disputes'
        )
      ) {
        behaviorPattern = 'Extreme Coordinated Fraud Pattern';
      } else if (transaction.velocity === 'Extreme' || transaction.velocity === 'High') {
        behaviorPattern = 'Velocity Abuse Pattern';
      } else if (transaction.chargebackPattern !== 'None') {
        behaviorPattern = 'Chargeback Risk Pattern';
      } else if (transaction.cardCountry !== transaction.billingCountry || transaction.billingCountry !== transaction.ipCountry) {
        behaviorPattern = 'Location Mismatch Pattern';
      }
  
      return {
        score: score,
        riskLevel: riskLevel,
        decision: decision,
        confidence: confidence,
        action: action,
        actionSource: actionSource,
        behaviorPattern: behaviorPattern,
        rules: engineResult.rules
      };
    }
  
    function renderer() {
      var t = state.latestTransaction;
      var r = state.latestResult;
  
      if (!t || !r) return;
  
      safeText('paymentScoreValue', r.score);
      safeText('paymentRiskLevelText', r.riskLevel);
      safeText('paymentDecisionText', r.decision);
      safeText('paymentConfidencePill', 'Confidence: ' + r.confidence);
      safeText('paymentAmountText', t.amount.toFixed(2));
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
  
        ring.style.background = 'conic-gradient(' + color + ' ' + degrees + 'deg, rgba(51, 65, 85, 0.75) ' + degrees + 'deg)';
      }
  
      renderSignals();
      renderBreakdown();
      renderActivityLog();
      renderInsights();
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
            ['Amount', t.amount.toFixed(2) + ' ' + t.currency],
            ['Payment Method', t.method]
          ]
        },
        {
          title: 'Card Signals',
          rows: [
            ['Card Country', t.cardCountry],
            ['Billing Country', t.billingCountry]
          ]
        },
        {
          title: 'Location Signals',
          rows: [
            ['Shipping Country', t.shippingCountry],
            ['IP Country', t.ipCountry]
          ]
        },
        {
          title: 'Velocity Signals',
          rows: [
            ['Transaction Velocity', t.velocity]
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
            ['Final Score', r.score]
          ]
        }
      ];
  
      var html = groups.map(function (group) {
        var rows = group.rows.map(function (row) {
          return '<div class="payment-fraud-signal"><span>' + row[0] + '</span><strong>' + row[1] + '</strong></div>';
        }).join('');
  
        return '<div class="payment-fraud-signal-group"><h4>' + group.title + '</h4>' + rows + '</div>';
      }).join('');
  
      safeHtml('paymentSignalsPanel', html);
    }
  
    function renderBreakdown() {
      var r = state.latestResult;
  
      if (!r || !r.rules || r.rules.length === 0) {
        safeHtml('paymentBreakdownBody', '<tr><td colspan="5">No payment analysis yet.</td></tr>');
        return;
      }
  
      var html = r.rules.map(function (item) {
        return '<tr>' +
          '<td>' + item.rule + '</td>' +
          '<td>' + item.group + '</td>' +
          '<td><span class="payment-fraud-badge">' + item.severity + '</span></td>' +
          '<td>' + item.impact + '</td>' +
          '<td>' + item.reason + '</td>' +
        '</tr>';
      }).join('');
  
      safeHtml('paymentBreakdownBody', html);
    }
  
    function renderActivityLog() {
      if (!state.activity.length) {
        safeHtml('paymentActivityBody', '<tr><td colspan="13">No payment activity yet.</td></tr>');
        return;
      }
  
      var html = state.activity.map(function (item) {
        return '<tr>' +
          '<td>' + item.timestamp + '</td>' +
          '<td>' + item.amount + ' ' + item.currency + '</td>' +
          '<td>' + item.method + '</td>' +
          '<td>' + item.cardCountry + '</td>' +
          '<td>' + item.billingCountry + '</td>' +
          '<td>' + item.shippingCountry + '</td>' +
          '<td>' + item.ipCountry + '</td>' +
          '<td>' + item.riskLevel + '</td>' +
          '<td>' + item.score + '</td>' +
          '<td>' + item.decision + '</td>' +
          '<td>' + item.action + '</td>' +
          '<td>' + item.actionSource + '</td>' +
          '<td>' + (item.behaviorPattern || '--') + '</td>' +
        '</tr>';
      }).join('');
  
      safeHtml('paymentActivityBody', html);
    }
  
    function renderInsights() {
      var activity = state.activity;
      var total = activity.length;
  
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
  
      var high = activity.filter(function (item) { return item.riskLevel === 'High Risk'; }).length;
      var medium = activity.filter(function (item) { return item.riskLevel === 'Medium Risk'; }).length;
      var low = activity.filter(function (item) { return item.riskLevel === 'Low Risk'; }).length;
      var blocked = activity.filter(function (item) {
        return item.action === 'Blocked' || item.action === 'Challenged';
      }).length;
  
      var scoreTotal = activity.reduce(function (sum, item) {
        return sum + Number(item.score);
      }, 0);
  
      safeText('paymentHighRiskCount', high);
      safeText('paymentMediumRiskCount', medium);
      safeText('paymentLowRiskCount', low);
      safeText('paymentBlockedCount', blocked);
      safeText('paymentAvgRiskScore', Math.round(scoreTotal / total));
      safeText('paymentHighRiskPercent', Math.round((high / total) * 100) + '%');
      safeText('paymentMostCommonMethod', mostCommon(activity, 'method'));
      safeText('paymentMostCommonPattern', mostCommon(activity, 'behaviorPattern'));
      safeText('paymentLastDecision', activity[0].decision);
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
  
    function saveActivityRecord() {
      var t = state.latestTransaction;
      var r = state.latestResult;
  
      if (!t || !r) return;
  
      var record = {
        timestamp: t.timestamp,
        amount: t.amount.toFixed(2),
        currency: t.currency,
        method: t.method,
        cardCountry: t.cardCountry,
        billingCountry: t.billingCountry,
        shippingCountry: t.shippingCountry,
        ipCountry: t.ipCountry,
        riskLevel: r.riskLevel,
        score: r.score,
        decision: r.decision,
        action: r.action,
        actionSource: r.actionSource,
        behaviorPattern: r.behaviorPattern
      };
  
      state.activity.unshift(record);
      state.activity = state.activity.slice(0, 100);
  
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.activity));
      window.dispatchEvent(new CustomEvent('aiTrustOsActivityUpdated'));
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

var engineResult = ruleEngine(transaction);

var decision = {
  score: backendResult.score,
  riskLevel: backendResult.risk_level,
  decision: backendResult.decision,
  confidence: backendResult.confidence === 'High' ? 95 : 75,
  action: 'Blocked',
  actionSource: 'AI',
  behaviorPattern: 'Payment fraud behavior detected',
  rules: engineResult.rules,
  event_id: backendResult.event_id,
  backendModule: backendResult.module,
  backendSynced: true
};

if (decision.riskLevel === 'Medium Risk') {
  decision.action = 'Challenged';
}

if (decision.riskLevel === 'Low Risk') {
  decision.action = 'Approved';
}
  
      state.latestTransaction = transaction;
      state.latestResult = decision;
  
      saveActivityRecord();
      renderer();
    }
  
    function resetSimulation() {
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
        ring.style.background = 'conic-gradient(#38bdf8 0deg, rgba(51, 65, 85, 0.75) 0deg)';
      }
  
      renderSignals();
      renderBreakdown();
      renderInsights();
      renderActivityLog();
    }
  
    function exportCsv() {
      if (!state.activity.length) {
        alert('No payment activity to export yet.');
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
  
      var rows = state.activity.map(function (item) {
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
  
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
  
      link.href = url;
      link.download = 'payment-fraud-activity.csv';
      link.click();
  
      URL.revokeObjectURL(url);
    }
  
    function copyResult() {
      var t = state.latestTransaction;
      var r = state.latestResult;
  
      if (!t || !r) {
        alert('Analyze a payment first.');
        return;
      }
  
      var report = [
        'Payment Fraud Intelligence Report',
        '--------------------------------',
        'Timestamp: ' + t.timestamp,
        'Amount: ' + t.amount.toFixed(2) + ' ' + t.currency,
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
        'Action Source: ' + r.actionSource
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
  
    function clearLog() {
      state.activity = [];
      state.latestTransaction = null;
      state.latestResult = null;
    
      localStorage.removeItem(STORAGE_KEY);
    
      resetSimulation();
      renderInsights();
      renderActivityLog();
    
      window.dispatchEvent(new CustomEvent('aiTrustOsActivityUpdated'));
    }

    function restoreLatestProfile() {
      var latest = state.activity[0];
    
      if (!latest) return;
    
      safeText('paymentScoreValue', latest.score);
      safeText('paymentRiskLevelText', latest.riskLevel);
      safeText('paymentDecisionText', latest.decision);
      safeText('paymentConfidencePill', 'Confidence: Restored');
      safeText('paymentAmountText', latest.amount);
      safeText('paymentCurrencyText', latest.currency);
      safeText('paymentMethodText', latest.method);
      safeText('paymentCardCountryText', latest.cardCountry);
      safeText('paymentBillingCountryText', latest.billingCountry);
      safeText('paymentShippingCountryText', latest.shippingCountry);
      safeText('paymentIpCountryText', latest.ipCountry);
      safeText('paymentVelocityText', latest.velocity || 'Restored from log');
      safeText('paymentChargebackPatternText', latest.chargebackPattern || 'Restored from log');
      safeText('paymentBehaviorPattern', latest.behaviorPattern || 'Restored from log');
    
      var ring = byId('paymentScoreRing');
    
      if (ring) {
        var score = Number(latest.score) || 0;
        var degrees = Math.round((score / 100) * 360);
        var color = '#22c55e';
    
        if (score >= 80) {
          color = '#ef4444';
        } else if (score >= 50) {
          color = '#f59e0b';
        }
    
        ring.style.background = 'conic-gradient(' + color + ' ' + degrees + 'deg, rgba(51, 65, 85, 0.75) ' + degrees + 'deg)';
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
      if (resetBtn) resetBtn.addEventListener('click', resetSimulation);
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
          localStorage.setItem(AUTO_ACTION_KEY, autoActionToggle.checked ? 'true' : 'false');
        });
      }
    }
    
    function init() {
      if (!document.getElementById('paymentFraudModule')) return;
    
      try {
        state.activity = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch (error) {
        state.activity = [];
      }
    
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
    
      bindEvents();
    
      if (state.activity.length) {
        restoreLatestProfile();
      } else {
        resetSimulation();
      }
    
      renderInsights();
      renderActivityLog();
    }
    
    document.addEventListener('DOMContentLoaded', init);
    })();