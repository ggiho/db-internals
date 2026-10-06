/* "이 스텝이 바꾼 것" — 배우별 전→후. 새로 쓰지 않고 bake 가 이미 만든 변경 기록(chg)과
   직전 상태를 비교해서 만든다. 그래야 무대와 어긋날 수 없다 : 무대가 그리는 것과
   같은 프레임에서 나온다.

   순수 함수다. tools/deltacheck.js 가 전체 덱의 모든 스텝에 돌려 본다. */

/* 값의 색 표시(ACTIVE|gold)는 무대용이다 — 글로 옮길 때는 뗀다 */
const val = (v) => (v === undefined || v === null || v === '' ? '—'
  : String(typeof v === 'object' ? (v.sub ?? v.id ?? JSON.stringify(v)) : v).replace(/\|[a-z]+$/, ''));
const itemText = (it) => (it ? it.id + (it.sub ? '  ·  ' + val(it.sub) : '') : '');
/* "(비었다)" 같은 항목은 빈 자리를 그리려는 표시다 — 그것이 지워지는 것은 변경이 아니다 */
const placeholder = (it) => !!it && /^\(.*\)$/.test(String(it.id));

export function delta(scene, frames, i, ACTORS) {
  const now = frames[i];
  if (!now) return [];
  const before = i > 0 ? frames[i - 1].st : scene.init || {};
  const rows = [];
  for (const [who, c] of Object.entries(now.chg || {})) {
    const a = now.st[who] || {}, b = before[who] || {};
    const lines = [];
    /* kv 의 바뀐 키 — 같은 값으로 set 하면 bake 가 keys 에 넣지 않는다.
       글자는 같고 색(|gold 등)만 바뀐 칸은 "X → X" 로 쓰면 바뀐 것이 없어 보인다 — book/ch3 06b 가
       짚는 칸을 색으로 바꾸자 그런 줄이 스텝마다 생겼다. 색이 켜진 칸은 '강조' 로 적고, 꺼진 칸은 뺀다. */
    if (a.kv) for (const k of c.keys || []) {
      const was = b.kv && b.kv[k], is = a.kv[k];
      if (val(was) !== val(is)) lines.push({ s: '~', t: `${k}  ${val(was)} → ${val(is)}` });
      else if (/\|[a-z]+$/.test(String(is))) lines.push({ s: '~', t: `${k}  ${val(is)}  · 강조` });
    }
    if (a.mx && (c.keys || []).some((k) => k === 'on' || k === 'dim')) {
      lines.push({ s: '~', t: `강조한 칸 ${(a.mx.on || []).length}개` + ((a.mx.dim || []).length ? ` · 흐린 칸 ${a.mx.dim.length}개` : '') });
    }
    for (const it of c.del || []) if (!placeholder(it)) lines.push({ s: '−', t: itemText(it) });
    for (const id of c.add || []) {
      const it = (a.items || []).find((x) => x.id === id);
      if (!placeholder(it)) lines.push({ s: '+', t: itemText(it) || id });
    }
    for (const id of new Set(c.mod || [])) {
      const x = (a.items || []).find((y) => y.id === id), y = (b.items || []).find((z) => z.id === id);
      /* 같은 값을 다시 적은 것은 bake 가 mod 로 세지만 바뀐 게 없다 — 거른다 */
      if (x && y && JSON.stringify(x) === JSON.stringify(y)
        && (a.items || []).indexOf(x) === (b.items || []).findIndex((z) => z.id === id)) continue;
      const bt = y ? val(y.sub) : '—', at = x ? val(x.sub) : '—';
      if (bt !== at) lines.push({ s: '~', t: `${id}  ${bt} → ${at}` });
      else if (x && y && x.tag !== y.tag) lines.push({ s: '~', t: `${id}  ${y.tag || '—'} → ${x.tag || '—'}` });
      else lines.push({ s: '~', t: `${id}  자리 이동` });
    }
    for (const [coll, bag] of [['span', 'spans'], ['edge', 'edges']]) {
      const d = c[coll];
      if (!d) continue;
      const lb = (arr, id) => { const x = (arr || []).find((y) => y.id === id);
        return x ? (coll === 'edge' ? `${x.from} → ${x.to}${x.lb ? '  ' + x.lb : ''}` : (x.lb || id)) : id; };
      for (const id of d.del) lines.push({ s: '−', t: lb(b[bag], id) });
      for (const id of d.add) lines.push({ s: '+', t: lb(a[bag], id) });
      for (const id of d.mod) lines.push({ s: '~', t: lb(a[bag], id) });
    }
    if (lines.length) rows.push({ who, nm: (ACTORS[who] && ACTORS[who].nm) || who, lines });
  }
  return rows;
}

/* 보기만 하는 스텝 — 무엇을 보라는지 배우 이름으로 */
export function looks(step, ACTORS) {
  return Object.keys((step && step.look) || {}).map((w) => (ACTORS[w] && ACTORS[w].nm) || w);
}
