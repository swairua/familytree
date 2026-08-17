/**
 * extract_tree_cdp.mjs
 *
 * Extracts a MyHeritage family tree using the user's real Chrome session (CDP).
 *
 * Usage:
 *   node extract_tree_cdp.mjs [--port 9222] [--dry-run]
 *
 * Behaviour:
 *   1. Connects to an existing Chrome instance on the CDP port.
 *   2. If logged out of MyHeritage, auto-fills the login form using
 *      myheritage_credentials.json (git-ignored).
 *      - If a CAPTCHA / 2FA appears, it PAUSES and waits for you to
 *        complete it manually in the Chrome window, then continues.
 *   3. Navigates to the family site and locates the Family Tree module.
 *   4. Captures every network JSON response (people/relationships/events).
 *   5. Also extracts from the rendered DOM as a fallback.
 *   6. Writes raw captures to data/captures/ and a GEDCOM to
 *      data/myheritage_export.ged
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const CAPTURES_DIR = path.join(DATA_DIR, 'captures');

// ---- CLI args -----------------------------------------------------------------
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg >= 0 && args[portArg + 1] ? parseInt(args[portArg + 1], 10) : 9222;
const DRY_RUN = args.includes('--dry-run');

// ---- Credentials ----------------------------------------------------------------
let CREDS = null;
const credsPath = path.join(__dirname, 'myheritage_credentials.json');
if (fs.existsSync(credsPath)) {
  CREDS = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
}

const TARGET_URL = CREDS?.familySiteUrl || 'https://www.myheritage.com/';
const USER_EMAIL = CREDS?.email || '';
const USER_PASS = CREDS?.password || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- CDP helpers ---------------------------------------------------------------
function checkPort(p) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: p, path: '/json/version', method: 'GET', timeout: 2500,
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ ok: true, info: JSON.parse(data) }); } catch { resolve({ ok: false }); }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.end();
  });
}

async function findDebugPort() {
  for (let p = PORT; p <= PORT + 20; p++) {
    const r = await checkPort(p);
    if (r.ok) return { port: p, info: r.info };
  }
  return null;
}

// ---- Logging --------------------------------------------------------------------
const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

// ---- Person data candidates ------------------------------------------------------
function looksLikePerson(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const hasName = typeof obj.name === 'string' || typeof obj.fullName === 'string' ||
                  typeof obj.displayName === 'string' || typeof obj.firstName === 'string';
  if (!hasName) return false;
  // id-like keys
  const hasId = obj.id || obj.personId || obj.individualId || obj.nodeId || obj.recordId;
  return true;
}

// ---- Network capture -------------------------------------------------------------
async function captureNetwork(page) {
  const captures = [];
  page.on('response', async (response) => {
    try {
      const url = response.url();
      const ct = (response.headers()['content-type'] || '').toLowerCase();
      const status = response.status();
      if (status < 200 || status >= 400) return;
      if (ct.includes('json')) {
        const text = await response.text().catch(() => null);
        if (text && text.length > 0) {
          captures.push({ url, status, contentType: ct, body: text, at: Date.now() });
        }
      }
    } catch { /* ignore */ }
  });
  return captures;
}

// ---- Login ------------------------------------------------------------------------
async function ensureLoggedIn(page) {
  log('Checking login state...');
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => log('Nav error: ' + e.message));
  await sleep(5000);

  const state = await page.evaluate(() => {
    const text = (document.body ? document.body.innerText : '').substring(0, 4000);
    const url = location.href;
    const hasLoginForm = !!document.querySelector('input[type="email"], input[name="email"], input[name="login"]');
    const hasPassword = !!document.querySelector('input[type="password"]');
    const bodyHTML = (document.body ? document.body.innerHTML : '').substring(0, 2000);
    return {
      url,
      hasLoginForm,
      hasPassword,
      text,
      bodyHTML,
      blocked: /incapsula|access denied|robot|unusual/i.test(bodyHTML + ' ' + text),
    };
  });

  log('Current URL: ' + state.url);
  log('Blocked: ' + state.blocked);
  log('Has login form: ' + state.hasLoginForm + ' | Has password: ' + state.hasPassword);

  if (state.blocked) {
    log('!! Incapsula / bot protection detected on the page.');
    log('   The page HTML contains a challenge. Attempting to wait/refresh...');
    await sleep(10000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(8000);
  }

  const after = await page.evaluate(() => ({
    url: location.href,
    hasPassword: !!document.querySelector('input[type="password"]'),
    text: (document.body ? document.body.innerText : '').substring(0, 1500),
  }));
  log('After check URL: ' + after.url + ' | hasPassword: ' + after.hasPassword);

  // If there is a password field, we are on the login screen
  if (after.hasPassword) {
    log('Login required. Auto-filling credentials...');
    const filled = await page.evaluate((email, pass) => {
      const emailInputs = document.querySelectorAll('input[type="email"], input[name="email"], input[name="login"], input[name="username"]');
      const passInputs = document.querySelectorAll('input[type="password"]');
      let filledEmail = false;
      let filledPass = false;
      emailInputs.forEach((el) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, email);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filledEmail = true;
      });
      passInputs.forEach((el) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, pass);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filledPass = true;
      });
      return { filledEmail, filledPass, emailCount: emailInputs.length, passCount: passInputs.length };
    }, USER_EMAIL, USER_PASS);

    log('Filled email: ' + filled.filledEmail + ' (' + filled.emailCount + ') | password: ' + filled.filledPass + ' (' + filled.passCount + ')');

    if (filled.filledPass) {
      // Look for a submit button and click it
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
        const candidates = buttons.filter((b) => {
          const t = (b.innerText || b.value || '').toLowerCase();
          return /log\s*in|sign\s*in|sign\s*up|continue|submit|login|next/.test(t);
        });
        if (candidates.length > 0) {
          candidates[0].click();
          return true;
        }
        // fallback: submit nearest form
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit ? form.requestSubmit() : form.submit();
          return true;
        }
        return false;
      });
      log('Submit clicked: ' + clicked);
    }
  } else {
    log('No password field found — either already logged in, or the family site is publicly visible.');
  }

  // Wait for navigation / post-login
  log('Waiting 12s for login/navigation to settle...');
  await sleep(12000);

  const final = await page.evaluate(() => ({
    url: location.href,
    hasPassword: !!document.querySelector('input[type="password"]'),
    text: (document.body ? document.body.innerText : '').substring(0, 800),
  }));
  log('Post-login URL: ' + final.url);
  log('Post-login text: ' + final.text.replace(/\s+/g, ' ').substring(0, 300));

  // Detect CAPTCHA/2FA - ask user to complete it manually
  const challenge = await page.evaluate(() => {
    const text = (document.body ? document.body.innerText : '').substring(0, 4000);
    return /recaptcha|captcha|verify|not a robot|two.step|verification|challenge/i.test(text);
  });

  if (challenge) {
    log('====================================================================');
    log('  A CAPTCHA or verification step needs your attention.');
    log('  Please complete it in the Chrome window, then press ENTER here.');
    log('====================================================================');
    await new Promise((resolve) => process.stdin.once('data', resolve));
  }

  return page;
}

// ---- Locate the family tree ------------------------------------------------------
async function findTree(page) {
  log('Searching for the Family Tree section...');

  // Try the current page first - look for tree-related links
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors
      .filter((a) => /tree|family|chart|people|individual/i.test((a.textContent + ' ' + a.href)))
      .map((a) => ({ text: (a.textContent || '').trim().substring(0, 60), href: a.href }))
      .slice(0, 30);
  });
  log('Found ' + links.length + ' tree-related links');
  links.slice(0, 15).forEach((l) => log('  - ' + l.text + '  =>  ' + l.href));

  // Prefer a URL that actually contains tree data
  let treeUrl = null;
  for (const l of links) {
    if (/tree/i.test(l.href) && /myheritage\.com/.test(l.href)) {
      treeUrl = l.href;
      break;
    }
  }
  if (treeUrl) {
    log('Navigating to tree link: ' + treeUrl);
    await page.goto(treeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => log('Nav err: ' + e.message));
    await sleep(8000);
    return page.url();
  }

  // Fallback: try to click a visible "Family tree" button/tab
  const clicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, button, [role="tab"], span, div'));
    const cand = els.find((el) => {
      const t = (el.textContent || '').trim();
      return t === 'Family tree' || t === 'Family Tree' || /^family tree$/i.test(t) || /^\s*family\s*tree\s*$/i.test(t);
    });
    if (cand) {
      cand.click();
      return true;
    }
    return false;
  });
  if (clicked) {
    log('Clicked a "Family Tree" element. Waiting...');
    await sleep(8000);
  }

  return page.url();
}

// ---- Data extraction --------------------------------------------------------------
async function extractPeopleFromDOM(page) {
  // Fallback: parse visible text lines that look like names + dates
  const found = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.slice(0, 500);
  });
  return found;
}

async function analyzeCaptures(captures, individuals, families) {
  // Heuristic scan over captured JSON for arrays of person-like objects
  for (const cap of captures) {
    try {
      const parsed = JSON.parse(cap.body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (looksLikePerson(item)) individuals.set(JSON.stringify(item), item);
        }
      } else if (parsed && typeof parsed === 'object') {
        // look for nested arrays
        const visit = (node, depth) => {
          if (!node || depth > 6) return;
          if (Array.isArray(node)) {
            const persons = node.filter(looksLikePerson);
            persons.forEach((p) => individuals.set(JSON.stringify(p), p));
            node.forEach((n) => visit(n, depth + 1));
          } else if (typeof node === 'object') {
            Object.values(node).forEach((v) => visit(v, depth + 1));
          }
        };
        visit(parsed, 0);
      }
    } catch { /* not JSON */ }
  }
}

// ---- GEDCOM generation -----------------------------------------------------------
function toGedcomDate(dateStr) {
  if (!dateStr) return '';
  // Accept formats: "DD MMM YYYY", "MMM YYYY", "YYYY", ISO "YYYY-MM-DD"
  let s = String(dateStr).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${parseInt(iso[3], 10)} ${months[parseInt(iso[2], 10) - 1]} ${iso[1]}`;
  }
  return s;
}

function buildGEDCOM(people, rels) {
  const lines = [];
  lines.push('0 HEAD');
  lines.push('1 SOUR MyHeritage');
  lines.push('2 NAME MyHeritage Family Tree Builder');
  lines.push('2 VERS 8.0');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');
  lines.push(`1 DATE ${new Date().toUTCString().slice(5, 16).toUpperCase()}`);

  const idMap = new Map();
  people.forEach((p, i) => {
    const id = `@I${i + 1}@`;
    idMap.set(p.id ?? p.uniqueKey ?? i, id);
  });

  people.forEach((p, i) => {
    const id = `@I${i + 1}@`;
    const given = p.givenName || p.firstName || p.given || '';
    const surname = p.surname || p.lastName || p.familyName || '';
    lines.push(`0 ${id} INDI`);
    lines.push(`1 NAME ${given} /${surname}/`);
    if (given) lines.push(`2 GIVN ${given}`);
    if (surname) lines.push(`2 SURN ${surname}`);
    const gender = (p.gender || p.sex || '').toLowerCase();
    if (gender.startsWith('m')) lines.push('1 SEX M');
    else if (gender.startsWith('f')) lines.push('1 SEX F');

    const birthDate = toGedcomDate(p.birthDate || p.birthDate?.date || p.birth?.date || p.born?.date || p.birthYear);
    const birthPlace = p.birthPlace || p.birthPlace?.place || p.birth?.place || p.born?.place || '';
    if (birthDate || birthPlace) {
      lines.push('1 BIRT');
      if (birthDate) lines.push(`2 DATE ${birthDate}`);
      if (birthPlace) lines.push(`2 PLAC ${birthPlace}`);
    }
    const deathDate = toGedcomDate(p.deathDate || p.deathDate?.date || p.death?.date || p.died?.date || p.deathYear);
    const deathPlace = p.deathPlace || p.deathPlace?.place || p.death?.place || p.died?.place || '';
    if (deathDate || deathPlace) {
      lines.push('1 DEAT');
      if (deathDate) lines.push(`2 DATE ${deathDate}`);
      if (deathPlace) lines.push(`2 PLAC ${deathPlace}`);
    }
    if (p.occupation) lines.push(`1 OCCU ${p.occupation}`);
  });

  rels.forEach((r, i) => {
    const fid = `@F${i + 1}@`;
    lines.push(`0 ${fid} FAM`);
    if (r.husbandId && idMap.has(r.husbandId)) lines.push(`1 HUSB ${idMap.get(r.husbandId)}`);
    if (r.wifeId && idMap.has(r.wifeId)) lines.push(`1 WIFE ${idMap.get(r.wifeId)}`);
    (r.childrenIds || []).forEach((cid) => {
      if (idMap.has(cid)) lines.push(`1 CHIL ${idMap.get(cid)}`);
    });
  });

  lines.push('0 TRLR');
  return lines.join('\n');
}

// ---- Main ------------------------------------------------------------------------
async function main() {
  log('=== MyHeritage Tree Extractor (CDP) ===');

  fs.mkdirSync(CAPTURES_DIR, { recursive: true });

  const cdp = await findDebugPort();
  if (!cdp) {
    log('');
    log('ERROR: No Chrome with remote debugging found on port ' + PORT + '.');
    log('  1. Close all Chrome windows');
    log('  2. Run: start_chrome_debug.cmd  (starts Chrome with --remote-debugging-port=9222)');
    log('  3. Log into MyHeritage in that window if needed');
    log('  4. Re-run this script.');
    process.exit(1);
  }
  log('Connected to Chrome on port ' + cdp.port + ' (' + (cdp.info.Browser || '') + ')');

  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.connect({ browserURL: `http://localhost:${cdp.port}`, defaultViewport: null });
  log('Browser connected.');

  let pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('myheritage')) || pages[0] || null;
  if (!page) page = await browser.newPage();
  if (page.url().startsWith('chrome://') || page.url() === 'about:blank') {
    page = await browser.newPage();
  }
  log('Using page: ' + (page.url() || '(blank)'));

  const captures = captureNetwork(page);

  await ensureLoggedIn(page);

  const treePageUrl = await findTree(page);
  log('Tree page URL: ' + treePageUrl);

  // Wait for tree data to load
  await sleep(10000);

  const html = await page.content();
  const domLines = await extractPeopleFromDOM(page);
  log('Page HTML length: ' + html.length);
  log('Visible text lines: ' + domLines.length);

  // Save raw page
  fs.writeFileSync(path.join(CAPTURES_DIR, 'tree_page.html'), html);
  fs.writeFileSync(path.join(CAPTURES_DIR, 'tree_page_text.txt'), domLines.join('\n'));

  // Let network settle
  await sleep(5000);

  const net = captures || [];
  log('Captured ' + net.length + ' JSON network responses');

  // Save captures to disk
  const capFiles = [];
  net.forEach((c, i) => {
    const f = path.join(CAPTURES_DIR, `capture_${String(i).padStart(3, '0')}.json`);
    try {
      const parsed = JSON.parse(c.body);
      fs.writeFileSync(f, JSON.stringify({ url: c.url, status: c.status, data: parsed }, null, 2));
      capFiles.push(f);
    } catch {
      fs.writeFileSync(f, JSON.stringify({ url: c.url, status: c.status, body: c.body }, null, 2));
      capFiles.push(f);
    }
  });
  log('Saved ' + capFiles.length + ' capture files to ' + CAPTURES_DIR);

  // Analyze
  const individuals = new Map();
  const families = new Map();
  await analyzeCaptures(net, individuals, families);

  log('Person-like objects found in network data: ' + individuals.size);
  if (individuals.size > 0) {
    const sample = Array.from(individuals.values()).slice(0, 3);
    sample.forEach((p) => log('  SAMPLE: ' + JSON.stringify(p).substring(0, 300)));
  }

  // If nothing found in network, dump the page text for manual review
  if (individuals.size === 0) {
    log('No structured person data found in network captures.');
    log('Dumping page text (first 3000 chars) for review:');
    log('------------------------------------------------');
    log(domLines.slice(0, 200).join('\n').substring(0, 3000));
  }

  // Build GEDCOM if we have people
  if (individuals.size > 0 && !DRY_RUN) {
    const people = Array.from(individuals.values());
    const gedcom = buildGEDCOM(people, []);
    const outPath = path.join(DATA_DIR, 'myheritage_export.ged');
    fs.writeFileSync(outPath, gedcom);
    log('Wrote GEDCOM with ' + people.length + ' individuals to ' + outPath);
  } else if (DRY_RUN) {
    log('DRY RUN — no GEDCOM written.');
  }

  log('');
  log('=== Done. Review captures in ' + CAPTURES_DIR + ' ===');
  await browser.disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
