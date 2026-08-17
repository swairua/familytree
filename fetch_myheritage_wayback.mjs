import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_URL = 'https://www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ?hcl=1&tr_date=20260816';

// Check Wayback Machine for a snapshot of the family site
function checkWayback() {
  return new Promise((resolve) => {
    const url = `https://archive.org/wayback/available?url=${encodeURIComponent('www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ*')}&timestamp=2026`;
    
    const req = https.request(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Parse error: ' + e.message });
        }
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

// Fetch archived page from Wayback
function fetchArchivedPage(url) {
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, content: data });
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout' });
    });
    req.end();
  });
}

// Also check Google cache
function checkGoogleCache() {
  return new Promise((resolve) => {
    const url = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent('www.myheritage.com/family-sites/wairua/OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ')}`;
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, content: data.substring(0, 5000) });
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout' });
    });
    req.end();
  });
}

async function main() {
  console.log('=== CHECKING ALTERNATIVE ACCESS METHODS ===\n');
  
  // 1. Check Wayback Machine
  console.log('1. Checking Wayback Machine...');
  const wayback = await checkWayback();
  console.log('Wayback response:', JSON.stringify(wayback, null, 2));
  
  if (wayback && wayback.archived_snapshots && wayback.archived_snapshots.closest) {
    const snapshot = wayback.archived_snapshots.closest;
    console.log('\nFound snapshot:', snapshot.url);
    console.log('Timestamp:', snapshot.timestamp);
    
    const result = await fetchArchivedPage(snapshot.url);
    if (result.status === 200 && result.content) {
      console.log('Snapshot content length:', result.content.length);
      console.log('Contains Incapsula:', result.content.includes('Incapsula'));
      console.log('Contains family data:', result.content.includes('family') || result.content.includes('tree') || result.content.includes('person'));
      console.log('\n--- FIRST 3000 CHARS ---');
      console.log(result.content.substring(0, 3000));
      
      if (!result.content.includes('Incapsula')) {
        fs.writeFileSync(path.join(__dirname, 'myheritage_wayback.html'), result.content);
        console.log('\nSaved to myheritage_wayback.html');
      }
    } else {
      console.log('Failed to fetch snapshot:', result.error || `Status ${result.status}`);
    }
  } else {
    console.log('\nNo archived snapshot found for this URL');
  }
  
  // 2. Check Google Cache
  console.log('\n2. Checking Google Cache...');
  const googleCache = await checkGoogleCache();
  if (googleCache.error) {
    console.log('Google Cache error:', googleCache.error);
  } else {
    console.log('Google Cache status:', googleCache.status);
    if (googleCache.content) {
      console.log('Google Cache content length:', googleCache.content.length);
      console.log('Contains family data:', googleCache.content.includes('family') || googleCache.content.includes('tree') || googleCache.content.includes('person'));
      console.log('--- FIRST 2000 CHARS ---');
      console.log(googleCache.content.substring(0, 2000));
    }
  }
  
  console.log('\n=== DONE ===');
}

main();