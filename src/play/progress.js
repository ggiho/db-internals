/* 복습 상태 — 라이트너 상자. 맞히면 한 칸 올라가고, 틀리면 0 으로 떨어진다.
   낮은 상자일수록 자주 나온다. 그래서 틀린 것은 다음 판에 다시 나오고, 여러 번 맞힌
   것은 뜸해진다. 상태는 이 브라우저에만 있다(localStorage) — 서버가 없다.

   순수 함수로 둔다. 저장소(store)를 인자로 받으므로 node 에서 가짜 저장소로 검증한다. */
import { hash } from './quiz.js';

const KEY = 'dbi.play.v1';
const TOP = 5;                     /* 상자는 0 ‥ 5 */
const empty = () => ({ box: {}, seen: {}, rounds: 0 });

export function load(store = globalThis.localStorage) {
  /* 사생활 모드·차단된 저장소에서는 접근 자체가 던진다 — 상태 없이도 게임은 돈다 */
  try { return { ...empty(), ...JSON.parse(store.getItem(KEY) || '{}') }; }
  catch { return empty(); }
}
export function save(st, store = globalThis.localStorage) {
  try { store.setItem(KEY, JSON.stringify(st)); } catch { /* 저장 못 해도 이번 판은 된다 */ }
}

/* 한 문항의 결과를 반영한다 — 새 객체를 돌려준다 */
export function record(st, id, ok) {
  const b = st.box[id] || 0;
  return { ...st,
    box: { ...st.box, [id]: ok ? Math.min(b + 1, TOP) : 0 },
    seen: { ...st.seen, [id]: (st.seen[id] || 0) + 1 } };
}

/* 우선순위 — 틀린 것(본 적 있고 상자 0) · 처음 보는 것 · 상자 1 · 상자 2 … 순.
   틀린 것을 처음 보는 것보다 앞에 둔다 : 새 것을 쌓기 전에 구멍을 메운다. */
function rank(st, id) {
  if (!st.seen[id]) return 1;
  const b = st.box[id] || 0;
  return b === 0 ? 0 : 1 + b;
}

/* 한 판의 문항을 고른다. 같은 우선순위 안에서는 판 번호로 섞어 매번 다르게 한다.
   종류를 돌아가며 뽑는다 — 우선순위 순서 그대로면 한 종류가 판을 채운다
   (link 가 208개로 가장 많다). */
export function pickRound(pool, st, n = 10) {
  const order = pool.slice().sort((a, b) =>
    rank(st, a.id) - rank(st, b.id) ||
    hash(a.id + ':' + st.rounds) - hash(b.id + ':' + st.rounds));
  const byKind = new Map();
  for (const q of order) {
    if (!byKind.has(q.kind)) byKind.set(q.kind, []);
    byKind.get(q.kind).push(q);
  }
  const lanes = [...byKind.values()];
  const out = [];
  for (let i = 0; out.length < n && lanes.some((l) => l.length); i++) {
    const lane = lanes[i % lanes.length];
    if (lane.length) out.push(lane.shift());
  }
  return out.map((q) => q.id);
}

/* 얼마나 익혔나 — 상자 3 이상이면 익힌 것으로 센다 */
export function mastery(st, ids) {
  let seen = 0, known = 0;
  for (const id of ids) {
    if (st.seen[id]) seen++;
    if ((st.box[id] || 0) >= 3) known++;
  }
  return { seen, known, total: ids.length };
}
