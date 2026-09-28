// pages/history/history.js —— 历史计划列表
const i18n = require('../../utils/i18n')
const api = require('../../utils/api')

Page({
  data: {
    T: {},
    items: [],
    loading: true
  },

  onLoad() {
    this.setData({ T: i18n.messages() })
    this.loadHistory()
  },

  onPullDownRefresh() {
    this.loadHistory(() => wx.stopPullDownRefresh())
  },

  t(key, params) {
    return i18n.t(key, params)
  },

  loadHistory(done) {
    this.setData({ loading: true })
    api.getTripHistory(50)
      .then((res) => {
        this.setData({ items: (res && res.items) || [], loading: false })
      })
      .catch(() => {
        this.setData({ items: [], loading: false })
        wx.showToast({ title: i18n.t('home.history.loadFailed'), icon: 'none' })
      })
      .finally(() => {
        if (done) done()
      })
  },

  openHistory(e) {
    const planId = e.currentTarget.dataset.plan
    if (planId) {
      wx.navigateTo({ url: '/pages/result/result?plan_id=' + planId })
    }
  },

  goCreate() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
