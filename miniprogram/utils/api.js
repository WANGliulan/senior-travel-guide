// api.js - 云函数调用统一封装（云环境可用时走云函数；失败/未配置时降级到本地模拟）
const config = require('../config');
const mock = require('./mockData');

function call(name, data) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    const cloudReady = app && app.globalData.cloudReady && config.CLOUD_ENV;
    if (cloudReady) {
      wx.cloud.callFunction({ name, data })
        .then((res) => {
          const r = res && res.result;
          if (r && r.ok !== false) {
            resolve(r);
          } else {
            const err = (r && r.error) || '云函数返回异常';
            if (config.USE_MOCK_FALLBACK && mockRouter[name]) {
              resolve(mockRouter[name](data));
            } else {
              reject(new Error(err));
            }
          }
        })
        .catch((err) => {
          if (config.USE_MOCK_FALLBACK && mockRouter[name]) {
            resolve(mockRouter[name](data));
          } else {
            reject(err);
          }
        });
    } else if (mockRouter[name]) {
      // 未配置云环境：直接使用本地模拟
      setTimeout(() => resolve(mockRouter[name](data)), 500);
    } else {
      reject(new Error('云环境未配置，且无本地模拟：' + name));
    }
  });
}

// 本地模拟路由（字段结构与云函数一致）
const mockRouter = {
  cities() {
    return { ok: true, regions: mock.CITIES };
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
    const last = (event.messages || []).length ? event.messages[event.messages.length - 1].content : '';
    let action = null;
    let text = '您好，我是您的老年出行助手。您可以说"增加休息""减少步行""换室内景点""避开人流"，我会帮您调整行程。';
    if (last.includes('休息') || last.includes('太累') || last.includes('慢')) { action = 'increase_rest'; text = '好的，已为您增加休息节点：每天在景点间插入茶歇，单日景点精简。'; }
    else if (last.includes('步行') || last.includes('走路') || last.includes('少走')) { action = 'reduce_walk'; text = '好的，已减少步行量：优先保留低体力、步行少的景点。'; }
    else if (last.includes('室内') || last.includes('下雨') || last.includes('天热')) { action = 'change_indoor'; text = '好的，已将户外强度大的景点更换为室内场馆。'; }
    else if (last.includes('人') || last.includes('拥挤')) { action = 'avoid_crowd'; text = '好的，已避开人流密集的景点。'; }
    let plan = null;
    if (action && event.plan) plan = applyMockAdjust(event.plan, action);
    return { ok: true, reply: text, action, plan };
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

module.exports = { call };
