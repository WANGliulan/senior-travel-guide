// 云函数：dialogue - 智能体多轮对话（约束持续生效，支持自然语言修改行程）
// event: { messages: [{role,content}], plan: 当前行程 }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { dialogueReply, adjustPlan } = require('./generator');

exports.main = async (event) => {
  try {
    const messages = (event && event.messages) || [];
    const plan = (event && event.plan) || null;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { ok: false, error: '消息不能为空' };
    }
    const result = await dialogueReply(messages, plan);
    let updatedPlan = null;
    if (result.action && plan) {
      updatedPlan = adjustPlan(plan, result.action);
    }
    return { ok: true, reply: result.reply, action: result.action, plan: updatedPlan };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
