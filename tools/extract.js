/* 각 ref#sym 의 실제 소스를 잘라 code.js 로 만든다.
   linemap.js 가 찾은 줄을 중심으로 위 6줄 · 아래 14줄. */
import fs from 'fs';
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
const B = 6, A = 14;
const DECK = process.argv[2];
if (!DECK) { console.error('사용법: node extract.js <덱경로>'); process.exit(2); }
const REPO = srcRoot(DECK, ROOT);
/* 데이터 파일이 ESM(export)으로 바뀐 뒤에도 이 한 줄만 eval 로 남아 있었다 —
   `export { LINES }` 에서 SyntaxError 로 죽는다. 위에 이미 있는 loadDeck 을 쓴다.
   (파일 상단 주석은 이미 import 를 쓴다고 적혀 있었는데 이 줄이 안 바뀌어 있었다.) */
await loadDeck(DECK);

const out = {}; let ok = 0, bad = [];
for (const [key, ln] of Object.entries(LINES)) {
  const file = key.split('#')[0];
  const full = path.join(REPO, file);
  if (!fs.existsSync(full)) { bad.push(key); continue; }
  const src = fs.readFileSync(full, 'utf8').split('\n');
  const from = Math.max(1, ln - B), to = Math.min(src.length, ln + A);
  out[key] = { from, hit: ln, lines: src.slice(from - 1, to).map(l => l.replace(/\t/g, '  ').replace(/\s+$/, '')) };
  ok++;
}
/* lines.js 와 같은 이유로 ESM export 를 함께 쓴다 — 빼먹으면 앱이 발췌를 import 하지 못한다. */
fs.writeFileSync(path.join(ROOT, 'data', DECK, 'code.js'),
  'const CODE = ' + JSON.stringify(out) + ';\n\nexport { CODE };\n');
const kb = (fs.statSync(path.join(ROOT, 'data', DECK, 'code.js')).size / 1024).toFixed(1);
console.log('발췌 ' + ok + ' / ' + Object.keys(LINES).length + '  ·  code.js ' + kb + ' KB');
if (bad.length) console.log('  실패: ' + bad.join(', '));
