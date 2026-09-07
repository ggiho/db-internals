/* PostgreSQL 의 테이블 락 충돌 표를 소스에서 유도해 덱의 행렬과 칸 단위로 대조한다.
   MySQL 은 주석에 ASCII 표가 있어 mxcheck.js 가 그것을 읽지만, PG 는
   LOCKMASK 비트마스크 배열이라 형식이 다르다 — 그래서 별도 도구다.
   64칸을 손으로 옮기면 반드시 틀린다. */
import fs from 'fs';
import path from 'path';
import { srcRoot } from './srcroot.js';

const __here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__here, '..');
const DECK = process.argv[2] || 'postgres/locks';
const REPO = srcRoot(DECK, ROOT);

const SHORT = { AccessShare:'AS', RowShare:'RS', RowExclusive:'RE',
  ShareUpdateExclusive:'SUE', Share:'S', ShareRowExclusive:'SRE',
  Exclusive:'X', AccessExclusive:'AX' };
const ORDER = Object.keys(SHORT);

/* ── 소스에서 유도 ── */
const f = path.join(REPO, 'src/backend/storage/lmgr/lock.c');
if (!fs.existsSync(f)) { console.error('  ! lock.c 없음: ' + f); process.exit(2); }
const src = fs.readFileSync(f, 'utf8');
const i = src.indexOf('static const LOCKMASK LockConflicts[] = {');
const j = src.indexOf('};', i);
if (i < 0 || j < 0) { console.error('  ! LockConflicts 배열을 못 찾았다'); process.exit(2); }
const parts = src.slice(i, j).split(/\/\*\s*(\w+Lock)\s*\*\//);
const from = {};
for (let k = 1; k < parts.length; k += 2) {
  const mode = parts[k].replace(/Lock$/, '');
  from[mode] = new Set([...parts[k + 1].matchAll(/LOCKBIT_ON\((\w+)Lock\)/g)].map((m) => m[1]));
}
const miss = ORDER.filter((m) => !from[m]);
if (miss.length) { console.error('  ! 소스에서 못 읽은 모드: ' + miss.join(',')); process.exit(2); }
const want = ORDER.map((r) => ORDER.map((c) => (from[r].has(c) ? '-' : '+')));

/* ── 덱의 행렬 ── */
const g = {};
for (const nm of ['actors', 'scenes']) {
  const p = path.join(ROOT, 'data', DECK, nm + '.js');
  Object.assign(g, await import('file://' + p));
}
const found = [];
for (const sc of (g.SCENES || [])) {
  for (const st of (sc.steps || [])) {
    for (const [id, op] of Object.entries(st.ops || {})) {
      if (op && op.mx) found.push({ at: sc.num, id, mx: op.mx });
    }
  }
  for (const [id, v] of Object.entries(sc.init || {})) {
    if (v && v.mx) found.push({ at: sc.num, id, mx: v.mx });
  }
}
if (!found.length) { console.log('행렬 없음 — 대조 건너뜀'); process.exit(0); }

let bad = 0, cells = 0;
for (const m of found) {
  const { rows, cols, cells: cc } = m.mx;
  if (rows.length !== 8 || cols.length !== 8) {
    console.log('  ! ' + m.at + '/' + m.id + ' 8×8 이 아니다 (' + rows.length + '×' + cols.length + ')'); bad++; continue;
  }
  let e = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    cells++;
    if (cc[r][c] !== want[r][c]) {
      console.log('  ! ' + m.at + '/' + m.id + ' [' + rows[r] + '][' + cols[c] + '] 덱 ' + cc[r][c] + ' ≠ 소스 ' + want[r][c]);
      e++; bad++;
    }
  }
  if (!e) console.log('  ✓ ' + m.at + '/' + m.id + ' (LockConflicts)  64칸 일치');
}
const conf = want.flat().filter((x) => x === '-').length;
console.log('소스 : 8모드 · 충돌 ' + conf + '/64 · 대칭 ' +
  (ORDER.every((r, ri) => ORDER.every((c, ci) => want[ri][ci] === want[ci][ri])) ? '성립' : '깨짐'));
console.log('행렬 ' + found.length + '개 · 대조한 칸 ' + cells + ' · 불일치 ' + bad);
if (bad) process.exitCode = 1;
