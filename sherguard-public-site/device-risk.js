(function () {
    'use strict';
  
    // Storage keys
var STORAGE_KEY = 'aiTrustOsDeviceRiskActivity';
var AUTO_ACTION_KEY = 'aiTrustOsDeviceRiskAutoAction';
var SCENARIO_KEY = 'aiTrustOsDeviceRiskScenario';
var REPUTATION_DB_KEY = 'aiTrustOsDeviceReputationDB';
var THREAT_TIMELINE_KEY = 'aiTrustOsDeviceThreatTimeline';
var MAX_HISTORY = 250;
  
    // State
    var state = {
      autoActionEnabled: false,
      history: [],
      currentResult: null
    };
    var els = {};
  
    // Utility functions
    function byId(id) { return document.getElementById(id); }
    function clamp(v, min, max) { return Math.min(Math.max(v,min), max); }
    function toNum(v,f) { var n=Number(v); return Number.isFinite(n)?n:(f||0); }
    function fmtPct(v) { var x = toNum(v,0); return x.toFixed(0)+'%'; }
    function fmtImpact(v) {
      if (typeof v === 'string') return v;
      var n = toNum(v,0);
      return n>0 ? '+'+n : n<0 ? ''+n : '0';
    }
    function fmtDate(ts) {
      if (!ts) return '—';
      var d=new Date(ts);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('en-US',{
        year:'numeric', month:'short', day:'2-digit',
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      }).format(d);
    }
    function fmtList(arr) {
      return Array.isArray(arr) && arr.length ? arr.join(', ') : 'None';
    }
    function safeText(v,fallback) {
      if (v===null||v===undefined||v==='') return fallback||'Unknown';
      return String(v);
    }
    function setText(el, t) { if(el) el.textContent = t; }
    function createNode(tag, className, text) {
      var el = document.createElement(tag);
    
      if (className) {
        el.className = className;
      }
    
      if (text !== undefined && text !== null) {
        el.textContent = text;
      }
    
      return el;
    }
    function setBadge(el,label,tone) {
      if (!el) return;
      el.className = 'device-risk-badge' + (tone ? ' ' + tone : '');
      el.textContent = label;
    }
  
    // Color/tone helpers
    function getRiskTone(lbl) {
      if (lbl==='High Risk') return 'high';
      if (lbl==='Medium Risk') return 'medium';
      return 'low';
    }
    function getDecisionTone(lbl) {
      if (lbl==='Blocked' || lbl==='Block') return 'high';
      if (lbl==='Challenge' || lbl==='Monitor' || lbl==='Monitored') return 'medium';
      if (lbl==='Allowed' || lbl==='Allow') return 'positive';
      return 'neutral';
    }
    function getSeverityTone(sev) {
      if (sev==='High') return 'high';
      if (sev==='Medium') return 'medium';
      if (sev==='Low') return 'low';
      if (sev==='Positive') return 'positive';
      return 'neutral';
    }
    function getOffsetLabel() {
      var m = new Date().getTimezoneOffset() * -1;
      var sign = m>=0?'+':'-';
      var am = Math.abs(m);
      var h = String(Math.floor(am/60)).padStart(2,'0');
      var mi = String(am%60).padStart(2,'0');
      return 'UTC ' + sign + h + ':' + mi;
    }
    function csvEscape(v) {
      var t = safeText(v,'');
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g,'""') + '"' : t;
    }
    function downloadFile(name, text, type) {
      var blob = new Blob([text], {type: type||'text/csv;charset=utf-8'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    function copyToClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function(resolve,reject){
        var ta = document.createElement('textarea');
        ta.value = text; ta.readOnly = true;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          if (ok) resolve(); else reject(new Error('Copy rejected'));
        } catch(e) {
          document.body.removeChild(ta);
          reject(e);
        }
      });
    }
  
    // Parser Layer: collect signals
    var parser = {
      parseBrowser: function(ua){
        ua = (ua||'').toLowerCase();
        if (/edg\//.test(ua)) return 'Edge';
        if (/firefox\//.test(ua)) return 'Firefox';
        if ((/chrome\//.test(ua)||/crios\//.test(ua)) && !/edg\//.test(ua) && !/opr\//.test(ua)) {
          return 'Chrome';
        }
        if (/safari\//.test(ua) && !/chrome\//.test(ua) && !/crios\//.test(ua) && !/android/.test(ua)) {
          return 'Safari';
        }
        return 'Unknown';
      },
      parseOS: function(ua, platform){
        ua = (ua||'').toLowerCase(); platform = (platform||'').toLowerCase();
        if (/windows nt/.test(ua) || /^win/.test(platform)) return 'Windows';
        if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
        if (/android/.test(ua)) return 'Android';
        if (/mac os x/.test(ua) || /^mac/.test(platform)) return 'Mac';
        if (/linux/.test(ua) || /x11/.test(ua) || /linux/.test(platform)) return 'Linux';
        return 'Unknown';
      },
      parseDeviceType: function(ua, maxTouch, width, height){
        ua = (ua||'').toLowerCase();
        var touch = toNum(maxTouch,0);
        var maxDim = Math.max(toNum(width,0), toNum(height,0));
        var minDim = Math.min(toNum(width,0), toNum(height,0));
        var isTabletUA = /ipad|tablet|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua));
        var isMobileUA = /mobi|iphone|ipod|android.*mobile|windows phone/.test(ua);
        if (isTabletUA || (touch>1 && minDim>=600 && maxDim<=1600)) {
          return 'Tablet';
        }
        if (isMobileUA || (touch>0 && maxDim<=932 && minDim<=480)) {
          return 'Mobile';
        }
        return 'Desktop';
      },
      getScreenInfo: function(){
        var s = window.screen || {};
        var w = toNum(s.width,0), h = toNum(s.height,0);
        var ar = h?Number((w/h).toFixed(2)):0;
        return {
          width: w, height: h,
          availWidth: toNum(s.availWidth,w),
          availHeight: toNum(s.availHeight,h),
          pixelRatio: toNum(window.devicePixelRatio,1),
          aspectRatio: ar,
          label: w && h ? w+' × '+h+' @'+window.devicePixelRatio+'×' : 'Unknown'
        };
      },
      getTimezoneInfo: function(){
        var zone = 'Unknown';
        try {
          var opt = new Intl.DateTimeFormat().resolvedOptions();
          if (opt && opt.timeZone) zone = opt.timeZone;
        } catch(e){}
        return {
          timeZone: zone,
          offsetLabel: getOffsetLabel(),
          display: zone==='Unknown' ? getOffsetLabel() : zone + ' (' + getOffsetLabel() + ')'
        };
      },
      inspectProperties: function(nav, tzInfo, screenInfo){
        var checks = {
          userAgent: typeof nav.userAgent==='string' && nav.userAgent.length>0,
          platform: typeof nav.platform==='string' && nav.platform.length>0,
          language: typeof nav.language==='string' && nav.language.length>0,
          languages: Array.isArray(nav.languages) && nav.languages.length>0,
          screen: screenInfo.width>0 && screenInfo.height>0,
          timezone: tzInfo.timeZone!=='Unknown'
        };
        var missing = Object.keys(checks).filter(function(k){return !checks[k];});
        return { checks: checks, missing: missing, missingCount: missing.length };
      },
      uaHints: function(ua, platform){
        ua = (ua||'').toLowerCase(); platform = (platform||'').toLowerCase();
        return {
          mentionsWindows: /windows nt|win64|win32/.test(ua) || /^win/.test(platform),
          mentionsMac: /mac os x|macintosh/.test(ua) || /^mac/.test(platform),
          mentionsAndroid: /android/.test(ua),
          mentionsIOS: /iphone|ipad|ipod/.test(ua),
          mentionsLinux: /linux|x11/.test(ua)
        };
      },
      detectSuspiciousUA: function(ua){
        ua = (ua||'').toLowerCase();
        var tokens = ua.match(/bot|crawl|spider|headless|phantomjs|selenium|playwright|puppeteer|curl|wget|python|scrapy|httpclient/g) || [];
        var unique = [];
        tokens.forEach(function(t){ if (unique.indexOf(t)<0) unique.push(t); });
        return unique;
      },
      detectHeadless: function(ua){
        ua = (ua||'').toLowerCase();
        var indicators = [];
        if (/headless/.test(ua)) indicators.push('User agent contains "headless" token');
        if (/phantomjs|slimerjs/.test(ua)) indicators.push('User agent matches known headless engine');
        return { suspected: indicators.length>0, indicators: indicators };
      },
      detectIncognito: async function(browser){
        var points=0, evidence=[], quotaMb=null;
        if (navigator.storage && typeof navigator.storage.estimate==='function') {
          try {
            var est = await navigator.storage.estimate();
            if (est && typeof est.quota==='number') {
              quotaMb = Math.round(est.quota/(1024*1024));
              if ((browser==='Chrome' || browser==='Edge') && quotaMb>0 && quotaMb<=120) {
                points++; 
                evidence.push('Low storage quota ('+quotaMb+' MB)');
              }
            }
          } catch(e){}
        }
        var requestFS = window.RequestFileSystem || window.webkitRequestFileSystem;
        if ((browser==='Chrome' || browser==='Edge') && typeof requestFS==='function') {
          try {
            var denied = await new Promise(function(resolve){
              var done=false;
              var temp = (typeof window.TEMPORARY!=='undefined' ? window.TEMPORARY : 0);
              requestFS(temp, 100, function(){ if(!done){ done=true; resolve(false);} }, 
                                     function(){ if(!done){ done=true; resolve(true);} });
              setTimeout(function(){ if(!done){ done=true; resolve(false);} }, 200);
            });
            if (denied) {
              points++; 
              evidence.push('FileSystem request denied');
            }
          } catch(e){}
        }
        return { suspected: points>=1, points: points, evidence: evidence, quotaMb: quotaMb };
      },
      collect: async function(){
        var nav = window.navigator || {};
        var ua = safeText(nav.userAgent,'');
        var platform = safeText(nav.platform,'');
        var screenInfo = this.getScreenInfo();
        var timezoneInfo = this.getTimezoneInfo();
        var browser = this.parseBrowser(ua);
        var os = this.parseOS(ua, platform);
        var deviceType = this.parseDeviceType(ua, nav.maxTouchPoints, screenInfo.width, screenInfo.height);
        var props = this.inspectProperties(nav, timezoneInfo, screenInfo);
        var hints = this.uaHints(ua, platform);
        var suspiciousTokens = this.detectSuspiciousUA(ua);
        var headless = this.detectHeadless(ua);
        var incog = await this.detectIncognito(browser);
        var simulationScenario = els.scenarioSelect
  ? els.scenarioSelect.value
  : 'normal';
        var fingerprintSeed = [
          deviceType,
          os,
          browser,
          platform,
          screenInfo.width,
          screenInfo.height,
          screenInfo.pixelRatio,
          timezoneInfo.timeZone,
          safeText(nav.language, 'Unknown')
        ].join('|');
        
        var fingerprintId = 'dev_' + btoa(fingerprintSeed)
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 16);
        return {
          capturedAt: new Date().toISOString(),
          deviceType: deviceType,
          os: os,
          browser: browser,
          simulationScenario: simulationScenario,
          fingerprintId: fingerprintId,
          userAgent: ua,
          platform: platform,
          language: safeText(nav.language,'Unknown'),
          languages: Array.isArray(nav.languages)?nav.languages.slice():[],
          screen: screenInfo,
          timezone: timezoneInfo,
          maxTouchPoints: toNum(nav.maxTouchPoints,0),
          webdriver: !!nav.webdriver,
          standardProps: props,
          uaHints: hints,
          suspiciousUA: suspiciousTokens,
          headless: headless,
          incognito: incog
        };
      }
    };
  
    // Decision Engine: map score to label/action
    var decisionEngine = {
      getRiskLabel: function(score) {
        if (score >= 80) return 'High Risk';
        if (score >= 50) return 'Medium Risk';
        return 'Low Risk';
      },
      getDecision: function(score, flags) {
        if (score >= 80) {
          return 'Block';
        }
      
        if (score >= 50) {
          if (flags.suspiciousUA || flags.osMismatch || flags.webdriver || flags.headless) {
            return 'Challenge';
          }
      
          return 'Monitor';
        }
      
        return 'Allow';
      },
      getAction: function(riskLabel, autoOn) {
        if (!autoOn) {
          return { action:'Suggested', actionSource:'Rule Engine' };
        }
        if (riskLabel === 'High Risk') {
          return { action:'Blocked', actionSource:'AI' };
        }
        if (riskLabel === 'Medium Risk') {
          return { action:'Monitored', actionSource:'AI' };
        }
        return { action:'Allowed', actionSource:'AI' };
      },
      getConfidence: function(parsed, flags, trustBoost) {
        var conf = 74;
        if (parsed.standardProps.missingCount === 0) conf += 6;
        if (parsed.standardProps.missingCount >= 2) conf -= 10;
        if (parsed.browser==='Unknown' || parsed.os==='Unknown') conf -= 6;
        if (flags.webdriver) conf += 14;
        if (flags.headless) conf += 10;
        if (flags.suspiciousUA) conf += 8;
        if (flags.osMismatch) conf += 6;
        if (flags.combinedFlags) conf += 4;
        if (flags.incognito) conf -= 4;
        if (trustBoost) conf += 4;
        return clamp(conf, 52, 98);
      }
    };
  
    // Rule Engine: evaluate parsed signals
    var ruleEngine = {
      evaluate: function(parsed, autoAction) {
        var signals = { identity: [], environment: [], pattern: [], riskEngine: [] };
        var breakdown = [];
        var rawScore = 0;
        var unusualCount = 0;
        var trustBoost = false;
        var repeatDeviceCount = state.history.filter(function (item) {
          return item.profile &&
            item.profile.fingerprintId &&
            item.profile.fingerprintId === parsed.fingerprintId;
        }).length;
  
        function addSignal(group, cfg) {
          var sig = {
            key: cfg.key,
            title: cfg.title,
            group: group,
            status: cfg.status,
            impact: cfg.impact,
            displayImpact: cfg.displayImpact || fmtImpact(cfg.impact),
            severity: cfg.severity,
            reason: cfg.reason,
            triggered: !!cfg.triggered
          };
          signals[group].push(sig);
          if (cfg.inBreakdown !== false) {
            breakdown.push({
              rule: sig.title,
              group: sig.group,
              severity: sig.severity,
              impact: sig.displayImpact,
              impactValue: typeof sig.impact==='number' ? sig.impact : 0,
              reason: sig.reason
            });
          }
          if (typeof cfg.impact === 'number') {
            rawScore += cfg.impact;
          }
        }
        function markUnusual(t) { if(t) unusualCount++; }
  
        var tzKnown = parsed.timezone.timeZone !== 'Unknown';
        var browserKnown = parsed.browser !== 'Unknown';
        var osKnown = parsed.os !== 'Unknown';
        var screenKnown = parsed.screen.width>0 && parsed.screen.height>0;
        var suspUA = parsed.suspiciousUA.length > 0;
  
        // Check OS/UA mismatch
        var osMismatch = false;
        if ((parsed.os==='Windows' && (parsed.uaHints.mentionsAndroid||parsed.uaHints.mentionsIOS||parsed.uaHints.mentionsMac)) ||
            (parsed.os==='Mac' && (parsed.uaHints.mentionsWindows||parsed.uaHints.mentionsAndroid)) ||
            (parsed.os==='Android' && (parsed.uaHints.mentionsWindows||parsed.uaHints.mentionsMac||parsed.uaHints.mentionsIOS)) ||
            (parsed.os==='iOS' && (parsed.uaHints.mentionsWindows||parsed.uaHints.mentionsAndroid||parsed.uaHints.mentionsLinux)) ||
            (parsed.os==='Linux' && (parsed.uaHints.mentionsWindows||parsed.uaHints.mentionsIOS))) {
          osMismatch = true;
        }
  
        // Unusual resolution
        var unusualRes = false;
        if (screenKnown) {
          unusualRes = parsed.screen.width < 320 ||
                       parsed.screen.height < 480 ||
                       parsed.screen.width > 6000 ||
                       parsed.screen.height > 4000 ||
                       parsed.screen.aspectRatio >= 3.2 ||
                       parsed.screen.aspectRatio <= 0.32;
        }
  
        // Identity signals (informational)
        addSignal('identity', {
          key: 'deviceType',
          title: 'Device type identified',
          status: parsed.deviceType!=='Unknown' ? 'OK' : 'Triggered',
          impact: 0,
          severity: parsed.deviceType!=='Unknown'?'Info':'Low',
          reason: parsed.deviceType!=='Unknown'
                  ? 'Device classified as ' + parsed.deviceType + '.'
                  : 'Device type could not be determined.',
          triggered: parsed.deviceType==='Unknown',
          inBreakdown: false
        });
        addSignal('identity', {
          key: 'osIdentified',
          title: 'Operating system identified',
          status: osKnown ? 'OK' : 'Triggered',
          impact: 0,
          severity: osKnown?'Info':'Low',
          reason: osKnown
                  ? 'OS resolved as ' + parsed.os + '.'
                  : 'Operating system is unknown.',
          triggered: !osKnown,
          inBreakdown: false
        });
        addSignal('identity', {
          key: 'browserIdentified',
          title: 'Browser identified',
          status: browserKnown ? 'OK' : 'Triggered',
          impact: 0,
          severity: browserKnown?'Info':'Low',
          reason: browserKnown
                  ? 'Browser resolved as ' + parsed.browser + '.'
                  : 'Browser family is unknown.',
          triggered: !browserKnown,
          inBreakdown: false
        });
        addSignal('identity', {
          key: 'screenCaptured',
          title: 'Screen resolution captured',
          status: screenKnown ? 'OK' : 'Triggered',
          impact: 0,
          severity: screenKnown?'Info':'Low',
          reason: screenKnown
                  ? 'Screen captured as ' + parsed.screen.label + '.'
                  : 'Screen dimensions unavailable.',
          triggered: !screenKnown,
          inBreakdown: false
        });
        addSignal('identity', {
          key: 'timezoneCaptured',
          title: 'Timezone captured',
          status: tzKnown ? 'OK' : 'Triggered',
          impact: 0,
          severity: tzKnown?'Info':'Low',
          reason: tzKnown
                  ? 'Timezone resolved as ' + parsed.timezone.display + '.'
                  : 'Timezone could not be resolved.',
          triggered: !tzKnown,
          inBreakdown: false
        });
  
        // Environment signals
        var suspiciousScenario = parsed.simulationScenario === 'suspicious';
var proxyScenario = parsed.simulationScenario === 'proxy';
var vmScenario = parsed.simulationScenario === 'vm';
var automatedScenario = parsed.simulationScenario === 'automated';

addSignal('environment', {
  key: 'simulationScenario',
  title: 'Simulation scenario',
  status: suspiciousScenario || proxyScenario || vmScenario || automatedScenario ? 'Triggered' : 'OK',
  impact: automatedScenario ? 75 : (vmScenario ? 55 : (proxyScenario ? 45 : (suspiciousScenario ? 35 : 0))),
  severity: automatedScenario ? 'High' : (vmScenario ? 'High' : ((proxyScenario || suspiciousScenario) ? 'Medium' : 'Info')),
  reason: automatedScenario
    ? 'Automated device simulation selected for testing high-risk automation behavior.'
    : vmScenario
      ? 'Virtual machine / emulator simulation selected. Backend hardware and device attestation would verify this in production.'
      : proxyScenario
        ? 'VPN / Proxy device simulation selected. Backend/IP intelligence would verify this in production.'
        : suspiciousScenario
          ? 'Suspicious device simulation selected for testing medium-risk device behavior.'
          : 'Normal device simulation selected.',
  triggered: suspiciousScenario || proxyScenario || vmScenario || automatedScenario
});

markUnusual(suspiciousScenario || proxyScenario || vmScenario || automatedScenario);
        addSignal('environment', {
          key: 'webdriver',
          title: 'WebDriver flag',
          status: parsed.webdriver ? 'Triggered' : 'OK',
          impact: parsed.webdriver?40:0,
          severity: parsed.webdriver?'High':'Info',
          reason: parsed.webdriver
                  ? 'navigator.webdriver is true (browser is likely automated).'
                  : 'navigator.webdriver is false.',
          triggered: parsed.webdriver
        });
        markUnusual(parsed.webdriver);
  
        addSignal('environment', {
          key: 'headlessPattern',
          title: 'Headless browser pattern',
          status: parsed.headless.suspected ? 'Triggered' : 'OK',
          impact: parsed.headless.suspected?35:0,
          severity: parsed.headless.suspected?'High':'Info',
          reason: parsed.headless.suspected
                  ? (parsed.headless.indicators.join('; ') + '.')
                  : 'No known headless indicators in user agent.',
          triggered: parsed.headless.suspected
        });
        markUnusual(parsed.headless.suspected);
  
        addSignal('environment', {
          key: 'incognitoHeuristic',
          title: 'Incognito detection (heuristic)',
          status: parsed.incognito.suspected ? 'Triggered' : 'OK',
          impact: parsed.incognito.suspected?15:0,
          severity: parsed.incognito.suspected?'Medium':'Info',
          reason: parsed.incognito.suspected
                  ? (fmtList(parsed.incognito.evidence) + '.')
                  : 'No private-mode anomalies detected.',
          triggered: parsed.incognito.suspected
        });
        markUnusual(parsed.incognito.suspected);
  
        addSignal('environment', {
          key: 'suspiciousUA',
          title: 'Suspicious UA pattern',
          status: suspUA ? 'Triggered' : 'OK',
          impact: suspUA?30:0,
          severity: suspUA?'High':'Info',
          reason: suspUA
                  ? ('User agent contains tokens: ' + parsed.suspiciousUA.join(', ') + '.')
                  : 'User agent has no common bot/automation tokens.',
          triggered: suspUA
        });
        markUnusual(suspUA);
        var electronRuntime = parsed.userAgent &&
  parsed.userAgent.toLowerCase().includes('electron');

addSignal('environment', {
  key: 'electronRuntime',
  title: 'Electron runtime detected',
  status: electronRuntime ? 'Triggered' : 'OK',
  impact: electronRuntime ? 18 : 0,
  severity: electronRuntime ? 'Medium' : 'Info',
  reason: electronRuntime
    ? 'Electron runtime detected inside browser environment.'
    : 'No Electron runtime detected.',
  triggered: electronRuntime
});

markUnusual(electronRuntime);
  
        // Pattern signals
        var repeatedDeviceImpact = 0;

if (repeatDeviceCount >= 5) {
  repeatedDeviceImpact = 20;
} else if (repeatDeviceCount >= 3) {
  repeatedDeviceImpact = 10;
}

addSignal('pattern', {
  key: 'repeatedDeviceFingerprint',
  title: 'Repeated device fingerprint',
  status: repeatedDeviceImpact > 0 ? 'Triggered' : 'OK',
  impact: repeatedDeviceImpact,
  severity: repeatedDeviceImpact >= 20 ? 'Medium' : (repeatedDeviceImpact > 0 ? 'Low' : 'Info'),
  reason: repeatedDeviceImpact > 0
    ? 'This device fingerprint has appeared ' + repeatDeviceCount + ' times in local history.'
    : 'No repeated device abuse pattern detected yet.',
  triggered: repeatedDeviceImpact > 0
});

markUnusual(repeatedDeviceImpact > 0);
        addSignal('pattern', {
          key: 'unusualResolution',
          title: 'Unusual screen resolution',
          status: unusualRes ? 'Triggered' : 'OK',
          impact: unusualRes?10:0,
          severity: unusualRes?'Low':'Info',
          reason: unusualRes
                  ? ('Screen resolution or aspect ratio looks abnormal: ' + parsed.screen.label + '.')
                  : 'Resolution is within typical range.',
          triggered: unusualRes
        });
        markUnusual(unusualRes);
  
        addSignal('pattern', {
          key: 'osUaMismatch',
          title: 'OS-UA consistency',
          status: osMismatch ? 'Triggered' : 'OK',
          impact: osMismatch?20:0,
          severity: osMismatch?'Medium':'Info',
          reason: osMismatch
                  ? 'Parsed OS conflicts with user agent/platform hints.'
                  : 'OS, platform, and UA appear consistent.',
          triggered: osMismatch
        });
        markUnusual(osMismatch);
  
        var missingProps = parsed.standardProps.missingCount >= 2;
        addSignal('pattern', {
          key: 'missingProps',
          title: 'Missing standard props',
          status: missingProps ? 'Triggered' : 'OK',
          impact: missingProps?10:0,
          severity: missingProps?'Low':'Info',
          reason: missingProps
                  ? ('Missing browser props: ' + parsed.standardProps.missing.join(', ') + '.')
                  : 'All standard browser properties present.',
          triggered: missingProps
        });
        markUnusual(missingProps);
  
        var combined = unusualCount >= 3;
        addSignal('pattern', {
          key: 'combinedFlags',
          title: 'Multiple unusual flags',
          status: combined ? 'Triggered' : 'OK',
          impact: combined?20:0,
          severity: combined?'Medium':'Info',
          reason: combined
                  ? ('Three or more unusual signals observed ('+unusualCount+').')
                  : 'Unusual flags below combined-risk threshold.',
          triggered: combined
        });
  
        // Trust boost
        var positive = !parsed.webdriver && !parsed.headless.suspected && !parsed.incognito.suspected &&
                       !suspUA && !unusualRes && !osMismatch && !missingProps &&
                       parsed.standardProps.missingCount===0 && browserKnown && osKnown && tzKnown;
        if (positive) {
          trustBoost = true;
          addSignal('riskEngine', {
            key: 'trustBoost',
            title: 'Strong consistent signals',
            status: 'Triggered',
            impact: -10,
            severity: 'Positive',
            reason: 'All core signals are consistent; applying trust boost.',
            triggered: true
          });
        } else {
          addSignal('riskEngine', {
            key: 'trustBoost',
            title: 'Strong consistent signals',
            status: 'OK',
            impact: 0,
            severity: 'Info',
            reason: 'Trust boost not applied (risk signals present).',
            triggered: false
          });
        }
  
        // Final scoring
        var finalScore = clamp(rawScore, 0, 100);
        var riskLabel = decisionEngine.getRiskLabel(finalScore);
        var decision = decisionEngine.getDecision(finalScore, {
          webdriver: parsed.webdriver,
          headless: parsed.headless.suspected,
          suspiciousUA: suspUA,
          osMismatch: osMismatch,
          incognito: parsed.incognito.suspected,
          combinedFlags: combined
        });
        var trustLevel = 'Known Device';

if (
  automatedScenario ||
  vmScenario
) {
  trustLevel = 'Critical Device';

} else if (
  proxyScenario ||
  suspiciousScenario ||
  finalScore >= 50
) {
  trustLevel = 'Suspicious Device';

} else if (
  repeatDeviceCount >= 5 &&
  finalScore < 35
) {
  trustLevel = 'Trusted Device';
}
var deviceReputation = 'Neutral';

if (
  automatedScenario ||
  vmScenario
) {
  deviceReputation = 'Blocked';

} else if (
  proxyScenario ||
  suspiciousScenario
) {
  deviceReputation = 'Risky';

} else if (
  repeatDeviceCount >= 5 &&
  finalScore < 35
) {
  deviceReputation = 'Trusted';
}
var repeatBlockedDevice = false;

var reputationScore = 50;

if (deviceReputation === 'Trusted') {
  reputationScore += 35;
}

if (deviceReputation === 'Risky') {
  reputationScore -= 20;
}

if (deviceReputation === 'Blocked') {
  reputationScore -= 40;
}

reputationScore -= Math.min(unusualCount * 4, 20);

reputationScore = clamp(reputationScore, 0, 100);

if (
  deviceReputation === 'Blocked' &&
  repeatDeviceCount >= 2
) {
  repeatBlockedDevice = true;

  addSignal('riskEngine', {
    key: 'repeatBlockedDevice',
    title: 'Repeat blocked device',
    status: 'Triggered',
    impact: 15,
    severity: 'High',
    reason: 'This blocked device fingerprint has returned multiple times.',
    triggered: true
  });
}
var reputationDowngrade = false;
var reputationDB = store.loadReputationDB();
var currentFingerprint = parsed.fingerprintId;

if (
  currentFingerprint &&
  reputationDB.trusted.indexOf(currentFingerprint) !== -1 &&
  (automatedScenario || vmScenario || proxyScenario || suspiciousScenario)
) {
  reputationDowngrade = true;

  addSignal('riskEngine', {
    key: 'reputationDowngrade',
    title: 'Reputation downgrade',
    status: 'Triggered',
    impact: 25,
    severity: 'High',
    reason: 'A previously trusted device is now showing suspicious or automated behavior.',
    triggered: true
  });
}
        var confidence = decisionEngine.getConfidence(parsed, {
          webdriver: parsed.webdriver,
          headless: parsed.headless.suspected,
          suspiciousUA: suspUA,
          osMismatch: osMismatch,
          incognito: parsed.incognito.suspected,
          combinedFlags: combined
        }, trustBoost);
        var actionState = decisionEngine.getAction(riskLabel, autoAction);
  
        // Risk engine signals
        addSignal('riskEngine', {
          key: 'finalScore',
          title: 'Final risk score',
          status: finalScore>0 ? 'Triggered' : 'OK',
          impact: 'Score '+finalScore+'/100',
          displayImpact: 'Score '+finalScore+'/100',
          severity: riskLabel==='High Risk'?'High':(riskLabel==='Medium Risk'?'Medium':'Low'),
          reason: 'Sum of triggered rules (clamped 0–100).',
          triggered: finalScore>0,
          inBreakdown: false
        });
        addSignal('riskEngine', {
          key: 'finalLabel',
          title: 'Risk level',
          status: riskLabel==='Low Risk'?'OK':'Triggered',
          impact: riskLabel,
          displayImpact: riskLabel,
          severity: riskLabel==='High Risk'?'High':(riskLabel==='Medium Risk'?'Medium':'Low'),
          reason: 'Thresholds: 0–49 Low, 50–79 Medium, 80+ High.',
          triggered: riskLabel!=='Low Risk',
          inBreakdown: false
        });
        addSignal('riskEngine', {
          key: 'finalDecision',
          title: 'Final decision',
          status: decision==='Allow'?'OK':'Triggered',
          impact: decision,
          displayImpact: decision,
          severity: (decision==='Block'?'High':(decision==='Challenge'?'Medium':'Low')),
          reason: 'Based on risk level and automation evidence.',
          triggered: decision!=='Allow',
          inBreakdown: false
        });
        addSignal('riskEngine', {
          key: 'confidence',
          title: 'Confidence',
          status: confidence>=80?'Triggered':'OK',
          impact: confidence+'%',
          displayImpact: confidence+'%',
          severity: confidence>=85?'Positive':(confidence>=70?'Info':'Low'),
          reason: 'Higher with direct evidence; lower if only weak heuristics.',
          triggered: confidence>=80,
          inBreakdown: false
        });
  
        var automationDetected =
  parsed.webdriver ||
  parsed.headless.suspected ||
  suspUA ||
  parsed.simulationScenario === 'automated';

var result = {
  timestamp: parsed.capturedAt,
  profile: {
    deviceType: parsed.deviceType,
    os: parsed.os,
    browser: parsed.browser,
    fingerprintId: parsed.fingerprintId,
    simulationScenario: parsed.simulationScenario,
    userAgent: parsed.userAgent,
    screenSize: parsed.screen.label,
    timezone: parsed.timezone.display,
    language: parsed.language,
    languages: parsed.languages.slice(),
    platform: parsed.platform,
    maxTouchPoints: parsed.maxTouchPoints
  },
  score: finalScore,
  riskLabel: riskLabel,
  decision: decision,
  trustLevel: trustLevel,
  deviceReputation: deviceReputation,
  reputationScore: reputationScore,
  confidence: confidence,
  action: actionState.action,
  actionSource: actionState.actionSource,
  autoAction: !!autoAction,
  automationDetected: !!automationDetected,
  repeatDeviceCount: repeatDeviceCount + 1,
  flags: {
    webdriver: parsed.webdriver,
    headless: parsed.headless.suspected,
    incognito: parsed.incognito.suspected,
    suspiciousUA: suspUA,
    unusualResolution: unusualRes,
    osMismatch: osMismatch,
    missingProps: missingProps,
    combinedFlags: combined,
    strongConsistency: positive
  },
  environment: {
    webdriver: parsed.webdriver,
    headlessIndicators: parsed.headless.indicators.slice(),
    incognitoEvidence: parsed.incognito.evidence.slice(),
    suspiciousTokens: parsed.suspiciousUA.slice(),
    storageQuotaMB: parsed.incognito.quotaMb,
    missingProperties: parsed.standardProps.missing.slice()
  },
  signals: signals,
  breakdown: breakdown.sort(function(a,b) {
    return Math.abs(b.impactValue) - Math.abs(a.impactValue);
  }),
  riskReasons: breakdown
    .filter(function(item) {
      return item.impactValue > 0;
    })
    .map(function(item) {
      return item.rule + ': ' + item.reason;
    })
    .concat(
      finalScore === 0
        ? ['Clean device profile: browser, OS, screen, timezone, and automation signals look consistent.']
        : []
    )
};

var threatSeverity = getThreatSeverity(result);

result.threatSeverity = threatSeverity.severityLabel;
result.threatSeverityScore = threatSeverity.severityScore;
result.threatSeverityReasons = threatSeverity.reasons;

return result;
      }
    };
  
    // Store Layer: persistence
    var store = {
      loadHistory: function() {
        var data = [];
        try {
          data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch(e) { data = []; }
        if (!Array.isArray(data)) data = [];
        // Normalize and sort descending by timestamp
        var normalized = data.map(store.normalizeRecord).filter(Boolean);
        normalized.sort(function(a,b){
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      },
      normalizeRecord: function(rec) {
        if (!rec || typeof rec !== 'object') return null;
        var score = clamp(toNum(rec.score, 0), 0, 100);
        var riskLabel = rec.riskLabel || decisionEngine.getRiskLabel(score);
        var decision = rec.decision || decisionEngine.getDecision(score, {
          webdriver: !!rec.webdriver,
          headless: !!rec.headless,
          suspiciousUA: !!rec.automationDetected,
          osMismatch: false,
          incognito: false,
          combinedFlags: false
        });
        return {
          id: rec.id || ('device-risk-' + Date.now()),
          timestamp: rec.timestamp || new Date().toISOString(),
          deviceType: safeText(rec.deviceType||'', 'Unknown'),
          os: safeText(rec.os||'', 'Unknown'),
          browser: safeText(rec.browser||'', 'Unknown'),
          userAgent: safeText(rec.userAgent||'', ''),
          screenSize: safeText(rec.screenSize||'', 'Unknown'),
          timezone: safeText(rec.timezone||'', 'Unknown'),
          riskLabel: riskLabel,
          score: score,
          decision: decision,
          trustLevel: safeText(rec.trustLevel, 'Known Device'),
deviceReputation: safeText(rec.deviceReputation, 'Neutral'),
          confidence: clamp(toNum(rec.confidence, 75), 0, 100),
          action: safeText(rec.action, 'Suggested'),
          actionSource: safeText(rec.actionSource, rec.action!=='Suggested'?'AI':'Rule Engine'),
          automationDetected: rec.automationDetected === true,
          profile: rec.profile || {},
          environment: rec.environment || {},
          flags: rec.flags || {},
          breakdown: Array.isArray(rec.breakdown) ? rec.breakdown : [],
          signals: rec.signals || null
        };
      },
      persist: function(result) {
        var entry = {
          id: 'device-risk-' + Date.now(),
          timestamp: result.timestamp,
          scenario: result.profile && result.profile.simulationScenario ? result.profile.simulationScenario : 'normal',
          deviceType: result.profile.deviceType,
          os: result.profile.os,
          browser: result.profile.browser,
          userAgent: result.profile.userAgent,
          screenSize: result.profile.screenSize,
          timezone: result.profile.timezone,
          riskLabel: result.riskLabel,
          score: result.score,
          decision: result.decision,
          confidence: result.confidence,
          trustLevel: result.trustLevel,
          deviceReputation: result.deviceReputation,
          reputationScore: result.reputationScore,
threatSeverity: result.threatSeverity,
threatSeverityScore: result.threatSeverityScore,
threatSeverityReasons: result.threatSeverityReasons || [],
action: result.action,
          actionSource: result.actionSource,
          automationDetected: result.automationDetected,
          repeatDeviceCount: result.repeatDeviceCount,
          profile: result.profile,
          environment: result.environment,
          flags: result.flags,
          breakdown: result.breakdown,
          signals: result.signals,
          riskReasons: result.riskReasons || []
        };
        entry.seenCount = result.repeatDeviceCount || 1;
        state.history.unshift(entry);
        state.history = state.history.slice(0, MAX_HISTORY);
      
        var db = store.loadReputationDB();
        var previousReputation = 'New Device';

if (
  fingerprint &&
  db.trusted.indexOf(fingerprint) !== -1
) {
  previousReputation = 'Trusted';

} else if (
  fingerprint &&
  db.risky.indexOf(fingerprint) !== -1
) {
  previousReputation = 'Risky';

} else if (
  fingerprint &&
  db.blocked.indexOf(fingerprint) !== -1
) {
  previousReputation = 'Blocked';
}
        var fingerprint = result.profile && result.profile.fingerprintId;
      
        if (fingerprint) {
          db.trusted = db.trusted.filter(function(id) { return id !== fingerprint; });
          db.risky = db.risky.filter(function(id) { return id !== fingerprint; });
          db.blocked = db.blocked.filter(function(id) { return id !== fingerprint; });
      
          if (result.deviceReputation === 'Blocked') {
            db.blocked.push(fingerprint);
          } else if (result.deviceReputation === 'Risky') {
            db.risky.push(fingerprint);
          } else if (result.deviceReputation === 'Trusted') {
            db.trusted.push(fingerprint);
          }
      
          store.saveReputationDB(db);
        }
      
        var timeline = state.history.length <= 1 ? [] : store.loadThreatTimeline();
      
        timeline.unshift({
          id: 'device-threat-' + Date.now(),
          timestamp: result.timestamp,
          fingerprintId: fingerprint || 'unknown',
          scenario: result.profile && result.profile.simulationScenario
            ? result.profile.simulationScenario
            : 'unknown',
          riskLabel: result.riskLabel,
          score: result.score,
          trustLevel: result.trustLevel,
          deviceReputation: result.deviceReputation,
          previousReputation: previousReputation,
          threatSeverity: result.threatSeverity || 'Normal',
reputationTransition: previousReputation + ' → ' + result.deviceReputation,
decision: result.decision,
          action: result.action,
          reason: entry.riskReasons.length
            ? entry.riskReasons[0]
            : 'Device analysis completed.'
        });
      
        store.saveThreatTimeline(timeline);
      
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
      
        return entry;
      },
      clear: function() {
        state.history = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        localStorage.removeItem(THREAT_TIMELINE_KEY);
        localStorage.removeItem(REPUTATION_DB_KEY);
      },
      
      loadAuto: function() {
        try {
          return localStorage.getItem(AUTO_ACTION_KEY) === 'true';
        } catch(e) {
          return false;
        }
      },
      
      saveAuto: function(val) {
        localStorage.setItem(AUTO_ACTION_KEY, val ? 'true' : 'false');
      },
      
      saveScenario: function(val) {
        localStorage.setItem(SCENARIO_KEY, val || 'normal');
      },
      
      loadScenario: function() {
        return localStorage.getItem(SCENARIO_KEY) || 'normal';
      },
      
      loadReputationDB: function() {
        try {
          var db = JSON.parse(localStorage.getItem(REPUTATION_DB_KEY) || '{}');
      
          return {
            trusted: Array.isArray(db.trusted) ? db.trusted : [],
            risky: Array.isArray(db.risky) ? db.risky : [],
            blocked: Array.isArray(db.blocked) ? db.blocked : []
          };
        } catch(e) {
          return {
            trusted: [],
            risky: [],
            blocked: []
          };
        }
      },
      
      saveReputationDB: function(db) {
  localStorage.setItem(REPUTATION_DB_KEY, JSON.stringify(db));
},

loadThreatTimeline: function() {
  try {
    var data = JSON.parse(localStorage.getItem(THREAT_TIMELINE_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch(e) {
    return [];
  }
},

saveThreatTimeline: function(events) {
  localStorage.setItem(
    THREAT_TIMELINE_KEY,
    JSON.stringify(Array.isArray(events) ? events.slice(0, 100) : [])
  );
}
      };
    // Insights Layer
    var insights = {
      mostCommon: function(items, field) {
        if (!items.length) return 'No history';
        var counts = {};
        items.forEach(function(it){
          var val = safeText(it[field], 'Unknown');
          counts[val] = (counts[val]||0) + 1;
        });
        var top = Object.keys(counts).sort(function(a,b){
          return counts[b] - counts[a];
        })[0];
        return top + ' (' + counts[top] + ')';
      },
      summarize: function(items) {
        if (!items.length) {
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
      
        var highCount = items.filter(i => i.riskLabel === 'High Risk').length;
      
        var autoCount = items.filter(i => i.automationDetected).length;
      
        var last = items[0];
      
        function getTopFingerprint(type) {
          var counts = {};
      
          items.forEach(function(item) {
            if (
              item.deviceReputation === type &&
              item.profile &&
              item.profile.fingerprintId
            ) {
              var fp = item.profile.fingerprintId;
      
              counts[fp] = (counts[fp] || 0) + 1;
            }
          });
      
          var top = '—';
          var max = 0;
      
          Object.keys(counts).forEach(function(fp) {
            if (counts[fp] > max) {
              max = counts[fp];
              top = fp + ' (' + counts[fp] + ')';
            }
          });
      
          return top;
        }
      
        var escalationCount = items.filter(function(item) {
          return (
            item.threatSeverity === 'Critical Threat Actor' ||
            item.threatSeverity === 'High Severity'
          );
        }).length;
      
        var escalationRate = items.length
          ? Math.round((escalationCount / items.length) * 100) + '%'
          : '0%';
      
        return {
          commonDevice: this.mostCommon(items,'deviceType'),
      
          commonOS: this.mostCommon(items,'os'),
      
          highRiskPct: fmtPct((highCount/items.length)*100),
      
          autoPct: fmtPct((autoCount/items.length)*100),
      
          lastDevice:
            safeText(last.deviceType,'Unknown') + ' · ' +
            safeText(last.os,'Unknown') + ' · ' +
            safeText(last.browser,'Unknown'),
      
          topRiskyFingerprint: getTopFingerprint('Risky'),
      
          topBlockedFingerprint: getTopFingerprint('Blocked'),
      
          escalationRate: escalationRate,
      
          threatFrequency: items.length + ' events'
        };
      }
    };
  
    // Renderer Layer
    var renderer = {
      renderProfile: function(result) {
        if (!result) {
          if (els.profileCard) {
            els.profileCard.classList.remove('risk-low', 'risk-medium', 'risk-high');
          }
          setText(els.scoreValue, '--');
          setText(els.scoreLabel, 'No analysis yet');
          setBadge(els.profileRiskBadge, 'No Result', 'neutral');
          setBadge(els.profileDecisionBadge, 'Pending', 'neutral');
          setText(els.profileDeviceType, '—');
          setText(els.profileOs, '—');
          setText(els.profileBrowser, '—');
          setText(els.profileUserAgent, '—');
          setText(els.profileScreenSize, '—');
          setText(els.profileTimezone, '—');
          setText(els.profileConfidence, '—');
          setText(els.profileTimestamp, 'No analysis captured yet.');
          return;
        }
        // Update score ring
        var deg = Math.round((clamp(result.score,0,100)/100)*360);
        var ringColor = result.riskLabel==='High Risk' ? 'var(--device-risk-danger,#ef4444)'
                      : result.riskLabel==='Medium Risk' ? 'var(--device-risk-warning,#f59e0b)'
                      : 'var(--device-risk-success,#22c55e)';
        if (els.scoreRing) {
          els.scoreRing.style.setProperty('--device-risk-progress', deg+'deg');
          els.scoreRing.style.setProperty('--device-risk-ring-color', ringColor);
        }
        setText(els.scoreValue, String(result.score));
        setText(els.scoreLabel, result.riskLabel);
        setBadge(els.profileRiskBadge, result.riskLabel, getRiskTone(result.riskLabel));
        if (els.profileCard) {
          els.profileCard.classList.remove('risk-low', 'risk-medium', 'risk-high');
        
          if (result.riskLabel === 'High Risk') {
            els.profileCard.classList.add('risk-high');
          } else if (result.riskLabel === 'Medium Risk') {
            els.profileCard.classList.add('risk-medium');
          } else {
            els.profileCard.classList.add('risk-low');
          }
        }
        setBadge(els.profileDecisionBadge, result.decision, getDecisionTone(result.decision));
        setText(els.profileDeviceType, result.profile.deviceType);
        setText(els.profileOs, result.profile.os);
        setText(els.profileBrowser, result.profile.browser);

        setText(els.profileFingerprint, result.profile.fingerprintId || '--');
setText(els.profileSeenCount, String(result.repeatDeviceCount || 1));
setText(els.profileTrustLevel, result.trustLevel || 'Unknown');
        setText(
          els.profileFingerprint,
          result.profile.fingerprintId || 'Unavailable'
        );

        setText(
          els.profileSeenCount,
          result.repeatDeviceCount || 1
        );
        setText(
          els.profileTrustLevel,
          result.trustLevel || 'Unknown'
        );
        setText(
          els.profileReputation,
          result.deviceReputation || 'Neutral'
        );
        if (els.profileReputationScore) {
  setText(
    els.profileReputationScore,
    result.reputationScore + '/100'
  );
}
        setText(
          els.profileThreatSeverity,
          result.threatSeverity || 'Normal'
        );
        setText(els.profileUserAgent, result.profile.userAgent || 'Unavailable');
        setText(els.profileScreenSize, result.profile.screenSize);
        setText(els.profileTimezone, result.profile.timezone);
        setText(els.profileConfidence, result.confidence + '%');
        setText(els.profileReputation, result.deviceReputation);
setText(els.profileReputationScore, String(result.reputationScore || 0));
setText(els.profileThreatSeverity, result.threatSeverity || 'Low Severity');
        setText(els.profileTimestamp, 'Last analyzed: ' + fmtDate(result.timestamp));
      },
      renderSignals: function(result) {
        [['identity', els.identitySignals],
         ['environment', els.environmentSignals],
         ['pattern', els.patternSignals],
         ['riskEngine', els.riskEngineSignals]].forEach(function(pair){
          var grp = pair[0], container = pair[1];
          container.innerHTML = '';
          var list = result && result.signals && result.signals[grp] || [];
          if (!list.length) {
            container.appendChild(createNode('div','device-risk-empty','No signals.'));
            return;
          }
          list.forEach(function(sig){
            var item = createNode('article','device-risk-signal-item');
            var top = createNode('div','device-risk-signal-top');
            var left = createNode('div','device-risk-signal-left');
            var title = createNode('h4','device-risk-signal-title', sig.title);
            var reason = createNode('p','device-risk-signal-reason', sig.reason);
            var status = createNode('span','device-risk-badge '+
                                (sig.status==='Triggered'?getSeverityTone(sig.severity):'neutral'),
                                sig.status);
            var meta = createNode('div','device-risk-signal-meta');
            var impact = createNode('span','device-risk-signal-impact', sig.displayImpact);
            var severity = createNode('span','device-risk-badge '+getSeverityTone(sig.severity), sig.severity);
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
      renderBreakdown: function(result) {
        var tbody = els.breakdownTableBody;
        tbody.innerHTML = '';
        if (!result || !result.breakdown.length) {
          var tr = document.createElement('tr');
          var td = document.createElement('td');
          td.colSpan = 5;
          td.className = 'device-risk-empty-cell';
          td.textContent = 'No breakdown entries.';
          tr.appendChild(td);
          tbody.appendChild(tr);
          return;
        }
        result.breakdown.forEach(function(entry){
          var tr = document.createElement('tr');
          var tdRule = createNode('td','', entry.rule);
          var tdGroup = createNode('td','', entry.group);
          var tdSev = document.createElement('td');
          var sevBadge = createNode('span','device-risk-badge '+getSeverityTone(entry.severity), entry.severity);
          tdSev.appendChild(sevBadge);
          var tdImpact = createNode('td','', entry.impact);
          var tdReason = createNode('td','', entry.reason);
          tr.appendChild(tdRule);
          tr.appendChild(tdGroup);
          tr.appendChild(tdSev);
          tr.appendChild(tdImpact);
          tr.appendChild(tdReason);
          tbody.appendChild(tr);
        });
      },
      renderInsights: function(history) {
        var sum = insights.summarize(history);
        var reputationDB = store.loadReputationDB();
        var threatTimeline = store.loadThreatTimeline();
      
        setText(els.insightDeviceType, sum.commonDevice);
        setText(els.insightOS, sum.commonOS);
        setText(els.insightHighRisk, sum.highRiskPct);
        setText(els.insightAutomation, sum.autoPct);
        setText(els.insightLastDevice, sum.lastDevice);
        if (els.insightTopRiskyFingerprint) {
          setText(
            els.insightTopRiskyFingerprint,
            sum.topRiskyFingerprint
          );
        }
        
        if (els.insightTopBlockedFingerprint) {
          setText(
            els.insightTopBlockedFingerprint,
            sum.topBlockedFingerprint
          );
        }
        
        if (els.insightEscalationRate) {
          setText(
            els.insightEscalationRate,
            sum.escalationRate
          );
        }
        
        if (els.insightThreatFrequency) {
          setText(
            els.insightThreatFrequency,
            sum.threatFrequency
          );
        }
      
        if (els.insightTrustedFingerprints) {
          setText(
            els.insightTrustedFingerprints,
            reputationDB.trusted.length
          );
        }
      
        if (els.insightRiskyFingerprints) {
          setText(
            els.insightRiskyFingerprints,
            reputationDB.risky.length
          );
        }
      
        if (els.insightBlockedFingerprints) {
          setText(
            els.insightBlockedFingerprints,
            reputationDB.blocked.length
          );
        }
        if (els.insightThreatTimeline) {
  setText(
    els.insightThreatTimeline,
    history.length ? threatTimeline.length : 0
  );
}
      },
      renderThreatTimeline: function() {
        if (!els.threatTimelineList) return;
      
        var events = state.history.length ? store.loadThreatTimeline() : [];
      
        if (!events.length) {
          els.threatTimelineList.innerHTML = '<div class="device-risk-empty">No threat timeline events yet.</div>';
          return;
        }
      
        els.threatTimelineList.innerHTML = events.slice(0, 8).map(function(event) {
          return (
            '<div class="device-risk-timeline-item ' +
(
  event.threatSeverity === 'Critical Threat Actor'
    ? 'critical'
    : event.threatSeverity === 'High Severity'
    ? 'high'
    : event.threatSeverity === 'Medium Severity'
    ? 'medium'
    : 'low'
) +
'">' +
              '<div class="device-risk-timeline-top">' +
                '<strong>' +
(event.deviceReputation || 'Neutral') +
' · ' +
(event.riskLabel || 'Unknown') +
'</strong>' +

'<span class="device-risk-badge ' +
(
  event.threatSeverity === 'Critical Threat Actor'
    ? 'high'
    : event.threatSeverity === 'High Severity'
      ? 'medium'
      : 'low'
) +
'" style="margin-left:8px;">' +
(event.threatSeverity || 'Low Severity') +
'</span>' +
                '<span>' + fmtDate(event.timestamp) + '</span>' +
              '</div>' +
              '<p>' +
  '<strong>' +
    (event.reputationTransition || 'Unknown Transition') +
  '</strong><br>' +
  (event.reason || 'Device risk event recorded.') +
'</p>' +
              '<small>' +
'Score: ' + (event.score || 0) +
' · Decision: ' + (event.decision || 'Unknown') +
' · Action: ' + (event.action || 'Suggested') +
'</small>' +
            '</div>'
          );
        }).join('');
      },
      renderActivity: function(history) {
        var tbody = els.activityTableBody;
        tbody.innerHTML = '';
      
        if (!history.length) {
          var tr = document.createElement('tr');
          var td = document.createElement('td');
          td.colSpan = 14;
          td.className = 'device-risk-empty-cell';
          td.textContent = 'No activity history.';
          tr.appendChild(td);
          tbody.appendChild(tr);
          return;
        }
      
        history.forEach(function(entry) {
          var tr = document.createElement('tr');
      
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
  entry.scenario || 'Live Device',
  entry.threatSeverity || 'Low Severity',
  entry.riskLabel,
  String(entry.score),
  entry.decision,
  entry.action,
  entry.actionSource
];
      
          cells.forEach(function(val, idx) {
            var td = document.createElement('td');
      
            if (idx === 4) {
              var code = createNode('code', '', val);
              td.appendChild(code);
      
            } else if (idx === 5) {
              var trustBadge = createNode(
                'span',
                'device-risk-badge neutral',
                val
              );
              td.appendChild(trustBadge);
      
            } else if (idx === 6) {
              var repTone = val === 'Blocked'
                ? 'high'
                : val === 'Risky'
                  ? 'medium'
                  : val === 'Trusted'
                    ? 'positive'
                    : 'neutral';
      
              var repBadge = createNode(
                'span',
                'device-risk-badge ' + repTone,
                val
              );
              td.appendChild(repBadge);
      
            } else if (idx === 8) {
              var sevTone = val === 'Critical Threat Actor'
                ? 'high'
                : val === 'High Severity'
                  ? 'high'
                  : val === 'Elevated Severity'
                    ? 'medium'
                    : 'low';
      
              var severityBadge = createNode(
                'span',
                'device-risk-badge ' + sevTone,
                val
              );
              td.appendChild(severityBadge);
      
            } else if (idx === 9) {
              var riskBadge = createNode(
                'span',
                'device-risk-badge ' + getRiskTone(val),
                val
              );
              td.appendChild(riskBadge);
      
            } else if (idx === 11 || idx === 12) {
              var tone = idx === 11
                ? getDecisionTone(val)
                : (val === 'AI' ? 'positive' : 'neutral');
      
              var badge = createNode(
                'span',
                'device-risk-badge ' + tone,
                val
              );
              td.appendChild(badge);
      
            } else {
              if (
                typeof val === 'string' &&
                val.length > 38
              ) {
                td.textContent = val.slice(0, 38) + '...';
                td.title = val;
              
              } else {
                td.textContent = val;
              }
            }
      
            tr.appendChild(td);
          });
      
          tbody.appendChild(tr);
        });
      },
      renderRunState: function(msg, isError) {
        if (!els.runState) return;
        els.runState.textContent = msg;
        els.runState.className = 'device-risk-inline-status' + (isError?' is-error':'');
      },
      renderAutoState: function() {
        var msg = state.autoActionEnabled
                  ? 'Auto action is ON: Low→Allowed, Medium→Monitored, High→Blocked.'
                  : 'Auto action is OFF. Outcome will be suggested only.';
        setText(els.autoActionState, msg);
        if (els.autoActionToggle) els.autoActionToggle.checked = state.autoActionEnabled;
      },
      renderAll: function() {
        this.renderProfile(state.currentResult);
        this.renderSignals(state.currentResult);
        this.renderBreakdown(state.currentResult);
        this.renderInsights(state.history);
        this.renderThreatTimeline();
        this.renderActivity(state.history);
        this.renderAutoState();
      }
    };
  
    // Event bindings
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
    function getThreatSeverity(result) {
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
    reasons.push('Excessive automation behavior');
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
  
    async function analyzeDevice(options) {
      options = options || {};
      var persist = !!options.persist;
    
      renderer.renderRunState('Analyzing device signals...');
    
      if (els.analyzeBtn) {
        els.analyzeBtn.disabled = true;
        els.analyzeBtn.textContent = 'Analyzing...';
      }
    
      try {
        var parsed = await parser.collect();
    
        var backendPayload = {
          user_agent: String(parsed.userAgent || 'Unknown Device'),
          screen_size: String(
            parsed.screen && parsed.screen.label
              ? parsed.screen.label
              : 'Unknown'
          ),
          timezone: String(
            parsed.timezone && parsed.timezone.display
              ? parsed.timezone.display
              : 'Unknown'
          ),
          language: String(parsed.language || navigator.language || 'unknown')
        };
        
        if (parsed.simulationScenario === 'automated') {
          backendPayload.user_agent = 'HeadlessChrome Selenium WebDriver Bot Browser';
          backendPayload.screen_size = '800x600';
          backendPayload.timezone = 'Unknown';
          backendPayload.language = 'unknown';
        }
        
        if (parsed.simulationScenario === 'vm') {
          backendPayload.user_agent = 'HeadlessChrome Virtual Machine Emulator Browser';
          backendPayload.screen_size = '1024x768';
          backendPayload.timezone = 'UTC';
          backendPayload.language = 'unknown';
        }
        
        if (parsed.simulationScenario === 'proxy') {
          backendPayload.user_agent = 'python-requests/2.31 Proxy Datacenter Browser';
          backendPayload.screen_size = '1366x768';
          backendPayload.timezone = 'UTC';
          backendPayload.language = 'unknown';
        }
        
        if (parsed.simulationScenario === 'suspicious') {
          backendPayload.user_agent = 'Unknown Browser';
          backendPayload.screen_size = '800x600';
          backendPayload.timezone = 'Unknown';
          backendPayload.language = 'unknown';
        }

        if (parsed.simulationScenario !== 'normal') {
          parsed.userAgent = backendPayload.user_agent;
          parsed.screen.label = backendPayload.screen_size;
          parsed.timezone.display = backendPayload.timezone;
          parsed.language = backendPayload.language;
        
          if (parsed.simulationScenario === 'vm') {
            parsed.browser = 'Headless Chrome';
            parsed.os = 'Virtual Machine';
          }
        
          if (parsed.simulationScenario === 'automated') {
            parsed.browser = 'Headless Chrome';
            parsed.os = 'Automation Runtime';
          }
        
          if (parsed.simulationScenario === 'proxy') {
            parsed.browser = 'Scripted Client';
            parsed.os = 'Datacenter Environment';
          }
        
          if (parsed.simulationScenario === 'suspicious') {
            parsed.browser = 'Unknown Browser';
            parsed.os = 'Unknown OS';
          }
        }
        
        var backendResult = await aiTrustApiPost('/analyze/device', backendPayload);
        
        var result = ruleEngine.evaluate(
          parsed,
          state.autoActionEnabled
        );
        
        result.event_id = backendResult.event_id;
result.timestamp = backendResult.timestamp;
result.score = backendResult.score;
result.riskLabel = backendResult.risk_level;
result.decision = backendResult.decision;
result.confidence = backendResult.confidence === 'High' ? 95 : 70;
result.riskReasons = backendResult.reasons || result.riskReasons;
result.backendSynced = true;
result.backendModule = backendResult.module;
result.breakdown = [];

result.signals = {
  identity: [],
  environment: [],
  pattern: [],
  riskEngine: []
};

result.signals.riskEngine.push({
  key: 'backendRiskScore',
  title: 'Backend risk score',
  status: backendResult.risk_level,
  impact: backendResult.score,
  displayImpact: 'Score ' + backendResult.score + '/100',
  severity: backendResult.risk_level === 'High Risk'
    ? 'High'
    : backendResult.risk_level === 'Medium Risk'
      ? 'Medium'
      : 'Low',
  reason: 'Final risk score returned by backend source of truth.',
  triggered: backendResult.risk_level !== 'Low Risk',
  inBreakdown: true
});

result.signals.riskEngine.push({
  key: 'backendDecision',
  title: 'Backend decision',
  status: backendResult.decision,
  impact: backendResult.decision,
  displayImpact: backendResult.decision,
  severity: backendResult.decision === 'Block'
    ? 'High'
    : backendResult.decision === 'Monitor'
      ? 'Medium'
      : 'Low',
  reason: 'Final decision returned by backend source of truth.',
  triggered: backendResult.decision !== 'Allow',
  inBreakdown: true
});

result.breakdown.push({
  rule: 'Backend risk score',
key: 'backend-risk-score',
title: 'Backend risk score',
  group: 'riskEngine',
  severity: backendResult.risk_level === 'High Risk'
    ? 'High'
    : backendResult.risk_level === 'Medium Risk'
      ? 'Medium'
      : 'Low',
      impact: 'Score ' + backendResult.score + '/100',
  impactValue: backendResult.score,
  displayImpact: 'Score ' + backendResult.score + '/100',
  reason: 'Backend returned final score and risk level.'
});

result.threatSeverity = result.riskLabel === 'High Risk'
  ? 'High Severity'
  : result.riskLabel === 'Medium Risk'
    ? 'Elevated Severity'
    : 'Normal';

if (backendResult.device_reputation) {
  result.trustLevel = backendResult.device_reputation.trust_level || result.trustLevel;
  result.deviceReputation = backendResult.device_reputation.reputation || result.deviceReputation;
  result.repeatDeviceCount = backendResult.device_reputation.seen_count || result.repeatDeviceCount;
}

result.automationDetected =
  result.riskLabel === 'High Risk' ||
  parsed.simulationScenario === 'automated' ||
  parsed.simulationScenario === 'proxy' ||
  parsed.simulationScenario === 'vm' ||
  String(result.profile.userAgent || '').toLowerCase().indexOf('headless') !== -1 ||
  String(result.profile.userAgent || '').toLowerCase().indexOf('selenium') !== -1 ||
  String(result.profile.userAgent || '').toLowerCase().indexOf('python-requests') !== -1;

if (state.autoActionEnabled) {
  if (result.riskLabel === 'High Risk') {
    result.action = 'Blocked';
    result.actionSource = 'AI';
  } else if (result.riskLabel === 'Medium Risk') {
    result.action = 'Monitored';
    result.actionSource = 'AI';
  } else {
    result.action = 'Allowed';
    result.actionSource = 'AI';
  }
} else {
  result.action = 'Suggested';
  result.actionSource = 'Manual';
}
    
        state.currentResult = result;
    
        if (persist) {
          store.persist(result);
    
          window.dispatchEvent(
            new CustomEvent('aiTrustOsActivityUpdated', {
              detail: {
                module: 'Device Risk',
                storageKey: 'aiTrustOsDeviceRiskActivity',
                riskLabel: result.riskLabel,
                score: result.score,
                decision: result.decision,
                action: result.action,
                actionSource: result.actionSource,
                timestamp: result.timestamp,
                riskReasons: result.riskReasons || []
              }
            })
          );
        }
    
        renderer.renderAll();
    
        renderer.renderRunState(
          persist
            ? 'Analysis complete; saved to history.'
            : 'Analysis complete. (Click Analyze to save.)'
        );
    
      } catch (err) {
        console.error('Analysis error:', err);
    
        renderer.renderRunState(
          err && err.message
            ? err.message
            : 'Analysis failed (see console).',
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
        renderer.renderRunState('No analysis to copy.', true);
        return;
      }
      var lines = [];
      lines.push('Device Risk Report');
      lines.push('Time: ' + fmtDate(state.currentResult.timestamp));
      lines.push('Device: ' + state.currentResult.profile.deviceType + 
                 ', OS: ' + state.currentResult.profile.os + 
                 ', Browser: ' + state.currentResult.profile.browser);
      lines.push('User Agent: ' + state.currentResult.profile.userAgent);
      lines.push('Screen: ' + state.currentResult.profile.screenSize +
                 ', Timezone: ' + state.currentResult.profile.timezone);
      lines.push('Risk Score: ' + state.currentResult.score +
                 ', Risk Level: ' + state.currentResult.riskLabel);
      lines.push('Decision: ' + state.currentResult.decision +
                 ', Confidence: ' + state.currentResult.confidence + '%');
      lines.push('Action: ' + state.currentResult.action +
                 ' (Source: ' + state.currentResult.actionSource + ')');
      lines.push('');
      lines.push('Signals:');
      ['identity','environment','pattern','riskEngine'].forEach(function(group){
        lines.push('');
        lines.push(group.toUpperCase());
        state.currentResult.signals[group].forEach(function(sig){
          lines.push('- ' + sig.title + ' | ' + sig.status + ' | Impact: ' + sig.displayImpact + 
                     ' | ' + sig.severity + ' | ' + sig.reason);
        });
      });
      lines.push('');
      lines.push('Breakdown:');
      state.currentResult.breakdown.forEach(function(entry){
        lines.push('- ' + entry.rule + ' | ' + entry.group + ' | ' + entry.severity +
                   ' | ' + entry.impact + ' | ' + entry.reason);
      });
      copyToClipboard(lines.join('\n')).then(function(){
        renderer.renderRunState('Report copied to clipboard.');
      }).catch(function(){
        renderer.renderRunState('Copy to clipboard failed.', true);
      });
    }
  
    function handleExport() {
      var csv = [];
      csv.push('timestamp,deviceType,os,browser,riskLabel,score,decision,action,actionSource');
      var rows = state.history.length ? state.history : [store.normalizeRecord({
        timestamp: state.currentResult.timestamp,
        deviceType: state.currentResult.profile.deviceType,
        os: state.currentResult.profile.os,
        browser: state.currentResult.profile.browser,
        userAgent: state.currentResult.profile.userAgent,
        screenSize: state.currentResult.profile.screenSize,
        timezone: state.currentResult.profile.timezone,
        riskLabel: state.currentResult.riskLabel,
        score: state.currentResult.score,
        decision: state.currentResult.decision,
        action: state.currentResult.action,
        actionSource: state.currentResult.actionSource,
        automationDetected: state.currentResult.automationDetected
      },0)];
      rows.forEach(function(r){
        csv.push([
          csvEscape(r.timestamp),
          csvEscape(r.deviceType),
          csvEscape(r.os),
          csvEscape(r.browser),
          csvEscape(r.riskLabel),
          csvEscape(r.score),
          csvEscape(r.decision),
          csvEscape(r.action),
          csvEscape(r.actionSource)
        ].join(','));
      });
      downloadFile('device-risk.csv', csv.join('\n'), 'text/csv;charset=utf-8');
      renderer.renderRunState('CSV exported.');
    }
  
    function handleClear() {
      if (window.confirm('Clear Device Risk activity history?')) {
        store.clear();
    
        state.currentResult = null;
        state.history = [];
    
        renderer.renderAll();
        renderer.renderRunState('History cleared. Ready for a new device analysis.');
    
        window.dispatchEvent(
          new CustomEvent('aiTrustOsActivityUpdated', {
            detail: {
              module: 'Device Risk',
              storageKey: 'aiTrustOsDeviceRiskActivity',
              cleared: true,
              timestamp: new Date().toISOString()
            }
          })
        );
      }
    }
  
    function bindEvents() {
      if (els.analyzeBtn) {
        els.analyzeBtn.addEventListener('click', function(){
          analyzeDevice({persist:true});
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
        els.autoToggle.addEventListener('change', function(e){
          state.autoActionEnabled = !!e.target.checked;
          store.saveAuto(state.autoActionEnabled);
          renderer.renderAutoState();
          if (state.currentResult) {
            analyzeDevice({persist:false});
          }
        });
      }
    }
  
    function init() {
      assignElements();
    
      if (!els.module) return;
    
      state.autoActionEnabled = store.loadAuto();
      state.history = store.loadHistory();
    
      if (state.history.length) {
        state.currentResult = state.history[0];
    
        if (!state.currentResult.profile) {
          state.currentResult.profile = {};
        }
    
        if (!state.currentResult.trustLevel) {
          state.currentResult.trustLevel = 'Known Device';
        }
    
        if (!state.currentResult.deviceReputation) {
          state.currentResult.deviceReputation = 'Neutral';
        }
    
      } else {
        state.currentResult = null;
      }
    
      if (els.scenarioSelect) {
        els.scenarioSelect.value = store.loadScenario();
      }
    
      bindEvents();
    
      renderer.renderAll();
    
      renderer.renderRunState(
        state.history.length
          ? 'Loaded saved activity. Click Analyze Current Device to run a new check.'
          : 'Ready. Click Analyze Current Device to start analysis.'
      );
    }
    
    function bindEvents() {
    
      if (els.analyzeBtn) {
        els.analyzeBtn.addEventListener('click', function() {
          analyzeDevice({ persist: true });
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
        els.autoToggle.addEventListener('change', function(e) {
          state.autoActionEnabled = !!e.target.checked;
          store.saveAuto(state.autoActionEnabled);
          renderer.renderAutoState();
        });
      }
    
      if (els.scenarioSelect) {
        els.scenarioSelect.addEventListener('change', function(e) {
          store.saveScenario(e.target.value);
        });
      }
    }
  
    // Expose for debugging
    window.AITrustOSDeviceRisk = {
      init: init,
      analyze: analyzeDevice,
      parser: parser,
      ruleEngine: ruleEngine,
      decisionEngine: decisionEngine,
      store: store,
      renderer: renderer
    };
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  