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
    // 显式带上年龄段，后端据此分流「通用流程 / 适老化专项流程」
    api.call('itinerary', { ageGroup: profile.ageGroup, profile: profile, crowdPref: profile.crowdPref === true })
      .then((res) => {
        this._markStep(1);
        this._markStep(2);
        this._markStep(3);
        this._markStep(4);
        const plan = res.plan;
        // 记录本次生成方式（大模型 / 规则兜底），便于行程页展示
        plan.meta = Object.assign({}, plan.meta, {
          llmUsed: !!res.llmUsed,
          llmReason: res.aiReason || '',
          filteredCount: (res.filtered && res.filtered.removedCount) || 0
        });
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
