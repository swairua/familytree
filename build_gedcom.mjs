import fs from 'fs';

// Build a GEDCOM file from the MyHeritage people-list JSON (all_people_rel.json).
// Reconstructs individuals + families from relatives.spouses / relatives.children.
//
// Usable as a module:  buildGedcomFromPeople(people, outPath)
// or as a CLI:         node build_gedcom.mjs [input.json] [output.ged]

const SITE = 'OYYV6UYCQOJ76UUGSORCEA4K7X53VLQ';

function decodeHtml(s) {
  if (!s) return s;
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Convert a MyHeritage people array (from the list API `relatives=1`) into a
 * GEDCOM 5.5.1 file. Returns { lines, individuals, families }.
 */
export function buildGedcomFromPeople(people, outPath) {
  for (const p of people) {
    p.name = decodeHtml(p.name);
    p.firstName = decodeHtml(p.firstName);
    p.lastName = decodeHtml(p.lastName);
    if (p.names) for (const n of p.names) n.n = decodeHtml(n.n);
  }

  const byId = new Map();
  for (const p of people) byId.set(p.id, p);

  // ---- index: parentsOf[childId] = [parentId...], couples set ----------------
  const parentsOf = new Map(); // childId -> Set of parent ids
  for (const p of people) {
    const kids = p.relatives && p.relatives.children && p.relatives.children.persons;
    if (!kids) continue;
    for (const k of kids) {
      if (!byId.has(k.id)) continue;
      if (!parentsOf.has(k.id)) parentsOf.set(k.id, new Set());
      parentsOf.get(k.id).add(p.id);
    }
  }

  const couples = new Set(); // sorted "a|b"
  for (const p of people) {
    const sp = p.relatives && p.relatives.spouses && p.relatives.spouses.persons;
    if (!sp) continue;
    for (const s of sp) {
      if (!byId.has(s.id)) continue;
      const a = p.id < s.id ? p.id : s.id;
      const b = p.id < s.id ? s.id : p.id;
      couples.add(a + '|' + b);
    }
  }

  // ---- assign children to families -------------------------------------------
  const familyKeyToId = new Map();
  const childToFamily = new Map(); // childId -> familyId
  let famCounter = 0;
  function famIdFor(key) {
    if (!familyKeyToId.has(key)) familyKeyToId.set(key, 'F' + (++famCounter));
    return familyKeyToId.get(key);
  }
  for (const [childId, parentSet] of parentsOf) {
    const par = [...parentSet];
    if (par.length >= 2) {
      const [a, b] = [par[0], par[1]].sort();
      childToFamily.set(childId, famIdFor(a + '|' + b));
    } else if (par.length === 1) {
      childToFamily.set(childId, famIdFor('S|' + par[0]));
    }
  }

  // ---- build family records ---------------------------------------------------
  const fams = new Map();
  function ensureFamily(key, p1, p2) {
    const fid = famIdFor(key);
    if (!fams.has(fid)) fams.set(fid, { id: fid, husband: null, wife: null, children: [] });
    const f = fams.get(fid);
    const isCouple = key.includes('|');
    if (isCouple) {
      const a = p1, b = p2;
      if (a && b) {
        const ga = byId.get(a) ? byId.get(a).gender : '';
        const gb = byId.get(b) ? byId.get(b).gender : '';
        if (ga === 'M' && gb !== 'M') { f.husband = a; f.wife = b; }
        else if (gb === 'M' && ga !== 'M') { f.husband = b; f.wife = a; }
        else { f.husband = a; f.wife = b; }
      }
    } else {
      const pid = key.slice(2);
      const g = byId.get(pid) ? byId.get(pid).gender : '';
      if (g === 'M') f.husband = pid; else f.wife = pid;
    }
    return f;
  }

  for (const key of couples) {
    const [a, b] = key.split('|');
    ensureFamily(key, a, b);
  }
  for (const key of familyKeyToId.keys()) {
    if (!key.includes('|')) ensureFamily(key, key.slice(2), null);
  }
  for (const [childId, fid] of childToFamily) {
    if (fams.has(fid)) fams.get(fid).children.push(childId);
  }

  // ---- GEDCOM generation -------------------------------------------------------
  function gedLine(level, tag, value = '') {
    const v = String(value ?? '');
    return v ? `${level} ${tag} ${v}` : `${level} ${tag}`;
  }
  function placeName(pl) {
    return pl && pl.name ? pl.name : '';
  }
  function gedDate(d) {
    if (!d) return '';
    const s = String(d).trim();
    if (/^before/i.test(s)) return 'BEF ' + s.replace(/^before\s+/i, '');
    if (/^circa|^abt|^about/i.test(s)) return 'ABT ' + s.replace(/^(circa|abt|about)\s+/i, '');
    if (/^after/i.test(s)) return 'AFT ' + s.replace(/^after\s+/i, '');
    return s;
  }

  let out = [];
  out.push(gedLine(0, 'HEAD'));
  out.push(gedLine(1, 'SOUR', 'MyHeritage'));
  out.push(gedLine(2, 'NAME', 'MyHeritage'));
  out.push(gedLine(2, 'VERS', 'web-export'));
  out.push(gedLine(1, 'GEDC'));
  out.push(gedLine(2, 'VERS', '5.5.1'));
  out.push(gedLine(2, 'FORM', 'LINEAGE-LINKED'));
  out.push(gedLine(1, 'CHAR', 'UTF-8'));

  const indIdMap = new Map();
  for (const p of people) {
    const gid = p.id.startsWith(SITE + '-') ? p.id.slice(SITE.length + 1) : p.id;
    indIdMap.set(p.id, 'I' + gid);
  }

  for (const p of people) {
    const xref = indIdMap.get(p.id);
    out.push(gedLine(0, '@' + xref + '@', 'INDI'));
    const given = p.firstName || '';
    const surn = p.lastName || '';
    const nameVal = (given ? given + ' ' : '') + '/' + (surn ? surn : '') + '/';
    out.push(gedLine(1, 'NAME', nameVal));
    if (given) out.push(gedLine(2, 'GIVN', given));
    if (surn) out.push(gedLine(2, 'SURN', surn));
    if (p.names && p.names.length) {
      const seen = new Set([nameVal]);
      for (const n of p.names) {
        const alt = n.n;
        if (!alt || seen.has(alt)) continue;
        seen.add(alt);
        if (alt === p.name) continue;
        out.push(gedLine(1, 'NAME', alt.replace(/[\/@]/g, ' ')));
      }
    }
    if (p.gender === 'M') out.push(gedLine(1, 'SEX', 'M'));
    else if (p.gender === 'F') out.push(gedLine(1, 'SEX', 'F'));
    if (p.photo && p.photo.url) {
      const gid = indIdMap.get(p.id).slice(1); // strip 'I' prefix to match download naming
      out.push(gedLine(1, 'OBJE'));
      out.push(gedLine(2, 'FILE', gid + '.jpg'));
      out.push(gedLine(2, 'FORM', 'jpg'));
    }
    const bd = gedDate(p.birthDate);
    if (bd) {
      out.push(gedLine(1, 'BIRT'));
      out.push(gedLine(2, 'DATE', bd));
      const bp = placeName(p.birthPlace);
      if (bp) out.push(gedLine(2, 'PLAC', bp));
    }
    const dd = gedDate(p.deathDate);
    if (dd) {
      out.push(gedLine(1, 'DEAT'));
      out.push(gedLine(2, 'DATE', dd));
      const dp = placeName(p.deathPlace);
      if (dp) out.push(gedLine(2, 'PLAC', dp));
    } else if (p.deathDeceased === 'Deceased') {
      out.push(gedLine(1, 'DEAT'));
      const dp = placeName(p.deathPlace);
      if (dp) out.push(gedLine(2, 'PLAC', dp));
    }
  }

  const finalFamId = new Map();
  let fc = 0;
  for (const [fid, f] of fams) finalFamId.set(fid, 'F' + (++fc));

  for (const [fid, f] of fams) {
    const fx = finalFamId.get(fid);
    out.push(gedLine(0, '@' + fx + '@', 'FAM'));
    if (f.husband) out.push(gedLine(1, 'HUSB', '@' + indIdMap.get(f.husband) + '@'));
    if (f.wife) out.push(gedLine(1, 'WIFE', '@' + indIdMap.get(f.wife) + '@'));
    for (const cid of f.children) {
      out.push(gedLine(1, 'CHIL', '@' + indIdMap.get(cid) + '@'));
    }
  }

  out.push(gedLine(0, 'TRLR'));

  if (outPath) {
    fs.writeFileSync(outPath, out.join('\n') + '\n');
  }
  return { lines: out, individuals: people.length, families: fams.size };
}

// ---- CLI entry ----------------------------------------------------------------
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('\\').pop())) {
  const IN = process.argv[2] || 'data/captures/all_people_rel.json';
  const OUT = process.argv[3] || 'data/myheritage_export.ged';
  const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const people = raw.people || raw.results || raw;
  const { lines, individuals, families } = buildGedcomFromPeople(people, OUT);
  console.log(`People: ${individuals} | Families: ${families} | Lines: ${lines.length}`);
  console.log('Wrote', OUT);
}