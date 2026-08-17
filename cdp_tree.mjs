import WebSocket from 'ws';
import fs from 'fs';

// Capture the pedigree tree diagram data (full tree JSON with family links).
const BASE = 'http://localhost:9222';
const OUT_DIR = 'data/captures';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function getTargets() { return (await fetch(`${BASE}/json/list`)).json(); }
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const netCaptures = [];
    const handlers = {};
    ws.on('open', () => resolve({
      ws, netCaptures,
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
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
        return;
      }
      if (msg.method && handlers[msg.method]) handlers[msg.method].forEach(cb => cb(msg.params));
    });
    ws.on('error', reject);
  });
}

const targets = await getTargets();
let target = targets.find(t => t.type === 'page' && t.url.includes('myheritage') && !t.url.includes('chrome'));
if (!target) { console.error('No myheritage page'); process.exit(1); }
console.log('Target:', target.url);

const { ws, send, netCaptures, on } = await connect(target.webSocketDebuggerUrl);
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable', { maxTotalBufferSize: 400 * 1024 * 1024, maxResourceBufferSize: 400 * 1024 * 1024 });

const captureBodies = {};
on('Network.responseReceived', (params) => {
  try {
    const { response, requestId } = params;
    const url = response.url;
    const ct = (response.headers['content-type'] || response.mimeType || '').toLowerCase();
    if (response.status >= 200 && response.status < 400 && (ct.includes('json') || ct.includes('graphql') || /tree|getTree|diagram|family|graph/i.test(url))) {
      captureBodies[requestId] = { url, ct, status: response.status };
    }
  } catch {}
});
on('Network.loadingFinished', async (params) => {
  try {
    const meta = captureBodies[params.requestId];
    if (!meta) return;
    const res = await send('Network.getResponseBody', { requestId: params.requestId });
    const body = res && res.body ? res.body : '';
    if (body.length < 200000) {
      netCaptures.push({ ...meta, body });
    } else {
      netCaptures.push({ ...meta, body: '', tooBig: true });
    }
    const short = meta.url.split('?')[0].substring(0, 120);
    console.log(`[CAP] ${meta.status} ${meta.ct} ${short} (${body.length})`);
  } catch {}
});

console.log('\nNavigating to pedigree diagram (Wairua tree)...');
await send('Page.navigate', {
  url: 'https://www.myheritage.com/pedigree-tree-OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ/wairua?familyTreeID=2&gallery=0',
});
await new Promise(r => setTimeout(r, 20000));

const state = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText : '').substring(0, 2500),
    treeNodes: document.querySelectorAll('.node, .person, [class*="relatives"], [class*="treeNode"]').length,
    inputs: Array.from(document.querySelectorAll('input')).map(i => i.name)
  })`,
  returnByValue: true,
});
try {
  const val = JSON.parse(state.result.value);
  console.log('URL:', val.url);
  console.log('TITLE:', val.title);
  console.log('TEXT:', val.text.replace(/\s+/g, ' ').substring(0, 1200));
  console.log('treeNodes:', val.treeNodes);
} catch (e) { console.log('err', e.message); }

console.log('\n=== Captures:', netCaptures.length, '===');
netCaptures.forEach((c, i) => {
  try {
    const parsed = c.tooBig ? null : JSON.parse(c.body);
    fs.writeFileSync(`${OUT_DIR}/tree_${String(i).padStart(3, '0')}.json`, JSON.stringify({ url: c.url, ct: c.ct, status: c.status, data: parsed }, null, 2));
  } catch {
    fs.writeFileSync(`${OUT_DIR}/tree_${String(i).padStart(3, '0')}.json`, JSON.stringify({ url: c.url, ct: c.ct, status: c.status, body: c.body.substring(0, 3000) }, null, 2));
  }
});
console.log('Saved tree captures.');

ws.close();
process.exit(0);