import WebSocket from 'ws';
// Find correct person profile + export URL patterns from the people page DOM and any JS.
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
// Navigate to people page
await send('Page.navigate', { url: 'https://www.myheritage.com/people-OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ/wairua?query=&scope=all&treeId=all' });
await new Promise(r => setTimeout(r, 10000));
const r = await send('Runtime.evaluate', {
  expression: `(() => {
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href)
      .filter(h => /person|profile|individual/i.test(h));
    // also grab any anchors with data attrs
    const anchors = Array.from(document.querySelectorAll('a[href*="people-"], a[data-person-id], a[href*="_20"]'));
    return JSON.stringify({
      sample: links.slice(0, 30),
      anchorInfo: anchors.slice(0, 10).map(a => ({ href: a.href, text: (a.innerText||'').trim().substring(0,40), dataPersonId: a.getAttribute('data-person-id') }))
    }, null, 1);
  })()`,
  returnByValue: true,
});
try { console.log(r.result.value); } catch (e) { console.log('err', e.message); }
ws.close();
process.exit(0);