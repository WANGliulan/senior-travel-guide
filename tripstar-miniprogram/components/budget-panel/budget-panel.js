// components/budget-panel/budget-panel.js —— 预算明细与汇总
const i18n = require('../../utils/i18n')
const format = require('../../utils/format')

function deepClone(data) {
  return JSON.parse(JSON.stringify(data))
}

Component({
  properties: {
    plan: {
      type: Object,
      value: null
    }
  },

  data: {
    // 文案
    titleText: '',
    attractionText: '',
    hotelText: '',
    mealText: '',
    transportText: '',
    filterLabel: '',
    sortLabel: '',
    typeHeader: '',
    dayHeader: '',
    nameHeader: '',
    amountHeader: '',
    deleteText: '',
    noDetailsText: '',
    pendingTitle: '',
    restoreText: '',
    // 筛选/排序选项
    filterOptions: [],
    filterIndex: 0,
    sortOptions: [],
    sortIndex: 0,
    // 数据
    summary: { totalText: '0', attractionText: '0', hotelText: '0', mealText: '0', transportText: '0' },
    allItems: [],
    filteredItems: [],
    pendingItems: [],
    // 删除项的深拷贝（用于复原）：{ [uid]: payload }
    restorePayloads: {}
  },

  observers: {
    'plan': function (plan) {
      if (plan && plan.days) {
        this.buildItems(plan)
        this.applyFilterSort()
      }
    }
  },

  lifetimes: {
    attached() {
      this.updateI18n()
      const plan = this.data.plan
      if (plan && plan.days) {
        this.buildItems(plan)
        this.applyFilterSort()
      }
    }
  },

  methods: {
    t(key, params) {
      return i18n.t(key, params)
    },

    formatAmount(value) {
      return format.formatBudgetAmount(value)
    },

    updateI18n() {
      const t = i18n.t
      this.setData({
        titleText: t('result.budget.title'),
        attractionText: t('result.budget.attraction'),
        hotelText: t('result.budget.hotel'),
        mealText: t('result.budget.meal'),
        transportText: t('result.budget.transport'),
        filterLabel: t('result.budget.filterLabel'),
        sortLabel: t('result.budget.sortLabel'),
        typeHeader: t('result.budget.detailType'),
        dayHeader: t('result.budget.detailDay'),
        nameHeader: t('result.budget.detailName'),
        amountHeader: t('result.budget.detailAmount'),
        deleteText: t('common.delete'),
        noDetailsText: t('result.budget.noDetails'),
        pendingTitle: t('result.budget.pendingTitle'),
        restoreText: t('result.budget.restore'),
        filterOptions: [
          { value: 'all', label: t('result.budget.filterAll') },
          { value: 'attraction', label: t('result.budget.attraction') },
          { value: 'hotel', label: t('result.budget.hotel') },
          { value: 'meal', label: t('result.budget.meal') },
          { value: 'transport', label: t('result.budget.transport') }
        ],
        sortOptions: [
          { value: 'amountDesc', label: t('result.budget.sortAmountDesc') },
          { value: 'amountAsc', label: t('result.budget.sortAmountAsc') },
          { value: 'dayAsc', label: t('result.budget.sortDayAsc') },
          { value: 'dayDesc', label: t('result.budget.sortDayDesc') }
        ]
      })
    },

    // 构建预算明细
    buildItems(plan) {
      const t = i18n.t
      const items = []
      const typeLabels = {
        attraction: t('result.budget.attraction'),
        hotel: t('result.budget.hotel'),
        meal: t('result.budget.meal'),
        transport: t('result.budget.transport')
      }
      const mealLabels = {
        breakfast: t('result.meals.breakfast'),
        lunch: t('result.meals.lunch'),
        dinner: t('result.meals.dinner'),
        snack: t('result.meals.snack')
      }

      ;(plan.days || []).forEach((day, dayIndex) => {
        const dayNumber = dayIndex + 1
        ;(day.attractions || []).forEach((attraction, attractionIndex) => {
          const amount = format.roundBudgetAmount(format.toBudgetNumber(attraction.ticket_price))
          if (amount <= 0) return
          items.push({
            id: 'attraction-' + dayIndex + '-' + attractionIndex,
            type: 'attraction',
            typeLabel: typeLabels.attraction,
            dayIndex: dayIndex,
            dayNumber: dayNumber,
            name: attraction.name,
            amount: amount,
            sourceIndex: attractionIndex
          })
        })

        if (day.hotel) {
          const amount = format.roundBudgetAmount(format.toBudgetNumber(day.hotel.estimated_cost))
          if (amount > 0) {
            items.push({
              id: 'hotel-' + dayIndex,
              type: 'hotel',
              typeLabel: typeLabels.hotel,
              dayIndex: dayIndex,
              dayNumber: dayNumber,
              name: day.hotel.name,
              amount: amount
            })
          }
        }

        ;(day.meals || []).forEach((meal, mealIndex) => {
          const amount = format.roundBudgetAmount(format.toBudgetNumber(meal.estimated_cost))
          if (amount <= 0) return
          items.push({
            id: 'meal-' + dayIndex + '-' + mealIndex,
            type: 'meal',
            typeLabel: typeLabels.meal,
            dayIndex: dayIndex,
            dayNumber: dayNumber,
            name: (mealLabels[meal.type] || meal.type) + ' · ' + meal.name,
            amount: amount,
            sourceIndex: mealIndex
          })
        })
      })

      const transportTotal = format.roundBudgetAmount(format.toBudgetNumber(plan.budget.total_transportation))
      const transportDays = (plan.days || [])
        .map((day, dayIndex) => ({ day: day, dayIndex: dayIndex }))
        .filter(({ day }) => day.transportation && day.transportation.trim())

      if (transportTotal > 0 && transportDays.length > 0) {
        const avg = format.roundBudgetAmount(transportTotal / transportDays.length)
        let remaining = transportTotal
        transportDays.forEach(({ day, dayIndex }, index) => {
          const amount = index === transportDays.length - 1 ? remaining : Math.min(avg, remaining)
          remaining = format.roundBudgetAmount(remaining - amount)
          items.push({
            id: 'transport-' + dayIndex,
            type: 'transport',
            typeLabel: typeLabels.transport,
            dayIndex: dayIndex,
            dayNumber: day.day_index + 1,
            name: day.transportation,
            amount: format.roundBudgetAmount(amount)
          })
        })
      }

      this.setData({ allItems: items })
      // 汇总字符串（WXML 无法调用 formatAmount，需预计算）
      const b = plan.budget || {}
      this.setData({
        summary: {
          totalText: format.formatBudgetAmount(b.total),
          attractionText: format.formatBudgetAmount(b.total_attractions),
          hotelText: format.formatBudgetAmount(b.total_hotels),
          mealText: format.formatBudgetAmount(b.total_meals),
          transportText: format.formatBudgetAmount(b.total_transportation)
        }
      })
      // 为每项预计算展示文本
      const enriched = items.map((item) => {
        return Object.assign({}, item, {
          amountText: format.formatBudgetAmount(item.amount),
          dayNumberText: item.dayNumber != null
            ? i18n.t('common.dayNumber', { day: item.dayNumber })
            : '--'
        })
      })
      this.setData({ allItems: enriched })
    },

    applyFilterSort() {
      const filterType = this.data.filterOptions[this.data.filterIndex].value
      const sortMode = this.data.sortOptions[this.data.sortIndex].value

      let items = this.data.allItems.slice()
      if (filterType !== 'all') {
        items = items.filter((item) => item.type === filterType)
      }

      items.sort((a, b) => {
        const dayA = a.dayNumber != null ? a.dayNumber : Number.MAX_SAFE_INTEGER
        const dayB = b.dayNumber != null ? b.dayNumber : Number.MAX_SAFE_INTEGER
        switch (sortMode) {
          case 'amountAsc': return a.amount - b.amount
          case 'dayAsc': return dayA - dayB || b.amount - a.amount
          case 'dayDesc': return dayB - dayA || b.amount - a.amount
          default: return b.amount - a.amount
        }
      })

      this.setData({ filteredItems: items })
    },

    onFilterChange(e) {
      this.setData({ filterIndex: Number(e.detail.value) }, () => this.applyFilterSort())
    },

    onSortChange(e) {
      this.setData({ sortIndex: Number(e.detail.value) }, () => this.applyFilterSort())
    },

    // 删除预算条目
    deleteBudgetItem(e) {
      const item = e.currentTarget.dataset.item
      if (!item || item.dayIndex == null) return
      const plan = this.data.plan
      const day = plan.days[item.dayIndex]
      if (!day) return

      let payload = null
      let transportationOverride

      switch (item.type) {
        case 'attraction': {
          const attraction = day.attractions[item.sourceIndex]
          if (attraction) {
            payload = {
              kind: 'attraction',
              insertIndex: item.sourceIndex,
              attraction: deepClone(attraction),
              amount: item.amount
            }
            day.attractions.splice(item.sourceIndex, 1)
          }
          break
        }
        case 'meal': {
          const meal = day.meals[item.sourceIndex]
          if (meal) {
            payload = {
              kind: 'meal',
              insertIndex: item.sourceIndex,
              meal: deepClone(meal),
              amount: item.amount
            }
            day.meals.splice(item.sourceIndex, 1)
          }
          break
        }
        case 'hotel': {
          if (day.hotel) {
            payload = {
              kind: 'hotel',
              hotel: deepClone(day.hotel),
              accommodation: day.accommodation || '',
              amount: item.amount
            }
            day.hotel = null
            day.accommodation = ''
          }
          break
        }
        case 'transport': {
          if (day.transportation && day.transportation.trim()) {
            payload = {
              kind: 'transport',
              transportation: day.transportation,
              amount: item.amount
            }
            day.transportation = ''
            transportationOverride = Math.max(
              0,
              format.toBudgetNumber(plan.budget.total_transportation) - item.amount
            )
          }
          break
        }
      }

      if (!payload) return

      const uid = item.id + '-' + Date.now()
      const restorePayloads = Object.assign({}, this.data.restorePayloads)
      restorePayloads[uid] = payload

      const pendingItems = this.data.pendingItems.slice()
      pendingItems.unshift({ uid: uid, name: item.name, dayIndex: item.dayIndex })

      format.recalculateBudgetTotals(plan, transportationOverride)

      this.setData({ pendingItems: pendingItems, restorePayloads: restorePayloads })
      this.buildItems(plan)
      this.applyFilterSort()
      this.triggerEvent('planchange', { plan: plan })
    },

    // 复原预算条目
    restoreBudgetItem(e) {
      const index = Number(e.currentTarget.dataset.index)
      const pendingItem = this.data.pendingItems[index]
      if (!pendingItem) return
      const payload = this.data.restorePayloads[pendingItem.uid]
      const plan = this.data.plan
      const day = plan.days[pendingItem.dayIndex]
      if (!day) return

      let transportationOverride

      if (payload) {
        if (payload.kind === 'attraction') {
          const insertAt = Math.max(0, Math.min(payload.insertIndex, day.attractions.length))
          day.attractions.splice(insertAt, 0, deepClone(payload.attraction))
        } else if (payload.kind === 'meal') {
          const insertAt = Math.max(0, Math.min(payload.insertIndex, day.meals.length))
          day.meals.splice(insertAt, 0, deepClone(payload.meal))
        } else if (payload.kind === 'hotel') {
          day.hotel = deepClone(payload.hotel)
          day.accommodation = payload.accommodation
        } else if (payload.kind === 'transport') {
          day.transportation = payload.transportation
          transportationOverride = format.toBudgetNumber(plan.budget.total_transportation) + payload.amount
        }
      }

      format.recalculateBudgetTotals(plan, transportationOverride)

      const pendingItems = this.data.pendingItems.slice()
      pendingItems.splice(index, 1)
      const restorePayloads = Object.assign({}, this.data.restorePayloads)
      delete restorePayloads[pendingItem.uid]

      this.setData({ pendingItems: pendingItems, restorePayloads: restorePayloads })
      this.buildItems(plan)
      this.applyFilterSort()
      this.triggerEvent('planchange', { plan: plan })
    }
  }
})
