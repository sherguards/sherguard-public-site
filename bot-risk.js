(function () {
  'use strict';

  var STORAGE_KEY = aiTrustScopedKey('aiTrustOsBotRiskActivity');
var AUTO_KEY = aiTrustScopedKey('aiTrustOsBotAutoAction');
var SCENARIO_KEY = aiTrustScopedKey('aiTrustOsBotScenario');
var TIMELINE_KEY = aiTrustScopedKey('aiTrustOsBotThreatTimeline');
  var MAX_RECORDS = 150;

  var state = {
    activity: [],
    timeline: [],
    currentResult: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var el = byId(id);
    if (el) el.textContent = value;
  }

  function setHtml(id, value) {
    var el = byId(id);
    if (el) el.innerHTML = value;
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function now() {
    return new Date().toLocaleString();
  }

  function getScenario() {
    var select = byId('botRiskScenarioSelect');
    return select ? select.value : 'human';
  }

  function loadData() {
    try {
      state.activity = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      state.activity = [];
    }

    try {
      state.timeline = JSON.parse(localStorage.getItem(TIMELINE_KEY) || '[]');
    } catch (e) {
      state.timeline = [];
    }

    var savedScenario = localStorage.getItem(SCENARIO_KEY);
    if (savedScenario && byId('botRiskScenarioSelect')) {
      byId('botRiskScenarioSelect').value = savedScenario;
    }

    if (byId('botAutoActionToggle')) {
      byId('botAutoActionToggle').checked = localStorage.getItem(AUTO_KEY) === 'true';
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.activity.slice(0, MAX_RECORDS)));
    localStorage.setItem(TIMELINE_KEY, JSON.stringify(state.timeline.slice(0, 100)));
  }

  function buildSession() {
    var scenario = getScenario();

    var presets = {
      human: {
        sessionTime: rand(42, 180),
        clicks: rand(4, 18),
        mouse: true,
        scroll: true,
        keys: true,
        botType: 'Human Session',
        interaction: 'Natural'
      },
      'fast-click-bot': {
        sessionTime: rand(3, 12),
        clicks: rand(45, 120),
        mouse: false,
        scroll: false,
        keys: false,
        botType: 'Fast Click Bot',
        interaction: 'Automated'
      },
      'scripted-signup': {
        sessionTime: rand(5, 18),
        clicks: rand(18, 45),
        mouse: false,
        scroll: false,
        keys: true,
        botType: 'Scripted Signup Bot',
        interaction: 'Scripted'
      },
      scraper: {
        sessionTime: rand(8, 25),
        clicks: rand(1, 6),
        mouse: false,
        scroll: true,
        keys: false,
        botType: 'Scraper Bot',
        interaction: 'Crawler-like'
      },
      'credential-stuffing': {
        sessionTime: rand(4, 16),
        clicks: rand(20, 70),
        mouse: false,
        scroll: false,
        keys: true,
        botType: 'Credential Stuffing Bot',
        interaction: 'Repeated Login'
      },
      'ai-agent': {
        sessionTime: rand(6, 30),
        clicks: rand(10, 40),
        mouse: false,
        scroll: true,
        keys: true,
        botType: 'AI Agent Bot',
        interaction: 'AI Automation'
      }
    };

    var session = presets[scenario] || presets.human;
    session.scenario = scenario;
    session.timestamp = now();

    return session;
  }

  function analyzeRules(session) {
    var rules = [];
    var score = 20;

    function add(rule, group, severity, impact, reason) {
      rules.push({ rule: rule, group: group, severity: severity, impact: impact, reason: reason });
      score += impact;
    }

    if (session.sessionTime < 15) {
      add('Very Short Session', 'Timing Signals', 'High', 24, 'Session completed too quickly for normal human behavior.');
    }

    if (session.clicks > 40) {
      add('Abnormal Click Volume', 'Interaction Signals', 'High', 26, 'Click count is much higher than expected.');
    }

    if (!session.mouse) {
      add('No Mouse Movement', 'Behavior Signals', 'Medium', 14, 'No natural mouse movement detected.');
    }

    if (!session.scroll) {
      add('No Scroll Activity', 'Behavior Signals', 'Medium', 10, 'Session has no normal scroll behavior.');
    }

    if (session.scenario === 'credential-stuffing') {
      add('Credential Stuffing Pattern', 'Threat Signals', 'High', 32, 'Repeated login-style automation behavior detected.');
    }

    if (session.scenario === 'scraper') {
      add('Scraper Pattern', 'Threat Signals', 'High', 28, 'Crawler-like behavior detected.');
    }

    if (session.scenario === 'ai-agent') {
      add('AI Agent Automation', 'Threat Signals', 'High', 30, 'AI-driven automated session pattern detected.');
    }

    if (session.scenario === 'human') {
      add('Natural Human Pattern', 'Trust Signals', 'Low', -15, 'Human-like interaction signals reduce risk.');
    }

    score = Math.max(0, Math.min(100, score));

    return { score: score, rules: rules };
  }

  function decide(score, scenario) {

    var pattern = String(scenario || '').toLowerCase();
  
    if (
      pattern.indexOf('selenium') !== -1 ||
      pattern.indexOf('puppeteer') !== -1 ||
      pattern.indexOf('webdriver') !== -1 ||
      pattern.indexOf('headless') !== -1
    ) {
      return {
        risk: 'High Risk',
        decision: 'Block'
      };
    }
  
    if (
      pattern.indexOf('ai') !== -1 ||
      pattern.indexOf('automation') !== -1 ||
      pattern.indexOf('bot') !== -1
    ) {
  
      if (score >= 60) {
        return {
          risk: 'High Risk',
          decision: 'Block'
        };
      }
  
      return {
        risk: 'Medium Risk',
        decision: 'Challenge'
      };
    }
  
    if (score >= 60) {
      return {
        risk: 'High Risk',
        decision: 'Block'
      };
    }
  
    if (score >= 30) {
      return {
        risk: 'Medium Risk',
        decision: 'Monitor'
      };
    }
  
    return {
      risk: 'Low Risk',
      decision: 'Allow'
    };
  }

  function getAction(risk) {
    var auto = byId('botAutoActionToggle') && byId('botAutoActionToggle').checked;
  
    if (
      window.aiAgentConfig &&
      (
        window.aiAgentConfig.masterEnabled === false ||
        window.aiAgentConfig.autoAction === false
      )
    ) {
      auto = false;
    }
  
    if (!auto) return { action: 'Suggested', source: 'Manual' };
    if (risk === 'High Risk') return { action: 'Blocked', source: 'AI' };
    if (risk === 'Medium Risk') return { action: 'Monitored', source: 'AI' };
    return { action: 'Allowed', source: 'AI' };
  }

  async function analyzeBotRisk() {
    try {
      localStorage.setItem(SCENARIO_KEY, getScenario());
  
      var session = buildSession();
  
      var backendResult = await aiTrustApiPost('/analyze/bot', {
        session_time: session.sessionTime,
        clicks: session.clicks,
        mouse_movement: session.mouse,
        scroll_activity: session.scroll,
        keypress_activity: session.keys,
        scenario: session.scenario
      });
  
      var ruleResult = analyzeRules(session);
      var decision = decide(ruleResult.score);
      var action = getAction(backendResult.risk_level || decision.risk);
  
      var repeatCount = state.activity.filter(function (item) {
        return item.botType === session.botType;
      }).length + 1;
  
      var result = {
        timestamp: backendResult.timestamp || session.timestamp,
        sessionTime: session.sessionTime,
        scenario: session.scenario,
        botType: session.botType,
        interaction: session.interaction,
        mouse: session.mouse,
        scroll: session.scroll,
        keys: session.keys,
        clicks: session.clicks,
        score: backendResult.score,
        riskLevel: backendResult.risk_level,
        decision: backendResult.decision,
        confidence: backendResult.confidence === 'High' ? 95 : 70,
        action: action.action,
        actionSource: action.source,
        repeatAttempts: repeatCount,
        trustLevel:
  backendResult.bot_reputation &&
  backendResult.bot_reputation.trust_level
    ? backendResult.bot_reputation.trust_level
    : 'Unknown',

botReputation:
  backendResult.bot_reputation &&
  backendResult.bot_reputation.reputation
    ? backendResult.bot_reputation.reputation
    : 'Unknown',

seenCount:
  backendResult.bot_reputation &&
  backendResult.bot_reputation.seen_count
    ? backendResult.bot_reputation.seen_count
    : 1,

highRiskCount:
  backendResult.bot_reputation &&
  backendResult.bot_reputation.high_risk_count
    ? backendResult.bot_reputation.high_risk_count
    : 0,
        rules: ruleResult.rules,
        event_id: backendResult.event_id,
        backendModule: backendResult.module,
        backendSynced: true
      };
  
      state.currentResult = result;
      state.activity.unshift(result);
      state.activity = state.activity.slice(0, MAX_RECORDS);
  
      state.timeline.unshift({
        timestamp: result.timestamp,
        label: result.botType + ' · ' + result.riskLevel,
        detail: result.decision + ' · ' + result.action
      });
  
      saveData();
      renderAll();
  
      window.dispatchEvent(new CustomEvent('aiTrustOsActivityUpdated', {
        detail: {
          module: 'Bot Detection',
          storageKey: STORAGE_KEY,
          riskLabel: result.riskLevel,
          score: result.score,
          decision: result.decision,
          action: result.action,
          actionSource: result.actionSource,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error('Bot Detection analysis failed:', error);
      alert(error && error.message ? error.message : 'Bot Detection analysis failed.');
    }
  }

  function renderAll() {
    var result = state.currentResult || state.activity[0];

    if (result) {
      setText('botScoreValue', result.score);
      setText('botRiskLevelText', result.riskLevel);
      setText('botDecisionText', result.decision);
      setText('botFinalDecision', result.decision);
      setText('botConfidencePill', 'Confidence ' + result.confidence + '%');
      setText('botSessionTime', result.sessionTime + 's');
      setText('botBehaviorPattern', result.interaction);
      setText('botProfileScore', result.score);
      setText('botPatternPill', result.botType);
      setText(
        'botReputationText',
        result.botReputation || 'Unknown'
      );
      
      setText(
        'botRepeatAttempts',
        String(result.seenCount || 1)
      );
      
      setText(
        'botAiEnforcementText',
        result.action || result.decision || 'Unknown'
      );

      setText(
        'botDecisionText',
        result.decision || 'Unknown'
      );

      setText('botMouseActivity', result.mouse ? 'Yes' : 'No');
      setText('botClickCount', result.clicks);
      setText('botScrollActivity', result.scroll ? 'Yes' : 'No');
      setText('botKeypressActivity', result.keys ? 'Yes' : 'No');

      var ring = byId('botScoreRing');

if (ring) {
  ring.style.setProperty('--bot-score', result.score);

  ring.classList.remove('bot-risk-ring-low', 'bot-risk-ring-medium', 'bot-risk-ring-high');

  if (result.riskLevel === 'High Risk') {
    ring.classList.add('bot-risk-ring-high');
  } else if (result.riskLevel === 'Medium Risk') {
    ring.classList.add('bot-risk-ring-medium');
  } else {
    ring.classList.add('bot-risk-ring-low');
  }
}

      renderSignals(result);
      renderBreakdown(result.rules);
    }

    renderInsights();
    renderActivity();
    renderTimeline();
  }

  function renderSignals(result) {
    var html =
      '<div class="bot-risk-signal-group"><h4>Behavior Signals</h4><ul>' +
      '<li>Mouse Activity: ' + (result.mouse ? 'Detected' : 'Missing') + '</li>' +
      '<li>Scroll Activity: ' + (result.scroll ? 'Detected' : 'Missing') + '</li>' +
      '<li>Keypress Activity: ' + (result.keys ? 'Detected' : 'Missing') + '</li>' +
      '</ul></div>' +
      '<div class="bot-risk-signal-group"><h4>Automation Signals</h4><ul>' +
      '<li>Bot Type: ' + result.botType + '</li>' +
      '<li>Repeat Attempts: ' + result.repeatAttempts + '</li>' +
      '<li>Final Action: ' + result.action + '</li>' +
      '</ul></div>';

    setHtml('botSignalsPanel', html);
  }

  function renderBreakdown(rules) {
    if (!rules || !rules.length) {
      setHtml('botBreakdownBody', '<tr><td colspan="5">No risk rules triggered.</td></tr>');
      return;
    }

    setHtml('botBreakdownBody', rules.map(function (rule) {
      return '<tr><td>' + rule.rule + '</td><td>' + rule.group + '</td><td>' + rule.severity + '</td><td>' + (rule.impact > 0 ? '+' : '') + rule.impact + '</td><td>' + rule.reason + '</td></tr>';
    }).join(''));
  }

  function renderActivity() {
    if (!state.activity.length) {
      setHtml('botActivityBody', '<tr><td colspan="10">No bot risk activity yet.</td></tr>');
      return;
    }

    setHtml('botActivityBody', state.activity.map(function (item) {
      return '<tr>' +
        '<td>' + item.timestamp + '</td>' +
        '<td>' + item.sessionTime + 's</td>' +
        '<td>' + item.scenario + '</td>' +
        '<td>' + item.botType + '</td>' +
        '<td>' + item.interaction + '</td>' +
        '<td>' + item.riskLevel + '</td>' +
        '<td>' + item.score + '</td>' +
        '<td>' + item.decision + '</td>' +
        '<td>' + item.action + '</td>' +
        '<td>' + item.actionSource + '</td>' +
      '</tr>';
    }).join(''));
  }

  function renderTimeline() {
    if (!state.timeline.length) {
      setHtml('botThreatTimelineList', '<div class="bot-risk-empty">No bot threat timeline events yet.</div>');
      return;
    }

    setHtml('botThreatTimelineList', state.timeline.slice(0, 8).map(function (item) {
      return '<div class="bot-risk-timeline-item"><strong>' + item.label + '</strong><p>' + item.detail + '</p><small>' + item.timestamp + '</small></div>';
    }).join(''));
  }

  function renderInsights() {
    var total = state.activity.length;
    var bots = state.activity.filter(function (i) { return i.riskLevel !== 'Low Risk'; }).length;
    var humans = total - bots;

    var avg = total ? Math.round(state.activity.reduce(function (sum, i) {
      return sum + i.sessionTime;
    }, 0) / total) : 0;

    setText('botAvgSessionTime', avg + 's');
    setText('botDetectionPercent', total ? Math.round((bots / total) * 100) + '%' : '0%');
    setText('botHumanVsBotPercent', total ? Math.round((humans / total) * 100) + '% / ' + Math.round((bots / total) * 100) + '%' : '0% / 0%');
    setText('botCommonPattern', state.activity[0] ? state.activity[0].botType : 'None');
    setText('botLastSessionResult', state.activity[0] ? state.activity[0].riskLevel + ' · ' + state.activity[0].decision : 'No sessions yet');
  }

  function resetSession() {
    state.currentResult = null;

    setText('botScoreValue', '0');
    setText('botRiskLevelText', 'Low Risk');
    setText('botDecisionText', 'Allow');
    setText('botConfidencePill', 'Confidence 0%');
    setText('botSessionTime', '0s');
    setText('botBehaviorPattern', 'Waiting');
    setText('botProfileScore', '0');
    setText('botFinalDecision', 'Allow');
    setText('botPatternPill', 'Waiting');
    setText('botReputationText', 'Unknown');
    setText('botRepeatAttempts', '0');
    setText('botAiEnforcementText', 'Suggested');

    setHtml('botSignalsPanel', '');
    setHtml('botBreakdownBody', '<tr><td colspan="5">No analysis yet. Click “Analyze Bot Risk”.</td></tr>');
  }

  function clearLog() {
    state.activity = [];
    state.timeline = [];
    state.currentResult = null;
    saveData();
    resetSession();
    renderInsights();
    renderActivity();
    renderTimeline();

    window.dispatchEvent(new CustomEvent('aiTrustOsActivityUpdated'));
  }

  function copyResult() {
    var item = state.currentResult || state.activity[0];
    if (!item) return;

    var text =
      'Bot Detection Report\n' +
      'Risk Level: ' + item.riskLevel + '\n' +
      'Score: ' + item.score + '\n' +
      'Decision: ' + item.decision + '\n' +
      'Bot Type: ' + item.botType + '\n' +
      'Action: ' + item.action;

    navigator.clipboard.writeText(text);
  }

  function exportCsv() {
    if (!state.activity.length) return;

    var rows = ['Timestamp,Session Time,Scenario,Bot Type,Interaction,Risk Level,Score,Decision,Action,Action Source'];

    state.activity.forEach(function (item) {
      rows.push([
        item.timestamp,
        item.sessionTime,
        item.scenario,
        item.botType,
        item.interaction,
        item.riskLevel,
        item.score,
        item.decision,
        item.action,
        item.actionSource
      ].map(function (v) {
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(','));
    });

    var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bot-risk-activity.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    if (byId('botAnalyzeBtn')) byId('botAnalyzeBtn').addEventListener('click', analyzeBotRisk);
    if (byId('botResetSessionBtn')) byId('botResetSessionBtn').addEventListener('click', resetSession);
    if (byId('botClearLogBtn')) byId('botClearLogBtn').addEventListener('click', clearLog);
    if (byId('botClearHistoryTopBtn')) byId('botClearHistoryTopBtn').addEventListener('click', clearLog);
    if (byId('botCopyResultBtn')) byId('botCopyResultBtn').addEventListener('click', copyResult);
    if (byId('botExportCsvBtn')) byId('botExportCsvBtn').addEventListener('click', exportCsv);

    if (byId('botAutoActionToggle')) {
      byId('botAutoActionToggle').addEventListener('change', function (e) {
        localStorage.setItem(AUTO_KEY, e.target.checked ? 'true' : 'false');
      });
    }

    if (byId('botRiskScenarioSelect')) {
      byId('botRiskScenarioSelect').addEventListener('change', function (e) {
        localStorage.setItem(SCENARIO_KEY, e.target.value);
      });
    }
  }

  function init() {
    if (!byId('botRiskModule')) return;

    loadData();
    bindEvents();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();