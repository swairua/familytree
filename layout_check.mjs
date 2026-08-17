// Validate the new TreeView descendant-tree layout against real data.
// Mirrors src/components/TreeView.jsx layout logic (v2: roots all build, placedGlobal dedups).
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/export_snapshot.json', 'utf8'));
const individuals = new Map(data.individuals.map(p => [p.id, p]));
const NODE_WIDTH = 160, NODE_HEIGHT = 60, H_GAP = 40, V_GAP = 30;

const memo = new Map();
function build(id, path) {
  if (memo.has(id)) return memo.get(id);
  const person = individuals.get(id);
  if (!person || path.has(id)) return null;
  const spouses = (person.spouses || []).filter(s => individuals.has(s) && !path.has(s));
  const kids = (person.children || []).filter(c => individuals.has(c) && !path.has(c));
  const coupleCount = 1 + spouses.length;
  const coupleW = coupleCount * NODE_WIDTH + (coupleCount - 1) * H_GAP;
  const newPath = new Set(path); newPath.add(id);
  const childStructs = kids.map(k => build(k, newPath)).filter(Boolean);
  const kidsW = childStructs.length ? childStructs.reduce((s, c) => s + c.width, 0) + (childStructs.length - 1) * H_GAP : 0;
  const struct = {
    id, spouses, children: childStructs,
    width: Math.max(coupleW, kidsW),
    height: NODE_HEIGHT + (childStructs.length ? V_GAP + Math.max(...childStructs.map(c => c.height)) : 0),
  };
  memo.set(id, struct);
  return struct;
}

let roots = [];
for (const [id, person] of individuals) {
  if ((!person.parents || person.parents.length === 0)) roots.push(id);
}
if (roots.length === 0) roots = Array.from(individuals.keys());
roots.sort((a, b) => {
  const yearOf = (x) => { const m = (x.birthYear || '').match(/\d{4}/); return m ? +m[0] : 9999; };
  return yearOf(individuals.get(a)) - yearOf(individuals.get(b)) || (a < b ? -1 : 1);
});

const components = [];
for (const r of roots) {
  if (memo.has(r)) continue;
  const st = build(r, new Set());
  if (st) components.push(st);
}

const pos = new Map();
const placedGlobal = new Set();
let nodeCount = 0;

function place(st, left, top) {
  if (placedGlobal.has(st.id)) return { count: 0 };
  const spouses = st.spouses.filter(s => !placedGlobal.has(s));
  const coupleC = 1 + spouses.length;
  const coupleW = coupleC * NODE_WIDTH + (coupleC - 1) * H_GAP;
  placedGlobal.add(st.id);
  spouses.forEach(s => placedGlobal.add(s));
  const kidsW = st.children.length ? st.children.reduce((s, c) => s + c.width, 0) + (st.children.length - 1) * H_GAP : 0;
  const coupleX = left + (st.width - coupleW) / 2;
  const kidsX = left + (st.width - kidsW) / 2;
  pos.set(st.id, { x: coupleX, y: top });
  nodeCount++;
  spouses.forEach((s, i) => { pos.set(s, { x: coupleX + (i + 1) * (NODE_WIDTH + H_GAP), y: top }); nodeCount++; });
  const childTop = top + NODE_HEIGHT + V_GAP;
  let cx = kidsX;
  for (const cs of st.children) {
    place(cs, cx, childTop);
    cx += cs.width + H_GAP;
  }
  return { count: 1 + spouses.length };
}

let top = 0, maxWidth = 0, placedComponents = 0;
for (const st of components) {
  const before = placedGlobal.size;
  place(st, 0, top);
  if (placedGlobal.size > before) { placedComponents++; maxWidth = Math.max(maxWidth, st.width); top += st.height + V_GAP; }
}

// orphan pass (mirrors component)
for (const [id, person] of individuals) {
  if (pos.has(id)) continue;
  for (const sid of [id, ...(person.siblings || [])]) {
    if (!pos.has(sid)) pos.set(sid, { x: 0, y: top });
  }
  top += NODE_HEIGHT + V_GAP;
}

console.log('Total individuals:', individuals.size);
console.log('Placed nodes    :', pos.size);
console.log('Components      :', components.length, '(rendered:', placedComponents + ')');
console.log('Missing         :', individuals.size - pos.size);
console.log('Height          :', top + NODE_HEIGHT, 'Max width:', maxWidth);

const missing = [];
for (const id of individuals.keys()) if (!pos.has(id)) missing.push(id);
console.log('Missing ids count:', missing.length);