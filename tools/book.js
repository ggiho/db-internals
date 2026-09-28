/* 책 원문을 인용 대조용 말뭉치로 뽑는다 — tools/paper.js 의 책판이다.
   덱이 인용한 영어 구절이 그 장 원문에 실제로 있는지 verify.js 가 대조한다.
   PDF 는 저장소 밖에 두고(재배포가 되므로) 위치와 쪽 범위는 booksrc.js 에 적는다 —
   deck.js 에 두면 로컬 절대 경로가 번들에 실린다.

     node tools/book.js book/ch2

   booksrc.js :  export const BOOK = { pdf: '/…/x.pdf', from: 41, to: 61 };

   package.json 이 "type": "module" 이 된 뒤로 이 파일은 require 를 쓰다 실행되지
   않았다. 지금 있는 booktext.js 는 그 전에 만든 것이다. */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = process.argv[2];
if (!arg) { console.error('사용법: node tools/book.js <묶음>/<덱>'); process.exit(2); }
/* 예전 사용법(node tools/book.js data/book/ch2)도 받는다 */
const deck = arg.replace(/^(\.\/)?data\//, '').replace(/\/$/, '');
const dir = path.join(ROOT, 'data', deck);
const out = path.join(dir, 'booktext.js');
const src = path.join(dir, 'booksrc.js');

/* 원문을 만들 수 없으면 있던 파일을 건드리지 않는다. 예전엔 null 로 덮어써서, PDF 가
   없는 곳에서 한 번 돌리기만 해도 있던 원문이 사라졌다. 파일이 없으면 verify 는
   대조를 건너뛰고 그렇다고 알린다 — 빈 파일을 만들어 둘 이유가 없다. */
const skip = (why) => { console.log('책 원문: 만들지 않는다 — ' + why); process.exit(0); };
if (!fs.existsSync(src)) skip('booksrc.js 가 없다');
const { BOOK } = await import('file://' + src);
if (!BOOK || !fs.existsSync(BOOK.pdf)) skip('PDF 가 없다' + (BOOK ? ' (' + BOOK.pdf + ')' : ''));

let txt;
try {
  txt = execFileSync('pdftotext', ['-f', String(BOOK.from), '-l', String(BOOK.to), BOOK.pdf, '-'],
                     { encoding: 'utf8', maxBuffer: 32 << 20 });
} catch { skip('pdftotext 실행 실패'); }

/* verify.js 의 정규화와 같은 규칙 — 공백·따옴표·하이픈을 없앤다.
   PDF 추출이 줄 끝 하이픈을 삼켜 "key-value" 를 "keyvalue" 로 만든다. */
const flat = txt.replace(/\s+/g, ' ')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[-‐‑‒–—―]/g, '').toLowerCase();
fs.writeFileSync(out, 'const BOOKTEXT = ' + JSON.stringify(flat) + ';\n\nexport { BOOKTEXT };\n');
console.log('책 원문: ' + BOOK.from + '~' + BOOK.to + '쪽 · ' + (flat.length / 1024).toFixed(1) + ' KB 평탄화');
