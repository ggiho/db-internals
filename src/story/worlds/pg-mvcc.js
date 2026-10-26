/* postgres mvcc — 모든 장면이 같은 세계를 쓴다. 장면이 쓰는 배우만 그린다.
   그리는 것은 모두 장면의 bake 상태에서 읽는다(손으로 적은 값이 없다) —
     · TUPLE HEADER(hdr, t_xmin 이 있을 때) = 23 바이트 띠 — t_xmin 4 · t_xmax 4 · t_cid 4 · t_ctid 6 · t_infomask2 2 ·
       t_infomask 2 · t_hoff 1. 칸의 폭이 바이트 수, 이름은 위 · 값은 아래(겹치면 줄을 바꾸고 선으로 잇는다)
     · t_infomask2 · t_infomask = 16 비트 띠. 값에 적힌 비트 이름(htup_details.h 의 #define 에서 HEAP_ 를 뺀 것)을
       켜고, 'natts N' 은 아래 11 비트에 N 을 이진수로. 값의 0x.... 는 켠 비트의 합과 같아야 한다
     · SNAPSHOT(sn · snap) = XID 수직선. xmin · xmax 와 xip 의 XID, 그리고 튜플의 xmin(필드)을 같은 선 위에.
       XID 사이가 4 보다 크면 선을 끊어 그린다(100 과 200 · 201 이 한 선에 함께 읽히게)
     · HEAP TUPLES(tup, 항목에 lp 가 있을 때) = 한 heap 페이지 — 헤더(24 B) · line pointer 배열 · 끝에서부터 쌓인 튜플.
       튜플 칸 안에 xmin · xmax 와 hb(헤더 비트). lp → 튜플, ctid 로 새 버전, LP_REDIRECT 는 lp → lp.
       lps : dead 빨간 테두리 · unused 흐린 테두리 · redirect
     · INDEX(idx, 항목에 to 가 있을 때) = 항목에서 그 lp 로 선
     · VISIBILITY MAP(vm, 항목에 av 가 있을 때) = 페이지마다 두 비트(ALL_VISIBLE · ALL_FROZEN), n 은 이어진 페이지 수
     · XID SPACE(xid, '현재 XID' 가 있을 때) = 32 비트 고리. 현재 XID 에서 뒤로 2^31 이 과거, 앞으로 2^31 이 미래
     · 나머지 kv 는 글 블록, 나머지 list 는 칸 줄
     · 셈 맞추기 — lp 가 겹치거나, ctid · redirect · 인덱스가 없는 것을 가리키거나, snapshot 의 xip 가 [xmin, xmax) 밖이거나,
       비트 이름을 모르거나 0x 값이 비트의 합과 다르면 console.error 로 알린다(storysweep 의 errors 가 잡는다)
   손잡이가 있는 장면(08 transaction_isolation)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const TU = 120, LPN = 30, SL = 44, HB = 160, AX = 150, VB = 60, RING = 220, TOK = 150, BC = 12;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const nums = (v) => (bare(v).match(/\d[\d,]*/g) || []).map((x) => +x.replace(/,/g, ''));
const TAGC = { clean: INK, x: RED, dirty: GOLD, sep: ACCENT, ok: GREEN, free: FAINT, hold: GOLD, pin: GOLD, wait: GOLD };
const HDR = [['t_xmin', 4], ['t_xmax', 4], ['t_cid', 4], ['t_ctid', 6], ['t_infomask2', 2], ['t_infomask', 2], ['t_hoff', 1]];
/* src/include/access/htup_details.h 의 #define 그대로 */
const IM1 = {
  HASNULL: 0x0001, HASVARWIDTH: 0x0002, HASEXTERNAL: 0x0004, HASOID_OLD: 0x0008, XMAX_KEYSHR_LOCK: 0x0010, COMBOCID: 0x0020,
  XMAX_EXCL_LOCK: 0x0040, XMAX_LOCK_ONLY: 0x0080, XMAX_SHR_LOCK: 0x0050, XMIN_COMMITTED: 0x0100, XMIN_INVALID: 0x0200,
  XMIN_FROZEN: 0x0300, XMAX_COMMITTED: 0x0400, XMAX_INVALID: 0x0800, XMAX_IS_MULTI: 0x1000, UPDATED: 0x2000, MOVED_OFF: 0x4000, MOVED_IN: 0x8000,
};
const IM2 = { KEYS_UPDATED: 0x2000, HOT_UPDATED: 0x4000, ONLY_TUPLE: 0x8000 };
const STRIPS = [['t_infomask2', IM2], ['t_infomask', IM1]];
const decode = (v, T) => {
  const s = bare(v), fl = [...new Set(s.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])];
  const hx = /0x([0-9a-f]{4})\b/i.exec(s), na = /natts\s+(\d+)/.exec(s), natts = na ? +na[1] : null;
  const ok = fl.filter((f) => f in T), mask = ok.reduce((m, f) => m | T[f], natts || 0);
  return { fl: ok, bad: fl.filter((f) => !(f in T)), mask, hex: hx ? parseInt(hx[1], 16) : null, natts, any: ok.length > 0 || natts != null };
};
const hex4 = (m) => '0x' + m.toString(16).padStart(4, '0');
const bitsIn = (m) => Array.from({ length: 16 }, (_, b) => b).filter((b) => m & (1 << b));
export default {
  count: (narrow) => (narrow ? 3600 : 5000),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);

  /* ── 상태 읽기 — 손잡이 값마다 ── */
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
    const S = frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch));
    BAKES.set(k, { S0, S, NK: S.length });
  }
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  /* 역할 — 그 배우의 데이터가 그 모양을 가졌을 때만 */
  const has = (a, f) => cast.includes(a) && all.some((s) => f(s[a]));
  const HDRA = has('hdr', (kv) => kv && 't_xmin' in kv) ? 'hdr' : null;
  const SNAP = ['sn', 'snap'].find((a) => has(a, (kv) => kv && ('xip' in kv || 'xmin' in kv))) || null;
  const PAGE = has('tup', (it) => it && it.some((x) => x.lp != null)) ? 'tup' : null;
  const IDX = has('idx', (it) => it && it.some((x) => x.to != null)) ? 'idx' : null;
  const VM = has('vm', (it) => it && it.some((x) => x.av != null)) ? 'vm' : null;
  const RINGA = has('xid', (kv) => kv && '현재 XID' in kv) ? 'xid' : null;
  /* PGPROC 의 subxid 캐시 — kv 의 subxids 가 'N / 64' 일 때 64 칸 */
  const CACHE = cast.find((a) => A[a].kind === 'kv' && ![HDRA, SNAP, RINGA].includes(a) && all.some((s) => s[a] && /\d+\s*\/\s*64\b/.test(bare(s[a].subxids)))) || null;
  const SPECIAL = new Set([HDRA, SNAP, PAGE, IDX, VM, RINGA, CACHE].filter(Boolean));
  const TEXTS = cast.filter((a) => A[a].kind === 'kv' && !SPECIAL.has(a));
  const ROWS = cast.filter((a) => A[a].kind === 'list' && !SPECIAL.has(a));
  /* 백엔드 · 슬롯 — list 항목이 xmin 이나 xid 를 가졌을 때. XID 선 위에 min(xmin, xid) 로 선다(procarray.c 의
     ComputeXidHorizons 가 둘 다 본다). horizon 은 kv 의 OldestXmin(vacuum.c 의 cutoffs->OldestXmin) */
  const pv0 = (x) => Math.min(...[x.xmin, x.xid].filter((v) => v > 0));
  const PROCS = SNAP ? ROWS.filter((a) => all.some((s) => s[a].some((x) => isFinite(pv0(x))))) : [];
  const HZA = SNAP ? TEXTS.find((a) => all.some((s) => nums(s[a].OldestXmin)[0] > 0)) || null : null;
  const ids = (a) => [...new Set(all.flatMap((s) => (s[a] || []).map((x) => x.id)))];
  const TIDS = PAGE ? ids(PAGE) : [], XIDS = IDX ? ids(IDX) : [], VIDS = VM ? ids(VM) : [];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  const MAXLP = PAGE ? Math.max(1, ...all.flatMap((s) => s[PAGE].map((x) => x.lp || 0))) : 0;
  /* 비트 띠 — 어느 스텝에든 비트 이름이나 natts 가 적힌 필드만. 이름표는 모든 스텝에 나오는 비트의 합집합 */
  const STR = HDRA ? STRIPS.filter(([k, T]) => all.some((s) => decode(s[HDRA][k], T).any)) : [];
  const FLU = Object.fromEntries(STR.map(([k, T]) => [k, [...new Set(all.flatMap((s) => decode(s[HDRA][k], T).fl))]]));
  const NAT = Object.fromEntries(STR.map(([k, T]) => [k, all.some((s) => decode(s[HDRA][k], T).natts != null)]));
  const snapOf = (s) => {
    const kv = s[SNAP] || {}, xmin = nums(kv.xmin)[0], xmax = nums(kv.xmax)[0], xip = nums(kv.xip);
    return { xmin, xmax, xip };
  };
  const stored = (x) => !!x && x.lp != null && !['dead', 'unused', 'redirect'].includes(x.lps);
  /* XID 수직선의 눈금 — 모든 스텝의 snapshot · 튜플 xmin/xmax. 사이가 4 이하면 그 거리만큼, 넘으면 끊고 3 칸 */
  const XU = (() => {
    if (!SNAP) return null;
    const xs = [...new Set(all.flatMap((s) => { const n = snapOf(s); return [n.xmin, n.xmax, ...n.xip, ...(PAGE ? s[PAGE].flatMap((t) => [t.xmin, t.xmax]) : []),
      ...PROCS.flatMap((a) => s[a].map(pv0)), HZA ? nums(s[HZA].OldestXmin)[0] : 0]; }).filter((x) => x > 0 && isFinite(x)))].sort((p, q) => p - q);
    if (!xs.length) return null;
    const pos = new Map(), brk = [];
    let u = 1;
    xs.forEach((x, i) => { if (i) { const d = x - xs[i - 1]; if (d > 4) { brk.push(u + 1.5); u += 3; } else u += d; } pos.set(x, u); });
    return { pos, n: u + 1, brk };
  })();

  /* 셈 맞추기 */
  for (const [k, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    const at = `pg mvcc ${sc.num} 세계${k ? ' (' + sc.vary.knob + '=' + k + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    if (PAGE) {
      const live = s[PAGE].filter((t) => t.lp != null), seen = new Map();
      for (const t of live) { if (seen.has(t.lp)) console.error(`${at} 의 lp ${t.lp} 를 ${seen.get(t.lp)} 와 ${t.id} 가 함께 쓴다`); seen.set(t.lp, t.id); }
      for (const t of live) {
        if (t.ctid && !s[PAGE].some((x) => x.id === t.ctid)) console.error(`${at} 의 ${t.id} 가 없는 튜플 ${t.ctid} 를 ctid 로 가리킨다`);
        if (t.lps === 'redirect' && !live.some((x) => x.lp === t.rto)) console.error(`${at} 의 lp ${t.lp} 가 없는 lp ${t.rto} 로 redirect 한다`);
      }
    }
    if (IDX && PAGE) for (const e of s[IDX]) if (e.to != null && !s[PAGE].some((t) => t.lp === e.to)) console.error(`${at} 의 인덱스 ${e.id} 가 없는 lp ${e.to} 를 가리킨다`);
    if (SNAP) { const n = snapOf(s); if (n.xmin > 0 && n.xmax > 0) for (const x of n.xip) if (x < n.xmin || x >= n.xmax) console.error(`${at} 의 xip ${x} 가 [${n.xmin}, ${n.xmax}) 밖이다`); }
    if (HZA && PROCS.length) {
      const h = nums(s[HZA].OldestXmin)[0], m = Math.min(...PROCS.flatMap((a) => s[a].map(pv0)));
      if (h > 0 && isFinite(m) && h !== m) console.error(`${at} 의 OldestXmin ${h} 가 백엔드 · 슬롯의 가장 작은 xmin/xid ${m} 와 다르다`);
    }
    if (CACHE) { const n = nums(s[CACHE].subxids); if (n.length && (n[0] > 64 || (n[0] < 64 && /overflow/i.test(bare(s[CACHE].subxids))))) console.error(`${at} 의 subxids ${bare(s[CACHE].subxids)} — 64 칸을 넘기 전에는 overflow 가 아니다`); }
    for (const [f, T] of STR) {
      const d = decode(s[HDRA][f], T);
      if (d.bad.length) console.error(`${at} 의 ${f} 에 모르는 비트 이름 ${d.bad.join(', ')}`);
      if (d.hex != null && d.hex !== d.mask) console.error(`${at} 의 ${f} 가 ${hex4(d.hex)} 인데 비트의 합은 ${hex4(d.mask)} 다`);
    }
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  TIDS.forEach((id) => take('t:' + id, TU));
  for (let j = 1; j <= MAXLP; j++) take('lp:' + j, LPN);
  if (PAGE) take('ph', HB);
  XIDS.forEach((id) => take('i:' + id, SL));
  VIDS.forEach((id) => take('v:' + id, VB));
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  if (HDRA) take('hdr', HB);
  for (const [k] of STR) take('b:' + k, 16 * BC);
  if (CACHE) take('cache', 64 * 6);
  if (SNAP) take('ax', AX);
  if (RINGA) take('ring', RING);
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('pg mvcc 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표(DOM) — 모두 읽어야 하는 값이라 .sm 을 쓰지 않는다 ── */
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
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  /* 필드 이름은 화면 폭에 따라 t_ 를 뗀다 — 글이 스텝마다 같으므로 build 에서 쓰고 paint 는 밝기만 */
  const hdrLb = HDRA ? Object.fromEntries(HDR.map(([k]) => [k, { name: label('aq'), v: label('aq') }])) : null;
  const hdrCap = HDRA ? label('aq ml aq-b') : null;
  /* 칸마다 바이트 수 — 두 점 줄 사이 */
  const hdrB = HDRA ? Object.fromEntries(HDR.map(([k]) => [k, label('aq aq-c')])) : null;
  const stripLb = Object.fromEntries(STR.map(([k]) => [k, { head: label('aq'), nat: NAT[k] ? label('aq') : null, fl: Object.fromEntries(FLU[k].map((f) => [f, label('aq')])) }]));
  const snapLb = SNAP ? { xmin: label('aq'), xmax: label('aq'), xip: label('aq'), rest: label('aq ml aq-b') } : null;
  const tupLb = Object.fromEntries(TIDS.map((id) => [id, label('aq ml aq-c')]));
  const tickLb = Object.fromEntries(TIDS.map((id) => [id, label('aq aq-c')]));
  const lpLb = Object.fromEntries(Array.from({ length: MAXLP }, (_, j) => [j + 1, label('aq aq-c')]));
  const phLb = PAGE ? label('aq aq-c') : null;
  const capLb = PAGE ? label('aq ml aq-b') : null;
  const ixLb = Object.fromEntries(XIDS.map((id) => [id, label('aq aq-c')]));
  const ixCap = IDX ? label('aq ml aq-b') : null;
  const vmLb = Object.fromEntries(VIDS.map((id) => [id, label('aq ml aq-c aq-b')]));
  /* 두 비트 칸 아래 V · F — 이름은 머리말에 한 번 */
  const vmVF = Object.fromEntries(VIDS.map((id) => [id, [label('aq aq-c'), label('aq aq-c')]]));
  /* 이어진 페이지(n > 1)가 있으면 칸 아래에 n 개의 눈금 — 32 번째(SKIP_PAGES_THRESHOLD)가 길다 */
  const VRUN = VM && all.some((s) => s[VM].some((x) => x.n > 1));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const ringLb = RINGA ? label('aq ml aq-b') : null;
  /* 고리 위의 이름 — 튜플의 xmin(헤더 띠의 t_xmin), 바늘 뒤 반 바퀴 · 앞 반 바퀴, 그리고 '한계' 가 적히면 wrap 한계
     (varsup.c : xidWrapLimit = datfrozenxid + 2^31, 경고 4천만 전 · 거부 3백만 전. datfrozenxid 는 얼지 않은 가장 늙은 xmin) */
  const ringX = RINGA ? { xmin: label('aq'), past: label('aq aq-c'), fut: label('aq aq-c'), wrap: label('aq') } : null;
  const ringXmin = (s) => (HDRA ? nums(s[HDRA].t_xmin)[0] || 0 : 0);
  const ringLim = (s) => !!s[RINGA] && bare(s[RINGA]['한계'] || '—') !== '—';
  const procLb = Object.fromEntries(PROCS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq')]))]));
  const hzLb = HZA ? label('aq') : null, cacheCap = CACHE ? label('aq ml aq-b') : null;
  const edgeLb = label('aq'), tok = label('stn-tok');
  /* 레인 — 배우의 lane 순서(SQL 계층 · HEAP · 공유 메모리)로 쌓는다. TABLE AM 은 EDGE.after 레인 다음,
     그 밖의 레인 사이는 아래 레인의 이름으로 가른다 */
  const LORD = [...new Set([...(deck.LANES || []).map((l) => l.id), ...cast.map((a) => A[a].lane)])];
  const LUSE = LORD.filter((ln) => cast.some((a) => A[a].lane === ln));
  const DIV = LUSE.filter((ln, i) => i > 0 && !(EDGE && EDGE.after === LUSE[i - 1]));
  const laneLb = Object.fromEntries(DIV.map((ln) => [ln, label('aq')]));

  /* 스텝마다의 글과 강조 — [글, 또렷한가, 색, 보이나, html] */
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, skip = []) => Object.entries(kv).filter(([k]) => !skip.includes(k)).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  /* 튜플 칸 안의 글 — 이름, 헤더의 xmin · xmax, 헤더 비트(hb) */
  const tupText = (t) => {
    const ln = [`<span class="q-i">${esc(t.id)}</span>`];
    if (t.xmin != null) ln.push('xmin ' + t.xmin, 'xmax ' + (t.xmax || 0));
    if (t.hb) ln.push(...String(t.hb).split(/\s*·\s*/).map(esc));
    return ln.join('\n');
  };
  const SKEY = new Map(STR);
  const texts = (S, S0) => S.map((s, i) => {
    const t = new Map(), on = (a) => s.touch.has(a), pv = i ? S[i - 1] : S0;
    /* 헤더 띠의 이름에 누구의 헤더인지('튜플' 키)를 붙인다 */
    for (const a of cast) t.set(hd[a], [A[a].nm + (a === HDRA ? (s[a]['튜플'] ? `  ·  튜플 ${bare(s[a]['튜플'])}` : '') + '  ·  23 B' : a === VM ? '  ·  V = ALL_VISIBLE  ·  F = ALL_FROZEN' : ''), on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a]), on(a), '', true, true]);
    if (HDRA) {
      const mod = modOf(s, HDRA), hot = (k) => on(HDRA) && (mod.has(k) || !mod.size);
      for (const [k] of HDR) {
        const v = s[HDRA][k], T = SKEY.get(k), d = T ? decode(v, T) : null;
        t.set(hdrLb[k].v, [v == null ? '—' : d && d.any ? hex4(d.mask) : val(v), hot(k), '', true, true]);
      }
      t.set(hdrCap, [kvHtml(s[HDRA], [...HDR.map(([k]) => k), '튜플']), on(HDRA), '', true, true]);
      for (const [k, b] of HDR) t.set(hdrB[k], [b + ' B', false]);
      for (const [k, T] of STR) {
        const d = decode(s[HDRA][k], T), dp = decode(pv[HDRA][k], T);
        t.set(stripLb[k].head, [k + '  ·  16 bit', on(HDRA)]);
        if (stripLb[k].nat) t.set(stripLb[k].nat, [d.natts != null ? 'natts ' + d.natts : '', hot(k), '', d.natts != null]);
        for (const f of FLU[k]) t.set(stripLb[k].fl[f], [f, hot(k), d.fl.includes(f) && !dp.fl.includes(f) && i > 0 ? 'gold' : '', d.fl.includes(f)]);
      }
    }
    if (SNAP) {
      const kv = s[SNAP], n = snapOf(s);
      t.set(snapLb.xmin, [n.xmin ? 'xmin ' + n.xmin : '', on(SNAP), '', !!n.xmin]);
      t.set(snapLb.xmax, [n.xmax ? 'xmax ' + n.xmax : '', on(SNAP), '', !!n.xmax]);
      t.set(snapLb.xip, [n.xip.length ? 'xip ' + n.xip.join(' · ') : '', on(SNAP), 'gold', n.xip.length > 0]);
      t.set(snapLb.rest, [kvHtml(kv, ['xmin', 'xmax', 'xip']), on(SNAP), '', true, true]);
    }
    if (PAGE) {
      for (const id of TIDS) {
        const it = s[PAGE].find((x) => x.id === id);
        t.set(tupLb[id], [it ? tupText(it) : '', on(PAGE) && !!it && hotIt(s, PAGE, id), it && it.tag === 'x' ? 'red' : '', stored(it), true]);
        t.set(tickLb[id], [it ? id.replace(/^튜플\s*/, '').replace(/^버전\s*/, 'v') : '', on(PAGE) && !!it && hotIt(s, PAGE, id), '', !!(SNAP && stored(it) && it.xmin > 0)]);
      }
      for (let j = 1; j <= MAXLP; j++) {
        const it = s[PAGE].find((x) => x.lp === j), st = it ? (it.lps || 'normal') : null;
        t.set(lpLb[j], ['lp ' + j, on(PAGE) && !!it && hotIt(s, PAGE, it.id), st === 'dead' ? 'red' : st === 'redirect' ? 'gold' : '', !!it]);
      }
      t.set(phLb, ['page hdr 24 B', on(PAGE)]);
      /* 칸 안의 xmin · xmax 를 되풀이할 뿐인 설명은 뺀다 */
      const notes = s[PAGE].filter((x) => x.sub && !/^xmin \d+( · xmax \d+)?$/.test(x.sub.trim())).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`);
      t.set(capLb, [notes.join('\n'), on(PAGE), '', true, true]);
    }
    if (IDX) {
      for (const id of XIDS) { const it = s[IDX].find((x) => x.id === id); t.set(ixLb[id], [it ? id : '', on(IDX) && !!it && hotIt(s, IDX, id), it && it.tag === 'x' ? 'red' : '', !!it && it.tag !== 'free']); }
      t.set(ixCap, [s[IDX].filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n'), on(IDX), '', true, true]);
    }
    if (VM) for (const id of VIDS) {
      const it = s[VM].find((x) => x.id === id), h = on(VM) && !!it && hotIt(s, VM, id);
      t.set(vmLb[id], [it ? `<span class="q-i">${esc(id)}</span>\n${esc(it.sub || '')}` : '', h, '', !!it, true]);
      t.set(vmVF[id][0], ['V', h, '', !!it]); t.set(vmVF[id][1], ['F', h, '', !!it]);
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), '', !!it]); }
      t.set(rowCap[a], [s[a].filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n') || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    if (RINGA) {
      t.set(ringLb, [kvHtml(s[RINGA]), on(RINGA), '', true, true]);
      const xm = ringXmin(s);
      t.set(ringX.xmin, [xm ? 't_xmin ' + xm : '', on(RINGA), '', !!xm]);
      t.set(ringX.past, ['과거 2^31', on(RINGA)]); t.set(ringX.fut, ['미래 2^31', on(RINGA)]);
      t.set(ringX.wrap, ['wrap 한계', on(RINGA), 'red', ringLim(s) && !!xm]);
    }
    for (const a of PROCS) for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id), v = it ? pv0(it) : Infinity; t.set(procLb[a][id], [isFinite(v) ? `${id}  ${v}` : '', on(a) && !!it && hotIt(s, a, id), '', isFinite(v)]); }
    if (HZA) { const h = nums(s[HZA].OldestXmin)[0]; t.set(hzLb, [h > 0 ? 'horizon ' + h : '', on(HZA), 'red', h > 0]); }
    if (CACHE) t.set(cacheCap, [kvHtml(s[CACHE]).split('\n').join('  ·  '), on(CACHE), '', true, true]);
    if (EDGE) t.set(edgeLb, [EDGE.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '', LUSE.some((ln, j) => j > 0 && LUSE[j - 1] === EDGE.after)]);
    for (const ln of DIV) t.set(laneLb[ln], [((deck.LANES || []).find((l) => l.id === ln) || { lb: ln }).lb, false]);
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S, b.S0);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  /* 재는 동안 넣은 글은 되돌린다(다시 짤 때 다음 paint 전까지 다른 스텝의 글이 남지 않게) */
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
  const rnd = U.rng(17);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {} };
    /* 높이를 먼저 잰다 — 한 번 쌓아 보고, 넓은 화면은 가운데로 옮겨 다시 쌓는다 */
    const TL = Object.fromEntries(LUSE.map((ln) => {
      const as = TEXTS.filter((a) => A[a].lane === ln), n = Math.max(1, Math.min(3, as.length)), w = (ww - (n - 1) * gap) / n;
      for (const a of as) wrap(tx[a], w);
      return [ln, { as, n, w, rows: Math.ceil(as.length / n), h: as.length ? hMax(as.map((a) => tx[a])) : 0 }];
    }));
    /* 헤더 띠 — 칸의 폭은 바이트 수. 이름 · 값의 줄은 화면 폭마다 다시 나눈다 */
    const hw = (b) => (ww * b) / 23;
    let NM = null, VL = null;
    if (HDRA) {
      const fx = {};
      let x = L.x0;
      for (const [k, b] of HDR) { fx[k] = { x, w: hw(b) }; x += hw(b); }
      G.hdrF = fx;
      for (const short of [false, true]) {
        for (const [k] of HDR) setText(hdrLb[k].name, short ? k.replace(/^t_/, '') : k);
        NM = stagger(HDR.map(([k]) => ({ k, cx: fx[k].x + fx[k].w / 2, w: hdrLb[k].name.el.getBoundingClientRect().width })), L.x0, L.x1);
        if (NM.ok && NM.rows <= 2) break;
      }
      VL = stagger(HDR.map(([k]) => ({ k, cx: fx[k].x + fx[k].w / 2, w: most(hdrLb[k].v).w })), L.x0, L.x1);
      wrap(hdrCap, ww);
    }
    const hcH = HDRA ? most(hdrCap).h : 0;
    /* 비트 띠 — 왼쪽이 비트 15. 이름표는 모든 스텝의 비트를 한 번에 나눠 스텝마다 자리가 같다 */
    const cw = ww / 16, bitX = (b) => L.x0 + (15 - b + 0.5) * cw;
    G.cw = cw; G.bitX = bitX;
    const FL = Object.fromEntries(STR.map(([k, T]) => {
      const its = FLU[k].map((f) => { const pins = bitsIn(T[f]).map(bitX); return { f, cx: pins.reduce((p, q) => p + q, 0) / pins.length, w: most(stripLb[k].fl[f]).w, pins }; });
      if (NAT[k]) its.push({ f: '', nat: true, cx: (bitX(0) + bitX(10)) / 2, w: most(stripLb[k].nat).w, pins: [(bitX(0) + bitX(10)) / 2] });
      return [k, stagger(its, L.x0, L.x1)];
    }));
    if (SNAP) wrap(snapLb.rest, ww);
    const srH = SNAP ? most(snapLb.rest).h : 0;
    if (CACHE) wrap(cacheCap, ww);
    const ccH = CACHE ? most(cacheCap).h : 0;
    /* XID 선 — 왼쪽 끝은 튜플 생애 막대의 이름 자리. 선 위 이름표(snapshot · 백엔드 · horizon)는 스텝마다 나눠 두고
       가장 많은 줄만큼 높이를 잡는다 */
    const BR = PAGE && SNAP ? TIDS.filter((id) => all.some((s) => { const it = s[PAGE].find((x) => x.id === id); return it && it.xmin > 0; })) : [];
    const gut = BR.length ? Math.ceil(Math.max(...BR.map((id) => most(tickLb[id]).w))) + 16 : 10;
    G.ax = { x0: L.x0 + gut, x1: L.x1 - 10, y: 0 };
    G.bar = {};
    let topRows = 1;
    if (SNAP && XU) {
      const wc = new Map();
      const wOf = (lb, html) => {
        let m = wc.get(lb);
        if (!m) wc.set(lb, (m = new Map()));
        if (!m.has(html)) { const keep = lb.el.innerHTML; lb.el.innerHTML = html; m.set(html, lb.el.getBoundingClientRect().width); lb.el.innerHTML = keep; }
        return m.get(html);
      };
      for (const b of BAKES.values()) {
        b.TOP = b.S.map((s, kk) => {
          const T = b.TX[kk], n = snapOf(s), its = [];
          const add = (lb, pins) => { const e = T.get(lb); if (e && e[3] !== false && e[0]) its.push({ lb, cx: pins.reduce((p, q) => p + q, 0) / pins.length, w: wOf(lb, e[0]), pins }); };
          if (n.xmin) add(snapLb.xmin, [xidX(n.xmin)]);
          if (n.xmax) add(snapLb.xmax, [xidX(n.xmax)]);
          if (n.xip.length) add(snapLb.xip, n.xip.map(xidX));
          for (const a of PROCS) for (const it of s[a]) if (isFinite(pv0(it))) add(procLb[a][it.id], [xidX(pv0(it))]);
          if (HZA) { const h = nums(s[HZA].OldestXmin)[0]; if (h > 0) add(hzLb, [xidX(h)]); }
          return stagger(its, L.x0, L.x1);
        });
        topRows = Math.max(topRows, ...b.TOP.map((q) => q.rows));
      }
    }
    /* heap 페이지 — 헤더 · lp 배열 · 튜플. 튜플 칸은 안의 글이 들어갈 만큼 */
    const lpw = 40, lph = 20, phw = PAGE ? Math.max(52, Math.ceil(most(phLb).w) + 14) : 52;
    const tm = TIDS.map((id) => most(tupLb[id]));
    const tw = Math.max(64, Math.ceil(Math.max(0, ...tm.map((m) => m.w))) + 16), th = Math.max(34, Math.ceil(Math.max(0, ...tm.map((m) => m.h))) + 12);
    const nst = PAGE ? Math.max(1, ...all.map((s) => s[PAGE].filter(stored).length)) : 1;
    const tg = nst > 1 ? Math.min(26, (ww - 16 - nst * tw) / (nst - 1)) : 26;
    if (PAGE && tg < 6) console.error(`pg mvcc ${sc.num} 세계 : 튜플 ${nst} 개가 페이지 폭 ${Math.round(ww)} 에 안 들어간다`);
    /* 실제 페이지처럼 lp 는 앞에서, 튜플은 끝에서 한 줄로 — 둘 사이(빈 공간)가 28px 이상 남을 때만 */
    const one = PAGE && ww - (8 + phw + 10 + MAXLP * (lpw + 6)) - (nst * (tw + tg) - tg + 8) >= 28;
    if (PAGE) wrap(capLb, ww);
    const cpH = PAGE ? most(capLb).h : 0;
    if (IDX) wrap(ixCap, ww);
    const icH = IDX ? most(ixCap).h : 0;
    const vw = VM ? Math.round(U.clamp((ww - (VIDS.length - 1) * 12) / Math.max(1, VIDS.length), 70, 160)) : 0;
    for (const id of VIDS) wrap(vmLb[id], vw);
    const vlH = VM ? hMax(VIDS.map((id) => vmLb[id])) : 0;
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    for (const a of ROWS) wrap(rowCap[a], ww);
    const rcH = Object.fromEntries(ROWS.map((a) => [a, most(rowCap[a]).h]));
    if (RINGA) wrap(ringLb, ww * 0.5);
    const rgW = RINGA ? most(ringLb).w : 0, rgT = RINGA ? most(ringLb).h : 0;
    /* k — 블록 사이 간격의 배율, rr — XID 고리의 반지름 상한. 무대보다 높으면 간격을, 그래도 높으면 고리를 줄여 다시 쌓는다 */
    const lay = (y0, k = 1, rr = 120) => {
      let y = y0;
      const texts = (ln) => {
        const T = TL[ln];
        T.as.forEach((a, i) => { const x = L.x0 + (i % T.n) * (T.w + gap), yy = y + Math.floor(i / T.n) * (HD + T.h + 12); place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + T.w - 18, y: yy + 8 }; });
        y += T.rows * (HD + T.h + 12 * k);
      };
      const hdrBlk = () => {
        place(hd[HDRA], L.x0, y); y += HD + 6 + NM.rows * RH;
        G.hdr = { y };
        /* 줄을 내렸거나 옆으로 밀린 이름 · 값만 칸의 가운데로 잇는다 */
        const off = (q) => q.row > 0 || q.cx < q.l || q.cx > q.r;
        G.hdrLead = [];
        for (const q of NM.out) { place(hdrLb[q.k].name, q.l, y - 3 - q.row * RH, 'l', 'b'); if (off(q)) G.hdrLead.push([q.cx, y - 3 - q.row * RH + 1, y - 2]); }
        for (const q of VL.out) { place(hdrLb[q.k].v, q.l, y + 26 + 5 + q.row * RH, 'l', 't'); if (off(q)) G.hdrLead.push([q.cx, y + 28, y + 26 + 5 + q.row * RH - 1]); }
        G.anc[HDRA] = { x: L.x0 + hw(4), y: y + 13 };
        for (const [kf] of HDR) place(hdrB[kf], G.hdrF[kf].x + G.hdrF[kf].w / 2, y + 13, 'c', 'c');
        y += 26 + 5 + VL.rows * RH + 6; place(hdrCap, L.x0, y); y += hcH + (hcH > 1 ? 10 * k : 0) + 6 * k;
        G.strip = {};
        for (const [f] of STR) {
          place(stripLb[f].head, L.x0, y); y += HD + 2;
          G.strip[f] = { y: y + 6 };
          for (const q of FL[f].out) place(q.nat ? stripLb[f].nat : stripLb[f].fl[q.f], q.l, y + 12 + 8 + q.row * RH, 'l', 't');
          G.strip[f].fl = FL[f].out;
          y += 12 + 8 + FL[f].rows * RH + 12 * k;
        }
      };
      const cacheBlk = () => {
        place(hd[CACHE], L.x0, y); y += HD + 6;
        G.cache = { y, cw: ww / 32 }; G.anc[CACHE] = { x: L.x0 + ww / 4, y: y + 5 };
        y += 2 * 14 + 6; place(cacheCap, L.x0, y); y += ccH + 14 * k;
      };
      const rowsAt = (a) => {
        place(hd[a], L.x0, y); G.slot[a] = { y: y + HD, sw: sw[a] }; G.anc[a] = { x: L.x0 + 30, y: y + HD + 13 };
        y += HD + 26 + 8; G.slot[a].capY = y; place(rowCap[a], L.x0, y); y += rcH[a] + 16 * k;
      };
      const snapBlk = () => {
        place(hd[SNAP], L.x0, y); y += HD + 6 + topRows * RH + 8;
        G.ax.y = y; G.anc[SNAP] = { x: L.x0 + ww / 2, y };
        BR.forEach((id, r) => { G.bar[id] = y + 16 + r * 14; });
        y += 16 + BR.length * 14 + 4; place(snapLb.rest, L.x0, y); y += srH + 14 * k;
      };
      /* 고리 — 오른쪽에 글을 두고 남는 폭만큼 키운다 */
      const ringBlk = () => {
        place(hd[RINGA], L.x0, y);
        const r = Math.max(56, Math.min(rr, (ww - rgW - 60) / 2));
        G.ring = { x: L.x0 + r + 10, y: y + HD + r + 6, r };
        place(ringLb, L.x0 + 2 * r + 40, y + HD + 6); G.anc[RINGA] = { x: G.ring.x, y: G.ring.y };
        y += HD + Math.max(2 * r + 12, rgT) + 16 * k;
      };
      /* 인덱스 — 설명을 칸 위에 둔다(칸에서 lp 로 가는 선이 글을 지나지 않게) */
      const idxBlk = () => {
        place(hd[IDX], L.x0, y); y += HD + 2;
        G.ixCapY = y; place(ixCap, L.x0, y); y += icH + (icH > 1 ? 8 : 0);
        G.ixY = y + 12; G.anc[IDX] = { x: L.x0 + 40, y: G.ixY };
        y += 24 + 12 + 10 * k;
      };
      /* 페이지 이름은 페이지 안 오른쪽 위 — 왼쪽 위로 인덱스 선이 내려온다 */
      const pageBlk = () => {
        /* 한 줄 : 위쪽 22px 는 lp → 튜플 선이 넘어가는 자리, 페이지 이름은 lp 칸 아래.
           두 줄 : lp 줄 아래에 튜플 줄, 이름은 오른쪽 위 */
        let h, ry, ty;
        if (one) {
          ry = ty = y + 22 + th / 2;
          const nT = ry + lph / 2 + 3;
          h = Math.max(ry + th / 2 + 12, nT + 19) - y;
          place(hd[PAGE], L.x0 + 8, nT, 'l', 't');
        } else {
          ry = y + 8 + lph / 2; ty = y + 8 + lph + 10 + 8 * k + th / 2;
          h = 8 + lph + 10 + 8 * k + th + 12 + 8 * k;
          place(hd[PAGE], L.x1 - 8, y + 8, 'r', 't');
        }
        G.page = { x0: L.x0, x1: L.x1, y, h, tw, th, tg, lpw, lph, phw, one, ry, ty };
        G.anc[PAGE] = { x: L.x1 - tw / 2 - 8, y: ty };
        y += h + 8 + 4 * k; G.capY = y; place(capLb, L.x0, y); y += cpH + 16 * k;
      };
      const vmBlk = () => {
        G.vm = { y: y + HD + 4, w: vw, ly: 30 + (VRUN ? 14 : 0) };
        place(hd[VM], L.x0, y); G.anc[VM] = { x: L.x0 + vw / 2, y: G.vm.y + 14 };
        y += HD + 4 + 14 + G.vm.ly + 6 + vlH + 16 * k;
      };
      const BLK = [[HDRA, hdrBlk], ['', texts], [CACHE, cacheBlk], [SNAP, snapBlk], [RINGA, ringBlk], [IDX, idxBlk], [PAGE, pageBlk], [VM, vmBlk], ...ROWS.map((a) => [a, () => rowsAt(a)])].filter(([a]) => a !== null);
      G.edgeY = null; G.divs = [];
      LUSE.forEach((ln, j) => {
        if (j) {
          y += 4 + 10 * k;
          if (EDGE && EDGE.after === LUSE[j - 1]) { G.edgeY = y; place(edgeLb, L.x1, y - 3, 'r', 'b'); }
          else { G.divs.push(y); place(laneLb[ln], L.x1, y - 3, 'r', 'b'); }
          y += 8 + 8 * k;
        }
        for (const [a, f] of BLK) if (a ? A[a].lane === ln : TL[ln].as.length) f(ln);
      });
      return y - y0;
    };
    let k = 1, rr = 120, total = lay(L.y0, 1, rr);
    if (total > wh) { k = 0.2; total = lay(L.y0, k, rr); }
    if (total > wh && RINGA) { rr = 70; total = lay(L.y0, k, rr); }
    if (total > wh + 1) console.error(`pg mvcc ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k, rr);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* heap 페이지의 자리 — lp 는 헤더 다음 왼쪽부터, 튜플은 페이지 끝(오른쪽)부터 lp 순서대로 왼쪽으로 쌓인다 */
  const lpAt = (j) => { const P = G.page; return { x: P.x0 + 8 + P.phw + 10 + (j - 0.5) * (P.lpw + 6), y: P.ry }; };
  const sOrder = (s) => s[PAGE].filter(stored).sort((p, q) => p.lp - q.lp);
  function tupAt(s, id) {
    const t = s[PAGE].find((x) => x.id === id);
    if (!stored(t)) return null;
    const P = G.page, j = sOrder(s).indexOf(t);
    return { x: P.x1 - 8 - P.tw / 2 - j * (P.tw + P.tg), y: P.ty, j };
  }
  const ringTh = (v) => (v / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
  const xidX = (x) => G.ax.x0 + ((XU.pos.get(x) ?? 0) / XU.n) * (G.ax.x1 - G.ax.x0);
  const rowSlot = (s, a, id) => { let x = G.L.x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  const ixSlot = (s, id) => { const its = s[IDX], j = its.findIndex((x) => x.id === id); if (j < 0) return null; const w = 74; return { x: G.L.x0 + w / 2 + j * (w + 10), y: G.ixY, w }; };
  const vmCell = (s, id) => { const j = s[VM].findIndex((x) => x.id === id); return j < 0 ? null : { x: G.L.x0 + G.vm.w / 2 + j * (G.vm.w + 12), y: G.vm.y + 14 }; };
  function anchor(a, s, lbText) {
    if (a === PAGE) {
      const id = TIDS.filter((x) => (lbText || '').includes(x)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, PAGE)].find((x) => TIDS.includes(x));
      const P = id ? tupAt(s, id) : null;
      if (P) return [P.x, P.y];
    }
    if (a === IDX) { const id = [...modOf(s, IDX)][0]; const P = id ? ixSlot(s, id) : null; if (P) return [P.x, P.y]; }
    if (a === VM) { const id = [...modOf(s, VM)][0]; const P = id ? vmCell(s, id) : null; if (P) return [P.x, P.y]; }
    if (ROWS.includes(a)) { const id = [...modOf(s, a)][0]; const P = id ? rowSlot(s, a, id) : null; if (P) return [P.x, P.y]; }
    const P = G.anc[a];
    return P ? [P.x, P.y] : [G.L.x0, G.L.y0];
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
  /* 칸 하나 — 테두리(글자가 안에 들어가도록 안은 비운다). 두 겹이면 새로 온 것 */
  function box(o, r0, n, P, PV, w, h, tg, a0, lit, e, from, gone, into, fly) {
    const dbl = tg === 'dirty' || tg === 'ok';
    for (let m = 0; m < n; m++) {
      const i = r0 + m, f = m / n, inner = dbl && m % 2 === 1;
      const cx = PV && e < 1 ? U.lerp(PV.x, P.x, e) : P.x, cy = PV && e < 1 ? U.lerp(PV.y, P.y, e) : P.y;
      let [x, y] = rim(cx, cy, inner ? w - 5 : w, inner ? h - 5 : h, dbl ? n / 2 : n, dbl ? Math.floor(m / 2) : m);
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
    const src = act ? anchor(act.f, s, act.lb) : null, mv = show(p, 0.12, 0.4);
    const level = (a, id) => (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
    /* 헤더 띠 — 칸 일곱. 바뀐 칸이 금빛 */
    if (HDRA) {
      const [h0] = R.hdr, n = HB, mod = modOf(s, HDRA);
      for (let m = 0; m < n; m++) {
        const u = m / n, x = G.L.x0 + u * (G.L.x1 - G.L.x0), y = G.hdr.y + (m % 2 ? 26 : 0);
        let acc = 0, key = HDR[0][0]; for (const [kk2, b] of HDR) { if (u * 23 < acc + b) { key = kk2; break; } acc += b; }
        const [xx, yy] = into(h0 + m, x, y);
        put(o, h0 + m, xx, yy, (s.touch.has(HDRA) && !end ? 0.85 : 0.45) * dim * form, mod.has(key) && !end ? 0.5 : 0, 0.02, 1.05, mod.has(key) && !end ? GOLD : INK);
      }
      /* 비트 띠 — 켠 비트는 칸을 채우고, 끈 비트는 테두리만. 이번 스텝에 바뀐 비트가 금빛 */
      for (const [k, T] of STR) {
        const [b0] = R['b:' + k], mk = decode(s[HDRA][k], T).mask, pm = decode(prev[HDRA][k], T).mask, on = s.touch.has(HDRA) && !end;
        const cwid = Math.max(6, G.cw - 4), cy = G.strip[k].y;
        for (let b = 0; b < 16; b++) for (let m = 0; m < BC; m++) {
          const i = b0 + b * BC + m, now = !!(mk & (1 << b)), was = !!(pm & (1 << b));
          const bit = !end && now !== was ? (show(p, 0.2, 0.42) > m / BC ? now : was) : now, cx = G.bitX(b);
          const [x, y] = bit ? [cx + ((m % 4) - 1.5) * Math.min(5, (cwid - 3) / 3.2), cy + (Math.floor(m / 4) - 1) * 3.8] : rim(cx, cy, cwid, 12, BC, m);
          const [xx, yy] = into(i, x, y), hot = now !== was && !end;
          put(o, i, xx, yy, (bit ? (on ? 0.95 : 0.6) : on ? 0.35 : 0.22) * dim * form, bit && hot ? 0.5 : 0, 0.02, bit ? 1.45 : 1, bit ? (hot ? GOLD : INK) : FAINT);
        }
      }
    }
    /* XID 수직선 — 선 위에 xmin(먹) · xmax(먹) · xip(금). 튜플의 xmin 은 선 아래 작은 눈금 */
    /* 선 위로 선 눈금(snapshot · 백엔드), 아래로는 튜플 생애 막대의 두 끝(xmin · xmax) */
    if (SNAP && XU) {
      const [x0] = R.ax, n = snapOf(s), on = s.touch.has(SNAP) && !end, marks = [];
      if (n.xmin) marks.push([n.xmin, INK, 10]); if (n.xmax) marks.push([n.xmax, INK, 10]);
      for (const x of n.xip) marks.push([x, GOLD, 7]);
      for (const a of PROCS) for (const it of s[a]) if (isFinite(pv0(it))) marks.push([pv0(it), ACCENT, 8]);
      if (PAGE) for (const tp of s[PAGE]) if (stored(tp) && tp.xmin > 0 && G.bar[tp.id] != null) {
        marks.push([tp.xmin, TAGC[tp.tag] ?? INK, 0, G.bar[tp.id]]);
        if (tp.xmax > 0) marks.push([tp.xmax, TAGC[tp.tag] ?? INK, 0, G.bar[tp.id]]);
      }
      const PL = [[0, 0], [-1.8, 0], [1.8, 0], [0, -1.8], [0, 1.8]];
      for (let m = 0; m < AX; m++) {
        const i = x0 + m, mk = marks[Math.floor(m / 5)];
        if (!mk) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const [xv, col, hh, by] = mk, mx = xidX(xv);
        const [x, y] = into(i, hh > 0 ? mx : mx + PL[m % 5][0], hh > 0 ? G.ax.y - 3 - (m % 5) * (hh / 5) : by + PL[m % 5][1]);
        put(o, i, x, y, (on ? 0.95 : 0.6) * dim * form, on ? 0.4 : 0, 0.02, 1.15, col);
      }
    }
    /* subxid 캐시 — 64 칸. 찬 칸은 채우고, 이번에 찬 칸은 금빛, 넘쳤으면(overflowed) 모두 빨강 */
    if (CACHE) {
      const [c0] = R.cache, kv = s[CACHE], nN = Math.min(64, nums(kv.subxids)[0] || 0), pN = Math.min(64, nums(prev[CACHE].subxids)[0] || 0);
      const ov = /overflow/i.test(bare(kv.subxids)), on = s.touch.has(CACHE) && !end, fill = end ? nN : U.lerp(pN, nN, show(p, 0.15, 0.45));
      const cw = G.cache.cw, w = Math.max(5, cw - 3), RIM = [[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1], [0, -1], [0, 1]];
      for (let c = 0; c < 64; c++) {
        const cx = G.L.x0 + ((c % 32) + 0.5) * cw, cy = G.cache.y + 5 + Math.floor(c / 32) * 14, full = c + 1 <= fill + 1e-6;
        const col = full ? (ov ? RED : c >= pN && !end ? GOLD : INK) : FAINT;
        for (let m = 0; m < 6; m++) {
          const i = c0 + c * 6 + m, [x, y] = into(i, full ? cx + ((m % 3) - 1) * Math.min(3.2, w / 3.4) : cx + RIM[m][0] * w, full ? cy + (Math.floor(m / 3) - 0.5) * 4 : cy + RIM[m][1] * 5);
          put(o, i, x, y, (full ? (on ? 0.95 : 0.6) : on ? 0.3 : 0.2) * dim * form, full && col === GOLD ? 0.5 : 0, 0.02, full ? 1.3 : 1, col);
        }
      }
    }
    /* heap 페이지 — 테두리와 헤더(24 B) 칸 */
    if (PAGE) {
      const [p0] = R.ph, P = G.page, on = s.touch.has(PAGE) && !end;
      for (let m = 0; m < HB; m++) {
        const [x, y] = m < 120 ? rim((P.x0 + P.x1) / 2, P.y + P.h / 2, P.x1 - P.x0, P.h, 120, m) : rim(P.x0 + 8 + P.phw / 2, P.ry, P.phw, P.lph, 40, m - 120);
        const [xx, yy] = into(p0 + m, x, y);
        put(o, p0 + m, xx, yy, (on ? 0.5 : 0.3) * dim * form * (m < 120 ? 0.7 : 1), 0, 0.02, 1, m < 120 ? FAINT : INK);
      }
      for (let j = 1; j <= MAXLP; j++) {
        const key = 'lp:' + j, it = s[PAGE].find((x) => x.lp === j), pv = prev[PAGE].find((x) => x.lp === j);
        if (!it && !(pv && !end)) { hide(key); continue; }
        const st = (it || pv).lps || 'normal', tg = st === 'dead' ? 'x' : st === 'unused' ? 'free' : st === 'redirect' ? 'hold' : (it || pv).tag === 'dirty' ? 'dirty' : 'clean';
        const born = it && !pv && !end;
        box(o, R[key][0], LPN, lpAt(j), null, P.lpw, P.lph, tg, level(PAGE, (it || pv).id) * (born ? show(p, 0.2, 0.4) : 1), false, 1, null, it ? 0 : show(p, 0.1, 0.4), into, fly);
      }
      for (const id of TIDS) {
        const key = 't:' + id, it = s[PAGE].find((x) => x.id === id), pv = prev[PAGE].find((x) => x.id === id);
        if (!stored(it) && !(stored(pv) && !end)) { hide(key); continue; }
        const Pt = stored(it) ? tupAt(s, id) : tupAt(prev, id), PV = stored(pv) ? tupAt(prev, id) : null;
        const gone = stored(it) ? 0 : show(p, 0.1, 0.4), born = stored(it) && !pv && !end;
        const from = born && act && act.t === PAGE ? src : null;
        const lit = s.touch.has(PAGE) && !end && modOf(s, PAGE).has(id);
        box(o, R[key][0], TU, Pt, PV && !end ? PV : null, P.tw, P.th, (it || pv).tag, level(PAGE, id), lit, PV ? mv : 1, from, gone, into, fly);
      }
    }
    /* 인덱스 항목 */
    if (IDX) for (const id of XIDS) {
      const key = 'i:' + id, it = s[IDX].find((x) => x.id === id), pv = prev[IDX].find((x) => x.id === id);
      if ((!it || it.tag === 'free') && !(pv && pv.tag !== 'free' && !end)) { hide(key); continue; }
      const P = ixSlot(s, id) || ixSlot(prev, id), gone = it && it.tag !== 'free' ? 0 : show(p, 0.1, 0.4);
      box(o, R[key][0], SL, P, null, P.w, 22, (it || pv).tag, level(IDX, id), false, 1, null, gone, into, fly);
    }
    /* visibility map — 페이지마다 칸, 안에 두 비트(왼쪽 ALL_VISIBLE · 오른쪽 ALL_FROZEN) */
    if (VM) for (const id of VIDS) {
      const key = 'v:' + id, [v0] = R[key], it = s[VM].find((x) => x.id === id);
      if (!it) { hide(key); continue; }
      const P = vmCell(s, id), on = level(VM, id), pv = prev[VM].find((x) => x.id === id);
      /* 켠 비트는 칸을 채우고(6 × 5), 끈 비트는 테두리만 */
      for (let m = 0; m < VB; m++) {
        const i = v0 + m, half = m < VB / 2, bit = half ? it.av : it.af, pb = pv ? (half ? pv.av : pv.af) : bit, c = m % 30;
        const b = !end && pb !== bit ? (show(p, 0.2, 0.42) > c / 30 ? bit : pb) : bit;
        const cx = P.x + (half ? -16 : 16), [x, y] = into(i, ...(b ? [cx + ((c % 6) - 2.5) * 4.2, P.y + (Math.floor(c / 6) - 2) * 4.2] : rim(cx, P.y, 26, 22, 30, c)));
        put(o, i, x, y, (b ? on : on * 0.45), b && modOf(s, VM).has(id) && !end ? 0.5 : 0, 0.02, b ? 1.25 : 1, b ? (half ? GREEN : ACCENT) : FAINT);
      }
    }
    /* 나머지 list — 칸 줄 */
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const born = it && !pv && !end, from = born && act && act.t === a ? src : null;
      box(o, R[key][0], SL, P, null, P.w, 24, (it || pv).tag, level(a, id), it && modOf(s, a).has(id) && !end, 1, from, it ? 0 : show(p, 0.1, 0.4), into, fly);
    }
    /* XID 고리 — 현재 XID 에서 뒤로 반 바퀴(2^31)가 과거(먹), 앞으로 반 바퀴가 미래(흐림) */
    if (RINGA) {
      const [g0] = R.ring, xv = nums(s[RINGA]['현재 XID'])[0] || 0, pvv = nums(prev[RINGA]['현재 XID'])[0] || xv;
      const cv = end ? xv : U.lerp(pvv, xv, show(p, 0.2, 0.45)), th0 = (cv / 2 ** 32) * Math.PI * 2 - Math.PI / 2, on = s.touch.has(RINGA) && !end;
      for (let m = 0; m < RING; m++) {
        const i = g0 + m;
        if (m < RING - 20) {
          const u = m / (RING - 20), th = u * Math.PI * 2 - Math.PI / 2, d = ((th - th0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2), past = d > Math.PI;
          const [x, y] = into(i, G.ring.x + Math.cos(th) * G.ring.r, G.ring.y + Math.sin(th) * G.ring.r);
          put(o, i, x, y, (past ? 0.85 : 0.3) * (on ? 1 : 0.6) * dim * form, 0, 0.02, past ? 1.15 : 1, past ? INK : FAINT);
        } else {
          const u = (m - (RING - 20)) / 20, [x, y] = into(i, G.ring.x + Math.cos(th0) * G.ring.r * u, G.ring.y + Math.sin(th0) * G.ring.r * u);
          put(o, i, x, y, 0.95 * dim * form, on ? 0.5 : 0, 0.02, 1.2, GOLD);
        }
      }
    }
    /* act — 덩어리가 f 에서 t 로. 제자리 act(f = t)는 그 자리에서 고리 */
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
      if (SNAP && XU) {
        for (const q of cur.TOP[kk].out) place(q.lb, q.l, G.ax.y - 14 - q.row * RH, 'l', 'b');
        /* 막대 이름은 막대가 시작하는 xmin 바로 왼쪽 */
        for (const id of Object.keys(G.bar)) { const it = PAGE && s[PAGE].find((x) => x.id === id); place(tickLb[id], (it && it.xmin > 0 ? xidX(it.xmin) : G.ax.x0) - 8, G.bar[id], 'r', 'c'); }
      }
      if (PAGE) {
        for (const tp of s[PAGE]) { const P = tupAt(s, tp.id); if (P) place(tupLb[tp.id], P.x, P.y, 'c', 'c'); }
        for (let j = 1; j <= MAXLP; j++) { const L0 = lpAt(j); place(lpLb[j], L0.x, L0.y, 'c', 'c'); }
        place(phLb, G.page.x0 + 8 + G.page.phw / 2, G.page.ry, 'c', 'c');
        place(capLb, G.L.x0, G.capY);
      }
      if (IDX) for (const e of s[IDX]) { const P = ixSlot(s, e.id); if (P) place(ixLb[e.id], P.x, P.y, 'c', 'c'); }
      if (VM) for (const v of s[VM]) {
        const P = vmCell(s, v.id);
        if (P) { place(vmLb[v.id], P.x, P.y + G.vm.ly, 'c', 't'); place(vmVF[v.id][0], P.x - 16, P.y + 13, 'c', 't'); place(vmVF[v.id][1], P.x + 16, P.y + 13, 'c', 't'); }
      }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
      if (RINGA) {
        const { x, y, r } = G.ring, th0 = ringTh(nums(s[RINGA]['현재 XID'])[0] || 0), xm = ringXmin(s);
        const out = (lb, th, d) => { const c = Math.cos(th), sn = Math.sin(th); place(lb, x + c * (r + d), y + sn * (r + d), c > 0.3 ? 'l' : c < -0.3 ? 'r' : 'c', sn > 0.3 ? 't' : sn < -0.3 ? 'b' : 'c'); };
        if (xm) out(ringX.xmin, ringTh(xm), 8);
        if (xm) out(ringX.wrap, ringTh(xm + 2 ** 31), 14);
        place(ringX.past, x + Math.cos(th0 - Math.PI / 2) * r * 0.55, y + Math.sin(th0 - Math.PI / 2) * r * 0.55, 'c', 'c');
        place(ringX.fut, x + Math.cos(th0 + Math.PI / 2) * r * 0.55, y + Math.sin(th0 + Math.PI / 2) * r * 0.55, 'c', 'c');
      }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    if (HDRA) { const on = S[kk].touch.has(HDRA) && !end; for (const [kf] of HDR) setO(hdrLb[kf].name, dimO * (on ? 0.8 : 0.42)); }
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
  function curve(ctx, x0, y0, x1, y1, lift, head = 5) {
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - lift;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    const a = Math.atan2(y1 - my, x1 - mx);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
    ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45)); ctx.stroke();
  }
  const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save(); ctx.lineWidth = 1;
    /* TABLE AM 경계 */
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]);
    if (G.edgeY != null) seg(ctx, L.x0, G.edgeY, L.x1, G.edgeY);
    ctx.globalAlpha = 0.3 * o; for (const y of G.divs) seg(ctx, L.x0, y, L.x1, y);
    ctx.setLineDash([]);
    /* 헤더 띠 — 줄을 내린 이름 · 값을 칸의 가운데로 잇고, 비트 이름은 그 비트로 */
    if (HDRA) {
      ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.faint;
      for (const [kf, T] of STR) {
        const d = decode(s[HDRA][kf], T), cy = G.strip[kf].y;
        for (const q of G.strip[kf].fl) {
          const lit = q.nat ? d.natts != null : d.fl.includes(q.f);
          if (!lit) continue;
          const ly = cy + 12 + 8 + q.row * RH;
          if (q.nat) {
            const xa = G.bitX(10) - G.cw / 2 + 2, xb = G.bitX(0) + G.cw / 2 - 2;
            seg(ctx, xa, cy + 9, xb, cy + 9); seg(ctx, xa, cy + 9, xa, cy + 6); seg(ctx, xb, cy + 9, xb, cy + 6);
            if (q.row) seg(ctx, q.pins[0], cy + 9, q.pins[0], ly - 1);
          } else for (const x of q.pins) seg(ctx, x, cy + 8, x, ly - 1);
        }
      }
      if (G.hdrLead) for (const [x, y0, y1] of G.hdrLead) seg(ctx, x, y0, x, y1);
      /* 칸 경계 — 바이트 폭이 읽히게 */
      ctx.globalAlpha = 0.3 * o;
      for (const [kf] of HDR.slice(1)) seg(ctx, G.hdrF[kf].x, G.hdr.y + 4, G.hdrF[kf].x, G.hdr.y + 22);
    }
    if (SNAP && XU) {
      /* 끊긴 자리는 선을 비우고 // 를 긋는다 */
      ctx.globalAlpha = 0.55 * o; ctx.strokeStyle = css.ink;
      const W = G.ax.x1 - G.ax.x0, cut = XU.brk.map((u) => G.ax.x0 + (u / XU.n) * W);
      let x = G.ax.x0;
      for (const c of cut) { seg(ctx, x, G.ax.y, c - 5, G.ax.y); seg(ctx, c - 6, G.ax.y + 4, c - 2, G.ax.y - 4); seg(ctx, c + 2, G.ax.y + 4, c + 6, G.ax.y - 4); x = c + 5; }
      seg(ctx, x, G.ax.y, G.ax.x1, G.ax.y);
      /* xmin ~ xmax 사이(아직 결정 안 된 구간) */
      const n = snapOf(s);
      if (n.xmin && n.xmax) { ctx.globalAlpha = 0.25 * o; ctx.fillStyle = css.gold; ctx.fillRect(xidX(n.xmin), G.ax.y - 2, xidX(n.xmax) - xidX(n.xmin), 4); }
      /* 줄을 내렸거나 옆으로 밀린 선 위 이름표는 제 XID 로 잇는다 */
      ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint;
      for (const q of cur.TOP[kk].out) if (q.row > 0 || q.pins.length > 1 || q.cx < q.l || q.cx > q.r) for (const x of q.pins) seg(ctx, x, G.ax.y - 14 - q.row * RH + 1, x, G.ax.y - 14);
      /* 튜플 생애 막대 [xmin, xmax) — xmax 가 없으면 오른쪽 끝까지 열려 있다 */
      if (PAGE) for (const id of Object.keys(G.bar)) {
        const it = s[PAGE].find((x) => x.id === id);
        if (!stored(it) || !(it.xmin > 0)) continue;
        const y = G.bar[id], xa = xidX(it.xmin), xb = it.xmax > 0 ? xidX(it.xmax) : G.ax.x1, hot = s.touch.has(PAGE) && !end && hotIt(s, PAGE, id);
        ctx.globalAlpha = (hot ? 0.8 : 0.4) * o; ctx.strokeStyle = it.tag === 'x' ? css.red : ['hold', 'dirty', 'wait'].includes(it.tag) ? css.gold : css.ink; ctx.lineWidth = 1.5;
        /* 이 snapshot 에 안 보이는 튜플(vis:false)은 점선 */
        if (it.vis === false) ctx.setLineDash([3, 3]);
        seg(ctx, xa, y, xb, y); ctx.setLineDash([]);
        if (it.xmax > 0) seg(ctx, xb, y - 4, xb, y + 4); else { seg(ctx, xb, y, xb - 5, y - 3); seg(ctx, xb, y, xb - 5, y + 3); }
        ctx.lineWidth = 1;
      }
      /* horizon — 이보다 앞에서 지워진 튜플만 치울 수 있다 */
      if (HZA) {
        const h = nums(s[HZA].OldestXmin)[0];
        if (h > 0) {
          const ys = Object.values(G.bar), yb = ys.length ? Math.max(...ys) + 9 : G.ax.y + 10;
          ctx.globalAlpha = 0.85 * o; ctx.strokeStyle = css.red; ctx.setLineDash([4, 3]);
          seg(ctx, xidX(h), G.ax.y - 13, xidX(h), yb); ctx.setLineDash([]);
        }
      }
    }
    if (PAGE) {
      const on = s.touch.has(PAGE) && !end, P = G.page;
      /* lp → 튜플 : lp 줄 아래에서 튜플 위로. redirect 는 lp → lp 위로 */
      for (const tp of s[PAGE]) {
        if (tp.lp == null) continue;
        const Lp = lpAt(tp.lp);
        if (tp.lps === 'redirect' && tp.rto) {
          const Q = lpAt(tp.rto);
          ctx.globalAlpha = 0.9 * o; ctx.strokeStyle = css.gold; curve(ctx, Lp.x, Lp.y - P.lph / 2, Q.x, Q.y - P.lph / 2, 10);
          continue;
        }
        const T0 = tupAt(s, tp.id);
        if (!T0) continue;
        ctx.globalAlpha = (on ? 0.5 : 0.3) * o; ctx.strokeStyle = css.ink;
        ctx.beginPath();
        if (P.one) { ctx.moveTo(Lp.x, Lp.y - P.lph / 2); ctx.bezierCurveTo(Lp.x, P.y + 3, T0.x, P.y + 3, T0.x, T0.y - P.th / 2 - 1); }
        else { ctx.moveTo(Lp.x, Lp.y + P.lph / 2); ctx.bezierCurveTo(Lp.x, Lp.y + P.lph / 2 + 12, T0.x, T0.y - P.th / 2 - 10, T0.x, T0.y - P.th / 2 - 1); }
        ctx.stroke();
      }
      /* ctid — 옛 버전에서 새 버전으로. 바로 왼쪽 이웃이면 칸 사이 화살표, 아니면 칸 아래로 휜다 */
      for (const tp of s[PAGE]) {
        if (!tp.ctid) continue;
        const A0 = tupAt(s, tp.id), B0 = tupAt(s, tp.ctid);
        if (!A0 || !B0 || A0.j === B0.j) continue;
        const fresh = !end && modOf(s, PAGE).has(tp.id);
        ctx.globalAlpha = (fresh ? 0.95 * show(p, 0.3, 0.46) : on ? 0.7 : 0.45) * o; ctx.strokeStyle = fresh ? css.gold : css.accent; ctx.lineWidth = fresh ? 1.6 : 1.2;
        if (B0.j === A0.j + 1) curve(ctx, A0.x - P.tw / 2 - 2, A0.y, B0.x + P.tw / 2 + 3, B0.y, 0, 4);
        else curve(ctx, A0.x - P.tw / 4, A0.y + P.th / 2 + 2, B0.x + P.tw / 4, B0.y + P.th / 2 + 2, -12);
        ctx.lineWidth = 1;
      }
    }
    /* 고리 — t_xmin 눈금(먹), '한계' 가 적히면 경고 · 거부 · wrap 눈금(바깥으로) */
    if (RINGA) {
      const { x, y, r } = G.ring, xm = ringXmin(s);
      const tick = (v, d, col, a) => { const th = ringTh(v), c = Math.cos(th), sn = Math.sin(th); ctx.globalAlpha = a * o; ctx.strokeStyle = col; seg(ctx, x + c * (r - 4), y + sn * (r - 4), x + c * (r + d), y + sn * (r + d)); };
      ctx.lineWidth = 1.5;
      if (xm) tick(xm, 6, css.ink, 0.8);
      if (xm && ringLim(s)) { const w = xm + 2 ** 31; tick(w - 40e6, 6, css.gold, 0.9); tick(w - 3e6, 8, css.red, 0.9); tick(w, 11, css.red, 0.9); }
      ctx.lineWidth = 1;
    }
    /* 이어진 페이지 — n 개의 눈금, 32 번째가 길고 금빛(SKIP_PAGES_THRESHOLD) */
    if (VM && VRUN) for (const v of s[VM]) {
      if (!(v.n > 1)) continue;
      const P = vmCell(s, v.id), x0 = P.x - G.vm.w / 2 + 8, x1 = P.x + G.vm.w / 2 - 8, y = P.y + 34, hot = s.touch.has(VM) && !end && hotIt(s, VM, v.id);
      for (let j = 0; j < v.n; j++) {
        const x = x0 + ((j + 0.5) / v.n) * (x1 - x0), mark = j === 31;
        ctx.globalAlpha = (mark ? 0.9 : hot ? 0.55 : 0.3) * o; ctx.strokeStyle = mark ? css.gold : css.ink;
        seg(ctx, x, y - (mark ? 3 : 0), x, y + 4);
      }
    }
    if (IDX && PAGE) {
      const on = s.touch.has(IDX) && !end;
      for (const e of s[IDX]) {
        if (e.to == null || e.tag === 'free') continue;
        const P0 = ixSlot(s, e.id), Lp = lpAt(e.to);
        ctx.globalAlpha = (on ? 0.6 : 0.35) * o; ctx.strokeStyle = e.tag === 'x' ? css.red : css.ink;
        seg(ctx, P0.x, P0.y + 12, Lp.x, Lp.y - G.page.lph / 2 - 1);
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent') };
    },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
