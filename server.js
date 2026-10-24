#!/usr/bin/env node
/* =====================================================================
 * 麦麦营养点餐助手 · MCP 实时代理（零依赖 Node）
 * ---------------------------------------------------------------------
 * 存在的原因：MCP Token 是用户私人凭证，绝不能放进公开页面；静态托管
 * 也没有后端。本服务持有 Token，向页面暴露一组受控 JSON API：
 *
 *   GET  /api/health                  → 存活探测（页面据此进入实时模式）
 *   GET  /api/stores?lat&lng          → 浏览器定位 → 反向地理编码 →
 *                                       MCP query-nearby-stores →
 *                                       门店地址正向地理编码补经纬度
 *   GET  /api/menu?storeCode          → MCP query-meals 真实菜单
 *   POST /api/quote  {storeCode,itemIds} → MCP calculate-price 实时核价
 *   POST /api/order  {storeCode,itemIds} → MCP create-order → payH5Url
 *
 * Token 读取顺序：process.env.MCD_MCP_TOKEN → ./mcp-token.txt（已 gitignore）
 * 静态托管同目录文件（index.html 等）；.txt/.git 等一律不对外。
 * ===================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = __dirname;
const MCP_URL = 'https://mcp.mcd.cn';
/* 地理编码用 Photon（OSM 数据，国内可达；Nominatim 在境内网络不可达） */
const PHOTON = 'https://photon.komoot.io';
const UA = 'mcd-nutrition-coach-proxy/1.0 (contest demo)';

function readToken() {
  if (process.env.MCD_MCP_TOKEN && process.env.MCD_MCP_TOKEN.trim()) return process.env.MCD_MCP_TOKEN.trim();
  try { return fs.readFileSync(path.join(ROOT, 'mcp-token.txt'), 'utf8').trim(); } catch (e) { return ''; }
}
const TOKEN = readToken();

/* ---------------- 演示餐品 → 真实商品 映射 ---------------- */
/* key：index.html MENU 的演示 id；name：演示名；real：真实菜单中的品名
 * （菜单改版导致品名变化时以 real 为准；null = 菜单中无对应在售品，诚实地不映射） */
const DEMO_ITEMS = [
  { id: 'bigmac', name: '巨无霸', real: '巨无霸' },
  { id: 'spicy', name: '麦辣鸡腿汉堡', real: '麦辣鸡腿汉堡' },
  { id: 'grilled', name: '板烧鸡腿堡', real: '板烧鸡腿堡' },
  { id: 'doublecheese', name: '双层吉士汉堡', real: '双层吉士汉堡' },
  { id: 'fish', name: '麦香鱼', real: '麦香鱼' },
  { id: 'mcrispy', name: '麦麦脆汁鸡(大)', real: '麦麦脆汁鸡1块' },
  { id: 'mcmuffin', name: '猪柳麦满分', real: '枫糖风味厚松饼猪柳堡' },
  { id: 'eggcheese', name: '烟肉蛋麦满分', real: '枫糖风味厚松饼猪柳蛋堡' },
  { id: 'fries-m', name: '中薯条', real: '薯条' },
  { id: 'fries-s', name: '小薯条', real: '薯条' },
  { id: 'corn', name: '玉米杯(小)', real: '玉米杯' },
  { id: 'nuggets', name: '麦乐鸡(5块)', real: '麦乐鸡' },
  { id: 'apple', name: '苹果片', real: '苹果片' },
  { id: 'cola-m', name: '中杯可口可乐', real: '可乐' },
  { id: 'cola-zero', name: '中杯无糖可乐', real: null },
  { id: 'sprite-m', name: '中杯雪碧', real: '雪碧' },
  { id: 'coffee', name: '鲜煮咖啡', real: '鲜萃咖啡' },
  { id: 'oj', name: '美汁源橙汁', real: '【美汁源】“黄金橙橙”' },
  { id: 'mcflurry', name: '麦旋风(奥利奥)', real: '经典麦旋风' },
  { id: 'pie', name: '菠萝派', real: '派' },
  { id: 'sundae', name: '草莓新地', real: '新地' },
  { id: 'wings', name: '麦辣鸡翅(4块)', real: '麦辣鸡翅' }
];
const DEMO_BY_ID = {};
DEMO_ITEMS.forEach((d) => { DEMO_BY_ID[d.id] = d; });

/* ---------------- 已知门店坐标表 ----------------
 * MCP query-nearby-stores 不返回门店经纬度（longitude/latitude=0）。
 * 以下坐标取自 OpenStreetMap（Photon，WGS-84）的街道/地标级位置，
 * 并用三家门店的 MCP 距离做三角校验（唯一自洽组合）后选定，误差约百米。
 * 运行时对未知门店仍会尝试 Photon 正向地理编码补充。 */
const STORE_COORDS = {
  '1980128': { lat: 40.0434, lng: 117.4011, src: 'OSM 渔阳南路(东北隅村段)' },
  '1980269': { lat: 40.0228, lng: 117.3716, src: 'OSM 蓟州万达广场' },
  '1980278': { lat: 40.0338, lng: 117.4401, src: 'OSM 翠湖东路' }
};

/* ---------------- 缓存 ---------------- */
const cache = {
  geo: new Map(),    // 反向地理编码（坐标→行政区）
  addr: new Map(),   // 正向地理编码（地址→经纬度）
  menu: new Map()    // 门店菜单
};
const GEO_TTL = 24 * 3600e3, ADDR_TTL = 7 * 24 * 3600e3, MENU_TTL = 10 * 60e3;
function cacheGet(map, key, ttl) {
  const hit = map.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.val;
  map.delete(key);
  return null;
}

/* ---------------- MCP JSON-RPC（streamable HTTP） ---------------- */
let sessionId = null, sessionAt = 0, initializing = null;

async function mcpFetch(body, withSession) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': 'Bearer ' + TOKEN
  };
  if (withSession && sessionId) headers['mcp-session-id'] = sessionId;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  try {
    const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
    const text = await res.text();
    return { status: res.status, sid: res.headers.get('mcp-session-id'), text };
  } finally { clearTimeout(timer); }
}

async function ensureSession() {
  if (sessionId && Date.now() - sessionAt < 30 * 60e3) return sessionId;
  if (initializing) return initializing;
  initializing = (async () => {
    const r = await mcpFetch({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'mcd-nutrition-coach-proxy', version: '1.0.0' } }
    }, false);
    if (r.status >= 400) throw new Error('MCP initialize HTTP ' + r.status);
    if (r.sid) { sessionId = r.sid; sessionAt = Date.now(); }
    try {
      await mcpFetch({ jsonrpc: '2.0', method: 'notifications/initialized' }, true);
    } catch (e) { /* 部分服务端不要求 */ }
    return sessionId;
  })();
  try { return await initializing; } finally { initializing = null; }
}

/* 从 MCP 文本负载中稳健提取 JSON：
 * ① 纯 JSON；② 「## Original Response」包装；③ 任意说明文字中内嵌的平衡括号 JSON 对象 */
function extractJson(text) {
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (e) { /* fallthrough */ }
  const marker = text.lastIndexOf('## Original Response');
  if (marker >= 0) {
    const sub = text.slice(marker + '## Original Response'.length).trim();
    try { return JSON.parse(sub); } catch (e) {
      const s = sub.indexOf('{'), e2 = sub.lastIndexOf('}');
      if (s >= 0 && e2 > s) { try { return JSON.parse(sub.slice(s, e2 + 1)); } catch (e3) { /* fallthrough */ } }
    }
  }
  /* 平衡括号扫描（跳过字符串字面量） */
  const spans = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') { if (depth > 0) { depth--; if (depth === 0) spans.push([start, i + 1]); } }
  }
  let best = null;
  for (const span of spans) {
    try {
      const o = JSON.parse(text.slice(span[0], span[1]));
      if (o && typeof o === 'object') {
        if (o.success !== undefined || o.data !== undefined || o.code !== undefined) return o;
        if (best === null) best = o;
      }
    } catch (e) { /* 继续找下一个 */ }
  }
  return best;
}

async function callTool(name, args) {
  if (!TOKEN) throw new Error('no-token');
  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureSession();
    const r = await mcpFetch({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }, true);
    let json = null;
    try { json = JSON.parse(r.text); } catch (e) {
      const lines = r.text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('data:'));
      for (let i = lines.length - 1; i >= 0; i--) {
        try { json = JSON.parse(lines[i].slice(5).trim()); break; } catch (e2) { /* continue */ }
      }
    }
    if (!json) throw new Error('MCP 响应解析失败: ' + r.text.slice(0, 160));
    if (json.error) {
      const msg = JSON.stringify(json.error);
      if (attempt === 0 && /session/i.test(msg)) { sessionId = null; continue; }
      throw new Error('MCP 错误: ' + msg);
    }
    const content = json.result && json.result.content;
    if (Array.isArray(content) && content[0] && typeof content[0].text === 'string') {
      const payload = extractJson(content[0].text);
      if (payload !== null) return payload;
      return content[0].text;
    }
    return json.result;
  }
  throw new Error('MCP 调用重试后仍失败');
}

/* ---------------- 地理编码（Photon，带缓存与降级） ---------------- */
async function fetchJson(url, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs || 8000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

/* 直辖市补「市」：天津→天津市（MCP 门店搜索的 city 参数用全称） */
function mcpCity(province) {
  if (!province) return '';
  if (/^(北京|上海|天津|重庆)$/.test(province)) return province + '市';
  return province;
}

/* 坐标 → 行政区（city/keyword 供 MCP 门店搜索） */
async function reverseGeo(lat, lng) {
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  const hit = cacheGet(cache.geo, key, GEO_TTL);
  if (hit) return hit;
  const url = PHOTON + '/reverse?lat=' + lat + '&lon=' + lng;
  const j = await fetchJson(url);
  const f = j && j.features && j.features[0];
  const a = (f && f.properties) || {};
  /* Photon 中文回解：state=省级；city/district/county 中任一是区县级 */
  const district = a.district || a.city || a.county || a.city_district || '';
  const city = mcpCity(a.state || a.province || a.county || '');
  const val = {
    city,
    keyword: district || city,
    display: [a.name, a.street, a.district || a.city, a.state].filter(Boolean).join(' · ')
  };
  cache.geo.set(key, { at: Date.now(), val });
  return val;
}

/* 地址 → 经纬度（补全 MCP 不返回的门店坐标；失败返回 null） */
async function forwardGeo(address, city) {
  const key = (city || '') + '|' + address;
  const hit = cacheGet(cache.addr, key, ADDR_TTL);
  if (hit !== null && hit !== undefined) return hit;
  const tries = [
    address + ' ' + (city || ''),
    address.replace(/[0-9０-９]+[号弄支段]/g, '') + ' ' + (city || '')
  ];
  for (const q of tries) {
    if (!q.trim()) continue;
    try {
      const url = PHOTON + '/api/?limit=3&q=' + encodeURIComponent(q);
      const j = await fetchJson(url);
      const feats = (j && j.features) || [];
      const f = feats.find((x) => x.properties && x.properties.countrycode === 'CN' && x.geometry && x.geometry.coordinates);
      if (f) {
        const c = f.geometry.coordinates;
        const val = { lat: c[1], lng: c[0], display: [f.properties.name, f.properties.street, f.properties.district || f.properties.city, f.properties.state].filter(Boolean).join(' · ') };
        cache.addr.set(key, { at: Date.now(), val });
        return val;
      }
    } catch (e) { /* 尝试下一个 */ }
  }
  cache.addr.set(key, { at: Date.now(), val: null });
  return null;
}

/* ---------------- 菜单 ---------------- */
async function getMenu(storeCode) {
  const hit = cacheGet(cache.menu, storeCode, MENU_TTL);
  if (hit) return hit;
  const j = await callTool('query-meals', { storeCode, orderType: 1, beType: 1 });
  if (!j) throw new Error('菜单查询失败（MCP 无返回）');
  const data = (j && j.data) || {};
  const byName = {};
  const catOf = {};
  (data.categories || []).forEach((c) => {
    (c.meals || []).forEach((m) => { if (!catOf[m.code]) catOf[m.code] = c.name.replace(/\n/g, ''); });
  });
  Object.keys(data.meals || {}).forEach((code) => {
    const m = data.meals[code] || {};
    if (m && m.name) byName[m.name] = { code, name: m.name, price: parseFloat(m.currentPrice || '0'), category: catOf[code] || '' };
  });
  const val = { byName, count: Object.keys(byName).length };
  /* 空菜单（打烊时段）不缓存：否则开门后 10 分钟内仍会误报「不在营业时间」 */
  if (val.count) cache.menu.set(storeCode, { at: Date.now(), val });
  return val;
}

/* 演示 id 列表 → 真实商品（含未匹配项，诚实告知） */
function normName(s) { return String(s || '').replace(/[「」【】（）()""'':：\s·]/g, ''); }
function findInMenu(menu, realName) {
  if (menu.byName[realName]) return menu.byName[realName];
  const target = normName(realName);
  const keys = Object.keys(menu.byName);
  let hit = keys.find((k) => normName(k) === target);
  if (hit) return menu.byName[hit];
  /* 包含匹配兜底（如「中薯条」→「薯条」；注意先精确再模糊，避免「薯条」撞上「脆脆薯条」） */
  hit = keys.find((k) => normName(k).includes(target) || target.includes(normName(k)));
  return hit ? menu.byName[hit] : null;
}
async function resolveItems(storeCode, itemIds) {
  const menu = await getMenu(storeCode);
  /* 打烊时段 MCP 仍返回 success，但菜单是空的 → 必须说「不在营业时间」，不能说「无在售商品」 */
  if (!menu.count) return { matched: [], unmapped: [], menuSize: 0, menuEmpty: true };
  const matched = [], unmapped = [];
  (itemIds || []).forEach((id) => {
    const demo = DEMO_BY_ID[id];
    if (!demo) { unmapped.push({ id, name: id, reason: '未知餐品' }); return; }
    if (!demo.real) { unmapped.push({ id, name: demo.name, reason: '门店菜单中暂无对应在售商品' }); return; }
    const hit = findInMenu(menu, demo.real);
    if (hit) matched.push({ id, name: demo.name, realName: hit.name, code: hit.code, price: hit.price });
    else unmapped.push({ id, name: demo.name, reason: '该店菜单暂无「' + demo.real + '」' });
  });
  return { matched, unmapped, menuSize: menu.count };
}

/* ---------------- MCP 错误 → 人话（麦当劳侧限额/闭店/售罄等要如实告诉用户） ---------------- */
function friendlyErr(msg) {
  const m = String(msg || '');
  if (/上限|已达上限|超过.*限制|额度/.test(m))
    return { code: 'QUOTA', text: '麦当劳 MCP 今日可创建的订单数已达上限（平台侧限制，非本页故障）' };
  if (/频繁|限流|rate/i.test(m))
    return { code: 'RATE', text: '下单太频繁，请稍后再试' };
  if (/营业|休息|闭店|暂停/.test(m))
    return { code: 'CLOSED', text: '该门店当前不在营业时间，请换一家门店或稍后再试' };
  if (/售罄|无在售|库存|已下架/.test(m))
    return { code: 'SOLD_OUT', text: '有餐品在该店已售罄或已下架，请回到推荐页换一款' };
  return { code: 'UNKNOWN', text: m || '下单失败' };
}

/* ---------------- 下单限流（默认每 IP 每小时 3 单，防止公开链接被滥用） ----------------
   联调/压测时可用 MCD_ORDER_LIMIT 放宽，生产保持默认。 */
const ORDER_LIMIT = Math.max(1, +(process.env.MCD_ORDER_LIMIT || 3));
const orderBuckets = new Map();
function rateOk(ip) {
  const now = Date.now();
  let b = orderBuckets.get(ip);
  if (!b || now > b.reset) { b = { n: 0, reset: now + 3600e3 }; orderBuckets.set(ip, b); }
  if (b.n >= ORDER_LIMIT) return false;
  b.n++;
  return true;
}

/* ---------------- 静态托管 ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  const ext = path.extname(file).toLowerCase();
  /* .txt（含 mcp-token.txt）与点文件一律不对外 */
  if (ext === '.txt' || /(^|\/)\.[^/]/.test(file)) { res.writeHead(404); res.end('not found'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

/* ---------------- API ---------------- */
function sendJson(res, obj, code) {
  res.writeHead(code || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 64e3) { req.destroy(); reject(new Error('body too large')); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if (p === '/api/health') {
      return sendJson(res, { live: !!TOKEN, now: new Date().toISOString(), service: 'mcd-nutrition-coach-proxy' });
    }
    if (!TOKEN) return sendJson(res, { ok: false, error: '服务端未配置 MCP Token，实时模式不可用' }, 503);

    if (p === '/api/stores') {
      const lat = parseFloat(u.searchParams.get('lat') || '');
      const lng = parseFloat(u.searchParams.get('lng') || '');
      if (!isFinite(lat) || !isFinite(lng)) return sendJson(res, { ok: false, error: '缺少有效坐标' }, 400);
      let area = null;
      try { area = await reverseGeo(lat, lng); } catch (e) { area = null; }
      if (!area || !area.city) {
        return sendJson(res, { ok: false, error: '定位反解失败（无法确定所在城市），已回退本地快照', fallback: 'snapshot' });
      }
      const j = await callTool('query-nearby-stores', { searchType: 2, city: area.city, keyword: area.keyword, beType: 1 });
      const list = (j && j.data) || [];
      /* 并发补经纬度：先查内置坐标表，再试 Photon 正向地理编码；都失败则距离回退 MCP 值 */
      const stores = await Promise.all(list.map(async (s) => {
        let geo = null, src = 'none';
        const known = STORE_COORDS[s.storeCode];
        if (known) { geo = { lat: known.lat, lng: known.lng }; src = known.src; }
        else {
          try { geo = await forwardGeo(s.address || '', area.city); src = geo ? 'nominatim' : 'none'; } catch (e) { geo = null; }
        }
        return {
          storeCode: s.storeCode, name: s.storeName, addr: s.address || '',
          lat: geo ? geo.lat : null, lng: geo ? geo.lng : null, geoSource: src,
          mcpDist: typeof s.distance === 'number' ? s.distance : null,
          open: (s.businessStartTime && s.businessEndTime) ? s.businessStartTime + '–' + s.businessEndTime : '',
          business: s.businessStatus !== false,
          reservation: s.reservation === true
        };
      }));
      return sendJson(res, { ok: true, source: 'live', area, stores });
    }

    if (p === '/api/menu') {
      const storeCode = u.searchParams.get('storeCode') || '';
      if (!storeCode) return sendJson(res, { ok: false, error: '缺少 storeCode' }, 400);
      const menu = await getMenu(storeCode);
      const products = Object.keys(menu.byName).map((k) => menu.byName[k]);
      return sendJson(res, { ok: true, storeCode, count: products.length, products });
    }

    if (p === '/api/quote' && req.method === 'POST') {
      const body = await readBody(req);
      const storeCode = String(body.storeCode || '');
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
      if (!storeCode || !itemIds.length) return sendJson(res, { ok: false, error: '参数不完整' }, 400);
      const { matched, unmapped, menuEmpty } = await resolveItems(storeCode, itemIds);
      if (menuEmpty) return sendJson(res, { ok: false, code: 'CLOSED', error: '该门店当前没有可售餐品，通常是不在营业时间（示例门店营业 07:00–23:00），请换一家门店或稍后再试' });
      if (!matched.length) return sendJson(res, { ok: false, code: 'SOLD_OUT', error: '推荐餐品在该店均无对应在售商品', unmapped });
      const j = await callTool('calculate-price', {
        storeCode, orderType: 1, beType: 1, needTableware: false,
        items: matched.map((m) => ({ productCode: m.code, quantity: 1 }))
      });
      const d = (j && j.data) || {};
      const totalFen = typeof d.price === 'number' ? d.price : null;
      return sendJson(res, {
        ok: true, total: totalFen === null ? null : totalFen / 100, totalFen,
        original: typeof d.originalPrice === 'number' ? d.originalPrice / 100 : null,
        takeWayList: (d.takeWayList || []).map((t) => ({ code: t.code, title: t.title, subtitle: t.subtitle })),
        productList: d.productList || [], matched, unmapped
      });
    }

    if (p === '/api/order' && req.method === 'POST') {
      const body = await readBody(req);
      const storeCode = String(body.storeCode || '');
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
      if (!storeCode || !itemIds.length) return sendJson(res, { ok: false, error: '参数不完整' }, 400);
      if (!rateOk(ip)) return sendJson(res, { ok: false, code: 'RATE', error: '本页下单太频繁（每 IP 每小时最多 ' + ORDER_LIMIT + ' 单），请稍后再试' }, 429);
      const { matched, unmapped, menuEmpty } = await resolveItems(storeCode, itemIds);
      if (menuEmpty) return sendJson(res, { ok: false, code: 'CLOSED', error: '该门店当前没有可售餐品，通常是不在营业时间（示例门店营业 07:00–23:00），请换一家门店或稍后再试' });
      if (!matched.length) return sendJson(res, { ok: false, code: 'SOLD_OUT', error: '推荐餐品在该店均无对应在售商品', unmapped });
      const q = await callTool('calculate-price', {
        storeCode, orderType: 1, beType: 1, needTableware: false,
        items: matched.map((m) => ({ productCode: m.code, quantity: 1 }))
      });
      const qd = (q && q.data) || {};
      const takeWay = (qd.takeWayList || []).find((t) => t.code === 'take-in-store') || (qd.takeWayList || [])[0];
      if (!takeWay) return sendJson(res, { ok: false, error: '未获取到取餐方式' });
      const o = await callTool('create-order', {
        storeCode, orderType: 1, beType: 1, needTableware: false,
        takeWayCode: takeWay.code,
        items: matched.map((m) => ({ productCode: m.code, quantity: 1 }))
      });
      if (!o || o.success === false) {
        const fe = friendlyErr((o && o.message) || '下单失败');
        console.error('[create-order fail]', fe.code, JSON.stringify(o).slice(0, 400));
        return sendJson(res, { ok: false, code: fe.code, error: fe.text, raw: o });
      }
      /* 防御式取字段：不同版本字段名可能有差异 */
      const od = o.data || o;
      const orderId = od.orderId || od.orderNo || od.orderID || '';
      const payH5Url = od.payH5Url || od.payUrl || od.h5Url || od.paymentUrl || '';
      const totalFen = typeof od.price === 'number' ? od.price : (typeof qd.price === 'number' ? qd.price : null);
      if (!orderId || !payH5Url) {
        return sendJson(res, { ok: false, error: '下单成功但未拿到支付链接', raw: o });
      }
      return sendJson(res, {
        ok: true, orderId, payH5Url,
        total: totalFen === null ? null : totalFen / 100, totalFen,
        takeWay: takeWay.title,
        items: (qd.productList || []).map((x) => ({ name: x.productName, qty: x.quantity })),
        unmatched: unmapped
      });
    }

    if (p.startsWith('/api/')) return sendJson(res, { ok: false, error: 'unknown api' }, 404);
    serveStatic(req, res, p);
  } catch (e) {
    console.error('[api error]', p, e.message);
    sendJson(res, { ok: false, error: e.message || String(e) }, 500);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('mcd-nutrition-coach proxy listening on :' + PORT + ' | token: ' + (TOKEN ? 'loaded' : 'MISSING (snapshot mode)'));
});
