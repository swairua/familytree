import fs from 'fs';
import path from 'path';

// Download all profile photos (CDN URLs from the MyHeritage people list) into
// data/photos/{gid}.jpg so they can be served locally and embedded into the
// GEDCOM via OBJE/FILE.
//
// Usage:
//   node download_photos.mjs [people.json] [outdir]
//   node download_photos.mjs --check        # only report which are missing
//
// The people JSON matches the shape saved by the sync/extraction scripts:
//   { "people": [ { id, photo: { url, width, height }, ... } ] }  or a bare array.

const SITE = 'OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';
const CONCURRENCY = 12;

function gidFor(id) {
  return id && id.startsWith(SITE + '-') ? id.slice(SITE.length + 1) : id;
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Referer': 'https://www.myheritage.com/' },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function run(peopleFile, outDir, checkOnly = false) {
  fs.mkdirSync(outDir, { recursive: true });

  const raw = JSON.parse(fs.readFileSync(peopleFile, 'utf8'));
  const people = Array.isArray(raw) ? raw : (raw.people || raw.results || []);
  return ensurePhotos(people, outDir, { checkOnly });
}

export async function ensurePhotos(people, outDir, { checkOnly = false, onProgress } = {}) {
  fs.mkdirSync(outDir, { recursive: true });

  const jobs = people
    .filter(p => p && p.photo && p.photo.url)
    .map(p => ({ id: p.id, gid: gidFor(p.id), url: p.photo.url }));

  const dedupe = new Map();
  for (const j of jobs) {
    if (!dedupe.has(j.gid)) dedupe.set(j.gid, j);
  }
  const unique = Array.from(dedupe.values());
  console.log(`People with photos: ${jobs.length} | unique: ${unique.length}`);

  const existing = unique.filter(j => fs.existsSync(path.join(outDir, j.gid + '.jpg')) && fs.statSync(path.join(outDir, j.gid + '.jpg')).size > 0);
  const todo = unique.filter(j => !fs.existsSync(path.join(outDir, j.gid + '.jpg')) || fs.statSync(path.join(outDir, j.gid + '.jpg')).size === 0);
  console.log(`Already present: ${existing.length} | to download: ${todo.length}`);

  if (checkOnly) {
    console.log('Missing:', todo.length);
    return { total: unique.length, downloaded: 0, failed: [] };
  }

  let done = 0, ok = 0, fail = 0;
  const fails = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const job = todo[next++];
      const dest = path.join(outDir, job.gid + '.jpg');
      try {
        const bytes = await download(job.url, dest);
        ok++; done++;
        console.log(`[${done}/${todo.length}] ${job.gid} (${bytes} bytes)`);
      } catch (e) {
        fail++; done++;
        fails.push({ gid: job.gid, url: job.url, error: e.message });
        console.log(`[${done}/${todo.length}] ${job.gid} FAILED: ${e.message}`);
      }
      if (onProgress) onProgress({ ok, fail, total: todo.length });
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, todo.length) }, () => worker());
  await Promise.all(workers);

  console.log(`Done: ${ok} ok, ${fail} failed (${existing.length} already present)`);
  if (fails.length) {
    fs.writeFileSync(path.join(outDir, '_failures.json'), JSON.stringify(fails, null, 2));
    console.log('Wrote data/photos/_failures.json');
  }
  return { total: unique.length, downloaded: ok, failed: fails };
}

const arg = process.argv[2];
if (arg === '--check' || arg === '-c') {
  const peopleFile = process.argv[3] || 'data/captures/all_people_rel.json';
  const outDir = process.argv[4] || 'data/photos';
  await run(peopleFile, outDir, true);
} else {
  const peopleFile = arg || 'data/captures/all_people_rel.json';
  const outDir = process.argv[3] || 'data/photos';
  await run(peopleFile, outDir, false);
}