/**
 * knowledge.js - 知识库访问层（知识库检索）
 *
 * 单一数据源原则：默认直接复用云函数公共知识库
 *   cloudfunctions/_shared/data.js （景点：体力等级/无障碍/人流/类型/步行量/休息点/就近医疗 + 老年出行科普）
 * 这样「微信云开发云函数」与「公网 HTTP 后端」两种部署形态共用同一份知识库，避免数据分叉。
 *
 * 升级路径（字段结构不变）：
 *   接入向量数据库 / embedding 检索时，只需让本模块的 search() 返回同样结构的数组即可。
 */
const fs = require('fs');
const path = require('path');

const CANDIDATES = [
  process.env.KNOWLEDGE_PATH,
  path.join(__dirname, '..', '..', 'cloudfunctions', '_shared', 'data.js'),
  path.join(__dirname, 'knowledge.data.js')
].filter(Boolean);

let data = null;
let loadedFrom = '';
for (const file of CANDIDATES) {
  try {
    if (fs.existsSync(file)) {
      data = require(file);
      loadedFrom = file;
      break;
    }
  } catch (e) {
    /* 尝试下一个候选路径 */
  }
}

if (!data || !Array.isArray(data.ATTRACTIONS)) {
  throw new Error(
    '未找到知识库文件。请设置环境变量 KNOWLEDGE_PATH 指向 cloudfunctions/_shared/data.js，' +
    '或确保仓库目录结构完整（server 与 cloudfunctions 同级）。'
  );
}

const CITIES = data.CITIES || [];
const ATTRACTIONS = data.ATTRACTIONS || [];
const ELDERLY_TIPS = data.ELDERLY_TIPS || {};

// ---------- 台阶数推断 ----------
// 知识库暂未单列台阶字段时，按景点描述与体力等级做保守推断；
// 后续若补充实测字段 stairCount，直接启用实测值（字段升级向下兼容）。
const STAIRS_HEAVY_KEYS = ['台阶较多', '台阶多', '登塔', '登山', '登顶', '爬', '坡', '攀'];
const STAIRS_OK_KEYS = ['电梯', '平缓', '平坦', '无障碍'];

function stairsOf(spot) {
  if (spot.stairCount !== undefined) {
    const n = Number(spot.stairCount);
    return n >= 80 ? '多' : (n >= 20 ? '中' : '无');
  }
  const text = String((spot.tips || '') + (spot.desc || ''));
  if (STAIRS_OK_KEYS.some((k) => text.indexOf(k) >= 0)) return '无';
  if (STAIRS_HEAVY_KEYS.some((k) => text.indexOf(k) >= 0)) return '多';
  return spot.level === '高' ? '多' : (spot.level === '中' ? '中' : '无');
}

/** 按城市取景点（知识库检索基础能力） */
function byCity(city) {
  return ATTRACTIONS.filter((s) => s.city === city);
}

/** 关键词检索（可平滑替换为向量检索） */
function search(city, keyword) {
  const list = byCity(city);
  if (!keyword) return list;
  const k = String(keyword);
  return list.filter((s) => (s.name + s.type + s.desc).indexOf(k) >= 0);
}

/** 补全台阶字段后的景点视图（不修改原知识库对象） */
function enrich(spot) {
  return Object.assign({}, spot, { stairs: spot.stairs || stairsOf(spot) });
}

module.exports = {
  CITIES,
  ATTRACTIONS,
  ELDERLY_TIPS,
  loadedFrom,
  byCity,
  search,
  stairsOf,
  enrich
};
