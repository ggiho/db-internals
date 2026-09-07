/* 산문 속 "상수 = 값" 주장을 저장소와 대조한다.
   249스텝을 사람이 읽는 일은 매번 다르게 놓치므로, 기계가 잡을 수 있는 형태만
   골라 자동화한다 : NAME = 4 · NAME(512) · NAME = 8 처럼 값이 붙은 인용.
   값 없는 인용은 fact 경고가 이미 표시한다. */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { srcRoot } from './srcroot.js';

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
const DECK = process.argv[2];
if (!DECK) { console.error('사용법: node claimcheck.js <덱경로>'); process.exit(2); }
const REPO = srcRoot(DECK, ROOT);
await loadDeck(DECK);

/* 저장소에서 상수 정의를 찾는다 (constexpr · #define · static const · enum 초기화) */
const cache = new Map();
/* 검색 경로도 덱마다 다르다 — MySQL 은 storage/innobase·sql·include 이고
   PostgreSQL 은 src 다. 경로를 박아 두면 PG 덱에서 없는 디렉터리를 뒤져
   "정의 못 찾음" 이 조용히 쌓인다(실측 : HEAP_XMAX_LOCK_ONLY 등 2건). */
/* PG 덱은 InnoDB 상수를 대조로 인용한다(예 : "InnoDB 의 FIL_PAGE_DATA = 38 은
   리터럴이다"). 그래서 자기 트리만 뒤지면 그 주장이 "정의 못 찾음" 으로 빠진다 —
   두 트리를 모두 본다. 상대 엔진 트리가 없으면 그 경로는 조용히 빠진다. */
const OTHER = srcRoot(String(DECK).split('/')[0] === 'postgres' ? 'mysql/x' : 'postgres/x', ROOT);
const SELF = (String(DECK).split('/')[0] === 'postgres'
  ? [REPO + '/src']
  : [REPO + '/storage/innobase', REPO + '/sql', REPO + '/include']).filter((d) => fs.existsSync(d));
const CROSS = (String(DECK).split('/')[0] === 'postgres'
  ? [OTHER + '/storage/innobase', OTHER + '/include']
  : [OTHER + '/src']).filter((d) => fs.existsSync(d));
/* 자기 트리를 먼저 보고, 못 찾을 때만 상대 트리를 본다 — 둘을 항상 뒤지면
   덱 하나에 2분이 넘는다(실측). 대조 인용은 소수이므로 이 순서가 훨씬 빠르다. */
const GREP_PATHS = SELF.join(' ');
const GREP_PATHS_CROSS = CROSS.join(' ');
function lookup(name) {
  if (cache.has(name)) return cache.get(name);
  /* grep 은 -F 로 이름만 고정 문자열로 찾고, 판별은 JS 에서 한다 —
     패턴을 셸로 넘기면 JSON.stringify 가 \\b · \\n 을 이중 이스케이프해서 조용히 0건이 된다. */
  let lines = [];
  try {
    lines = execSync(
      'grep -rhF ' + JSON.stringify(name) + ' ' + GREP_PATHS + ' 2>/dev/null | head -200',
      { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n');
  } catch (e) {
    /* grep 이 못 돌면 "정의 못 찾음" 으로 조용히 넘어가면 안 된다.
       ESM 전환 때 require('child_process') 가 죽어 10건이 조용히 0건이 됐다. */
    if (!/exit code 1/.test(String(e.status))) { console.error('  ! grep 실행 실패: ' + String(e.message).slice(0,90)); process.exitCode = 2; }
    lines = [];
  }
  const pats = [
    new RegExp('constexpr\\s[\\w:<>*\\s]*\\b' + name + '\\s*=\\s*([^;]+);'),
    new RegExp('#define\\s+' + name + '\\s+([^/\\n]+)'),
    new RegExp('static\\s+const\\s[\\w\\s]*\\b' + name + '\\s*=\\s*([^;]+);'),
    new RegExp('\\b' + name + '\\s*=\\s*(0x[0-9A-Fa-f]+|\\d+)\\s*[,}]'),
  ];
  const vals = new Set();
  for (const ln of lines)
    for (const re of pats) {
      const m = ln.match(re);
      if (m) { vals.add(m[1].trim().replace(/\s+/g, ' ')); break; }
    }
  /* 자기 트리에서 못 찾았으면 상대 엔진 트리를 본다 — PG 덱이 InnoDB 상수를
     대조로 인용하는 경우다(예 : FIL_PAGE_DATA = 38). 처음부터 둘을 뒤지면
     덱 하나에 2분이 넘으므로 이 순서가 중요하다. */
  if (!vals.size && GREP_PATHS_CROSS) {
    let more = [];
    try {
      more = execSync('grep -rhF ' + JSON.stringify(name) + ' ' + GREP_PATHS_CROSS + ' 2>/dev/null | head -200',
        { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n');
    } catch (e) {
      if (!/exit code 1/.test(String(e.status))) { console.error('  ! 상대 트리 grep 실패: ' + String(e.message).slice(0,80)); process.exitCode = 2; }
    }
    for (const ln of more)
      for (const re of pats) { const m = ln.match(re); if (m) { vals.add(m[1].trim().replace(/\s+/g, ' ')); break; } }
  }
  const out = vals.size ? [...vals] : null;
  cache.set(name, out);
  return out;
}
const num = s => {
  const t = s.replace(/[(),;]/g, '').trim();
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^\d+$/.test(t)) return +t;
  const m = t.match(/^(\d+)\s*<<\s*(\d+)$/); if (m) return (+m[1]) << (+m[2]);
  return null;
};

let checked = 0, bad = 0, skipped = 0;
for (const sc of SCENES) sc.steps.forEach((st, i) => {
  const S = 'SCENE ' + sc.num + '.' + String(i + 1).padStart(2, '0');
  const txt = [st.note, st.why, st.key].filter(Boolean).join(' ');
  /* NAME = 값  ·  NAME(값) */
  /* 16진수를 먼저 시도해야 한다 — [0-9]+ 를 앞에 두면 0x0080 에서 '0' 만 집어
     "덱 0 ≠ 저장소 128" 같은 거짓 불일치가 난다(실측 : PostgreSQL infomask 비트 2건). */
  const re = /\b([A-Z][A-Z0-9_]{5,})\s*(?:=\s*|\(\s*=?\s*)(0x[0-9A-Fa-f]+|[0-9]+\s*<<\s*[0-9]+|[0-9]+)/g;
  let m;
  while ((m = re.exec(txt))) {
    const name = m[1], claimed = num(m[2]);
    if (claimed === null) continue;
    const defs = lookup(name);
    if (!defs) { skipped++; console.log('  ? ' + S + ' ' + name + ' 정의를 저장소에서 못 찾았다 (주장 ' + claimed + ')'); continue; }
    const actual = defs.map(num).filter(v => v !== null);
    checked++;
    if (actual.length && !actual.includes(claimed)) {
      bad++;
      console.log('  ! ' + S + ' ' + name + ' — 덱 ' + claimed + ' ≠ 저장소 ' + [...new Set(actual)].join(' · '));
    }
  }
});
console.log(DECK + ' : 값이 붙은 상수 주장 ' + checked + '건 대조 · 불일치 ' + bad + ' · 정의 못 찾음 ' + skipped);
process.exit(bad ? 1 : 0);
