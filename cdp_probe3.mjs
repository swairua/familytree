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
await send('Page.enable');

// We're on people page. Find first person row link via click.
const probe = await send('Runtime.evaluate', {
  expression: `(() => {
    const rows = Array.from(document.querySelectorAll('a[href], [role="link"], [data-person-id]'));
    const interesting = rows.filter(a => {
      const t = (a.innerText || '').trim();
      return a.href && !a.href.includes('myheritage.com/about') && (t.length < 40) && (a.href.includes('people-') || a.href.includes('person-') || a.href.includes('profile-') || a.href.includes('individual'));
    }).map(a => ({ tag: a.tagName, cls: (a.className||'').toString().substring(0,60), href: a.href, text: (a.innerText||'').trim().substring(0,40), dataId: a.dataset.personId || a.dataset.individualId || '' }));
    return JSON.stringify({ count: rows.length, interesting: interesting.slice(0, 25) }, null, 1);
  })()`,
  returnByValue: true,
});
try { console.log(probe.result.value); } catch (e) { console.log('err', e.message); }

ws.close();
process.exit(0);