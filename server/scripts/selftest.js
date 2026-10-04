/**
 * selftest.js - 后端自测脚本（无需启动 HTTP 服务，直接验证业务链路）
 * 运行：node server/scripts/selftest.js
 *
 * 说明：自测必须是「确定性 + 零 token 消耗」的，因此这里显式清空 LLM_API_KEY，
 *      强制走「规则引擎 + 知识库」兜底分支。
 *      （config.js 加载 .env 时只在 process.env 未定义的情况下注入，显式置空即可屏蔽 server/.env）
 *      真实大模型的联通性请通过 HTTP 接口验证：GET /api/ai/status、POST /api/itinerary
 */
process.env.LLM_API_KEY = '';

const path = require('path');
const os = require('os');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'zykx-selftest-' + Date.now());

const agePolicy = require('../lib/agePolicy');
const knowledge = require('../lib/knowledge');
const rules = require('../lib/rulesEngine');
const planner = require('../lib/planner');
const gen = require('../lib/generator');
const dialogue = require('../lib/dialogue');
const ai = require('../lib/aiProvider');
const store = require('../lib/store');
const config = require('../config');

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log('  [通过] ' + name + (extra ? '  → ' + extra : ''));
  } else {
    fail += 1;
    console.log('  [失败] ' + name + (extra ? '  → ' + extra : ''));
  }
}
function head(t) { console.log('\n=== ' + t + ' ==='); }

(async function main() {
  console.log('智游康行·岁旅相伴 后端自测');
  console.log('知识库来源：' + knowledge.loadedFrom);
  console.log('大模型状态：' + (ai.isConfigured() ? '已配置' : '未配置（走规则引擎兜底，本次自测场景）'));

  head('1. 年龄段分流（4 组区间）');
  const g1 = agePolicy.buildFlowDecision('6-17');
  const g2 = agePolicy.buildFlowDecision('18-40');
  const g3 = agePolicy.buildFlowDecision('41-60');
  const g4 = agePolicy.buildFlowDecision('61+');
  check('6-17 → 通用流程', g1.mode === 'general' && g1.seniorFlow === false, g1.ageLabel);
  check('18-40 → 通用流程', g2.mode === 'general' && g2.seniorFlow === false, g2.ageLabel);
  check('41-60 → 适老化专项（自动大字体）', g3.seniorFlow === true && g3.fontScale > 1, 'fontScale=' + g3.fontScale);
  check('61+ → 适老化专项（自动大字体+高对比度）', g4.seniorFlow === true && g4.highContrast === true, 'fontScale=' + g4.fontScale);
  check('数字年龄 68 可解析为 61+', agePolicy.resolveAgeGroup(68).id === '61+', agePolicy.resolveAgeGroup(68).label);
  check('中文表述"61岁及以上"可解析', agePolicy.resolveAgeGroup('61岁及以上').id === '61+');
  check('适老字段清单非空', g4.requireFields.length >= 4, g4.requireFields.map((f) => f.label).join('/'));

  head('2. 规则引擎前置过滤（61+ 北京，1-3km，需慢行，无障碍）');
  const seniorProfile = planner.normalizeProfile({
    ageGroup: '61+', city: '北京', days: 3, budget: '舒适型',
    interests: ['历史古迹', '室内场馆'], mobility: '需慢行', chronic: ['高血压'],
    joints: '轻微不便', accessible: true, walkLimit: '1-3km', fillBy: '子女代填'
  });
  const filtered = rules.filterAttractions(seniorProfile, { crowdPref: false });
  console.log('  候选中：' + filtered.kept.map((s) => s.name).join('、'));
  console.log('  已剔除：' + filtered.removed.map((r) => r.spot.name + '（' + r.reason + '）').join('；'));
  check('存在候选景点', filtered.kept.length > 0, filtered.kept.length + ' 个');
  check('所有候选步行量不超过上限', filtered.kept.every((s) => s.walk <= 3000));
  check('所有候选均有无障碍配套', filtered.kept.every((s) => s.accessible === true));
  check('高体力景点被剔除（杭州·灵隐寺）', (function () {
    const hz = planner.normalizeProfile({ ageGroup: '61+', city: '杭州', days: 2, walkLimit: '3-5km', mobility: '完全自理' });
    const f = rules.filterAttractions(hz, {});
    return f.removed.some((r) => r.spot.name.indexOf('灵隐寺') >= 0 && r.reason.indexOf('高体力') >= 0);
  })(), '杭州 61+ 过滤结果');
  check('台阶多的景点被剔除', filtered.removed.some((r) => r.reason.indexOf('台阶') >= 0));
  check('单日景点数上限=2（需慢行）', rules.maxSpotsPerDay(seniorProfile, '61+') === 2);

  head('3. 适老行程生成（61+ 北京 3 天：规则引擎 + 兜底模板）');
  const r4 = await planner.planTrip({
    ageGroup: '61+',
    profile: {
      city: '北京', days: 3, interests: ['历史古迹'], mobility: '需慢行',
      chronic: ['高血压'], joints: '轻微不便', accessible: true, walkLimit: '1-3km', budget: '舒适型'
    }
  });
  check('返回 ok', r4.ok === true);
  check('seniorFlow=true', r4.seniorFlow === true);
  check('未配置 Key 时 llmUsed=false 且有降级原因', r4.llmUsed === false && !!r4.aiReason, r4.aiReason);
  check('行程天数=3', !!r4.plan && r4.plan.schedule.length === 3);
  check('每天都有休息/午餐/休整节点', r4.plan.schedule.every((d) => d.spots.some((s) => s.rest || s.meal || s.restDay)));
  check('单日景点数不超过 2', r4.plan.schedule.every((d) => d.spots.filter((s) => !s.rest && !s.meal && !s.restDay).length <= 2));
  check('输出独立风险评估报告（5 维度）', !!(r4.plan.risk && r4.plan.risk.dimensions.length === 5 && r4.plan.risk.items.length > 0), '风险等级：' + r4.plan.risk.level);
  check('风险报告含剔除原因汇总', Array.isArray(r4.plan.risk.filters));
  check('输出中老年出行专属贴士', !!(r4.plan.tips && r4.plan.tips.personal.length > 0), r4.plan.tips.personal[0].slice(0, 26) + '…');
  check('慢病饮食贴士被引用', r4.plan.tips.diet.some((t) => t.indexOf('盐') >= 0));
  check('第 3 天为休整日（3 天以上每 3 天休整）', r4.plan.schedule[2].spots.some((s) => s.restDay));

  head('4. 通用行程生成（18-40 上海 4 天）');
  const r5 = await planner.planTrip({ ageGroup: '18-40', profile: { city: '上海', days: 4, interests: ['室内场馆'], budget: '舒适型' } });
  check('返回 ok', r5.ok === true);
  check('mode=general', r5.mode === 'general');
  check('行程天数=4', r5.plan.schedule.length === 4);
  check('通用贴士（非适老）', r5.plan.tips.mode === 'general');
  check('城市未收录时给出优雅降级', (await planner.planTrip({ ageGroup: '61+', profile: { city: '测试城市不存在', days: 2 } })).plan.meta.noCandidates === true);

  head('5. 多轮对话（未配置 Key → 关键词规则兜底）');
  const d1 = await dialogue.dialogueReply([{ role: 'user', content: '走得太累了，能不能多安排休息' }], r4.plan);
  check('识别 increase_rest 意图', d1.action === 'increase_rest', d1.reply.slice(0, 18) + '…');
  const d2 = await dialogue.dialogueReply([{ role: 'user', content: '老人家膝盖不好，减少走路吧' }], r4.plan);
  check('识别 reduce_walk 意图', d2.action === 'reduce_walk');
  const d3 = await dialogue.dialogueReply([{ role: 'user', content: '万一下雨怎么办' }], r4.plan);
  check('识别 change_indoor 意图', d3.action === 'change_indoor');
  check('对话返回调整后的行程', !!d1.plan && d1.plan.schedule.length === r4.plan.schedule.length);

  head('6. 快捷按钮调整（纯规则引擎，确定性）');
  const a1 = gen.adjustPlan(r4.plan, 'increase_rest');
  check('增加休息：休息节点不减少', a1.schedule.filter((d) => d.spots.some((s) => s.rest)).length >= r4.plan.schedule.filter((d) => d.spots.some((s) => s.rest)).length);
  const a2 = gen.adjustPlan(r4.plan, 'reduce_walk');
  check('减少步行：单点步行量受控', a2.schedule.every((d) => d.spots.filter((s) => !s.rest && !s.meal && !s.restDay).every((s) => (s.walk || 0) <= 3000)));
  const a3 = gen.adjustPlan(r4.plan, 'avoid_crowd');
  check('避开人流：无高人流景点', a3.schedule.every((d) => d.spots.filter((s) => !s.rest && !s.meal && !s.restDay).every((s) => s.crowd !== '高')));
  const a4 = gen.adjustPlan(r4.plan, 'change_indoor');
  check('换室内景点：行程结构完整', a4.schedule.length === r4.plan.schedule.length);
  check('调整后重新计算风险评估', !!a4.risk && a4.risk.dimensions.length === 5);

  head('7. 方案持久化（保存/列表/详情/删除）');
  const s1 = store.save(r4.plan, { openid: 'test_openid' });
  check('保存成功返回 id', !!s1.id, s1.id);
  const list1 = store.list('test_openid');
  check('列表可查到且风险等级正确', list1.length === 1 && list1[0].risk === r4.plan.risk.level, 'risk=' + list1[0].risk);
  const got = store.get(s1.id, 'test_openid');
  check('详情含完整行程', !!got && got.schedule.length === 3);
  check('用户间数据隔离', store.list('other_openid').length === 0);
  const del = store.remove(s1.id, 'test_openid');
  check('删除成功', del === true && store.list('test_openid').length === 0);

  head('8. 无 Key 场景下的 AI 接口行为');
  let aiErr = null;
  try {
    await ai.chat([{ role: 'user', content: 'hi' }]);
  } catch (e) {
    aiErr = e;
  }
  check('未配置 Key 时 chat() 抛出 AI_NOT_CONFIGURED', !!aiErr && aiErr.code === 'AI_NOT_CONFIGURED');
  const st = ai.getStatus();
  check('AI 状态返回未配置 + 配置指引', st.configured === false && st.hint.indexOf('LLM_API_KEY') >= 0);
  check('预留接口方法齐全', typeof ai.chat === 'function' && typeof ai.chatJson === 'function' &&
    typeof ai.withFallback === 'function' && typeof ai.getStatus === 'function');

  head('9. 大模型协议适配（chat / responses 双协议）');
  const cfgArk = { model: 'doubao-seed-evolving', protocol: 'responses', temperature: 0.6, maxTokens: 16384 };
  const rp = ai.buildResponsesPayload([
    { role: 'system', content: '系统人设' },
    { role: 'user', content: '北京三天怎么玩' }
  ], {}, cfgArk);
  check('responses：system 消息 → 顶层 instructions', rp.instructions === '系统人设');
  check('responses：用户消息 → input 内容块', rp.input.length === 1 && rp.input[0].content[0].type === 'input_text');
  check('responses：使用 max_output_tokens（不是 max_tokens）',
    rp.max_output_tokens === 16384 && rp.max_tokens === undefined);
  check('responses：json 选项 → text.format', ai.buildResponsesPayload([], { json: true }, cfgArk).text.format.type === 'json_object');
  check('responses：thinking=disabled 写入请求体',
    ai.buildResponsesPayload([], {}, Object.assign({}, cfgArk, { thinking: 'disabled' })).thinking.type === 'disabled');
  check('responses：thinking=off 时不发送该字段',
    ai.buildResponsesPayload([], {}, Object.assign({}, cfgArk, { thinking: 'off' })).thinking === undefined);
  const cp = ai.buildChatPayload([{ role: 'user', content: 'hi' }], { json: true }, { model: 'qwen-max', protocol: 'chat', temperature: 0.6, maxTokens: 4096 });
  check('chat：使用 max_tokens 与 response_format',
    cp.max_tokens === 4096 && cp.response_format.type === 'json_object' && cp.messages.length === 1);
  check('协议 → 请求地址（responses）',
    ai.endpointOf({ baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/', protocol: 'responses' }) === 'https://ark.cn-beijing.volces.com/api/v3/responses');
  check('协议 → 请求地址（chat）',
    ai.endpointOf({ baseUrl: 'https://api.deepseek.com/v1', protocol: 'chat' }) === 'https://api.deepseek.com/v1/chat/completions');

  // 夹具取自火山方舟 /responses 真实返回结构（含 reasoning 思维链项）
  const arkResp = {
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [{ type: 'summary_text', text: '思考中…' }], encrypted_content: 'xxx' },
      { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"title":"北京慢游"}' }] }
    ]
  };
  check('responses：跳过思维链、只取 message 正文', ai.extractContent(arkResp, 'responses') === '{"title":"北京慢游"}');
  check('responses：顶层 output_text 优先', ai.extractContent({ output_text: '直接给' }, 'responses') === '直接给');
  check('responses：被截断时给出明确报错', (function () {
    try {
      ai.extractContent({ status: 'incomplete', incomplete_details: { reason: 'length' }, output: [{ type: 'reasoning' }] }, 'responses');
      return false;
    } catch (e) { return e.code === 'AI_OUTPUT_TRUNCATED'; }
  })());
  check('chat：取 choices[0].message.content',
    ai.extractContent({ choices: [{ message: { content: '你好', reasoning_content: '思考' } }] }, 'chat') === '你好');
  check('chat：只有 reasoning_content 时提示额度不足', (function () {
    try {
      ai.extractContent({ choices: [{ message: { reasoning_content: '思考' } }] }, 'chat');
      return false;
    } catch (e) { return e.code === 'AI_OUTPUT_TRUNCATED'; }
  })());
  check('错误体解析（方舟 {"error":{"message":...}}）',
    ai.extractError(401, '{"error":{"message":"invalid api key"}}').indexOf('invalid api key') >= 0);
  check('厂商别名 doubao → ark', config.PROVIDER_ALIAS.doubao === 'ark');
  check('LLM_PROTOCOL 默认 auto 时跟随厂商预设',
    config.PROTOCOLS.indexOf(config.AI.protocol) >= 0, '当前协议=' + config.AI.protocol);

  console.log('\n==========================================');
  console.log('自测结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  console.log('==========================================');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('自测异常：', e);
  process.exit(1);
});
