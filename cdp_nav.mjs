import WebSocket from 'ws';
import fs from 'fs';

// CDP navigation + network capture for MyHeritage extraction.
// Usage: node cdp_nav.mjs

const BASE = 'http://localhost:9222';
const OUT_DIR = 'data/captures';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function getTargets() {
  const res = await fetch(`${BASE}/json/list`);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const netCaptures = [];
    const handlers = {};
    ws.on('open', () => resolve({
      ws,
      netCaptures,
      on(event, cb) { (handlers[event] = handlers[event] || []).push(cb); },
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const msgId = ++id;
          pending.set(msgId, { res, rej });
          ws.send(JSON.stringify({ id: msgId, method, params }));
        });
      },
    }));
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
        return;
      }
      if (msg.method && handlers[msg.method]) {
        handlers[msg.method].forEach((cb) => cb(msg.params));
      }
    });
    ws.on('error', reject);
  });
}

const targets = await getTargets();
let target = targets.find(t => t.type === 'page' && t.url.includes('myheritage') && !t.url.includes('photo') && !t.url.includes('discovery'));
if (!target) target = targets.find(t => t.type === 'page' && t.url.includes('myheritage'));
if (!target) { console.error('No myheritage page target'); process.exit(1); }
console.log('Target:', target.id, target.url);

const { ws, send, netCaptures, on } = await connect(target.webSocketDebuggerUrl);
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable', { maxTotalBufferSize: 50 * 1024 * 1024, maxResourceBufferSize: 50 * 1024 * 1024 });

// Capture JSON + ged responses
const captureBodies = {};
on('Network.responseReceived', (params) => {
  try {
    const { response, requestId } = params;
    const url = response.url;
    const ct = (response.headers['content-type'] || response.mimeType || '').toLowerCase();
    const status = response.status;
    const interesting = ct.includes('json') || ct.includes('ged') || /\.ged($|\?)/.test(url) || /gedcom/i.test(url) || /export/i.test(url);
    if (status >= 200 && status < 400 && interesting) {
      captureBodies[requestId] = { url, ct, status };
    }
  } catch {}
});

on('Network.loadingFinished', async (params) => {
  try {
    const meta = captureBodies[params.requestId];
    if (!meta) return;
    const res = await send('Network.getResponseBody', { requestId: params.requestId });
    const body = res && res.body ? res.body : '';
    const entry = { url: meta.url, ct: meta.ct, status: meta.status, body };
    netCaptures.push(entry);
    console.log(`[CAP] ${meta.status} ${meta.ct} ${meta.url.substring(0, 120)} (${body.length} bytes)`);
    if (/ged/i.test(meta.url) || meta.ct.includes('ged')) {
      fs.writeFileSync(pathSafe(meta.url), body);
      console.log('   !! SAVED GEDCOM-like response');
    }
  } catch {}
});

function pathSafe(url) {
  const name = url.replace(/[^\w.-]+/g, '_').substring(0, 100) || 'response';
  return `${OUT_DIR}/${name}`;
}

// Navigate to family trees listing
const TREES_URL = 'https://www.myheritage.com/family-trees/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';
console.log('\nNavigating to trees listing:', TREES_URL);
await send('Page.navigate', { url: TREES_URL });
await new Promise(r => setTimeout(r, 12000));

// Get page state
const state = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText : '').substring(0, 4000),
    links: Array.from(document.querySelectorAll('a')).slice(0,60).map(a => ({t:(a.textContent||'').trim().substring(0,80), h:a.href})).filter(l=>l.t),
    buttons: Array.from(document.querySelectorAll('button')).slice(0,30).map(b => (b.textContent||'').trim().substring(0,80)).filter(t=>t)
  })`,
  returnByValue: true,
});
try {
  const val = JSON.parse(state.result.value);
  console.log('\nURL:', val.url);
  console.log('TITLE:', val.title);
  console.log('BUTTONS:', JSON.stringify(val.buttons));
  console.log('LINKS:');
  val.links.forEach(l => console.log('  -', l.t, '=>', l.h));
  console.log('\nTEXT (first 1500):', val.text.replace(/\s+/g, ' ').substring(0, 1500));
  fs.writeFileSync(`${OUT_DIR}/trees_listing_text.txt`, val.text);
} catch (e) {
  console.log('Parse err:', e.message, state.result);
}

// Dump what we captured so far
console.log('\n=== Network captures so far:', netCaptures.length, '===');
netCaptures.slice(0, 30).forEach(c => console.log(' ', c.status, c.ct, c.url.substring(0, 120)));

// Save all captures
netCaptures.forEach((c, i) => {
  try {
    const parsed = JSON.parse(c.body);
    fs.writeFileSync(`${OUT_DIR}/net_${String(i).padStart(3, '0')}.json`, JSON.stringify({ url: c.url, ct: c.ct, status: c.status, data: parsed }, null, 2));
  } catch {
    fs.writeFileSync(`${OUT_DIR}/net_${String(i).padStart(3, '0')}.json`, JSON.stringify({ url: c.url, ct: c.ct, status: c.status, body: c.body.substring(0, 5000) }, null, 2));
  }
});

console.log('\nSaved captures to', OUT_DIR);
ws.close();
process.exit(0);
