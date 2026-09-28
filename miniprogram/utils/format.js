// format.js - 格式化与文案工具
function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// 体力等级文案
function levelText(level) {
  return { '高': '高体力', '中': '中等体力', '低': '低体力' }[level] || level;
}

// 行程文本（复制/分享用）
function planToText(plan) {
  const lines = [];
  lines.push('【' + (plan.title || '适老行程') + '】');
  lines.push('目的地：' + plan.city + '　天数：' + plan.days + '天');
  (plan.schedule || []).forEach((day) => {
    lines.push('');
    lines.push('第' + day.day + '天：' + (day.theme || ''));
    (day.spots || []).forEach((s) => {
      if (s.rest) {
        lines.push('  ☕ ' + s.name + '（' + s.duration + '）' + (s.description || ''));
      } else {
        lines.push('  · ' + s.name + '｜' + (s.type || '') + '｜' + levelText(s.level) + '｜步行约' + s.walk + '米｜' + (s.duration || ''));
        if (s.tips) lines.push('    提示：' + s.tips);
      }
    });
  });
  lines.push('');
  lines.push('【风险评估】' + (plan.risk ? plan.risk.level : ''));
  (plan.risk ? plan.risk.items : []).forEach((i) => lines.push('  - ' + i));
  lines.push('');
  lines.push('【老年出行贴士】');
  if (plan.tips) {
    ['rest', 'medical', 'diet', 'weather', 'carry'].forEach((k) => {
      (plan.tips[k] || []).forEach((t) => lines.push('  · ' + t));
    });
  }
  lines.push('');
  lines.push('—— 由"智游康行·岁旅相伴"适老行程助手生成');
  return lines.join('\n');
}

module.exports = { formatTime, formatDate, levelText, planToText };
