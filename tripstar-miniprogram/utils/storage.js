// utils/storage.js —— 本地存储与运行时配置管理（对应原前端 services/api.ts 的存储部分）
const USER_ID_KEY = 'tripstar.user_id'
const API_BASE_KEY = 'tripstar.runtime.api_base_url'
const AMAP_WEB_KEY_KEY = 'tripstar.runtime.amap_web_key'
const GOOGLE_MAPS_KEY = 'tripstar.runtime.google_maps_api_key'
const PLAN_STORAGE_KEY = 'tripstar.plan'

function getStorage(key, def) {
  try {
    const v = wx.getStorageSync(key)
    return v === '' || v === undefined ? def : v
  } catch (e) {
    return def
  }
}

function setStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (e) { /* ignore */ }
}

function removeStorage(key) {
  try {
    wx.removeStorageSync(key)
  } catch (e) { /* ignore */ }
}

function normalizeBaseUrl(value) {
  const text = String(value == null ? '' : value).trim()
  return text.replace(/\/+$/, '')
}

// ===== 用户唯一 ID（本地生成并持久化，用于记忆库） =====
function getOrCreateUserId() {
  let uid = getStorage(USER_ID_KEY, '')
  if (!uid) {
    uid = 'wx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    setStorage(USER_ID_KEY, uid)
  }
  return uid
}

// ===== 后端地址 =====
const DEFAULT_API_BASE = 'http://localhost:8000'

function getRuntimeApiBaseUrl() {
  const saved = normalizeBaseUrl(getStorage(API_BASE_KEY, ''))
  return saved || DEFAULT_API_BASE
}

function setRuntimeApiBaseUrl(value) {
  const normalized = normalizeBaseUrl(value)
  if (normalized) {
    setStorage(API_BASE_KEY, normalized)
    return normalized
  }
  return getRuntimeApiBaseUrl()
}

// ===== 运行时配置（来自后端 /api/settings） =====
function getRuntimeSettings() {
  return getStorage('tripstar.runtime.settings', {})
}

function setRuntimeSettings(settings) {
  setStorage('tripstar.runtime.settings', settings || {})
}

function getGoogleMapsApiKey() {
  return String(getStorage(GOOGLE_MAPS_KEY, ''))
}

// ===== 行程计划本地缓存 =====
function savePlanLocally(plan, graph, planId) {
  setStorage(PLAN_STORAGE_KEY, {
    plan: plan,
    graph: graph || null,
    planId: planId || ''
  })
}

function loadPlanLocally() {
  return getStorage(PLAN_STORAGE_KEY, null)
}

function clearPlanLocally() {
  removeStorage(PLAN_STORAGE_KEY)
}

module.exports = {
  getStorage,
  setStorage,
  removeStorage,
  getOrCreateUserId,
  getRuntimeApiBaseUrl,
  setRuntimeApiBaseUrl,
  getRuntimeSettings,
  setRuntimeSettings,
  getGoogleMapsApiKey,
  savePlanLocally,
  loadPlanLocally,
  clearPlanLocally,
  normalizeBaseUrl
}
