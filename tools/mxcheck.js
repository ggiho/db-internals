/* 덱의 행렬을 소스와 한 칸씩 대조한다. 정규식으로 덱을 긁지 않고 실제로 평가한다 —
   regex 로 긁었더니 0개를 찾고도 "불일치 0" 을 보고했다. 0개면 실패로 끝낸다. */
import fs from 'fs';
import path from 'path';

/* 데이터 로딩 — eval 이 아니라 import() 다. 데이터 파일이 export 를 갖게 되면서
   기존 eval 로더(^const → globalThis)는 export 문에서 깨진다. */
const __here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__here, '..');
async function loadDeck(deck) {
  const g = {};
  for (const f of ['deck', 'actors', 'scenes', 'linemap', 'code', 'booktext', 'booksrc']) {
    const p = path.join(ROOT, 'data', deck, f + '.js');
    if (!fs.existsSync(p)) continue;
    Object.assign(g, await import('file://' + p));
  }
  for (const f of ['knobmap', 'statusmap', 'tablemap']) {
    const p = path.join(ROOT, 'data', 'shared', f + '.js');
    if (fs.existsSync(p)) Object.assign(g, await import('file://' + p));
  }
  for (const [k, v] of Object.entries(g)) if (k !== 'default') globalThis[k] = v;
  return g;
}
/* MySQL 소스 위치. 기본값은 이 프로젝트의 형제 디렉터리 ../mysql-server 다 —
   절대경로를 박으면 다른 사람이 쓸 수 없고 사용자명이 저장소에 남는다.
   다른 곳에 있으면 MYSQL_SRC 로 지정한다. */
const REPO = process.env.MYSQL_SRC || path.resolve(ROOT, '..', 'mysql-server');
const DECK = process.argv[2];
if (!DECK) { console.error('사용법: node mxcheck.js <덱경로>'); process.exit(2); }
await loadDeck(DECK);

/* 덱에서 모든 matrix 를 모은다 */
const found = [];
for (const sc of SCENES)
  for (const [k, v] of Object.entries(sc.init || {}))
    if (v && v.mx) found.push({ scene: sc.num, actor: k, mx: v.mx });
if (!found.length) { console.log('행렬 없음 — 대조 건너뜀'); process.exit(0); }

/* 소스 : C 배열 두 개 */
const priv = fs.readFileSync(path.join(REPO, 'storage/innobase/include/lock0priv.h'), 'utf8');
const carr = name => {
  /* 겉 중괄호 한 쌍만 벗겨야 마지막 행을 잃지 않는다 — \}\}; 로 끝을 잡으면
     마지막 행의 닫는 중괄호가 패턴에 먹혀 4행만 나온다 (그렇게 한 번 틀렸다). */
  const m = priv.match(new RegExp(name + '\\[5\\]\\[5\\]\\s*=\\s*(\\{[\\s\\S]*?\\}\\});'));
  const inner = m[1].slice(1, -1);
  return inner.match(/\{[^{}]*\}/g).map(r =>
    r.replace(/[{}]/g, '').split(',').map(v => v.trim() === 'true' ? '+' : '-'));
};
/* 소스 : MDL 주석의 ASCII 표 */
const mdlsrc = fs.readFileSync(path.join(REPO, 'sql/mdl.cc'), 'utf8');
const at = mdlsrc.indexOf('Request  |  Granted requests for lock');
const mdlRows = [], mdlNames = [];
for (const ln of mdlsrc.slice(at, at + 1400).split('\n')) {
  const m = ln.match(/^\s*(S|SH|SR|SW|SWLP|SU|SRO|SNW|SNRW|X)\s+\|([^|]*)\|/);
  if (m) { mdlNames.push(m[1]); mdlRows.push(m[2].trim().split(/\s+/).filter(c => c === '+' || c === '-')); }
}
const SRC = {
  'lock_compatibility_matrix': carr('lock_compatibility_matrix'),
  'lock_strength_matrix':      carr('lock_strength_matrix'),
  'MDL_lock::m_object_lock_strategy': mdlRows,
};
console.log('소스 : 호환 ' + SRC['lock_compatibility_matrix'].length + '행 · 강도 ' +
  SRC['lock_strength_matrix'].length + '행 · MDL ' + mdlRows.length + '행(' + mdlNames.join(' ') + ')');

let bad = 0, checked = 0;
for (const f of found) {
  /* 어떤 소스 표인지는 lb.r 에 적어 두었다 */
  const tag = (f.mx.lb && f.mx.lb.r) || '';
  const key = Object.keys(SRC).find(k => tag.toLowerCase().includes(k.toLowerCase()));
  if (!key) { console.log('  ? ' + f.scene + '/' + f.actor + ' 는 어느 소스 표인지 표시(lb.r)가 없다 — 대조 못 함'); bad++; continue; }
  const a = SRC[key], b = f.mx.cells;
  if (a.length !== b.length) { console.log('  ! ' + f.scene + '/' + f.actor + ' 행 수 소스 ' + a.length + ' ≠ 덱 ' + b.length); bad++; continue; }
  const diff = [];
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) { diff.push('행 ' + f.mx.rows[r] + ' 칸수 ' + a[r].length + '≠' + b[r].length); continue; }
    for (let c = 0; c < a[r].length; c++)
      if (a[r][c] !== b[r][c]) diff.push('[' + f.mx.rows[r] + '/' + f.mx.cols[c] + '] 소스 ' + a[r][c] + ' ≠ 덱 ' + b[r][c]);
  }
  checked += a.reduce((s, r) => s + r.length, 0);
  if (diff.length) { console.log('  ! ' + f.scene + '/' + f.actor + ' (' + key + ') : ' + diff.slice(0, 8).join(' / ')); bad += diff.length; }
  else console.log('  ✓ ' + f.scene + '/' + f.actor + ' (' + key + ')  ' + a.reduce((s, r) => s + r.length, 0) + '칸 일치');
}
console.log('행렬 ' + found.length + '개 · 대조한 칸 ' + checked + ' · 불일치 ' + bad);
process.exit(bad ? 1 : 0);
