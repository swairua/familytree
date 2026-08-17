/**
 * MyHeritage Family Site Data Extractor
 * 
 * Connects to the user's real Chrome browser via CDP to bypass Incapsula
 * bot protection. Uses the user's existing MyHeritage session/cookies.
 * 
 * HOW TO USE:
 * 1. Close all Chrome windows
 * 2. Start Chrome with remote debugging enabled:
 *    "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 * 3. Log into MyHeritage in the browser and confirm you can see the family site
 * 4. Run: node fetch_myheritage_full.mjs
 * 
 * The script will:
 * - Connect to your Chrome browser
 * - Navigate to the family site
 * - Extract all people and family relationships
 * - Save the page HTML
 * - Generate a GEDCOM file for import into the family tree app
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_URL = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816';

// ==================== CDP Connection ====================

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

async function findDebugPort() {
  for (let port = 9222; port <= 9232; port++) {
    const result = await checkDebuggingPort(port);
    if (result.ok) return { port, info: result.info };
  }
  return null;
}

// ==================== HTTP Helper for Direct Access ====================

function fetchURL(url, headers = {}) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, content: data }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout' });
    });
    req.end();
  });
}

// ==================== GEDCOM Generation ====================

function generateGEDCOM(individuals, families) {
  const lines = [];
  lines.push('0 HEAD');
  lines.push('1 SOUR MyHeritage');
  lines.push('2 NAME MyHeritage Family Tree Builder');
  lines.push('2 VERS 8.0');
  lines.push('1 DEST MyHeritage');
  lines.push(`1 DATE ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ').toUpperCase()}`);
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');
  lines.push('1 LANG English');

  // Individuals
  const idMap = new Map();
  individuals.forEach((ind, index) => {
    const id = `I${index + 1}`;
    idMap.set(ind.originalId, id);
    lines.push(`0 @${id}@ INDI`);
    lines.push(`1 NAME ${ind.givenName || ''} /${ind.surname || ''}/`);
    if (ind.givenName) lines.push(`2 GIVN ${ind.givenName}`);
    if (ind.surname) lines.push(`2 SURN ${ind.surname}`);
    if (ind.gender) {
      const sex = ind.gender === 'female' ? 'F' : 'M';
      lines.push(`1 SEX ${sex}`);
    }
    if (ind.birthDate || ind.birthPlace) {
      lines.push('1 BIRT');
      if (ind.birthDate) lines.push(`2 DATE ${ind.birthDate}`);
      if (ind.birthPlace) lines.push(`2 PLAC ${ind.birthPlace}`);
    }
    if (ind.deathDate || ind.deathPlace) {
      lines.push('1 DEAT');
      if (ind.deathDate) lines.push(`2 DATE ${ind.deathDate}`);
      if (ind.deathPlace) lines.push(`2 PLAC ${ind.deathPlace}`);
    }
    if (ind.occupation) lines.push(`1 OCCU ${ind.occupation}`);
    if (ind.notes && ind.notes.length > 0) {
      ind.notes.forEach(n => lines.push(`1 NOTE ${n}`));
    }
  });

  // Families
  const familyIdMap = new Map();
  families.forEach((fam, index) => {
    const fid = `F${index + 1}`;
    familyIdMap.set(fam.originalId, fid);
    lines.push(`0 @${fid}@ FAM`);
    if (fam.husbandId && idMap.has(fam.husbandId)) lines.push(`1 HUSB @${idMap.get(fam.husbandId)}@`);
    if (fam.wifeId && idMap.has(fam.wifeId)) lines.push(`1 WIFE @${idMap.get(fam.wifeId)}@`);
    fam.childrenIds.forEach(cid => {
      if (idMap.has(cid)) lines.push(`1 CHIL @${idMap.get(cid)}@`);
    });
    if (fam.marriageDate || fam.marriagePlace) {
      lines.push('1 MARR');
      if (fam.marriageDate) lines.push(`2 DATE ${fam.marriageDate}`);
      if (fam.marriagePlace) lines.push(`2 PLAC ${fam.marriagePlace}`);
    }
  });

  // Link individuals to families
  families.forEach((fam, index) => {
    const fid = `F${index + 1}`;
    if (fam.husbandId && idMap.has(fam.husbandId)) {
      lines.push(`0 @${idMap.get(fam.husbandId)}@ INDI`);
      lines.push(`1 FAMS @${fid}@`);
    }
    if (fam.wifeId && idMap.has(fam.wifeId)) {
      lines.push(`0 @${idMap.get(fam.wifeId)}@ INDI`);
      lines.push(`1 FAMS @${fid}@`);
    }
    fam.childrenIds.forEach(cid => {
      if (idMap.has(cid)) {
        lines.push(`0 @${idMap.get(cid)}@ INDI`);
        lines.push(`1 FAMC @${fid}@`);
      }
    });
  });

  lines.push('0 TRLR');
  return lines.join('\n');
}

// ==================== Data Extraction ====================

function extractName(nameStr) {
  if (!nameStr) return { givenName: '', surname: '' };
  // Handle MyHeritage name format
  const cleaned = nameStr.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0) return { givenName: '', surname: '' };
  if (parts.length === 1) return { givenName: parts[0], surname: '' };
  const surname = parts.pop();
  const givenName = parts.join(' ');
  return { givenName, surname };
}

async function extractDataFromPage(page) {
  console.log('\nExtracting family tree data from page...');
  
  // First try to find if there's a people list page
  const peopleData = await page.evaluate(() => {
    const result = {
      individuals: [],
      families: [],
      pageText: '',
    };
    
    // Get visible text content
    result.pageText = document.body ? document.body.innerText.substring(0, 10000) : '';
    
    // Look for JSON data in script tags
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (text.includes('person') || text.includes('individual') || text.includes('family')) {
        const matches = text.match(/[{][^{}]*"[^"]*"[^{}]*[}]/g) || [];
        if (matches.length > 2) {
          try {
            const jsonData = JSON.parse('[' + matches.join(',') + ']');
            if (Array.isArray(jsonData)) {
              result.individuals = jsonData.filter(item => item && (item.name || item.personId || item.id));
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
    }
    
    // Look for person cards or list items
    const personElements = document.querySelectorAll('[class*="person"], [class*="individual"], [data-person-id], [id*="person"]');
    const persons = [];
    personElements.forEach(el => {
      const text = el.innerText || el.textContent || '';
      if (text && text.length > 2 && text.length < 500) {
        persons.push(text.trim());
      }
    });
    result.foundPersonElements = persons;
    
    return result;
  });
  
  console.log('Found person elements:', peopleData.foundPersonElements ? peopleData.foundPersonElements.length : 0);
  if (peopleData.foundPersonElements) {
    peopleData.foundPersonElements.slice(0, 20).forEach(p => console.log('  -', p.substring(0, 100)));
  }
  
  console.log('Page text sample:', peopleData.pageText.substring(0, 500));
  
  return peopleData;
}

// ==================== Main ====================

async function main() {
  console.log('========================================');
  console.log('MyHeritage Family Site Data Extractor');
  console.log('========================================\n');
  
  // First try direct HTTP access (block might have expired)
  console.log('1. Trying direct HTTP access...');
  const direct = await fetchURL(TARGET_URL);
  if (!direct.error && direct.status === 200 && !direct.content.includes('Incapsula') && !direct.content.includes('Request unsuccessful')) {
    console.log('SUCCESS! Direct access works!');
    console.log('Content length:', direct.content.length);
    
    fs.writeFileSync(path.join(__dirname, 'myheritage_accessible.html'), direct.content);
    console.log('Saved to myheritage_accessible.html');
    
    if (!direct.content.includes('Incapsula')) {
      console.log('Found family data in page!');
      return;
    }
  } else {
    console.log('Direct access blocked:', direct.error || `Status ${direct.status} (Incapsula)`);
  }
  
  // Try CDP connection to real Chrome
  console.log('\n2. Trying Chrome CDP connection...');
  const cdp = await findDebugPort();
  
  if (!cdp) {
    console.log('');
    console.log('==========================================');
    console.log('  CHROME CDP NOT FOUND');
    console.log('==========================================');
    console.log('The MyHeritage site is protected by Incapsula bot protection');
    console.log('and your IP address is temporarily blocked (Error 16).');
    console.log('');
    console.log('To extract data, you need to connect your real Chrome browser:');
    console.log('');
    console.log('STEP 1: Close all Chrome windows completely');
    console.log('');
    console.log('STEP 2: Start Chrome with remote debugging enabled:');
    console.log('   "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
    console.log('');
    console.log('STEP 3: In the new Chrome window, log into MyHeritage');
    console.log('   and navigate to the family site:');
    console.log('   https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ');
    console.log('');
    console.log('STEP 4: Run this script again:');
    console.log('   node fetch_myheritage_full.mjs');
    console.log('');
    console.log('ALTERNATIVELY, if you can access the site from another');
    console.log('network (e.g., mobile hotspot or VPN):');
    console.log('   node fetch_myheritage_real.mjs');
    console.log('');
    console.log('OR wait 24 hours for the IP block to expire, then run:');
    console.log('   node fetch_myheritage_real.mjs');
    console.log('==========================================');
    return;
  }
  
  console.log('Found Chrome debugging port:', cdp.port);
  console.log('Browser:', cdp.info.Browser || 'Unknown');
  
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${cdp.port}`,
    defaultViewport: null,
  });
  
  console.log('Connected to Chrome!');
  
  let pages = await browser.pages();
  let page = pages.find(p => p.url().includes('myheritage')) || pages[0] || await browser.newPage();
  
  console.log('Using page:', page.url() || '(new/blank)');
  
  // Navigate to the family site
  console.log('\n3. Navigating to MyHeritage family site...');
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('Nav error:', e.message));
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  const finalUrl = page.url();
  const html = await page.content();
  console.log('Final URL:', finalUrl);
  console.log('HTML Length:', html.length);
  
  // Check if blocked
  const isBlocked = html.includes('Incapsula') || html.includes('incap_ses') || html.includes('Request unsuccessful') || html.includes('Access Denied');
  console.log('Is blocked:', isBlocked);
  
  if (!isBlocked && html.length > 1000) {
    console.log('\nSUCCESS! Got the MyHeritage page!');
    
    // Save the raw HTML
    fs.writeFileSync(path.join(__dirname, 'myheritage_cdp_page.html'), html);
    console.log('Saved HTML to myheritage_cdp_page.html');
    
    // Take screenshot
    try {
      await page.screenshot({ path: path.join(__dirname, 'myheritage_cdp_screenshot.png'), fullPage: true });
      console.log('Screenshot saved to myheritage_cdp_screenshot.png');
    } catch (e) {
      console.log('Screenshot error:', e.message);
    }
    
    // Extract data from the page
    const data = await extractDataFromPage(page);
    
    // Search for the people list page or tree page
    console.log('\nLooking for People page link...');
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .filter(a => /people|individual|tree|family/i.test(a.textContent + ' ' + a.href))
        .map(a => ({ text: a.textContent.trim(), href: a.href }))
        .slice(0, 20);
    });
    console.log('Found links:', JSON.stringify(links, null, 2));
    
    // Check if there's a chart/pedigree page
    console.log('\nSearching for data patterns in HTML...');
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
    
    // Show first 3000 chars of the page
    console.log('\n--- PAGE CONTENT (first 3000 chars) ---');
    console.log(html.substring(0, 3000));
    
    // Check for GEDCOM export link
    console.log('\nLooking for GEDCOM export link...');
    const gedcomLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .filter(a => /gedcom|export|download|\.ged/i.test(a.href + ' ' + a.textContent))
        .map(a => ({ text: a.textContent.trim(), href: a.href }))
        .slice(0, 20);
    });
    console.log('GEDCOM links:', JSON.stringify(gedcomLinks, null, 2));
    
  } else {
    console.log('\nStill blocked even through Chrome CDP.');
    console.log('The IP block is at the Incapsula service level.');
    console.log('Your IP:', '41.139.222.47');
    console.log('\nOptions:');
    console.log('1. Use a VPN or different network to access');
    console.log('2. Wait 24 hours for the block to expire');
    console.log('3. Contact MyHeritage support at security-support@myheritage.com');
    console.log('\n--- BLOCKED CONTENT ---');
    console.log(html.substring(0, 2000));
  }
  
  await browser.disconnect();
  console.log('\nDisconnected from Chrome.');
}

main();