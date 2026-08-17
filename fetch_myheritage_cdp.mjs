import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_URL = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816';
const CDP_PORT = 9222; // Default Chrome remote debugging port

// Function to check if Chrome's debugging port is open
function checkDebuggingPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/json/version',
      method: 'GET',
      timeout: 3000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve({ ok: true, info });
        } catch (e) {
          resolve({ ok: false, error: 'Invalid response' });
        }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
    req.end();
  });
}

// Find an available debugging port
async function findDebugPort() {
  for (let port = 9222; port <= 9232; port++) {
    const result = await checkDebuggingPort(port);
    if (result.ok) {
      return { port, info: result.info };
    }
  }
  return null;
}

async function main() {
  try {
    console.log('Searching for Chrome debugging port...');
    const cdp = await findDebugPort();
    
    if (!cdp) {
      console.log('No Chrome debugging port found.');
      console.log('');
      console.log('To connect to your real Chrome browser with your MyHeritage session, please:');
      console.log('1. Close all Chrome windows');
      console.log('2. Start Chrome with remote debugging enabled:');
      console.log('   "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
      console.log('3. Log in to MyHeritage if needed and visit the family site URL');
      console.log('4. Run this script again: node fetch_myheritage_cdp.mjs');
      console.log('');
      console.log('This approach uses your real Chrome session/cookies to bypass the Incapsula block.');
      return;
    }
    
    console.log('Found Chrome debugging port:', cdp.port);
    console.log('Browser version:', cdp.info.Browser || 'Unknown');
    
    const puppeteer = (await import('puppeteer-core')).default;
    
    // Connect to the running Chrome instance
    const browser = await puppeteer.connect({
      browserURL: `http://localhost:${cdp.port}`,
      defaultViewport: null,
    });
    
    console.log('Connected to Chrome!');
    
    // Get existing pages or create a new one
    let pages = await browser.pages();
    let page = pages[0] || null;
    
    if (!page) {
      page = await browser.newPage();
    }
    
    console.log('Using page:', page.url() || '(new/blank)');
    
    // Navigate to the MyHeritage family site
    console.log('\nNavigating to MyHeritage family site...');
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('Nav error:', e.message));
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const finalUrl = page.url();
    const html = await page.content();
    console.log('\nFinal URL:', finalUrl);
    console.log('HTML Length:', html.length);
    
    // Check if blocked
    const isBlocked = html.includes('Incapsula') || html.includes('incap_ses') || html.includes('Request unsuccessful') || html.includes('Access Denied');
    console.log('Is blocked:', isBlocked);
    
    // Capture network responses for data extraction
    const networkData = [];
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';
      
      if (status === 200 && (contentType.includes('json') || contentType.includes('text')) && url.includes('myheritage')) {
        try {
          const body = await response.text().catch(() => null);
          if (body) {
            networkData.push({ url, status, contentType, body: body.substring(0, 5000) });
          }
        } catch (e) {
          // ignore
        }
      }
    });
    
    if (!isBlocked && html.length > 1000) {
      console.log('SUCCESS! Got the page!');
      fs.writeFileSync(path.join(__dirname, 'myheritage_cdp_page.html'), html);
      
      // Take screenshot
      await page.screenshot({ path: path.join(__dirname, 'myheritage_cdp_screenshot.png'), fullPage: true });
      console.log('Page saved and screenshot taken.');
      
      // Save network data
      fs.writeFileSync(path.join(__dirname, 'myheritage_cdp_network.json'), JSON.stringify(networkData, null, 2));
      
      // Look for family tree data patterns
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
        /firstName/gi,
        /lastName/gi,
      ];
      patterns.forEach((p) => {
        const matches = html.match(p);
        if (matches) console.log(`Pattern ${p}: ${matches.length} matches`);
      });
      
      console.log('\n--- FIRST 3000 CHARS ---');
      console.log(html.substring(0, 3000));
    } else {
      console.log('Still blocked by Incapsula.');
      console.log('Note: The IP address is blocked at the service level (Error 16).');
      console.log('The block lasts approximately 24 hours from when it was triggered.');
      console.log('');
      console.log('Suggestions:');
      console.log('1. Try using a different network/IP (e.g., mobile hotspot)');
      console.log('2. Wait 24 hours and try again');
      console.log('3. If you have a VPN, try connecting through it');
      console.log('4. Log into MyHeritage in your normal browser - if you can access it there, run this script again while that browser is open');
      
      console.log('\n--- BLOCKED PAGE CONTENT ---');
      console.log(html.substring(0, 3000));
    }
    
    await browser.disconnect();
    console.log('\nDisconnected from Chrome.');
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  }
}

main();