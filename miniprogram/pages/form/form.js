// pages/form/form.js - 老年出行信息表单（全单选/下拉/开关，减少手动打字）
const api = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    city: '',
    allCities: [],
    days: 3,
    dayOptions: [1, 2, 3, 4, 5, 6, 7],
    budget: '舒适型',
    budgetOptions: ['经济型', '舒适型', '品质型'],
    interests: [],
    interestsText: '',
    interestOptions: ['历史古迹', '民俗文化', '怀旧场景', '自然风光', '美食体验', '室内场馆'],
    mobility: '完全自理',
    mobilityOptions: ['完全自理', '需慢行', '需搀扶或轮椅'],
    chronic: [],
    chronicText: '',
    chronicOptions: ['高血压', '心脏病', '糖尿病'],
    joints: '正常',
    jointsOptions: ['正常', '轻微不便', '明显不便'],
    accessible: true,
    walkLimit: '1-3km',
    walkOptions: ['1km以内', '1-3km', '3-5km', '5km以上'],
    fillBy: '老人本人',
    fillOptions: ['老人本人', '子女代填'],
    fontScale: 16,
    highContrast: false,
    ready: false
  },

  onLoad(options) {
    this.applySettings();
    const fromProfile = options.from === 'profile';
    const last = store.get(store.KEY_PROFILE, null);
    if (fromProfile && last) {
      // 复用上次填写的身体信息（无需重复填写）
      this.setData({
        city: options.city || last.city || '',
        days: last.days || 3,
        budget: last.budget || '舒适型',
        interests: last.interests || [],
        interestsText: (last.interests && last.interests.length) ? '已选：' + last.interests.join('、') : '',
        mobility: last.mobility || '完全自理',
        chronic: last.chronic || [],
        chronicText: (last.chronic && last.chronic.length) ? '已选：' + last.chronic.join('、') + '（行程将自动加入相应提醒）' : '未选择慢性病',
        joints: last.joints || '正常',
        accessible: last.accessible === false ? false : true,
        walkLimit: last.walkLimit || '1-3km',
        fillBy: last.fillBy || '老人本人'
      });
    } else if (options.city) {
      this.setData({ city: decodeURIComponent(options.city) });
    }
    this.loadCities();
  },

  applySettings() {
    const s = getApp().getSettings();
    this.setData({ fontScale: Math.round(15 * (s.fontScale || 1.2)), highContrast: !!s.highContrast });
  },

  loadCities() {
    api.call('cities', {}).then((res) => {
      const all = [];
      (res.regions || []).forEach((r) => (r.cities || []).forEach((c) => all.push(c)));
      this.setData({ allCities: all, ready: true });
    }).catch(() => {
      this.setData({ ready: true });
    });
  },

  // ===== 表单交互 =====
  onCityChange(e) {
    this.setData({ city: this.data.allCities[e.detail.value] || '' });
  },
  onDaysChange(e) {
    this.setData({ days: this.data.dayOptions[e.detail.value] });
  },
  onBudget(e) {
    this.setData({ budget: e.currentTarget.dataset.value });
  },
  toggleInterest(e) {
    const v = e.currentTarget.dataset.value;
    const list = this.data.interests.slice();
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1); else list.push(v);
    this.setData({
      interests: list,
      interestsText: list.length ? '已选：' + list.join('、') : '未选择（按常规适老偏好推荐）'
    });
  },
  onMobility(e) {
    this.setData({ mobility: e.currentTarget.dataset.value });
  },
  toggleChronic(e) {
    const v = e.currentTarget.dataset.value;
    const list = this.data.chronic.slice();
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1); else list.push(v);
    this.setData({
      chronic: list,
      chronicText: list.length ? '已选：' + list.join('、') + '（行程将自动加入相应提醒）' : '未选择慢性病'
    });
  },
  onJoints(e) {
    this.setData({ joints: e.currentTarget.dataset.value });
  },
  onAccessible(e) {
    this.setData({ accessible: e.detail.value });
  },
  onWalk(e) {
    this.setData({ walkLimit: e.currentTarget.dataset.value });
  },
  onFillBy(e) {
    this.setData({ fillBy: e.currentTarget.dataset.value });
  },

  // 生成行程
  submit() {
    const d = this.data;
    if (!d.city) {
      wx.showToast({ title: '请先选择出行城市', icon: 'none' });
      return;
    }
    if (d.interests.length === 0) {
      wx.showToast({ title: '请至少选择一项兴趣偏好', icon: 'none' });
      return;
    }
    const profile = {
      city: d.city,
      days: d.days,
      budget: d.budget,
      interests: d.interests,
      mobility: d.mobility,
      chronic: d.chronic,
      joints: d.joints,
      accessible: d.accessible,
      walkLimit: d.walkLimit,
      fillBy: d.fillBy
    };
    // 保存身体信息，下次免重复填写
    store.set(store.KEY_PROFILE, profile);
    store.set(store.KEY_PENDING, profile);
    wx.navigateTo({ url: '/pages/generating/generating' });
  }
});
