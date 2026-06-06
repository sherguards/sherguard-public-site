(function () {
  'use strict';

  /*
    SherGuard Bot Detection Intelligence
    Backend-first module.

    Risk events, history, timeline, insights, profile, signals,
    breakdown, copy, export, and activity table now use backend events.

    LocalStorage remains only for safe UI preferences:
    - Auto Action toggle
    - Scenario selector
  */

  var AUTO_KEY = aiTrustScopedKey('aiTrustOsBotAutoAction');
  var SCENARIO_KEY = aiTrustScopedKey('aiTrustOsBotScenario');

  var state = {
    currentResult: null,
    backendActivity: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var element = byId(id);

    if (element) {
      element.textContent = value;
    }
  }

  function setHtml(id, value) {
    var element = byId(id);

    if (element) {
      element.innerHTML = value;
    }
  }

  function safeText(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback || 'Unknown';
    }

    return String(value);
  }

  function toNumber(value, fallback) {
    var number = Number(value);

    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return '—';
    }

    var date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleString();
  }

  function getScenario() {
    var select = byId('botRiskScenarioSelect');

    return select ? select.value : 'human';
  }

  function getAutoActionEnabled() {
    var toggle = byId('botAutoActionToggle');
    var enabled = toggle && toggle.checked;

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
        source: 'Backend'
      };
    }

    if (riskLevel === 'High Risk') {
      return {
        action: 'Blocked',
        source: 'AI'
      };
    }

    if (riskLevel === 'Medium Risk') {
      return {
        action: 'Monitored',
        source: 'AI'
      };
    }

    return {
      action: 'Allowed',
      source: 'AI'
    };
  }

  function getDecisionFromRisk(riskLevel) {
    if (riskLevel === 'High Risk') {
      return 'Block';
    }

    if (riskLevel === 'Medium Risk') {
      return 'Monitor';
    }

    return 'Allow';
  }

  function getScenarioPreset(scenario) {
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

    return {
      sessionTime: session.sessionTime,
      clicks: session.clicks,
      mouse: session.mouse,
      scroll: session.scroll,
      keys: session.keys,
      botType: session.botType,
      interaction: session.interaction,
      scenario: scenario,
      timestamp: nowIso()
    };
  }

  function getBackendBotEvents() {
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

        return (
          moduleName.includes('bot') ||
          moduleName.includes('bot detection')
        );
      })
      .map(mapBackendBotEvent)
      .filter(Boolean)
      .sort(function (a, b) {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
  }

  function mapBackendBotEvent(record) {
    if (!record || typeof record !== 'object') {
      return null;
    }

    var raw =
      record.raw_event ||
      record.rawEvent ||
      record;

    var signals =
      raw.signals ||
      record.signals ||
      {};

    var reputation =
      raw.bot_reputation ||
      record.bot_reputation ||
      {};

    var riskLevel =
      raw.risk_level ||
      record.risk_level ||
      record.riskLabel ||
      record.riskLevel ||
      'Low Risk';

    var score = toNumber(
      raw.score ||
      record.score ||
      record.riskScore,
      0
    );

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
        : toNumber(raw.confidence || record.confidence, 70);

    var reasons = Array.isArray(raw.reasons)
      ? raw.reasons
      : Array.isArray(record.reasons)
      ? record.reasons
      : Array.isArray(record.riskReasons)
      ? record.riskReasons
      : [];

    var sessionTime =
      toNumber(signals.session_time || raw.session_time || record.sessionTime, 0);

    var clicks =
      toNumber(signals.clicks || raw.clicks || record.clicks, 0);

    var mouse =
      signals.mouse_movement === true ||
      raw.mouse_movement === true ||
      record.mouse === true;

    var scroll =
      signals.scroll_activity === true ||
      raw.scroll_activity === true ||
      record.scroll === true;

    var keys =
      signals.keypress_activity === true ||
      raw.keypress_activity === true ||
      record.keys === true;

    var scenario =
      signals.scenario ||
      raw.scenario ||
      record.scenario ||
      inferScenarioFromReasons(reasons, riskLevel);

    var botType =
      reputation.bot_type ||
      raw.bot_type ||
      record.botType ||
      inferBotType(scenario, reasons, riskLevel);

    var interaction =
      raw.interaction ||
      record.interaction ||
      inferInteraction(scenario, riskLevel);

    var action = getAction(riskLevel, decision);

    var repeatAttempts =
      toNumber(
        reputation.seen_count ||
        record.seenCount ||
        record.repeatAttempts,
        1
      );

    var result = {
      id: String(
        raw.event_id ||
        record.event_id ||
        record.id ||
        'bot-event-' + (record.timestamp || Date.now())
      ),
      event_id:
        raw.event_id ||
        record.event_id ||
        record.id,
      timestamp:
        raw.timestamp ||
        record.timestamp ||
        nowIso(),
      sessionTime:
        sessionTime,
      scenario:
        scenario,
      botType:
        botType,
      interaction:
        interaction,
      mouse:
        mouse,
      scroll:
        scroll,
      keys:
        keys,
      clicks:
        clicks,
      score:
        score,
      riskLevel:
        riskLevel,
      decision:
        decision,
      confidence:
        confidence,
      action:
        action.action,
      actionSource:
        action.source,
      repeatAttempts:
        repeatAttempts,
      trustLevel:
        reputation.trust_level ||
        (
          riskLevel === 'High Risk'
            ? 'Untrusted Bot Session'
            : riskLevel === 'Medium Risk'
            ? 'Suspicious Session'
            : 'Trusted Human Session'
        ),
      botReputation:
        reputation.reputation ||
        (
          riskLevel === 'High Risk'
            ? 'Blocked'
            : riskLevel === 'Medium Risk'
            ? 'Risky'
            : 'Neutral'
        ),
      seenCount:
        repeatAttempts,
      highRiskCount:
        toNumber(reputation.high_risk_count, riskLevel === 'High Risk' ? 1 : 0),
      rules:
        buildBackendRules(reasons, riskLevel, score, decision),
      signals:
        buildBackendSignals(
          signals,
          reasons,
          riskLevel,
          score,
          decision,
          confidence,
          {
            sessionTime: sessionTime,
            clicks: clicks,
            mouse: mouse,
            scroll: scroll,
            keys: keys,
            scenario: scenario,
            botType: botType,
            interaction: interaction
          }
        ),
      riskReasons:
        reasons,
      backendModule:
        'Bot Detection Intelligence',
      backendSynced:
        true
    };

    return result;
  }

  function inferScenarioFromReasons(reasons, riskLevel) {
    var text = Array.isArray(reasons)
      ? reasons.join(' ').toLowerCase()
      : '';

    if (text.includes('credential')) {
      return 'credential-stuffing';
    }

    if (text.includes('scraper') || text.includes('crawler')) {
      return 'scraper';
    }

    if (text.includes('ai agent') || text.includes('ai-driven')) {
      return 'ai-agent';
    }

    if (text.includes('automation') || text.includes('bot')) {
      return 'scripted-signup';
    }

    if (riskLevel === 'Low Risk') {
      return 'human';
    }

    return 'backend-bot-event';
  }

  function inferBotType(scenario, reasons, riskLevel) {
    var scenarioText = String(scenario || '').toLowerCase();
    var reasonText = Array.isArray(reasons)
      ? reasons.join(' ').toLowerCase()
      : '';

    if (scenarioText.includes('credential') || reasonText.includes('credential')) {
      return 'Credential Stuffing Bot';
    }

    if (scenarioText.includes('scraper') || reasonText.includes('scraper')) {
      return 'Scraper Bot';
    }

    if (scenarioText.includes('ai') || reasonText.includes('ai agent')) {
      return 'AI Agent Bot';
    }

    if (scenarioText.includes('fast')) {
      return 'Fast Click Bot';
    }

    if (riskLevel === 'Low Risk') {
      return 'Human Session';
    }

    return 'Automated Bot Session';
  }

  function inferInteraction(scenario, riskLevel) {
    var text = String(scenario || '').toLowerCase();

    if (text.includes('credential')) {
      return 'Repeated Login';
    }

    if (text.includes('scraper')) {
      return 'Crawler-like';
    }

    if (text.includes('ai')) {
      return 'AI Automation';
    }

    if (text.includes('human') || riskLevel === 'Low Risk') {
      return 'Natural';
    }

    return 'Automated';
  }

  function buildBackendRules(reasons, riskLevel, score, decision) {
    var severity =
      riskLevel === 'High Risk'
        ? 'High'
        : riskLevel === 'Medium Risk'
        ? 'Medium'
        : 'Low';

    var rules = [];

    if (Array.isArray(reasons) && reasons.length) {
      reasons.forEach(function (reason, index) {
        rules.push({
          rule: reason,
          group:
            String(reason).toLowerCase().includes('session') ||
            String(reason).toLowerCase().includes('time')
              ? 'Timing Signals'
              : String(reason).toLowerCase().includes('mouse') ||
                String(reason).toLowerCase().includes('click') ||
                String(reason).toLowerCase().includes('scroll') ||
                String(reason).toLowerCase().includes('keypress')
              ? 'Behavior Signals'
              : String(reason).toLowerCase().includes('bot') ||
                String(reason).toLowerCase().includes('automation') ||
                String(reason).toLowerCase().includes('ai') ||
                String(reason).toLowerCase().includes('scraper')
              ? 'Threat Signals'
              : 'Risk Engine',
          severity: severity,
          impact:
            index === 0
              ? score
              : 0,
          reason: reason
        });
      });
    }

    rules.push({
      rule: 'Backend risk score',
      group: 'Risk Engine',
      severity: severity,
      impact: score,
      reason: 'Backend returned final bot risk score.'
    });

    rules.push({
      rule: 'Backend decision',
      group: 'Risk Engine',
      severity:
        decision === 'Block'
          ? 'High'
          : decision === 'Monitor' || decision === 'Challenge'
          ? 'Medium'
          : 'Low',
      impact: 0,
      reason: 'Backend returned final decision: ' + decision + '.'
    });

    return rules;
  }

  function buildBackendSignals(
    signals,
    reasons,
    riskLevel,
    score,
    decision,
    confidence,
    session
  ) {
    var severity =
      riskLevel === 'High Risk'
        ? 'High'
        : riskLevel === 'Medium Risk'
        ? 'Medium'
        : 'Low';

    var behavior = [
      'Session Time: ' + session.sessionTime + 's',
      'Clicks: ' + session.clicks,
      'Mouse Activity: ' + (session.mouse ? 'Detected' : 'Missing'),
      'Scroll Activity: ' + (session.scroll ? 'Detected' : 'Missing'),
      'Keypress Activity: ' + (session.keys ? 'Detected' : 'Missing')
    ];

    var automation = [
      'Scenario: ' + session.scenario,
      'Bot Type: ' + session.botType,
      'Interaction: ' + session.interaction,
      'Decision: ' + decision,
      'Confidence: ' + confidence + '%'
    ];

    var reasonItems = Array.isArray(reasons) && reasons.length
      ? reasons
      : ['Backend bot analysis completed.'];

    return {
      behavior: behavior,
      automation: automation,
      reasons: reasonItems,
      riskEngine: [
        'Backend Risk Level: ' + riskLevel,
        'Backend Score: ' + score + '/100',
        'Backend Decision: ' + decision,
        'Backend Confidence: ' + confidence + '%'
      ],
      raw: signals || {}
    };
  }

  function getBackendBotActivity() {
    state.backendActivity = getBackendBotEvents();

    return state.backendActivity;
  }

  async function analyzeBotRisk() {
    try {
      var scenario = getScenario();

      localStorage.setItem(SCENARIO_KEY, scenario);

      var session = getScenarioPreset(scenario);

      var backendResult = await aiTrustApiPost('/analyze/bot', {
        session_time: session.sessionTime,
        clicks: session.clicks,
        mouse_movement: session.mouse,
        scroll_activity: session.scroll,
        keypress_activity: session.keys,
        scenario: session.scenario
      });

      var mapped = mapBackendBotEvent({
        moduleName: 'Bot Detection Intelligence',
        module: 'Bot Detection Intelligence',
        timestamp: backendResult.timestamp || nowIso(),
        raw_event: backendResult,
        risk_level: backendResult.risk_level,
        score: backendResult.score,
        decision: backendResult.decision,
        confidence: backendResult.confidence,
        reasons: backendResult.reasons,
        signals: backendResult.signals,
        bot_reputation: backendResult.bot_reputation
      });

      if (mapped) {
        mapped.sessionTime = session.sessionTime;
        mapped.scenario = session.scenario;
        mapped.botType = session.botType;
        mapped.interaction = session.interaction;
        mapped.mouse = session.mouse;
        mapped.scroll = session.scroll;
        mapped.keys = session.keys;
        mapped.clicks = session.clicks;
        mapped.signals = buildBackendSignals(
          backendResult.signals || {},
          backendResult.reasons || [],
          mapped.riskLevel,
          mapped.score,
          mapped.decision,
          mapped.confidence,
          session
        );

        state.currentResult = mapped;
      }

      renderAll();

      window.dispatchEvent(
        new CustomEvent('aiTrustOsActivityUpdated', {
          detail: {
            module: 'Bot Detection',
            storageKey: null,
            backendSynced: true,
            riskLabel: backendResult.risk_level,
            score: backendResult.score,
            decision: backendResult.decision,
            action: mapped ? mapped.action : backendResult.decision,
            actionSource: mapped ? mapped.actionSource : 'Backend',
            timestamp: backendResult.timestamp || nowIso(),
            riskReasons: backendResult.reasons || []
          }
        })
      );

      window.dispatchEvent(
        new CustomEvent('sherguardBotRiskAnalyzed', {
          detail: {
            result: mapped,
            backendResult: backendResult
          }
        })
      );

    } catch (error) {
      console.error('Bot Detection analysis failed:', error);
      alert(
        error && error.message
          ? error.message
          : 'Bot Detection analysis failed.'
      );
    }
  }

  function renderAll() {
    var activity = getBackendBotActivity();
    var result = activity.length ? activity[0] : state.currentResult;

    state.currentResult = result || null;

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
      setText('botReputationText', result.botReputation || 'Unknown');
      setText('botRepeatAttempts', String(result.seenCount || result.repeatAttempts || 1));
      setText('botAiEnforcementText', result.action || result.decision || 'Unknown');
      setText('botMouseActivity', result.mouse ? 'Yes' : 'No');
      setText('botClickCount', result.clicks);
      setText('botScrollActivity', result.scroll ? 'Yes' : 'No');
      setText('botKeypressActivity', result.keys ? 'Yes' : 'No');

      var ring = byId('botScoreRing');

      if (ring) {
        ring.style.setProperty('--bot-score', result.score);

        ring.classList.remove(
          'bot-risk-ring-low',
          'bot-risk-ring-medium',
          'bot-risk-ring-high'
        );

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

    } else {
      resetSession(false);
    }

    renderInsights(activity);
    renderActivity(activity);
    renderTimeline(activity);
  }

  function renderSignals(result) {
    if (!result) {
      setHtml('botSignalsPanel', '');
      return;
    }

    var behavior = result.signals && Array.isArray(result.signals.behavior)
      ? result.signals.behavior
      : [];

    var automation = result.signals && Array.isArray(result.signals.automation)
      ? result.signals.automation
      : [];

    var reasons = result.signals && Array.isArray(result.signals.reasons)
      ? result.signals.reasons
      : [];

    var riskEngine = result.signals && Array.isArray(result.signals.riskEngine)
      ? result.signals.riskEngine
      : [];

    var html =
      '<div class="bot-risk-signal-group"><h4>Behavior Signals</h4><ul>' +
      behavior.map(function (item) {
        return '<li>' + item + '</li>';
      }).join('') +
      '</ul></div>' +

      '<div class="bot-risk-signal-group"><h4>Automation Signals</h4><ul>' +
      automation.map(function (item) {
        return '<li>' + item + '</li>';
      }).join('') +
      '</ul></div>' +

      '<div class="bot-risk-signal-group"><h4>Risk Reasons</h4><ul>' +
      reasons.map(function (item) {
        return '<li>' + item + '</li>';
      }).join('') +
      '</ul></div>' +

      '<div class="bot-risk-signal-group"><h4>Risk Engine Signals</h4><ul>' +
      riskEngine.map(function (item) {
        return '<li>' + item + '</li>';
      }).join('') +
      '</ul></div>';

    setHtml('botSignalsPanel', html);
  }

  function renderBreakdown(rules) {
    if (!rules || !rules.length) {
      setHtml(
        'botBreakdownBody',
        '<tr><td colspan="5">No backend risk rules triggered.</td></tr>'
      );
      return;
    }

    setHtml(
      'botBreakdownBody',
      rules.map(function (rule) {
        return (
          '<tr>' +
            '<td>' + safeText(rule.rule, 'Backend rule') + '</td>' +
            '<td>' + safeText(rule.group, 'Risk Engine') + '</td>' +
            '<td>' + safeText(rule.severity, 'Low') + '</td>' +
            '<td>' + (toNumber(rule.impact, 0) > 0 ? '+' : '') + safeText(rule.impact, '0') + '</td>' +
            '<td>' + safeText(rule.reason, 'Backend bot event.') + '</td>' +
          '</tr>'
        );
      }).join('')
    );
  }

  function renderActivity(activity) {
    if (!activity.length) {
      setHtml(
        'botActivityBody',
        '<tr><td colspan="10">No backend bot risk activity yet.</td></tr>'
      );
      return;
    }

    setHtml(
      'botActivityBody',
      activity.map(function (item) {
        return (
          '<tr>' +
            '<td>' + formatDate(item.timestamp) + '</td>' +
            '<td>' + item.sessionTime + 's</td>' +
            '<td>' + safeText(item.scenario, 'Backend') + '</td>' +
            '<td>' + safeText(item.botType, 'Unknown') + '</td>' +
            '<td>' + safeText(item.interaction, 'Unknown') + '</td>' +
            '<td>' + safeText(item.riskLevel, 'Unknown') + '</td>' +
            '<td>' + safeText(item.score, 0) + '</td>' +
            '<td>' + safeText(item.decision, 'Unknown') + '</td>' +
            '<td>' + safeText(item.action, 'Backend') + '</td>' +
            '<td>' + safeText(item.actionSource, 'Backend') + '</td>' +
          '</tr>'
        );
      }).join('')
    );
  }

  function renderTimeline(activity) {
    if (!activity.length) {
      setHtml(
        'botThreatTimelineList',
        '<div class="bot-risk-empty">No backend bot threat timeline events yet.</div>'
      );
      return;
    }

    setHtml(
      'botThreatTimelineList',
      activity.slice(0, 8).map(function (item) {
        return (
          '<div class="bot-risk-timeline-item">' +
            '<strong>' + safeText(item.botType, 'Bot Session') + ' · ' + safeText(item.riskLevel, 'Unknown') + '</strong>' +
            '<p>' + safeText(item.decision, 'Unknown') + ' · ' + safeText(item.action, 'Backend') + '</p>' +
            '<small>' + formatDate(item.timestamp) + '</small>' +
          '</div>'
        );
      }).join('')
    );
  }

  function renderInsights(activity) {
    var total = activity.length;
    var bots = activity.filter(function (item) {
      return item.riskLevel !== 'Low Risk';
    }).length;

    var humans = total - bots;

    var avg = total
      ? Math.round(
          activity.reduce(function (sum, item) {
            return sum + toNumber(item.sessionTime, 0);
          }, 0) / total
        )
      : 0;

    setText('botAvgSessionTime', avg + 's');

    setText(
      'botDetectionPercent',
      total
        ? Math.round((bots / total) * 100) + '%'
        : '0%'
    );

    setText(
      'botHumanVsBotPercent',
      total
        ? Math.round((humans / total) * 100) + '% / ' + Math.round((bots / total) * 100) + '%'
        : '0% / 0%'
    );

    setText(
      'botCommonPattern',
      activity[0]
        ? activity[0].botType
        : 'None'
    );

    setText(
      'botLastSessionResult',
      activity[0]
        ? activity[0].riskLevel + ' · ' + activity[0].decision
        : 'No backend sessions yet'
    );
  }

  function resetSession(renderEverything) {
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
    setText('botMouseActivity', 'No');
    setText('botClickCount', '0');
    setText('botScrollActivity', 'No');
    setText('botKeypressActivity', 'No');

    setHtml('botSignalsPanel', '');
    setHtml(
      'botBreakdownBody',
      '<tr><td colspan="5">No backend analysis yet. Click “Analyze Bot Risk”.</td></tr>'
    );

    if (renderEverything !== false) {
      renderInsights([]);
      renderActivity([]);
      renderTimeline([]);
    }
  }

  async function clearLog() {
    if (!window.confirm('Clear backend dashboard activity? This clears organization security events, not only Bot Detection.')) {
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
      state.currentResult = null;
      window.latestDashboardRecords = [];

      resetSession();
      renderAll();

      window.dispatchEvent(
        new CustomEvent('aiTrustOsActivityUpdated', {
          detail: {
            module: 'Bot Detection',
            cleared: true,
            backendSynced: true,
            timestamp: nowIso()
          }
        })
      );

    } catch (error) {
      console.error('Bot Detection backend clear failed:', error);
      alert('Backend clear failed. Use main dashboard Clear Activity if needed.');
    }
  }

  function copyResult() {
    var item = state.currentResult || getBackendBotActivity()[0];

    if (!item) {
      return;
    }

    var text =
      'SherGuard — Bot Detection Report\n' +
      'Risk Level: ' + item.riskLevel + '\n' +
      'Score: ' + item.score + '\n' +
      'Decision: ' + item.decision + '\n' +
      'Bot Type: ' + item.botType + '\n' +
      'Interaction: ' + item.interaction + '\n' +
      'Action: ' + item.action + '\n' +
      'Action Source: ' + item.actionSource + '\n' +
      'Reasons:\n' +
      (
        Array.isArray(item.riskReasons) && item.riskReasons.length
          ? item.riskReasons.map(function (reason) {
              return '- ' + reason;
            }).join('\n')
          : '- No backend reasons recorded.'
      );

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
  }

  function exportCsv() {
    var activity = getBackendBotActivity();

    if (!activity.length && state.currentResult) {
      activity = [state.currentResult];
    }

    if (!activity.length) {
      return;
    }

    var rows = [
      'Timestamp,Session Time,Scenario,Bot Type,Interaction,Risk Level,Score,Decision,Action,Action Source'
    ];

    activity.forEach(function (item) {
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
      ].map(function (value) {
        return '"' + String(value).replace(/"/g, '""') + '"';
      }).join(','));
    });

    var blob = new Blob([rows.join('\n')], {
      type: 'text/csv;charset=utf-8'
    });

    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');

    link.href = url;
    link.download = 'bot-risk-backend-activity.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    if (byId('botAnalyzeBtn')) {
      byId('botAnalyzeBtn').addEventListener('click', analyzeBotRisk);
    }

    if (byId('botResetSessionBtn')) {
      byId('botResetSessionBtn').addEventListener('click', function () {
        resetSession();
      });
    }

    if (byId('botClearLogBtn')) {
      byId('botClearLogBtn').addEventListener('click', clearLog);
    }

    if (byId('botClearHistoryTopBtn')) {
      byId('botClearHistoryTopBtn').addEventListener('click', clearLog);
    }

    if (byId('botCopyResultBtn')) {
      byId('botCopyResultBtn').addEventListener('click', copyResult);
    }

    if (byId('botExportCsvBtn')) {
      byId('botExportCsvBtn').addEventListener('click', exportCsv);
    }

    if (byId('botAutoActionToggle')) {
      byId('botAutoActionToggle').addEventListener('change', function (event) {
        localStorage.setItem(AUTO_KEY, event.target.checked ? 'true' : 'false');
        renderAll();
      });
    }

    if (byId('botRiskScenarioSelect')) {
      byId('botRiskScenarioSelect').addEventListener('change', function (event) {
        localStorage.setItem(SCENARIO_KEY, event.target.value);
      });
    }

    window.addEventListener('sherguardDashboardEventsSynced', function () {
      renderAll();
    });

    window.addEventListener('aiTrustOsActivityUpdated', function () {
      setTimeout(function () {
        renderAll();
      }, 500);
    });
  }

  function loadPreferences() {
    var savedScenario = localStorage.getItem(SCENARIO_KEY);

    if (savedScenario && byId('botRiskScenarioSelect')) {
      byId('botRiskScenarioSelect').value = savedScenario;
    }

    if (byId('botAutoActionToggle')) {
      byId('botAutoActionToggle').checked =
        localStorage.getItem(AUTO_KEY) === 'true';
    }
  }

  function init() {
    if (!byId('botRiskModule')) {
      return;
    }

    loadPreferences();
    bindEvents();
    renderAll();
  }

  window.SherGuardBotRisk = {
    analyze: analyzeBotRisk,
    getBackendBotEvents: getBackendBotEvents,
    renderAll: renderAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();