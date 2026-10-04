/**
 * store.js - 方案持久化（轻量 JSON 文件存储，零依赖）
 *
 * 为什么不用数据库：大赛演示环境要求"开箱即跑、公网可访问"，
 * 文件存储无外部依赖、可随容器一起迁移；如需生产级持久化，
 * 只需替换本文件的 4 个方法实现（save/list/get/remove），上层业务代码无需改动。
 *   - 云数据库（如腾讯云 CloudBase / MongoDB）：把 read/write 换成对应 SDK 调用即可。
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const FILE = path.join(config.DATA_DIR, 'plans.json');
let cache = null;
let writing = false;

function ensureDir() {
  try {
    if (!fs.existsSync(config.DATA_DIR)) fs.mkdirSync(config.DATA_DIR, { recursive: true });
  } catch (e) {
    /* 目录已存在或无权限，写入时会给出明确报错 */
  }
}

function load() {
  if (cache) return cache;
  ensureDir();
  try {
    if (fs.existsSync(FILE)) {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (!Array.isArray(cache)) cache = [];
    } else {
      cache = [];
    }
  } catch (e) {
    cache = [];
  }
  return cache;
}

function persist() {
  if (writing) return;
  writing = true;
  try {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(load(), null, 2), 'utf8');
  } catch (e) {
    // 只读环境（如部分 Serverless）下降级为内存存储，不影响接口可用
  }
  writing = false;
}

function nextId() {
  return 'plan_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * 保存方案（同一用户同一行程重复保存则更新）
 * @param {object} plan 行程对象
 * @param {{id?:string, openid?:string}} [opts]
 */
function save(plan, opts) {
  const o = opts || {};
  const list = load();
  const openid = o.openid || 'anonymous';
  const now = new Date().toISOString();

  if (o.id) {
    const idx = list.findIndex((p) => p.id === o.id);
    if (idx >= 0) {
      list[idx] = Object.assign({}, list[idx], {
        title: plan.title,
        city: plan.city,
        days: plan.days,
        profile: plan.profile,
        schedule: plan.schedule,
        risk: plan.risk,
        tips: plan.tips,
        updatedAt: now
      });
      persist();
      return { id: o.id, updated: true };
    }
  }

  const id = o.id || nextId();
  list.unshift({
    id: id,
    openid: openid,
    title: plan.title,
    city: plan.city,
    days: plan.days,
    risk: plan.risk,
    mode: (plan.risk && plan.risk.mode) || (plan.profile && plan.profile.mode) || 'senior',
    ageGroup: (plan.profile && plan.profile.ageGroup) || '',
    profile: plan.profile,
    schedule: plan.schedule,
    tips: plan.tips,
    createdAt: now,
    updatedAt: now
  });
  // 说明：risk 以对象整体存储（含 level/items/dimensions/filters），列表接口只取 level
  // 单用户最多保留 50 条
  const mine = list.filter((p) => p.openid === openid);
  if (mine.length > 50) {
    const drop = mine.slice(50).map((p) => p.id);
    cache = list.filter((p) => drop.indexOf(p.id) < 0);
  }
  persist();
  return { id: id, updated: false };
}

/** 方案列表（按用户，时间倒序） */
function list(openid) {
  const oid = openid || 'anonymous';
  return load()
    .filter((p) => p.openid === oid)
    .map((p) => ({
      id: p.id,
      title: p.title,
      city: p.city,
      days: p.days,
      risk: (p.risk && p.risk.level) ? p.risk.level : (typeof p.risk === 'string' ? p.risk : '低'),
      mode: p.mode,
      ageGroup: p.ageGroup,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));
}

/** 方案详情 */
function get(id, openid) {
  const oid = openid || 'anonymous';
  const hit = load().find((p) => p.id === id && p.openid === oid);
  return hit || null;
}

/** 删除 */
function remove(id, openid) {
  const oid = openid || 'anonymous';
  const list0 = load();
  const rest = list0.filter((p) => !(p.id === id && p.openid === oid));
  if (rest.length === list0.length) return false;
  cache = rest;
  persist();
  return true;
}

module.exports = { FILE, save, list, get, remove };
