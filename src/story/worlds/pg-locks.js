/* postgres locks — 모든 장면이 같은 세계를 쓴다. 장면이 쓰는 배우만 그린다. 그리는 것은 모두 bake 상태에서 읽는다 —
     · matrix 배우 = 충돌 행렬. '-' 칸은 막힘(빨강), '+' 칸은 허용. 데이터의 on 이 가리키는 칸은 금빛 테두리, dim 은 흐리게.
       행 = 이미 걸린 락, 열 = 새 요청
     · 락 큐(list, 항목에 q 와 mode 가 있을 때) = LOCK 객체 하나. 왼쪽이 granted, 오른쪽이 wait queue(줄 순서 그대로).
       아래에 grantMask · waitMask 를 8 비트로 — 세계가 항목의 mode 로 셈한다(lock.h 의 LOCK 구조체 두 필드).
       항목에 req 가 있으면 그 요청의 conflictTab 을 함께 그려 & 결과를 보인다
     · graph 배우 = 노드 칸과 간선 화살표(대기 · rw-conflict)
     · 나머지 kv 는 글 블록, 나머지 list 는 칸 줄
     · 셈 맞추기 — 장면의 8 × 8 행렬이 아래 LockConflicts(lock.c 의 배열을 그대로 옮긴 것)와 다르거나, 큐 항목의 mode 를
       모르면 console.error 로 알린다. 행렬 자체는 tools/pgmx.js 가 소스와 칸 단위로 대조한다
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
/* MC : 행렬 칸 하나의 알갱이(4 × 4) · BG : 마스크 비트 하나의 알갱이(4 × 3) — 비트가 알갱이 넷이라 켠 비트와 끈 비트가 거의 같아 보였다(06 · 08) */
const SL = 44, MC = 16, BG = 12, QB = 8 * BG, SB = 120, TOK = 150, RH = 15;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: GOLD, gold: GOLD, hold: GOLD, pin: GOLD, hdr: ACCENT, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
/* lockdefs.h 의 모드 1 ‥ 8 과 lock.c 의 LockConflicts[] — 모드마다 충돌하는 모드의 집합 */
const MODES = ['AccessShare', 'RowShare', 'RowExclusive', 'ShareUpdateExclusive', 'Share', 'ShareRowExclusive', 'Exclusive', 'AccessExclusive'];
const SHORT = ['AS', 'RS', 'RE', 'SUE', 'S', 'SRE', 'X', 'AX'];
const CONF = [[8], [7, 8], [5, 6, 7, 8], [4, 5, 6, 7, 8], [3, 4, 6, 7, 8], [3, 4, 5, 6, 7, 8], [2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]];
const modeNo = (m) => { const s = String(m || '').replace(/Lock$/, ''); const i = MODES.indexOf(s); return i >= 0 ? i + 1 : SHORT.indexOf(s) + 1; };
const maskOf = (ms) => ms.reduce((t, m) => t | (m > 0 ? 1 << m : 0), 0);
const confMask = (m) => (m > 0 ? maskOf(CONF[m - 1]) : 0);

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);

  /* ── 상태 읽기 ── */
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      const k = A[a].kind, x = st[a] || {};
      if (k === 'kv') s[a] = x.kv || {};
      else if (k === 'matrix') s[a] = x.mx || { rows: [], cols: [], cells: [] };
      else if (k === 'bytes') { s[a] = (x.items || []).map((it) => ({ ...it, id: String(it.id), sub: it.sub || '' })); s[a].byl = x.byl || null; }
      else {
        s[a] = (x.items || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
        if (k === 'graph') s[a].edges = (x.edges || []).map((e) => ({ ...e }));
      }
    }
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k), S0 = read(sc.init);
    const S = frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch));
    BAKES.set(k, { S0, S, NK: S.length });
  }
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const MATS = cast.filter((a) => A[a].kind === 'matrix');
  const STRIPS = cast.filter((a) => A[a].kind === 'bytes');
  const GRAPHS = cast.filter((a) => A[a].kind === 'graph');
  const QUEUES = cast.filter((a) => A[a].kind === 'list' && all.some((s) => s[a].some((x) => x.q && x.mode)));
  const TEXTS = cast.filter((a) => A[a].kind === 'kv');
  const ROWS = cast.filter((a) => A[a].kind === 'list' && !QUEUES.includes(a));
  const ids = (a) => [...new Set(all.flatMap((s) => (s[a] || []).map((x) => x.id)))];
  const RIDS = Object.fromEntries([...ROWS, ...QUEUES, ...GRAPHS].map((a) => [a, ids(a)]));
  const EIDS = Object.fromEntries(GRAPHS.map((a) => [a, [...new Set(all.flatMap((s) => s[a].edges.map((e) => String(e.id))))]]));
  const SIDS = Object.fromEntries(STRIPS.map((a) => [a, ids(a)]));
  const MSHAPE = Object.fromEntries(MATS.map((a) => { const m = all.find((s) => s[a].rows.length)?.[a] || { rows: [], cols: [] }; return [a, { r: m.rows.length, c: m.cols.length }]; }));

  /* 셈 맞추기 */
  for (const a of MATS) {
    const m = all[0][a];
    if (m.rows.length === 8 && m.rows.every((r, i) => r === SHORT[i])) m.cells.forEach((row, i) => row.forEach((c, j) => {
      const want = CONF[i].includes(j + 1) ? '-' : '+';
      if (c !== want) console.error(`pg locks ${sc.num} 세계 : 행렬 ${SHORT[i]} × ${SHORT[j]} 가 '${c}' 인데 LockConflicts 는 '${want}'`);
    }));
  }
  /* 행 락 행렬(KS · S · NKX · X)은 heapam.c 의 tupleLockExtraInfo 대응(AS · RS · X · AX)으로 같은 표에서 셈한다 */
  const ROWLK = { KS: 1, S: 2, NKX: 7, X: 8 };
  for (const a of MATS) {
    const m = all[0][a];
    if (m.rows.length === 4 && m.rows.every((r) => r in ROWLK)) m.cells.forEach((row, i) => row.forEach((c, j) => {
      const want = CONF[ROWLK[m.rows[i]] - 1].includes(ROWLK[m.cols[j]]) ? '-' : '+';
      if (c !== want) console.error(`pg locks ${sc.num} 세계 : 행 락 행렬 ${m.rows[i]} × ${m.cols[j]} 가 '${c}' 인데 대응한 락 모드로 셈하면 '${want}'`);
    }));
  }
  for (const a of QUEUES) all.forEach((s) => s[a].forEach((x) => { if (x.mode && !modeNo(x.mode)) console.error(`pg locks ${sc.num} 세계 : ${a}.${x.id} 의 모드 '${x.mode}' 를 모른다`); }));
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  for (const a of MATS) take('m:' + a, MSHAPE[a].r * MSHAPE[a].c * MC);
  for (const a of STRIPS) take('s:' + a, SB);
  for (const a of QUEUES) { RIDS[a].forEach((id) => take(a + ':' + id, SL)); take('qm:' + a, 3 * QB); }
  for (const a of GRAPHS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('pg locks 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표 ── */
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
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const EDGE = (deck.EDGES || [])[0] || null;
  /* 경계선 위는 서버(sql) 쪽 배우, 아래는 힙(heap) 쪽 배우 — 종류 순서(글 → 띠 → 행렬 → 선 → 큐 → 그래프 → 칸 줄)로만
     놓았더니 01 의 TUPLE 이 선 위, TABLE LOCKS 가 선 아래에 섰다. 한쪽 안에서는 칸 줄을 큐 앞에(08 의 PARTITIONS 가
     그 안의 LOCK 보다 먼저), vs INNODB 는 맨 끝. 선은 양쪽에 비교 말고 배우가 있을 때만 — 02 · 03 · 05 · 06 · 08 은 없다 */
  const sideOf = (a) => (A[a].lane === 'heap' ? 1 : 0);
  const PH = [0, 1].map((ph) => {
    const of = (xs) => xs.filter((a) => sideOf(a) === ph);
    const P = { tx: of(TEXTS).filter((a) => a !== 'cmp'), st: of(STRIPS), mt: of(MATS), rw: of(ROWS), qu: of(QUEUES), gr: of(GRAPHS), tail: of(TEXTS).filter((a) => a === 'cmp') };
    if (!P.st.length && !P.mt.length && !P.rw.length && !P.qu.length && !P.gr.length) { P.tx = [...P.tx, ...P.tail]; P.tail = []; }
    return P;
  });
  const bodyOf = (P) => [...P.tx, ...P.st, ...P.mt, ...P.rw, ...P.qu, ...P.gr].filter((a) => a !== 'cmp');
  const HASEDGE = !!EDGE && bodyOf(PH[0]).length > 0 && bodyOf(PH[1]).length > 0;
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const mLb = Object.fromEntries(MATS.map((a) => [a, { r: Array.from({ length: MSHAPE[a].r }, () => label('aq')), c: Array.from({ length: MSHAPE[a].c }, () => label('aq aq-c')), cap: label('aq') }]));
  const slotLb = Object.fromEntries([...ROWS, ...QUEUES, ...GRAPHS].map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const modeLb = Object.fromEntries(QUEUES.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const qLb = Object.fromEntries(QUEUES.map((a) => [a, { g: label('aq'), w: label('aq'), gm: label('aq'), wm: label('aq'), rq: label('aq'), and: label('aq'), bits: Array.from({ length: 8 }, () => label('aq aq-c')) }]));
  const eLb = Object.fromEntries(GRAPHS.map((a) => [a, Object.fromEntries(EIDS[a].map((id) => [id, label('aq')]))]));
  const capLb = Object.fromEntries([...ROWS, ...QUEUES, ...GRAPHS].map((a) => [a, label('aq ml aq-b')]));
  const sLb = Object.fromEntries(STRIPS.map((a) => [a, Object.fromEntries(SIDS[a].map((id) => [id, { n: label('aq'), v: label('aq') }]))]));
  const sCap = Object.fromEntries(STRIPS.map((a) => [a, label('aq ml aq-b')]));
  const edgeLb = label('aq'), tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  /* 큐의 셈 — granted 의 모드로 grantMask, waiting 의 모드로 waitMask, req 가 붙은 항목의 conflictTab */
  const qState = (its) => {
    const g = its.filter((x) => x.q === 'granted'), w = its.filter((x) => x.q === 'waiting');
    const rq = its.find((x) => x.req);
    /* 요청이 견주는 waitMask 는 줄에서 자기 앞의 대기자들 것이다 — 자기는 아직 줄에 없다(LockAcquireExtended 가
       conflictTab[lockmode] & waitMask 를 보는 것은 줄에 서기 전). 줄 전체로 셈했더니 06/2 의 T2 가 제 비트에 걸렸다 */
    const ahead = rq && rq.q === 'waiting' ? w.slice(0, w.indexOf(rq)) : w;
    return { g, w, gm: maskOf(g.map((x) => modeNo(x.mode))), wm: maskOf(w.map((x) => modeNo(x.mode))), wa: maskOf(ahead.map((x) => modeNo(x.mode))), rq, cm: rq ? confMask(modeNo(rq.mode)) : 0 };
  };
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a]), on(a), '', true, true]);
    for (const a of STRIPS) {
      const mod = modOf(s, a);
      for (const id of SIDS[a]) {
        const it = s[a].find((x) => x.id === id), hot = on(a) && !!it && hotIt(s, a, id);
        t.set(sLb[a][id].n, [it ? id : '', hot, mod.has(id) && on(a) ? 'gold' : '', !!it]);
        t.set(sLb[a][id].v, [it ? esc(it.sub) : '', hot, '', !!it && !!it.sub, true]);
      }
      const byl = s[a].byl;
      t.set(sCap[a], [byl ? `${esc(byl.l || '')}${byl.r ? '  ·  ' + esc(byl.r) : ''}` : '', on(a), '', !!byl, true]);
    }
    for (const a of MATS) {
      const m = s[a];
      mLb[a].r.forEach((lb, i) => t.set(lb, [m.rows[i] || '', on(a) && (m.on || []).some((q) => q.split('/')[0] === m.rows[i]), (m.on || []).some((q) => q.split('/')[0] === m.rows[i]) ? 'gold' : '', i < m.rows.length]));
      mLb[a].c.forEach((lb, j) => t.set(lb, [m.cols[j] || '', on(a) && (m.on || []).some((q) => q.split('/')[1] === m.cols[j]), (m.on || []).some((q) => q.split('/')[1] === m.cols[j]) ? 'gold' : '', j < m.cols.length]));
      t.set(mLb[a].cap, [m.lb ? `${m.lb.l || ''}${m.lb.r ? '  ·  ' + m.lb.r : ''}` : '', on(a), '', !!m.lb]);
    }
    for (const a of [...ROWS, ...QUEUES, ...GRAPHS]) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(slotLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && (it.tag === 'x' || it.tag === 'red') ? 'red' : '', !!it]); }
      t.set(capLb[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    for (const a of QUEUES) {
      const q = qState(s[a]);
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(modeLb[a][id], [it ? SHORT[modeNo(it.mode) - 1] || '' : '', on(a) && !!it && hotIt(s, a, id), it && it.req ? 'gold' : '', !!it]); }
      /* 비트는 칸이 보인다 — 글에는 이름만 */
      t.set(qLb[a].g, ['granted', on(a), '', s[a].length > 0]); t.set(qLb[a].w, ['wait queue', on(a), '', s[a].length > 0]);
      t.set(qLb[a].gm, ['grantMask', on(a)]);
      t.set(qLb[a].wm, ['waitMask', on(a)]);
      t.set(qLb[a].rq, [q.rq ? `conflictTab[${SHORT[modeNo(q.rq.mode) - 1]}]` : '', on(a), 'gold', !!q.rq]);
      const hitG = q.cm & q.gm, hitW = q.cm & q.wa;
      t.set(qLb[a].and, [q.rq ? (hitW ? `& waitMask ≠ 0 — 줄 뒤에서 기다린다` : hitG ? `& grantMask ≠ 0 — 기다린다` : `& 둘 다 0 — 곧바로 받는다`) : '', on(a), q.rq ? (hitW || hitG ? 'red' : 'green') : '', !!q.rq]);
      qLb[a].bits.forEach((lb, i) => t.set(lb, [SHORT[7 - i], false, '', true]));
    }
    for (const a of GRAPHS) for (const id of EIDS[a]) { const e = s[a].edges.find((x) => String(x.id) === id); t.set(eLb[a][id], [e && e.lb ? e.lb : '', on(a), e && e.hot ? 'red' : '', !!(e && e.lb)]); }
    if (EDGE) t.set(edgeLb, [EDGE.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '', HASEDGE]);
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => {
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const t of TXALL) {
      const e = t.get(lb);
      if (!e || e[3] === false) continue;
      lb.el.innerHTML = e[0];
      const r = lb.el.getBoundingClientRect();
      w = Math.max(w, r.width); h = Math.max(h, r.height);
    }
    lb.el.innerHTML = keep;
    return { w, h };
  };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(31);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {}, mat: {}, q: {}, gr: {}, strip: {} };
    /* 확대 띠 — 이름 · 설명의 줄을 스텝마다 나눈다 */
    const wc = new Map();
    const wOf = (lb, html) => {
      if (!html) return 0;
      let m = wc.get(lb);
      if (!m) wc.set(lb, (m = new Map()));
      if (!m.has(html)) { const keep = lb.el.innerHTML; lb.el.innerHTML = html; m.set(html, lb.el.getBoundingClientRect().width); lb.el.innerHTML = keep; }
      return m.get(html);
    };
    const SW = {};
    for (const a of STRIPS) {
      wrap(sCap[a], ww);
      const pos = (s) => { const its = s[a], tot = its.reduce((p, x) => p + (x.sz || 1), 0) || 1; let x = L.x0; return Object.fromEntries(its.map((it) => { const w = (ww * (it.sz || 1)) / tot, r = [x, w]; x += w; return [it.id, r]; })); };
      let nr = 1, vr = 1;
      const per = new Map();
      for (const b of BAKES.values()) b.S.forEach((s, kk) => {
        const P = pos(s), T = b.TX[kk], g2 = (lb) => { const e = T.get(lb); return e && e[3] !== false ? e[0] : ''; };
        const NM = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: wOf(sLb[a][it.id].n, g2(sLb[a][it.id].n)) })).filter((q) => q.w), L.x0, L.x1);
        const VL = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: wOf(sLb[a][it.id].v, g2(sLb[a][it.id].v)) })).filter((q) => q.w), L.x0, L.x1);
        nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows);
        per.set(b.S[kk], { P, NM: NM.out, VL: VL.out });
      });
      SW[a] = { nr, vr, per, capH: most(sCap[a]).h };
    }
    /* 글 블록 — 쪽마다 따로 격자를 짠다(앞 글들 · 끝의 vs INNODB) */
    const grid = (xs) => {
      let tn = Math.max(1, Math.min(3, xs.length));
      while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
      const tW = (ww - (tn - 1) * gap) / tn;
      for (const a of xs) wrap(tx[a], tW);
      const tRows = Math.ceil(xs.length / tn), tHs = Array.from({ length: tRows }, (_, r) => hMax(xs.slice(r * tn, r * tn + tn).map((a) => tx[a])));
      return { xs, tn, tW, tRows, tHs };
    };
    const GR = PH.map((P) => ({ head: grid(P.tx), tail: grid(P.tail) }));
    /* 행렬 — 행 이름 폭만큼 왼쪽을 비우고 칸은 정사각. 칸은 cap 까지 키운다 — 34 에 묶였더니 03 · 07 의 표가 세계 폭의 3 분의 1 이었다.
       높이가 넘치면 cap 을 줄여 다시 짠다 */
    let MW = {};
    const mwOf = (cap) => Object.fromEntries(MATS.map((a) => { const lw = Math.ceil(Math.max(20, ...mLb[a].r.map((lb) => most(lb).w))) + 10, c = MSHAPE[a].c, cs = Math.min(cap, Math.floor((ww - lw) / Math.max(1, c))); return [a, { lw, cs }]; }));
    const sw = Object.fromEntries([...ROWS, ...QUEUES, ...GRAPHS].map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(34, Math.ceil(most(slotLb[a][id]).w) + 14)]))]));
    for (const a of [...ROWS, ...QUEUES, ...GRAPHS]) wrap(capLb[a], ww);
    /* 마스크 비트 칸은 이름표(grantMask · waitMask · conflictTab[..]) 오른쪽에서 시작 */
    for (const a of QUEUES) G.q[a] = { bx: L.x0 + Math.ceil(Math.max(...['gm', 'wm', 'rq'].map((k2) => most(qLb[a][k2]).w))) + 14 };
    const qMin = Object.fromEntries(QUEUES.map((a) => [a, Math.ceil(most(qLb[a].g).w) + 16]));
    /* 요청을 짚는(req) 항목이 한 번도 없으면 conflictTab 줄과 결과 줄을 두지 않는다 */
    const qReq = Object.fromEntries(QUEUES.map((a) => [a, all.some((st) => st[a].some((x) => x.req))]));
    /* 칸 줄은 폭을 넘으면 다음 줄로 — 줄 수는 모든 스텝에서 가장 많은 만큼 */
    const lines = (a, its) => { let x = 0, n = 1; for (const it of its) { const w = sw[a][it.id]; if (x && x + w > ww) { n++; x = 0; } x += w + 6; } return n; };
    const rL = Object.fromEntries(ROWS.map((a) => [a, Math.max(1, ...all.map((st) => lines(a, st[a])))]));
    const cH = Object.fromEntries([...ROWS, ...QUEUES, ...GRAPHS].map((a) => [a, most(capLb[a]).h]));
    const texts2 = (g, y, k) => {
      const rowY = [y]; for (let r = 0; r < g.tRows; r++) rowY.push(rowY[r] + HD + g.tHs[r] + 12 * k);
      g.xs.forEach((a, i) => { const x = L.x0 + (i % g.tn) * (g.tW + gap), yy = rowY[Math.floor(i / g.tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + g.tW - 18, y: yy + 8 }; });
      return rowY[g.tRows];
    };
    const lay = (y0, k = 1) => {
      let y = y0;
      G.edgeY = null;
      PH.forEach((P, ph) => {
        if (ph === 1 && HASEDGE) { y += 6 * k; G.edgeY = y; place(edgeLb, L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
        y = texts2(GR[ph].head, y, k);
        for (const a of P.st) {
          place(hd[a], L.x0, y); y += HD + 6 + SW[a].nr * RH;
          G.strip[a] = { y, ...SW[a] }; G.anc[a] = { x: L.x0 + ww / 2, y: y + 13 };
          y += 26 + 5 + SW[a].vr * RH + 4; G.strip[a].capY = y; place(sCap[a], L.x0, y); y += SW[a].capH + (SW[a].capH > 1 ? 6 : 0) + 12 * k;
        }
        for (const a of P.mt) {
          place(hd[a], L.x0, y); y += HD + 4;
          const { lw, cs } = MW[a];
          G.mat[a] = { x0: L.x0 + lw, y: y + 16, cs };
          mLb[a].c.forEach((lb, j) => place(lb, L.x0 + lw + (j + 0.5) * cs, y + 8, 'c', 'c'));
          mLb[a].r.forEach((lb, i) => place(lb, L.x0 + lw - 8, y + 16 + (i + 0.5) * cs, 'r', 'c'));
          G.anc[a] = { x: L.x0 + lw + (MSHAPE[a].c * cs) / 2, y: y + 16 + (MSHAPE[a].r * cs) / 2 };
          y += 16 + MSHAPE[a].r * cs + 6; place(mLb[a].cap, L.x0, y); y += 16 + 12 * k;
        }
        for (const a of P.rw) {
          place(hd[a], L.x0, y); G.slot[a] = { x0: L.x0, y: y + HD, sw: sw[a] }; G.anc[a] = { x: L.x0 + 30, y: y + HD + 13 };
          y += HD + rL[a] * 32 - 6 + 8; place(capLb[a], L.x0, y); G.slot[a].capY = y; y += cH[a] + 14 * k;
        }
        /* 락 큐 — granted 칸들, 화살표, wait queue 칸들. 칸 아래 모드. 그 아래 마스크 셋 */
        for (const a of P.qu) {
          place(hd[a], L.x0, y); y += HD + 4;
          place(qLb[a].g, L.x0, y); y += 16;
          G.q[a] = { ...G.q[a], y: y + 13, sw: sw[a], min: qMin[a] }; G.anc[a] = { x: L.x0 + 40, y: y + 13 };
          /* 칸 26 · 모드 이름 16 · 비트 머리 줄 16 */
          y += 26 + 4 + 16 + 8 + 16;
          G.q[a].mY = y; G.q[a].nr = qReq[a] ? 3 : 2; y += G.q[a].nr * 18 + 8;
          G.q[a].andY = y; if (qReq[a]) y += 18 + 4;
          place(capLb[a], L.x0, y); G.q[a].capY = y; y += cH[a] + 14 * k;
        }
        for (const a of P.gr) {
          place(hd[a], L.x0, y); y += HD + 4;
          G.gr[a] = { y: y + 13 + 22, sw: sw[a] }; G.anc[a] = { x: L.x0 + ww / 2, y: y + 35 };
          y += 26 + 44 + 8; place(capLb[a], L.x0, y); G.gr[a].capY = y; y += cH[a] + 14 * k;
        }
        y = texts2(GR[ph].tail, y, k);
      });
      return y - y0;
    };
    let k = 1, total = 0;
    for (const cap of [56, 48, 40, 34]) { MW = mwOf(cap); total = lay(L.y0, 1); if (total <= wh) break; }
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`pg locks ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  const rowSlot = (s, a, id) => {
    const x0 = G.slot[a].x0, ww = G.L.x1 - x0;
    let x = 0, ln = 0;
    for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (x && x + w > ww) { ln++; x = 0; } if (it.id === id) return { x: x0 + x + w / 2, y: G.slot[a].y + 13 + ln * 32, w }; x += w + 6; }
    return null;
  };
  /* 큐 칸 — granted 를 왼쪽부터, 그 뒤 화살표 자리 28, wait queue 를 순서대로 */
  const qWx = (s, a) => Math.max(G.L.x0 + G.q[a].min, qState(s[a]).g.reduce((x, it) => x + G.q[a].sw[it.id] + 6, G.L.x0)) + 34;
  const qSlot = (s, a, id) => {
    const q = qState(s[a]), Q = G.q[a];
    let x = G.L.x0;
    for (const it of q.g) { const w = Q.sw[it.id]; if (it.id === id) return { x: x + w / 2, y: Q.y, w }; x += w + 6; }
    x = qWx(s, a);
    for (const it of q.w) { const w = Q.sw[it.id]; if (it.id === id) return { x: x + w / 2, y: Q.y, w }; x += w + 6; }
    return null;
  };
  const gSlot = (s, a, id) => {
    const its = s[a], n = its.length, j = its.findIndex((x) => x.id === id);
    if (j < 0) return null;
    const ww = G.L.x1 - G.L.x0, w = G.gr[a].sw[id], step = ww / Math.max(1, n);
    return { x: G.L.x0 + step * (j + 0.5), y: G.gr[a].y, w };
  };
  function anchor(a, s, lbText) {
    const id = (RIDS[a] || []).filter((x) => (lbText || '').includes(x)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, a)].find((x) => (RIDS[a] || []).includes(x));
    const P = id ? (QUEUES.includes(a) ? qSlot(s, a, id) : GRAPHS.includes(a) ? gSlot(s, a, id) : ROWS.includes(a) ? rowSlot(s, a, id) : null) : null;
    if (P) return [P.x, P.y];
    const Q = G.anc[a];
    return Q ? [Q.x, Q.y] : [G.L.x0, G.L.y0];
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  function rim(cx, cy, w, h, n, m) {
    const per = 2 * (w + h), d = (m / n) * per;
    if (d < w) return [cx - w / 2 + d, cy - h / 2];
    if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)];
    if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2];
    return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)];
  }
  let O = null;
  const hide = (k) => { const [a, b] = R[k]; for (let i = a; i < b; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  function box(o, r0, n, P, PV, w, h, tg, a0, lit, e, from, gone, into, fly) {
    for (let m = 0; m < n; m++) {
      const i = r0 + m, f = m / n;
      const cx = PV && e < 1 ? U.lerp(PV.x, P.x, e) : P.x, cy = PV && e < 1 ? U.lerp(PV.y, P.y, e) : P.y;
      let [x, y] = rim(cx, cy, w, h, n, m);
      if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
      if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone + 8 * gone; }
      [x, y] = into(i, x, y);
      put(o, i, x, y, a0 * (1 - gone) * (tg === 'free' ? 0.5 * (m % 2) : 1), lit ? 0.4 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
    }
  }
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const { S, S0, NK } = cur, end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const src = act ? anchor(act.f, s, act.lb) : null, mv = show(p, 0.12, 0.42);
    const level = (a, id) => (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
    for (const a of STRIPS) {
      const [s0, s1] = R['s:' + a], n = s1 - s0, info = G.strip[a].per.get(s), mod = modOf(s, a), on = s.touch.has(a) && !end;
      if (!info || !s[a].length) { hide('s:' + a); continue; }
      const cuts = Object.values(info.P).map(([x]) => x).slice(1), nc = Math.min(cuts.length * 4, 40), nl = n - nc;
      for (let m = 0; m < n; m++) {
        const i = s0 + m;
        let x, y, col = INK, hot = false;
        if (m < nl) {
          const u = Math.floor(m / 2) / Math.ceil(nl / 2); x = G.L.x0 + u * (G.L.x1 - G.L.x0); y = G.strip[a].y + (m % 2 ? 26 : 0);
          const id = Object.keys(info.P).find((q) => x >= info.P[q][0] && x < info.P[q][0] + info.P[q][1]);
          const it = id && s[a].find((q) => q.id === id);
          hot = !!id && mod.has(id) && on; col = hot ? GOLD : it && it.tag && it.tag !== 'hdr' && it.tag !== 'clean' ? TAGC[it.tag] ?? INK : INK;
        } else { const c = Math.floor((m - nl) / 4); if (c >= cuts.length) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; } x = cuts[c]; y = G.strip[a].y + 5 + ((m - nl) % 4) * 5.3; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, (on ? 0.85 : 0.45) * dim * form, hot ? 0.5 : 0, 0.02, 1.05, col);
      }
    }
    /* 행렬 — 칸마다 점 여섯. 막힘은 채운 빨강, 허용은 흐린 테두리 점, on 은 금빛 */
    for (const a of MATS) {
      const m = s[a], M = G.mat[a], [m0] = R['m:' + a], on = s.touch.has(a) && !end, cs = M.cs, cw = cs - 6;
      for (let i = 0; i < MSHAPE[a].r; i++) for (let j = 0; j < MSHAPE[a].c; j++) {
        const c = (m.cells[i] || [])[j], key = `${m.rows[i]}/${m.cols[j]}`, hot = (m.on || []).includes(key), dm = (m.dim || []).includes(key);
        const cx = M.x0 + (j + 0.5) * cs, cy = M.y + (i + 0.5) * cs;
        for (let q = 0; q < MC; q++) {
          const idx = m0 + (i * MSHAPE[a].c + j) * MC + q, blk = c === '-';
          const [x, y] = into(idx, blk ? cx + ((q % 4) - 1.5) * (cw / 4.6) : rim(cx, cy, cw, cw, MC, q)[0], blk ? cy + (Math.floor(q / 4) - 1.5) * (cw / 4.6) : rim(cx, cy, cw, cw, MC, q)[1]);
          /* '+' 칸의 테두리 — 0.18 이면 바탕의 먼지와 같아 '허용' 이 '아무것도 없음' 으로 읽혔다 */
          const al = (blk ? (on ? 0.85 : 0.55) : on ? 0.5 : 0.35) * (dm ? 0.35 : 1) * dim * form;
          put(o, idx, x, y, hot ? Math.max(al, 0.95 * dim * form) : al, hot && !end ? 0.5 : 0, 0.02, blk ? 1.25 + Math.max(0, cs - 34) / 40 : 1, hot ? GOLD : blk ? RED : FAINT);
        }
      }
    }
    /* 락 큐 */
    for (const a of QUEUES) {
      const q = qState(s[a]), Q = G.q[a];
      for (const id of RIDS[a]) {
        const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
        if (!it && !(pv && !end)) { hide(key); continue; }
        const P = it ? qSlot(s, a, id) : qSlot(prev, a, id), PV = pv && it ? qSlot(prev, a, id) : null;
        if (!P) { hide(key); continue; }
        const born = it && !pv && !end, from = born && act && act.t === a ? src : null, cur2 = it || pv;
        box(o, R[key][0], SL, P, PV && !end ? PV : null, P.w, 24, cur2.q === 'waiting' ? 'wait' : cur2.tag, level(a, id), it && modOf(s, a).has(id) && !end, PV ? mv : 1, from, it ? 0 : show(p, 0.1, 0.4), into, fly);
      }
      /* 마스크 셋 — 비트 8 ‥ 1 을 왼쪽부터. 켠 비트는 채운 점 */
      const [q0] = R['qm:' + a], rows = [q.gm, q.wm, q.rq ? q.cm : 0], bx = Q.bx, cw = Math.min(26, (G.L.x1 - bx) / 8);
      /* 켠 비트는 4 × 3 알갱이로 칸을 채우고, 끈 비트는 흐린 점 하나. 걸린 비트(요청의 conflictTab 과 겹친 것)는 빨강 —
         waitMask 줄은 요청 앞의 대기자 것만 걸린다 */
      for (let r = 0; r < 3; r++) for (let b = 0; b < 8; b++) for (let m = 0; m < BG; m++) {
        const i = q0 + (r * 8 + b) * BG + m, bit = (rows[r] >> (8 - b)) & 1, cx = bx + (b + 0.5) * cw, cy = Q.mY + r * 18 + 7;
        const hitBit = r < 2 && q.rq && ((q.cm >> (8 - b)) & 1) && ((r === 0 ? q.gm : q.wa) >> (8 - b)) & 1;
        const [x, y] = into(i, cx + ((m % 4) - 1.5) * 3.4, cy + (Math.floor(m / 4) - 1) * 3.4 + 6);
        const vis = r === 2 && !q.rq ? 0 : bit ? 0.95 : m === 5 ? 0.3 : 0;
        put(o, i, x, y, vis * dim * form, hitBit && !end ? 0.5 : 0, 0.02, bit ? 1.5 : 1, hitBit ? RED : r === 2 ? GOLD : bit ? INK : FAINT);
      }
    }
    /* graph — 노드 칸 */
    for (const a of GRAPHS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id);
      if (!it) { hide(key); continue; }
      const P = gSlot(s, a, id);
      box(o, R[key][0], SL, P, null, P.w, 26, it.tag, level(a, id), modOf(s, a).has(id) && !end, 1, null, 0, into, fly);
    }
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const born = it && !pv && !end, from = born && act && act.t === a ? src : null;
      box(o, R[key][0], SL, P, null, P.w, 24, (it || pv).tag, level(a, id), it && modOf(s, a).has(id) && !end, 1, from, it ? 0 : show(p, 0.1, 0.4), into, fly);
    }
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
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
      const s = S[kk];
      for (const a of STRIPS) {
        const info = G.strip[a].per.get(s);
        if (!info) continue;
        for (const q of info.NM) place(sLb[a][q.id].n, q.l, G.strip[a].y - 3 - q.row * RH, 'l', 'b');
        for (const q of info.VL) place(sLb[a][q.id].v, q.l, G.strip[a].y + 26 + 5 + q.row * RH, 'l', 't');
        place(sCap[a], G.L.x0, G.strip[a].capY);
      }
      for (const a of QUEUES) {
        const Q = G.q[a];
        for (const it of s[a]) { const P = qSlot(s, a, it.id); if (P) { place(slotLb[a][it.id], P.x, P.y, 'c', 'c'); place(modeLb[a][it.id], P.x, P.y + 16, 'c', 't'); } }
        Q.wx = qWx(s, a);
        place(qLb[a].w, Q.wx, Q.y - 29, 'l', 't');
        const bx = Q.bx, cw = Math.min(26, (G.L.x1 - bx) / 8);
        place(qLb[a].gm, G.L.x0, Q.mY, 'l', 't'); place(qLb[a].wm, G.L.x0, Q.mY + 18, 'l', 't'); place(qLb[a].rq, G.L.x0, Q.mY + 36, 'l', 't');
        qLb[a].bits.forEach((lb, i) => place(lb, bx + (i + 0.5) * cw, Q.mY - 2, 'c', 'b'));
        place(qLb[a].and, G.L.x0, Q.andY, 'l', 't');
        place(capLb[a], G.L.x0, Q.capY);
      }
      for (const a of GRAPHS) {
        for (const it of s[a]) { const P = gSlot(s, a, it.id); if (P) place(slotLb[a][it.id], P.x, P.y, 'c', 'c'); }
        for (const e of s[a].edges) { const P = gSlot(s, a, e.from), Q2 = gSlot(s, a, e.to); if (P && Q2) { const up = P.x < Q2.x; place(eLb[a][String(e.id)], (P.x + Q2.x) / 2, P.y + (up ? -34 : 34), 'c', up ? 'b' : 't'); } }
        place(capLb[a], G.L.x0, G.gr[a].capY);
      }
      for (const a of ROWS) { for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(slotLb[a][it.id], P.x, P.y, 'c', 'c'); } place(capLb[a], G.L.x0, G.slot[a].capY); }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, act.lb), [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(show(p, 0.08, 0.42));
      const arc = act.f === act.t ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arc - (act.f === act.t ? 30 : 14));
      tok.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  function arrow(ctx, x0, y0, x1, y1, lift) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - lift;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    const an = Math.atan2(y1 - my, x1 - mx), hd2 = 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd2 * Math.cos(an - 0.45), y1 - hd2 * Math.sin(an - 0.45));
    ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd2 * Math.cos(an + 0.45), y1 - hd2 * Math.sin(an + 0.45)); ctx.stroke();
  }
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save(); ctx.lineWidth = 1;
    if (G.edgeY != null) { ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]); seg(ctx, L.x0, G.edgeY, L.x1, G.edgeY); ctx.setLineDash([]); }
    for (const a of STRIPS) {
      const info = G.strip[a].per.get(s);
      if (!info) continue;
      ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.faint;
      const y = G.strip[a].y, off = (q) => q.row > 0 || q.cx < q.l || q.cx > q.r;
      for (const q of info.NM) if (off(q)) seg(ctx, q.cx, y - 3 - q.row * RH + 1, q.cx, y - 2);
      for (const q of info.VL) if (off(q)) seg(ctx, q.cx, y + 28, q.cx, y + 26 + 5 + q.row * RH - 1);
    }
    /* 행렬 — on 칸에 금빛 테두리 */
    for (const a of MATS) {
      const m = s[a], M = G.mat[a];
      ctx.globalAlpha = 0.9 * o; ctx.strokeStyle = css.gold; ctx.lineWidth = 1.5;
      for (const key of m.on || []) { const [r, c] = key.split('/'), i = m.rows.indexOf(r), j = m.cols.indexOf(c); if (i >= 0 && j >= 0) ctx.strokeRect(M.x0 + j * M.cs + 1, M.y + i * M.cs + 1, M.cs - 2, M.cs - 2); }
      ctx.lineWidth = 1;
    }
    /* 큐 — granted 와 wait queue 사이 경계, 비트 칸 경계 */
    for (const a of QUEUES) {
      const Q = G.q[a];
      if (Q.wx != null) { ctx.globalAlpha = 0.5 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([2, 3]); seg(ctx, Q.wx - 17, Q.y - 30, Q.wx - 17, Q.y + 30); ctx.setLineDash([]); }
      const bx = Q.bx, cw = Math.min(26, (G.L.x1 - bx) / 8);
      ctx.globalAlpha = 0.2 * o; ctx.strokeStyle = css.faint;
      for (let r = 0; r < Q.nr; r++) for (let bb = 0; bb <= 8; bb++) seg(ctx, bx + bb * cw, Q.mY + r * 18 + 2, bx + bb * cw, Q.mY + r * 18 + 18);
    }
    /* graph 간선 — 왼→오는 위로, 오→왼은 아래로 휜다 */
    for (const a of GRAPHS) for (const e of s[a].edges) {
      const P = gSlot(s, a, e.from), Q2 = gSlot(s, a, e.to);
      if (!P || !Q2) continue;
      const up = P.x < Q2.x, dx = up ? 1 : -1;
      ctx.globalAlpha = (e.hot ? 0.95 : 0.6) * o; ctx.strokeStyle = e.hot ? css.red : css.ink; ctx.lineWidth = e.hot ? 1.6 : 1.2;
      arrow(ctx, P.x + dx * (P.w / 2 - 6), P.y + (up ? -13 : 13), Q2.x - dx * (Q2.w / 2 - 6), Q2.y + (up ? -13 : 13), up ? 26 : -26);
      ctx.lineWidth = 1;
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') };
    },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
