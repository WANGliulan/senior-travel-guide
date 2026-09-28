/**
 * data.js - 智游康行·岁旅相伴 公共数据模块
 * 说明：
 *  - attractions 为"示范城市景点知识库"（轻量版）。每条景点预先标注：
 *    体力等级(level)、无障碍(accessible)、人流量(crowd)、类型(type)、
 *    单点步行量(walk)、建议时长(duration)、休息点(restPoint)、就近医疗(nearbyHospital)。
 *  - 升级路径：接入向量数据库（如腾讯云向量数据库）后，可将本文件替换为
 *    embedding 检索结果，字段结构保持不变。
 *  - elderlyTips 为老年出行科普知识库（饮食、天气、随身物品、休息）。
 */

const CITIES = [
  { region: '华北', cities: ['北京', '天津', '石家庄'] },
  { region: '华东', cities: ['上海', '南京', '杭州', '苏州', '青岛'] },
  { region: '华南', cities: ['广州', '深圳', '厦门', '桂林'] },
  { region: '西南', cities: ['成都', '重庆', '昆明'] },
  { region: '西北', cities: ['西安', '兰州', '乌鲁木齐'] },
  { region: '东北', cities: ['哈尔滨', '大连', '沈阳'] }
];

// level: 高/中/低 体力消耗；crowd: 高/中/低 人流量；accessible: 是否具备无障碍配套
const ATTRACTIONS = [
  // ===== 北京 =====
  { id: 'bj01', city: '北京', name: '故宫博物院', level: '中', accessible: true, crowd: '高', type: '历史古迹', walk: 2500, duration: '2.5小时', restPoint: '院内有多处休息长廊与座椅', nearbyHospital: '北京协和医院（约2公里）', desc: '明清两代皇宫，慢步中轴线感受历史，道路平坦适合慢游。', tips: '提前预约门票，建议上午入园、避开周末人流高峰。' },
  { id: 'bj02', city: '北京', name: '天坛公园', level: '低', accessible: true, crowd: '中', type: '历史古迹', walk: 1500, duration: '2小时', restPoint: '园内林荫长椅充足', nearbyHospital: '同仁医院（约1.5公里）', desc: '明清皇家祭天场所，古柏参天，步道平缓，是散步休闲的好去处。', tips: '清晨人少清静，可自带水杯在园内茶座休息。' },
  { id: 'bj03', city: '北京', name: '北海公园', level: '低', accessible: true, crowd: '中', type: '自然风光', walk: 1200, duration: '1.5小时', restPoint: '湖边多处座椅', nearbyHospital: '北大医院（约2公里）', desc: '皇家园林，湖面开阔，环湖步道平缓，适合慢节奏游览。', tips: '可乘游船观景，选择平缓的西岸步道。' },
  { id: 'bj04', city: '北京', name: '国家博物馆', level: '低', accessible: true, crowd: '高', type: '室内场馆', walk: 1800, duration: '3小时', restPoint: '馆内各层均有休息座椅', nearbyHospital: '北京医院（约1公里）', desc: '国家最高历史文化殿堂，室内参观、冬暖夏凉，适合天气不佳时安排。', tips: '免费但需预约，建议分时段参观、每层设茶歇。' },
  { id: 'bj05', city: '北京', name: '首都博物馆', level: '低', accessible: true, crowd: '低', type: '室内场馆', walk: 1200, duration: '2小时', restPoint: '馆内休息区充足', nearbyHospital: '宣武医院（约2公里）', desc: '人少清静的市级博物馆，展示北京历史文化，参观节奏轻松。', tips: '人流量小、环境安静，适合怕拥挤的长辈。' },
  { id: 'bj06', city: '北京', name: '景山公园', level: '中', accessible: false, crowd: '中', type: '自然风光', walk: 1000, duration: '1.5小时', restPoint: '园内座椅较多', nearbyHospital: '北京医院（约1公里）', desc: '登万春亭可俯瞰故宫全景，台阶不多、坡度较缓。', tips: '腿脚不便者可在山脚平地活动，不必登顶。' },
  { id: 'bj07', city: '北京', name: '什刹海·荷花市场', level: '低', accessible: true, crowd: '高', type: '民俗文化', walk: 1000, duration: '1.5小时', restPoint: '沿湖座椅与茶座', nearbyHospital: '积水潭医院（约1公里）', desc: '老北京风情水域，沿湖漫步看胡同与人力车，烟火气浓。', tips: '傍晚人多，建议上午前往；可乘三轮车代步。' },
  { id: 'bj08', city: '北京', name: '雍和宫', level: '中', accessible: false, crowd: '高', type: '民俗文化', walk: 1500, duration: '1.5小时', restPoint: '殿前有少量座椅', nearbyHospital: '第六医院（约1.5公里）', desc: '京城香火最盛的藏传佛教寺庙，建筑古朴庄严。', tips: '殿宇台阶较多，膝部不适者量力而行。' },

  // ===== 西安 =====
  { id: 'xa01', city: '西安', name: '陕西历史博物馆', level: '低', accessible: true, crowd: '高', type: '室内场馆', walk: 2000, duration: '3小时', restPoint: '馆内各层休息座椅', nearbyHospital: '陕西省人民医院（约1.5公里）', desc: '"给我一天，还你千年"，馆藏丰富、室内参观无日晒。', tips: '免费票需提前预约；建议请讲解器慢听，每层中途休息。' },
  { id: 'xa02', city: '西安', name: '大雁塔·大慈恩寺', level: '中', accessible: false, crowd: '中', type: '历史古迹', walk: 1500, duration: '1.5小时', restPoint: '寺内树荫座椅', nearbyHospital: '交大一附院（约2公里）', desc: '唐长安标志性建筑，寺内庭院清幽，塔身可不登。', tips: '登塔台阶多，长辈可在塔下广场活动、看喷泉。' },
  { id: 'xa03', city: '西安', name: '回民街', level: '低', accessible: true, crowd: '高', type: '美食体验', walk: 1200, duration: '2小时', restPoint: '街边小吃店可随时休息', nearbyHospital: '西安市第一医院（约1公里）', desc: '西安特色美食街，牛羊肉泡馍、甑糕等老字号云集。', tips: '人多拥挤建议错峰，注意忌口、少食油腻。' },
  { id: 'xa04', city: '西安', name: '曲江池遗址公园', level: '低', accessible: true, crowd: '低', type: '自然风光', walk: 2000, duration: '2小时', restPoint: '环湖座椅充足', nearbyHospital: '曲江新区医院（约1公里）', desc: '盛唐气象的开放式公园，水面开阔、步道平缓，适合散步。', tips: '免费开放，傍晚凉爽，适合晚餐后慢走。' },
  { id: 'xa05', city: '西安', name: '大唐不夜城', level: '低', accessible: true, crowd: '高', type: '民俗文化', walk: 1500, duration: '1.5小时', restPoint: '街区多处休息亭', nearbyHospital: '西安市第一医院（约2公里）', desc: '唐风步行街，灯光璀璨、演艺丰富，夜间热闹。', tips: '晚上人多，可只看一段并随时休息，避免全程步行。' },
  { id: 'xa06', city: '西安', name: '西安城墙（南门段）', level: '中', accessible: false, crowd: '中', type: '历史古迹', walk: 1200, duration: '1.5小时', restPoint: '城楼处有休息区', nearbyHospital: '西安市第四医院（约1公里）', desc: '中国现存最完整古城墙，南门段坡度平缓，可步行或乘电瓶车。', tips: '建议只走南门一小段，或乘景区电瓶车观景。' },
  { id: 'xa07', city: '西安', name: '碑林博物馆', level: '低', accessible: true, crowd: '低', type: '室内场馆', walk: 1000, duration: '2小时', restPoint: '馆内休息座椅', nearbyHospital: '西安市第四医院（约1公里）', desc: '书法艺术宝库，室内凉爽安静，人少清幽。', tips: '适合喜爱书法、安静环境的长辈，节奏自由。' },

  // ===== 南京 =====
  { id: 'nj01', city: '南京', name: '夫子庙·秦淮河', level: '低', accessible: true, crowd: '高', type: '民俗文化', walk: 1500, duration: '2小时', restPoint: '河畔长廊座椅', nearbyHospital: '南京市第一医院（约1公里）', desc: '六朝烟水气，秦淮河畔看灯影桨声，老街氛围浓厚。', tips: '夜游人多，建议傍晚前到达，河畔茶座歇脚。' },
  { id: 'nj02', city: '南京', name: '南京博物院', level: '低', accessible: true, crowd: '中', type: '室内场馆', walk: 2500, duration: '3小时', restPoint: '馆内多处休息区', nearbyHospital: '东部战区总医院（约2公里）', desc: '一院六馆，馆藏浩如烟海，室内参观不受天气影响。', tips: '免费预约，建议挑 1-2 个馆细看，每小时坐下歇脚。' },
  { id: 'nj03', city: '南京', name: '玄武湖公园', level: '低', accessible: true, crowd: '中', type: '自然风光', walk: 2000, duration: '2小时', restPoint: '环湖长椅密集', nearbyHospital: '东南大学附属中大医院（约1.5公里）', desc: '金陵明珠，湖面开阔、绿柳成荫，环湖步道平缓。', tips: '可乘游船，或只走湖东一小段，边走边歇。' },
  { id: 'nj04', city: '南京', name: '总统府', level: '中', accessible: false, crowd: '高', type: '历史古迹', walk: 2000, duration: '2小时', restPoint: '园内长廊座椅', nearbyHospital: '江苏省人民医院（约1公里）', desc: '近代史缩影，中西合璧建筑群，庭院清雅。', tips: '参观路线较长，可只走中轴线，带折叠凳歇脚。' },
  { id: 'nj05', city: '南京', name: '老门东', level: '低', accessible: true, crowd: '中', type: '民俗文化', walk: 1000, duration: '1.5小时', restPoint: '街巷小吃店可休息', nearbyHospital: '南京市第一医院（约1公里）', desc: '金陵老城南风貌街区，青砖黛瓦、小吃云集，节奏悠闲。', tips: '比夫子庙人少，适合慢慢逛、随时进店歇脚。' },
  { id: 'nj06', city: '南京', name: '侵华日军南京大屠杀遇难同胞纪念馆', level: '低', accessible: true, crowd: '中', type: '室内场馆', walk: 1500, duration: '2小时', restPoint: '馆内休息区', nearbyHospital: '南京市第一医院（约1公里）', desc: '铭记历史的庄重场所，室内参观、路线平缓。', tips: '请保持肃静，体力有限者可在休息区多次停留。' },
  { id: 'nj07', city: '南京', name: '明孝陵', level: '中', accessible: false, crowd: '低', type: '历史古迹', walk: 2000, duration: '2小时', restPoint: '神道沿线座椅', nearbyHospital: '东部战区总医院（约3公里）', desc: '世界文化遗产，神道石像生古朴庄重，林荫清凉。', tips: '神道较长，可乘景区观光车到核心区再慢行。' },

  // ===== 成都 =====
  { id: 'cd01', city: '成都', name: '宽窄巷子', level: '低', accessible: true, crowd: '高', type: '民俗文化', walk: 1200, duration: '1.5小时', restPoint: '巷内茶馆可歇脚', nearbyHospital: '成都市第三人民医院（约1公里）', desc: '成都慢生活名片，老院落、茶馆、小吃，节奏巴适。', tips: '找个茶馆喝盖碗茶坐一坐，就是最好的游览方式。' },
  { id: 'cd02', city: '成都', name: '人民公园', level: '低', accessible: true, crowd: '中', type: '自然风光', walk: 1000, duration: '1.5小时', restPoint: '鹤鸣茶社座椅充足', nearbyHospital: '成都市第三人民医院（约1公里）', desc: '成都人喝茶摆龙门阵的地方，采耳、喝茶、看报，悠闲惬意。', tips: '鹤鸣茶社喝杯茶、歇歇脚，感受成都式慢生活。' },
  { id: 'cd03', city: '成都', name: '成都博物馆', level: '低', accessible: true, crowd: '中', type: '室内场馆', walk: 1800, duration: '2.5小时', restPoint: '馆内休息座椅', nearbyHospital: '成都市第一人民医院（约1.5公里）', desc: '天府文化集中展示，皮影、蜀锦特色展馆，室内舒适。', tips: '免费预约，二层皮影馆很有味道，适合长辈细看。' },
  { id: 'cd04', city: '成都', name: '武侯祠', level: '中', accessible: false, crowd: '中', type: '历史古迹', walk: 1500, duration: '1.5小时', restPoint: '祠内庭院座椅', nearbyHospital: '成都市第三人民医院（约1公里）', desc: '三国文化圣地，红墙竹影、古柏森森，气氛庄重清幽。', tips: '与锦里相邻，可安排在上午，午后入锦里歇脚。' },
  { id: 'cd05', city: '成都', name: '锦里古街', level: '低', accessible: true, crowd: '高', type: '民俗文化', walk: 1000, duration: '1.5小时', restPoint: '街边小吃店、茶座', nearbyHospital: '成都市第三人民医院（约1公里）', desc: '三国主题民俗街，灯笼高挂、小吃繁多，热闹喜庆。', tips: '人多拥挤，注意防走失，建议家人同行慢逛。' },
  { id: 'cd06', city: '成都', name: '成都大熊猫繁育研究基地', level: '中', accessible: true, crowd: '高', type: '自然风光', walk: 3000, duration: '3小时', restPoint: '园区多处休息亭', nearbyHospital: '成都医学院附属医院（约3公里）', desc: '看国宝大熊猫，园区开阔，可乘观光车减少步行。', tips: '务必乘观光车，只看月亮产房等核心区，留足休息。' },

  // ===== 杭州 =====
  { id: 'hz01', city: '杭州', name: '西湖（白堤-断桥段）', level: '低', accessible: true, crowd: '高', type: '自然风光', walk: 1500, duration: '2小时', restPoint: '沿湖长椅密集', nearbyHospital: '浙一医院（约2公里）', desc: '人间天堂，平湖秋月、断桥残雪，步道平缓景致如画。', tips: '只走白堤一小段，累了就坐游船观景，风大注意添衣。' },
  { id: 'hz02', city: '杭州', name: '河坊街', level: '低', accessible: true, crowd: '中', type: '民俗文化', walk: 1000, duration: '1.5小时', restPoint: '街边茶座小吃店', nearbyHospital: '杭州市第一人民医院（约500米）', desc: '南宋御街风情，老字号药铺、丝绸、小吃，烟火市井。', tips: '与西湖邻近，可上午西湖、下午河坊街，节奏从容。' },
  { id: 'hz03', city: '杭州', name: '浙江省博物馆（孤山馆区）', level: '低', accessible: true, crowd: '低', type: '室内场馆', walk: 1200, duration: '2小时', restPoint: '馆内休息座椅', nearbyHospital: '浙江医院（约1公里）', desc: '西湖畔的博物馆，人少清静，越窑青瓷与雷峰塔文物可观。', tips: '紧邻西湖，参观完可就地漫步或乘电瓶车回程。' },
  { id: 'hz04', city: '杭州', name: '西溪国家湿地公园', level: '低', accessible: true, crowd: '中', type: '自然风光', walk: 1500, duration: '2.5小时', restPoint: '园区游船码头可歇', nearbyHospital: '省立同德医院（约3公里）', desc: '城市里的湿地水乡，乘船穿行芦苇荡，安静清幽。', tips: '建议乘船为主、少量步行，园内风大注意保暖。' },
  { id: 'hz05', city: '杭州', name: '雷峰塔', level: '中', accessible: true, crowd: '中', type: '历史古迹', walk: 1000, duration: '1.5小时', restPoint: '塔内有电梯、平台休息', nearbyHospital: '浙一医院（约3公里）', desc: '白蛇传传说地标，塔内有电梯可直达观景层，俯瞰西湖。', tips: '乘电梯登塔，老人无压力，傍晚看西湖落日最佳。' },
  { id: 'hz06', city: '杭州', name: '灵隐寺', level: '高', accessible: false, crowd: '高', type: '历史古迹', walk: 2000, duration: '2小时', restPoint: '寺内少量座椅', nearbyHospital: '浙江医院（约4公里）', desc: '千年古刹、飞来峰造像，登山台阶较多、体力消耗大。', tips: '腿脚不便者建议在寺前广场参拜，不登山、不进飞来峰。' },

  // ===== 青岛 =====
  { id: 'qd01', city: '青岛', name: '栈桥', level: '低', accessible: true, crowd: '高', type: '自然风光', walk: 800, duration: '1小时', restPoint: '回澜阁附近座椅', nearbyHospital: '市立医院（约1公里）', desc: '青岛地标，伸入海中的百年栈桥，看海鸥与海景。', tips: '风大注意保暖，走一小段即可，不必走到尽头。' },
  { id: 'qd02', city: '青岛', name: '五四广场', level: '低', accessible: true, crowd: '中', type: '自然风光', walk: 800, duration: '1小时', restPoint: '广场座椅充足', nearbyHospital: '青岛大学附属医院（约1.5公里）', desc: '"五月的风"雕塑与滨海广场，视野开阔，路面平整。', tips: '与奥帆中心相邻，傍晚散步看灯光最惬意。' },
  { id: 'qd03', city: '青岛', name: '八大关', level: '中', accessible: true, crowd: '低', type: '自然风光', walk: 2000, duration: '2小时', restPoint: '海边长椅多处', nearbyHospital: '青岛大学附属医院（约2公里）', desc: '万国建筑博览，林荫道与海景交融，人少清净。', tips: '路况平缓但范围大，走一段歇一段，或乘电瓶车。' },
  { id: 'qd04', city: '青岛', name: '青岛啤酒博物馆', level: '低', accessible: true, crowd: '中', type: '室内场馆', walk: 1200, duration: '2小时', restPoint: '馆内休息区、品酒吧', nearbyHospital: '市立医院（约1.5公里）', desc: '百年啤酒厂改造的博物馆，可了解青岛城市历史，室内凉爽。', tips: '赠送原浆一杯，浅尝即可，注意慢病忌口。' },
  { id: 'qd05', city: '青岛', name: '小鱼山公园', level: '中', accessible: false, crowd: '低', type: '自然风光', walk: 600, duration: '1小时', restPoint: '山顶平台座椅', nearbyHospital: '青大附院（约2公里）', desc: '登顶可观红瓦绿树、碧海蓝天全景，台阶不多。', tips: '山不高但有小台阶，膝部不适者可在山下远观。' },
  { id: 'qd06', city: '青岛', name: '奥帆中心', level: '低', accessible: true, crowd: '中', type: '自然风光', walk: 1000, duration: '1.5小时', restPoint: '海边步道座椅', nearbyHospital: '青大附院（约2公里）', desc: '奥运帆船赛场地，港湾游艇、海风习习，步道平整。', tips: '适合傍晚散步，与五四广场连成一线慢走。' }
];

// 老年出行科普知识库
const ELDERLY_TIPS = {
  diet: {
    common: ['饮食清淡、少油少盐，多吃易消化的食物', '外出就餐选择卫生条件好的老字号，避免生冷刺激', '随身带保温杯，少量多次喝水，不喝冰饮'],
    hypertension: ['控制盐摄入，少吃腌制、酱制食品', '避免浓茶、咖啡等刺激性饮品'],
    diabetes: ['定时定量进餐，随身带小糖果防低血糖', '主食粗细搭配，避免含糖饮料'],
    heart: ['避免过饱、油腻，七分饱即可', '随身携带急救药并告知同行家人']
  },
  weather: [
    '早晚温差大，随身带一件薄外套或围巾',
    '晴天注意防晒：遮阳帽、太阳镜、防晒霜',
    '雨天路面湿滑，穿防滑鞋，放慢脚步',
    '夏季高温时段（12-15点）尽量安排室内活动或午休',
    '冬季注意保暖，帽子、手套、护膝不可少'
  ],
  carry: [
    '常用药物及病历摘要、急救联系卡',
    '身份证、老年证（多数景区可减免门票）',
    '保温杯、折叠拐杖或助行器（如需）',
    '舒适防滑的鞋、充电宝、常用小零食'
  ],
  rest: [
    '行程中每日安排 1-2 次坐下歇脚的茶歇',
    '午后安排 30 分钟以上的午休或慢节奏活动',
    '景点之间预留充足的转场休息时间',
    '身体不适立即停下休息，就近寻找医院药店'
  ],
  medical: [
    '出发前确认行程沿途的医院、药店位置',
    '身体不适优先就近就医，勿勉强赶行程',
    '慢性病患者随身携带药品并保证按时服药'
  ]
};

module.exports = { CITIES, ATTRACTIONS, ELDERLY_TIPS };
