import WebSocket from 'ws';
import fs from 'fs';

// Discover the individual profile page JSON API for one person.
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
await send('Network.enable', { maxTotalBufferSize: 200 * 1024 * 1024, maxResourceBufferSize: 200 * 1024 * 1024 });

const captureBodies = {};
on('Network.responseReceived', (params) => {
  try {
    const { response, requestId } = params;
    const url = response.url;
    const ct = (response.headers['content-type'] || response.mimeType || '').toLowerCase();
    if (response.status >= 200 && response.status < 400 && (ct.includes('json') || ct.includes('graphql') || /api|individual|person|tree|genealogy/i.test(url))) {
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
    netCaptures.push({ ...meta, body });
    const short = meta.url.split('?')[0].substring(0, 120);
    console.log(`[CAP] ${meta.status} ${meta.ct} ${short} (${body.length})`);
  } catch {}
});

// Navigate to an individual profile
console.log('\nNavigating to individual profile...');
await send('Page.navigate', {
  url: 'https://www.myheritage.com/person-OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ_2000001/wairua',
});
await new Promise(r => setTimeout(r, 12000));

const state = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText : '').substring(0, 4000),
    links: Array.from(document.querySelectorAll('a[href*="person-"], a[href*="individual"]')).map(a => a.href).slice(0, 20)
  })`,
  returnByValue: true,
});
try {
  const val = JSON.parse(state.result.value);
  console.log('URL:', val.url);
  console.log('TITLE:', val.title);
  console.log('TEXT:', val.text.replace(/\s+/g, ' ').substring(0, 1500));
  console.log('person-links:', JSON.stringify(val.links, null, 1));
} catch (e) { console.log('err', e.message); }

console.log('\n=== Captures:', netCaptures.length, '===');
netCaptures.forEach((c, i) => {
  try {
    const parsed = JSON.parse(c.body);
    fs.writeFileSync(`${OUT_DIR}/person_probe_${String(i).padStart(3, '0')}.json`, JSON.stringify({ url: c.url, ct: c.ct, status: c.status, data: parsed }, null, 2));
  } catch {
    fs.writeFileSync(`${OUT_DIR}/person_probe_${String(i).padStart(3, '0')}.json`, JSON.stringify({ url: c.url, ct: c.ct, status: c.status, body: c.body.substring(0, 3000) }, null, 2));
  }
});
console.log('Saved person probes.');

ws.close();
process.exit(0);