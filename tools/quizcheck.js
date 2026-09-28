/* 문항 검증 — 생성기가 만든 문제가 풀 수 있는 문제인지 본다.
   이 프로젝트의 다른 검사와 같은 규율이다 : 사람이 눈으로 훑지 않고 기계가 판정한다.

   보는 것
     · 정답이 선택지 안에 정확히 한 번 있는가 (없거나 두 번이면 풀 수 없다)
     · 선택지가 서로 다른가 (같은 글이 둘 있으면 정답이 둘이 된다)
     · 같은 id 가 두 번 나오지 않는가 (복습 상태가 어긋난다)
     · 순서 문항의 정답이 선택지의 순열인가
     · 문항이 가리키는 주소가 실재하는 장면·스텝인가 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildQuiz, dedupe, WATCH_ALL, WATCH_GROUPS } from '../src/play/quiz.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DECKS = process.argv[2] ? [process.argv[2]]
  : ['mysql/innodb', 'mysql/locks', 'postgres/mvcc', 'postgres/heap', 'postgres/locks',
     'postgres/wal', 'aurora/mysql', 'book/ch2', 'book/ch3'];

let bad = 0, total = 0;
const byKind = {};
const posCount = {};          /* 선택지 수 → 정답 위치별 개수 */
const ids = new Set();
let coreBeat = 0, coreDone = 0, coreSkip = 0, coreLongest = 0, coreN = 0;

for (const deck of DECKS) {
  const { SCENES } = await import(pathToFileURL(path.join(ROOT, 'data', deck, 'scenes.js')).href);
  const qf = path.join(ROOT, 'data', deck, 'quiz.js');
  const { CORE, SKIP } = fs.existsSync(qf) ? await import(pathToFileURL(qf).href) : {};
  const scByNum = new Map(SCENES.map((s) => [s.num, s]));
  const qs = buildQuiz(deck, SCENES, CORE);
  const beats = SCENES.reduce((a, sc) => a + (sc.steps || []).filter((s) => s.beat).length, 0);
  coreBeat += beats; coreDone += Object.keys(CORE || {}).length; coreSkip += Object.keys(SKIP || {}).length;
  for (const k of Object.keys(SKIP || {})) if (CORE && CORE[k]) { bad++; console.log(`  ! ${deck} ${k} 가 CORE 와 SKIP 에 둘 다 있다`); }
  /* beat 스텝은 전부 문항이 되거나, 뺀 이유가 적혀 있어야 한다 — 새 장면을 더하고
     문항을 잊으면 여기서 걸린다. 뺀 것도 실재하는 beat 여야 한다. */
  for (const sc of SCENES) (sc.steps || []).forEach((st, i) => {
    const k = `${sc.num}/${i + 1}`;
    if (st.beat && !(CORE && CORE[k]) && !(SKIP && SKIP[k])) { bad++; console.log(`  ! ${deck} ${k} beat 인데 핵심 문항도 뺀 이유도 없다`); }
    if (!st.beat && SKIP && SKIP[k]) { bad++; console.log(`  ! ${deck} ${k} beat 가 아닌데 SKIP 에 있다`); }
  });
  for (const k of Object.keys(SKIP || {})) {
    const [n, j] = k.split('/'); const sc = scByNum.get(n);
    if (!sc || !(sc.steps || [])[+j - 1]) { bad++; console.log(`  ! ${deck} SKIP ${k} 가 없는 스텝이다`); }
  }
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

    /* 지표 문항의 오답이 정답일 수도 있는가 — 같은 장면의 지표, 무엇이든 보는 도구,
       같은 것을 보는 다른 창. 처음엔 187문항 중 94개가 여기에 걸렸다. */
    if (q.kind === 'watch') {
      const mine = new Set((scByNum.get(q.scene).watch || []).map((w) => w[0]));
      for (const o of q.opts) if (o !== q.answer) {
        if (mine.has(o)) err(q, `오답 "${o}" 을 같은 장면도 지표로 쓴다`);
        if (WATCH_ALL.has(o)) err(q, `오답 "${o}" 은 무엇이든 보여 주는 도구다`);
        if (WATCH_GROUPS.some((g) => g.includes(o) && g.includes(q.answer))) err(q, `오답 "${o}" 은 정답과 같은 것을 본다`);
      }
    }

    /* 핵심 문항은 오답을 사람이 쓴다 — 사람이 쓴 오답은 정답보다 짧고 뭉뚱그려지기
       쉽다. 정답만 유난히 길거나 짧으면 읽지 않고도 고를 수 있다. */
    if (q.kind === 'core') {
      coreN++;
      if (!q._beat) err(q, 'beat 스텝이 아닌 곳을 가리킨다');
      if (q._x.length !== 3) err(q, `오답이 ${q._x.length}개다 (3이어야 한다)`);
      const la = [...q.answer].length, lx = q._x.map((x) => [...x].length);
      if (la > Math.max(...lx) * 1.4) err(q, `정답만 길다 : ${la} vs 오답 최대 ${Math.max(...lx)}`);
      if (la < Math.min(...lx) * 0.6) err(q, `정답만 짧다 : ${la} vs 오답 최소 ${Math.min(...lx)}`);
      if (la > Math.max(...lx)) coreLongest++;
      if (!q.why) err(q, '해설(스텝의 key)이 없다');
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
/* 같은 문제가 두 번 나오는가 — 덱 안에서는 생성기가 막아야 하고(오류), 덱 사이는
   Play 가 dedupe 로 거른다(개수만 보고한다). 비교 장면이 links 를 물려받아 같은 문제가
   두 번 나오는 것을 처음엔 id 가 달라서 놓쳤다. */
{
  const pool = [], per = new Map();
  for (const deck of DECKS) {
    const { SCENES } = await import(pathToFileURL(path.join(ROOT, 'data', deck, 'scenes.js')).href);
    const qf = path.join(ROOT, 'data', deck, 'quiz.js');
    const { CORE } = fs.existsSync(qf) ? await import(pathToFileURL(qf).href) : {};
    const qs = buildQuiz(deck, SCENES, CORE);
    const d = qs.length - dedupe(qs).length;
    if (d) { bad++; console.log(`  ! ${deck} 안에서 같은 문제가 ${d}개 겹친다`); }
    pool.push(...qs);
  }
  const kept = dedupe(pool).length;
  console.log(`── 덱 사이 중복 ${pool.length - kept} 거름 → 판에 나오는 문항 ${kept}`);
}

/* 규칙에 적은 지표 이름이 실제로 있는가 — 한 글자만 틀려도 규칙이 조용히 헛돈다 */
{
  const seen = new Set();
  for (const deck of DECKS) {
    const { SCENES } = await import(pathToFileURL(path.join(ROOT, 'data', deck, 'scenes.js')).href);
    for (const sc of SCENES) for (const [w] of (sc.watch || [])) seen.add(w);
  }
  for (const n of [...WATCH_ALL, ...WATCH_GROUPS.flat()])
    if (!seen.has(n)) { bad++; console.log(`  ! 지표 규칙의 "${n}" 이 어느 장면에도 없다`); }
}

/* 정답이 가장 긴 선택지인 비율 — 넷 중 하나이니 25% 근처여야 한다. 40% 를 넘으면
   "제일 긴 것" 이 전략이 된다. */
if (coreN >= 20) {
  const r = coreLongest / coreN;
  if (r > 0.4) { bad++; console.log(`  ! 핵심 문항 정답이 가장 긴 선택지인 비율 ${(r * 100).toFixed(0)}% (≤40%)`); }
  console.log(`── 핵심 : 정답이 가장 긴 것 ${(r * 100).toFixed(0)}%`);
}
console.log(`── 핵심 문항 ${coreDone} · 뺀 것 ${coreSkip} / beat 스텝 ${coreBeat}`);
console.log('── 종류별 :', Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(bad ? `── 문제 ${bad}건 / 문항 ${total}` : `── 문항 ${total} 전부 통과`);
process.exit(bad ? 1 : 0);
