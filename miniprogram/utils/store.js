// store.js - 本地存储封装（方案历史、设置、用户资料）
const KEY_SETTINGS = 'settings';
const KEY_PROFILE = 'last_profile';
const KEY_PLANS = 'plans';          // 本地方案列表 [{id, title, city, days, risk, createdAt}]
const KEY_PLAN_BODY = 'plan_';      // plan_<id> 存完整方案
const KEY_PENDING = 'pending_plan'; // 生成中暂存（含 profile 与城市）

function get(key, def) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined ? def : v;
  } catch (e) {
    return def;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (e) {}
}

module.exports = {
  get, set, remove,
  KEY_SETTINGS, KEY_PROFILE, KEY_PLANS, KEY_PLAN_BODY, KEY_PENDING
};
