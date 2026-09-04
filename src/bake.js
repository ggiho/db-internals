/* 연산을 재생해 스텝별 상태를 만든다 — 기존 엔진의 bake 와 같은 규칙이다.
   렌더러가 React 로 바뀌어도 이 규칙은 데이터의 일부이므로 그대로 옮긴다. */
const clone = (x) => structuredClone(x);

export function bake(scene) {
  const frames = [];
  let st = clone(scene.init);
  for (const step of scene.steps) {
    const chg = {};
    for (const [who, op] of Object.entries(step.ops || {})) {
      const a = st[who] || (st[who] = {});
      const c = (chg[who] = { keys: [], add: [], del: [], mod: [] });

      if (op.set && a.kv) for (const [k, v] of Object.entries(op.set)) {
        if (a.kv[k] !== v) c.keys.push(k);
        a.kv[k] = v;
      }
      if (op.gg) a.gg = { ...a.gg, ...op.gg };
      if (a.mx) {
        if (op.on) { a.mx.on = [...op.on]; c.keys.push('on'); }
        if (op.dim) { a.mx.dim = [...op.dim]; c.keys.push('dim'); }
        if (op.clear) { a.mx.on = []; a.mx.dim = []; c.keys.push('on'); }
      }
      if (a.items) {
        if (op.del) for (const id of op.del) {
          const i = a.items.findIndex((x) => x.id === id);
          if (i >= 0) { c.del.push(clone(a.items[i])); a.items.splice(i, 1); }
        }
        if (op.set) for (const [id, patch] of Object.entries(op.set)) {
          const it = a.items.find((x) => x.id === id);
          if (it) { Object.assign(it, patch); c.mod.push(id); }
        }
        if (op.add) for (const it of op.add) { a.items.push(clone(it)); c.add.push(it.id); }
        if (op.move) for (const [id, to] of op.move) {
          const i = a.items.findIndex((x) => x.id === id);
          if (i >= 0) { const [it] = a.items.splice(i, 1); a.items.splice(to, 0, it); c.mod.push(id); }
        }
      }
      for (const [coll, bag] of [['span', 'spans'], ['edge', 'edges']]) {
        if (!op[coll]) continue;
        const o = op[coll];
        a[bag] = a[bag] || [];
        c[coll] = { add: [], del: [], mod: [] };
        if (o.del) for (const id of o.del) {
          const i = a[bag].findIndex((x) => x.id === id);
          if (i >= 0) { c[coll].del.push(id); a[bag].splice(i, 1); }
        }
        if (o.set) for (const [id, patch] of Object.entries(o.set)) {
          const it = a[bag].find((x) => x.id === id);
          if (it) { Object.assign(it, patch); c[coll].mod.push(id); }
        }
        if (o.add) for (const x of o.add) { a[bag].push(clone(x)); c[coll].add.push(x.id); }
      }
    }
    frames.push({ st: clone(st), chg, touch: touched(step, chg) });
  }
  return frames;
}

function touched(step, chg) {
  const s = new Set(Object.keys(chg));
  if (step.act) { s.add(step.act.f); s.add(step.act.t); }
  if (step.look) for (const k of Object.keys(step.look)) s.add(k);
  return s;
}

/* 이 스텝이 실제로 무대에 올릴 배우 — 가독성의 핵심 규칙이다.
   전에는 덱의 모든 배우(최대 20개)를 언제나 그렸고 안 쓰는 것은 세로 띠로 접었다.
   실측하니 3장 덱은 평균 4개만 쓰면서 16개가 띠였다 — 화면의 80% 가 정보 없는 픽셀.
   그래서 "장면의 cast" 가 아니라 "이 스텝이 건드리는 것 + 직전 맥락" 만 올린다. */
export function onStage(scene, frames, i, maxCards = 4) {
  const cast = scene.cast || [];
  const now = frames[i]?.touch || new Set();
  const prev = frames[i - 1]?.touch || new Set();
  const rank = (id) => (now.has(id) ? 0 : prev.has(id) ? 1 : 2);
  return cast
    .map((id, idx) => ({ id, idx, r: rank(id) }))
    .sort((a, b) => a.r - b.r || a.idx - b.idx)
    .slice(0, maxCards)
    .sort((a, b) => a.idx - b.idx)           /* 자리 순서는 원래 배열대로 — 세계가 흔들리지 않게 */
    .map((x) => x.id);
}
