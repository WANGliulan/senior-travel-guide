// components/day-panel/day-panel.js —— 每日行程折叠面板
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
    days: [],
    // 文案（随语言更新）
    transferDayText: '',
    transferInfoText: '',
    descLabel: '',
    transportLabel: '',
    accommodationLabel: '',
    attractionTitleText: '',
    addressLabel: '',
    durationLabel: '',
    ratingLabel: '',
    minuteUnitText: '',
    reservationRequiredText: '',
    hotelTitleText: '',
    typeLabel: '',
    priceRangeLabel: '',
    distanceLabel: '',
    mealsTitleText: '',
    mealLabels: {}
  },

  observers: {
    'plan': function (plan) {
      if (plan && plan.days) {
        this.buildDays(plan)
      }
    }
  },

  lifetimes: {
    attached() {
      this.updateI18n()
      const plan = this.data.plan
      if (plan && plan.days) this.buildDays(plan)
    }
  },

  methods: {
    t(key, params) {
      return i18n.t(key, params)
    },

    updateI18n() {
      const t = i18n.t
      this.setData({
        transferDayText: t('result.transferDay'),
        transferInfoText: t('result.transferInfo'),
        descLabel: t('result.dayDescription'),
        transportLabel: t('result.dayTransport'),
        accommodationLabel: t('result.dayAccommodation'),
        attractionTitleText: t('result.attractionTitle'),
        addressLabel: t('result.fieldAddress'),
        durationLabel: t('result.fieldVisitDuration'),
        ratingLabel: t('result.fieldRating'),
        minuteUnitText: t('result.minuteUnit'),
        reservationRequiredText: t('result.reservationRequired'),
        hotelTitleText: t('result.hotelTitle'),
        typeLabel: t('result.fieldType'),
        priceRangeLabel: t('result.fieldPriceRange'),
        distanceLabel: t('result.fieldDistance'),
        mealsTitleText: t('result.mealsTitle'),
        mealLabels: {
          breakfast: t('result.meals.breakfast'),
          lunch: t('result.meals.lunch'),
          dinner: t('result.meals.dinner'),
          snack: t('result.meals.snack')
        }
      })
    },

    buildDays(plan) {
      const mealLabels = this.data.mealLabels
      const days = plan.days.map((day, dayIndex) => {
        const d = Object.assign({}, day, {
          day_index: dayIndex,
          dayNumberText: i18n.t('common.dayNumber', { day: dayIndex + 1 }),
          open: dayIndex === 0
        })
        d.meals = (day.meals || []).map((meal) => {
          return Object.assign({}, meal, { label: mealLabels[meal.type] || meal.type })
        })
        d.attractions = (day.attractions || []).map((attr) => {
          return Object.assign({}, attr, {
            image: api.poiImageUrl(attr.name)
          })
        })
        return d
      })
      this.setData({ days: days })
    },

    toggleDay(e) {
      const index = Number(e.currentTarget.dataset.index)
      const days = this.data.days.slice()
      if (days[index]) {
        days[index] = Object.assign({}, days[index], { open: !days[index].open })
      }
      this.setData({ days: days })
    },

    onImageError() {
      // 忽略图片加载失败，保持占位
    },

    scrollToDay(dayIndex) {
      const days = this.data.days.slice()
      if (days[dayIndex]) {
        days[dayIndex] = Object.assign({}, days[dayIndex], { open: true })
      }
      this.setData({ days: days })
    }
  }
})
