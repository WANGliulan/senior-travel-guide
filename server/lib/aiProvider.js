/**
 * aiProvider.js - ★★ 大模型 API 统一接入层（预留接口）
 * ============================================================================
 * 【这个文件就是"接入 AI 的接口"，拿到 API Key 后无需改动任何业务代码。】
 *
 * 接入三步：
 *   1. 复制 server/.env.example 为 server/.env（或云平台「环境变量」中配置）：
 *        LLM_PROVIDER=dashscope        # 厂商：dashscope/openai/deepseek/moonshot/zhipu/custom
 *        LLM_API_KEY=<你的 API Key>    # ★ 当前留空
 *        LLM_BASE_URL=                 # 可留空用厂商默认；私有化部署时填自建地址
 *        LLM_MODEL=                    # 可留空用厂商默认
 *   2. 访问 GET /api/ai/status 确认 configured=true；
 *   3. 行程生成 / 多轮对话即自动由大模型产出。
 *
 * 未配置 Key 时的行为：
 *   - chat() 抛出 { code: 'AI_NOT_CONFIGURED' }；上层自动回退「规则引擎 + 知识库」
 *     兜底方案，全流程功能完整、演示不中断（这正是混合智能体架构的设计）。
 *   - GET /api/ai/status 明确返回 configured:false 与配置指引，便于评审查看。
 *
 * 协议：所有厂商统一走 OpenAI 兼容的 POST {baseUrl}/chat/completions。
 * 依赖：仅 Node 内置 http/https（零第三方依赖）。
 * ============================================================================
 */
const http = require('http');
const https = require('https');
const config = require('../config');

// 运行期状态：用于 /api/ai/status 展示（不记录任何 Key 内容）
const state = {
  lastCallAt: '',
  lastOk: null,
  lastError: '',
  lastLatencyMs: 0,
  callCount: 0,
  successCount: 0,
  fallbackCount: 0
};

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

/** 是否已配置 API Key（未配置则走规则引擎兜底） */
function isConfigured() {
  return !!config.AI.apiKey;
}

/** 当前 AI 配置状态（供 /api/ai/status 与前端展示） */
function getStatus() {
  const cfg = config.AI;
  return {
    configured: isConfigured(),
    provider: cfg.provider,
    providerLabel: cfg.providerLabel,
    model: cfg.model,
    protocol: cfg.protocol,
    endpoint: endpointOf(cfg),
    thinking: cfg.thinking,
    baseUrl: cfg.baseUrl,
    apiKeyMasked: maskKey(cfg.apiKey),
    timeout: cfg.timeout,
    maxTokens: cfg.maxTokens,
    stats: Object.assign({}, state),
    hint: isConfigured()
      ? '大模型已启用（' + cfg.providerLabel + ' · ' + cfg.model + ' · ' + cfg.protocol + ' 协议），行程生成与多轮对话由大模型产出。'
      : '★★ 尚未配置大模型 API Key：当前自动使用「规则引擎 + 知识库」兜底，功能完整。' +
        ' 配置环境变量 LLM_PROVIDER / LLM_API_KEY / LLM_MODEL 后重启服务即可启用大模型。'
  };
}

function aiError(message, code) {
  const err = new Error(message);
  err.code = code || 'AI_ERROR';
  return err;
}

/** 底层 HTTP POST JSON（仅用内置模块，兼容 Node 16+） */
function postJson(urlStr, payload, timeoutMs, headers) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(urlStr);
    } catch (e) {
      reject(aiError('LLM_BASE_URL 不是合法地址：' + urlStr, 'AI_BAD_BASE_URL'));
      return;
    }
    const transport = urlObj.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = transport.request(
      {
        method: 'POST',
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname.replace(/\/+$/, '') + urlObj.search,
        headers: Object.assign(
          {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          },
          headers || {}
        )
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', (e) => reject(aiError('大模型请求失败：' + e.message, 'AI_NETWORK_ERROR')));
    req.setTimeout(timeoutMs || config.AI.timeout, () => {
      req.destroy(aiError('大模型请求超时（' + (timeoutMs || config.AI.timeout) + 'ms）', 'AI_TIMEOUT'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * 把统一的 messages 数组转成 Responses 协议的 input
 * Responses 协议用顶层 instructions 承载系统提示词，其余消息放进 input，正文用内容块表达。
 */
function splitSystem(messages) {
  const system = [];
  const input = [];
  (messages || []).forEach((m) => {
    const msg = m || {};
    const role = msg.role === 'assistant' ? 'assistant' : (msg.role === 'system' ? 'system' : 'user');
    const text = String(msg.content === undefined || msg.content === null ? '' : msg.content);
    if (!text) return;
    if (role === 'system') {
      system.push(text);
      return;
    }
    input.push({ role: role, content: [{ type: 'input_text', text: text }] });
  });
  return { instructions: system.join('\n\n'), input: input };
}

/** 构造 chat/completions 请求体（OpenAI 兼容协议） */
function buildChatPayload(messages, opts, cfg) {
  const o = opts || {};
  const payload = {
    model: o.model || cfg.model,
    messages: messages,
    temperature: o.temperature === undefined ? cfg.temperature : o.temperature,
    max_tokens: o.maxTokens || cfg.maxTokens,
    stream: false
  };
  if (o.json) payload.response_format = { type: 'json_object' };
  return payload;
}

/** 构造 responses 请求体（火山方舟 /responses 协议，已实测兼容 instructions 与 text.format） */
function buildResponsesPayload(messages, opts, cfg) {
  const o = opts || {};
  const s = splitSystem(messages);
  const payload = {
    model: o.model || cfg.model,
    input: s.input,
    temperature: o.temperature === undefined ? cfg.temperature : o.temperature,
    max_output_tokens: o.maxTokens || cfg.maxTokens
  };
  if (s.instructions) payload.instructions = s.instructions;
  if (o.json) payload.text = { format: { type: 'json_object' } };
  // 思维链开关（豆包推理模型）：disabled 时可将一次行程生成从约 100s 降至约 4s
  if (cfg.thinking && cfg.thinking !== 'off') payload.thinking = { type: cfg.thinking };
  // 注：不传 stream（默认即为非流式），避免个别网关对 stream:false 兼容性差异
  return payload;
}

/** 根据协议推导请求地址 */
function endpointOf(cfg) {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  return base + (cfg.protocol === 'responses' ? '/responses' : '/chat/completions');
}

/**
 * 从两种协议的响应体里提取正文文本
 * - chat/completions       → choices[0].message.content
 * - responses（方舟/豆包）  → output[] 中 type=message 的 content[].text
 *   （推理模型还会返回 type=reasoning 的思维链项，需跳过，只取 message）
 */
function extractContent(data, protocol) {
  if (!data) throw aiError('大模型返回内容为空', 'AI_EMPTY_CONTENT');

  if (protocol === 'responses') {
    if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
    const parts = [];
    (data.output || []).forEach((item) => {
      if (!item || item.type !== 'message') return;
      (item.content || []).forEach((c) => {
        if (c && (c.type === 'output_text' || c.type === 'text') && c.text) parts.push(c.text);
      });
    });
    if (parts.length) return parts.join('');
    const reason = data.incomplete_details && data.incomplete_details.reason;
    if (reason === 'length') {
      throw aiError(
        '大模型输出被截断：推理模型的思维链会占用输出额度，请调大环境变量 LLM_MAX_TOKENS（当前 ' +
        (config.AI.maxTokens || '') + '）后重试',
        'AI_OUTPUT_TRUNCATED'
      );
    }
    throw aiError('大模型返回内容为空（status=' + (data.status || 'unknown') + '）', 'AI_EMPTY_CONTENT');
  }

  const msg = data.choices && data.choices[0] && data.choices[0].message;
  if (!msg) throw aiError('大模型返回内容为空', 'AI_EMPTY_CONTENT');
  if (typeof msg.content === 'string' && msg.content.trim()) return msg.content;
  if (Array.isArray(msg.content)) {
    const text = msg.content.map((c) => (c && c.text) || '').join('');
    if (text.trim()) return text;
  }
  if (msg.reasoning_content) {
    throw aiError(
      '大模型只返回了思维链、未返回正文（输出额度不足），请调大环境变量 LLM_MAX_TOKENS 后重试',
      'AI_OUTPUT_TRUNCATED'
    );
  }
  throw aiError('大模型返回内容为空', 'AI_EMPTY_CONTENT');
}

/** 从错误响应体里提取可读信息（方舟返回 {"error":{"message":...}}） */
function extractError(status, body) {
  try {
    const j = JSON.parse(body);
    const e = j && j.error;
    if (e) return '大模型返回异常状态码 ' + status + '：' + (e.message || e.code || JSON.stringify(e));
  } catch (err) {
    /* 错误体不是 JSON，走下面的兜底 */
  }
  return '大模型返回异常状态码 ' + status + '：' + String(body || '').slice(0, 300);
}

/**
 * 调用大模型（非流式），返回正文文本。
 * 支持两种协议：chat/completions（OpenAI 兼容）与 responses（火山方舟豆包）。
 * @param {Array<{role:string,content:string}>} messages
 * @param {{temperature?:number,maxTokens?:number,timeout?:number,model?:string,json?:boolean}} [opts]
 * @returns {Promise<string>}
 */
async function chat(messages, opts) {
  const cfg = config.AI;
  if (!isConfigured()) {
    state.fallbackCount += 1;
    throw aiError(
      '大模型 API Key 未配置（请在 server/.env 或云平台环境变量中设置 LLM_API_KEY）',
      'AI_NOT_CONFIGURED'
    );
  }
  const o = opts || {};
  const url = endpointOf(cfg);
  // 按协议分别构造请求体：chat/completions（OpenAI 兼容）或 responses（方舟豆包）
  const payload = cfg.protocol === 'responses'
    ? buildResponsesPayload(messages, o, cfg)
    : buildChatPayload(messages, o, cfg);

  const started = Date.now();
  state.callCount += 1;
  state.lastCallAt = new Date().toISOString();
  try {
    const res = await postJson(
      url,
      payload,
      o.timeout || cfg.timeout,
      { Authorization: 'Bearer ' + cfg.apiKey }
    );
    state.lastLatencyMs = Date.now() - started;
    if (res.status !== 200) {
      const msg = extractError(res.status, res.body);
      state.lastOk = false;
      state.lastError = msg;
      throw aiError(msg, 'AI_HTTP_' + res.status);
    }
    let parsed;
    try {
      parsed = JSON.parse(res.body);
    } catch (e) {
      throw aiError('大模型返回内容不是合法 JSON', 'AI_BAD_RESPONSE');
    }
    const content = extractContent(parsed, cfg.protocol);
    state.lastOk = true;
    state.lastError = '';
    state.successCount += 1;
    return content;
  } catch (e) {
    state.lastLatencyMs = Date.now() - started;
    state.lastOk = false;
    if (e.code === 'AI_NOT_CONFIGURED') state.fallbackCount += 1;
    else state.lastError = e.message;
    throw e;
  }
}

/** 容错解析大模型输出的 JSON（兼容 ```json 包裹、前后废话、单对象/数组） */
function parseJson(content) {
  if (!content) return null;
  let text = String(content).trim();
  text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

/** 要求大模型返回 JSON 并解析（解析失败返回 null，由上层回退规则引擎） */
async function chatJson(messages, opts) {
  const content = await chat(messages, Object.assign({ json: true }, opts || {}));
  return parseJson(content);
}

/**
 * 统一入口：有 Key 就用大模型，无 Key / 调用失败则执行 fallback 回调。
 * 业务层推荐使用本函数，天然实现"大模型出内容、规则引擎兜底"的混合架构。
 * @param {Function|Array} buildMessages 生成 messages 的函数（延迟构造，未启用 AI 时零开销）
 * @param {Function} fallback 返回兜底结果的函数
 * @param {object} [opts]
 */
async function withFallback(buildMessages, fallback, opts) {
  if (!isConfigured()) {
    state.fallbackCount += 1;
    return { viaAI: false, reason: 'AI_NOT_CONFIGURED', data: await fallback() };
  }
  try {
    const messages = typeof buildMessages === 'function' ? buildMessages() : buildMessages;
    const content = await chat(messages, opts);
    return { viaAI: true, content: content, data: content };
  } catch (e) {
    return {
      viaAI: false,
      reason: e.code || 'AI_ERROR',
      message: e.message,
      data: await fallback()
    };
  }
}

module.exports = {
  isConfigured,
  getStatus,
  chat,
  chatJson,
  parseJson,
  withFallback,
  maskKey,
  endpointOf,
  // 以下为协议适配内部函数，导出以便自测脚本直接验证请求体与响应解析
  splitSystem,
  buildChatPayload,
  buildResponsesPayload,
  extractContent,
  extractError
};
