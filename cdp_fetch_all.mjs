import WebSocket from 'ws';
import fs from 'fs';

// Paginate the MyHeritage people-list API and collect ALL people.
// Uses the page's own fetch() within the logged-in browser (keeps cookies + CSRF).
const BASE = 'http://localhost:9222';
const OUT_DIR = 'data/captures';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function getTargets() {
  return (await fetch(`${BASE}/json/list`)).json();
}
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
let target = targets.find(t => t.type === 'page' && t.url.includes('myheritage'));
if (!target) { console.error('No myheritage page'); process.exit(1); }
console.log('Target:', target.url);

const { ws, send } = await connect(target.webSocketDebuggerUrl);
await send('Runtime.enable');

// First ensure we're on a myheritage page context for fetch
const base = await send('Runtime.evaluate', {
  expression: `(() => {
    if (!location.href.includes('myheritage.com')) { location.href = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ'; return 'navigating'; }
    return 'ready';
  })()`,
  returnByValue: true,
});
console.log('Context check:', base.result.value);
if (base.result.value === 'navigating') {
  await new Promise(r => setTimeout(r, 12000));
}

// Fetch all pages of the list API using the page's fetch (session cookies)
const script = `
(async () => {
  const siteId = 'OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';
  const results = [];
  let total = 0;
  const pageSize = 250;
  // First page to learn total
  const baseUrl = 'https://www.myheritage.com/pedigree-tree-' + siteId + '/wairua?action=list&treeId=all&filter=0&sort=lname&letter=&relatives=0&format=json';
  let page = 1;
  let maxPages = 1;
  for (;;) {
    const url = baseUrl + '&page=' + page + '&perPage=' + pageSize;
    const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!res.ok) { results.push({ error: 'HTTP ' + res.status, url }); break; }
    const json = await res.json();
    if (json && json.data) {
      total = parseInt(json.data.total || 0, 10);
      const persons = json.data.persons || [];
      results.push(...persons);
      maxPages = json.data.totalPages || Math.ceil(total / pageSize);
      if (json.data.pageNumber >= maxPages) break;
      page = parseInt(json.data.pageNumber, 10) + 1;
    } else {
      results.push({ error: 'bad json', url });
      break;
    }
  }
  return JSON.stringify({ total, pageCount: page, collected: results.length, results });
})()
`;

const r = await send('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
let out;
try {
  out = JSON.parse(r.result.value);
  console.log('TOTAL:', out.total);
  console.log('PAGES:', out.pageCount);
  console.log('COLLECTED:', out.collected);
  if (out.total !== out.collected) console.log('!! MISMATCH — may need more pages');
  fs.writeFileSync(`${OUT_DIR}/all_people.json`, JSON.stringify({ total: out.total, collected: out.collected, people: out.results }, null, 2));
  console.log('Saved data/captures/all_people.json');
  const first = out.results[0];
  if (first) console.log('First:', JSON.stringify(first).substring(0, 300));
} catch (e) {
  console.log('Parse error:', e.message);
  console.log('Raw:', String(r.result.value).substring(0, 1000));
}

ws.close();
process.exit(0);
