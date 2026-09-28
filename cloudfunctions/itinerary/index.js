// 云函数：itinerary - 生成老年专属行程（规则引擎→知识库→大模型→风险评估→出行贴士）
// event: { profile: 老年出行表单, crowdPref: 是否避开人流 }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { generatePlan } = require('./generator');

exports.main = async (event) => {
  try {
    const profile = event && event.profile;
    if (!profile || !profile.city) {
      return { ok: false, error: '缺少出行信息（城市必填）' };
    }
    const result = await generatePlan(profile, { crowdPref: !!event.crowdPref });
    return Object.assign({ ok: true }, result);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
