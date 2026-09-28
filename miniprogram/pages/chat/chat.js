// pages/chat/chat.js - 智能体多轮对话（自然语言修改行程，约束持续生效）
const api = require('../../utils/api');
const fmt = require('../../utils/format');

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    plan: null,
    constraintText: '',
    quickChips: ['增加休息', '减少步行', '换室内景点', '避开人流', '行程太赶了'],
    fontScale: 16,
    highContrast: false,
    scrollTo: ''
  },

  onLoad() {
    this.applySettings();
    const plan = getApp().globalData.currentPlan;
    if (plan) {
      this.setData({ plan });
      this.setData({ constraintText: this._constraintText(plan.profile) });
      this._push({ role: 'assistant', content: '您好！我是您的老年出行助手。您可以直接告诉我怎么调整行程，比如"增加休息""减少步行""换室内景点""避开人流"，我会在您身体条件允许的范围内帮您调整。' });
    } else {
      this._push({ role: 'assistant', content: '您好！请先生成一份行程，再回来和我对话调整。' });
    }
  },

  onShow() {
    this.applySettings();
  },

  applySettings() {
    const s = getApp().getSettings();
    this.setData({ fontScale: Math.round(15 * (s.fontScale || 1.2)), highContrast: !!s.highContrast });
  },

  _constraintText(profile) {
    if (!profile) return '';
    const parts = [
      '行动能力：' + profile.mobility,
      '慢病：' + (profile.chronic && profile.chronic.length ? profile.chronic.join('、') : '无'),
      '无障碍：' + (profile.accessible ? '需要' : '不需要'),
      '步行上限：' + profile.walkLimit
    ];
    return '身体约束：' + parts.join('　');
  },

  _push(msg) {
    const messages = this.data.messages.concat([Object.assign({}, msg, { id: Date.now() + Math.random() })]);
    this.setData({ messages, scrollTo: 'bottom' });
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  send() {
    const text = (this.data.input || '').trim();
    if (!text || this.data.sending) return;
    const plan = this.data.plan;
    if (!plan) {
      wx.showToast({ title: '请先生成行程', icon: 'none' });
      return;
    }
    this._push({ role: 'user', content: text });
    this.setData({ input: '', sending: true });
    this._push({ role: 'assistant', content: '…', typing: true });

    const messages = this.data.messages.filter((m) => !m.typing).map((m) => ({ role: m.role, content: m.content }));
    api.call('dialogue', { messages, plan })
      .then((res) => {
        const msgs = this.data.messages.filter((m) => !m.typing);
        msgs.push({ role: 'assistant', content: res.reply || '已收到您的想法', id: Date.now() });
        let newPlan = this.data.plan;
        if (res.plan) {
          newPlan = res.plan;
          getApp().globalData.currentPlan = newPlan;
          msgs.push({ role: 'assistant', content: '行程已按您的要求更新，点击下方按钮可查看最新行程。', id: Date.now() + 1 });
        }
        this.setData({ messages: msgs, sending: false, plan: newPlan });
      })
      .catch((err) => {
        const msgs = this.data.messages.filter((m) => !m.typing);
        msgs.push({ role: 'assistant', content: '抱歉，网络开小差了，请稍后再试。', id: Date.now() });
        this.setData({ messages: msgs, sending: false });
      });
  },

  onQuick(e) {
    this.setData({ input: e.currentTarget.dataset.text });
    this.send();
  },

  viewPlan() {
    wx.navigateBack();
  },

  copyPlan() {
    if (!this.data.plan) return;
    wx.setClipboardData({
      data: fmt.planToText(this.data.plan),
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  }
});
