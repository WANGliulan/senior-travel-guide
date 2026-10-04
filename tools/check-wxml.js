/**
 * tools/check-wxml.js - WXML 循环变量检查（栈式作用域分析）
 *
 * 背景（真实踩坑）：WXML 的 wx:for 默认循环变量名是 item / index。
 * 若模板里写了别的名字（例如 {{m.content}}）却没有声明 wx:for-item="m"，
 * 该变量会恒为 undefined —— 消息内容、typing 状态、id 全部取不到，
 * 表现为「气泡是空的、界面没有字」，而且不报任何错误，极难排查。
 *
 * 用法：node tools/check-wxml.js
 * 退出码：发现疑似问题返回 1（可用于提交前检查 / CI）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'miniprogram');
// 常见"像列表项"的变量名：未在作用域内声明却被使用，即可疑
const SUSPICIOUS = ['m', 'msg', 'row', 'record', 'obj', 'one', 'it'];

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else if (d.name.endsWith('.wxml')) out.push(p);
  });
  return out;
}

function varsUsedIn(text) {
  const names = [];
  const re = /\{\{[^}]*?([A-Za-z_$][\w$]*)\s*(?:\.|\[)/g;
  let m;
  while ((m = re.exec(text))) names.push(m[1]);
  return Array.from(new Set(names));
}

let issued = 0;
let loopCount = 0;

function checkText(src, text, scope, file, baseIndex, kind) {
  if (!text) return;
  const bad = varsUsedIn(text).filter((n) => SUSPICIOUS.indexOf(n) >= 0 && scope.indexOf(n) < 0);
  if (!bad.length) return;
  issued += 1;
  const line = src.slice(0, baseIndex).split(/\r?\n/).length;
  console.log('[问题] ' + path.relative(path.join(__dirname, '..'), file) + ':' + line);
  console.log('       ' + kind + ' 中使用了未声明的循环变量 ' + JSON.stringify(bad) +
    '（当前作用域只有 ' + JSON.stringify(scope) + '）');
  console.log('       片段：' + text.slice(0, 140).replace(/\s+/g, ' '));
  console.log('       修复：给对应的 wx:for 元素补 wx:for-item="' + bad[0] +
    '"，或把模板里的 ' + bad[0] + ' 改成 item\n');
}

walk(ROOT, []).forEach((file) => {
  const src = fs.readFileSync(file, 'utf8');
  // 依次扫描「标签」与「标签之间的文本」，用栈维护当前可见的循环变量
  const tokenRe = /<\/?[A-Za-z-]+(?:"[^"]*"|'[^']*'|[^>"'])*?\/?>/g;
  const frames = []; // [{ tag, item }]
  let last = 0;
  let m;

  while ((m = tokenRe.exec(src))) {
    const gap = src.slice(last, m.index);
    checkText(src, gap, frames.map((f) => f.item), file, last, '文本');

    const tag = m[0];
    if (/^<\//.test(tag)) {
      const name = (tag.match(/^<\/([A-Za-z-]+)/) || [])[1];
      for (let i = frames.length - 1; i >= 0; i--) {
        if (frames[i].tag === name) {
          frames.length = i;
          break;
        }
      }
      last = tokenRe.lastIndex;
      continue;
    }

    const name = (tag.match(/^<([A-Za-z-]+)/) || [])[1];
    const selfClose = /\/>$/.test(tag);
    const declares = tag.indexOf('wx:for=') >= 0;
    if (declares) loopCount += 1;
    const itemVar = declares ? ((tag.match(/wx:for-item="([^"]+)"/) || [])[1] || 'item') : null;

    // 该标签自身的属性里可以使用它自己声明的循环变量
    const scope = frames.map((f) => f.item).concat(declares ? [itemVar] : []);
    checkText(src, tag, scope, file, m.index, '元素');

    if (declares && !selfClose) frames.push({ tag: name, item: itemVar });
    last = tokenRe.lastIndex;
  }
  checkText(src, src.slice(last), frames.map((f) => f.item), file, last, '文本');
});

console.log('检查完成：共扫描 ' + loopCount + ' 个 wx:for，发现 ' + issued + ' 处循环变量未声明问题。');
process.exit(issued === 0 ? 0 : 1);
