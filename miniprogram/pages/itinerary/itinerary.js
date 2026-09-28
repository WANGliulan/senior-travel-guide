// pages/itinerary/itinerary.js - 行程结果页（核心交付页）
const api = require('../../utils/api');
const store = require('../../utils/store');
const fmt = require('../../utils/format');

const ADJUST_LABEL = {
  increase_rest: '增加休息',
  reduce_walk: '减少步行',
  change_indoor: '更换室内景点',
  avoid_crowd: '避开人流密集'
};

Page({
  data: {
    plan: null,
    loading: true,
    fontScale: 16,
    highContrast: false,
    saved: false
  },

  onLoad(options) {
    this.applySettings();
    if (options.from === 'history' && options.id) {
      this._loadFromStore(options.id);
    } else {
      const plan = getApp().globalData.currentPlan;
      if (plan) {
        this.setData({ plan, loading: false });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '没有行程数据，请先生成', icon: 'none' });
      }
    }
  },

  onShow() {
    this.applySettings();
  },

  applySettings() {
    const s = getApp().getSettings();
    this.setData({ fontScale: Math.round(15 * (s.fontScale || 1.2)), highContrast: !!s.highContrast });
  },

  _loadFromStore(id) {
    api.call('plan', { action: 'get', id })
      .then((res) => {
        if (res.plan) {
          getApp().globalData.currentPlan = res.plan;
          this.setData({ plan: res.plan, loading: false });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: '方案不存在或已删除', icon: 'none' });
        }
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  levelClass(level) {
    return 'level-' + ({ '高': 'high', '中': 'mid', '低': 'low' }[level] || 'low');
  },

  // ===== 快捷调整 =====
  onAdjust(e) {
    const action = e.currentTarget.dataset.action;
    const plan = this.data.plan;
    wx.showLoading({ title: '正在调整…' });
    api.call('adjust', { action, plan })
      .then((res) => {
        wx.hideLoading();
        if (res.plan) {
          this.setData({ plan: res.plan, saved: false });
          wx.showToast({ title: '已为您调整行程', icon: 'success' });
        }
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '调整失败，请重试', icon: 'none' });
      });
  },

  // ===== 保存方案 =====
  save() {
    const plan = this.data.plan;
    if (!plan) return;
    api.call('plan', { action: 'save', plan })
      .then((res) => {
        this.setData({ saved: true });
        wx.showToast({ title: '已保存到「我的方案」', icon: 'success' });
      })
      .catch(() => {
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  },

  // ===== 复制行程文本 =====
  copy() {
    const plan = this.data.plan;
    if (!plan) return;
    const text = fmt.planToText(plan);
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '行程已复制，可转发给家人', icon: 'success' })
    });
  },

  // ===== 生成分享图片 =====
  shareImage() {
    const plan = this.data.plan;
    if (!plan) return;
    wx.showLoading({ title: '生成分享图…' });
    this._drawShareCanvas(plan);
  },

  _drawShareCanvas(plan) {
    const query = wx.createSelectorQuery().in(this);
    query.select('#shareCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = ((wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2);
      const W = 640, H = 900;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      // 背景
      ctx.fillStyle = '#F4FAF6';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5DAF8C';
      ctx.fillRect(0, 0, W, 140);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('智游康行 · 岁旅相伴', 32, 62);
      ctx.font = '20px sans-serif';
      ctx.fillText(plan.city + ' · ' + plan.days + '天 · 适老行程', 32, 104);

      let y = 180;
      ctx.fillStyle = '#2E6B4F';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(plan.title || '', 32, y);
      y += 44;
      (plan.schedule || []).forEach((day) => {
        if (y > H - 60) return;
        ctx.fillStyle = '#5DAF8C';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('第' + day.day + '天 ' + (day.theme || ''), 32, y);
        y += 34;
        (day.spots || []).forEach((s) => {
          if (y > H - 60) return;
          ctx.fillStyle = s.rest ? '#B45309' : (s.meal ? '#2E7D5A' : (s.restDay ? '#7C8B83' : '#2B3440'));
          ctx.font = '20px sans-serif';
          const prefix = s.rest ? '☕ ' : (s.meal ? '🍚 ' : (s.restDay ? '🌿 ' : '· '));
          ctx.fillText(prefix + s.name + (s.rest || s.meal || s.restDay ? '' : ('（' + (s.duration || '') + '）')), 48, y);
          y += 32;
        });
        y += 10;
      });

      ctx.fillStyle = '#B91C1C';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('行程风险评估：' + (plan.risk ? plan.risk.level : ''), 32, y + 6);
      y += 40;
      ctx.fillStyle = '#6B7280';
      ctx.font = '18px sans-serif';
      ctx.fillText('—— 由"智游康行·岁旅相伴"适老行程助手生成，出行注意安全', 32, H - 30);

      wx.canvasToTempFilePath({
        canvas,
        success: (r) => {
          wx.hideLoading();
          wx.previewImage({ urls: [r.tempFilePath] });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      });
    });
  },

  // ===== 继续对话 =====
  goChat() {
    getApp().globalData.currentPlan = this.data.plan;
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  // ===== 转发给家人确认 =====
  onShareAppMessage() {
    const plan = this.data.plan;
    return {
      title: plan ? ('【' + plan.title + '】请爸妈查收') : '智游康行·岁旅相伴 - 适老行程助手',
      path: '/pages/index/index'
    };
  }
});
