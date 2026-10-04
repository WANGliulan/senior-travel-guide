/**
 * config.js - 智游康行·岁旅相伴 后端服务配置
 *
 * 设计原则：
 *  1) 零依赖：不引入 dotenv / express 等第三方包，仅用 Node 内置模块，任何云环境可直接跑；
 *  2) 密钥不入库：所有 Key 一律通过环境变量注入，代码与仓库中不出现明文；
 *  3) 未配置 Key 也能完整运行：AI 层自动降级为「规则引擎 + 知识库」兜底。
 */
const fs = require('fs');
const path = require('path');

// ---------- 极简 .env 解析（无第三方依赖） ----------
function loadDotEnv(file) {
  try {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    text.split(/\r?\n/).forEach((line) => {
      const s = line.trim();
      if (!s || s.startsWith('#')) return;
      const i = s.indexOf('=');
      if (i < 0) return;
      const key = s.slice(0, i).trim();
      let val = s.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    });
  } catch (e) {
    /* 忽略 .env 读取异常，不影响服务启动 */
  }
}
loadDotEnv(path.join(__dirname, '.env'));

// ---------- 大模型厂商预设 ----------
// ★ 新增厂商只需在此处追加一行，业务代码无需改动。
//   protocol: 'chat'       → OpenAI 兼容的 POST {baseUrl}/chat/completions（通用）
//   protocol: 'responses'  → 新版 Responses 协议 POST {baseUrl}/responses（火山方舟豆包等）
const PROVIDERS = {
  dashscope: {
    label: '阿里云百炼 · 通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-max',
    protocol: 'chat'
  },
  ark: {
    label: '火山方舟 · 豆包（Doubao）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    // 可直接填模型名（如 doubao-seed-evolving）或推理接入点 ID（如 ep-2024xxxx-xxxxx）
    model: 'doubao-seed-evolving',
    protocol: 'responses',
    // thinking：豆包推理模型的思维链开关（仅 responses 协议下发送）。
    //   实测 {type:'disabled'} 可把一次行程生成从约 100 秒降到约 4 秒（思维链 token 归零），
    //   而本项目的安全字段与风险评估本就由规则引擎决定，思维链收益有限 → 默认关闭最划算。
    //   需要更强推理时把环境变量 LLM_THINKING 设为 enabled；设为 off 则不发送该参数。
    thinking: 'disabled',
    // 关闭思维链后 4 秒左右即可返回；这里保留较宽的超时，便于临时开启 thinking 时也不被截断。
    maxTokens: 16384,
    timeout: 120000
  },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', protocol: 'chat' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', protocol: 'chat' },
  moonshot: { label: '月之暗面 Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', protocol: 'chat' },
  zhipu: { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', protocol: 'chat' },
  custom: { label: '自定义 / 本地部署', baseUrl: '', model: '', protocol: 'chat' }
};

// 厂商别名，兼容常见叫法
const PROVIDER_ALIAS = {
  doubao: 'ark', volc: 'ark', volces: 'ark', volcengine: 'ark', 方舟: 'ark',
  qwen: 'dashscope', tongyi: 'dashscope',
  kimi: 'moonshot', glm: 'zhipu'
};

const PROTOCOLS = ['chat', 'responses'];

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function str(v, def) {
  return (v === undefined || v === null || String(v).trim() === '') ? def : String(v).trim();
}

const providerRaw = str(process.env.LLM_PROVIDER, 'dashscope');
const provider = PROVIDER_ALIAS[providerRaw] || providerRaw;
const preset = PROVIDERS[provider] || PROVIDERS.custom;

// 协议：留空/auto 时使用厂商预设；显式配置可强制覆盖（如某模型不支持 /responses 时改为 chat）
const protocolRaw = str(process.env.LLM_PROTOCOL, 'auto');
const protocol = (protocolRaw === 'auto' ? (preset.protocol || 'chat') : protocolRaw).toLowerCase();

const config = {
  // ---------- 服务 ----------
  PORT: num(process.env.PORT, 3000),
  HOST: str(process.env.HOST, '0.0.0.0'),
  CORS_ORIGIN: str(process.env.CORS_ORIGIN, '*'),
  ACCESS_TOKEN: str(process.env.ACCESS_TOKEN, ''),
  DEBUG: process.env.DEBUG === '1',

  // ---------- ★ AI 接口配置（预留，Key 由环境变量注入）----------
  AI: {
    provider,
    providerLabel: preset.label,
    apiKey: str(process.env.LLM_API_KEY, ''),
    baseUrl: str(process.env.LLM_BASE_URL, preset.baseUrl),
    model: str(process.env.LLM_MODEL, preset.model),
    protocol: PROTOCOLS.indexOf(protocol) >= 0 ? protocol : 'chat',
    // thinking：推理模型思维链开关，'off' 表示请求体里不发送该字段
    thinking: str(process.env.LLM_THINKING, preset.thinking || 'off'),
    timeout: num(process.env.LLM_TIMEOUT, preset.timeout || 60000),
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.6,
    maxTokens: num(process.env.LLM_MAX_TOKENS, preset.maxTokens || 4096)
  },

  // ---------- 数据 ----------
  DATA_DIR: str(process.env.DATA_DIR, path.join(__dirname, 'data')),
  KNOWLEDGE_PATH: str(process.env.KNOWLEDGE_PATH, ''),

  PROVIDERS,
  PROVIDER_ALIAS,
  PROTOCOLS
};

module.exports = config;
