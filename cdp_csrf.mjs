import WebSocket from 'ws';
const BASE = 'http://localhost:9222';
async function getTargets() { return (await fetch(`${BASE}/json/list`)).json(); }
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const handlers = {};
    ws.on('open', () => resolve({
      ws,
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
const { ws, send } = await connect(target.webSocketDebuggerUrl);
await send('Runtime.enable');

// First navigate to the people page to get a fresh csrf token in the HTML/JS
const r1 = await send('Runtime.evaluate', {
  expression: `(() => {
    // look for csrf tokens in DOM / globals
    const html = document.documentElement.outerHTML;
    const re = /csrf[_a-zA-Z]*["']?\\s*[:=]\\s*["']([A-Za-z0-9_.]+)["']/g;
    const found = [];
    let m;
    while ((m = re.exec(html)) && found.length < 10) found.push(m[1]);
    return JSON.stringify({ found, keys: Object.keys(window).filter(k => /csrf/i.test(k)).slice(0,10) });
  })()`,
  returnByValue: true,
});
try { console.log('csrf scan:', r1.result.value); } catch(e){ console.log('e1', e.message); }

ws.close();
process.exit(0);