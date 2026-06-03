(function () {
  'use strict';
  let riskDistributionChart = null;
  let moduleActivityChart = null;

  function getData(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function fetchSecurityCenter() {
    try {
      const data = await aiTrustApiGet(
        '/analytics/security-center'
      );
  
      window.aiTrustSecurityCenter = data;
  
      console.log(
        'AI Trust OS Security Center:',
        data
      );
  
      if (data.dashboard) {
        console.log(
          'Security Center dashboard synced'
        );
      }
  
      return data;
  
    } catch (error) {
  
      console.error(
        'Security Center sync failed:',
        error
      );
  
      return null;
    }
  }

  async function fetchAnalyticsSummary() {
    try {
      const data = await aiTrustApiGet(
        '/analytics/summary'
      );
  
      window.aiTrustAnalyticsSummary = data;
  
      return data;
  
    } catch (error) {
      console.error(
        'Analytics summary sync failed:',
        error
      );
  
      return null;
    }
  }

  async function fetchApiUsageAnalytics() {
    try {
      const data = await aiTrustApiGet(
        '/analytics/api-usage'
      );
  
      window.aiTrustApiUsage = data;
  
      return data;
  
    } catch (error) {
      console.error(
        'API usage analytics failed:',
        error
      );
  
      return null;
    }
  }

  async function collectAllData() {
    await fetchSecurityCenter();
  
    let backendEvents = [];
  
    try {
      const data = await aiTrustApiGet('/events');
    
      if (data && data.events) {
      if (data.events && Array.isArray(data.events)) {
          backendEvents = data.events.map(function (event) {
            return {
              ...event,
              moduleName: event.module || 'Unknown Module',
              riskLevel: event.risk_level || event.riskLevel || event.riskLabel,
              riskLabel: event.risk_level || event.riskLabel || event.riskLevel,
              confidence:
                event.confidence === 'High'
                  ? 95
                  : event.confidence === 'Medium'
                  ? 75
                  : 55
            };
          });
        }
      }
    } catch (error) {
      console.error('Dashboard backend sync failed:', error);
    }
  
    const localEvents = []
    .concat(tagModule(getData(aiTrustScopedKey('aiTrustOsEmailRiskActivity')), 'Email Risk'))
    .concat(tagModule(getData(aiTrustScopedKey('aiTrustOsDeviceRiskActivity')), 'Device Risk'))
    .concat(tagModule(getData(aiTrustScopedKey('aiTrustOsBotRiskActivity')), 'Bot Detection'))
    .concat(tagModule(getData(aiTrustScopedKey('aiTrustOsApiAbuseActivity')), 'API Abuse'))
    .concat(tagModule(getData(aiTrustScopedKey('aiTrustOsPaymentFraudActivity')), 'Payment Fraud Intelligence'));
  
      const combined = backendEvents.length > 0
      ? backendEvents
      : localEvents;
  
    return combined.map(function (event) {
      const risk =
        event.riskLevel ||
        event.riskLabel ||
        event.risk_level ||
        event.risk_level_text ||
        'Low Risk';
  
      return {
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
        riskLevel: risk,
        riskLabel: risk,
        score: Number(event.score || event.riskScore || 0),
        moduleName:
          event.moduleName ||
          event.module ||
          event.module_key ||
          'Unknown Module'
      };
    });
  }

  function tagModule(records, moduleName) {
    return records.map(record => ({
      ...record,
      moduleName
    }));
  }

  function calculateStats(records) {
    let high = 0;
    let medium = 0;
    let low = 0;

    records.forEach(r => {
      const level = (r.riskLabel || r.riskLevel || '').toLowerCase();

      if (level.includes('high')) high++;
      else if (level.includes('medium')) medium++;
      else if (level.includes('low')) low++;
    });

    return {
      total: records.length,
      high,
      medium,
      low
    };
  }

  function updateUI(stats, securityCenter) {
    if (securityCenter && securityCenter.dashboard) {
      setText('totalChecksValue', securityCenter.dashboard.total_events || 0);
      setText('highRiskValue', securityCenter.dashboard.high_risk || 0);
      setText('mediumRiskValue', securityCenter.dashboard.medium_risk || 0);
      setText('lowRiskValue', securityCenter.dashboard.low_risk || 0);
  
      setKpiColor('highRiskValue', securityCenter.dashboard.high_risk || 0, 'high');
      setKpiColor('mediumRiskValue', securityCenter.dashboard.medium_risk || 0, 'medium');
      setKpiColor('lowRiskValue', securityCenter.dashboard.low_risk || 0, 'low');
  
      return;
    }
  
    setText('totalChecksValue', stats.total);
    setText('highRiskValue', stats.high);
    setText('mediumRiskValue', stats.medium);
    setText('lowRiskValue', stats.low);
  
    setKpiColor('highRiskValue', stats.high, 'high');
    setKpiColor('mediumRiskValue', stats.medium, 'medium');
    setKpiColor('lowRiskValue', stats.low, 'low');
  }

  function updateSystemInsights(records, stats) {
    const policyConfig = getSavedAgentPolicy();

    if (stats.total === 0) {
      const emptyStatus = getEngineStatus(0, policyConfig);
      const emptyPolicy = getCurrentPolicy();

      setText('insightText', 'No activity has been reviewed yet. Run a module check to generate live intelligence.');
      setText('insightMeta', `AI Policy: ${emptyPolicy}`);
      setText('insightUpdated', 'Waiting for data');
      setText('insightConfidence', 'Confidence: Low');
      setText('topPattern', 'No pattern detected yet');
      setText('engineStatus', emptyStatus);
      setStatusColor(emptyStatus);
      setRiskSummary({
        high: 0,
        medium: 0,
        low: 0
      });
      setText('actionAdvice', `Run Email Risk, Device Risk, Bot Detection, or another module to begin analysis. Current AI policy: ${emptyPolicy}.`);
      return;
    }

    const highPercent = Math.round((stats.high / stats.total) * 100);
    const confidence = getConfidence(stats.total);
    const topPattern = getTopPattern(records, stats);
    const status = getEngineStatus(highPercent, policyConfig);
    const advice = getActionAdvice(highPercent, stats, policyConfig);
    const policy = getCurrentPolicy();

    let insightMessage = `AI Trust OS reviewed ${stats.total} events across modules. High-risk activity is ${highPercent}%.`;

if (stats.high >= 5) {
  insightMessage = 'High-risk activity spike detected across trust modules. Immediate review recommended.';
} else if (stats.medium >= 5) {
  insightMessage = 'Medium-risk activity is increasing across monitored systems.';
} else if (stats.low >= stats.total - 1 && stats.total > 3) {
  insightMessage = 'Environment appears stable with mostly low-risk trust activity.';
}

const disposableHits = records.filter(
  (item) =>
    item.providerType === 'disposable' ||
    item.domainType === 'disposable'
).length;

if (disposableHits >= 2) {
  insightMessage += ' Disposable email usage patterns detected.';
}

setText('insightText', insightMessage);

        setText('insightMeta', `AI Policy: ${policy}`);
    setText('insightUpdated', `Last live sync: ${new Date().toLocaleTimeString()}`);
    setText('insightConfidence', `Confidence: ${confidence}`);
    setText('topPattern', topPattern);
    setText('engineStatus', status);
    updateSystemHealth(highPercent);
    updateRiskBanner(highPercent);
    setStatusColor(status);
    setRiskSummary(stats);
    setText('actionAdvice', `${advice} Current AI policy: ${policy}.`);
  }

  function getSavedAgentPolicy() {
    let savedPolicy = {};

    try {
      savedPolicy = JSON.parse(localStorage.getItem(aiTrustScopedKey('aiTrustOsAgentPermissions')) || '{}');
    } catch {
      savedPolicy = {};
    }

    if (!window.aiAgentConfig) window.aiAgentConfig = {};

    window.aiAgentConfig.masterEnabled = savedPolicy.masterAI !== false;
    window.aiAgentConfig.strictMode = savedPolicy.strictMode === true;
    window.aiAgentConfig.autoAction = savedPolicy.autoAction === true;
    window.aiAgentConfig.approvalRequired = savedPolicy.approvalRequired !== false;

    return window.aiAgentConfig;
  }

  function getCurrentPolicy() {
    const config = getSavedAgentPolicy();

    const enabled = config.masterEnabled ? 'Enabled' : 'Disabled';
    const strict = config.strictMode ? 'ON' : 'OFF';
    const auto = config.autoAction ? 'ON' : 'OFF';
    const approval = config.approvalRequired ? 'ON' : 'OFF';

    return `${enabled} | Strict: ${strict} | Auto: ${auto} | Approval: ${approval}`;
  }

  function getConfidence(total) {
    if (total >= 20) return 'High';
    if (total >= 8) return 'Medium';
    return 'Low';
  }

  function getEngineStatus(highPercent, policyConfig) {
    if (policyConfig?.masterEnabled === false) {
      return 'AI Disabled';
    }

    if (highPercent >= 50) {
      if (policyConfig.strictMode && policyConfig.autoAction) {
        return 'Critical Risk (Strict + Auto-Protect)';
      }

      if (policyConfig.strictMode) {
        return 'Critical Risk (Strict Mode)';
      }

      if (policyConfig.autoAction) {
        return 'Critical Risk (Auto-Protect)';
      }

      return 'Critical Risk';
    }

    if (highPercent >= 25) {
      if (policyConfig.strictMode && policyConfig.autoAction) {
        return 'Elevated Risk (Strict + Auto-Protect)';
      }

      if (policyConfig.strictMode) {
        return 'Elevated Risk (Strict Mode)';
      }

      if (policyConfig.autoAction) {
        return 'Elevated Risk (Auto-Protect)';
      }

      return 'Elevated Risk';
    }

    if (policyConfig.strictMode && policyConfig.autoAction) {
      return 'Monitoring (Strict + Auto-Protect)';
    }

    if (policyConfig.strictMode) {
      return 'Monitoring (Strict Mode)';
    }

    if (policyConfig.autoAction) {
      return 'Monitoring (Auto-Protect)';
    }

    return 'Monitoring';
  }

  function getActionAdvice(highPercent, stats, policyConfig) {
    const autoAction = policyConfig?.autoAction === true;
    const strictMode = policyConfig?.strictMode === true;
    const approvalRequired = policyConfig?.approvalRequired !== false;

    if (highPercent >= 50) {
      if (autoAction) {
        return 'Auto-Protect is active. High-risk activity should be restricted automatically while human review stays available.';
      }

      return 'Immediate review recommended. High-risk activity is dominating recent checks.';
    }

    if (highPercent >= 25) {
      if (autoAction) {
        return 'Auto-Protect is active. The system should reduce risky actions and keep suspicious events under review.';
      }

      return 'Increase review controls and investigate the modules creating high-risk signals.';
    }

    if (stats.medium > stats.high && stats.medium > stats.low) {
      return approvalRequired
        ? 'Medium-risk activity is increasing. Keep approval controls enabled before allowing automation.'
        : 'Medium-risk activity is increasing. Consider enabling approval controls for safer automation.';
    }

    if (strictMode) {
      return 'Strict Mode is active. The system requires tighter review and safer decisions for all activity.';
    }

    if (autoAction) {
      return 'System looks stable. Auto-Protect can assist with low-risk decisions while monitoring continues.';
    }

    return 'System looks stable. Continue monitoring and keep approval controls enabled.';
  }

  function getTopPattern(records, stats) {
    const moduleCounts = {};

    records.forEach(record => {
      const name = record.moduleName || 'Unknown Module';
      moduleCounts[name] = (moduleCounts[name] || 0) + 1;
    });

    let topModule = 'Unknown Module';
    let topCount = 0;

    Object.keys(moduleCounts).forEach(name => {
      if (moduleCounts[name] > topCount) {
        topModule = name;
        topCount = moduleCounts[name];
      }
    });

    const deviceHighRisk = records.filter(function (item) {
      return (
        item.moduleName === 'Device Risk' &&
        String(item.riskLabel || item.riskLevel || '').toLowerCase().includes('high')
      );
    }).length;
    
    if (deviceHighRisk >= 2) {
      return 'Most common pattern: Repeated high-risk device signals detected';
    }
    
    if (stats.high >= stats.medium && stats.high >= stats.low && stats.high > 0) {
      return `Most common pattern: High-risk signals, mainly from ${topModule}`;
    }

    if (stats.medium >= stats.high && stats.medium >= stats.low && stats.medium > 0) {
      return `Most common pattern: Medium-risk signals, mainly from ${topModule}`;
    }

    return `Most common pattern: Low-risk signals, mainly from ${topModule}`;
  }

  function setStatusColor(status) {
    const el = document.getElementById('engineStatus');
    if (!el) return;

    el.style.fontWeight = '700';

    if (status.toLowerCase().includes('critical')) {
      el.style.color = '#dc2626';
      return;
    }

    if (status.toLowerCase().includes('elevated')) {
      el.style.color = '#d97706';
      return;
    }

    if (status.toLowerCase().includes('disabled')) {
      el.style.color = '#6b7280';
      return;
    }

    el.style.color = '#16a34a';
  }

  function setRiskSummary(stats) {
    const el = document.getElementById('riskSummary');
    if (!el) return;

    el.innerHTML = `
      <span style="color:#dc2626 !important; font-weight:700;">High: ${stats.high}</span>
      ·
      <span style="color:#d97706 !important; font-weight:700;">Medium: ${stats.medium}</span>
      ·
      <span style="color:#16a34a !important; font-weight:700;">Low: ${stats.low}</span>
    `;
  }

  function updateRiskBanner(highPercent) {

    const banner = document.getElementById('riskBanner');

    const securityCenter =
  window.aiTrustSecurityCenter || {};

const incident =
  securityCenter.incident_response || {};

    if (!banner) return;

    if (
      incident.incident_mode === 'Critical Incident'
    ) {
    
      banner.classList.remove('hidden');
    
      banner.textContent =
        '🚨 Emergency Response Active • Auto Protection Enabled • Critical Incident Detected';
    
      banner.classList.add('critical-pulse');
    
      playCriticalBeep();
    
      banner.style.background = '#fee2e2';
      banner.style.color = '#991b1b';
    
      return;
    }
    
    if (
      incident.incident_mode === 'Elevated Incident'
    ) {
    
      banner.classList.remove('hidden');
    
      banner.textContent =
        '⚠️ Threat Escalation Monitoring • Strict Protection Recommended';
    
      banner.style.background = '#fef3c7';
      banner.style.color = '#92400e';
    
      return;
    }
    
    if (highPercent >= 50) {
      banner.classList.remove('hidden');
    
      banner.textContent =
        '🚨 Critical risk detected. Immediate review is recommended.';
    
      banner.classList.add('critical-pulse');
    
      playCriticalBeep();
    
      banner.style.background = '#fee2e2';
      banner.style.color = '#991b1b';
    
      return;
    }

    if (highPercent >= 25) {
      banner.classList.remove('hidden');
      banner.textContent = '⚠️ Elevated risk detected. Review suspicious activity soon.';
      banner.style.background = '#fef3c7';
      banner.style.color = '#92400e';
      return;
    }
    banner.classList.remove('critical-pulse');
    banner.classList.add('hidden');
  }

  function setKpiColor(id, value, type) {
    const el = document.getElementById(id);
    if (!el) return;

    el.style.fontWeight = '700';

    if (value === 0) {
      el.style.color = '#6b7280';
      return;
    }

    if (type === 'high') {
      el.style.color = '#dc2626';
      return;
    }

    if (type === 'medium') {
      el.style.color = '#d97706';
      return;
    }

    if (type === 'low') {
      el.style.color = '#16a34a';
      return;
    }
  }

  function updateSystemHealth(highPercent) {
    const el = document.getElementById('systemHealth');
    if (!el) return;

    if (highPercent >= 50) {
      el.textContent = 'System Health: Critical';
      el.style.color = '#dc2626';
      return;
    }

    if (highPercent >= 25) {
      el.textContent = 'System Health: Watch';
      el.style.color = '#d97706';
      return;
    }

    el.textContent = 'System Health: Stable';
    el.style.color = '#16a34a';
  }

  function updateTrend(current, previous) {
    const el = document.getElementById('trendIndicator');
    if (!el) return;

    if (!previous) {
      el.textContent = 'Trend: Collecting baseline data...';
      el.style.color = '#6b7280';
      return;
    }

    if (current.high > previous.high) {
      el.textContent = 'Trend: Risk Increasing ↑';
      el.style.color = '#dc2626';
      return;
    }

    if (current.high < previous.high) {
      el.textContent = 'Trend: Improving ↓';
      el.style.color = '#16a34a';
      return;
    }

    el.textContent = 'Trend: Stable';
    el.style.color = '#6b7280';
  }

  function updateRecentActivity(records) {
    const el = document.getElementById('recentActivityFeed');
  
    if (!el) {
      return;
    }
  
    let activityRecords = records || [];
  
    if (!activityRecords || activityRecords.length === 0) {
      el.innerHTML = `
        <div style="
          text-align:center;
          padding:24px;
          color:#6b7280;
          font-size:13px;
        ">
          <div style="font-size:22px; margin-bottom:8px;">🧹</div>
          No backend activity yet.<br>
          Run a module to start generating organization security events.
        </div>
      `;
      return;
    }
  
    const latest = activityRecords.slice(-5).reverse();
  
    el.innerHTML = latest.map((item) => {
      const label =
        item.risk_level ||
        item.riskLabel ||
        item.riskLevel ||
        'Unknown';
  
      const module =
        item.module ||
        item.moduleName ||
        'Module';
  
      const score =
        item.score != null ? item.score : '—';
  
      const confidence =
        item.confidence != null ? item.confidence : '—';
  
      const reason =
        Array.isArray(item.reasons) && item.reasons.length
          ? item.reasons[0]
          : Array.isArray(item.riskReasons) && item.riskReasons.length
            ? item.riskReasons[0]
            : 'No major reason';
  
      const time = item.timestamp
        ? new Date(item.timestamp).toLocaleTimeString()
        : '';
  
      let color = '#6b7280';
  
      if (label.toLowerCase().includes('high')) {
        color = '#dc2626';
      } else if (label.toLowerCase().includes('medium')) {
        color = '#d97706';
      } else if (label.toLowerCase().includes('low')) {
        color = '#16a34a';
      }
  
      return `
        <div onclick="openModule('${module}')" style="cursor:pointer;">
          <span style="display:inline-block; padding:3px 8px; border-radius:999px; font-size:11px; font-weight:600; background:${color}20; color:${color}; margin-right:6px;">
            ${label}
          </span>
          ${module} · Score: ${score} · Confidence: ${confidence}
          <br>
          <span style="color:#64748b; font-size:12px;">Reason: ${reason}</span>
          <span style="color:#9ca3af; font-size:12px; margin-left:6px;">
            ${time}
          </span>
        </div>
      `;
    }).join('');
  
    const feed = document.querySelector('.dashboard-mini-feed');
  
    if (feed) {
      feed.classList.remove('live-pulse');
  
      setTimeout(function () {
        feed.classList.add('live-pulse');
      }, 50);
    }
  }
  
  window.openModule = function (moduleName) {
    const map = {
      'Email Risk': 'email-risk',
      'Device Risk': 'device-risk-module',
      'Bot Detection': 'bot-detection',
      'API Abuse': 'api-abuse',
      'Payment Fraud': 'payment-fraud',
    };
  
    const targetId = map[moduleName];
    if (!targetId) return;
  
    const section = document.getElementById(targetId);
    if (!section) return;
  
    section.scrollIntoView({ behavior: 'smooth' });
  };

  function toggleClearButton(total) {
    const btn = document.getElementById('clearActivityBtn');
  
    if (!btn) return;
  
    btn.style.display = 'inline-flex';
  
    if (total <= 0) {
      btn.style.opacity = '0.5';
    } else {
      btn.style.opacity = '1';
    }
  }

  function ensureClearModal() {
    if (document.getElementById('clearActivityModal')) return;

    const modal = document.createElement('div');
    modal.id = 'clearActivityModal';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '999999999';
    modal.style.background = 'rgba(15, 23, 42, 0.55)';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '20px';

    modal.innerHTML = `
      <div style="
        width: min(420px, 100%);
        background: #ffffff;
        border-radius: 18px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
        padding: 22px;
        font-family: inherit;
      ">
        <h3 style="margin: 0 0 8px; color: #111827; font-size: 20px;">Clear all dashboard activity?</h3>
        <p style="margin: 0 0 18px; color: #6b7280; font-size: 14px; line-height: 1.5;">
          This will remove all saved activity from Email Risk, Device Risk, Bot Detection, API Abuse, Payment Fraud, and Review Fraud. This cannot be undone.
        </p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
          <button id="cancelClearActivityBtn" type="button" style="
            padding: 9px 14px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            background: #ffffff;
            color: #374151;
            cursor: pointer;
            font-weight: 600;
          ">Cancel</button>
          <button id="confirmClearActivityBtn" type="button" style="
            padding: 9px 14px;
            border-radius: 10px;
            border: 1px solid #dc2626;
            background: #dc2626;
            color: #ffffff;
            cursor: pointer;
            font-weight: 700;
          ">Yes, clear activity</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('cancelClearActivityBtn').addEventListener('click', closeClearModal);
    document.getElementById('confirmClearActivityBtn').addEventListener('click', confirmClearActivity);
  }

  function openClearModal() {
    ensureClearModal();

    const modal = document.getElementById('clearActivityModal');
    if (!modal) return;

    modal.style.display = 'flex';
  }

  function closeClearModal() {
    const modal = document.getElementById('clearActivityModal');
    if (!modal) return;

    modal.style.display = 'none';
  }

  async function confirmClearActivity() {
    localStorage.removeItem(aiTrustScopedKey('aiTrustOsEmailRiskActivity'));

localStorage.removeItem(aiTrustScopedKey('aiTrustOsDeviceRiskActivity'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsDeviceRiskTimeline'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsDeviceRiskReputation'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsDeviceRiskFingerprints'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsDeviceRiskTrustStore'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsDeviceRiskBlockedFingerprints'));

localStorage.removeItem(aiTrustScopedKey('aiTrustOsBotRiskActivity'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsApiAbuseActivity'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsPaymentFraudActivity'));
localStorage.removeItem(aiTrustScopedKey('aiTrustOsPrevStats'));
  
    try {
      await fetch('https://sherguard-api.onrender.com/events', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('aiTrustToken')
        }
      });
    } catch (error) {
      console.error('Backend clear failed:', error);
    }
  
    window.latestDashboardRecords = [];
    window.previousDashboardTotal = 0;
  
    closeClearModal();
    runDashboard();
    showDashboardToast('Activity cleared successfully.');
  
    setTimeout(function () {
      window.location.reload();
    }, 500);
  }

  function showDashboardToast(message) {
    let toast = document.getElementById('dashboardToast');
  
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dashboardToast';
      toast.style.position = 'fixed';
      toast.style.right = '24px';
      toast.style.bottom = '24px';
      toast.style.zIndex = '999999999';
      toast.style.background = '#16a34a';
      toast.style.color = '#ffffff';
      toast.style.padding = '12px 16px';
      toast.style.borderRadius = '12px';
      toast.style.fontSize = '14px';
      toast.style.fontWeight = '700';
      toast.style.boxShadow = '0 14px 35px rgba(15, 23, 42, 0.18)';
      document.body.appendChild(toast);
    }
  
    toast.textContent = message;
    toast.style.display = 'block';
  
    setTimeout(function () {
      toast.style.display = 'none';
    }, 2200);
  }

  function playCriticalBeep() {
    if (window.lastCriticalBeep && Date.now() - window.lastCriticalBeep < 8000) return;
  
    window.lastCriticalBeep = Date.now();
  
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
  
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
  
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
  
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
  
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.18);
  }

  function updateThreatTicker(records, stats) {
    const ticker = document.getElementById('threatTicker');
    if (!ticker) return;
  
    if (!records || records.length === 0) {
      ticker.textContent = 'Live Threat Feed: Waiting for activity...';
      return;
    }
  
    if (stats.high > 0) {
      ticker.textContent = `Live Threat Feed: ${stats.high} high-risk signal(s) detected • Review recommended • AI Trust OS monitoring live`;
      return;
    }
  
    if (stats.medium > 0) {
      ticker.textContent = `Live Threat Feed: ${stats.medium} medium-risk signal(s) detected • Monitoring suspicious activity`;
      return;
    }
  
    ticker.textContent = `Live Threat Feed: ${stats.low} low-risk signal(s) reviewed • System stable`;
  }

  function updateGlobalRiskMeter(stats) {
    const total = stats.total || 1;
    const weightedRisk =
  (stats.high * 100) +
  (stats.medium * 45) +
  (stats.low * 10);

const maxPossible =
  stats.total * 100;

const riskPercent =
  stats.total
    ? Math.round((weightedRisk / maxPossible) * 100)
    : 0;
  
    const percentEl = document.getElementById('globalRiskPercent');
    const statusEl = document.getElementById('globalRiskStatus');
    const fillEl = document.getElementById('globalRiskBarFill');
    const meterValue = document.getElementById('globalRiskMeterValue');
    const eventsEl = document.getElementById('globalEventsText');
    const rateEl = document.getElementById('highRiskRateText');
    const actionEl = document.getElementById('globalActionText');
  
    if (!percentEl || !statusEl || !fillEl) return;

if (eventsEl) {
  eventsEl.textContent = `${stats.total} total risk event${stats.total !== 1 ? 's' : ''} reviewed`;
}
if (rateEl) {
  rateEl.textContent = `High-risk rate: ${riskPercent}%`;
}
if (actionEl) {
  if (riskPercent >= 50) {
    actionEl.textContent = 'Recommended action: Restrict high-risk activity and review immediately';
  } else if (riskPercent >= 25) {
    actionEl.textContent = 'Recommended action: Increase review controls';
  } else {
    actionEl.textContent = 'Recommended action: Continue monitoring';
  }
}
  
    percentEl.textContent = `${riskPercent}%`;
    fillEl.style.width = `${riskPercent}%`;

if (riskPercent >= 70) {
  fillEl.style.background = '#dc2626';

  if (meterValue) {
    meterValue.style.color = '#dc2626';
  }

} else if (riskPercent >= 40) {
  fillEl.style.background = '#d97706';

  if (meterValue) {
    meterValue.style.color = '#d97706';
  }

} else {
  fillEl.style.background = '#16a34a';

  if (meterValue) {
    meterValue.style.color = '#16a34a';
  }
}
  
fillEl.classList.remove(
  'global-risk-stable',
  'global-risk-elevated',
  'global-risk-critical',
  'global-risk-critical-pulse'
);
  
if (riskPercent >= 50) {
  statusEl.textContent = 'CRITICAL';
  statusEl.style.color = '#fca5a5';

  fillEl.classList.add('global-risk-critical');
  fillEl.classList.add('global-risk-critical-pulse');

  return;
}
  
    if (riskPercent >= 25) {
      statusEl.textContent = 'ELEVATED';
      statusEl.style.color = '#fde68a';
      fillEl.classList.add('global-risk-elevated');
      return;
    }
  
    statusEl.textContent = 'STABLE';
    statusEl.style.color = '#86efac';
    fillEl.classList.add('global-risk-stable');
  }

  function updateConnectedModules() {

    const el = document.getElementById('connectedModulesText');
    if (!el) return;
  
    const modules = [
      'aiTrustOsEmailRiskActivity',
      'aiTrustOsDeviceRiskActivity',
      'aiTrustOsBotRiskActivity',
      'aiTrustOsApiAbuseActivity',
      'aiTrustOsPaymentFraudActivity',
    ];
  
    let activeCount = 0;
  
    modules.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(aiTrustScopedKey(key)) || '[]');
  
        if (Array.isArray(data) && data.length > 0) {
          activeCount++;
        }
      } catch {}
    });
  
    el.textContent = `${activeCount} active risk module${activeCount !== 1 ? 's' : ''} connected`;
  }

  function updateDashboardTimeline(records) {
    const el = document.getElementById('dashboardTimelineFeed');
    if (!el) return;
  
    if (!records || records.length === 0) {
      el.innerHTML = 'Waiting for timeline events...';
      return;
    }
  
    const latest = records
  .slice()
  .sort(function (a, b) {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  })
  .slice(0, 8);
  
    el.innerHTML = latest.map(item => {
      const label = item.riskLabel || item.riskLevel || 'Unknown';
      const module = item.moduleName || 'Module';
      const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'No time';
  
      let tone = 'neutral';

if (label.toLowerCase().includes('high')) {
  tone = 'high';
} else if (label.toLowerCase().includes('medium')) {
  tone = 'medium';
} else if (label.toLowerCase().includes('low')) {
  tone = 'low';
}

return `
  <div class="timeline-item ${tone}">
          <strong>${module} · ${label}</strong>
          <span>${time}</span>
        </div>
      `;
    }).join('');
    updateTotalChecksLastEventTime(records);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
  
    const oldValue = el.textContent;
    el.textContent = value;
  
    if (!isNaN(value) && oldValue !== String(value)) {
      el.style.transform = 'scale(1.18)';
      el.style.transition = 'transform 0.25s ease';
  
      setTimeout(function () {
        el.style.transform = 'scale(1)';
      }, 250);
    }
  }

  function updateSecurityCenterCard() {
    const data = window.aiTrustSecurityCenter;
  
    if (!data) return;
  
    const status = data.security_status || 'Stable';
    const priority = data.priority || 'Monitor';
    let trend = 'Stable';
let action = 'Continue monitoring';

if (data.security_status === 'Critical') {
  trend = 'Critical threat activity detected';
  action = 'Immediate review required';
} else if (data.security_status === 'Elevated') {
  trend = 'Elevated suspicious activity detected';
  action = 'Review recommended';
} else if (
  data.trends &&
  data.trends.recent_event_count > 0
) {
  trend = 'Live monitoring active';
  action = 'Continue monitoring';
}
  
    setText('securityCenterStatus', status);
    setText('securityCenterPriority', 'Priority: ' + priority);
    setText('securityCenterTrend', 'Trend: ' + trend);
    setText('securityCenterAction', 'Recommended action: ' + action);
  
    const statusEl = document.getElementById('securityCenterStatus');
  
    if (statusEl) {
      if (status === 'Critical') {
        statusEl.style.color = '#fca5a5';
      } else if (status === 'Elevated') {
        statusEl.style.color = '#fde68a';
      } else {
        statusEl.style.color = '#86efac';
      }
    }
  }

  function renderAnalyticsCharts(stats, records) {

    const riskCanvas =
      document.getElementById(
        'riskDistributionChart'
      );
  
    const moduleCanvas =
      document.getElementById(
        'moduleActivityChart'
      );
  
    if (
      !riskCanvas ||
      !moduleCanvas ||
      typeof Chart === 'undefined'
    ) {
      return;
    }
  
    if (riskDistributionChart) {
      riskDistributionChart.destroy();
    }
  
    riskDistributionChart =
      new Chart(riskCanvas, {
        type: 'doughnut',
        data: {
          labels: [
            'High Risk',
            'Medium Risk',
            'Low Risk'
          ],
          datasets: [{
            data: [
              stats.high,
              stats.medium,
              stats.low
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
  
    const moduleCounts = {
      Email: 0,
      Device: 0,
      Bot: 0,
      API: 0,
      Payment: 0
    };
  
    records.forEach(function(record) {
  
      const module =
        String(
          record.moduleName || ''
        ).toLowerCase();
  
      if (module.includes('email')) {
        moduleCounts.Email++;
      }
  
      else if (module.includes('device')) {
        moduleCounts.Device++;
      }
  
      else if (module.includes('bot')) {
        moduleCounts.Bot++;
      }
  
      else if (module.includes('api')) {
        moduleCounts.API++;
      }
  
      else if (module.includes('payment')) {
        moduleCounts.Payment++;
      }
  
    });
  
    if (moduleActivityChart) {
      moduleActivityChart.destroy();
    }
  
    moduleActivityChart =
      new Chart(moduleCanvas, {
        type: 'bar',
        data: {
          labels: [
            'Email',
            'Device',
            'Bot',
            'API',
            'Payment'
          ],
          datasets: [{
            label: 'Events',
            data: [
              moduleCounts.Email,
              moduleCounts.Device,
              moduleCounts.Bot,
              moduleCounts.API,
              moduleCounts.Payment
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
  
  }

  async function runDashboard() {
    const previousStats = JSON.parse(localStorage.getItem(aiTrustScopedKey('aiTrustOsPrevStats')) || 'null');
    const analyticsSummary = await fetchAnalyticsSummary();
    const apiUsageAnalytics = await fetchApiUsageAnalytics();
    const records = await collectAllData();
    window.latestDashboardRecords = records;
    const stats = calculateStats(records);

    if (analyticsSummary) {
      stats.total = analyticsSummary.total_events || stats.total;
      stats.high = analyticsSummary.high_risk || stats.high;
      stats.medium = analyticsSummary.medium_risk || stats.medium;
      stats.low = analyticsSummary.low_risk || stats.low;
    }

    if (apiUsageAnalytics) {

      setText(
        'analyticsTotalRequests',
        apiUsageAnalytics.total_requests || 0
      );
    
      setText(
        'analyticsAvgResponse',
        (
          apiUsageAnalytics.average_response_time || 0
        ) + 's'
      );
    
      setText(
        'analyticsThreatEvents',
        analyticsSummary
          ? analyticsSummary.high_risk || 0
          : 0
      );
    
      const apiKeys = getData('aiTrustApiKeys');
    
      setText(
        'analyticsApiKeys',
        Array.isArray(apiKeys)
          ? apiKeys.length
          : 0
      );
    
      const endpointList =
        document.getElementById(
          'topEndpointsList'
        );
    
      if (
        endpointList &&
        Array.isArray(
          apiUsageAnalytics.top_endpoints
        )
      ) {
    
        endpointList.innerHTML = '';
    
        apiUsageAnalytics.top_endpoints
          .slice(0, 6)
          .forEach(function(endpoint) {
    
            const item =
              document.createElement('div');
    
            item.className =
              'enterprise-endpoint-item';
    
            item.innerHTML = `
              <div class="enterprise-endpoint-path">
                ${endpoint.path}
              </div>
    
              <div class="enterprise-endpoint-count">
                ${endpoint.requests} requests
              </div>
            `;
    
            endpointList.appendChild(item);
          });
      }
    
      const requestVolumeChart =
        document.getElementById(
          'requestVolumeChart'
        );
    
      if (requestVolumeChart) {
    
        const totalRequests =
          apiUsageAnalytics.total_requests || 0;
    
        const blockedRequests =
          apiUsageAnalytics.blocked_requests || 0;
    
        const successfulRequests =
          apiUsageAnalytics.successful_requests || 0;
    
        requestVolumeChart.innerHTML = `
          <div class="enterprise-volume-stats">
    
  <div class="enterprise-volume-item enterprise-volume-success">
  <strong>${successfulRequests}</strong>
  <span>Successful</span>
</div>

<div class="enterprise-volume-item enterprise-volume-blocked">
  <strong>${blockedRequests}</strong>
  <span>Blocked</span>
</div>

<div class="enterprise-volume-item enterprise-volume-total">
  <strong>${totalRequests}</strong>
  <span>Total Requests</span>
</div>
    
          </div>
        `;
      }
    }

    toggleClearButton(stats.total);
    updateUI(stats, null);
    updateSystemInsights(records, stats);
    updateTrend(stats, previousStats);
    updateRecentActivity(records);
    updateGlobalRiskMeter(stats);
    updateSecurityCenterCard();

    if (analyticsSummary) {
      setText(
        'globalRiskPercent',
        (analyticsSummary.global_risk_score || 0) + '%'
      );
    
      setText(
        'globalRiskStatus',
        analyticsSummary.global_risk_level || 'Monitoring'
      );
    
      setText(
        'highRiskRateText',
        'High-risk rate: ' + (analyticsSummary.high_risk_rate || 0) + '%'
      );
    
      setText(
        'globalActionText',
        'Recommended action: ' +
          (
            analyticsSummary.global_risk_level === 'Critical'
              ? 'Immediate review required'
              : analyticsSummary.global_risk_level === 'Elevated'
              ? 'Increase review controls'
              : 'Continue monitoring'
          )
      );
    } else if (window.aiTrustSecurityCenter) {
      setText('globalRiskPercent', (window.aiTrustSecurityCenter.high_risk_rate || 0) + '%');
      setText('globalRiskStatus', window.aiTrustSecurityCenter.security_status || 'Monitoring');
      setText('highRiskRateText', 'High-risk rate: ' + (window.aiTrustSecurityCenter.high_risk_rate || 0) + '%');
      setText('globalActionText', 'Recommended action: ' + (window.aiTrustSecurityCenter.priority || 'Monitor'));
    }
    updateConnectedModules();
    updateThreatTicker(records, stats);
    updateDashboardTimeline(records);
    renderAnalyticsCharts(
      stats,
      records
    );
    updateTotalChecksLastEventTime(records);
    triggerTotalChecksPulse(stats.total);

    localStorage.setItem(aiTrustScopedKey('aiTrustOsPrevStats'), JSON.stringify(stats));
    setText(
      'dashboardSyncTime',
      `Last sync: ${new Date().toLocaleTimeString()}`
    );

    console.log('Dashboard updated:', stats);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const savedPolicy = JSON.parse(localStorage.getItem(aiTrustScopedKey('aiTrustOsAgentPermissions')) || '{}');

    if (!window.aiAgentConfig) window.aiAgentConfig = {};

    window.aiAgentConfig.masterEnabled = savedPolicy.masterAI !== false;
    window.aiAgentConfig.strictMode = savedPolicy.strictMode === true;
    window.aiAgentConfig.autoAction = savedPolicy.autoAction === true;
    window.aiAgentConfig.approvalRequired = savedPolicy.approvalRequired !== false;

    const autoToggle = document.getElementById('autoActionToggle');

    if (autoToggle) {
      autoToggle.checked = window.aiAgentConfig.autoAction;

      autoToggle.addEventListener('change', function () {
        if (!window.aiAgentConfig) window.aiAgentConfig = {};

        window.aiAgentConfig.autoAction = this.checked;

        const currentPolicy = JSON.parse(localStorage.getItem(aiTrustScopedKey('aiTrustOsAgentPermissions')) || '{}');
        currentPolicy.autoAction = this.checked;
        localStorage.setItem(aiTrustScopedKey('aiTrustOsAgentPermissions'), JSON.stringify(currentPolicy));

        runDashboard();
      });
    }

    document.addEventListener('click', function (event) {
      const clearBtn = event.target.closest('#clearActivityBtn');
      if (!clearBtn) return;

      event.preventDefault();
      openClearModal();
    });

    runDashboard();
  });
// FORCE CONNECT CLEAR BUTTON TO MODAL
document.addEventListener('DOMContentLoaded', function () {

  const btn = document.getElementById('clearActivityBtn');

  if (btn) {
    btn.onclick = function () {
      const modal = document.getElementById('clearActivityModal');
      if (modal) modal.style.display = 'flex';
    };
  }

});
// LIVE blinking dot
setInterval(function () {
  const dot = document.getElementById('liveDot');
  if (!dot) return;

  dot.style.opacity = dot.style.opacity === '0.3' ? '1' : '0.3';
}, 700);

window.addEventListener('aiTrustOsActivityUpdated', function () {
  runDashboard();
});

  setInterval(runDashboard, 3000);
  setInterval(function () {
    updateTotalChecksLastEventTime(window.latestDashboardRecords || []);
}, 1000);
function triggerTotalChecksPulse(total) {
    const card = document.getElementById('totalChecks')?.closest('.kpi-card');
    if (!card) return;

    const previousTotal = Number(window.previousDashboardTotal || 0);

    if (total > previousTotal) {
        card.classList.remove('kpi-new-event-pulse');

        void card.offsetWidth;

        card.classList.add('kpi-new-event-pulse');
    }

    window.previousDashboardTotal = total;
}

function updateTotalChecksLastEventTime(records) {
  const el = document.getElementById('totalChecksUpdated');
  if (!el) return;

  if (!records || records.length === 0) {
      el.textContent = 'No activity yet';
      return;
  }

  const latestRecord = records
      .slice()
      .sort(function (a, b) {
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      })[0];

  if (!latestRecord || !latestRecord.timestamp) {
      el.textContent = 'No recent activity';
      return;
  }

  el.textContent = 'Updated ' + formatTimeAgo(latestRecord.timestamp);
}

function formatTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return diffSeconds + 's ago';
  if (diffMinutes < 60) return diffMinutes + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';

  return then.toLocaleDateString();
}

fetchSecurityCenter();

setInterval(function () {
  fetchSecurityCenter();
}, 5000);
})();