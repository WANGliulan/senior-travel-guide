# 旅途星辰 TripStar · 微信小程序版

将原「TripStar」全栈项目（Vue3 前端 + FastAPI 后端）的**前端**完整改造为**微信小程序原生工程**，可直接导入微信开发者工具运行。

## 项目结构

```
tripstar-miniprogram/
├── project.config.json        # 微信开发者工具项目配置（编译即可）
├── app.json                   # 页面注册 / tabBar（规划·历史·设置）/ 全局窗口
├── app.js                     # 全局数据（行程、知识图谱、语言）
├── app.wxss                   # 暗黑玻璃拟物全局样式
├── sitemap.json
├── utils/
│   ├── i18n.js                # 中 / 英 / 日 多语言（含占位符插值）
│   ├── locales/zh.js|en.js|ja.js  # 三语字典
│   ├── api.js                 # wx.request 封装 + 全部后端接口
│   ├── storage.js             # 本地存储 / 运行时配置 / userId
│   └── format.js              # 日期·金额·天气·地图数据工具
├── pages/
│   ├── index/                 # 首页：目的地表单 + 偏好 + 进度轮询 + 历史
│   ├── result/                # 结果页：概览/预算/地图/每日行程/知识图谱/天气 + AI 问答
│   ├── history/               # 历史计划列表
│   └── settings/              # 运行时配置
└── components/
    ├── day-panel/             # 每日行程折叠面板（景点/酒店/餐饮/预约提醒）
    ├── budget-panel/          # 预算明细（筛选/排序/删除/复原/重算）
    ├── weather-panel/         # 天气面板（渐变主卡 + 周列表 + 详情）
    ├── knowledge-graph/       # canvas 知识图谱（布局 + 分类配色 + 图例）
    └── chat-panel/            # AI 行程问答悬浮窗（快速问题 + 流式问答）
```

## 功能对照（原 Web 版 → 小程序版）

| 原 Web 技术 | 小程序等价实现 |
| --- | --- |
| Vue3 + vue-router + Pinia | 原生 WXML/WXSS/JS + 页面路由 + globalData |
| Ant Design Vue（暗黑玻璃风） | 自定义 app.wxss 玻璃拟态样式还原 |
| vue-i18n（中/英/日） | utils/i18n.js + 三语字典 |
| axios | utils/api.js（wx.request 封装） |
| 高德地图 JS API | 微信原生 `<map>` 组件（markers + polyline），坐标仍由后端高德服务提供 |
| ECharts 知识图谱 | 原生 canvas 2d 力导向布局绘制 + 分类配色图例 |
| html2canvas / PDF 导出 | 小程序端以页面展示为准（导出入 README 说明） |
| AI 问答 WebSocket | POST /api/chat/ask（utils/api.askTripChat） |

## 快速开始

### 1. 启动后端（沿用原 FastAPI 后端，无需改动）

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 配置 OPENAI_API_KEY / AMAP 等
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> 小程序端作为纯客户端，通过 `wx.request` 访问该后端。后端地址在「设置」页配置，默认 `http://localhost:8000`。

### 2. 导入小程序

1. 打开 **微信开发者工具** → 导入项目
2. 目录选择本工程的 **`tripstar-miniprogram`** 文件夹
3. AppID 选择「测试号」或你的小程序 AppID（`project.config.json` 中已用 `touristappid` 占位）
4. 编译即可

### 3. 配置后端地址与密钥

- 打开小程序「设置」tab → 填入**后端地址**（如 `http://localhost:8000`）
- 其余密钥（高德 Web Key、OpenAI、小红书 Cookie 等）可在此页填写，保存后同步到后端 `/api/settings`
- 微信开发者工具中：详情 → 本地设置 → 勾选「不校验合法域名」（开发阶段用）

## 请求域名白名单（正式发布前）

小程序正式发布前，必须在 **mp.weixin.qq.com → 开发管理 → 服务器域名** 中添加：

- **request 合法域名**：你的后端 HTTPS 域名（如 `https://api.tripstar.example.com`）
- 后端必须启用 **HTTPS**（微信要求）且接口返回合法 CA 证书
- 开发阶段可在开发者工具中关闭「校验合法域名」避免拦截

## 关键差异与注意事项

1. **地图**：小程序使用微信原生 `<map>` 组件（腾讯地图底图），不加载高德 JS SDK。景点标记与按天连线直接由 `utils/format.js` 从行程 `location` 生成 `markers` / `polyline`。如需真实驾车/步行路线，可后续调用后端高德路由接口生成 polyline 注入。
2. **知识图谱**：`knowledge-graph` 组件用 canvas 2d 绘制（根节点居中 + 按分类环形布局 + 分类配色 + 图例），数据来自后端 `graph_data`。
3. **图片**：景点图经后端 `/api/poi/image` 代理（`utils/api.poiImageUrl`）。若某图不可达，前端显示占位。
4. **多语言**：右上角语言切换，三语字典完整，中/英/日全覆盖。
5. **预算编辑**：`budget-panel` 支持删除预算条目（同步移除关联行程项）、复原、筛选、排序，并实时重算汇总。

## 后端接口（小程序已封装）

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/trip/plan` | POST | 提交行程规划（返回 task_id） |
| `/api/trip/status/{task_id}` | GET | 轮询规划状态 / 结果 |
| `/api/trip/history` | GET | 历史计划 |
| `/api/settings` | GET/PUT | 运行时配置 |
| `/api/chat/ask` | POST | AI 行程问答 |
| `/api/memory/list` | GET | 用户记忆（可选） |
| `/api/poi/image` | GET | 景点图片代理 |
