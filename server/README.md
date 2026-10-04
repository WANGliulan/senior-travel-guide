# 智游康行 · 岁旅相伴 —— 后端服务（公网 HTTP API）

面向老年人的旅游规划智能体后端，采用 **规则引擎前置过滤 + 知识库检索 + 大模型生成 + 多轮会话迭代** 的混合智能体架构。
本项目**不依赖任何第三方 npm 包**（仅用 Node 内置模块），开箱即跑、可部署到任意公网云环境，满足大赛"公网可访问"评审硬性条件。

---

## 一、30 秒跑起来

```bash
# 仓库根目录下执行
node server/index.js
```

启动后访问 <http://localhost:3000/> 即可看到服务状态与完整接口清单。

> 不需要 API Key、不需要 `npm install`、不需要数据库即可完整运行全部业务流程。

---

## 二、★ 接入大模型 API（已内置火山方舟 · 豆包，Key 已填入 `server/.env`）

后端已经把 AI 接口单独抽成 `server/lib/aiProvider.js` 一个文件，**换厂商 / 换协议 / 换模型都只改配置，业务代码一行都不用动**。

### 当前配置（火山方舟 · 豆包 Doubao）

`server/.env` 已配置好：

```ini
LLM_PROVIDER=ark                                             # 火山方舟
LLM_API_KEY=ark-xxxx...                                      # 你的 Key（该文件已 gitignore）
LLM_PROTOCOL=auto                                            # 跟随预设 → responses 协议
LLM_MODEL=                                                   # 留空 = doubao-seed-evolving
LLM_THINKING=disabled                                        # 关闭思维链：100 秒 → 5 秒
```

启动后访问 `GET /api/ai/status` 即可看到：

```json
{
  "configured": true,
  "providerLabel": "火山方舟 · 豆包（Doubao）",
  "protocol": "responses",
  "endpoint": "https://ark.cn-beijing.volces.com/api/v3/responses",
  "thinking": "disabled",
  "model": "doubao-seed-evolving"
}
```

### 支持的厂商与协议

| `LLM_PROVIDER` | 厂商 | 默认协议 | 默认地址 |
|---|---|---|---|
| `ark`（别名 `doubao`/`volc`） | 火山方舟 · 豆包 | `responses` | `https://ark.cn-beijing.volces.com/api/v3` |
| `dashscope`（别名 `qwen`） | 阿里云百炼 · 通义千问 | `chat` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `deepseek` / `moonshot` / `zhipu` / `openai` | 各家 | `chat` | 各家默认 |
| `custom` | 自建 / 本地（vLLM、Ollama） | `chat` | 自行填写 `LLM_BASE_URL` |

两种协议由 `aiProvider.js` 统一适配，业务层无感知：

- **`chat`** → `POST {baseUrl}/chat/completions`（OpenAI 兼容），`max_tokens` + `response_format`
- **`responses`** → `POST {baseUrl}/responses`（方舟豆包），`input` 内容块 + `instructions` + `max_output_tokens` + `text.format`，响应从 `output[]` 中跳过 `reasoning` 项、只取 `message` 正文

用 `LLM_PROTOCOL` 可强制切换（`auto` / `chat` / `responses`）。

### 豆包（推理模型）接入时的三个实测坑与对策

| 现象 | 原因 | 本项目的处理 |
|---|---|---|
| 只返回思维链、没有正文 | 推理模型的思维链占用输出额度（实测一次简单问答就烧 1170 reasoning tokens） | 默认 `LLM_MAX_TOKENS=16384`，并在 `extractContent` 里对 `incomplete_details.reason='length'` 抛出明确的 `AI_OUTPUT_TRUNCATED` |
| 请求 100 秒以上甚至超时 | 未限制输出格式时，推理模型会长时间"自由发挥" | 行程生成强制 `json:true`（`text.format=json_object`），并默认 `LLM_THINKING=disabled` → **耗时从约 100 秒降到约 5 秒** |
| 返回的 JSON 解析失败 | 模型包了 Markdown 代码块或夹带解释文字 | `parseJson()` 容错解析（去代码块 + 提取首个 JSON）；仍失败则自动回退规则引擎模板 |

### 未配置 Key 时的行为（兜底）

| 能力 | 未配置 Key | 已配置 Key |
|---|---|---|
| 行程生成 `/api/itinerary` | 规则引擎 + 知识库模板生成（**功能完整**），响应 `llmUsed:false, aiReason:"AI_NOT_CONFIGURED"` | 大模型在安全候选集内编排，响应 `llmUsed:true` |
| 多轮对话 `/api/dialogue` | 关键词规则兜底（增加休息/减少步行/换室内/避开人流） | 大模型理解意图 + 结构化 action |
| 快捷调整 `/api/adjust` | 纯规则引擎（两种模式完全一致，确定性） | 同左 |
| 风险评估 / 专属贴士 | 规则引擎计算（**始终不受大模型影响**） | 同左 |
| `/api/ai/chat` | 返回 HTTP 503 + 明确配置指引 | 正常返回大模型回复 |

任何情况下**行程修改、风险评估、设施与安全字段都不采信大模型输出**，由规则引擎确定性计算 —— 这是本项目缓解大模型幻觉的核心设计。

### 快捷调整配置（不改代码）

- 换模型：`LLM_MODEL=ep-2024xxxx-xxxxx`（方舟推理接入点 ID）或 `doubao-seed-1-6-250615` 等模型名。
- 换回通义千问：`LLM_PROVIDER=dashscope` + 对应的 `LLM_API_KEY`。
- 想让豆包"多想想"：`LLM_THINKING=enabled`（约 100 秒，不推荐用于交互式场景）。
- 模型不支持 `thinking` 参数：`LLM_THINKING=off`（请求体里不发送该字段）。

---

## 三、接口清单

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 服务说明页（浏览器可直接打开，含接口清单与调用示例） |
| GET | `/api/health` | 健康检查（服务版本、知识库规模、AI 配置状态） |
| GET | `/api/ai/status` | ★ 大模型接口状态（是否配置 Key、厂商、模型、调用统计） |
| POST | `/api/ai/chat` | ★ 大模型对话接口（预留；未配置 Key 返回 503 + 指引） |
| GET | `/api/cities` | 国内地区板块与城市列表 |
| GET | `/api/age-groups` | 年龄段选项（6-17 / 18-40 / 41-60 / 61+） |
| POST | `/api/age/resolve` | 年龄段 → 流程分流决策（通用 / 适老化专项）+ 自动大字体参数 |
| POST | `/api/attractions` | 规则引擎前置过滤（透明返回"哪些景点被剔除、为什么"） |
| POST | `/api/itinerary` | 生成行程（核心接口） |
| POST | `/api/dialogue` | **智能助手聊天入口**：人设 + 知识库注入 + 多轮历史 + 身体约束，可选返回行程调整 action |
| POST | `/api/adjust` | 快捷按钮调整（纯规则引擎） |
| POST | `/api/plans` | 方案保存 / 列表 / 详情 / 删除 |

所有接口返回结构与微信云函数**完全一致**（`{ ok: true, ... }` / `{ ok: false, error }`），前端可无缝切换数据源。

### 调用示例

```bash
# 年龄段分流
curl -X POST http://localhost:3000/api/age/resolve \
  -H "Content-Type: application/json" \
  -d '{"ageGroup":"61+"}'

# 生成 61 岁长辈的北京 3 日适老行程
curl -X POST http://localhost:3000/api/itinerary \
  -H "Content-Type: application/json" \
  -d '{
        "ageGroup": "61+",
        "profile": {
          "city": "北京", "days": 3, "budget": "舒适型",
          "interests": ["历史古迹", "室内场馆"],
          "mobility": "需慢行", "chronic": ["高血压"],
          "joints": "轻微不便", "accessible": true,
          "walkLimit": "1-3km", "fillBy": "子女代填"
        }
      }'

# 自然语言调整行程
curl -X POST http://localhost:3000/api/dialogue \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"走得太累了，多安排休息"}],"plan":<上一步返回的 plan>}'
```

---

## 四、部署到公网（任选其一）

### 方案 A：轻量应用服务器 / 云主机（最简单）

```bash
# 1. 上传代码（或 git clone）
# 2. 启动服务（可用 pm2 / systemd 守护）
PORT=3000 node server/index.js

# 3. Nginx 反代 + HTTPS（微信小程序要求 https 域名）
#    server {
#      listen 443 ssl;
#      server_name your-domain.com;
#      location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host;
#                   proxy_set_header X-Forwarded-Proto $scheme; }
#    }
```

### 方案 B：GitHub 一键部署（推荐，比赛最省事）

本项目**零第三方依赖**（`dependencies: {}`），云平台只要跑 `npm start` 即可，无需构建产物。

**第 1 步：推送到 GitHub**

```bash
git add .
git commit -m "feat: 后端服务（规则引擎 + 知识库 + 豆包大模型）"
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin master
```
> `.gitignore` 已排除 `server/.env`，**Key 不会进仓库**，需要在平台控制台单独填。

**第 2 步：选一个平台（都支持 GitHub 直连）**

| 平台 | 操作 | 得到 |
|---|---|---|
| **Render** ⭐ | 仓库已带 `render.yaml` → 打开 [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints) → New Blueprint Instance → 选仓库 → 填 `LLM_API_KEY` | `https://xxx.onrender.com` |
| **Railway** | New Project → Deploy from GitHub repo → 选仓库（自动识别根目录 `package.json` 的 `npm start`）→ Variables 里加 `LLM_API_KEY` | `https://xxx.up.railway.app` |
| **腾讯云 CloudBase 云托管** | 新建服务 → 源码部署 → GitHub → 选仓库（Dockerfile 选根目录的 `Dockerfile`）→ 环境变量填 `LLM_API_KEY` | 你自己的 HTTPS 域名（国内访问最快） |
| **Zeabur / Koyeb / Fly.io** | 同样 GitHub 直连，启动命令 `node server/index.js` | 平台分配域名 |

**第 3 步：填环境变量**（模板已在 `render.yaml` / `.env.example` 里列全）

```
LLM_PROVIDER=ark
LLM_API_KEY=ark-xxxxxxxx        ← 只有这一项必须手填
LLM_MODEL=doubao-seed-evolving
LLM_THINKING=disabled
```

**第 4 步：验证 + 接入小程序**

```bash
curl https://你的域名/api/health      # 应返回 ok:true, aiConfigured:true
curl https://你的域名/api/ai/status   # 确认大模型已启用
```
然后把该域名填到 `miniprogram/config.js` 的 `API_BASE_URL`，并在微信公众平台加入「request 合法域名」白名单。

> ⚠️ Render 免费实例 15 分钟无访问会休眠，首次唤醒约 30 秒。评审前先访问一次 `/api/health` 预热即可。

### 方案 C：Docker / 自建服务器

```bash
# 注意：构建上下文必须是【仓库根目录】（后端复用 cloudfunctions/_shared 知识库）
docker build -t zykx-server .
docker run -d -p 3000:3000 --name zykx --env-file server/.env \
  -v zykx-data:/app/server/data zykx-server
```

### 方案 D：仅有 Node 运行时的 PaaS

启动命令填 `node server/index.js`（或 `npm start`），平台会自动注入 `PORT` 环境变量（本服务已适配）。

---

## 五、小程序端接入

1. 在 `miniprogram/config.js` 里填写后端地址：

```js
module.exports = {
  API_BASE_URL: 'https://your-domain.com',  // ★ 公网后端地址（留空则回退云函数/本地模拟）
  CLOUD_ENV: '',                            // 微信云开发环境 ID（可选）
  USE_MOCK_FALLBACK: true
};
```

2. 需要在微信公众平台「开发设置 → 服务器域名 → request 合法域名」中添加该域名（必须 HTTPS）。
3. 前端 `utils/api.js` 采用三级降级：**公网 HTTP 后端 → 微信云函数 → 本地模拟数据**，任一环节不可用都不影响演示。

---

## 六、目录结构

```
server/
├── index.js              HTTP 服务入口（启动、路由分发、优雅退出）
├── routes.js             全部 REST 接口
├── config.js             服务与 AI 配置（环境变量注入，零依赖 .env 解析）
├── .env.example          ★ 环境变量模板（含 LLM_API_KEY 占位）
├── scripts/check-llm.js  大模型连通性自检（node server/scripts/check-llm.js）
├── scripts/selftest.js   业务自检（63 项断言，覆盖全业务链路）
├── data/                 方案持久化目录（自动创建，已 gitignore）
└── lib/
    ├── aiProvider.js     ★★ 大模型 API 统一接入层（预留接口，换厂商只改这里）
    ├── agePolicy.js      年龄段策略（4 组区间 → 通用/适老分流、自动大字体）
    ├── knowledge.js      知识库访问（复用 cloudfunctions/_shared/data.js，单一数据源）
    ├── rulesEngine.js    适老规则引擎（体力/台阶/步行/无障碍/人流/休息点 六维前置过滤）
    ├── generator.js      行程生成 + 独立风险评估报告 + 中老年专属贴士 + 快捷调整
    ├── planner.js        编排层（年龄段分流、提示词构造、大模型输出校验防幻觉）
    ├── dialogue.js       多轮会话迭代（大模型优先，关键词规则兜底）
    ├── store.js          方案持久化（JSON 文件；可平滑替换为云数据库）
    ├── http.js           CORS / JSON / 请求解析 / 鉴权 / 日志
    └── homePage.js       服务说明页 HTML
```

---

## 七、自测

```bash
node server/scripts/selftest.js
```

覆盖：年龄段分流、规则引擎过滤、适老/通用行程生成、风险评估、专属贴士、多轮对话、快捷调整、方案持久化、无 Key 场景 AI 行为。

---

## 八、关键设计说明

1. **为什么年龄段前置**：41 岁以上自动进入适老化专项流程，先采集行动能力、基础疾病、无障碍需求、每日步行上限，再规划行程 —— 从源头避免"给长辈排高负荷路线"。
2. **为什么规则引擎前置过滤**：大模型不直接看全量景点，只看规则引擎筛过的安全候选集，从机制上杜绝"推荐高体力、多台阶景点"的幻觉。
3. **为什么安全字段不让大模型写**：步行量、台阶、无障碍、就近医疗、休息点一律以知识库为准，大模型只负责"怎么编排更舒服、怎么表达更易懂"。
4. **为什么保留模板兜底**：演示场景（比赛现场）不能因为网络或 Key 问题中断，未配置 Key 时全流程仍然完整可用。
5. **知识库单一数据源**：后端与微信云函数共用 `cloudfunctions/_shared/data.js`，避免两套数据分叉；升级为向量检索时字段结构保持不变。
