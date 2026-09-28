/* 복습 상태(progress.js) 검증 — 가짜 저장소로 node 에서 돈다. 던지는 저장소도 넣는다 :
   사생활 모드에서 localStorage 접근은 예외를 던지고, 그래도 게임은 돌아야 한다. */
import { load, save, record, pickRound, mastery } from '../src/play/progress.js';
const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('  ✗', m); } else console.log('  ✓', m); };

const pool = [];
for (const k of ['link', 'watch', 'fact', 'order', 'vary']) for (let i = 0; i < 6; i++) pool.push({ id: `${k}:${i}`, kind: k });

let st = load(mem);
ok(st.rounds === 0 && Object.keys(st.box).length === 0, '빈 저장소에서 빈 상태');
ok(JSON.stringify(load(broken)) === JSON.stringify({ box: {}, seen: {}, rounds: 0 }), '저장소가 던져도 빈 상태로 돈다');
save(st, broken); ok(true, '저장소가 던져도 save 가 죽지 않는다');

const r1 = pickRound(pool, st, 10);
ok(r1.length === 10 && new Set(r1).size === 10, '한 판 10문항 · 중복 없음');
const kinds = new Set(r1.map((id) => id.split(':')[0]));
ok(kinds.size === 5, `다섯 종류가 섞인다 (${kinds.size})`);
ok(JSON.stringify(r1) === JSON.stringify(pickRound(pool, st, 10)), '같은 상태면 같은 판 — 결정적');

st = record(st, r1[0], false);
st = record(st, r1[1], true);
ok(st.box[r1[0]] === 0 && st.seen[r1[0]] === 1, '틀리면 상자 0 · 본 횟수 1');
ok(st.box[r1[1]] === 1, '맞히면 상자 1');
st = { ...st, rounds: 1 };
const r2 = pickRound(pool, st, 10);
ok(r2[0] === r1[0], '틀린 것이 다음 판 맨 앞에 온다');
ok(!r2.includes(r1[1]) || r2.indexOf(r1[1]) > r2.indexOf(r1[0]), '맞힌 것은 뒤로 밀린다');
ok(JSON.stringify(r2) !== JSON.stringify(r1), '판 번호가 바뀌면 순서가 바뀐다');

for (let i = 0; i < 9; i++) st = record(st, 'link:5', true);
ok(st.box['link:5'] === 5, '상자는 5 에서 멈춘다');
const m = mastery(st, pool.map((q) => q.id));
ok(m.known === 1 && m.seen === 3, `익힘 집계 (seen ${m.seen} · known ${m.known})`);

save(st, mem); ok(JSON.stringify(load(mem)) === JSON.stringify(st), '저장 후 읽으면 같다');
console.log(fail ? `실패 ${fail}` : '전부 통과'); process.exit(fail ? 1 : 0);
