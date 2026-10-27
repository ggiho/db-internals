/* mysql innodb 10 — 클러스터 인덱스의 분할. 그리는 것은 모두 bake 상태에서 읽는다 —
     · B+tree = tree 배우. 항목의 lvl 이 깊이(0 이 루트), keys 가 칸의 글, fill 이 채운 비율 — 칸 안의 막대와 백분율.
       90% 이상은 초록, 60% 이상은 금빛, 그 아래는 빨강. 부모와 자식은 데이터에 링크가 없으므로 순서대로 고르게 나눠 잇는다
     · 나머지 kv 는 글 블록(SQL 층), 나머지 list · frames 는 칸 줄
     · 셈 맞추기 — 루트(lvl 0)가 하나가 아니거나, 깊이가 0 부터 빠짐없이 이어지지 않거나, fill 이 0~1 밖이면 console.error
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';

const HANGUL = /[가-힣]/;
const SL = 44, TOK = 150, NODEN = 56, FILLN = 24;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT };
const fillCol = (f) => (f >= 0.9 ? GREEN : f >= 0.6 ? GOLD : RED);
const fillCls = (f) => (f >= 0.9 ? 'green' : f >= 0.6 ? 'gold' : 'red');

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      if (A[a].kind === 'kv') s[a] = (st[a] && st[a].kv) || {};
      else s[a] = ((st[a] && st[a].items) || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
    }
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k), S0 = read(sc.init);
    BAKES.set(k, { S0, S: frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch)), NK: frames.length });
  }
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const TEXTS = cast.filter((a) => A[a].kind === 'kv');
  const TR = cast.find((a) => A[a].kind === 'tree') || null;
  const ROWS = cast.filter((a) => A[a].kind === 'list' || A[a].kind === 'frames');
  const ids = (a) => [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  const TIDS = TR ? ids(TR) : [];
  const levels = (s) => { const by = new Map(); for (const it of s[TR]) { const l = it.lvl ?? 0; if (!by.has(l)) by.set(l, []); by.get(l).push(it); } return [...by.entries()].sort((p, q) => p[0] - q[0]).map(([, v]) => v); };

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    if (!TR) return;
    const at = `innodb ${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    const ls = [...new Set(s[TR].map((x) => x.lvl ?? 0))].sort((p, q) => p - q);
    if (s[TR].filter((x) => (x.lvl ?? 0) === 0).length !== 1) console.error(`${at} : 루트(lvl 0)가 ${s[TR].filter((x) => (x.lvl ?? 0) === 0).length} 개다`);
    ls.forEach((l, j) => { if (l !== j) console.error(`${at} : 깊이가 이어지지 않는다 — ${ls.join(', ')}`); });
    for (const it of s[TR]) if (it.fill != null && (it.fill < 0 || it.fill > 1)) console.error(`${at} : ${it.id} 의 fill ${it.fill} 가 0~1 밖이다`);
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  TIDS.forEach((id) => { take('n:' + id, NODEN); take('f:' + id, FILLN); });
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb tree 세계 : 알갱이가 모자란다');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') { const el = document.createElement('div'); el.className = 'wl ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; }
  function setText(lb, s, html = false) { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls)); }
  function place(lb, x, y, al = 'l', va = 't') { const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%'; lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`; }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const EDG = deck.EDGES || [];
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const nLb = Object.fromEntries(TIDS.map((id) => [id, { n: label('aq aq-c'), k: label('aq aq-c'), f: label('aq aq-c') }]));
  const lvLb = [0, 1, 2, 3].map(() => label('aq'));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const edgeLb = EDG.map(() => label('aq')), tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const DISK = new Set(ROWS.filter((a) => A[a].lane === 'disk'));
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], focusOf(s, a)), on(a), '', true, true]);
    if (TR) {
      const ls = levels(s);
      for (const id of TIDS) {
        const it = s[TR].find((x) => x.id === id), hot = !!it && on(TR) && hotIt(s, TR, id), leaf = it && (it.lvl ?? 0) === ls.length - 1 && ls.length > 1;
        t.set(nLb[id].n, [it ? id : '', hot, '', !!it]);
        t.set(nLb[id].k, [it ? it.keys || '' : '', hot, '', !!it && !!it.keys]);
        /* 채움 백분율은 잎에만 — 루트 · 중간 노드의 fill 은 그림의 자리 표시다 */
        t.set(nLb[id].f, [it && leaf && it.fill != null ? Math.round(it.fill * 100) + '%' : '', hot, it && it.fill != null ? fillCls(it.fill) : '', !!it && !!leaf && it.fill != null]);
      }
      lvLb.forEach((lb, j) => t.set(lb, [j < ls.length ? (j === 0 ? 'root' : j === ls.length - 1 ? 'leaf' : '중간') : '', false, '', j < ls.length]));
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && (it.tag === 'x' || it.tag === 'dirty') ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    /* 메모리 · 디스크 점선은 두 칸 줄을 위아래로 놓을 때만 — 하나씩이면 나란히 두고 긋지 않는다 */
    const pairable = ROWS.filter((a) => !DISK.has(a)).length === 1 && ROWS.filter((a) => DISK.has(a)).length === 1;
    EDG.forEach((e, i) => t.set(edgeLb[i], [e.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === e.hot ? 'gold' : '', i === 0 ? TEXTS.length > 0 : ROWS.some((a) => DISK.has(a)) && !pairable]));
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => { let w = 0, h = 0; const keep = lb.el.innerHTML; for (const t of TXALL) { const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); } lb.el.innerHTML = keep; return { w, h }; };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(61);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const NH = 46, LGAP = 32;
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {} };
    let tn = Math.max(1, Math.min(3, TEXTS.length));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const tW = (ww - (tn - 1) * gap) / tn;
    for (const a of TEXTS) wrap(tx[a], tW);
    const tRows = Math.ceil(TEXTS.length / tn), tHs = Array.from({ length: tRows }, (_, r) => hMax(TEXTS.slice(r * tn, r * tn + tn).map((a) => tx[a])));
    /* 노드 폭 — 이름과 키 글 중 넓은 것, 단 한 수준의 노드가 다 들어가는 폭까지 */
    const maxPer = TR ? Math.max(1, ...all.map((s) => Math.max(...levels(s).map((l) => l.length)))) : 1;
    const lvW = 46;
    G.nw = TR ? Math.min((ww - lvW - (maxPer - 1) * 14) / maxPer, Math.max(80, ...TIDS.map((id) => Math.max(most(nLb[id].n).w, most(nLb[id].k).w) + 16))) : 0;
    for (const id of TIDS) wrap(nLb[id].k, G.nw - 8);
    G.lvW = lvW;
    const nLv = TR ? Math.max(1, ...all.map((s) => levels(s).length)) : 0;
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    const rc = ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    const MEMR = ROWS.filter((a) => !DISK.has(a)), DSKR = ROWS.filter((a) => DISK.has(a));
    const rcH = {}, rSide = {};
    for (const a of ROWS) {
      const used = RIDS[a].reduce((t, id) => t + sw[a][id] + 6, -6), sideW = rW - used - 12;
      wrap(rowCap[a], rW); const hb = most(rowCap[a]).h;
      let hs = Infinity; if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      rSide[a] = Math.max(26, hs) < 26 + 8 + hb ? used + 12 : 0; if (!rSide[a]) wrap(rowCap[a], rW);
      rcH[a] = rSide[a] ? hs : hb;
    }
    const lay = (y0, k = 1) => {
      let y = y0;
      const rowY = [y]; for (let r = 0; r < tRows; r++) rowY.push(rowY[r] + HD + tHs[r] + 12 * k);
      TEXTS.forEach((a, i) => { const x = L.x0 + (i % tn) * (tW + gap), yy = rowY[Math.floor(i / tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + tW - 18, y: yy + 8 }; });
      y = rowY[tRows];
      G.edgeY = [null, null];
      if (TEXTS.length && EDG[0]) { y += 2 * k; G.edgeY[0] = y; place(edgeLb[0], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
      if (TR) {
        place(hd[TR], L.x0, y); y += HD + 4;
        G.tree = { y0: y + NH / 2 }; G.anc[TR] = { x: L.x0 + ww / 2, y: y + NH / 2 };
        y += nLv * NH + (nLv - 1) * LGAP + 14 + 12 * k;
      }
      /* 메모리 쪽 칸 줄과 디스크 쪽 칸 줄을 나란히 — 둘 다 짧다 */
      const pair = MEMR.length === 1 && DSKR.length === 1;
      const bands = pair ? [[MEMR[0], DSKR[0]]] : [...MEMR, ...DSKR].map((a) => [a]);
      if (!pair && DSKR.length && EDG[1]) { /* 점선은 메모리 · 디스크 사이 — 나란히 둘 때는 생략 */ }
      for (const band of bands) {
        if (!pair && DISK.has(band[0]) && G.edgeY[1] == null && MEMR.length && EDG[1]) { y += 4 * k; G.edgeY[1] = y; place(edgeLb[1], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
        let hh = 0;
        band.forEach((a, j) => {
          const x0 = L.x0 + j * (rW + gap);
          place(hd[a], x0, y); G.slot[a] = { x0, y: y + HD, sw: sw[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + 13 };
          if (rSide[a]) { place(rowCap[a], x0 + rSide[a], y + HD + 4); hh = Math.max(hh, HD + Math.max(26, rcH[a] + 4)); }
          else { place(rowCap[a], x0, y + HD + 26 + 8); hh = Math.max(hh, HD + 26 + 8 + rcH[a]); }
        });
        y += hh + 14 * k;
      }
      G.pair = pair;
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`innodb ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    HT = total;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 노드 자리 — 수준마다 가운데 정렬, 수준 이름 몫(lvW)을 왼쪽에 둔다 */
  const nodeAt = (s, id) => {
    const ls = levels(s);
    for (let l = 0; l < ls.length; l++) {
      const j = ls[l].findIndex((x) => x.id === id);
      if (j < 0) continue;
      const n = ls[l].length, span = n * G.nw + (n - 1) * 14, x0 = G.L.x0 + G.lvW + (G.L.x1 - G.L.x0 - G.lvW - span) / 2;
      return { x: x0 + G.nw / 2 + j * (G.nw + 14), y: G.tree.y0 + l * (NH + LGAP), l, j, n };
    }
    return null;
  };
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  function anchor(a, s, lbText) {
    if (a === TR && G.tree) { const id = TIDS.find((x) => (lbText || '').includes(x)) || [...modOf(s, TR)].find((x) => TIDS.includes(x)); const P = id ? nodeAt(s, id) : null; if (P) return [P.x, P.y]; }
    if (ROWS.includes(a)) { const id = RIDS[a].find((x) => (lbText || '').includes(x)) || [...modOf(s, a)][0]; const P = id ? rowSlot(s, a, id) : null; if (P) return [P.x, P.y]; }
    const P = G.anc[a];
    return P ? [P.x, P.y] : [G.L.x0, G.L.y0];
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  function rim(cx, cy, w, h, n, m) { const per = 2 * (w + h), d = (m / n) * per; if (d < w) return [cx - w / 2 + d, cy - h / 2]; if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)]; if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2]; return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)]; }
  let O = null;
  const hide = (k) => { const [a, b] = R[k]; for (let i = a; i < b; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const { S, S0, NK } = cur, end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const src = act ? anchor(act.f, s, act.lb) : null, mv = show(p, 0.12, 0.42);
    if (TR) {
      const on = s.touch.has(TR) && !end, ls = levels(s);
      for (const id of TIDS) {
        const it = s[TR].find((x) => x.id === id), pv = prev[TR].find((x) => x.id === id);
        const P1 = it ? nodeAt(s, id) : null, P0 = pv ? nodeAt(prev, id) : null;
        if (!P1 && !(P0 && !end)) { hide('n:' + id); hide('f:' + id); continue; }
        /* 깊이가 바뀐 노드(루트를 올릴 때 잎이 한 단 내려간다)는 옛 자리에서 미끄러진다 */
        const P = P1 && P0 && !end ? { x: U.lerp(P0.x, P1.x, mv), y: U.lerp(P0.y, P1.y, mv) } : P1 || P0;
        const gone = it ? 0 : show(p, 0.1, 0.4), lit = it && on && hotIt(s, TR, id), lv = (lit ? 0.95 : on ? 0.6 : 0.45) * dim * form * (1 - gone);
        const born = it && !pv && !end, from = born && act ? src : null;
        for (let m = 0; m < NODEN; m++) {
          const i = R['n:' + id][0] + m, f = m / NODEN;
          let [x, y] = rim(P.x, P.y, G.nw, NH, NODEN, m);
          if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q) - Math.sin(q * Math.PI) * 18; }
          if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
          const [xx, yy] = into(i, x, y);
          put(o, i, xx, yy, lv, lit ? 0.3 : 0, 0.03, 1.1, INK);
        }
        /* 채움 막대 — 잎만, 칸 바닥 안쪽. fill 이 바뀌면 옛 길이에서 늘거나 준다 */
        const leaf = it && (it.lvl ?? 0) === ls.length - 1 && ls.length > 1, fl = it ? it.fill ?? 0 : 0, f0 = pv && pv.fill != null ? pv.fill : fl, ff = end ? fl : U.lerp(f0, fl, mv);
        for (let m = 0; m < FILLN; m++) {
          const i = R['f:' + id][0] + m;
          if (!leaf) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
          const u = m / (FILLN - 1), x = P.x - G.nw / 2 + 6 + u * (G.nw - 12), filled = u <= ff, [xx, yy] = into(i, x, P.y + NH / 2 - 5);
          put(o, i, xx, yy, (filled ? 0.95 : 0.25) * lv, filled && lit ? 0.4 : 0, 0.02, filled ? 2.4 : 1.2, filled ? fillCol(fl) : FAINT);
        }
      }
    }
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const gone = it ? 0 : show(p, 0.1, 0.4), tg = (it || pv).tag, lv = (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
      for (let m = 0; m < SL; m++) { const i = R[key][0] + m; let [x, y] = rim(P.x, P.y, P.w, 24, SL, m); if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; } const [xx, yy] = into(i, x, y); put(o, i, xx, yy, lv * (1 - gone), 0, 0.03, 1.1, TAGC[tg] ?? INK); }
    }
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
        put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, Math.max(G.L.y0 + 4, U.lerp(fy, ty2, e) + Math.sin(th) * r - arc), (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, act.gold ? GOLD : ACCENT);
      }
    } else hide('tok');
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK, TX } = cur;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = TX[Math.min(k, NK - 1)], TB = TX[Math.min(next, NK - 1)], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) { setText(lb, txt, html); for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c); }
      const s = S[kk];
      if (TR) {
        /* 칸 안 — 위에 이름(오른쪽 위에 백분율), 가운데 키, 바닥에 채움 막대. 키를 막대에 붙였더니 막대가 키 글을 덮었다 */
        for (const it of s[TR]) { const P = nodeAt(s, it.id); if (!P) continue; place(nLb[it.id].n, P.x, P.y - NH / 2 + 3, 'c', 't'); place(nLb[it.id].k, P.x, P.y - 4, 'c', 't'); place(nLb[it.id].f, P.x + G.nw / 2 - 4, P.y - NH / 2 + 3, 'r', 't'); }
        levels(s).forEach((_, l) => place(lvLb[l], G.L.x0, G.tree.y0 + l * (NH + LGAP), 'l', 'c'));
      }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    let o = act ? show(p, 0.06, 0.12) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, act.lb), [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(show(p, 0.08, 0.42));
      const arc = act.f === act.t ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arc - (act.f === act.t ? 30 : 14));
      const [qx, qy, keep] = dockAt(F, tok.el, s, p, x, y, G.L, tx2, ty2); o *= keep;
      tok.el.style.transform = `translate(${qx}px, ${qy}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save(); ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]);
    for (const y of G.edgeY) if (y != null) seg(ctx, L.x0, y, L.x1, y);
    ctx.setLineDash([]);
    if (TR) {
      /* 부모 → 자식 — 다음 수준의 노드를 순서대로 고르게 나눈다 */
      const ls = levels(s);
      ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.ink;
      for (let l = 0; l + 1 < ls.length; l++) {
        const par = ls[l], ch = ls[l + 1];
        ch.forEach((c, j) => {
          const pi = Math.min(par.length - 1, Math.floor((j * par.length) / ch.length)), P = nodeAt(s, par[pi].id), C = nodeAt(s, c.id);
          if (P && C) seg(ctx, P.x, P.y + NH / 2, C.x, C.y - NH / 2);
        });
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); return HT; },
    theme() { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim(); css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') }; },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
