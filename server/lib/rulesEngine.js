/**
 * rulesEngine.js - 适老规则引擎（后端自研，前置过滤，降低大模型幻觉与行程强度风险）
 *
 * 职责：把「年龄段 + 身体参数」翻译成硬性过滤规则，在大模型生成之前先剔除不符合条件的景点，
 *       再由大模型在安全候选集内生成轻量化行程。规则先行、模型后生成 —— 混合智能体架构的第一道闸。
 *
 * 过滤维度：
 *   体力消耗等级 level / 台阶 stairs / 单点步行量 walk / 无障碍 accessible / 人流量 crowd / 休息点 restPoint
 */
const knowledge = require('./knowledge');
const agePolicy = require('./agePolicy');

const WALK_LIMIT_MAP = { '1km以内': 1000, '1-3km': 3000, '3-5km': 5000, '5km以上': 8000 };

/** 每日可承受步行上限（米） */
function walkLimitMeters(profile) {
  const p = profile || {};
  return WALK_LIMIT_MAP[p.walkLimit] || 3000;
}

/** 单日景点承载上限：适老"宁可少、不要赶" */
function maxSpotsPerDay(profile, ageGroup) {
  const p = profile || {};
  const group = ageGroup || p.ageGroup;
  if (group === '61+' || p.mobility === '需搀扶或轮椅') return 2;
  if (group === '41-60' || p.mobility === '需慢行') return 3;
  return 5;
}

/** 是否处于适老化专项流程 */
function isSenior(profile, ageGroup) {
  const group = ageGroup || (profile && profile.ageGroup);
  return agePolicy.resolveAgeGroup(group).mode === 'senior';
}

/**
 * 前置过滤候选景点（核心）
 * @param {object} profile 出行信息（含 ageGroup / mobility / chronic / joints / accessible / walkLimit / interests / city）
 * @param {{crowdPref?:boolean, ageGroup?:string}} [opts]
 * @returns {{kept:Array, removed:Array<{spot:object,reason:string,rule:string}>}}
 */
function filterAttractions(profile, opts) {
  const p = profile || {};
  const o = opts || {};
  const group = agePolicy.resolveAgeGroup(o.ageGroup || p.ageGroup);
  const senior = group.mode === 'senior';
  const limit = walkLimitMeters(p);
  const crowdPref = o.crowdPref === true;
  const chronic = p.chronic || [];
  const heartRisk = chronic.indexOf('心脏病') >= 0 || chronic.indexOf('高血压') >= 0;
  const jointRisk = p.joints === '轻微不便' || p.joints === '明显不便';
  const walkAid = p.mobility === '需慢行' || p.mobility === '需搀扶或轮椅';

  const kept = [];
  const removed = [];

  knowledge.byCity(p.city).forEach((raw) => {
    const spot = knowledge.enrich(raw);
    if (!senior) {
      // 通用流程（6-17 / 18-40）：不做身体条件硬过滤，仅保留可达性提示
      kept.push(spot);
      return;
    }
    const reasons = [];
    let rule = '';

    // 规则 1：高体力消耗景点（登山、长距离、登塔）在适老流程中剔除
    if (spot.level === '高') {
      reasons.push('高体力消耗');
      rule = rule || 'RULE_HIGH_LEVEL';
    }
    // 规则 2：台阶过多（膝/腿不便、需搀扶、高龄长辈）
    if (spot.stairs === '多' && (walkAid || jointRisk || group.id === '61+' || group.id === '41-60')) {
      reasons.push('台阶较多，不便行走');
      rule = rule || 'RULE_STAIRS';
    }
    // 规则 3：单点步行量超过用户可承受上限
    if (spot.walk > limit) {
      reasons.push('步行量超过每日可承受上限');
      rule = rule || 'RULE_WALK_LIMIT';
    }
    // 规则 4：需要无障碍配套但景点无无障碍通道/电梯
    if (p.accessible === true && !spot.accessible) {
      reasons.push('无无障碍通道/电梯配套');
      rule = rule || 'RULE_ACCESSIBILITY';
    }
    // 规则 5：高峰人流（用户明确表示避开人流，或高龄 + 心脑血管慢病）
    if (crowdPref && spot.crowd === '高') {
      reasons.push('人流量过大');
      rule = rule || 'RULE_CROWD';
    }
    if (heartRisk && spot.crowd === '高' && group.id === '61+') {
      reasons.push('人流密集，心脑血管风险');
      rule = rule || 'RULE_CROWD_HEART';
    }
    // 规则 6：无休息点，无法满足适老"随时歇脚"需求
    if (!spot.restPoint && (group.id === '61+' || walkAid)) {
      reasons.push('沿途缺少休息点位');
      rule = rule || 'RULE_NO_REST';
    }

    if (reasons.length > 0) {
      removed.push({ spot: spot, reason: reasons.join('、'), rule: rule });
    } else {
      kept.push(spot);
    }
  });

  return { kept, removed };
}

/** 候选景点打分（结合兴趣偏好与适老友好度） */
function scoreSpot(spot, profile) {
  const p = profile || {};
  let score = 0;
  if (p.interests && p.interests.indexOf(spot.type) >= 0) score += 3;
  if (spot.level === '低') score += 2;
  else if (spot.level === '中') score += 1;
  if (spot.accessible) score += 1;
  if (spot.crowd === '低') score += 1;
  else if (spot.crowd === '中') score += 0.5;
  if (spot.restPoint) score += 0.5;      // 有休息点加分
  if (spot.stairs === '无') score += 0.5; // 无台阶加分
  return score;
}

/** 候选排序 */
function rankCandidates(kept, profile) {
  return kept
    .map((s) => ({ spot: s, score: scoreSpot(s, profile) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.spot);
}

/** 被剔除原因汇总（写入行程风险评估报告，向用户透明展示"为什么删掉了这些点"） */
function summarizeRemoved(removed) {
  const map = {};
  (removed || []).forEach((r) => {
    const key = r.rule || 'RULE_OTHER';
    if (!map[key]) map[key] = { rule: key, reason: r.reason, count: 0, spots: [] };
    map[key].count += 1;
    if (map[key].spots.length < 6) map[key].spots.push(r.spot.name);
  });
  return Object.keys(map).map((k) => map[k]).sort((a, b) => b.count - a.count);
}

module.exports = {
  WALK_LIMIT_MAP,
  walkLimitMeters,
  maxSpotsPerDay,
  isSenior,
  filterAttractions,
  scoreSpot,
  rankCandidates,
  summarizeRemoved
};
