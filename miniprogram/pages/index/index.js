// pages/index/index.js - 智能体首页：自由对话 + 快捷服务模块
const api = require('../../utils/api');

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    allCities: [],
    quickChips: ['生成行程', '给我出行贴士', '去北京玩3天', '看看我的方案'],
    fontScale: 16,
    highContrast: false,
    quickServices: [
      { key: 'plan', label: '生成行程', desc: '定制适老行程' },
      { key: 'settings', label: '显示设置', desc: '字体与对比度' }
    ]
  },

  onLoad() {
    this.applySettings();
    this.loadCities();
    this._greet();
  },

  onShow() {
    this.applySettings();
  },

  applySettings() {
    const s = getApp().getSettings();
    this.setData({ fontScale: Math.round(15 * (s.fontScale || 1.2)), highContrast: !!s.highContrast });
  },

  loadCities() {
    api.call('cities', {}).then((res) => {
      const all = [];
      (res.regions || []).forEach((r) => (r.cities || []).forEach((c) => all.push(c)));
      this.setData({ allCities: all });
    }).catch(() => {});
  },

  _greet() {
    this._push({
      role: 'assistant',
      content: '您好，我是"智游康行"的适老出行助手。\n我可以帮您：\n· 生成慢节奏、低负荷的适老行程（告诉我目的地城市即可）\n· 提供老年出行贴士（健康、饮食、天气、随身物品）\n· 调整已有行程（增加休息、减少步行、换室内景点）\n\n直接对我说您想做什么，或点击下方服务模块快速进入。'
    });
  },

  _push(msg) {
    const messages = this.data.messages.concat([Object.assign({}, msg, { id: Date.now() + Math.random() })]);
    this.setData({ messages, scrollTo: 'bottom' });
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  // ===== 发送指令 =====
  send() {
    const text = (this.data.input || '').trim();
    if (!text || this.data.sending) return;
    this._push({ role: 'user', content: text });
    this.setData({ input: '', sending: true });
    this._push({ role: 'assistant', content: '…', typing: true });
    this._route(text);
  },

  _route(text) {
    // 1) 城市意图：去指定城市
    const city = this._findCity(text);
    if (city) {
      this._reply(
        '好的，为您规划【' + city + '】的适老行程。\n我会优先过滤高体力、无无障碍配套的景点，生成慢节奏低负荷的行程。\n请告诉我大概玩几天，或直接点击下方按钮开始填写出行信息。',
        [{ label: '开始生成' + city + '行程', city: city }]
      );
      return;
    }
    // 2) 出行贴士意图（含"出行"字样，须先于行程判断）
    if (/(贴士|注意|忌口|天气|穿衣|药品|携带|健康|血压|血糖|证件)/.test(text)) {
      this._reply(this._tipsText());
      return;
    }
    // 3) 行程/规划意图
    if (/(行程|规划|攻略|旅游|去|玩|出行|路线)/.test(text)) {
      this._reply(
        '好的，我可以帮您生成适老行程。\n请告诉我目的地城市（例如"我想去杭州玩3天"），或直接点击下方"生成行程"。',
        [{ label: '生成行程', city: '' }]
      );
      return;
    }
    // 4) 我的方案意图
    if (/(方案|历史|我的行程|保存)/.test(text)) {
      this._reply('好的，已带您到"我的方案"，那里保存了您生成的所有行程。');
      wx.switchTab({ url: '/pages/history/history' });
      return;
    }
    // 5) 问候
    if (/(你好|您好|在吗|嗨|hello|hi)/i.test(text)) {
      this._reply('您好呀！我是您的适老出行助手。您可以告诉我：\n· "去北京玩3天" → 生成行程\n· "给我出行贴士" → 出行建议\n· "看看我的方案" → 历史行程\n需要我帮您做什么？');
      return;
    }
    // 6) 其他：交给智能体自由对话（大模型/关键词兜底）
    const messages = this.data.messages.filter((m) => !m.typing).map((m) => ({ role: m.role, content: m.content }));
    api.call('dialogue', { messages, plan: getApp().globalData.currentPlan || null })
      .then((res) => {
        this._reply(res.reply || '收到，还有什么可以帮您？');
      })
      .catch(() => {
        this._reply('抱歉，网络开小差了，请稍后再试。');
      });
  },

  _findCity(text) {
    if (!text) return null;
    const hits = this.data.allCities.filter((c) => text.indexOf(c) >= 0);
    return hits.length ? hits[hits.length - 1] : null;
  },

  _reply(content, actions) {
    const msgs = this.data.messages.filter((m) => !m.typing);
    msgs.push({ role: 'assistant', content: content, actions: actions || [], id: Date.now() });
    this.setData({ messages: msgs, sending: false });
  },

  _tipsText() {
    return '为您整理的老年出行小贴士：\n' +
      '· 休息：每日安排 1-2 次茶歇，午后适当午休\n' +
      '· 医疗：出发前确认沿途医院药店；慢病随身带药、按时服药\n' +
      '· 饮食：清淡少油盐；高血压少盐、糖尿病定时定量、心脏病七分饱\n' +
      '· 天气：早晚温差大带薄外套；晴天防晒、雨天防滑\n' +
      '· 随身：常用药+病历摘要+急救卡、身份证/老年证、保温杯、舒适防滑鞋\n' +
      '如需更贴合您身体状况的建议，可先生成一份行程，我会在贴士中自动加入您的忌口与提醒。';
  },

  // 消息中的快捷操作按钮
  onMsgAction(e) {
    const city = e.currentTarget.dataset.city || '';
    wx.navigateTo({ url: city ? ('/pages/form/form?city=' + encodeURIComponent(city)) : '/pages/form/form' });
  },

  // ===== 快捷服务模块 =====
  onService(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'plan') {
      wx.navigateTo({ url: '/pages/form/form' });
    } else if (key === 'settings') {
      wx.switchTab({ url: '/pages/settings/settings' });
    }
  },

  onQuick(e) {
    this.setData({ input: e.currentTarget.dataset.text });
    this.send();
  }
});
