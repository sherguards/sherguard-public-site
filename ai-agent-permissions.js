(function () {
    'use strict';
  
    var storageKey = 'aiTrustOsAgentPermissions';
  
    var defaultModules = [
      'Email Risk',
      'Device Risk',
      'Bot Detection',
      'API Abuse',
      'Payment Fraud'
    ];
  
    var state = {
      masterAI: true,
      strictMode: false,
      autoAction: false,
      approvalRequired: true,
      riskTolerance: 'Medium',
      enforcementMode: 'Soft Block',
      lastUpdated: '',
      modules: {},
      activity: []
    };
  
    function safeText(id, value) {
      var element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    }
  
    function safeHtml(id, value) {
      var element = document.getElementById(id);
      if (element) {
        element.innerHTML = value;
      }
    }
  
    function createDefaultModules() {
      var modules = {};
  
      defaultModules.forEach(function (moduleName) {
        modules[moduleName] = {
          read: true,
          write: false,
          execute: false,
          autoAction: false,
          approvalRequired: true
        };
      });
  
      return modules;
    }
  
    function getTimestamp() {
      return new Date().toLocaleString();
    }
  
    function addActivity(action, moduleName, change, source, result) {
      state.activity.unshift({
        timestamp: getTimestamp(),
        action: action,
        module: moduleName,
        change: change,
        source: source,
        result: result
      });
  
      state.activity = state.activity.slice(0, 100);
    }
  
    function loadPolicy() {
      var savedPolicy = localStorage.getItem(storageKey);
  
      if (savedPolicy) {
        try {
          var parsedPolicy = JSON.parse(savedPolicy);
          state = Object.assign(state, parsedPolicy);
        } catch (error) {
          state.modules = createDefaultModules();
        }
      }
  
      if (!state.modules || Object.keys(state.modules).length === 0) {
        state.modules = createDefaultModules();
      }
    }
  
    function savePolicy() {
      localStorage.setItem(storageKey, JSON.stringify(state));
      
        window.aiAgentConfig = {
          masterEnabled: state.masterAI,
          strictMode: state.strictMode,
          autoAction: state.autoAction,
          approvalRequired: state.approvalRequired,
          riskTolerance: String(state.riskTolerance || 'Medium').toLowerCase(),
          enforcement: String(state.enforcementMode || 'Soft Block').toLowerCase()
        };
      }
  
    function getAllowedActions() {
      if (!state.masterAI) {
        return ['Read-only dashboard suggestions', 'Manual review recommendations'];
      }
  
      if (state.riskTolerance === 'Low') {
        return ['Read risk signals', 'Generate suggestions', 'Create manual review notes'];
      }
  
      if (state.riskTolerance === 'High') {
        return ['Read risk signals', 'Write internal decisions', 'Execute approved workflows', 'Trigger auto actions'];
      }
  
      return ['Read risk signals', 'Write policy notes', 'Execute approved actions'];
    }
  
    function getRestrictedActions() {
      if (state.strictMode) {
        return ['Auto execution', 'Policy override', 'High-risk module changes'];
      }
  
      if (state.enforcementMode === 'Monitor') {
        return ['No blocking active', 'Actions are logged only'];
      }
  
      return ['Sensitive module writes', 'Auto action without approval', 'Risk score overrides'];
    }
  
    function getBlockedActions() {
      if (state.enforcementMode === 'Hard Block') {
        return ['Unapproved execution', 'Unsafe automation', 'Permission escalation'];
      }
  
      if (!state.masterAI) {
        return ['All AI write actions', 'All AI execute actions', 'All AI auto actions'];
      }
  
      return ['Unauthorized access', 'Policy bypass attempts'];
    }
  
    function listToHtml(items) {
      return items.map(function (item) {
        return '<li>' + item + '</li>';
      }).join('');
    }
  
    function renderPolicy() {
      safeText('aiModeText', state.masterAI ? 'Enabled' : 'Disabled');
      safeText('aiStrictText', state.strictMode ? 'On' : 'Off');
      safeText('aiAutoActionText', state.autoAction ? 'On' : 'Off');
      safeText('aiApprovalText', state.approvalRequired ? 'Enabled' : 'Disabled');
      safeText('aiRiskToleranceText', state.riskTolerance);
      safeText('aiEnforcementText', state.enforcementMode);
      safeText('aiModulesCountText', String(Object.keys(state.modules).length));
      safeText('aiLastUpdatedText', state.lastUpdated || 'Not updated');
  
      safeHtml('aiAllowedActions', listToHtml(getAllowedActions()));
      safeHtml('aiRestrictedActions', listToHtml(getRestrictedActions()));
      safeHtml('aiBlockedActions', listToHtml(getBlockedActions()));
  
      var masterToggle = document.getElementById('aiMasterToggle');
      var strictToggle = document.getElementById('aiStrictToggle');
      var autoToggle = document.getElementById('aiAutoActionToggle');
      var approvalToggle = document.getElementById('aiApprovalToggle');
      var riskSelect = document.getElementById('aiRiskToleranceSelect');
      var enforcementSelect = document.getElementById('aiEnforcementSelect');
  
      if (masterToggle) masterToggle.checked = state.masterAI;
      if (strictToggle) strictToggle.checked = state.strictMode;
      if (autoToggle) autoToggle.checked = state.autoAction;
      if (approvalToggle) approvalToggle.checked = state.approvalRequired;
      if (riskSelect) riskSelect.value = state.riskTolerance;
      if (enforcementSelect) enforcementSelect.value = state.enforcementMode;
    }
  
    function renderMatrix() {
      var tableBody = document.getElementById('aiPermissionTable');
  
      if (!tableBody) {
        return;
      }
  
      tableBody.innerHTML = '';
  
      Object.keys(state.modules).forEach(function (moduleName) {
        var permissions = state.modules[moduleName];
  
        var row = document.createElement('tr');
  
        row.innerHTML =
          '<td class="ai-agent-module-name">' + moduleName + '</td>' +
          createCheckboxCell(moduleName, 'read', permissions.read) +
          createCheckboxCell(moduleName, 'write', permissions.write) +
          createCheckboxCell(moduleName, 'execute', permissions.execute) +
          createCheckboxCell(moduleName, 'autoAction', permissions.autoAction) +
          createCheckboxCell(moduleName, 'approvalRequired', permissions.approvalRequired);
  
        tableBody.appendChild(row);
      });
    }
  
    function createCheckboxCell(moduleName, permissionKey, isChecked) {
      return (
        '<td>' +
        '<input class="ai-agent-permission-toggle" type="checkbox" ' +
        'data-module="' + moduleName + '" ' +
        'data-permission="' + permissionKey + '" ' +
        (isChecked ? 'checked' : '') +
        '>' +
        '</td>'
      );
    }
  
    function renderActivityLog() {
      var activityBody = document.getElementById('aiActivityBody');
  
      if (!activityBody) {
        return;
      }
  
      if (state.activity.length === 0) {
        activityBody.innerHTML = '<tr><td colspan="6" class="ai-agent-empty-row">No activity yet.</td></tr>';
        return;
      }
  
      activityBody.innerHTML = state.activity.map(function (entry) {
        return (
          '<tr>' +
          '<td>' + entry.timestamp + '</td>' +
          '<td>' + entry.action + '</td>' +
          '<td>' + entry.module + '</td>' +
          '<td>' + entry.change + '</td>' +
          '<td>' + entry.source + '</td>' +
          '<td>' + entry.result + '</td>' +
          '</tr>'
        );
      }).join('');
    }
  
    function applyPermissions() {
      state.masterAI = !!document.getElementById('aiMasterToggle')?.checked;
      state.strictMode = !!document.getElementById('aiStrictToggle')?.checked;
      state.autoAction = !!document.getElementById('aiAutoActionToggle')?.checked;
      state.approvalRequired = !!document.getElementById('aiApprovalToggle')?.checked;
  
      var riskSelect = document.getElementById('aiRiskToleranceSelect');
      var enforcementSelect = document.getElementById('aiEnforcementSelect');
  
      if (riskSelect) {
        state.riskTolerance = riskSelect.value;
      }
  
      if (enforcementSelect) {
        state.enforcementMode = enforcementSelect.value;
      }
  
      if (state.strictMode) {
        Object.keys(state.modules).forEach(function (moduleName) {
          state.modules[moduleName].write = false;
          state.modules[moduleName].execute = false;
          state.modules[moduleName].autoAction = false;
          state.modules[moduleName].approvalRequired = true;
        });
      }
  
      if (state.approvalRequired) {
        Object.keys(state.modules).forEach(function (moduleName) {
          state.modules[moduleName].approvalRequired = true;
        });
      }
  
      state.lastUpdated = getTimestamp();
  
      addActivity(
        'Apply Permissions',
        'Global Policy',
        'Policy settings applied',
        'Manual',
        state.enforcementMode
      );
  
      savePolicy();
      renderPolicy();
      renderMatrix();
      renderActivityLog();
    }
  
    function resetPolicies() {
      state = {
        masterAI: true,
        strictMode: false,
        autoAction: false,
        approvalRequired: true,
        riskTolerance: 'Medium',
        enforcementMode: 'Soft Block',
        lastUpdated: getTimestamp(),
        modules: createDefaultModules(),
        activity: []
      };
  
      addActivity(
        'Reset Policies',
        'Global Policy',
        'Default policy restored',
        'Manual',
        'Success'
      );
  
      savePolicy();
      renderPolicy();
      renderMatrix();
      renderActivityLog();
    }
  
    function copyPolicy() {
      var policyText = JSON.stringify(state, null, 2);
  
      if (navigator.clipboard) {
        navigator.clipboard.writeText(policyText);
        addActivity('Copy Policy', 'Global Policy', 'Policy copied to clipboard', 'Manual', 'Success');
      } else {
        addActivity('Copy Policy', 'Global Policy', 'Clipboard not available', 'Manual', 'Warning');
      }
  
      savePolicy();
      renderActivityLog();
    }
  
    function exportPolicyJson() {
      var policyText = JSON.stringify(state, null, 2);
      var blob = new Blob([policyText], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
  
      link.href = url;
      link.download = 'ai-agent-permissions-policy.json';
      link.click();
  
      URL.revokeObjectURL(url);
  
      addActivity('Export Policy JSON', 'Global Policy', 'Policy JSON exported', 'Manual', 'Success');
  
      savePolicy();
      renderActivityLog();
    }
  
    function handleMatrixChange(event) {
      var target = event.target;
  
      if (!target.classList.contains('ai-agent-permission-toggle')) {
        return;
      }
  
      var moduleName = target.getAttribute('data-module');
      var permissionKey = target.getAttribute('data-permission');
  
      if (!state.modules[moduleName]) {
        return;
      }
  
      state.modules[moduleName][permissionKey] = target.checked;
      state.lastUpdated = getTimestamp();
  
      addActivity(
        'Permission Change',
        moduleName,
        permissionKey + ' changed to ' + (target.checked ? 'On' : 'Off'),
        'Manual',
        'Saved'
      );
  
      savePolicy();
      renderPolicy();
      renderActivityLog();
    }
  
    function bindEvents() {
      var applyBtn = document.getElementById('aiApplyBtn');
      var resetBtn = document.getElementById('aiResetBtn');
      var copyBtn = document.getElementById('aiCopyBtn');
      var exportBtn = document.getElementById('aiExportBtn');
      var permissionTable = document.getElementById('aiPermissionTable');
  
      if (applyBtn) applyBtn.addEventListener('click', applyPermissions);
      if (resetBtn) resetBtn.addEventListener('click', resetPolicies);
      if (copyBtn) copyBtn.addEventListener('click', copyPolicy);
      if (exportBtn) exportBtn.addEventListener('click', exportPolicyJson);
      if (permissionTable) permissionTable.addEventListener('change', handleMatrixChange);
    }
  
    function init() {
      if (!document.getElementById('aiAgentModule')) {
        return;
      }
  
      loadPolicy();
      renderPolicy();
      renderMatrix();
      renderActivityLog();
      bindEvents();
    }
  
    init();
  })();