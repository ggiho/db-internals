/* postgres buffer 01 — clock-sweep. 공유 버퍼 여섯 칸을 시계 판으로 놓고 바늘이 돈다.
   그리는 것은 모두 장면의 bake 상태에서 읽는다(손으로 적은 값이 없다) —
     · 칸 = SHARED BUFFERS 의 항목. 페이지 · usage · pin · dirty 는 항목의 sub · tag 에서 뽑는다.
       형식이 다르면 조용히 넘어가지 않고 console.error 로 알린다(storysweep 의 errors 가 잡는다)
     · 바늘 = BACKEND 의 '바늘'("buf 1 → buf 2"). 그 스텝에서 바뀌었으면 앞 칸에서 뒤 칸으로 시계 방향으로 돈다
     · usage(0 – 5, BM_MAX_USAGE_COUNT)는 그 스텝에서 그 칸이 바뀌었을 때만 앞 값에서 뒤 값으로 찬다 · 빈다
     · buffer mapping 의 줄은 칸들의 페이지 → 버퍼 그대로다 — 매핑 표의 내용이 곧 그것이다
     · act 는 덩어리가 f 의 자리에서 t 의 자리로 — pool · heap 은 act 이름이 짚는 칸 · 페이지(없으면 그 스텝에서 바뀐 것)
     · 그 스텝이 건드린 배우(touch)는 또렷하게, 나머지는 흐리게 — 한 화면에 다 담지 않고 지금 일어나는 것을 앞에 둔다
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, ACCENT, RED, FAINT, U } from '../field.js';
import { bake, stepsOf } from '../../bake.js';

const HANGUL = /[가-힣]/;
const MAXU = 5;                      /* BM_MAX_USAGE_COUNT */
const SLOT = 120, PIP = 16, HAND = 150, HUB = 36, BGH = 90, PAGE = 100, TOK = 200;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const gold = (v) => /\|gold$/.test(String(v ?? ''));
const has = (a, x) => (a || []).includes(x);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export default {
  count: (narrow) => (narrow ? 3800 : 5600),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const frames = bake(sc, null), steps = stepsOf(sc, null), NK = frames.length;

  /* ── 상태 읽기 ── */
  const bufOf = (it) => {
    const pg = /^(p:\d+)/.exec(it.sub || ''), u = /usage\s+(\d)(?:\s*→\s*(\d))?/.exec(it.sub || '');
    if (!pg || !u) console.error(`pg-buffer 세계 : SHARED BUFFERS 의 ${it.id} 에서 페이지 · usage 를 못 읽었다 — "${it.sub}"`);
    return { id: it.id, pg: pg ? pg[1] : '?', u0: u ? +u[1] : 0, u: u ? +(u[2] ?? u[1]) : 0, pin: it.tag === 'pin', dirty: it.tag === 'dirty', bgw: /bgwriter/.test(it.sub || '') };
  };
  const handOf = (kv) => {
    const m = bare(kv['바늘']).match(/buf \d+/g) || [];
    if (!m.length) console.error(`pg-buffer 세계 : BACKEND 의 '바늘' 을 못 읽었다 — "${kv['바늘']}"`);
    return { from: m[0], to: m[m.length - 1] };
  };
  const S = frames.map((fr, k) => {
    const st = fr.st, c = fr.chg;
    return {
      pool: (st.pool.items || []).map(bufOf), hand: handOf(st.be.kv || {}), step: steps[k] || {}, touch: fr.touch,
      handMoved: has(c.be && c.be.keys, '바늘'),
      poolMod: new Set([...((c.pool && c.pool.mod) || []), ...((c.pool && c.pool.add) || [])]),
      heap: st.heap.items || [], heapMod: new Set((c.heap && c.heap.mod) || []),
      be: st.be.kv || {}, beKeys: (c.be && c.be.keys) || [], map: st.map.kv || {}, bgw: st.bgw.kv || {}, cmp: st.cmp.kv || {},
    };
  });
  const ids = S[0].pool.map((b) => b.id), NB = ids.length, idx = (id) => ids.indexOf(id);
  const init = { pool: (sc.init.pool.items || []).map(bufOf), hand: handOf(sc.init.be.kv || {}) };
  const HEAPS = [...new Set(S.flatMap((s) => s.heap.map((h) => h.id)))];
  const pgOf = (s) => { const m = /\(t,\s*(\d+)\)/.exec(bare(s)); return m ? 'p:' + m[1] : null; };

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  ids.forEach((id) => take('slot:' + id, SLOT));
  ids.forEach((id) => take('pip:' + id, PIP * MAXU));
  take('hand', HAND); take('hub', HUB); take('bgh', BGH);
  HEAPS.forEach((id) => take('heap:' + id, PAGE));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('pg-buffer 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표(DOM) ── */
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
    lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\bpb\b/.test(lb.cls));
  }
  /* va — 't' 위 · 'c' 가운데 · 'b' 아래. 여러 줄은 위에 맞춘다(가운데로 두면 줄이 늘 때 이웃을 덮는다) */
  function place(lb, x, y, al = 'l', va = 't') {
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%';
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`;
  }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(80, Math.floor(w)) + 'px'; };
  const hdBe = label('pb'), txBe = label('pb ml');
  const hdBgw = label('pb'), txBgw = label('pb ml');
  const hdMap = label('pb'), rowMap = ids.map(() => label('pb')), qMap = label('pb ml'), free = label('pb');
  const hdCmp = label('pb'), txCmp = label('pb ml');
  const slotLb = ids.map(() => label('pb ml pb-slot'));
  const hdHeap = label('pb'), heapLb = HEAPS.map(() => label('pb ml pb-heap'));
  const edgeLb = label('pb'), tok = label('stn-tok');
  const EDGE = (deck.EDGES || []).find((e) => e.after === A.pool.lane) || null;

  /* 스텝마다의 글과 강조 — 바뀌지 않으므로 한 번 만든다. emph : 그 배우를 그 스텝이 건드렸는가 */
  const cmpOn = (s) => Object.values(s.cmp).some((v) => bare(v) !== '—');
  const TX = S.map((s) => {
    const t = new Map(), on = (id) => s.touch.has(id);
    const q = pgOf(s.map['찾는 것']), res = bare(s.map['결과']);
    t.set(hdBe, [A.be.nm, on('be')]);
    t.set(txBe, [`요청  ${bare(s.be['요청'])}\n단계  ${bare(s.be['단계'])}`, on('be'), gold(s.be['단계']) ? 'gold' : '']);
    t.set(hdBgw, [A.bgw.nm, on('bgw')]);
    t.set(txBgw, [`주기  ${bare(s.bgw['주기'])}\n이번  ${bare(s.bgw['이번 주기'])}\n상태  ${bare(s.bgw['상태'])}`, on('bgw')]);
    const showMap = !cmpOn(s);
    t.set(hdMap, [A.map.nm, showMap && on('map'), '', showMap]);
    s.pool.forEach((b, i) => t.set(rowMap[i], [`${b.pg}  →  ${b.id}`, showMap && (on('map') || s.poolMod.has(b.id)), b.pg === q && on('map') ? 'gold' : s.poolMod.has(b.id) && on('map') ? 'gold' : '', showMap]));
    t.set(qMap, [`찾는 것  ${bare(s.map['찾는 것'])}\n→  ${res}`, showMap && on('map'), /없다/.test(res) ? 'red' : /있다/.test(res) ? 'green' : /넣음/.test(res) ? 'gold' : '', showMap]);
    /* freelist 는 덱의 배우가 아니다 — '빈 버퍼 찾기' 에 들어선 스텝에만 밝힌다(비어 있으므로 clock 으로 간다) */
    t.set(free, ['freelist  ·  비었다', showMap && /빈 버퍼/.test(bare(s.be['단계'])) && has(s.beKeys, '단계'), '', showMap]);
    t.set(hdCmp, [A.cmp.nm, on('cmp'), '', !showMap]);
    /* 값의 색(|gold) — bare 로 지웠더니 02 장면과 달리 'PG' 줄이 맨 글씨였다(08) */
    const tv = (v) => { const m = /\|(gold|red)$/.exec(String(v ?? '')); return m ? `<span class="pb-${m[1] === 'gold' ? 'g' : 'r'}">${esc(bare(v))}</span>` : esc(bare(v)); };
    t.set(txCmp, [Object.entries(s.cmp).map(([k, v]) => `<span class="pb-i">${esc(k)}</span>\n${tv(v)}`).join('\n'), on('cmp'), '', !showMap, true]);
    s.pool.forEach((b, i) => {
      const st = b.pin ? '<span class="pb-g">pin</span>' : b.dirty ? '<span class="pb-r">dirty</span>' : '';
      t.set(slotLb[i], [`<span class="pb-i">${esc(b.pg)}</span>\n${esc(b.id)}  ·  usage ${b.u}${st ? '\n' + st : ''}`, true, '', true, true]);
    });
    t.set(hdHeap, [A.heap.nm, on('heap')]);
    s.heap.forEach((h, j) => t.set(heapLb[HEAPS.indexOf(h.id)], [`<span class="pb-i">${esc(h.id)}</span>\n${esc(h.sub || '')}`, on('heap') || s.heapMod.has(h.id), s.heapMod.has(h.id) ? 'gold' : '', true, true]));
    if (EDGE) t.set(edgeLb, [EDGE.lb, true, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '']);
    return t;
  });

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(11);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0;
    /* 높이 예산 : 위(맨 위 칸의 이름) 70 · 칸 · 지름 · 아래 칸의 이름 62 · 경계 34 · 페이지 40 · 페이지 이름 34 */
    const Rr = Math.max(90, Math.min(ww * 0.26, (wh - 240) / 2.24));
    const sw = Math.round(Rr * 0.36), sh = Math.round(Rr * 0.24);
    const contentH = 240 + 2.24 * Rr, dy = L.narrow ? 0 : Math.max(0, (wh - contentH) / 2), y0 = L.y0 + dy;
    const C = { x: L.x0 + ww * 0.6, y: y0 + 70 + sh / 2 + Rr };
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / NB;
    const slots = ids.map((id, i) => ({ x: C.x + Rr * Math.cos(ang(i)), y: C.y + Rr * Math.sin(ang(i)), top: Math.sin(ang(i)) < -0.9 }));
    /* usage 칸 다섯 — 칸 바로 아래(맨 위 칸은 위). 이름은 그 바깥 */
    const pipS = 7, pipG = 4, pipW = MAXU * pipS + (MAXU - 1) * pipG;
    const pips = slots.map((s) => ({ x: s.x - pipW / 2, y: s.top ? s.y - sh / 2 - 8 - pipS : s.y + sh / 2 + 8 }));
    const bottom = C.y + Rr + sh / 2 + 62, edgeY = bottom + 16, heapY = edgeY + 18, pw = Math.round(Math.min(64, Rr * 0.4)), ph = 40;
    const gapX = Math.max(pw + 60, Math.min(150, ww * 0.18));
    const heaps = HEAPS.map((id, j) => ({ x: C.x + (j - (HEAPS.length - 1) / 2) * gapX, y: heapY + ph / 2 }));
    G = { L, y0, C, Rr, sw, sh, ang, slots, pips, pipS, pipG, heaps, pw, ph, edgeY };
    /* 이름표 자리 */
    place(hdBe, L.x0, y0); place(txBe, L.x0, y0 + 16); wrap(txBe, C.x - 70 - L.x0);
    place(hdBgw, L.x1, y0, 'r'); place(txBgw, L.x1, y0 + 16, 'r');
    wrap(txBgw, Math.min(180, L.x1 - (C.x + 70)));
    /* 매핑 표(또는 끝의 vs InnoDB)는 왼쪽, 왼쪽 두 칸 사이의 띠에 — 왼쪽 칸 이름의 가장 넓은 폭(모든 스텝의 글로 잰다) 앞에서 멈춘다 */
    /* 재는 동안 넣은 글은 되돌린다(다시 짤 때 다음 paint 전까지 다른 스텝의 글이 남지 않게) */
    const slotW = slotLb.map((lb) => { const keep = lb.el.innerHTML, w = Math.max(...TX.map((t) => { lb.el.innerHTML = t.get(lb)[0]; return lb.el.getBoundingClientRect().width; })); lb.el.innerHTML = keep; return w; });
    const left = Math.min(...slots.map((s, i) => (Math.cos(ang(i)) < -0.1 ? s.x - Math.max(sw, slotW[i]) / 2 : Infinity)));
    const mx = L.x0, mw = left - 14 - mx, my = C.y - 64;
    place(hdMap, mx, my);
    rowMap.forEach((lb, i) => place(lb, mx, my + 18 + i * 15));
    place(qMap, mx, my + 18 + NB * 15 + 6); wrap(qMap, mw);
    const qKeep = qMap.el.textContent, qH = Math.max(...TX.map((t) => { qMap.el.textContent = t.get(qMap)[0]; return qMap.el.getBoundingClientRect().height; }));
    qMap.el.textContent = qKeep;
    place(free, mx, my + 18 + NB * 15 + 6 + qH + 8);
    place(hdCmp, mx, my); place(txCmp, mx, my + 18); wrap(txCmp, mw);
    slots.forEach((s, i) => (s.top ? place(slotLb[i], s.x, pips[i].y - 6, 'c', 'b') : place(slotLb[i], s.x, pips[i].y + pipS + 6, 'c', 't')));
    place(hdHeap, L.x0, heapY + ph / 2, 'l', 'c');
    heaps.forEach((h, j) => place(heapLb[j], h.x, heapY + ph + 6, 'c', 't'));
    place(edgeLb, L.x1, edgeY - 3, 'r', 'b');
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }

  /* 배우의 자리 — act 의 덩어리가 오가는 곳 */
  function anchor(id, s, lbText) {
    const { L, C, slots, heaps } = G;
    if (id === 'pool' || (id === 'bgw' && s.pool.some((b) => b.bgw) && /쓰기/.test(lbText))) {
      const m = /buf \d+/.exec(lbText || ''), b = id === 'bgw' ? s.pool.find((x) => x.bgw) : null;
      const bid = b ? b.id : m ? m[0] : [...s.poolMod][0] || s.hand.to, i = idx(bid);
      return i >= 0 ? [slots[i].x, slots[i].y] : [C.x, C.y];
    }
    if (id === 'heap') {
      const m = /p:\d+/.exec(lbText || ''), hid = m && HEAPS.includes(m[0]) ? m[0] : [...s.heapMod][0] || HEAPS[0], j = HEAPS.indexOf(hid);
      return [heaps[j].x, heaps[j].y];
    }
    if (id === 'map') return [L.x0 + 60, C.y - 20];
    if (id === 'be') return [L.x0 + 40, G.y0 + 30];
    if (id === 'bgw') return [L.x1 - 40, G.y0 + 30];
    return [C.x, C.y];
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  /* 격자 — 줄 수를 내림으로 잡는다(올림이면 마지막 줄이 덜 차 덩어리 아래가 이가 빠졌다). 남는 알갱이는 셋째 값이 false — 숨긴다 */
  function grid(cx, cy, w, h, n, m) {
    const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h)))), rows = Math.max(1, Math.floor(n / cols));
    return [cx - w / 2 + ((m % cols) + 0.5) / cols * w, cy - h / 2 + (Math.floor(m / cols) % rows + 0.5) / rows * h, m < cols * rows];
  }
  function pose(k, p, t, o) {
    if (!G) return;
    const end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : init;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    const { C, Rr, sw, sh, ang, slots, pips, pipS, pipG, heaps, pw, ph } = G;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    /* 밝히는 칸 — 그 스텝에서 바뀐 칸, 그리고 바늘이 막 떠나는 칸(4 : pin 이라 건너뛰는 buf 2) */
    const litOf = (b) => !end && (s.poolMod.has(b.id) || (s.handMoved && b.id === s.hand.from));
    /* 바늘 — 바뀐 스텝은 앞 칸에 섰다가(그 칸의 usage 가 바뀌는 동안) 시계 방향으로 뒤 칸까지 */
    let ha = ang(idx(s.hand.to));
    if (s.handMoved && !end) {
      const from = idx(s.hand.from), d = ((idx(s.hand.to) - from + NB) % NB) * (2 * Math.PI / NB);
      ha = ang(from) + d * show(p, 0.34, 0.48);
    }
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    /* 칸 */
    s.pool.forEach((b, bi) => {
      const [s0] = R['slot:' + b.id], sl = slots[bi], pb = prev.pool.find((x) => x.id === b.id);
      const swapped = pb && pb.pg !== b.pg;          /* 페이지가 바뀐 칸(6 : p:17 → p:42) — 새 페이지가 파일에서 올라온다 */
      const src = swapped && act && act.f === 'heap' ? anchor('heap', s, act.lb) : null;
      const on = litOf(b), lit = on ? 0.7 : 0, emph = s.touch.has('pool') ? 1 : 0.6;
      /* 쓰여 깨끗해진 칸(5 : 백엔드 · 7 : bgwriter) — 덩어리가 떠나는 동안 빨강이 알갱이마다 차례로 걷힌다 */
      const cleaned = !end && pb && pb.pg === b.pg && pb.dirty && !b.dirty;
      for (let m = 0; m < SLOT; m++) {
        const i = s0 + m, col = b.dirty || (cleaned && p < 0.12 + (m / SLOT) * 0.25) ? RED : INK;
        let [x, y, ing] = grid(sl.x, sl.y, sw, sh, SLOT, m);
        if (src) { const q = show(fly, (m % 9) * 0.02, 0.82 + (m % 9) * 0.02); x = U.lerp(src[0] + jit[i * 2] * 14, x, q); y = U.lerp(src[1] + jit[i * 2 + 1] * 14, y, q); }
        [x, y] = into(i, x, y);
        put(o, i, x, y, (b.pin && m % 11 === 0 ? 0.95 : on ? 0.95 : 0.62) * emph * dim * form * ing, lit, 0.05, on ? 1.25 : 1.1, b.pin && m % 11 === 0 ? GOLD : col);
      }
      /* usage — 그 스텝에서 바뀐 칸만 앞 값에서 뒤 값으로 */
      const [p0] = R['pip:' + b.id], ch = s.poolMod.has(b.id) && !end, uu = ch ? U.lerp(pb && pb.pg === b.pg ? pb.u : b.u0, b.u, show(p, 0.24, 0.4)) : b.u;
      for (let j = 0; j < MAXU; j++) {
        const fill = U.clamp(uu - j, 0, 1), cx = pips[bi].x + j * (pipS + pipG) + pipS / 2, cy = pips[bi].y + pipS / 2;
        for (let m = 0; m < PIP; m++) {
          const i = p0 + j * PIP + m, [x, y] = into(i, cx + ((m % 4) - 1.5) * (pipS / 4), cy + (Math.floor(m / 4) - 1.5) * (pipS / 4));
          put(o, i, x, y, (0.3 + 0.65 * fill) * dim * form, ch && fill > 0 ? 0.6 : 0, 0.02, 0.95, fill > 0.5 ? (ch ? GOLD : INK) : FAINT);
        }
      }
    });
    /* 바늘 · 축 */
    const [h0] = R.hand, len = Rr - sh * 0.75;
    for (let m = 0; m < HAND; m++) {
      const u = 0.08 + (m / (HAND - 1)) * 0.92, i = h0 + m, [x, y] = into(i, C.x + Math.cos(ha) * len * u, C.y + Math.sin(ha) * len * u);
      put(o, i, x, y, 0.92 * dim * form, end ? 0 : 0.5, 0.04, 1.15, GOLD);
    }
    const [u0] = R.hub;
    for (let m = 0; m < HUB; m++) { const a = (m / HUB) * Math.PI * 2, i = u0 + m, [x, y] = into(i, C.x + Math.cos(a) * 6, C.y + Math.sin(a) * 6); put(o, i, x, y, 0.8 * dim * form, 0, 0.03, 1, INK); }
    /* bgwriter 의 손 — 깨어나 dirty 를 쓴 칸을 가리킨다(시계 바늘 앞) */
    const [g0] = R.bgh, bt = s.pool.findIndex((b) => b.bgw), awake = /깨어남/.test(bare(s.bgw['상태'])) && bt >= 0;
    for (let m = 0; m < BGH; m++) {
      const i = g0 + m, u = 0.1 + (m / (BGH - 1)) * 0.6, a2 = bt >= 0 ? ang(bt) : ha;
      const [x, y] = into(i, C.x + Math.cos(a2) * len * u, C.y + Math.sin(a2) * len * u);
      put(o, i, x, y, awake ? 0.6 * dim * (s.touch.has('bgw') ? show(p, 0.06, 0.2) : 1) : 0, 0, 0.05, 1, ACCENT);
    }
    /* 파일의 페이지 */
    s.heap.forEach((h) => {
      const j = HEAPS.indexOf(h.id), [s0] = R['heap:' + h.id], hp = heaps[j], lk = s.heapMod.has(h.id) && !end;
      for (let m = 0; m < PAGE; m++) {
        const i = s0 + m, [gx, gy, ing] = grid(hp.x, hp.y, pw, ph, PAGE, m), [x, y] = into(i, gx, gy);
        put(o, i, x, y, (lk ? 0.95 : s.touch.has('heap') ? 0.7 : 0.45) * dim * form * ing, lk ? 0.7 : 0, 0.05, 1.05, lk ? GOLD : INK);
      }
    });
    /* act — 덩어리가 f 에서 t 로. 도착(0.42) 뒤 0.52 까지 흩어진다 */
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, act.lb), [tx, ty] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52);
      const arc = Math.sin(e * Math.PI) * Math.min(70, Math.hypot(tx - fx, ty - fy) * 0.25), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, r = Math.sqrt((m + 0.5) / tn) * 8, th = m * 2.399;
        put(o, i, U.lerp(fx, tx, e) + Math.cos(th) * r, U.lerp(fy, ty, e) + Math.sin(th) * r - arc, (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, col);
      }
    } else for (let m = 0; m < tn; m++) put(o, t0 + m, dust[(t0 + m) * 2], dust[(t0 + m) * 2 + 1], 0, 0, 2, 1, FAINT);
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
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
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    /* act 이름표 — 덩어리를 따라가고 0.52 까지 사라진다. 세계 밖으로 나가지 않게 묶는다 */
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, act.lb), [tx, ty] = anchor(act.t, s, act.lb), e = U.smooth(show(p, 0.08, 0.42));
      const arc = Math.sin(e * Math.PI) * Math.min(70, Math.hypot(tx - fx, ty - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty, e) - arc - 14);
      tok.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L, C, Rr, edgeY } = G;
    ctx.save();
    /* 시계 판 — 칸을 잇는 원 */
    ctx.globalAlpha = 0.28 * o; ctx.strokeStyle = css.faint; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.arc(C.x, C.y, Rr, 0, Math.PI * 2); ctx.stroke();
    /* 버퍼 → 파일 경계. 쓰기 · 읽기가 지나가는 스텝에 밝힌다 */
    if (EDGE) {
      const lit = (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot && !end;
      ctx.globalAlpha = (lit ? 0.95 : 0.45) * o; ctx.strokeStyle = lit ? css.gold : css.faint; ctx.lineWidth = lit ? 1.5 : 1; ctx.setLineDash(lit ? [] : [3, 4]);
      ctx.beginPath(); ctx.moveTo(L.x0, edgeY); ctx.lineTo(L.x1, edgeY); ctx.stroke();
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement);
      css = { faint: cs.getPropertyValue('--faint').trim(), gold: cs.getPropertyValue('--gold').trim() };
    },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
