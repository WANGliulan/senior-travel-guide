// pages/index/index.js - 智能体首页：年龄段选择 + 自由对话 + 快捷服务模块
const api = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    allCities: [],
    quickChips: ['生成行程', '给我出行贴士', '去北京玩3天', '看看我的方案'],
    fontScale: 16,
    highContrast: false,
    // 规划流程起始的年龄段选择（4 组数字区间）
    ageGroups: [
      { id: '6-17', label: '6—17 岁', desc: '通用规划' },
      { id: '18-40', label: '18—40 岁', desc: '通用规划' },
      { id: '41-60', label: '41—60 岁', desc: '适老化规划' },
      { id: '61+', label: '61 岁及以上', desc: '适老化规划 · 大字模式' }
    ],
    ageGroup: '',
    ageLabel: '',
    seniorFlow: false,
    // 年龄段选择结果提示（显示在卡片下方的提示条里，不再往对话区追加消息）
    ageNotice: '',
    // 智能助手回复来源标识（大模型在线 / 规则兜底）
    aiBadge: '',
    dataSource: 'mock',
    quickServices: [
      { key: 'plan', label: '生成行程', desc: '定制适老行程' },
      { key: 'settings', label: '显示设置', desc: '字体与对比度' }
    ]
  },

  onLoad() {
    this.applySettings();
    this.loadCities();
    const ageGroup = store.get(store.KEY_AGE_GROUP, '');
    const senior = ageGroup === '41-60' || ageGroup === '61+';
    const dataSource = api.dataSource();
    this.setData({
      ageGroup: ageGroup,
      ageLabel: this._ageLabelOf(ageGroup),
      // 恢复上次选择的年龄段状态，避免重进页面后判断错「是否已处于适老模式」
      seniorFlow: senior,
      ageNotice: ageGroup ? this._noticeOf(ageGroup, senior) : '',
      dataSource: dataSource,
      // 离线时先把状态亮出来，点击可看「如何接入大模型」
      aiBadge: dataSource === 'mock' ? '离线演示' : ''
    });
    this._greet();
    console.log('[智能助手] 初始化完成', {
      数据源: this.data.dataSource,
      消息数: this.data.messages.length,
      首条字数: String((this.data.messages[0] || {}).content || '').length
    });
  },

  onShow() {
    this.applySettings();
  },

  applySettings() {
    const s = getApp().getSettings();
    this.setData({ fontScale: Math.round(15 * (s.fontScale || 1.2)), highContrast: !!s.highContrast });
  },

  loadCities() {
    api.call('cities', {}).then((res) => {
      const all = [];
      (res.regions || []).forEach((r) => (r.cities || []).forEach((c) => all.push(c)));
      this.setData({ allCities: all });
    }).catch(() => {});
  },

  // ===== 年龄段选择：决定进入「通用规划」还是「适老化专项业务流程」 =====
  // 说明：无论选哪一组年龄段都会同步刷新显示设置 ——
  //   41 岁以上 → 自动放大字体（首次进入前先备份用户自己的显示偏好）；
  //   6-17 / 18-40 → 还原用户原本的显示偏好，避免停留在适老大字模式。
  onPickAge(e) {
    const id = e.currentTarget.dataset.id;
    const app = getApp();
    const DEFAULT_SETTINGS = { fontScale: 1.2, highContrast: false };
    // 已经从适老切到通用时，不重复备份
    const wasSenior = !!this.data.seniorFlow;

    // ★ 幂等：重复点击同一个年龄段直接忽略，避免每次都触发一遍流程
    if (id === this.data.ageGroup) {
      wx.showToast({ title: '当前已是该年龄段', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在切换…', mask: true });
    api.call('ageResolve', { ageGroup: id })
      .then((res) => {
        wx.hideLoading();
        store.set(store.KEY_AGE_GROUP, id);
        const senior = !!res.seniorFlow;
        const label = res.ageLabel || this._ageLabelOf(id);
        this.setData({
          ageGroup: id,
          ageLabel: label,
          seniorFlow: senior,
          // ★ 反馈放在卡片下方的提示条里，不再往对话区追加消息（否则每点一次就多一块）
          ageNotice: this._noticeOf(id, senior)
        });

        // ⚠️ 必须克隆：store.get 返回的是传入默认对象的同一引用，
        //    若直接在其上改 fontScale，会把已保存的备份一起改坏。
        const current = Object.assign({}, store.get(store.KEY_SETTINGS, DEFAULT_SETTINGS));
        let settings;
        if (senior) {
          // 41 岁以上：自动开启大字体（首次进入适老模式时备份用户原有偏好）
          if (!wasSenior) {
            store.set(store.KEY_SETTINGS_BACKUP, Object.assign({}, current));
          }
          settings = {
            fontScale: res.fontScale || 1.25,
            highContrast: !!res.highContrast
          };
        } else {
          // 6-17 / 18-40：还原进入适老化之前用户自己的显示偏好
          const backup = store.get(store.KEY_SETTINGS_BACKUP, null);
          settings = Object.assign({}, backup || DEFAULT_SETTINGS);
          store.remove(store.KEY_SETTINGS_BACKUP);
        }
        store.set(store.KEY_SETTINGS, settings);
        app.globalData.fontScale = settings.fontScale || 1.2;
        app.globalData.highContrast = !!settings.highContrast;
        this.applySettings();

        wx.showToast({
          title: senior ? '已开启适老化模式' : '已退出适老化模式',
          icon: 'success',
          duration: 1200
        });
      })
      .catch(() => {
        wx.hideLoading();
        store.set(store.KEY_AGE_GROUP, id);
        const senior = id === '41-60' || id === '61+';
        this.setData({
          ageGroup: id,
          ageLabel: this._ageLabelOf(id),
          seniorFlow: senior,
          ageNotice: this._noticeOf(id, senior)
        });
      });
  },

  // 年龄段展示名
  _ageLabelOf(id) {
    const hit = (this.data.ageGroups || []).filter((g) => g.id === id)[0];
    return hit ? hit.label : '';
  },

  // 卡片下方的提示条文案（替代原先往对话区追加的长消息）
  _noticeOf(id, senior) {
    const label = this._ageLabelOf(id) || id;
    if (senior) {
      return '已开启适老化模式（大字模式）· 当前：' + label +
        '　接下来将采集行动能力 / 基础疾病 / 无障碍需求 / 每日步行上限，' +
        '并优先过滤高体力消耗、无无障碍配套的景点。';
    }
    return '已进入通用规划流程 · 当前：' + label + '　填写出行信息即可生成行程。';
  },

  _greet() {
    // 首屏不自动滚到底部：让用户先看到"选择年龄段"的卡片
    this._push({
      role: 'assistant',
      content: '您好，我是"智游康行"的旅游规划智能助手。\n\n您可以直接和我聊天，例如：\n· "杭州有什么好玩的？"\n· "老人出门要带哪些东西？"\n· "去西安玩三天怎么安排？"\n\n也可以先选好年龄段，我按您的身体条件生成正式行程，并附上行程风险评估与专属出行贴士。'
    }, { scroll: false });
  },

  _push(msg, opts) {
    const o = opts || {};
    const item = this._normalizeMessage(Object.assign({}, msg, { id: this._nextId() }));
    const messages = this.data.messages.concat([item]);
    const patch = { messages: messages };
    // 用「每条消息自己的 id」作为滚动锚点：值每次都不同，scroll-into-view 才会真正触发
    if (o.scroll !== false) patch.scrollTo = 'msg-' + item.id;
    this.setData(patch);
  },

  // 保证每条消息都"有字可显示"：content 强制为字符串且非空，actions 强制为数组
  _normalizeMessage(m) {
    const out = Object.assign({}, m);
    out.content = (out.content === undefined || out.content === null) ? '' : String(out.content);
    if (!out.typing && !out.content.trim()) {
      out.content = '（这条回复内容为空，请再说一次，或点击下方"生成行程"）';
    }
    out.actions = Array.isArray(out.actions) ? out.actions : [];
    return out;
  },

  // 回复看门狗：宁可给出兜底话术，也不让"正在思考…"一直挂着
  _clearWatchdog() {
    if (this._watchdog) {
      clearTimeout(this._watchdog);
      this._watchdog = null;
    }
  },

  // 严格唯一的消息 id：避免同一毫秒内连续插入导致 wx:key 重复、列表渲染错位
  _nextId() {
    this._seq = (this._seq || 0) + 1;
    return Date.now() + '-' + this._seq;
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  // ===== 发送指令 =====
  send() {
    const text = (this.data.input || '').trim();
    if (!text || this.data.sending) return;
    this._push({ role: 'user', content: text });
    this.setData({ input: '', sending: true });
    this._push({ role: 'assistant', content: '…', typing: true });
    // 看门狗：45 秒内没有回复就兜底，避免"正在思考…"一直挂着像卡死
    this._clearWatchdog();
    this._watchdog = setTimeout(() => {
      if (!this.data.sending) return;
      console.warn('[智能助手] 回复超时（45s），已给出兜底提示');
      this._reply('抱歉，这次回复等太久了。您可以再问一次，或直接点击下方"生成行程"。');
    }, 45000);
    this._route(text);
  },

  _route(text) {
    // 唯一保留的本地快捷指令：需要跳页，交给智能体反而绕
    if (/(我的方案|我的行程|历史行程|保存的方案)/.test(text)) {
      this._reply('好的，已带您到"我的方案"，那里保存了您生成的所有行程。');
      wx.switchTab({ url: '/pages/history/history' });
      return;
    }

    // ★ 主路径：所有对话都交给大模型智能体
    //    携带「多轮历史 + 当前行程 + 年龄段与身体约束」，让它有上下文、有依据地回答
    const history = this.data.messages
      .filter((m) => !m.typing)
      .map((m) => ({ role: m.role, content: m.content }));
    const stored = store.get(store.KEY_PROFILE, null) || {};
    const profile = Object.assign({}, stored, {
      ageGroup: this.data.ageGroup || stored.ageGroup || ''
    });

    api.call('dialogue', {
      messages: history,
      plan: getApp().globalData.currentPlan || null,
      profile: profile
    })
      .then((res) => {
        // 便于定位问题：在开发者工具 Console 里能直接看到这次回复的字数与来源
        console.log('[智能助手] 对话返回', {
          llmUsed: !!res.llmUsed,
          replyType: typeof res.reply,
          replyLength: String(res.reply === undefined ? '' : res.reply).length
        });
        const reply = res.reply || '收到，还有什么可以帮您？';
        this._reply(reply, this._actionsFor(text, reply));
        this.setData({ aiBadge: res.llmUsed ? '大模型在线' : '规则兜底' });
      })
      .catch(() => {
        this._localRoute(text);
      });
  },

  // 点角标 → 说明当前回复是谁生成的、以及如何接入大模型
  onTapBadge() {
    const src = this.data.dataSource;
    if (src === 'http' || src === 'cloud') {
      wx.showModal({
        title: src === 'http' ? '已连接后端服务' : '已连接微信云开发',
        content: '对话会优先走大模型。\n\n若角标显示「规则兜底」，说明大模型未配置 Key 或调用失败（会自动降级，功能不受影响）。\n可在浏览器打开后端地址的 /api/ai/status 查看具体原因。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    wx.showModal({
      title: '当前是「离线演示模式」',
      content: '还没连上后端，回复由本地规则生成，所以比较"套路"、不够智能。\n\n两步开启大模型：\n' +
        '① 项目根目录执行：node server/index.js\n' +
        '② 把 miniprogram/config.js 的 API_BASE_URL 填成后端地址（如 http://localhost:3000）\n\n' +
        '重新编译后，角标会变成「大模型在线」，回复就由大模型生成了。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 对话里出现城市 → 给回复挂一个「开始生成XX行程」按钮，衔接正式规划
  _actionsFor(text, reply) {
    const city = this._findCity(text) || this._findCity(reply);
    return city ? [{ label: '开始生成' + city + '行程', city: city }] : [];
  },

  // 兜底路由（大模型与后端都不可用时使用，保证仍能对话与导航）
  _localRoute(text) {
    const city = this._findCity(text);
    if (city) {
      this._reply(
        '好的，为您规划【' + city + '】的行程。\n请点击下方按钮填写出行信息，我会按您的年龄段与身体条件生成方案。',
        [{ label: '开始生成' + city + '行程', city: city }]
      );
      return;
    }
    if (/(贴士|注意|忌口|天气|穿衣|药品|携带|健康|血压|血糖|证件)/.test(text)) {
      this._reply(this._tipsText());
      return;
    }
    if (/(行程|规划|攻略|旅游|去|玩|出行|路线)/.test(text)) {
      this._reply(
        '好的，我可以帮您生成行程。\n请告诉我目的地城市（例如"我想去杭州玩3天"），或直接点击下方"生成行程"。',
        [{ label: '生成行程', city: '' }]
      );
      return;
    }
    if (/(你好|您好|在吗|嗨|hello|hi)/i.test(text)) {
      this._reply('您好呀！我是您的出行助手。您可以问我任何旅游问题，比如"杭州有什么好玩的"、"老人出门要带什么"。');
      return;
    }
    this._reply('抱歉，网络开小差了，请稍后再试。也可以直接点击下方"生成行程"先填写出行信息。');
  },

  _findCity(text) {
    if (!text) return null;
    const hits = this.data.allCities.filter((c) => text.indexOf(c) >= 0);
    return hits.length ? hits[hits.length - 1] : null;
  },

  _reply(content, actions) {
    this._clearWatchdog();
    const item = this._normalizeMessage({ role: 'assistant', content: content, actions: actions || [] });
    // 无条件移除"正在思考…"占位，再追加真正的回复（避免占位残留或空白气泡）
    const msgs = this.data.messages.filter((m) => !m.typing);
    msgs.push(Object.assign({}, item, { id: this._nextId() }));
    this.setData({
      messages: msgs,
      sending: false,
      scrollTo: 'msg-' + msgs[msgs.length - 1].id
    });
    console.log('[智能助手] 已渲染回复', { 字数: item.content.length, 预览: item.content.slice(0, 30) });
  },

  _tipsText() {
    return '为您整理的老年出行小贴士：\n' +
      '· 休息：每日安排 1-2 次茶歇，午后适当午休\n' +
      '· 医疗：出发前确认沿途医院药店；慢病随身带药、按时服药\n' +
      '· 饮食：清淡少油盐；高血压少盐、糖尿病定时定量、心脏病七分饱\n' +
      '· 天气：早晚温差大带薄外套；晴天防晒、雨天防滑\n' +
      '· 随身：常用药+病历摘要+急救卡、身份证/老年证、保温杯、舒适防滑鞋\n' +
      '如需更贴合您身体状况的建议，可先生成一份行程，我会在贴士中自动加入您的忌口与提醒。';
  },

  // 消息中的快捷操作按钮
  onMsgAction(e) {
    const city = e.currentTarget.dataset.city || '';
    const age = this.data.ageGroup ? ('age=' + encodeURIComponent(this.data.ageGroup) + '&') : '';
    wx.navigateTo({ url: '/pages/form/form?' + age + (city ? ('city=' + encodeURIComponent(city)) : '') });
  },

  // ===== 快捷服务模块 =====
  onService(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'plan') {
      wx.navigateTo({ url: '/pages/form/form' + (this.data.ageGroup ? ('?age=' + encodeURIComponent(this.data.ageGroup)) : '') });
    } else if (key === 'settings') {
      wx.switchTab({ url: '/pages/settings/settings' });
    }
  },

  onQuick(e) {
    this.setData({ input: e.currentTarget.dataset.text });
    this.send();
  }
});
