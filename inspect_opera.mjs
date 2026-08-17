import { default as puppeteer } from 'puppeteer-core';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
const pages = await browser.pages();
console.log('Page count:', pages.length);
for (const p of pages) {
  try {
    const url = p.url();
    console.log('Page:', url);
    const state = await Promise.race([
      p.evaluate(() => ({
        text: (document.body ? document.body.innerText : '').substring(0, 800),
        hasPass: !!document.querySelector('input[type="password"]'),
        hasEmail: !!document.querySelector('input[type="email"]'),
      })),
      sleep(8000).then(() => ({ text: '(timeout waiting for document)', hasPass: false, hasEmail: false })),
    ]);
    console.log('  hasPass:', state.hasPass, '| hasEmail:', state.hasEmail);
    console.log('  text:', state.text.replace(/\s+/g, ' ').substring(0, 400));
  } catch (e) {
    console.log('  error:', e.message);
  }
}
await browser.disconnect();
console.log('DONE');
