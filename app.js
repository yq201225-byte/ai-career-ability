(() => {
  'use strict';

  const app = document.getElementById('app');
  if (!app) return;

  const KEYS = {
    session: 'aiCareer.session.v04', profile: 'user_goal_profile', topic: 'conversation_topic',
    codeContext: 'currentCodeContext', codeSession: 'codeSession', trainingProgress: 'trainingProgress',
    codeRecords: 'codeRecords', learningRecords: 'learningRecords', practiceRecords: 'practiceRecords',
    workRecords: 'workRecords', trainingCases: 'trainingCases', portfolioDrafts: 'portfolioDrafts', confirmedFacts: 'confirmedFacts',
    pendingFacts: 'pendingFacts', rejectedFacts: 'rejectedFacts', historyItems: 'historyItems', onboarding: 'aiCareer.onboarding.v04'
  };

  const BASE = {
    route: 'home', routeHistory: [], codeTab: 'current', homeDraft: '', conversationTopic: 'welcome',
    conversation: [{ role: 'ai', text: '我是 AI 学习助手。你可以直接问 AI 概念、贴代码、说项目经历；你卡在哪里，我先回答当前问题，再推荐下一步。', actions: [] }],
    userGoalProfile: { target: '', level: '', availableTime: '' }, currentCodeContext: null,
    codeSession: null, trainingProgress: null, quiz: { index: 0, answers: [] }, practice: { step: 0, answers: [] },
    learningRecords: [], practiceRecords: [], workRecords: [], trainingCases: [], codeRecords: [], portfolioDrafts: [],
    factCandidates: [], confirmedFacts: [], pendingFacts: [], rejectedFacts: [], experienceFlow: null,
    historyItems: [], onboardingComplete: false, goalChoice: '', assetView: null, assetRecord: null, draftEditor: null, viewingDraft: null, ui: { modal: null, toast: null, loading: null, pendingDelete: null, undo: null, chatScrolls: {}, chatFollow: {} }
  };

  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  };
  const save = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); };
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = glyph => `<i class="glyph" aria-hidden="true">${glyph}</i>`;
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = () => new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function hydrate() {
    const session = read(KEYS.session, {});
    const state = { ...BASE, ...session, ui: { ...BASE.ui } };
    state.userGoalProfile = read(KEYS.profile, state.userGoalProfile);
    state.conversationTopic = read(KEYS.topic, state.conversationTopic);
    state.currentCodeContext = read(KEYS.codeContext, state.currentCodeContext);
    state.codeSession = read(KEYS.codeSession, state.codeSession);
    state.trainingProgress = read(KEYS.trainingProgress, state.trainingProgress);
    state.learningRecords = read(KEYS.learningRecords, state.learningRecords);
    state.practiceRecords = read(KEYS.practiceRecords, state.practiceRecords);
    state.workRecords = read(KEYS.workRecords, state.workRecords);
    state.trainingCases = read(KEYS.trainingCases, state.trainingCases);
    state.codeRecords = read(KEYS.codeRecords, state.codeRecords);
    state.portfolioDrafts = read(KEYS.portfolioDrafts, state.portfolioDrafts);
    state.confirmedFacts = read(KEYS.confirmedFacts, state.confirmedFacts);
    state.pendingFacts = read(KEYS.pendingFacts, state.pendingFacts);
    state.rejectedFacts = read(KEYS.rejectedFacts, state.rejectedFacts);
    state.historyItems = read(KEYS.historyItems, state.historyItems);
    state.onboardingComplete = read(KEYS.onboarding, state.onboardingComplete);
    state.factCandidates = [...state.confirmedFacts, ...state.pendingFacts, ...state.rejectedFacts].sort((a, b) => (a.order || 0) - (b.order || 0));
    state.conversation = Array.isArray(state.conversation) && state.conversation.length ? state.conversation : BASE.conversation;
    if (state.conversation[0]?.role === 'ai' && /你好，我可以先帮你把一个问题讲明白/.test(state.conversation[0].text)) {
      state.conversation[0] = { ...BASE.conversation[0] };
    }
    state.quiz = { index: 0, answers: [], ...(state.quiz || {}) };
    state.practice = { step: 0, answers: [], responses: [], draft: '', feedback: null, ...(state.practice || {}) };
    state.practice.responses = Array.isArray(state.practice.responses) ? state.practice.responses : [];
    state.learningRecords = Array.isArray(state.learningRecords) ? state.learningRecords : [];
    state.practiceRecords = Array.isArray(state.practiceRecords) ? state.practiceRecords : [];
    state.workRecords = Array.isArray(state.workRecords) ? state.workRecords : [];
    state.trainingCases = Array.isArray(state.trainingCases) ? state.trainingCases : [];
    state.codeRecords = Array.isArray(state.codeRecords) ? state.codeRecords : [];
    state.portfolioDrafts = Array.isArray(state.portfolioDrafts) ? state.portfolioDrafts : [];
    if (['portfolio-incubate', 'portfolio-recommendations', 'portfolio-project'].includes(state.route)) {
      state.route = 'practice';
      state.practice = { mode: 'composite', caseId: 'knowledge', step: 0, responses: [], draft: '', feedback: null };
    }
    delete state.incubation;
    delete state.project;
    // Earlier builds stored one kind of practice record. Treat those safely as review items.
    state.practiceRecords.forEach(record => { if (!record.type) record.type = 'review'; });
    if (state.codeSession) {
      state.codeSession = {
        askedPoints: ['输入', '输出', '条件分支'], goals: ['看懂输入与输出', '看懂条件如何影响下一步', '看懂为什么需要默认分支'],
        steps: ['拆输入输出', '代码填空', '代码排序', '最小仿写', '检查这段能不能用'], trainingDirection: '基础训练库',
        unit: '基础代码理解', lesson: '从输入到输出', progress: 0, status: 'in-progress', ...state.codeSession
      };
      state.codeSession.askedPoints = Array.isArray(state.codeSession.askedPoints) ? state.codeSession.askedPoints : ['输入', '输出', '条件分支'];
      state.codeSession.goals = Array.isArray(state.codeSession.goals) ? state.codeSession.goals : ['看懂输入与输出', '看懂条件如何影响下一步', '看懂为什么需要默认分支'];
      state.codeSession.steps = Array.isArray(state.codeSession.steps) ? state.codeSession.steps : ['拆输入输出', '代码填空', '代码排序', '最小仿写', '检查这段能不能用'];
    }
    if (state.trainingProgress) {
      state.trainingProgress = { step: 0, answers: [], attempts: [], order: [2, 0, 1], imitate: '', checks: [], ...state.trainingProgress };
      state.trainingProgress.answers = Array.isArray(state.trainingProgress.answers) ? state.trainingProgress.answers : [];
      state.trainingProgress.attempts = Array.isArray(state.trainingProgress.attempts) ? state.trainingProgress.attempts : [];
      state.trainingProgress.order = Array.isArray(state.trainingProgress.order) ? state.trainingProgress.order : [2, 0, 1];
      state.trainingProgress.checks = Array.isArray(state.trainingProgress.checks) ? state.trainingProgress.checks : [];
    }
    if (!state.onboardingComplete && state.route === 'home') state.route = 'goal-setup';
    return state;
  }

  let state = hydrate();

  function syncFacts() {
    state.confirmedFacts = state.factCandidates.filter(item => item.status === 'confirmed');
    state.pendingFacts = state.factCandidates.filter(item => item.status === 'pending');
    state.rejectedFacts = state.factCandidates.filter(item => item.status === 'rejected');
  }

  function persist() {
    syncFacts();
    if (state.codeSession && state.trainingProgress) state.codeSession.progress = state.trainingProgress.step || 0;
    try {
      save(KEYS.session, {
        route: state.route, routeHistory: state.routeHistory, codeTab: state.codeTab, homeDraft: state.homeDraft,
        conversation: state.conversation, quiz: state.quiz, practice: state.practice, experienceFlow: state.experienceFlow,
        factCandidates: state.factCandidates, onboardingComplete: state.onboardingComplete, goalChoice: state.goalChoice, assetView: state.assetView, assetRecord: state.assetRecord, draftEditor: state.draftEditor, viewingDraft: state.viewingDraft
      });
      save(KEYS.profile, state.userGoalProfile); save(KEYS.topic, state.conversationTopic);
      save(KEYS.codeContext, state.currentCodeContext); save(KEYS.codeSession, state.codeSession);
      save(KEYS.trainingProgress, state.trainingProgress); save(KEYS.learningRecords, state.learningRecords);
      save(KEYS.practiceRecords, state.practiceRecords); save(KEYS.workRecords, state.workRecords); save(KEYS.trainingCases, state.trainingCases);
      save(KEYS.codeRecords, state.codeRecords); save(KEYS.portfolioDrafts, state.portfolioDrafts);
      save(KEYS.confirmedFacts, state.confirmedFacts); save(KEYS.pendingFacts, state.pendingFacts);
      save(KEYS.rejectedFacts, state.rejectedFacts); save(KEYS.historyItems, state.historyItems);
      save(KEYS.onboarding, state.onboardingComplete);
    } catch (_) {
      state.ui.modal = 'save-error';
    }
  }

  function button(label, action, options = {}) {
    const { className = '', disabled = false, data = {} } = options;
    const attrs = Object.entries(data).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
    return `<button class="button ${className}" data-action="${action}" ${attrs} ${disabled ? 'disabled aria-disabled="true"' : ''}>${label}</button>`;
  }

  function move(route, options = {}) {
    if (state.route !== route && options.history !== false) state.routeHistory.push(state.route);
    state.route = route;
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function back() { state.route = state.routeHistory.pop() || 'home'; if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function flash(message, undo = false) {
    state.ui.toast = { message, undo };
    window.setTimeout(() => {
      if (state.ui.toast?.message === message) { state.ui.toast = null; persist(); render(); }
    }, 3400);
  }
  function loading(message, callback) {
    state.ui.loading = message; render();
    window.setTimeout(() => { callback(); state.ui.loading = null; persist(); render(); }, 650);
  }
  function input(name) { return document.querySelector(`[data-field="${name}"]`)?.value.trim() || ''; }
  function followChat(key) { state.ui.chatFollow[key] = true; }
  function rememberChatScroll() {
    app.querySelectorAll('.conversation-list[data-chat-key]').forEach(list => {
      const key = list.dataset.chatKey;
      state.ui.chatScrolls[key] = list.scrollTop;
    });
  }
  function restoreChatScroll() {
    app.querySelectorAll('.conversation-list[data-chat-key]').forEach(list => {
      const key = list.dataset.chatKey;
      const shouldFollow = state.ui.chatFollow[key] || state.ui.chatScrolls[key] === undefined;
      list.scrollTop = shouldFollow ? list.scrollHeight : state.ui.chatScrolls[key];
      state.ui.chatFollow[key] = false;
      list.addEventListener('scroll', () => { state.ui.chatScrolls[key] = list.scrollTop; });
    });
    if (state.ui.focusHomeConversation) {
      state.ui.focusHomeConversation = false;
      window.setTimeout(() => document.querySelector('.home-conversation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }

  function header(backButton = false) {
    return `<header class="topbar">${backButton ? `<button class="back" data-action="back" aria-label="返回">${icon('‹')}</button><span class="brand">AI Career</span>` : `<div class="brand"><span class="brand-mark">${icon('A')}</span>AI Career</div>`}<button class="icon-button" data-action="notice" aria-label="消息提醒">${icon('◌')}</button></header>`;
  }
  function nav() {
    const items = [['home', '首页', '⌂'], ['code', '代码', '⌘'], ['portfolio', '作品集', '▣'], ['me', '我的', '●']];
    const active = ['home', 'quiz', 'practice', 'practice-hub', 'goal-setup'].includes(state.route) ? 'home' : state.route.startsWith('code') ? 'code' : state.route.startsWith('portfolio') ? 'portfolio' : 'me';
    return `<nav class="nav">${items.map(([key, label, glyph]) => `<button class="${key === active ? 'active' : ''}" data-action="nav" data-route="${key}">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav>`;
  }
  function page(content, options = {}) {
    const { useNav = true, useBack = false } = options;
    return `<div class="app-shell">${header(useBack)}${content}</div>${useNav ? nav() : ''}${modal()}${toastView()}${loadingView()}`;
  }

  function actionChips(actions = []) {
    if (!actions.length) return '';
    return `<div class="chat-actions"><div class="chat-actions-head"><b>接下来你可以</b><small>完成后会沉淀为可回看的学习资产</small></div><div>${actions.map(item => button(item.label, item.action, { className: 'secondary', data: item.data || {} })).join('')}</div></div>`;
  }
  function message(item) { return `<article class="chat-message ${item.role}"><span>${item.role === 'ai' ? 'AI Career' : '你'}</span><p>${esc(item.text)}</p>${item.role === 'ai' ? actionChips(item.actions) : ''}</article>`; }
  function appendMessage(role, text, actions = []) {
    state.conversation.push({ role, text, actions });
    followChat('home');
    if (role === 'user') {
      state.historyItems.unshift({ id: uid('history'), title: text.slice(0, 24), savedAt: now() });
      state.historyItems = state.historyItems.slice(0, 12);
    }
  }

  const goalOptions = [
    ['concept', '看懂 AI 概念', '◎'], ['pm', '转 AI 产品 / AI PM', '◆'], ['content', '做 AI 运营 / 内容', '✦'],
    ['code', '补代码理解', '⌘'], ['portfolio', '整理简历 / 作品集', '▣'], ['explore', '先随便问问', '↗']
  ];
  function goalLabel(value) { return (goalOptions.find(item => item[0] === value) || [null, '先随便问问'])[1]; }
  const targetPlans = {
    concept: {
      id: 'concept', practiceTitle: 'AI 概念判断实操', practiceKicker: 'AI 实操 · 概念理解',
      practiceTasks: [['回答一个概念问题前，先要判断什么？', ['是否有明确的问题与可用资料', '先把所有术语都背下来'], 0], ['资料不足时更合适的处理方式', ['说明缺少信息并邀请补充', '直接给出确定结论'], 0], ['理解后更合适的下一步是？', ['做小测或保存学习记录', '立刻开始完整课程'], 0]],
      codeOrder: [0, 2, 1, 3], portfolioHint: '先沉淀一个概念学习或小测记录，再补充作品项目。'
    },
    pm: {
      id: 'pm', practiceTitle: 'AI 产品路径判断实操', practiceKicker: 'AI 实操 · 产品判断',
      practiceTasks: [['面对模糊目标，第一步更适合做什么？', ['先确认目标、基础与可投入时间', '直接给出一整套学习计划'], 0], ['固定步骤、状态明确的环节更适合交给谁？', ['结构化页面与规则', '每一步都交给对话回答'], 0], ['完成一次产品判断后，应该沉淀什么？', ['可回看的决策与下一步', '只记住一个结论'], 0]],
      codeOrder: [2, 3, 1, 0], portfolioHint: '优先完成一次项目化综合练习，沉淀为明确标注的个人训练案例。'
    },
    content: {
      id: 'content', practiceTitle: 'AI 内容判断实操', practiceKicker: 'AI 实操 · 内容判断',
      practiceTasks: [['生成内容前，优先确认什么？', ['目标受众、来源与表达边界', '先追求更吸引人的措辞'], 0], ['没有证据支持的数据应该怎样处理？', ['明确标为待补充，不写进结论', '换一个更夸张的说法'], 0], ['完成内容任务后，应该保存什么？', ['可复用的内容结构与验证记录', '只保留最终标题'], 0]],
      codeOrder: [1, 3, 2, 0], portfolioHint: '可以从内容/运营场景完成一项任务型练习，再保留可回看的训练案例。'
    },
    code: {
      id: 'code', practiceTitle: '代码理解判断实操', practiceKicker: 'AI 实操 · 代码理解',
      practiceTasks: [['看一段代码时，先拆哪三件事？', ['输入、输出和决定分支的条件', '逐行背下所有语法'], 0], ['不理解默认分支时，更合适的动作是？', ['先确认空输入和兜底返回', '忽略默认分支'], 0], ['完成代码理解后，应该沉淀什么？', ['掌握点、薄弱点与下一步训练', '一次性的阅读印象'], 0]],
      codeOrder: [2, 0, 1, 3], portfolioHint: '先把代码理解训练保存为记录，再进入与目标匹配的实操任务。'
    },
    portfolio: {
      id: 'portfolio', practiceTitle: '可信表达判断实操', practiceKicker: 'AI 实操 · 表达边界',
      practiceTasks: [['生成作品集表达前，哪些内容可以进入草稿？', ['已确认且有证据支撑的事实', '任何听起来更厉害的描述'], 0], ['“我参与了项目”暂时不建议写成什么？', ['主导整个项目', '参与某个明确环节'], 0], ['草稿保存时，最需要保留什么？', ['引用的事实来源与版本内容', '只保留润色后的文字'], 0]],
      codeOrder: [3, 2, 0, 1], portfolioHint: '先把经历说清楚，逐条确认可写内容后再生成草稿。'
    },
    explore: {
      id: 'explore', practiceTitle: 'AI 概念判断实操', practiceKicker: 'AI 实操 · 概念理解',
      practiceTasks: [['回答一个概念问题前，先要判断什么？', ['是否有明确的问题与可用资料', '先把所有术语都背下来'], 0], ['资料不足时更合适的处理方式', ['说明缺少信息并邀请补充', '直接给出确定结论'], 0], ['理解后更合适的下一步是？', ['做小测或保存学习记录', '立刻开始完整课程'], 0]],
      codeOrder: [0, 2, 1, 3], portfolioHint: '先从一个明确问题开始，再决定进入代码、AI 实操或作品集。'
    }
  };
  function targetPlan(target = state.userGoalProfile.target) { return targetPlans[target] || targetPlans.explore; }
  function goalSetup() {
    const selected = state.goalChoice || state.userGoalProfile.target || '';
    const plan = selected ? targetPlan(selected) : null;
    const preview = plan ? (selected === 'pm' ? 'AI 实操、项目化综合练习、训练案例表达' : selected === 'code' ? '代码训练、理解记录、相关实操任务' : selected === 'portfolio' ? '经历整理、训练案例标签、可信草稿' : selected === 'content' ? '内容场景实操、表达边界、训练案例' : selected === 'concept' ? '概念答疑、小测、学习记录' : '从一个明确问题开始，再决定下一步') : '选择一个当前最想解决的问题即可，之后随时可以调整。';
    return `<div class="goal-shell"><header class="goal-top"><div class="brand"><span class="brand-mark">${icon('A')}</span>AI Career</div><button data-action="skip-goal">跳过</button></header><section class="goal-intro"><span>首次进入</span><h1>请选择你的目标</h1><p>我会根据你的目标，调整回答方式、练习内容、AI 实操主题推荐和作品集表达。</p></section><div class="goal-cloud">${goalOptions.map(([value, label, glyph]) => `<button class="goal-bubble ${selected === value ? 'selected' : ''}" data-action="choose-goal" data-value="${value}"><i>${selected === value ? '✓' : glyph}</i><b>${label}</b></button>`).join('')}</div><div class="goal-preview ${selected ? 'ready' : ''}"><span>${icon(selected ? '✓' : '◎')}</span><div><b>${selected ? `已选择：${goalLabel(selected)}` : '选择后会发生什么？'}</b><small>将优先推荐：${preview}</small></div></div><div class="goal-footer">${button('确认并进入首页', 'confirm-goal', { disabled: !selected })}</div></div>`;
  }
  function home() {
    const last = state.historyItems[0];
    const goal = state.userGoalProfile.target || 'explore';
    const cards = [
      ['concept', '概念答疑', '先把一个问题讲明白', '◎', 'ask-rag'], ['pm', 'AI 实操', '完成一次可检查的产品任务', '◆', 'start-composite'],
      ['code', '代码理解', '进入训练库，练会一段代码', '⌘', 'open-code'], ['portfolio', '作品集表达', '先确认真实内容再表达', '▣', 'start-experience']
    ].sort((a, b) => (a[0] === goal ? -1 : b[0] === goal ? 1 : 0));
    const latestCase = state.trainingCases[0];
    const recommended = state.codeSession ? ['继续上次代码训练', `${state.codeSession.title} · 已完成 ${state.trainingProgress?.step || 0}/5 步`, 'continue-code', '代码训练'] : latestCase ? ['回看最近训练案例', `${latestCase.title} · 已保存检查与复盘`, 'open-training-cases', '训练案例'] : [goal === 'pm' ? '开始一次项目化综合练习' : goal === 'portfolio' ? '确认一条可写事实' : goal === 'code' ? '开始一段代码理解' : '从一个明确问题开始', goal === 'pm' ? '完成需求判断、状态设计与测试复盘' : goal === 'portfolio' ? '确认事实后，再生成可信表达' : goal === 'code' ? '粘贴一段看不懂的代码，我会先解释整体作用' : '问一个概念问题，再决定下一步', goal === 'pm' ? 'start-composite' : goal === 'portfolio' ? 'portfolio-facts' : goal === 'code' ? 'go-home-code' : 'ask-rag', '今日推进'];
    const assetTotal = state.learningRecords.length + state.codeRecords.length + state.workRecords.length + state.trainingCases.length + state.portfolioDrafts.length;
    return page(`<section class="home-page"><div class="home-greeting"><div><p class="eyebrow">当前目标</p><h1>你好，${esc(goalLabel(goal))}</h1></div><button class="goal-switch" data-action="open-goal-setup">调整${icon('›')}</button></div><article class="today-card"><div class="today-card-head"><span>${icon('✦')} ${recommended[3]}</span><small>${assetTotal} 条能力资产</small></div><h2>${recommended[0]}</h2><p>${esc(recommended[1])}</p><footer><span class="today-progress"><i></i>现在就做一小步</span>${button('继续', recommended[2], { className: 'today-action' })}</footer></article><div class="section-head home-section-head"><h2 class="section-title">你可以从这里开始</h2><button class="text-action" data-action="review-history">回顾对话</button></div><div class="home-feature-grid">${cards.map(([type, title, note, glyph, action]) => `<button class="home-feature ${type}" data-action="${action}"><span>${icon(glyph)}</span><b>${title}</b><small>${note}</small>${icon('›')}</button>`).join('')}</div><div class="home-summary-grid"><button class="summary-entry" data-action="review-history">${icon('↺')}<span><b>回顾上次对话</b><small>${last ? esc(last.title) : '还没有已保存的对话'}</small></span>${icon('›')}</button><button class="summary-entry" data-action="nav" data-route="me">${icon('▣')}<span><b>能力资产中心</b><small>${assetTotal ? `已沉淀 ${assetTotal} 条，可继续回看与使用` : '完成学习、训练或 AI 实操后会沉淀在这里'}</small></span>${icon('›')}</button></div>
  <section class="conversation-panel home-conversation"><div class="conversation-head"><div><b>AI 学习助手</b><small>理解问题，判断下一步</small></div><span class="role-badge">开放问答</span></div><p class="assistant-intro">你可以直接问 AI 概念、贴代码、说项目经历；我先回答当前问题，再推荐下一步。</p><div class="home-prompt-row"><button data-action="ask-rag">什么是 RAG？</button><button data-action="go-home-code">看懂一段代码</button><button data-action="start-composite">做一次 AI PM 练习</button></div><div class="conversation-list" data-chat-key="home">${state.conversation.map(message).join('')}</div><label class="ask-box">${icon('⌕')}<input data-field="homeDraft" value="${esc(state.homeDraft)}" placeholder="向 AI 学习助手提问..."><button class="send" data-action="ask" aria-label="发送">${icon('↗')}</button></label></section>
    </section>`);
  }

  function classify(text) {
    if (/代码|报错|function|def|return|state|next|error|API|JSON|response|```/i.test(text)) return 'code';
    if (/没有项目|没项目|还没有项目|做个项目|想做项目/i.test(text)) return 'no-project';
    if (/参与.{0,8}项目|项目经历|简历|作品集|写厉害点|包装一下/i.test(text)) return 'experience';
    if (/LLM.{0,10}RAG|RAG.{0,10}(区别|不同)|大模型.{0,8}检索/i.test(text)) return 'llm-rag';
    if (/什么是 RAG|RAG 是什么|RAG.*原理|检索增强/i.test(text)) return 'rag';
    if (/什么是 Agent|Agent.*(是什么|原理|做什么)|智能体/i.test(text)) return 'agent';
    if (/Prompt|提示词/i.test(text)) return 'prompt';
    if (/AI 产品经理|AI PM|PRD|需求分析|产品方案/i.test(text)) return 'pm';
    if (/AI 运营|内容运营|内容怎么做/i.test(text)) return 'content';
    if (/不知道|从哪开始|迷茫|怎么学|转 AI 产品|想学 AI|学 AI/i.test(text)) return 'fuzzy';
    return 'general';
  }
  function learningActions() {
    return [{ label: '继续追问', action: 'ask-rag-followup' }, { label: '做 3 道小测', action: 'start-quiz' }, { label: '进入 AI 实操', action: 'start-practice' }, { label: '保存学习记录', action: 'save-learning' }];
  }
  function homeReply(intent, query) {
    const prior = state.conversationTopic;
    if (/举例|例子|怎么用/.test(query) && prior === 'rag') return { topic: 'rag', text: '举个例子：员工问“报销怎么申请”，系统先从公司的报销制度里找到相关条款，再基于条款组织回答。资料负责提供依据，模型负责把依据说清楚。', actions: learningActions() };
    if (/举例|例子|怎么用/.test(query) && prior === 'agent') return { topic: 'agent', text: '例如用户说“我想完成一次 AI 产品练习”，系统可以先判断任务是否明确；明确时进入有交付和检查标准的实操，不明确时先追问当前目标。重点不是“多说一句”，而是根据状态选择下一步。', actions: [{ label: '做一次 AI PM 练习', action: 'start-composite' }, { label: '看懂相关代码', action: 'go-home-code' }] };
    const replies = {
      rag: { text: 'RAG 可以理解为“开卷回答”：先从相关资料里找依据，再基于这些内容组织回答。它适合知识库问答，也能减少只凭模型记忆回答带来的偏差。', actions: learningActions() },
      'llm-rag': { text: 'LLM 更像负责理解和生成的“大脑”；RAG 则是在回答前先从指定资料里找依据，再交给模型组织答案。一个提供生成能力，一个让回答基于资料。', actions: learningActions() },
      agent: { text: 'Agent 不是单纯多轮聊天，而是能根据目标、当前状态和规则决定下一步动作的协作流程。它可以回答、追问、调用工具或转入固定任务，但每一步都应有边界。', actions: [{ label: '看一个路由例子', action: 'go-home-code' }, { label: '继续问 Agent', action: 'ask-rag-followup' }] },
      prompt: { text: 'Prompt 是你给 AI 的任务说明。一个更有效的 Prompt 通常会写清目标、已有材料、输出格式和限制条件；它不是“越长越好”，而是让任务边界更明确。', actions: [{ label: '做一次任务实操', action: 'start-practice' }, { label: '保存学习记录', action: 'save-learning' }] },
      pm: { text: 'AI 产品工作不是只写 PRD。你需要先判断问题是否明确，再决定哪里由 AI 协助、哪里必须由规则和用户确认。可以先完成一次有任务背景、检查标准和复盘的练习，再沉淀为个人训练案例。', actions: [{ label: '做一次 AI PM 练习', action: 'start-composite' }, { label: '看看可写事实', action: 'start-experience' }] },
      content: { text: '做 AI 内容或运营时，先确认受众、内容目标、事实来源和审核边界。AI 可以协助拆任务和检查表达，但未经验证的数据、效果和职责不能直接写进结论。', actions: [{ label: '做一次内容实操', action: 'start-practice' }, { label: '整理真实经历', action: 'start-experience' }] },
      experience: { text: '我可以先帮你把经历说清楚，但不会直接把“参与”改写成“主导”。接下来会逐步澄清你的职责、交付物、数据、协作边界和证明材料，再由你确认哪些能写。', actions: [{ label: '把经历说清楚', action: 'start-experience' }, { label: '查看作品集', action: 'nav', data: { route: 'portfolio' } }] },
      'no-project': { text: '没有真实项目经历时，先不要生成一段看起来完整的作品集表达。你可以完成一次项目化综合练习，留下自己的提交、检查反馈和复盘；它会被明确标注为个人训练案例，而不是工作项目。', actions: [{ label: '开始项目化综合练习', action: 'start-composite' }, { label: '先看一个概念', action: 'ask-rag' }] },
      general: { text: '我可以先帮你把当前问题拆清楚。你可以直接问一个 AI 概念、贴一段看不懂的代码，或说说你想做的项目和已有经历；我会按不同任务给你不同的下一步。', actions: [{ label: '什么是 RAG？', action: 'ask-rag' }, { label: '看懂一段代码', action: 'go-home-code' }, { label: '说说项目经历', action: 'start-experience' }] }
    };
    return { topic: intent, ...(replies[intent] || replies.general) };
  }
  function askHome() {
    const query = input('homeDraft') || state.homeDraft;
    if (!query) { flash('先输入一个想解决的问题'); return; }
    appendMessage('user', query); state.homeDraft = '';
    if (state.currentCodeContext?.isCodeContextActive && /懂了|好的|明白了|先这样|差不多懂了/.test(query)) {
      state.currentCodeContext.lastUserIntent = 'ready-for-training';
      appendMessage('ai', '看起来你已经理解了大概意思。要不要把这段代码变成一组练习，检查自己是不是真的会了？', [{ label: '生成代码训练', action: 'create-code-training' }, { label: '继续追问', action: 'code-followup' }]);
      return;
    }
    const intent = classify(query);
    if (intent === 'code') {
      const partial = query.length > 560;
      state.currentCodeContext = {
        rawInput: query, codeSnippet: partial ? `${query.slice(0, 560)}\n// 已折叠其余内容` : query,
        explanationSummary: '根据当前状态判断信息是否足够，再决定先澄清还是直接回答。', askedPoints: [],
        lastUserIntent: 'code-question', isCodeContextActive: true, partial
      };
      appendMessage('ai', `${partial ? '我先基于你贴出的前半段解释：' : ''}这段代码的整体作用是：根据当前状态判断下一步要进入哪个流程。你可以先看 3 件事：输入是什么、输出是什么、哪个条件决定下一步。`, [{ label: '继续追问', action: 'code-followup' }, { label: '生成代码训练', action: 'create-code-training' }, { label: '保存代码理解记录', action: 'save-code-summary' }]);
      return;
    }
    if (intent === 'fuzzy') {
      state.clarify = { step: 0, answers: {} };
      appendMessage('ai', '我先不直接给你一大套学习计划。你现在更想先解决哪类问题？', goalActions());
      return;
    }
    const reply = homeReply(intent, query);
    state.conversationTopic = reply.topic;
    appendMessage('ai', reply.text, reply.actions);
  }
  function goalActions() { return [{ label: '看懂 AI 概念', action: 'clarify-choice', data: { value: 'concept' } }, { label: '完成一次 AI PM 练习', action: 'clarify-choice', data: { value: 'pm' } }, { label: '补代码理解能力', action: 'clarify-choice', data: { value: 'code' } }, { label: '整理简历 / 作品集', action: 'clarify-choice', data: { value: 'portfolio' } }]; }
  function clarifyActions() { return [{ label: '刚开始了解', action: 'clarify-choice', data: { value: 'beginner' } }, { label: '看过一些概念', action: 'clarify-choice', data: { value: 'aware' } }, { label: '已有实践经验', action: 'clarify-choice', data: { value: 'practiced' } }]; }
  function timeActions() { return [{ label: '1–3 天', action: 'clarify-choice', data: { value: '1-3-days' } }, { label: '5–7 天', action: 'clarify-choice', data: { value: '5-7-days' } }, { label: '2 周以上', action: 'clarify-choice', data: { value: '2-weeks-plus' } }]; }
  function chooseClarify(value) {
    const flow = state.clarify;
    if (!flow) return;
    if (flow.step === 0) { flow.answers.goal = value; flow.step = 1; appendMessage('user', { concept: '看懂 AI 概念', pm: '完成一次 AI PM 练习', code: '补代码理解能力', portfolio: '整理简历 / 作品集' }[value]); appendMessage('ai', '了解。你目前的基础更接近哪一种？', clarifyActions()); }
    else if (flow.step === 1) { flow.answers.level = value; flow.step = 2; appendMessage('user', { beginner: '刚开始了解', aware: '看过一些概念', practiced: '已有实践经验' }[value]); appendMessage('ai', '最后确认一下：你这段时间大概能投入多久？', timeActions()); }
    else { flow.answers.time = value; appendMessage('user', { '1-3-days': '1–3 天', '5-7-days': '5–7 天', '2-weeks-plus': '2 周以上' }[value]); const goal = flow.answers.goal; const next = goal === 'pm' ? { label: '开始 AI PM 综合练习', action: 'start-composite' } : goal === 'code' ? { label: '补一段代码理解', action: 'go-home-code' } : goal === 'portfolio' ? { label: '把经历说清楚', action: 'start-experience' } : { label: '先学一个 RAG 概念', action: 'ask-rag' }; appendMessage('ai', '我会先给你一条轻量下一步，不把你推进完整课程。先完成这一件小事，再决定是否继续深入。', [next]); state.userGoalProfile = { target: goal, level: flow.answers.level, availableTime: value }; state.clarify = null; }
  }

  const quizQuestions = [
    ['RAG 与直接回答最大的区别是？', ['先检索相关资料，再组织回答', '把所有资料一次性输入模型', '只依赖模型参数中的记忆'], 0],
    ['RAG 的“检索”主要解决什么？', ['从相关资料中找到依据', '让回答变得更长', '替代人工确认'], 0],
    ['完成解释后，产品更合适的下一步是？', ['给用户一个轻量、可选的下一步', '强制进入完整课程', '直接结束对话'], 0]
  ];
  function quizScreen() {
    const q = quizQuestions[state.quiz.index]; const selected = state.quiz.answers[state.quiz.index];
    return page(`<section><p class="eyebrow">知识小测 · RAG</p><h1 class="hero-title">用三个问题，<br>确认自己是否理解。</h1><div class="exercise glass-card"><span class="card-kicker">第 ${state.quiz.index + 1} 题 / 3</span><h3>${q[0]}</h3>${q[1].map((item, index) => `<button class="choice ${selected === index ? 'selected' : ''}" data-action="quiz-select" data-index="${index}">${item}</button>`).join('')}${selected !== undefined ? `<p class="feedback ${selected === q[2] ? 'good' : 'bad'}">${selected === q[2] ? '回答正确，已抓住关键点。' : '再想一想：RAG 的关键在于回答前先找到相关依据。'}</p>` : ''}<div class="action-row">${button(state.quiz.index === 2 ? '完成并保存' : '下一题', 'quiz-next', { disabled: selected === undefined })}</div></div></section>`, { useNav: false, useBack: true });
  }
  const practiceScenarios = {
    concept: [
      ['判断回答依据', '用户问“什么是 RAG？”。请写下回答前你会优先确认的依据。', '可以写资料来源、检索范围或问题是否明确。', ['资料', '检索', '来源', '问题']],
      ['处理信息缺口', '资料不足时，请写一句不会误导用户的回应。', '不要补造结论；说明缺少什么，并邀请用户补充。', ['缺少', '补充', '不确定', '资料']],
      ['设计下一步', '写一个回答后可选、轻量的下一步。', '可以是小测、保存学习记录或继续追问。', ['小测', '保存', '追问', '学习记录']]
    ],
    pm: [
      ['澄清模糊目标', '用户说“我想转 AI 产品，但不知道从哪开始”。请提出两个澄清问题。', '至少覆盖目标、基础或可投入时间中的两项。', ['目标', '基础', '时间', '投入']],
      ['划分 AI 与规则', '写下一个固定步骤更适合如何处理，并说明原因。', '例如：事实确认交给结构化页面与用户确认。', ['规则', '确认', '结构化', '固定']],
      ['沉淀产品判断', '用一句话写下本轮你希望留下的产品产物。', '可以是澄清卡、状态流或走查记录。', ['澄清', '状态', '走查', '产物']]
    ],
    content: [
      ['确认内容边界', '为一条 AI 内容任务写下开始前需要确认的两项信息。', '优先写受众、来源、目标或事实边界。', ['受众', '来源', '目标', '事实']],
      ['处理未经验证的表述', '把“效果很好”改写成一条不夸大的表达。', '没有证据时，不能补造数据或结果。', ['暂无', '待补充', '反馈', '验证']],
      ['留下复用资产', '写下这次内容任务结束后要保留的一个资产。', '可以是内容结构、审核记录或案例素材。', ['结构', '审核', '记录', '素材']]
    ],
    code: [
      ['拆解代码输入输出', '针对一段路由函数，写下它的输入、输出和关键判断。', '至少包含输入、输出或条件分支中的两项。', ['输入', '输出', '条件', '分支']],
      ['检查默认分支', '写下空输入或条件不满足时，函数应该如何处理。', '关注默认返回、兜底分支或错误处理。', ['默认', '兜底', '返回', '错误']],
      ['形成训练记录', '写下你还需要继续练习的一个代码点。', '可以是条件、状态、返回值或接口字段。', ['条件', '状态', '返回', '接口']]
    ],
    portfolio: [
      ['澄清真实职责', '把“我参与了 AI 项目”补成一句真实、边界清楚的描述。', '写你实际完成的环节，避免直接使用“主导”。', ['参与', '完成', '负责', '协助']],
      ['补充证明材料', '写下可用于证明这条经历的一项材料。', '可以是 PRD、原型、Demo、截图、链接或测试表。', ['PRD', '原型', 'Demo', '截图', '链接', '测试']],
      ['确定可写边界', '写下草稿生成前必须满足的一条规则。', '例如：只有已确认事实才可以进入草稿。', ['确认', '事实', '草稿', '证据']]
    ]
  };
  practiceScenarios.explore = practiceScenarios.concept;
  function practiceScenario(target, step) { return (practiceScenarios[target] || practiceScenarios.concept)[step]; }
  function checkPracticeResponse(target, step, response) {
    const [, , , keywords] = practiceScenario(target, step);
    const matched = keywords.filter(keyword => response.toLowerCase().includes(keyword.toLowerCase()));
    return { passed: matched.length > 0 && response.length >= 8, matched, suggestion: matched.length ? `已识别到“${matched.join('、')}”。再检查这句话是否对应了当前任务。` : `先补充与“${keywords.slice(0, 3).join('、')}”有关的具体内容，再提交检查。` };
  }
  function practiceScreen() {
    if (state.practice.mode === 'composite') return compositePracticeScreen();
    const plan = targetPlan(state.practice.target);
    const [title, task, hint] = practiceScenario(plan.id, state.practice.step);
    const feedback = state.practice.feedback;
    return page(`<section class="task-workbench"><p class="eyebrow">AI 实操 · 任务协作</p><h1 class="hero-title">先动手完成，<br>再由 AI 帮你检查。</h1><div class="task-role"><span class="round-icon green">${icon('✦')}</span><span><b>任务协作与质量检查助手</b><small>协助拆任务、检查输出、建议下一次修改</small></span><em>${state.practice.step + 1} / 3</em></div><div class="task-steps">${[0, 1, 2].map(index => `<span class="${index < state.practice.step ? 'done' : index === state.practice.step ? 'current' : ''}">${index + 1}</span>`).join('')}</div><article class="task-context glass-card"><span class="card-kicker">本步任务 · ${esc(title)}</span><h3>${esc(task)}</h3><p>${esc(hint)}</p></article><label class="task-input"><span>你的提交内容</span><textarea data-field="practiceResponse" placeholder="先写下你的判断或方案，再提交检查">${esc(state.practice.draft || '')}</textarea></label>${feedback ? `<section class="task-review ${feedback.passed ? 'passed' : 'needs-work'}"><div><span>${icon(feedback.passed ? '✓' : '!')}</span><b>${feedback.passed ? 'AI 检查通过' : '还需要补充'}</b></div><p>${esc(feedback.suggestion)}</p>${feedback.passed ? `<small>可以进入下一步；完成后会沉淀本次实操记录。</small>` : '<small>修改后可再次提交，不会清空你的内容。</small>'}</section>` : ''}<div class="action-row">${button(feedback?.passed ? (state.practice.step === 2 ? '完成实操并保存' : '进入下一步') : '提交给 AI 检查', feedback?.passed ? 'practice-next' : 'practice-submit')}${feedback && !feedback.passed ? button('继续修改', 'practice-edit', { className: 'ghost' }) : ''}</div></section>`, { useNav: false, useBack: true });
  }

  const compositeThemes = {
    knowledge: {
      title: 'AI 知识库问答案例',
      subtitle: '个人训练案例 · AI PM 综合练习',
      background: '知识库问答经常在用户问题模糊时直接回答，导致结果答非所问。你需要为首轮澄清与兜底状态做一次产品判断。',
      deliverable: '目标用户判断、首轮澄清策略、状态与兜底方案、测试场景。',
      steps: [
        ['问题判断', '写清目标用户、核心问题与一个典型使用场景。', ['目标用户', '核心问题', '场景']],
        ['状态设计', '说明明确问题、模糊问题和无法判断时分别进入什么状态。', ['明确', '模糊', '兜底']],
        ['测试复盘', '写至少两个测试场景，并说明你要观察什么。', ['测试', '场景', '观察']]
      ]
    },
    workflow: {
      title: 'AI 工作流设计案例',
      subtitle: '个人训练案例 · AI PM 综合练习',
      background: '用户希望把复杂需求交给 AI，但其中有些步骤需要理解和生成，有些步骤必须由规则或用户确认。你需要划分边界。',
      deliverable: '任务拆解、AI 与规则边界、失败兜底、一次复盘。',
      steps: [
        ['任务拆解', '写清用户要完成的任务，以及本次不处理的范围。', ['任务', '范围']],
        ['边界判断', '说明哪一步由 AI 协助、哪一步由规则或用户确认。', ['AI', '规则', '确认']],
        ['失败复盘', '写一个失败场景、兜底方式与检查动作。', ['失败', '兜底', '检查']]
      ]
    },
    fact: {
      title: '可信表达边界案例',
      subtitle: '个人训练案例 · AI PM 综合练习',
      background: '候选人说自己“参与了 AI 项目”，同时希望把表达写得像主导。你需要设计一套先澄清事实、再决定表达边界的流程。',
      deliverable: '事实分类、表达强度判断、确认门禁与边界测试场景。',
      steps: [
        ['事实分类', '区分哪些是用户已说明的真实事实，哪些还需要补充证明。', ['事实', '证明', '待补充']],
        ['门禁设计', '写清哪些内容可以进入草稿，哪些内容必须被拦截。', ['确认', '草稿', '拦截']],
        ['边界复盘', '写一个夸大表达场景，并说明系统如何提醒与兜底。', ['夸大', '提醒', '兜底']]
      ]
    }
  };
  const compositePriorities = {
    pm: ['knowledge', 'workflow', 'fact'],
    concept: ['knowledge', 'workflow', 'fact'],
    content: ['workflow', 'fact', 'knowledge'],
    portfolio: ['fact', 'knowledge', 'workflow'],
    code: ['workflow', 'knowledge', 'fact'],
    explore: ['knowledge', 'workflow', 'fact']
  };
  function practiceHub() {
    const target = state.userGoalProfile.target || 'explore';
    const order = compositePriorities[target] || compositePriorities.explore;
    const reasons = {
      pm: '与你当前的 AI 产品目标匹配，先练问题判断、状态设计和测试复盘。',
      concept: '从概念理解延伸到一次具体的产品判断练习。',
      content: '优先练清楚 AI、规则与人工确认之间的边界。',
      portfolio: '先练事实边界与确认门禁，再处理可信表达。',
      code: '先完成一次状态与兜底判断，再回到代码训练验证实现。',
      explore: '先从一个边界清楚、可在平台内完成的案例开始。'
    };
    return page(`<section class="practice-hub"><p class="eyebrow">AI 实操</p><h1 class="hero-title">把岗位能力变成<br>一次次可检查的任务。</h1><div class="notice"><strong>当前优先目标：</strong>${esc(goalLabel(target))}。${esc(reasons[target] || reasons.explore)}</div><div class="practice-hub-role"><span class="round-icon green">${icon('✦')}</span><div><b>任务协作与质量检查助手</b><small>每项练习都有任务背景、用户提交、检查标准、修改循环与可回看的记录。</small></div></div><div class="theme-grid">${order.map((id, index) => { const theme = compositeThemes[id]; return `<article class="theme-card ${index === 0 ? 'recommended' : ''}"><span class="card-kicker">${index === 0 ? '优先推荐' : '进阶主题'}</span><h3>${esc(theme.title)}</h3><p>${esc(theme.background)}</p><div><b>本次交出</b><small>${esc(theme.deliverable)}</small></div><footer>${button(index === 0 ? '开始这项练习' : '查看并开始', 'choose-composite-theme', { data: { caseId: id }, className: index === 0 ? '' : 'secondary' })}</footer></article>`; }).join('')}</div><p class="quiet-note">完成的是平台内的训练任务。保存后会标为“个人训练案例”，不等于真实项目、上线结果或工作经历。</p></section>`);
  }
  function compositeTheme() { return compositeThemes[state.practice.caseId] || compositeThemes.knowledge; }
  function beginComposite(caseId = 'knowledge') {
    state.practice = { mode: 'composite', caseId, step: 0, responses: [], draft: '', feedback: null, startedAt: now() };
    move('practice');
  }
  function compositeFeedback(response) {
    const [, , required] = compositeTheme().steps[state.practice.step];
    const matched = required.filter(word => response.includes(word));
    return {
      passed: response.trim().length >= 20 && matched.length >= 2,
      matched,
      suggestion: matched.length >= 2 && response.trim().length >= 20
        ? `已覆盖：${matched.join('、')}。请确认这不是泛泛描述，而是和当前案例有关的具体判断。`
        : `还需要补充更具体的判断。本步至少应说明：${required.join('、')}。`
    };
  }
  function compositePracticeScreen() {
    const theme = compositeTheme(); const [title, task, required] = theme.steps[state.practice.step]; const feedback = state.practice.feedback;
    return page(`<section class="task-workbench"><p class="eyebrow">AI 实操 · 项目化综合练习</p><h1 class="hero-title">完成一次能力任务，<br>不假装完成真实项目。</h1><div class="task-role"><span class="round-icon green">${icon('✦')}</span><span><b>任务协作与质量检查助手</b><small>只检查本次训练的完成度、规则覆盖与内容自洽</small></span><em>${state.practice.step + 1} / ${theme.steps.length}</em></div><article class="task-context glass-card"><span class="card-kicker">训练主题 · ${esc(theme.title)}</span><h3>任务背景</h3><p>${esc(theme.background)}</p><div class="record-detail"><b>本次需要交出</b><p>${esc(theme.deliverable)}</p><b>完成后如何保存</b><p>保存为个人训练案例，保留你的提交、检查反馈和修改历史；它不是真实项目经历。</p></div></article><div class="task-steps">${theme.steps.map((step, index) => `<span class="${index < state.practice.step ? 'done' : index === state.practice.step ? 'current' : ''}">${index + 1}</span>`).join('')}</div><article class="task-context glass-card"><span class="card-kicker">本步任务 · ${esc(title)}</span><h3>${esc(task)}</h3><p>检查重点：${esc(required.join('、'))}</p></article><label class="task-input"><span>你的提交内容</span><textarea data-field="compositeResponse" placeholder="写下你自己的产品判断；通过检查后仍可继续修改">${esc(state.practice.draft || '')}</textarea></label>${feedback ? `<section class="task-review ${feedback.passed ? 'passed' : 'needs-work'}"><div><span>${icon(feedback.passed ? '✓' : '!')}</span><b>${feedback.passed ? '本步检查通过' : '还需要补充'}</b></div><p>${esc(feedback.suggestion)}</p><small>${feedback.passed ? '可以进入下一步；所有步骤完成后会保存为个人训练案例。' : '修改后再次提交，当前内容不会丢失。'}</small></section>` : ''}<div class="action-row">${button(feedback?.passed ? (state.practice.step === theme.steps.length - 1 ? '完成并保存训练案例' : '进入下一步') : '提交检查', feedback?.passed ? 'composite-next' : 'composite-submit')}${feedback && !feedback.passed ? button('继续修改', 'composite-edit', { className: 'ghost' }) : ''}</div></section>`, { useNav: false, useBack: true });
  }
  function saveCompositeCase() {
    const theme = compositeTheme();
    const record = { id: uid('training-case'), title: theme.title, label: '个人训练案例', source: 'AI 实操 · 项目化综合练习', taskBrief: theme.background, deliverable: theme.deliverable, submissions: [...state.practice.responses], checkResults: theme.steps.map((step, index) => ({ step: step[0], result: '通过', submittedAt: now() })), revisionHistory: [{ at: now(), note: '完成三步任务并通过检查' }], reflection: '本案例用于展示个人训练过程，不代表真实上线、团队项目或工作经历。', status: '已保存', savedAt: now(), nextSuggestion: '到作品集中按“个人训练案例”类型确认可写内容' };
    state.trainingCases.unshift(record);
    state.workRecords.unshift({ id: uid('practice'), kind: 'practice', title: theme.title, note: '完成项目化综合练习：已保存提交、检查结果与复盘。', nextSuggestion: '回看训练案例，或进入作品集确认案例表达边界', savedAt: now() });
    state.practiceRecords.unshift({ id: uid('review'), type: 'review', title: `${theme.title} · 待复习`, note: '复盘本次产品判断与检查反馈', nextSuggestion: '重新查看训练案例中的修改点', savedAt: now() });
    move('me'); flash('个人训练案例已保存到“我的”');
  }

  const directions = [
    { title: '新手先看懂基础代码', note: '变量、条件与返回值', units: [['基础语法与数据', ['变量在传什么', '条件如何判断', '函数返回什么']], ['阅读一段小程序', ['从输入到输出', '定位关键分支', '找到默认结果']]] },
    { title: '看懂接口和数据返回', note: '请求、字段和异常分支', units: [['请求与响应', ['请求参数是什么', '返回字段怎么读', '空数据如何处理']], ['异常与边界', ['状态码意味着什么', '错误信息怎么用', '什么时候要重试']]] },
    { title: '看懂 AI 应用里的代码', note: '状态、路由和下一步', units: [['Agent 状态和路由', ['看懂 router 怎么决定下一步', '理解 state 的来源', '兜底分支为什么必要']], ['回答与澄清', ['什么时候先澄清', '回答后如何给下一步', '把上下文传下去']]] },
    { title: '看懂 Demo 状态和交互', note: '保存、返回和页面状态', units: [['状态管理', ['记录怎样保存', '返回如何保持上下文', '删除如何撤销']], ['交互边界', ['按钮何时不可用', '加载时用户看到什么', '失败后如何重试']]] }
  ];
  function code() {
    const tabs = [['current', 'A · 当前训练'], ['library', 'B · 基础训练库'], ['records', 'C · 理解记录']];
    let content = state.codeTab === 'current' ? currentPanel() : state.codeTab === 'library' ? libraryPanel() : recordPanel();
    return page(`<section><p class="eyebrow">代码训练</p><h1 class="hero-title">把看过的代码，<br>变成一步步练会的小训练。</h1><div class="tabs">${tabs.map(([key, label]) => `<button class="${state.codeTab === key ? 'active' : ''}" data-action="code-tab" data-tab="${key}">${label}</button>`).join('')}</div>${content}</section>`);
  }
  function currentPanel() {
    if (!state.codeSession) return `<div class="empty glass-card">${icon('⌘')}<b>还没有从首页生成的代码训练。</b><small>你可以先在首页粘贴代码，或者从下面的基础训练库开始。</small><div class="action-row">${button('去首页问代码', 'go-home-code', { className: 'secondary' })}${button('从基础训练库开始', 'code-tab', { className: 'ghost', data: { tab: 'library' } })}</div></div>`;
    const progress = state.trainingProgress?.step || 0;
    return `<article class="result-card"><span class="answer-label">来自 ${esc(state.codeSession.source)}</span><h2 class="answer-title">${esc(state.codeSession.title)}</h2><p class="answer-copy">训练方向：${esc(state.codeSession.trainingDirection)}<br>问过的问题：${esc(state.codeSession.askedPoints?.join(' / ') || '输入、输出、条件分支')}</p><div class="goal-list"><b>这次要练会</b>${state.codeSession.goals.map(goal => `<span>${icon('✓')}${esc(goal)}</span>`).join('')}</div><div class="progress-top"><b>五步训练</b><span>${progress}/5</span></div><div class="bar"><i style="width:${progress * 20}%"></i></div>${button('继续训练', 'continue-code')}</article>`;
  }
  function libraryPanel() {
    const order = targetPlan().codeOrder;
    return `<div class="notice"><strong>为你优先推荐：</strong>${esc(directions[order[0]].title)}。推荐顺序会随当前目标调整，你仍可进入全部训练方向。</div><div class="library-grid">${order.map((index, position) => { const item = directions[index]; return `<button class="library-card" data-action="open-direction" data-index="${index}"><span>${position === 0 ? '优先推荐' : '训练方向'}</span><b>${item.title}</b><small>${item.note}</small><em>推荐小课 · 预计 10 分钟 · 0 / 5 步</em>${icon('›')}</button>`; }).join('')}</div>`;
  }
  function recordPanel() {
    if (!state.codeRecords.length) return `<div class="empty glass-card">${icon('▤')}<b>还没有代码理解记录。</b><small>完成训练后会保留来源、掌握点和继续训练入口。</small></div>`;
    return `<div class="record-list">${state.codeRecords.map((item, index) => `<div class="record-row"><span class="round-icon">${icon('⌘')}</span><span><b>${esc(item.title)}</b><small>${esc(item.sourceType || item.source)} · ${esc(item.status || '已保存')} · ${esc(item.nextSuggestion || '可继续训练')}</small></span><button class="inline-icon" data-action="view-code-record" data-index="${index}" aria-label="查看记录">${icon('⌕')}</button><button class="inline-icon" data-action="resume-code-record" data-index="${index}" aria-label="继续训练">${icon('›')}</button><button class="inline-icon" data-action="delete-record" data-kind="codeRecords" data-index="${index}" aria-label="删除">${icon('×')}</button></div>`).join('')}</div>`;
  }
  function directionScreen() {
    const index = Number(state.libraryDirection || 0); const direction = directions[index];
    return page(`<section><p class="eyebrow">基础训练库</p><h1 class="hero-title">${esc(direction.title)}</h1><p class="lead">${esc(direction.note)}</p><div class="unit-list">${direction.units.map(([unit, lessons], unitIndex) => `<article class="unit-card glass-card"><span class="card-kicker">能力单元</span><h3>${unit}</h3>${lessons.map((lesson, lessonIndex) => `<button class="lesson-row" data-action="start-lesson" data-direction="${index}" data-unit="${unitIndex}" data-lesson="${lessonIndex}"><span>${lessonIndex + 1}</span><b>${lesson}<small>预计 10 分钟 · 五步训练 · 未开始</small></b>${icon('›')}</button>`).join('')}</article>`).join('')}</div></section>`, { useNav: false, useBack: true });
  }
  function codeMeta(snippet) {
    const name = (snippet.match(/(?:function|def)\s+([\w$]+)/) || snippet.match(/(?:const|let|var)\s+([\w$]+)\s*=/) || [])[1] || '这段函数';
    const condition = (snippet.match(/if\s*\(([^)]+)/) || [])[1] || '条件是否满足';
    const returns = [...snippet.matchAll(/return\s+([^;\n}]+)/g)].map(match => match[1].trim());
    const fallback = returns[returns.length - 1] || '默认结果';
    const hasApi = /fetch|axios|API|response|json/i.test(snippet);
    return { name, condition, fallback, hasApi, returns, input: hasApi ? '请求参数或用户输入' : '函数接收的参数', output: returns.length ? `返回 ${returns.join(' 或 ')}` : '函数执行后的结果', blocks: [`判断 ${condition}`, `满足条件时返回分支结果`, `条件不满足时返回 ${fallback}`] };
  }
  function buildSession(title, source, direction = '看懂 AI 应用里的代码', extra = {}) {
    const codeSnippet = extra.codeSnippet || 'function routeAgent(message) {\n  if (isAmbiguous(message)) return "clarify";\n  return "answer_and_next_step";\n}';
    const meta = codeMeta(codeSnippet);
    state.codeSession = { id: uid('code-session'), source, title: extra.title || (source === '首页代码对话' ? `${meta.name} · 代码理解` : title), codeSnippet, trainingMeta: meta, askedPoints: extra.askedPoints || ['state', 'next', '返回值'], trainingDirection: direction, unit: extra.unit || 'Agent 状态和路由', lesson: extra.lesson || title, goals: [`看懂 ${meta.name} 的输入与输出`, `看懂条件“${meta.condition}”如何影响结果`, `看懂默认返回 ${meta.fallback}`], steps: ['拆输入输出', '代码填空', '代码排序', '最小仿写', '检查这段能不能用'], progress: 0, status: 'in-progress', createdAt: now(), updatedAt: now() };
    state.trainingProgress = { sessionId: state.codeSession.id, step: 0, answers: [], attempts: [], order: [2, 0, 1], imitate: '', checks: [] };
  }
  function training() {
    if (!state.codeSession || !state.trainingProgress) { move('code', { history: false }); return code(); }
    const p = state.trainingProgress; const steps = state.codeSession.steps; const complete = p.step >= 5;
    const activity = complete ? trainingSummary() : trainingActivity(p.step);
    return page(`<section><p class="eyebrow">代码训练 · ${esc(state.codeSession.title)}</p><h1 class="hero-title">${complete ? '这一轮训练完成了。' : '把“好像懂了”推进成会用。'}</h1><div class="training-header glass-card"><div class="progress-top"><b>任务进度</b><span>${Math.min(p.step + 1, 5)} / 5</span></div><div class="bar"><i style="width:${p.step * 20}%"></i></div><div class="step-list">${steps.map((step, index) => `<div class="step ${index < p.step ? 'complete' : index === p.step ? 'current' : ''}"><span class="step-state">${index < p.step ? '✓' : index + 1}</span><span><b>${step}</b><small>${['确定输入与输出', '补全关键条件', '理解执行顺序', '迁移到最小场景', '检查边界条件'][index]}</small></span><em>${index < p.step ? '已完成' : index === p.step ? '进行中' : '待开始'}</em></div>`).join('')}</div></div>${activity}</section>`, { useNav: false, useBack: true });
  }
  function trainingActivity(step) {
    const p = state.trainingProgress; const meta = state.codeSession.trainingMeta || codeMeta(state.codeSession.codeSnippet);
    if (step === 0) return `<div class="exercise glass-card"><span class="card-kicker">步骤 1 · 拆输入输出</span><h3>${esc(meta.name)} 接收什么，返回什么？</h3><pre class="code-panel">${esc(state.codeSession.codeSnippet)}</pre><div class="inspect-grid"><div><b>输入</b><p>${esc(meta.input)}</p></div><div><b>输出</b><p>${esc(meta.output)}</p></div><div><b>关键判断</b><p>${esc(meta.condition)}</p></div></div>${button('我理解了，进入下一步', 'complete-training-step')}</div>`;
    if (step === 1) { const options = [meta.fallback, `先处理 ${meta.condition}`, '直接结束']; const correct = 1; return `<div class="exercise glass-card"><span class="card-kicker">步骤 2 · 代码填空</span><h3>遇到“${esc(meta.condition)}”时，下一步应是什么？</h3>${options.map((option, index) => `<button class="choice ${p.answers[1] === index ? 'selected' : ''}" data-action="fill-select" data-index="${index}">${esc(option)}</button>`).join('')}${p.answers[1] !== undefined ? `<p class="feedback ${p.answers[1] === correct ? 'good' : 'bad'}">${p.answers[1] === correct ? '正确。先处理条件分支，再决定后续返回。' : '再回到原代码看一下 if 条件与 return 的关系。'}</p>` : ''}${button('完成填空', 'complete-training-step', { disabled: p.answers[1] !== correct })}</div>`; }
    if (step === 2) {
      const blocks = meta.blocks;
      return `<div class="exercise glass-card"><span class="card-kicker">步骤 3 · 代码排序</span><h3>把执行顺序排正确。</h3><div class="sort-list">${p.order.map((value, index) => `<div><b>${index + 1}. ${blocks[value]}</b><span>${button('↑', 'sort-move', { className: 'ghost mini', disabled: index === 0, data: { index, direction: 'up' } })}${button('↓', 'sort-move', { className: 'ghost mini', disabled: index === p.order.length - 1, data: { index, direction: 'down' } })}</span></div>`).join('')}</div>${p.order.join(',') === '0,1,2' ? '<p class="feedback good">顺序正确：先判断，再决定是否走澄清分支。</p>' : ''}${button('提交排序', 'complete-training-step', { disabled: p.order.join(',') !== '0,1,2' })}</div>`;
    }
    if (step === 3) return `<div class="exercise glass-card"><span class="card-kicker">步骤 4 · 最小仿写</span><h3>围绕“${esc(meta.condition)}”写一个最小分支。</h3><textarea class="code-input" data-field="imitate" placeholder="例如：if (${esc(meta.condition)}) return '分支结果';">${esc(p.imitate)}</textarea><p>检查是否包含条件判断和返回结果；不运行真实代码。</p>${button('检查最小仿写', 'check-imitate')}</div>`;
    return `<div class="exercise glass-card"><span class="card-kicker">步骤 5 · 检查这段能不能用</span><h3>检查 ${esc(meta.name)} 的关键边界。</h3>${['有没有默认分支', `${meta.input}为空怎么办`, '返回格式是否正确', meta.hasApi ? '请求失败时如何处理' : '是否需要补测试样例'].map((label, index) => `<label class="check-row"><input type="checkbox" data-action="toggle-check" data-index="${index}" ${p.checks.includes(index) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}${button('完成训练', 'finish-training', { disabled: p.checks.length !== 4 })}</div>`;
  }
  function trainingSummary() { return `<div class="result-card"><span class="answer-label">训练完成</span><h2 class="answer-title">已形成一条代码理解记录。</h2><p class="answer-copy">掌握点：输入、分支与返回值。<br>下一步：在真实代码里再找一次默认分支。</p>${button('保存为代码理解记录', 'save-code-record')}</div>`; }
  function codeRecordDetail() {
    const item = state.viewingCodeRecord;
    if (!item) { move('code', { history: false }); return code(); }
    return page(`<section><p class="eyebrow">代码理解记录</p><h1 class="hero-title">${esc(item.title)}</h1><div class="result-card"><span class="answer-label">${esc(item.sourceType || item.source)}</span><h2 class="answer-title">${esc(item.status || '已保存')}</h2><p class="answer-copy">训练方向：${esc(item.trainingDirection || '基础训练')}<br>能力单元：${esc(item.unit || '待补充')}<br>训练小课：${esc(item.lesson || '待补充')}</p><div class="record-detail"><b>掌握点</b><p>${esc((item.masteredPoints || ['整体作用']).join(' / '))}</p><b>薄弱点</b><p>${esc((item.weakPoints || []).join(' / ') || '暂无')}</p><b>下一步建议</b><p>${esc(item.nextSuggestion || '继续训练')}</p></div>${button('继续训练', 'resume-viewed-code-record')}</div></section>`, { useNav: false, useBack: true });
  }

  const experiencePrompts = [
    '你具体负责哪一部分？可以只写自己实际做过的内容。',
    '你产出了哪些交付物？例如 PRD、流程图、原型、Demo、测试表或其他材料。',
    '有没有样本量、测试结果、使用反馈或完成率？没有也可以直接写“暂无数据”。',
    '哪些由你完成，哪些由产品、研发、同学或团队成员完成？',
    '有没有截图、文档、Demo、链接、代码或表格可以证明这些内容？'
  ];
  function portfolio() {
    const plan = targetPlan();
    const latestCase = state.trainingCases[0];
    const progress = state.factCandidates.length
      ? `当前有 ${state.confirmedFacts.length} 条已确认内容、${state.pendingFacts.length} 条待补充。完成确认后，草稿会保存在“我的 · 作品集草稿”。`
      : '选择一种内容来源后，系统会先帮助你澄清或读取训练记录，再进入确认与草稿步骤。';
    return page(`<section><p class="eyebrow">作品集</p><h1 class="hero-title">先确认内容来源，<br>再让表达更有说服力。</h1><div class="notice"><strong>围绕“${esc(goalLabel(plan.id))}”：</strong>${esc(plan.portfolioHint)}</div><div class="route-choice glass-card"><button data-action="start-experience"><span class="round-icon">${icon('✓')}</span><span><b>真实经历</b><small>逐步补齐职责、产物、数据、协作和证明材料</small></span>${icon('›')}</button><button data-action="${latestCase ? 'use-training-case' : 'start-composite'}" ${latestCase ? 'data-index="0"' : ''}><span class="round-icon green">${icon('✦')}</span><span><b>个人训练案例</b><small>${latestCase ? `${esc(latestCase.title)} · 可作为训练案例整理` : '先完成一次项目化综合练习'}</small></span>${icon('›')}</button></div><section class="portfolio-flow-note"><span class="round-icon amber">${icon('◆')}</span><div><b>确认与保存会在流程中完成</b><small>${esc(progress)}</small></div></section><p class="quiet-note">真实经历可以写真实职责与已证明结果；训练案例只能写为独立训练，不得写成上线、团队或工作项目。</p></section>`);
  }
  function beginExperience() {
    if (!state.experienceFlow) state.experienceFlow = { step: 0, draft: '', messages: [{ role: 'ai', text: '先从一段真实经历开始。接下来我会逐步确认职责、交付物、数据、协作边界和证明材料，不会替你补事实。', actions: [] }, { role: 'ai', text: experiencePrompts[0], actions: [] }], answers: [] };
    return experience();
  }
  function experience() {
    const flow = state.experienceFlow;
    const categories = ['职责范围', '交付物', '验证与数据', '协作边界', '证明材料'];
    const completed = flow.answers.map((answer, index) => `<article class="evidence-answer"><span>${index + 1}</span><div><b>${categories[index]}</b><small>${esc(answer)}</small></div>${icon('✓')}</article>`).join('');
    return page(`<section class="evidence-workbench"><p class="eyebrow">把经历说清楚</p><h1 class="hero-title">先澄清真实经历，<br>再决定哪些能写。</h1><div class="evidence-guard"><span class="round-icon amber">${icon('◆')}</span><div><b>AI 事实澄清助手</b><small>只收集职责、产物、数据、边界和证明材料；不会替你补事实。</small></div></div><div class="evidence-progress">${categories.map((label, index) => `<span class="${index < flow.step ? 'done' : index === flow.step ? 'current' : ''}"><i>${index < flow.step ? '✓' : index + 1}</i><b>${label}</b></span>`).join('')}</div>${completed ? `<section class="evidence-history"><div class="section-head"><h2 class="section-title">已确认的信息</h2><span>${flow.answers.length} 条</span></div>${completed}</section>` : ''}<article class="evidence-question glass-card"><span class="card-kicker">正在确认 · ${categories[flow.step]}</span><h3>${esc(experiencePrompts[flow.step])}</h3><p>请只写自己确认过的内容；没有数据或材料可以直接说明“暂无”。</p><label class="evidence-input"><span>你的真实材料</span><textarea data-field="experienceDraft" placeholder="写下真实内容；不确定的数据可以写“暂无数据”">${esc(flow.draft)}</textarea></label>${button('提交这一项', 'experience-submit')}</article><p class="quiet-note">未确认内容不会进入草稿。“写厉害点”会先回到事实边界检查。</p></section>`, { useNav: false, useBack: true });
  }
  function candidate(title, detail, strength, evidence, status = 'pending', type = '事实') { return { id: uid('fact'), title, detail, strength, evidence, status, type, order: state.factCandidates.length }; }
  function generateFacts() {
    const answers = state.experienceFlow?.answers || [];
    const responsibility = answers[0] || '参与 AI 项目中的部分工作';
    const deliverable = answers[1] || '需要补充具体交付物';
    const data = answers[2] || '暂无数据'; const boundary = answers[3] || '需要补充团队边界'; const proof = answers[4] || '需要补充证明材料';
    const facts = [
      candidate('可说明的职责', responsibility, /负责|独立/.test(responsibility) ? '负责' : '参与', /文档|原型|Demo|截图|链接|表格/.test(proof) ? '已证明' : '待补充', 'pending', '职责'),
      candidate('可说明的交付物', deliverable, '负责', /文档|原型|Demo|截图|链接|表格/.test(proof) ? '已证明' : '待补充', 'pending', '交付物'),
      candidate('验证或数据情况', data, '参与', /暂无|没有/.test(data) ? '无证明' : '待补充', 'pending', '数据'),
      candidate('团队协作边界', boundary, /主导/.test(boundary) ? '协助' : '参与', '待补充', 'pending', '团队边界'),
      candidate('“主导项目并显著提升关键指标”', '当前材料未证明整体方案、资源推进、上线结果和指标口径。', '主导', '无证明', 'rejected', '暂不建议使用')
    ];
    state.factCandidates = facts;
    syncFacts();
  }
  function generateTrainingCaseFacts(record) {
    state.factCandidates = [
      candidate('训练案例类型', `围绕“${record.title}”完成的个人训练案例，不代表真实上线、团队或工作项目。`, '参与', '训练记录已保存', 'pending', '训练案例标签'),
      candidate('本次完成的训练动作', record.submissions.map((item, index) => `步骤 ${index + 1}：${item}`).join('；'), '负责', '训练记录已保存', 'pending', '训练过程'),
      candidate('检查与修改记录', `已完成 ${record.checkResults.length} 次任务检查；${record.reflection}`, '参与', '训练记录已保存', 'pending', '检查与复盘'),
      candidate('“主导上线项目并取得业务结果”', '训练记录无法证明上线、团队协作、外部业务结果或工作职责。', '主导', '无证明', 'rejected', '暂不建议使用')
    ];
    syncFacts();
  }
  function factCard(item, index) {
    const labels = { confirmed: '可写', pending: '待补充', rejected: '暂时不能写' };
    return `<article class="fact-card glass-card"><header><span class="status ${item.status}">${labels[item.status]}</span><small>${esc(item.type)}</small></header><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><div class="fact-meta"><span>表达强度：${esc(item.strength)}</span><span>证据：${esc(item.evidence)}</span></div><footer>${button('确认可写', 'fact-status', { className: 'secondary mini', data: { index, status: 'confirmed' } })}${button('待补充', 'fact-status', { className: 'ghost mini', data: { index, status: 'pending' } })}${button('暂不写', 'fact-status', { className: 'ghost mini', data: { index, status: 'rejected' } })}<button class="small-btn" data-action="edit-fact" data-index="${index}">修改</button><button class="small-btn no" data-action="remove-fact" data-index="${index}">移除</button></footer></article>`;
  }
  function canConfirmFact(item) {
    if (item.strength === '主导' && item.evidence !== '已证明') return false;
    if (item.evidence === '无证明') return false;
    return true;
  }
  function facts() {
    const counts = { confirmed: state.confirmedFacts.length, pending: state.pendingFacts.length, rejected: state.rejectedFacts.length };
    return page(`<section><p class="eyebrow">确认哪些能写</p><h1 class="hero-title">确认内容来源后，<br>再生成可信表达。</h1><div class="fact-summary"><div class="fact-count confirm"><b>${counts.confirmed}</b><small>可写内容</small></div><div class="fact-count pending"><b>${counts.pending}</b><small>待补充</small></div><div class="fact-count reject"><b>${counts.rejected}</b><small>暂时不能写</small></div></div>${state.factCandidates.length ? state.factCandidates.map(factCard).join('') : `<div class="empty glass-card"><b>还没有内容卡。</b><small>先把真实经历说清楚，或完成一项项目化综合练习。</small><div class="action-row">${button('把经历说清楚', 'portfolio-experience', { className: 'secondary' })}${button('去 AI 实操', 'start-composite', { className: 'ghost' })}</div></div>`}<div class="intercept glass-card"><span class="card-kicker">表达边界</span><h3>“写厉害点”不会绕过来源与事实确认。</h3><p>真实经历可增强问题、方法、产物与已证明结果；训练案例必须标注为个人训练，不能补造上线、业务结果或团队职责。</p>${button('查看边界说明', 'open-overclaim', { className: 'ghost' })}</div>${button('生成可信草稿', 'make-draft', { disabled: counts.confirmed === 0 })}</section>`, { useNav: false, useBack: true });
  }
  function overclaim() {
    const levels = [['参与', '在明确任务中提供支持或完成局部工作。'], ['协助', '配合他人推进一个可说明的交付环节。'], ['负责', '对明确范围的方案、产物或结果承担主要责任。'], ['主导', '定义方向、推进落地、协调资源并对结果负责。']];
    return page(`<section><p class="eyebrow">表达边界</p><h1 class="hero-title">表达可以更清楚，<br>事实不能被放大。</h1><div class="split-rule"><div><span class="round-icon green">${icon('✓')}</span><h3>可以增强的表达</h3><p>问题背景、方法、产物、真实职责、已证明结果。</p></div><div><span class="round-icon amber">${icon('!')}</span><h3>不能增强的内容</h3><p>未确认数据、没做过的职责、未上线结果、不是你负责的团队工作。</p></div></div><div class="expression-levels"><span class="card-kicker">表达强度判断</span>${levels.map(([title, detail], index) => `<div><b>0${index + 1} · ${title}</b><p>${detail}</p></div>`).join('')}</div><div class="notice"><strong>建议表达强度：</strong>当前材料未证明整体方案、推进落地、资源协调和结果责任时，只建议使用“参与”或“协助”，不建议写成“主导”。</div><div class="action-row">${button('补充事实', 'start-experience')}${button('确认可写内容', 'portfolio-facts', { className: 'secondary' })}</div></section>`, { useNav: false, useBack: true });
  }
  function draft() {
    const facts = state.confirmedFacts;
    if (!facts.length) return page(`<section><p class="eyebrow">作品集草稿</p><h1 class="hero-title">还不能生成草稿。</h1><div class="result-card"><p class="answer-copy">请先确认至少一条可写内容。待补充和暂时不能写的内容不会进入草稿。</p>${button('去确认事实', 'portfolio-facts')}</div></section>`, { useNav: false, useBack: true });
    const defaultBody = facts.map(item => `${item.title}：${item.detail}`).join('\n');
    const hasTrainingCase = facts.some(item => /训练案例|训练过程|检查与复盘/.test(item.type || ''));
    const editor = state.draftEditor || { title: hasTrainingCase ? 'AI 知识库问答 · 个人训练案例' : 'AI 职业能力转化平台', body: defaultBody, factIds: facts.map(item => item.id), factSnapshots: null, basedOn: null, sourceType: hasTrainingCase ? '个人训练案例' : '真实经历' };
    const references = editor.factSnapshots || facts.filter(item => editor.factIds.includes(item.id)).map(factSnapshot);
    return page(`<section><p class="eyebrow">作品集草稿</p><h1 class="hero-title">一份可以继续编辑的<br>可信表达。</h1><div class="result-card"><span class="answer-label">${esc(editor.sourceType)} · 仅基于已确认内容</span><label class="draft-field">草稿标题<input data-field="draftTitle" value="${esc(editor.title)}"></label><label class="draft-field">草稿内容<textarea data-field="draftBody">${esc(editor.body)}</textarea></label><div class="fact-reference"><b>本版本引用的内容</b>${references.map(item => `<span>${esc(item.title)} · ${esc(item.strength || '参与')} · ${esc(item.evidence || '已确认')}</span>`).join('')}</div>${editor.sourceType === '个人训练案例' ? '<p class="quiet-note">对外表达必须保留“个人训练案例”标签，不得替换为上线、团队或工作项目。</p>' : ''}${button(editor.basedOn ? '保存为新版本' : '保存版本', 'save-draft')}</div>${state.portfolioDrafts.length ? `<section class="draft-history"><h2 class="section-title">已保存版本</h2>${state.portfolioDrafts.map((item, index) => `<button data-action="view-draft-version" data-index="${index}"><span><b>V${state.portfolioDrafts.length - index} · ${esc(item.title)}</b><small>${esc(item.sourceType || '真实经历')} · ${esc(item.savedAt)} · 冻结引用 ${item.factSnapshots?.length ?? item.confirmedFactIds?.length ?? 0} 条内容</small></span>${icon('›')}</button>`).join('')}</section>` : ''}</section>`, { useNav: false, useBack: true });
  }
  function factSnapshot(item) { return { id: item.id, title: item.title, detail: item.detail, strength: item.strength, evidence: item.evidence, type: item.type, status: item.status }; }
  function draftVersion() {
    const item = state.viewingDraft; if (!item) { move('portfolio-drafts', { history: false }); return draft(); }
    const sources = item.factSnapshots || state.confirmedFacts.filter(fact => item.confirmedFactIds?.includes(fact.id)).map(factSnapshot);
    return page(`<section><p class="eyebrow">作品集草稿 · 版本回看</p><h1 class="hero-title">${esc(item.title)}</h1><div class="result-card"><span class="answer-label">${esc(item.savedAt)} · 版本来源已冻结</span><p class="draft-copy">${esc(item.body || item.note)}</p><div class="fact-reference"><b>引用来源快照</b>${sources.length ? sources.map(fact => `<span><strong>${esc(fact.title)}</strong><small>${esc(fact.detail)} · ${esc(fact.strength)} · ${esc(fact.evidence)}</small></span>`).join('') : '<span>早期版本未保存来源快照</span>'}</div><div class="action-row">${button('以此版本继续编辑', 'edit-draft-version')}${button('返回版本列表', 'back', { className: 'ghost' })}</div></div></section>`, { useNav: false, useBack: true });
  }

  function assetSources() {
    return {
      learning: { title: '学习记录', glyph: '◆', key: 'learningRecords', items: state.learningRecords, empty: '从首页保存一个概念解释后，会在这里回看。', action: 'start-quiz', actionLabel: '继续小测' },
      review: { title: '待复习', glyph: '↺', key: 'practiceRecords', items: state.practiceRecords.filter(item => item.type !== 'consolidation'), empty: '完成一次小测或实操后，会生成待复习内容。', action: 'start-quiz', actionLabel: '开始复习' },
      consolidation: { title: '巩固练习记录', glyph: '✓', key: 'practiceRecords', items: state.practiceRecords.filter(item => item.type === 'consolidation'), empty: '完成一轮巩固练习后，会保留练习记录。', action: 'start-practice', actionLabel: '开始练习' },
      practice: { title: 'AI 实操记录', glyph: '✦', key: 'workRecords', items: state.workRecords.filter(item => item.kind === 'practice'), empty: '完成一次 AI 实操后，会保留判断过程。', action: 'start-practice', actionLabel: '再次实操' },
      code: { title: '代码理解记录', glyph: '⌘', key: 'codeRecords', items: state.codeRecords, empty: '完成代码训练后，会保留掌握点和下一步。', action: 'open-code', actionLabel: '去代码训练' },
      trainingCase: { title: '个人训练案例', glyph: '✦', key: 'trainingCases', items: state.trainingCases, empty: '完成一次项目化综合练习后，会在这里保留你的提交、检查反馈与复盘。', action: 'start-composite', actionLabel: '开始练习' },
      draft: { title: '作品集草稿', glyph: '▣', key: 'portfolioDrafts', items: state.portfolioDrafts, empty: '确认可写事实后，才能保存作品集草稿。', action: 'portfolio-facts', actionLabel: '确认事实' }
    };
  }
  function assetStatus(source) {
    if (!source.items.length) return '尚未沉淀';
    const latest = source.items[0];
    return latest.status || latest.nextSuggestion || latest.note || latest.output || '已保存';
  }
  function assetTile(id, source) {
    const latest = source.items[0];
    return `<button class="asset-tile" data-action="open-asset" data-asset="${id}"><span class="round-icon">${icon(source.glyph)}</span><span><b>${source.title}</b><em>${source.items.length} 条</em><small>${esc(latest ? assetStatus(source) : source.empty)}</small></span>${icon('›')}</button>`;
  }
  function me() {
    const sources = assetSources();
    const assetCount = Object.values(sources).reduce((total, source) => total + source.items.length, 0);
    const draftCount = state.portfolioDrafts.length;
    const factTotal = state.confirmedFacts.length + state.pendingFacts.length + state.rejectedFacts.length;
    const focus = state.codeSession && (state.trainingProgress?.step || 0) < 5
      ? { title: state.codeSession.title, note: `代码训练 · 已完成 ${state.trainingProgress?.step || 0} / 5 步`, action: 'continue-code', label: '继续训练' }
      : state.practice?.mode === 'composite'
        ? { title: compositeTheme().title, note: `项目化综合练习 · 第 ${state.practice.step + 1} 步`, action: 'start-composite', label: '继续练习' }
        : state.trainingCases[0]
          ? { title: state.trainingCases[0].title, note: '个人训练案例 · 可回看检查与复盘', action: 'open-training-cases', label: '查看案例' }
        : state.practiceRecords[0]
          ? { title: state.practiceRecords[0].title, note: state.practiceRecords[0].nextSuggestion || '重新巩固一次理解', action: 'start-practice', label: '开始复习' }
          : { title: '从一个问题开始', note: '保存学习、训练或训练案例后，它们会沉淀在这里。', action: 'nav', label: '去首页', data: { route: 'home' } };
    return page(`<section class="asset-page"><div class="asset-page-head"><div><p class="eyebrow">我的 · 能力资产</p><h1 class="hero-title">今天的积累，<br>会成为下一次的底气。</h1></div><button class="profile-chip" data-action="open-goal-setup">${icon('◉')} ${esc(goalLabel(state.userGoalProfile.target))}</button></div><div class="asset-hero glass-card"><div class="asset-hero-copy"><span class="card-kicker">能力资产总览</span><h2>让做过的事，<br>持续为你所用。</h2><p>学习、训练、个人训练案例和表达都会在这里回看、继续并形成可信积累。</p></div><div class="asset-stat"><div><b>${assetCount}</b><small>已沉淀资产</small></div><div><b>${state.confirmedFacts.length}</b><small>已确认内容</small></div></div></div><div class="section-head"><h2 class="section-title">当前推进</h2><span class="section-meta">1 件待处理</span></div><div class="asset-focus glass-card"><span class="round-icon green">${icon('↗')}</span><span><em>下一步</em><b>${esc(focus.title)}</b><small>${esc(focus.note)}</small></span>${button(focus.label, focus.action, { className: 'secondary', data: focus.data || {} })}</div><div class="section-head"><h2 class="section-title">可信表达状态</h2><button class="text-action" data-action="portfolio-facts">去确认</button></div><div class="trust-strip"><button data-action="portfolio-facts"><b>${state.confirmedFacts.length}</b><span>可写内容</span></button><button data-action="portfolio-facts"><b>${state.pendingFacts.length}</b><span>待补充</span></button><button data-action="portfolio-drafts"><b>${draftCount}</b><span>草稿版本</span></button></div>${factTotal === 0 ? `<div class="asset-empty-tip">还没有可用于表达的内容。把真实经历说清楚，或完成一次项目化综合练习后，会在这里形成可信线索。</div>` : ''}<div class="section-head"><h2 class="section-title">能力资产</h2><span class="section-meta">${assetCount} 条</span></div><div class="asset-grid">${Object.entries(sources).map(([id, source]) => assetTile(id, source)).join('')}</div><div class="section-head"><h2 class="section-title">管理与回顾</h2></div><div class="manage-list glass-card"><button data-action="review-history">${icon('↺')}<span><b>对话历史</b><small>回顾曾经问过的问题</small></span>${icon('›')}</button><button data-action="open-goal-setup">${icon('◉')}<span><b>调整当前目标</b><small>${esc(goalLabel(state.userGoalProfile.target))}</small></span>${icon('›')}</button></div></section>`);
  }
  function assetDetail() {
    const source = assetSources()[state.assetView];
    if (!source) { move('me', { history: false }); return me(); }
    return page(`<section><p class="eyebrow">我的 · ${esc(source.title)}</p><h1 class="hero-title">${esc(source.title)}</h1><p class="lead">${source.items.length ? `共 ${source.items.length} 条，最近一条状态：${assetStatus(source)}` : source.empty}</p>${source.items.length ? `<div class="asset-detail-list">${source.items.map((item, index) => assetItemCard(item, index, source)).join('')}</div>` : `<div class="empty glass-card">${icon(source.glyph)}<b>${source.empty}</b>${button(source.actionLabel, source.action, { className: 'secondary', data: source.action === 'nav' ? { route: 'home' } : {} })}</div>`}</section>`, { useNav: false, useBack: true });
  }
  function assetItemCard(item, index, source) {
    const detailAction = source.key === 'codeRecords' ? 'view-code-record' : source.key === 'portfolioDrafts' ? 'view-draft-version' : 'view-asset-record';
    const continuation = source.key === 'codeRecords' ? 'resume-code-record' : source.action;
    const hasContinue = source.title !== '作品集草稿';
    return `<article class="asset-item glass-card"><header><span class="round-icon">${icon(source.glyph)}</span><span><b>${esc(item.title)}</b><small>${esc(item.savedAt || '已保存')}</small></span><span class="asset-status">${esc(item.status || '已沉淀')}</span></header><p>${esc(item.nextSuggestion || item.note || item.output || '可继续查看或处理。')}</p><footer>${button('查看', detailAction, { className: 'ghost mini', data: { asset: state.assetView, index } })}${hasContinue ? button(source.actionLabel, continuation, { className: 'secondary mini', data: { index } }) : ''}${button('删除', 'delete-asset-record', { className: 'ghost mini', data: { asset: state.assetView, index } })}</footer></article>`;
  }
  function assetRecordDetail() {
    const record = state.assetRecord;
    if (!record) { move('me', { history: false }); return me(); }
    const source = assetSources()[record.asset]; const item = source?.items[record.index];
    if (!item) { move('asset-detail', { history: false }); return assetDetail(); }
    const details = [
      ['当前状态', item.status || '已沉淀'], ['来源 / 产物', item.sourceType || item.source || item.output || '已保存'],
      ['掌握或完成内容', (item.masteredPoints || []).join(' / ') || item.note || '已完成'], ['下一步建议', item.nextSuggestion || '可继续处理']
    ];
    if (source.key === 'trainingCases') {
      details.splice(1, 0, ['训练标签', item.label || '个人训练案例'], ['用户提交', (item.submissions || []).join('\n\n') || '未找到提交内容'], ['检查与修改', `${item.checkResults?.length || 0} 次检查；${item.revisionHistory?.map(entry => entry.note).join(' / ') || '暂无修改记录'}`]);
    }
    return page(`<section><p class="eyebrow">${esc(source.title)} · 记录详情</p><h1 class="hero-title">${esc(item.title)}</h1><div class="result-card"><span class="answer-label">${esc(item.savedAt || '已保存')}</span><div class="record-detail">${details.map(([label, value]) => `<b>${label}</b><p>${esc(value)}</p>`).join('')}</div>${source.key === 'trainingCases' ? `<div class="notice"><strong>表达边界：</strong>此记录只能作为个人训练案例引用，不能表示真实上线、团队协作或工作经历。</div>` : ''}<div class="action-row">${source.key === 'codeRecords' ? button('继续训练', 'resume-code-record', { data: { index: record.index } }) : button(source.actionLabel, source.action, { className: 'secondary' })}${button('返回列表', 'back', { className: 'ghost' })}</div></div></section>`, { useNav: false, useBack: true });
  }

  function modal() {
    if (!state.ui.modal) return '';
    if (state.ui.modal === 'profile') return `<div class="modal-mask"><section class="modal"><span class="card-kicker">目标设置</span><h2>调整你的学习目标</h2><label>目标<input data-field="profileTarget" value="${esc(state.userGoalProfile.target)}" placeholder="例如：转向 AI 产品"></label><label>基础<input data-field="profileLevel" value="${esc(state.userGoalProfile.level)}" placeholder="例如：了解基础概念"></label><label>可投入时间<input data-field="profileTime" value="${esc(state.userGoalProfile.availableTime)}" placeholder="例如：每周 6–8 小时"></label><div class="action-row">${button('保存设置', 'save-profile')}${button('取消', 'close-modal', { className: 'ghost' })}</div></section></div>`;
    if (state.ui.modal === 'history') return `<div class="modal-mask"><section class="modal"><span class="card-kicker">对话回顾</span><h2>最近问过的问题</h2>${state.historyItems.length ? `<div class="history-list">${state.historyItems.slice(0, 6).map(item => `<div><b>${esc(item.title)}</b><small>${esc(item.savedAt)}</small></div>`).join('')}</div>` : '<p>还没有已保存的对话。</p>'}<div class="action-row">${button('继续当前对话', 'close-modal')}${button('关闭', 'close-modal', { className: 'ghost' })}</div></section></div>`;
    if (state.ui.modal === 'delete') return `<div class="modal-mask"><section class="modal"><span class="card-kicker">删除确认</span><h2>确定删除这条记录吗？</h2><p>删除后可在本次提示中撤销；关闭提示后会保持删除状态。</p><div class="action-row">${button('确认删除', 'confirm-delete')}${button('保留记录', 'close-modal', { className: 'ghost' })}</div></section></div>`;
    if (state.ui.modal === 'fact-edit') { const item = state.factCandidates[state.ui.factIndex]; return `<div class="modal-mask"><section class="modal"><span class="card-kicker">修改事实卡</span><h2>只保留可证明的内容</h2><label>内容<input data-field="factTitle" value="${esc(item.title)}"></label><label>说明<textarea data-field="factDetail">${esc(item.detail)}</textarea></label><label>表达强度<select data-field="factStrength">${['参与', '协助', '负责', '主导'].map(value => `<option ${value === item.strength ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>证据状态<select data-field="factEvidence">${['已证明', '训练记录已保存', '待补充', '无证明'].map(value => `<option ${value === item.evidence ? 'selected' : ''}>${value}</option>`).join('')}</select></label><div class="action-row">${button('保存修改', 'save-fact')}${button('取消', 'close-modal', { className: 'ghost' })}</div></section></div>`; }
    if (state.ui.modal === 'save-error') return `<div class="modal-mask"><section class="modal"><span class="card-kicker">保存失败</span><h2>内容仍保留在当前页面。</h2><p>请重试保存；系统不会因为一次保存失败清空你的输入。</p><div class="action-row">${button('重试保存', 'retry-save')}${button('暂不保存', 'close-modal', { className: 'ghost' })}</div></section></div>`;
    return '';
  }
  function toastView() { return state.ui.toast ? `<div class="toast show">${esc(state.ui.toast.message)}${state.ui.toast.undo ? '<button data-action="undo-delete">撤销</button>' : ''}</div>` : ''; }
  function loadingView() { return state.ui.loading ? `<div class="loading-mask"><div class="loading-card"><i></i><b>${esc(state.ui.loading)}</b></div></div>` : ''; }

  function render() {
    rememberChatScroll();
    const routes = {
      home, quiz: quizScreen, practice: practiceScreen, 'practice-hub': practiceHub, code, 'code-direction': directionScreen, 'code-training': training,
      portfolio, 'portfolio-experience': beginExperience, 'portfolio-facts': facts, 'portfolio-overclaim': overclaim,
      'portfolio-drafts': draft, 'portfolio-draft-version': draftVersion,
      'goal-setup': goalSetup, 'code-record-detail': codeRecordDetail,
      'asset-detail': assetDetail, 'asset-record-detail': assetRecordDetail, me
    };
    app.innerHTML = (routes[state.route] || home)();
    restoreChatScroll();
  }

  function startCodeTraining() {
    if (!state.currentCodeContext?.isCodeContextActive) { flash('还没有可生成训练的代码内容，请先在首页粘贴一段代码。'); return; }
    loading('正在根据这段代码生成训练...', () => {
      buildSession('Agent 路由函数', '首页代码对话', '看懂 AI 应用里的代码', { codeSnippet: state.currentCodeContext.codeSnippet, askedPoints: state.currentCodeContext.askedPoints });
      state.codeTab = 'current'; move('code'); flash('训练已生成');
    });
  }
  function eventHandler(event) {
    const node = event.target.closest('[data-action]'); if (!node || node.disabled) return;
    const action = node.dataset.action;
    if (action === 'nav') move(node.dataset.route);
    else if (action === 'back') back();
    else if (action === 'choose-goal') state.goalChoice = node.dataset.value;
    else if (action === 'confirm-goal') { if (!state.goalChoice) flash('请选择一个当前优先目标，或直接跳过。'); else { state.userGoalProfile = { ...state.userGoalProfile, target: state.goalChoice }; state.onboardingComplete = true; move('home', { history: false }); flash('目标已保存，首页推荐已调整'); } }
    else if (action === 'skip-goal') { state.goalChoice = 'explore'; state.userGoalProfile = { ...state.userGoalProfile, target: 'explore' }; state.onboardingComplete = true; move('home', { history: false }); }
    else if (action === 'open-goal-setup') { state.goalChoice = state.userGoalProfile.target || ''; move('goal-setup'); }
    else if (action === 'notice') flash('当前没有新的提醒');
    else if (action === 'review-history') state.ui.modal = 'history';
    else if (action === 'ask') askHome();
    else if (action === 'ask-rag') { state.homeDraft = '什么是 RAG？'; state.ui.focusHomeConversation = true; askHome(); }
    else if (action === 'ask-rag-followup') { appendMessage('ai', '如果你愿意，可以继续问“LLM 和 RAG 有什么区别”，或者直接用小测检查理解。', [{ label: '做 3 道小测', action: 'start-quiz' }]); }
    else if (action === 'go-home-code') { state.codeTab = state.codeSession ? 'current' : 'library'; move('code'); flash('已进入代码训练，可选择基础小课或继续上次训练。'); }
    else if (action === 'code-followup') { state.currentCodeContext?.askedPoints.push('state / next / return'); appendMessage('ai', 'state 可以理解为当前流程状态，next 是下一步动作，return 则把这个决定交给后续流程。', [{ label: '生成代码训练', action: 'create-code-training' }]); }
    else if (action === 'create-code-training') startCodeTraining();
    else if (action === 'clarify-choice') chooseClarify(node.dataset.value);
    else if (action === 'start-quiz') { state.quiz = { index: 0, answers: [] }; move('quiz'); }
    else if (action === 'quiz-select') state.quiz.answers[state.quiz.index] = Number(node.dataset.index);
    else if (action === 'quiz-next') { if (state.quiz.index < 2) state.quiz.index += 1; else { state.learningRecords.unshift({ id: uid('learning'), title: 'RAG 基础理解', note: '完成 3 道小测 · 待复习', nextSuggestion: '下一次尝试 AI 实操', savedAt: now() }); move('me'); flash('学习记录已保存到“我的”'); } }
    else if (action === 'start-practice') { state.practice = { step: 0, answers: [], responses: [], draft: '', feedback: null, target: targetPlan().id }; move('practice'); }
    else if (action === 'start-composite') move('practice-hub');
    else if (action === 'choose-composite-theme') beginComposite(node.dataset.caseId);
    else if (action === 'composite-submit') { const response = input('compositeResponse'); if (!response) flash('先写下你的产品判断，再提交检查。'); else { state.practice.draft = response; state.practice.feedback = compositeFeedback(response); } }
    else if (action === 'composite-edit') state.practice.feedback = null;
    else if (action === 'composite-next') { const response = state.practice.draft; if (!state.practice.feedback?.passed) flash('请先通过当前步骤的检查。'); else { state.practice.responses[state.practice.step] = response; if (state.practice.step < compositeTheme().steps.length - 1) { state.practice.step += 1; state.practice.draft = ''; state.practice.feedback = null; } else saveCompositeCase(); } }
    else if (action === 'practice-submit') { const response = input('practiceResponse'); if (!response) flash('先写下你的判断或方案，再提交检查。'); else { const result = checkPracticeResponse(state.practice.target, state.practice.step, response); state.practice.draft = response; state.practice.feedback = result; if (result.passed) state.practice.responses[state.practice.step] = response; } }
    else if (action === 'practice-edit') state.practice.feedback = null;
    else if (action === 'practice-next') { if (!state.practice.feedback?.passed) flash('请先通过当前步骤的检查。'); else if (state.practice.step < 2) { state.practice.step += 1; state.practice.draft = ''; state.practice.feedback = null; } else { const plan = targetPlan(state.practice.target); state.workRecords.unshift({ id: uid('practice'), kind: 'practice', title: plan.practiceTitle, note: `完成三步任务协作与质量检查：${state.practice.responses.join(' / ')}`, nextSuggestion: '回看本次判断并继续下一步', savedAt: now() }); state.practiceRecords.unshift({ id: uid('consolidation'), type: 'consolidation', title: `${plan.practiceTitle} · 巩固`, note: '完成一轮目标匹配练习', nextSuggestion: '7 天后重新做一轮练习', savedAt: now() }, { id: uid('review'), type: 'review', title: `${plan.practiceTitle} · 待复习`, note: '7 天后回顾本次判断要点', nextSuggestion: '从本轮实操开始回顾', savedAt: now() }); move('me'); flash('AI 实操、巩固与待复习内容已保存'); } }
    else if (action === 'save-learning') { state.learningRecords.unshift({ id: uid('learning'), title: 'RAG 是什么？', note: '概念解释 · 待复习', nextSuggestion: '做 3 道小测巩固理解', savedAt: now() }); flash('学习记录已保存到“我的”'); }
    else if (action === 'save-code-summary') { if (!state.currentCodeContext) flash('还没有可保存的代码理解内容'); else { state.codeRecords.unshift({ id: uid('code-record'), title: 'Agent 路由函数', sourceType: '首页代码对话', status: '已解释', masteredPoints: ['整体作用'], weakPoints: [], nextSuggestion: '生成训练后继续巩固', savedAt: now() }); flash('代码理解记录已保存'); } }
    else if (action === 'code-tab') state.codeTab = node.dataset.tab;
    else if (action === 'continue-code') move('code-training');
    else if (action === 'open-code') { state.codeTab = 'library'; move('code'); }
    else if (action === 'continue-project') { beginComposite('knowledge'); }
    else if (action === 'open-direction') { state.libraryDirection = Number(node.dataset.index); move('code-direction'); }
    else if (action === 'start-lesson') { const direction = directions[Number(node.dataset.direction)]; const unit = direction.units[Number(node.dataset.unit)]; const lesson = unit[1][Number(node.dataset.lesson)]; buildSession(lesson, '基础训练库', direction.title, { unit: unit[0], lesson, askedPoints: ['输入', '条件分支', '返回值'] }); move('code-training'); }
    else if (action === 'fill-select') { const answer = Number(node.dataset.index); state.trainingProgress.answers[1] = answer; state.trainingProgress.attempts.push(answer); }
    else if (action === 'sort-move') { const index = Number(node.dataset.index); const target = node.dataset.direction === 'up' ? index - 1 : index + 1; const order = state.trainingProgress.order; [order[index], order[target]] = [order[target], order[index]]; }
    else if (action === 'complete-training-step') { state.trainingProgress.step += 1; flash('当前步骤已完成'); }
    else if (action === 'check-imitate') { state.trainingProgress.imitate = input('imitate'); if (/if/.test(state.trainingProgress.imitate) && /return/.test(state.trainingProgress.imitate)) { state.trainingProgress.step += 1; flash('最小仿写通过检查'); } else flash('请补上条件判断 if 和返回结果 return 后再检查。'); }
    else if (action === 'toggle-check') { const index = Number(node.dataset.index); const checks = state.trainingProgress.checks; const at = checks.indexOf(index); if (node.checked && at === -1) checks.push(index); if (!node.checked && at !== -1) checks.splice(at, 1); }
    else if (action === 'finish-training') { state.trainingProgress.step = 5; flash('五步训练已完成'); }
    else if (action === 'save-code-record') { const session = state.codeSession; const meta = session.trainingMeta || codeMeta(session.codeSnippet); const wrongFill = (state.trainingProgress.attempts || []).some(answer => answer !== 1); state.codeRecords.unshift({ id: uid('code-record'), title: session.title, sourceType: session.source, trainingDirection: session.trainingDirection, unit: session.unit, lesson: session.lesson, status: '已完成', codeSnippet: session.codeSnippet, masteredPoints: [`${meta.name} 的输入与输出`, `条件：${meta.condition}`, `默认返回：${meta.fallback}`], weakPoints: wrongFill ? [`条件“${meta.condition}”与返回值的对应关系`] : [], exerciseResult: '五步训练已完成', nextSuggestion: wrongFill ? '重新检查条件分支，再用一段相似代码练习' : '用另一段代码重复练习默认分支', savedAt: now() }); move('code'); state.codeTab = 'records'; flash('代码理解记录已保存'); }
    else if (action === 'view-code-record') { state.viewingCodeRecord = state.codeRecords[Number(node.dataset.index)]; move('code-record-detail'); }
    else if (action === 'resume-code-record') { const item = state.codeRecords[Number(node.dataset.index)]; buildSession(item.title, '代码理解记录', item.trainingDirection || '基础训练库', { unit: item.unit, lesson: item.lesson }); move('code-training'); }
    else if (action === 'resume-viewed-code-record') { const item = state.viewingCodeRecord; buildSession(item.title, '代码理解记录', item.trainingDirection || '基础训练库', { unit: item.unit, lesson: item.lesson }); move('code-training'); }
    else if (action === 'start-experience') { state.experienceFlow = null; move('portfolio-experience'); }
    else if (action === 'portfolio-experience') move('portfolio-experience');
    else if (action === 'experience-submit') { const text = input('experienceDraft'); const flow = state.experienceFlow; if (!text) { flash('请先写下真实内容；没有数据可以明确写“暂无数据”。'); } else if (/写厉害点|包装一下|写高级一点|写得像主导|编好看点/.test(text)) { appendExperience('user', text); move('portfolio-overclaim'); } else { appendExperience('user', text); flow.answers.push(text); flow.draft = ''; flow.step += 1; if (flow.step < 5) appendExperience('ai', experiencePrompts[flow.step]); else { appendExperience('ai', '材料已收齐。接下来我会把内容拆成可写、待补充与暂时不能写的事实卡，由你确认。'); generateFacts(); move('portfolio-facts'); flash('已生成事实卡，请逐项确认'); } } }
    else if (action === 'portfolio-facts') move('portfolio-facts');
    else if (action === 'fact-status') { const item = state.factCandidates[Number(node.dataset.index)]; if (node.dataset.status === 'confirmed' && !canConfirmFact(item)) flash('这条内容证据不足，不能确认可写；请补充证明材料或降低表达强度。'); else { item.status = node.dataset.status; syncFacts(); flash('事实状态已更新'); } }
    else if (action === 'edit-fact') { state.ui.factIndex = Number(node.dataset.index); state.ui.modal = 'fact-edit'; }
    else if (action === 'save-fact') { const item = state.factCandidates[state.ui.factIndex]; item.title = input('factTitle'); item.detail = input('factDetail'); item.strength = input('factStrength'); item.evidence = input('factEvidence'); state.ui.modal = null; syncFacts(); flash('事实卡已修改'); }
    else if (action === 'remove-fact') { state.factCandidates.splice(Number(node.dataset.index), 1); syncFacts(); flash('事实卡已移除'); }
    else if (action === 'open-overclaim') move('portfolio-overclaim');
    else if (action === 'make-draft') move('portfolio-drafts');
    else if (action === 'save-draft') {
      const title = input('draftTitle'); const body = input('draftBody');
      if (!title || !body) { flash('请先填写草稿标题和内容。'); }
      else {
        const editor = state.draftEditor || {};
        const liveFacts = state.confirmedFacts.filter(item => (editor.factIds || state.confirmedFacts.map(fact => fact.id)).includes(item.id));
        const snapshots = editor.factSnapshots || liveFacts.map(factSnapshot);
        const sourceType = editor.sourceType || (snapshots.some(item => /训练案例|训练过程|检查与复盘/.test(item.type || '')) ? '个人训练案例' : '真实经历');
        if (sourceType === '个人训练案例' && !/个人训练案例|独立训练|训练案例/.test(`${title}\n${body}`)) {
          flash('训练案例草稿必须明确保留“个人训练案例”或“独立训练”标签。');
        } else {
          state.portfolioDrafts.unshift({ id: uid('draft'), title, body, sourceType, note: sourceType === '个人训练案例' ? '个人训练案例 · 仅引用已确认内容' : '真实经历 · 仅引用已确认事实', confirmedFactIds: snapshots.map(item => item.id), factSnapshots: snapshots.map(item => ({ ...item })), basedOn: editor.basedOn || null, nextSuggestion: sourceType === '个人训练案例' ? '保留训练案例标签，再补一次复盘或相关训练' : '继续补充证据或修改措辞', savedAt: now() });
          state.draftEditor = null; move('me'); flash('草稿新版本已保存，并冻结了来源快照');
        }
      }
    }
    else if (action === 'view-draft-version') { state.viewingDraft = state.portfolioDrafts[Number(node.dataset.index)]; move('portfolio-draft-version'); }
    else if (action === 'edit-draft-version') { const item = state.viewingDraft; state.draftEditor = { title: item.title, body: item.body || '', factIds: item.confirmedFactIds || [], factSnapshots: item.factSnapshots ? item.factSnapshots.map(snapshot => ({ ...snapshot })) : null, sourceType: item.sourceType || '真实经历', basedOn: item.id }; move('portfolio-drafts'); }
    else if (action === 'portfolio-drafts') move('portfolio-drafts');
    else if (action === 'open-training-cases') { state.assetView = 'trainingCase'; state.assetRecord = null; move('asset-detail'); }
    else if (action === 'use-training-case') { const item = state.trainingCases[Number(node.dataset.index)]; if (!item) { flash('还没有可引用的训练案例。'); return; } generateTrainingCaseFacts(item); move('portfolio-facts'); flash('已生成训练案例内容，请确认哪些可以进入表达'); }
    else if (action === 'open-profile') state.ui.modal = 'profile';
    else if (action === 'save-profile') { state.userGoalProfile = { target: input('profileTarget'), level: input('profileLevel'), availableTime: input('profileTime') }; state.ui.modal = null; flash('目标设置已更新'); }
    else if (action === 'open-asset') { state.assetView = node.dataset.asset; state.assetRecord = null; move('asset-detail'); }
    else if (action === 'view-asset-record') { state.assetRecord = { asset: node.dataset.asset, index: Number(node.dataset.index) }; move('asset-record-detail'); }
    else if (action === 'delete-asset-record') { const source = assetSources()[node.dataset.asset]; const item = source?.items[Number(node.dataset.index)]; const list = source && state[source.key]; const index = item && list ? list.findIndex(record => record.id === item.id) : -1; if (index > -1) { state.ui.pendingDelete = { key: source.key, index }; state.ui.modal = 'delete'; } }
    else if (action === 'delete-record') { const list = state[node.dataset.kind]; const index = node.dataset.id ? list.findIndex(item => item.id === node.dataset.id) : Number(node.dataset.index); state.ui.pendingDelete = { key: node.dataset.kind, index }; state.ui.modal = 'delete'; }
    else if (action === 'confirm-delete') { const pending = state.ui.pendingDelete; if (pending && pending.index > -1) { const item = state[pending.key][pending.index]; state[pending.key].splice(pending.index, 1); state.ui.undo = { ...pending, item }; state.ui.pendingDelete = null; state.ui.modal = null; flash('记录已删除', true); } }
    else if (action === 'undo-delete') { const undo = state.ui.undo; if (undo) { state[undo.key].splice(undo.index, 0, undo.item); state.ui.undo = null; flash('已恢复记录'); } }
    else if (action === 'retry-save') { state.ui.modal = null; persist(); flash('已重新尝试保存'); }
    else if (action === 'close-modal') state.ui.modal = null;
    persist(); render();
  }
  function appendExperience(role, text) { state.experienceFlow.messages.push({ role, text, actions: [] }); }

  document.addEventListener('click', eventHandler);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && event.target.matches('[data-field="homeDraft"]')) { event.preventDefault(); event.target.closest('.ask-box')?.querySelector('[data-action="ask"]')?.click(); }
  });
  render();
})();
