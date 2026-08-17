import WebSocket from 'ws';
import fs from 'fs';

// Fetch ALL people (all pages) with relatives=1 → complete dataset for GEDCOM building.
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
console.log('Target:', target.url);

const { ws, send } = await connect(target.webSocketDebuggerUrl);
await send('Runtime.enable');

const script = `
(async () => {
  const siteId = 'OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';
  const results = [];
  const pageSize = 250;
  const baseUrl = 'https://www.myheritage.com/pedigree-tree-' + siteId + '/wairua?action=list&treeId=all&filter=0&sort=lname&letter=&relatives=1&format=json';
  let page = 1;
  let total = 0;
  for (;;) {
    const url = baseUrl + '&page=' + page + '&perPage=' + pageSize;
    const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!res.ok) { results.push({ error: 'HTTP ' + res.status, url }); break; }
    const json = await res.json();
    if (json && json.data) {
      total = parseInt(json.data.total || 0, 10);
      const persons = json.data.persons || [];
      results.push(...persons);
      const maxPages = json.data.totalPages || Math.ceil(total / pageSize);
      console.log('page', json.data.pageNumber, 'got', persons.length, 'of', total);
      if (persons.length === 0 || parseInt(json.data.pageNumber, 10) >= maxPages) break;
      page = parseInt(json.data.pageNumber, 10) + 1;
    } else {
      results.push({ error: 'bad json', url });
      break;
    }
  }
  return JSON.stringify({ total, collected: results.length, people: results });
})()
`;

const r = await send('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
try {
  const out = JSON.parse(r.result.value);
  console.log('TOTAL:', out.total);
  console.log('COLLECTED:', out.collected);
  // sanity: count persons with relatives
  let withRel = 0, spouseGroups = 0, childRefs = 0;
  for (const p of out.people) {
    if (p.relatives && Object.keys(p.relatives).length) withRel++;
    if (p.relatives && p.relatives.spouses && p.relatives.spouses.persons) spouseGroups += p.relatives.spouses.persons.length;
    if (p.relatives && p.relatives.children && p.relatives.children.persons) childRefs += p.relatives.children.persons.length;
  }
  console.log('with relatives:', withRel, 'spouse refs:', spouseGroups, 'child refs:', childRefs);
  fs.writeFileSync(`${OUT_DIR}/all_people_rel.json`, JSON.stringify(out, null, 2));
  console.log('Saved data/captures/all_people_rel.json');
} catch (e) { console.log('Parse error:', e.message); console.log(String(r.result.value).substring(0,1000)); }

ws.close();
process.exit(0);