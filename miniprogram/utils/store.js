// store.js - 本地存储封装（方案历史、设置、用户资料）
const KEY_SETTINGS = 'settings';
const KEY_PROFILE = 'last_profile';
const KEY_PLANS = 'plans';          // 本地方案列表 [{id, title, city, days, risk, createdAt}]
const KEY_PLAN_BODY = 'plan_';      // plan_<id> 存完整方案
const KEY_PENDING = 'pending_plan'; // 生成中暂存（含 profile 与城市）
const KEY_AGE_GROUP = 'age_group';  // 已选年龄段（6-17 / 18-40 / 41-60 / 61+）
// 适老化自动放大前的用户原始显示设置（切回通用年龄段时用于还原）
const KEY_SETTINGS_BACKUP = 'settings_backup';

// 读取本地存储；未命中时返回 def
// ⚠️ 注意：未命中时返回的就是传入的 def 对象本身（同一引用）。
//    调用方若要修改返回值，请先克隆：Object.assign({}, store.get(key, def))
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
  KEY_SETTINGS, KEY_PROFILE, KEY_PLANS, KEY_PLAN_BODY, KEY_PENDING, KEY_AGE_GROUP, KEY_SETTINGS_BACKUP
};
