/**
 * http.js - HTTP 工具层（CORS / JSON 响应 / 请求体解析 / 统一错误）
 * 零依赖：仅使用 Node 内置 http 模块能力，方便部署到任意云环境。
 */
const config = require('../config');

/** 统一 CORS 头（小程序 wx.request 不需要，但浏览器/评审直接访问与 H5 需要） */
function corsHeaders(req) {
  const origin = config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Access-Token',
    'Access-Control-Max-Age': '86400'
  };
}

function baseHeaders(req) {
  return Object.assign(
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    corsHeaders(req)
  );
}

/** 返回 JSON */
function sendJson(req, res, status, body) {
  const text = JSON.stringify(body, null, config.DEBUG ? 2 : 0);
  res.writeHead(status, baseHeaders(req));
  res.end(text);
}

/** 返回 HTML（服务说明页，便于大赛评审直接用浏览器访问） */
function sendHtml(req, res, status, html) {
  res.writeHead(status, Object.assign({}, corsHeaders(req), {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  }));
  res.end(html);
}

/** 处理 OPTIONS 预检 */
function sendNoContent(req, res) {
  res.writeHead(204, corsHeaders(req));
  res.end();
}

/** 解析 JSON 请求体（最大 2MB） */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(Object.assign(new Error('请求体过大'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : { value: parsed });
      } catch (e) {
        reject(Object.assign(new Error('请求体不是合法 JSON'), { status: 400 }));
      }
    });
    req.on('error', (e) => reject(e));
  });
}

/** 业务错误：带 HTTP 状态码 */
function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || 'BAD_REQUEST';
  return err;
}

/** 简单鉴权（config.ACCESS_TOKEN 为空时开放访问，方便公网评审） */
function checkAuth(req, url, body) {
  if (!config.ACCESS_TOKEN) return true;
  const header = req.headers['x-access-token'] || req.headers['authorization'] || '';
  const token = String(header).replace(/^Bearer\s+/i, '');
  const query = url.searchParams.get('token') || '';
  const bodyToken = (body && body.token) || '';
  return token === config.ACCESS_TOKEN || query === config.ACCESS_TOKEN || bodyToken === config.ACCESS_TOKEN;
}

/** 统一日志 */
function log() {
  const time = new Date().toISOString();
  console.log.apply(console, ['[' + time + ']'].concat(Array.prototype.slice.call(arguments)));
}

module.exports = {
  sendJson,
  sendHtml,
  sendNoContent,
  readJson,
  httpError,
  checkAuth,
  corsHeaders,
  log
};
