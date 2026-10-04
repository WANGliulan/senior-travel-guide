/**
 * homePage.js - 后端服务首页（HTML）
 * 大赛评审可直接用浏览器打开公网地址，看到服务状态与完整接口清单。
 */
const VERSION = '1.0.0';

const APIS = [
  ['GET', '/api/health', '健康检查（含 AI 配置状态）'],
  ['GET', '/api/ai/status', '★ 大模型接口状态（是否已配置 API Key）'],
  ['POST', '/api/ai/chat', '★ 大模型对话接口（预留；未配置 Key 时返回明确指引）'],
  ['GET', '/api/cities', '国内地区板块与城市列表'],
  ['GET', '/api/age-groups', '年龄段选项（6-17 / 18-40 / 41-60 / 61+）'],
  ['POST', '/api/age/resolve', '年龄段 → 流程分流决策（通用 / 适老化专项）'],
  ['POST', '/api/attractions', '规则引擎前置过滤候选景点（透明展示剔除原因）'],
  ['POST', '/api/itinerary', '生成行程（规则引擎 → 知识库 → 大模型 → 风险评估 → 专属贴士）'],
  ['POST', '/api/dialogue', '多轮会话调整行程（大模型优先，关键词规则兜底）'],
  ['POST', '/api/adjust', '快捷按钮调整（纯规则引擎，确定性）'],
  ['POST', '/api/plans', '方案保存 / 列表 / 详情 / 删除']
];

const SAMPLE = 'curl -X POST {URL}/api/itinerary -H "Content-Type: application/json" ' +
  '-d "{\\"ageGroup\\":\\"61+\\",\\"profile\\":{\\"city\\":\\"北京\\",\\"days\\":3,\\"interests\\":[\\"历史古迹\\"],' +
  '\\"mobility\\":\\"需慢行\\",\\"walkLimit\\":\\"1-3km\\",\\"accessible\\":true,\\"chronic\\":[\\"高血压\\"]}}"';

function render(st, knowledge, baseUrl) {
  const rows = APIS.map((a) =>
    '<tr><td class="m ' + a[0] + '">' + a[0] + '</td><td class="p">' + a[1] + '</td><td>' + a[2] + '</td></tr>'
  ).join('');
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>智游康行·岁旅相伴 | 后端服务</title><style>' +
    'body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:920px;margin:0 auto;padding:28px 20px;color:#1F3B33;background:#F4FAF6;line-height:1.9;font-size:17px}' +
    'h1{font-size:26px;margin:0 0 6px}.sub{color:#5E7A70;margin-bottom:22px}' +
    '.card{background:#fff;border-radius:14px;padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 10px rgba(93,175,140,.12)}' +
    'table{width:100%;border-collapse:collapse;font-size:15px}td{padding:8px 6px;border-bottom:1px solid #EAF3EE;vertical-align:top}' +
    '.m{font-weight:700;width:64px}.GET{color:#2E8B57}.POST{color:#B8860B}.p{font-family:Menlo,Consolas,monospace;color:#0B5C3F;width:190px}' +
    '.ok{color:#2E8B57;font-weight:700}.no{color:#C7701E;font-weight:700}' +
    'code{background:#EAF3EE;border-radius:5px;padding:2px 6px;font-size:13px;word-break:break-all}' +
    '.tip{color:#5E7A70;font-size:14px;margin-top:8px}</style></head><body>' +
    '<h1>智游康行 · 岁旅相伴</h1>' +
    '<div class="sub">面向老年人的旅游规划智能体 · 后端服务（规则引擎前置过滤 + 知识库检索 + 大模型生成 + 多轮会话迭代）</div>' +
    '<div class="card"><b>服务状态</b><br>版本 v' + VERSION + ' · 知识库：' +
    knowledge.CITIES.length + ' 个地区板块 / ' + knowledge.ATTRACTIONS.length + ' 条景点数据<br>' +
    '大模型接口：<span class="' + (st.configured ? 'ok' : 'no') + '">' +
    (st.configured ? '已配置（' + st.providerLabel + ' · ' + st.model + '）' : '未配置 API Key（自动使用规则引擎兜底，功能完整）') +
    '</span><div class="tip">' + st.hint + '</div></div>' +
    '<div class="card"><b>接口清单</b><table><tbody>' + rows + '</tbody></table>' +
    '<div class="tip">调用示例：<br><code>' + SAMPLE.split('{URL}').join(baseUrl) + '</code></div></div>' +
    '</body></html>';
}

module.exports = { render, VERSION, APIS };
