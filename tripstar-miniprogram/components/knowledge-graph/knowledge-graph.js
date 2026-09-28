// components/knowledge-graph/knowledge-graph.js —— 知识图谱 canvas 绘制
const i18n = require('../../utils/i18n')

const CATEGORY_KEY_MAP = {
  '城市': 'city', '都市': 'city', 'city': 'city',
  '日程': 'schedule', '行程': 'schedule', 'schedule': 'schedule', 'スケジュール': 'schedule',
  '景点': 'attraction', '観光地': 'attraction', 'attraction': 'attraction',
  '酒店': 'hotel', 'ホテル': 'hotel', 'hotel': 'hotel',
  '餐饮': 'meal', '食事': 'meal', 'meal': 'meal', 'dining': 'meal', 'グルメ': 'meal',
  '天气': 'weather', '天気': 'weather', 'weather': 'weather',
  '预算': 'budget', '予算': 'budget', 'budget': 'budget',
  '偏好/建议': 'suggestion', '好み/提案': 'suggestion', 'preference/suggestion': 'suggestion', 'tips': 'suggestion', 'おすすめ': 'suggestion'
}

const CATEGORY_COLORS = {
  city: '#4A90D9',
  schedule: '#5B8FF9',
  attraction: '#5AD8A6',
  hotel: '#F6BD16',
  meal: '#E8684A',
  weather: '#6DC8EC',
  budget: '#FF9845',
  suggestion: '#B37FEB'
}

function normalizeCategoryKey(name) {
  const key = String(name || '').toLowerCase()
  return CATEGORY_KEY_MAP[name] || CATEGORY_KEY_MAP[key] || name
}

Component({
  properties: {
    graph: {
      type: Object,
      value: null
    }
  },

  data: {
    titleText: '',
    legend: []
  },

  observers: {
    'graph': function (graph) {
      if (graph && graph.nodes && graph.nodes.length > 0) {
        this.buildLegend(graph)
        this.render()
      }
    }
  },

  lifetimes: {
    attached() {
      this.setData({ titleText: i18n.t('result.graphTitle') })
      const graph = this.data.graph
      if (graph && graph.nodes && graph.nodes.length > 0) {
        this.buildLegend(graph)
        this.render()
      }
    }
  },

  methods: {
    t(key, params) {
      return i18n.t(key, params)
    },

    getCategoryColor(name) {
      const key = normalizeCategoryKey(name)
      return CATEGORY_COLORS[key] || '#999999'
    },

    getCategoryLabel(name) {
      const key = normalizeCategoryKey(name)
      if (CATEGORY_COLORS[key]) {
        return i18n.t('result.graph.categories.' + key)
      }
      return name
    },

    buildLegend(graph) {
      const legend = (graph.categories || []).map((cat) => ({
        name: cat.name,
        color: this.getCategoryColor(cat.name),
        label: this.getCategoryLabel(cat.name)
      }))
      this.setData({ legend: legend })
    },

    // 布局：根节点居中，其余按分类分组环形排列
    computeLayout(nodes, edges, width, height) {
      const nodeKey = (id) => String(id)
      const degreeMap = {}
      nodes.forEach((node) => { degreeMap[nodeKey(node.id)] = 0 })
      edges.forEach((edge) => {
        const s = nodeKey(edge.source)
        const t = nodeKey(edge.target)
        degreeMap[s] = (degreeMap[s] || 0) + 1
        degreeMap[t] = (degreeMap[t] || 0) + 1
      })

      let rootKey = nodes.length > 0 ? nodeKey(nodes[0].id) : ''
      let maxDegree = -1
      nodes.forEach((node) => {
        const key = nodeKey(node.id)
        const deg = degreeMap[key] || 0
        if (deg > maxDegree) {
          maxDegree = deg
          rootKey = key
        }
      })

      const grouped = {}
      nodes.forEach((node) => {
        const key = nodeKey(node.id)
        if (key === rootKey) return
        const catName = (this.data.graph.categories && this.data.graph.categories[Number(node.category)] && this.data.graph.categories[Number(node.category)].name) || ''
        const catKey = normalizeCategoryKey(catName) || 'misc'
        if (!grouped[catKey]) grouped[catKey] = []
        grouped[catKey].push(node)
      })

      const groupKeys = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length)

      const cx = width / 2
      const cy = height / 2
      const outerRX = Math.max(80, width / 2 - 30)
      const outerRY = Math.max(80, height / 2 - 30)
      const layerFactors = [1, 0.85, 0.7, 0.6]
      const positions = {}
      if (rootKey) positions[rootKey] = { x: cx, y: cy }

      groupKeys.forEach((groupKey, groupIndex) => {
        const group = grouped[groupKey]
        if (!group || group.length === 0) return
        const baseAngle = -Math.PI / 2 + (2 * Math.PI * groupIndex) / Math.max(1, groupKeys.length)
        const spread = Math.min(1.25, Math.max(0.55, group.length * 0.03))
        const layerStride = Math.max(1, Math.ceil(group.length / layerFactors.length))

        group.forEach((node, nodeIndex) => {
          const t = group.length === 1 ? 0 : nodeIndex / (group.length - 1) - 0.5
          const angle = baseAngle + t * spread
          const layerIndex = Math.min(layerFactors.length - 1, Math.floor(nodeIndex / layerStride))
          const factor = layerFactors[layerIndex]
          let x = cx + Math.cos(angle) * outerRX * factor
          let y = cy + Math.sin(angle) * outerRY * factor
          x = Math.max(20, Math.min(width - 20, x))
          y = Math.max(20, Math.min(height - 20, y))
          positions[nodeKey(node.id)] = { x: x, y: y }
        })
      })

      return positions
    },

    render() {
      const graph = this.data.graph
      if (!graph || !graph.nodes || graph.nodes.length === 0) return

      const query = wx.createSelectorQuery().in(this)
      query.select('#kgCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const width = res[0].width
        const height = res[0].height
        const ctx = canvas.getContext('2d')

        // 适配设备像素比
        const dpr = (wx.getSystemInfoSync().pixelRatio || 2)
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        ctx.clearRect(0, 0, width, height)

        const positions = this.computeLayout(graph.nodes, graph.edges, width, height)

        // 绘制边
        graph.edges.forEach((edge) => {
          const s = positions[String(edge.source)]
          const t = positions[String(edge.target)]
          if (!s || !t) return
          ctx.beginPath()
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(t.x, t.y)
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'
          ctx.lineWidth = 1
          ctx.stroke()
        })

        // 绘制节点
        graph.nodes.forEach((node) => {
          const pos = positions[String(node.id)]
          if (!pos) return
          const catName = (graph.categories && graph.categories[Number(node.category)] && graph.categories[Number(node.category)].name) || ''
          const color = this.getCategoryColor(catName)
          const rawSize = Number(node.symbolSize) || 40
          const baseSize = rawSize >= 70 ? 100 : rawSize >= 45 ? 80 : 60
          const radius = Math.round(baseSize * 1.25 * 0.34)

          // 光晕
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.globalAlpha = 0.15
          ctx.fill()
          ctx.globalAlpha = 1

          // 主体
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()

          // 节点文字
          const name = String(node.name || '')
          const labelMaxChars = radius >= 45 ? 6 : 5
          const display = name.length > labelMaxChars ? name.slice(0, labelMaxChars) + '…' : name
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold ' + (radius >= 45 ? 11 : 10) + 'px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(display, pos.x, pos.y)
        })
      })
    }
  }
})
