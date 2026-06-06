(function () {
    'use strict';
  
    // Email Risk Master Module
    // Plain browser-side email intelligence with explainable rules, history, and exports.
  
    const STORAGE_KEY = aiTrustScopedKey('aiTrustOsEmailRiskActivity');
    const ACTION_OPTIONS = [
      'Suggested',
      'Blocked',
      'Monitored',
      'Allowed',
      'Blocked (AI)',
      'Challenged (AI)',
      'Monitored (AI)',
      'Allowed (AI)'
    ];
  
    const CONFIG = {
      suspiciousKeywords: [
        'test',
        'fake',
        'spam',
        'bot',
        'temp',
        'disposable',
        'demo',
        'fraud',
        'abuse',
        'root',
        'null',
        'guest',
        'anonymous'
      ],
      disposableDomains: [
        'temp-mail.org',
        '10minutemail.com',
        'guerrillamail.com',
        'mailinator.com',
        'yopmail.com',
        'trashmail.com',
        'fakeinbox.com',
        'sharklasers.com',
        'getnada.com',
        'dispostable.com'
      ],
      roleLocalParts: ['admin', 'support', 'info', 'sales', 'contact'],
      suspiciousTlds: ['top', 'xyz', 'click', 'gq', 'work', 'support'],
      freeProviders: [
        'gmail.com',
        'googlemail.com',
        'yahoo.com',
        'yahoo.co.uk',
        'outlook.com',
        'hotmail.com',
        'live.com',
        'msn.com',
        'aol.com',
        'icloud.com',
        'proton.me',
        'protonmail.com',
        'gmx.com',
        'mail.com',
        'yandex.com'
      ],
      disposableDomains: [
        'mailinator.com',
        'guerrillamail.com',
        'guerrillamailblock.com',
        'guerrillamail.info',
        'guerrillamail.biz',
        'sharklasers.com',
        'grr.la',
        'yopmail.com',
        'yopmail.net',
        'yopmail.fr',
        '10minutemail.com',
        '10minutemail.net',
        'temp-mail.org',
        'tempmail.com',
        'tempail.com',
        'getnada.com',
        'maildrop.cc',
        'dispostable.com',
        'throwawaymail.com',
        'trashmail.com'
      ]
    };
  
    const SETS = {
      suspiciousTlds: new Set(CONFIG.suspiciousTlds),
      freeProviders: new Set(CONFIG.freeProviders),
      disposableDomains: new Set(CONFIG.disposableDomains)
    };
  
    const state = {
      initialized: false,
      loading: false,
      latestResult: null,
      activity: []
    };
  
    const dom = {};
  
    // Small helper so the code stays beginner-friendly and readable.
    function el(id) {
      return document.getElementById(id);
    }
  
    function setText(node, value) {
      if (node) node.textContent = value;
    }
  
    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }
  
    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function capitalize(value) {
      const text = String(value || '');
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
    }
  
    function fileTimestamp(date) {
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('') + '-' + [
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0'),
        String(date.getSeconds()).padStart(2, '0')
      ].join('');
    }
  
    function formatTimestamp(value) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
    }
  
    function formatSeverity(severity) {
      if (severity === 'high') return 'High';
      if (severity === 'medium') return 'Medium';
      if (severity === 'info') return 'Info';
      return 'Low';
    }
  
    function formatScoreImpact(value) {
      const amount = Number(value || 0);
      if (amount > 0) return '+' + amount;
      if (amount < 0) return String(amount);
      return '0';
    }
  
    function formatDomainType(value) {
      if (value === 'abuse-heavy-tld') return 'Abuse-heavy TLD';
      if (value === 'custom') return 'Custom';
      if (value === 'public') return 'Public';
      if (value === 'disposable') return 'Disposable';
      return 'Unknown';
    }
  
    function riskTone(riskLabel) {
      if (riskLabel === 'High Risk') return 'high';
      if (riskLabel === 'Medium Risk') return 'medium';
      return 'low';
    }
  
    function decisionTone(decision) {
      if (decision === 'Block') return 'block';
      if (decision === 'Challenge') return 'challenge';
      if (decision === 'Monitor') return 'monitor';
      return 'allow';
    }
  
    function percentage(part, total) {
      return total ? Math.round((part / total) * 100) : 0;
    }
  
    function getTld(domain) {
      const parts = String(domain || '').toLowerCase().split('.').filter(Boolean);
      return parts.length > 1 ? parts[parts.length - 1] : '';
    }
  
    function createId(seed) {
      return 'email-' + Math.random().toString(36).slice(2, 8) + '-' + String(seed || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-10);
    }
  
    function getMostCommonValue(values) {
      if (!values.length) return '';
      const counts = new Map();
      values.forEach((value) => {
        const item = value || 'Unknown';
        counts.set(item, (counts.get(item) || 0) + 1);
      });
      let winner = '';
      let highest = 0;
      counts.forEach((count, value) => {
        if (count > highest) {
          highest = count;
          winner = value;
        }
      });
      return winner;
    }

    function getBackendEmailRiskEvents() {
      const records = Array.isArray(window.latestDashboardRecords)
        ? window.latestDashboardRecords
        : [];

      return records
        .filter(function (item) {
          const moduleName = String(
            item.moduleName ||
            item.module ||
            ''
          ).toLowerCase();

          return moduleName.includes('email');
        })
        .map(function (item) {
          const emailValue =
            item.email ||
            item.rawEmail ||
            item.value ||
            (
              item.raw_event &&
              (
                item.raw_event.email ||
                item.raw_event.rawEmail
              )
            ) ||
            'backend-email-event@example.com';

          const parsedResult = parseEmailInput(emailValue);
          const parsed =
            parsedResult && parsedResult.valid
              ? parsedResult.parsed
              : null;

          const domain = parsed
            ? parsed.domain
            : String(emailValue).split('@')[1] || 'unknown.com';

          const providerType =
            parsed ? parsed.providerType : inferProviderType(domain);

          const tld =
            parsed ? parsed.tld : getTld(domain);

          const domainType =
            parsed ? parsed.domainType : inferDomainType(domain, providerType, tld);

          const riskLabel =
            item.riskLabel ||
            item.riskLevel ||
            item.risk_level ||
            'Low Risk';

          const score =
            Number(item.score || item.riskScore || 0);

          return {
            id: String(item.id || item.event_id || createId(emailValue)),
            timestamp: item.timestamp || new Date().toISOString(),
            rawEmail: emailValue,
            normalizedEmail: parsed ? parsed.normalizedEmail : emailValue,
            username: parsed ? parsed.username : String(emailValue).split('@')[0],
            domain: domain,
            tld: tld,
            providerType: providerType,
            domainType: domainType,
            score: score,
            riskLabel: riskLabel,
            decision:
              item.decision ||
              defaultDecisionFromRisk(riskLabel),
            confidence:
              item.confidence === 95 ||
              item.confidence === 'High'
                ? 95
                : Number(item.confidence || 70),
            action:
              riskLabel === 'High Risk'
                ? 'Blocked (AI)'
                : riskLabel === 'Medium Risk'
                ? 'Monitored (AI)'
                : 'Allowed (AI)',
            actionSource: 'Backend',
            breakdown: [],
            signals: {
              identity: [],
              provider: [],
              pattern: [],
              engine: [
                {
                  title: 'Backend Email Risk event',
                  status: riskLabel,
                  detail: 'This event was generated by backend API or SherGuard self-protection.',
                  scoreImpact: score,
                  severity:
                    riskLabel === 'High Risk'
                      ? 'high'
                      : riskLabel === 'Medium Risk'
                      ? 'medium'
                      : 'low'
                }
              ]
            },
            riskReasons:
              Array.isArray(item.reasons)
                ? item.reasons
                : Array.isArray(item.riskReasons)
                ? item.riskReasons
                : [],
            verification: buildVerificationStatus({
              domainType: domainType,
              riskReasons:
                Array.isArray(item.reasons)
                  ? item.reasons
                  : []
            }),
            domainReputation: buildDomainReputation({
              domainType: domainType,
              providerType: providerType
            }),
            behavioralRisk: {
              velocity: 'Backend Synced',
              behavior: riskLabel,
              repeatedDomains: 0,
              recentHighRiskEvents: 0
            },
            backendSynced: true,
            backendModule: 'Email Risk Intelligence'
          };
        });
    }


    function getCombinedEmailActivity() {
      const combined = []
        .concat(state.activity || [])
        .concat(getBackendEmailRiskEvents());

      const seen = new Set();

      return combined
        .filter(function (item) {
          const key = String(
            item.event_id ||
            item.id ||
            item.timestamp + '-' + item.rawEmail + '-' + item.score
          );

          if (seen.has(key)) return false;

          seen.add(key);
          return true;
        })
        .sort(sortNewestFirst);
    }
  
    // Cache the DOM once so we do not keep querying the page repeatedly.
    function cacheDom() {
      dom.section = el('email-risk');
      if (!dom.section) return false;
  
      Object.assign(dom, {
        form: el('emailRiskForm'),
        input: el('emailInput'),
        checkButton: el('emailCheckButton'),
        autoAction: el('emailAutoAction'),
        autoActionState: el('emailAutoActionState'),
        formMessage: el('emailFormMessage'),
        copyResultButton: el('emailCopyResultButton'),
        exportCsvButton: el('emailExportCsvButton'),
        clearHistoryButton: el('emailClearHistoryButton'),
  
        kpiTotal: el('emailKpiTotal'),
        kpiHigh: el('emailKpiHigh'),
        kpiMedium: el('emailKpiMedium'),
        kpiLow: el('emailKpiLow'),
  
        scoreRing: el('emailScoreRing'),
        scoreRingValue: el('emailScoreRingValue'),
  
        profileRaw: el('emailProfileRaw'),
        profileNormalized: el('emailProfileNormalized'),
        profileUsername: el('emailProfileUsername'),
        profileDomain: el('emailProfileDomain'),
        profileProviderType: el('emailProfileProviderType'),
        profileDomainType: el('emailProfileDomainType'),
        profileScore: el('emailScore'),
        profileRisk: el('emailRiskLevel'),
        profileDecision: el('emailDecision'),
        profileConfidence: el('emailConfidence'),
  
        identitySignals: el('emailIdentitySignals'),
        providerSignals: el('emailProviderSignals'),
        patternSignals: el('emailPatternSignals'),
        engineSignals: el('emailEngineSignals'),
  
        breakdownBody: el('emailBreakdownBody'),
  
        searchInput: el('emailSearchInput'),
        riskFilter: el('emailRiskFilter'),
        sortOrder: el('emailSortOrder'),
        filterCount: el('emailFilterCount'),
        activityBody: el('emailActivityBody'),
  
        insightMostDomain: el('emailInsightMostDomain'),
        insightMostRisk: el('emailInsightMostRisk'),
        insightHighPct: el('emailInsightHighPct'),
        insightFreePct: el('emailInsightFreePct'),
        insightLastEmail: el('emailInsightLastEmail'),
        insightText: el('emailInsightText')
      });
  
      return true;
    }
  
    // Main startup function.
function init() {
  if (state.initialized || !cacheDom()) return;

  bindEvents();

  state.activity = loadHistory().sort(sortNewestFirst);
  state.latestResult = state.activity[0] || null;

  const savedAutoAction = localStorage.getItem('emailRiskAutoAction');

  if (dom.autoAction && savedAutoAction !== null) {
    dom.autoAction.checked = savedAutoAction === 'true';
  }

  if (state.latestResult) {
    renderResult(state.latestResult);
    showMessage('Loaded saved Email Risk history.', 'info');
  } else {
    renderWaitingState();
    showMessage('Waiting for the first check.', 'info');
  }

  renderAnalytics();
  renderActivityTable();
  updateAutoActionState();

  state.initialized = true;
}
  
    function bindEvents() {
      if (dom.form) dom.form.addEventListener('submit', handleSubmit);
      if (dom.copyResultButton) dom.copyResultButton.addEventListener('click', handleCopyResult);
      if (dom.exportCsvButton) dom.exportCsvButton.addEventListener('click', exportCsv);
      if (dom.clearHistoryButton) dom.clearHistoryButton.addEventListener('click', clearHistory);
      if (dom.searchInput) dom.searchInput.addEventListener('input', renderActivityTable);
      if (dom.riskFilter) dom.riskFilter.addEventListener('change', renderActivityTable);
      if (dom.sortOrder) dom.sortOrder.addEventListener('change', renderActivityTable);
      if (dom.autoAction) {
        dom.autoAction.addEventListener('change', function () {
          localStorage.setItem('emailRiskAutoAction', String(dom.autoAction.checked));
          updateAutoActionState();
        });
      }
      if (dom.activityBody) dom.activityBody.addEventListener('change', handleActivityActionChange);
  
      window.addEventListener('storage', function (event) {
        if (event.key !== STORAGE_KEY) return;
        state.activity = loadHistory().sort(sortNewestFirst);
        state.latestResult = state.activity[0] || state.latestResult;
        renderAnalytics();
        renderActivityTable();
      });
    }
  
    function showMessage(message, tone) {
      if (!dom.formMessage) return;
      dom.formMessage.textContent = message;
      dom.formMessage.className = 'email-helper-text email-helper-text--' + tone;
    }
  
    function setLoading(isLoading) {
      state.loading = isLoading;
      if (dom.checkButton) {
        dom.checkButton.disabled = isLoading;
        dom.checkButton.textContent = isLoading ? 'Analyzing…' : 'Check Risk';
      }
      if (dom.input) dom.input.disabled = isLoading;
    }
  
    function updateAutoActionState() {
      if (!dom.autoActionState) return;
      const enabled = Boolean(dom.autoAction && dom.autoAction.checked);
      dom.autoActionState.textContent = enabled ? 'ON' : 'OFF';
      dom.autoActionState.className = 'email-toggle-pill__state ' + (enabled ? 'is-on' : 'is-off');
    }
  
    // Form submit: validate, analyze, save, then render.
    function handleSubmit(event) {
      event.preventDefault();
      if (!dom.input) return;
  
      const parsedResponse = parseEmailInput(dom.input.value.trim());
      if (!parsedResponse.valid) {
        showMessage(parsedResponse.error, 'error');
        return;
      }
  
      setLoading(true);
  
      (async function () {
        try {
          const backendResult = await aiTrustApiPost('/analyze/email', {
            email: dom.input.value.trim()
          });
          
          const result = analyzeParsedEmail(
            parsedResponse.parsed,
            Boolean(dom.autoAction && dom.autoAction.checked)
          );
          
          result.event_id = backendResult.event_id;
result.timestamp = backendResult.timestamp;
result.score = backendResult.score;
result.riskLabel = backendResult.risk_level;
result.decision = backendResult.decision;
result.confidence = backendResult.confidence === 'High' ? 95 : 70;

if (result.riskLabel === 'Low Risk') {
  result.riskReasons = [];
} else {
  result.riskReasons = backendResult.reasons || result.riskReasons;
}

result.backendSynced = true;
result.backendModule = backendResult.module;

result.signals = buildSignals(result, {
  breakdown: result.breakdown || [],
  patternRuleCount: (result.breakdown || []).filter(function (item) {
    return item.group === 'pattern' && Number(item.scoreImpact || 0) > 0;
  }).length
});

result.verification = buildVerificationStatus(result);
result.domainReputation = buildDomainReputation(result);
result.behavioralRisk = buildBehavioralRisk(result);
const backendAction = getActionForRisk(
  result.riskLabel,
  Boolean(dom.autoAction && dom.autoAction.checked),
  result.decision
);

result.action = backendAction.action;
result.actionSource = backendAction.actionSource;
      
          state.latestResult = result;
          state.activity.unshift(result);
      
          saveHistory(state.activity);
      
          renderResult(result);
          renderAnalytics();
          renderActivityTable();
      
          if (typeof renderSeverityTimeline === 'function') {
            renderSeverityTimeline();
          }
      
          showMessage('Email Risk analysis completed.', 'success');
        } catch (error) {
          console.error('Email Risk backend analysis failed:', error);
      
          showMessage(
            error && error.message
              ? error.message
              : 'Backend connection failed. Check FastAPI server.',
            'error'
          );

        } finally {
          setLoading(false);
        }
      })();
    }
  
    // Parser layer: turn raw input into structured email fields.
    function parseEmailInput(value) {
      const rawEmail = String(value || '').trim();
      const error = validateEmailSyntax(rawEmail);
  
      if (error) {
        return { valid: false, error };
      }
  
      const atIndex = rawEmail.lastIndexOf('@');
      const username = rawEmail.slice(0, atIndex);
      const domain = rawEmail.slice(atIndex + 1).toLowerCase();
      const tld = getTld(domain);
  
      const plusIndex = username.indexOf('+');
      const hasPlusAddress = plusIndex !== -1;
      const usernameBase = hasPlusAddress ? username.slice(0, plusIndex) : username;
      const plusTag = hasPlusAddress ? username.slice(plusIndex + 1) : '';
  
      const isGmailAddress = domain === 'gmail.com';
      const gmailDotAlias = isGmailAddress && usernameBase.includes('.');
  
      let normalizedEmail = username + '@' + domain;
      if (isGmailAddress) {
        const gmailNormalizedBase = usernameBase.toLowerCase().replace(/\./g, '');
        const gmailNormalizedTag = plusTag ? '+' + plusTag.toLowerCase() : '';
        normalizedEmail = gmailNormalizedBase + gmailNormalizedTag + '@' + domain;
      }
  
      const providerType = inferProviderType(domain);
      const domainType = inferDomainType(domain, providerType, tld);
  
      return {
        valid: true,
        parsed: {
          rawEmail,
          normalizedEmail,
          username,
          usernameLower: username.toLowerCase(),
          usernameBase,
          usernameBaseLower: usernameBase.toLowerCase(),
          plusTag,
          hasPlusAddress,
          gmailDotAlias,
          domain,
          tld,
          providerType,
          domainType
        }
      };
    }
  
    // Conservative syntax guardrails for a browser-only product.
    function validateEmailSyntax(rawEmail) {
      if (!rawEmail) return 'Enter an email address.';
      if (rawEmail.length > 320) return 'Email exceeds the practical 320-character guardrail.';
  
      const atMatches = rawEmail.match(/@/g) || [];
      if (atMatches.length !== 1) return 'Email must contain exactly one @ symbol.';
  
      const basicPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!basicPattern.test(rawEmail)) return 'Enter a valid email address.';
  
      const parts = rawEmail.split('@');
      const localPart = parts[0] || '';
      const domain = parts[1] || '';
  
      if (!localPart || !domain) return 'Email must include a username and domain.';
      if (localPart.length > 64) return 'Local part exceeds 64 characters.';
      if (domain.length > 255) return 'Domain exceeds 255 characters.';
      if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return 'Local part has invalid dot placement.';
      if (domain.includes('..')) return 'Domain contains invalid dot placement.';
  
      const labels = domain.split('.');
      for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i];
        if (!label) return 'Domain has an empty label.';
        if (label.length > 63) return 'A domain label exceeds 63 characters.';
        if (!/^[a-zA-Z0-9-]+$/.test(label) || label.startsWith('-') || label.endsWith('-')) {
          return 'Domain labels may only use letters, numbers, and internal hyphens.';
        }
      }
  
      return '';
    }
  
    // Decision engine: run rules, build a result object, and attach action metadata.
    function analyzeParsedEmail(parsed, autoActionEnabled) {
      const breakdown = [];
      const result = {
        id: createId(parsed.rawEmail),
        timestamp: new Date().toISOString(),
        rawEmail: parsed.rawEmail,
        normalizedEmail: parsed.normalizedEmail,
        username: parsed.username,
        domain: parsed.domain,
        tld: parsed.tld,
        providerType: parsed.providerType,
        domainType: parsed.domainType,
        score: 0,
        riskLabel: 'Low Risk',
        decision: 'Allow',
        confidence: 50,
        action: 'Suggested',
        actionSource: 'Manual',
        breakdown,
        signals: { identity: [], provider: [], pattern: [], engine: [] }
      };
  
      const context = {
        parsed,
        breakdown,
        patternRuleCount: 0
      };
  
      runRuleRegistry(context);
  
      const rawScore = breakdown.reduce((total, item) => total + Number(item.scoreImpact || 0), 0);
const score = clamp(rawScore, 0, 100);
      result.score = score;
      result.riskLabel = getRiskLabel(score);
      result.decision = getFinalDecision(result, context);
      result.confidence = getConfidenceScore(result, context);
  
      const derivedAction = getActionForRisk(
        result.riskLabel,
        autoActionEnabled,
        result.decision
      );
      result.action = derivedAction.action;
      result.actionSource = derivedAction.actionSource;
  
      result.signals = buildSignals(result, context);
      result.riskReasons = buildRiskReasons(result);
      result.verification = buildVerificationStatus(result);
      result.domainReputation = buildDomainReputation(result);
      result.behavioralRisk = buildBehavioralRisk(result);

      if (
        result.decision === 'Block' ||
        result.riskLabel === 'High Risk' ||
        Number(result.score || 0) >= 80
      ) {
        result.action = 'Blocked (AI)';
        result.actionSource = 'AI';
      } else if (
        result.decision === 'Monitor' ||
        result.riskLabel === 'Medium Risk'
      ) {
        result.action = 'Monitored (AI)';
        result.actionSource = 'AI';
      } else {
        result.action = 'Allowed (AI)';
        result.actionSource = 'AI';
      }
  
      return result;
    }
  
    // Rule registry: every triggered rule becomes a breakdown item.
function runRuleRegistry(context) {
  const parsed = context.parsed;
  const usernameBaseLower = parsed.usernameBaseLower;
  const cleanedBase = usernameBaseLower.replace(/[^a-z0-9]/g, '');
  const combinedText = (parsed.usernameLower + ' ' + parsed.domain).toLowerCase();

  if (isDisposableDomain(parsed.domain)) {
    addRule(context, {
      code: 'disposable-domain',
      title: 'Disposable domain match',
      group: 'provider',
      severity: 'high',
      scoreImpact: 45,
      reason: 'Domain matched the seeded disposable-domain list.'
    });
    parsed.providerType = 'disposable';
    parsed.domainType = 'disposable';
  }

  if (isRoleBasedLocalPart(usernameBaseLower)) {
    addRule(context, {
      code: 'role-local-part',
      title: 'Role-based local part',
      group: 'identity',
      severity: 'medium',
      scoreImpact: 18,
      reason: 'Username looks like a shared role mailbox instead of a person-linked identity.'
    });
  }

  if (SETS.suspiciousTlds.has(parsed.tld)) {
    addRule(context, {
      code: 'suspicious-tld',
      title: 'Suspicious TLD match',
      group: 'provider',
      severity: 'medium',
      scoreImpact: 12,
      reason: 'Top-level domain is in the configurable abuse-heavy watchlist.'
    });
    parsed.domainType = 'abuse-heavy-tld';
  }

  if (parsed.providerType === 'free') {
    addRule(context, {
      code: 'free-provider',
      title: 'Free/public provider',
      group: 'provider',
      severity: 'low',
      scoreImpact: 6,
      reason: 'Public webmail is legitimate but offers weaker B2B ownership attribution.'
    });
    if (parsed.domainType === 'unknown') parsed.domainType = 'public';
  }

  if (parsed.providerType === 'business') {
    addRule(context, {
      code: 'custom-domain-credit',
      title: 'Custom/business domain',
      group: 'provider',
      severity: 'low',
      scoreImpact: -8,
      reason: 'Custom domains earn a small trust credit because ownership attribution is stronger.'
    });
  }

  if (parsed.hasPlusAddress) {
    addRule(context, {
      code: 'plus-addressing',
      title: 'Plus-addressing detected',
      group: 'provider',
      severity: 'low',
      scoreImpact: 6,
      reason: 'Address includes a +detail segment, which is useful for one-off or segmented registrations.'
    });
  }

  if (parsed.gmailDotAlias) {
    addRule(context, {
      code: 'gmail-dot-alias',
      title: 'Gmail dot-alias normalization',
      group: 'provider',
      severity: 'info',
      scoreImpact: 0,
      reason: 'Dots in gmail.com usernames are normalized for deduplication only.'
    });
  }

  const matchedKeywords = CONFIG.suspiciousKeywords.filter((keyword) => combinedText.includes(keyword));
  if (matchedKeywords.length > 0) {
    addRule(context, {
      code: 'suspicious-keywords',
      title: 'Suspicious keywords',
      group: 'pattern',
      severity: 'high',
      scoreImpact: 55,
      reason: 'Matched keyword(s): ' + matchedKeywords.join(', ') + '.'
    });
  }

  if (/(.)\1{2,}/.test(cleanedBase)) {
    addRule(context, {
      code: 'repeated-characters',
      title: 'Repeated characters',
      group: 'pattern',
      severity: 'low',
      scoreImpact: 8,
      reason: 'Username contains repeated characters, which often appear in synthetic or throwaway strings.'
    });
  }

  const digitCount = (cleanedBase.match(/\d/g) || []).length;
  const digitRatio = cleanedBase ? digitCount / cleanedBase.length : 0;
  if (digitCount >= 3 && digitRatio >= 0.35) {
    addRule(context, {
      code: 'high-digit-density',
      title: 'High digit density',
      group: 'pattern',
      severity: 'medium',
      scoreImpact: 10,
      reason: 'Username has a high concentration of numbers.'
    });
  }
  if (/(\d)\1{3,}/.test(cleanedBase) || /\d{5,}/.test(cleanedBase)) {
    addRule(context, {
      code: 'sequential-number-pattern',
      title: 'Sequential/fake signup pattern',
      group: 'pattern',
      severity: 'medium',
      scoreImpact: 18,
      reason: 'Username contains long or repeated number patterns commonly seen in automated registrations.'
    });
  }

  if (cleanedBase.length > 0 && cleanedBase.length <= 3) {
    addRule(context, {
      code: 'very-short-local-part',
      title: 'Very short local part',
      group: 'pattern',
      severity: 'low',
      scoreImpact: 8,
      reason: 'Very short usernames provide weak person-level attribution.'
    });
  }

  const safeHumanPattern =
  /^[a-z]+([._-][a-z]+)+$/.test(parsed.usernameBaseLower);

  if (
    !safeHumanPattern &&
    looksGibberish(parsed.usernameBaseLower)
  ) {
    addRule(context, {
      code: 'gibberish-local-part',
      title: 'Gibberish/random-looking email pattern',
      group: 'pattern',
      severity: 'high',
      scoreImpact: 45,
      reason: 'Username looks algorithmic, random, or weakly human-readable.'
    });
  
    if (parsed.providerType === 'business') {
      addRule(context, {
        code: 'gibberish-custom-domain-combo',
        title: 'Random username on custom domain',
        group: 'pattern',
        severity: 'medium',
        scoreImpact: 18,
        reason: 'Random-looking username on a custom domain needs extra review because mailbox and domain reputation cannot be verified in the browser.'
      });
    }
  }
if (
  !safeHumanPattern &&
  looksGibberish(parsed.usernameBaseLower) &&
  parsed.domainType === 'Custom'
) {
  addRule(context, {
    code: 'gibberish-custom-domain-combo',
    title: 'Random username on custom domain',
    group: 'pattern',
    severity: 'medium',
    scoreImpact: 18,
    reason: 'Random-looking username on a custom domain needs extra review because mailbox and domain reputation cannot be verified in the browser.'
  });
}

  if (context.patternRuleCount >= 2) {
    addRule(context, {
      code: 'pattern-cluster',
      title: 'Multiple pattern hits',
      group: 'engine',
      severity: 'medium',
      scoreImpact: 10,
      reason: 'Two or more pattern anomalies appeared together, which raises overall confidence in the risk signal.'
    });
  }
}
  
    function addRule(context, rule) {
      context.breakdown.push({
        code: rule.code,
        title: rule.title,
        group: rule.group,
        severity: rule.severity,
        scoreImpact: rule.scoreImpact,
        reason: rule.reason
      });
  
      if (rule.group === 'pattern' && Number(rule.scoreImpact) > 0) {
        context.patternRuleCount += 1;
      }
    }
  
    function getRiskLabel(score) {
      if (score >= 70) return 'High Risk';
if (score >= 35) return 'Medium Risk';
      return 'Low Risk';
    }
  
    function getFinalDecision(result, context) {
      const breakdown = context.breakdown;
      const providerHighHit = breakdown.some((item) => item.group === 'provider' && item.severity === 'high' && item.scoreImpact > 0);
      const disposableHit = breakdown.some(
        (item) => item.code === 'disposable-domain'
      );
      const mediumOrHigherHits = breakdown.filter((item) => (item.severity === 'medium' || item.severity === 'high') && item.scoreImpact > 0).length;
      const patternHits = breakdown.filter((item) => item.group === 'pattern' && item.scoreImpact > 0).length;
      const roleMailboxDetected = breakdown.some(
        (item) => item.code === 'role-local-part'
      );
  
      if (result.riskLabel === 'Low Risk') {

        if (roleMailboxDetected) {
          return 'Monitor';
        }
      
        return 'Allow';
      }
  
      if (result.riskLabel === 'Medium Risk') {

        if (disposableHit) {
          return 'Challenge';
        }
      
        return providerHighHit || mediumOrHigherHits >= 3 || patternHits >= 3
          ? 'Challenge'
          : 'Monitor';
      }
  
      if (
        disposableHit ||
        providerHighHit ||
        patternHits >= 4 ||
        result.score >= 95 ||
        mediumOrHigherHits >= 4
      ) {
        return 'Block';
      }
      
      return 'Challenge';
    }
  
    function getConfidenceScore(result, context) {
      const positiveHits = context.breakdown.filter((item) => item.scoreImpact > 0);
      const strongHits = positiveHits.filter((item) => item.scoreImpact >= 18).length;
      const categoryCoverage = new Set(
        positiveHits
          .filter((item) => item.group !== 'engine')
          .map((item) => item.group)
      ).size;
  
      let confidence = 54;
      confidence += Math.min(18, strongHits * 6);
      confidence += Math.min(12, categoryCoverage * 4);
      confidence += Math.min(10, context.patternRuleCount * 2);
  
      if (result.riskLabel === 'High Risk') confidence += 8;
      if (result.riskLabel === 'Medium Risk') confidence += 4;
      if (result.score === 0) confidence += 4;
      if (positiveHits.length === 0) confidence -= 4;
      const disposableDetected = positiveHits.some(
        (item) => item.code === 'disposable-domain'
      );
      
      if (disposableDetected) {
        confidence += 10;
      }
      
      if (strongHits >= 3) {
        confidence += 6;
      }
      
      if (categoryCoverage >= 3) {
        confidence += 5;
      }
  
      return clamp(Math.round(confidence), 52, 97);
    }
  
    function buildSignals(result, context) {
      const groups = { identity: [], provider: [], pattern: [], engine: [] };
  
      context.breakdown.forEach((item) => {
        const target = groups[item.group] || groups.engine;
        target.push({
          title: item.title,
          status: item.scoreImpact < 0 ? 'Trust credit' : item.scoreImpact === 0 ? 'Informational' : 'Triggered',
          detail: item.reason,
          scoreImpact: item.scoreImpact,
          severity: item.severity
        });
      });
  
      groups.engine.push({
        title: 'Risk score generated',
        status: result.riskLabel,
        detail: 'Final score is ' + result.score + ' points.',
        scoreImpact: 0,
        severity: result.riskLabel === 'High Risk' ? 'high' : result.riskLabel === 'Medium Risk' ? 'medium' : 'low'
      });
  
      groups.engine.push({
        title: 'Decision engine',
        status: result.decision,
        detail: 'Decision output is ' + result.decision + ' based on rule composition.',
        scoreImpact: 0,
        severity: result.decision === 'Block' ? 'high' : result.decision === 'Challenge' ? 'medium' : 'low'
      });
  
      groups.engine.push({
        title: 'Confidence heuristic',
        status: result.confidence + '%',
        detail: 'Confidence is derived from rule agreement and signal strength, not mailbox verification.',
        scoreImpact: 0,
        severity: 'low'
      });
  
      return groups;
    }

    function buildRiskReasons(result) {

      const reasons = [];
    
      (result.breakdown || []).forEach((item) => {
    
        if (item.scoreImpact <= 0) return;
    
        reasons.push(item.title);
      });
    
      return reasons.slice(0, 4);
    }

    function buildVerificationStatus(result) {
  return {
    syntax: 'Valid',
    domain: result.domainType === 'disposable' ? 'Disposable domain detected' : 'Domain format valid',
    disposable: result.domainType === 'disposable' ? 'Detected' : 'Not detected',
    pattern: result.riskReasons && result.riskReasons.length ? 'Suspicious pattern found' : 'No major pattern risk',
    mailbox: 'Backend/API required',
    socialPresence: 'Backend/API required',
    age: 'Backend/API required'
  };
}

function buildDomainReputation(result) {
  if (result.domainType === 'disposable') {
    return {
      level: 'Poor',
      trustTier: 'High Risk Provider',
      explanation: 'This domain is linked to temporary or disposable inbox behavior.'
    };
  }

  if (result.providerType === 'free') {
    return {
      level: 'Moderate',
      trustTier: 'Public Email Provider',
      explanation: 'Public email providers are common and valid, but weaker for business identity trust.'
    };
  }

  if (result.providerType === 'business') {
    return {
      level: 'Strong',
      trustTier: 'Business Domain',
      explanation: 'Custom business domains usually provide stronger identity ownership signals.'
    };
  }

  return {
    level: 'Unknown',
    trustTier: 'Unverified Domain',
    explanation: 'Domain reputation requires backend/API enrichment for stronger confidence.'
  };
}

function buildBehavioralRisk(result) {

  const sameDomainCount = state.activity.filter(
    (item) => item.domain === result.domain
  ).length;

  const highRiskBurst = state.activity.filter(
    (item) => item.riskLabel === 'High Risk'
  ).length;

  let velocity = 'Normal';
  let behavior = 'Stable';

  if (sameDomainCount >= 3) {
    velocity = 'Repeated Domain Activity';
  }

  if (highRiskBurst >= 5) {
    behavior = 'Elevated Threat Activity';
  }

  return {
    velocity,
    behavior,
    repeatedDomains: sameDomainCount,
    recentHighRiskEvents: highRiskBurst
  };
}
  
function getActionForRisk(riskLabel, autoActionEnabled, decision) {
  if (!autoActionEnabled) {
    return {
      action: 'Suggested',
      actionSource: 'Manual'
    };
  }

  if (riskLabel === 'High Risk') {
    return {
      action: 'Blocked (AI)',
      actionSource: 'AI'
    };
  }

  if (riskLabel === 'Medium Risk') {
    if (
      decision &&
      decision.toLowerCase().indexOf('challenge') !== -1
    ) {
      return {
        action: 'Challenged (AI)',
        actionSource: 'AI'
      };
    }

    return {
      action: 'Monitored (AI)',
      actionSource: 'AI'
    };
  }

  return {
    action: 'Allowed (AI)',
    actionSource: 'AI'
  };
}
  
    // Waiting state used before the first successful check.
    function renderWaitingState() {
      setText(dom.profileRaw, 'Waiting');
      setText(dom.profileNormalized, 'Waiting');
      setText(dom.profileUsername, 'Waiting');
      setText(dom.profileDomain, 'Waiting');
      setText(dom.profileProviderType, 'Waiting');
      setText(dom.profileDomainType, 'Waiting');
      setText(dom.profileScore, '—');
      setText(dom.profileRisk, 'Waiting');
      setText(dom.profileDecision, 'Waiting');
      setText(dom.profileConfidence, '—');
  
      if (dom.scoreRing) dom.scoreRing.setAttribute('data-risk', 'low');
      updateScoreRing(0);
  
      renderSignalGroup(dom.identitySignals, []);
      renderSignalGroup(dom.providerSignals, []);
      renderSignalGroup(dom.patternSignals, []);
      renderSignalGroup(dom.engineSignals, []);
      renderBreakdown([]);
    }

    function renderDecisionBanner(result) {

      const banner = document.getElementById('emailDecisionBanner');
    
      if (!banner) return;
    
      let text = '';
      let tone = '';
    
      switch (result.decision) {
    
        case 'Block':
          text = 'Recommended Action: BLOCK SIGNUP — High confidence abuse indicators detected.';
          tone = 'block';
          break;
    
        case 'Challenge':
          text = 'Recommended Action: CHALLENGE USER — Additional verification recommended.';
          tone = 'challenge';
          break;
    
        case 'Monitor':
          text = 'Recommended Action: ALLOW WITH MONITORING — Moderate suspicious activity detected.';
          tone = 'monitor';
          break;
    
        default:
          text = 'Recommended Action: ALLOW USER — No major abuse signals detected.';
          tone = 'allow';
      }
    
      banner.className =
        `email-decision-banner email-decision-banner--${tone}`;
    
      banner.textContent = text;
    }
  
    function renderRiskValue(node, value, riskLabel) {
      if (!node) return;
      node.textContent = value;
      node.className = 'email-profile-value email-value-pill email-value-pill--' + riskTone(riskLabel);
    }
  
    function renderDecisionValue(node, value) {
      if (!node) return;
      node.textContent = value;
      node.className = 'email-profile-value email-value-pill email-value-pill--decision-' + decisionTone(value);
    }
  
    function updateScoreRing(score) {
      if (dom.scoreRing) {
        const percent = clamp(Number(score || 0), 0, 100);
        dom.scoreRing.style.setProperty('--email-score', String(percent));
        dom.scoreRing.setAttribute('aria-label', 'Risk score ' + percent + ' out of 100');
      }
      if (dom.scoreRingValue) {
        dom.scoreRingValue.textContent = String(Math.max(0, Math.round(Number(score || 0))));
      }
    }
  
    // Renderer layer: update the profile card, signals, score ring, and breakdown table.
    function renderResult(result) {
      if (!result) {
        renderWaitingState();
        return;
      }
  
      setText(dom.profileRaw, result.rawEmail);
      setText(dom.profileNormalized, result.normalizedEmail);
      setText(dom.profileUsername, result.username);
      setText(dom.profileDomain, result.domain);
      setText(dom.profileProviderType, capitalize(result.providerType));
      setText(dom.profileDomainType, formatDomainType(result.domainType));
      renderRiskValue(dom.profileScore, result.score + ' pts', result.riskLabel);
      renderRiskValue(dom.profileRisk, result.riskLabel, result.riskLabel);
      renderDecisionValue(dom.profileDecision, result.decision);
      renderDecisionBanner(result);
      setText(dom.profileConfidence, result.confidence + '% heuristic');
  
      if (dom.scoreRing) dom.scoreRing.setAttribute('data-risk', riskTone(result.riskLabel));
      updateScoreRing(result.score);
  
      renderSignalGroup(dom.identitySignals, result.signals.identity || []);
renderSignalGroup(dom.providerSignals, result.signals.provider || []);
renderSignalGroup(dom.patternSignals, result.signals.pattern || []);
renderSignalGroup(dom.engineSignals, result.signals.engine || []);

updateSignalCounters(result);
renderRiskReasons(result.riskReasons || []);
renderVerificationStatus(result.verification);
renderDomainReputation(result.domainReputation);
renderBehavioralRisk(result.behavioralRisk);
renderThreatFeed();
renderExplainabilityPanel(result);
renderBreakdown(result.breakdown || []);
    }
  
    function renderSignalGroup(container, items) {
      if (!container) return;
  
      if (!items || items.length === 0) {
        container.innerHTML = '<li class="email-empty-state">Waiting for signals.</li>';
        return;
      }
  
      container.innerHTML = items.map((item) => {
        return (
          '<li class="email-signal-item email-signal-item--' + escapeHtml(item.severity || 'low') + '">' +
            '<div class="email-signal-item__head">' +
              '<strong>' + escapeHtml(item.title) + '</strong>' +
              '<span class="email-signal-item__status">' + escapeHtml(item.status) + '</span>' +
            '</div>' +
            '<div class="email-signal-item__meta">' +
              '<span>' + formatScoreImpact(item.scoreImpact) + '</span>' +
              '<span>' + escapeHtml(formatSeverity(item.severity)) + '</span>' +
            '</div>' +
            '<p>' + escapeHtml(item.detail) + '</p>' +
          '</li>'
        );
      }).join('');
    }

    function updateSignalCounters(result) {

      const identityCount = (result.signals.identity || []).length;
      const providerCount = (result.signals.provider || []).length;
      const patternCount = (result.signals.pattern || []).length;
      const engineCount = (result.signals.engine || []).length;
    
      const totalSignals =
        identityCount +
        providerCount +
        patternCount +
        engineCount;
    
      const counters = document.getElementById('emailSignalCounters');
    
      if (!counters) return;
    
      counters.innerHTML = `
        <div class="email-signal-counter-card">
          <strong>${totalSignals}</strong>
          <span>Total Signals</span>
        </div>
    
        <div class="email-signal-counter-card">
          <strong>${providerCount}</strong>
          <span>Provider</span>
        </div>
    
        <div class="email-signal-counter-card">
          <strong>${patternCount}</strong>
          <span>Pattern</span>
        </div>
    
        <div class="email-signal-counter-card">
          <strong>${identityCount}</strong>
          <span>Identity</span>
        </div>
      `;
    }

    function renderRiskReasons(reasons) {

      const container = document.getElementById('emailRiskReasons');
    
      if (!container) return;
    
      if (!reasons.length) {
        container.innerHTML = `
          <h4>Top Risk Reasons</h4>
          <ul>
            <li>No major risk signals detected.</li>
          </ul>
        `;
        return;
      }
    
      container.innerHTML = `
        <h4>Top Risk Reasons</h4>
        <ul>
          ${reasons.map(reason => `<li>${reason}</li>`).join('')}
        </ul>
      `;
    }

    function renderVerificationStatus(verification) {
      const container = document.getElementById('emailVerificationStatus');
    
      if (!container || !verification) return;
    
      container.innerHTML = `
        <h4>Verification Intelligence</h4>
        <div class="email-verification-grid">
          <div><span>Syntax</span><strong>${verification.syntax}</strong></div>
          <div><span>Domain</span><strong>${verification.domain}</strong></div>
          <div><span>Disposable</span><strong>${verification.disposable}</strong></div>
          <div><span>Pattern</span><strong>${verification.pattern}</strong></div>
          <div><span>Mailbox</span><strong>${verification.mailbox}</strong></div>
          <div><span>Social Presence</span><strong>${verification.socialPresence}</strong></div>
          <div><span>Email Age</span><strong>${verification.age}</strong></div>
        </div>
      `;
    }

    function renderDomainReputation(reputation) {
      const container = document.getElementById('emailDomainReputation');
    
      if (!container || !reputation) return;
    
      container.innerHTML = `
        <h4>Domain Reputation Intelligence</h4>
        <div class="email-domain-reputation-grid">
          <div>
            <span>Reputation Level</span>
            <strong>${reputation.level}</strong>
          </div>
          <div>
            <span>Trust Tier</span>
            <strong>${reputation.trustTier}</strong>
          </div>
          <p>${reputation.explanation}</p>
        </div>
      `;
    }

    function renderBehavioralRisk(behavioralRisk) {
      const container = document.getElementById('emailBehavioralRisk');
    
      if (!container || !behavioralRisk) return;
    
      container.innerHTML = `
        <h4>Behavioral Signup Intelligence</h4>
        <div class="email-behavioral-grid">
          <div>
            <span>Signup Velocity</span>
            <strong>${behavioralRisk.velocity}</strong>
          </div>
          <div>
            <span>Behavior Status</span>
            <strong>${behavioralRisk.behavior}</strong>
          </div>
          <div>
            <span>Repeated Domain Events</span>
            <strong>${behavioralRisk.repeatedDomains}</strong>
          </div>
          <div>
            <span>Recent High-Risk Events</span>
            <strong>${behavioralRisk.recentHighRiskEvents}</strong>
          </div>
        </div>
      `;
    }

    function renderThreatFeed() {

      const container = document.getElementById('emailThreatFeed');
    
      if (!container) return;
    
      const recent = state.activity.slice(0, 6);
    
      if (!recent.length) {
        container.innerHTML = `
          <h4>Real-Time Threat Feed</h4>
          <p>No live threat activity yet.</p>
        `;
        return;
      }
    
      container.innerHTML = `
        <h4>Real-Time Threat Feed</h4>
    
        <div class="email-threat-feed-list">
          ${recent.map(item => {
    
            let message = 'Low-risk signup observed.';
    
            if (item.domainType === 'disposable') {
              message = 'Disposable email signup blocked.';
            } else if (item.riskLabel === 'High Risk') {
              message = 'High-risk signup pattern detected.';
            } else if (item.providerType === 'free') {
              message = 'Public email provider monitored.';
            }
    
            return `
              <div class="email-threat-feed-item">
                <span>${new Date(item.timestamp).toLocaleTimeString()}</span>
                <strong>${message}</strong>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderExplainabilityPanel(result) {
      const container = document.getElementById('emailExplainabilityPanel');
    
      if (!container || !result) return;
    
      const reasons = Array.isArray(result.riskReasons) && result.riskReasons.length
        ? result.riskReasons.join(', ')
        : 'No major abuse indicators detected';
    
      container.innerHTML = `
        <h4>AI Explainability</h4>
        <p><strong>Decision:</strong> ${result.decision}</p>
        <p><strong>Why:</strong> ${reasons}</p>
        <p><strong>Confidence:</strong> ${result.confidence}% based on rule agreement, provider reputation, behavior, and pattern signals.</p>
      `;
    }
  
    function renderBreakdown(items) {
      if (!dom.breakdownBody) return;
  
      if (!items || items.length === 0) {
        dom.breakdownBody.innerHTML = '<tr><td colspan="5" class="email-empty-state">Waiting for rule output.</td></tr>';
        return;
      }
  
      dom.breakdownBody.innerHTML = items.map((item) => {
        return (
          '<tr>' +
            '<td>' + escapeHtml(item.title) + '</td>' +
            '<td>' + escapeHtml(capitalize(item.group)) + '</td>' +
            '<td><span class="email-severity-badge email-severity-badge--' + escapeHtml(item.severity) + '">' + escapeHtml(formatSeverity(item.severity)) + '</span></td>' +
            '<td>' + formatScoreImpact(item.scoreImpact) + '</td>' +
            '<td>' + escapeHtml(item.reason) + '</td>' +
          '</tr>'
        );
      }).join('');
    }
  
    function updateKpis() {
      const activity = getCombinedEmailActivity();

      const total = activity.length;
      const high = activity.filter((item) => item.riskLabel === 'High Risk').length;
      const medium = activity.filter((item) => item.riskLabel === 'Medium Risk').length;
      const low = activity.filter((item) => item.riskLabel === 'Low Risk').length;

      setText(dom.kpiTotal, String(total));
      setText(dom.kpiHigh, String(high));
      setText(dom.kpiMedium, String(medium));
      setText(dom.kpiLow, String(low));

      const averageRisk = total
        ? Math.round(
            activity.reduce((sum, item) => sum + Number(item.score || 0), 0) / total
          )
        : 0;

      setText(el('emailAverageRisk'), averageRisk + ' / 100');

      let trustStatus = 'Stable';

      const highRiskCount = activity.filter(
        (item) => item.riskLabel === 'High Risk'
      ).length;

      const disposableCount = activity.filter(
        (item) =>
          item.providerType === 'disposable' ||
          item.domainType === 'disposable'
      ).length;

      if (highRiskCount >= 5 || disposableCount >= 3) {
        trustStatus = 'Under Attack';
      } else if (highRiskCount >= 3) {
        trustStatus = 'Critical';
      } else if (medium >= 5) {
        trustStatus = 'Elevated';
      }

      setText(el('emailTrustStatus'), trustStatus);
    }
  
    function updateInsights() {
      if (state.activity.length === 0) {
        setText(dom.insightMostDomain, 'None yet');
        setText(dom.insightMostRisk, 'None yet');
        setText(dom.insightHighPct, '0%');
        setText(dom.insightFreePct, '0%');
        setText(dom.insightLastEmail, 'None yet');
        setText(dom.insightText, 'Run the first check to build email intelligence insights.');
        return;
      }
  
      const mostCommonDomain = getMostCommonValue(state.activity.map((item) => item.domain || 'Unknown'));
      const mostCommonRisk = getMostCommonValue(state.activity.map((item) => item.riskLabel || 'Unknown'));
      const highRiskPct = percentage(state.activity.filter((item) => item.riskLabel === 'High Risk').length, state.activity.length);
      const freeProviderPct = percentage(state.activity.filter((item) => item.providerType === 'free').length, state.activity.length);
      const lastChecked = state.activity[0] ? state.activity[0].rawEmail : 'None yet';
  
      setText(dom.insightMostDomain, mostCommonDomain || 'Unknown');
      setText(dom.insightMostRisk, mostCommonRisk || 'Unknown');
      setText(dom.insightHighPct, highRiskPct + '%');
      setText(dom.insightFreePct, freeProviderPct + '%');
      setText(dom.insightLastEmail, lastChecked);
      let insightMessage =
  'History shows ' +
  highRiskPct +
  '% high-risk outcomes and ' +
  freeProviderPct +
  '% free-provider usage across saved checks.';

const disposableCount = state.activity.filter(
  (item) =>
    item.providerType === 'disposable' ||
    item.domainType === 'disposable'
).length;

const highRiskCount = state.activity.filter(
  (item) => item.riskLabel === 'High Risk'
).length;

if (disposableCount >= 3) {
  insightMessage += ' Repeated disposable-email attack patterns detected.';
}

if (highRiskCount >= 5) {
  insightMessage += ' Elevated high-risk signup activity detected.';
}

setText(dom.insightText, insightMessage);
    }
  
    function renderAnalytics() {
      updateKpis();
      updateInsights();
    }
  
    function updateFilterCount(filteredCount, totalCount) {
      if (dom.filterCount) dom.filterCount.textContent = filteredCount + ' shown of ' + totalCount;
    }
  
    function sortNewestFirst(a, b) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
  
    function getFilteredActivity() {
      const searchTerm = dom.searchInput ? dom.searchInput.value.trim().toLowerCase() : '';
      const riskFilter = dom.riskFilter ? dom.riskFilter.value : 'all';
      const sortOrder = dom.sortOrder ? dom.sortOrder.value : 'newest';
  
      let records = getCombinedEmailActivity();
  
      if (riskFilter !== 'all') {
        records = records.filter((item) => String(item.riskLabel || '').toLowerCase() === riskFilter.toLowerCase());
      }
  
      if (searchTerm) {
        records = records.filter((item) => {
          const haystack = [
            item.rawEmail,
            item.normalizedEmail,
            item.domain,
            item.providerType,
            item.riskLabel,
            item.decision,
            item.action,
            item.actionSource
          ].join(' ').toLowerCase();
  
          return haystack.includes(searchTerm);
        });
      }
  
      records.sort((a, b) => {
        switch (sortOrder) {
          case 'oldest':
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          case 'score-desc':
            return Number(b.score || 0) - Number(a.score || 0);
          case 'score-asc':
            return Number(a.score || 0) - Number(b.score || 0);
          case 'email-asc':
            return String(a.rawEmail || '').localeCompare(String(b.rawEmail || ''));
          case 'newest':
          default:
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }
      });
  
      return records;
    }
  
    function renderActionSelect(item) {
      const options = ACTION_OPTIONS.map((option) => {
        const selected = option === item.action ? ' selected' : '';
        return '<option value="' + escapeHtml(option) + '"' + selected + '>' + escapeHtml(option) + '</option>';
      }).join('');
  
      return (
        '<label class="email-visually-hidden" for="emailAction-' + escapeHtml(item.id) + '">Action</label>' +
        '<select class="email-action-select" id="emailAction-' + escapeHtml(item.id) + '" data-record-id="' + escapeHtml(item.id) + '">' +
        options +
        '</select>'
      );
    }

    function renderSeverityTimeline() {

  const container = document.getElementById('emailSeverityTimeline');

  if (!container) return;

  const recent = state.activity.slice(0, 12).reverse();

  if (!recent.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = recent.map((item) => {

    let tone = 'low';

    if (item.riskLabel === 'High Risk') {
      tone = 'high';
    } else if (item.riskLabel === 'Medium Risk') {
      tone = 'medium';
    }

    const height = Math.max(12, item.score);

    return `
      <div
        class="email-severity-bar email-severity-bar--${tone}"
        style="height:${height}%"
        title="${item.rawEmail} • ${item.score}"
      ></div>
    `;
  }).join('');
}
  
    // Activity table renderer with search, filter, sort, and manual action editing.
    function renderActivityTable() {
      if (!dom.activityBody) return;
  
      const filtered = getFilteredActivity();
      updateFilterCount(filtered.length, state.activity.length);
  
      if (filtered.length === 0) {
        const message = state.activity.length > 0
          ? 'No activity matches the current search or filters.'
          : 'No email risk checks saved yet.';
  
        dom.activityBody.innerHTML = '<tr><td colspan="8" class="email-empty-state">' + escapeHtml(message) + '</td></tr>';
        return;
      }
  
      dom.activityBody.innerHTML = filtered.map((item) => {
        return (
          '<tr>' +
            '<td>' + escapeHtml(formatTimestamp(item.timestamp)) + '</td>' +
            '<td class="email-table-email">' + escapeHtml(item.rawEmail) + '</td>' +
            '<td>' + escapeHtml(capitalize(item.providerType)) + '</td>' +
            '<td><span class="email-risk-chip email-risk-chip--' + riskTone(item.riskLabel) + '">' + escapeHtml(item.riskLabel) + '</span></td>' +
            '<td>' + escapeHtml(String(item.score)) + '</td>' +
            '<td><span class="email-decision-chip email-decision-chip--' + decisionTone(item.decision) + '">' + escapeHtml(item.decision) + '</span></td>' +
            '<td>' + renderActionSelect(item) + '</td>' +
            '<td><span class="email-source-chip email-source-chip--' + escapeHtml((item.actionSource || 'Manual').toLowerCase()) + '">' + escapeHtml(item.actionSource || 'Manual') + '</span></td>' +
          '</tr>'
        );
      }).join('');
    }
  
    function handleActivityActionChange(event) {
      const target = event.target;
      if (!target || !target.classList.contains('email-action-select')) return;
  
      const recordId = target.getAttribute('data-record-id');
      const nextAction = target.value;
  
      const record = state.activity.find((item) => item.id === recordId);
      if (!record) return;
  
      record.action = nextAction;
      record.actionSource = nextAction.includes('(AI)') ? 'AI' : 'Manual';
  
      saveHistory(state.activity);
      renderActivityTable();
      showMessage('Action updated for activity log entry.', 'success');
    }
  
    function clearHistory() {
      if (state.activity.length === 0) {
        showMessage('Nothing to clear yet.', 'info');
        return;
      }
    
      if (!window.confirm('Clear all saved Email Risk history?')) return;
    
      state.activity = [];
      state.latestResult = null;
    
      removeStorageKey();
      renderWaitingState();
      renderAnalytics();
      renderActivityTable();
    
      const counters = document.getElementById('emailSignalCounters');
      if (counters) {
        counters.innerHTML = `
          <div class="email-signal-counter-card">
            <strong>0</strong>
            <span>Total Signals</span>
          </div>
          <div class="email-signal-counter-card">
            <strong>0</strong>
            <span>Provider</span>
          </div>
          <div class="email-signal-counter-card">
            <strong>0</strong>
            <span>Pattern</span>
          </div>
          <div class="email-signal-counter-card">
            <strong>0</strong>
            <span>Identity</span>
          </div>
        `;
      }
    
      showMessage('Email Risk history cleared.', 'success');
    }
  
    // Store adapter: load, migrate, and backfill old records from localStorage.
    function loadHistory() {
      let parsed = [];
  
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        parsed = raw ? JSON.parse(raw) : [];
      } catch (error) {
        parsed = [];
      }
  
      if (!Array.isArray(parsed)) return [];
  
      const migrated = parsed.map(migrateRecord).filter(Boolean);
      saveHistory(migrated);
      return migrated;
    }
  
    function saveHistory(records) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (error) {
        // Ignore storage write failures in restricted browsing contexts.
      }
    }
  
    function removeStorageKey() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // Ignore storage removal failures in restricted browsing contexts.
      }
    }
  
    function defaultDecisionFromRisk(riskLabel) {
      if (riskLabel === 'High Risk') return 'Challenge';
      if (riskLabel === 'Medium Risk') return 'Monitor';
      return 'Allow';
    }
  
    function migrateBreakdownItem(item) {
      if (!item || typeof item !== 'object') {
        return {
          code: 'legacy-item',
          title: 'Legacy rule',
          group: 'engine',
          severity: 'low',
          scoreImpact: 0,
          reason: 'Migrated from an older Email Risk history record.'
        };
      }
  
      return {
        code: item.code || createId('legacy-rule'),
        title: item.title || item.rule || 'Legacy rule',
        group: item.group || 'engine',
        severity: item.severity || 'low',
        scoreImpact: Number(item.scoreImpact || item.score || 0),
        reason: item.reason || 'Migrated from an older Email Risk history record.'
      };
    }
  
    function migrateSignals(signals) {
      const safeSignals = signals && typeof signals === 'object' ? signals : {};
  
      function normalizeGroup(group) {
        if (!Array.isArray(group)) return [];
        return group.map((item) => ({
          title: item.title || 'Legacy signal',
          status: item.status || 'Migrated',
          detail: item.detail || item.reason || 'Migrated from an older Email Risk history record.',
          scoreImpact: Number(item.scoreImpact || item.score || 0),
          severity: item.severity || 'low'
        }));
      }
  
      return {
        identity: normalizeGroup(safeSignals.identity),
        provider: normalizeGroup(safeSignals.provider),
        pattern: normalizeGroup(safeSignals.pattern),
        engine: normalizeGroup(safeSignals.engine)
      };
    }
  
    function migrateRecord(record) {
      if (!record || typeof record !== 'object') return null;
  
      const rawEmail = String(record.rawEmail || record.email || '').trim();
      const parsedResult = rawEmail ? parseEmailInput(rawEmail) : null;
      const parsed = parsedResult && parsedResult.valid ? parsedResult.parsed : null;
      const score = Number(record.score || 0);
      const riskLabel = getRiskLabel(score);
      const action = record.action || 'Suggested';
      const actionSource = record.actionSource || (action.includes('(AI)') ? 'AI' : 'Manual');
  
      const domain = record.domain || (parsed ? parsed.domain : ((rawEmail.split('@')[1] || 'unknown.com').toLowerCase()));
      const providerType = record.providerType || inferProviderType(domain);
      const tld = record.tld || getTld(domain);
  
      return {
        id: String(record.id || createId(rawEmail || Date.now())),
        timestamp: record.timestamp || new Date().toISOString(),
        rawEmail: rawEmail || 'unknown@example.com',
        normalizedEmail: record.normalizedEmail || (parsed ? parsed.normalizedEmail : (rawEmail || 'unknown@example.com')),
        username: record.username || (parsed ? parsed.username : (rawEmail.split('@')[0] || 'unknown')),
        domain: domain,
        tld: tld,
        providerType: providerType,
        domainType: record.domainType || inferDomainType(domain, providerType, tld),
        score: score,
        riskLabel: riskLabel,
        decision: record.decision || defaultDecisionFromRisk(riskLabel),
        confidence: Number(record.confidence) ? Number(record.confidence) : clamp(55 + Math.round(score / 4), 52, 97),
        action: action,
        actionSource: actionSource,
        breakdown: Array.isArray(record.breakdown) ? record.breakdown.map(migrateBreakdownItem) : [],
        signals: migrateSignals(record.signals)
      };
    }
  
    function escapeCsvValue(value) {
      const text = String(value == null ? '' : value).replace(/"/g, '""');
      return '"' + text + '"';
    }
  
    // Export only the currently displayed rows so filters/search affect the CSV.
    function exportCsv() {
      const rows = getFilteredActivity();
      if (rows.length === 0) {
        showMessage('There are no rows to export.', 'info');
        return;
      }
  
      const lines = [
        ['timestamp', 'email', 'providerType', 'riskLabel', 'score', 'decision', 'action', 'actionSource'].join(',')
      ];
  
      rows.forEach((item) => {
        lines.push([
          item.timestamp,
          item.rawEmail,
          item.providerType,
          item.riskLabel,
          item.score,
          item.decision,
          item.action,
          item.actionSource
        ].map(escapeCsvValue).join(','));
      });
  
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
  
      link.href = url;
      link.download = 'email-risk-activity-' + fileTimestamp(new Date()) + '.csv';
  
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  
      showMessage('CSV export created for the currently displayed rows.', 'success');
    }
  
    function buildCopyReport(result) {
      const lines = [
        'AI Trust Layer — Email Risk Report',
        'Checked: ' + formatTimestamp(result.timestamp),
        'Email: ' + result.rawEmail,
        'Normalized Email: ' + result.normalizedEmail,
        'Username: ' + result.username,
        'Domain: ' + result.domain,
        'Provider Type: ' + capitalize(result.providerType),
        'Domain Type: ' + formatDomainType(result.domainType),
        'Risk Score: ' + result.score + ' pts',
        'Risk Level: ' + result.riskLabel,
        'Decision: ' + result.decision,
        'Confidence: ' + result.confidence + '% heuristic',
        'Action: ' + result.action,
        'Action Source: ' + result.actionSource,
        '',
        'Triggered Rules:'
      ];
  
      if (!result.breakdown || result.breakdown.length === 0) {
        lines.push('- No rules were triggered.');
      } else {
        result.breakdown.forEach((item) => {
          lines.push(
            '- [' + formatSeverity(item.severity) + ' | ' + capitalize(item.group) + '] ' +
            item.title + ' (' + formatScoreImpact(item.scoreImpact) + '): ' + item.reason
          );
        });
      }
  
      return lines.join('\n');
    }
  
    // Older fallback for non-secure contexts or browsers without navigator.clipboard.
    function fallbackCopyText(text) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
  
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
  
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
  
        return Boolean(success);
      } catch (error) {
        return false;
      }
    }
  
    // Copy the latest report to the clipboard with a safe fallback path.
    async function handleCopyResult() {
      if (!state.latestResult) {
        showMessage('Run a check before copying a result.', 'info');
        return;
      }
  
      const reportText = buildCopyReport(state.latestResult);
  
      try {
        if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(reportText);
          showMessage('Latest email risk report copied to clipboard.', 'success');
          return;
        }
  
        const copied = fallbackCopyText(reportText);
        showMessage(
          copied ? 'Latest email risk report copied using fallback mode.' : 'Clipboard copy is unavailable in this browser context.',
          copied ? 'success' : 'error'
        );
      } catch (error) {
        const copied = fallbackCopyText(reportText);
        showMessage(
          copied ? 'Latest email risk report copied using fallback mode.' : 'Clipboard copy failed in this browser context.',
          copied ? 'success' : 'error'
        );
      }
    }
  
    // Lightweight provider classification used by both new results and migrated history.
    function inferProviderType(domain) {
      if (!domain) return 'unknown';
      if (isDisposableDomain(domain)) return 'disposable';
      if (SETS.freeProviders.has(domain)) return 'free';
      if (domain.includes('.')) return 'business';
      return 'unknown';
    }
  
    function inferDomainType(domain, providerType, tld) {
      if (providerType === 'disposable') return 'disposable';
      if (SETS.suspiciousTlds.has(tld)) return 'abuse-heavy-tld';
      if (providerType === 'free') return 'public';
      if (providerType === 'business') return 'custom';
      return 'unknown';
    }
  
    function isDisposableDomain(domain) {
      if (!domain) return false;
      if (SETS.disposableDomains.has(domain)) return true;
  
      for (const disposable of SETS.disposableDomains) {
        if (domain === disposable || domain.endsWith('.' + disposable)) return true;
      }
  
      return false;
    }
  
    function isRoleBasedLocalPart(localPart) {
      if (!localPart) return false;
      const normalized = localPart.toLowerCase();
      return CONFIG.roleLocalParts.some((role) => new RegExp('^' + role + '([._-].*)?$').test(normalized));
    }
  
    function looksGibberish(localPart) {
      const normalized = String(localPart || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
      if (normalized.length < 8) return false;
    
      const letters = normalized.replace(/[^a-z]/g, '');
      const digits = (normalized.match(/\d/g) || []).length;
      const vowels = (letters.match(/[aeiou]/g) || []).length;
      const vowelRatio = letters.length ? vowels / letters.length : 0;
    
      const consonantRun = /[bcdfghjklmnpqrstvwxyz]{4,}/.test(letters);
      const longRandomText =
  normalized.length >= 12 &&
  vowelRatio < 0.28 &&
  !/[aeiou]{2,}/.test(letters);
      const randomEnding = /[bcdfghjklmnpqrstvwxyz]{3,}$/.test(letters);
      const tooManyDigits = digits >= 4;
    
      return consonantRun || longRandomText || randomEnding || tooManyDigits;
    }

    window.addEventListener('sherguardDashboardEventsSynced', function () {
      renderAnalytics();
      renderActivityTable();
      renderThreatFeed();

      if (typeof renderSeverityTimeline === 'function') {
        renderSeverityTimeline();
      }
    });

    // Start immediately if the DOM is ready, otherwise wait for the page to finish loading.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  