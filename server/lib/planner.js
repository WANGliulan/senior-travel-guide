/**
 * planner.js - 行程编排（混合智能体架构总调度）
 *
 * 规划流程：
 *   年龄段选择 ─┬─ 6-17 / 18-40 ─→ 通用规划流程（general）
 *               └─ 41-60 / 61+  ─→ 适老化专项业务流程（senior）
 *                                    │
 *                                    ├─ 1. 规则引擎前置过滤（剔除高体力、多台阶、无无障碍配套景点）
 *                                    ├─ 2. 知识库检索（候选景点 + 老年出行科普知识）
 *                                    ├─ 3. 大模型生成轻量化行程（未配 Key 时模板兜底）
 *                                    ├─ 4. 输出校验（防幻觉：只认候选集内景点，安全字段规则重算）
 *                                    └─ 5. 同步输出独立的行程风险评估报告 + 中老年出行专属贴士
 */
const agePolicy = require('./agePolicy');
const knowledge = require('./knowledge');
const rules = require('./rulesEngine');
const gen = require('./generator');
const ai = require('./aiProvider');

/** 表单归一化：年龄段默认值兜底 + 字段清洗 */
function normalizeProfile(input) {
  const p = Object.assign({}, input || {});
  const group = agePolicy.resolveAgeGroup(p.ageGroup);
  const dft = agePolicy.defaultsOf(group.id);
  p.ageGroup = group.id;
  p.mode = group.mode;
  p.city = String(p.city || '').trim();
  p.days = gen.clampDays(p.days);
  p.budget = p.budget || '舒适型';
  p.interests = Array.isArray(p.interests) ? p.interests : [];
  p.chronic = Array.isArray(p.chronic) ? p.chronic.filter((c) => c && c !== '无') : [];
  if (group.mode === 'senior') {
    p.mobility = p.mobility || dft.mobility;
    p.walkLimit = p.walkLimit || dft.walkLimit;
    p.joints = p.joints || '正常';
    p.accessible = p.accessible === undefined ? dft.accessible : !!p.accessible;
  } else {
    p.mobility = p.mobility || '完全自理';
    p.walkLimit = p.walkLimit || dft.walkLimit;
    p.joints = p.joints || '正常';
    p.accessible = !!p.accessible;
  }
  p.fillBy = p.fillBy || '老人本人';
  return p;
}

// ---------- 通用规划流程（6-17 / 18-40） ----------
async function generalPlan(profile, opts) {
  const o = opts || {};
  const candidates = knowledge.byCity(profile.city).map((s) => knowledge.enrich(s));
  if (candidates.length === 0) {
    return { plan: gen.buildEmptyPlan(profile, '知识库未收录该城市', { senior: false }), candidates: [], removed: [], aiUsed: false };
  }
  const ranked = rules.rankCandidates(candidates, profile).slice(0, 12);

  const r = await ai.withFallback(
    () => buildMessages(profile, ranked, false),
    () => null,
    // json:true → 强制模型输出 JSON（responses 协议走 text.format，chat 协议走 response_format）
    { temperature: 0.7, timeout: 120000, json: true }
  );
  const parsed = r.viaAI ? ai.parseJson(r.data) : null;
  const filteredInfo = { removed: [], removedCount: 0 };
  if (parsed && Array.isArray(parsed.schedule)) {
    return {
      plan: gen.normalizePlan(parsed, profile, ranked, filteredInfo, { senior: false }),
      candidates: ranked,
      removed: [],
      aiUsed: true,
      aiReason: ''
    };
  }
  return {
    plan: gen.buildPlanFrom(profile, ranked, filteredInfo, { senior: false }),
    candidates: ranked,
    removed: [],
    aiUsed: false,
    aiReason: r.reason || 'LLM_OUTPUT_INVALID'
  };
}

// ---------- 提示词构造（大模型只在安全候选集内做编排） ----------
function buildMessages(profile, candidates, senior) {
  const spotsText = candidates.map((s) =>
    s.name + '|' + s.type + '|体力:' + s.level + '|台阶:' + (s.stairs || '无') +
    '|步行约' + s.walk + '米|无障碍:' + (s.accessible ? '有' : '无') +
    '|人流:' + s.crowd + '|休息点:' + (s.restPoint || '无') +
    '|附近医疗:' + s.nearbyHospital + '|简介:' + s.desc
  ).join('\n');

  const userText = [
    '出行城市：' + profile.city,
    '出行天数：' + profile.days + ' 天',
    '预算档位：' + profile.budget,
    '兴趣偏好：' + (profile.interests.length ? profile.interests.join('、') : '无特殊偏好'),
    senior ? '年龄段：' + profile.ageGroup + '（适老化专项流程）' : '年龄段：' + profile.ageGroup + '（通用流程）',
    senior ? '行动能力：' + profile.mobility : '',
    senior ? '基础疾病：' + (profile.chronic.length ? profile.chronic.join('、') : '无') : '',
    senior ? '关节状况：' + profile.joints : '',
    senior ? '无障碍需求：' + (profile.accessible ? '需要无障碍通道/电梯' : '无特殊要求') : '',
    senior ? '每日可承受步行上限：' + profile.walkLimit : ''
  ].filter(Boolean).join('\n');

  const sys = senior
    ? '你是"智游康行·岁旅相伴"的老年旅游规划师，服务对象为 41 岁以上中老年及高龄长辈。' +
      '请严格在「候选景点」范围内编排行程，绝对不要虚构景点或编造不存在的设施。要求：\n' +
      '1) 每天安排 2 个景点为宜（行动能力为"需搀扶或轮椅"时可只安排 1 个），严禁超过 3 个，宁少勿赶；\n' +
      '2) 每天必须在第一个景点之后安排午餐休息节点（meal:true），并在游览途中插入茶歇休息节点（rest:true）；\n' +
      '3) 优先选择低体力、有休息点、无台阶、符合兴趣偏好的景点；\n' +
      '4) 为行程主题起一个温和易懂的中文名字（theme）；\n' +
      '5) 输出必须是严格 JSON，不要 Markdown 代码块、不要多余解释。\n' +
      '输出格式：{"title":"...","days":' + profile.days + ',"schedule":[{"day":1,"theme":"第1天 · 历史人文","spots":[{"name":"景点名（必须与候选一致）","duration":"2小时","tips":"给长辈的一句提醒"},{"name":"午餐休息·就近餐厅","meal":true},{"name":"茶歇休息","rest":true}]}]}'
    : '你是"智游康行·岁旅相伴"的旅游规划师，服务对象为 6-40 岁普通游客。' +
      '请严格在「候选景点」范围内编排行程，不要虚构景点。要求：\n' +
      '1) 每天可安排 3-5 个景点，节奏紧凑但不赶；\n' +
      '2) 每天安排午餐节点（meal:true）；\n' +
      '3) 结合兴趣偏好与预算档位（经济型/舒适型/品质型）给出合理搭配；\n' +
      '4) 为每天取一个主题名（theme）；\n' +
      '5) 输出必须是严格 JSON，不要 Markdown 代码块、不要多余解释。\n' +
      '输出格式：{"title":"...","days":' + profile.days + ',"schedule":[{"day":1,"theme":"第1天 · 历史人文","spots":[{"name":"景点名（必须与候选一致）","duration":"2小时","tips":"一句实用提醒"},{"name":"午餐休息·就近餐厅","meal":true}]}]}';

  return [
    { role: 'system', content: sys },
    { role: 'user', content: userText + '\n\n候选景点（只能从中挑选）：\n' + spotsText }
  ];
}

// ---------- 适老化专项业务流程（41-60 / 61+） ----------
async function seniorPlan(profile, opts) {
  const o = opts || {};
  // ① 规则引擎前置过滤
  const filtered = rules.filterAttractions(profile, { crowdPref: !!o.crowdPref });
  const filteredInfo = { removed: filtered.removed, removedCount: filtered.removed.length };

  if (filtered.kept.length === 0) {
    return {
      plan: gen.buildEmptyPlan(profile, '符合您身体条件的候选景点为 0', { senior: true }),
      candidates: [],
      removed: filtered.removed,
      aiUsed: false,
      aiReason: 'NO_CANDIDATE'
    };
  }

  // ② 知识库检索 + 排序（取前 12 个作为大模型可选范围）
  const perDayCap = rules.maxSpotsPerDay(profile, profile.ageGroup);
  const ranked = rules.rankCandidates(filtered.kept, profile).slice(0, Math.max(perDayCap * profile.days + 4, 8));

  // ③ 大模型生成（未配置 Key / 调用失败 → 模板兜底）
  //    两个关键点（实测）：
  //    a) json:true 必须开 —— 强制 JSON 输出模式，否则推理模型会长时间"思考"甚至超时；
  //    b) 不写死 maxTokens —— 交给 config.AI.maxTokens 控制，推理模型的思维链会占用输出额度，
  //       额度不足会导致只返回思维链而没有正文。
  const r = await ai.withFallback(
    () => buildMessages(profile, ranked, true),
    () => null,
    { temperature: 0.5, timeout: 120000, json: true }
  );
  const parsed = r.viaAI ? ai.parseJson(r.data) : null;

  // ④ 输出校验 + ⑤ 风险评估报告与专属贴士（由规则引擎重算，不采信模型输出）
  if (parsed && Array.isArray(parsed.schedule)) {
    const plan = gen.normalizePlan(parsed, profile, ranked, filteredInfo, { senior: true });
    return { plan: plan, candidates: ranked, removed: filtered.removed, aiUsed: true, aiReason: '' };
  }
  return {
    plan: gen.buildPlanFrom(profile, ranked, filteredInfo, { senior: true }),
    candidates: ranked,
    removed: filtered.removed,
    aiUsed: false,
    aiReason: r.reason || 'LLM_OUTPUT_INVALID'
  };
}

/**
 * 统一入口：按年龄段自动分流
 * @param {{ageGroup?:string, profile?:object, crowdPref?:boolean}} input
 */
async function planTrip(input) {
  const raw = (input && input.profile) || input || {};
  const profile = normalizeProfile(Object.assign({}, raw, { ageGroup: (input && input.ageGroup) || raw.ageGroup }));
  if (!profile.city) {
    return { ok: false, error: '缺少出行信息（城市必填）' };
  }
  const group = agePolicy.resolveAgeGroup(profile.ageGroup);
  const senior = group.mode === 'senior';
  const result = senior
    ? await seniorPlan(profile, { crowdPref: input && input.crowdPref })
    : await generalPlan(profile, { crowdPref: input && input.crowdPref });

  return {
    ok: true,
    mode: group.mode,
    seniorFlow: senior,
    ageGroup: group.id,
    ageLabel: group.label,
    plan: result.plan,
    llmUsed: !!result.aiUsed,
    aiReason: result.aiReason || '',
    aiConfigured: ai.isConfigured(),
    filtered: {
      removedCount: result.removed.length,
      removed: result.removed.slice(0, 20).map((r) => ({ name: r.spot.name, reason: r.reason, rule: r.rule })),
      candidateCount: result.candidates.length
    }
  };
}

module.exports = {
  normalizeProfile,
  planTrip,
  generalPlan,
  seniorPlan,
  buildMessages
};
