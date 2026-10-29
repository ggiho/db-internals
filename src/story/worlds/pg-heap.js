/* postgres heap — 모든 장면이 같은 세계를 쓴다. 장면이 쓰는 배우만 그린다. 그리는 것은 모두 bake 상태에서 읽는다 —
     · PAGE 8KB(pg, 항목에 off · len 이 있을 때) = 페이지 한 장을 바이트 그대로. 한 줄 512 B × 16 줄, 왼쪽 위가 0.
       k : hdr · lp · tup · pad · spc. pd_lower 는 lp 의 끝, pd_upper 는 가장 앞 튜플 — 둘 다 영역에서 셈한다
     · bytes 배우(hdr · tup · fsm …) = 확대한 띠. 칸의 폭이 sz, 이름은 위 · 설명은 아래(겹치면 줄을 바꾸고 선으로 잇는다)
     · LINE POINTERS(lp, 항목에 off 나 fl 이 있을 때) = 칸 줄 + 지금 보는 항목의 ItemIdData 32 비트
       (lp_off 15 · lp_flags 2 · lp_len 15 — itemid.h 의 비트필드 선언 순서). to 가 있으면 PAGE 의 그 영역으로 선
     · FSM(fsm, 항목의 sub 가 숫자일 때) = 잎의 범주 위에 최댓값 트리(부모 = 두 자식의 최댓값, 세계가 셈한다).
       kv 의 '찾는 범주' 가 있으면 fsm_search_avail 의 길 — '시작 슬롯'(fp_next_slot) 잎에서 오르고 왼쪽 먼저 내려간다. 고른 잎은 금빛
     · 나머지 kv 는 글 블록, 나머지 list 는 칸 줄
     · 셈 맞추기 — 영역이 겹치거나 0 ‥ 8192 밖이거나, 헤더가 [0, 24) 가 아니거나, kv 의 pd_lower · pd_upper 나
       헤더 띠 칸(pd_lower · pd_upper · pd_special)의 sub '오프셋 · 값' 이 영역과 다르거나, 트리의 잎이 숫자가 아니면
       console.error 로 알린다(storysweep 의 errors 가 잡는다). line pointer 가 가리키는 영역이 lp_off · lp_len 과 다르거나,
       REDIRECT 가 len 0 · NORMAL 대상이 아니거나, UNUSED 에 저장이 있어도 알린다
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const PG = 8192, ROWB = 512, NR = PG / ROWB;
const RG = 200, SB = 120, SL = 44, LB = 96, FN = 24, TOK = 150;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const nums = (v) => (bare(v).match(/\d[\d,]*/g) || []).map((x) => +x.replace(/,/g, ''));
const fmt = (n) => Number(n).toLocaleString('en-US');
const TAGC = { clean: INK, x: RED, red: RED, dirty: GOLD, gold: GOLD, hold: GOLD, pin: GOLD, hdr: ACCENT, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT };
const KC = { hdr: ACCENT, lp: GOLD, tup: INK, pad: FAINT, gap: FAINT, spc: GREEN };
/* itemid.h — lp_off:15, lp_flags:2, lp_len:15 와 LP_UNUSED 0 · LP_NORMAL 1 · LP_REDIRECT 2 · LP_DEAD 3 */
const LPF = [['lp_off', 15], ['lp_flags', 2], ['lp_len', 15]];
const FLN = ['UNUSED', 'NORMAL', 'REDIRECT', 'DEAD'];
const flagOf = (v) => (typeof v === 'number' ? v : Math.max(0, FLN.indexOf(String(v || 'NORMAL').toUpperCase())));

export default {
  count: (narrow) => (narrow ? 3800 : 5000),
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
      else {
        /* byl(띠 아래 설명)은 items 바깥의 필드다 — 새 배열에 다시 붙인다(빠뜨리면 띠 설명이 영영 안 나온다) */
        const arr = ((st[a] && st[a].items) || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
        if (st[a] && st[a].byl) arr.byl = st[a].byl;
        s[a] = arr;
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
  const has = (a, f) => cast.includes(a) && all.some((s) => f(s[a]));
  /* 역할 — 그 배우의 데이터가 그 모양을 가졌을 때만 */
  const GRID = has('pg', (it) => it && it.some((x) => x.off != null && x.len != null)) ? 'pg' : null;
  const LPA = has('lp', (it) => it && it.some((x) => x.off != null || x.fl != null)) ? 'lp' : null;
  const FSM = has('fsm', (it) => it && it.length > 1 && it.every((x) => nums(x.sub).length > 0)) ? 'fsm' : null;
  const STRIPS = cast.filter((a) => A[a].kind === 'bytes' && a !== FSM);
  const SPECIAL = new Set([GRID, LPA, FSM, ...STRIPS].filter(Boolean));
  const TEXTS = cast.filter((a) => A[a].kind === 'kv' && !SPECIAL.has(a));
  const ROWS = cast.filter((a) => (A[a].kind === 'list' || A[a].kind === 'tree') && !SPECIAL.has(a));
  const ids = (a) => [...new Set(all.flatMap((s) => (s[a] || []).map((x) => x.id)))];
  const GIDS = GRID ? ids(GRID) : [], LIDS = LPA ? ids(LPA) : [], FIDS = FSM ? ids(FSM) : [];
  const SIDS = Object.fromEntries(STRIPS.map((a) => [a, ids(a)]));
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  const SEEK = TEXTS.find((a) => all.some((s) => nums(s[a]['찾는 범주'])[0] > 0)) || null;
  /* 띠의 눈금 — 칸 폭은 sz 다. 한 띠는 모든 스텝에서 같은 눈금(가장 긴 스텝이 폭 전체)이라 줄면 짧아 보이고,
     배우의 scale 이 같은 띠들(08 의 두 행)은 눈금을 함께 쓴다 */
  const szOf = (its) => (its || []).reduce((p, x) => p + (x.sz || 1), 0);
  const grpOf = (a) => A[a].scale || a, STOT = {};
  for (const a of STRIPS) STOT[grpOf(a)] = Math.max(STOT[grpOf(a)] || 1, ...all.map((s) => szOf(s[a])));
  /* 트리(kind tree, 항목에 lvl) — 단마다 한 줄로 쌓는다 */
  const TREE = ROWS.filter((a) => A[a].kind === 'tree' && all.some((s) => s[a].some((x) => x.lvl != null)));
  const TLV = Object.fromEntries(TREE.map((a) => [a, 1 + Math.max(0, ...all.flatMap((s) => s[a].map((x) => x.lvl || 0)))]));
  /* 레인 — 배우의 lane 순서로 쌓고, EDGE 는 그 레인과 다음 레인 사이(한쪽이 비면 긋지 않는다) */
  const LORD = [...new Set([...(deck.LANES || []).map((l) => l.id), ...cast.map((a) => A[a].lane)])];
  const LUSE = LORD.filter((ln) => cast.some((a) => A[a].lane === ln));
  /* 영역에서 셈한다 — pd_lower 는 lp 의 끝(없으면 헤더 끝 24), pd_upper 는 가장 앞 튜플(없으면 spc 앞, 그도 없으면 8192).
     gap(저장을 거뒀지만 아직 메우지 않은 바이트)도 튜플 쪽에 센다 — 조각 모으기 전까지 pd_upper 는 그대로다 */
  const bounds = (s) => {
    const it = s[GRID] || [], lp = it.filter((x) => x.k === 'lp'), tu = it.filter((x) => x.k === 'tup' || x.k === 'pad' || x.k === 'gap'), sp = it.filter((x) => x.k === 'spc');
    const special = sp.length ? Math.min(...sp.map((x) => x.off)) : PG;
    return { lower: lp.length ? Math.max(...lp.map((x) => x.off + x.len)) : 24, upper: tu.length ? Math.min(...tu.map((x) => x.off)) : special, special };
  };

  /* 셈 맞추기 */
  for (const [k, b] of BAKES) [b.S0, ...b.S].forEach((s, i, arr) => {
    const at = `pg heap ${sc.num} 세계${k ? ' (' + sc.vary.knob + '=' + k + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    if (GRID) {
      const it = [...s[GRID]].sort((p, q) => p.off - q.off);
      for (const x of it) if (x.off < 0 || x.off + x.len > PG) console.error(`${at} 의 ${x.id} [${x.off}, ${x.off + x.len}) 가 페이지 밖이다`);
      for (let j = 1; j < it.length; j++) if (it[j].off < it[j - 1].off + it[j - 1].len) console.error(`${at} 의 ${it[j - 1].id} 와 ${it[j].id} 가 겹친다`);
      const h = it.find((x) => x.k === 'hdr');
      if (h && (h.off !== 0 || h.len !== 24)) console.error(`${at} 의 헤더가 [0, 24) 가 아니다`);
      const bd = bounds(s);
      for (const a of TEXTS) for (const [key, want] of [['pd_lower', bd.lower], ['pd_upper', bd.upper]]) {
        const v = nums(s[a][key])[0];
        if (v != null && s[a][key] !== '—' && v !== want) console.error(`${at} 의 ${a}.${key} ${v} 가 영역으로 셈한 ${want} 와 다르다`);
      }
      /* 헤더 띠(02)의 sub 은 '오프셋 · 값' — 값이 적혀 있으면 영역으로 셈한 경계와 같아야 한다 */
      for (const a of STRIPS) for (const [id, want] of [['pd_lower', bd.lower], ['pd_upper', bd.upper], ['pd_special', bd.special]]) {
        const it = s[a].find((x) => x.id === id), v = it ? nums(it.sub) : [];
        if (v.length > 1 && v[1] !== want) console.error(`${at} 의 ${a}.${id} ${v[1]} 가 영역으로 셈한 ${want} 와 다르다`);
      }
      if (bd.lower > bd.upper) console.error(`${at} 의 pd_lower ${bd.lower} 가 pd_upper ${bd.upper} 를 넘었다`);
    }
    if (FSM && !s[FSM].every((x) => nums(x.sub).length)) console.error(`${at} 의 FSM 잎에 숫자가 없다`);
    /* line pointer 와 페이지 — NORMAL 이 가리키는 영역(to)은 lp_off 에서 lp_len 이나 MAXALIGN(lp_len)(07 은 패딩을 영역에 넣는다), REDIRECT 는 len 0 에 NORMAL 인 lp 를,
       UNUSED 는 저장 없음(off 0 · len 0). 여럿을 묶은 항목('lp 3 … 102')은 대표값이라 건너뛴다 */
    if (LPA) for (const x of s[LPA]) {
      if (x.id.includes('…')) continue;
      const f = flagOf(x.fl);
      if (GRID && f === 1 && x.to) { const g = s[GRID].find((y) => y.id === x.to); if (g && (g.off !== x.off || (g.len !== x.len && g.len !== Math.ceil(x.len / 8) * 8))) console.error(`${at} 의 ${x.id}(off ${x.off} · len ${x.len}) 가 가리키는 ${x.to} 는 [${g.off}, ${g.off + g.len}) 다`); }
      if (f === 2) { const t = s[LPA].find((y) => y.id === 'lp ' + x.off); if (+x.len || !t || flagOf(t.fl) !== 1) console.error(`${at} 의 ${x.id} REDIRECT → lp ${x.off} 가 len 0 · NORMAL 대상이 아니다`); }
      if (f === 0 && (+x.off || +x.len)) console.error(`${at} 의 ${x.id} 는 UNUSED 인데 off ${x.off} · len ${x.len} 이다`);
    }
    /* 행 띠(08, scale 'row') — 칸의 sub 첫 숫자는 앞 칸 sz 의 합(데이터 영역 오프셋)이어야 하고, 이름에 int2 · int4 · int8 이 든 값은
       그 typalign 경계(2 · 4 · 8)에서 시작해야 한다 — heap_compute_data_size 의 셈 */
    for (const a of STRIPS) if (A[a].scale === 'row') {
      let o = 0;
      for (const x of s[a]) {
        const n = nums(x.sub), w = /int([248])/.exec(x.id);
        if (n.length && n[0] !== o) console.error(`${at} 의 ${a}.${x.id} 오프셋 ${n[0]} 가 앞 칸들의 합 ${o} 와 다르다`);
        if (w && o % +w[1]) console.error(`${at} 의 ${a}.${x.id} 가 ${o} 에서 시작한다 — ${w[1]} 의 배수가 아니다`);
        o += +x.sz || 0;
      }
    }
    /* 조각 모으기(07) — kv 'compactify_tuples' 가 이 스텝에 'nitems N · presorted …' 로 바뀌면, 저장이 있는 lp 를 번호 순서로 세어 nitems 와,
       앞 상태에서 그 lp 들의 오프셋이 줄곧 줄었는지(presorted)를 맞추고, 지금 오프셋이 페이지 끝부터 MAXALIGN 길이로 빈틈없이 쌓였는지 본다 */
    const prev = i ? arr[i - 1] : null;
    if (LPA && prev) for (const a of TEXTS) {
      const v = bare(s[a].compactify_tuples), m = /nitems (\d+) · presorted (true|false)/.exec(v);
      if (!m || v === bare(prev[a] && prev[a].compactify_tuples)) continue;
      const no = (x) => +x.id.replace(/\D/g, ''), live = s[LPA].filter((x) => flagOf(x.fl) === 1 && +x.len > 0).sort((p, q) => no(p) - no(q));
      const was = live.map((x) => (prev[LPA].find((y) => y.id === x.id) || {}).off);
      const pre = was.every((o, j) => o != null && (j === 0 || o < was[j - 1]));
      if (+m[1] !== live.length) console.error(`${at} 의 compactify_tuples nitems ${m[1]} 가 저장이 있는 lp ${live.length} 개와 다르다`);
      if ((m[2] === 'true') !== pre) console.error(`${at} 의 compactify_tuples presorted ${m[2]} 가 앞 상태의 lp 순서 오프셋 ${was.join(' · ')} 로 셈한 ${pre} 와 다르다`);
      let up = GRID ? bounds(s).special : PG;
      for (const x of live) { up -= Math.ceil(x.len / 8) * 8; if (+x.off !== up) console.error(`${at} 의 ${x.id} off ${x.off} 가 조각 모으기 뒤 자리 ${up} 와 다르다`); }
    }
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  GIDS.forEach((id) => take('g:' + id, RG));
  if (GRID) take('frame', 140);
  for (const a of STRIPS) take('s:' + a, SB);
  LIDS.forEach((id) => take('l:' + id, SL));
  if (LPA) take('bits', LB);
  if (FSM) { take('fl', FIDS.length * 2 * FN); }
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('pg heap 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

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
  const gLb = Object.fromEntries(GIDS.map((id) => [id, label('aq aq-c')]));
  const gLeg = GRID ? label('aq') : null, gCap = GRID ? label('aq ml aq-b') : null;
  const mkLb = GRID ? { lo: label('aq'), up: label('aq') } : null;
  const sLb = Object.fromEntries(STRIPS.map((a) => [a, Object.fromEntries(SIDS[a].map((id) => [id, { n: label('aq'), v: label('aq') }]))]));
  const sCap = Object.fromEntries(STRIPS.map((a) => [a, label('aq ml aq-b')]));
  const lLb = Object.fromEntries(LIDS.map((id) => [id, label('aq aq-c')]));
  const lCap = LPA ? label('aq ml aq-b') : null;
  const bitLb = LPA ? Object.fromEntries(LPF.map(([f]) => [f, label('aq')])) : null;
  const bitHd = LPA ? label('aq') : null;
  const bitDig = LPA ? Array.from({ length: 32 }, () => label('aq aq-c')) : [];
  const fLb = Object.fromEntries(FIDS.map((id) => [id, { n: label('aq aq-c'), v: label('aq aq-c') }]));
  const fNode = FSM ? Array.from({ length: 16 }, () => label('aq aq-c')) : [];
  const fCap = FSM ? label('aq ml aq-b') : null;
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const edgeLb = label('aq'), tok = label('stn-tok');

  /* FSM 최댓값 트리 — 잎(범주)을 2 의 거듭제곱으로 채우고(빈 자리는 0) 위로 최댓값. levels[0] = 잎 */
  const fsmTree = (s) => {
    const leaves = s[FSM].map((x) => nums(x.sub)[0] || 0);
    let n = 1; while (n < leaves.length) n *= 2;
    const lv = [leaves.concat(Array(n - leaves.length).fill(0))];
    while (lv[lv.length - 1].length > 1) { const p = lv[lv.length - 1]; lv.push(Array.from({ length: p.length / 2 }, (_, i) => Math.max(p[2 * i], p[2 * i + 1]))); }
    return lv;
  };
  /* fsm_search_avail 그대로 — 시작 잎(kv '시작 슬롯' = fp_next_slot, 없으면 0)이 need 미만이면 오른쪽 이웃의 부모로 오르고,
     need 이상인 노드에 닿으면 왼쪽 자식을 먼저 보며 잎까지 내려간다. 루트가 need 보다 작으면 길이 없다(-1 을 돌려준다).
     오른쪽 이웃은 그린 단 안에서 돈다 — 실제 페이지는 잎이 4,069 칸이라 더 넓게 돌지만 그린 잎 밖은 모두 0 이다 */
  const fsmPath = (lv, need, start) => {
    const top = lv.length - 1;
    if (!(need > 0) || lv[top][0] < need) return [];
    let d = 0, i = Math.min(Math.max(0, start || 0), lv[0].length - 1);
    const path = [[0, i]];
    while (d < top && lv[d][i] < need) { i = ((i + 1) % lv[d].length) >> 1; d++; path.push([d, i]); }
    while (d > 0) { i = lv[d - 1][2 * i] >= need ? 2 * i : 2 * i + 1; d--; path.push([d, i]); }
    return path;
  };
  const seekOf = (s) => { const lv = fsmTree(s), kv = (SEEK && s[SEEK]) || {}, path = fsmPath(lv, nums(kv['찾는 범주'])[0] || 0, nums(kv['시작 슬롯'])[0]); return { lv, path, pick: path.length ? path[path.length - 1][1] : -1 }; };
  /* 셈 맞추기 — kv '고른 페이지' 가 잎 이름(p3 …)으로 시작하면 트리로 찾은 잎과 같아야 하고, '없음' 이면 길이 없어야 한다 */
  if (FSM && SEEK) for (const [k, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    const v = bare(s[SEEK]['고른 페이지'] || ''), want = (/^p\d+/.exec(v) || [])[0] || (/^없음/.test(v) ? '없음' : null);
    if (!want) return;
    const { pick } = seekOf(s), got = pick >= 0 ? (s[FSM][pick] || {}).id : '없음';
    if (got !== want) console.error(`pg heap ${sc.num} 세계${k ? ' (' + sc.vary.knob + '=' + k + ')' : ''} : ${i ? i + ' 스텝' : 'init'} 의 고른 페이지 ${want} 가 FSM 트리로 찾은 ${got} 와 다르다`);
  });

  /* 스텝마다의 글과 강조 — [글, 또렷한가, 색, 보이나, html] */
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, skip = [], hot) => Object.entries(kv).filter(([k]) => !skip.includes(k)).map(kvLine(esc, val, hot)).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  /* 지금 보는 line pointer — look 이 가리키거나 이번에 바뀐 것, 없으면 첫 항목 */
  const lpFocus = (s) => {
    const its = s[LPA] || [], f = focusOf(s, LPA), c = s.chg[LPA] || {}, add = new Set((c.add || []).map(String)), m = modOf(s, LPA);
    /* 이번에 더한 항목이 고친 항목보다 앞선다 — 06/3 은 lp 2 를 더하면서 lp 1 의 표만 바꿨다 */
    return (f ? its.find((x) => f.has(x.id)) : its.find((x) => add.has(x.id)) || its.find((x) => m.has(x.id))) || its[0] || null;
  };
  /* REDIRECT 는 lp_off 에 대상 lp 번호를, DEAD(저장 없음)는 0 을 담는다(ItemIdSetRedirect · ItemIdSetDead) — 데이터의 off 그대로 */
  const lpBits = (it) => (it ? [+it.off || 0, flagOf(it.fl), +it.len || 0] : [0, 0, 0]);
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], [], focusOf(s, a)), on(a), '', true, true]);
    if (GRID) {
      for (const id of GIDS) { const it = s[GRID].find((x) => x.id === id); t.set(gLb[id], [it ? id : '', on(GRID) && !!it && hotIt(s, GRID, id), it && it.tag === 'x' ? 'red' : '', !!it]); }
      const bd = bounds(s);
      t.set(gLeg, [`pd_lower ${fmt(bd.lower)}  ·  pd_upper ${fmt(bd.upper)}  ·  빈 공간 ${fmt(bd.upper - bd.lower)} B`, on(GRID)]);
      t.set(mkLb.lo, ['pd_lower', on(GRID), 'gold']);
      t.set(mkLb.up, ['pd_upper', on(GRID), 'gold']);
      t.set(gCap, [capOf(s[GRID]), on(GRID), '', true, true]);
    }
    for (const a of STRIPS) {
      const mod = modOf(s, a);
      for (const id of SIDS[a]) {
        const it = s[a].find((x) => x.id === id), hot = on(a) && !!it && hotIt(s, a, id);
        /* 빨강 · 초록 표가 붙은 칸(패딩 · 남은 것)은 그 색이 '바뀜' 의 금빛보다 앞선다 */
        const tc = it && ['red', 'x'].includes(it.tag) ? 'red' : it && ['green', 'ok'].includes(it.tag) ? 'green' : mod.has(id) && on(a) ? 'gold' : '';
        t.set(sLb[a][id].n, [it ? id : '', hot, tc, !!it]);
        t.set(sLb[a][id].v, [it ? esc(it.sub) : '', hot, '', !!it && !!it.sub, true]);
      }
      const byl = (s[a].byl || null);
      t.set(sCap[a], [byl ? `${esc(byl.l || '')}${byl.r ? '  ·  ' + esc(byl.r) : ''}` : s[a].length ? '' : '— 아직 없다', on(a), '', !!byl || !s[a].length, true]);
    }
    if (LPA) {
      for (const id of LIDS) { const it = s[LPA].find((x) => x.id === id), f = it ? flagOf(it.fl) : 0; t.set(lLb[id], [it ? id : '', on(LPA) && !!it && hotIt(s, LPA, id), f === 3 ? 'red' : f === 2 ? 'gold' : '', !!it]); }
      t.set(lCap, [capOf(s[LPA]), on(LPA), '', true, true]);
      const fo = lpFocus(s), [bo, bf, bl] = lpBits(fo);
      t.set(bitHd, [fo ? `${fo.id}  ·  ItemIdData 32 bit` : '', on(LPA), '', !!fo]);
      t.set(bitLb.lp_off, [`lp_off ${bo}${bf === 2 ? '  (→ lp ' + bo + ')' : ''}`, on(LPA), '', !!fo]);
      t.set(bitLb.lp_flags, [`lp_flags ${bf} ${FLN[bf]}`, on(LPA), bf === 3 ? 'red' : bf === 2 ? 'gold' : '', !!fo]);
      t.set(bitLb.lp_len, [`lp_len ${bl}`, on(LPA), '', !!fo]);
      /* 비트필드 선언 순서대로, 필드마다 위 비트가 왼쪽 */
      let c = 0;
      LPF.forEach(([, w], fi) => { const v = [bo, bf, bl][fi]; for (let b = w - 1; b >= 0; b--) t.set(bitDig[c++], [String((v >> b) & 1), on(LPA) && ((v >> b) & 1) === 1, fi === 1 ? 'gold' : '', !!fo]); });
    }
    if (FSM) {
      const { lv, path, pick } = seekOf(s);
      for (const id of FIDS) { const it = s[FSM].find((x) => x.id === id); t.set(fLb[id].n, [it ? id : '', on(FSM), '', !!it]); t.set(fLb[id].v, [it ? String(nums(it.sub)[0]) : '', on(FSM) && !!it && hotIt(s, FSM, id), it && it.tag === 'red' ? 'red' : it && s[FSM][pick] === it ? 'gold' : '', !!it]); }
      let k = 0;
      for (let d = 1; d < lv.length; d++) for (let j = 0; j < lv[d].length; j++) { const lb = fNode[k++]; if (lb) t.set(lb, [String(lv[d][j]), on(FSM) || (SEEK && on(SEEK)), path.some(([pd, pj]) => pd === d && pj === j) ? 'gold' : '', true]); }
      for (; k < fNode.length; k++) t.set(fNode[k], ['', false, '', false]);
      /* 잎의 sub 에서 숫자 뒤의 말(예 : '0 · 실제로는 비었는데')은 잎 칸에 안 들어가므로 설명 줄로 */
      const rest = s[FSM].map((x) => [x, bare(x.sub).replace(/^\s*\d[\d,]*\s*(·\s*)?/, '').trim()]).filter(([, r]) => r).map(([x, r]) => `<span class="q-i">${esc(x.id)}</span> ${esc(nums(x.sub)[0])}  ·  ${esc(r)}`);
      const head = s[FSM].byl ? `${esc(s[FSM].byl.l || '')}  ·  ${esc(s[FSM].byl.r || '')}` : '';
      t.set(fCap, [[head, ...rest].filter(Boolean).join('\n'), on(FSM), '', !!head || rest.length > 0, true]);
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && (it.tag === 'x' || it.tag === 'red') ? 'red' : '', !!it]); }
      t.set(rowCap[a], [s[a].map((x) => x.sub || x.keys ? `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub || x.keys || '')}` : '').filter(Boolean).join('\n') || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    if (EDGE) t.set(edgeLb, [EDGE.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '', LUSE.some((ln, j) => j > 0 && LUSE[j - 1] === EDGE.after)]);
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
  const rnd = U.rng(23);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15;
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {}, strip: {} };
    const TL = Object.fromEntries(LUSE.map((ln) => {
      const as = TEXTS.filter((a) => A[a].lane === ln), n = Math.max(1, Math.min(3, as.length)), w = (ww - (n - 1) * gap) / n;
      for (const a of as) wrap(tx[a], w);
      return [ln, { as, n, w, rows: Math.ceil(as.length / n), h: as.length ? hMax(as.map((a) => tx[a])) : 0 }];
    }));
    /* 확대 띠 — 이름 · 설명의 줄은 모든 스텝의 칸 자리로 나눈다(칸이 스텝마다 바뀌면 자리도 바뀐다) */
    const SW = {};
    for (const a of STRIPS) {
      wrap(sCap[a], ww);
      const pos = (s) => { const its = s[a], tot = STOT[grpOf(a)]; let x = L.x0; return Object.fromEntries(its.map((it) => { const w = (ww * (it.sz || 1)) / tot, r = [x, w]; x += w; return [it.id, r]; })); };
      let nr = 1, vr = 1;
      const per = new Map();
      for (const b of BAKES.values()) b.S.forEach((s, kk) => {
        const P = pos(s), T = b.TX[kk];
        const wOf = (lb) => { const e = T.get(lb); if (!e || e[3] === false || !e[0]) return 0; const keep = lb.el.innerHTML; lb.el.innerHTML = e[0]; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };
        const NM = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: wOf(sLb[a][it.id].n) })).filter((q) => q.w), L.x0, L.x1);
        const VL = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: wOf(sLb[a][it.id].v) })).filter((q) => q.w), L.x0, L.x1);
        nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows);
        per.set(b.S[kk], { P, NM: NM.out, VL: VL.out });
      });
      SW[a] = { nr, vr, per, capH: most(sCap[a]).h };
    }
    /* 페이지 — 한 줄 512 B, 줄 높이 18(무대보다 높으면 15 까지 줄인다) */
    const cell = ww / ROWB;
    if (GRID) { wrap(gCap, ww); }
    const gcH = GRID ? most(gCap).h : 0;
    /* 페이지의 셈(pd_lower · pd_upper · 빈 공간)은 제목 줄 오른쪽에 — 들어가면. 페이지와 lp 칸 사이를 lp → 튜플 선에 비워 준다 */
    const legTop = GRID && most(gLeg).w + most(hd[GRID]).w + 30 <= ww;
    /* line pointer 칸 줄과 32 비트 */
    const lw = LPA ? Object.fromEntries(LIDS.map((id) => [id, Math.max(40, Math.ceil(most(lLb[id]).w) + 14)])) : {};
    /* 설명은 칸 줄 오른쪽에 — 남는 폭이 180 이상일 때. 아니면 아래 */
    const lsW = LPA ? LIDS.reduce((t, id) => t + lw[id] + 6, -6) : 0, lSide = LPA && ww - lsW - 20 >= 180;
    if (LPA) wrap(lCap, lSide ? ww - lsW - 20 : ww);
    const lcH = LPA ? most(lCap).h : 0;
    const bitW = LPA ? Object.fromEntries(LPF.map(([f]) => [f, most(bitLb[f]).w])) : {};
    /* FSM 트리 */
    if (FSM) wrap(fCap, ww);
    const fcH = FSM ? most(fCap).h : 0;
    const fDepth = FSM ? Math.max(...all.map((s) => fsmTree(s).length)) : 0;
    /* 잎 이름은 잎 칸 가운데 + 13 에서 시작한다 */
    const fnH = FSM ? hMax(FIDS.map((id) => fLb[id].n)) : 0;
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    for (const a of ROWS) wrap(rowCap[a], ww);
    const rcH = Object.fromEntries(ROWS.map((a) => [a, most(rowCap[a]).h]));
    /* lh — FSM 트리 단 사이, fb — 잎 칸 가운데에서 설명까지 */
    const lay = (y0, k = 1, gr = 18, lh = 34, fb = 22 + 30) => {
      let y = y0;
      const texts = (ln) => {
        const T = TL[ln];
        T.as.forEach((a, i) => { const x = L.x0 + (i % T.n) * (T.w + gap), yy = y + Math.floor(i / T.n) * (HD + T.h + 12 * k); place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + T.w - 18, y: yy + 8 }; });
        y += T.rows * (HD + T.h + 12 * k);
      };
      const strip = (a) => {
        place(hd[a], L.x0, y); y += HD + 6 + SW[a].nr * RH;
        G.strip[a] = { y, ...SW[a] }; G.anc[a] = { x: L.x0 + ww / 2, y: y + 13 };
        y += 26 + 5 + SW[a].vr * RH + 4; G.strip[a].capY = y; place(sCap[a], L.x0, y); y += SW[a].capH + (SW[a].capH > 1 ? 6 : 0) + 12 * k;
      };
      const grid = () => {
        place(hd[GRID], L.x0, y);
        if (legTop) G.leg = { x: L.x1, y, al: 'r' };
        y += HD + 4;
        G.grid = { x0: L.x0, y, cell, gr }; G.anc[GRID] = { x: L.x0 + ww / 2, y: y + (NR * gr) / 2 };
        y += NR * gr + 6;
        if (!legTop) { G.leg = { x: L.x0, y, al: 'l' }; y += 16; }
        if (!LPA) { G.capY = y; place(gCap, L.x0, y); y += gcH + 14 * k; }
      };
      const lps = () => {
        /* lp 칸은 페이지 바로 아래 — 칸 위쪽이 lp → 튜플 선의 길이고, 제목 · 설명은 칸 아래로 비킨다 */
        if (GRID) y += 12 + 10 * k;
        G.lps = { y, w: lw }; G.anc[LPA] = { x: L.x0 + 30, y: y + 13 };
        if (lSide) { G.lpCapX = L.x0 + lsW + 20; G.lpCapY = y - 1; }
        y += (lSide ? Math.max(26, lcH) : 26) + 4;
        /* 지금 보는 항목의 이름은 제목 줄 오른쪽 — 32 비트 띠 위에 따로 한 줄을 쓰지 않는다 */
        place(hd[LPA], L.x0, y); place(bitHd, L.x1, y, 'r', 't');
        y += HD + 4;
        G.bits = { y: y + 8, cw: ww / 32 };
        const bx = { lp_off: L.x0, lp_flags: L.x0 + (ww * 15) / 32, lp_len: L.x0 + (ww * 17) / 32 }, bw = { lp_off: (ww * 15) / 32, lp_flags: (ww * 2) / 32, lp_len: (ww * 15) / 32 };
        const BL = stagger(LPF.map(([f]) => ({ f, cx: bx[f] + bw[f] / 2, w: bitW[f] })), L.x0, L.x1);
        G.bits.lb = BL.out;
        for (const q of BL.out) place(bitLb[q.f], q.l, y + 16 + 10 + q.row * RH, 'l', 't');
        y += 16 + 10 + BL.rows * RH + 6;
        if (!lSide) { G.lpCapX = L.x0; G.lpCapY = y; y += lcH + 14 * k; } else y += 8 * k;
        place(lCap, G.lpCapX, G.lpCapY);
        /* 페이지 영역의 설명은 lp 띠 다음 — 페이지와 lp 칸 사이에 두면 lp → 튜플 선이 그 글을 지난다 */
        if (GRID) { G.capY = y; place(gCap, L.x0, y); y += gcH + 14 * k; }
      };
      const fsm = () => {
        place(hd[FSM], L.x0, y); y += HD + 8;
        G.fsm = { y, lh, depth: fDepth }; G.anc[FSM] = { x: L.x0 + ww / 2, y: y + 10 };
        y += (fDepth - 1) * lh + fb; place(fCap, L.x0, y); y += fcH + 14 * k;
      };
      const rows = (a) => {
        const nl = TREE.includes(a) ? TLV[a] : 1;
        place(hd[a], L.x0, y); G.slot[a] = { y: y + HD, sw: sw[a], tree: nl > 1 || TREE.includes(a) }; G.anc[a] = { x: L.x0 + 30, y: y + HD + 13 };
        y += HD + 26 + (nl - 1) * 34 + 8; place(rowCap[a], L.x0, y); y += rcH[a] + 16 * k;
      };
      const BLK = [['', texts], ...STRIPS.map((a) => [a, () => strip(a)]), [GRID, grid], [LPA, lps], [FSM, fsm], ...ROWS.map((a) => [a, () => rows(a)])].filter(([a]) => a !== null);
      G.edgeY = null;
      LUSE.forEach((ln, j) => {
        /* 경계 이름은 선 아래 오른쪽 — 위쪽 글 블록은 오른쪽 끝까지 찬다 */
        if (j) { y += 6 * k; if (EDGE && EDGE.after === LUSE[j - 1]) { G.edgeY = y; place(edgeLb, L.x1, y + 2, 'r', 't'); } y += 8 + 8 * k; }
        for (const [a, f] of BLK) if (a ? A[a].lane === ln : TL[ln].as.length) f(ln);
      });
      return y - y0;
    };
    let k = 1, gr = 18, total = lay(L.y0, 1, gr);
    if (total > wh) { k = 0.2; total = lay(L.y0, k, gr); }
    if (total > wh) { k = 0; total = lay(L.y0, k, gr); }
    /* 줄 높이 14 아래로는 영역 이름(글 높이 약 14)이 줄을 넘는다 */
    if (total > wh && GRID) { gr = Math.max(14, gr - Math.ceil((total - wh) / NR)); total = lay(L.y0, k, gr); }
    /* 그래도 높으면 FSM 트리를 조인다 — 잎 이름 아래의 빈 자리(약 25px)를 8 로, 그래도 높으면 단 사이를 34 에서 26 까지
       (26 에서 노드 고리 · 잎 칸(높이 20) 사이가 6px 남는다. 05 : 1280×720) */
    let lh = 34, fb = 22 + 30;
    if (total > wh && FSM) {
      fb = 13 + fnH + 8; total = lay(L.y0, k, gr, lh, fb);
      if (total > wh && fDepth > 1) { lh = Math.max(26, lh - Math.ceil((total - wh) / (fDepth - 1))); total = lay(L.y0, k, gr, lh, fb); }
    }
    if (total > wh + 1) console.error(`pg heap ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    HT = total;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k, gr, lh, fb);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 바이트 offset → 격자 위 자리. 영역은 줄마다 조각으로 나뉜다 */
  const bxy = (o) => { const g = G.grid, r = Math.min(NR - 1, Math.floor(o / ROWB)); return [g.x0 + (o - r * ROWB) * g.cell, g.y + r * g.gr]; };
  const segs = (off, len) => {
    const out = [];
    for (let a = off; a < off + len;) { const r = Math.floor(a / ROWB), b = Math.min(off + len, (r + 1) * ROWB); out.push([a, b, r]); a = b; }
    return out;
  };
  const lpSlot = (s, id) => { let x = G.L.x0; for (const it of s[LPA]) { const w = G.lps.w[it.id]; if (it.id === id) return { x: x + w / 2, y: G.lps.y + 13, w }; x += w + 6; } return null; };
  const rowSlot = (s, a, id) => {
    if (G.slot[a].tree) { const it = s[a].find((q) => q.id === id); return it ? { x: (G.L.x0 + G.L.x1) / 2, y: G.slot[a].y + 13 + (it.lvl || 0) * 34, w: G.slot[a].sw[id] } : null; }
    let x = G.L.x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  const regionAt = (s, id) => { const it = (s[GRID] || []).find((x) => x.id === id); if (!it) return null; const sg = segs(it.off, it.len), lg = sg.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p), sg[0]); const [x0, y0] = bxy(lg[0]); return { x: x0 + ((lg[1] - lg[0]) * G.grid.cell) / 2, y: y0 + G.grid.gr / 2, w: (lg[1] - lg[0]) * G.grid.cell }; };
  /* FSM 노드 자리 — 잎은 아래 줄, 부모는 두 자식의 가운데 위 */
  const fsmXY = (d, j, n) => { const ww = G.L.x1 - G.L.x0, cw = ww / n, span = 2 ** d; return { x: G.L.x0 + cw * (j * span + span / 2), y: G.fsm.y + (G.fsm.depth - 1 - d) * G.fsm.lh }; };
  function anchor(a, s, lbText) {
    if (a === GRID) {
      const id = GIDS.filter((x) => (lbText || '').includes(x)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, GRID)].find((x) => GIDS.includes(x));
      const P = id ? regionAt(s, id) : null;
      if (P) return [P.x, P.y];
    }
    if (a === LPA) { const id = [...modOf(s, LPA)][0]; const P = id ? lpSlot(s, id) : null; if (P) return [P.x, P.y]; }
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
  function box(o, r0, n, P, w, h, tg, a0, lit, from, gone, into, fly) {
    for (let m = 0; m < n; m++) {
      const i = r0 + m, f = m / n;
      let [x, y] = rim(P.x, P.y, w, h, n, m);
      if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
      if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone + 8 * gone; }
      [x, y] = into(i, x, y);
      put(o, i, x, y, a0 * (1 - gone) * (tg === 'free' ? 0.5 * (m % 2) : 1), lit ? 0.4 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
    }
  }
  /* 영역의 알갱이 — 바이트 범위 안에 고르게. 이름표가 앉을 가운데 조각은 비운다 */
  const regionPts = (it, n) => {
    const sg = segs(it.off, it.len), tot = it.len, lg = sg.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p), sg[0]);
    const pts = [], cx = bxy(lg[0])[0] + ((lg[1] - lg[0]) * G.grid.cell) / 2;
    for (let m = 0; m < n; m++) {
      const u = (m + 0.5) / n, o = it.off + u * tot, [x, y] = bxy(o), r = Math.floor(o / ROWB), yy = y + 3 + ((m * 7) % 5) * ((G.grid.gr - 6) / 4);
      /* 이름이 앉는 조각의 알갱이는 비킨다 — 40 B 를 넘는 영역은 그 조각 전체, 그보다 작은데 이름이 보이는 영역은 이름 폭만
         (06 의 'lp 3 이후' 는 40 B 인데 넓은 무대에서 이름이 들어가 알갱이 4 개가 이름 위에 앉았다) */
      const lw = G.gLw && G.gHide && G.gHide[it.id] === false ? G.gLw[it.id] : 0;
      pts.push([x, yy, r === lg[2] && (it.len > 40 || (lw && Math.abs(x - cx) < lw / 2 + 3)) ? 1 : 0]);
    }
    return pts;
  };
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
    /* 페이지 — 테두리와 영역. 영역이 옮겨 가면(조각 모으기) 알갱이가 옛 바이트에서 새 바이트로 */
    if (GRID) {
      const [f0, f1] = R.frame, g = G.grid, W = ROWB * g.cell, H = NR * g.gr;
      for (let m = 0; m < f1 - f0; m++) { const [x, y] = into(f0 + m, ...rim(g.x0 + W / 2, g.y + H / 2, W, H, f1 - f0, m)); put(o, f0 + m, x, y, 0.3 * dim * form, 0, 0.02, 1, FAINT); }
      for (const id of GIDS) {
        const key = 'g:' + id, [r0, r1] = R[key], it = s[GRID].find((x) => x.id === id), pv = prev[GRID].find((x) => x.id === id);
        if (!it && !(pv && !end)) { hide(key); continue; }
        const cur2 = it || pv, n = Math.max(3, Math.min(r1 - r0, Math.round((cur2.len * g.cell * g.gr) / 260)));
        const P = regionPts(cur2, n), Q = pv && it && !end && (pv.off !== it.off || pv.len !== it.len) ? regionPts(pv, n) : null;
        const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === GRID ? src : null;
        const col = cur2.tag && cur2.tag !== 'clean' ? TAGC[cur2.tag] ?? INK : KC[cur2.k] ?? INK, lv = level(GRID, id);
        for (let m = 0; m < r1 - r0; m++) {
          const i = r0 + m;
          if (m >= n) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
          let [x, y, inLb] = P[m];
          if (Q) { x = U.lerp(Q[m][0], x, mv); y = U.lerp(Q[m][1], y, mv); }
          if (from) { const q = show(fly, (m / n) * 0.4, 0.6 + (m / n) * 0.4); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q) - Math.sin(q * Math.PI) * 16; }
          if (gone) { x += jit[i * 2] * 20 * gone; y += jit[i * 2 + 1] * 20 * gone; }
          const [xx, yy] = into(i, x, y);
          put(o, i, xx, yy, lv * (1 - gone) * (inLb ? 0 : 1) * (cur2.k === 'pad' ? 0.45 : 1), s.touch.has(GRID) && !end && modOf(s, GRID).has(id) ? 0.4 : 0, 0.02, 1.1, col);
        }
      }
    }
    /* 확대 띠 — 위 · 아래 두 줄과 칸 사이 칸막이 */
    for (const a of STRIPS) {
      const [s0, s1] = R['s:' + a], n = s1 - s0, info = G.strip[a].per.get(s), mod = modOf(s, a), on = s.touch.has(a) && !end;
      if (!info || !s[a].length) { hide('s:' + a); continue; }
      /* 띠는 눈금대로 — 끝(xe)에 닫는 칸막이 */
      const xe = Math.max(...Object.values(info.P).map(([x, w]) => x + w)), cuts = Object.values(info.P).map(([x]) => x).slice(1).concat(xe < G.L.x1 - 1 ? [xe] : []);
      const nc = Math.min(cuts.length * 4, 40), nl = n - nc;
      for (let m = 0; m < n; m++) {
        const i = s0 + m;
        let x, y, col = INK, hot = false;
        if (m < nl) {
          const u = Math.floor(m / 2) / Math.ceil(nl / 2); x = G.L.x0 + u * (xe - G.L.x0); y = G.strip[a].y + (m % 2 ? 26 : 0);
          const id = Object.keys(info.P).find((q) => x >= info.P[q][0] && x < info.P[q][0] + info.P[q][1]);
          const it = id && s[a].find((q) => q.id === id);
          hot = !!id && mod.has(id) && on;
          /* 빨강 · 초록 표가 붙은 칸은 그 색 — 바뀐 칸의 금빛보다 앞선다 */
          col = it && ['red', 'x', 'green', 'ok'].includes(it.tag) ? TAGC[it.tag] : hot ? GOLD : it && it.tag !== 'hdr' && it.tag !== 'clean' ? TAGC[it.tag] ?? INK : INK;
        } else { const c = Math.floor((m - nl) / 4); if (c >= cuts.length) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; } x = cuts[c]; y = G.strip[a].y + 5 + ((m - nl) % 4) * 5.3; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, (on ? 0.85 : 0.45) * dim * form, hot ? 0.5 : 0, 0.02, 1.05, col);
      }
    }
    /* line pointer 칸 줄 + 지금 보는 항목의 32 비트 — 켠 비트는 채우고, 끈 비트는 바닥 점 하나 */
    if (LPA) {
      for (const id of LIDS) {
        const key = 'l:' + id, it = s[LPA].find((x) => x.id === id), pv = prev[LPA].find((x) => x.id === id);
        if (!it && !(pv && !end)) { hide(key); continue; }
        const P = it ? lpSlot(s, id) : lpSlot(prev, id), f = flagOf((it || pv).fl);
        box(o, R[key][0], SL, P, P.w, 24, f === 3 ? 'x' : f === 2 ? 'hold' : f === 0 ? 'free' : (it || pv).tag, level(LPA, id), it && modOf(s, LPA).has(id) && !end, null, it ? 0 : show(p, 0.1, 0.4), into, fly);
      }
      const [b0] = R.bits, fo = lpFocus(s), bits = lpBits(fo), on = s.touch.has(LPA) && !end;
      const word = []; LPF.forEach(([, w], fi) => { for (let b = w - 1; b >= 0; b--) word.push([(bits[fi] >> b) & 1, fi]); });
      /* 칸마다 바닥 눈금 셋 — 켠 비트는 진하게. 0 · 1 은 이름표가 적는다 */
      for (let c = 0; c < 32; c++) for (let m = 0; m < 3; m++) {
        const i = b0 + c * 3 + m, [bit, fi] = word[c], cx = G.L.x0 + (c + 0.5) * G.bits.cw, cy = G.bits.y;
        const [x, y] = into(i, cx + (m - 1) * Math.min(3, G.bits.cw / 5), cy + 10);
        put(o, i, x, y, fo ? (bit ? (on ? 0.95 : 0.6) : 0.25) * dim * form : 0, 0, 0.02, bit ? 1.25 : 1, bit ? (fi === 1 ? GOLD : INK) : FAINT);
      }
    }
    /* FSM — 잎 칸과 그 위의 최댓값 노드. 찾는 길의 노드는 금빛 */
    if (FSM) {
      const [q0] = R.fl, { lv, path } = seekOf(s), n = lv[0].length, on = s.touch.has(FSM) && !end;
      let i = q0;
      FIDS.forEach((id, j) => {
        const it = s[FSM].find((x) => x.id === id), P = fsmXY(0, j, n), w = Math.min(56, (G.L.x1 - G.L.x0) / n - 8);
        for (let m = 0; m < FN; m++, i++) { if (!it) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; } const [x, y] = into(i, ...rim(P.x, P.y, w, 20, FN, m)); put(o, i, x, y, level(FSM, id), it.tag === 'red' ? 0.3 : 0, 0.02, 1.05, TAGC[it.tag] ?? INK); }
      });
      /* 노드 고리는 세 자리 값(FSM 범주 0–255)의 글 상자(약 20 × 14)를 모서리까지 품는다 — 13 × 9 로 두자 대각선의 알갱이가
         상자 안 0.6–0.8px 에 들었고, 세계 확대 2 배에서 1px 허용을 넘어 storysweep label-grain 에 걸렸다(2560 · 05) */
      let nodes = 0;
      for (let d = 1; d < lv.length; d++) for (let j = 0; j < lv[d].length; j++) {
        const P = fsmXY(d, j, n), hot = path.some(([pd, pj]) => pd === d && pj === j);
        for (let m = 0; m < FN && nodes < FIDS.length * FN; m++, i++, nodes++) { const th = (m / FN) * Math.PI * 2, [x, y] = into(i, P.x + Math.cos(th) * 16.5, P.y + Math.sin(th) * 10); put(o, i, x, y, (on || hot ? 0.9 : 0.5) * dim * form, hot && !end ? 0.5 : 0, 0.02, 1.05, hot ? GOLD : INK); }
      }
      for (; i < R.fl[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    }
    /* 나머지 list — 칸 줄 */
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const born = it && !pv && !end, from = born && act && act.t === a ? src : null, cur3 = it || pv;
      /* 여유(free)는 칸 안의 막대로 overlay 가 긋는다 — 알갱이 12 개로는 2px 점선이 되어 읽히지 않았다 */
      box(o, R[key][0], SL, P, P.w, 24, cur3.tag, level(a, id), it && modOf(s, a).has(id) && !end, from, it ? 0 : show(p, 0.1, 0.4), into, fly);
    }
    /* act — 덩어리가 f 에서 t 로 */
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
      if (GRID) {
        /* 영역 이름은 가장 긴 조각의 가운데 — 이름이 조각보다 넓으면 숨긴다(설명 줄에 남아 있다) */
        for (const it of s[GRID]) { const P = regionAt(s, it.id); place(gLb[it.id], P.x, P.y, 'c', 'c'); G.gHide = G.gHide || {}; G.gLw = G.gLw || {}; G.gLw[it.id] = gLb[it.id].el.getBoundingClientRect().width; G.gHide[it.id] = P.w < G.gLw[it.id] + 6; }
        const bd = bounds(s), [lx, ly] = bxy(bd.lower), [ux, uy] = bxy(Math.min(PG - 1, bd.upper));
        /* pd_upper 가 줄의 맨 앞이면 이름을 눈금 오른쪽에 — 왼쪽은 무대 밖이다 */
        const upL = ux - 4 - mkLb.up.el.getBoundingClientRect().width < G.L.x0;
        place(mkLb.lo, lx + 4, ly + G.grid.gr / 2, 'l', 'c'); place(mkLb.up, upL ? ux + 4 : ux - 4, uy + G.grid.gr / 2, upL ? 'l' : 'r', 'c');
        const free = (bd.upper - bd.lower) * G.grid.cell, wl = mkLb.lo.el.getBoundingClientRect().width, wu = mkLb.up.el.getBoundingClientRect().width;
        G.mkShow = { lo: free > wl + 12 && (ly !== uy || ux - lx > wl + wu + 24), up: free > wu + 12 && (ly !== uy || ux - lx > wl + wu + 24) };
        place(gLeg, G.leg.x, G.leg.y, G.leg.al, 't'); place(gCap, G.L.x0, G.capY);
      }
      for (const a of STRIPS) {
        const info = G.strip[a].per.get(s);
        if (!info) continue;
        for (const q of info.NM) place(sLb[a][q.id].n, q.l, G.strip[a].y - 3 - q.row * RH, 'l', 'b');
        for (const q of info.VL) place(sLb[a][q.id].v, q.l, G.strip[a].y + 26 + 5 + q.row * RH, 'l', 't');
        place(sCap[a], G.L.x0, G.strip[a].capY);
      }
      if (LPA) {
        for (const it of s[LPA]) { const P = lpSlot(s, it.id); place(lLb[it.id], P.x, P.y, 'c', 'c'); }
        bitDig.forEach((lb, c) => place(lb, G.L.x0 + (c + 0.5) * G.bits.cw, G.bits.y, 'c', 'c'));
        place(lCap, G.lpCapX, G.lpCapY);
      }
      if (FSM) {
        const lv = fsmTree(s), n = lv[0].length;
        FIDS.forEach((id, j) => { const P = fsmXY(0, j, n); place(fLb[id].v, P.x, P.y, 'c', 'c'); place(fLb[id].n, P.x, P.y + 13, 'c', 't'); });
        let q = 0;
        for (let d = 1; d < lv.length; d++) for (let j = 0; j < lv[d].length; j++) { const P = fsmXY(d, j, n); if (fNode[q]) place(fNode[q], P.x, P.y, 'c', 'c'); q++; }
      }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      let o = vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0;
      if (GRID && G.gHide) for (const id of GIDS) if (lb === gLb[id] && G.gHide[id]) o = 0;
      if (GRID && G.mkShow && ((lb === mkLb.lo && !G.mkShow.lo) || (lb === mkLb.up && !G.mkShow.up))) o = 0;
      setO(lb, o);
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
    if (G.edgeY != null) seg(ctx, L.x0, G.edgeY, L.x1, G.edgeY);
    ctx.setLineDash([]);
    if (GRID) {
      const g = G.grid;
      /* 16 줄의 안내선 — 한 줄이 512 바이트 */
      ctx.globalAlpha = 0.12 * o; ctx.strokeStyle = css.faint;
      for (let r = 1; r < NR; r++) seg(ctx, g.x0, g.y + r * g.gr, g.x0 + ROWB * g.cell, g.y + r * g.gr);
      /* 영역의 경계 — 줄마다 조각의 테두리 */
      for (const it of s[GRID]) {
        ctx.globalAlpha = (s.touch.has(GRID) && !end && hotIt(s, GRID, it.id) ? 0.6 : 0.3) * o; ctx.strokeStyle = it.k === 'pad' ? css.faint : css.ink;
        for (const [a, bb] of segs(it.off, it.len)) { const [x0, y0] = bxy(a); ctx.strokeRect(x0 + 0.5, y0 + 1.5, Math.max(1, (bb - a) * g.cell - 1), g.gr - 3); }
      }
      /* pd_lower · pd_upper 눈금 */
      const bd = bounds(s);
      ctx.globalAlpha = 0.9 * o; ctx.strokeStyle = css.gold; ctx.lineWidth = 1.5;
      for (const v of [bd.lower, bd.upper]) { const [x, y] = bxy(Math.min(PG - 1, v)); seg(ctx, x, y - 2, x, y + g.gr + 2); }
      ctx.lineWidth = 1;
      /* lp → 튜플 */
      if (LPA) for (const it of s[LPA]) {
        if (!it.to) continue;
        const P = lpSlot(s, it.id), Q = regionAt(s, it.to);
        if (!P || !Q) continue;
        ctx.globalAlpha = (s.touch.has(LPA) && !end ? 0.5 : 0.25) * o; ctx.strokeStyle = css.ink;
        ctx.beginPath(); ctx.moveTo(P.x, P.y - 12); ctx.bezierCurveTo(P.x, P.y - 40, Q.x, Q.y + 30, Q.x, Q.y + g.gr / 2); ctx.stroke();
      }
    }
    /* LP_REDIRECT — lp_off 가 가리키는 lp 칸으로 짧은 금빛 호(HOT 사슬의 이음매) */
    if (LPA) for (const it of s[LPA]) {
      if (flagOf(it.fl) !== 2) continue;
      const P = lpSlot(s, it.id), Q = lpSlot(s, 'lp ' + it.off);
      if (!P || !Q) continue;
      const x0 = P.x, x1 = Q.x, yb = P.y + 12, my = yb + 9;
      ctx.globalAlpha = 0.9 * o; ctx.strokeStyle = css.gold; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x0, yb); ctx.quadraticCurveTo((x0 + x1) / 2, my + 4, x1, yb); ctx.stroke();
      const an = Math.atan2(yb - (my + 4), x1 - (x0 + x1) / 2);
      ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x1 - 5 * Math.cos(an - 0.45), yb - 5 * Math.sin(an - 0.45)); ctx.moveTo(x1, yb); ctx.lineTo(x1 - 5 * Math.cos(an + 0.45), yb - 5 * Math.sin(an + 0.45)); ctx.stroke();
      ctx.lineWidth = 1;
    }
    /* 칸 줄의 여유(free) — 칸 안 아래쪽 3px 막대, 폭이 여유의 비율 */
    for (const a of ROWS) for (const it of s[a]) {
      if (it.free == null) continue;
      const P = rowSlot(s, a, it.id);
      if (!P) continue;
      ctx.globalAlpha = (s.touch.has(a) && !end ? 0.85 : 0.5) * o; ctx.fillStyle = css.green;
      ctx.fillRect(P.x - P.w / 2 + 4, P.y + 8, Math.max(2, (P.w - 8) * U.clamp(it.free / (PG - 24))), 2.5);
    }
    /* 트리 — 단 사이 선. act 가 트리에서 나가거나 들어오면 금빛(위에서 아래로 내려가는 길) */
    for (const a of TREE) {
      const act = !end && s.step.act, hot = !!act && (act.f === a || act.t === a);
      const its = [...s[a]].sort((p2, q2) => (p2.lvl || 0) - (q2.lvl || 0));
      for (const c of its) {
        const par = its.filter((q2) => (q2.lvl || 0) === (c.lvl || 0) - 1);
        for (const pp of par) {
          const P = rowSlot(s, a, pp.id), Q = rowSlot(s, a, c.id);
          if (!P || !Q) continue;
          ctx.globalAlpha = (hot ? 0.9 : 0.35) * o; ctx.strokeStyle = hot ? css.gold : css.ink; ctx.lineWidth = hot ? 1.6 : 1;
          seg(ctx, P.x, P.y + 13, Q.x, Q.y - 13);
        }
      }
      ctx.lineWidth = 1;
    }
    for (const a of STRIPS) {
      const info = G.strip[a].per.get(s);
      if (!info) continue;
      ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.faint;
      const y = G.strip[a].y, off = (q) => q.row > 0 || q.cx < q.l || q.cx > q.r;
      for (const q of info.NM) if (off(q)) seg(ctx, q.cx, y - 3 - q.row * RH + 1, q.cx, y - 2);
      for (const q of info.VL) if (off(q)) seg(ctx, q.cx, y + 28, q.cx, y + 26 + 5 + q.row * RH - 1);
    }
    if (LPA && lpFocus(s)) {
      /* 32 비트 칸 경계 — 필드 사이는 진하게. 볼 항목이 없으면 긋지 않는다 */
      const y = G.bits.y, cw = G.bits.cw;
      ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint;
      for (let c = 0; c <= 32; c++) { const x = L.x0 + c * cw; ctx.globalAlpha = (c === 0 || c === 15 || c === 17 || c === 32 ? 0.7 : 0.2) * o; seg(ctx, x, y - 8, x, y + 8); }
      ctx.globalAlpha = 0.4 * o;
      for (const q of G.bits.lb) { const ly = y + 8 + 10 + q.row * RH; if (q.row) seg(ctx, q.cx, y + 13, q.cx, ly - 1); }
    }
    if (FSM) {
      const { lv, path } = seekOf(s), n = lv[0].length;
      for (let d = 1; d < lv.length; d++) for (let j = 0; j < lv[d].length; j++) {
        const P = fsmXY(d, j, n);
        for (const c of [2 * j, 2 * j + 1]) {
          const Q = fsmXY(d - 1, c, n), hot = path.some(([pd, pj]) => pd === d && pj === j) && path.some(([pd, pj]) => pd === d - 1 && pj === c);
          ctx.globalAlpha = (hot ? 0.9 : 0.3) * o; ctx.strokeStyle = hot ? css.gold : css.ink; ctx.lineWidth = hot ? 1.6 : 1;
          seg(ctx, P.x, P.y + 9, Q.x, Q.y - (d - 1 ? 9 : 10));
        }
      }
      ctx.lineWidth = 1;
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); return HT; },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') };
    },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
