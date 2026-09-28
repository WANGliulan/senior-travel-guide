// pages/result/result.js —— 结果页：概览/预算/地图/每日行程/知识图谱/天气 + AI问答
const i18n = require('../../utils/i18n')
const api = require('../../utils/api')
const storage = require('../../utils/storage')
const format = require('../../utils/format')

const app = getApp()

Page({
  data: {
    T: {},
    tripPlan: null,
    graphData: null,
    planId: '',
    activeSection: 'overview',
    navItems: [],
    overviewAttractions: [],
    dateRangeText: '',
    attractionPhotos: {},
    mapMarkers: [],
    mapPolylines: [],
    mapCenter: { latitude: 39.916527, longitude: 116.397128 },
    showBackTop: false,
    scrollTarget: '',
    loadingRestore: false
  },

  onLoad(query) {
    this.setData({ T: i18n.messages() })
    const planId = (query && query.plan_id) || ''
    this.setData({ planId })
    this.restoreTrip(planId)
  },

  t(key, params) {
    return i18n.t(key, params)
  },

  // ===== 恢复行程数据 =====
  restoreTrip(planId) {
    const global = app.getTrip()

    // 1. 全局数据且 plan_id 匹配（刚生成跳转）
    if (planId && global.plan && global.planId === planId) {
      this.applyPlan(global.plan, global.graph, global.planId)
      return
    }
    // 2. 未指定 plan_id，使用全局数据（如从首页直接跳转但 id 未透传）
    if (!planId && global.plan) {
      this.applyPlan(global.plan, global.graph, global.planId || '')
      return
    }
    // 3. 本地缓存与 plan_id 匹配
    const cached = storage.loadPlanLocally()
    if (planId && cached && cached.plan && cached.planId === planId) {
      this.applyPlan(cached.plan, cached.graph, cached.planId)
      return
    }
    // 4. 未指定 plan_id 且无全局数据，用本地缓存
    if (!planId && cached && cached.plan) {
      this.applyPlan(cached.plan, cached.graph, cached.planId || '')
      return
    }
    // 5. 指定了 plan_id，从后端回补
    if (planId) {
      this.setData({ loadingRestore: true })
      api.pollTaskStatus(planId)
        .then((task) => {
          if (task && task.status === 'completed' && task.result && task.result.data) {
            this.applyPlan(task.result.data, task.result.graph_data || null, planId)
          } else {
            wx.showToast({ title: i18n.t('result.noTripPlanDesc'), icon: 'none' })
          }
        })
        .catch(() => {
          wx.showToast({ title: i18n.t('result.noTripPlanDesc'), icon: 'none' })
        })
        .finally(() => this.setData({ loadingRestore: false }))
    }
  },

  applyPlan(plan, graph, planId) {
    app.setTrip(plan, graph, planId)
    storage.savePlanLocally(plan, graph, planId)
    this.setData({ tripPlan: plan, graphData: graph, planId: planId || '' })
    this.buildNavItems(plan)
    this.buildOverview(plan)
    this.buildMapData(plan)
    this.loadAttractionPhotos(plan)
  },

  // ===== 分区导航 =====
  buildNavItems(plan) {
    const t = i18n.t
    const items = [
      { key: 'overview', label: t('result.side.overview') },
      { key: 'days', label: t('result.side.days') }
    ]
    if (plan && plan.budget) {
      items.push({ key: 'budget', label: t('result.side.budget') })
    }
    items.push({ key: 'map', label: t('result.side.map') })
    items.push({ key: 'knowledge-graph', label: t('result.side.graph') })
    if (plan && plan.weather_info && plan.weather_info.length > 0) {
      items.push({ key: 'weather', label: t('result.side.weather') })
    }
    this.setData({ navItems: items })
  },

  switchSection(e) {
    this.setData({ activeSection: e.currentTarget.dataset.key, scrollTarget: '' })
  },

  goToDayFromOverview(e) {
    const day = Number(e.currentTarget.dataset.day)
    const plan = this.data.tripPlan
    this.setData({ activeSection: 'days' })
    // 通过 day-panel 的事件切换指定天（用 eventChannel 简化：存入全局标识）
    this.setData({ scrollTarget: '' })
    wx.nextTick(() => {
      const dayPanel = this.selectComponent('#dayPanel')
      if (dayPanel) dayPanel.scrollToDay(day)
    })
  },

  scrollTop() {
    this.setData({ scrollTarget: 'overview' })
  },

  onBodyScroll(e) {
    const top = (e.detail && e.detail.scrollTop) || 0
    const show = top > 600
    if (show !== this.data.showBackTop) {
      this.setData({ showBackTop: show })
    }
  },

  goBack() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // ===== 概览 =====
  buildOverview(plan) {
    const items = []
    ;(plan.days || []).forEach((day, dayArrayIndex) => {
      ;(day.attractions || []).forEach((attraction, order) => {
        items.push({
          uid: 'ov-' + items.length,
          dayNumberText: i18n.t('common.dayNumber', { day: dayArrayIndex + 1 }),
          name: attraction.name,
          address: attraction.address,
          visit_duration: attraction.visit_duration,
          description: attraction.description,
          ticket_price: attraction.ticket_price,
          dayNumber: dayArrayIndex + 1,
          dayArrayIndex: dayArrayIndex,
          order: order,
          image: this.getAttractionImage(attraction.name)
        })
      })
    })
    this.setData({ overviewAttractions: items })
    this.setData({
      dateRangeText: i18n.t('result.dateRange', {
        start: plan.start_date || '',
        end: plan.end_date || ''
      })
    })
  },

  getAttractionImage(name) {
    const photos = this.data.attractionPhotos
    if (photos[name]) return photos[name]
    // 深色占位图（使用 base64 SVG）
    return this.placeholderImage(name)
  },

  placeholderImage(name) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
      '<rect width="400" height="300" fill="#1a262f"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="rgba(255,255,255,0.4)">' + name + '</text>' +
      '</svg>'
    // 小程序 image 不支持 data:image/svg+xml 直接显示，改用不渲染
    return ''
  },

  loadAttractionPhotos(plan) {
    const names = []
    const seen = {}
    ;(plan.days || []).forEach((day) => {
      ;(day.attractions || []).forEach((attraction) => {
        if (attraction.name && !seen[attraction.name]) {
          seen[attraction.name] = true
          names.push(attraction.name)
        }
      })
    })

    const photos = Object.assign({}, this.data.attractionPhotos)
    names.forEach((name) => {
      photos[name] = api.poiImageUrl(name)
    })
    this.setData({ attractionPhotos: photos })

    const overview = this.data.overviewAttractions.map((item) => {
      if (item.name && photos[item.name]) {
        return Object.assign({}, item, { image: photos[item.name] })
      }
      return item
    })
    this.setData({ overviewAttractions: overview })
  },

  onImageError() {
    // 忽略，保持占位
  },

  // ===== 地图 =====
  buildMapData(plan) {
    const { markers, all } = format.buildMapMarkers(plan)
    const polylines = format.buildMapPolylines(plan)
    let center = { latitude: 39.916527, longitude: 116.397128 }
    if (all.length > 0) {
      const first = all[0].location
      center = { latitude: first.latitude, longitude: first.longitude }
    }
    this.setData({ mapMarkers: markers, mapPolylines: polylines, mapCenter: center })
  },

  refreshMap() {
    const plan = this.data.tripPlan
    if (plan) this.buildMapData(plan)
  },

  // 预算面板修改行程后同步回页面/全局
  onBudgetPlanChange(e) {
    const plan = e.detail && e.detail.plan
    if (plan) {
      app.setTrip(plan, this.data.graphData, this.data.planId)
      storage.savePlanLocally(plan, this.data.graphData, this.data.planId)
      this.setData({ tripPlan: plan })
    }
  }
})
