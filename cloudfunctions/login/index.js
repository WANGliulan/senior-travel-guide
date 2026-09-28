// 云函数：login - 获取微信 openid，识别用户身份（对应原 NextAuth 鉴权）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext();
  try {
    const users = db.collection('users');
    const existing = await users.where({ _openid: OPENID }).limit(1).get();
    if (existing.data.length === 0) {
      await users.add({
        data: {
          _openid: OPENID,
          nickname: (event && event.nickname) || '新用户',
          role: (event && event.role) || 'elderly', // elderly:老人本人, child:子女代填
          createdAt: db.serverDate()
        }
      });
    }
    return { ok: true, openid: OPENID, appid: APPID, unionid: UNIONID || '' };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
