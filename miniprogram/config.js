// config.js - 运行配置
module.exports = {
  // 云开发环境 ID：留空则使用"本地模拟数据"模式（无需云环境即可预览全部页面）；
  // 部署上线时填入你的云环境 ID（在微信开发者工具「云开发」控制台获取），
  // 并到 cloudfunctions 目录逐个「上传并部署：云端安装依赖」。
  CLOUD_ENV: '',

  // 云函数调用失败时是否自动降级到本地模拟数据（保证可直接运行与演示）
  USE_MOCK_FALLBACK: true,

  // 大模型相关（云函数环境变量中配置，前端无需填写）：
  // LLM_API_KEY / LLM_BASE_URL / LLM_MODEL —— 见 README 部署说明
};
