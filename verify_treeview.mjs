import puppeteer from 'puppeteer-core';
const { launch } = puppeteer;

const APP_URL = 'http://localhost:3000/';
const SCREENSHOT = 'data/captures/treeview_fixed.png';

(() => {
  let browser;
  const errors = [];
  process.on('unhandledRejection', (err) => { errors.push('[unhandledRejection] ' + String(err).slice(0, 300)); });

  async function run() {
    browser = await launch({
      headless: 'new',
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: [
        '--remote-debugging-port=9223',
        '--disable-gpu',
        '--no-first-run',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--user-data-dir=C:\\Temp\\cline-puppeteer-profile',
      ],
    });

    let page = await browser.newPage();
    await page.setBypassCSP(true);
    page.on('pageerror', (err) => errors.push('[pageerror] ' + String(err).slice(0, 300)));
    page.on('console', (msg) => {
      const t = String(msg.type());
      const text = (msg.text() || '').toString();
      if (/error|failed|uncaught|exception/i.test(t + ' ' + text)) errors.push(`[console.${t}] ${text.slice(0, 300)}`);
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 6000));

    const scaleOf = (t) => { const m = /scale\(([\d.eE+-]+)\)/.exec(t || ''); return m ? parseFloat(m[1]) : NaN; };
    const txOf = (t) => { const m = /translate\(([^,]+),\s*([^)]+)\)/.exec(t || ''); return m ? [parseFloat(m[1]), parseFloat(m[2])] : [NaN, NaN]; };
    let pass = 0; let fail = 0;
    const verdict = (ok, name, detail = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

    // 1. Chart renders
    const s0json = await page.evaluate(() => JSON.stringify({
      hasSvg: !!document.querySelector('#tree-svg'),
      hasContent: !!document.querySelector('#tree-content'),
      nodes: document.querySelectorAll('.tree-node').length,
      links: document.querySelectorAll('.tree-link').length,
      canvasW: document.querySelector('.tree-canvas')?.offsetWidth,
      canvasH: document.querySelector('.tree-canvas')?.offsetHeight,
      transform: document.querySelector('#tree-content')?.getAttribute('transform'),
      noViewBox: !document.querySelector('#tree-svg')?.hasAttribute('viewBox'),
      zoomText: document.querySelector('.toolbar-zoom')?.textContent,
    }));
    console.log('initial:', s0json);
    const s0 = JSON.parse(s0json);
    verdict(s0.hasSvg && s0.nodes > 100, 'svg renders with nodes', `${s0.nodes} nodes, canvas ${s0.canvasW}x${s0.canvasH}`);
    verdict(s0.noViewBox === true, 'no viewBox double-transform', `transform=${s0.transform}`);

    // 2. Zoom in button increases scale
    await page.evaluate(() => document.querySelector('.tree-toolbar .toolbar-left .btn-icon').click());
    await new Promise((r) => setTimeout(r, 500));
    const s1json = await page.evaluate(() => JSON.stringify({
      transform: document.querySelector('#tree-content')?.getAttribute('transform'),
      zoomText: document.querySelector('.toolbar-zoom')?.textContent,
    }));
    const s1 = JSON.parse(s1json);
    verdict(scaleOf(s1.transform) > scaleOf(s0.transform), 'zoom-in button', `${s0.transform} -> ${s1.transform} (${s1.zoomText})`);

    // 3. Fit-to-screen shows the whole huge tree
    await page.evaluate(() => Array.from(document.querySelectorAll('.tree-toolbar .btn-icon'))[2].click());
    await new Promise((r) => setTimeout(r, 500));
    const s2json = await page.evaluate(() => JSON.stringify({
      transform: document.querySelector('#tree-content')?.getAttribute('transform'),
      zoomText: document.querySelector('.toolbar-zoom')?.textContent,
    }));
    const s2 = JSON.parse(s2json);
    verdict(Number.isFinite(scaleOf(s2.transform)) && scaleOf(s2.transform) >= 0.009, 'fit-to-screen', `${s2.transform} (${s2.zoomText})`);

    // 4. Drag pans the canvas via container-relative coords
    const panRes = await page.evaluate(() => (async () => {
      const canvas = document.querySelector('.tree-canvas');
      const before = document.querySelector('#tree-content').getAttribute('transform');
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const opts = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1 });
      canvas.dispatchEvent(new MouseEvent('mousedown', opts(cx, cy)));
      await new Promise((res) => setTimeout(res, 80));
      canvas.dispatchEvent(new MouseEvent('mousemove', opts(cx + 80, cy + 40)));
      await new Promise((res) => setTimeout(res, 80));
      canvas.dispatchEvent(new MouseEvent('mouseup', opts(cx + 80, cy + 40)));
      await new Promise((res) => setTimeout(res, 250));
      return JSON.stringify({ before, after: document.querySelector('#tree-content').getAttribute('transform') });
    })());
    console.log('pan:', panRes);
    const p = JSON.parse(panRes);
    const [bx, by] = txOf(p.before); const [ax, ay] = txOf(p.after);
    verdict(Math.abs(ax - bx - 80) < 14 && Math.abs(ay - by - 40) < 14, 'mouse drag pans', `${p.before} -> ${p.after}`);

    // 5. No JS errors
    verdict(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));

    await page.screenshot({ path: SCREENSHOT, fullPage: false }).catch((e) => console.log('screenshot skipped:', e.message));
    console.log('screenshot: ' + SCREENSHOT);

    console.log(`\n${pass}/${pass + fail} checks passed`);
    await browser.close();
    process.exit(fail ? 1 : 0);
  }

  run().catch((e) => { console.error('FATAL:', e && (e.stack || e.message || e)); process.exit(2); });
})();