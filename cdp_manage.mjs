import WebSocket from 'ws';
import fs from 'fs';

// Navigate to Manage Trees / genealogy welcome and look for GEDCOM export
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
    const netCaptures = [];
    const handlers = {};
    ws.on('open', () => resolve({
      ws, netCaptures,
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

const { ws, send, netCaptures, on } = await connect(target.webSocketDebuggerUrl);
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable', { maxTotalBufferSize: 50 * 1024 * 1024, maxResourceBufferSize: 50 * 1024 * 1024 });

const captureBodies = {};
on('Network.responseReceived', (params) => {
  try {
    const { response, requestId } = params;
    const url = response.url;
    const ct = (response.headers['content-type'] || response.mimeType || '').toLowerCase();
    if (response.status >= 200 && response.status < 400) {
      if (ct.includes('json') || /ged/i.test(url) || /export/i.test(url) || /download/i.test(url)) {
        captureBodies[requestId] = { url, ct, status: response.status };
      }
    }
  } catch {}
});
on('Network.loadingFinished', async (params) => {
  try {
    const meta = captureBodies[params.requestId];
    if (!meta) return;
    const res = await send('Network.getResponseBody', { requestId: params.requestId });
    const body = res && res.body ? res.body : '';
    netCaptures.push({ ...meta, body });
    console.log(`[CAP] ${meta.status} ${meta.ct} ${meta.url.substring(0, 120)} (${body.length})`);
    if (/ged/i.test(meta.url) || meta.ct.includes('ged')) {
      const f = `${OUT_DIR}/export_${Date.now()}.ged`;
      fs.writeFileSync(f, body);
      console.log('   !! GEDCOM SAVED:', f);
    }
  } catch {}
});

// 1. Navigate to Manage Trees (genealogy welcome)
console.log('\nNavigating to Manage Trees...');
await send('Page.navigate', { url: 'https://www.myheritage.com/FP/genealogy-welcome.php?s=OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ' });
await new Promise(r => setTimeout(r, 12000));

const state = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText : '').substring(0, 6000),
    links: Array.from(document.querySelectorAll('a')).slice(0,120).map(a => ({t:(a.textContent||'').trim().substring(0,80), h:a.href})).filter(l=>l.t && /ged|export|tree|download/i.test(l.t + ' ' + l.h))
  })`,
  returnByValue: true,
});
try {
  const val = JSON.parse(state.result.value);
  console.log('URL:', val.url);
  console.log('TITLE:', val.title);
  console.log('LINKS (ged/export/tree):');
  val.links.forEach(l => console.log('  -', l.t, '=>', l.h));
  console.log('\nTEXT (first 2000):');
  console.log(val.text.replace(/\s+/g, ' ').substring(0, 2000));
  fs.writeFileSync(`${OUT_DIR}/manage_trees.txt`, val.text);
} catch (e) {
  console.log('parse err', e.message);
}

// 2. Look for "Export" / "GEDCOM" buttons on the page and click if found
const btnResult = await send('Runtime.evaluate', {
  expression: `(() => {
    const all = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'));
    const matches = all.filter(el => {
      const t = ((el.textContent||'') + ' ' + (el.getAttribute && el.getAttribute('title')||'') + ' ' + (el.href||'')).toLowerCase();
      return /gedcom|export|download|save as/.test(t);
    });
    return JSON.stringify(matches.map(el => ({
      tag: el.tagName,
      text: (el.textContent||'').trim().substring(0,60),
      href: el.href || '',
      title: el.getAttribute ? el.getAttribute('title') || '' : '',
      onclick: el.getAttribute ? el.getAttribute('onclick') || '' : ''
    })));
  })()`,
  returnByValue: true,
});
try {
  const btns = JSON.parse(btnResult.result.value);
  console.log('\nGEDCOM/export elements found:', btns.length);
  btns.forEach(b => console.log('  ', b.tag, '|', b.text, '|', b.href, '|', b.title, '|', b.onclick));
} catch (e) {
  console.log('btn parse err', e.message);
}

console.log('\nCaptures:', netCaptures.length);
ws.close();
process.exit(0);
