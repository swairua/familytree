import { default as puppeteer } from 'puppeteer-core';
import fs from 'fs';

const creds = JSON.parse(fs.readFileSync('myheritage_credentials.json', 'utf8'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
const pages = await browser.pages();
let page = pages[0];
console.log('Using page:', page.url());

// Navigate to MyHeritage login
await page.goto('https://www.myheritage.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('Nav err:', e.message));
await sleep(6000);
console.log('After login nav URL:', page.url());

try {
  const state = await page.evaluate(() => {
    return {
      hasEmail: !!document.querySelector('input[type="email"], input[name="email"], input[name="login"]'),
      hasPass: !!document.querySelector('input[type="password"]'),
      text: (document.body ? document.body.innerText : '').substring(0, 2000),
      bodyHtml: (document.body ? document.body.innerHTML : '').substring(0, 1000),
    };
  });
  console.log('Login page state:', JSON.stringify({ hasEmail: state.hasEmail, hasPass: state.hasPass }, null, 2));
  console.log('TEXT:', state.text.replace(/\s+/g, ' ').substring(0, 500));
  console.log('HTML snippet:', state.bodyHtml.replace(/\s+/g, ' ').substring(0, 500));

  if (state.hasPass) {
    // Fill credentials
    const filled = await page.evaluate((email, pass) => {
      const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="login"]');
      const passInput = document.querySelector('input[type="password"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      let okEmail = false, okPass = false;
      if (emailInput) {
        setter.call(emailInput, email);
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        okEmail = true;
      }
      if (passInput) {
        setter.call(passInput, pass);
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));
        okPass = true;
      }
      return { okEmail, okPass, emailCount: document.querySelectorAll('input').length };
    }, creds.email, creds.password);
    console.log('Filled:', JSON.stringify(filled));

    // Click submit
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const cand = buttons.filter(b => /log\s*in|sign\s*in|continue|submit|next/i.test(b.innerText || b.value || ''));
      if (cand.length) { cand[0].click(); return 'clicked: ' + (cand[0].innerText || cand[0].value); }
      const form = document.querySelector('form');
      if (form) { form.requestSubmit ? form.requestSubmit() : form.submit(); return 'form submitted'; }
      return 'nothing';
    });
    console.log('Submit:', clicked);
  } else {
    console.log('No password field — checking if already logged in.');
  }

  await sleep(10000);
  console.log('Final URL:', page.url());
  const post = await page.evaluate(() => ({
    text: (document.body ? document.body.innerText : '').substring(0, 2000),
  }));
  console.log('POST LOGIN TEXT:', post.text.replace(/\s+/g, ' ').substring(0, 600));

  try {
    await page.screenshot({ path: 'data/captures/after_login.png' });
    console.log('Screenshot saved.');
  } catch (e) { console.log('Screenshot err:', e.message); }

} catch (e) {
  console.log('Evaluate error:', e.message);
}

await browser.disconnect();
console.log('Done.');
