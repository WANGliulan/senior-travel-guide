/**
 * routes.js - 所有 HTTP 接口路由
 *
 * 约定：返回结构与微信云函数保持一致，统一为 { ok: true, ... } / { ok: false, error }
 * 这样小程序端同一套 utils/api.js 可以无缝切换「公网 HTTP 后端 / 云函数 / 本地模拟」三种数据源。
 */
const config = require('./config');
const ai = require('./lib/aiProvider');
const agePolicy = require('./lib/agePolicy');
const knowledge = require('./lib/knowledge');
const rules = require('./lib/rulesEngine');
const gen = require('./lib/generator');
const planner = require('./lib/planner');
const dialogue = require('./lib/dialogue');
const store = require('./lib/store');
const http = require('./lib/http');
const homePage = require('./lib/homePage');

const STARTED_AT = new Date().toISOString();

// ---------- 首页：浏览器可直接访问的服务说明（满足大赛公网可访问评审条件） ----------
function home(req, res, body, ctx) {
  const html = homePage.render(ai.getStatus(), knowledge, ctx.baseUrl);
  http.sendHtml(req, res, 200, html);
}

// ---------- 健康检查 ----------
function health(req, res) {
  const st = ai.getStatus();
  http.sendJson(req, res, 200, {
    ok: true,
    service: 'zhiyou-kangxing-server',
    version: homePage.VERSION,
    startedAt: STARTED_AT,
    uptimeSec: Math.round(process.uptime()),
    aiConfigured: st.configured,
    aiProvider: st.provider,
    aiModel: st.model,
    knowledge: {
      regions: knowledge.CITIES.length,
      attractions: knowledge.ATTRACTIONS.length,
      loadedFrom: knowledge.loadedFrom
    }
  });
}

// ---------- ★ AI 接口状态 ----------
function aiStatus(req, res) {
  http.sendJson(req, res, 200, Object.assign({ ok: true }, ai.getStatus()));
}

// ---------- ★ AI 对话接口（预留；未配置 Key 返回 503 + 明确指引） ----------
async function aiChat(req, res, body) {
  const messages = body && body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw http.httpError(400, 'messages 不能为空', 'BAD_REQUEST');
  }
  if (!ai.isConfigured()) {
    http.sendJson(req, res, 503, {
      ok: false,
      code: 'AI_NOT_CONFIGURED',
      error: '大模型 API Key 未配置',
      hint: '请在 server/.env 或云平台环境变量中设置 LLM_PROVIDER / LLM_API_KEY / LLM_MODEL 后重启服务。' +
        '未配置期间 /api/itinerary 与 /api/dialogue 会自动使用「规则引擎 + 知识库」兜底，全流程功能完整。',
      configured: false,
      provider: config.AI.provider,
      baseUrl: config.AI.baseUrl,
      model: config.AI.model
    });
    return;
  }
  const content = await ai.chat(messages.slice(-20), {
    temperature: body.temperature,
    maxTokens: body.maxTokens
  });
  http.sendJson(req, res, 200, {
    ok: true,
    provider: config.AI.provider,
    model: config.AI.model,
    content: content
  });
}

// ---------- 地区板块 ----------
function cities(req, res) {
  http.sendJson(req, res, 200, { ok: true, regions: knowledge.CITIES });
}

// ---------- 年龄段选项 ----------
function ageGroups(req, res) {
  http.sendJson(req, res, 200, {
    ok: true,
    groups: agePolicy.AGE_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      short: g.short,
      min: g.min,
      max: g.max,
      mode: g.mode,
      seniorFlow: g.mode === 'senior',
      fontScale: g.fontScale
    })),
    seniorFields: agePolicy.SENIOR_FIELDS
  });
}

// ---------- 年龄段 → 流程分流决策 ----------
function ageResolve(req, res, body) {
  const decision = agePolicy.buildFlowDecision((body && (body.ageGroup || body.age)) || '');
  http.sendJson(req, res, 200, Object.assign({ ok: true }, decision));
}

// ---------- 规则引擎前置过滤（透明展示"为什么剔除这些景点"） ----------
function attractions(req, res, body) {
  const b = body || {};
  const raw = Object.assign({}, b.profile || b, {
    ageGroup: b.ageGroup || (b.profile && b.profile.ageGroup)
  });
  const profile = planner.normalizeProfile(raw);
  if (!profile.city) throw http.httpError(400, '缺少城市（city）', 'BAD_REQUEST');
  const filtered = rules.filterAttractions(profile, { crowdPref: !!b.crowdPref });
  http.sendJson(req, res, 200, {
    ok: true,
    ageGroup: profile.ageGroup,
    seniorFlow: agePolicy.isSeniorFlow(profile.ageGroup),
    candidateCount: filtered.kept.length,
    candidates: filtered.kept.map((s) => ({
      name: s.name,
      type: s.type,
      level: s.level,
      stairs: s.stairs,
      walk: s.walk,
      duration: s.duration,
      accessible: s.accessible,
      crowd: s.crowd,
      restPoint: s.restPoint,
      nearbyHospital: s.nearbyHospital,
      description: s.desc,
      tips: s.tips
    })),
    removedCount: filtered.removed.length,
    removed: filtered.removed.map((r) => ({ name: r.spot.name, reason: r.reason, rule: r.rule })),
    filterSummary: rules.summarizeRemoved(filtered.removed)
  });
}

// ---------- 生成行程（核心接口） ----------
async function itinerary(req, res, body) {
  const result = await planner.planTrip({
    ageGroup: body && body.ageGroup,
    profile: body && body.profile,
    crowdPref: !!(body && body.crowdPref)
  });
  if (!result.ok) {
    http.sendJson(req, res, 400, result);
    return;
  }
  http.sendJson(req, res, 200, result);
}

// ---------- 多轮会话调整 ----------
async function dialogueRoute(req, res, body) {
  const messages = (body && body.messages) || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    throw http.httpError(400, 'messages 不能为空', 'BAD_REQUEST');
  }
  // 身体约束：前端可只传 ageGroup，其余从当前行程回填
  const profile = Object.assign(
    {},
    (body && body.plan && body.plan.profile) || {},
    (body && body.profile) || {},
    { ageGroup: (body && (body.ageGroup || (body.profile && body.profile.ageGroup))) || undefined }
  );
  const result = await dialogue.dialogueReply(messages, (body && body.plan) || null, { profile: profile });
  http.sendJson(req, res, 200, {
    ok: true,
    reply: result.reply,
    action: result.action,
    plan: result.plan,
    llmUsed: result.viaAI
  });
}

// ---------- 快捷调整按钮（纯规则引擎） ----------
function adjust(req, res, body) {
  const action = body && body.action;
  const plan = body && body.plan;
  if (gen.ADJUST_ACTIONS.indexOf(action) < 0) {
    throw http.httpError(400, '不支持的调整动作：' + action, 'BAD_ACTION');
  }
  if (!plan) throw http.httpError(400, '缺少当前行程（plan）', 'BAD_REQUEST');
  http.sendJson(req, res, 200, {
    ok: true,
    action: action,
    label: gen.ACTION_LABEL[action] || action,
    plan: gen.adjustPlan(plan, action)
  });
}

// ---------- 方案服务 ----------
function plans(req, res, body) {
  const b = body || {};
  const action = b.action || 'list';
  const openid = b.openid || (req.headers && req.headers['x-openid']) || 'anonymous';

  if (action === 'save') {
    if (!b.plan || !b.plan.city) throw http.httpError(400, '行程数据不完整', 'BAD_REQUEST');
    const r = store.save(b.plan, { id: b.id, openid: openid });
    http.sendJson(req, res, 200, { ok: true, id: r.id, updated: r.updated });
    return;
  }
  if (action === 'list') {
    http.sendJson(req, res, 200, { ok: true, list: store.list(openid) });
    return;
  }
  if (action === 'get') {
    const plan = store.get(b.id, openid);
    if (!plan) throw http.httpError(404, '未找到该方案', 'NOT_FOUND');
    http.sendJson(req, res, 200, { ok: true, plan: plan });
    return;
  }
  if (action === 'delete') {
    const done = store.remove(b.id, openid);
    http.sendJson(req, res, 200, { ok: done, deleted: done, id: b.id });
    return;
  }
  throw http.httpError(400, '未知操作：' + action, 'BAD_ACTION');
}

/**
 * 路由表
 * method + path → handler(req, res, body, ctx)
 * ctx: { baseUrl }
 */
const ROUTES = [
  { method: 'GET', path: '/', handler: home },
  { method: 'GET', path: '/api', handler: home },
  { method: 'GET', path: '/api/health', handler: health },
  { method: 'GET', path: '/api/ai/status', handler: aiStatus },
  { method: 'POST', path: '/api/ai/chat', handler: aiChat },
  { method: 'GET', path: '/api/cities', handler: cities },
  { method: 'GET', path: '/api/age-groups', handler: ageGroups },
  { method: 'POST', path: '/api/age/resolve', handler: ageResolve },
  { method: 'POST', path: '/api/attractions', handler: attractions },
  { method: 'POST', path: '/api/itinerary', handler: itinerary },
  { method: 'POST', path: '/api/dialogue', handler: dialogueRoute },
  { method: 'POST', path: '/api/adjust', handler: adjust },
  { method: 'POST', path: '/api/plans', handler: plans },
  // 兼容别名：与小程序云函数名称保持一致，便于前端一套代码两种后端切换
  { method: 'POST', path: '/api/plan', handler: plans }
];

module.exports = { ROUTES, VERSION: homePage.VERSION, STARTED_AT };
