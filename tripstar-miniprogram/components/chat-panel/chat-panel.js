// components/chat-panel/chat-panel.js —— AI 行程智能问答悬浮窗
const i18n = require('../../utils/i18n')
const api = require('../../utils/api')

Component({
  properties: {
    plan: {
      type: Object,
      value: null
    }
  },

  data: {
    open: false,
    input: '',
    history: [],
    loading: false,
    scrollInto: '',
    titleText: '',
    welcomeText: '',
    placeholderText: '',
    sendText: '',
    quickQuestions: []
  },

  lifetimes: {
    attached() {
      this.updateI18n()
    }
  },

  methods: {
    t(key, params) {
      return i18n.t(key, params)
    },

    updateI18n() {
      const t = i18n.t
      this.setData({
        titleText: t('result.chat.title'),
        welcomeText: t('result.chat.welcome'),
        placeholderText: this.data.plan ? t('result.chat.placeholder') : t('result.noTripPlanDesc'),
        sendText: t('result.chat.send'),
        quickQuestions: [
          { label: t('result.chat.quickPriceLabel'), question: t('result.chat.quickPriceQuestion') },
          { label: t('result.chat.quickSuitabilityLabel'), question: t('result.chat.quickSuitabilityQuestion') },
          { label: t('result.chat.quickMealLabel'), question: t('result.chat.quickMealQuestion') }
        ]
      })
    },

    toggleChat() {
      this.setData({ open: !this.data.open })
    },

    onInput(e) {
      this.setData({ input: e.detail.value })
    },

    sendQuickQuestion(e) {
      const q = e.currentTarget.dataset.q
      this.setData({ input: q })
      this.sendMessage()
    },

    sendMessage() {
      const text = (this.data.input || '').trim()
      const plan = this.data.plan
      if (!text || this.data.loading || !plan) return

      const history = this.data.history.slice()
      history.push({ id: 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), role: 'user', content: text })
      this.setData({ history: history, input: '', loading: true, scrollInto: 'chatBottom' })

      api.askTripChat(text, plan, history.slice(0, -1))
        .then((res) => {
          const reply = (res && res.success && res.reply) ? res.reply : i18n.t('result.chat.replyFallback')
          const next = this.data.history.slice()
          next.push({ id: 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), role: 'assistant', content: reply })
          this.setData({ history: next, loading: false, scrollInto: 'chatBottom' })
        })
        .catch(() => {
          const next = this.data.history.slice()
          next.push({ id: 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), role: 'assistant', content: i18n.t('result.chat.networkError') })
          this.setData({ history: next, loading: false, scrollInto: 'chatBottom' })
        })
    }
  }
})
