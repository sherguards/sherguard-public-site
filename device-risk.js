(function () {
  'use strict';

  /*
    SherGuard Device Risk Intelligence
    Backend-first module.

    Important:
    - Risk events, history, activity, timeline, insights, profile, signals,
      and breakdown are now read from backend dashboard events.
    - LocalStorage is used only for safe UI preferences:
      auto action toggle and selected simulation scenario.
    - Manual dashboard checks still call the backend source of truth:
      POST /analyze/device
    - Customer API events from /v1/device-risk and SherGuard self-protection
      events appear in this module through /events -> dashboard.js ->
      window.latestDashboardRecords.
  */

  var AUTO_ACTION_KEY = aiTrustScopedKey('aiTrustOsDeviceRiskAutoAction');
  var SCENARIO_KEY = aiTrustScopedKey('aiTrustOsDeviceRiskScenario');

  var state = {
    autoActionEnabled: false,
    currentResult: null,
    backendActivity: []
  };

  var els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function toNum(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeText(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback || 'Unknown';
    }

    return String(value);
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function createNode(tag, className, text) {
    var element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = text;
    }

    return element;
  }

  function fmtDate(timestamp) {
    if (!timestamp) {
      return '—';
    }

    var date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  function fmtPct(value) {
    return toNum(value, 0).toFixed(0) + '%';
  }

  function csvEscape(value) {
    var text = safeText(value, '');

    if (/[",\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }

    return text;
  }

  function downloadFile(name, text, type) {
    var blob = new Blob([text], {
      type: type || 'text/csv;charset=utf-8'
    });

    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');

    link.href = url;
    link.download = name;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');

      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);
      textarea.select();

      try {
        var success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (success) {
          resolve();
        } else {
          reject(new Error('Copy rejected'));
        }
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  function getRiskTone(label) {
    if (label === 'High Risk') {
      return 'high';
    }

    if (label === 'Medium Risk') {
      return 'medium';
    }

    return 'low';
  }

  function getDecisionTone(label) {
    if (label === 'Blocked' || label === 'Block') {
      return 'high';
    }

    if (
      label === 'Challenge' ||
      label === 'Monitor' ||
      label === 'Monitored'
    ) {
      return 'medium';
    }

    if (label === 'Allowed' || label === 'Allow') {
      return 'positive';
    }

    return 'neutral';
  }

  function getSeverityTone(severity) {
    if (severity === 'High') {
      return 'high';
    }

    if (severity === 'Medium') {
      return 'medium';
    }

    if (severity === 'Low') {
      return 'low';
    }

    if (severity === 'Positive') {
      return 'positive';
    }

    return 'neutral';
  }

  function setBadge(element, label, tone) {
    if (!element) {
      return;
    }

    element.className = 'device-risk-badge' + (tone ? ' ' + tone : '');
    element.textContent = label;
  }

  function getOffsetLabel() {
    var minutes = new Date().getTimezoneOffset() * -1;
    var sign = minutes >= 0 ? '+' : '-';
    var absolute = Math.abs(minutes);
    var hours = String(Math.floor(absolute / 60)).padStart(2, '0');
    var mins = String(absolute % 60).padStart(2, '0');

    return 'UTC ' + sign + hours + ':' + mins;
  }

  function parseBrowser(userAgent) {
    var ua = String(userAgent || '').toLowerCase();

    if (/edg\//.test(ua)) {
      return 'Edge';
    }

    if (/firefox\//.test(ua)) {
      return 'Firefox';
    }

    if (
      (/chrome\//.test(ua) || /crios\//.test(ua)) &&
      !/edg\//.test(ua) &&
      !/opr\//.test(ua)
    ) {
      return 'Chrome';
    }

    if (
      /safari\//.test(ua) &&
      !/chrome\//.test(ua) &&
      !/crios\//.test(ua) &&
      !/android/.test(ua)
    ) {
      return 'Safari';
    }

    return 'Unknown';
  }

  function parseOS(userAgent, platform) {
    var ua = String(userAgent || '').toLowerCase();
    var pf = String(platform || '').toLowerCase();

    if (/windows nt/.test(ua) || /^win/.test(pf)) {
      return 'Windows';
    }

    if (/iphone|ipad|ipod/.test(ua)) {
      return 'iOS';
    }

    if (/android/.test(ua)) {
      return 'Android';
    }

    if (/mac os x/.test(ua) || /^mac/.test(pf)) {
      return 'Mac';
    }

    if (/linux/.test(ua) || /x11/.test(ua) || /linux/.test(pf)) {
      return 'Linux';
    }

    return 'Unknown';
  }

  function parseDeviceType(userAgent, maxTouchPoints, width, height) {
    var ua = String(userAgent || '').toLowerCase();
    var touch = toNum(maxTouchPoints, 0);
    var maxDim = Math.max(toNum(width, 0), toNum(height, 0));
    var minDim = Math.min(toNum(width, 0), toNum(height, 0));

    var tablet =
      /ipad|tablet|silk/.test(ua) ||
      (/android/.test(ua) && !/mobile/.test(ua));

    var mobile =
      /mobi|iphone|ipod|android.*mobile|windows phone/.test(ua);

    if (tablet || (touch > 1 && minDim >= 600 && maxDim <= 1600)) {
      return 'Tablet';
    }

    if (mobile || (touch > 0 && maxDim <= 932 && minDim <= 480)) {
      return 'Mobile';
    }

    return 'Desktop';
  }

  function getScreenInfo() {
    var screenObject = window.screen || {};
    var width = toNum(screenObject.width, 0);
    var height = toNum(screenObject.height, 0);

    return {
      width: width,
      height: height,
      pixelRatio: toNum(window.devicePixelRatio, 1),
      label: width && height
        ? width + ' × ' + height + ' @' + window.devicePixelRatio + '×'
        : 'Unknown'
    };
  }

  function getTimezoneInfo() {
    var zone = 'Unknown';

    try {
      var options = new Intl.DateTimeFormat().resolvedOptions();

      if (options && options.timeZone) {
        zone = options.timeZone;
      }
    } catch (error) {}

    return {
      timeZone: zone,
      offsetLabel: getOffsetLabel(),
      display: zone === 'Unknown'
        ? getOffsetLabel()
        : zone + ' (' + getOffsetLabel() + ')'
    };
  }

  function buildFingerprint(userAgent, screenSize, timezone) {
    var seed = [
      userAgent || 'Unknown',
      screenSize || 'Unknown',
      timezone || 'Unknown'
    ].join('|');

    try {
      return 'dev_' + btoa(seed)
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 16);
    } catch (error) {
      return 'dev_' + String(seed)
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 16);
    }
  }

  async function collectCurrentDeviceProfile() {
    var navigatorObject = window.navigator || {};
    var userAgent = safeText(navigatorObject.userAgent, 'Unknown');
    var platform = safeText(navigatorObject.platform, 'Unknown');
    var screenInfo = getScreenInfo();
    var timezoneInfo = getTimezoneInfo();
    var browser = parseBrowser(userAgent);
    var os = parseOS(userAgent, platform);
    var deviceType = parseDeviceType(
      userAgent,
      navigatorObject.maxTouchPoints,
      screenInfo.width,
      screenInfo.height
    );

    var scenario = els.scenarioSelect
      ? els.scenarioSelect.value
      : 'normal';

    var payload = {
      user_agent: userAgent,
      screen_size: screenInfo.label,
      timezone: timezoneInfo.display,
      language: safeText(navigatorObject.language, 'unknown')
    };

    if (scenario === 'automated') {
      payload.user_agent = 'HeadlessChrome Selenium WebDriver Bot Browser';
      payload.screen_size = '800x600';
      payload.timezone = 'Unknown';
      payload.language = 'unknown';

      browser = 'Headless Chrome';
      os = 'Automation Runtime';
      deviceType = 'Desktop';
    }

    if (scenario === 'vm') {
      payload.user_agent = 'HeadlessChrome Virtual Machine Emulator Browser';
      payload.screen_size = '1024x768';
      payload.timezone = 'UTC';
      payload.language = 'unknown';

      browser = 'Headless Chrome';
      os = 'Virtual Machine';
      deviceType = 'Desktop';
    }

    if (scenario === 'proxy') {
      payload.user_agent = 'python-requests/2.31 Proxy Datacenter Browser';
      payload.screen_size = '1366x768';
      payload.timezone = 'UTC';
      payload.language = 'unknown';

      browser = 'Scripted Client';
      os = 'Datacenter Environment';
      deviceType = 'Desktop';
    }

    if (scenario === 'suspicious') {
      payload.user_agent = 'Unknown Browser';
      payload.screen_size = '800x600';
      payload.timezone = 'Unknown';
      payload.language = 'unknown';

      browser = 'Unknown Browser';
      os = 'Unknown OS';
      deviceType = 'Desktop';
    }

    return {
      scenario: scenario,
      payload: payload,
      profile: {
        deviceType: deviceType,
        os: os,
        browser: browser,
        fingerprintId: buildFingerprint(
          payload.user_agent,
          payload.screen_size,
          payload.timezone
        ),
        simulationScenario: scenario,
        userAgent: payload.user_agent,
        screenSize: payload.screen_size,
        timezone: payload.timezone,
        language: payload.language,
        platform: platform,
        maxTouchPoints: toNum(navigatorObject.maxTouchPoints, 0)
      }
    };
  }

  function getBackendDeviceEvents() {
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

        return moduleName.includes('device');
      })
      .map(mapBackendDeviceEvent)
      .filter(Boolean)
      .sort(function (a, b) {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
  }

  function mapBackendDeviceEvent(record) {
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
      raw.device_reputation ||
      record.device_reputation ||
      {};

    var userAgent =
      signals.user_agent ||
      raw.user_agent ||
      record.user_agent ||
      'Unknown Device';

    var screenSize =
      signals.screen_size ||
      raw.screen_size ||
      record.screen_size ||
      'Unknown';

    var timezone =
      signals.timezone ||
      raw.timezone ||
      record.timezone ||
      'Unknown';

    var language =
      signals.language ||
      raw.language ||
      record.language ||
      'unknown';

    var riskLabel =
      raw.risk_level ||
      record.risk_level ||
      record.riskLabel ||
      record.riskLevel ||
      'Low Risk';

    var score = toNum(
      raw.score ||
      record.score ||
      record.riskScore,
      0
    );

    var decision =
      raw.decision ||
      record.decision ||
      defaultDecisionFromRisk(riskLabel);

    var confidence =
      raw.confidence === 'High' ||
      record.confidence === 'High'
        ? 95
        : raw.confidence === 'Medium' ||
          record.confidence === 'Medium'
        ? 75
        : toNum(raw.confidence || record.confidence, 70);

    var profile = {
      deviceType:
        reputation.device_type ||
        raw.device_type ||
        record.deviceType ||
        'Desktop',
      os:
        reputation.os ||
        parseOS(userAgent, ''),
      browser:
        reputation.browser ||
        parseBrowser(userAgent),
      fingerprintId:
        reputation.fingerprint_id ||
        raw.fingerprint_id ||
        buildFingerprint(userAgent, screenSize, timezone),
      simulationScenario:
        raw.scenario ||
        record.scenario ||
        'Backend Event',
      userAgent: userAgent,
      screenSize: screenSize,
      timezone: timezone,
      language: language,
      platform: 'Backend',
      maxTouchPoints: 0
    };

    var deviceReputation =
      reputation.reputation ||
      (
        riskLabel === 'High Risk'
          ? 'Blocked'
          : riskLabel === 'Medium Risk'
          ? 'Risky'
          : 'Neutral'
      );

    var trustLevel =
      reputation.trust_level ||
      (
        riskLabel === 'High Risk'
          ? 'Critical Device'
          : riskLabel === 'Medium Risk'
          ? 'Suspicious Device'
          : 'Known Device'
      );

    var repeatDeviceCount =
      toNum(reputation.seen_count || record.seenCount, 1);

    var reputationScore =
      toNum(
        reputation.reputation_score ||
        (
          deviceReputation === 'Blocked'
            ? 15
            : deviceReputation === 'Risky'
            ? 45
            : deviceReputation === 'Trusted'
            ? 90
            : 65
        ),
        65
      );

    var automationDetected =
      String(signals.automation || '').toLowerCase().includes('detected') ||
      String(userAgent || '').toLowerCase().indexOf('headless') !== -1 ||
      String(userAgent || '').toLowerCase().indexOf('selenium') !== -1 ||
      String(userAgent || '').toLowerCase().indexOf('webdriver') !== -1 ||
      String(userAgent || '').toLowerCase().indexOf('python-requests') !== -1 ||
      riskLabel === 'High Risk';

    var threatSeverity = buildThreatSeverityFromBackend({
      riskLabel: riskLabel,
      score: score,
      automationDetected: automationDetected,
      deviceReputation: deviceReputation,
      repeatDeviceCount: repeatDeviceCount
    });

    var reasons = Array.isArray(raw.reasons)
      ? raw.reasons
      : Array.isArray(record.reasons)
      ? record.reasons
      : Array.isArray(record.riskReasons)
      ? record.riskReasons
      : [];

    var breakdown = buildBackendBreakdown(
      reasons,
      riskLabel,
      score,
      decision
    );

    return {
      id: String(
        raw.event_id ||
        record.event_id ||
        record.id ||
        profile.fingerprintId + '-' + (record.timestamp || Date.now())
      ),
      event_id:
        raw.event_id ||
        record.event_id ||
        record.id,
      timestamp:
        raw.timestamp ||
        record.timestamp ||
        new Date().toISOString(),
      scenario:
        profile.simulationScenario,
      deviceType:
        profile.deviceType,
      os:
        profile.os,
      browser:
        profile.browser,
      userAgent:
        profile.userAgent,
      screenSize:
        profile.screenSize,
      timezone:
        profile.timezone,
      riskLabel:
        riskLabel,
      score:
        score,
      decision:
        decision,
      confidence:
        confidence,
      trustLevel:
        trustLevel,
      deviceReputation:
        deviceReputation,
      reputationScore:
        reputationScore,
      action:
        state.autoActionEnabled
          ? actionFromRisk(riskLabel)
          : decision,
      actionSource:
        'Backend',
      automationDetected:
        automationDetected,
      repeatDeviceCount:
        repeatDeviceCount,
      profile:
        profile,
      environment:
        {
          automation: signals.automation || 'Unknown',
          reputation: signals.reputation || 'Unknown',
          correlationRisk: signals.correlation_risk || 'Stable'
        },
      flags:
        {
          automationDetected: automationDetected,
          backendSynced: true
        },
      signals:
        buildBackendSignals(
          signals,
          reasons,
          riskLabel,
          score,
          decision,
          confidence
        ),
      breakdown:
        breakdown,
      riskReasons:
        reasons,
      threatSeverity:
        threatSeverity.severityLabel,
      threatSeverityScore:
        threatSeverity.severityScore,
      threatSeverityReasons:
        threatSeverity.reasons,
      backendSynced:
        true,
      backendModule:
        'Device Risk Intelligence'
    };
  }

  function buildBackendBreakdown(reasons, riskLabel, score, decision) {
    var severity =
      riskLabel === 'High Risk'
        ? 'High'
        : riskLabel === 'Medium Risk'
        ? 'Medium'
        : 'Low';

    var items = [];

    if (Array.isArray(reasons) && reasons.length) {
      reasons.forEach(function (reason, index) {
        items.push({
          rule: reason,
          key: 'backend-device-reason-' + index,
          title: reason,
          group:
            String(reason).toLowerCase().includes('automation') ||
            String(reason).toLowerCase().includes('headless') ||
            String(reason).toLowerCase().includes('bot')
              ? 'environment'
              : String(reason).toLowerCase().includes('correlation')
              ? 'riskEngine'
              : 'pattern',
          severity: severity,
          impact: index === 0
            ? 'Score ' + score + '/100'
            : '0',
          impactValue: index === 0 ? score : 0,
          displayImpact: index === 0
            ? 'Score ' + score + '/100'
            : '0',
          reason: reason
        });
      });
    }

    items.push({
      rule: 'Backend risk score',
      key: 'backend-risk-score',
      title: 'Backend risk score',
      group: 'riskEngine',
      severity: severity,
      impact: 'Score ' + score + '/100',
      impactValue: score,
      displayImpact: 'Score ' + score + '/100',
      reason: 'Backend returned final score and risk level.'
    });

    items.push({
      rule: 'Backend decision',
      key: 'backend-decision',
      title: 'Backend decision',
      group: 'riskEngine',
      severity:
        decision === 'Block'
          ? 'High'
          : decision === 'Monitor' || decision === 'Challenge'
          ? 'Medium'
          : 'Low',
      impact: decision,
      impactValue: 0,
      displayImpact: decision,
      reason: 'Backend returned final decision.'
    });

    return items;
  }

  function buildBackendSignals(
    signals,
    reasons,
    riskLabel,
    score,
    decision,
    confidence
  ) {
    var severity =
      riskLabel === 'High Risk'
        ? 'High'
        : riskLabel === 'Medium Risk'
        ? 'Medium'
        : 'Low';

    var result = {
      identity: [],
      environment: [],
      pattern: [],
      riskEngine: []
    };

    result.identity.push({
      key: 'backendUserAgent',
      title: 'User agent received',
      group: 'identity',
      status: 'OK',
      impact: 0,
      displayImpact: '0',
      severity: 'Info',
      reason: safeText(signals.user_agent, 'Device user-agent was received by backend.'),
      triggered: false
    });

    result.identity.push({
      key: 'backendScreen',
      title: 'Screen profile received',
      group: 'identity',
      status: 'OK',
      impact: 0,
      displayImpact: '0',
      severity: 'Info',
      reason: 'Screen size: ' + safeText(signals.screen_size, 'Unknown'),
      triggered: false
    });

    result.identity.push({
      key: 'backendTimezone',
      title: 'Timezone received',
      group: 'identity',
      status: 'OK',
      impact: 0,
      displayImpact: '0',
      severity: 'Info',
      reason: 'Timezone: ' + safeText(signals.timezone, 'Unknown'),
      triggered: false
    });

    result.environment.push({
      key: 'backendAutomation',
      title: 'Automation signal',
      group: 'environment',
      status:
        String(signals.automation || '').toLowerCase().includes('detected')
          ? 'Triggered'
          : 'OK',
      impact:
        String(signals.automation || '').toLowerCase().includes('detected')
          ? score
          : 0,
      displayImpact:
        String(signals.automation || '').toLowerCase().includes('detected')
          ? 'Score ' + score + '/100'
          : '0',
      severity:
        String(signals.automation || '').toLowerCase().includes('detected')
          ? 'High'
          : 'Info',
      reason:
        'Automation status: ' + safeText(signals.automation, 'Unknown'),
      triggered:
        String(signals.automation || '').toLowerCase().includes('detected')
    });

    result.environment.push({
      key: 'backendReputation',
      title: 'Device reputation',
      group: 'environment',
      status:
        signals.reputation && signals.reputation !== 'Unknown device reputation'
          ? 'Triggered'
          : 'OK',
      impact: 0,
      displayImpact: '0',
      severity:
        riskLabel === 'High Risk'
          ? 'High'
          : riskLabel === 'Medium Risk'
          ? 'Medium'
          : 'Info',
      reason:
        'Reputation: ' + safeText(signals.reputation, 'Unknown'),
      triggered:
        riskLabel !== 'Low Risk'
    });

    if (Array.isArray(reasons) && reasons.length) {
      reasons.forEach(function (reason, index) {
        result.pattern.push({
          key: 'backendDeviceReason' + index,
          title: reason,
          group: 'pattern',
          status:
            riskLabel === 'Low Risk'
              ? 'OK'
              : 'Triggered',
          impact:
            index === 0
              ? score
              : 0,
          displayImpact:
            index === 0
              ? 'Score ' + score + '/100'
              : '0',
          severity: severity,
          reason: reason,
          triggered:
            riskLabel !== 'Low Risk'
        });
      });
    }

    result.riskEngine.push({
      key: 'backendRiskScore',
      title: 'Backend risk score',
      group: 'riskEngine',
      status: riskLabel,
      impact: score,
      displayImpact: 'Score ' + score + '/100',
      severity: severity,
      reason: 'Backend source of truth returned final risk score.',
      triggered: riskLabel !== 'Low Risk'
    });

    result.riskEngine.push({
      key: 'backendDecision',
      title: 'Backend decision',
      group: 'riskEngine',
      status: decision,
      impact: decision,
      displayImpact: decision,
      severity:
        decision === 'Block'
          ? 'High'
          : decision === 'Monitor' || decision === 'Challenge'
          ? 'Medium'
          : 'Low',
      reason: 'Backend source of truth returned final decision.',
      triggered: decision !== 'Allow'
    });

    result.riskEngine.push({
      key: 'backendConfidence',
      title: 'Confidence',
      group: 'riskEngine',
      status: confidence + '%',
      impact: confidence,
      displayImpact: confidence + '%',
      severity:
        confidence >= 85
          ? 'Positive'
          : confidence >= 70
          ? 'Info'
          : 'Low',
      reason: 'Confidence is based on backend risk calculation.',
      triggered: confidence >= 80
    });

    return result;
  }

  function defaultDecisionFromRisk(riskLabel) {
    if (riskLabel === 'High Risk') {
      return 'Block';
    }

    if (riskLabel === 'Medium Risk') {
      return 'Monitor';
    }

    return 'Allow';
  }

  function actionFromRisk(riskLabel) {
    if (riskLabel === 'High Risk') {
      return 'Blocked';
    }

    if (riskLabel === 'Medium Risk') {
      return 'Monitored';
    }

    return 'Allowed';
  }

  function buildThreatSeverityFromBackend(result) {
    var severityScore = 0;
    var reasons = [];

    if (result.deviceReputation === 'Blocked') {
      severityScore += 35;
      reasons.push('Blocked device reputation');
    }

    if (result.repeatDeviceCount >= 3 && result.deviceReputation === 'Blocked') {
      severityScore += 30;
      reasons.push('Repeated blocked attempts from same fingerprint');
    }

    if (result.automationDetected === true && result.score >= 80) {
      severityScore += 25;
      reasons.push('Automation behavior with high risk score');
    }

    if (
      result.deviceReputation === 'Blocked' &&
      result.riskLabel === 'High Risk'
    ) {
      severityScore += 35;
      reasons.push('Aggressive escalation behavior');
    }

    var severityLabel = 'Normal';

    if (severityScore >= 80) {
      severityLabel = 'Critical Threat Actor';
    } else if (severityScore >= 50) {
      severityLabel = 'High Severity';
    } else if (severityScore >= 25) {
      severityLabel = 'Elevated Severity';
    }

    return {
      severityScore: severityScore,
      severityLabel: severityLabel,
      reasons: reasons
    };
  }

  function getBackendDeviceActivity() {
    state.backendActivity = getBackendDeviceEvents();

    return state.backendActivity;
  }

  function getLatestDeviceResult() {
    var activity = getBackendDeviceActivity();

    if (activity.length) {
      return activity[0];
    }

    return state.currentResult;
  }

  function calculateBackendReputationStats(activity) {
    var trusted = {};
    var risky = {};
    var blocked = {};

    activity.forEach(function (item) {
      var fingerprint =
        item.profile && item.profile.fingerprintId
          ? item.profile.fingerprintId
          : null;

      if (!fingerprint) {
        return;
      }

      if (item.deviceReputation === 'Trusted') {
        trusted[fingerprint] = true;
      }

      if (item.deviceReputation === 'Risky') {
        risky[fingerprint] = true;
      }

      if (item.deviceReputation === 'Blocked') {
        blocked[fingerprint] = true;
      }

      if (item.riskLabel === 'High Risk') {
        blocked[fingerprint] = true;
      }

      if (item.riskLabel === 'Medium Risk') {
        risky[fingerprint] = true;
      }
    });

    return {
      trusted: Object.keys(trusted).length,
      risky: Object.keys(risky).length,
      blocked: Object.keys(blocked).length
    };
  }

  function summarizeInsights(activity) {
    if (!activity.length) {
      return {
        commonDevice: 'No history',
        commonOS: 'No history',
        highRiskPct: '0%',
        autoPct: '0%',
        lastDevice: 'No history',
        topRiskyFingerprint: '—',
        topBlockedFingerprint: '—',
        escalationRate: '0%',
        threatFrequency: '0 events'
      };
    }

    function mostCommon(field) {
      var counts = {};

      activity.forEach(function (item) {
        var value = safeText(item[field], 'Unknown');
        counts[value] = (counts[value] || 0) + 1;
      });

      var top = Object.keys(counts).sort(function (a, b) {
        return counts[b] - counts[a];
      })[0];

      return top + ' (' + counts[top] + ')';
    }

    function topFingerprint(type) {
      var counts = {};

      activity.forEach(function (item) {
        if (
          item.deviceReputation === type &&
          item.profile &&
          item.profile.fingerprintId
        ) {
          var fingerprint = item.profile.fingerprintId;
          counts[fingerprint] = (counts[fingerprint] || 0) + 1;
        }
      });

      var top = '—';
      var max = 0;

      Object.keys(counts).forEach(function (fingerprint) {
        if (counts[fingerprint] > max) {
          max = counts[fingerprint];
          top = fingerprint + ' (' + counts[fingerprint] + ')';
        }
      });

      return top;
    }

    var high = activity.filter(function (item) {
      return item.riskLabel === 'High Risk';
    }).length;

    var automation = activity.filter(function (item) {
      return item.automationDetected === true;
    }).length;

    var escalation = activity.filter(function (item) {
      return (
        item.threatSeverity === 'Critical Threat Actor' ||
        item.threatSeverity === 'High Severity'
      );
    }).length;

    var last = activity[0];

    return {
      commonDevice: mostCommon('deviceType'),
      commonOS: mostCommon('os'),
      highRiskPct: fmtPct((high / activity.length) * 100),
      autoPct: fmtPct((automation / activity.length) * 100),
      lastDevice:
        safeText(last.deviceType, 'Unknown') +
        ' · ' +
        safeText(last.os, 'Unknown') +
        ' · ' +
        safeText(last.browser, 'Unknown'),
      topRiskyFingerprint: topFingerprint('Risky'),
      topBlockedFingerprint: topFingerprint('Blocked'),
      escalationRate: fmtPct((escalation / activity.length) * 100),
      threatFrequency: activity.length + ' events'
    };
  }

  var renderer = {
    renderProfile: function (result) {
      if (!result) {
        if (els.profileCard) {
          els.profileCard.classList.remove(
            'risk-low',
            'risk-medium',
            'risk-high'
          );
        }

        setText(els.scoreValue, '--');
        setText(els.scoreLabel, 'No analysis yet');
        setBadge(els.profileRiskBadge, 'No Result', 'neutral');
        setBadge(els.profileDecisionBadge, 'Pending', 'neutral');
        setText(els.profileDeviceType, '—');
        setText(els.profileOs, '—');
        setText(els.profileBrowser, '—');
        setText(els.profileFingerprint, '—');
        setText(els.profileSeenCount, '—');
        setText(els.profileTrustLevel, '—');
        setText(els.profileReputation, '—');
        setText(els.profileReputationScore, '—');
        setText(els.profileThreatSeverity, '—');
        setText(els.profileUserAgent, '—');
        setText(els.profileScreenSize, '—');
        setText(els.profileTimezone, '—');
        setText(els.profileConfidence, '—');
        setText(els.profileTimestamp, 'No backend device activity yet.');

        return;
      }

      var score = clamp(toNum(result.score, 0), 0, 100);
      var degrees = Math.round((score / 100) * 360);
      var ringColor =
        result.riskLabel === 'High Risk'
          ? 'var(--device-risk-danger,#ef4444)'
          : result.riskLabel === 'Medium Risk'
          ? 'var(--device-risk-warning,#f59e0b)'
          : 'var(--device-risk-success,#22c55e)';

      if (els.scoreRing) {
        els.scoreRing.style.setProperty(
          '--device-risk-progress',
          degrees + 'deg'
        );
        els.scoreRing.style.setProperty(
          '--device-risk-ring-color',
          ringColor
        );
      }

      setText(els.scoreValue, String(score));
      setText(els.scoreLabel, result.riskLabel);

      setBadge(
        els.profileRiskBadge,
        result.riskLabel,
        getRiskTone(result.riskLabel)
      );

      if (els.profileCard) {
        els.profileCard.classList.remove(
          'risk-low',
          'risk-medium',
          'risk-high'
        );

        if (result.riskLabel === 'High Risk') {
          els.profileCard.classList.add('risk-high');
        } else if (result.riskLabel === 'Medium Risk') {
          els.profileCard.classList.add('risk-medium');
        } else {
          els.profileCard.classList.add('risk-low');
        }
      }

      setBadge(
        els.profileDecisionBadge,
        result.decision,
        getDecisionTone(result.decision)
      );

      setText(els.profileDeviceType, result.profile.deviceType);
      setText(els.profileOs, result.profile.os);
      setText(els.profileBrowser, result.profile.browser);
      setText(els.profileFingerprint, result.profile.fingerprintId || 'Unavailable');
      setText(els.profileSeenCount, String(result.repeatDeviceCount || 1));
      setText(els.profileTrustLevel, result.trustLevel || 'Unknown');
      setText(els.profileReputation, result.deviceReputation || 'Neutral');
      setText(els.profileReputationScore, String(result.reputationScore || 0));
      setText(els.profileThreatSeverity, result.threatSeverity || 'Normal');
      setText(els.profileUserAgent, result.profile.userAgent || 'Unavailable');
      setText(els.profileScreenSize, result.profile.screenSize || 'Unknown');
      setText(els.profileTimezone, result.profile.timezone || 'Unknown');
      setText(els.profileConfidence, result.confidence + '%');
      setText(els.profileTimestamp, 'Last backend event: ' + fmtDate(result.timestamp));
    },

    renderSignals: function (result) {
      [
        ['identity', els.identitySignals],
        ['environment', els.environmentSignals],
        ['pattern', els.patternSignals],
        ['riskEngine', els.riskEngineSignals]
      ].forEach(function (pair) {
        var group = pair[0];
        var container = pair[1];

        if (!container) {
          return;
        }

        container.innerHTML = '';

        var list =
          result &&
          result.signals &&
          Array.isArray(result.signals[group])
            ? result.signals[group]
            : [];

        if (!list.length) {
          container.appendChild(
            createNode('div', 'device-risk-empty', 'No backend signals yet.')
          );
          return;
        }

        list.forEach(function (signal) {
          var item = createNode('article', 'device-risk-signal-item');
          var top = createNode('div', 'device-risk-signal-top');
          var left = createNode('div', 'device-risk-signal-left');
          var title = createNode('h4', 'device-risk-signal-title', signal.title);
          var reason = createNode('p', 'device-risk-signal-reason', signal.reason);
          var status = createNode(
            'span',
            'device-risk-badge ' +
              (
                signal.status === 'Triggered'
                  ? getSeverityTone(signal.severity)
                  : 'neutral'
              ),
            signal.status
          );
          var meta = createNode('div', 'device-risk-signal-meta');
          var impact = createNode(
            'span',
            'device-risk-signal-impact',
            signal.displayImpact
          );
          var severity = createNode(
            'span',
            'device-risk-badge ' + getSeverityTone(signal.severity),
            signal.severity
          );

          left.appendChild(title);
          left.appendChild(reason);
          top.appendChild(left);
          top.appendChild(status);
          meta.appendChild(impact);
          meta.appendChild(severity);
          item.appendChild(top);
          item.appendChild(meta);
          container.appendChild(item);
        });
      });
    },

    renderBreakdown: function (result) {
      var tbody = els.breakdownTableBody;

      if (!tbody) {
        return;
      }

      tbody.innerHTML = '';

      if (!result || !Array.isArray(result.breakdown) || !result.breakdown.length) {
        var emptyRow = document.createElement('tr');
        var emptyCell = document.createElement('td');

        emptyCell.colSpan = 5;
        emptyCell.className = 'device-risk-empty-cell';
        emptyCell.textContent = 'No backend breakdown entries yet.';

        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);

        return;
      }

      result.breakdown.forEach(function (entry) {
        var row = document.createElement('tr');
        var rule = createNode('td', '', entry.rule || entry.title || 'Backend rule');
        var group = createNode('td', '', entry.group || 'riskEngine');
        var severityCell = document.createElement('td');
        var severityBadge = createNode(
          'span',
          'device-risk-badge ' + getSeverityTone(entry.severity),
          entry.severity || 'Low'
        );
        var impact = createNode('td', '', entry.impact || entry.displayImpact || '0');
        var reason = createNode('td', '', entry.reason || 'Backend device event.');

        severityCell.appendChild(severityBadge);

        row.appendChild(rule);
        row.appendChild(group);
        row.appendChild(severityCell);
        row.appendChild(impact);
        row.appendChild(reason);

        tbody.appendChild(row);
      });
    },

    renderInsights: function (activity) {
      var summary = summarizeInsights(activity);
      var reputationStats = calculateBackendReputationStats(activity);

      setText(els.insightDeviceType, summary.commonDevice);
      setText(els.insightOS, summary.commonOS);
      setText(els.insightHighRisk, summary.highRiskPct);
      setText(els.insightAutomation, summary.autoPct);
      setText(els.insightLastDevice, summary.lastDevice);

      if (els.insightTopRiskyFingerprint) {
        setText(els.insightTopRiskyFingerprint, summary.topRiskyFingerprint);
      }

      if (els.insightTopBlockedFingerprint) {
        setText(els.insightTopBlockedFingerprint, summary.topBlockedFingerprint);
      }

      if (els.insightEscalationRate) {
        setText(els.insightEscalationRate, summary.escalationRate);
      }

      if (els.insightThreatFrequency) {
        setText(els.insightThreatFrequency, summary.threatFrequency);
      }

      if (els.insightTrustedFingerprints) {
        setText(els.insightTrustedFingerprints, reputationStats.trusted);
      }

      if (els.insightRiskyFingerprints) {
        setText(els.insightRiskyFingerprints, reputationStats.risky);
      }

      if (els.insightBlockedFingerprints) {
        setText(els.insightBlockedFingerprints, reputationStats.blocked);
      }

      if (els.insightThreatTimeline) {
        setText(els.insightThreatTimeline, activity.length);
      }
    },

    renderThreatTimeline: function (activity) {
      if (!els.threatTimelineList) {
        return;
      }

      if (!activity.length) {
        els.threatTimelineList.innerHTML =
          '<div class="device-risk-empty">No backend threat timeline events yet.</div>';
        return;
      }

      els.threatTimelineList.innerHTML = activity.slice(0, 8).map(function (event) {
        var timelineTone =
          event.threatSeverity === 'Critical Threat Actor'
            ? 'critical'
            : event.threatSeverity === 'High Severity'
            ? 'high'
            : event.threatSeverity === 'Elevated Severity'
            ? 'medium'
            : 'low';

        var badgeTone =
          event.threatSeverity === 'Critical Threat Actor' ||
          event.threatSeverity === 'High Severity'
            ? 'high'
            : event.threatSeverity === 'Elevated Severity'
            ? 'medium'
            : 'low';

        return (
          '<div class="device-risk-timeline-item ' + timelineTone + '">' +
            '<div class="device-risk-timeline-top">' +
              '<strong>' +
                safeText(event.deviceReputation, 'Neutral') +
                ' · ' +
                safeText(event.riskLabel, 'Unknown') +
              '</strong>' +
              '<span class="device-risk-badge ' + badgeTone + '" style="margin-left:8px;">' +
                safeText(event.threatSeverity, 'Normal') +
              '</span>' +
              '<span>' + fmtDate(event.timestamp) + '</span>' +
            '</div>' +
            '<p>' +
              '<strong>' +
                'Backend Device Event' +
              '</strong><br>' +
              (
                event.riskReasons && event.riskReasons.length
                  ? event.riskReasons[0]
                  : 'Device risk event recorded by backend.'
              ) +
            '</p>' +
            '<small>' +
              'Score: ' + safeText(event.score, 0) +
              ' · Decision: ' + safeText(event.decision, 'Unknown') +
              ' · Action: ' + safeText(event.action, 'Backend') +
            '</small>' +
          '</div>'
        );
      }).join('');
    },

    renderActivity: function (activity) {
      var tbody = els.activityTableBody;

      if (!tbody) {
        return;
      }

      tbody.innerHTML = '';

      if (!activity.length) {
        var emptyRow = document.createElement('tr');
        var emptyCell = document.createElement('td');

        emptyCell.colSpan = 14;
        emptyCell.className = 'device-risk-empty-cell';
        emptyCell.textContent = 'No backend device activity history.';

        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);

        return;
      }

      activity.forEach(function (entry) {
        var row = document.createElement('tr');

        var cells = [
          fmtDate(entry.timestamp),
          entry.deviceType,
          entry.os,
          entry.browser,
          entry.profile && entry.profile.fingerprintId
            ? entry.profile.fingerprintId
            : '--',
          entry.trustLevel || 'Unknown',
          entry.deviceReputation || '--',
          entry.scenario || 'Backend Device',
          entry.threatSeverity || 'Normal',
          entry.riskLabel,
          String(entry.score),
          entry.decision,
          entry.action,
          entry.actionSource
        ];

        cells.forEach(function (value, index) {
          var cell = document.createElement('td');

          if (index === 4) {
            cell.appendChild(createNode('code', '', value));

          } else if (index === 5) {
            cell.appendChild(
              createNode('span', 'device-risk-badge neutral', value)
            );

          } else if (index === 6) {
            var reputationTone =
              value === 'Blocked'
                ? 'high'
                : value === 'Risky'
                ? 'medium'
                : value === 'Trusted'
                ? 'positive'
                : 'neutral';

            cell.appendChild(
              createNode('span', 'device-risk-badge ' + reputationTone, value)
            );

          } else if (index === 8) {
            var severityTone =
              value === 'Critical Threat Actor' ||
              value === 'High Severity'
                ? 'high'
                : value === 'Elevated Severity'
                ? 'medium'
                : 'low';

            cell.appendChild(
              createNode('span', 'device-risk-badge ' + severityTone, value)
            );

          } else if (index === 9) {
            cell.appendChild(
              createNode('span', 'device-risk-badge ' + getRiskTone(value), value)
            );

          } else if (index === 11 || index === 12) {
            var tone =
              index === 11
                ? getDecisionTone(value)
                : value === 'AI' || value === 'Backend'
                ? 'positive'
                : 'neutral';

            cell.appendChild(
              createNode('span', 'device-risk-badge ' + tone, value)
            );

          } else {
            if (typeof value === 'string' && value.length > 38) {
              cell.textContent = value.slice(0, 38) + '...';
              cell.title = value;
            } else {
              cell.textContent = value;
            }
          }

          row.appendChild(cell);
        });

        tbody.appendChild(row);
      });
    },

    renderRunState: function (message, isError) {
      if (!els.runState) {
        return;
      }

      els.runState.textContent = message;
      els.runState.className =
        'device-risk-inline-status' + (isError ? ' is-error' : '');
    },

    renderAutoState: function () {
      var message = state.autoActionEnabled
        ? 'Auto action is ON: Low→Allowed, Medium→Monitored, High→Blocked.'
        : 'Auto action is OFF. Backend decision is displayed without local action override.';

      setText(els.autoActionState, message);

      if (els.autoActionToggle) {
        els.autoActionToggle.checked = state.autoActionEnabled;
      }
    },

    renderAll: function () {
      var activity = getBackendDeviceActivity();
      var latest = activity.length ? activity[0] : state.currentResult;

      state.currentResult = latest || null;

      this.renderProfile(state.currentResult);
      this.renderSignals(state.currentResult);
      this.renderBreakdown(state.currentResult);
      this.renderInsights(activity);
      this.renderThreatTimeline(activity);
      this.renderActivity(activity);
      this.renderAutoState();
    }
  };

  function assignElements() {
    els.module = byId('device-risk-module');
    els.analyzeBtn = byId('deviceRiskAnalyzeBtn');
    els.copyBtn = byId('deviceRiskCopyBtn');
    els.exportBtn = byId('deviceRiskExportBtn');
    els.clearBtn = byId('deviceRiskClearBtn');
    els.autoToggle = byId('deviceRiskAutoActionToggle');
    els.autoActionToggle = els.autoToggle;
    els.runState = byId('deviceRiskRunState');
    els.autoActionState = byId('deviceRiskAutoActionState');
    els.scenarioSelect = byId('deviceRiskScenarioSelect');

    els.scoreRing = byId('deviceRiskScoreRing');
    els.scoreValue = byId('deviceRiskScoreValue');
    els.scoreLabel = byId('deviceRiskScoreLabel');
    els.profileRiskBadge = byId('deviceRiskProfileBadge');
    els.profileCard = document.querySelector('.device-risk-profile-card');
    els.profileDecisionBadge = byId('deviceRiskDecisionBadge');
    els.profileDeviceType = byId('deviceRiskProfileDeviceType');
    els.profileOs = byId('deviceRiskProfileOS');
    els.profileBrowser = byId('deviceRiskProfileBrowser');
    els.profileFingerprint = byId('deviceRiskProfileFingerprint');
    els.profileSeenCount = byId('deviceRiskProfileSeenCount');
    els.profileTrustLevel = byId('deviceRiskProfileTrustLevel');
    els.profileReputation = byId('deviceRiskProfileReputation');
    els.profileReputationScore = byId('deviceRiskProfileReputationScore');
    els.profileThreatSeverity = byId('deviceRiskProfileThreatSeverity');
    els.profileUserAgent = byId('deviceRiskProfileUserAgent');
    els.profileScreenSize = byId('deviceRiskProfileScreen');
    els.profileTimezone = byId('deviceRiskProfileTimezone');
    els.profileConfidence = byId('deviceRiskProfileConfidence');
    els.profileTimestamp = byId('deviceRiskProfileTimestamp');

    els.identitySignals = byId('deviceRiskIdentitySignals');
    els.environmentSignals = byId('deviceRiskEnvironmentSignals');
    els.patternSignals = byId('deviceRiskPatternSignals');
    els.riskEngineSignals = byId('deviceRiskEngineSignals');

    els.breakdownTableBody = byId('deviceRiskBreakdownBody');
    els.activityTableBody = byId('deviceRiskActivityBody');
    els.threatTimelineList = byId('deviceRiskThreatTimelineList');

    els.insightDeviceType = byId('deviceRiskInsightDeviceType');
    els.insightOS = byId('deviceRiskInsightOS');
    els.insightHighRisk = byId('deviceRiskInsightHighRisk');
    els.insightAutomation = byId('deviceRiskInsightAutomation');
    els.insightLastDevice = byId('deviceRiskInsightLastDevice');
    els.insightTrustedFingerprints = byId('deviceRiskInsightTrustedFingerprints');
    els.insightRiskyFingerprints = byId('deviceRiskInsightRiskyFingerprints');
    els.insightBlockedFingerprints = byId('deviceRiskInsightBlockedFingerprints');
    els.insightThreatTimeline = byId('deviceRiskInsightThreatTimeline');
    els.insightTopRiskyFingerprint = byId('deviceRiskInsightTopRiskyFingerprint');
    els.insightTopBlockedFingerprint = byId('deviceRiskInsightTopBlockedFingerprint');
    els.insightEscalationRate = byId('deviceRiskInsightEscalationRate');
    els.insightThreatFrequency = byId('deviceRiskInsightThreatFrequency');
  }

  async function analyzeDevice() {
    renderer.renderRunState('Analyzing current device with backend...');

    if (els.analyzeBtn) {
      els.analyzeBtn.disabled = true;
      els.analyzeBtn.textContent = 'Analyzing...';
    }

    try {
      var collected = await collectCurrentDeviceProfile();

      var backendResult = await aiTrustApiPost(
        '/analyze/device',
        collected.payload
      );

      var mapped = mapBackendDeviceEvent({
        moduleName: 'Device Risk Intelligence',
        module: 'Device Risk Intelligence',
        timestamp: backendResult.timestamp || new Date().toISOString(),
        raw_event: backendResult,
        risk_level: backendResult.risk_level,
        score: backendResult.score,
        decision: backendResult.decision,
        confidence: backendResult.confidence,
        reasons: backendResult.reasons,
        signals: backendResult.signals,
        device_reputation: backendResult.device_reputation
      });

      if (mapped) {
        mapped.profile.deviceType = collected.profile.deviceType;
        mapped.profile.os = collected.profile.os;
        mapped.profile.browser = collected.profile.browser;
        mapped.profile.simulationScenario = collected.profile.simulationScenario;
        mapped.profile.platform = collected.profile.platform;
        mapped.profile.maxTouchPoints = collected.profile.maxTouchPoints;

        state.currentResult = mapped;
      }

      window.dispatchEvent(
        new CustomEvent('aiTrustOsActivityUpdated', {
          detail: {
            module: 'Device Risk',
            storageKey: null,
            backendSynced: true,
            riskLabel: backendResult.risk_level,
            score: backendResult.score,
            decision: backendResult.decision,
            timestamp: backendResult.timestamp || new Date().toISOString(),
            riskReasons: backendResult.reasons || []
          }
        })
      );

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('sherguardDeviceRiskAnalyzed', {
            detail: {
              result: mapped,
              backendResult: backendResult
            }
          })
        );
      }

      renderer.renderAll();

      renderer.renderRunState(
        'Backend analysis complete. Device Risk activity is synced from backend events.'
      );

    } catch (error) {
      console.error('Device Risk backend analysis failed:', error);

      renderer.renderRunState(
        error && error.message
          ? error.message
          : 'Backend device analysis failed.',
        true
      );

    } finally {
      if (els.analyzeBtn) {
        els.analyzeBtn.disabled = false;
        els.analyzeBtn.textContent = 'Analyze Current Device';
      }
    }
  }

  function handleCopy() {
    if (!state.currentResult) {
      renderer.renderRunState('No backend device result to copy.', true);
      return;
    }

    var result = state.currentResult;
    var lines = [];

    lines.push('SherGuard — Device Risk Report');
    lines.push('Time: ' + fmtDate(result.timestamp));
    lines.push(
      'Device: ' +
      result.profile.deviceType +
      ', OS: ' +
      result.profile.os +
      ', Browser: ' +
      result.profile.browser
    );
    lines.push('Fingerprint: ' + safeText(result.profile.fingerprintId, 'Unavailable'));
    lines.push('User Agent: ' + safeText(result.profile.userAgent, 'Unavailable'));
    lines.push(
      'Screen: ' +
      safeText(result.profile.screenSize, 'Unknown') +
      ', Timezone: ' +
      safeText(result.profile.timezone, 'Unknown')
    );
    lines.push(
      'Risk Score: ' +
      result.score +
      ', Risk Level: ' +
      result.riskLabel
    );
    lines.push(
      'Decision: ' +
      result.decision +
      ', Confidence: ' +
      result.confidence +
      '%'
    );
    lines.push(
      'Action: ' +
      result.action +
      ' (Source: ' +
      result.actionSource +
      ')'
    );
    lines.push('');
    lines.push('Risk Reasons:');

    if (Array.isArray(result.riskReasons) && result.riskReasons.length) {
      result.riskReasons.forEach(function (reason) {
        lines.push('- ' + reason);
      });
    } else {
      lines.push('- No backend reasons recorded.');
    }

    lines.push('');
    lines.push('Breakdown:');

    if (Array.isArray(result.breakdown) && result.breakdown.length) {
      result.breakdown.forEach(function (entry) {
        lines.push(
          '- ' +
          safeText(entry.rule || entry.title, 'Backend rule') +
          ' | ' +
          safeText(entry.group, 'riskEngine') +
          ' | ' +
          safeText(entry.severity, 'Low') +
          ' | ' +
          safeText(entry.impact || entry.displayImpact, '0') +
          ' | ' +
          safeText(entry.reason, 'Backend event')
        );
      });
    } else {
      lines.push('- No backend breakdown entries recorded.');
    }

    copyToClipboard(lines.join('\n')).then(function () {
      renderer.renderRunState('Backend device report copied to clipboard.');
    }).catch(function () {
      renderer.renderRunState('Copy to clipboard failed.', true);
    });
  }

  function handleExport() {
    var activity = getBackendDeviceActivity();

    if (!activity.length && state.currentResult) {
      activity = [state.currentResult];
    }

    if (!activity.length) {
      renderer.renderRunState('No backend device activity to export.', true);
      return;
    }

    var csv = [];

    csv.push(
      'timestamp,deviceType,os,browser,fingerprint,riskLabel,score,decision,action,actionSource,deviceReputation,threatSeverity'
    );

    activity.forEach(function (item) {
      csv.push([
        csvEscape(item.timestamp),
        csvEscape(item.deviceType),
        csvEscape(item.os),
        csvEscape(item.browser),
        csvEscape(
          item.profile && item.profile.fingerprintId
            ? item.profile.fingerprintId
            : ''
        ),
        csvEscape(item.riskLabel),
        csvEscape(item.score),
        csvEscape(item.decision),
        csvEscape(item.action),
        csvEscape(item.actionSource),
        csvEscape(item.deviceReputation),
        csvEscape(item.threatSeverity)
      ].join(','));
    });

    downloadFile(
      'device-risk-backend-activity.csv',
      csv.join('\n'),
      'text/csv;charset=utf-8'
    );

    renderer.renderRunState('Backend Device Risk CSV exported.');
  }

  async function handleClear() {
    if (!window.confirm('Clear backend dashboard activity? This clears organization security events, not only Device Risk.')) {
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

      renderer.renderAll();
      renderer.renderRunState('Backend activity cleared successfully.');

      window.dispatchEvent(
        new CustomEvent('aiTrustOsActivityUpdated', {
          detail: {
            module: 'Device Risk',
            cleared: true,
            backendSynced: true,
            timestamp: new Date().toISOString()
          }
        })
      );

    } catch (error) {
      console.error('Device Risk backend clear failed:', error);

      renderer.renderRunState(
        'Backend clear failed. Use main dashboard Clear Activity if needed.',
        true
      );
    }
  }

  function loadAutoPreference() {
    try {
      return localStorage.getItem(AUTO_ACTION_KEY) === 'true';
    } catch (error) {
      return false;
    }
  }

  function saveAutoPreference(value) {
    try {
      localStorage.setItem(AUTO_ACTION_KEY, value ? 'true' : 'false');
    } catch (error) {}
  }

  function loadScenarioPreference() {
    try {
      return localStorage.getItem(SCENARIO_KEY) || 'normal';
    } catch (error) {
      return 'normal';
    }
  }

  function saveScenarioPreference(value) {
    try {
      localStorage.setItem(SCENARIO_KEY, value || 'normal');
    } catch (error) {}
  }

  function bindEvents() {
    if (els.analyzeBtn) {
      els.analyzeBtn.addEventListener('click', function () {
        analyzeDevice();
      });
    }

    if (els.copyBtn) {
      els.copyBtn.addEventListener('click', handleCopy);
    }

    if (els.exportBtn) {
      els.exportBtn.addEventListener('click', handleExport);
    }

    if (els.clearBtn) {
      els.clearBtn.addEventListener('click', handleClear);
    }

    if (els.autoToggle) {
      els.autoToggle.addEventListener('change', function (event) {
        state.autoActionEnabled = !!event.target.checked;
        saveAutoPreference(state.autoActionEnabled);
        renderer.renderAll();
      });
    }

    if (els.scenarioSelect) {
      els.scenarioSelect.addEventListener('change', function (event) {
        saveScenarioPreference(event.target.value);
      });
    }

    window.addEventListener('sherguardDashboardEventsSynced', function () {
      renderer.renderAll();
    });

    window.addEventListener('aiTrustOsActivityUpdated', function () {
      setTimeout(function () {
        renderer.renderAll();
      }, 500);
    });
  }

  function init() {
    assignElements();

    if (!els.module) {
      return;
    }

    state.autoActionEnabled = loadAutoPreference();

    if (els.scenarioSelect) {
      els.scenarioSelect.value = loadScenarioPreference();
    }

    bindEvents();

    renderer.renderAll();

    renderer.renderRunState(
      getBackendDeviceActivity().length
        ? 'Loaded backend Device Risk activity.'
        : 'Ready. Click Analyze Current Device to create a backend Device Risk event.'
    );
  }

  window.AITrustOSDeviceRisk = {
    init: init,
    analyze: analyzeDevice,
    getBackendDeviceEvents: getBackendDeviceEvents,
    renderer: renderer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();