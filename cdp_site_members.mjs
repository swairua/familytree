import { default as puppeteer } from 'puppeteer-core';
import fs from 'fs';

// Scrape the MyHeritage family-site members page via CDP.
// Requires a browser with --remote-debugging-port=9222 (e.g. a dedicated,
// separate profile) and logs in with myheritage_credentials.json if needed.
//
// Usage:
//   node cdp_site_members.mjs
//   CDP_BASE=http://localhost:9222 node cdp_site_members.mjs

const CREDS = JSON.parse(fs.readFileSync('myheritage_credentials.json', 'utf8'));
const OUT_DIR = 'data/captures';
const SITE_URL = 'https://www.myheritage.com/site-members-OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ/wairua';
const FAMILY_SITE = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';
const BASE = process.env.CDP_BASE || 'http://localhost:9222';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT_DIR, { recursive: true });

async function getBrowser() {
  try {
    return await puppeteer.connect({ browserURL: BASE, defaultViewport: null });
  } catch (e) {
    console.error(`Cannot connect to CDP browser at ${BASE}. Launch one with --remote-debugging-port=9222.`);
    process.exit(1);
  }
}

async function ensureLoggedIn(page) {
  await page.goto('https://www.myheritage.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await sleep(3000);
  // If there is no password field we are probably already logged in.
  const state = await page.evaluate(() => ({
    hasPass: !!document.querySelector('input[type="password"]'),
    text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 2000),
  }));
  if (!state.hasPass) {
    console.log('No password field — appears already logged in.');
    return true;
  }

  console.log('Logging in as', CREDS.email);
  await page.evaluate((email, pass) => {
    const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="login"]');
    const passInput = document.querySelector('input[type="password"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    if (emailInput) {
      setter.call(emailInput, email);
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (passInput) {
      setter.call(passInput, pass);
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, CREDS.email, CREDS.password);
  await sleep(500);
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    const cand = buttons.filter(b => /log\s*in|sign\s*in|continue|submit|next/i.test((b.innerText || b.value || '')));
    if (cand.length) { cand[0].click(); return; }
    const form = document.querySelector('form');
    if (form) (form.requestSubmit ? form.requestSubmit() : form.submit());
  });

  // Wait for either a successful redirect or a CAPTCHA/2FA challenge.
  for (let i = 0; i < 40; i++) {
    await sleep(2000);
    const s = await page.evaluate(() => ({
      url: location.href,
      text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 3000),
    }));
    const onLogin = /login|sign-in|signin/i.test(s.url);
    const challenge = /captcha|verification|verify|one[- ]time|security code|two[- ]factor|confirm it's you/i.test(s.text);
    if (challenge) {
      console.log('\n*** CAPTCHA / verification challenge detected — solve it in the browser window. Waiting... ***\n');
      await page.screenshot({ path: `${OUT_DIR}/site_member_challenge.png` });
      // keep waiting but don't automate; user must solve manually
      continue;
    }
    if (!onLogin) {
      console.log('Logged in (redirected to', s.url + ')');
      return true;
    }
  }
  console.log('Timed out waiting for login to complete.');
  return false;
}

const browser = await getBrowser();
const pages = await browser.pages();
let page = pages.find(p => p.url().includes('myheritage')) || pages[0];
if (!page) { console.error('No page found'); process.exit(1); }
console.log('Using page:', page.url());

try {
  const loggedIn = await ensureLoggedIn(page);
  if (!loggedIn) {
    await page.screenshot({ path: `${OUT_DIR}/site_member_login.png` });
    process.exit(2);
  }

  console.log('Navigating to', SITE_URL);
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(e => console.log('Nav err:', e.message));
  await sleep(6000);

  // The site-members page may be server-rendered or load a table async; wait a bit more.
  for (let i = 0; i < 10; i++) {
    const t = await page.evaluate(() => document.body ? document.body.innerText : '');
    const looksReady = /member|manager|invite/i.test(t);
    if (looksReady) break;
    await sleep(1500);
  }

  const dump = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText : '').slice(0, 20000),
    html: document.documentElement ? document.documentElement.outerHTML : '',
  }));

  fs.writeFileSync(`${OUT_DIR}/site_members.txt`, dump.text);
  fs.writeFileSync(`${OUT_DIR}/site_members.html`, dump.html);
  console.log('Saved data/captures/site_members.txt and .html');
  console.log('URL:', dump.url, '\nTitle:', dump.title);
  console.log('--- TEXT PREVIEW ---\n' + dump.text.slice(0, 4000));

  try { await page.screenshot({ path: `${OUT_DIR}/site_members.png`, fullPage: true }); } catch {}
} catch (e) {
  console.log('Error:', e.message);
  try { await page.screenshot({ path: `${OUT_DIR}/site_members_error.png` }); } catch {}
  process.exit(1);
}

process.exit(0);
