(function () {
    'use strict';
  
    var welcomeTimer = null;
    var buttonTextTimer = null;

var buttonMessages = [
  'Need Help?',
  'Ask About API Keys',
  'Dashboard Help',
  'Risk Score Help',
  'Contact Support'
];

var currentButtonMessageIndex = 0;
  
    var helpEmail = 'support@sherguard.com';
    var securityEmail = 'security@sherguard.com';
  
    var quickQuestions = [
      'How does the dashboard work?',
      'How do I create an API key?',
      'Where is Settings?',
      'What does High Risk mean?',
      'How does Team Management work?'
    ];
  
    var blockedTopics = [
      'hack',
      'hacking',
      'bypass',
      'crack',
      'steal',
      'exploit',
      'backend file',
      'source code',
      'admin access',
      'unlimited api',
      'free api key',
      'break limit',
      'disable billing'
    ];
  
    function normalize(value) {
      return String(value || '').toLowerCase().trim();
    }
  
    function includesAny(message, words) {
      return words.some(function (word) {
        return message.indexOf(word) !== -1;
      });
    }
  
    function createWidget() {
      var widget = document.createElement('div');
      widget.className = 'dashboard-chatbot-widget';
      widget.innerHTML = [
        '<div id="dashboardChatbotWelcome" class="dashboard-chatbot-welcome">',
        '<strong>Need help using SherGuard?</strong>',
        '<p>Ask about modules, API keys, team settings, subscriptions, results, or dashboard features.</p>',
        '</div>',
  
        '<div id="dashboardChatbotPanel" class="dashboard-chatbot-panel">',
        '<div class="dashboard-chatbot-header">',
        '<div>',
        '<strong>SherGuard Help Assistant</strong>',
        '<span>Dashboard guidance, module help, API key setup, and support answers.</span>',
        '</div>',
        '<button id="dashboardChatbotClose" class="dashboard-chatbot-close" type="button">×</button>',
        '</div>',
  
        '<div id="dashboardChatbotMessages" class="dashboard-chatbot-messages"></div>',
  
        '<div id="dashboardChatbotSuggestions" class="dashboard-chatbot-suggestions"></div>',
  
        '<div class="dashboard-chatbot-input-row">',
        '<input id="dashboardChatbotInput" type="text" placeholder="Ask a dashboard question..." />',
        '<button id="dashboardChatbotSend" type="button">Send</button>',
        '</div>',
  
        '<div class="dashboard-chatbot-support">',
        'Not satisfied with the answer? Contact a human: ',
        '<a href="mailto:' + helpEmail + '">' + helpEmail + '</a>',
        '<br />Security issue? ',
        '<a href="mailto:' + securityEmail + '">' + securityEmail + '</a>',
        '</div>',
        '</div>',
  
        '<button id="dashboardChatbotButton" class="dashboard-chatbot-button" type="button" aria-label="Open help chatbot">💬</button>'
      ].join('');
  
      document.body.appendChild(widget);
    }
  
    function addMessage(type, text) {
      var messages = document.getElementById('dashboardChatbotMessages');
  
      if (!messages) {
        return;
      }
  
      var message = document.createElement('div');
      message.className = 'dashboard-chatbot-message ' + type;
      message.textContent = text;
  
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
    }
  
    function renderSuggestions() {
      var suggestions = document.getElementById('dashboardChatbotSuggestions');
  
      if (!suggestions) {
        return;
      }
  
      suggestions.innerHTML = '';
  
      quickQuestions.forEach(function (question) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'dashboard-chatbot-suggestion';
        button.textContent = question;
  
        button.addEventListener('click', function () {
          askQuestion(question);
        });
  
        suggestions.appendChild(button);
      });
    }
  
    function answerQuestion(rawQuestion) {
      var question = normalize(rawQuestion);
  
      if (!question) {
        return 'Please type a SherGuard dashboard question.';
      }
  
      if (includesAny(question, blockedTopics)) {
        return [
          'I can only help with safe SherGuard dashboard usage, account management, module explanations, API key setup, billing guidance, and support questions.',
          '',
          'For security concerns, contact ' + securityEmail + '.'
        ].join('\n');
      }
  
      if (
        question.indexOf('dashboard') !== -1 ||
        question.indexOf('how does it work') !== -1 ||
        question.indexOf('whole dashboard') !== -1
      ) {
        return [
          'The SherGuard dashboard gives one place to monitor trust and fraud signals.',
          '',
          'Main areas:',
          '• Security Center shows your current security posture.',
          '• Enterprise Analytics shows API traffic and system activity.',
          '• Risk modules analyze Email, Device, Bot, API Abuse, and Payment Fraud.',
          '• API Key Management creates scoped developer keys.',
          '• Team Management controls users, roles, sessions, and audit logs.',
          '• Settings manages profile, password, and session security.'
        ].join('\n');
      }
  
      if (
        question.indexOf('setting') !== -1 ||
        question.indexOf('profile') !== -1 ||
        question.indexOf('password') !== -1
      ) {
        return [
          'Open the left sidebar and click Settings near the bottom.',
          '',
          'In Settings you can:',
          '• View full name, email, role, organization, plan, and verification status.',
          '• Change your password using your current password.',
          '• View session security controls.',
          '• Force logout active organization sessions if needed.'
        ].join('\n');
      }
  
      if (
        question.indexOf('api key') !== -1 ||
        question.indexOf('create api') !== -1 ||
        question.indexOf('developer key') !== -1 ||
        question.indexOf('where to put api') !== -1
      ) {
        return [
          'Go to API Key Management in the dashboard.',
          '',
          'Steps:',
          '1. Enter an API key name.',
          '2. Select allowed module scopes such as Email Risk, Device Risk, Bot Detection, API Abuse, or Payment Fraud.',
          '3. Click Create API Key.',
          '4. Copy the key immediately. It is shown only once.',
          '',
          'Use the key in your integration request header as:',
          'x-api-key: your_api_key_here'
        ].join('\n');
      }
  
      if (
        question.indexOf('email risk') !== -1 ||
        question.indexOf('email module') !== -1
      ) {
        return [
          'Email Risk Intelligence checks signup email quality and fraud indicators.',
          '',
          'It can show:',
          '• Risk score',
          '• Risk level',
          '• Final decision',
          '• Provider type',
          '• Domain type',
          '• Triggered risk reasons',
          '• Activity history',
          '',
          'Use it when you want to review fake signups, disposable emails, suspicious domains, or risky email patterns.'
        ].join('\n');
      }
  
      if (
        question.indexOf('device') !== -1 ||
        question.indexOf('fingerprint') !== -1
      ) {
        return [
          'Device Risk Intelligence checks browser, device, screen, timezone, user-agent, and automation signals.',
          '',
          'It helps detect:',
          '• Headless browsers',
          '• Bot-style devices',
          '• suspicious user agents',
          '• risky device fingerprints',
          '• repeated high-risk device patterns.',
          '',
          'Click Analyze Current Device to run the check.'
        ].join('\n');
      }
  
      if (
        question.indexOf('bot') !== -1 ||
        question.indexOf('automation') !== -1
      ) {
        return [
          'Bot Detection Intelligence analyzes behavior signals such as clicks, session time, mouse movement, scroll activity, and keypress activity.',
          '',
          'It helps detect:',
          '• fast-click bots',
          '• scraper behavior',
          '• scripted signup activity',
          '• credential stuffing patterns',
          '• AI agent automation behavior.'
        ].join('\n');
      }
  
      if (
        question.indexOf('api abuse') !== -1 ||
        question.indexOf('api module') !== -1 ||
        question.indexOf('endpoint') !== -1
      ) {
        return [
          'API Abuse Intelligence detects suspicious API traffic.',
          '',
          'It reviews:',
          '• endpoint behavior',
          '• request rate',
          '• repeated requests',
          '• missing headers',
          '• auth header status',
          '• status codes',
          '• IP reputation.',
          '',
          'Use it to identify scraping, burst traffic, token abuse, credential stuffing, and sensitive endpoint abuse.'
        ].join('\n');
      }
  
      if (
        question.indexOf('payment') !== -1 ||
        question.indexOf('fraud') !== -1 ||
        question.indexOf('chargeback') !== -1
      ) {
        return [
          'Payment Fraud Intelligence reviews transaction risk.',
          '',
          'It checks:',
          '• amount',
          '• currency',
          '• payment method',
          '• billing country',
          '• shipping country',
          '• failed attempts',
          '• VPN or proxy signals.',
          '',
          'It helps detect stolen card attempts, card testing, chargeback patterns, proxy/VPN payment abuse, and high-risk checkout behavior.'
        ].join('\n');
      }
  
      if (
        question.indexOf('ai agent') !== -1 ||
        question.indexOf('permission') !== -1 ||
        question.indexOf('policy') !== -1
      ) {
        return [
          'AI Agent Permissions controls automation boundaries across SherGuard.',
          '',
          'You can review:',
          '• Master AI enable status',
          '• Strict Mode',
          '• Auto Action',
          '• Approval Required',
          '• Permission Matrix',
          '• Allowed, restricted, and blocked actions.',
          '',
          'This section is for controlling how automated decisions are allowed to behave.'
        ].join('\n');
      }
  
      if (
        question.indexOf('team') !== -1 ||
        question.indexOf('invite') !== -1 ||
        question.indexOf('role') !== -1 ||
        question.indexOf('session') !== -1 ||
        question.indexOf('audit') !== -1
      ) {
        return [
          'Team Management controls organization access.',
          '',
          'You can:',
          '• Invite team members.',
          '• Assign admin, analyst, or viewer roles.',
          '• Disable or remove users.',
          '• Review active login sessions.',
          '• Clear inactive sessions.',
          '• Review audit logs.',
          '',
          'Admins have full access. Analysts can review and run analysis. Viewers have read-only access.'
        ].join('\n');
      }
  
      if (
        question.indexOf('subscription') !== -1 ||
        question.indexOf('plan') !== -1 ||
        question.indexOf('billing') !== -1 ||
        question.indexOf('upgrade') !== -1 ||
        question.indexOf('limit') !== -1
      ) {
        return [
          'Your current plan appears in the top organization card and in Settings.',
          '',
          'Subscription benefits may include:',
          '• higher daily usage limits',
          '• more API keys',
          '• more team members',
          '• access to production usage levels',
          '• business or enterprise support.',
          '',
          'Click Upgrade Plan at the top of the dashboard to view pricing. If you purchased a subscription but your plan does not update, contact ' + helpEmail + ' with your account email and payment details.'
        ].join('\n');
      }
  
      if (
        question.indexOf('security center') !== -1 ||
        question.indexOf('monitoring') !== -1 ||
        question.indexOf('priority') !== -1
      ) {
        return [
          'Security Center summarizes your current organization security posture.',
          '',
          'It can show:',
          '• current status such as Stable, Elevated, or Critical',
          '• priority level',
          '• current trend',
          '• recommended action.',
          '',
          'It updates from recent trust events, module activity, reputation signals, and risk trends.'
        ].join('\n');
      }
  
      if (
        question.indexOf('analytics') !== -1 ||
        question.indexOf('request') !== -1 ||
        question.indexOf('traffic') !== -1 ||
        question.indexOf('chart') !== -1
      ) {
        return [
          'Enterprise Analytics shows organization-wide API and activity metrics.',
          '',
          'It can show:',
          '• total API requests',
          '• average response time',
          '• threat events',
          '• active API keys',
          '• request volume',
          '• top endpoints.',
          '',
          'These values update from backend request logs and analytics endpoints.'
        ].join('\n');
      }
  
      if (
        question.indexOf('high risk') !== -1 ||
        question.indexOf('medium risk') !== -1 ||
        question.indexOf('low risk') !== -1 ||
        question.indexOf('risk score') !== -1
      ) {
        return [
          'SherGuard risk levels are based on score ranges:',
          '',
          '• Low Risk: score below 50',
          '• Medium Risk: score 50 to 79',
          '• High Risk: score 80 or higher',
          '',
          'Each module also shows reasons, signals, final decision, confidence, and activity history so the result is explainable.'
        ].join('\n');
      }
  
      if (
        question.indexOf('support') !== -1 ||
        question.indexOf('human') !== -1 ||
        question.indexOf('contact') !== -1 ||
        question.indexOf('problem') !== -1 ||
        question.indexOf('not working') !== -1
      ) {
        return [
          'If the dashboard answer does not solve your issue, contact a human support member.',
          '',
          'Support email: ' + helpEmail,
          'Security email: ' + securityEmail,
          '',
          'Please include:',
          '• your account email',
          '• what page or module has the problem',
          '• what you clicked',
          '• any error message or screenshot.'
        ].join('\n');
      }
  
      return [
        'I can help with SherGuard dashboard usage, modules, API keys, team management, settings, subscriptions, risk results, and support.',
        '',
        'Try asking:',
        '• How do I create an API key?',
        '• What does High Risk mean?',
        '• Where is Settings?',
        '• How does Payment Fraud work?',
        '• How do I contact support?'
      ].join('\n');
    }
  
    function askQuestion(question) {
      var input = document.getElementById('dashboardChatbotInput');
  
      if (input) {
        input.value = '';
      }
  
      addMessage('user', question);
  
      setTimeout(function () {
        addMessage('bot', answerQuestion(question));
      }, 250);
    }
  
    function sendCurrentQuestion() {
      var input = document.getElementById('dashboardChatbotInput');
  
      if (!input) {
        return;
      }
  
      var question = input.value.trim();
  
      if (!question) {
        return;
      }
  
      askQuestion(question);
    }
  
    function openChatbot() {
      var panel = document.getElementById('dashboardChatbotPanel');
      var button = document.getElementById('dashboardChatbotButton');
      var welcome = document.getElementById('dashboardChatbotWelcome');
  
      if (welcome) {
        welcome.style.display = 'none';
      }
  
      if (button) {
        button.style.display = 'none';
      }
  
      if (panel) {
        panel.classList.add('is-open');
      }
    }
  
    function closeChatbot() {
      var panel = document.getElementById('dashboardChatbotPanel');
      var button = document.getElementById('dashboardChatbotButton');
  
      if (panel) {
        panel.classList.remove('is-open');
      }
  
      if (button) {
        button.style.display = 'inline-block';
      }
    }

    function updateChatbotButtonText() {
      var button = document.getElementById('dashboardChatbotButton');
    
      if (!button) {
        return;
      }
    
      button.setAttribute(
        'data-help-text',
        buttonMessages[currentButtonMessageIndex]
      );
    
      currentButtonMessageIndex =
        (currentButtonMessageIndex + 1) % buttonMessages.length;
    }
    
    function startChatbotButtonRotation() {
      updateChatbotButtonText();
    
      buttonTextTimer = setInterval(function () {
        updateChatbotButtonText();
      }, 4000);
    }
  
    function bindEvents() {
      document.getElementById('dashboardChatbotButton')
        ?.addEventListener('click', openChatbot);
  
      document.getElementById('dashboardChatbotClose')
        ?.addEventListener('click', closeChatbot);
  
      document.getElementById('dashboardChatbotSend')
        ?.addEventListener('click', sendCurrentQuestion);
  
      document.getElementById('dashboardChatbotInput')
        ?.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            sendCurrentQuestion();
          }
        });
    }
  
    function hideWelcomeAfterDelay() {
      var welcome = document.getElementById('dashboardChatbotWelcome');
  
      welcomeTimer = setTimeout(function () {
        if (welcome) {
          welcome.style.display = 'none';
        }
      }, 3000);
    }
  
    function initChatbot() {
      createWidget();
      renderSuggestions();
      bindEvents();
  
      addMessage(
        'bot',
        'Hello. I can help you understand SherGuard modules, API keys, team settings, subscriptions, risk scores, and dashboard features.'
      );
  
      hideWelcomeAfterDelay();
      startChatbotButtonRotation();
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initChatbot);
    } else {
      initChatbot();
    }
  })();