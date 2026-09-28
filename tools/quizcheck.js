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
const posCount = {};          /* 선택지 수 → 정답 위치별 개수 */
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
      const L = q.opts.length;
      (posCount[L] ||= Array(L).fill(0))[q.opts.indexOf(q.answer)]++;
      const n = q.opts.filter((o) => o === q.answer).length;
      if (n !== 1) err(q, `정답이 선택지에 ${n}번 있다 (1이어야 한다)`);
      const uniq = new Set(q.opts.map((o) => String(o).replace(/\s+/g, ' ').trim()));
      if (uniq.size !== q.opts.length) err(q, '선택지에 같은 글이 둘 있다');
      /* 정답이 질문에 그대로 들어 있으면 풀 필요가 없는 문제다. 손잡이 문항이 처음에
         "knob 를 v 로 두면?" 에 정답 v 를 묻고 있었고, 위 검사들은 그것을 통과시켰다. */
      /* 대소문자를 가리지 않는다 — REDUNDANT 가 redundant 를 말하는 것을 처음엔 놓쳤다 */
      const qa = String(q.answer).trim().toLowerCase();
      if (qa.length >= 2 && (q.q + ' ' + (q.stem || '')).toLowerCase().includes(qa))
        err(q, `정답이 질문에 그대로 들어 있다 : "${qa.slice(0, 30)}"`);
    }

    /* 주소가 실재하는가 — #덱/장면/스텝. 관계 문항은 이어지는 장면(at2)도 본다. */
    for (const addr of [q.at, q.at2].filter(Boolean)) {
      const m = /^(.+)\/([^/]+)\/(\d+)(\/v.+)?$/.exec(addr);
      if (!m) { err(q, `주소 형식이 이상하다 : ${addr}`); continue; }
      const sc = scByNum.get(m[2]);
      if (!sc) err(q, `없는 장면을 가리킨다 : ${m[2]}`);
      else if (+m[3] > (sc.steps || []).length) err(q, `없는 스텝을 가리킨다 : ${m[2]}/${m[3]}`);
    }
  }
  console.log(`${deck.padEnd(16)} 문항 ${String(qs.length).padStart(4)}`);
}

/* 정답 위치가 고른가 — 섞기가 치우치면 "항상 1번" 으로 점수를 딸 수 있다.
   처음 만든 섞기가 4지선다 정답을 첫 칸에 36% 몰았는데 위의 검사들은 전부 통과했다.
   문항 하나하나는 옳고, 치우침은 모아 봐야 보이기 때문이다. 기대값 대비 ±20% 를 넘으면 문제로 센다. */
for (const [n, cnt] of Object.entries(posCount)) {
  const tot = cnt.reduce((a, b) => a + b, 0);
  if (tot < 40) continue;                        /* 표본이 작으면 판정하지 않는다 */
  const exp = tot / +n;
  cnt.forEach((c, i) => {
    if (Math.abs(c - exp) > exp * 0.2) { bad++; console.log(`  ! ${n}지선다 정답이 ${i + 1}번에 ${c}개 — 기대 ${exp.toFixed(0)} (±20%)`); }
  });
  console.log(`── ${n}지선다 정답 위치 : ${cnt.join(' / ')}  (기대 ${exp.toFixed(0)})`);
}
console.log('── 종류별 :', Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(bad ? `── 문제 ${bad}건 / 문항 ${total}` : `── 문항 ${total} 전부 통과`);
process.exit(bad ? 1 : 0);
