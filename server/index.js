/**
 * index.js - 智游康行·岁旅相伴 后端服务入口
 *
 * 启动：node server/index.js     （零依赖，Node 16+ 直接运行）
 * 部署：见 server/README.md（云托管 / 轻量服务器 / Docker 均可，公网可访问）
 */
const http = require('http');
const config = require('./config');
const { ROUTES, VERSION } = require('./routes');
const h = require('./lib/http');
const ai = require('./lib/aiProvider');
const knowledge = require('./lib/knowledge');

// 路由索引：method + path 精确匹配（本服务接口固定，无需正则路由）
const TABLE = {};
ROUTES.forEach((r) => {
  TABLE[r.method + ' ' + r.path] = r.handler;
});

function baseUrlOf(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || ('localhost:' + config.PORT);
  return proto + '://' + host;
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let url;
  try {
    url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  } catch (e) {
    h.sendJson(req, res, 400, { ok: false, error: '非法请求地址' });
    return;
  }
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  // CORS 预检
  if (req.method === 'OPTIONS') {
    h.sendNoContent(req, res);
    return;
  }

  const handler = TABLE[req.method + ' ' + pathname];
  if (!handler) {
    h.sendJson(req, res, 404, {
      ok: false,
      error: '接口不存在：' + req.method + ' ' + url.pathname,
      hint: '访问 GET / 查看完整接口清单'
    });
    return;
  }

  try {
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      body = await h.readJson(req);
    }
    if (!h.checkAuth(req, url, body)) {
      h.sendJson(req, res, 401, { ok: false, error: '未授权：请携带正确的 ACCESS_TOKEN', code: 'UNAUTHORIZED' });
      return;
    }
    await handler(req, res, body, { baseUrl: baseUrlOf(req), url: url });
    if (config.DEBUG) h.log(req.method, pathname, res.statusCode, (Date.now() - started) + 'ms');
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    if (status >= 500) h.log('ERROR', req.method, pathname, e && e.stack ? e.stack : e);
    if (!res.headersSent) {
      h.sendJson(req, res, status, {
        ok: false,
        error: (e && e.message) || String(e),
        code: (e && e.code) || 'INTERNAL_ERROR'
      });
    }
  }
});

server.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE') {
    h.log('端口被占用：' + config.PORT + '，请设置环境变量 PORT 使用其他端口后重试。');
  } else {
    h.log('服务启动失败：', e && e.message ? e.message : e);
  }
  process.exit(1);
});

/** 找出本机的局域网 IPv4（真机预览时手机需要用这个地址访问电脑） */
function lanUrls(port) {
  const os = require('os');
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((info) => {
      if (info && info.family === 'IPv4' && !info.internal) out.push('http://' + info.address + ':' + port);
    });
  });
  return out;
}

server.listen(config.PORT, config.HOST, () => {
  const st = ai.getStatus();
  const local = 'http://localhost:' + config.PORT;
  const lans = lanUrls(config.PORT);
  h.log('==========================================================');
  h.log('  ✅ 智游康行·岁旅相伴 后端服务 v' + VERSION + ' 已启动');
  h.log('');
  h.log('  ★★ 这就是你要填的「后端地址」，复制下面这行到');
  h.log('     miniprogram/config.js 覆盖掉 API_BASE_URL：');
  h.log('');
  h.log("      API_BASE_URL: '" + local + "',");
  if (lans.length) {
    h.log('');
    h.log('     真机预览（手机与电脑连同一个 WiFi）用这个：');
    h.log("      API_BASE_URL: '" + lans[0] + "',");
  } else {
    h.log('');
    h.log('     （未检测到局域网地址，真机预览请手动查本机 IP）');
  }
  h.log('');
  h.log('  大模型   ：' + (st.configured
    ? '已启用（' + st.providerLabel + ' · ' + st.model + ' · ' + st.protocol + ' 协议）'
    : '未配置 Key，当前走规则引擎兜底'));
  h.log('  知识库   ：' + knowledge.CITIES.length + ' 个地区板块 / ' + knowledge.ATTRACTIONS.length + ' 条景点');
  h.log('  接口清单 ：浏览器打开 ' + local + '/');
  h.log('  连通自检 ：node server/scripts/check-llm.js（另开一个终端执行）');
  h.log('  停止服务 ：Ctrl + C');
  h.log('==========================================================');
});

// 优雅退出（容器环境下可快速重建）
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    h.log('收到 ' + sig + '，正在关闭服务…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
});

module.exports = server;
