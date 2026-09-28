// pages/generating/generating.js - 行程生成中（进度化提示，缓解等待焦虑）
const api = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    steps: [
      { text: '适老规则引擎过滤景点', done: false },
      { text: '检索景点与出行知识库', done: false },
      { text: '智能体生成慢节奏行程', done: false },
      { text: '评估行程风险', done: false },
      { text: '整理老年出行贴士', done: false }
    ],
    error: '',
    fontScale: 16,
    highContrast: false
  },

  onLoad() {
    this.applySettings();
    this.run();
  },

  applySettings() {
    const s = getApp().getSettings();
    this.setData({ fontScale: Math.round(15 * (s.fontScale || 1.2)), highContrast: !!s.highContrast });
  },

  run() {
    const profile = store.get(store.KEY_PENDING, null);
    if (!profile || !profile.city) {
      this.setData({ error: '缺少出行信息，请返回重新填写' });
      return;
    }
    this._markStep(0);
    api.call('itinerary', { profile })
      .then((res) => {
        this._markStep(1);
        this._markStep(2);
        this._markStep(3);
        this._markStep(4);
        const plan = res.plan;
        getApp().globalData.currentPlan = plan;
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/itinerary/itinerary?from=generate' });
        }, 400);
      })
      .catch((err) => {
        this.setData({ error: (err && err.message) || '生成失败，请重试' });
      });
  },

  _markStep(i) {
    const steps = this.data.steps.map((s, idx) => Object.assign({}, s, { done: idx <= i }));
    this.setData({ steps });
  },

  retry() {
    this.setData({ error: '' });
    this.run();
  },

  back() {
    wx.navigateBack();
  }
});
