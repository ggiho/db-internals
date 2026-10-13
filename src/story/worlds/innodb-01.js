/* mysql innodb 01 — 쓰기 경로. SQL 계층 · InnoDB 메모리 · 디스크의 세 띠와 그 사이의 두 경계(handler API · 메모리 | 디스크).
   모든 배우가 25 스텝 내내 제자리에 있다 — BUFFER POOL 의 p:5(c = 200)와 .ibd 의 p:5(c = 100)가 늘 함께 보인다.
   그리는 것은 모두 장면의 bake 상태에서 읽는다(손으로 적은 값이 없다) —
     · frame = BUFFER POOL 의 항목(순서 = LRU 의 자리), .ibd 의 항목. tag : clean 먹색 · dirty 빨강 · pin 금빛 · free 테두리만
     · UNDO · LOCK · FLUSH LIST · DOUBLEWRITE 의 항목은 작은 칩. 생기면 act 의 f 에서 날아오고, 지우면 흩어진다
     · LOG BUFFER 는 gg.v 만큼 찬 막대
     · LSN 자 = LOG BUFFER 의 assigned · redo 의 Log flushed up to · Last checkpoint at. assigned 와 flushed 사이가
       아직 durable 하지 않은 redo 다(손잡이 1 · 2 · 0 의 차이가 이 구간이다)
     · 셈 맞추기 — flushed 가 뒤로 가거나, .ibd 에 쓰인 page 의 LSN 이 그때의 flushed 보다 크면(WAL 위반),
       checkpoint 가 flushed 를 앞지르면 조용히 넘어가지 않고 console.error 로 알린다(storysweep 의 errors 가 잡는다)
     · act 는 덩어리가 f 에서 t 로(제자리 act 는 그 자리에서 고리). 경계를 지나는 스텝(hot)은 그 경계선이 밝아진다
     · 그 스텝이 건드린 배우(touch)는 또렷하게, 나머지는 흐리게. look 이 항목을 짚으면 그 항목만
   손잡이(innodb_flush_log_at_trx_commit)의 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';

const HANGUL = /[가-힣]/;
const FR = 160, CH = 60, GA = 140, TOK = 160, PTR = 24;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const lsn = (v) => { const m = /(\d[\d,]*)/.exec(bare(v)); return m ? +m[1].replace(/,/g, '') : null; };
const FRAMES = ['bp', 'ibd'], LISTS = ['undo', 'lock', 'fl', 'dw'], TEXTS = ['ses', 'stmt', 'bin', 'redo'];
/* 글 블록은 SQL 계층의 셋 — redo 의 값(flushed · checkpoint)과 LOG BUFFER 의 assigned 는 LSN 자의 바늘 이름이 그대로 적는다 */
const SHOWN = ['ses', 'stmt', 'bin'];
const TAGC = { clean: INK, dirty: RED, pin: GOLD, hold: GOLD, ok: INK, free: FAINT };

export default {
  count: (narrow) => (narrow ? 3800 : 5200),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;

  /* ── 상태 읽기 — 손잡이 값마다 ── */
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const items = (a) => ((st[a] && st[a].items) || []).map((it) => ({ id: it.id, tag: it.tag, sub: it.sub || '' }));
    const look = (step && step.look) || {};
    const s = { st, step: step || {}, touch: touch || new Set(), chg: chg || {}, look };
    for (const a of [...FRAMES, ...LISTS]) s[a] = items(a);
    for (const a of TEXTS) s[a] = (st[a] && st[a].kv) || {};
    s.lb = (st.lb && st.lb.kv) || {}; s.gg = (st.lb && st.lb.gg) || { v: 0, l: '', r: '' };
    s.assigned = lsn(s.lb['assigned up to']); s.flushed = lsn(s.redo['Log flushed up to']); s.ckpt = lsn(s.redo['Last checkpoint at']);
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k), S0 = read(sc.init);
    const S = frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch));
    /* 셈 맞추기 */
    const tag = `innodb 01 세계 (${sc.vary ? sc.vary.knob + '=' + (k ?? base) : '기본'})`;
    [S0, ...S].forEach((s, i) => {
      const at = i ? `${i} 스텝` : 'init', pv = i > 1 ? S[i - 2] : S0;
      if (i && s.flushed < pv.flushed) console.error(`${tag} : ${at} 의 Log flushed up to 가 뒤로 갔다 — ${pv.flushed} → ${s.flushed}`);
      if (s.ckpt > s.flushed) console.error(`${tag} : ${at} 의 checkpoint ${s.ckpt} 가 flushed ${s.flushed} 를 앞지른다`);
      if (i) for (const it of s.ibd) {
        const was = pv.ibd.find((x) => x.id === it.id), pl = lsn((/LSN\s*([\d,]+)/.exec(it.sub) || [])[1]);
        if (was && was.sub !== it.sub && pl != null && pl > s.flushed) console.error(`${tag} : ${at} 에 .ibd 의 ${it.id}(LSN ${pl}) 를 썼는데 flushed 는 ${s.flushed} — WAL 위반`);
      }
    });
    BAKES.set(k, { S0, S, NK: S.length });
  }
  let cur = BAKES.get(null) || [...BAKES.values()][0];
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const IDS = Object.fromEntries([...FRAMES, ...LISTS].map((a) => [a, [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))]]));
  const SLOTS = Object.fromEntries(FRAMES.map((a) => [a, Math.max(...all.map((s) => s[a].length))]));
  const MAXL = Object.fromEntries(LISTS.map((a) => [a, Math.max(1, ...all.map((s) => s[a].length))]));
  const LS = all.flatMap((s) => [s.assigned, s.flushed, s.ckpt]).filter((x) => x != null);
  const LMIN = Math.min(...LS), LMAX = Math.max(...LS);

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  for (const a of FRAMES) IDS[a].forEach((id) => take(a + ':' + id, FR));
  for (const a of LISTS) IDS[a].forEach((id) => take(a + ':' + id, CH));
  take('gauge', GA); take('tok', TOK);
  for (const p of ['ckpt', 'flushed', 'assigned']) take('ptr:' + p, PTR);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb 01 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

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
  const LN = deck.LANES || [], EDG = deck.EDGES || [];
  const hd = Object.fromEntries([...FRAMES, ...LISTS, ...TEXTS, 'lb'].map((a) => [a, label('aq')]));
  const tx = Object.fromEntries([...SHOWN, 'lb'].map((a) => [a, label('aq ml aq-b')]));
  /* frame 의 이름은 칸 아래 가운데, 칩의 이름은 블록 왼쪽에 맞춘다(칩이 왼쪽에 있다) */
  const itLb = Object.fromEntries([...FRAMES, ...LISTS].map((a) => [a, Object.fromEntries(IDS[a].map((id) => [id, label(FRAMES.includes(a) ? 'aq ml aq-c aq-b' : 'aq ml aq-b')]))]));
  const empty = Object.fromEntries(LISTS.map((a) => [a, label('aq')]));
  const laneLb = Object.fromEntries(LN.map((l) => { const lb = label('aq'); lb.lane = true; return [l.id, lb]; }));
  const edgeLb = EDG.map(() => label('aq'));
  const ptrLb = Object.fromEntries(['ckpt', 'flushed', 'assigned'].map((p) => [p, label('aq aq-b')]));
  const lsnLb = label('aq'), tok = label('stn-tok');
  const PTRK = { ckpt: ['redo', 'Last checkpoint at', 'checkpoint'], flushed: ['redo', 'Log flushed up to', 'flushed'], assigned: ['lb', 'assigned up to', 'assigned'] };

  /* 스텝마다의 글과 강조 — [글, 또렷한가, 색, 보이나, html]. 값마다 따로 */
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a]) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || [])] : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  /* 키는 흐리게, 값은 진하게 — 읽는 것은 값이다 */
  const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of [...FRAMES, ...LISTS, ...TEXTS, 'lb']) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of SHOWN) t.set(tx[a], [kvHtml(s[a]), on(a), '', true, true]);
    t.set(tx.lb, [`${esc(s.gg.l || 'log buffer')}  <span class="q-v">${esc(s.gg.r || '')}</span>`, on('lb'), '', true, true]);
    for (const a of [...FRAMES, ...LISTS]) for (const id of IDS[a]) {
      const it = s[a].find((x) => x.id === id);
      if (!it) { t.set(itLb[a][id], ['', false, '', false, true]); continue; }
      const cls = it.tag === 'dirty' ? 'q-r' : it.tag === 'pin' || it.tag === 'hold' ? 'q-g' : '';
      t.set(itLb[a][id], [`<span class="q-i">${esc(id)}</span>\n<span class="${cls}">${esc(it.sub)}</span>`, on(a) && hotIt(s, a, id), '', true, true]);
    }
    for (const a of LISTS) t.set(empty[a], ['—', false, '', !s[a].length]);
    for (const l of LN) t.set(laneLb[l.id], [`${l.lb}  ·  ${l.note}`, false]);
    EDG.forEach((e, i) => t.set(edgeLb[i], [e.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === e.hot ? 'gold' : '']));
    for (const [p, [a, k, nm]] of Object.entries(PTRK)) {
      const v = a === 'lb' ? s.lb[k] : s.redo[k], n = lsn(v);
      t.set(ptrLb[p], [`${nm}  ${n == null ? '—' : bare(v)}`, on(a), tone(v)]);
    }
    t.set(lsnLb, ['LSN', on('redo') || on('lb')]);
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => {
    let w = 0, h = 0;
    for (const t of TXALL) {
      const e = t.get(lb);
      if (!e || e[3] === false) continue;
      lb.el.innerHTML = e[0];
      const r = lb.el.getBoundingClientRect();
      w = Math.max(w, r.width); h = Math.max(h, r.height);
    }
    lb.t = null;
    return { w, h };
  };

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(9);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18, cw = 34, chh = 18;
    /* 띠마다 고정 열 — 흘려 놓으면 좁은 폭에서 줄이 늘어 1024 에서 세계 높이(606)를 265px 넘었다 */
    const col = (n) => (ww - (n - 1) * gap) / n;
    const fw = Math.round(U.clamp((ww - (SLOTS.bp - 1) * 12) / SLOTS.bp, 70, 132));
    const dwW = Math.round(Math.max(96, col(5))), fi = Math.round(Math.min(fw, (ww - gap - dwW - (SLOTS.ibd - 1) * 12) / SLOTS.ibd));
    const tW = col(SHOWN.length), qW = col(4);
    for (const a of SHOWN) wrap(tx[a], tW);
    wrap(tx.lb, qW);
    for (const a of ['undo', 'lock', 'fl']) for (const id of IDS[a]) wrap(itLb[a][id], qW);
    for (const id of IDS.bp) wrap(itLb.bp[id], fw + 8);
    for (const id of IDS.ibd) wrap(itLb.ibd[id], fi + 8);
    for (const id of IDS.dw) wrap(itLb.dw[id], dwW);
    for (const pk of Object.keys(PTRK)) wrap(ptrLb[pk], ww * 0.62);
    const hMax = (lbs) => Math.max(16, ...lbs.map((lb) => most(lb).h));
    const tH = hMax(SHOWN.map((a) => tx[a])), bpH = hMax(IDS.bp.map((id) => itLb.bp[id])), ibH = hMax(IDS.ibd.map((id) => itLb.ibd[id]));
    const qH = Math.max(20 + most(tx.lb).h, chh + 8 + hMax(['undo', 'lock', 'fl'].flatMap((a) => IDS[a].map((id) => itLb[a][id])))), dwH = chh + 8 + hMax(IDS.dw.map((id) => itLb.dw[id]));
    const pH = hMax(Object.keys(PTRK).map((pk) => ptrLb[pk]));
    /* 높이가 모자라면 — 레인 이름 줄을 빼고, 그래도 모자라면 frame 을 낮춘다 */
    /* 경계 한 줄 = 위 여백 22(이름표가 위 블록에 닿지 않게) + 아래 14. LSN 자 = 바늘(위아래 13px) 밖에 이름 */
    const need = (fh, lanes) => (lanes ? 3 * 22 : 0) + HD + tH + 36 + HD + fh + 8 + bpH + 16 + HD + qH + 36 + HD + fh + 8 + Math.max(ibH, dwH) + 24 + HD + pH + 16 + 16 + pH + 4 + pH;
    const tiers = [[Math.round(fw * 0.42), true], [Math.round(fw * 0.42), false], [Math.max(22, Math.round(fw * 0.28)), false], [20, false]];
    const [fh, lanes] = tiers.find(([f, l]) => need(f, l) <= wh) || tiers[tiers.length - 1];
    const dy = L.narrow ? 0 : Math.max(0, (wh - need(fh, lanes)) / 2);
    G = { L, fw, fi, fh, cw, chh, lanes, slot: {}, anc: {}, lbx: {}, edges: [] };
    let y = L.y0 + dy;
    const lane = (id) => { if (lanes) { place(laneLb[id], L.x1, y, 'r'); y += 22; } };
    const edge = (i) => { y += 22; G.edges[i] = y; place(edgeLb[i], L.x1, y - 3, 'r', 'b'); y += 14; };
    const frames = (a, x, w, y0) => {
      const n = SLOTS[a];
      place(hd[a], x, y0);
      G.slot[a] = Array.from({ length: n }, (_, j) => ({ x: x + w / 2 + j * (w + 12), y: y0 + HD + fh / 2 }));
      G.anc[a] = { x: x + (n * w + (n - 1) * 12) / 2, y: y0 + HD + fh / 2 };
    };
    const chips = (a, x, y0) => {
      place(hd[a], x, y0); place(empty[a], x, y0 + HD + 2);
      G.slot[a] = Array.from({ length: MAXL[a] }, (_, j) => ({ x: x + cw / 2 + j * (cw + 8), y: y0 + HD + chh / 2 }));
      G.lbx[a] = x; G.anc[a] = { x: x + cw / 2, y: y0 + HD + chh / 2 };
    };
    lane('sql');
    /* 글 블록의 act 자리는 머리글 줄의 오른쪽 빈 곳 — 글 위에서 출발하거나 돌면 값을 덮는다(15 : binlog fsync 의 고리) */
    SHOWN.forEach((a, i) => { const x = L.x0 + i * (tW + gap); place(hd[a], x, y); place(tx[a], x, y + HD); G.anc[a] = { x: x + tW - 18, y: y + 8 }; });
    y += HD + tH;
    edge(0);
    lane('mem');
    frames('bp', L.x0, fw, y);
    y += HD + fh + 8 + bpH + 16;
    place(hd.lb, L.x0, y); place(tx.lb, L.x0, y + HD + 20);
    G.gauge = { x: L.x0, y: y + HD + 6, w: Math.min(qW, 160) }; G.anc.lb = { x: L.x0 + 20, y: y + HD + 6 };
    ['undo', 'lock', 'fl'].forEach((a, i) => chips(a, L.x0 + (i + 1) * (qW + gap), y));
    y += HD + qH;
    edge(1);
    lane('disk');
    frames('ibd', L.x0, fi, y);
    chips('dw', L.x1 - dwW, y);
    y += HD + fh + 8 + Math.max(ibH, dwH) + 24;
    place(hd.redo, L.x0, y);
    y += HD + pH + 16;
    G.ruler = { y, x0: L.x0 + 34, x1: L.x1 - 8, pH };
    place(lsnLb, L.x0, y, 'l', 'c');
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  const lsnX = (n) => G.ruler.x0 + ((n - LMIN) / Math.max(1, LMAX - LMIN)) * (G.ruler.x1 - G.ruler.x0);
  const slotOf = (s, a, id) => { const j = s[a].findIndex((x) => x.id === id); return j >= 0 ? G.slot[a][Math.min(j, G.slot[a].length - 1)] : null; };

  /* 배우의 자리 — act 의 덩어리가 오가는 곳. frame 묶음은 act 이름이 짚는 page, 없으면 그 스텝에서 바뀐 것 */
  function anchor(a, s, lbText) {
    if (FRAMES.includes(a) || LISTS.includes(a)) {
      const m = /p:\d+/.exec(lbText || ''), ids = s[a].map((x) => x.id);
      const id = (m && ids.includes(m[0]) && m[0]) || [...modOf(s, a)][0] || (focusOf(s, a) && [...focusOf(s, a)][0]) || null;
      const P = id ? slotOf(s, a, id) : null;
      return P ? [P.x, P.y] : [G.anc[a].x, G.anc[a].y];
    }
    if (a === 'redo') return [lsnX(s.flushed ?? LMIN), G.ruler.y];   /* redo 는 LSN 자의 flushed 바늘 */
    const P = G.anc[a];
    return P ? [P.x, P.y] : [G.L.x0, G.L.y0];
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  /* 격자 — 줄 수를 내림으로 잡는다(마지막 줄이 덜 차지 않게). 남는 알갱이는 셋째 값이 false — 숨긴다 */
  function grid(cx, cy, w, h, n, m) {
    const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h)))), rows = Math.max(1, Math.floor(n / cols));
    return [cx - w / 2 + ((m % cols) + 0.5) / cols * w, cy - h / 2 + (Math.floor(m / cols) % rows + 0.5) / rows * h, m < cols * rows];
  }
  function rim(cx, cy, w, h, n, m) {
    const per = 2 * (w + h), d = (m / n) * per;
    if (d < w) return [cx - w / 2 + d, cy - h / 2];
    if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)];
    if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2];
    return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)];
  }
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
    const src = act ? anchor(act.f, s, act.lb) : null;
    /* frame · 칩 — 같은 규칙. 생기면 act 의 f 에서(act 가 그 배우로 가면), 자리가 바뀌면 옮겨 가고, 지우면 흩어진다 */
    const body = (a, n, w, h) => {
      const on = s.touch.has(a) && !end;
      for (const id of IDS[a]) {
        const key = a + ':' + id, [r0] = R[key], it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
        if (!it && !(pv && !end)) { hide(key); continue; }
        const P = it ? slotOf(s, a, id) : slotOf(prev, a, id), PV = pv ? slotOf(prev, a, id) : null;
        if (!P) { hide(key); continue; }
        const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === a ? src : null;
        const moved = it && PV && (PV.x !== P.x || PV.y !== P.y) && !end, mv = moved ? show(p, 0.12, 0.4) : 1;
        const tg = (it || pv).tag, free = tg === 'free', ptag = pv && pv.tag, retag = it && pv && ptag !== tg && !end;
        const f0 = focusOf(s, a), lit = !end && on && (f0 ? f0.has(id) : modOf(s, a).has(id));
        const a0 = (on ? (hotIt(s, a, id) ? 0.92 : 0.55) : 0.45) * dim * form;
        for (let m = 0; m < n; m++) {
          const i = r0 + m, f = m / n;
          const cx = moved ? U.lerp(PV.x, P.x, mv) : P.x, cy = moved ? U.lerp(PV.y, P.y, mv) : P.y;
          let [x, y, ing = true] = free ? rim(cx, cy, w, h, n, m) : grid(cx, cy, w, h, n, m);
          if (from) { const e = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 14, x, e); y = U.lerp(from[1] + jit[i * 2 + 1] * 14, y, e) - Math.sin(e * Math.PI) * 24; }
          if (gone) { x += jit[i * 2] * 30 * gone; y += jit[i * 2 + 1] * 30 * gone - 10 * gone; }
          [x, y] = into(i, x, y);
          /* 태그가 바뀌면 알갱이마다 차례로 새 색 */
          const col = retag && p < 0.14 + f * 0.24 ? TAGC[ptag] ?? INK : TAGC[tg] ?? INK;
          put(o, i, x, y, (free ? a0 * 0.5 * (m % 2) : a0) * (1 - gone) * ing, lit ? 0.5 : 0, 0.05, 1.1, col);
        }
      }
    };
    body('bp', FR, G.fw, G.fh); body('ibd', FR, G.fi, G.fh);
    for (const a of LISTS) body(a, CH, G.cw, G.chh);
    /* LOG BUFFER — gg.v 만큼 찬 막대(빈 쪽은 테두리) */
    const [g0] = R.gauge, gv = end ? s.gg.v : U.lerp(prev.gg.v || 0, s.gg.v || 0, show(p, 0.24, 0.44)), gOn = s.touch.has('lb') && !end, Gg = G.gauge;
    for (let m = 0; m < GA; m++) {
      const i = g0 + m, c = m % 35, r = Math.floor(m / 35), u = (c + 0.5) / 35;
      const [x, y] = into(i, Gg.x + u * Gg.w, Gg.y - 4.5 + r * 3);
      const fill = u <= gv, edge = r === 0 || r === 3;
      put(o, i, x, y, (fill ? 0.92 : edge ? 0.6 : 0.12) * (gOn ? 1 : 0.6) * dim * form, fill && gOn ? 0.4 : 0, 0.02, 1.05, fill ? INK : FAINT);
    }
    /* LSN 자의 바늘 — 값이 바뀐 스텝은 앞 값에서 뒤 값으로 */
    for (const [pk, [a, key]] of Object.entries(PTRK)) {
      const [p0] = R['ptr:' + pk], v = a === 'lb' ? s.lb[key] : s.redo[key], pvv = a === 'lb' ? prev.lb[key] : prev.redo[key];
      const n = lsn(v), n0 = lsn(pvv) ?? n, xx = lsnX(end ? n : U.lerp(n0, n, show(p, 0.26, 0.46)));
      const up = pk === 'assigned', col = { green: GREEN, gold: GOLD, red: RED }[tone(v)] || (pk === 'ckpt' ? FAINT : INK), on = s.touch.has(a) && !end;
      for (let m = 0; m < PTR; m++) {
        const i = p0 + m, r = Math.floor(m / 6), c = (m % 6) - 2.5, wd = (4 - r) / 4;
        const [x, y] = into(i, xx + c * wd * 1.6, G.ruler.y + (up ? -(4 + r * 2.4) : 4 + r * 2.4));
        put(o, i, x, y, (on ? 0.95 : 0.6) * dim * form, on ? 0.4 : 0, 0.02, 1.15, col);
      }
    }
    /* act — 덩어리가 f 에서 t 로. 제자리 act(f = t)는 그 자리에서 고리 */
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(60, Math.hypot(tx2 - fx, ty2 - fy) * 0.25), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399;
        const r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 8;
        put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, U.lerp(fy, ty2, e) + Math.sin(th) * r - arc, (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, col);
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
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
      }
      /* 항목 이름 — 그 스텝의 자리 아래. 칩의 이름은 블록의 왼쪽에서 */
      const s = S[kk];
      for (const a of FRAMES) for (const it of s[a]) { const P = slotOf(s, a, it.id); if (P) place(itLb[a][it.id], P.x, P.y + G.fh / 2 + 8, 'c', 't'); }
      for (const a of LISTS) for (const it of s[a]) { const P = slotOf(s, a, it.id); if (P) place(itLb[a][it.id], G.lbx[a], P.y + G.chh / 2 + 8, 'l', 't'); }
      /* LSN 바늘 이름 — assigned 는 자 위, flushed · checkpoint 는 자 아래 두 줄. 바늘 가운데에 두되 세계 안으로 묶는다 */
      for (const [pk, [a, key]] of Object.entries(PTRK)) {
        const lb = ptrLb[pk], n = lsn(a === 'lb' ? s.lb[key] : s.redo[key]), w = lb.el.offsetWidth, R0 = G.ruler;
        const x = U.clamp(lsnX(n) - w / 2, G.L.x0, G.L.x1 - w);
        if (pk === 'assigned') place(lb, x, R0.y - 16, 'l', 'b');
        else place(lb, x, R0.y + 16 + (pk === 'flushed' ? 0 : R0.pH + 4), 'l', 't');
      }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      /* 레인 이름은 세로 여유가 있을 때만(build 가 정한다) — CSS 로 숨기지 않는다(label-hidden) */
      setO(lb, vis && !(lb.lane && !G.lanes) ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    /* act 이름표 — 덩어리를 따라가고 0.52 까지 사라진다. 세계 밖으로 나가지 않게 묶는다 */
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, act.lb), [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(show(p, 0.08, 0.42));
      const arc = act.f === act.t ? 0 : Math.sin(e * Math.PI) * Math.min(60, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arc - (act.f === act.t ? 34 : 14));
      tok.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L, ruler } = G;
    ctx.save();
    /* 경계 — 그 스텝이 지나가는 경계(hot)는 금빛 실선 */
    const hot = s.step.hot || (s.step.act && s.step.act.hot);
    EDG.forEach((e, i) => {
      const yy = G.edges[i];
      if (yy == null) return;
      const lit = hot === e.hot && !end;
      ctx.globalAlpha = (lit ? 0.95 : 0.45) * o; ctx.strokeStyle = lit ? css.gold : css.faint; ctx.lineWidth = lit ? 1.5 : 1; ctx.setLineDash(lit ? [] : [3, 4]);
      ctx.beginPath(); ctx.moveTo(L.x0, yy); ctx.lineTo(L.x1, yy); ctx.stroke();
    });
    /* LSN 자 — checkpoint ~ flushed 는 복구에 필요한 redo, flushed ~ assigned 는 아직 durable 하지 않은 redo */
    const nA = s.assigned, nF = s.flushed, nC = s.ckpt;
    ctx.setLineDash([]); ctx.lineWidth = 1; ctx.globalAlpha = 0.5 * o; ctx.strokeStyle = css.faint;
    ctx.beginPath(); ctx.moveTo(ruler.x0, ruler.y); ctx.lineTo(ruler.x1, ruler.y); ctx.stroke();
    const band = (n0, n1, col, a) => { if (n0 == null || n1 == null || n1 <= n0) return; ctx.globalAlpha = a * o; ctx.fillStyle = col; ctx.fillRect(lsnX(n0), ruler.y - 2, lsnX(n1) - lsnX(n0), 4); };
    band(nC, nF, css.ink, 0.25);
    band(nF, nA, css.red, 0.55);
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red') };
    },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
