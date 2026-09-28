// app.js - 智游康行·岁旅相伴 小程序入口
const config = require('./config');
const store = require('./utils/store');

App({
  globalData: {
    openid: '',
    userRole: 'elderly',
    fontScale: 1.2,      // 适老化默认大字体
    highContrast: false, // 高对比度默认关闭
    currentPlan: null    // 当前行程方案
  },

  onLaunch() {
    // 1. 初始化适老化设置（默认大字体、大按钮）
    const settings = store.get('settings', { fontScale: 1.2, highContrast: false });
    this.globalData.fontScale = settings.fontScale || 1.2;
    this.globalData.highContrast = !!settings.highContrast;

    // 2. 初始化云开发环境（config.CLOUD_ENV 为空时自动进入本地模拟模式，便于直接预览）
    if (config.CLOUD_ENV) {
      wx.cloud.init({
        env: config.CLOUD_ENV,
        traceUser: true
      });
      this.globalData.cloudReady = true;
      this._login();
    } else {
      this.globalData.cloudReady = false;
    }
  },

  _login() {
    // 微信 openid 登录（对应原项目邮箱注册/登录体系的微信化替代）
    wx.cloud.callFunction({ name: 'login', data: {} })
      .then((res) => {
        const r = res.result || {};
        if (r.ok) {
          this.globalData.openid = r.openid;
          this.globalData.userRole = r.role || 'elderly';
        }
      })
      .catch(() => {});
  },

  // 供页面读取适老化设置
  getSettings() {
    return {
      fontScale: this.globalData.fontScale,
      highContrast: this.globalData.highContrast,
      cloudReady: this.globalData.cloudReady
    };
  }
});
