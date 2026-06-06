(function () {
  'use strict';

  /*
    SherGuard API Abuse Intelligence
    Backend-first module.

    Risk events, profile, signals, breakdown, activity log, insights,
    copy, and export now read from backend dashboard events.

    LocalStorage remains only for safe UI preferences:
    - Auto Action toggle
    - Scenario selector
  */

  const AUTO_KEY = aiTrustScopedKey('aiTrustOsApiAutoAction');
  const SCENARIO_KEY = aiTrustScopedKey('aiTrustOsApiScenario');

  const state = {
    latestRequest: null,
    latestRules: [],
    latestDecision: null,
    backendActivity: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function safeHtml(id, value) {
    const el = byId(id);
    if (el) el.innerHTML = value;
  }

  function safeValue(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback || 'Unknown';
    }

    return String(value);
  }

  function toNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatDate(timestamp) {
    if (!timestamp) return '—';

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString();
  }

  function loadScenarioState() {
    const select = byId('apiScenarioSelect');
    if (!select) return;

    const saved = localStorage.getItem(SCENARIO_KEY);
    if (saved) select.value = saved;
  }

  function saveScenarioState() {
    const select = byId('apiScenarioSelect');
    if (!select) return;

    localStorage.setItem(SCENARIO_KEY, select.value);
  }

  function loadAutoActionState() {
    const toggle = byId('apiAutoActionToggle');
    if (!toggle) return;

    toggle.checked = localStorage.getItem(AUTO_KEY) === 'true';
  }

  function saveAutoActionState() {
    const toggle = byId('apiAutoActionToggle');
    if (!toggle) return;

    localStorage.setItem(AUTO_KEY, toggle.checked ? 'true' : 'false');
    renderer();
  }

  function getAutoActionEnabled() {
    const toggle = byId('apiAutoActionToggle');
    let enabled = toggle && toggle.checked;

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

  function getAction(decision) {
    const autoEnabled = getAutoActionEnabled();

    if (!autoEnabled) {
      return {
        action: decision && decision.decision ? decision.decision : 'Suggested',
        actionSource: 'Backend'
      };
    }

    if (decision.riskLevel === 'High Risk') {
      return {
        action: 'Blocked',
        actionSource: 'AI'
      };
    }

    if (decision.riskLevel === 'Medium Risk') {
      return {
        action: 'Rate Limited',
        actionSource: 'AI'
      };
    }

    return {
      action: 'Allowed',
      actionSource: 'AI'
    };
  }

  function getDecisionFromRisk(riskLevel) {
    if (riskLevel === 'High Risk') return 'Block';
    if (riskLevel === 'Medium Risk') return 'Rate Limit';
    return 'Allow';
  }

  function parserLayer() {
    const scenarioSelect = byId('apiScenarioSelect');
    const selectedScenario = scenarioSelect ? scenarioSelect.value : 'random';
    const apiConsumerId = 'api-client-' + randomNumber(1001, 1008);

    if (selectedScenario === 'normal') {
      return {
        timestamp: nowIso(),
        apiConsumerId: apiConsumerId,
        endpoint: '/api/user/profile',
        method: 'GET',
        status: 200,
        rate: randomNumber(8, 35),
        repeatedRequests: randomNumber(1, 8),
        missingHeaders: false,
        authHeaderPresent: true,
        suspiciousEndpoint: false,
        ipReputation: 'Trusted'
      };
    }

    if (selectedScenario === 'burst') {
      return {
        timestamp: nowIso(),
        apiConsumerId: apiConsumerId,
        endpoint: randomItem(['/api/login', '/api/signup', '/api/checkout']),
        method: randomItem(['POST', 'GET']),
        status: 429,
        rate: randomNumber(190, 320),
        repeatedRequests: randomNumber(65, 120),
        missingHeaders: randomItem([true, false]),
        authHeaderPresent: true,
        suspiciousEndpoint: false,
        ipReputation: randomItem(['Unknown', 'Suspicious', 'High Risk'])
      };
    }

    if (selectedScenario === 'scraper') {
      return {
        timestamp: nowIso(),
        apiConsumerId: apiConsumerId,
        endpoint: randomItem(['/api/user/profile', '/api/products', '/api/search']),
        method: 'GET',
        status: randomItem([200, 200, 200, 429]),
        rate: randomNumber(90, 180),
        repeatedRequests: randomNumber(45, 95),
        missingHeaders: true,
        authHeaderPresent: randomItem([true, false]),
        suspiciousEndpoint: false,
        ipReputation: randomItem(['Unknown', 'Suspicious'])
      };
    }

    if (selectedScenario === 'credential') {
      return {
        timestamp: nowIso(),
        apiConsumerId: apiConsumerId,
        endpoint: '/api/login',
        method: 'POST',
        status: randomItem([401, 401, 403]),
        rate: randomNumber(85, 170),
        repeatedRequests: randomNumber(55, 120),
        missingHeaders: false,
        authHeaderPresent: false,
        suspiciousEndpoint: false,
        ipReputation: randomItem(['Suspicious', 'High Risk'])
      };
    }

    if (selectedScenario === 'token') {
      return {
        timestamp: nowIso(),
        apiConsumerId: apiConsumerId,
        endpoint: '/api/token/refresh',
        method: 'POST',
        status: randomItem([200, 401, 403, 429]),
        rate: randomNumber(70, 150),
        repeatedRequests: randomNumber(35, 95),
        missingHeaders: false,
        authHeaderPresent: true,
        suspiciousEndpoint: false,
        ipReputation: randomItem(['Unknown', 'Suspicious', 'High Risk'])
      };
    }

    if (selectedScenario === 'payment') {
      return {
        timestamp: nowIso(),
        apiConsumerId: apiConsumerId,
        endpoint: '/api/checkout',
        method: 'POST',
        status: randomItem([400, 401, 403, 429, 500]),
        rate: randomNumber(60, 140),
        repeatedRequests: randomNumber(25, 80),
        missingHeaders: randomItem([true, false]),
        authHeaderPresent: randomItem([true, false]),
        suspiciousEndpoint: false,
        ipReputation: randomItem(['Unknown', 'Suspicious', 'High Risk'])
      };
    }

    if (selectedScenario === 'ai-agent') {
      return {
        timestamp: nowIso(),
        apiConsumerId: apiConsumerId,
        endpoint: randomItem(['/api/admin/export', '/api/user/profile', '/api/token/refresh']),
        method: randomItem(['GET', 'POST']),
        status: randomItem([200, 401, 403, 429]),
        rate: randomNumber(100, 240),
        repeatedRequests: randomNumber(45, 110),
        missingHeaders: randomItem([true, false]),
        authHeaderPresent: randomItem([true, false]),
        suspiciousEndpoint: true,
        ipReputation: randomItem(['Unknown', 'Suspicious', 'High Risk'])
      };
    }

    const endpoints = [
      '/api/login',
      '/api/signup',
      '/api/checkout',
      '/api/password-reset',
      '/api/user/profile',
      '/api/admin/export',
      '/api/token/refresh'
    ];

    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const statuses = [200, 201, 400, 401, 403, 404, 429, 500];
    const endpoint = randomItem(endpoints);

    return {
      timestamp: nowIso(),
      apiConsumerId: apiConsumerId,
      endpoint: endpoint,
      method: randomItem(methods),
      status: randomItem(statuses),
      rate: randomNumber(5, 260),
      repeatedRequests: randomNumber(1, 90),
      missingHeaders: Math.random() < 0.35,
      authHeaderPresent: Math.random() > 0.32,
      suspiciousEndpoint: endpoint === '/api/admin/export',
      ipReputation: randomItem(['Trusted', 'Unknown', 'Suspicious', 'High Risk'])
    };
  }

  function isProtectedEndpoint(endpoint) {
    return [
      '/api/checkout',
      '/api/user/profile',
      '/api/admin/export',
      '/api/token/refresh'
    ].includes(endpoint);
  }

  function classifyThreat(request, decision) {
    const endpoint = safeValue(request.endpoint, '').toLowerCase();
    const status = toNumber(request.status, 200);
    const repeated = toNumber(request.repeatedRequests, 0);
    const rate = toNumber(request.rate, 0);
    const method = safeValue(request.method, 'GET').toUpperCase();

    if (endpoint.includes('checkout') || endpoint.includes('payment')) {
      return 'Payment API Abuse';
    }

    if (endpoint.includes('token') && repeated >= 20) {
      return 'Token Abuse';
    }

    if ((status === 401 || status === 403) && repeated >= 25) {
      return 'Credential Stuffing API';
    }

    if (endpoint.includes('admin') || endpoint.includes('export')) {
      return 'Sensitive Endpoint Abuse';
    }

    if (rate >= 180) {
      return 'Burst Traffic Attack';
    }

    if (method === 'GET' && repeated >= 40) {
      return 'Scraper API Bot';
    }

    if (rate >= 80) {
      return 'Abnormal API Usage';
    }

    if (decision && decision.riskLevel === 'Low Risk') {
      return 'Normal API Traffic';
    }

    return 'API Abuse Pattern';
  }

  function getBehaviorPattern(request, decision) {
    if (decision.riskLevel === 'High Risk') {
      return 'Abnormal / abusive pattern';
    }

    if (request.rate > 80 || request.repeatedRequests > 25) {
      return 'Elevated usage pattern';
    }

    return 'Normal API usage pattern';
  }

  function getApiReputation(record) {
    if (record.riskLevel === 'High Risk') {
      return 'Critical API Actor';
    }

    if (record.riskLevel === 'Medium Risk') {
      return 'Suspicious API Consumer';
    }

    if (record.ipReputation === 'Trusted') {
      return 'Trusted API Consumer';
    }

    return 'Known API Consumer';
  }

  function buildRulesFromBackend(reasons, request, decision) {
    const severity =
      decision.riskLevel === 'High Risk'
        ? 'High'
        : decision.riskLevel === 'Medium Risk'
        ? 'Medium'
        : 'Low';

    const rules = [];

    if (Array.isArray(reasons) && reasons.length) {
      reasons.forEach(function (reason, index) {
        const lower = String(reason).toLowerCase();

        rules.push({
          rule: reason,
          group:
            lower.includes('rate') || lower.includes('burst')
              ? 'Traffic Signals'
              : lower.includes('header') || lower.includes('auth')
              ? 'Header Signals'
              : lower.includes('endpoint') || lower.includes('admin')
              ? 'Endpoint Signals'
              : lower.includes('repeat') || lower.includes('request')
              ? 'Request Signals'
              : 'Risk Engine Signals',
          severity: severity,
          impact: index === 0 ? 'Score ' + decision.score + '/100' : '0',
          reason: reason,
          scoreImpact: index === 0 ? decision.score : 0
        });
      });
    }

    rules.push({
      rule: 'Backend risk score',
      group: 'Risk Engine Signals',
      severity: severity,
      impact: 'Score ' + decision.score + '/100',
      reason: 'Backend returned final API abuse risk score.',
      scoreImpact: decision.score
    });

    rules.push({
      rule: 'Backend decision',
      group: 'Risk Engine Signals',
      severity:
        decision.decision === 'Block'
          ? 'High'
          : decision.decision === 'Rate Limit' || decision.decision === 'Monitor'
          ? 'Medium'
          : 'Low',
      impact: decision.decision,
      reason: 'Backend returned final decision: ' + decision.decision + '.',
      scoreImpact: 0
    });

    if (!rules.length) {
      rules.push({
        rule: 'Backend API analysis completed',
        group: 'Risk Engine Signals',
        severity: 'Low',
        impact: '0',
        reason: 'No strong abuse indicators were returned by backend.',
        scoreImpact: 0
      });
    }

    return rules;
  }

  function getBackendApiEvents() {
    const records = Array.isArray(window.latestDashboardRecords)
      ? window.latestDashboardRecords
      : [];

    return records
      .filter(function (record) {
        const moduleName = String(
          record.moduleName ||
          record.module ||
          record.module_key ||
          ''
        ).toLowerCase();

        return moduleName.includes('api');
      })
      .map(mapBackendApiEvent)
      .filter(Boolean)
      .sort(function (a, b) {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
  }

  function mapBackendApiEvent(record) {
    if (!record || typeof record !== 'object') {
      return null;
    }

    const raw = record.raw_event || record.rawEvent || record;
    const signals = raw.signals || record.signals || {};

    const endpoint =
      signals.endpoint ||
      raw.endpoint ||
      record.endpoint ||
      '/unknown';

    const method =
      signals.method ||
      raw.method ||
      record.method ||
      'GET';

    const status =
      toNumber(
        signals.status_code ||
        raw.status_code ||
        raw.status ||
        record.status,
        200
      );

    const rate =
      toNumber(
        signals.request_rate ||
        raw.request_rate ||
        raw.rate ||
        record.rate,
        0
      );

    const repeatedRequests =
      toNumber(
        signals.repeated_requests ||
        raw.repeated_requests ||
        raw.repeatedRequests ||
        record.repeatedRequests,
        0
      );

    const authHeaderPresent =
      signals.auth_header_present === true ||
      raw.auth_header_present === true ||
      record.authHeaderPresent === true;

    const missingHeaders =
      signals.missing_headers === true ||
      raw.missing_headers === true ||
      record.missingHeaders === true;

    const ipReputation =
      signals.ip_reputation ||
      raw.ip_reputation ||
      raw.ipReputation ||
      record.ipReputation ||
      'Unknown';

    const riskLevel =
      raw.risk_level ||
      record.risk_level ||
      record.riskLevel ||
      record.riskLabel ||
      'Low Risk';

    const score =
      toNumber(raw.score || record.score || record.riskScore, 0);

    const decision = {
      score: score,
      riskLevel: riskLevel,
      decision:
        raw.decision ||
        record.decision ||
        getDecisionFromRisk(riskLevel),
      confidence:
        raw.confidence === 'High' ||
        record.confidence === 'High'
          ? 99
          : raw.confidence === 'Medium' ||
            record.confidence === 'Medium'
          ? 80
          : toNumber(raw.confidence || record.confidence, 80)
    };

    const request = {
      timestamp:
        raw.timestamp ||
        record.timestamp ||
        nowIso(),
      apiConsumerId:
        raw.api_consumer_id ||
        raw.apiConsumerId ||
        record.apiConsumerId ||
        'backend-api-client',
      endpoint: endpoint,
      method: method,
      status: status,
      rate: rate,
      repeatedRequests: repeatedRequests,
      missingHeaders: missingHeaders,
      authHeaderPresent: authHeaderPresent,
      suspiciousEndpoint:
        endpoint === '/api/admin/export' ||
        endpoint.includes('admin') ||
        endpoint.includes('export'),
      ipReputation: ipReputation
    };

    const reasons = Array.isArray(raw.reasons)
      ? raw.reasons
      : Array.isArray(record.reasons)
      ? record.reasons
      : Array.isArray(record.riskReasons)
      ? record.riskReasons
      : [];

    const actionData = getAction(decision);
    const classification = classifyThreat(request, decision);
    const rules = buildRulesFromBackend(reasons, request, decision);

    return {
      id: String(
        raw.event_id ||
        record.event_id ||
        record.id ||
        'api-event-' + request.timestamp
      ),
      event_id:
        raw.event_id ||
        record.event_id ||
        record.id,
      timestamp:
        request.timestamp,
      endpoint:
        request.endpoint,
      method:
        request.method,
      status:
        request.status,
      rate:
        request.rate,
      repeatedRequests:
        request.repeatedRequests,
      authHeaderPresent:
        request.authHeaderPresent,
      missingHeaders:
        request.missingHeaders,
      suspiciousEndpoint:
        request.suspiciousEndpoint,
      ipReputation:
        request.ipReputation,
      abuseClassification:
        classification,
      apiConsumerId:
        request.apiConsumerId,
      apiReputation:
        getApiReputation({
          riskLevel: decision.riskLevel,
          ipReputation: request.ipReputation
        }),
      riskLevel:
        decision.riskLevel,
      score:
        decision.score,
      decision:
        decision.decision,
      confidence:
        decision.confidence,
      action:
        actionData.action,
      actionSource:
        actionData.actionSource,
      rules:
        rules,
      riskReasons:
        reasons,
      request:
        request,
      backendModule:
        'API Abuse Intelligence',
      backendSynced:
        true
    };
  }

  function getBackendApiActivity() {
    state.backendActivity = getBackendApiEvents();

    return state.backendActivity;
  }

  function setCurrentFromLatestBackend() {
    const activity = getBackendApiActivity();
    const latest = activity.length ? activity[0] : null;

    if (!latest) {
      state.latestRequest = null;
      state.latestRules = [];
      state.latestDecision = null;
      return null;
    }

    state.latestRequest = latest.request;
    state.latestRules = latest.rules;
    state.latestDecision = {
      score: latest.score,
      riskLevel: latest.riskLevel,
      decision: latest.decision,
      confidence: latest.confidence
    };

    return latest;
  }

  function renderer() {
    const latest = setCurrentFromLatestBackend();

    if (!latest) {
      resetSimulation(false);
      renderActivityLog([]);
      renderInsights([]);
      renderExplainableAi();
      renderSignals();
      renderBreakdown();
      return;
    }

    const request = state.latestRequest;
    const decision = state.latestDecision;

    safeText('apiScoreValue', decision.score);
    safeText('apiRiskLevelText', decision.riskLevel);
    safeText('apiDecisionText', decision.decision);
    safeText('apiConfidencePill', decision.confidence + '%');
    safeText('apiEndpointText', request.endpoint);
    safeText('apiMethodText', request.method);
    safeText('apiStatusText', request.status);
    safeText('apiRateText', request.rate + ' / min');
    safeText('apiIpReputationText', request.ipReputation);
    safeText('apiConsumerIdText', request.apiConsumerId || 'Unknown');
    safeText('apiReputationText', latest.apiReputation || 'Known API Consumer');
    safeText('apiAuthHeaderText', request.authHeaderPresent ? 'Present' : 'Missing');
    safeText('apiBehaviorPattern', getBehaviorPattern(request, decision));

    const ring = byId('apiScoreRing');

    if (ring) {
      const degrees = decision.score * 3.6;
      let ringColor = '#22c55e';

      if (decision.score >= 80) {
        ringColor = '#ef4444';
      } else if (decision.score >= 50) {
        ringColor = '#f59e0b';
      }

      ring.style.background =
        'conic-gradient(' +
        ringColor +
        ' ' +
        degrees +
        'deg, rgba(51, 65, 85, 0.18) ' +
        degrees +
        'deg)';
    }

    renderExplainableAi();
    renderSignals();
    renderBreakdown();
    renderActivityLog(getBackendApiActivity());
    renderInsights(getBackendApiActivity());
  }

  function renderExplainableAi() {
    const decision = state.latestDecision;

    if (!decision) {
      safeText(
        'apiExplainSummary',
        'Run an API analysis or connect API traffic to see why the engine made its decision.'
      );
      safeHtml('apiExplainList', '');
      return;
    }

    const topRules = state.latestRules
      .filter(function (rule) {
        return rule.scoreImpact > 0;
      })
      .sort(function (a, b) {
        return b.scoreImpact - a.scoreImpact;
      })
      .slice(0, 3);

    safeText(
      'apiExplainSummary',
      'The API engine classified this request as ' +
      decision.riskLevel +
      ' because backend analysis matched ' +
      topRules.length +
      ' important risk signal(s). Final decision: ' +
      decision.decision +
      '.'
    );

    if (!topRules.length) {
      safeHtml(
        'apiExplainList',
        '<div class="api-abuse-explain-item"><strong>Normal traffic behavior</strong><span>No strong abuse indicators were detected.</span></div>'
      );
      return;
    }

    const html = topRules.map(function (rule) {
      return (
        '<div class="api-abuse-explain-item">' +
          '<strong>' + rule.rule + ' (' + rule.impact + ')</strong>' +
          '<span>' + rule.reason + '</span>' +
        '</div>'
      );
    }).join('');

    safeHtml('apiExplainList', html);
  }

  function renderSignals() {
    const request = state.latestRequest;
    const decision = state.latestDecision;

    if (!request || !decision) {
      safeHtml('apiSignalsPanel', '');
      return;
    }

    const groups = {
      'Request Signals': [
        'Method: ' + request.method,
        'Repeated Requests: ' + request.repeatedRequests,
        'Behavior: ' + getBehaviorPattern(request, decision)
      ],
      'Traffic Signals': [
        'Rate: ' + request.rate + ' / min',
        'Burst Traffic: ' + (request.rate >= 80 ? 'Detected' : 'Not detected')
      ],
      'Header Signals': [
        'Auth Header: ' + (request.authHeaderPresent ? 'Present' : 'Missing'),
        'Missing Headers: ' + (request.missingHeaders ? 'Yes' : 'No')
      ],
      'Endpoint Signals': [
        'Endpoint: ' + request.endpoint,
        'Suspicious Endpoint: ' + (request.suspiciousEndpoint ? 'Yes' : 'No')
      ],
      'Risk Engine Signals': [
        'IP Reputation: ' + request.ipReputation,
        'Risk Level: ' + decision.riskLevel,
        'Score: ' + decision.score + '/100',
        'Decision: ' + decision.decision,
        'Confidence: ' + decision.confidence + '%'
      ]
    };

    let html = '';

    Object.keys(groups).forEach(function (groupName) {
      html += '<div class="api-abuse-signal-group">';
      html += '<h4>' + groupName + '</h4>';
      html += '<ul>';

      groups[groupName].forEach(function (signal) {
        html += '<li>' + signal + '</li>';
      });

      html += '</ul>';
      html += '</div>';
    });

    safeHtml('apiSignalsPanel', html);
  }

  function renderBreakdown() {
    if (!state.latestRules.length) {
      safeHtml(
        'apiBreakdownBody',
        '<tr><td colspan="5">No backend API risk rules analyzed yet.</td></tr>'
      );
      return;
    }

    const html = state.latestRules.map(function (rule) {
      return (
        '<tr>' +
          '<td>' + safeValue(rule.rule, 'Backend rule') + '</td>' +
          '<td>' + safeValue(rule.group, 'Risk Engine Signals') + '</td>' +
          '<td><span class="api-abuse-badge">' + safeValue(rule.severity, 'Low') + '</span></td>' +
          '<td>' + safeValue(rule.impact, '0') + '</td>' +
          '<td>' + safeValue(rule.reason, 'Backend API event.') + '</td>' +
        '</tr>'
      );
    }).join('');

    safeHtml('apiBreakdownBody', html);
  }

  function renderActivityLog(activity) {
    const records = Array.isArray(activity)
      ? activity
      : getBackendApiActivity();

    if (!records.length) {
      safeHtml(
        'apiActivityBody',
        '<tr><td colspan="11">No backend API activity yet.</td></tr>'
      );
      return;
    }

    const html = records.map(function (item) {
      return (
        '<tr>' +
          '<td>' + formatDate(item.timestamp) + '</td>' +
          '<td>' + safeValue(item.endpoint, '/unknown') + '</td>' +
          '<td>' + safeValue(item.method, 'GET') + '</td>' +
          '<td>' + safeValue(item.status, 200) + '</td>' +
          '<td>' + safeValue(item.rate, 0) + ' / min</td>' +
          '<td>' + safeValue(item.abuseClassification, 'API Abuse Pattern') + '</td>' +
          '<td>' + safeValue(item.riskLevel, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.score, 0) + '</td>' +
          '<td>' + safeValue(item.decision, 'Unknown') + '</td>' +
          '<td>' + safeValue(item.action, 'Backend') + '</td>' +
          '<td>' + safeValue(item.actionSource, 'Backend') + '</td>' +
        '</tr>'
      );
    }).join('');

    safeHtml('apiActivityBody', html);
  }

  function renderInsights(activity) {
    const records = Array.isArray(activity)
      ? activity
      : getBackendApiActivity();

    const total = records.length;

    const high = records.filter(function (item) {
      return item.riskLevel === 'High Risk';
    }).length;

    const medium = records.filter(function (item) {
      return item.riskLevel === 'Medium Risk';
    }).length;

    const low = records.filter(function (item) {
      return item.riskLevel === 'Low Risk';
    }).length;

    const avgScore = total
      ? Math.round(
          records.reduce(function (sum, item) {
            return sum + toNumber(item.score, 0);
          }, 0) / total
        )
      : 0;

    safeText('apiTotalChecks', total);
    safeText('apiHighRiskCount', high);
    safeText('apiMediumRiskCount', medium);
    safeText('apiLowRiskCount', low);
    safeText('apiAvgRiskScore', avgScore);
    safeText(
      'apiHighRiskPercent',
      total ? Math.round((high / total) * 100) + '%' : '0%'
    );
    safeText('apiMostCommonEndpoint', getMostCommon(records, 'endpoint'));
    safeText('apiMostCommonMethod', getMostCommon(records, 'method'));
    safeText(
      'apiLastDecision',
      records[0] ? records[0].decision : '—'
    );
  }

  function getMostCommon(records, key) {
    if (!records.length) return '—';

    const counts = {};

    records.forEach(function (item) {
      const value = item[key] || 'Unknown';
      counts[value] = (counts[value] || 0) + 1;
    });

    return Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    })[0];
  }

  async function analyzeApiRequest() {
    saveScenarioState();

    const request = parserLayer();

    const backendResult = await aiTrustApiPost('/analyze/api-abuse', {
      endpoint: String(request.endpoint || '/unknown'),
      method: String(request.method || 'GET'),
      status_code: Number(request.status || 200),
      request_rate: Number(request.rate || 0),
      repeated_requests: Number(request.repeatedRequests || 0),
      auth_header_present: Boolean(request.authHeaderPresent),
      missing_headers: Boolean(request.missingHeaders),
      ip_reputation: String(request.ipReputation || 'Unknown')
    });

    const mapped = mapBackendApiEvent({
      moduleName: 'API Abuse Intelligence',
      module: 'API Abuse Intelligence',
      timestamp: backendResult.timestamp || nowIso(),
      raw_event: backendResult,
      risk_level: backendResult.risk_level,
      score: backendResult.score,
      decision: backendResult.decision,
      confidence: backendResult.confidence,
      reasons: backendResult.reasons,
      signals: {
        endpoint: request.endpoint,
        method: request.method,
        status_code: request.status,
        request_rate: request.rate,
        repeated_requests: request.repeatedRequests,
        auth_header_present: request.authHeaderPresent,
        missing_headers: request.missingHeaders,
        ip_reputation: request.ipReputation
      }
    });

    if (mapped) {
      state.latestRequest = mapped.request;
      state.latestRules = mapped.rules;
      state.latestDecision = {
        score: mapped.score,
        riskLevel: mapped.riskLevel,
        decision: mapped.decision,
        confidence: mapped.confidence
      };
    }

    renderer();

    window.dispatchEvent(
      new CustomEvent('aiTrustOsActivityUpdated', {
        detail: {
          module: 'API Abuse',
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
      new CustomEvent('sherguardApiAbuseAnalyzed', {
        detail: {
          result: mapped,
          backendResult: backendResult
        }
      })
    );
  }

  function resetSimulation(renderEverything) {
    state.latestRequest = null;
    state.latestRules = [];
    state.latestDecision = null;

    safeText('apiScoreValue', '0');
    safeText('apiRiskLevelText', 'Not analyzed');
    safeText('apiDecisionText', 'Waiting');
    safeText('apiConfidencePill', '0%');
    safeText('apiEndpointText', '—');
    safeText('apiMethodText', '—');
    safeText('apiStatusText', '—');
    safeText('apiRateText', '—');
    safeText('apiIpReputationText', '—');
    safeText('apiConsumerIdText', '—');
    safeText('apiReputationText', '—');
    safeText('apiAuthHeaderText', '—');
    safeText('apiBehaviorPattern', '—');

    safeHtml('apiSignalsPanel', '');
    safeHtml(
      'apiBreakdownBody',
      '<tr><td colspan="5">No backend API risk rules analyzed yet.</td></tr>'
    );

    safeText(
      'apiExplainSummary',
      'Run an API analysis or connect API traffic to see why the engine made its decision.'
    );
    safeHtml('apiExplainList', '');

    const ring = byId('apiScoreRing');

    if (ring) {
      ring.style.background =
        'conic-gradient(#38bdf8 0deg, rgba(51, 65, 85, 0.9) 0deg)';
    }

    if (renderEverything !== false) {
      renderActivityLog([]);
      renderInsights([]);
    }
  }

  async function clearLog() {
    if (!window.confirm('Clear backend dashboard activity? This clears organization security events, not only API Abuse.')) {
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
      window.latestDashboardRecords = [];

      resetSimulation();

      window.dispatchEvent(
        new CustomEvent('aiTrustOsActivityUpdated', {
          detail: {
            module: 'API Abuse',
            cleared: true,
            backendSynced: true,
            timestamp: nowIso()
          }
        })
      );

    } catch (error) {
      console.error('API Abuse backend clear failed:', error);
      alert('Backend clear failed. Use main dashboard Clear Activity if needed.');
    }
  }

  function exportCsv() {
    const records = getBackendApiActivity();

    if (!records.length) return;

    const headers = [
      'Timestamp',
      'Endpoint',
      'Method',
      'Status',
      'Rate',
      'IP Reputation',
      'Threat Classification',
      'API Consumer ID',
      'API Reputation',
      'Risk Level',
      'Score',
      'Decision',
      'Confidence',
      'Action',
      'Action Source'
    ];

    const rows = records.map(function (item) {
      return [
        item.timestamp,
        item.endpoint,
        item.method,
        item.status,
        item.rate,
        item.ipReputation,
        item.abuseClassification,
        item.apiConsumerId,
        item.apiReputation,
        item.riskLevel,
        item.score,
        item.decision,
        item.confidence,
        item.action,
        item.actionSource
      ];
    });

    const csv = [headers].concat(rows).map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'api-abuse-backend-activity.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  function copyResult() {
    const records = getBackendApiActivity();

    if (!records.length) return;

    const latest = records[0];

    const report =
      'SherGuard — API Abuse Intelligence Report\n' +
      'Endpoint: ' + latest.endpoint + '\n' +
      'Method: ' + latest.method + '\n' +
      'Status: ' + latest.status + '\n' +
      'Rate: ' + latest.rate + ' / min\n' +
      'Threat Classification: ' + latest.abuseClassification + '\n' +
      'API Consumer ID: ' + latest.apiConsumerId + '\n' +
      'API Reputation: ' + latest.apiReputation + '\n' +
      'Risk Level: ' + latest.riskLevel + '\n' +
      'Score: ' + latest.score + '\n' +
      'Decision: ' + latest.decision + '\n' +
      'Action: ' + latest.action + '\n' +
      'Action Source: ' + latest.actionSource + '\n' +
      'Reasons:\n' +
      (
        Array.isArray(latest.riskReasons) && latest.riskReasons.length
          ? latest.riskReasons.map(function (reason) {
              return '- ' + reason;
            }).join('\n')
          : '- No backend reasons recorded.'
      );

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report);
    }
  }

  function bindEvents() {
    const analyzeBtn = byId('apiAnalyzeBtn');
    const resetBtn = byId('apiResetBtn');
    const copyBtn = byId('apiCopyResultBtn');
    const exportBtn = byId('apiExportCsvBtn');
    const clearBtn = byId('apiClearLogBtn');
    const autoToggle = byId('apiAutoActionToggle');
    const scenarioSelect = byId('apiScenarioSelect');

    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeApiRequest);

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetSimulation();
      });
    }

    if (copyBtn) copyBtn.addEventListener('click', copyResult);
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
    if (clearBtn) clearBtn.addEventListener('click', clearLog);
    if (autoToggle) autoToggle.addEventListener('change', saveAutoActionState);
    if (scenarioSelect) scenarioSelect.addEventListener('change', saveScenarioState);

    window.addEventListener('sherguardDashboardEventsSynced', function () {
      renderer();
    });

    window.addEventListener('aiTrustOsActivityUpdated', function () {
      setTimeout(function () {
        renderer();
      }, 500);
    });
  }

  function init() {
    if (!byId('apiAbuseModule')) return;

    loadAutoActionState();
    loadScenarioState();
    bindEvents();

    renderer();

    setTimeout(function () {
      renderer();
    }, 250);
  }

  window.SherGuardApiAbuse = {
    analyze: analyzeApiRequest,
    getBackendApiEvents: getBackendApiEvents,
    render: renderer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();