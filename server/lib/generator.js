/**
 * generator.js - 行程生成 / 风险评估 / 出行贴士 / 快捷调整（适老专项 + 通用）
 *
 * 适老化专项业务流程（41-60 / 61+）：
 *   规则引擎前置过滤 → 知识库检索 → 大模型生成（未配 Key 时模板兜底）→ 输出校验 → 风险评估报告 + 专属贴士
 * 通用规划流程（6-17 / 18-40）：
 *   按天数/预算/兴趣编排常规行程，节奏与强度不做适老约束。
 */
const knowledge = require('./knowledge');
const rules = require('./rulesEngine');
const agePolicy = require('./agePolicy');

const TIPS = knowledge.ELDERLY_TIPS || {};

const TYPE_THEME = {
  '历史古迹': '历史人文',
  '民俗文化': '民俗风情',
  '怀旧场景': '怀旧记忆',
  '自然风光': '自然风光',
  '室内场馆': '室内场馆',
  '美食体验': '美食体验'
};

function iso() {
  return new Date().toISOString();
}

function clampDays(days) {
  return Math.min(Math.max(Number(days) || 1, 1), 7);
}

// ---------- 节点工厂 ----------
function makeRest() {
  return {
    rest: true,
    name: '茶歇休息',
    duration: '30分钟',
    description: '坐下歇脚、补充水分，缓解疲劳',
    restPoint: '就近茶座/长椅',
    tips: '慢病患者记得按时服药、少量多次喝水'
  };
}
function makeMeal() {
  return {
    meal: true,
    name: '午餐休息·就近餐厅',
    duration: '1小时',
    description: '就近选择卫生清淡的餐厅用餐，补充体力后再出发',
    restPoint: '餐厅可就坐休息',
    nearbyHospital: '',
    tips: '慢病忌口请参照出行贴士，少油少盐、七分饱'
  };
}
function makeRestDay(day) {
  return {
    restDay: true,
    name: '休整日·自由安排',
    duration: '全天',
    description: '就近散步、逛早市或酒店休息，量力而行，不安排景点',
    tips: '充分休息恢复体力，为后续行程储备能量'
  };
}

function toSpotNode(spot) {
  return {
    name: spot.name,
    type: spot.type,
    level: spot.level,
    accessible: spot.accessible,
    crowd: spot.crowd,
    stairs: spot.stairs,
    walk: spot.walk,
    duration: spot.duration,
    restPoint: spot.restPoint,
    nearbyHospital: spot.nearbyHospital,
    description: spot.desc,
    tips: spot.tips,
    rest: false,
    meal: false
  };
}

/** 在景点之间插入休息节点 */
function interleaveRest(spots, every) {
  const rebuilt = [];
  spots.forEach((s, i) => {
    rebuilt.push(s);
    if ((i + 1) % every === 0 && i !== spots.length - 1) rebuilt.push(makeRest());
  });
  return rebuilt;
}

/** 确保每天有午餐休息节点 */
function ensureMeal(spots) {
  const list = spots.slice();
  if (list.some((s) => s.meal)) return list;
  const firstReal = list.findIndex((s) => !s.rest && !s.meal);
  if (firstReal < 0) return list;
  list.splice(firstReal + 1, 0, makeMeal());
  return list;
}

// ---------- 兜底模板：把候选排成分天行程（大模型不可用时的确定性方案） ----------
function templateSchedule(profile, candidates, opts) {
  const o = opts || {};
  const days = clampDays(profile.days);
  const limit = rules.walkLimitMeters(profile);
  const perDayCap = o.perDayCap || rules.maxSpotsPerDay(profile);
  const senior = o.senior !== false;
  const list = rules.rankCandidates(candidates, profile);
  const schedule = [];
  let cursor = 0;

  for (let d = 1; d <= days; d++) {
    const pool = [];
    // 高龄长辈每 3 天安排 1 个休整日（符合实际体力恢复需要）
    const isRestDay = senior && days >= 3 && d % 3 === 0;
    if (isRestDay) {
      schedule.push({ day: d, theme: '第' + d + '天 · 休整日', spots: [makeRestDay(d)] });
      continue;
    }
    while (pool.length < perDayCap && cursor < list.length) {
      pool.push(list[cursor]);
      cursor += 1;
    }
    if (pool.length === 0) {
      schedule.push({
        day: d,
        theme: '第' + d + '天 · ' + (senior ? '休整日' : '自由活动'),
        spots: [
          senior
            ? makeRestDay(d)
            : { name: '自由活动·城市漫步', duration: '半天', description: '按兴趣自由安排，推荐就近街区与小店', tips: '注意集合时间与交通末班车' }
        ]
      });
      continue;
    }
    let spots = [];
    let dayWalk = 0;
    pool.forEach((spot) => {
      spots.push(toSpotNode(spot));
      dayWalk += spot.walk + 400;
      if (senior && dayWalk >= limit) {
        spots.push(makeRest());
        dayWalk = 0;
      }
    });
    if (senior && !spots.some((s) => s.rest)) {
      spots.splice(Math.floor(spots.length / 2), 0, makeRest());
    }
    spots = ensureMeal(spots);
    const theme = TYPE_THEME[pool[0].type] || (senior ? '轻松慢游' : '城市漫游');
    schedule.push({ day: d, theme: '第' + d + '天 · ' + theme, spots: spots });
  }
  return schedule;
}

// ---------- 独立的行程风险评估报告 ----------
function buildRisk(schedule, profile, filteredInfo) {
  const p = profile || {};
  const limit = rules.walkLimitMeters(p);
  const group = agePolicy.resolveAgeGroup(p.ageGroup);
  const senior = group.mode === 'senior';
  const days = Math.max(schedule.length, 1);

  let totalWalk = 0;
  let spotCount = 0;
  let highLevel = 0;
  let midLevel = 0;
  let stairsHeavy = 0;
  let crowdHigh = 0;
  let restCount = 0;
  const hospitals = [];
  const seenHospital = {};

  schedule.forEach((day) => {
    day.spots.forEach((s) => {
      if (s.rest || s.meal) {
        restCount += 1;
        return;
      }
      if (s.restDay) return;
      totalWalk += (s.walk || 0) + 400; // 单点步行 + 转场步行估算
      spotCount += 1;
      if (s.level === '高') highLevel += 1;
      if (s.level === '中') midLevel += 1;
      if (s.stairs === '多') stairsHeavy += 1;
      if (s.crowd === '高') crowdHigh += 1;
      if (s.nearbyHospital && !seenHospital[s.nearbyHospital]) {
        seenHospital[s.nearbyHospital] = true;
        hospitals.push(s.nearbyHospital);
      }
    });
  });

  const perDay = Math.round(totalWalk / days / 500) * 500;
  const items = [];

  if (!senior) {
    // 通用行程：输出强度提示，不做适老约束判定
    items.push('全程 ' + days + ' 天，共安排 ' + spotCount + ' 个景点，预估每日步行约 ' + perDay + ' 米，属常规强度。');
    if (perDay > 12000) items.push('单日步行量偏大，建议穿舒适运动鞋并预留午休。');
    items.push('热门景点建议提前线上预约，避免现场排队耽误时间。');
    return {
      level: perDay > 12000 ? '中' : '低',
      dailyWalk: '约' + perDay + '米/天',
      spotCount: spotCount,
      mode: 'general',
      items: items,
      dimensions: [],
      filters: []
    };
  }

  // ---- 适老风险判定 ----
  const walkOver = perDay > limit;
  if (walkOver) {
    items.push('预估每日步行约 ' + perDay + ' 米，超过您设定的上限（' + (p.walkLimit || '1-3km') + '），建议增加休息节点或减少景点。');
  } else {
    items.push('预估每日步行约 ' + perDay + ' 米，在您设定的上限（' + (p.walkLimit || '1-3km') + '）以内，节奏较轻松。');
  }

  if (p.accessible === true) {
    const n = (filteredInfo && filteredInfo.removedCount) || 0;
    items.push(n > 0
      ? '已为您自动过滤 ' + n + ' 个无无障碍配套或体力要求偏高的景点，所选景点均可轮椅/助行器通行。'
      : '所选景点均具备无障碍通道或电梯配套。');
  }

  const chronic = p.chronic || [];
  if (chronic.length > 0) {
    items.push('您标注了基础疾病（' + chronic.join('、') + '），请随身携带药品、按时服药并注意饮食忌口（详见出行贴士）。');
    if (chronic.indexOf('心脏病') >= 0 || chronic.indexOf('高血压') >= 0) {
      items.push('心脑血管类慢病：行程节奏已放缓，请勿赶路、避免长时间暴晒与人流高峰时段。');
    }
    if (chronic.indexOf('糖尿病') >= 0) {
      items.push('糖尿病：请定时定量进餐，随身携带小糖果以防低血糖，避免长时间空腹赶行程。');
    }
  }

  if (p.mobility === '需搀扶或轮椅') {
    items.push('行动需搀扶/轮椅：单日景点已压缩至 2 个，请确认景区可租借轮椅，并预留充足的无障碍通行时间。');
  } else if (p.mobility === '需慢行') {
    items.push('行动需慢行：单日景点按 2-3 个安排，景点之间已预留转场与歇脚时间。');
  }

  if (stairsHeavy > 0) {
    items.push('行程含 ' + stairsHeavy + ' 个有台阶的景点，已安排在体力较好的时段，可采用"缓行一小段即可返回"的游览方式。');
  } else {
    items.push('所选景点均以平缓步道为主，无明显台阶负担。');
  }

  if (crowdHigh > 0) {
    items.push('有 ' + crowdHigh + ' 个景点人流较多，建议错峰（上午 9 点前或下午 4 点后）前往，并约定同行人集合点。');
  }

  restCount += schedule.filter((d) => d.spots.some((s) => s.restDay)).length;
  items.push('行程已安排 ' + restCount + ' 处午餐/茶歇/休整节点，覆盖每一天，避免连续行走。');
  if (days >= 3) items.push('每 3 天已预留 1 个休整日，用于恢复体力，符合长辈出行实际节奏。');

  if (hospitals.length > 0) {
    items.push('沿途可就近关注的医疗机构：' + hospitals.slice(0, 4).join('、') + '。');
  }
  if (midLevel > 0) {
    items.push('有 ' + midLevel + ' 个中等体力景点，已优先安排在有休息点、可随时折返的时段。');
  }
  if (highLevel > 0) {
    items.push('⚠️ 行程中仍包含 ' + highLevel + ' 个高体力景点，建议调整为就近轻量游览或直接替换。');
  }

  // 维度化评估（结构化展示，便于前端做风险卡片）
  const dimensions = [
    { key: 'walk', label: '步行负荷', level: walkOver ? '高' : (perDay > limit * 0.8 ? '中' : '低'), note: '约' + perDay + '米/天（上限 ' + (p.walkLimit || '1-3km') + '）' },
    { key: 'stairs', label: '台阶强度', level: stairsHeavy >= 2 ? '高' : (stairsHeavy === 1 ? '中' : '低'), note: stairsHeavy > 0 ? '含 ' + stairsHeavy + ' 个有台阶景点' : '以平缓步道为主' },
    { key: 'crowd', label: '人流风险', level: crowdHigh >= 2 ? '高' : (crowdHigh === 1 ? '中' : '低'), note: crowdHigh > 0 ? crowdHigh + ' 个景点人流较多' : '整体较为清静' },
    { key: 'rest', label: '休息覆盖', level: restCount >= days ? '低' : '中', note: restCount + ' 处休息/午餐/休整节点' },
    { key: 'medical', label: '医疗可达', level: hospitals.length > 0 ? '低' : '中', note: hospitals.length > 0 ? '沿途 ' + hospitals.length + ' 家医院可选' : '建议出行前自行确认就近医院' }
  ];

  const filters = rules.summarizeRemoved((filteredInfo && filteredInfo.removed) || []);

  const level = (walkOver || highLevel > 0 || (chronic.length >= 2 && crowdHigh > 0)) ? '高'
    : ((stairsHeavy > 0 || chronic.length >= 1 || crowdHigh > 0 || dimensions.some((d) => d.level === '中')) ? '中' : '低');

  return {
    level: level,
    dailyWalk: '约' + perDay + '米/天',
    spotCount: spotCount,
    mode: 'senior',
    ageGroup: group.id,
    items: items,
    dimensions: dimensions,
    filters: filters,
    filteredCount: (filteredInfo && filteredInfo.removedCount) || 0
  };
}

// ---------- 中老年出行专属贴士（结合慢病/行动能力/天气） ----------
function buildTips(profile, schedule) {
  const p = profile || {};
  const chronic = p.chronic || [];
  const diet = [];
  (TIPS.diet && TIPS.diet.common ? TIPS.diet.common : ['饮食清淡、少油少盐，多吃易消化的食物']).forEach((t) => diet.push(t));
  if (chronic.indexOf('高血压') >= 0 && TIPS.diet) diet.push(TIPS.diet.hypertension[0]);
  if (chronic.indexOf('糖尿病') >= 0 && TIPS.diet) diet.push(TIPS.diet.diabetes[0]);
  if (chronic.indexOf('心脏病') >= 0 && TIPS.diet) diet.push(TIPS.diet.heart[0]);
  if (chronic.length === 0) diet.push('外出就餐注意卫生与清淡，避免生冷刺激');

  const medical = [];
  const hospitals = [];
  const seen = {};
  (schedule || []).forEach((day) => day.spots.forEach((s) => {
    if (s.rest || s.meal || s.restDay) return;
    if (s.nearbyHospital && !seen[s.nearbyHospital]) {
      seen[s.nearbyHospital] = true;
      hospitals.push(s.nearbyHospital);
    }
  }));
  hospitals.slice(0, 4).forEach((h) => medical.push('行程沿途可关注：' + h));
  (TIPS.medical || []).forEach((t) => medical.push(t));

  const rest = [];
  if (p.mobility === '需搀扶或轮椅') rest.push('建议同行 1-2 位家人全程照护，景区轮椅请提前预约租借');
  if (p.mobility === '需慢行') rest.push('每游览 40 分钟坐下休息 10 分钟，宁慢勿赶');
  (TIPS.rest || []).forEach((t) => rest.push(t));
  rest.push('随身携带折叠小凳或选择有座椅的路线，随时歇脚');

  const weather = (TIPS.weather || []).slice(0, 6);
  const carry = (TIPS.carry || []).slice(0, 6);
  carry.push('常用药物按天数分装并附用药清单，注明剂量与服用时间');

  return {
    mode: 'senior',
    rest: rest,
    medical: medical,
    diet: diet,
    weather: weather,
    carry: carry,
    // 中老年出行专属贴士：结合本次填写的身体条件动态生成
    personal: buildPersonalTips(p)
  };
}

/** 结合身体条件动态生成的个性化提醒 */
function buildPersonalTips(profile) {
  const p = profile || {};
  const list = [];
  if (p.chronic && p.chronic.indexOf('高血压') >= 0) list.push('高血压：每日早晚各测一次血压；避免清晨剧烈活动与情绪激动。');
  if (p.chronic && p.chronic.indexOf('糖尿病') >= 0) list.push('糖尿病：随身带血糖仪与小糖果；三餐定时，避免空腹长时间游览。');
  if (p.chronic && p.chronic.indexOf('心脏病') >= 0) list.push('心脏病：随身携带硝酸甘油等急救药；胸闷气短立即停止活动并就医。');
  if (p.joints === '轻微不便') list.push('膝关节轻微不便：佩戴护膝，尽量选择平缓步道，避免长时间上下台阶。');
  if (p.joints === '明显不便') list.push('膝关节明显不便：建议使用手杖或助行器，必要时使用景区无障碍通道/电瓶车。');
  if (p.mobility === '需搀扶或轮椅') list.push('行动需搀扶/轮椅：出行前致电景区确认无障碍入口、电梯与轮椅租借服务。');
  if (p.walkLimit) list.push('每日步行上限：' + p.walkLimit + '，行程已按此上限编排；如当天感觉疲劳，可随时跳过景点返回休息。');
  if (p.accessible === true) list.push('已为您筛选具备无障碍通道/电梯的景点，住宿建议同步选择无障碍房型。');
  if (list.length === 0) list.push('请根据当日身体状态灵活调整行程，感觉不适立即停下休息并就近就医。');
  return list;
}

/** 通用出行贴士（6-17 / 18-40） */
function buildGeneralTips(profile, schedule) {
  const p = profile || {};
  const days = clampDays(p.days);
  return {
    mode: 'general',
    rest: [
      '连续游览注意节奏，每 2 小时安排一次休息',
      '行程共 ' + days + ' 天，建议第 2 天起适当安排半日机动时间',
      '夜游或早起看日出请保证前一日充足睡眠'
    ],
    medical: [
      '随身携带创可贴、肠胃药、退烧药等基础药品',
      '暑期出行注意防暑降温，随身带电解质饮料',
      '记录当地急救电话与就近医院位置'
    ],
    diet: [
      '尝试当地特色美食时注意卫生，避免路边生冷摊点',
      '按 ' + (p.budget || '舒适型') + ' 预算选择餐厅，热门店铺建议提前取号',
      '注意按时用餐，避免因排队长时间空腹'
    ],
    weather: (TIPS.weather || []).slice(0, 4),
    carry: [
      '身份证件、充电宝、雨具、舒适运动鞋',
      '根据 ' + (p.days || 3) + ' 天行程准备换洗衣物与洗漱用品',
      '提前下载离线地图与景点预约凭证'
    ],
    personal: [
      '热门景点与博物馆普遍需要提前 1-7 天线上预约，请尽早安排',
      '如需带长辈/小朋友同行，可在出行信息中选择对应年龄段获取适老化方案'
    ]
  };
}

// ---------- 大模型输出校验（防幻觉：只允许候选集内的景点，安全字段由规则引擎重算） ----------
function normalizePlan(raw, profile, candidates, filteredInfo, opts) {
  const o = opts || {};
  const senior = o.senior !== false;
  const allowed = {};
  candidates.forEach((c) => (allowed[c.name] = c));
  const days = clampDays(profile.days);
  const perDayCap = rules.maxSpotsPerDay(profile, profile.ageGroup);

  const schedule = [];
  const rawSchedule = (raw && raw.schedule) || [];
  let dropped = 0;
  let duplicates = 0;
  const used = {}; // 同一景点在整份行程中只允许出现一次

  for (let d = 1; d <= days; d++) {
    const rawDay = rawSchedule[d - 1] || { spots: [] };
    const spots = [];
    (rawDay.spots || []).forEach((s) => {
      if (!s) return;
      if (s.rest || s.restDay) {
        spots.push(s.restDay ? makeRestDay(d) : makeRest());
        return;
      }
      if (s.meal) {
        spots.push(makeMeal());
        return;
      }
      const hit = allowed[s.name];
      if (!hit) {
        dropped += 1; // 大模型编造了候选集外的景点 → 丢弃（缓解幻觉）
        return;
      }
      if (used[hit.name]) {
        duplicates += 1; // 同一景点重复出现在多天 → 丢弃，避免"重游同一个地方"
        return;
      }
      used[hit.name] = true;
      spots.push(toSpotNode(hit)); // 安全相关字段以知识库为准，不采信模型输出
    });
    // 该天没有「实际景点」时（模型重复使用已被去重 / 候选不足，或只返回了占位节点），
    // 先用「还没用过」的候选补齐；补齐后仍为空则改为休整日 / 自由活动日，
    // 避免出现"只有午饭、没有景点"的空白天。
    const realCount = () => spots.filter((s) => !s.rest && !s.meal && !s.restDay).length;
    let filled = false; // 该天是否被"补齐"过（此时模型给的主题已不匹配实际景点）
    if (realCount() === 0) {
      const pool = rules.rankCandidates(candidates, profile)
        .filter((c) => !used[c.name])
        .slice(0, perDayCap);
      if (pool.length > 0) {
        spots.length = 0;
        pool.forEach((s) => {
          used[s.name] = true;
          spots.push(toSpotNode(s));
        });
        filled = true;
      }
    }
    let isRestDay = false;
    if (realCount() === 0) {
      spots.length = 0;
      spots.push(senior
        ? makeRestDay(d)
        : { name: '自由活动·城市漫步', duration: '全天', description: '按兴趣自由安排，推荐就近街区、公园与场馆', tips: '建议提前查看开放时间与预约要求' });
      isRestDay = true;
    }
    if (senior && !isRestDay && !spots.some((x) => x.rest)) {
      spots.splice(Math.min(1, spots.length), 0, makeRest());
    }
    // 主题：休整日固定文案；被补齐过则按实际景点重新生成，避免"主题说 A、实际去 B"
    const autoTheme = '第' + d + '天 · ' + (TYPE_THEME[(spots[0] || {}).type] || (senior ? '轻松慢游' : '城市漫游'));
    schedule.push({
      day: d,
      theme: isRestDay
        ? ('第' + d + '天 · ' + (senior ? '休整日' : '自由活动'))
        : (filled ? autoTheme : ((rawDay.theme && String(rawDay.theme).slice(0, 20)) || autoTheme)),
      spots: ensureMeal(spots)
    });
  }

  return {
    title: (raw && raw.title && String(raw.title).slice(0, 40)) ||
      (profile.city + (senior ? ' · 慢节奏适老' : ' · 精选') + days + '日游'),
    city: profile.city,
    days: days,
    profile: profile,
    schedule: schedule,
    risk: buildRisk(schedule, profile, filteredInfo),
    tips: senior ? buildTips(profile, schedule) : buildGeneralTips(profile, schedule),
    generatedAt: iso(),
    meta: { llmGenerated: true, droppedSpots: dropped, droppedDuplicates: duplicates }
  };
}

/** 模板兜底方案（确定性，无需大模型） */
function buildPlanFrom(profile, candidates, filteredInfo, opts) {
  const o = opts || {};
  const senior = o.senior !== false;
  const perDayCap = rules.maxSpotsPerDay(profile, profile.ageGroup);
  const schedule = templateSchedule(profile, candidates, { perDayCap: perDayCap, senior: senior });
  return {
    title: profile.city + (senior ? ' · 慢节奏适老' : ' · 精选') + clampDays(profile.days) + '日游',
    city: profile.city,
    days: clampDays(profile.days),
    profile: profile,
    schedule: schedule,
    risk: buildRisk(schedule, profile, filteredInfo),
    tips: senior ? buildTips(profile, schedule) : buildGeneralTips(profile, schedule),
    generatedAt: iso(),
    meta: { llmGenerated: false, droppedSpots: 0 }
  };
}

/** 无候选景点（知识库未收录该城市 / 过滤后为空）时的降级方案 */
function buildEmptyPlan(profile, reason, opts) {
  const o = opts || {};
  const senior = o.senior !== false;
  const days = clampDays(profile.days);
  const schedule = [];
  for (let d = 1; d <= days; d++) {
    schedule.push({
      day: d,
      theme: '第' + d + '天 · 自由安排',
      spots: [senior
        ? makeRestDay(d)
        : { name: '自由活动·城市漫步', duration: '全天', description: '按兴趣自由安排，推荐就近街区、公园与场馆', tips: '建议提前查看开放时间与预约要求' }]
    });
  }
  return {
    title: profile.city + (senior ? ' · 慢节奏适老' : ' · 精选') + days + '日游',
    city: profile.city,
    days: days,
    profile: profile,
    schedule: schedule,
    risk: {
      level: '低',
      dailyWalk: '约0米/天',
      mode: senior ? 'senior' : 'general',
      items: [
        '知识库暂未匹配到【' + profile.city + '】的可用景点（' + (reason || '无候选景点') + '）。',
        senior
          ? '已按慢节奏为您生成休整型行程框架；建议出行前致电景区确认无障碍通道与休息设施。'
          : '已为您生成自由活动框架，建议结合当地热门榜单自行安排。'
      ],
      dimensions: [],
      filters: []
    },
    tips: senior ? buildTips(profile, schedule) : buildGeneralTips(profile, schedule),
    generatedAt: iso(),
    meta: { llmGenerated: false, droppedSpots: 0, noCandidates: true }
  };
}

// ---------- 快捷调整按钮（纯规则引擎，确定性修改，无需大模型） ----------
const ADJUST_ACTIONS = ['increase_rest', 'reduce_walk', 'change_indoor', 'avoid_crowd'];

const ACTION_LABEL = {
  increase_rest: '增加休息',
  reduce_walk: '减少步行',
  change_indoor: '换室内景点',
  avoid_crowd: '避开人流'
};

function keptNames(spots) {
  return spots.map((s) => s.name);
}

function adjustPlan(plan, action) {
  if (ADJUST_ACTIONS.indexOf(action) < 0) return plan;
  const profile = plan.profile || {};
  const senior = agePolicy.resolveAgeGroup(profile.ageGroup).mode === 'senior';
  const schedule = JSON.parse(JSON.stringify(plan.schedule || []));
  const citySpots = knowledge.byCity(plan.city).map((s) => knowledge.enrich(s));
  const limit = rules.walkLimitMeters(profile);

  schedule.forEach((day) => {
    const restDays = day.spots.filter((s) => s.restDay);
    if (restDays.length > 0) return; // 休整日不做调整

    const real = day.spots.filter((s) => !s.rest && !s.meal);

    if (action === 'increase_rest') {
      const rebuilt = [];
      real.forEach((s, i) => {
        rebuilt.push(s);
        if ((i + 1) % 2 === 0) rebuilt.push(makeRest());
      });
      if (!rebuilt.some((s) => s.rest)) rebuilt.splice(Math.min(1, rebuilt.length), 0, makeRest());
      day.spots = ensureMeal(rebuilt.slice(0, 6));
    } else if (action === 'reduce_walk') {
      const kept = [];
      real.forEach((s) => {
        if ((s.walk || 0) <= Math.min(limit, 1500)) {
          kept.push(s);
          return;
        }
        const alt = citySpots.find((c) =>
          c.walk <= 800 && c.level === '低' &&
          keptNames(kept).indexOf(c.name) < 0 && c.name !== s.name &&
          (!profile.accessible || c.accessible)
        );
        if (alt) kept.push(toSpotNode(alt));
      });
      if (kept.length === 0 && real.length > 0) kept.push(real[0]);
      day.spots = ensureMeal(interleaveRest(kept.slice(0, 3), 2));
    } else if (action === 'change_indoor') {
      const indoors = citySpots.filter((s) => s.type === '室内场馆' && s.level !== '高');
      const used = [];
      const kept = real.map((s) => {
        if (s.type !== '室内场馆' && s.level !== '低') {
          const alt = indoors.find((c) => used.indexOf(c.name) < 0 && c.name !== s.name);
          if (alt) {
            used.push(alt.name);
            return toSpotNode(alt);
          }
        }
        used.push(s.name);
        return s;
      });
      day.spots = ensureMeal(interleaveRest(kept.slice(0, 3), senior ? 3 : 4));
    } else if (action === 'avoid_crowd') {
      const kept = real.filter((s) => s.crowd !== '高');
      if (kept.length === 0 && real.length > 0) kept.push(real[0]);
      day.spots = ensureMeal(interleaveRest(kept.slice(0, 3), senior ? 3 : 4));
    }
  });

  const filteredInfo = { removedCount: (plan.risk && plan.risk.filteredCount) || 0, removed: [] };
  return Object.assign({}, plan, {
    schedule: schedule,
    risk: buildRisk(schedule, profile, filteredInfo),
    tips: senior ? buildTips(profile, schedule) : buildGeneralTips(profile, schedule),
    updatedAt: iso()
  });
}

module.exports = {
  TYPE_THEME,
  ADJUST_ACTIONS,
  ACTION_LABEL,
  clampDays,
  makeRest,
  makeMeal,
  makeRestDay,
  toSpotNode,
  interleaveRest,
  ensureMeal,
  templateSchedule,
  buildRisk,
  buildTips,
  buildGeneralTips,
  buildPersonalTips,
  normalizePlan,
  buildPlanFrom,
  buildEmptyPlan,
  adjustPlan
};
