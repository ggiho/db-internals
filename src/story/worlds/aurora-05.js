/* aurora mysql 05 — quorum. AZ 세 칸에 복사본(3-way 는 하나씩, 6-way 는 둘씩)을 놓고, 아래 표 막대가 살아 있는 표를 센다.
   그리는 것은 모두 장면의 bake 상태에서 읽는다(손으로 적은 값이 없다) —
     · 복사본 = CLUSTER VOLUME 의 항목. AZ 는 id 의 앞(AZ-a · 1 → AZ-a), 살았나는 tag('ok' · 'x')
     · 표 막대 = QUORUM 의 V · 쓰기 quorum · 읽기 quorum · 살아 있는 표. 칸 V 개 중 살아 있는 만큼 차고, 두 quorum 에 눈금
     · 쓰기 · 읽기의 글과 색은 QUORUM 의 값 그대로다. 그림이 표를 다시 세어 데이터와 어긋나면(살아 있는 표 ≠ ok 인 복사본,
       표가 쓰기 quorum 을 채우는데 '불가' …) 조용히 넘어가지 않고 console.error 로 알린다(storysweep 의 errors 가 잡는다)
     · 고장(ok → x)은 덩어리가 빨갛게 무너지고, 재복제(x → ok)는 같은 AZ 의 살아 있는 복사본에서 알갱이가 흘러 들어간다
     · 3-way → 6-way 는 AZ 의 복사본 하나가 둘로 갈라진다(지운 항목의 자리에서 새 항목이 나온다)
     · look 이 항목을 짚는 스텝(평시 읽기)은 compute 에서 그 복사본으로 선 하나
     · 복제 모델의 값에 '4/6' 처럼 x/y 가 있으면 작은 막대로 — 앞 x 칸은 값의 색, 나머지는 기다리지 않는 칸
     · 그 스텝이 건드린 배우(touch)는 또렷하게, 나머지는 흐리게
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, FAINT, U } from '../field.js';
import { bake, stepsOf } from '../../bake.js';

const HANGUL = /[가-힣]/;
const COPY = 200, FLOW = 110, VG = 8, VOTE = VG * VG, MG = 5, MM = MG * MG, MAXV = 6;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr', '': '' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const zoneOf = (id) => id.split(' · ')[0];
/* '가능' · '불가' · '멈춤' 으로 말하는 값만 셈과 견준다('평소 세그먼트 하나 …' 는 말하지 않는다) */
const says = (v) => (/불가|멈춤/.test(bare(v)) ? false : /가능/.test(bare(v)) ? true : null);

export default {
  count: (narrow) => (narrow ? 3600 : 5200),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const frames = bake(sc, null), steps = stepsOf(sc, null), NK = frames.length;

  /* ── 상태 읽기 ── */
  const ratio = (q, key, k) => {
    const m = /^(\d+)\/(\d+)$/.exec(bare(q[key]));
    if (!m) console.error(`aurora 05 세계 : ${k} 의 '${key}' 를 x/y 로 못 읽었다 — "${q[key]}"`);
    return m ? +m[1] : 0;
  };
  const read = (st, step, chg, touch, k) => {
    const q = st.qm.kv, c = (chg && chg.vol) || { add: [], del: [], mod: [] }, look = (step && step.look) || {};
    const s = {
      items: st.vol.items.map((it) => ({ id: it.id, ok: it.tag === 'ok', sub: it.sub || '' })),
      step: step || {}, touch: touch || new Set(), mod: new Set([...c.mod, ...c.add]),
      V: +bare(q['V (표)']), Vw: ratio(q, '쓰기 quorum', k), Vr: ratio(q, '읽기 quorum', k), alive: +bare(q['살아 있는 표']),
      w: q['쓰기'], r: q['읽기'], mdl: st.mdl.kv, grade: st.grade.kv,
      focus: Array.isArray(look.vol) ? new Set(look.vol) : null,
    };
    /* 셈 맞추기 — 데이터의 셈을 그림이 다시 센다 */
    const okN = s.items.filter((x) => x.ok).length;
    if (okN !== s.alive) console.error(`aurora 05 세계 : ${k} 의 살아 있는 표 ${s.alive} ≠ ok 인 복사본 ${okN}`);
    if (s.items.length !== s.V) console.error(`aurora 05 세계 : ${k} 의 V ${s.V} ≠ 복사본 ${s.items.length}`);
    if (says(s.w) !== null && says(s.w) !== s.alive >= s.Vw) console.error(`aurora 05 세계 : ${k} 의 쓰기 "${bare(s.w)}" — 표 ${s.alive} · 쓰기 quorum ${s.Vw}`);
    if (says(s.r) !== null && says(s.r) !== s.alive >= s.Vr) console.error(`aurora 05 세계 : ${k} 의 읽기 "${bare(s.r)}" — 표 ${s.alive} · 읽기 quorum ${s.Vr}`);
    return s;
  };
  const S0 = read(sc.init, null, null, null, 'init');
  const S = frames.map((fr, k) => read(fr.st, steps[k], fr.chg, fr.touch, `${k + 1} 스텝`));
  const ids = [...new Set([S0, ...S].flatMap((s) => s.items.map((x) => x.id)))];
  const ZONES = [...new Set(ids.map(zoneOf))], ZN = ZONES.length;
  const MDL = [...new Set([S0, ...S].flatMap((s) => Object.keys(s.mdl)))];
  /* 그 항목이 한 AZ 에 몇과 함께 있나 — 처음 나온 스텝에서. 3-way 의 항목은 하나, 6-way 는 둘 */
  const perZone = (id) => { const s = [S0, ...S].find((x) => x.items.some((y) => y.id === id)); return s.items.filter((y) => zoneOf(y.id) === zoneOf(id)).length; };
  /* 또렷한 복사본 — look 이 짚은 것, 없으면 그 스텝에서 바뀐 것, 그것도 없으면 모두 */
  const hot = (s, id) => (s.focus ? s.focus.has(id) : s.mod.size ? s.mod.has(id) : true);

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  ids.forEach((id) => take('c:' + id, COPY));
  take('flow', FLOW);
  for (let j = 0; j < MAXV; j++) take('v:' + j, VOTE);
  MDL.forEach((key) => take('mm:' + key, MAXV * MM));
  R.DST = [at, N];
  if (at > N) throw new Error('aurora 05 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표(DOM) — 모두 읽어야 하는 값이라 .sm(좁은 화면에서 숨는 곁말)을 쓰지 않는다 ── */
  const made = [];
  function label(cls = '') {
    const el = document.createElement('div');
    el.className = 'wl ' + cls;
    labels.appendChild(el);
    const lb = { el, cls, t: null, o: -1 };
    made.push(lb);
    return lb;
  }
  function setText(lb, s, html = false) {
    if (lb.t === s) return;
    lb.t = s;
    if (html) lb.el.innerHTML = s; else lb.el.textContent = s;
    lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls));
  }
  function place(lb, x, y, al = 'l', va = 't') {
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%';
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`;
  }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(60, Math.floor(w)) + 'px'; };
  const LN = deck.LANES || [], EDGE = (deck.EDGES || [])[0] || null;
  const compLb = label('aq'), storLb = label('aq'), edgeLb = label('aq');
  const zoneLb = ZONES.map(() => label('aq'));
  const copyLb = Object.fromEntries(ids.map((id) => [id, label('aq ml aq-c')]));
  const hdQ = label('aq'), aliveLb = label('aq ml'), wTick = label('aq'), rTick = label('aq'), stLb = label('aq ml');
  const hdMdl = label('aq'), mdlLb = Object.fromEntries(MDL.map((key) => [key, label('aq ml')]));
  const hdGr = label('aq'), grLb = label('aq ml');

  /* 스텝마다의 글과 강조 — 바뀌지 않으므로 한 번 만든다. [글, 또렷한가, 색, 보이나, html] */
  const TX = S.map((s) => {
    const t = new Map(), on = (id) => s.touch.has(id);
    const comp = LN.find((l) => l.id === 'comp'), stor = LN.find((l) => l.id === 'stor');
    if (comp) t.set(compLb, [`${comp.lb}  ·  ${comp.note}`, !!s.focus]);
    if (stor) t.set(storLb, [`${stor.lb}  ·  ${stor.note}`, on('vol')]);
    if (EDGE) t.set(edgeLb, [EDGE.lb, false]);
    ZONES.forEach((z, i) => {
      const its = s.items.filter((x) => zoneOf(x.id) === z), down = its.length && its.every((x) => !x.ok);
      t.set(zoneLb[i], [z, on('vol'), down ? 'red' : '']);
    });
    for (const id of ids) {
      const it = s.items.find((x) => x.id === id);
      if (!it) { t.set(copyLb[id], ['', false, '', false, true]); continue; }
      const cls = !it.ok ? 'q-r' : s.focus && s.focus.has(id) ? 'q-g' : '';
      t.set(copyLb[id], [`<span class="q-i">${esc(id)}</span>\n<span class="${cls}">${esc(it.sub)}</span>`, on('vol') && hot(s, id), '', true, true]);
    }
    t.set(hdQ, [A.qm.nm, on('qm')]);
    t.set(aliveLb, [`<span class="q-i">살아 있는 표</span>\n${s.alive} / ${s.V}`, on('qm'), '', true, true]);
    const tk = (v) => (says(v) === true ? 'green' : says(v) === false ? 'red' : '');
    t.set(wTick, [`쓰기 ${s.Vw}/${s.V}`, on('qm'), tk(s.w)]);
    t.set(rTick, [`읽기 ${s.Vr}/${s.V}`, on('qm'), tk(s.r)]);
    t.set(stLb, [`<span class="q-i">쓰기</span>  ${val(s.w)}\n<span class="q-i">읽기</span>  ${val(s.r)}`, on('qm'), '', true, true]);
    t.set(hdMdl, [A.mdl.nm, on('mdl')]);
    for (const key of MDL) t.set(mdlLb[key], [`<span class="q-i">${esc(key)}</span>\n${val(s.mdl[key])}`, on('mdl'), '', true, true]);
    t.set(hdGr, [A.grade.nm, on('grade')]);
    t.set(grLb, [Object.entries(s.grade).map(([k, v]) => `<span class="q-i">${esc(k)}</span>\n${val(v)}`).join('\n'), on('grade'), '', true, true]);
    return t;
  });
  /* 한 이름표의 모든 스텝 글 중 가장 큰 폭 · 높이(글이 바뀌어도 이웃을 덮지 않게 자리를 잡는다) */
  /* 재는 동안 넣은 글은 되돌린다 — 글꼴이 늦게 와 다시 짤 때 다음 paint 전까지 마지막 스텝의 글이 남아,
     그 사이에 잰 storysweep 이 wiredtiger 01 / 2 에서 5 스텝의 글을 보았다 */
  const most = (lb) => {
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const t of TX) {
      const e = t.get(lb);
      if (!e || e[3] === false) continue;
      lb.el.innerHTML = e[0];
      const r = lb.el.getBoundingClientRect();
      w = Math.max(w, r.width); h = Math.max(h, r.height);
    }
    lb.el.innerHTML = keep;
    return { w, h };
  };

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(5);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0;
    const zg = Math.max(14, ww * 0.03), zw = (ww - (ZN - 1) * zg) / ZN;
    const cw = Math.round(U.clamp(zw * 0.4, 40, 120)), chh = Math.round(cw * 0.7);
    /* 복사본 이름 — AZ 에 하나면 칸 폭, 둘이면 반 */
    for (const id of ids) wrap(copyLb[id], perZone(id) === 1 ? zw - 16 : zw / 2 - 8);
    const copyH = Math.max(...ids.map((id) => most(copyLb[id]).h));
    /* 표 막대 — 왼쪽에 살아 있는 표, 오른쪽(모자라면 아래)에 쓰기 · 읽기 */
    const ss = Math.round(U.clamp(ww * 0.06, 28, 44)), sg = Math.round(ss * 0.3), aliveW = most(aliveLb).w, sx = L.x0 + aliveW + 16, sEnd = sx + MAXV * (ss + sg) - sg;
    const stRight = L.x1 - (sEnd + 22) >= 190;
    wrap(stLb, stRight ? L.x1 - (sEnd + 22) : ww);
    const stH = most(stLb).h;
    /* 아래 — 복제 모델(왼쪽) · 근거 등급(오른쪽) */
    const mw = ww * 0.56, gx = L.x0 + ww * 0.6;
    MDL.forEach((key) => wrap(mdlLb[key], mw));
    wrap(grLb, L.x1 - gx);
    const mdlH = MDL.map((key) => most(mdlLb[key]).h), grH = most(grLb).h;
    /* 세로 — 위에서부터 쌓아 높이를 재고, 넓은 화면은 가운데로 */
    const edgeY = 26, zoneY = edgeY + 34, boxY = zoneY + 18, boxH = 14 + chh + 10 + copyH + 12;
    const meterY = boxY + boxH + 56, meterB = meterY + ss + 30 + (stRight ? 0 : 10 + stH);
    const botY = meterB + 34, botH = 18 + Math.max(mdlH.reduce((a, b) => a + b + 8, 0), grH);
    const dy = L.narrow ? 0 : Math.max(0, (wh - (botY + botH)) / 2), Y = (v) => L.y0 + dy + v;
    const zones = ZONES.map((z, i) => ({ x: L.x0 + i * (zw + zg), y: Y(boxY), w: zw, h: boxH }));
    G = { L, cw, chh, zones, edgeY: Y(edgeY), ss, sg, sx, meterY: Y(meterY), mm: {} };
    place(compLb, L.x0, Y(0)); place(storLb, L.x0, Y(edgeY + 8));
    if (EDGE) place(edgeLb, L.x1, Y(edgeY) - 3, 'r', 'b');
    zones.forEach((zn, i) => place(zoneLb[i], zn.x, Y(zoneY)));
    for (const id of ids) { const P = copyAt(perZone(id), id); place(copyLb[id], P.x, P.y + chh / 2 + 10, 'c', 't'); }
    place(hdQ, L.x0, Y(meterY) - 34);
    place(aliveLb, L.x0, Y(meterY) + ss / 2, 'l', 'c');
    if (stRight) place(stLb, sEnd + 22, Y(meterY) + ss / 2, 'l', 'c'); else place(stLb, L.x0, Y(meterY) + ss + 40);
    place(hdMdl, L.x0, Y(botY));
    let ry = Y(botY) + 18;
    MDL.forEach((key, i) => {
      const lb = mdlLb[key];
      place(lb, L.x0, ry);
      /* 작은 막대는 이름 줄의 끝에 */
      const keep = lb.el.innerHTML;
      lb.el.innerHTML = TX[0].get(lb)[0];
      const k = lb.el.querySelector('.q-i');
      G.mm[key] = { x: L.x0 + k.offsetLeft + k.offsetWidth + 12, y: ry + k.offsetTop + k.offsetHeight / 2 };
      lb.el.innerHTML = keep;
      ry += mdlH[i] + 8;
    });
    place(hdGr, gx, Y(botY)); place(grLb, gx, Y(botY) + 18);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 복사본의 가운데 — 그 AZ 에 n 개일 때 j 번째. 칸을 n 등분한 가운데(이름표 폭 = 칸 / n − 8 과 맞춘다) */
  function copyAt(n, id, j = -1) {
    const { zones, chh } = G, zn = zones[ZONES.indexOf(zoneOf(id))];
    if (j < 0) j = n === 1 ? 0 : Math.max(0, +(/ · (\d+)$/.exec(id) || [0, 1])[1] - 1);
    return { x: zn.x + (j + 0.5) * (zn.w / n), y: zn.y + 14 + chh / 2 };
  }
  const posIn = (s, id) => {
    const same = s.items.filter((x) => zoneOf(x.id) === zoneOf(id));
    return copyAt(same.length, id, same.findIndex((x) => x.id === id));
  };

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  /* 격자 — 줄 수를 내림으로 잡는다(올림이면 마지막 줄이 덜 차 덩어리 아래가 이가 빠졌다). 남는 알갱이는 셋째 값이 false — 숨긴다 */
  function grid(cx, cy, w, h, n, m) {
    const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h)))), rows = Math.max(1, Math.floor(n / cols));
    return [cx - w / 2 + ((m % cols) + 0.5) / cols * w, cy - h / 2 + (Math.floor(m / cols) % rows + 0.5) / rows * h, m < cols * rows];
  }
  const hide = (k) => { const [a, b] = R[k]; for (let i = a; i < b; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  const COL = { red: RED, green: GREEN, gold: GOLD, '': INK };
  let O = null;
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    const { cw, chh, ss, sg, sx, meterY } = G;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const volOn = s.touch.has('vol') && !end;
    /* 복사본 */
    let heal = null;
    for (const id of ids) {
      const [s0] = R['c:' + id], it = s.items.find((x) => x.id === id), pv = prev.items.find((x) => x.id === id);
      if (!it) {
        /* 그 스텝에서 지운 항목(3 : 3-way 의 복사본) — 제자리에서 흐려지고, 그 자리에서 새 항목이 나온다 */
        if (!pv || end) { hide('c:' + id); continue; }
        const P = posIn(prev, id), a = 0.85 * (1 - show(p, 0.1, 0.3)) * form;
        for (let m = 0; m < COPY; m++) { const i = s0 + m, [gx, gy, ing] = grid(P.x, P.y, cw, chh, COPY, m), [x, y] = into(i, gx, gy); put(o, i, x, y, a * ing, 0, 0.05, 1.1, pv.ok ? INK : RED); }
        continue;
      }
      const P = posIn(s, id), parent = !pv && !end ? prev.items.find((x) => zoneOf(x.id) === zoneOf(id)) : null, PP = parent ? posIn(prev, parent.id) : null;
      const failing = !end && pv && pv.ok && !it.ok, healing = !end && pv && !pv.ok && it.ok;
      if (healing) heal = { id, P };
      const focus = !end && s.focus && s.focus.has(id);
      const base = (volOn ? (hot(s, id) ? 0.92 : 0.5) : 0.45) * dim * form;
      for (let m = 0; m < COPY; m++) {
        const i = s0 + m, jx = jit[i * 2], jy = jit[i * 2 + 1], f = m / COPY;
        let [x, y, ing] = grid(P.x, P.y, cw, chh, COPY, m), a = base, col = it.ok ? (focus ? GOLD : INK) : RED;
        /* 무너진 자리 — 아래로 처지고 흩어진다. 고장 나는 스텝은 알갱이마다 차례로 */
        let q = !it.ok ? (failing ? show(p, 0.1 + f * 0.12, 0.24 + f * 0.12) : 1) : 0;
        if (healing) q = 1 - show(p, 0.18 + f * 0.2, 0.24 + f * 0.2);
        if (q > 0) { x += jx * 10 * q; y += (4 + Math.abs(jy) * 16) * q; a = U.lerp(base, base * 0.38, q); col = q > (healing ? 0.5 : 0.02) ? RED : INK; }
        if (PP) { const e = show(p, 0.1 + (m % 9) * 0.015, 0.34 + (m % 9) * 0.015), [px, py] = grid(PP.x, PP.y, cw, chh, COPY, m); x = U.lerp(px, x, e); y = U.lerp(py, y, e); }
        [x, y] = into(i, x, y);
        put(o, i, x, y, a * ing, focus ? 0.6 : 0, 0.05, 1.1, col);
      }
    }
    /* 흐름 — 재복제는 같은 AZ 의 살아 있는 복사본에서, 평시 읽기는 compute 에서 그 복사본으로 */
    const [f0] = R.flow, fid = s.focus && !end ? [...s.focus][0] : null;
    if (heal) {
      const src = s.items.find((x) => x.ok && x.id !== heal.id && zoneOf(x.id) === zoneOf(heal.id)) || s.items.find((x) => x.ok && x.id !== heal.id);
      const SP = src ? posIn(s, src.id) : heal.P;
      for (let m = 0; m < FLOW; m++) {
        const i = f0 + m, t0 = 0.1 + (m / FLOW) * 0.2, q = show(p, t0, t0 + 0.12), arc = Math.sin(q * Math.PI) * 22;
        put(o, i, U.lerp(SP.x, heal.P.x, q) + jit[i * 2] * 8, U.lerp(SP.y, heal.P.y, q) - arc + jit[i * 2 + 1] * 8, q > 0 && q < 1 ? 0.9 : 0, 0.8, 0.1, 1.2, GREEN);
      }
    } else if (fid && s.items.some((x) => x.id === fid)) {
      /* 평시 읽기 — compute 의 DB 인스턴스(작은 상자, 앞 STUB 알갱이)에서 그 복사본으로 곧은 선 하나 */
      const STUB = 36, P = posIn(s, fid), bw = 30, bh = 12, by = G.edgeY - 8 - bh, y0 = G.edgeY - 8, y1 = P.y - chh / 2 - 6, grow = show(p, 0.1, 0.4);
      for (let m = 0; m < FLOW; m++) {
        const i = f0 + m;
        if (m < STUB) {
          const d = ((m + 0.5) / STUB) * 2 * (bw + bh), x = d < bw ? P.x - bw / 2 + d : d < bw + bh ? P.x + bw / 2 : d < 2 * bw + bh ? P.x + bw / 2 - (d - bw - bh) : P.x - bw / 2;
          const y = d < bw ? by : d < bw + bh ? by + (d - bw) : d < 2 * bw + bh ? by + bh : by + bh - (d - 2 * bw - bh);
          const [xx, yy] = into(i, x, y);
          put(o, i, xx, yy, 0.85 * form, 0, 0.03, 1.05, INK);
          continue;
        }
        const u = (m - STUB) / (FLOW - STUB - 1), [x, y] = into(i, P.x, U.lerp(y0, y1, u));
        put(o, i, x, y, u <= grow ? 0.9 * form : 0, 0.5, 0.02, 1.1, GOLD);
      }
    } else hide('flow');
    /* 표 막대 — 칸 V 개, 살아 있는 표만큼 찬다. 칸이 늘면(3 → 6) 새 칸은 끝 칸에서 나온다 */
    const qmOn = s.touch.has('qm') && !end, live = end ? s.alive : U.lerp(prev.alive, s.alive, show(p, 0.3, 0.44));
    for (let j = 0; j < MAXV; j++) {
      const [v0] = R['v:' + j];
      if (j >= s.V) { hide('v:' + j); continue; }
      const cx = sx + j * (ss + sg) + ss / 2, cy = meterY + ss / 2, born = !end && j >= prev.V;
      const bx = sx + Math.max(0, prev.V - 1) * (ss + sg) + ss / 2, e = born ? show(p, 0.3, 0.44) : 1;
      const fill = U.clamp(live - j, 0, 1), a = (fill > 0.5 ? 0.95 : 0.5) * (qmOn ? 1 : 0.55) * dim * form;
      /* 찬 칸은 꽉, 잃은 표는 테두리만 — 모양으로 구별한다 */
      for (let m = 0; m < VOTE; m++) {
        const i = v0 + m, c = m % VG, r = Math.floor(m / VG), rim = c === 0 || c === VG - 1 || r === 0 || r === VG - 1;
        const gx = cx + (c - (VG - 1) / 2) * (ss / VG), gy = cy + (r - (VG - 1) / 2) * (ss / VG), [x, y] = into(i, U.lerp(bx, gx, e), gy);
        put(o, i, x, y, (fill > 0.5 || rim ? a : 0) * (born ? e : 1), fill > 0.5 && qmOn ? 0.3 : 0, 0.03, fill > 0.5 ? 1.6 : 1.05, fill > 0.5 ? INK : RED);
      }
    }
    /* 복제 모델의 작은 막대 — 값에 x/y 가 있는 줄만. 큰 막대와 같은 문법 : 기다리는 칸은 꽉(값의 색), 안 기다리는 칸은 테두리만 */
    const mdlOn = s.touch.has('mdl') && !end;
    for (const key of MDL) {
      const v = s.mdl[key], m2 = /(\d+)\/(\d+)/.exec(bare(v)), mm = G.mm[key];
      if (!m2 || !mm) { hide('mm:' + key); continue; }
      const need = +m2[1], tot = Math.min(MAXV, +m2[2]), [m0] = R['mm:' + key];
      const pm = prev.mdl[key], fresh = !end && bare(pm) !== bare(v), e = fresh ? show(p, 0.2, 0.4) : 1;
      for (let j = 0; j < MAXV; j++) for (let m = 0; m < MM; m++) {
        const i = m0 + j * MM + m;
        if (j >= tot) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const c = m % MG, r = Math.floor(m / MG), rim = c === 0 || c === MG - 1 || r === 0 || r === MG - 1, wait = j < need;
        const [x, y] = into(i, mm.x + j * 19 + 7 + (c - (MG - 1) / 2) * 3, mm.y + (r - (MG - 1) / 2) * 3);
        put(o, i, U.lerp(mm.x, x, e), y, (wait ? 0.92 : rim ? 0.45 : 0) * (mdlOn ? 1 : 0.5) * dim * form * e, wait ? 0.4 : 0, 0.02, wait ? 1.25 : 1, wait ? COL[tone(v)] : FAINT);
      }
    }
  }

  /* ── 글 ── */
  let shown = -2;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  const tickX = (n) => G.sx + n * (G.ss + G.sg) - G.sg / 2;
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = TX[Math.min(k, NK - 1)], TB = TX[Math.min(next, NK - 1)], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
      }
      /* quorum 눈금의 이름 — 쓰기는 눈금 위, 읽기는 아래 */
      place(wTick, tickX(S[kk].Vw), G.meterY - 10, 'c', 'b');
      place(rTick, tickX(S[kk].Vr), G.meterY + G.ss + 10, 'c', 't');
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
  }

  let css = {};
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L, zones, edgeY, meterY, ss } = G;
    ctx.save();
    /* compute · storage 경계 */
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(L.x0, edgeY); ctx.lineTo(L.x1, edgeY); ctx.stroke();
    /* AZ 칸 — 그 AZ 의 복사본이 모두 죽으면 빨강 */
    ctx.setLineDash([2, 4]);
    zones.forEach((zn, i) => {
      const its = s.items.filter((x) => zoneOf(x.id) === ZONES[i]), down = !end && its.length && its.every((x) => !x.ok);
      ctx.globalAlpha = (down ? 0.75 : 0.35) * o; ctx.strokeStyle = down ? css.red : css.faint;
      ctx.beginPath(); ctx.roundRect(zn.x + 0.5, zn.y + 0.5, zn.w - 1, zn.h - 1, 8); ctx.stroke();
    });
    /* quorum 눈금 — 채우면 초록, 못 채우면 빨강(값이 말하지 않으면 흐리게) */
    ctx.setLineDash([]); ctx.lineWidth = 2;
    const tick = (n, v, y0, y1) => {
      const ok = says(v);
      ctx.globalAlpha = (ok === null ? 0.4 : 0.9) * o; ctx.strokeStyle = ok === true ? css.green : ok === false ? css.red : css.faint;
      ctx.beginPath(); ctx.moveTo(tickX(n), y0); ctx.lineTo(tickX(n), y1); ctx.stroke();
    };
    tick(s.Vw, s.w, meterY - 8, meterY + ss / 2);
    tick(s.Vr, s.r, meterY + ss / 2, meterY + ss + 8);
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), red: v('--red'), green: v('--green') };
    },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
