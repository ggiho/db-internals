/* 논문 원문을 인용 대조용 말뭉치로 뽑는다 — tools/book.js 의 논문판이다.
   aurora 덱은 AWS 문서 문장(booktext.js)만으로는 quorum 수치를 적을 수 없었다. 그 값은
   SIGMOD 2017 논문에 있다. PDF 는 저장소 밖에 두고(재배포가 되므로) 위치는 papersrc.js 에
   적는다 — deck.js 에 두면 로컬 경로가 번들에 실린다. 없으면 조용히 건너뛴다.

     node tools/paper.js aurora/mysql

   papersrc.js :  export const PAPERS = [{ pdf: '/…/x.pdf', sha256: '…' }];
   sha256 을 적는 이유 — 같은 제목의 다른 판(프리프린트·ACM 판)은 문장이 조금씩 다르다.
   대조한 판이 무엇인지 고정해 두지 않으면 통과가 무엇을 뜻하는지 흐려진다. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const deck = process.argv[2];
if (!deck) { console.error('사용법: node tools/paper.js <묶음>/<덱>'); process.exit(2); }
const dir = path.join(ROOT, 'data', deck);
const out = path.join(dir, 'papertext.js');
const src = path.join(dir, 'papersrc.js');

const none = (why) => {
  fs.writeFileSync(out, 'const PAPERTEXT = null;\n\nexport { PAPERTEXT };\n');
  console.log('논문 원문: 없음 — ' + why);
  process.exit(0);
};
if (!fs.existsSync(src)) none('papersrc.js 가 없다');
const { PAPERS } = await import('file://' + src);

const parts = [];
for (const p of PAPERS) {
  if (!fs.existsSync(p.pdf)) none('PDF 가 없다 (' + p.pdf + ')');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(p.pdf)).digest('hex');
  if (p.sha256 && sha !== p.sha256) {
    console.error('논문 원문: sha256 이 다르다 — 다른 판이다\n  기대 ' + p.sha256 + '\n  실제 ' + sha);
    process.exit(1);
  }
  let txt;
  try { txt = execFileSync('pdftotext', [p.pdf, '-'], { encoding: 'utf8', maxBuffer: 32 << 20 }); }
  catch { none('pdftotext 실행 실패'); }
  parts.push(txt);
  console.log('논문 원문: ' + path.basename(p.pdf) + ' · ' + (txt.length / 1024).toFixed(1) + ' KB');
}
/* 평탄화는 verify.js 의 정규화에 맡긴다 — 여기서 줄이면 두 규칙이 어긋날 때 원인을 찾기
   어렵다. 줄바꿈만 공백으로 바꾼다. */
fs.writeFileSync(out, 'const PAPERTEXT = ' + JSON.stringify(parts.join('\n\n').replace(/\s+/g, ' ')) +
  ';\n\nexport { PAPERTEXT };\n');
