const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--start-maximized',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Add JavaScript to mask webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });

    console.log('Navigating to MyHeritage...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Page loaded. Waiting for content...');
    // Wait for the page to potentially render content or bypass Incapsula
    await sleep(10000);

    // Get final URL
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    // Get page content
    const html = await page.content();
    console.log('HTML Length:', html.length);

    // Save the HTML
    const outputPath = path.join(__dirname, 'myheritage_page3.html');
    fs.writeFileSync(outputPath, html);
    console.log('Saved to:', outputPath);

    // Take a screenshot
    const screenshotPath = path.join(__dirname, 'myheritage_screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);

    // Check if we are on an Incapsula page
    if (html.includes('Incapsula') || html.includes('incap_ses')) {
      console.log('WARNING: Blocked by Incapsula protection');
      // Try to wait and reload - Incapsula sometimes issues a JS challenge
      console.log('Waiting 15 seconds then reloading to solve JS challenge...');
      await sleep(15000);
      await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(15000);

      const html2 = await page.content();
      const finalUrl2 = page.url();
      console.log('Final URL after reload:', finalUrl2);
      console.log('HTML Length after reload:', html2.length);

      if (!html2.includes('Incapsula')) {
        fs.writeFileSync(outputPath, html2);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('SUCCESS: Bypassed Incapsula!');
        
        // Print first 3000 chars
        console.log('--- PAGE CONTENT (first 3000 chars) ---');
        console.log(html2.substring(0, 3000));
      } else {
        console.log('Still blocked by Incapsula');
        console.log('--- PAGE CONTENT (first 2000 chars) ---');
        console.log(html2.substring(0, 2000));
      }
    } else {
      console.log('SUCCESS: Page loaded without Incapsula block!');
      console.log('--- PAGE CONTENT (first 3000 chars) ---');
      console.log(html.substring(0, 3000));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();