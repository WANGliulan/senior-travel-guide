// utils/api.js —— 后端 HTTP 封装（wx.request），对应原前端 services/api.ts
const storage = require('./storage')

// 通用请求封装
function request(method, url, data, options) {
  const baseUrl = storage.getRuntimeApiBaseUrl()
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + url,
      method: method || 'GET',
      data: data || {},
      header: { 'Content-Type': 'application/json' },
      timeout: options && options.timeout ? options.timeout : 60000,
      success: (res) => {
        // HTTP 非 2xx
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          const detail = (res.data && (res.data.detail || res.data.message)) || ('HTTP ' + res.statusCode)
          reject(new Error(detail))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      }
    })
  })
}

function get(url, params, options) {
  return request('GET', url, params, options)
}

function post(url, data, options) {
  return request('POST', url, data, options)
}

function put(url, data, options) {
  return request('PUT', url, data, options)
}

function del(url, params, options) {
  return request('DELETE', url, params, options)
}

// ===== 健康检查 =====
function healthCheck() {
  return get('/health')
}

// ===== 提交旅行规划任务（立即返回 task_id） =====
function submitTripPlan(formData) {
  const payload = Object.assign({}, formData, { user_id: storage.getOrCreateUserId() })
  return post('/api/trip/plan', payload)
}

// ===== 轮询任务状态 =====
function pollTaskStatus(taskId) {
  return get('/api/trip/status/' + taskId)
}

// ===== 历史计划 =====
function getTripHistory(limit) {
  return get('/api/trip/history', { limit: limit || 8 })
}

// ===== 运行时配置 =====
function getBackendRuntimeSettings() {
  return get('/api/settings')
}

function updateBackendRuntimeSettings(updates) {
  return put('/api/settings', updates)
}

// ===== AI 行程问答 =====
function askTripChat(message, tripPlan, history) {
  return post('/api/chat/ask', {
    message: message,
    trip_plan: tripPlan,
    history: history || []
  })
}

// ===== 用户记忆 =====
function listUserMemory() {
  return get('/api/memory/list', { user_id: storage.getOrCreateUserId() })
}

function addExplicitMemory(content) {
  return post('/api/memory/add-explicit', null, { query: { user_id: storage.getOrCreateUserId(), content: content } })
}

function clearUserMemory() {
  return del('/api/memory/clear', { user_id: storage.getOrCreateUserId() })
}

// 景点图片代理地址
function poiImageUrl(name) {
  return storage.getRuntimeApiBaseUrl() + '/api/poi/image?name=' + encodeURIComponent(name)
}

module.exports = {
  request,
  get,
  post,
  put,
  del,
  healthCheck,
  submitTripPlan,
  pollTaskStatus,
  getTripHistory,
  getBackendRuntimeSettings,
  updateBackendRuntimeSettings,
  askTripChat,
  listUserMemory,
  addExplicitMemory,
  clearUserMemory,
  poiImageUrl
}
