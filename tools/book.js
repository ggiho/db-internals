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
/* 덱이 인용한 책 원문을 대조할 수 있게 해당 장의 텍스트를 뽑는다.
   PDF 는 저장소 밖에 있고 사용자마다 경로가 다르므로, 없으면 조용히 건너뛴다.
   경로와 페이지 범위는 deck.js 의 book 필드가 정한다. */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const DECKDIR = process.argv[2];
if (!DECKDIR) { console.error('사용법: node book.js <덱경로>'); process.exit(2); }
eval(fs.readFileSync(path.join(DECKDIR, 'deck.js'), 'utf8').replace(/^const /m, 'globalThis.'));

const out = path.join(DECKDIR, 'booktext.js');
/* 책 PDF 위치는 deck.js 가 아니라 booksrc.js 에 있다 — deck.js 에 두면
   로컬 절대 경로가 클라이언트 번들에 실린다(배포 시 경로가 드러난다). */
const b = (globalThis.BOOK !== undefined) ? globalThis.BOOK : (DECK.book || null);
if (!b || !fs.existsSync(b.pdf)) {
  fs.writeFileSync(out, 'const BOOKTEXT = null;\n');
  console.log('책 원문: 없음 — 대조를 건너뛴다' + (b ? ' (' + b.pdf + ')' : ''));
  process.exit(0);
}
let txt;
try {
  txt = execFileSync('pdftotext', ['-f', String(b.from), '-l', String(b.to), b.pdf, '-'],
                     { encoding: 'utf8', maxBuffer: 32 << 20 });
} catch (e) {
  fs.writeFileSync(out, 'const BOOKTEXT = null;\n');
  console.log('책 원문: pdftotext 실행 실패 — 대조를 건너뛴다');
  process.exit(0);
}
/* 줄바꿈·따옴표 차이로 대조가 깨지지 않게 평탄화해 둔다 */
/* verify.js 의 정규화와 같은 규칙 — 공백·따옴표·하이픈을 없앤다.
   PDF 추출이 줄 끝 하이픈을 삼켜 "key-value" 를 "keyvalue" 로 만든다. */
const flat = txt.replace(/\s+/g, ' ')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[-‐‑‒–—―]/g, '').toLowerCase();
fs.writeFileSync(out, 'const BOOKTEXT = ' + JSON.stringify(flat) + ';\n');
console.log('책 원문: ' + b.from + '~' + b.to + '쪽 · ' + (flat.length / 1024).toFixed(1) + ' KB 평탄화');
