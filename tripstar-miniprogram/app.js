// app.js —— 旅途星辰 TripStar 微信小程序入口
const i18n = require('./utils/i18n')

App({
  globalData: {
    // 当前行程计划（跨页面共享）
    tripPlan: null,
    // 知识图谱数据
    graphData: null,
    // 计划编号
    planId: '',
    // 当前语言
    locale: 'zh-CN'
  },

  onLaunch() {
    // 初始化语言
    const locale = i18n.init()
    this.globalData.locale = locale
  },

  // 全局设置行程数据（result 页与 chat 共用）
  setTrip(plan, graph, planId) {
    this.globalData.tripPlan = plan
    this.globalData.graphData = graph || null
    this.globalData.planId = planId || ''
  },

  getTrip() {
    return {
      plan: this.globalData.tripPlan,
      graph: this.globalData.graphData,
      planId: this.globalData.planId
    }
  }
})
