/* 연산을 재생해 스텝별 상태를 만든다 — 기존 엔진의 bake 와 같은 규칙이다.
   렌더러가 React 로 바뀌어도 이 규칙은 데이터의 일부이므로 그대로 옮긴다. */
const clone = (x) => structuredClone(x);

/* 손잡이 값에 따라 달라지는 스텝을 갈아끼운 목록을 준다.
   장면은 기본값(vary.base)을 전제로 쓰여 있고, 달라지는 스텝만 vary.alt 에 적는다 :

     vary:{ knob:'innodb_flush_log_at_trx_commit', base:'1',
            alt:{ '2':{ 12:{ note, why, key, ops, fact, ref, sym } }, '0':{ ... } } }

   번호는 화면과 같은 1부터다. 덮어쓰기는 얕은 병합이다 — "이 스텝은 대신 이렇게 한다".
   ops 를 깊게 병합하지 않는 이유 : 값에 따라 아무 일도 하지 않는 스텝이 있고,
   그때 빈 ops 로 덮어써야 "하지 않는다" 를 표현할 수 있다.
   한 곳에 모아 두는 이유 : bake·검증·줄찾기·발췌·스윕이 모두 같은 목록을 봐야 한다. */
export function stepsOf(scene, v) {
  const alt = v != null && scene.vary && scene.vary.alt && scene.vary.alt[String(v)];
  if (!alt) return scene.steps || [];
  return (scene.steps || []).map((st, i) => (alt[i + 1] ? { ...st, ...alt[i + 1] } : st));
}

/* 그 장면이 가진 값들 — 기본값을 앞에 둔다. 없으면 빈 배열이다. */
export function valuesOf(scene) {
  if (!scene || !scene.vary) return [];
  const alt = Object.keys(scene.vary.alt || {});
  /* JS 는 정수형 키를 숫자 순으로 강제하므로 저작 순서가 사라진다 —
     '1' 다음에 '0','2' 가 와서 1·0·2 로 보였다.
     내림차순으로 두면 이 손잡이에서는 곧 내구성이 낮아지는 순서가 된다(1 → 2 → 0).
     vary.order 를 적어 두면 그것을 그대로 쓴다. */
  if (scene.vary.order) return scene.vary.order.map(String);
  const num = alt.every((k) => /^-?\d+$/.test(k));
  const rest = num ? alt.sort((a, b) => Number(b) - Number(a)) : alt;
  return [String(scene.vary.base), ...rest];
}

export function bake(scene, v) {
  const frames = [];
  let st = clone(scene.init);
  for (const step of stepsOf(scene, v)) {
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
