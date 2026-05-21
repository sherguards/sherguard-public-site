(function () {
    'use strict';
  
    const STORAGE_KEY = 'aiTrustOsApiAbuseActivity';
const REPUTATION_KEY = 'aiTrustOsApiAbuseReputation';
const MAX_RECORDS = 100;
  
    const state = {
  latestRequest: null,
  latestRules: [],
  latestDecision: null,
  activity: [],
  reputation: {}
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
  
    function randomItem(items) {
      return items[Math.floor(Math.random() * items.length)];
    }
  
    function randomNumber(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  
    function loadActivity() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        state.activity = saved ? JSON.parse(saved) : [];
      } catch (error) {
        state.activity = [];
      }
    }

    function loadReputation() {
  try {
    const saved = localStorage.getItem(REPUTATION_KEY);
    state.reputation = saved ? JSON.parse(saved) : {};
  } catch (error) {
    state.reputation = {};
  }
}

function saveReputation() {
  localStorage.setItem(REPUTATION_KEY, JSON.stringify(state.reputation));
}

function loadScenarioState() {
  const select = byId('apiScenarioSelect');
  if (!select) return;

  const saved = localStorage.getItem('aiTrustOsApiScenario');

  if (saved) {
    select.value = saved;
  }
}

function saveScenarioState() {
  const select = byId('apiScenarioSelect');
  if (!select) return;

  localStorage.setItem(
    'aiTrustOsApiScenario',
    select.value
  );
}

    function loadAutoActionState() {
      const toggle = byId('apiAutoActionToggle');
      if (!toggle) return;
    
      const saved = localStorage.getItem('aiTrustOsApiAutoAction');
    
      toggle.checked = saved === 'true';
    }
    
    function saveAutoActionState() {
      const toggle = byId('apiAutoActionToggle');
      if (!toggle) return;
    
      localStorage.setItem(
        'aiTrustOsApiAutoAction',
        toggle.checked
      );
    }
  
    function saveActivity() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.activity.slice(0, MAX_RECORDS)));
    }
  
    function parserLayer() {
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

      const scenarioSelect = byId('apiScenarioSelect');
const selectedScenario = scenarioSelect ? scenarioSelect.value : 'random';
const apiConsumerId = 'api-client-' + randomNumber(1001, 1008);

if (selectedScenario === 'normal') {
  return {
    timestamp: new Date().toLocaleString(),
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
    timestamp: new Date().toLocaleString(),
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
    timestamp: new Date().toLocaleString(),
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
    timestamp: new Date().toLocaleString(),
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
    timestamp: new Date().toLocaleString(),
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
    timestamp: new Date().toLocaleString(),
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
    timestamp: new Date().toLocaleString(),
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
  
      const endpoint = randomItem(endpoints);
      const method = randomItem(methods);
      const status = randomItem(statuses);
      const rate = randomNumber(5, 260);
      const repeatedRequests = randomNumber(1, 90);
      const missingHeaders = Math.random() < 0.35;
      const authHeaderPresent = Math.random() > 0.32;
      const suspiciousEndpoint = endpoint === '/api/admin/export';
      const ipReputation = randomItem(['Trusted', 'Unknown', 'Suspicious', 'High Risk']);
  
      return {
        timestamp: new Date().toLocaleString(),
        endpoint,
        method,
        status,
        rate,
        repeatedRequests,
        missingHeaders,
        authHeaderPresent,
        suspiciousEndpoint,
        ipReputation
      };
    }
  
    function ruleEngine(request) {
      const rules = [];
  
      function addRule(rule, group, severity, impact, reason, scoreImpact) {
        rules.push({ rule, group, severity, impact, reason, scoreImpact });
      }
  
      if (request.rate >= 180) {
        addRule('Very High Request Rate', 'Traffic Signals', 'High', '+25', 'Request rate is far above normal API usage.', 25);
      } else if (request.rate >= 80) {
        addRule('Elevated Request Rate', 'Traffic Signals', 'Medium', '+14', 'Request rate is higher than expected.', 14);
      } else {
        addRule('Normal Request Rate', 'Traffic Signals', 'Low', '-8', 'Traffic rate appears normal.', -8);
      }
  
      if (request.repeatedRequests >= 60) {
        addRule('Repeated Request Burst', 'Request Signals', 'High', '+22', 'Many repeated requests detected in a short window.', 22);
      } else if (request.repeatedRequests >= 25) {
        addRule('Moderate Repetition', 'Request Signals', 'Medium', '+10', 'Some repeated request behavior detected.', 10);
      }
  
      if (!request.authHeaderPresent && isProtectedEndpoint(request.endpoint)) {
        addRule('Missing Auth Header', 'Header Signals', 'High', '+24', 'Protected endpoint was accessed without an auth header.', 24);
      }
  
      if (request.missingHeaders) {
        addRule('Missing Standard Headers', 'Header Signals', 'Medium', '+10', 'Expected request headers are missing.', 10);
      }
  
      if (request.status === 429) {
        addRule('Rate Limit Triggered', 'Risk Engine Signals', 'High', '+22', 'API returned 429 rate limit response.', 22);
      }
      if (request.status >= 500) {
        addRule('Server Error Spike', 'Risk Engine Signals', 'Medium', '+18', 'Repeated server errors on API traffic can indicate abuse or stress testing.', 18);
      }
      
      if (request.endpoint === '/api/checkout' && request.repeatedRequests >= 25) {
        addRule('Repeated Checkout Attempts', 'Payment API Signals', 'High', '+28', 'Multiple repeated checkout requests detected on a payment endpoint.', 28);
      }
  
      if ((request.status === 401 || request.status === 403) && request.repeatedRequests >= 20) {
        addRule('Repeated Unauthorized Attempts', 'Risk Engine Signals', 'High', '+24', 'Repeated 401/403 behavior may indicate credential abuse.', 24);
      }
  
      if (request.suspiciousEndpoint) {
        addRule(
          'Sensitive Endpoint Access',
          'Endpoint Signals',
          'High',
          '+26',
          'Endpoint ' + request.endpoint + ' is sensitive or high-value.',
          26
        );
      }

      if (
        request.repeatedRequests >= 40 &&
        request.rate >= 100 &&
        request.method === 'POST'
      ) {
        addRule(
          'AI Agent Abuse Pattern',
          'AI Threat Signals',
          'High',
          '+30',
          'Automated AI/API behavior pattern detected across repeated high-rate POST activity.',
          30
        );
      }
  
      if (request.method === 'DELETE') {
        addRule('Destructive Method', 'Request Signals', 'Medium', '+12', 'DELETE method can be risky when behavior is abnormal.', 12);
      }
  
      if (request.ipReputation === 'High Risk') {
        addRule('High Risk IP Reputation', 'Risk Engine Signals', 'High', '+25', 'IP reputation is marked high risk.', 25);
      } else if (request.ipReputation === 'Suspicious') {
        addRule('Suspicious IP Reputation', 'Risk Engine Signals', 'Medium', '+14', 'IP reputation has suspicious history.', 14);
      } else if (request.ipReputation === 'Trusted') {
        addRule('Trusted IP Reputation', 'Risk Engine Signals', 'Low', '-12', 'Trusted IP lowers the total risk score.', -12);
      }
  
      if ((request.status === 200 || request.status === 201) && request.rate < 50 && request.ipReputation === 'Trusted') {
        addRule('Successful Normal Request', 'Risk Engine Signals', 'Low', '-15', 'Successful request from trusted source with normal rate.', -15);
      }
      if (
        window.aiAgentConfig &&
        window.aiAgentConfig.strictMode &&
        rules.length >= 2
      ) {
        addRule(
          'Strict AI Policy Pressure',
          'AI Policy Signals',
          'Medium',
          '+8',
          'Strict AI mode is enabled, so elevated API abuse receives stronger enforcement pressure.',
          8
        );
      }
  
      return rules;
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
      const scenarioSelect = byId('apiScenarioSelect');
      const selectedScenario = scenarioSelect ? scenarioSelect.value : 'random';
    
      if (selectedScenario === 'payment') {
        return 'Payment API Abuse';
      }
    
      if (selectedScenario === 'ai-agent') {
        return 'AI Agent API Abuse';
      }
    
      if (selectedScenario === 'credential') {
        return 'Credential Stuffing API';
      }
    
      if (selectedScenario === 'token') {
        return 'Token Abuse';
      }
    
      if (selectedScenario === 'burst') {
        return 'Burst Traffic Attack';
      }
    
      if (selectedScenario === 'scraper') {
        return 'Scraper API Bot';
      }
    
      if (selectedScenario === 'normal') {
        return 'Normal API Traffic';
      }
    
      if (request.endpoint === '/api/admin/export') {
        return 'Sensitive Endpoint Abuse';
      }
    
      if (request.endpoint === '/api/token/refresh' && request.repeatedRequests >= 20) {
        return 'Token Abuse';
      }
    
      if (request.status === 401 || request.status === 403) {
        if (request.repeatedRequests >= 25) {
          return 'Credential Stuffing API';
        }
      }
    
      if (request.rate >= 180) {
        return 'Burst Traffic Attack';
      }
    
      if (request.method === 'GET' && request.repeatedRequests >= 40) {
        return 'Scraper API Bot';
      }
    
      if (request.rate >= 80) {
        return 'Abnormal API Usage';
      }
    
      if (decision && decision.riskLevel === 'Low Risk') {
        return 'Normal API Traffic';
      }
    
      return 'API Abuse Pattern';
    }
  
    function decisionEngine(rules) {
      let score = 20;
  
      rules.forEach(function (rule) {
        score += rule.scoreImpact;
      });
  
      score = Math.max(5, Math.min(100, score));
  
      let riskLevel = 'Low Risk';
      let decision = 'Allow';
  
      if (score >= 80) {
        riskLevel = 'High Risk';
        decision = 'Block';
      } else if (score >= 50) {
        riskLevel = 'Medium Risk';
        decision = 'Rate Limit';
      }
  
      const confidence = Math.min(99, Math.max(70, score + randomNumber(8, 18)));
  
      return { score, riskLevel, decision, confidence };
    }

    function updateApiReputation(request, decision) {
  const consumerId = request.apiConsumerId || 'unknown-api-client';

  if (!state.reputation[consumerId]) {
    state.reputation[consumerId] = {
      totalRequests: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      reputation: 'Trusted'
    };
  }

  const profile = state.reputation[consumerId];

  profile.totalRequests += 1;

  if (decision.riskLevel === 'High Risk') {
    profile.highRiskCount += 1;
  }

  if (decision.riskLevel === 'Medium Risk') {
    profile.mediumRiskCount += 1;
  }

  if (profile.highRiskCount >= 3) {
    profile.reputation = 'Critical API Actor';
  } else if (profile.highRiskCount >= 1 || profile.mediumRiskCount >= 2) {
    profile.reputation = 'Suspicious API Consumer';
  } else {
    profile.reputation = 'Trusted API Consumer';
  }

  saveReputation();

  return profile;
}
  
    function getAction(decision) {
      const autoToggle = byId('apiAutoActionToggle');
const scenarioSelect = byId('apiScenarioSelect');
let autoEnabled = autoToggle && autoToggle.checked;

if (
  window.aiAgentConfig &&
  (
    window.aiAgentConfig.masterEnabled === false ||
    window.aiAgentConfig.autoAction === false
  )
) {
  autoEnabled = false;
}
  
      if (!autoEnabled) {
        return {
          action: 'Suggested',
          actionSource: 'Manual'
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
  
    function renderer() {
      const request = state.latestRequest;
      const decision = state.latestDecision;
  
      if (!request || !decision) return;
  
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
safeText(
  'apiReputationText',
  state.activity[0] && state.activity[0].apiReputation
    ? state.activity[0].apiReputation
    : 'Trusted API Consumer'
);
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
renderActivityLog();
renderInsights();

    }
  
    function getBehaviorPattern(request, decision) {
      if (decision.riskLevel === 'High Risk') return 'Abnormal / abusive pattern';
      if (request.rate > 80 || request.repeatedRequests > 25) return 'Elevated usage pattern';
      return 'Normal API usage pattern';
    }

    function renderExplainableAi() {
      const request = state.latestRequest;
      const decision = state.latestDecision;
    
      if (!request || !decision) return;
    
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
        'The API engine classified this request as ' + decision.riskLevel +
        ' because the request pattern matched ' + topRules.length +
        ' important risk signal(s). Final decision: ' + decision.decision + '.'
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
      if (!request || !decision) return;
  
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
          'Decision: ' + decision.decision
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
        safeHtml('apiBreakdownBody', '<tr><td colspan="5">No API risk rules analyzed yet.</td></tr>');
        return;
      }
  
      const html = state.latestRules.map(function (rule) {
        return (
          '<tr>' +
          '<td>' + rule.rule + '</td>' +
          '<td>' + rule.group + '</td>' +
          '<td><span class="api-abuse-badge">' + rule.severity + '</span></td>' +
          '<td>' + rule.impact + '</td>' +
          '<td>' + rule.reason + '</td>' +
          '</tr>'
        );
      }).join('');
  
      safeHtml('apiBreakdownBody', html);
    }
  
    function renderActivityLog() {
      if (!state.activity.length) {
        safeHtml('apiActivityBody', '<tr><td colspan="10">No API activity yet.</td></tr>');
        return;
      }
  
      const html = state.activity.map(function (item) {
        return (
          '<tr>' +
          '<td>' + item.timestamp + '</td>' +
          '<td>' + item.endpoint + '</td>' +
          '<td>' + item.method + '</td>' +
          '<td>' + item.status + '</td>' +
          '<td>' + item.rate + ' / min</td>' +
          '<td>' + (item.abuseClassification || 'API Abuse Pattern') + '</td>' +
          '<td>' + item.riskLevel + '</td>' +
          '<td>' + item.score + '</td>' +
          '<td>' + item.decision + '</td>' +
          '<td>' + item.action + '</td>' +
          '<td>' + item.actionSource + '</td>' +
          '</tr>'
        );
      }).join('');
  
      safeHtml('apiActivityBody', html);
    }
  
    function renderInsights() {
      const total = state.activity.length;
      const high = state.activity.filter(function (item) {
        return item.riskLevel === 'High Risk';
      }).length;
  
      const medium = state.activity.filter(function (item) {
        return item.riskLevel === 'Medium Risk';
      }).length;
  
      const low = state.activity.filter(function (item) {
        return item.riskLevel === 'Low Risk';
      }).length;
  
      const avgScore = total
        ? Math.round(state.activity.reduce(function (sum, item) {
          return sum + item.score;
        }, 0) / total)
        : 0;
  
      safeText('apiTotalChecks', total);
      safeText('apiHighRiskCount', high);
      safeText('apiMediumRiskCount', medium);
      safeText('apiLowRiskCount', low);
      safeText('apiAvgRiskScore', avgScore);
      safeText('apiHighRiskPercent', total ? Math.round((high / total) * 100) + '%' : '0%');
      safeText('apiMostCommonEndpoint', getMostCommon('endpoint'));
      safeText('apiMostCommonMethod', getMostCommon('method'));
      safeText('apiLastDecision', state.activity[0] ? state.activity[0].decision : '—');
    }
  
    function getMostCommon(key) {
      if (!state.activity.length) return '—';
  
      const counts = {};
  
      state.activity.forEach(function (item) {
        counts[item[key]] = (counts[item[key]] || 0) + 1;
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

      const rules = ruleEngine(request);

      const decision = {
        score: backendResult.score,
        riskLevel: backendResult.risk_level,
        decision: backendResult.decision,
        confidence: backendResult.confidence === 'High' ? 99 : 80
      };
      
      const classification = classifyThreat(request, decision);
      const reputationProfile = updateApiReputation(request, decision);
      const actionData = getAction(decision);
  
      const record = {
        timestamp: request.timestamp,
        endpoint: request.endpoint,
        method: request.method,
        status: request.status,
        rate: request.rate,
        ipReputation: request.ipReputation,
        abuseClassification: classification,
        apiConsumerId: request.apiConsumerId,
apiReputation: reputationProfile.reputation,
riskLevel: backendResult.risk_level,
score: backendResult.score,
decision: backendResult.decision,
confidence: backendResult.confidence,
event_id: backendResult.event_id,
backendModule: backendResult.module,
backendSynced: true,
        action: actionData.action,
        actionSource: actionData.actionSource
      };
  
      state.latestRequest = request;
      state.latestRules = rules;
      state.latestDecision = {
        score: backendResult.score,
        riskLevel: backendResult.risk_level,
        decision: backendResult.decision,
        confidence: backendResult.confidence === 'High' ? 99 : 80
      };
      state.activity.unshift(record);
      state.activity = state.activity.slice(0, MAX_RECORDS);
  
      saveActivity();

window.dispatchEvent(new CustomEvent('aiTrustOsActivityUpdated'));

renderer();
    }
  
    function resetSimulation() {
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
      safeText('apiAuthHeaderText', '—');
      safeText('apiBehaviorPattern', '—');
      safeHtml('apiSignalsPanel', '');
      renderBreakdown();
  
      const ring = byId('apiScoreRing');
      if (ring) {
        ring.style.background = 'conic-gradient(#38bdf8 0deg, rgba(51, 65, 85, 0.9) 0deg)';
      }
    }
  
    function exportCsv() {
      if (!state.activity.length) return;
  
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
  
      const rows = state.activity.map(function (item) {
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
  
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
  
      link.href = url;
      link.download = 'api-abuse-activity.csv';
      link.click();
  
      URL.revokeObjectURL(url);
    }
  
    function copyResult() {
      if (!state.activity.length) return;
  
      const latest = state.activity[0];
  
      const report =
        'API Abuse Intelligence Report\n' +
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
        'Action Source: ' + latest.actionSource;
  
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report);
      }
    }
  
    function clearLog() {
      state.activity = [];
      state.latestRequest = null;
      state.latestRules = [];
      state.latestDecision = null;
      state.reputation = {};
    
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      localStorage.removeItem(REPUTATION_KEY);
    
      resetSimulation();
      renderActivityLog();
      renderInsights();
    
      safeText('apiExplainSummary', 'Run an API analysis to see why the engine made its decision.');
      safeHtml('apiExplainList', '');
    
      window.dispatchEvent(new CustomEvent('aiTrustOsActivityUpdated'));
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
      if (resetBtn) resetBtn.addEventListener('click', resetSimulation);
      if (copyBtn) copyBtn.addEventListener('click', copyResult);
      if (exportBtn) exportBtn.addEventListener('click', exportCsv);
      if (clearBtn) clearBtn.addEventListener('click', clearLog);
      if (autoToggle) autoToggle.addEventListener('change', saveAutoActionState);
      if (scenarioSelect) scenarioSelect.addEventListener('change', saveScenarioState);
    }

    function restoreSavedApiView() {
      renderActivityLog();
      renderInsights();
    
      if (!state.activity.length) return;
    
      const latest = state.activity[0];
    
      safeText('apiScoreValue', latest.score || 0);
      safeText('apiRiskLevelText', latest.riskLevel || 'Not analyzed');
      safeText('apiDecisionText', latest.decision || 'Waiting');
      safeText('apiConfidencePill', (latest.confidence || 85) + '%');
      safeText('apiEndpointText', latest.endpoint || '—');
      safeText('apiMethodText', latest.method || '—');
      safeText('apiStatusText', latest.status || '—');
      safeText('apiRateText', latest.rate ? latest.rate + ' / min' : '—');
      safeText('apiIpReputationText', latest.ipReputation || 'Unknown');
      safeText('apiConsumerIdText', latest.apiConsumerId || 'Unknown');
      safeText('apiReputationText', latest.apiReputation || 'Trusted API Consumer');
      safeText('apiAuthHeaderText', 'Restored from saved activity');
      safeText('apiBehaviorPattern', latest.abuseClassification || 'Saved API activity');
    
      const ring = byId('apiScoreRing');
      if (ring) {
        const score = latest.score || 0;
        const degrees = score * 3.6;
        let ringColor = '#22c55e';
    
        if (score >= 80) {
          ringColor = '#ef4444';
        } else if (score >= 50) {
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
    }
  
    function init() {
      if (!byId('apiAbuseModule')) return;
    
      loadActivity();
      loadReputation();
      loadAutoActionState();
      bindEvents();
      loadScenarioState();
    
      renderBreakdown();
      restoreSavedApiView();
    
      setTimeout(function () {
        restoreSavedApiView();
      }, 250);
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();