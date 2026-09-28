// 云函数：attractions - 规则引擎前置过滤候选景点
// event: { profile: 老年出行表单, crowdPref: 是否避开人流 }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { filterAttractions, rankCandidates } = require('./rulesEngine');

exports.main = async (event) => {
  try {
    const profile = event && event.profile;
    if (!profile || !profile.city) {
      return { ok: false, error: '缺少出行信息（城市必填）' };
    }
    const { kept, removed } = filterAttractions(profile, { crowdPref: !!event.crowdPref });
    return {
      ok: true,
      candidates: rankCandidates(kept, profile),
      removed: removed.slice(0, 10),
      removedCount: removed.length
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
