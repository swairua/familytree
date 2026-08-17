import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildGedcomFromPeople } from './build_gedcom.mjs';

// ---------------------------------------------------------------------------
// Sync: re-pull ALL people from MyHeritage via the logged-in CDP browser,
// rebuild the GEDCOM and import it into the MySQL database. Progress is
// written to data/sync_status.json so the UI can poll.
//
// Usage:  node sync_myheritage.mjs
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'sync_status.json');
const PEOPLE_FILE = path.join(DATA_DIR, 'captures', 'all_people_rel.json');
const GEDCOM_FILE = path.join(DATA_DIR, 'myheritage_export.ged');
const SITE_ID = 'OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';
const CDP_BASE = process.env.CDP_BASE || 'http://localhost:9222';

fs.mkdirSync(path.join(DATA_DIR, 'captures'), { recursive: true });

let aborted = false;
if (process.env.SYNC_ABORT_FILE) {
  fs.writeFileSync(process.env.SYNC_ABORT_FILE, '', 'utf8');
}

function writeStatus(patch) {
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch {}
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
  const msg = patch.message || '';
  if (msg) console.log('[sync]', msg);
}

async function getTargets() {
  return (await fetch(`${CDP_BASE}/json/list`)).json();
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

function checkAbort() {
  if (process.env.SYNC_ABORT_FILE && fs.existsSync(process.env.SYNC_ABORT_FILE)) {
    const content = fs.readFileSync(process.env.SYNC_ABORT_FILE, 'utf8').trim();
    if (content === 'abort') return true;
  }
  return false;
}

async function main() {
  writeStatus({ state: 'running', message: 'Connecting to MyHeritage browser (CDP)...', progress: 0 });

  // ---- discover CDP page ---------------------------------------------------
  let targets;
  try {
    targets = await getTargets();
  } catch (e) {
    writeStatus({ state: 'error', message: 'Cannot reach CDP on port 9222. Start Opera with --remote-debugging-port=9222 and log in to MyHeritage.', progress: 0 });
    process.exit(1);
  }
  let target = targets.find(t => t.type === 'page' && t.url.includes('myheritage') && !t.url.includes('chrome'));
  if (!target) {
    writeStatus({ state: 'error', message: 'No MyHeritage tab found in the CDP browser.', progress: 0 });
    process.exit(1);
  }
  console.log('Target:', target.url);

  const { ws, send } = await connect(target.webSocketDebuggerUrl);
  await send('Runtime.enable');

  writeStatus({ message: 'Extracting people from MyHeritage...', progress: 5 });

  // ---- paginate the people-list API -----------------------------------------
  const script = `
(async () => {
  const siteId = '${SITE_ID}';
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
      window.__SYNC_PROGRESS = { page, got: results.length, total };
      if (persons.length === 0 || parseInt(json.data.pageNumber, 10) >= maxPages) break;
      page = parseInt(json.data.pageNumber, 10) + 1;
    } else {
      results.push({ error: 'bad json', url });
      break;
    }
  }
  return JSON.stringify({ total, collected: results.length, people: results, progress: window.__SYNC_PROGRESS });
})()
`;

  const r = await send('Runtime.evaluate', { expression: script, returnByValue: true, awaitPromise: true });
  let out;
  try {
    out = JSON.parse(r.result.value);
  } catch (e) {
    writeStatus({ state: 'error', message: 'Failed to parse extraction result: ' + e.message, progress: 0 });
    process.exit(1);
  }

  if (out.error) {
    writeStatus({ state: 'error', message: 'Extraction error: ' + out.error, progress: 0 });
    process.exit(1);
  }

  const people = (out.people || []).filter(p => !p.error);
  const total = parseInt(out.total, 10) || people.length;
  writeStatus({ message: `Extracted ${people.length} of ${total} people`, progress: 60, total, extracted: people.length });

  // ---- rebuild GEDCOM -------------------------------------------------------
  writeStatus({ message: 'Rebuilding GEDCOM file...', progress: 70 });
  const ged = buildGedcomFromPeople(people, GEDCOM_FILE);
  writeStatus({ message: `GEDCOM rebuilt: ${ged.individuals} individuals, ${ged.families} families`, progress: 80 });

  // ---- import into MySQL -----------------------------------------------------
  writeStatus({ message: 'Importing into database...', progress: 85 });
  const { execFileSync } = await import('child_process');
  const php = process.env.PHP_BIN || 'php';
  const importer = path.join(__dirname, 'api', 'import_gedcom.php');
  try {
    execFileSync(php, [importer, '--file', GEDCOM_FILE], { stdio: 'inherit', timeout: 300000 });
  } catch (e) {
    writeStatus({ state: 'error', message: 'Database import failed: ' + (e.message || 'see log'), progress: 85 });
    process.exit(1);
  }

  ws.close();

  writeStatus({
    state: 'done',
    message: `Sync complete: ${people.length} people, ${ged.families} families synced to database`,
    progress: 100,
    total: people.length,
    extracted: people.length,
    families: ged.families,
  });
  console.log('Sync complete.');
  process.exit(0);
}

main().catch((e) => {
  writeStatus({ state: 'error', message: 'Sync failed: ' + (e && e.message ? e.message : String(e)), progress: 0 });
  process.exit(1);
});