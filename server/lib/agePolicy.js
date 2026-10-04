/**
 * agePolicy.js - 年龄段策略（项目核心差异化创新的入口开关）
 *
 * 规划流程起始即选择年龄段，四个数字区间：
 *   6-17 岁 / 18-40 岁  → 通用规划流程（mode = general）
 *   41-60 岁 / 61 岁及以上 → 自动触发适老化专项业务流程（mode = senior）
 *
 * 41 岁以上触发适老化流程时同步下发：
 *   - 自动大字体（fontScale）与高对比度建议
 *   - 需要采集的适老字段清单（行动能力 / 基础疾病 / 无障碍需求 / 每日步行上限）
 *   - 该年龄段的默认约束（作为表单默认值，用户可覆盖）
 */
const AGE_GROUPS = [
  {
    id: '6-17',
    label: '6—17 岁',
    short: '青少年',
    min: 6,
    max: 17,
    mode: 'general',
    fontScale: 1.0,
    highContrast: false
  },
  {
    id: '18-40',
    label: '18—40 岁',
    short: '中青年',
    min: 18,
    max: 40,
    mode: 'general',
    fontScale: 1.0,
    highContrast: false
  },
  {
    id: '41-60',
    label: '41—60 岁',
    short: '中老年',
    min: 41,
    max: 60,
    mode: 'senior',
    fontScale: 1.25,
    highContrast: false
  },
  {
    id: '61+',
    label: '61 岁及以上',
    short: '高龄长辈',
    min: 61,
    max: 130,
    mode: 'senior',
    fontScale: 1.4,
    highContrast: true
  }
];

// 适老化流程需要采集的字段（后端强校验项，前端表单对应项）
const SENIOR_FIELDS = [
  { key: 'mobility', label: '行动能力', options: ['完全自理', '需慢行', '需搀扶或轮椅'], required: true },
  { key: 'chronic', label: '基础疾病', options: ['无', '高血压', '心脏病', '糖尿病'], required: false },
  { key: 'accessible', label: '无障碍需求', options: ['需要无障碍通道/电梯', '不需要'], required: true },
  { key: 'walkLimit', label: '每日可承受步行上限', options: ['1km以内', '1-3km', '3-5km', '5km以上'], required: true },
  { key: 'joints', label: '关节/膝关节状况', options: ['正常', '轻微不便', '明显不便'], required: false }
];

/** 各年龄段默认约束（作为适老表单默认值） */
const DEFAULTS = {
  '6-17': { walkLimit: '5km以上', mobility: '完全自理', accessible: false, maxSpotsPerDay: 5, maxDays: 7 },
  '18-40': { walkLimit: '5km以上', mobility: '完全自理', accessible: false, maxSpotsPerDay: 5, maxDays: 7 },
  '41-60': { walkLimit: '3-5km', mobility: '完全自理', accessible: false, maxSpotsPerDay: 3, maxDays: 6 },
  '61+': { walkLimit: '1-3km', mobility: '需慢行', accessible: true, maxSpotsPerDay: 2, maxDays: 5 }
};

/** 解析输入的年龄段：支持 '61+'、'41-60'、'61岁及以上'、数字 65 等写法 */
function resolveAgeGroup(input) {
  const raw = (input === undefined || input === null) ? '' : String(input).trim();
  if (raw) {
    // 1) 直接命中 id
    const byId = AGE_GROUPS.find((g) => g.id === raw || g.label === raw);
    if (byId) return byId;
    // 2) 命中区间写法 41-60 / 41~60 / 41—60
    const range = raw.match(/^(\d{1,3})\s*[-~—－至]\s*(\d{1,3})$/);
    if (range) {
      const g = AGE_GROUPS.find((x) => x.min === Number(range[1]) && x.max === Number(range[2]));
      if (g) return g;
    }
    // 3) 纯数字年龄
    const age = raw.match(/(\d{1,3})/);
    if (age) {
      const n = Number(age[1]);
      const byAge = AGE_GROUPS.find((g) => n >= g.min && n <= g.max);
      if (byAge) return byAge;
    }
    // 4) 含"61"等关键字的高龄表述
    if (/61|65|70|75|80|85|90|高龄|老年|长辈/.test(raw)) return AGE_GROUPS[3];
  }
  // 未选择/无法识别：默认走通用流程（不擅自给用户叠加适老约束）
  return Object.assign({}, AGE_GROUPS[1], { fallback: true });
}

/** 是否触发适老化专项业务流程 */
function isSeniorFlow(input) {
  return resolveAgeGroup(input).mode === 'senior';
}

/** 年龄段 → 适老化流程开关（返回给前端：决定是否自动开启大字体、进入适老表单） */
function buildFlowDecision(input) {
  const group = resolveAgeGroup(input);
  const senior = group.mode === 'senior';
  return {
    ageGroup: group.id,
    ageLabel: group.label,
    mode: group.mode,
    seniorFlow: senior,
    // 自动开启大字体（前端直接写入设置）
    fontScale: group.fontScale,
    highContrast: group.highContrast,
    requireFields: senior ? SENIOR_FIELDS : [],
    defaults: DEFAULTS[group.id] || DEFAULTS['18-40'],
    nextStep: senior ? 'senior_profile' : 'general_profile',
    message: senior
      ? '已为您开启适老化模式（大字体）并进入适老出行信息采集。系统将优先过滤高体力消耗、无无障碍配套的景点，并额外输出行程风险评估与专属出行贴士。'
      : '已进入通用规划流程，填写出行信息即可生成行程。'
  };
}

/** 年龄段默认约束（行程编排使用） */
function defaultsOf(input) {
  const group = resolveAgeGroup(input);
  return Object.assign({}, DEFAULTS[group.id] || DEFAULTS['18-40'], { group: group.id, mode: group.mode });
}

module.exports = {
  AGE_GROUPS,
  SENIOR_FIELDS,
  DEFAULTS,
  resolveAgeGroup,
  isSeniorFlow,
  buildFlowDecision,
  defaultsOf
};
