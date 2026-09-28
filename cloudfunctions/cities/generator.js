/**
 * generator.js - 智游康行·岁旅相伴 行程生成与智能体核心
 * 混合智能体架构：
 *   1) 规则引擎前置过滤候选景点（rulesEngine）
 *   2) 知识库检索（本模块内基于标签/字段，可升级为向量检索）
 *   3) 大模型生成（配置 LLM_API_KEY 时启用，生成失败自动回退模板）
 *   4) 多轮迭代：对话(dialogue)与快捷调整(adjust)均在此实现
 */
const { ATTRACTIONS, ELDERLY_TIPS } = require('./data');
const { walkLimitMeters, maxSpotsPerDay, filterAttractions, rankCandidates } = require('./rulesEngine');
const llm = require('./llm');

const TYPE_THEME = {
  '历史古迹': '历史人文',
  '民俗文化': '民俗风情',
  '怀旧场景': '怀旧记忆',
  '自然风光': '自然风光',
  '室内场馆': '室内场馆',
  '美食体验': '美食体验'
};

function buildTitle(city, days) {
  return city + ' · 慢节奏适老' + days + '日游';
}

// ---------- 风险评估 ----------
function buildRisk(schedule, profile, filteredInfo) {
  const limit = walkLimitMeters(profile);
  let totalWalk = 0;
  let spotCount = 0;
  let highLevel = 0;
  schedule.forEach((day) => {
    day.spots.forEach((s) => {
      if (s.rest || s.meal || s.restDay) return;
      totalWalk += (s.walk || 0) + 400; // 单点步行 + 转场步行估算
      spotCount += 1;
      if (s.level === '高') highLevel += 1;
    });
  });
  const perDay = Math.round(totalWalk / Math.max(schedule.length, 1) / 500) * 500;
  const items = [];
  if (perDay > limit) {
    items.push('预估每日步行约 ' + perDay + ' 米，超过您设定的上限（' + profile.walkLimit + '），建议增加休息或减少步行量');
  } else {
    items.push('预估每日步行约 ' + perDay + ' 米，在您设定的上限（' + profile.walkLimit + '）以内，节奏较轻松');
  }
  if (profile.accessible === true) {
    if (filteredInfo && filteredInfo.removedCount > 0) {
      items.push('已自动过滤 ' + filteredInfo.removedCount + ' 个无无障碍配套的景点');
    } else {
      items.push('所选景点均具备无障碍配套');
    }
  }
  if (profile.chronic && profile.chronic.length > 0) {
    items.push('您标注了慢病（' + profile.chronic.join('、') + '），请随身携带药品并注意饮食忌口（见出行贴士）');
    if (profile.chronic.includes('心脏病') || profile.chronic.includes('高血压')) {
      items.push('心脑血管类慢病，行程节奏已放缓，请勿赶路、避免长时间暴晒');
    }
  }
  if (highLevel > 0) {
    items.push('有 ' + highLevel + ' 个中等体力景点，已安排在体力较好的时段并预留休息');
  }
  // 休息/休整覆盖检查
  let restDays = 0;
  schedule.forEach((day) => {
    if (day.spots.some((s) => s.rest || s.restDay)) restDays += 1;
  });
  if (restDays < schedule.length) {
    items.push('建议每天预留茶歇/午休时间，避免连续行走');
  }
  if (schedule.some((day) => day.spots.some((s) => s.meal))) {
    items.push('行程已安排午餐休息与茶歇节点，节奏从容、避免空腹赶路');
  }
  const level = perDay > limit || (profile.chronic && profile.chronic.length >= 2) ? '中' : '低';
  return {
    level,
    dailyWalk: '约' + perDay + '米/天',
    items
  };
}

// ---------- 出行贴士 ----------
function buildTips(profile, schedule) {
  const diet = [];
  diet.push(ELDERLY_TIPS.diet.common[0]);
  if (profile.chronic) {
    if (profile.chronic.includes('高血压')) diet.push(ELDERLY_TIPS.diet.hypertension[0]);
    if (profile.chronic.includes('糖尿病')) diet.push(ELDERLY_TIPS.diet.diabetes[0]);
    if (profile.chronic.includes('心脏病')) diet.push(ELDERLY_TIPS.diet.heart[0]);
  }
  const rest = ELDERLY_TIPS.rest.slice(0, 3);
  const medical = [];
  const hospitals = new Set();
  schedule.forEach((day) => day.spots.forEach((s) => {
    if (s.rest) return;
    if (s.nearbyHospital) hospitals.add(s.nearbyHospital);
  }));
  hospitals.forEach((h) => medical.push('行程沿途可关注：' + h));
  medical.push(ELDERLY_TIPS.medical[0]);
  medical.push(ELDERLY_TIPS.medical[2]);
  const weather = ELDERLY_TIPS.weather.slice(0, 4);
  const carry = ELDERLY_TIPS.carry.slice(0, 5);
  return {
    rest,
    medical,
    diet,
    weather,
    carry
  };
}

// ---------- 兜底模板：把候选景点排成分天行程（自动插入休息节点） ----------
function templateSchedule(profile, candidates) {
  const days = Math.min(Math.max(profile.days || 1, 1), 7);
  const limit = walkLimitMeters(profile);
  const perDayCap = maxSpotsPerDay(profile);
  const list = rankCandidates(candidates, profile);
  const schedule = [];
  for (let d = 1; d <= days; d++) {
    const spots = [];
    let dayWalk = 0;
    const pool = list.slice((d - 1) * perDayCap, d * perDayCap);
    if (pool.length === 0) {
      // 候选不足：该天改为休整日，不安排景点（符合实际的慢节奏）
      schedule.push({ day: d, theme: '第' + d + '天 · 休整日', spots: [makeRestDay()] });
      continue;
    }
    pool.forEach((spot) => {
      dayWalk += spot.walk + 400;
      spots.push({
        name: spot.name,
        type: spot.type,
        level: spot.level,
        accessible: spot.accessible,
        crowd: spot.crowd,
        walk: spot.walk,
        duration: spot.duration,
        restPoint: spot.restPoint,
        nearbyHospital: spot.nearbyHospital,
        description: spot.desc,
        tips: spot.tips,
        rest: false
      });
      // 步行预算触发休息节点
      if (dayWalk >= limit && spots[spots.length - 1] && !spots[spots.length - 1].rest) {
        spots.push({ rest: true, name: '茶歇休息', duration: '30分钟', description: '坐下歇脚、补充水分，缓解疲劳', restPoint: '就近茶座/长椅', tips: '慢病患者记得按时服药、少量多次喝水' });
        dayWalk = 0;
      }
    });
    if (!spots.some((s) => s.rest)) {
      const mid = Math.floor(spots.length / 2);
      spots.splice(mid, 0, { rest: true, name: '茶歇休息', duration: '30分钟', description: '坐下歇脚、补充水分，缓解疲劳', restPoint: '就近茶座/长椅', tips: '慢病患者记得按时服药、少量多次喝水' });
    }
    // 符合实际的适老节奏：第一个景点后插入午餐休息（就近餐厅，避免空腹赶路）
    const firstReal = spots.findIndex((s) => !s.rest && !s.meal);
    if (firstReal >= 0 && !spots.some((s) => s.meal)) {
      spots.splice(firstReal + 1, 0, makeMeal());
    }
    schedule.push({ day: d, theme: '第' + d + '天 · ' + (spots[0] ? (TYPE_THEME[spots[0].type] || '轻松慢游') : '轻松慢游'), spots });
  }
  return schedule;
}

function makeMeal() {
  return { meal: true, name: '午餐休息·就近餐厅', duration: '1小时', description: '就近选择卫生清淡的餐厅用餐，补充体力后再出发', restPoint: '餐厅可就坐休息', nearbyHospital: '', tips: '慢病忌口请参照出行贴士，少油少盐、七分饱' };
}

// 休整日节点：不安排景点，彻底放松（适老、符合实际）
function makeRestDay() {
  return { restDay: true, name: '休整日·自由安排', duration: '全天', description: '就近散步、逛早市或酒店休息，量力而行，不安排景点', tips: '充分休息恢复体力，为后续行程储备能量' };
}

// ---------- 大模型生成（带校验与回退） ----------
async function generateWithLLM(profile, candidates) {
  const spotsText = candidates.map((s) => {
    return s.name + '|' + s.type + '|体力:' + s.level + '|步行约' + s.walk + '米|无障碍:' + (s.accessible ? '有' : '无') + '|人流:' + s.crowd + '|休息点:' + s.restPoint + '|附近医疗:' + s.nearbyHospital + '|简介:' + s.desc;
  }).join('\n');
  const sys = '你是"智游康行·岁旅相伴"的老年旅游规划师。只允许从提供的候选景点中挑选，为老人规划慢节奏、低负荷的分天行程。要求：' +
    '1) 每天最多 3 个景点（行动不便/需慢行的老人不超过 2 个），宁少勿赶；' +
    '2) 每天在第一个景点后安排午餐休息节点（meal:true，就近餐厅），中途插入茶歇休息节点（rest:true）；' +
    '3) 优先低体力、有休息点、符合老人兴趣的景点；' +
    '4) 给出行程风险评估（level: 低/中/高，dailyWalk 文案，items 提示列表）与老年出行贴士（rest/medical/diet/weather/carry 四类提示列表）。' +
    '严格输出 JSON，不要 Markdown：{"title":"...","schedule":[{"day":1,"theme":"...","spots":[{"name":"...","type":"...","level":"低","walk":500,"duration":"1.5小时","description":"...","tips":"...","restPoint":"...","nearbyHospital":"...","rest":false,"meal":false},{"name":"午餐休息·就近餐厅","duration":"1小时","meal":true,"description":"...","tips":"..."}]}],"risk":{"level":"低","dailyWalk":"约2000米/天","items":["..."]},"tips":{"rest":["..."],"medical":["..."],"diet":["..."],"weather":["..."],"carry":["..."]}}';
  const user = '老人身体约束：行动能力=' + profile.mobility + '，慢性病=' + (profile.chronic && profile.chronic.length ? profile.chronic.join('、') : '无') +
    '，腿脚关节=' + profile.joints + '，需要无障碍设施=' + (profile.accessible ? '是' : '否') +
    '，单日可承受步行=' + profile.walkLimit + '，兴趣偏好=' + (profile.interests || []).join('、') + '，出行天数=' + profile.days + '天，目的地=' + profile.city + '。\n候选景点：\n' + spotsText;
  const content = await llm.chat([
    { role: 'system', content: sys },
    { role: 'user', content: user }
  ], { temperature: 0.5, maxTokens: 4096, timeout: 60000 });
  const parsed = llm.parseJson(content);
  if (!parsed || !Array.isArray(parsed.schedule)) return null;
  return parsed;
}

// 归一化大模型结果（字段兜底、天数截断、健康约束复核）
function normalizePlan(plan, profile, candidates, filteredInfo) {
  const days = Math.min(Math.max(profile.days || 1, 1), 7);
  const schedule = (plan.schedule || []).slice(0, days).map((day, i) => ({
    day: i + 1,
    theme: day.theme || '第' + (i + 1) + '天 · 轻松慢游',
    spots: (day.spots || []).map((s) => ({
      name: s.name,
      type: s.type || '自然风光',
      level: s.level || '低',
      accessible: s.accessible === true || s.accessible === '有',
      crowd: s.crowd || '中',
      walk: Number(s.walk) || 800,
      duration: s.duration || '1.5小时',
      restPoint: s.restPoint || '就近座椅',
      nearbyHospital: s.nearbyHospital || '行程沿途医院',
      description: s.description || '',
      tips: s.tips || '',
      rest: !!s.rest,
      meal: !!s.meal,
      restDay: !!s.restDay
    }))
  }));
  // 若大模型漏插休息/午餐节点，按规则补齐（适老：宁慢勿赶）
  schedule.forEach((day) => {
    if (!day.spots.some((s) => s.rest)) {
      const mid = Math.floor(day.spots.length / 2);
      day.spots.splice(mid, 0, { rest: true, name: '茶歇休息', duration: '30分钟', description: '坐下歇脚、补充水分，缓解疲劳', restPoint: '就近茶座/长椅', tips: '慢病患者记得按时服药、少量多次喝水' });
    }
    const firstReal = day.spots.findIndex((s) => !s.rest && !s.meal);
    if (firstReal >= 0 && !day.spots.some((s) => s.meal)) {
      day.spots.splice(firstReal + 1, 0, makeMeal());
    }
  });
  const risk = buildRisk(schedule, profile, filteredInfo);
  const tips = buildTips(profile, schedule);
  return {
    title: plan.title || buildTitle(profile.city, profile.days),
    city: profile.city,
    days,
    profile,
    schedule,
    risk,
    tips,
    generatedAt: new Date().toISOString()
  };
}

// 行程生成主入口：规则引擎 → 知识库 → 大模型(可回退模板)
async function generatePlan(profile, opts) {
  const filtered = filterAttractions(profile, opts);
  const candidates = rankCandidates(filtered.kept, profile);
  if (candidates.length === 0) {
    // 约束过严导致无候选：放宽到同城全部低/中体力景点
    const relaxed = ATTRACTIONS.filter((s) => s.city === profile.city && s.level !== '高');
    const fallback = relaxed.length ? relaxed : ATTRACTIONS.filter((s) => s.city === profile.city);
    return {
      ok: true,
      relaxed: true,
      plan: buildPlanFrom(profile, fallback, { removedCount: filtered.removed.length })
    };
  }
  const filteredInfo = { removedCount: filtered.removed.length };
  let plan = null;
  try {
    plan = await generateWithLLM(profile, candidates);
  } catch (e) {
    plan = null;
  }
  if (!plan) {
    return { ok: true, plan: buildPlanFrom(profile, candidates, filteredInfo), llmUsed: false };
  }
  const normalized = normalizePlan(plan, profile, candidates, filteredInfo);
  return { ok: true, plan: normalized, llmUsed: true };
}

function buildPlanFrom(profile, candidates, filteredInfo) {
  const schedule = templateSchedule(profile, candidates);
  const risk = buildRisk(schedule, profile, filteredInfo);
  const tips = buildTips(profile, schedule);
  return {
    title: buildTitle(profile.city, profile.days),
    city: profile.city,
    days: Math.min(Math.max(profile.days || 1, 1), 7),
    profile,
    schedule,
    risk,
    tips,
    generatedAt: new Date().toISOString()
  };
}

// ---------- 快捷调整（纯规则引擎，确定性修改，无需大模型） ----------
const ADJUST_ACTIONS = ['increase_rest', 'reduce_walk', 'change_indoor', 'avoid_crowd'];

function adjustPlan(plan, action) {
  if (!ADJUST_ACTIONS.includes(action)) return plan;
  const schedule = JSON.parse(JSON.stringify(plan.schedule));
  const citySpots = ATTRACTIONS.filter((s) => s.city === plan.city);
  const limit = walkLimitMeters(plan.profile);
  schedule.forEach((day) => {
    const spots = day.spots.filter((s) => !s.rest && !s.meal);
    if (action === 'increase_rest') {
      // 每 2 个景点后插入休息节点，且每天至少 1 个
      const rebuilt = [];
      spots.forEach((s, i) => {
        rebuilt.push(s);
        if ((i + 1) % 2 === 0) {
          rebuilt.push(makeRest());
        }
      });
      if (!rebuilt.some((s) => s.rest)) rebuilt.splice(1, 0, makeRest());
      if (rebuilt.length > 6) rebuilt.length = 6;
      day.spots = ensureMeal(rebuilt);
    } else if (action === 'reduce_walk') {
      // 用低步行候选替换步行量大的景点，并压缩单日景点数
      const kept = [];
      spots.forEach((s) => {
        if (s.walk <= Math.min(limit, 1500)) {
          kept.push(s);
        } else {
          const alt = citySpots.find((c) => c.walk <= 800 && c.level === '低' && !kept.some((k) => k.name === c.name) && c.name !== s.name);
          if (alt) {
            kept.push({ name: alt.name, type: alt.type, level: alt.level, accessible: alt.accessible, crowd: alt.crowd, walk: alt.walk, duration: alt.duration, restPoint: alt.restPoint, nearbyHospital: alt.nearbyHospital, description: alt.desc, tips: alt.tips, rest: false, meal: false });
          }
        }
      });
      day.spots = ensureMeal(interleaveRest(kept.slice(0, 3), 2));
    } else if (action === 'change_indoor') {
      const indoors = citySpots.filter((s) => s.type === '室内场馆' && s.level !== '高');
      const kept = spots.map((s) => {
        if (s.type !== '室内场馆' && s.level !== '低') {
          const alt = indoors.find((c) => !keptNames(kept).includes(c.name) && c.name !== s.name);
          if (alt) {
            return { name: alt.name, type: alt.type, level: alt.level, accessible: alt.accessible, crowd: alt.crowd, walk: alt.walk, duration: alt.duration, restPoint: alt.restPoint, nearbyHospital: alt.nearbyHospital, description: alt.desc, tips: alt.tips, rest: false, meal: false };
          }
        }
        return s;
      });
      day.spots = ensureMeal(interleaveRest(kept.slice(0, 3), 3));
    } else if (action === 'avoid_crowd') {
      const kept = spots.filter((s) => s.crowd !== '高');
      if (kept.length === 0) kept.push(spots[0]);
      day.spots = ensureMeal(interleaveRest(kept.slice(0, 3), 3));
    }
  });
  return Object.assign({}, plan, {
    schedule,
    risk: buildRisk(schedule, plan.profile, null),
    updatedAt: new Date().toISOString()
  });
}

function makeRest() {
  return { rest: true, name: '茶歇休息', duration: '30分钟', description: '坐下歇脚、补充水分，缓解疲劳', restPoint: '就近茶座/长椅', tips: '慢病患者记得按时服药、少量多次喝水' };
}

function interleaveRest(spots, every) {
  const rebuilt = [];
  spots.forEach((s, i) => {
    rebuilt.push(s);
    if ((i + 1) % every === 0 && i !== spots.length - 1) rebuilt.push(makeRest());
  });
  return rebuilt;
}

// 确保每天有午餐休息节点（符合实际）
function ensureMeal(spots) {
  const list = spots.slice();
  if (list.some((s) => s.meal)) return list;
  const firstReal = list.findIndex((s) => !s.rest && !s.meal);
  if (firstReal < 0) return list;
  list.splice(firstReal + 1, 0, makeMeal());
  return list;
}

function keptNames(spots) {
  return spots.map((s) => s.name);
}

// ---------- 多轮对话（大模型优先，失败走关键词规则兜底） ----------
async function dialogueReply(messages, plan) {
  try {
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const sys = '你是"智游康行·岁旅相伴"的老年旅游规划助手。用户是一起出行的老人或子女。回答要求：' +
      '1) 简洁、耐心、多用短句，可给出具体建议；' +
      '2) 如用户要求修改行程（如增加休息、减少步行、换室内景点、避开人流），请在回复末尾输出一行 JSON：{"action":"increase_rest|reduce_walk|change_indoor|avoid_crowd"}；' +
      '3) 始终以老人身体约束（行动能力、慢病、无障碍、步行上限）为前提给出建议，绝不建议高强度行程。';
    const content = await llm.chat([{ role: 'system', content: sys }].concat(history), { temperature: 0.6, maxTokens: 2048, timeout: 45000 });
    return { reply: content, action: extractAction(content) };
  } catch (e) {
    return keywordReply(messages, plan);
  }
}

function extractAction(content) {
  const m = String(content).match(/\{"action"\s*:\s*"([^"]+)"\}/);
  if (m && ADJUST_ACTIONS.includes(m[1])) return m[1];
  return null;
}

const KEYWORD_ACTIONS = [
  { keys: ['休息', '太累', '慢一点', '节奏'], action: 'increase_rest', text: '好的，我已经为您增加了休息节点：每天在景点之间插入茶歇，单日景点适当精简。' },
  { keys: ['步行', '走路', '少走'], action: 'reduce_walk', text: '好的，我已经减少了步行量：优先保留低体力、步行少的景点，每天最多安排 3 个点。' },
  { keys: ['室内', '下雨', '天热', '怕晒'], action: 'change_indoor', text: '好的，我已把户外强度较大的景点更换为室内场馆，参观更舒适。' },
  { keys: ['人', '拥挤', '吵'], action: 'avoid_crowd', text: '好的，我已避开人流密集的景点，改选人少清净的地方。' }
];

function keywordReply(messages, plan) {
  const last = messages[messages.length - 1] && messages[messages.length - 1].content;
  if (!last) return { reply: '您好，我是您的老年出行助手，有什么可以帮您调整行程的吗？', action: null };
  for (const item of KEYWORD_ACTIONS) {
    if (item.keys.some((k) => last.includes(k))) {
      return { reply: item.text, action: item.action };
    }
  }
  if (last.includes('你好') || last.includes('您好') || last.includes('在吗')) {
    return { reply: '您好！我是您的老年出行助手。您可以说"增加休息""减少步行""换室内景点""避开人流"，我会帮您调整行程。', action: null };
  }
  if (last.includes('行程') || last.includes('安排')) {
    return { reply: '您当前的行程共 ' + (plan ? plan.days : '') + ' 天，已按慢节奏低负荷设计，每日穿插茶歇休息。如需调整，随时告诉我。', action: null };
  }
  return {
    reply: '我已收到您的想法。建议：每天上午安排主要游览、午后安排休息，景点之间预留充足转场时间。如需具体调整行程，请告诉我"增加休息/减少步行/换室内景点/避开人流"。',
    action: null
  };
}

module.exports = { generatePlan, adjustPlan, dialogueReply, ADJUST_ACTIONS, buildRisk, buildTips };
