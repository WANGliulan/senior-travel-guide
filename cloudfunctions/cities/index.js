// 云函数：cities - 地区板块与城市列表（对应首页地区板块大卡片）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { CITIES } = require('./data');

exports.main = async (event) => {
  try {
    return { ok: true, regions: CITIES };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
