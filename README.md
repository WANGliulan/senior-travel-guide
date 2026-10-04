# 智游康行 · 岁旅相伴 — 微信小程序源码

面向老年人的旅游规划智能体微信小程序（大模型与智能体应用赛道）。
基于原 Web 版 Tour-AI（Next.js）按《小程序前后端设计方案》改写的可运行版本：
**规则引擎前置过滤 + 知识库 + 大模型生成 + 多轮迭代**的混合智能体架构。

```
项目结构
├── project.config.json        微信开发者工具项目配置
├── package.json               根目录脚本：npm start / npm test / npm run check（供 GitHub 云平台识别）
├── Dockerfile                 ★ 容器化部署（构建上下文 = 仓库根目录）
├── render.yaml                ★ Render 一键部署蓝图（GitHub 直连）
├── Procfile                   Railway / Heroku 类平台启动声明
├── 启动后端.bat               Windows 双击启动后端
├── .github/workflows/ci.yml   推送自动跑自检（后端 63 项 + WXML 检查）
├── tools/check-wxml.js        WXML 循环变量静态检查（防"空白气泡"类问题）
├── miniprogram/               小程序前端（原生 WXML + WXSS + JS，全局适老化 UI）
│   ├── app.js / app.json / app.wxss / sitemap.json / config.js
│   ├── utils/                 api 统一数据层（公网后端 → 云函数 → 本地模拟 三级降级）、本地存储、格式化、模拟数据
│   └── pages/                 7 个页面：
│       ├── index/             首页：年龄段选择 + 智能助手聊天（走大模型）+ 快捷服务
│       ├── form/              出行信息表单（适老化流程额外采集身体约束项）
│       ├── generating/        行程生成中（进度化提示）
│       ├── itinerary/         行程结果：分天行程 + 风险评估 + 出行贴士 + 快捷调整 + 保存/复制/分享图
│       ├── chat/              智能体多轮对话（自然语言调整，身体约束持续生效）
│       ├── history/           我的方案（历史查看/删除）
│       └── settings/          适老化设置（字体大小、高对比度、数据管理）
├── server/                    ★ 公网 HTTP 后端（Node.js 零依赖，满足大赛公网可访问评审条件）
│   ├── index.js               服务入口（启动横幅会直接打印要填的 API_BASE_URL）
│   ├── routes.js              全部 REST 接口
│   ├── config.js              ★ AI 配置（环境变量注入，Key 不入库）
│   ├── .env.example           ★ LLM_API_KEY 占位模板
│   ├── scripts/check-llm.js   大模型连通性自检
│   ├── scripts/selftest.js    业务自检（63 项断言）
│   ├── README.md              后端部署与接口文档（含豆包接入 + GitHub 部署）
│   └── lib/                   aiProvider(★AI 接口·双协议) / agePolicy(年龄段) / rulesEngine / generator / planner / dialogue / store ...
└── cloudfunctions/            微信云开发后端（Node.js 云函数，与 server 共用同一份知识库）
    ├── login/                 获取微信 openid（替代原邮箱注册登录）
    ├── cities/                地区板块与城市列表
    ├── attractions/           规则引擎前置过滤候选景点
    ├── itinerary/             生成老年专属行程（规则引擎→知识库→大模型→风险评估→出行贴士）
    ├── dialogue/              多轮对话调整行程（大模型优先，关键词规则兜底）
    ├── adjust/                快捷调整按钮（纯规则引擎，确定性修改）
    ├── plan/                  方案保存/列表/详情/删除（云数据库）
    └── _shared/               公共知识库 / 规则引擎 / 生成器（server 与各云函数共用）
```

## 一、直接运行（推荐先用这步）

1. 打开**微信开发者工具** → 导入项目 → 选择本目录；
2. AppID 选择「测试号」或使用自己的 AppID；
3. 无需任何配置即可运行：`config.js` 中 `API_BASE_URL` 与 `CLOUD_ENV` 均为空，前端自动进入**本地模拟模式**，全部页面与业务流程（年龄段分流、生成行程、调整、对话、保存、分享）均可完整演示。

> 本地模拟模式的数据结构与后端完全一致，仅用于界面与流程演示。

## 二、启动后端服务（公网 API）— 三步走

**第 1 步：确认后端信息（就 3 行，在 `server/.env`）**

```ini
LLM_PROVIDER=ark                    # 厂商：火山方舟（豆包）
LLM_API_KEY=ark-xxxx...             # ★ 大模型 Key（已填好）
LLM_MODEL=doubao-seed-evolving      # 模型名；也可填方舟推理接入点 ID：ep-2024xxxx-xxxxx
```

> ⚠️ **不要把 Key 填到 `miniprogram/config.js`**！小程序代码可被解包反编译。
> 调用链是：小程序 ──API_BASE_URL──▶ 你的后端(`server/`) ──LLM_API_KEY──▶ 豆包。
> 也用不着自己写后端 —— `server/` 就是后端，包含规则引擎 + 知识库 + 大模型接入 + 全部接口。

**第 2 步：启动 + 自检**

```bash
# Windows 可直接双击根目录的「启动后端.bat」
node server/index.js            # 启动服务

node server/scripts/check-llm.js   # 连通性自检（会真实调用一次大模型）
```

自检通过会输出：

```
③ 真实调用一次大模型…
   [√] 调用成功，耗时 1033 ms
④ 完整跑一次适老行程生成（规则引擎 + 大模型）…
   耗时 6447 ms  llmUsed=true  规则引擎剔除 4 个景点
  ✅ 全部通过：后端已就绪，大模型调用正常
```

**第 3 步：让小程序连上后端**

```js
// miniprogram/config.js
API_BASE_URL: 'http://localhost:3000',   // 就填你自己后端的地址
```

重新编译小程序，角标会从「离线演示」变成「**大模型在线**」。

- 真机预览：`localhost` 无效，改成电脑局域网 IP（如 `http://192.168.1.5:3000`）
- 开发者工具：勾选「详情 → 本地设置 → 不校验合法域名」
- 公网部署：填你的 HTTPS 域名，并在微信公众平台加入「request 合法域名」白名单

### 用 GitHub 部署到公网（推荐，满足大赛"公网可访问"要求）

仓库里已经备好了云平台需要的全部文件，**推上 GitHub 后选一个平台点几下就能拿到公网 HTTPS 地址**：

| 文件 | 作用 |
|---|---|
| `package.json`（根目录） | 提供 `npm start` = `node server/index.js`，平台自动识别 |
| `render.yaml` | Render 蓝图：一键创建服务 + 预置环境变量 |
| `Procfile` | Railway / Heroku 类平台启动声明 |
| `Dockerfile`（根目录） | 云托管 / 任意容器平台 |
| `.github/workflows/ci.yml` | 推送后自动跑自检（63 项断言 + WXML 检查） |

```bash
# 1) 推到 GitHub（Key 不会进仓库，.gitignore 已排除 server/.env）
git add . && git commit -m "feat: 后端服务" && git push

# 2) Render：dashboard.render.com/blueprints → New Blueprint Instance → 选仓库
#    Railway：New Project → Deploy from GitHub repo → 选仓库
#    云托管  ：新建服务 → 源码部署 → GitHub → Dockerfile 选根目录 Dockerfile
#    然后在平台「环境变量」里只需手填一项：LLM_API_KEY

# 3) 验证
curl https://你的域名/api/health      # ok:true, aiConfigured:true
```

拿到公网域名后填进 `miniprogram/config.js` 的 `API_BASE_URL` 即可。完整说明见 **`server/README.md` 第四节**。

详细部署方式（轻量服务器 / Docker / 云托管 / PaaS）见 **`server/README.md`**。

## 三、接入大模型 API（已接入火山方舟 · 豆包）

后端已把 AI 接口独立成 `server/lib/aiProvider.js`，**换厂商 / 换协议 / 换模型都只改环境变量，业务代码零改动**。
当前 `server/.env` 已配置好火山方舟豆包：

```ini
LLM_PROVIDER=ark          # 火山方舟（别名 doubao / volc）
LLM_API_KEY=ark-xxxx...   # 你的 Key（server/.env 已被 gitignore，不入库）
LLM_PROTOCOL=auto         # 跟随预设 → responses 协议
LLM_THINKING=disabled     # 关闭思维链：实测耗时 100 秒 → 5 秒
```

支持两种协议，由 `aiProvider.js` 统一适配、业务层无感知：

| 协议 | 请求 | 适用 |
|---|---|---|
| `chat` | `POST {baseUrl}/chat/completions`（OpenAI 兼容） | 通义千问、DeepSeek、Kimi、GLM、OpenAI、本地 vLLM |
| `responses` | `POST {baseUrl}/responses`（`input` 内容块 + `instructions` + `text.format`） | 火山方舟豆包 |

**大模型用在哪几个地方：**

| 入口 | 接口 | 说明 |
|---|---|---|
| **智能助手聊天**（首页对话区） | `POST /api/dialogue` | 用户随便聊什么都会走这里：人设 + 知识库注入 + 多轮历史 + 身体约束；只有"我的方案"这类**跳页指令**才走本地 |
| 多轮调整行程（chat 页 / 快捷按钮） | `POST /api/dialogue` · `POST /api/adjust` | 对话由大模型理解意图并输出结构化 `action`，实际改动仍由规则引擎执行 |
| 行程生成 | `POST /api/itinerary` | 大模型只在规则引擎筛过的**安全候选集**内编排 |

> 智能助手每轮回复会带一个角标：**大模型在线** / **规则兜底**，一眼能看出这次回复是谁生成的。

**豆包是推理模型，接入时踩到的三个坑已全部处理**（详见 `server/README.md`）：
① 思维链会吃掉输出额度（一次简单问答烧 1170 reasoning tokens）→ 默认 `LLM_MAX_TOKENS=16384` 并对截断抛明确错误；
② 不限制输出格式时请求要 100 秒以上 → 行程生成强制 `json:true`；
③ `LLM_THINKING=disabled` 后 **耗时从约 100 秒降到约 5 秒**，实测 3/3 成功。

**未配置 Key 时**：行程生成与多轮对话自动使用「规则引擎 + 知识库」兜底，全流程功能完整、演示不中断。
无论是否配置 Key，**行程修改、风险评估、景点安全字段一律由规则引擎确定性计算**，不采信大模型输出。

> 微信云函数侧同样支持：在云函数控制台为 `itinerary`、`dialogue` 配置 `LLM_API_KEY` 等环境变量即可。

## 四、小程序对接后端

在 `miniprogram/config.js` 填入后端地址：

```js
module.exports = {
  API_BASE_URL: 'https://your-domain.com',  // ★ 公网后端地址
  API_TIMEOUT: 90000,
  CLOUD_ENV: '',                            // 微信云开发环境 ID（可选）
  USE_MOCK_FALLBACK: true
};
```

前端 `utils/api.js` 采用三级降级：**公网 HTTP 后端 → 微信云函数 → 本地模拟数据**，任一环节不可用都不会中断演示。
正式发布需在微信公众平台「开发设置 → 服务器域名」中加入该域名（必须 HTTPS）。

## 五、年龄段分层的核心业务流程

| 年龄段 | 流程 | 后端行为 |
|---|---|---|
| 6—17 岁 / 18—40 岁 | 通用规划流程 | 按天数/预算/兴趣编排常规行程，不做身体条件限制 |
| 41—60 岁 / 61 岁及以上 | **适老化专项业务流程** | 自动开启大字体 → 采集行动能力/基础疾病/无障碍需求/每日步行上限 → 规则引擎前置过滤 → 大模型生成轻量化行程 → 输出**独立风险评估报告** + **中老年专属贴士** |

规则引擎过滤维度：体力消耗等级、台阶数量、单点步行量、无障碍配套、人流量、休息点位；
并透明返回"哪些景点被剔除、为什么"，便于用户理解与信任。

## 六、自测

```bash
node server/scripts/selftest.js    # 后端业务链路（年龄段分流 / 规则引擎 / 行程 / 对话 / 持久化 / 双协议），63 项断言
node tools/check-wxml.js           # 前端 WXML 循环变量检查（防 wx:for-item 未声明导致的"空白气泡"类问题）
```

> `tools/check-wxml.js` 是踩坑后补的工具：WXML 的 `wx:for` 默认变量名是 `item`，
> 若模板里写了 `{{m.xxx}}` 却没声明 `wx:for-item="m"`，变量恒为 `undefined`，页面会渲染成**空白气泡且不报错**。

覆盖年龄段分流、规则引擎过滤、适老/通用行程生成、风险评估、专属贴士、多轮对话、快捷调整、
方案持久化、无 Key 场景下的 AI 接口行为、chat/responses 双协议适配，共 63 项断言。

## 七、常见问题

- **导入后提示找不到页面？** 请确认导入的是本目录（含 project.config.json），并已重新编译。
- **tabBar 无图标？** 微信 tabBar 的 iconPath 为可选项，本项目以文字为主，适配长辈大图标浏览。
- **后端端口被占用？** 设置环境变量 `PORT` 后重启，如 `PORT=8080 node server/index.js`。
- **云函数部署失败？** 每个云函数目录都是自包含的（含公共模块副本），确保以「云端安装依赖」方式上传。
- **单独部署 server 目录时提示找不到知识库？** 后端默认复用 `cloudfunctions/_shared/data.js`，
  请保持仓库目录结构，或用环境变量 `KNOWLEDGE_PATH` 指定知识库文件位置。

## 八、数据与知识库说明

- `cloudfunctions/_shared/data.js`：示范城市景点知识库（体力等级/无障碍/人流量/类型/步行量/休息点/就近医疗）+ 老年出行科普知识库。
- **单一数据源**：公网后端 `server/lib/knowledge.js` 与各云函数共用该文件，避免数据分叉。
- 升级路径：可替换为腾讯云向量数据库 + embedding 检索，字段结构保持不变。
