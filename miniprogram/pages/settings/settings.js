// pages/settings/settings.js - 适老化设置（字体大小、高对比度、关于）
const store = require('../../utils/store');

Page({
  data: {
    fontScale: 1.2,
    fontScaleText: 120,
    highContrast: false,
    cloudReady: false,
    openid: '',
    version: '1.0.0'
  },

  onLoad() {
    this.load();
  },

  onShow() {
    this.load();
  },

  load() {
    const app = getApp();
    const settings = store.get(store.KEY_SETTINGS, { fontScale: 1.2, highContrast: false });
    this.setData({
      fontScale: settings.fontScale || 1.2,
      fontScaleText: Math.round((settings.fontScale || 1.2) * 100),
      highContrast: !!settings.highContrast,
      cloudReady: app.globalData.cloudReady,
      openid: app.globalData.openid ? app.globalData.openid.slice(0, 8) + '…' : ''
    });
  },

  onFontScale(e) {
    const fontScale = e.detail.value / 100;
    this.setData({ fontScale, fontScaleText: e.detail.value });
    store.set(store.KEY_SETTINGS, { fontScale, highContrast: this.data.highContrast });
    getApp().globalData.fontScale = fontScale;
  },

  onContrast(e) {
    const highContrast = e.detail.value;
    this.setData({ highContrast });
    store.set(store.KEY_SETTINGS, { fontScale: this.data.fontScale, highContrast });
    getApp().globalData.highContrast = highContrast;
  },

  clearHistory() {
    wx.showModal({
      title: '清空历史',
      content: '将删除本地的全部方案记录，确定吗？',
      confirmColor: '#B91C1C',
      success: (res) => {
        if (res.confirm) {
          const plans = store.get(store.KEY_PLANS, []);
          plans.forEach((p) => store.remove(store.KEY_PLAN_BODY + p.id));
          store.set(store.KEY_PLANS, []);
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  }
});
