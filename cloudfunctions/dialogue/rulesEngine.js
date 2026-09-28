/**
 * rulesEngine.js - 智游康行·岁旅相伴 适老规则引擎
 * 职责：把老人身体参数转化为硬性过滤/评分规则，对景点知识库做前置过滤，
 *       降低大模型幻觉与"行程强度过高"的风险。规则引擎先兜底、大模型再生成。
 */
const { ATTRACTIONS, ELDERLY_TIPS } = require('./data');

// 步行上限换算（米）
function walkLimitMeters(profile) {
  const map = { '1km以内': 1000, '1-3km': 3000, '3-5km': 5000, '5km以上': 8000 };
  return map[profile.walkLimit] || 3000;
}

// 最大单日承载景点数（适老：宁可少、不要赶，符合实际体力）
function maxSpotsPerDay(profile) {
  if (profile.mobility === '需搀扶/轮椅') return 2;
  if (profile.mobility === '需慢行') return 2;
  return 3;
}

// 过滤候选景点：输出 { kept, removed: [{spot, reason}] }
function filterAttractions(profile, opts) {
  const limit = walkLimitMeters(profile);
  const crowdPref = opts && opts.crowdPref === true; // 避开人流
  const kept = [];
  const removed = [];
  ATTRACTIONS.forEach((spot) => {
    if (spot.city !== profile.city) return;
    const reasons = [];
    if (spot.level === '高' && profile.mobility !== '完全自理') {
      reasons.push('高体力消耗');
    }
    if (spot.walk > limit) {
      reasons.push('步行量超过每日上限');
    }
    if (profile.accessible === true && !spot.accessible) {
      reasons.push('无无障碍配套');
    }
    if (crowdPref && spot.crowd === '高') {
      reasons.push('人流量过大');
    }
    if (reasons.length > 0) {
      removed.push({ spot, reason: reasons.join('、') });
    } else {
      kept.push(spot);
    }
  });
  return { kept, removed };
}

// 候选景点打分排序（结合兴趣偏好）
function scoreSpot(spot, profile) {
  let score = 0;
  if (profile.interests && profile.interests.includes(spot.type)) score += 3;
  if (spot.level === '低') score += 2;
  if (spot.level === '中') score += 1;
  if (spot.accessible) score += 1;
  if (spot.crowd === '低') score += 1;
  if (spot.crowd === '中') score += 0.5;
  return score;
}

// 排序候选
function rankCandidates(kept, profile) {
  return kept
    .map((s) => ({ spot: s, score: scoreSpot(s, profile) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.spot);
}

module.exports = { walkLimitMeters, maxSpotsPerDay, filterAttractions, rankCandidates, ELDERLY_TIPS };
