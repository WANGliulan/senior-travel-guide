/**
 * dialogue.js - 多轮会话迭代（自然语言调整行程）
 *
 * 混合策略：
 *   1) 已配置大模型 → 由智能体理解用户意图并给出回复，同时输出结构化 action；
 *   2) 未配置 Key / 调用失败 → 关键词规则兜底，同样能完成"增加休息/减少步行/换室内/避开人流"等调整；
 *   3) 无论走哪条路径，行程修改一律由规则引擎确定性执行（adjustPlan），大模型只负责"听懂"和"说话"。
 */
const ai = require('./aiProvider');
const gen = require('./generator');
const agePolicy = require('./agePolicy');
const knowledge = require('./knowledge');

// ---------- 智能体人设与知识注入 ----------
const ALL_CITIES = (knowledge.CITIES || []).reduce((acc, r) => acc.concat(r.cities || []), []);

/** 从最近几轮对话里识别城市（用户问"北京有什么好玩的"时，用来注入该城市的景点知识） */
function detectCity(messages) {
  const text = (messages || []).slice(-4).map((m) => String(m.content || '')).join(' ');
  const hits = ALL_CITIES.filter((c) => text.indexOf(c) >= 0).sort((a, b) => b.length - a.length);
  return hits[0] || '';
}

/** 老年出行科普知识库 → 提示词片段（贴士类问题照此回答，避免模型凭空编造） */
function tipsBlock() {
  const t = knowledge.ELDERLY_TIPS || {};
  const diet = ((t.diet && t.diet.common) || []).slice(0, 3);
  const chronic = [];
  if (t.diet) {
    if (t.diet.hypertension) chronic.push('高血压：' + t.diet.hypertension[0]);
    if (t.diet.diabetes) chronic.push('糖尿病：' + t.diet.diabetes[0]);
    if (t.diet.heart) chronic.push('心脏病：' + t.diet.heart[0]);
  }
  return [
    '- 休息：' + (t.rest || []).join('；'),
    '- 医疗：' + (t.medical || []).join('；'),
    '- 饮食：' + diet.concat(chronic).join('；'),
    '- 天气穿衣：' + (t.weather || []).join('；'),
    '- 随身物品：' + (t.carry || []).join('；')
  ].join('\n');
}

/** 城市景点知识 → 提示词片段（只允许引用库内景点，缓解幻觉） */
function cityBlock(city, senior) {
  if (!city) return '';
  const spots = knowledge.byCity(city).map((s) => knowledge.enrich(s));
  if (!spots.length) return '';
  const lines = spots.map((s) =>
    '- ' + s.name + '｜' + s.type + '｜体力' + s.level + '｜台阶' + s.stairs +
    '｜步行约' + s.walk + '米｜无障碍' + (s.accessible ? '有' : '无') +
    '｜人流' + s.crowd + '｜休息点：' + (s.restPoint || '无')
  );
  return '【' + city + ' 知识库景点（共 ' + spots.length + ' 个；回答时只能引用这些景点，不得编造）】\n' +
    lines.join('\n') +
    (senior ? '\n（该用户走适老化流程：高体力、台阶多、无无障碍配套的景点不要推荐）' : '');
}

/**
 * 组装系统提示词：人设 + 能力清单 + 用户身体约束 + 知识库 + 当前行程 + 输出格式
 * 说明：智能助手=聊天入口，这里决定它"会聊什么、怎么聊、有哪些依据"。
 */
function buildSystemPrompt(messages, profile, plan) {
  const group = agePolicy.resolveAgeGroup(profile.ageGroup);
  const senior = group.mode === 'senior';
  const city = detectCity(messages);
  const parts = [];

  parts.push('你是"智游康行·岁旅相伴"微信小程序里的旅游规划智能助手。' +
    '用户可能是长辈本人，也可能是帮长辈规划的子女。你的定位是"懂老年友好出行的旅行顾问"，不是只会套模板的机器人。');

  parts.push('【你可以做的事】\n' +
    '1) 像真人一样聊天、答疑，回答任何旅游相关问题（目的地、季节、交通、门票、礼仪、注意事项等）；\n' +
    '2) 结合下方知识库给出目的地建议、景点推荐与行程思路；\n' +
    '3) 给行前准备建议（休息节奏、常用药、饮食忌口、天气穿衣、随身物品、就近医疗）；\n' +
    '4) 解释平台规则：为什么某些景点被过滤掉、适老化流程怎么走、风险评估怎么读；\n' +
    '5) 引导用户生成正式行程（提示点击"生成行程"填写出行信息）；\n' +
    '6) 按用户要求调整已有行程。');

  parts.push('【回复风格】温和、耐心、口语化，多用短句与分点，不使用生僻词；面向长辈时避免专业术语。' +
    '默认控制在 250 字以内，用户明确要求详细展开时再放长；不要堆砌 emoji。');

  parts.push('【当前用户】年龄段：' + group.label + '（' + (senior ? '适老化专项流程' : '通用规划流程') + '）');
  if (senior) {
    parts.push('【身体约束·必须全程遵守，绝不推荐高强度、多台阶、长时间步行的安排】\n' +
      '- 行动能力：' + (profile.mobility || '未填写') + '\n' +
      '- 基础疾病：' + ((profile.chronic && profile.chronic.length) ? profile.chronic.join('、') : '无') + '\n' +
      '- 关节状况：' + (profile.joints || '未填写') + '\n' +
      '- 无障碍需求：' + (profile.accessible ? '需要无障碍通道/电梯' : '无特殊要求') + '\n' +
      '- 每日可承受步行上限：' + (profile.walkLimit || '未填写'));
  }

  if (plan) {
    parts.push('【当前行程】' + plan.title + '（' + plan.days + ' 天）\n' +
      (plan.schedule || []).map((d) => '第' + d.day + '天 ' + (d.spots || [])
        .filter((s) => !s.rest && !s.meal && !s.restDay)
        .map((s) => s.name).join('/')).join('；'));
  } else {
    parts.push('【当前行程】用户还没有生成行程。若用户在问目的地或"怎么玩"，先正常解答并给思路，' +
      '再建议他点击"生成行程"填写出行信息，以得到符合身体条件的正式方案。');
  }

  parts.push('【老年出行科普知识库（贴士类问题优先照此回答）】\n' + tipsBlock());
  const cb = cityBlock(city, senior);
  if (cb) parts.push(cb);

  parts.push('【输出格式】\n' +
    '1) 先输出给用户看的自然语言；\n' +
    '2) 若用户要求修改行程（增加休息、减少步行、换室内景点、避开人流），在最后单独一行输出 ' +
    '{"action":"increase_rest|reduce_walk|change_indoor|avoid_crowd"}；不需要修改时输出 {"action":"none"}；\n' +
    '3) 不要输出 Markdown 代码块；不要编造知识库以外的景点名称与设施，拿不准就直说。');

  return parts.join('\n\n');
}

const KEYWORD_ACTIONS = [
  { keys: ['休息', '歇脚', '太累', '慢一点', '节奏慢', '茶歇'], action: 'increase_rest', text: '好的，我已经为您增加了休息节点：每天在景点之间插入茶歇与午餐休息，单日景点适当精简，走一段就坐下歇一歇。' },
  { keys: ['步行', '走路', '少走', '腿脚', '走不动', '膝盖'], action: 'reduce_walk', text: '好的，我已经减少了步行量：优先保留低体力、步行少的景点，单日步行控制在您的上限以内。' },
  { keys: ['室内', '下雨', '天热', '怕晒', '太晒', '风大'], action: 'change_indoor', text: '好的，我已把户外强度较大的景点换成室内场馆（博物馆、展馆类），冬暖夏凉、坐着也能看。' },
  // ⚠️ 这里曾经用裸的 '人' 做关键词，导致"病 人""老 人"被误判为"避开人流"，已收紧
  { keys: ['人流', '人多', '拥挤', '排队', '太吵', '吵', '避开人多'], action: 'avoid_crowd', text: '好的，我已避开人流密集的景点，改选清静、有座椅的地方，建议错峰出行。' }
];

// 行动能力受限的各种说法（脑梗 / 中风 / 偏瘫 / 轮椅…）
const MOBILITY_KEYS = [
  '脑梗', '脑出血', '脑血栓', '中风', '偏瘫', '半身', '瘫痪',
  '轮椅', '搀扶', '搀着', '扶着', '拄拐', '拐杖', '助行器', '助行',
  '行动不便', '走不动', '走不了', '腿脚', '腿不利索', '膝盖', '关节', '刚能走', '勉强走', '站不稳'
];

function extractAction(content) {
  const text = String(content || '');
  const m = text.match(/"action"\s*:\s*"([a-z_]+)"/);
  if (m && gen.ADJUST_ACTIONS.indexOf(m[1]) >= 0) return m[1];
  return null;
}

/** 行动能力受限的选点建议（无行程 / 只是问推荐时使用） */
function mobilityAdvice(messages) {
  const city = detectCity(messages);
  const lines = [
    '按您说的行动还不太方便，选地方把握三点最要紧：',
    '· 全程平路无台阶、有无障碍通道或电梯；',
    '· 每个点 1 小时以内，随时能坐下歇脚；',
    '· 离医院近、打车方便，累了能马上回住处。'
  ];
  if (city) {
    const spots = knowledge.byCity(city)
      .map((s) => knowledge.enrich(s))
      .filter((s) => s.accessible && s.level !== '高' && s.stairs !== '多')
      .slice(0, 3);
    if (spots.length) {
      lines.push('');
      lines.push('【' + city + '】里符合这些条件的选择：');
      spots.forEach((s) => lines.push('· ' + s.name + '（' + s.type + '，步行约' + s.walk +
        '米，' + (s.restPoint || '有休息点') + '）'));
    }
  }
  lines.push('');
  lines.push('建议点击"生成行程"填写出行信息，把"行动能力"选为"需搀扶或轮椅"、"每日步行上限"选"1km以内"，' +
    '我会据此剔除台阶多、步行量大的景点，并额外给出行程风险评估与专属贴士。');
  return lines.join('\n');
}

/** 关键词规则兜底回复 */
function keywordReply(messages, plan) {
  const last = messages.length ? String(messages[messages.length - 1].content || '') : '';
  if (!last) return { reply: '您好，我是您的出行助手，有什么可以帮您调整行程的吗？', action: null };
  const mobilityHit = MOBILITY_KEYS.some((k) => last.indexOf(k) >= 0);

  // 行动能力受限且当前没有行程 → 直接给"怎么选地方"的可执行建议
  // （有行程时优先响应"调整行程"的明确诉求，见下方 KEYWORD_ACTIONS）
  if (mobilityHit && !plan) {
    return { reply: mobilityAdvice(messages), action: null };
  }

  for (let i = 0; i < KEYWORD_ACTIONS.length; i++) {
    const item = KEYWORD_ACTIONS[i];
    if (item.keys.some((k) => last.indexOf(k) >= 0)) {
      return { reply: item.text, action: item.action };
    }
  }
  if (/你好|您好|在吗|嗨/.test(last)) {
    return { reply: '您好！我是您的出行助手。您可以直接对我说「增加休息」「减少步行」「换室内景点」「避开人流」，我会立刻帮您调整行程。', action: null };
  }
  if (/行程|安排|几天|玩什么/.test(last) && plan) {
    return {
      reply: '您当前的行程是「' + (plan.title || plan.city + '行程') + '」，共 ' + plan.days + ' 天，' +
        (plan.risk && plan.risk.mode === 'senior' ? '已按慢节奏低负荷设计，每日穿插茶歇与午餐休息节点。' : '节奏适中，热门景点建议提前预约。') +
        '如需调整，请告诉我「增加休息 / 减少步行 / 换室内景点 / 避开人流」。',
      action: null
    };
  }
  if (/贴士|注意|忌口|准备什么|带什么|药品/.test(last)) {
    return {
      reply: '出行小贴士：① 休息——每天安排 1-2 次茶歇，午后适当午休；② 医疗——出发前确认沿途医院药店，慢病随身带药、按时服药；' +
        '③ 饮食——清淡少油盐，高血压少盐、糖尿病定时定量；④ 天气——早晚温差大带薄外套，雨天穿防滑鞋；' +
        '⑤ 随身——常用药+病历摘要+急救卡、身份证/老年证、保温杯、舒适防滑鞋。',
      action: null
    };
  }
  // 提到城市 → 直接用知识库给出可落地的推荐（无大模型时也有依据，不是空话）
  const city = detectCity(messages);
  if (city) {
    const spots = knowledge.byCity(city).map((s) => knowledge.enrich(s)).slice(0, 5);
    if (spots.length) {
      const list = spots.map((s) => s.name + '（' + s.type + '，体力' + s.level +
        '，步行约' + s.walk + '米' + (s.accessible ? '，有无障碍' : '') + '）');
      return {
        reply: '为您介绍【' + city + '】的推荐去处：\n· ' + list.join('\n· ') +
          '\n想让我按您的身体条件和天数排成正式行程吗？点击"生成行程"填写出行信息即可。',
        action: null
      };
    }
  }
  if (/你会什么|能做什么|怎么用|帮助|有什么功能|介绍一下自己/.test(last)) {
    return {
      reply: '我是您的旅游规划助手，可以：\n· 回答旅游问题、推荐目的地与景点\n' +
        '· 给您行前准备建议（休息、用药、饮食忌口、天气穿衣、随身物品）\n' +
        '· 生成符合身体条件的适老行程\n' +
        '· 按您的想法调整已有行程（增加休息 / 减少步行 / 换室内景点 / 避开人流）\n' +
        '您可以直接告诉我想去哪，或者点下方"生成行程"。',
      action: null
    };
  }
  if (/谢谢|感谢|辛苦/.test(last)) {
    return { reply: '不客气，能帮上您就好。祝您和家人旅途顺利，路上慢一些、多歇歇。', action: null };
  }
  // 提到行动不便但没匹配到具体调整诉求 → 给出选点建议
  if (mobilityHit) return { reply: mobilityAdvice(messages), action: null };
  return {
    reply: '我已收到您的想法。建议：每天上午安排主要游览、午后安排休息，景点之间预留充足转场时间。如需具体调整行程，请告诉我「增加休息 / 减少步行 / 换室内景点 / 避开人流」。',
    action: null
  };
}

/**
 * 多轮对话
 * @param {Array<{role:string,content:string}>} messages
 * @param {object} [plan] 当前行程
 * @param {{profile?:object}} [opts]
 * @returns {Promise<{reply:string, action:string|null, viaAI:boolean, plan:object|null}>}
 */
async function dialogueReply(messages, plan, opts) {
  const o = opts || {};
  // 身体约束：显式传入的优先，其余从当前行程回填（保证约束在多轮对话中持续生效）
  const profile = Object.assign({}, (plan && plan.profile) || {}, o.profile || {});
  const group = agePolicy.resolveAgeGroup(profile.ageGroup);
  const senior = group.mode === 'senior';

  const history = (messages || []).slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 800)
  }));

  // 智能助手的系统提示词：人设 + 能力 + 身体约束 + 知识库 + 当前行程 + 输出格式
  const sys = buildSystemPrompt(history, profile, plan);

  let reply = '';
  let viaAI = false;
  let action = null;

  if (ai.isConfigured()) {
    try {
      reply = await ai.chat([{ role: 'system', content: sys }].concat(history), {
        temperature: 0.7,
        timeout: 90000
      });
      viaAI = true;
      action = extractAction(reply);
      // 去掉末尾那一行 action JSON（含可能的空行）
      reply = reply.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '').replace(/\n{3,}/g, '\n\n').trim();
      if (!reply) reply = action ? '好的，行程已按您的要求更新。' : '收到，还有什么可以帮您？';
    } catch (e) {
      viaAI = false;
    }
  }

  if (!viaAI) {
    const fb = keywordReply(history, plan);
    reply = fb.reply;
    action = fb.action;
  }

  let updatedPlan = null;
  if (action && plan) updatedPlan = gen.adjustPlan(plan, action);

  return { reply: reply, action: action, viaAI: viaAI, plan: updatedPlan };
}

module.exports = { dialogueReply, keywordReply, extractAction, KEYWORD_ACTIONS, MOBILITY_KEYS, buildSystemPrompt, detectCity, tipsBlock, cityBlock };
