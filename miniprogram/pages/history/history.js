// pages/history/history.js - 我的方案（保存与历史查看）
const api = require('../../utils/api');
const fmt = require('../../utils/format');

Page({
  data: {
    list: [],
    loading: true,
    fontScale: 16,
    highContrast: false
  },

  onShow() {
    this.applySettings();
    this.loadList();
  },

  applySettings() {
    const s = getApp().getSettings();
    this.setData({ fontScale: Math.round(15 * (s.fontScale || 1.2)), highContrast: !!s.highContrast });
  },

  loadList() {
    api.call('plan', { action: 'list' })
      .then((res) => {
        const list = (res.list || []).map((p) => Object.assign({}, p, {
          createdAtText: fmt.formatTime(p.createdAt) || fmt.formatTime(p.generatedAt) || ''
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => {
        this.setData({ list: [], loading: false });
      });
  },

  view(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/itinerary/itinerary?from=history&id=' + id });
  },

  del(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除方案',
      content: '确定删除这份行程方案吗？',
      confirmColor: '#B91C1C',
      success: (res) => {
        if (res.confirm) {
          api.call('plan', { action: 'delete', id })
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadList();
            })
            .catch(() => wx.showToast({ title: '删除失败', icon: 'none' }));
        }
      }
    });
  }
});
