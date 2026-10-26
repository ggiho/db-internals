/* mysql innodb 07 · 08 — 레코드 락과 교착. 그리는 것은 모두 bake 상태에서 읽는다 —
     · 인덱스 = axis 배우. 수직선 위의 레코드 점(items 의 v), 그 위에 잠금 범위(spans) —
       next (a, b] = 왼쪽 빈 원 · 오른쪽 찬 원, gap (a, b) = 양끝 빈 원, rec = 레코드 위의 굵은 점, blk = 기다리는 요청(빨간 화살표)
     · wait-for 그래프 = graph 배우. 노드와 간선, 간선이 이루는 사이클은 세계가 찾아 빨갛게
     · 나머지 kv 는 글 블록(SQL 층), 나머지 list 는 칸 줄
     · 셈 맞추기 — next 의 b 가 레코드가 아니거나 a 가 그 바로 앞 레코드(첫 레코드면 축의 시작)가 아니거나, gap 의 양끝이
       이웃한 레코드가 아니거나, rec 가 레코드 위에 있지 않거나, hot 으로 칠한 간선이 사이클 위에 없으면 console.error
   손잡이가 있는 장면(07 격리 수준 · 08 innodb_deadlock_detect)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const SL = 44, TOK = 150, RECN = 10, SPN = 40, NODEN = 48;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
const SPC = { next: GOLD, gap: ACCENT, rec: INK, blk: RED, ii: GREEN };

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

/* 짝 장면(locks 02 · 02v, 06 · 06v)은 한 세계가 둘을 다 들고 setScene 으로 바꾼다 — Story 는 짝을 바꿔도 세계를 다시 만들지 않는다
   (열쇠가 짝의 A). 둘 다 없었을 때는 V 로 B 를 골라도 A 의 그림이 남았다. 둘은 더 높은 쪽의 높이로 가운데를 맞춘다 —
   제 높이로 맞췄더니 A ↔ B 에서 세계가 10 · 19px 뛰었다 */
function make({ F, deck, labels, scene }) {
  const sc = scene();
  const mate = (deck.SCENES || []).find((s) => s !== sc && (s.num === sc.pair || s.pair === sc.num) && s.steps.length === sc.steps.length);
  const W = new Map([[sc.num, one({ F, deck, labels, sc })]]);
  if (mate) W.set(mate.num, one({ F, deck, labels, sc: mate }));
  let cur = W.get(sc.num);
  return {
    build(L) { const ws = [...W.values()], T = Math.max(...ws.map((w) => w.build(L))); ws.forEach((w) => w.fin(T)); },
    theme() { W.forEach((w) => w.theme()); },
    setScene(n2) { const w = W.get(n2); if (w && w !== cur) { cur.hide(); cur = w; cur.reset(); } },
    setVary(v) { W.forEach((w) => w.setVary(v)); },
    pose: (...a) => cur.pose(...a),
    paint: (...a) => cur.paint(...a),
    overlay: (...a) => cur.overlay(...a),
    dispose() { W.forEach((w) => w.dispose()); },
  };
}

function one({ F, deck, labels, sc }) {
  const N = F.N, A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      const x = st[a] || {};
      if (A[a].kind === 'kv') s[a] = x.kv || {};
      else s[a] = (x.items || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
      if (A[a].kind === 'axis') { s[a + '#ax'] = x.axis || { min: 0, max: 100 }; s[a + '#sp'] = (x.spans || []).map((q) => ({ ...q, id: String(q.id) })); }
      if (A[a].kind === 'graph') s[a + '#e'] = (x.edges || []).map((q) => ({ ...q, id: String(q.id) }));
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
  const IDX = cast.find((a) => A[a].kind === 'axis') || null;
  const GR = cast.find((a) => A[a].kind === 'graph') || null;
  const ROWS = cast.filter((a) => A[a].kind === 'list' || A[a].kind === 'frames');
  /* 층 — 배우의 lane 대로 위에서 아래로 : 서버(sql) | 경계 0 | InnoDB 메모리 | 경계 1 | 디스크.
     글 블록을 늘 맨 위에, 경계 0 을 그 바로 아래에 두었더니 MDL QUEUE(lane sql)가 InnoDB 쪽에 그려졌다(locks 01 · 11 · 12),
     경계 1 은 아예 그리지 않아 ROW LOCKS 와 행 (클러스터)(lane disk, '락은 여기 없다') 사이에 선이 없었다(locks 07 · 08 · 09) */
  const laneOf = (a) => (A[a].lane === 'sql' ? 0 : A[a].lane === 'disk' ? 2 : 1);
  const SQLT = TEXTS.filter((a) => laneOf(a) === 0), MEMT = TEXTS.filter((a) => laneOf(a) !== 0);
  const SQLR = ROWS.filter((a) => laneOf(a) === 0), MEMR = ROWS.filter((a) => laneOf(a) === 1), DSKR = ROWS.filter((a) => laneOf(a) === 2);
  const HAS = [SQLT.length + SQLR.length > 0, MEMT.length + MEMR.length + (IDX ? 1 : 0) + (GR ? 1 : 0) > 0, DSKR.length > 0];
  const EDGE_ON = [HAS[0] && (HAS[1] || HAS[2]), HAS[1] && HAS[2]];
  const ids = (a) => [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  const RECS = IDX ? ids(IDX) : [];
  const SPIDS = IDX ? [...new Set(all.flatMap((s) => s[IDX + '#sp'].map((q) => q.id)))] : [];
  const NODES = GR ? ids(GR) : [];
  const EIDS = GR ? [...new Set(all.flatMap((s) => s[GR + '#e'].map((q) => q.id)))] : [];
  /* 사이클 위의 간선 — 간선마다, 그 끝에서 출발해 그 시작으로 돌아오는 길이 있으면 */
  const cycleOf = (s) => {
    if (!GR) return new Set();
    const E = s[GR + '#e'], out = new Map(); for (const e of E) { if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e.to); }
    const reach = (a, b) => { const seen = new Set([a]), st = [a]; while (st.length) { const x = st.pop(); if (x === b) return true; for (const y of out.get(x) || []) if (!seen.has(y)) { seen.add(y); st.push(y); } } return false; };
    return new Set(E.filter((e) => reach(e.to, e.from)).map((e) => e.id));
  };

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    const at = `${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    if (IDX) {
      const vs = s[IDX].map((x) => x.v).sort((p, q) => p - q), ax = s[IDX + '#ax'];
      const prevOf = (v) => { const j = vs.indexOf(v); return j > 0 ? vs[j - 1] : ax.min; };
      for (const q of s[IDX + '#sp']) {
        if (q.kind === 'next' && (!vs.includes(q.to) || q.from !== prevOf(q.to))) console.error(`${at} : next-key ${q.id} (${q.from}, ${q.to}] 의 끝이 레코드와 맞지 않는다 — 레코드 ${vs.join(' · ')}`);
        if ((q.kind === 'gap' || q.kind === 'ii') && (!(vs.includes(q.from) || q.from === ax.min) || !vs.includes(q.to) || q.from !== prevOf(q.to))) console.error(`${at} : ${q.kind} ${q.id} (${q.from}, ${q.to}) 의 양끝이 이웃한 레코드가 아니다`);
        if (q.kind === 'rec' && (q.from !== q.to || !vs.includes(q.to))) console.error(`${at} : 레코드 락 ${q.id} 가 레코드 위에 있지 않다 (${q.from}–${q.to})`);
      }
    }
    if (GR) { const cyc = cycleOf(s); for (const e of s[GR + '#e']) if (e.hot && !cyc.has(e.id)) console.error(`${at} : hot 간선 ${e.id} 가 사이클 위에 없다`); }
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  if (IDX) { take('line', 60); RECS.forEach((id) => take('r:' + id, RECN)); SPIDS.forEach((id) => take('s:' + id, SPN)); }
  NODES.forEach((id) => take('n:' + id, NODEN));
  if (GR) take('edges', 80);
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb lock 세계 : 알갱이가 모자란다');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') { const el = document.createElement('div'); el.className = 'wl ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; }
  function setText(lb, s, html = false) { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls)); }
  function place(lb, x, y, al = 'l', va = 't') { const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%'; lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`; }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const EDG = deck.EDGES || [];
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const recLb = Object.fromEntries(RECS.map((id) => [id, label('aq aq-c')]));
  const spLb = Object.fromEntries(SPIDS.map((id) => [id, label('aq')]));
  const nLb = Object.fromEntries(NODES.map((id) => [id, { n: label('aq aq-c'), v: label('aq aq-c') }]));
  const eLb = Object.fromEntries(EIDS.map((id) => [id, label('aq')]));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const edgeLb = EDG.map(() => label('aq')), tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || []), ...((c.span && [...c.span.add, ...c.span.mod]) || []), ...((c.edge && [...c.edge.add, ...c.edge.mod]) || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a]), on(a), '', true, true]);
    if (IDX) {
      for (const id of RECS) { const it = s[IDX].find((x) => x.id === id); t.set(recLb[id], [it ? id : '', on(IDX), '', !!it]); }
      for (const id of SPIDS) { const q = s[IDX + '#sp'].find((x) => x.id === id); t.set(spLb[id], [q ? q.lb || '' : '', !!q && on(IDX) && hotIt(s, IDX, id), q ? (q.kind === 'blk' ? 'red' : q.kind === 'next' ? 'gold' : q.kind === 'rec' || q.kind === 'ii' ? 'green' : '') : '', !!q && !!q.lb]); }
    }
    if (GR) {
      const cyc = cycleOf(s);
      for (const id of NODES) { const it = s[GR].find((x) => x.id === id); t.set(nLb[id].n, [it ? id : '', on(GR) && !!it && hotIt(s, GR, id), it && it.tag === 'x' ? 'red' : '', !!it]); t.set(nLb[id].v, [it ? it.sub : '', on(GR) && !!it, it && it.tag === 'x' ? 'red' : '', !!it && !!it.sub]); }
      /* 간선 이름(대기)은 그리지 않는다 — 제목이 '화살표 = 기다린다' 를 적는다 */
      for (const id of EIDS) t.set(eLb[id], ['', false, '', false]);
      t.set(hd[GR], [`${A[GR].nm}  ·  화살표 = 기다린다${cyc.size ? '  ·  사이클' : ''}`, on(GR), cyc.size ? 'red' : '']);
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && it.tag === 'x' ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    EDG.forEach((e, i) => t.set(edgeLb[i], [e.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === e.hot ? 'gold' : '', !!EDGE_ON[i]]));
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => { let w = 0, h = 0; const keep = lb.el.innerHTML; for (const t of TXALL) { const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); } lb.el.innerHTML = keep; return { w, h }; };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(59);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15, SROW = 22;
  const ixX = (s, v) => { const ax = s[IDX + '#ax']; return G.ix.x0 + ((v - ax.min) / (ax.max - ax.min)) * (G.ix.x1 - G.ix.x0); };
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {}, ix: { x0: L.x0 + 14, x1: L.x1 - 14 } };
    /* 글 블록의 격자 — 층마다 따로(서버 층의 SESSION · STATEMENT, InnoDB 층의 READ VIEW) */
    const grid = (list) => {
      let tn = Math.max(1, Math.min(3, list.length));
      while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
      const tW = (ww - (tn - 1) * gap) / tn;
      for (const a of list) wrap(tx[a], tW);
      const tRows = Math.ceil(list.length / tn);
      return { list, tn, tW, tRows, tHs: Array.from({ length: tRows }, (_, r) => hMax(list.slice(r * tn, r * tn + tn).map((a) => tx[a]))) };
    };
    const GT = [grid(SQLT), grid(MEMT)];
    /* 범위의 줄 — 데이터의 row(0 이 수직선에 가깝다). 이름표는 그 줄의 막대 위에서 줄 나누기 —
       같은 줄의 (10,20] 과 (20,30] 이름표가 겹쳤다. 줄마다 이름표가 쌓인 만큼 띠를 높인다 */
    const nRow = IDX ? Math.max(1, ...all.flatMap((s) => s[IDX + '#sp'].map((q) => (q.row ?? 0) + 1))) : 0;
    const lrows = Array(nRow).fill(1);
    G.ix.x0 = L.x0 + 14; G.ix.x1 = L.x1 - 14;
    if (IDX) for (const b of BAKES.values()) b.SPL = b.S.map((s, kk) => {
      const T = b.TX[kk], wOf = (lb) => { const e = T.get(lb); const h = e && e[3] !== false ? e[0] : ''; if (!h) return 0; const keep = lb.el.innerHTML; lb.el.innerHTML = h; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };
      const out = {};
      for (let r = 0; r < nRow; r++) {
        const qs = s[IDX + '#sp'].filter((q) => (q.row ?? 0) === r).map((q) => { const xa = ixX(s, q.from), xb = ixX(s, q.to), w = wOf(spLb[q.id]), dot = q.kind === 'rec' || q.kind === 'blk'; return { id: q.id, cx: dot ? xa + 9 + w / 2 : (xa + xb) / 2, pins: [dot ? xa : (xa + xb) / 2], w }; }).filter((q) => q.w);
        const st = stagger(qs, L.x0, L.x1);
        lrows[r] = Math.max(lrows[r], st.rows);
        for (const q of st.out) out[q.id] = q;
      }
      return out;
    });
    const bandH = lrows.map((n) => 16 + n * RH);
    /* 그래프 — 노드는 가로로, 칸 폭은 이름표만큼 */
    /* 노드 폭 — 설명이 한 줄로 들어가는 폭, 단 무대에 노드가 다 들어가는 폭까지. 넘치면 설명은 줄을 바꾼다 */
    const NG = 70, nCap = GR ? (ww - (NODES.length - 1) * NG) / Math.max(1, NODES.length) : 0;
    const nw = GR ? Math.min(nCap, Math.max(90, ...NODES.map((id) => Math.max(most(nLb[id].n).w, most(nLb[id].v).w) + 18))) : 0;
    if (GR) for (const id of NODES) wrap(nLb[id].v, nw - 10);
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    /* 그래프와 InnoDB 층의 첫 칸 줄은 나란히 — 반 폭에 들어갈 때 */
    const rc = ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    /* 칸 줄의 폭 — 한 상태에 함께 있는 칸들의 폭 중 가장 넓은 것. 줄이 가진 적 있는 id 를 모두 더했더니 '(비었다)' 처럼
       다른 칸과 함께 있지 않는 자리 칸까지 더해져, 설명이 칸 끝에서 150 – 480px 떨어졌다(locks 03 · 05 · 06 · 06v · 07) */
    const usedW = (a) => Math.max(0, ...all.map((s) => s[a].reduce((t, x) => t + sw[a][x.id] + 6, -6)));
    const side = GR && rc > 1 && NODES.length * (nw + NG) - NG <= rW && MEMR.length && usedW(MEMR[0]) <= rW;
    const sideR = side ? MEMR[0] : null;
    G.ng = NG;
    if (GR && NODES.length * (nw + NG) - NG > ww + 1) console.error(`innodb ${sc.num} 세계 : 그래프가 무대보다 넓다 (${L.W}×${L.H})`);
    const rcH = {}, rSide = {};
    for (const a of ROWS) {
      const W0 = a === sideR ? rW : ww, used = usedW(a), sideW = W0 - used - 12;
      wrap(rowCap[a], W0); const hb = most(rowCap[a]).h;
      let hs = Infinity; if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      rSide[a] = Math.max(26, hs) < 26 + 8 + hb ? used + 12 : 0; if (!rSide[a]) wrap(rowCap[a], W0);
      rcH[a] = rSide[a] ? hs : hb;
    }
    const nvH = GR ? hMax(NODES.map((id) => nLb[id].v)) : 0;
    const lay = (y0, k = 1) => {
      let y = y0;
      const texts = (g) => {
        const rowY = [y]; for (let r = 0; r < g.tRows; r++) rowY.push(rowY[r] + HD + g.tHs[r] + 12 * k);
        g.list.forEach((a, i) => { const x = L.x0 + (i % g.tn) * (g.tW + gap), yy = rowY[Math.floor(i / g.tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + g.tW - 18, y: yy + 8 }; });
        y = rowY[g.tRows];
      };
      const placeGraph = (x0, yy) => { place(hd[GR], x0, yy); G.gr = { x0, y: yy + HD + 15, nw }; G.anc[GR] = { x: x0 + nw / 2, y: yy + HD + 15 }; return HD + 30 + 6 + nvH + 6; };
      const rows = (list) => {
        for (const a of list) {
          const x0 = a === sideR ? L.x0 + rW + gap : L.x0;
          place(hd[a], x0, y); G.slot[a] = { x0, y: y + HD, sw: sw[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + 13 };
          let hh;
          if (rSide[a]) { G.cap[a] = y + HD + 4; place(rowCap[a], x0 + rSide[a], G.cap[a]); hh = HD + Math.max(26, rcH[a] + 4); }
          else { G.cap[a] = null; place(rowCap[a], x0, y + HD + 26 + 8); hh = HD + 26 + 8 + rcH[a]; }
          if (a === sideR) hh = Math.max(hh, placeGraph(L.x0, y));
          y += hh + 14 * k;
        }
      };
      const edge = (i) => { if (!EDGE_ON[i] || !EDG[i]) return; y += (i ? 4 : 2) * k; G.edgeY[i] = y; place(edgeLb[i], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; };
      G.edgeY = [null, null]; G.cap = {};
      texts(GT[0]); rows(SQLR);
      edge(0);
      texts(GT[1]);
      if (IDX) {
        place(hd[IDX], L.x0, y); y += HD + 6;
        G.ix.top = y; y += bandH.reduce((p, q) => p + q, 0) + 6; G.ix.y = y; G.anc[IDX] = { x: L.x0 + ww / 2, y }; y += 10 + 16 + 10 * k;
        /* 줄 r 의 막대 y — 수직선에서 위로 띠를 쌓는다 */
        G.barY = bandH.map((_, r) => G.ix.y - 12 - bandH.slice(0, r).reduce((p, q) => p + q, 0));
      }
      rows(MEMR);
      if (GR && !side) y += placeGraph(L.x0, y) + 10 * k;
      edge(1);
      rows(DSKR);
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`innodb ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    G.lay = lay; G.k = k; G.total = total;
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
    return total;
  }
  /* 가운데 맞추기 — T 는 짝까지 본 높이 */
  function fin(T) {
    const { L } = G, dy = L.narrow ? 0 : Math.max(0, (L.y1 - L.y0 - Math.max(G.total, T)) / 2);
    if (dy) G.lay(L.y0 + dy, G.k);
    shown = -2;
  }
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  const nodeAt = (s, id) => { const j = NODES.indexOf(id); return j < 0 ? null : { x: G.gr.x0 + G.gr.nw / 2 + j * (G.gr.nw + G.ng), y: G.gr.y }; };
  /* 간선 — 두 노드 사이의 곧은 화살표. 오른쪽으로 가는 것은 위, 왼쪽으로 가는 것은 아래 */
  const edgeLine = (s, e) => { const A0 = nodeAt(s, e.from), B0 = nodeAt(s, e.to); if (!A0 || !B0) return null; const rt = B0.x > A0.x, y = A0.y + (rt ? -6 : 6), xa = A0.x + (rt ? 1 : -1) * (G.gr.nw / 2 + 4), xb = B0.x - (rt ? 1 : -1) * (G.gr.nw / 2 + 4); return { xa, xb, y, rt }; };
  const spY = (q) => G.barY[q.row ?? 0];
  function anchor(a, s, lbText) {
    if (a === IDX && G.ix.y) {
      const m = /(\d+)/.exec(lbText || ''), v = m ? +m[1] : null;
      if (v != null) return [ixX(s, v), G.ix.y];
    }
    if (a === GR && G.gr) { const id = NODES.find((x) => (lbText || '').includes(x)) || [...modOf(s, GR)].find((x) => NODES.includes(x)); const P = id ? nodeAt(s, id) : null; if (P) return [P.x, P.y]; }
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
    const src = act ? anchor(act.f, s, act.lb) : null;
    if (IDX) {
      const on = s.touch.has(IDX) && !end;
      { const [l0, l1] = R.line; for (let i = l0; i < l1; i++) { const u = (i - l0) / (l1 - l0 - 1), [xx, yy] = into(i, U.lerp(G.ix.x0, G.ix.x1, u), G.ix.y); put(o, i, xx, yy, (on ? 0.6 : 0.35) * dim * form, 0, 0.02, 1, INK); } }
      /* 레코드 — 수직선 위의 점, 새로 들어온 레코드(INSERT 25)는 금빛 */
      for (const id of RECS) {
        const [r0] = R['r:' + id], it = s[IDX].find((x) => x.id === id), pv = prev[IDX].find((x) => x.id === id);
        if (!it) { hide('r:' + id); continue; }
        const born = !pv && !end;
        for (let m = 0; m < RECN; m++) { const i = r0 + m, th = (m / RECN) * Math.PI * 2, [xx, yy] = into(i, ixX(s, it.v) + Math.cos(th) * 3.2, G.ix.y + Math.sin(th) * 3.2); put(o, i, xx, yy, (on ? 0.95 : 0.6) * dim * form, born ? 0.5 : 0, 0.02, 1.4, born ? GOLD : INK); }
      }
      /* 잠금 범위 — 막대 + 끝의 원(빈 원 = 열린 끝, 찬 원 = 닫힌 끝) */
      for (const id of SPIDS) {
        const [s0] = R['s:' + id], q = s[IDX + '#sp'].find((x) => x.id === id), pq = prev[IDX + '#sp'].find((x) => x.id === id);
        if (!q && !(pq && !end)) { hide('s:' + id); continue; }
        const z = q || pq, gone = q ? 0 : show(p, 0.1, 0.4), y = spY(z), xa = ixX(s, z.from), xb = ixX(s, z.to), col = SPC[z.kind] ?? INK;
        const lit = q && on && hotIt(s, IDX, id), lv = (lit ? 0.95 : on ? 0.6 : 0.4) * dim * form * (1 - gone);
        const born = q && !pq && !end, from = born && act && act.t === IDX ? src : null;
        for (let m = 0; m < SPN; m++) {
          const i = s0 + m, f = m / SPN;
          let x, yy = y, sz = 1.3, a0 = lv;
          if (z.kind === 'rec' || z.kind === 'blk') {
            /* 점 하나 — rec 는 레코드 위의 고리, blk 는 아래를 가리키는 화살표 */
            if (z.kind === 'rec') { const th = f * Math.PI * 2; x = xa + Math.cos(th) * 6; yy = y + Math.sin(th) * 6; }
            else { const r = Math.floor(m / 8), c = (m % 8) - 3.5; x = xa + c * (4 - r) * 0.6; yy = y - 8 + r * 4; if (r > 4) a0 = 0; }
          } else if (m < SPN - 12) {
            x = U.lerp(xa + 5, xb - 5, m / (SPN - 13));
          } else {
            /* 끝의 원 — 앞 여섯은 왼쪽, 뒤 여섯은 오른쪽. 찬 원은 안을 채운다 */
            const e = m - (SPN - 12), right = e >= 6, th = ((e % 6) / 6) * Math.PI * 2, closed = right ? z.kind === 'next' : false;
            const r = closed ? 2.2 : 4;
            x = (right ? xb : xa) + Math.cos(th) * r; yy = y + Math.sin(th) * r; sz = closed ? 1.8 : 1.1;
          }
          if (from) { const qq = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, qq); yy = U.lerp(from[1], yy, qq) - Math.sin(qq * Math.PI) * 14; }
          if (gone) { x += jit[i * 2] * 24 * gone; yy += jit[i * 2 + 1] * 24 * gone; }
          const [xx, y2] = into(i, x, yy);
          put(o, i, xx, y2, a0, lit ? 0.4 : 0, 0.02, sz, col);
        }
      }
    }
    if (GR) {
      const on = s.touch.has(GR) && !end;
      for (const id of NODES) {
        const [n0] = R['n:' + id], it = s[GR].find((x) => x.id === id), P = nodeAt(s, id);
        if (!it || !P) { hide('n:' + id); continue; }
        const lv = (on ? (hotIt(s, GR, id) ? 0.95 : 0.6) : 0.45) * dim * form;
        for (let m = 0; m < NODEN; m++) { const [x, y] = rim(P.x, P.y, G.gr.nw, 30, NODEN, m), [xx, yy] = into(n0 + m, x, y); put(o, n0 + m, xx, yy, lv, it.tag === 'x' ? 0.3 : 0, 0.03, 1.1, TAGC[it.tag] ?? INK); }
      }
      /* 간선 — 노드 사이의 활, 위로 가는 것과 아래로 가는 것을 갈라 서로 겹치지 않게 */
      const [e0, e1] = R.edges, cyc = cycleOf(s), E = s[GR + '#e'];
      let i = e0;
      const per = Math.max(10, Math.floor((e1 - e0) / Math.max(1, E.length)));
      for (const e of E) {
        const ln = edgeLine(s, e); if (!ln) continue;
        for (let m = 0; m < per && i < e1; m++, i++) {
          const u = m / (per - 1), [xx, yy] = into(i, U.lerp(ln.xa, ln.xb, u), ln.y);
          put(o, i, xx, yy, (on ? 0.9 : 0.5) * dim * form, cyc.has(e.id) && on ? 0.5 : 0, 0.02, 1.3, cyc.has(e.id) ? RED : ACCENT);
        }
      }
      for (; i < e1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    }
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === a ? src : null, tg = (it || pv).tag;
      const lv = (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
      for (let m = 0; m < SL; m++) {
        const i = R[key][0] + m, f = m / SL;
        let [x, y] = rim(P.x, P.y, P.w, 24, SL, m);
        if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, lv * (1 - gone), 0, 0.03, 1.1, TAGC[tg] ?? INK);
      }
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
      if (IDX) {
        for (const it of s[IDX]) place(recLb[it.id], ixX(s, it.v), G.ix.y + 10, 'c', 't');
        /* 범위 이름 — 막대의 가운데 위, 점(rec · blk)은 그 오른쪽 */
        const SPL = cur.SPL[kk];
        for (const q of s[IDX + '#sp']) { const L2 = SPL[q.id]; if (L2) place(spLb[q.id], L2.l, spY(q) - 8 - L2.row * RH, 'l', 'b'); }
      }
      if (GR) for (const id of NODES) { const P = nodeAt(s, id); if (P) { place(nLb[id].n, P.x, P.y, 'c', 'c'); place(nLb[id].v, P.x, P.y + 21, 'c', 't'); } }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
      /* 옆 설명은 그 스텝의 칸 끝 바로 옆 — 줄 폭(가장 넓은 상태)에 두면 칸이 적은 스텝에서 멀리 떨어졌다. 설명의 줄바꿈 폭은
         가장 넓은 상태의 것 그대로라 높이는 변하지 않는다. 칸이 바뀌면 설명 글도 바뀌므로(사라졌다 나타난다) 자리를 옮겨도 튀지 않는다 */
      for (const a of ROWS) if (G.cap[a] != null) place(rowCap[a], G.slot[a].x0 + Math.max(0, s[a].reduce((t, x) => t + G.slot[a].sw[x.id] + 6, -6)) + 12, G.cap[a]);
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
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save(); ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]);
    for (const y of G.edgeY) if (y != null) seg(ctx, L.x0, y, L.x1, y);
    ctx.setLineDash([]);
    if (IDX) {
      /* 축의 양 끝 값과 범위 막대 끝에서 레코드까지의 점선 */
      ctx.globalAlpha = 0.3 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([2, 3]);
      for (const q of s[IDX + '#sp']) { const y = spY(q); for (const v of q.from === q.to ? [q.from] : [q.from, q.to]) seg(ctx, ixX(s, v), y + 4, ixX(s, v), G.ix.y - 4); }
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.3 * o;
      const SPL = cur.SPL[kk];
      for (const q of s[IDX + '#sp']) { const L2 = SPL[q.id]; if (L2 && L2.row > 0) seg(ctx, L2.pins[0], spY(q) - 8 - L2.row * RH + 1, L2.pins[0], spY(q) - 7); }
    }
    if (GR) {
      /* 간선 끝의 화살촉 */
      const cyc = cycleOf(s);
      for (const e of s[GR + '#e']) {
        const ln = edgeLine(s, e); if (!ln) continue;
        const sx = ln.rt ? -1 : 1;
        ctx.globalAlpha = 0.8 * o; ctx.strokeStyle = cyc.has(e.id) ? css.red : css.accent;
        seg(ctx, ln.xb, ln.y, ln.xb + sx * 6, ln.y - 4); seg(ctx, ln.xb, ln.y, ln.xb + sx * 6, ln.y + 4);
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); return build(L); },
    fin,
    theme() { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim(); css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') }; },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    /* 짝으로 물러날 때 — 이름표를 감춘다. 돌아오면 글을 다시 쓴다 */
    hide() { for (const lb of made) { lb.el.style.opacity = '0'; lb.o = 0; } tokO = 0; },
    reset() { shown = -2; },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
