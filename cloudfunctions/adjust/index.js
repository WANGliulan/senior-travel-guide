// 云函数：adjust - 行程快捷调整按钮（纯规则引擎，无需大模型，确定性修改）
// event: { action: increase_rest|reduce_walk|change_indoor|avoid_crowd, plan: 当前行程 }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { adjustPlan, ADJUST_ACTIONS } = require('./generator');

exports.main = async (event) => {
  try {
    const action = event && event.action;
    const plan = event && event.plan;
    if (!ADJUST_ACTIONS.includes(action)) {
      return { ok: false, error: '不支持的调整动作' };
    }
    if (!plan) {
      return { ok: false, error: '缺少当前行程' };
    }
    return { ok: true, action, plan: adjustPlan(plan, action) };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
