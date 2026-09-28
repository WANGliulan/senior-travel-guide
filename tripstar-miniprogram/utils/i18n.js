// utils/i18n.js —— 多语言管理（中/英/日），支持 {占位符} 插值
const zh = require('./locales/zh')
const en = require('./locales/en')
const ja = require('./locales/ja')

const LOCALE_STORAGE_KEY = 'tripstar-locale'
const DEFAULT_LOCALE = 'zh-CN'
const SUPPORTED = ['zh-CN', 'zh-TW', 'ja-JP', 'en-US']

const MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'en-US': en
}

// 从浏览器式语言标签归一化为受支持的语言
function normalizeLocale(locale) {
  if (!locale) return DEFAULT_LOCALE
  const lower = String(locale).toLowerCase()
  if (lower.indexOf('ja') === 0) return 'ja-JP'
  if (lower.indexOf('en') === 0) return 'en-US'
  return 'zh-CN'
}

let currentLocale = DEFAULT_LOCALE

// 读取存储中的语言，若没有则使用系统语言
function init() {
  try {
    const saved = wx.getStorageSync(LOCALE_STORAGE_KEY)
    if (saved) {
      currentLocale = normalizeLocale(saved)
    } else {
      const sys = wx.getSystemInfoSync()
      currentLocale = normalizeLocale(sys.language)
    }
  } catch (e) {
    currentLocale = DEFAULT_LOCALE
  }
  return currentLocale
}

function setLocale(locale) {
  currentLocale = normalizeLocale(locale)
  try {
    wx.setStorageSync(LOCALE_STORAGE_KEY, currentLocale)
  } catch (e) { /* ignore */ }
  return currentLocale
}

function getLocale() {
  return currentLocale
}

// 沿点路径取值，如 t('result.budget.attraction')
function lookup(obj, path) {
  const keys = String(path).split('.')
  let node = obj
  for (let i = 0; i < keys.length; i++) {
    if (node == null) return undefined
    node = node[keys[i]]
  }
  return node
}

// 占位符替换：{day} {name} 等
function interpolate(text, params) {
  if (!text) return text
  if (!params) return text
  return String(text).replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key]
    return value === undefined || value === null ? match : String(value)
  })
}

// 翻译函数：t('common.dayNumber', { day: 1 })
function t(key, params) {
  const messages = MESSAGES[currentLocale] || zh
  let value = lookup(messages, key)
  if (value === undefined) {
    // 回退到中文
    value = lookup(zh, key)
  }
  if (value === undefined) {
    return key
  }
  return interpolate(value, params)
}

// 返回当前语言完整字典（供 WXML 通过 {{T.xx.xx}} 使用，WXML 无法调用方法）
function messages() {
  return MESSAGES[currentLocale] || zh
}

module.exports = {
  init,
  setLocale,
  getLocale,
  t,
  messages,
  normalizeLocale,
  DEFAULT_LOCALE,
  SUPPORTED
}
