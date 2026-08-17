import WebSocket from 'ws';
import fs from 'fs';

// Raw CDP client using the ws module (avoids puppeteer connect hang).
// Usage: node cdp_direct.mjs <command> [pageId]
//   commands: list | content | evaluate <js> | screenshot <path>

const BASE = 'http://localhost:9222';

async function getTargets() {
  const res = await fetch(`${BASE}/json/list`);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.on('open', () => resolve({
      ws,
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
      }
    });
    ws.on('error', reject);
  });
}

const cmd = process.argv[2];
const targets = await getTargets();

if (cmd === 'list') {
  for (const t of targets) {
    if (t.type === 'page') console.log(t.id, '|', (t.title || '').substring(0, 50), '|', t.url);
  }
  process.exit(0);
}

// Find a myheritage page
let target = targets.find(t => t.type === 'page' && t.url.includes('myheritage'));
if (!target) target = targets.find(t => t.type === 'page');
if (!target) { console.error('No page target found'); process.exit(1); }
console.log('Target:', target.id, target.url);

const { ws, send } = await connect(target.webSocketDebuggerUrl);
await send('Runtime.enable');

if (cmd === 'content') {
  const r = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      hasPass: !!document.querySelector('input[type="password"]'),
      hasEmail: !!document.querySelector('input[type="email"]'),
      text: (document.body ? document.body.innerText : '').substring(0, 3000),
      html: (document.body ? document.body.innerHTML : '').substring(0, 800),
      links: Array.from(document.querySelectorAll('a')).slice(0,40).map(a => ({t:(a.textContent||'').trim().substring(0,60), h:a.href})).filter(l=>l.t)
    })`,
    returnByValue: true,
  });
  const val = r.result && r.result.value;
  try { console.log(JSON.stringify(JSON.parse(val), null, 2)); }
  catch { console.log('RAW:', String(val).substring(0, 2000)); }
}

if (cmd === 'evaluate') {
  const expr = process.argv[3];
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(r.result, null, 2));
}

if (cmd === 'screenshot') {
  const path = process.argv[3] || 'data/captures/cdp_screenshot.png';
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r && r.data) {
    fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
    console.log('Screenshot saved to', path);
  } else {
    console.log('No screenshot data', JSON.stringify(r));
  }
}

ws.close();
process.exit(0);
