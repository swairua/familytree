import WebSocket from 'ws';
import fs from 'fs';
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
  const res = await fetch(base + '?action=list&treeId=all&page=1&perPage=250&filter=0&sort=lname&letter=&relatives=1&format=json', { credentials: 'include', headers: { 'Accept': 'application/json' } });
  const j = await res.json();
  const persons = j.data.persons;
  // find a person with non-empty relatives
  let sample = null;
  for (const p of persons) {
    if (p.relatives && (Array.isArray(p.relatives) ? p.relatives.length : Object.keys(p.relatives).length)) { sample = p; break; }
  }
  return JSON.stringify({
    total: j.data.total,
    nPersons: persons.length,
    withRelatives: persons.filter(p => p.relatives && (Array.isArray(p.relatives) ? p.relatives.length : Object.keys(p.relatives).length)).length,
    samplePerson: sample ? { id: sample.id, name: sample.name, relatives: sample.relatives } : null
  }, null, 2);
})()
`;
const r = await send('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
try {
  const out = JSON.parse(r.result.value);
  console.log('total:', out.total, 'persons:', out.nPersons, 'withRelatives:', out.withRelatives);
  console.log(JSON.stringify(out.samplePerson, null, 1));
} catch (e) { console.log('err', e.message, String(r.result.value).substring(0,1500)); }
ws.close();
process.exit(0);