/* 문항 검증 — 생성기가 만든 문제가 풀 수 있는 문제인지 본다.
   이 프로젝트의 다른 검사와 같은 규율이다 : 사람이 눈으로 훑지 않고 기계가 판정한다.

   보는 것
     · 정답이 선택지 안에 정확히 한 번 있는가 (없거나 두 번이면 풀 수 없다)
     · 선택지가 서로 다른가 (같은 글이 둘 있으면 정답이 둘이 된다)
     · 같은 id 가 두 번 나오지 않는가 (복습 상태가 어긋난다)
     · 순서 문항의 정답이 선택지의 순열인가
     · 문항이 가리키는 주소가 실재하는 장면·스텝인가 */
import path from 'path';
import { pathToFileURL } from 'url';
import { buildQuiz } from '../src/play/quiz.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DECKS = process.argv[2] ? [process.argv[2]]
  : ['mysql/innodb', 'mysql/locks', 'postgres/mvcc', 'postgres/heap', 'postgres/locks',
     'postgres/wal', 'aurora/mysql', 'book/ch2', 'book/ch3'];

let bad = 0, total = 0;
const byKind = {};
const ids = new Set();

for (const deck of DECKS) {
  const { SCENES } = await import(pathToFileURL(path.join(ROOT, 'data', deck, 'scenes.js')).href);
  const scByNum = new Map(SCENES.map((s) => [s.num, s]));
  const qs = buildQuiz(deck, SCENES);
  const err = (q, m) => { bad++; console.log(`  ! ${q.kind} ${q.id}\n      ${m}`); };

  for (const q of qs) {
    total++;
    byKind[q.kind] = (byKind[q.kind] || 0) + 1;

    if (ids.has(q.id)) err(q, 'id 가 중복된다 — 복습 상태가 어긋난다');
    ids.add(q.id);

    if (!q.opts || q.opts.length < 2) { err(q, '선택지가 2개 미만이다'); continue; }

    if (q.kind === 'order') {
      const a = [...q.answer].sort(), b = [...q.opts].sort();
      if (a.length !== b.length || a.some((x, i) => x !== b[i]))
        err(q, '정답이 선택지의 순열이 아니다');
      if (JSON.stringify(q.answer) === JSON.stringify(q.opts))
        err(q, '섞이지 않았다 — 이미 정답 순서다');
    } else {
      const n = q.opts.filter((o) => o === q.answer).length;
      if (n !== 1) err(q, `정답이 선택지에 ${n}번 있다 (1이어야 한다)`);
      const uniq = new Set(q.opts.map((o) => String(o).replace(/\s+/g, ' ').trim()));
      if (uniq.size !== q.opts.length) err(q, '선택지에 같은 글이 둘 있다');
    }

    /* 주소가 실재하는가 — #덱/장면/스텝 */
    const m = /^(.+)\/([^/]+)\/(\d+)(\/v.+)?$/.exec(q.at);
    if (!m) err(q, `주소 형식이 이상하다 : ${q.at}`);
    else {
      const sc = scByNum.get(m[2]);
      if (!sc) err(q, `없는 장면을 가리킨다 : ${m[2]}`);
      else if (+m[3] > (sc.steps || []).length) err(q, `없는 스텝을 가리킨다 : ${m[2]}/${m[3]}`);
    }
  }
  console.log(`${deck.padEnd(16)} 문항 ${String(qs.length).padStart(4)}`);
}

console.log('── 종류별 :', Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(bad ? `── 문제 ${bad}건 / 문항 ${total}` : `── 문항 ${total} 전부 통과`);
process.exit(bad ? 1 : 0);
