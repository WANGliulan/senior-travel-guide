// pages/settings/settings.js —— 运行时配置
const i18n = require('../../utils/i18n')
const api = require('../../utils/api')
const storage = require('../../utils/storage')

Page({
  data: {
    T: {},
    formData: {
      api_base_url: '',
      amap_js_key: '',
      amap_web_key: '',
      google_maps_api_key: '',
      google_maps_proxy: '',
      openai_base_url: '',
      openai_model: '',
      openai_api_key: '',
      xhs_cookie: ''
    }
  },

  onLoad() {
    this.setData({ T: i18n.messages() })
    this.loadSettings()
  },

  onShow() {
    this.setData({ T: i18n.messages() })
  },

  t(key, params) {
    return i18n.t(key, params)
  },

  loadSettings() {
    // 后端地址从本地读取（前端直接使用）
    const formData = Object.assign({}, this.data.formData, {
      api_base_url: storage.getRuntimeApiBaseUrl()
    })

    // 其余配置从后端读取
    api.getBackendRuntimeSettings()
      .then((res) => {
        if (res && res.settings) {
          const s = res.settings
          this.setData({
            formData: Object.assign({}, formData, {
              amap_js_key: s.amap_js_key || '',
              amap_web_key: s.amap_web_key || '',
              google_maps_api_key: s.google_maps_api_key || '',
              google_maps_proxy: s.google_maps_proxy || '',
              openai_base_url: s.openai_base_url || '',
              openai_model: s.openai_model || '',
              openai_api_key: s.openai_api_key || '',
              xhs_cookie: s.xhs_cookie || ''
            })
          })
        }
      })
      .catch(() => {
        // 后端不可用时仅保留本地后端地址
        this.setData({ formData: formData })
      })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ ['formData.' + key]: e.detail.value })
  },

  saveSettings() {
    const fd = this.data.formData
    const normalized = storage.setRuntimeApiBaseUrl(fd.api_base_url)

    // 本地保存后端地址
    storage.setRuntimeApiBaseUrl(normalized)

    // 保存到后端（供后端服务使用）
    const updates = {
      amap_js_key: fd.amap_js_key,
      amap_web_key: fd.amap_web_key,
      google_maps_api_key: fd.google_maps_api_key,
      google_maps_proxy: fd.google_maps_proxy,
      openai_base_url: fd.openai_base_url,
      openai_model: fd.openai_model,
      openai_api_key: fd.openai_api_key,
      xhs_cookie: fd.xhs_cookie
    }

    api.updateBackendRuntimeSettings(updates)
      .then(() => {
        wx.showToast({ title: i18n.t('settings.messages.saved'), icon: 'success' })
      })
      .catch(() => {
        wx.showToast({ title: i18n.t('settings.messages.saveFailed'), icon: 'none' })
      })
  }
})
