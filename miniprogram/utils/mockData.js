// mockData.js - 本地模拟数据（无云环境时前端演示用，字段结构与云函数保持一致）
// 说明：真实部署后由云函数（规则引擎+知识库+大模型）返回同样结构的数据。

const CITIES = [
  { region: '华北', cities: ['北京', '天津', '石家庄'] },
  { region: '华东', cities: ['上海', '南京', '杭州', '苏州', '青岛'] },
  { region: '华南', cities: ['广州', '深圳', '厦门', '桂林'] },
  { region: '西南', cities: ['成都', '重庆', '昆明'] },
  { region: '西北', cities: ['西安', '兰州', '乌鲁木齐'] },
  { region: '东北', cities: ['哈尔滨', '大连', '沈阳'] }
];

// 演示用精简景点池（每城市若干，含体力/无障碍/人流标注）
const POOL = {
  '北京': [
    { name: '天坛公园', type: '历史古迹', level: '低', walk: 1500, duration: '2小时', restPoint: '园内林荫长椅充足', nearbyHospital: '同仁医院（约1.5公里）', desc: '明清皇家祭天场所，古柏参天，步道平缓。', tips: '清晨人少清静，可自带水杯在茶座休息。' },
    { name: '首都博物馆', type: '室内场馆', level: '低', walk: 1200, duration: '2小时', restPoint: '馆内休息区充足', nearbyHospital: '宣武医院（约2公里）', desc: '人少清静的市级博物馆，参观节奏轻松。', tips: '环境安静，适合怕拥挤的长辈。' },
    { name: '北海公园', type: '自然风光', level: '低', walk: 1200, duration: '1.5小时', restPoint: '湖边多处座椅', nearbyHospital: '北大医院（约2公里）', desc: '皇家园林，湖面开阔，环湖步道平缓。', tips: '可乘游船观景，选择西岸平缓步道。' },
    { name: '国家博物馆', type: '室内场馆', level: '低', walk: 1800, duration: '3小时', restPoint: '馆内各层均有休息座椅', nearbyHospital: '北京医院（约1公里）', desc: '国家最高历史文化殿堂，冬暖夏凉。', tips: '免费但需预约，每小时坐下歇脚。' },
    { name: '景山公园', type: '自然风光', level: '中', walk: 1000, duration: '1.5小时', restPoint: '园内座椅较多', nearbyHospital: '北京医院（约1公里）', desc: '登万春亭俯瞰故宫全景，坡度较缓。', tips: '腿脚不便者可在山脚平地活动。' },
    { name: '什刹海', type: '民俗文化', level: '低', walk: 1000, duration: '1.5小时', restPoint: '沿湖座椅与茶座', nearbyHospital: '积水潭医院（约1公里）', desc: '老北京风情水域，沿湖漫步看胡同。', tips: '傍晚人多，建议上午前往。' }
  ],
  '西安': [
    { name: '曲江池遗址公园', type: '自然风光', level: '低', walk: 2000, duration: '2小时', restPoint: '环湖座椅充足', nearbyHospital: '曲江新区医院（约1公里）', desc: '盛唐气象的开放式公园，水面开阔。', tips: '免费开放，傍晚凉爽适合慢走。' },
    { name: '碑林博物馆', type: '室内场馆', level: '低', walk: 1000, duration: '2小时', restPoint: '馆内休息座椅', nearbyHospital: '西安市第四医院（约1公里）', desc: '书法艺术宝库，室内凉爽安静。', tips: '适合喜爱书法、安静环境的长辈。' },
    { name: '陕西历史博物馆', type: '室内场馆', level: '低', walk: 2000, duration: '3小时', restPoint: '馆内各层休息座椅', nearbyHospital: '陕西省人民医院（约1.5公里）', desc: '馆藏丰富、室内参观无日晒。', tips: '免费票需提前预约，请讲解器慢听。' },
    { name: '回民街', type: '美食体验', level: '低', walk: 1200, duration: '2小时', restPoint: '街边小吃店可随时休息', nearbyHospital: '西安市第一医院（约1公里）', desc: '西安特色美食街，老字号云集。', tips: '人多拥挤建议错峰，注意忌口。' }
  ],
  '成都': [
    { name: '人民公园', type: '自然风光', level: '低', walk: 1000, duration: '1.5小时', restPoint: '鹤鸣茶社座椅充足', nearbyHospital: '成都市第三人民医院（约1公里）', desc: '成都人喝茶摆龙门阵的地方。', tips: '鹤鸣茶社喝杯茶歇歇脚，感受慢生活。' },
    { name: '成都博物馆', type: '室内场馆', level: '低', walk: 1800, duration: '2.5小时', restPoint: '馆内休息座椅', nearbyHospital: '成都市第一人民医院（约1.5公里）', desc: '天府文化集中展示，皮影蜀锦特色。', tips: '免费预约，二层皮影馆值得细看。' },
    { name: '宽窄巷子', type: '民俗文化', level: '低', walk: 1200, duration: '1.5小时', restPoint: '巷内茶馆可歇脚', nearbyHospital: '成都市第三人民医院（约1公里）', desc: '成都慢生活名片，老院落茶馆小吃。', tips: '找茶馆喝盖碗茶坐一坐就是最好游览。' }
  ]
};

// 兜底城市池（未收录城市也能演示）
function poolOf(city) {
  return POOL[city] || [
    { name: '城市博物馆', type: '室内场馆', level: '低', walk: 1200, duration: '2小时', restPoint: '馆内休息区', nearbyHospital: '市中心医院（约1公里）', desc: city + '的市级博物馆，室内参观舒适。', tips: '免费或低价，适合慢节奏参观。' },
    { name: '中心公园', type: '自然风光', level: '低', walk: 1500, duration: '2小时', restPoint: '园内长椅充足', nearbyHospital: '市中心医院（约1公里）', desc: city + '的城市公园，步道平缓、绿树成荫。', tips: '适合早晚散步，随时坐下休息。' },
    { name: '历史文化街区', type: '民俗文化', level: '低', walk: 1000, duration: '1.5小时', restPoint: '街边店铺可休息', nearbyHospital: '市中心医院（约1.5公里）', desc: city + '的老街风貌，烟火气浓厚。', tips: '慢慢逛、随时进店歇脚。' },
    { name: '艺术展览馆', type: '室内场馆', level: '低', walk: 800, duration: '1.5小时', restPoint: '馆内座椅', nearbyHospital: '市中心医院（约1公里）', desc: '室内展览空间，人少清净。', tips: '天气不佳时的好去处。' }
  ];
}

function walkLimitMeters(profile) {
  const map = { '1km以内': 1000, '1-3km': 3000, '3-5km': 5000, '5km以上': 8000 };
  return map[profile.walkLimit] || 3000;
}

function buildPlan(profile) {
  const city = profile.city;
  const days = Math.min(Math.max(profile.days || 1, 1), 7);
  const limit = walkLimitMeters(profile);
  // 适老：单日最多 3 个景点（需慢行/轮椅 2 个）
  const perDayCap = (profile.mobility === '需慢行' || profile.mobility === '需搀扶或轮椅') ? 2 : 3;
  let spots = poolOf(city).filter((s) => s.walk <= limit);
  if (spots.length === 0) spots = poolOf(city); // 无候选时放宽（与云端一致）
  const schedule = [];
  for (let d = 1; d <= days; d++) {
    const daySpots = spots.slice((d - 1) * perDayCap, d * perDayCap).map((s) => Object.assign({ rest: false, meal: false, restDay: false }, s));
    if (daySpots.length === 0) {
      // 候选不足：该天改为休整日，不安排景点（符合实际的慢节奏）
      schedule.push({ day: d, theme: '第' + d + '天 · 休整日', spots: [{ restDay: true, name: '休整日·自由安排', duration: '全天', description: '就近散步、逛早市或酒店休息，量力而行，不安排景点', tips: '充分休息恢复体力，为后续行程储备能量' }] });
      continue;
    }
    if (daySpots.length > 1) {
      daySpots.splice(Math.floor(daySpots.length / 2), 0, { rest: true, name: '茶歇休息', duration: '30分钟', description: '坐下歇脚、补充水分', restPoint: '就近茶座/长椅', tips: '慢病患者按时服药、少量多次喝水' });
    }
    daySpots.splice(1, 0, { meal: true, name: '午餐休息·就近餐厅', duration: '1小时', description: '就近选择卫生清淡的餐厅用餐，补充体力后再出发', restPoint: '餐厅可就坐休息', nearbyHospital: '', tips: '慢病忌口请参照出行贴士，少油少盐、七分饱' });
    schedule.push({ day: d, theme: '第' + d + '天 · 轻松慢游', spots: daySpots });
  }
  const risk = {
    level: profile.chronic && profile.chronic.length >= 2 ? '中' : '低',
    dailyWalk: '约' + (limit > 3000 ? 2500 : limit) + '米/天',
    items: [
      '行程按慢节奏低负荷设计，安排午餐休息与茶歇，节奏从容',
      profile.accessible ? '已优先选择具备无障碍配套的景点' : '出行注意台阶与路面情况',
      profile.chronic && profile.chronic.length ? '您标注了慢病（' + profile.chronic.join('、') + '），请随身携带药品并注意忌口' : '身体状况良好，保持常规作息即可'
    ]
  };
  const tips = {
    rest: ['每日安排 1-2 次坐下歇脚的茶歇', '午后安排 30 分钟以上午休或慢节奏活动', '景点之间预留充足转场休息时间'],
    medical: ['出发前确认行程沿途医院、药店位置', '身体不适优先就近就医，勿勉强赶行程', '慢性病患者随身携带药品并按时服药'],
    diet: ['饮食清淡、少油少盐，多吃易消化食物'],
    weather: ['早晚温差大，随身带薄外套', '晴天注意防晒：遮阳帽、太阳镜', '雨天穿防滑鞋放慢脚步'],
    carry: ['常用药物及病历摘要、急救联系卡', '身份证、老年证（多数景区减免门票）', '保温杯、舒适防滑的鞋']
  };
  if (profile.chronic) {
    if (profile.chronic.includes('高血压')) tips.diet.push('控制盐摄入，少吃腌制酱制食品');
    if (profile.chronic.includes('糖尿病')) tips.diet.push('定时定量进餐，随身带糖果防低血糖');
    if (profile.chronic.includes('心脏病')) tips.diet.push('避免过饱油腻，七分饱，随身带急救药');
  }
  return {
    title: city + ' · 慢节奏适老' + days + '日游',
    city,
    days,
    profile,
    schedule,
    risk,
    tips,
    generatedAt: new Date().toISOString(),
    mock: true
  };
}

// ===== 年龄段策略（本地模拟版，与后端 server/lib/agePolicy.js 行为一致）=====
const AGE_GROUPS = [
  { id: '6-17', label: '6—17 岁', mode: 'general', fontScale: 1.0, highContrast: false },
  { id: '18-40', label: '18—40 岁', mode: 'general', fontScale: 1.0, highContrast: false },
  { id: '41-60', label: '41—60 岁', mode: 'senior', fontScale: 1.25, highContrast: false },
  { id: '61+', label: '61 岁及以上', mode: 'senior', fontScale: 1.4, highContrast: true }
];

function resolveAgeFlow(input) {
  const raw = String(input || '');
  let group = AGE_GROUPS.filter((g) => g.id === raw)[0];
  if (!group) {
    const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      group = num <= 17 ? AGE_GROUPS[0] : (num <= 40 ? AGE_GROUPS[1] : (num <= 60 ? AGE_GROUPS[2] : AGE_GROUPS[3]));
    }
  }
  if (!group) group = AGE_GROUPS[1];
  const senior = group.mode === 'senior';
  return {
    ok: true,
    ageGroup: group.id,
    ageLabel: group.label,
    mode: group.mode,
    seniorFlow: senior,
    fontScale: group.fontScale,
    highContrast: group.highContrast,
    requireFields: senior
      ? [
        { key: 'mobility', label: '行动能力', options: ['完全自理', '需慢行', '需搀扶或轮椅'] },
        { key: 'chronic', label: '基础疾病', options: ['无', '高血压', '心脏病', '糖尿病'] },
        { key: 'accessible', label: '无障碍需求', options: ['需要无障碍通道/电梯', '不需要'] },
        { key: 'walkLimit', label: '每日可承受步行上限', options: ['1km以内', '1-3km', '3-5km', '5km以上'] },
        { key: 'joints', label: '关节/膝关节状况', options: ['正常', '轻微不便', '明显不便'] }
      ]
      : [],
    nextStep: senior ? 'senior_profile' : 'general_profile',
    message: senior
      ? '已为您开启适老化模式（大字体）并进入适老出行信息采集。系统将优先过滤高体力消耗、无无障碍配套的景点，并额外输出行程风险评估与专属出行贴士。'
      : '已进入通用规划流程，填写出行信息即可生成行程。'
  };
}

// ===== 离线智能回复（未连接大模型/后端时的兜底，尽量给出有依据、可执行的回答）=====
const CITY_LIST = CITIES.reduce((acc, r) => acc.concat(r.cities || []), []);

function findCityIn(text) {
  const s = String(text || '');
  const hits = CITY_LIST.filter((c) => s.indexOf(c) >= 0).sort((a, b) => b.length - a.length);
  return hits[0] || '';
}

// 行动能力受限的各种说法（脑梗 / 中风 / 偏瘫 / 轮椅…）
// ⚠️ 注意不能再用裸的 '人' 做关键词 —— "病人""老人""家人" 都会误命中"避开人流"
const MOBILITY_KEYS = [
  '脑梗', '脑出血', '脑血栓', '中风', '偏瘫', '半身', '瘫痪',
  '轮椅', '搀扶', '搀着', '扶着', '拄拐', '拐杖', '助行器', '助行',
  '行动不便', '走不动', '走不了', '腿脚', '腿不利索', '膝盖', '关节', '刚能走', '勉强走', '站不稳'
];

/** 行动能力受限的选点建议（无行程 / 只是问推荐时使用） */
function mobilityAdvice(t) {
  const city = findCityIn(t);
  const lines = [
    '按您说的行动还不太方便，选地方把握三点最要紧：',
    '· 全程平路无台阶、有无障碍通道或电梯；',
    '· 每个点 1 小时以内，随时能坐下歇脚；',
    '· 离医院近、打车方便，累了能马上回住处。'
  ];
  if (city) {
    const spots = poolOf(city).filter((s) => s.level !== '高').slice(0, 3);
    if (spots.length) {
      lines.push('');
      lines.push('【' + city + '】相对稳妥的选择：');
      spots.forEach((s) => lines.push('· ' + s.name + '（' + s.type + '，' + s.duration + '，' + s.restPoint + '）'));
    }
  }
  lines.push('');
  lines.push('建议点击"生成行程"填写出行信息，把"行动能力"选为"需搀扶或轮椅"、"每日步行上限"选"1km以内"，' +
    '我会据此剔除台阶多、步行量大的景点，并额外给出行程风险评估与专属贴士。');
  return lines.join('\n');
}

/** 本地兜底回复：意图识别 + 知识库推荐 + 引导生成行程 */
function buildOfflineReply(text, plan) {
  const t = String(text || '');
  const city = findCityIn(t);
  const hasPlan = !!plan;
  const mobilityHit = MOBILITY_KEYS.some((k) => t.indexOf(k) >= 0);

  // 1) 行动能力受限 且 当前没有行程 → 直接给"怎么选地方"的可执行建议
  //    （有行程时优先响应"调整行程"的明确诉求，见下方各分支）
  if (mobilityHit && !hasPlan) {
    return { reply: mobilityAdvice(t), action: null };
  }

  // 2) 人流（关键词收紧：必须是"人流/人多/拥挤"等，不能是裸的"人"）
  if (/人流|人多|拥挤|排队|太吵|吵|清净|避开人多/.test(t)) {
    return hasPlan
      ? { reply: '好的，我已避开人流密集的景点，改选清静、有座椅的地方。建议上午 9 点前或下午 4 点后错峰出门，博物馆一开馆就进去人最少。', action: 'avoid_crowd' }
      : { reply: '想避开人流，建议挑工作日上午 9 点前或下午 4 点后出门；博物馆开馆即入最清静。\n您也可以先生成一份行程，我会直接把人多的景点筛掉。', action: null };
  }

  // 3) 休息 / 节奏
  if (/休息|歇脚|茶歇|太累|慢一点|节奏慢|赶/.test(t)) {
    return hasPlan
      ? { reply: '好的，我已为您增加休息节点：每天在景点之间插入茶歇与午餐休息，单日景点适当精简。', action: 'increase_rest' }
      : { reply: '安排行程时建议每天只放 2 个景点，上午一个、午后一个，中间留 1 小时午休。\n先生成一份行程，我可以按这个节奏帮您排。', action: null };
  }

  // 4) 步行量
  if (/步行|走路多|走路远|少走|走得远/.test(t)) {
    return hasPlan
      ? { reply: '好的，我已减少步行量：优先保留低体力、步行少的景点，单日步行控制在您的上限以内。', action: 'reduce_walk' }
      : { reply: '减少步行量的办法：优先选博物馆、公园平路，善用景区电瓶车和游船。\n生成行程时把"每日步行上限"选小一档，我会据此过滤。', action: null };
  }

  // 5) 室内 / 天气
  if (/室内|下雨|太晒|晒|天热|高温|风大|阴天/.test(t)) {
    return hasPlan
      ? { reply: '好的，我已把户外强度较大的景点换成室内场馆（博物馆、展馆类），冬暖夏凉、坐着也能看。', action: 'change_indoor' }
      : { reply: '遇到雨天或高温，博物馆、美术馆这类室内场馆最合适：有空调、有座椅、还能看展。\n需要的话我帮您把行程整体换成"室内为主"。', action: null };
  }

  // 6) 行前准备 / 贴士
  if (/带什么|准备|要带|药品|吃药|忌口|饮食|穿衣|天气|证件|贴士|注意什么/.test(t)) {
    return {
      reply: '出行前按这五类准备就稳妥：\n' +
        '① 证件：身份证、老年证（多数景区减免门票）、医保卡；\n' +
        '② 药品：常用药按天数分装 + 病历摘要/急救卡（写明病史、用药、家人电话）；\n' +
        '③ 穿戴：防滑鞋、薄外套或围巾（早晚温差大）、遮阳帽；\n' +
        '④ 随身：保温杯（少量多次喝温水）、小零食（防低血糖）、拐杖或助行器；\n' +
        '⑤ 医疗：出发前确认沿途医院药店，身体不适优先就近就医、别勉强赶行程。',
      action: null
    };
  }

  // 7) 提到城市 → 用知识库给推荐
  if (city) {
    const spots = poolOf(city).slice(0, 4);
    if (spots.length) {
      const list = spots.map((s) => s.name + '（' + s.type + '，' + s.duration +
        '，步行约' + s.walk + '米，' + s.restPoint + '）');
      return {
        reply: '为您介绍【' + city + '】值得去的几个地方：\n· ' + list.join('\n· ') +
          '\n\n想让我按您的天数和身体条件排成正式行程？点"生成行程"填写出行信息即可。',
        action: null
      };
    }
  }

  // 8) 问候 / 自我介绍
  if (/你好|您好|在吗|嗨|你是谁|介绍一下/.test(t)) {
    return { reply: '您好，我是您的旅游规划助手。您可以问我"杭州有什么好玩的""带老人出门要准备什么""走不动路适合去哪"。\n想拿正式方案，点下方"生成行程"填写出行信息即可。', action: null };
  }
  if (/你会什么|能做什么|帮助|怎么用|有什么功能/.test(t)) {
    return {
      reply: '我可以帮您：\n· 推荐目的地与景点（会说明步行量、有无台阶、休息点）\n' +
        '· 给行前准备建议（吃药、饮食、穿衣、随身物品）\n' +
        '· 按年龄段与身体条件生成行程，并附风险评估与专属贴士\n' +
        '· 按您的想法调整已有行程',
      action: null
    };
  }

  // 9) 提到行动不便但没匹配到具体调整诉求 → 给出选点建议
  if (mobilityHit) return { reply: mobilityAdvice(t), action: null };

  // 10) 默认
  return {
    reply: '我大概理解您的意思了。您可以再具体一点，例如：\n· "杭州有什么好玩的"\n· "我走不太动路，适合去哪"\n· "带老人出门要准备什么"\n也可以直接点下方"生成行程"，我按您的身体条件出方案。',
    action: null
  };
}

module.exports = { CITIES, buildPlan, AGE_GROUPS, resolveAgeFlow, buildOfflineReply };

