// api.js - 统一数据层：公网 HTTP 后端 → 微信云函数 → 本地模拟（逐级降级）
// 三级数据源的返回结构完全一致（{ok:true,...}），任一环节不可用都不会中断演示。
const config = require('../config');
const mock = require('./mockData');

// 【一级】公网 HTTP 后端路由（与 server/routes.js 一一对应）
const HTTP_ROUTES = {
  health: { method: 'GET', path: '/api/health' },
  aiStatus: { method: 'GET', path: '/api/ai/status' },
  cities: { method: 'GET', path: '/api/cities' },
  ageGroups: { method: 'GET', path: '/api/age-groups' },
  ageResolve: { method: 'POST', path: '/api/age/resolve' },
  attractions: { method: 'POST', path: '/api/attractions' },
  itinerary: { method: 'POST', path: '/api/itinerary' },
  dialogue: { method: 'POST', path: '/api/dialogue' },
  adjust: { method: 'POST', path: '/api/adjust' },
  plan: { method: 'POST', path: '/api/plans' }
};

// 【二级】微信云开发云函数（名称与 cloudfunctions 目录一致）
const CLOUD_FUNCS = {
  login: true,
  cities: true,
  attractions: true,
  itinerary: true,
  dialogue: true,
  adjust: true,
  plan: true
};

function httpRequest(route, data) {
  return new Promise((resolve, reject) => {
    const base = String(config.API_BASE_URL || '').replace(/\/+$/, '');
    if (!base) {
      reject(new Error('未配置 API_BASE_URL'));
      return;
    }
    const method = route.method;
    const doSend = (bodyData) => {
      wx.request({
        url: base + route.path,
        method: method,
        data: bodyData,
        timeout: config.API_TIMEOUT || 90000,
        header: { 'content-type': 'application/json' },
        success: (res) => {
          const r = res && res.data;
          if (res.statusCode >= 200 && res.statusCode < 300 && r && r.ok !== false) {
            resolve(r);
          } else {
            // 特殊处理：AI 未配置（两种后端均返回该状态，属正常降级而非故障）
            const err = new Error((r && (r.error || r.hint)) || ('HTTP ' + res.statusCode));
            err.code = (r && r.code) || 'HTTP_' + res.statusCode;
            err.response = r;
            reject(err);
          }
        },
        fail: (e) => reject(new Error((e && e.errMsg) || '网络请求失败'))
      });
    };
    // GET 使用 query 传参；POST 传 JSON body
    if (method === 'GET') {
      const qs = [];
      Object.keys(data || {}).forEach((k) => {
        const v = data[k];
        if (v !== undefined && v !== null) {
          qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v));
        }
      });
      wx.request({
        url: base + route.path + (qs.length ? ('?' + qs.join('&')) : ''),
        method: 'GET',
        timeout: config.API_TIMEOUT || 30000,
        success: (res) => {
          const r = res && res.data;
          if (res.statusCode >= 200 && res.statusCode < 300 && r && r.ok !== false) resolve(r);
          else {
            const err = new Error((r && (r.error || r.hint)) || ('HTTP ' + res.statusCode));
            err.code = (r && r.code) || 'HTTP_' + res.statusCode;
            err.response = r;
            reject(err);
          }
        },
        fail: (e) => reject(new Error((e && e.errMsg) || '网络请求失败'))
      });
    } else {
      doSend(data);
    }
  });
}

function cloudCall(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name: name, data: data || {} })
      .then((res) => {
        const r = res && res.result;
        if (r && r.ok !== false) resolve(r);
        else reject(new Error((r && r.error) || '云函数返回异常'));
      })
      .catch(reject);
  });
}

/**
 * 统一调用入口：按「公网后端 → 云函数 → 本地模拟」顺序逐个尝试
 * @param {string} name 接口名（itinerary/dialogue/adjust/plan/cities/...）
 * @param {object} data 请求参数
 */
function call(name, data) {
  const app = getApp();
  const payload = data || {};
  const cloudReady = !!(app && app.globalData && app.globalData.cloudReady && config.CLOUD_ENV);

  const attempts = [];
  if (config.API_BASE_URL && HTTP_ROUTES[name]) {
    attempts.push(function () {
      // plan 接口需要标识用户，便于服务端按用户隔离方案
      const body = Object.assign({}, payload);
      if (name === 'plan' && !body.openid) {
        body.openid = (app && app.globalData && app.globalData.openid) || 'anonymous';
      }
      return httpRequest(HTTP_ROUTES[name], body);
    });
  }
  if (cloudReady && CLOUD_FUNCS[name]) {
    attempts.push(function () { return cloudCall(name, payload); });
  }

  return new Promise((resolve, reject) => {
    let idx = 0;
    const lastErr = { value: null };

    const next = () => {
      if (idx >= attempts.length) {
        // 全部失败：降级到本地模拟（保证演示不中断）
        if (config.USE_MOCK_FALLBACK && mockRouter[name]) {
          setTimeout(() => resolve(mockRouter[name](payload)), 300);
        } else {
          reject(lastErr.value || new Error('云环境未配置，且无本地模拟：' + name));
        }
        return;
      }
      const attempt = attempts[idx];
      idx += 1;
      attempt()
        .then(resolve)
        .catch((err) => {
          lastErr.value = err;
          next();
        });
    };

    if (attempts.length === 0 && !(config.USE_MOCK_FALLBACK && mockRouter[name])) {
      reject(new Error('云环境未配置，且无本地模拟：' + name));
      return;
    }
    next();
  });
}

/** 当前使用的数据源（前端可展示，便于评审确认走的是公网后端还是本地模拟） */
function dataSource() {
  const app = getApp();
  if (config.API_BASE_URL) return 'http';
  if (app && app.globalData && app.globalData.cloudReady && config.CLOUD_ENV) return 'cloud';
  return 'mock';
}

// 本地模拟路由（字段结构与云函数/公网后端一致）
const mockRouter = {
  cities() {
    return { ok: true, regions: mock.CITIES };
  },
  ageGroups() {
    return { ok: true, groups: mock.AGE_GROUPS };
  },
  ageResolve(event) {
    return mock.resolveAgeFlow(event && (event.ageGroup || event.age));
  },
  attractions(event) {
    // 前端暂不直接使用该接口（过滤逻辑在 itinerary 云函数内部完成），保留以兼容云函数路由
    return { ok: true, candidates: [], removed: [], removedCount: 0 };
  },
  itinerary(event) {
    const profile = event.profile || {};
    if (!profile.city) return { ok: false, error: '缺少城市' };
    return { ok: true, plan: mock.buildPlan(profile), llmUsed: false };
  },
  dialogue(event) {
    // 离线兜底：意图识别 + 知识库推荐（比原来的裸关键词匹配准确得多）
    const msgs = (event && event.messages) || [];
    const last = msgs.length ? String(msgs[msgs.length - 1].content || '') : '';
    const out = mock.buildOfflineReply(last, (event && event.plan) || null);
    let plan = null;
    if (out.action && event && event.plan) plan = applyMockAdjust(event.plan, out.action);
    return { ok: true, reply: out.reply, action: out.action, plan: plan, llmUsed: false };
  },
  adjust(event) {
    if (!event.plan) return { ok: false, error: '缺少行程' };
    return { ok: true, action: event.action, plan: applyMockAdjust(event.plan, event.action) };
  },
  plan(event) {
    const store = require('./store');
    if (event.action === 'save') {
      const plans = store.get(store.KEY_PLANS, []);
      const body = event.plan;
      const id = event.id || 'plan_' + Date.now();
      plans.unshift({ id, title: body.title, city: body.city, days: body.days, risk: body.risk ? body.risk.level : '低', createdAt: body.generatedAt || new Date().toISOString() });
      store.set(store.KEY_PLANS, plans.slice(0, 50));
      store.set(store.KEY_PLAN_BODY + id, body);
      return { ok: true, id };
    }
    if (event.action === 'list') {
      return { ok: true, list: store.get(store.KEY_PLANS, []) };
    }
    if (event.action === 'get') {
      return { ok: true, plan: store.get(store.KEY_PLAN_BODY + event.id, null) };
    }
    if (event.action === 'delete') {
      const plans = store.get(store.KEY_PLANS, []).filter((p) => p.id !== event.id);
      store.set(store.KEY_PLANS, plans);
      store.remove(store.KEY_PLAN_BODY + event.id);
      return { ok: true };
    }
    return { ok: false, error: '未知操作' };
  },
  login() {
    return { ok: true, openid: 'mock_openid_demo' };
  }
};

// 本地模拟快捷调整（与云函数 adjustPlan 行为一致的精简版）
function applyMockAdjust(plan, action) {
  const schedule = JSON.parse(JSON.stringify(plan.schedule || []));
  schedule.forEach((day) => {
    const spots = day.spots.filter((s) => !s.rest && !s.meal);
    if (action === 'increase_rest') {
      const rebuilt = [];
      spots.forEach((s, i) => {
        rebuilt.push(s);
        if ((i + 1) % 2 === 0) rebuilt.push({ rest: true, name: '茶歇休息', duration: '30分钟', description: '坐下歇脚、补充水分', restPoint: '就近茶座/长椅', tips: '慢病患者按时服药' });
      });
      day.spots = (rebuilt.length ? rebuilt : spots).concat(day.spots.filter((s) => s.meal));
    } else if (action === 'reduce_walk') {
      day.spots = spots.slice(0, 2).map((s) => Object.assign({}, s, { walk: Math.min(s.walk || 1000, 1200) })).concat(day.spots.filter((s) => s.meal));
    } else if (action === 'change_indoor') {
      day.spots = spots.slice(0, 3).concat(day.spots.filter((s) => s.meal));
    } else if (action === 'avoid_crowd') {
      day.spots = spots.slice(0, 2).concat(day.spots.filter((s) => s.meal));
    }
  });
  return Object.assign({}, plan, { schedule, updatedAt: new Date().toISOString() });
}

module.exports = { call, dataSource, HTTP_ROUTES };
