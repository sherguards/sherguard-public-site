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
          'I cannot help with hacking, bypassing limits, stealing data, exposing private customer information, backend files, source code, API secrets, JWT tokens, billing bypass, or admin access.',
          '',
          'I can only help with safe SherGuard dashboard usage, modules, API keys, billing guidance, subscriptions, settings, and support.',
          '',
          'For security concerns, contact ' + securityEmail + '.'
        ].join('\n');
      }
    
      if (question.indexOf('dashboard') !== -1) {
        return [
          'Dashboard is the main SherGuard control center.',
          '',
          'Where it is:',
          'Left Sidebar → Dashboard',
          '',
          'What it shows:',
          '• Organization plan',
          '• Today’s usage',
          '• Security Center status',
          '• Enterprise Analytics',
          '• Global risk level',
          '• Recent activity',
          '• Risk trends across modules'
        ].join('\n');
      }
    
      if (question.indexOf('security center') !== -1) {
        return [
          'Security Center shows your current organization security posture.',
          '',
          'Where it is:',
          'Dashboard top area → Security Center card',
          '',
          'It shows:',
          '• Stable, Elevated, or Critical status',
          '• Priority level',
          '• Trend',
          '• Recommended action'
        ].join('\n');
      }
    
      if (question.indexOf('analytics') !== -1 || question.indexOf('chart') !== -1 || question.indexOf('traffic') !== -1) {
        return [
          'Enterprise Analytics shows platform activity and API traffic.',
          '',
          'Where it is:',
          'Dashboard → Enterprise Analytics',
          '',
          'It shows:',
          '• Total API requests',
          '• Average response time',
          '• Threat events',
          '• Active API keys',
          '• Request volume',
          '• Top endpoints',
          '• Risk distribution',
          '• Module activity',
          '• Risk trend'
        ].join('\n');
      }
    
      if (question.indexOf('email risk') !== -1 || question.indexOf('email module') !== -1) {
        return [
          'Email Risk Intelligence helps detect fake signup emails and risky email patterns.',
          '',
          'Where it is:',
          'Left Sidebar → Email Risk',
          '',
          'It shows:',
          '• Email risk score',
          '• Risk level',
          '• Final decision',
          '• Provider type',
          '• Domain type',
          '• Risk reasons',
          '• Activity history'
        ].join('\n');
      }
    
      if (question.indexOf('device risk') !== -1 || question.indexOf('device') !== -1 || question.indexOf('fingerprint') !== -1) {
        return [
          'Device Risk Intelligence checks browser, OS, device fingerprint, timezone, screen size, and automation signals.',
          '',
          'Where it is:',
          'Left Sidebar → Device Risk',
          '',
          'Use it to detect:',
          '• Risky devices',
          '• Headless browsers',
          '• Automation signals',
          '• Suspicious fingerprints',
          '• Repeated risky device behavior'
        ].join('\n');
      }
    
      if (question.indexOf('bot') !== -1 || question.indexOf('bot detection') !== -1 || question.indexOf('automation') !== -1) {
        return [
          'Bot Detection Intelligence analyzes behavior signals to detect automated activity.',
          '',
          'Where it is:',
          'Left Sidebar → Bot Detection',
          '',
          'It checks:',
          '• Click behavior',
          '• Session time',
          '• Mouse movement',
          '• Scroll activity',
          '• Keypress activity',
          '• Bot-like patterns'
        ].join('\n');
      }
    
      if (question.indexOf('api abuse') !== -1 || question.indexOf('endpoint') !== -1) {
        return [
          'API Abuse Intelligence detects suspicious API traffic and abuse patterns.',
          '',
          'Where it is:',
          'Left Sidebar → API Abuse',
          '',
          'It helps detect:',
          '• Burst traffic',
          '• Scraper API bots',
          '• Credential stuffing',
          '• Token abuse',
          '• Sensitive endpoint abuse',
          '• Abnormal API usage'
        ].join('\n');
      }
    
      if (question.indexOf('payment fraud') !== -1 || question.indexOf('payment') !== -1 || question.indexOf('chargeback') !== -1) {
        return [
          'Payment Fraud Intelligence reviews checkout and transaction risk.',
          '',
          'Where it is:',
          'Left Sidebar → Payment Fraud',
          '',
          'It helps detect:',
          '• Stolen card attempts',
          '• Card testing',
          '• Chargeback patterns',
          '• Proxy or VPN payment abuse',
          '• High-risk checkout behavior'
        ].join('\n');
      }
    
      if (question.indexOf('ai agent') !== -1 || question.indexOf('permission') !== -1 || question.indexOf('policy') !== -1) {
        return [
          'AI Agent Permissions controls automation boundaries across SherGuard.',
          '',
          'Where it is:',
          'Left Sidebar → AI Agent Permissions',
          '',
          'It controls:',
          '• Master AI enable',
          '• Strict Mode',
          '• Auto Action',
          '• Approval Required',
          '• Permission Matrix',
          '• Allowed, restricted, and blocked actions'
        ].join('\n');
      }
    
      if (question.indexOf('api key') !== -1 || question.indexOf('developer key') !== -1 || question.indexOf('create api') !== -1) {
        return [
          'API Key Management lets you create scoped developer API keys.',
          '',
          'Where it is:',
          'Dashboard → API Key Management',
          '',
          'How it works:',
          '1. Enter API key name.',
          '2. Select allowed modules.',
          '3. Click Create API Key.',
          '4. Copy the key immediately.',
          '',
          'Use it in requests as:',
          'x-api-key: your_api_key_here'
        ].join('\n');
      }
    
      if (question.indexOf('team') !== -1 || question.indexOf('invite') !== -1 || question.indexOf('role') !== -1) {
        return [
          'Team Management controls organization users and access.',
          '',
          'Where it is:',
          'Dashboard → Team Management',
          '',
          'It includes:',
          '• Invite team members',
          '• Assign admin, analyst, or viewer roles',
          '• Manage pending invitations',
          '• Review active sessions',
          '• Clear inactive sessions',
          '• Review audit logs'
        ].join('\n');
      }
    
      if (question.indexOf('settings') !== -1 || question.indexOf('setting') !== -1 || question.indexOf('profile') !== -1) {
        return [
          'Settings manages your account, profile, password, sessions, subscription, and account deletion.',
          '',
          'Where it is:',
          'Left Sidebar → Settings',
          '',
          'It includes:',
          '• Profile information',
          '• Current plan',
          '• Manage Subscription',
          '• Logout',
          '• Change Password',
          '• Session Security',
          '• Delete Account Permanently'
        ].join('\n');
      }
    
      if (question.indexOf('subscription') !== -1 || question.indexOf('manage subscription') !== -1) {
        return [
          'Manage Subscription opens the Paddle customer portal for paid customers.',
          '',
          'Where it is:',
          'Left Sidebar → Settings → Manage Subscription',
          '',
          'Paid customers can:',
          '• View subscription',
          '• Update payment method',
          '• View invoices',
          '• Cancel subscription',
          '',
          'Free users will see a message asking them to upgrade first.'
        ].join('\n');
      }
    
      if (question.indexOf('upgrade') !== -1 || question.indexOf('upgrade plan') !== -1) {
        return [
          'Upgrade Plan sends you to SherGuard pricing.',
          '',
          'Where it is:',
          'Top of Dashboard → Upgrade Plan',
          '',
          'Use it to choose a paid plan and unlock higher limits, more API access, more team capacity, and production usage.'
        ].join('\n');
      }
    
      if (question.indexOf('billing') !== -1 || question.indexOf('invoice') !== -1 || question.indexOf('payment method') !== -1 || question.indexOf('cancel') !== -1) {
        return [
          'Billing is managed through Paddle.',
          '',
          'Where it is:',
          'Settings → Manage Subscription',
          '',
          'After you upgrade, you can:',
          '• Manage payment method',
          '• View billing details',
          '• Download invoices',
          '• Cancel subscription',
          '',
          'If billing does not update after payment, contact ' + helpEmail + '.'
        ].join('\n');
      }
    
      if (question.indexOf('email verification') !== -1 || question.indexOf('verify email') !== -1 || question.indexOf('verification email') !== -1) {
        return [
          'Email Verification protects SherGuard accounts before login.',
          '',
          'How it works:',
          '1. Create account.',
          '2. SherGuard sends a verification email.',
          '3. Click the verification link.',
          '4. Then login is allowed.',
          '',
          'If you do not receive the email, check spam or contact ' + helpEmail + '.'
        ].join('\n');
      }
    
      if (question.indexOf('password reset') !== -1 || question.indexOf('forgot password') !== -1 || question.indexOf('reset password') !== -1) {
        return [
          'Password Reset lets you recover your account securely.',
          '',
          'Where it is:',
          'Login page → Forgot your password?',
          '',
          'How it works:',
          '1. Enter your account email.',
          '2. Open the reset email.',
          '3. Set a new password.',
          '4. Login again.'
        ].join('\n');
      }
    
      if (question.indexOf('delete account') !== -1 || question.indexOf('delete my account') !== -1 || question.indexOf('permanently delete') !== -1) {
        return [
          'Delete Account Permanently removes your SherGuard user account.',
          '',
          'Where it is:',
          'Left Sidebar → Settings → Delete Account Permanently',
          '',
          'Safety flow:',
          '1. Click Delete Account Permanently.',
          '2. Confirm.',
          '3. Enter password.',
          '4. Confirm final warning.',
          '',
          'This action cannot be undone.'
        ].join('\n');
      }
    
      if (question.indexOf('audit') !== -1 || question.indexOf('audit logs') !== -1) {
        return [
          'Audit Logs show important organization actions.',
          '',
          'Where it is:',
          'Dashboard → Team Management → Audit Logs',
          '',
          'They help track:',
          '• Admin actions',
          '• Team changes',
          '• Session actions',
          '• Security actions',
          '• Clear audit log events'
        ].join('\n');
      }
    
      return [
        'I can help with SherGuard dashboard usage, modules, API keys, team management, settings, subscriptions, billing, risk results, and support.',
        '',
        'Try asking:',
        '• Where is Settings?',
        '• How do I manage subscription?',
        '• How do I create an API key?',
        '• What does Security Center show?',
        '• How does Payment Fraud work?'
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