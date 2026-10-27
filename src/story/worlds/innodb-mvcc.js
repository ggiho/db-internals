/* mysql innodb 02 — 일관 읽기. 그리는 것은 모두 bake 상태에서 읽는다 —
     · 행의 숨은 열 = 사슬 머리(trx · rp 를 가진 frames 항목)의 띠 : PK · DB_TRX_ID 6 바이트 · DB_ROLL_PTR 7 바이트 · 열.
       DB_ROLL_PTR 아래에는 그 7 바이트의 배치 — INSERT 1 비트 · undo 테이블스페이스 7 비트 · 페이지 4 바이트 · 위치 2 바이트
     · 버전 사슬 = 머리에서 rp 를 따라간 칸들(행 → undo 0 → undo 1 …). ins 가 있는 칸에서 끝난다.
       read view 가 있으면 칸마다 보이나 · 안 보이나를 칠하고, 처음 보이는 칸(그 view 가 읽는 값)을 금빛으로
     · trx id 축 = read view 의 m_up_limit_id(이 아래는 보인다) · m_low_limit_id(이 위는 안 보인다) · m_ids 의 점,
       그리고 사슬의 각 버전이 가진 DB_TRX_ID
     · 나머지 kv 는 글 블록, 나머지 list · frames 는 칸 줄
     · 셈 맞추기 — m_up_limit_id 가 명단의 최솟값(명단이 비면 m_low_limit_id)이 아니거나, m_low_limit_id 가 명단의 id 이하이거나,
       ok 로 칠한 undo(여기서 멈춘다)가 그 view 가 실제로 읽는 버전과 다르면 console.error 로 알린다
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const SL = 48, SB = 120, AXN = 120, TOK = 150;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
const nums = (v) => [...bare(v).matchAll(/\d+/g)].map((m) => +m[0]);
/* 숨은 열의 바이트(DB_TRX_ID 6 · DB_ROLL_PTR 7)와 roll pointer 의 비트 배치(1 · 7 · 32 · 16) */
const COLS = [['PK', 4], ['DB_TRX_ID', 6], ['DB_ROLL_PTR', 7], ['c', 4]];
const RPB = [['INSERT', 1], ['undo 공간', 7], ['페이지', 32], ['위치', 16]];
/* 비트 이름표 묶음 — 좁은 두 칸(1 · 7 비트)은 한 이름표로. 따로 두었더니 7b 의 지시선이 1b 이름표를 뚫었다 */
const RPG = [[0, 1], [2], [3]];

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
  const KV = cast.filter((a) => A[a].kind === 'kv');
  const RV = KV.find((a) => all.some((s) => Object.keys(s[a]).some((k) => /^m_ids/.test(k)))) || null;
  /* read view 는 축이 그린다 — 글 블록으로 한 번 더 적으면 1024×768 에서 세계가 무대를 넘었다 */
  const TEXTS = KV.filter((a) => a !== RV);
  const ITEMS = cast.filter((a) => A[a].kind !== 'kv');
  /* 사슬에 드는 배우 — trx 를 가진 항목이 한 번이라도 있는 배우 */
  const CH = ITEMS.filter((a) => all.some((s) => s[a].some((x) => x.trx != null)));
  const ROWS = ITEMS.filter((a) => !CH.includes(a));
  const ids = (a) => [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));

  /* 사슬 — rp 를 가진 frames 항목이 머리. rp 를 따라가다 ins 나 없는 칸에서 멈춘다 */
  const find = (s, id) => { for (const a of CH) { const it = s[a].find((x) => x.id === id); if (it) return { a, it }; } return null; };
  const chainOf = (s) => {
    const head = CH.flatMap((a) => s[a].filter((x) => x.trx != null && A[a].kind === 'frames').map((it) => ({ a, it })))[0];
    const out = [];
    let cur = head;
    while (cur && out.length < 8) { out.push(cur); if (cur.it.ins || !cur.it.rp) break; cur = find(s, cur.it.rp); }
    return out;
  };
  const viewOf = (s) => {
    if (!RV) return null;
    const kv = s[RV], k = (re) => Object.keys(kv).find((x) => re.test(x));
    const up = nums(kv[k(/^m_up_limit_id/)])[0], low = nums(kv[k(/^m_low_limit_id/)])[0];
    if (up == null || low == null) return null;
    return { up, low, ids: nums(kv[k(/^m_ids/)]), me: nums(kv[k(/^m_creator/)])[0] ?? 0 };
  };
  const sees = (v, id) => id < v.up || id === v.me || (id < v.low && !v.ids.includes(id));

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    const at = `innodb 02 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    const v = viewOf(s);
    if (v) {
      const lowest = v.ids.length ? Math.min(...v.ids) : v.low;
      if (v.up !== lowest) console.error(`${at} : m_up_limit_id ${v.up} 가 명단의 최솟값 ${lowest} 가 아니다`);
      if (v.ids.some((x) => x >= v.low)) console.error(`${at} : m_low_limit_id ${v.low} 가 명단의 id 보다 크지 않다`);
    }
    const ch = chainOf(s), ok = ch.find((q) => q.it.tag === 'ok');
    if (ok && v) { const first = ch.find((q) => sees(v, q.it.trx)); if (!first || first.it.id !== ok.it.id) console.error(`${at} : '여기서 멈춘다' 는 ${ok.it.id} 인데 view 가 읽는 버전은 ${first ? first.it.id : '없음'}`); }
    for (let j = 1; j < ch.length; j++) if (ch[j].it.trx > ch[j - 1].it.trx) console.error(`${at} : 사슬이 거꾸로다 — ${ch[j - 1].it.id}(${ch[j - 1].it.trx}) 뒤의 ${ch[j].it.id}(${ch[j].it.trx})`);
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];
  const CIDS = [...new Set(all.flatMap((s) => CH.flatMap((a) => s[a].filter((x) => x.trx != null).map((x) => a + ':' + x.id))))];
  /* 축의 범위 — 나온 trx id 와 view 의 경계 전부 */
  const TX = all.flatMap((s) => { const v = viewOf(s); return [...CH.flatMap((a) => s[a].map((x) => x.trx)).filter((x) => x != null), ...(v ? [v.up, v.low, ...v.ids] : [])]; });
  const AX = TX.length ? { lo: Math.min(...TX) - 2, hi: Math.max(...TX) + 2 } : null;

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  take('strip', SB);
  CIDS.forEach((k) => take('c:' + k, SL));
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  if (AX) take('ax', AXN);
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb 02 세계 : 알갱이가 모자란다');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') { const el = document.createElement('div'); el.className = 'wl ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; }
  function setText(lb, s, html = false) { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls)); }
  function place(lb, x, y, al = 'l', va = 't') { const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%'; lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`; }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const stHd = label('aq'), colLb = COLS.map(() => ({ n: label('aq'), v: label('aq') })), rpLb = RPG.map(() => label('aq'));
  const chHd = label('aq'), cLb = Object.fromEntries(CIDS.map((k) => [k, { n: label('aq aq-c'), v: label('aq aq-c') }]));
  const axHd = label('aq'), axT = Object.fromEntries(CIDS.map((k) => [k, label('aq')])), axUp = label('aq'), axLow = label('aq'), axIds = label('aq'), axKey = label('aq');
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const visOf = (s, it) => { const v = viewOf(s); return v ? (sees(v, it.trx) ? 'see' : 'no') : ''; };
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a), ch = chainOf(s), head = ch[0], v = viewOf(s), first = v ? ch.find((q) => sees(v, q.it.trx)) : null;
    const chOn = CH.some(on);
    /* 사슬 배우와 read view 는 자기 제목(사슬 · 축)이 따로 있다 — 배우 이름표는 숨긴다 */
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a), '', !CH.includes(a) && a !== RV]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], focusOf(s, a)), on(a), '', true, true]);
    /* 숨은 열 */
    t.set(stHd, [head ? `${head.it.id} 의 레코드  ·  숨은 열` : '', chOn, '', !!head]);
    /* roll pointer 가 가리키던 undo 가 회수됐으면 그렇다고 — 12 스텝에서 지워진 undo 0 을 계속 가리키는 것처럼 보였다 */
    const cv = head ? [nums(head.it.sub)[0] ?? '', head.it.trx, head.it.rp ? '→ ' + head.it.rp + (find(s, head.it.rp) ? '' : '  (회수됨)') : '—', head.it.c ?? ''] : [];
    COLS.forEach(([n, w], i) => { t.set(colLb[i].n, [head ? `${n}${i === 1 || i === 2 ? '  ' + w + ' B' : ''}` : '', chOn, '', !!head]); t.set(colLb[i].v, [head ? String(i === 0 ? 'id 5' : cv[i]) : '', chOn && i > 0, i === 1 && head && modOf(s, head.a).has(head.it.id) ? 'gold' : '', !!head]); });
    RPG.forEach((g, i) => t.set(rpLb[i], [head ? g.map((j) => `${RPB[j][0]} ${RPB[j][1]}b`).join('  ·  ') : '', chOn, '', !!head]));
    /* 사슬 */
    t.set(chHd, [ch.length ? 'version chain  ·  DB_ROLL_PTR 를 따라' : '', chOn, '', ch.length > 0]);
    for (const k of CIDS) {
      const q = ch.find((x) => x.a + ':' + x.it.id === k), vis = q ? visOf(s, q.it) : '';
      t.set(cLb[k].n, [q ? q.it.id : '', !!q && chOn && hotIt(s, q.a, q.it.id), first && q === first ? 'gold' : vis === 'no' ? 'red' : '', !!q]);
      /* 상태를 칠한 칸(ok 여기서 멈춘다 · x 회수 불가 · free 회수 가능)은 sub 의 첫 구절을 한 줄 더 — 11 스텝의 purge 가 색만으로는 안 보였다 */
      /* 그 구절은 칸의 상태 색으로 — 보이나(초록)와 같은 색이면 '회수 불가' 가 초록으로 읽혔다(11) */
      const st = q && ['ok', 'x', 'free'].includes(q.it.tag) ? q.it.sub.split(/\s+·\s+/)[0] : '';
      const stH = !st ? '' : q.it.tag === 'x' ? `<span class="q-r">${esc(st)}</span>` : q.it.tag === 'free' ? `<span style="color:var(--faint)">${esc(st)}</span>` : esc(st);
      t.set(cLb[k].v, [q ? `${esc(`c = ${q.it.c}  ·  trx ${q.it.trx}${q.it.ins ? '  ·  INSERT' : ''}`)}${st ? '<br>' + stH : ''}` : '', !!q && chOn, vis === 'see' ? 'green' : vis === 'no' ? 'red' : '', !!q, true]);
      t.set(axT[k], [q && AX ? `${q.it.id} ${q.it.trx}` : '', !!q && (chOn || (RV && on(RV))), vis === 'see' ? 'green' : vis === 'no' ? 'red' : '', !!q && !!AX]);
    }
    /* 축 */
    const rvOn = RV ? on(RV) : false;
    const rvs = RV ? bare(s[RV][Object.keys(s[RV]).find((x) => /^read view/.test(x))] ?? '') : '';
    t.set(axHd, [AX ? `trx id  ·  ${A[RV] ? A[RV].nm : 'READ VIEW'} ${v ? '— creator ' + v.me : rvs && rvs !== '—' ? rvs : '없음'}` : '', rvOn || chOn, '', !!AX]);
    /* 명단의 가장 작은 id 가 곧 m_up_limit_id 면 한 이름표로 */
    const idsHere = v && v.ids.length && !(v.ids.length === 1 && v.ids[0] === v.up);
    t.set(axUp, [v ? `m_up_limit_id ${v.up}${v.ids.length && v.ids[0] === v.up && !idsHere ? '  =  m_ids { ' + v.ids.join(', ') + ' }' : ''}` : '', rvOn, 'green', !!v]);
    t.set(axLow, [v ? `m_low_limit_id ${v.low}` : '', rvOn, 'red', !!v]);
    t.set(axIds, [idsHere ? `m_ids { ${v.ids.join(', ')} }` : '', rvOn, 'gold', !!idsHere]);
    t.set(axKey, [v ? '초록 = 보인다(m_up_limit_id 아래)  ·  빨강 = 안 보인다(m_low_limit_id 이상)  ·  그 사이는 명단에 없으면 보인다' : '', rvOn, '', !!v, false]);
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => { let w = 0, h = 0; const keep = lb.el.innerHTML; for (const t of TXALL) { const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); } lb.el.innerHTML = keep; return { w, h }; };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(43);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15;
  const axX = (t) => G.ax.x0 + ((t - AX.lo) / (AX.hi - AX.lo)) * (G.ax.x1 - G.ax.x0);
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, slot: {}, anc: {} };
    let tn = Math.max(1, Math.min(3, TEXTS.length));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const tW = (ww - (tn - 1) * gap) / tn;
    for (const a of TEXTS) wrap(tx[a], tW);
    const tRows = Math.ceil(TEXTS.length / tn), tHs = Array.from({ length: tRows }, (_, r) => hMax(TEXTS.slice(r * tn, r * tn + tn).map((a) => tx[a])));
    /* 띠 — 바이트 비례, 그 아래 roll pointer 의 비트 배치는 DB_ROLL_PTR 칸 폭 안에서 비트 비례 */
    const tot = COLS.reduce((p, [, w]) => p + w, 0);
    let x = L.x0; G.cols = COLS.map(([, w]) => { const r = [x, (ww * w) / tot]; x += r[1]; return r; });
    const [rx, rw] = G.cols[2], rtot = RPB.reduce((p, [, w]) => p + w, 0);
    let x2 = rx; G.rpb = RPB.map(([, w]) => { const r = [x2, (rw * w) / rtot]; x2 += r[1]; return r; });
    /* roll pointer 의 비트 이름 — 칸이 좁으면(1 비트) 줄을 나눈다 */
    /* 묶음 이름표는 오른쪽 끝을 그 칸들의 끝에 맞춘다 — 가운데에 두었더니 넓어서 옆의 '페이지 32b' 를 아랫줄로 밀었다 */
    const RB = stagger(RPG.map((g, i) => { const a0 = G.rpb[g[0]][0], a1 = G.rpb[g[g.length - 1]][0] + G.rpb[g[g.length - 1]][1], w = most(rpLb[i]).w; return { id: i, cx: g.length > 1 ? a1 + 3 - w / 2 : (a0 + a1) / 2, pins: g.map((j) => G.rpb[j][0] + G.rpb[j][1] / 2), w }; }), L.x0, L.x1);
    G.rpRows = RB.rows; G.rpOut = RB.out;
    /* 사슬 칸 — 머리부터 가로로, 칸 폭은 이름표만큼 */
    const cw = Math.max(110, ...CIDS.map((k) => Math.max(most(cLb[k].n).w, most(cLb[k].v).w) + 18));
    G.cw = Math.min(cw, (ww - 2 * 40) / Math.max(1, Math.min(3, CIDS.length)));
    for (const k of CIDS) { wrap(cLb[k].v, G.cw - 10); }
    const cvH = hMax(CIDS.map((k) => cLb[k].v));
    /* 축 이름표 — 스텝마다 줄 나누기 */
    G.ax = { x0: L.x0 + 8, x1: L.x1 - 8 };
    let axR = 1;
    if (AX) for (const b of BAKES.values()) b.AXL = b.S.map((s, kk) => {
      const T = b.TX[kk], g2 = (lb) => { const e = T.get(lb); return e && e[3] !== false ? e[0] : ''; }, wOf = (lb) => { const h = g2(lb); if (!h) return 0; const keep = lb.el.innerHTML; lb.el.innerHTML = h; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };
      const ch = chainOf(s), v = viewOf(s);
      const up = ch.map((q) => ({ lb: axT[q.a + ':' + q.it.id], cx: axX(q.it.trx) })).map((q) => ({ ...q, w: wOf(q.lb) })).filter((q) => q.w);
      const dn = v ? [{ lb: axUp, cx: axX(v.up) }, { lb: axLow, cx: axX(v.low) }, { lb: axIds, cx: axX(v.ids[0] ?? v.up) }].map((q) => ({ ...q, w: wOf(q.lb) })).filter((q) => q.w) : [];
      const U2 = stagger(up, L.x0, L.x1), D2 = stagger(dn, L.x0, L.x1);
      axR = Math.max(axR, U2.rows, D2.rows);
      return { up: U2.out, dn: D2.out };
    });
    wrap(axKey, ww); const keyH = AX ? most(axKey).h : 0;
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    const rc = ROWS.length >= 2 && ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
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
      TEXTS.forEach((a, i) => { const xx = L.x0 + (i % tn) * (tW + gap), yy = rowY[Math.floor(i / tn)]; place(hd[a], xx, yy); place(tx[a], xx, yy + HD); G.anc[a] = { x: xx + tW - 18, y: yy + 8 }; });
      y = rowY[tRows];
      /* 숨은 열 띠 */
      place(stHd, L.x0, y); y += HD + 14;
      G.strip = { y }; y += 22 + 4 + 15 + 6;
      G.rpY = y; y += 10 + 6 + G.rpRows * RH + 10 * k;
      /* 사슬 */
      place(chHd, L.x0, y); y += HD + 4;
      G.chain = { y: y + 15 }; G.anc.chain = { x: L.x0 + G.cw / 2, y: y + 15 };
      for (const a of CH) G.anc[a] = G.anc.chain;
      y += 30 + 6 + cvH + 12 * k;
      /* 축 */
      if (AX) { place(axHd, L.x0, y); y += HD + axR * RH + 8; G.ax.y = y; if (RV) G.anc[RV] = { x: L.x0 + ww / 2, y }; y += 14 + axR * RH + 4; G.axKeyY = y; place(axKey, L.x0, y); y += keyH + 10 * k; }
      for (let i = 0; i < ROWS.length; i += rc) {
        let hh = 0;
        ROWS.slice(i, i + rc).forEach((a, j) => {
          const x0 = L.x0 + j * (rW + gap);
          place(hd[a], x0, y); G.slot[a] = { x0, y: y + HD, sw: sw[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + 13 };
          if (rSide[a]) { place(rowCap[a], x0 + rSide[a], y + HD + 4); hh = Math.max(hh, HD + Math.max(26, rcH[a] + 4)); }
          else { place(rowCap[a], x0, y + HD + 26 + 8); hh = Math.max(hh, HD + 26 + 8 + rcH[a]); }
        });
        y += hh + 14 * k;
      }
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`innodb 02 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    HT = total;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 사슬 칸의 자리 — 머리부터 가로로, 칸 사이 40 */
  const chainSlot = (s, k) => { const ch = chainOf(s), j = ch.findIndex((q) => q.a + ':' + q.it.id === k); return j < 0 ? null : { x: G.L.x0 + G.cw / 2 + j * (G.cw + 40), y: G.chain.y, j }; };
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  function anchor(a, s, lbText) {
    if (CH.includes(a)) {
      const ch = chainOf(s), q = ch.find((x) => x.a === a && (lbText || '').includes(x.it.id)) || ch.find((x) => x.a === a && modOf(s, a).has(x.it.id)) || ch.find((x) => x.a === a);
      if (q) { const P = chainSlot(s, q.a + ':' + q.it.id); if (P) return [P.x, P.y]; }
    }
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
    const mv = show(p, 0.12, 0.42), chOn = CH.some((a) => s.touch.has(a)) && !end;
    const ch = chainOf(s), v = viewOf(s), first = v ? ch.find((q) => sees(v, q.it.trx)) : null, head = ch[0];
    /* 숨은 열 띠 — 칸마다 위아래 테두리, DB_TRX_ID 가 이번에 바뀌었으면 금빛 */
    {
      const [s0, s1] = R.strip, n = s1 - s0;
      if (!head) hide('strip');
      else for (let m = 0; m < n; m++) {
        const i = s0 + m, u = Math.floor(m / 2) / Math.ceil(n / 2), x = G.L.x0 + u * (G.L.x1 - G.L.x0), y = G.strip.y + (m % 2 ? 22 : 0);
        const ci = G.cols.findIndex(([x0, w]) => x >= x0 && x < x0 + w), hot = ci === 1 && chOn && modOf(s, head.a).has(head.it.id);
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, (chOn ? 0.85 : 0.45) * dim * form, hot ? 0.5 : 0, 0.02, 1.05, hot ? GOLD : ci === 1 || ci === 2 ? ACCENT : INK);
      }
    }
    /* 사슬 칸 — 보이나(초록) · 안 보이나(빨강) · 처음 보이는 것(금빛). 새 칸은 act 의 출발점에서 날아온다 */
    const src = act ? anchor(act.f, s, act.lb) : null;
    for (const key of CIDS) {
      const [c0] = R['c:' + key], P = chainSlot(s, key), P0 = chainSlot(prev, key);
      const q = ch.find((x) => x.a + ':' + x.it.id === key);
      if (!P && !(P0 && !end)) { hide('c:' + key); continue; }
      const at = P || P0, gone = P ? 0 : show(p, 0.1, 0.4), vis = q && v ? sees(v, q.it.trx) : null;
      const col = q && first === q ? GOLD : vis === true ? GREEN : vis === false ? RED : q ? TAGC[q.it.tag] ?? INK : FAINT;
      const lit = q && chOn && hotIt(s, q.a, q.it.id);
      const born = P && !P0 && !end, from = born && act ? src : null;
      for (let m = 0; m < SL; m++) {
        const i = c0 + m, f = m / SL;
        let [x, y] = rim(P0 && P && P0.j !== P.j && !end ? U.lerp(P0.x, P.x, mv) : at.x, at.y, G.cw, 30, SL, m);
        if (from) { const qq = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, qq); y = U.lerp(from[1], y, qq) - Math.sin(qq * Math.PI) * 18; }
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, (lit ? 0.95 : 0.55) * dim * form * (1 - gone), first === q && q ? 0.5 : 0, 0.03, 1.1, col);
      }
    }
    /* trx id 축 — 보이는 구역(초록) · 안 보이는 구역(빨강)은 overlay 가 칠한다. 알갱이는 눈금 */
    if (AX) {
      const [a0, a1] = R.ax, marks = [];
      for (const q of ch) marks.push([axX(q.it.trx), sees(v || { up: -1, low: Infinity, ids: [], me: -1 }, q.it.trx) && v ? GREEN : v ? RED : INK, 'up']);
      if (v) { marks.push([axX(v.up), GREEN, 'dn']); marks.push([axX(v.low), RED, 'dn']); for (const id of v.ids) marks.push([axX(id), GOLD, 'pt']); }
      let i = a0;
      const rvOn = RV && s.touch.has(RV) && !end;
      for (const [x, col, kd] of marks) for (let m = 0; m < 8 && i < a1; m++, i++) {
        const y = kd === 'up' ? G.ax.y - 3 - m * 1.6 : kd === 'dn' ? G.ax.y + 3 + m * 1.6 : G.ax.y + Math.cos(m * 0.785) * 3;
        const xx2 = kd === 'pt' ? x + Math.sin(m * 0.785) * 3 : x;
        const [xx, yy] = into(i, xx2, y);
        put(o, i, xx, yy, ((kd === 'up' ? chOn : rvOn) ? 0.95 : 0.55) * dim * form, 0.3, 0.02, 1.2, col);
      }
      for (; i < a1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    }
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const gone = it ? 0 : show(p, 0.1, 0.4), lv = (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form, tg = (it || pv).tag;
      for (let m = 0; m < SL; m++) {
        const i = R[key][0] + m; let [x, y] = rim(P.x, P.y, P.w, 24, SL, m);
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
      COLS.forEach((_, i) => { const [x0, w] = G.cols[i]; place(colLb[i].n, x0 + 4, G.strip.y - 3, 'l', 'b'); place(colLb[i].v, x0 + w / 2, G.strip.y + 11, 'c', 'c'); });
      for (const q of G.rpOut) place(rpLb[q.id], q.l, G.rpY + 16 + q.row * RH, 'l', 't');
      for (const kq of CIDS) { const P = chainSlot(s, kq); if (P) { place(cLb[kq].n, P.x, P.y, 'c', 'c'); place(cLb[kq].v, P.x, P.y + 21, 'c', 't'); } }
      if (AX && cur.AXL) { const al = cur.AXL[kk]; for (const q of al.up) place(q.lb, q.l, G.ax.y - 14 - q.row * RH, 'l', 'b'); for (const q of al.dn) place(q.lb, q.l, G.ax.y + 14 + q.row * RH, 'l', 't'); place(axKey, G.L.x0, G.axKeyY); place(axHd, G.L.x0, G.ax.y - 14 - (al.up.length ? Math.max(...al.up.map((q) => q.row)) + 1 : 0) * RH - 18); }
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
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G, ch = chainOf(s), v = viewOf(s);
    ctx.save(); ctx.lineWidth = 1;
    if (ch.length) {
      /* 띠의 칸 경계와 DB_ROLL_PTR → 비트 배치 */
      ctx.strokeStyle = css.faint; ctx.globalAlpha = 0.5 * o;
      for (const [x0] of G.cols.slice(1)) seg(ctx, x0, G.strip.y, x0, G.strip.y + 22);
      const [rx, rw] = G.cols[2];
      ctx.globalAlpha = 0.35 * o; seg(ctx, rx, G.strip.y + 24, G.rpb[0][0], G.rpY); seg(ctx, rx + rw, G.strip.y + 24, rx + rw, G.rpY);
      ctx.globalAlpha = 0.55 * o; ctx.strokeStyle = css.accent;
      ctx.strokeRect(rx, G.rpY, rw, 10);
      for (const [x0] of G.rpb.slice(1)) seg(ctx, x0, G.rpY, x0, G.rpY + 10);
      ctx.globalAlpha = 0.3 * o; ctx.strokeStyle = css.faint;
      for (const q of G.rpOut) for (const x of q.pins) if (q.row > 0 || x < q.l || x > q.r) seg(ctx, x, G.rpY + 11, x, G.rpY + 16 + q.row * RH - 1);
      /* 사슬의 화살표 */
      ctx.strokeStyle = css.ink; ctx.globalAlpha = 0.5 * o;
      for (let j = 1; j < ch.length; j++) {
        const x0 = L.x0 + G.cw / 2 + (j - 1) * (G.cw + 40) + G.cw / 2 + 4, x1 = x0 + 32, y = G.chain.y;
        seg(ctx, x0, y, x1, y); seg(ctx, x1 - 5, y - 4, x1, y); seg(ctx, x1 - 5, y + 4, x1, y);
      }
    }
    if (AX && G.ax.y) {
      ctx.globalAlpha = 0.55 * o; ctx.strokeStyle = css.ink; seg(ctx, G.ax.x0, G.ax.y, G.ax.x1, G.ax.y);
      if (v) {
        /* 보이는 구역 — 자의 왼쪽 끝부터 m_up_limit_id 까지, 안 보이는 구역 — m_low_limit_id 부터 끝까지 */
        ctx.globalAlpha = 0.2 * o; ctx.fillStyle = css.green; ctx.fillRect(G.ax.x0, G.ax.y - 2, axX(v.up) - G.ax.x0, 4);
        ctx.fillStyle = css.red; ctx.fillRect(axX(v.low), G.ax.y - 2, G.ax.x1 - axX(v.low), 4);
      }
      ctx.globalAlpha = 0.3 * o; ctx.strokeStyle = css.faint;
      const al = cur.AXL[kk];
      for (const q of al.up) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, G.ax.y - 14 - q.row * RH + 1, q.cx, G.ax.y - 9);
      for (const q of al.dn) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, G.ax.y + 13, q.cx, G.ax.y + 14 + q.row * RH - 1);
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
