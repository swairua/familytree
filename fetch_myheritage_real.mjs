import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_URL = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816';

async function main() {
  let browser;
  try {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    // Create a temporary user data directory to avoid conflicts with running Chrome
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myheritage-chrome-'));
    console.log('Using temp Chrome profile:', userDataDir);
    
    const puppeteer = (await import('puppeteer-core')).default;
    
    console.log('Launching Chrome...');
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false,
      userDataDir: userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-infobars',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });

    const page = await browser.newPage();
    
    // Override navigator properties to avoid detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });
    
    // First visit the MyHeritage homepage to set cookies as a normal user
    console.log('First visiting MyHeritage homepage...');
    await page.goto('https://www.myheritage.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('Homepage nav error:', e.message));
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const homeUrl = page.url();
    const homeHtml = await page.content();
    console.log('Homepage URL:', homeUrl);
    console.log('Homepage HTML Length:', homeHtml.length);
    console.log('Homepage blocked:', homeHtml.includes('Incapsula') || homeHtml.includes('incap_ses') || homeHtml.includes('Request unsuccessful'));
    
    // Now navigate to the family site page
    console.log('\nNavigating to family site...');
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
    
    if (!isBlocked && html.length > 1000) {
      console.log('SUCCESS! Got the page!');
      fs.writeFileSync(path.join(__dirname, 'myheritage_real_page.html'), html);
      
      // Take screenshot
      await page.screenshot({ path: path.join(__dirname, 'myheritage_real_screenshot.png'), fullPage: true });
      console.log('Page saved and screenshot taken.');
      
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
      console.log('Still blocked. Waiting 30 seconds and retrying...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('Reload error:', e.message));
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      const html2 = await page.content();
      const finalUrl2 = page.url();
      console.log('Second attempt URL:', finalUrl2);
      console.log('Second attempt HTML Length:', html2.length);
      
      const isBlocked2 = html2.includes('Incapsula') || html2.includes('incap_ses') || html2.includes('Request unsuccessful') || html2.includes('Access Denied');
      console.log('Is blocked (2nd attempt):', isBlocked2);
      
      if (!isBlocked2 && html2.length > 1000) {
        console.log('SUCCESS on second attempt!');
        fs.writeFileSync(path.join(__dirname, 'myheritage_real_page.html'), html2);
        await page.screenshot({ path: path.join(__dirname, 'myheritage_real_screenshot.png'), fullPage: true });
        console.log('--- FIRST 3000 CHARS ---');
        console.log(html2.substring(0, 3000));
      } else {
        console.log('Still blocked after retry.');
        console.log('--- BLOCKED PAGE CONTENT ---');
        console.log(html2.substring(0, 3000));
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
}

main();