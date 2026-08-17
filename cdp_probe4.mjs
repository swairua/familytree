import WebSocket from 'ws';
import fs from 'fs';

// Probe candidate full-tree export endpoints using in-page fetch (keeps session).
const BASE = 'http://localhost:9222';
const OUT_DIR = 'data/captures';
fs.mkdirSync(OUT_DIR, { recursive: true });

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
    { name: 'tree gens=60', url: base + '?action=tree&mode=viewPedigree&individualId=2000158&generations=60&activity=tree' },
    { name: 'tree viewPin relative=0', url: base + '?action=tree&mode=viewPedigree&individualId=2000158&generations=6&activity=tree&relatives=0&filter=0&format=json' },
    { name: 'tree familyTreeID', url: base + '?action=tree&mode=viewPedigree&individualId=2000158&generations=6&familyTreeID=2&activity=tree' },
    { name: 'immfamily', url: 'https://www.myheritage.com/immfamily-tree-' + S + '/wairua?action=tree&treeId=2&individualId=2000158&format=json' },
    { name: 'family-tree page', url: 'https://www.myheritage.com/family-tree-' + S + '/wairua?treeId=2&format=json' },
  ];
  const out = [];
  for (const t of tries) {
    try {
      const res = await fetch(t.url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
      const text = await res.text();
      let info = { name: t.name, status: res.status, url: t.url, len: text.length, head: text.substring(0, 400) };
      out.push(info);
    } catch (e) {
      out.push({ name: t.name, error: e.message });
    }
  }
  return JSON.stringify(out, null, 1);
})()
`;

const r = await send('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
try {
  const arr = JSON.parse(r.result.value);
  arr.forEach(o => {
    console.log('\n=== ' + o.name + ' | status=' + o.status + ' len=' + o.len + ' ===');
    console.log(o.head ? o.head.replace(/\n/g, ' ').substring(0, 300) : o.error);
  });
} catch (e) { console.log('err', e.message, String(r.result.value).substring(0,1000)); }

ws.close();
process.exit(0);