/* PG 세계들이 함께 쓰는 이름표 줄 나누기 — pg-mvcc 에서 옮겼다(pg-heap 도 쓴다). */
/* 이름표 줄 나누기 — 겹치면 다음 줄로. 줄을 내린 이름표는 선(pins)으로 제자리에 잇는데, 그 선이 다른 이름표를
   지나지 않게 한다. 그렇게 둘 곳이 없으면 겹침만 피한다(ok = false) */
const TRY = [0, 1, 2].map((r) => [r, 'c']).concat([0, 1, 2].flatMap((r) => [[r, 'L'], [r, 'R']]), [3, 4, 5].flatMap((r) => [[r, 'c'], [r, 'L'], [r, 'R']]));
export function stagger(items, x0, x1, gap = 8) {
  const out = [];
  let ok = true;
  for (const it of [...items].sort((p, q) => p.cx - q.cx)) {
    const pins = it.pins || [it.cx];
    const cand = (row, al) => {
      const l0 = al === 'c' ? it.cx - it.w / 2 : al === 'L' ? Math.min(...pins) + 3 - it.w : Math.max(...pins) - 3;
      const l = Math.max(x0, Math.min(x1 - it.w, l0));
      return { l, r: l + it.w, row };
    };
    const clash = (c, strict) => out.some((q) => (q.row === c.row && c.l < q.r + gap && q.l < c.r + gap)
      || (strict && ((q.row < c.row && pins.some((x) => x > q.l - 2 && x < q.r + 2)) || (q.row > c.row && q.pins.some((x) => x > c.l - 2 && x < c.r + 2)))));
    /* 가운데 정렬을 먼저(두 줄까지) — 옆으로 민 이름표는 이웃 칸의 이름처럼 읽힌다 */
    let pick = null;
    for (const strict of [true, false]) {
      for (const [row, al] of TRY) { const c = cand(row, al); if (!clash(c, strict)) { pick = c; break; } }
      if (pick) { if (!strict) ok = false; break; }
    }
    out.push({ ...it, ...(pick || cand(0, 'c')), pins });
  }
  return { out, ok, rows: out.length ? Math.max(...out.map((q) => q.row)) + 1 : 0 };
}
