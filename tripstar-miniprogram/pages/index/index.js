// pages/index/index.js —— 首页：目的地与偏好表单 + 进度轮询 + 历史计划
const i18n = require('../../utils/i18n')
const api = require('../../utils/api')
const storage = require('../../utils/storage')
const format = require('../../utils/format')

const app = getApp()

Page({
  data: {
    locale: 'zh-CN',
    formData: {
      city: '',
      start_date: '',
      end_date: '',
      travel_days: 1,
      transportation: '公共交通',
      accommodation: '经济型酒店',
      preferences: [],
      free_text_input: ''
    },
    cityFocus: false,
    transportOptions: [
      { value: '公共交通', label: '' },
      { value: '自驾', label: '' },
      { value: '步行', label: '' },
      { value: '混合', label: '' }
    ],
    transportIndex: 0,
    accommodationOptions: [
      { value: '经济型酒店', label: '' },
      { value: '舒适型酒店', label: '' },
      { value: '豪华酒店', label: '' },
      { value: '民宿', label: '' }
    ],
    accommodationIndex: 0,
    interestOptions: [
      { value: '历史文化', i18nKey: 'home.interests.history', label: '', active: false },
      { value: '自然风光', i18nKey: 'home.interests.nature', label: '', active: false },
      { value: '美食', i18nKey: 'home.interests.food', label: '', active: false },
      { value: '购物', i18nKey: 'home.interests.shopping', label: '', active: false },
      { value: '艺术', i18nKey: 'home.interests.art', label: '', active: false },
      { value: '休闲', i18nKey: 'home.interests.leisure', label: '', active: false }
    ],
    loading: false,
    loadingProgress: 0,
    loadingStatus: '',
    historyItems: [],
    pollTimer: null
  },

  onLoad() {
    this.refreshI18n()
    this.loadHistory()
  },

  onUnload() {
    this.stopPolling()
  },

  onShow() {
    // 返回时刷新语言
    const locale = i18n.getLocale()
    if (locale !== this.data.locale) {
      this.setData({ locale })
      this.refreshI18n()
    }
  },

  // 刷新语言相关文案
  refreshI18n() {
    const t = i18n.t
    // 将当前语言完整字典挂到 data.T 供 WXML 使用
    const T = i18n.messages()
    // 同步各选项 label 与当前选中偏好
    const prefs = this.data.formData.preferences
    const interestOptions = this.data.interestOptions.map((opt) => {
      return Object.assign({}, opt, {
        label: t(opt.i18nKey),
        active: prefs.indexOf(opt.value) > -1
      })
    })
    this.setData({
      T: T,
      locale: i18n.getLocale(),
      'transportOptions[0].label': t('home.transportation.public'),
      'transportOptions[1].label': t('home.transportation.drive'),
      'transportOptions[2].label': t('home.transportation.walk'),
      'transportOptions[3].label': t('home.transportation.mixed'),
      'accommodationOptions[0].label': t('home.accommodation.budget'),
      'accommodationOptions[1].label': t('home.accommodation.comfort'),
      'accommodationOptions[2].label': t('home.accommodation.luxury'),
      'accommodationOptions[3].label': t('home.accommodation.homestay'),
      interestOptions: interestOptions
    })
  },

  // t() 供 JS 逻辑使用（WXML 使用预计算的 T）
  t(key, params) {
    return i18n.t(key, params)
  },

  switchLocale(e) {
    const locale = e.currentTarget.dataset.locale
    i18n.setLocale(locale)
    this.setData({ locale })
    this.refreshI18n()
  },

  // ===== 表单输入 =====
  onCityInput(e) {
    this.setData({ 'formData.city': e.detail.value })
  },
  onCityFocus() { this.setData({ cityFocus: true }) },
  onCityBlur() { this.setData({ cityFocus: false }) },

  onStartDateChange(e) {
    const start = e.detail.value
    const patch = { 'formData.start_date': start }
    if (this.data.formData.end_date && this.data.formData.end_date < start) {
      patch['formData.end_date'] = ''
    }
    this.setData(patch, () => this.recalcDays())
  },

  onEndDateChange(e) {
    const end = e.detail.value
    const start = this.data.formData.start_date
    if (start && end < start) {
      wx.showToast({ title: i18n.t('home.messages.endDateEarlier'), icon: 'none' })
      return
    }
    this.setData({ 'formData.end_date': end }, () => this.recalcDays())
  },

  recalcDays() {
    const { start_date, end_date } = this.data.formData
    if (start_date && end_date) {
      const days = format.diffDays(start_date, end_date)
      if (days > 30) {
        wx.showToast({ title: i18n.t('home.messages.travelDaysTooLong'), icon: 'none' })
        this.setData({ 'formData.end_date': '' })
        return
      }
      if (days > 0) {
        this.setData({ 'formData.travel_days': days })
      }
    }
  },

  onTransportChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      transportIndex: index,
      'formData.transportation': this.data.transportOptions[index].value
    })
  },

  onAccommodationChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      accommodationIndex: index,
      'formData.accommodation': this.data.accommodationOptions[index].value
    })
  },

  togglePreference(e) {
    const value = e.currentTarget.dataset.value
    const prefs = this.data.formData.preferences.slice()
    const idx = prefs.indexOf(value)
    if (idx === -1) {
      prefs.push(value)
    } else {
      prefs.splice(idx, 1)
    }
    const interestOptions = this.data.interestOptions.map((opt) => {
      if (opt.value === value) {
        return Object.assign({}, opt, { active: prefs.indexOf(value) > -1 })
      }
      return opt
    })
    this.setData({ 'formData.preferences': prefs, interestOptions: interestOptions })
  },

  onFreeTextInput(e) {
    this.setData({ 'formData.free_text_input': e.detail.value })
  },

  // ===== 提交与轮询 =====
  getStageStatusText(stage) {
    const t = i18n.t
    if (stage === 'submitted' || stage === 'initializing') return t('home.loading.initializing')
    if (stage === 'attraction_search') return t('home.loading.searchingAttractions')
    if (stage === 'weather_search') return t('home.loading.queryingWeather')
    if (stage === 'hotel_search') return t('home.loading.recommendingHotels')
    if (stage === 'planning') return t('home.loading.generatingPlan')
    if (stage === 'graph_building') return t('home.loading.generatingPlan')
    if (stage === 'completed') return t('home.loading.done')
    return t('home.loading.initializing')
  },

  handleSubmit() {
    if (this.data.loading) return
    const fd = this.data.formData

    if (!fd.city.trim()) {
      wx.showToast({ title: i18n.t('home.cityRequired'), icon: 'none' })
      return
    }
    if (!fd.start_date || !fd.end_date) {
      wx.showToast({ title: i18n.t('home.messages.selectDate'), icon: 'none' })
      return
    }

    this.setData({ loading: true, loadingProgress: 5, loadingStatus: i18n.t('home.loading.initializing') })

    const requestData = {
      city: fd.city.trim(),
      start_date: fd.start_date,
      end_date: fd.end_date,
      travel_days: fd.travel_days,
      transportation: fd.transportation,
      accommodation: fd.accommodation,
      preferences: fd.preferences,
      free_text_input: fd.free_text_input,
      language: i18n.getLocale(),
      user_id: storage.getOrCreateUserId()
    }

    const t = i18n.t
    api.submitTripPlan(requestData)
      .then((task) => {
        if (task && task.task_id) {
          this.startPolling(task.task_id)
        } else {
          throw new Error(t('api.submitTripPlanFailed'))
        }
      })
      .catch((err) => {
        this.finishLoading()
        wx.showToast({ title: (err && err.message) || t('home.messages.generateRetry'), icon: 'none' })
      })
  },

  startPolling(taskId) {
    this.stopPolling()
    const poll = () => {
      api.pollTaskStatus(taskId)
        .then((res) => {
          if (!res) return
          if (res.status === 'processing') {
            if (typeof res.progress === 'number') {
              this.setData({ loadingProgress: Math.max(0, Math.min(100, res.progress)) })
            }
            this.setData({ loadingStatus: res.progress_text || this.getStageStatusText(res.stage) })
            return
          }
          if (res.status === 'completed') {
            this.stopPolling()
            this.handleCompleted(res.result, taskId)
            return
          }
          if (res.status === 'failed') {
            this.stopPolling()
            this.finishLoading()
            wx.showToast({ title: res.error || i18n.t('home.messages.generateFailed'), icon: 'none' })
          }
        })
        .catch((err) => {
          this.stopPolling()
          this.finishLoading()
          wx.showToast({ title: (err && err.message) || i18n.t('home.messages.generateRetry'), icon: 'none' })
        })
    }
    poll()
    this.setData({ pollTimer: setInterval(poll, 3000) })
  },

  stopPolling() {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer)
      this.setData({ pollTimer: null })
    }
  },

  handleCompleted(result, taskId) {
    if (result && result.success && result.data) {
      const plan = result.data
      const graph = result.graph_data || null
      const planId = result.plan_id || taskId || ''
      app.setTrip(plan, graph, planId)
      storage.savePlanLocally(plan, graph, planId)

      this.setData({ loadingProgress: 100, loadingStatus: i18n.t('home.loading.done') })
      wx.showToast({ title: i18n.t('home.messages.generateSuccess'), icon: 'success' })

      setTimeout(() => {
        this.finishLoading()
        wx.navigateTo({ url: '/pages/result/result?plan_id=' + planId })
      }, 600)
    } else {
      this.finishLoading()
      wx.showToast({ title: (result && result.message) || i18n.t('home.messages.generateFailed'), icon: 'none' })
    }
  },

  finishLoading() {
    this.stopPolling()
    setTimeout(() => {
      this.setData({ loading: false, loadingProgress: 0, loadingStatus: '' })
    }, 300)
  },

  // ===== 历史计划 =====
  loadHistory() {
    api.getTripHistory(8)
      .then((res) => {
        const items = (res && res.items) || []
        this.setData({ historyItems: items })
      })
      .catch(() => {
        // 静默失败，保留已有列表
      })
  },

  openHistory(e) {
    const planId = e.currentTarget.dataset.plan
    if (planId) {
      wx.navigateTo({ url: '/pages/result/result?plan_id=' + planId })
    }
  }
})
