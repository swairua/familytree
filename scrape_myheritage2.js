const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('Launching Chrome in headed mode...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,  // Use headed mode - real window
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--start-maximized',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Override navigator properties
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });

    // Capture all network requests
    const requests = [];
    page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
        headers: request.headers(),
      });
    });

    // Capture network responses
    const responses = [];
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      let body = null;
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          body = await response.json().catch(() => response.text().catch(() => null));
        } else if (contentType.includes('text') || contentType.includes('html')) {
          body = await response.text().catch(() => null);
          if (body && body.length > 5000) body = body.substring(0, 5000) + '...[TRUNCATED]';
        }
      } catch (e) {
        // ignore
      }
      responses.push({ url, status, contentType: response.headers()['content-type'], body });
    });

    console.log('Navigating to MyHeritage...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Waiting for page to load...');
    await sleep(20000);

    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    const html = await page.content();
    console.log('HTML Length:', html.length);

    // Check if blocked
    const isBlocked = html.includes('Incapsula') || html.includes('incap_ses') || html.includes('Request unsuccessful');
    
    if (isBlocked) {
      console.log('Still blocked. Waiting for Incapsula challenge to complete...');
      await sleep(30000);
      
      // Try clicking on the iframe or waiting more
      const html2 = await page.content();
      const finalUrl2 = page.url();
      console.log('URL after waiting:', finalUrl2);
      console.log('HTML Length after waiting:', html2.length);
      
      if (!html2.includes('Incapsula')) {
        console.log('SUCCESS! Bypassed Incapsula!');
        fs.writeFileSync(path.join(__dirname, 'myheritage_page4.html'), html2);
      } else {
        console.log('Still blocked by Incapsula challenge');
      }
    }

    // Save all captured requests and responses
    const dataFile = path.join(__dirname, 'myheritage_network.json');
    const networkData = {
      requests: requests,
      responses: responses.map(r => ({
        url: r.url,
        status: r.status,
        contentType: r.contentType,
        body: r.body,
      })),
      finalUrl,
      htmlLength: html.length,
    };
    fs.writeFileSync(dataFile, JSON.stringify(networkData, null, 2));
    console.log('Network data saved to:', dataFile);
    console.log('Total requests captured:', requests.length);
    console.log('Total responses captured:', responses.length);

    // Print summary of all URLs
    console.log('\n--- ALL REQUESTED URLS ---');
    requests.forEach((r, i) => {
      console.log(`${i + 1}. [${r.method}] ${r.type}: ${r.url}`);
    });

    // Print all JSON responses
    console.log('\n--- JSON RESPONSES ---');
    responses.forEach((r, i) => {
      if (r.contentType && r.contentType.includes('json')) {
        console.log(`${i + 1}. ${r.url}`);
        if (r.body) {
          const bodyStr = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
          console.log(bodyStr.substring(0, 2000));
        }
      }
    });

    // Take screenshot
    await page.screenshot({ path: path.join(__dirname, 'myheritage_screenshot2.png') });
    console.log('\nScreenshot saved.');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();