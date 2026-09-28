/* delta.js 검증 — 전체 덱의 모든 스텝(손잡이 값별 변형 포함)에 돌려 본다.
   보는 것 : 던지지 않는가 · ops 가 있는데 한 줄도 안 나오는 스텝이 있는가 ·
   "undefined" "[object Object]" 같은 글이 새어 나오는가. */
import path from 'path';
import { pathToFileURL } from 'url';
import { bake, stepsOf, valuesOf } from '../src/bake.js';
import { delta, looks } from '../src/delta.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DECKS = ['mysql/innodb', 'mysql/locks', 'postgres/mvcc', 'postgres/heap', 'postgres/locks',
  'postgres/wal', 'aurora/mysql', 'book/ch2', 'book/ch3'];
let steps = 0, withOps = 0, empty = [], leak = [], lines = 0, lookOnly = 0;
for (const deck of DECKS) {
  const u = (f) => pathToFileURL(path.join(ROOT, 'data', deck, f)).href;
  const { SCENES } = await import(u('scenes.js'));
  const { ACTORS } = await import(u('actors.js'));
  /* valuesOf 는 손잡이 없는 장면에 [] 를 돌려준다 — 처음엔 그것으로 돌아서 손잡이 있는
     장면만 검사하고 "207 스텝 전부 통과" 라고 했다. 없으면 기본 하나로 돈다. */
  for (const sc of SCENES) for (const v of (sc.vary ? valuesOf(sc) : [null])) {
    const fr = bake(sc, v), st = stepsOf(sc, v);
    fr.forEach((_, i) => {
      steps++;
      const rows = delta(sc, fr, i, ACTORS);
      const n = rows.reduce((a, r) => a + r.lines.length, 0);
      lines += n;
      const ops = st[i].ops && Object.values(st[i].ops).some((o) => o && Object.keys(o).some((k) => k !== 'gg'));
      if (ops) { withOps++; if (!n) empty.push(`${deck}/${sc.num}/${i + 1}${v != null ? '/v' + v : ''}`); }
      else if (looks(st[i], ACTORS).length) lookOnly++;
      for (const r of rows) for (const l of r.lines)
        if (/undefined|\[object Object\]|NaN/.test(l.t)) leak.push(`${deck}/${sc.num}/${i + 1} ${r.nm}: ${l.t}`);
    });
  }
}
console.log(`스텝 ${steps} · ops 있는 스텝 ${withOps} · 보기만 ${lookOnly} · 변경 줄 ${lines}`);
if (empty.length) console.log(`  ! ops 가 있는데 줄이 없다 ${empty.length}건\n    ` + empty.slice(0, 12).join('\n    '));
if (leak.length) console.log(`  ! 글이 새어 나온다 ${leak.length}건\n    ` + leak.slice(0, 8).join('\n    '));
const bad = empty.length + leak.length;
console.log(bad ? `── 문제 ${bad}건` : '── 전부 통과');
process.exit(bad ? 1 : 0);
