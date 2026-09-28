// components/weather-panel/weather-panel.js —— 天气面板
const i18n = require('../../utils/i18n')
const format = require('../../utils/format')

const ICON_MAP = {
  'sunny': { symbol: '☀️', small: '☀️' },
  'sun-shower': { symbol: '🌦️', small: '🌦️' },
  'thunder-storm': { symbol: '⛈️', small: '⛈️' },
  'cloudy': { symbol: '☁️', small: '☁️' },
  'flurries': { symbol: '❄️', small: '❄️' },
  'rainy': { symbol: '🌧️', small: '🌧️' }
}

Component({
  properties: {
    weather: {
      type: Array,
      value: []
    },
    city: {
      type: String,
      value: ''
    }
  },

  data: {
    list: [],
    activeIndex: 0,
    current: {},
    gradient: '',
    dayLabel: '',
    nightLabel: '',
    precipLabel: '',
    humidityLabel: '',
    windLabel: ''
  },

  observers: {
    'weather': function (weather) {
      if (weather && weather.length > 0) {
        this.buildList(weather)
      }
    }
  },

  lifetimes: {
    attached() {
      this.updateI18n()
      const w = this.data.weather
      if (w && w.length > 0) this.buildList(w)
    }
  },

  methods: {
    t(key, params) {
      return i18n.t(key, params)
    },

    updateI18n() {
      this.setData({
        dayLabel: i18n.t('result.weatherDay'),
        nightLabel: i18n.t('result.weatherNight'),
        precipLabel: i18n.t('result.weatherPrecipitation'),
        humidityLabel: i18n.t('result.weatherHumidity'),
        windLabel: i18n.t('result.weatherWind')
      })
    },

    buildList(weather) {
      const locale = i18n.getLocale()
      const list = weather.map((item) => {
        const text = (item.day_weather || '') + ' ' + (item.night_weather || '')
        const icon = format.getWeatherIconKind(text)
        const temp = format.formatWeatherTemp(item.day_temp)
        const nightTemp = format.formatWeatherTemp(item.night_temp)
        return {
          date: item.date,
          city: item.city || '',
          day_weather: item.day_weather || '',
          night_weather: item.night_weather || '',
          weekday: format.formatWeatherWeekday(item.date, false, locale),
          weekdayShort: format.formatWeatherWeekday(item.date, true, locale),
          dateText: format.formatWeatherDate(item.date, locale),
          icon: icon,
          symbol: ICON_MAP[icon].symbol,
          smallSymbol: ICON_MAP[icon].small,
          tempText: temp,
          nightTempText: nightTemp,
          precipitation: format.getWeatherPrecipitation(text),
          humidity: format.getWeatherHumidity(text),
          wind: format.getWeatherWind(item)
        }
      })
      this.setData({ list: list })
      this.selectDayByIndex(0)
    },

    selectDay(e) {
      this.selectDayByIndex(Number(e.currentTarget.dataset.index))
    },

    selectDayByIndex(index) {
      const list = this.data.list
      if (index < 0 || index >= list.length) return
      const current = list[index]
      this.setData({
        activeIndex: index,
        current: current,
        gradient: format.getWeatherGradient(current.day_weather)
      })
    }
  }
})
