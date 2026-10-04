/**
 * check-llm.js - 后端 + 大模型 连通性自检（一键确认"到底通没通"）
 * 运行：node server/scripts/check-llm.js
 *
 * 会依次检查：
 *   ① 读取到的配置（厂商 / 模型 / 协议 / 地址 / Key 掩码）
 *   ② Key 是否配置
 *   ③ 真实调用一次大模型（会消耗极少 token）
 *   ④ 完整跑一次适老行程生成（规则引擎 + 大模型）
 */
const config = require('../config');
const ai = require('../lib/aiProvider');
const knowledge = require('../lib/knowledge');
const planner = require('../lib/planner');

function line(k, v) {
  console.log('   ' + String(k).padEnd(12, ' ') + ': ' + v);
}

(async function main() {
  console.log('==============================================');
  console.log('  智游康行 · 岁旅相伴   后端 + 大模型 连通性自检');
  console.log('==============================================\n');

  console.log('① 当前配置');
  line('厂商', config.AI.providerLabel + '（' + config.AI.provider + '）');
  line('模型', config.AI.model);
  line('协议', config.AI.protocol + '  →  ' + ai.endpointOf(config.AI));
  line('思维链', config.AI.thinking);
  line('输出额度', config.AI.maxTokens);
  line('超时', config.AI.timeout + ' ms');
  line('API Key', config.AI.apiKey ? ai.maskKey(config.AI.apiKey) : '（空）');
  line('知识库', knowledge.ATTRACTIONS.length + ' 条景点 / ' + knowledge.CITIES.length + ' 个地区板块');

  console.log('\n② Key 配置检查');
  if (!ai.isConfigured()) {
    console.log('   [×] 未读取到 LLM_API_KEY');
    console.log('');
    console.log('   请在 server/.env 中填写（文件已存在，或从 .env.example 复制）：');
    console.log('       LLM_PROVIDER=ark');
    console.log('       LLM_API_KEY=你的方舟Key（ark-开头）');
    console.log('       LLM_MODEL=doubao-seed-evolving');
    console.log('   （云平台部署时改在「环境变量」里配置同样的名字）');
    process.exit(1);
  }
  console.log('   [√] 已配置');

  console.log('\n③ 真实调用一次大模型…');
  const t1 = Date.now();
  try {
    const reply = await ai.chat([{ role: 'user', content: '请只回复两个字：你好' }], { timeout: 60000 });
    console.log('   [√] 调用成功，耗时 ' + (Date.now() - t1) + ' ms');
    console.log('   模型回复：' + String(reply).trim().slice(0, 60));
  } catch (e) {
    console.log('   [×] 调用失败：code=' + (e.code || '?') + '  ' + e.message);
    console.log('');
    console.log('   常见原因：');
    console.log('   · 401/AuthenticationError → Key 不对或已失效（去方舟控制台重新生成）');
    console.log('   · 404/InvalidEndpoint    → LLM_MODEL 填错（填模型名或 ep-xxxx 接入点 ID）');
    console.log('   · 网络超时               → 本机访问不了 ark.cn-beijing.volces.com');
    process.exit(1);
  }

  console.log('\n④ 完整跑一次适老行程生成（规则引擎 + 大模型）…');
  const t2 = Date.now();
  const r = await planner.planTrip({
    ageGroup: '61+',
    profile: {
      city: '杭州', days: 2, interests: ['自然风光', '室内场馆'],
      mobility: '需搀扶或轮椅', accessible: true, walkLimit: '1km以内'
    }
  });
  console.log('   耗时 ' + (Date.now() - t2) + ' ms  llmUsed=' + r.llmUsed +
    '  规则引擎剔除 ' + r.filtered.removedCount + ' 个景点');
  console.log('   行程标题：' + r.plan.title);
  console.log('   风险等级：' + r.plan.risk.level + '（' + r.plan.risk.dailyWalk + '）');

  console.log('\n==============================================');
  if (r.llmUsed) {
    console.log('  ✅ 全部通过：后端已就绪，大模型调用正常');
    console.log('  下一步：把 miniprogram/config.js 的 API_BASE_URL 填成');
    console.log('          http://localhost:' + config.PORT + '  然后重新编译小程序');
  } else {
    console.log('  ⚠️ 大模型未生效（已自动降级到规则引擎，行程仍可用）');
    console.log('     原因：' + (r.aiReason || '未知'));
  }
  console.log('==============================================\n');
  process.exit(0);
})().catch((e) => {
  console.error('\n自检异常：' + (e && e.message ? e.message : e));
  process.exit(1);
});
