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

module.exports = { CITIES, buildPlan };
