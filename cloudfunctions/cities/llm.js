/**
 * llm.js - 大模型智能体客户端（OpenAI 兼容接口）
 * 通过云函数环境变量配置：
 *   LLM_API_KEY   必填（无 key 时自动走规则引擎兜底模板生成）
 *   LLM_BASE_URL  默认 https://dashscope.aliyuncs.com/compatible-mode/v1
 *   LLM_MODEL     默认 qwen-max（可按需改为其他兼容模型）
 * 说明：所有调用均做 JSON 解析容错；解析失败返回 null，由上层走兜底逻辑。
 */
const https = require('https');

function postJson(urlObj, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request(urlObj, { method: 'POST' }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('LLM 请求超时'));
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

function getEnvConfig() {
  return {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.LLM_MODEL || 'qwen-max'
  };
}

// 调用 chat completions（非流式），返回 message.content 字符串；失败抛错
async function chat(messages, opts) {
  const cfg = getEnvConfig();
  if (!cfg.apiKey) throw new Error('LLM_API_KEY 未配置');
  const url = new URL(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions');
  const payload = {
    model: opts && opts.model ? opts.model : cfg.model,
    messages,
    temperature: (opts && opts.temperature) || 0.6,
    max_tokens: (opts && opts.maxTokens) || 4096,
    stream: false
  };
  const res = await postJson(
    url,
    payload,
    (opts && opts.timeout) || 60000
  );
  if (res.status !== 200) {
    throw new Error('LLM 返回异常状态码 ' + res.status + ': ' + res.body.slice(0, 200));
  }
  const data = JSON.parse(res.body);
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('LLM 返回内容为空');
  return content;
}

// 解析 LLM 输出的 JSON（兼容 ```json 包裹与多余文本）
function parseJson(content) {
  if (!content) return null;
  let text = String(content).trim();
  text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    // 尝试提取第一个 { ... } 或 [ ... ]
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

module.exports = { chat, parseJson };
