// 云函数：plan - 方案服务（保存/列表/详情/删除，对应原行程 CRUD）
// event: { action: 'save'|'list'|'get'|'delete', plan?, id? }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = (event && event.action) || 'list';
  try {
    const plans = db.collection('plans');
    if (action === 'save') {
      const plan = event.plan;
      if (!plan || !plan.city) return { ok: false, error: '行程数据不完整' };
      const data = {
        city: plan.city,
        days: plan.days,
        title: plan.title,
        profile: plan.profile,
        schedule: plan.schedule,
        risk: plan.risk,
        tips: plan.tips,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      if (event.id) {
        await plans.doc(event.id).update({ data: { updatedAt: db.serverDate(), schedule: plan.schedule, risk: plan.risk, tips: plan.tips } });
        return { ok: true, id: event.id };
      }
      const res = await plans.add({ data });
      return { ok: true, id: res._id };
    }
    if (action === 'list') {
      const res = await plans.where({ _openid: OPENID }).orderBy('createdAt', 'desc').limit(50).get();
      return { ok: true, list: res.data };
    }
    if (action === 'get') {
      const res = await plans.doc(event.id).get();
      return { ok: true, plan: res.data };
    }
    if (action === 'delete') {
      await plans.doc(event.id).remove();
      return { ok: true };
    }
    return { ok: false, error: '未知操作' };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
