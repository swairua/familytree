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
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--start-maximized',
      '--disable-infobars',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Override navigator properties to avoid detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });

    // Capture all network requests
    const requests = [];
    const responses = [];

    page.on('request', (request) => {
      const data = {
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
      };
      requests.push(data);
      console.log(`[REQ] ${data.method} ${data.type}: ${data.url}`);
    });

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';
      
      let body = null;
      try {
        if (contentType.includes('json')) {
          body = await response.json().catch(() => null);
        } else if (contentType.includes('text') || contentType.includes('html')) {
          body = await response.text().catch(() => null);
          if (body && body.length > 3000) body = body.substring(0, 3000) + '...[TRUNC]';
        }
      } catch (e) {
        // ignore
      }
      
      if (status >= 200 && status < 400) {
        const data = { url, status, contentType, body };
        responses.push(data);
        if (status === 200 && (contentType.includes('json') || contentType.includes('html'))) {
          console.log(`[RES] ${status} ${contentType}: ${url}`);
          if (body && typeof body === 'string' && body.length > 50) {
            console.log(`   Body: ${body.substring(0, 500)}`);
          } else if (body) {
            console.log(`   Body: ${JSON.stringify(body).substring(0, 500)}`);
          }
        }
      }
    });

    console.log('Navigating to MyHeritage...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('Nav error:', e.message));

    console.log('Waiting 30 seconds for page and any challenges...');
    await sleep(30000);

    // Get page content safely - try the main page and frames
    let html = '';
    try {
      html = await page.mainFrame().content();
    } catch (e) {
      console.log('Error getting main frame content:', e.message);
    }
    
    console.log('Main frame HTML length:', html.length);
    console.log('Main frame URL:', page.mainFrame().url());

    // Get all frames
    const frames = page.frames();
    console.log(`Total frames: ${frames.length}`);
    for (const frame of frames) {
      try {
        const frameContent = await frame.content();
        const frameUrl = frame.url();
        console.log(`Frame URL: ${frameUrl} | Content length: ${frameContent.length}`);
        if (frameContent.includes('family') || frameContent.includes('tree') || frameContent.includes('person')) {
          console.log(`  Content excerpt: ${frameContent.substring(0, 2000)}`);
        }
      } catch (e) {
        console.log(`Error reading frame ${frame.url()}: ${e.message}`);
      }
    }

    // Check cookies
    const cookies = await page.cookies();
    console.log('\n--- COOKIES ---');
    cookies.forEach(c => console.log(`${c.name} = ${c.value.substring(0, 50)}...`));

    // Check if we're still on an Incapsula page
    const isBlocked = html.includes('Incapsula') || html.includes('incap_ses') || html.includes('Request unsuccessful');
    
    if (isBlocked) {
      console.log('\nBlocked by Incapsula. Waiting 60 more seconds...');
      await sleep(60000);
      
      // Try to get content again
      try {
        html = await page.mainFrame().content();
      } catch (e) {
        console.log('Error getting main frame content on retry:', e.message);
      }
      console.log('Main frame HTML length after retry:', html.length);
      console.log('Main frame URL after retry:', page.mainFrame().url());
      
      if (!html.includes('Incapsula')) {
        console.log('SUCCESS! Bypassed Incapsula!');
        fs.writeFileSync(path.join(__dirname, 'myheritage_page4.html'), html);
      }
    }

    // Save network data
    const dataFile = path.join(__dirname, 'myheritage_network.json');
    const networkData = {
      requests,
      responses: responses.map(r => ({ url: r.url, status: r.status, contentType: r.contentType, body: r.body })),
      finalUrl: page.mainFrame().url(),
      htmlLength: html.length,
      cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
    };
    fs.writeFileSync(dataFile, JSON.stringify(networkData, null, 2));
    console.log('\nNetwork data saved to:', dataFile);

    // Search HTML for any family tree data
    if (html && html.length > 1000 && !isBlocked) {
      // Look for JSON data embedded in scripts
      const jsonMatches = html.match(/window\.__[A-Z_]+\s*=\s*({[^;]+});/g) || [];
      console.log('\nEmbedded JSON data found:', jsonMatches.length);
      jsonMatches.forEach((m, i) => console.log(`${i + 1}: ${m.substring(0, 200)}...`));

      // Look for tree data patterns
      const patterns = [
        /"persons?"/gi,
        /"tree"/gi,
        /"family"/gi,
        /"individual"/gi,
        /"[A-Za-z]+Name"/g,
        /"children"/gi,
        /"parents"/gi,
        /"birthDate"/gi,
        /"deathDate"/gi,
        /"spouses?"/gi,
      ];
      patterns.forEach((p) => {
        const matches = html.match(p);
        if (matches) console.log(`Pattern ${p}: ${matches.length} matches`);
      });
    }

    // Take screenshot
    try {
      await page.screenshot({ path: path.join(__dirname, 'myheritage_screenshot3.png'), fullPage: false });
      console.log('\nScreenshot saved.');
    } catch (e) {
      console.log('Screenshot error:', e.message);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();