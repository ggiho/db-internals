/* mysql innodb 09 — 메타데이터 락 대기열. 그리는 것은 모두 bake 상태에서 읽는다 —
     · MDL = q 를 가진 list 배우. q 가 granted 면 보유 줄, pending 이면 대기 줄, gone 이면 대기 줄에서 흐리게(포기했다).
       칸 안에 이름과 mode(SR · SW · SU · X …). 대기 칸의 by 가 가리키는 칸으로 곡선 화살표 — 무엇이 막는가.
       막는 칸은 막히는 칸과 함께 밝힌다(대기 사슬을 따라). mode 가 'SU → X' 인 대기 칸은 앞의 SU 를 이미 쥐고 있으므로
       보유 줄에도 흐린 칸(SU)을 둔다 — 없었을 때 innodb 09 의 10 스텝은 보유 줄이 비어 ALTER 가 아무것도 안 쥔 듯 보였다
     · 층 — MDL 배우가 lane sql 이면 SQL 층과 InnoDB 사이의 점선은 대기열 아래. 글 블록 바로 아래에 두었더니 MDL QUEUE 가
       InnoDB 쪽에 그려졌다(innodb 09 · locks 11)
     · 나머지 kv 는 글 블록(SQL 층), 나머지 list · frames 는 칸 줄. SQL 층과 InnoDB 사이 · 메모리와 디스크 사이에 점선
     · 셈 맞추기 — 보유 줄의 mode 끼리 호환되지 않거나(X 는 무엇과도 함께 보유되지 않는다), by 가 없는 칸을 가리키거나,
       q 가 granted · pending · gone 밖이면 console.error
   손잡이가 있는 장면(lock_wait_timeout)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';

const HANGUL = /[가-힣]/;
const SL = 44, ML = 56, TOK = 150;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT };
/* mode 글에서 보유하는 것 — 'SU → X' 는 SU 를 쥐고 X 를 기다린다 */
const heldOf = (m) => String(m || '').split('→')[0].split('·').map((x) => x.trim()).filter(Boolean);

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
  const ITEMS = cast.filter((a) => A[a].kind !== 'kv');
  const MQ = ITEMS.find((a) => all.some((s) => s[a].some((x) => x.q))) || null;
  const ROWS = ITEMS.filter((a) => a !== MQ);
  const ids = (a) => [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  const QIDS = MQ ? ids(MQ) : [];
  const laneOf = (it) => (it.q === 'granted' ? 0 : 1);
  /* 대기 칸이 이미 쥔 것 — 'SU → X' 의 SU */
  const heldPart = (it) => (it.q === 'pending' && /→/.test(it.mode || '') ? heldOf(it.mode) : []);
  /* 줄 l 의 칸 — 보유 줄에는 대기 칸이 쥔 앞부분도(h) */
  const laneIts = (s, l) => s[MQ].flatMap((x) => (laneOf(x) === l ? [{ id: x.id, h: false }] : []).concat(l === 0 && heldPart(x).length ? [{ id: x.id, h: true }] : []));
  const HIDS = MQ ? [...new Set(all.flatMap((s) => s[MQ].filter((x) => heldPart(x).length).map((x) => x.id)))] : [];
  /* 막는 쪽 — 건드린 대기 칸의 by 를 사슬로 따라간다 */
  const blockers = (s) => {
    const out = new Set(); if (!MQ) return out;
    const by = new Map(s[MQ].filter((x) => x.by && x.q === 'pending').map((x) => [x.id, x.by]));
    for (const x of s[MQ]) { if (x.q !== 'pending' || !hotIt(s, MQ, x.id)) continue; let b = by.get(x.id), n = 0; while (b && !out.has(b) && n++ < 20) { out.add(b); b = by.get(b); } }
    return out;
  };
  const SQLQ = !!MQ && A[MQ].lane === 'sql';

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    if (!MQ) return;
    const at = `${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    const its = s[MQ];
    for (const it of its) {
      if (!['granted', 'pending', 'gone'].includes(it.q)) console.error(`${at} : ${it.id} 의 q ${it.q} 를 모른다`);
      if (it.by && !its.some((x) => x.id === it.by)) console.error(`${at} : ${it.id} 를 막는 ${it.by} 가 대기열에 없다`);
    }
    const held = its.flatMap((x) => (x.q === 'granted' ? heldOf(x.mode) : heldPart(x)).map((m) => ({ id: x.id, m })));
    if (held.some((h) => h.m === 'X') && new Set(held.map((h) => h.id)).size > 1) console.error(`${at} : X 를 쥔 칸이 있는데 다른 칸도 보유 중이다 — ${held.map((h) => h.id + ' ' + h.m).join(', ')}`);
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  QIDS.forEach((id) => take('q:' + id, ML));
  HIDS.forEach((id) => take('h:' + id, ML));
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb mdl 세계 : 알갱이가 모자란다');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') { const el = document.createElement('div'); el.className = 'wl ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; }
  function setText(lb, s, html = false) { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls)); }
  function place(lb, x, y, al = 'l', va = 't') { const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%'; lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`; }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const EDG = deck.EDGES || [];
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const qLb = Object.fromEntries(QIDS.map((id) => [id, { n: label('aq aq-c'), m: label('aq aq-c') }]));
  const hLb = Object.fromEntries(HIDS.map((id) => [id, { n: label('aq aq-c'), m: label('aq aq-c') }]));
  const laneLb = [label('aq'), label('aq')], qCap = label('aq ml aq-b');
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const edgeLb = EDG.map(() => label('aq')), tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const DISK = new Set(ROWS.filter((a) => A[a].lane === 'disk'));
  const MEMR = ROWS.filter((a) => !DISK.has(a)), DSKR = ROWS.filter((a) => DISK.has(a));
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a]), on(a), '', true, true]);
    if (MQ) {
      const blk = blockers(s);
      for (const id of HIDS) {
        const it = s[MQ].find((x) => x.id === id), hp = it ? heldPart(it) : [];
        t.set(hLb[id].n, [hp.length ? id : '', false, '', hp.length > 0]);
        t.set(hLb[id].m, [hp.length ? hp.join(' · ') : '', false, 'green', hp.length > 0]);
      }
      for (const id of QIDS) {
        const it = s[MQ].find((x) => x.id === id), hot = !!it && on(MQ) && (hotIt(s, MQ, id) || blk.has(id));
        t.set(qLb[id].n, [it ? id : '', hot, it && it.q === 'pending' ? 'red' : '', !!it]);
        t.set(qLb[id].m, [it ? it.mode || '' : '', hot, it && it.q === 'granted' ? 'green' : it && it.q === 'pending' ? 'red' : '', !!it && !!it.mode]);
      }
      t.set(laneLb[0], ['보유', on(MQ), 'green']);
      t.set(laneLb[1], ['대기', on(MQ), s[MQ].some((x) => x.q === 'pending') ? 'red' : '']);
      t.set(qCap, [capOf(s[MQ]) || '—', on(MQ), '', true, true]);
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && it.tag === 'x' ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    EDG.forEach((e, i) => t.set(edgeLb[i], [e.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === e.hot ? 'gold' : '', i === 0 ? (TEXTS.length > 0 || SQLQ) && (ROWS.length > 0 || (!!MQ && !SQLQ)) : MEMR.length > 0 && DSKR.length > 0]));
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => { let w = 0, h = 0; const keep = lb.el.innerHTML; for (const t of TXALL) { const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); } lb.el.innerHTML = keep; return { w, h }; };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(67);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  /* 두 줄 사이 — 16 이었을 때 보유 칸 바로 아래의 대기 칸에서 그 칸으로 가는 화살표가 15px 이라 보이지 않았다(locks 11) */
  const QH = 36, LANEW = 40, QG = 30;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {} };
    let tn = Math.max(1, Math.min(3, TEXTS.length));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const tW = (ww - (tn - 1) * gap) / tn;
    for (const a of TEXTS) wrap(tx[a], tW);
    const tRows = Math.ceil(TEXTS.length / tn), tHs = Array.from({ length: tRows }, (_, r) => hMax(TEXTS.slice(r * tn, r * tn + tn).map((a) => tx[a])));
    /* 대기열 칸 폭 — 이름과 mode 중 넓은 것. 한 줄에 다 들어가지 않으면 좁힌다 */
    const qw0 = Object.fromEntries(QIDS.map((id) => [id, Math.max(70, Math.max(most(qLb[id].n).w, most(qLb[id].m).w) + 16)]));
    const perLane = MQ ? Math.max(1, ...all.flatMap((s) => [0, 1].map((l) => s[MQ].filter((x) => laneOf(x) === l).length))) : 1;
    const widest = MQ ? Math.max(...all.flatMap((s) => [0, 1].map((l) => laneIts(s, l).reduce((t, x) => t + qw0[x.id] + 10, -10)))) : 0;
    const qScale = widest > ww - LANEW ? (ww - LANEW) / widest : 1;
    G.qw = Object.fromEntries(QIDS.map((id) => [id, qw0[id] * qScale]));
    for (const id of QIDS) { wrap(qLb[id].n, G.qw[id] - 6); wrap(qLb[id].m, G.qw[id] - 6); }
    for (const id of HIDS) { wrap(hLb[id].n, G.qw[id] - 6); wrap(hLb[id].m, G.qw[id] - 6); }
    wrap(qCap, ww);
    const qcH = MQ ? most(qCap).h : 0;
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    const rc = ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    /* 칸 줄의 폭 — 한 상태에 함께 있는 칸들의 폭 중 가장 넓은 것(innodb-lock 과 같은 이유 — '(비었다)' 까지 더해 설명이 멀어졌다, locks 11 의 P_S) */
    const usedW = (a) => Math.max(0, ...all.map((s) => s[a].reduce((t, x) => t + sw[a][x.id] + 6, -6)));
    const chunks = (rs) => { const o = []; let i = 0; while (i < rs.length) { const a = rs[i], b = rs[i + 1]; if (rc > 1 && b && usedW(a) <= rW && usedW(b) <= rW) { o.push([a, b]); i += 2; } else { o.push([a]); i += 1; } } return o; };
    const BANDS = [...chunks(MEMR).map((c) => ({ c, disk: false })), ...chunks(DSKR).map((c) => ({ c, disk: true }))];
    const rowW = Object.fromEntries(BANDS.flatMap((band) => band.c.map((a) => [a, band.c.length > 1 ? rW : ww])));
    const rcH = {}, rSide = {};
    for (const a of ROWS) {
      const W0 = rowW[a], used = usedW(a), sideW = W0 - used - 12;
      wrap(rowCap[a], W0); const hb = most(rowCap[a]).h;
      let hs = Infinity; if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      rSide[a] = Math.max(26, hs) < 26 + 8 + hb ? used + 12 : 0; if (!rSide[a]) wrap(rowCap[a], W0);
      rcH[a] = rSide[a] ? hs : hb;
    }
    const lay = (y0, k = 1) => {
      let y = y0;
      const rowY = [y]; for (let r = 0; r < tRows; r++) rowY.push(rowY[r] + HD + tHs[r] + 12 * k);
      TEXTS.forEach((a, i) => { const x = L.x0 + (i % tn) * (tW + gap), yy = rowY[Math.floor(i / tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + tW - 18, y: yy + 8 }; });
      y = rowY[tRows];
      G.edgeY = [null, null]; G.cap = {};
      const queue = () => {
        place(hd[MQ], L.x0, y); y += HD + 4;
        G.lane = [y + QH / 2, y + QH + QG + QH / 2]; G.anc[MQ] = { x: L.x0 + ww / 2, y: G.lane[0] };
        place(laneLb[0], L.x0, G.lane[0], 'l', 'c'); place(laneLb[1], L.x0, G.lane[1], 'l', 'c');
        y += 2 * QH + QG + 26; G.qCapY = y; place(qCap, L.x0, y); y += qcH + 12 * k;
      };
      if (MQ && SQLQ) queue();
      if ((TEXTS.length || SQLQ) && (ROWS.length || (MQ && !SQLQ)) && EDG[0]) { y += 2 * k; G.edgeY[0] = y; place(edgeLb[0], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
      if (MQ && !SQLQ) queue();
      for (const band of BANDS) {
        if (band.disk && G.edgeY[1] == null && MEMR.length && EDG[1]) { y += 4 * k; G.edgeY[1] = y; place(edgeLb[1], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
        let hh = 0;
        band.c.forEach((a, j) => {
          const x0 = L.x0 + j * (rW + gap);
          place(hd[a], x0, y); G.slot[a] = { x0, y: y + HD, sw: sw[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + 13 };
          if (rSide[a]) { G.cap[a] = y + HD + 4; place(rowCap[a], x0 + rSide[a], G.cap[a]); hh = Math.max(hh, HD + Math.max(26, rcH[a] + 4)); }
          else { G.cap[a] = null; place(rowCap[a], x0, y + HD + 26 + 8); hh = Math.max(hh, HD + 26 + 8 + rcH[a]); }
        });
        y += hh + 14 * k;
      }
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`innodb ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 대기열 칸 — 줄마다 데이터 순서대로 왼쪽부터 */
  const qSlot = (s, id, h = false) => {
    const it = s[MQ].find((x) => x.id === id); if (!it) return null;
    const l = h ? 0 : laneOf(it); let x = G.L.x0 + LANEW;
    for (const q of laneIts(s, l)) { const w = G.qw[q.id]; if (q.id === id && q.h === h) return { x: x + w / 2, y: G.lane[l], w }; x += w + 10; }
    return null;
  };
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  function anchor(a, s, lbText) {
    if (a === MQ && G.lane) { const id = QIDS.find((x) => (lbText || '').includes(x.trim())) || [...modOf(s, MQ)].find((x) => QIDS.includes(x)); const P = id ? qSlot(s, id) : null; if (P) return [P.x, P.y]; }
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
    if (MQ) {
      const on = s.touch.has(MQ) && !end, blk = blockers(s);
      /* 대기 칸이 쥔 앞부분 — 보유 줄의 흐린 점선 칸 */
      for (const id of HIDS) {
        const it = s[MQ].find((x) => x.id === id), pv = prev[MQ].find((x) => x.id === id);
        const P1 = it && heldPart(it).length ? qSlot(s, id, true) : null, P0 = pv && heldPart(pv).length ? qSlot(prev, id, true) : null;
        if (!P1 && !(P0 && !end)) { hide('h:' + id); continue; }
        const P = P1 && P0 && !end ? { x: U.lerp(P0.x, P1.x, mv), y: P1.y, w: P1.w } : P1 || P0, gone = P1 ? 0 : show(p, 0.1, 0.4);
        const lv = (on ? 0.55 : 0.35) * dim * form * (1 - gone);
        for (let m = 0; m < ML; m++) {
          const i = R['h:' + id][0] + m;
          let [x, y] = rim(P.x, P.y, P.w, QH, ML, m);
          if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
          const [xx, yy] = into(i, x, y);
          put(o, i, xx, yy, lv * (m % 2 ? 1 : 0.3), 0, 0.03, 1, GREEN);
        }
      }
      for (const id of QIDS) {
        const it = s[MQ].find((x) => x.id === id), pv = prev[MQ].find((x) => x.id === id);
        const P1 = it ? qSlot(s, id) : null, P0 = pv ? qSlot(prev, id) : null;
        if (!P1 && !(P0 && !end)) { hide('q:' + id); continue; }
        /* 줄을 옮긴 칸(대기 → 보유)은 옛 자리에서 미끄러진다 */
        const P = P1 && P0 && !end ? { x: U.lerp(P0.x, P1.x, mv), y: U.lerp(P0.y, P1.y, mv), w: P1.w } : P1 || P0;
        const z = it || pv, gone = it ? 0 : show(p, 0.1, 0.4), lit = it && on && (hotIt(s, MQ, id) || blk.has(id));
        const col = z.q === 'granted' ? GREEN : z.q === 'gone' ? FAINT : RED, lv = (lit ? 0.95 : on ? 0.6 : 0.45) * dim * form * (1 - gone) * (z.q === 'gone' ? 0.5 : 1);
        const born = it && !pv && !end, from = born && act ? src : null;
        for (let m = 0; m < ML; m++) {
          const i = R['q:' + id][0] + m, f = m / ML;
          let [x, y] = rim(P.x, P.y, P.w, QH, ML, m);
          if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q) - Math.sin(q * Math.PI) * 18; }
          if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
          const [xx, yy] = into(i, x, y);
          put(o, i, xx, yy, lv * (z.q === 'gone' ? 0.6 * (m % 2) + 0.4 : 1), lit ? 0.3 : 0, 0.03, 1.1, col);
        }
      }
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
        if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q) - Math.sin(q * Math.PI) * 18; }
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, lv * (1 - gone) * (tg === 'free' ? 0.5 * (m % 2) : 1), 0, 0.03, 1.1, TAGC[tg] ?? INK);
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
      if (MQ) for (const it of s[MQ]) {
        const P = qSlot(s, it.id); if (P) { place(qLb[it.id].n, P.x, P.y - 2, 'c', 'b'); place(qLb[it.id].m, P.x, P.y + 1, 'c', 't'); }
        const H = heldPart(it).length ? qSlot(s, it.id, true) : null; if (H) { place(hLb[it.id].n, H.x, H.y - 2, 'c', 'b'); place(hLb[it.id].m, H.x, H.y + 1, 'c', 't'); }
      }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
      /* 옆 설명은 그 스텝의 칸 끝 바로 옆 — 줄바꿈 폭은 가장 넓은 상태의 것 그대로 */
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
    if (MQ) {
      /* 보유 줄과 대기 줄 사이의 가는 선 */
      ctx.globalAlpha = 0.3 * o; seg(ctx, L.x0 + LANEW, (G.lane[0] + G.lane[1]) / 2, L.x1, (G.lane[0] + G.lane[1]) / 2);
      /* 막는 것 — 대기 칸에서 by 칸으로. 같은 줄이면 위로 휜다 */
      ctx.globalAlpha = 0.6 * o; ctx.strokeStyle = css.red;
      for (const it of s[MQ]) {
        if (!it.by || it.q !== 'pending') continue;
        const P = qSlot(s, it.id), B = qSlot(s, it.by); if (!P || !B) continue;
        /* 같은 대기 줄 안이면 아래로 휜다 — 위로 휘면 보유 줄의 칸을 지난다 */
        const same = Math.abs(P.y - B.y) < 1, y0 = same ? P.y + QH / 2 : P.y - QH / 2, y1 = same ? B.y + QH / 2 : B.y + QH / 2;
        /* 줄이 다르고 거의 바로 위면 옆으로 휜다 — 곧게 그으면 두 줄 사이의 틈만큼(30px)만 보인다 */
        const cy = same ? P.y + QH / 2 + 22 : (y0 + y1) / 2, cx = (P.x + B.x) / 2 + (!same && Math.abs(P.x - B.x) < 40 ? 26 : 0);
        ctx.beginPath(); ctx.moveTo(P.x, y0); ctx.quadraticCurveTo(cx, cy, B.x, y1); ctx.stroke();
        const ang = Math.atan2(y1 - cy, B.x - cx);
        seg(ctx, B.x, y1, B.x - Math.cos(ang - 0.4) * 6, y1 - Math.sin(ang - 0.4) * 6); seg(ctx, B.x, y1, B.x - Math.cos(ang + 0.4) * 6, y1 - Math.sin(ang + 0.4) * 6);
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim(); css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') }; },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
