// utils/format.js —— 格式化与工具函数（日期/金额/天气/地图数据）

// ===== 日期 =====
// 解析后端可能返回的各种日期格式，返回 Date 或 null
function parseDate(raw) {
  if (!raw) return null
  const normalized = String(raw)
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/[./]/g, '-')
    .trim()

  // YYYY-MM-DD
  const d = new Date(normalized)
  if (!isNaN(d.getTime())) return d

  const matched = String(raw).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!matched) return null
  const fallback = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  return isNaN(fallback.getTime()) ? null : fallback
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function toDateStr(date) {
  if (!date) return ''
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

// 计算两个 YYYY-MM-DD 字符串之间的天数差（含两端）
function diffDays(startStr, endStr) {
  const s = new Date(startStr)
  const e = new Date(endStr)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  const ms = e.getTime() - s.getTime()
  return Math.round(ms / 86400000) + 1
}

const WEEKDAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatWeatherDate(raw, locale) {
  const d = parseDate(raw)
  if (!d) return raw || '--'
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function formatWeatherWeekday(raw, short, locale) {
  const d = parseDate(raw)
  if (!d) return raw || '--'
  const day = d.getDay()
  if (locale === 'en-US') return short ? WEEKDAYS_EN[day] : WEEKDAYS_FULL_EN[day]
  return WEEKDAYS_CN[day]
}

function formatWeatherTemp(temp) {
  const n = Number(temp)
  if (!isFinite(n)) return '--'
  return Math.round(n) + '°C'
}

// ===== 天气图标分类 =====
function getWeatherIconKind(weatherText) {
  const text = String(weatherText || '').trim()
  const hasRain = /(雨|rain|shower|drizzle|sprinkle|阵雨|小雨|中雨|大雨|暴雨)/i.test(text)
  const hasSun = /(晴|sun|clear)/i.test(text)

  if (/(雷|thunder|storm|lightning|雷暴|雷阵雨)/i.test(text)) return 'thunder-storm'
  if (/(雪|snow|sleet|hail|冰雹|冻雨|雨夹雪)/i.test(text)) return 'flurries'
  if (hasRain && hasSun) return 'sun-shower'
  if (hasRain) return 'rainy'
  if (/(云|阴|cloud|overcast|雾|霾|fog|mist|haze|wind|breeze|gale)/i.test(text)) return 'cloudy'
  return 'sunny'
}

function getWeatherGradient(weatherText) {
  const text = String(weatherText || '').toLowerCase()
  if (/(雷|thunder)/.test(text)) return 'linear-gradient(140deg, #3a4a86 0%, #5b3b8a 100%)'
  if (/(雪|snow|sleet|hail)/.test(text)) return 'linear-gradient(140deg, #8bc6ec 0%, #d9afd9 100%)'
  if (/(雨|rain|shower|drizzle)/.test(text)) return 'linear-gradient(140deg, #4b6cb7 0%, #182848 100%)'
  if (/(雾|霾|fog|mist|haze)/.test(text)) return 'linear-gradient(140deg, #7b8799 0%, #4a5568 100%)'
  if (/(阴|cloud|overcast)/.test(text)) return 'linear-gradient(140deg, #6d7f92 0%, #3f4c6b 100%)'
  return 'linear-gradient(140deg, #72edf2 0%, #5151e5 100%)'
}

function getWeatherPrecipitation(weatherText) {
  const text = String(weatherText || '').toLowerCase()
  if (/(雷|thunder|暴雨|storm)/.test(text)) return '85%'
  if (/(雨|rain|shower|drizzle)/.test(text)) return '65%'
  if (/(雪|snow|sleet|hail)/.test(text)) return '55%'
  if (/(阴|cloud|overcast)/.test(text)) return '30%'
  return '10%'
}

function getWeatherHumidity(weatherText) {
  const text = String(weatherText || '').toLowerCase()
  if (/(雷|thunder|暴雨|storm)/.test(text)) return '88%'
  if (/(雨|rain|shower|drizzle)/.test(text)) return '78%'
  if (/(雪|snow|sleet|hail)/.test(text)) return '72%'
  if (/(阴|cloud|overcast|雾|霾|fog|mist|haze)/.test(text)) return '62%'
  return '42%'
}

function getWeatherWind(weather) {
  if (!weather) return '--'
  const dir = (weather.wind_direction || '').trim() || '--'
  const power = (weather.wind_power || '').trim() || '--'
  return (dir + ' ' + power).trim()
}

// ===== 金额 =====
function toBudgetNumber(value) {
  const n = Number(value)
  if (!isFinite(n) || n <= 0) return 0
  return n
}

function roundBudgetAmount(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function formatBudgetAmount(value) {
  const rounded = roundBudgetAmount(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

// 按天重建预算汇总
function recalculateBudgetTotals(tripPlan, transportationOverride) {
  if (!tripPlan) return null
  let attractionTotal = 0
  let hotelTotal = 0
  let mealTotal = 0

  ;(tripPlan.days || []).forEach((day) => {
    ;(day.attractions || []).forEach((attraction) => {
      attractionTotal += toBudgetNumber(attraction.ticket_price)
    })
    if (day.hotel) {
      hotelTotal += toBudgetNumber(day.hotel.estimated_cost)
    }
    ;(day.meals || []).forEach((meal) => {
      mealTotal += toBudgetNumber(meal.estimated_cost)
    })
  })

  const transportationTotal = roundBudgetAmount(
    transportationOverride !== undefined
      ? transportationOverride
      : toBudgetNumber((tripPlan.budget && tripPlan.budget.total_transportation))
  )

  const budget = {
    total_attractions: roundBudgetAmount(attractionTotal),
    total_hotels: roundBudgetAmount(hotelTotal),
    total_meals: roundBudgetAmount(mealTotal),
    total_transportation: transportationTotal,
    total: roundBudgetAmount(attractionTotal + hotelTotal + mealTotal + transportationTotal)
  }
  tripPlan.budget = budget
  return budget
}

// ===== 地图数据 =====
// 收集所有景点（含 dayIndex/attrIndex/globalIndex），仅保留有坐标的
function collectAttractions(tripPlan) {
  const all = []
  let globalIndex = 0
  ;(tripPlan.days || []).forEach((day, dayIndex) => {
    ;(day.attractions || []).forEach((attraction, attrIndex) => {
      globalIndex++
      if (attraction.location && attraction.location.longitude && attraction.location.latitude) {
        all.push(Object.assign({}, attraction, {
          dayIndex: dayIndex,
          attrIndex: attrIndex,
          globalIndex: globalIndex
        }))
      }
    })
  })
  return all
}

// 构建微信 map 组件的 markers
function buildMapMarkers(tripPlan) {
  const all = collectAttractions(tripPlan)
  const markers = all.map((attr) => ({
    id: attr.globalIndex,
    latitude: attr.location.latitude,
    longitude: attr.location.longitude,
    title: attr.name,
    width: 32,
    height: 32,
    callout: {
      content: (attr.dayIndex + 1) + '-' + (attr.attrIndex + 1),
      color: '#ffffff',
      fontSize: 12,
      borderRadius: 6,
      bgColor: '#ff5722',
      padding: 4,
      display: 'ALWAYS'
    },
    _name: attr.name,
    _address: attr.address,
    _visitDuration: attr.visit_duration,
    _day: attr.dayIndex + 1,
    _attr: attr.attrIndex + 1
  }))
  return { markers, all }
}

// 构建 map polyline：按天将景点用直线连接
function buildMapPolylines(tripPlan) {
  const all = collectAttractions(tripPlan)
  const dayGroups = {}
  all.forEach((attr) => {
    if (!dayGroups[attr.dayIndex]) dayGroups[attr.dayIndex] = []
    dayGroups[attr.dayIndex].push(attr)
  })

  const polylines = []
  const colorMap = ['#37b4ff', '#6ad38f', '#ffb347', '#c084fc', '#4ade80', '#f472b6']
  Object.keys(dayGroups).forEach((dayIdx) => {
    const attrs = dayGroups[dayIdx].sort((a, b) => a.attrIndex - b.attrIndex)
    if (attrs.length < 2) return
    const points = attrs.map((a) => ({
      latitude: a.location.latitude,
      longitude: a.location.longitude
    }))
    polylines.push({
      points: points,
      color: colorMap[Number(dayIdx) % colorMap.length],
      width: 4,
      dottedLine: true,
      arrowLine: true
    })
  })
  return polylines
}

module.exports = {
  parseDate,
  toDateStr,
  diffDays,
  formatWeatherDate,
  formatWeatherWeekday,
  formatWeatherTemp,
  getWeatherIconKind,
  getWeatherGradient,
  getWeatherPrecipitation,
  getWeatherHumidity,
  getWeatherWind,
  toBudgetNumber,
  roundBudgetAmount,
  formatBudgetAmount,
  recalculateBudgetTotals,
  collectAttractions,
  buildMapMarkers,
  buildMapPolylines
}
