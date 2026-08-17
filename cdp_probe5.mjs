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
const script = `
(async () => {
  const S = 'OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';
  const base = 'https://www.myheritage.com/pedigree-tree-' + S + '/wairua';
  const tries = [
    { name: 'list relatives=1 all', url: base + '?action=list&treeId=all&page=1&perPage=250&filter=0&sort=lname&letter=&relatives=1&format=json' },
    { name: 'list relatives=2 all', url: base + '?action=list&treeId=all&page=1&perPage=250&filter=0&sort=lname&letter=&relatives=2&format=json' },
    { name: 'list tree=2', url: base + '?action=list&treeId=2&page=1&perPage=250&filter=0&sort=lname&letter=&relatives=1&format=json' },
  ];
  const out = [];
  for (const t of tries) {
    try {
      const res = await fetch(t.url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
      const text = await res.text();
      let summary = {};
      try {
        const j = JSON.parse(text);
        summary = { status: j.status, total: j.data && j.data.total, got: j.data && j.data.persons ? j.data.persons.length : 0 };
        if (j.data && j.data.persons && j.data.persons[0]) {
          summary.firstKeys = Object.keys(j.data.persons[0]);
          summary.family = { pf: j.data.persons[0].parentFamilyId, f: j.data.persons[0].fatherId, m: j.data.persons[0].motherId };
        }
      } catch (e) { summary = { parseErr: e.message, head: text.substring(0,200) }; }
      out.push({ name: t.name, http: res.status, len: text.length, ...summary });
    } catch (e) { out.push({ name: t.name, error: e.message }); }
  }
  return JSON.stringify(out, null, 1);
})()
`;
const r = await send('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
try { console.log(JSON.parse(r.result.value).map(o => '\n' + JSON.stringify(o, null, 1)).join('')); }
catch (e) { console.log('err', e.message, String(r.result.value).substring(0,1000)); }
ws.close();
process.exit(0);