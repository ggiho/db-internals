/* mysql locks 04 · 10 — 호환 행렬 · 강도 행렬. 그리는 것은 모두 bake 상태에서 읽는다(손으로 적은 칸이 없다) —
     · matrix 배우 = 칸의 격자. '+' 는 채운 칸(초록), '-' 는 테두리만(빨강) — 범용 무대와 같은 문법이고, 칸의 뜻도 무대처럼
       mx.yes · mx.no(없으면 허용 · 막힘). 범례는 그 두 값뿐이다
     · on 칸 = 요청과 보유가 만나는 칸 — 금빛 테두리를 칸 밖에 두르고, 막힘(-)이면 칸 안을 옅게 빨강으로. 테두리를 칸 안에 그렸더니
       '-' 의 빨간 테두리 알갱이와 2px 사이로 붙어, 그 스텝이 짚는 칸만 막힘이 안 보였다(locks 04 의 3 · 4, 10 의 3 – 5).
       그 칸의 행 · 열이 띠로 밝아지고, 행 · 열 이름 옆에 그 축의 이름을 단다.
     · 범례를 따로 적은 행렬(mx.no — 강도 표의 예 · 아니오)의 '-' 는 빨강이 아니라 먹색 — '아니오' 는 충돌이 아니다
       축의 이름은 lb.l 이 '행 = A · 열 = B' 로 적으면 A · B, 아니면 STATEMENT 의 키 가운데 값의 첫 낱말이 그 행 · 열 이름인 것
       (강도 행렬 : 이미 걸린 락 X · 새 요청 S)
     · dim 이 있으면 그 칸들만 또렷하고 나머지는 흐리다(Lab · 무대와 같은 뜻 — 한 줄이나 한 열을 짚는다)
     · mx.meas = 두 세션으로 잰 칸 { '행/열' : 본 결과 '+' | '-' } — 칸 귀퉁이의 먹색 점, 범례에 '잰 칸'. 점이 없는 칸은 표의 규칙일 뿐이다(locks 04)
     · 그 스텝이 건드리지 않은 행렬은 흐리게. kv 는 글 블록
     · act 는 덩어리가 on 칸에서 글 블록으로(행렬 → 행렬이면 그 가운데로)
   셈 맞추기는 audit() — make 가 console.error 로 낸다(storysweep 의 errors 가 잡는다). 무엇을 보는지는 audit 의 주석에.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf } from '../../bake.js';

const MC = 25, TOK = 150, SW = 20;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const yesOf = (mx) => mx.yes || '허용', noOf = (mx) => mx.no || '막힘';
/* lb.l 의 축 — '행 = 새 요청  ·  열 = 이미 걸린 락' */
const axesOf = (mx) => { const m = /행\s*=\s*(.+?)\s*·\s*열\s*=\s*(.+)$/.exec((mx.lb && mx.lb.l) || ''); return m ? [m[1].trim(), m[2].trim()] : null; };
const first = (v) => bare(v).trim().split(/[\s(]+/)[0];
const ORDER = /강하거나 같은가|stronger/i;

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

function stateOf(deck, sc) {
  const A = deck.ACTORS, cast = sc.cast.filter((a) => A[a]);
  const frames = bake(sc, null), steps = stepsOf(sc, null);
  const read = (st, step, touch) => {
    const s = { step: step || {}, touch: touch || new Set() };
    for (const a of cast) s[a] = A[a].kind === 'matrix' ? ((st[a] && st[a].mx) || { rows: [], cols: [], cells: [] }) : (st[a] && st[a].kv) || {};
    return s;
  };
  const S0 = read(sc.init), S = frames.map((fr, i) => read(fr.st, steps[i], fr.touch));
  const MATS = cast.filter((a) => A[a].kind === 'matrix'), TEXTS = cast.filter((a) => A[a].kind === 'kv');
  return { A, cast, S0, S, NK: S.length, steps, MATS, TEXTS };
}
/* 그 스텝에서 행렬 a 의 축 이름 — lb.l 이 적으면 그것, 아니면 글 블록의 키 중 값의 첫 낱말이 on 칸의 행 · 열인 것 */
function axisTags(st, s, a) {
  const mx = s[a], on = (mx.on || []).map((k) => k.split('/')), ax = axesOf(mx);
  const rows = [...new Set(on.map(([r]) => r))], cols = [...new Set(on.map(([, c]) => c))];
  let rTag = ax ? ax[0] : null, cTag = ax ? ax[1] : null, rowAt = rows.length === 1 ? rows[0] : null, colAt = cols.length === 1 ? cols[0] : null;
  for (const t of st.TEXTS) for (const [k, v] of Object.entries(s[t])) {
    const w = first(v);
    if (!ax && rows.includes(w) && rows.length === 1 && !(cols.length === 1 && cols[0] === w)) { rTag = k; rowAt = w; }
    else if (!ax && cols.includes(w)) { cTag = k; colAt = w; }
  }
  /* 띠 — 축이 하나로 정해지면 그 행 · 열만(강도 표의 X 행 전부를 짚는 스텝은 X 행과 요청 S 열) */
  return { rTag: rowAt ? rTag : null, cTag: colAt ? cTag : null, rowAt, colAt, rows: rowAt ? [rowAt] : rows, cols: colAt ? [colAt] : cols.length === 1 ? cols : [] };
}

/* ── 셈 맞추기 — 장면 하나. 어긋나면 그 글을 돌려준다 ──
     모양 : 칸 수 = 행 × 열, 칸은 '+' · '-' 뿐 · on · dim 의 칸('행/열')이 행렬에 있다
     대칭 : 범례가 허용 · 막힘(호환 — 두 락 사이의 관계)이고 행 = 열이면 칸 (a, b) = (b, a)
     순서 : lb.l 이 '강하거나 같은가' 면 반사(대각선이 전부 +) · 반대칭(a ≠ b 이면 둘 다 + 일 수 없다) · 추이
     두 표 : 강도 a ≥ b 이면 a 와 함께 설 수 있는 락은 b 와도 함께 선다 — 호환 열 a 의 + 가 열 b 의 + 안에 든다
             (이미 쥔 강한 락이 있으면 약한 락을 새로 만들지 않는다 — 그래도 되려면 이것이 참이어야 한다)
     잰 칸 : meas 의 칸이 행렬에 있고, 본 결과가 그 칸의 값과 같다(호환 표 : 함께 GRANTED = + · WAITING = -,
             강도 표 : 새 락을 안 만듦 = + · 하나 더 만듦 = -). 글이 GRANTED · WAITING 을 말하면 on 칸(하나)이 잰 칸이고 값이 맞다
     act : 'R / C  →  낱말' 이면 그 행렬의 on 에 R/C 가 있고, 낱말이 그 칸의 범례 값이다
     글 : '결과' 같은 값에 범례 값 하나만 있으면 on 칸(하나)의 값과 같다 · lb.l 의 축 이름과 같은 키의 값은 첫 낱말이 그 축의 on 칸 ·
          '… (R) vs … (C)' 처럼 괄호 속 이름 둘이 행렬에 있으면 차례대로 on 칸의 행 · 열 */
export function audit(deck, sc) {
  const st = stateOf(deck, sc), out = [], all = [st.S0, ...st.S];
  const at = (i) => `locks ${sc.num} 세계 : ${i < 0 ? 'init' : i + 1 + ' 스텝'}`;
  all.forEach((s, j) => {
    const i = j - 1;
    for (const a of st.MATS) {
      const mx = s[a], { rows, cols, cells } = mx, cell = (r, c) => (cells[rows.indexOf(r)] || [])[cols.indexOf(c)];
      if (cells.length !== rows.length || cells.some((row) => row.length !== cols.length)) out.push(`${at(i)} 의 ${a} 칸 수가 ${rows.length} × ${cols.length} 가 아니다`);
      cells.forEach((row, ri) => row.forEach((c, ci) => { if (c !== '+' && c !== '-') out.push(`${at(i)} 의 ${a} ${rows[ri]}/${cols[ci]} 칸 '${c}' 는 + · - 가 아니다`); }));
      for (const key of [...(mx.on || []), ...(mx.dim || [])]) { const [r, c] = key.split('/'); if (!rows.includes(r) || !cols.includes(c)) out.push(`${at(i)} 의 ${a} 가 짚는 칸 ${key} 가 행렬에 없다`); }
      if (j > 0) continue;
      for (const [key, v] of Object.entries(mx.meas || {})) {
        const [r, c] = key.split('/');
        if (!rows.includes(r) || !cols.includes(c)) out.push(`${at(i)} 의 ${a} 잰 칸 ${key} 가 행렬에 없다`);
        else if (v !== cell(r, c)) out.push(`${at(i)} 의 ${a} 잰 칸 ${key} 에서 본 것은 '${v}' 인데 표는 '${cell(r, c)}' 다`);
      }
      const sq = rows.length === cols.length && rows.every((r) => cols.includes(r));
      if (sq && !mx.yes && !mx.no) for (const r of rows) for (const c of cols) if (r < c && cell(r, c) !== cell(c, r)) out.push(`${at(i)} 의 ${a} 가 대칭이 아니다 — ${r}/${c} '${cell(r, c)}' · ${c}/${r} '${cell(c, r)}'`);
      if (sq && ORDER.test((mx.lb && mx.lb.l) || '')) {
        for (const r of rows) if (cell(r, r) !== '+') out.push(`${at(i)} 의 ${a} 대각선 ${r}/${r} 가 + 가 아니다 — 자기보다 강하거나 같지 않다`);
        for (const r of rows) for (const c of cols) if (r !== c && cell(r, c) === '+' && cell(c, r) === '+') out.push(`${at(i)} 의 ${a} ${r}/${c} · ${c}/${r} 가 둘 다 + 다(반대칭이 아니다)`);
        for (const x of rows) for (const y of rows) for (const z of rows) if (cell(x, y) === '+' && cell(y, z) === '+' && cell(x, z) !== '+') out.push(`${at(i)} 의 ${a} ${x} ≥ ${y} ≥ ${z} 인데 ${x}/${z} 가 + 가 아니다`);
        for (const b of st.MATS) {
          const C = s[b];
          if (b === a || C.yes || C.no || C.cols.join() !== cols.join()) continue;
          const cc = (r, c) => (C.cells[C.rows.indexOf(r)] || [])[C.cols.indexOf(c)];
          for (const p of rows) for (const q of rows) if (p !== q && cell(p, q) === '+') for (const x of C.rows) if (cc(x, p) === '+' && cc(x, q) !== '+') out.push(`${at(i)} : ${a} 는 ${p} ≥ ${q} 인데 ${b} 에서 ${x} 는 ${p} 와 서고 ${q} 와는 막힌다`);
        }
      }
    }
    if (i < 0) return;
    const step = st.steps[i], act = step.act;
    if (act && st.MATS.includes(act.f)) {
      const m = /^\s*(\S+)\s*\/\s*(\S+)\s*→\s*(\S+)/.exec(act.lb), mx = s[act.f];
      if (m) {
        const key = m[1] + '/' + m[2], c = (mx.cells[mx.rows.indexOf(m[1])] || [])[mx.cols.indexOf(m[2])];
        if (!(mx.on || []).includes(key)) out.push(`${at(i)} 의 act '${act.lb}' 가 짚는 ${key} 가 ${act.f} 의 on 에 없다`);
        if (c && m[3] !== (c === '+' ? yesOf(mx) : noOf(mx))) out.push(`${at(i)} 의 act '${act.lb}' — ${key} 칸은 '${c === '+' ? yesOf(mx) : noOf(mx)}' 다`);
      }
    }
    /* 글과 견주는 행렬 — 그 스텝이 on 을 직접 적은 것(앞 스텝에서 이어진 on 은 그 스텝의 글이 말하는 칸이 아니다) */
    const touched = st.MATS.filter((a) => ((step.ops || {})[a] || {}).on && (s[a].on || []).length === 1);
    for (const a of touched) {
      const mx = s[a], [r, c] = mx.on[0].split('/'), v = (mx.cells[mx.rows.indexOf(r)] || [])[mx.cols.indexOf(c)], word = v === '+' ? yesOf(mx) : noOf(mx), ax = axesOf(mx);
      for (const t of st.TEXTS) for (const [k, raw] of Object.entries(s[t])) {
        const w0 = bare(raw), seen = !mx.yes && !mx.no && (step.ops || {})[t] && (step.ops[t].set || {})[k] !== undefined ? (/\bGRANTED\b/.test(w0) ? '+' : /\bWAITING\b/.test(w0) ? '-' : null) : null;
        if (seen && (mx.meas || {})[r + '/' + c] !== seen) out.push(`${at(i)} 의 ${t}.${k} "${w0}" — ${a} ${r}/${c} 가 '${seen}' 로 잰 칸이 아니다 (meas ${JSON.stringify((mx.meas || {})[r + '/' + c] ?? null)})`);
        const w = w0, says = [yesOf(mx), noOf(mx)].filter((x) => new RegExp(`(^|[\\s·])${x}($|[\\s·])`).test(w));
        if (says.length === 1 && (step.ops || {})[t] && (step.ops[t].set || {})[k] !== undefined && says[0] !== word) out.push(`${at(i)} 의 ${t}.${k} "${w}" 인데 ${a} ${r}/${c} 칸은 '${word}'`);
        if (ax && k === ax[0] && first(raw) !== r && mx.rows.includes(first(raw))) out.push(`${at(i)} 의 ${t}.${k} 가 ${first(raw)} 인데 ${a} 의 on 행은 ${r}`);
        if (ax && k === ax[1] && first(raw) !== c && mx.cols.includes(first(raw))) out.push(`${at(i)} 의 ${t}.${k} 가 ${first(raw)} 인데 ${a} 의 on 열은 ${c}`);
        const ps = [...w.matchAll(/\(([^)\s]+)\)/g)].map((q) => q[1]).filter((q) => mx.rows.includes(q) || mx.cols.includes(q));
        if (ps.length === 2 && (ps[0] !== r || ps[1] !== c)) out.push(`${at(i)} 의 ${t}.${k} "${w}" 의 (${ps[0]}) · (${ps[1]}) 가 ${a} 의 on ${r}/${c} 와 다르다`);
      }
    }
  });
  return out;
}

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), st = stateOf(deck, sc), { A, S0, S, NK, MATS, TEXTS } = st;
  for (const m of audit(deck, sc)) console.error(m);
  const SHAPE = Object.fromEntries(MATS.map((a) => [a, { r: S0[a].rows.length, c: S0[a].cols.length }]));

  /* ── 알갱이 구역 ── */
  const R0 = {};
  let at = 0;
  const take = (k, n) => { R0[k] = [at, at + n]; at += n; };
  for (const a of MATS) { take('m:' + a, SHAPE[a].r * SHAPE[a].c * MC); take('lg:' + a, 2 * SW); }
  take('tok', TOK);
  R0.DST = [at, N];
  if (at > N) throw new Error('locks 행렬 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표 ── */
  const made = [];
  const label = (cls = '') => { const el = document.createElement('div'); el.className = 'wl aq ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; };
  const setText = (lb, s, html = false) => { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; };
  const place = (lb, x, y, al = 'l', va = 't') => {
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%';
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`;
  };
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const hd = Object.fromEntries([...TEXTS, ...MATS].map((a) => [a, label('')])), tx = Object.fromEntries(TEXTS.map((a) => [a, label('ml aq-b')]));
  const ML = Object.fromEntries(MATS.map((a) => [a, {
    r: Array.from({ length: SHAPE[a].r }, () => label('')), c: Array.from({ length: SHAPE[a].c }, () => label('aq-c')),
    rt: label(''), ct: label('aq-c'), yes: label(''), no: label(''), ms: label(''), cap: label('ml aq-b'),
  }]));
  const tok = label(''); tok.el.className = 'wl stn-tok';
  const kvHtml = (kv, hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join('\n');
  /* 그 스텝이 짚는 배우 — ops 나 look 이 적은 것. act 의 출발점일 뿐인 행렬(04 의 5 : 호환 → 강도)은 앞 스텝의 on 이 남아 있어도 밝히지 않는다 */
  const live = (s, a) => !!((s.step.ops || {})[a] || (s.step.look || {})[a]);
  const TAGS = S.map((s) => Object.fromEntries(MATS.map((a) => [a, axisTags(st, s, a)])));
  const TX = S.map((s, kk) => {
    const t = new Map();
    for (const a of TEXTS) { t.set(hd[a], [A[a].nm, live(s, a)]); t.set(tx[a], [kvHtml(s[a]), live(s, a), '', true, true]); }
    for (const a of MATS) {
      const mx = s[a], M = ML[a], g = TAGS[kk][a], lit = live(s, a);
      t.set(hd[a], [A[a].nm, lit]);
      M.r.forEach((lb, i) => { const on = g.rows.includes(mx.rows[i]); t.set(lb, [mx.rows[i], lit, on && lit ? 'gold' : '']); });
      M.c.forEach((lb, j) => { const on = g.cols.includes(mx.cols[j]); t.set(lb, [mx.cols[j], lit, on && lit ? 'gold' : '']); });
      t.set(M.rt, [g.rTag ? g.rTag + '  →' : '', lit, 'gold', !!g.rTag && lit]);
      t.set(M.ct, [g.cTag ? g.cTag + '  ↓' : '', lit, 'gold', !!g.cTag && lit]);
      t.set(M.yes, [yesOf(mx), lit]); t.set(M.no, [noOf(mx), lit]);
      const nm = Object.keys(mx.meas || {}).length;
      t.set(M.ms, [nm ? `잰 칸 ${nm} · 나머지는 규칙` : '', lit, '', !!nm]);
      t.set(M.cap, [mx.lb ? `${esc(mx.lb.l || '')}${mx.lb.r ? '\n<span class="q-i">' + esc(mx.lb.r) + '</span>' : ''}` : '', lit, '', !!mx.lb, true]);
    }
    return t;
  });
  const most = (lb) => {
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const t of TX) { const e = t.get(lb); if (!e || e[3] === false || !e[0]) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); }
    lb.el.innerHTML = keep;
    return { w, h };
  };
  const widthOf = (lb, html) => { if (!html) return 0; const keep = lb.el.innerHTML; lb.el.innerHTML = html; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(17), dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const LH = 16, HD = 18;
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = ww < 560 ? 16 : 26;
    for (const a of TEXTS) wrap(tx[a], ww);
    const tH = TEXTS.reduce((t, a) => t + HD + most(tx[a]).h + 12, 0);
    /* 행렬 — 나란히(넓으면) 또는 위아래로. 칸은 정사각, 크기는 폭 · 높이 둘 다에서 */
    const tagW = Object.fromEntries(MATS.map((a) => [a, Math.ceil(most(ML[a].rt).w)])), rhW = Object.fromEntries(MATS.map((a) => [a, Math.ceil(Math.max(14, ...ML[a].r.map((lb) => most(lb).w)))]));
    const fixedW = (a) => tagW[a] + (tagW[a] ? 8 : 0) + rhW[a] + 8;
    const capH = (a, w) => { wrap(ML[a].cap, w); return most(ML[a].cap).h; };
    const blockH = (a, cs, w) => HD + LH + LH + SHAPE[a].r * cs + 8 + LH + 6 + capH(a, w);
    const tryLay = (side) => {
      const n = MATS.length, bw = side ? (ww - (n - 1) * gap) / n : ww;
      const csW = Math.min(...MATS.map((a) => (bw - fixedW(a)) / SHAPE[a].c));
      const restH = wh - tH - (side ? 0 : (n - 1) * 14);
      const fixH = side ? Math.max(...MATS.map((a) => blockH(a, 0, bw))) : MATS.reduce((t, a) => t + blockH(a, 0, bw), 0);
      const rowsH = side ? Math.max(...MATS.map((a) => SHAPE[a].r)) : MATS.reduce((t, a) => t + SHAPE[a].r, 0);
      const cs = Math.floor(Math.min(42, csW, (restH - fixH) / rowsH));
      return { side, bw, cs, h: tH + (side ? Math.max(...MATS.map((a) => blockH(a, cs, bw))) : MATS.reduce((t, a) => t + blockH(a, cs, bw), 0) + (n - 1) * 14) };
    };
    const lays = MATS.length > 1 ? [tryLay(true), tryLay(false)] : [tryLay(false)];
    const lay = lays.reduce((p, q) => (q.cs > p.cs + 2 ? q : p));
    if (lay.cs < 14 || lay.h > wh + 1) console.error(`locks ${sc.num} 행렬 세계 : 칸 ${lay.cs}px · 높이 ${Math.round(lay.h)} / 무대 ${Math.round(wh)} (${L.W}×${L.H})`);
    for (const a of MATS) wrap(ML[a].cap, lay.bw);
    HT = lay.h;
    const y0 = L.y0 + (L.narrow ? 0 : Math.max(0, (wh - lay.h) / 2));
    G = { L, cs: lay.cs, mat: {}, pos: S.map(() => new Map()), text: {} };
    const PA = (lb, x, y, al = 'l', va = 't') => G.pos.forEach((m) => m.set(lb, [x, y, al, va]));
    let y = y0;
    for (const a of TEXTS) { PA(hd[a], L.x0, y); PA(tx[a], L.x0, y + HD); G.text[a] = { x: L.x0, y, h: HD + most(tx[a]).h }; y += HD + most(tx[a]).h + 12; }
    MATS.forEach((a, n) => {
      const bx = lay.side ? L.x0 + n * (lay.bw + gap) : L.x0, by = lay.side ? y : y + MATS.slice(0, n).reduce((t, b) => t + blockH(b, lay.cs, lay.bw) + 14, 0);
      const M = ML[a], cs = lay.cs, gx = bx + fixedW(a), gy = by + HD + LH + LH;
      G.mat[a] = { x: gx, y: gy, cs, bx, by, w: lay.bw };
      PA(hd[a], bx, by);
      M.c.forEach((lb, j) => PA(lb, gx + (j + 0.5) * cs, gy - 4, 'c', 'b'));
      M.r.forEach((lb, i) => PA(lb, gx - 8, gy + (i + 0.5) * cs, 'r', 'c'));
      /* 축 이름 — 그 스텝의 on 행 왼쪽 · on 열 위. 열 이름은 격자 폭 안에서 가운데로 */
      S.forEach((s, kk) => {
        const g = TAGS[kk][a], mx = s[a];
        if (g.rowAt) G.pos[kk].set(M.rt, [gx - 8 - rhW[a] - 8, gy + (mx.rows.indexOf(g.rowAt) + 0.5) * cs, 'r', 'c']);
        if (g.colAt) {
          const w = widthOf(M.ct, TX[kk].get(M.ct)[0]), cx = gx + (mx.cols.indexOf(g.colAt) + 0.5) * cs;
          G.pos[kk].set(M.ct, [Math.max(bx + w / 2, Math.min(bx + lay.bw - w / 2, cx)), gy - 4 - LH, 'c', 'b']);
        }
      });
      const ly = gy + SHAPE[a].r * cs + 8 + LH / 2;
      G.mat[a].leg = { y: ly, x: bx };
      const yw = Math.ceil(widthOf(M.yes, esc(yesOf(S0[a]))));
      PA(M.yes, bx + 18, ly, 'l', 'c'); PA(M.no, bx + 18 + yw + 22 + 18, ly, 'l', 'c');
      G.mat[a].leg.nx = bx + 18 + yw + 22;
      /* 잰 칸 — 막힘 다음에 점 하나와 '잰 칸 N' */
      const nw = Math.ceil(widthOf(M.no, esc(noOf(S0[a]))));
      G.mat[a].leg.mx = G.mat[a].leg.nx + 18 + nw + 22;
      PA(M.ms, G.mat[a].leg.mx + 12, ly, 'l', 'c');
      if (Object.keys(S0[a].meas || {}).length && G.mat[a].leg.mx + 12 + most(M.ms).w > bx + lay.bw + 1) console.error(`locks ${sc.num} 행렬 세계 : ${a} 범례가 폭 ${Math.round(lay.bw)} 을 넘는다 (${L.W}×${L.H})`);
      PA(M.cap, bx, ly + LH / 2 + 6);
    });
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  const cellC = (a, mx, key) => { const [r, c] = key.split('/'), M = G.mat[a], i = mx.rows.indexOf(r), j = mx.cols.indexOf(c); return i < 0 || j < 0 ? null : [M.x + (j + 0.5) * M.cs, M.y + (i + 0.5) * M.cs]; };
  function anchor(a, s, from) {
    if (G.mat[a]) {
      const mx = s[a], on = mx.on || [];
      if (from && on.length === 1) return cellC(a, mx, on[0]);
      const M = G.mat[a]; return [M.x + (SHAPE[a].c * M.cs) / 2, M.y + (SHAPE[a].r * M.cs) / 2];
    }
    const T = G.text[a];
    return T ? [T.x + 60, T.y + 9] : [G.L.x0, G.L.y0];
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  const rim = (x, y, w, h, n, m) => { const per = 2 * (w + h), d = ((m + 0.5) / n) * per; return d < w ? [x + d, y] : d < w + h ? [x + w, y + d - w] : d < 2 * w + h ? [x + w - (d - w - h), y + h] : [x, y + h - (d - 2 * w - h)]; };
  const fill = (x, y, w, h, n, m) => { const c = Math.round(Math.sqrt(n)), r = Math.ceil(n / c); return [x + ((m % c) + 0.5) / c * w, y + (Math.floor(m / c) + 0.5) / r * h]; };
  let O = null;
  const hide = (k) => { const [a, b] = R0[k]; for (let i = a; i < b; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1, lit0 = show(p, 0.1, 0.36);
    for (let i = R0.DST[0]; i < R0.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    for (const a of MATS) {
      const mx = s[a], pm = prev[a], M = G.mat[a], [m0] = R0['m:' + a], live2 = live(s, a) && !end, cs = M.cs, w = cs - 7;
      const on = new Set(mx.on || []), dm = new Set(mx.dim || []), pon = new Set(pm.on || []), g = TAGS[kk][a], noC = mx.no ? INK : RED;
      for (let i = 0; i < SHAPE[a].r; i++) for (let j = 0; j < SHAPE[a].c; j++) {
        const key = mx.rows[i] + '/' + mx.cols[j], yes = (mx.cells[i] || [])[j] === '+', x0 = M.x + j * cs + 3.5, y0 = M.y + i * cs + 3.5;
        const hot = on.has(key), off = dm.size && !dm.has(key) && !hot, band = live2 && (g.rows.includes(mx.rows[i]) || g.cols.includes(mx.cols[j]));
        /* 새로 짚은 칸은 서서히 금빛 — 서는 자리 전에 끝난다 */
        const q = hot && live2 ? (pon.has(key) ? 1 : lit0) : 0;
        const al = (live2 ? (band ? 0.95 : 0.7) : 0.45) * (off ? 0.28 : 1) * dim * form;
        for (let m = 0; m < MC; m++) {
          const idx = m0 + (i * SHAPE[a].c + j) * MC + m, [x, y] = into(idx, ...(yes ? fill(x0, y0, w, w, MC, m) : rim(x0, y0, w, w, MC, m)));
          put(o, idx, x, y, Math.max(al, q * 0.95 * dim * form), q > 0.5 ? 0.6 : band ? 0.15 : 0, 0.02, yes ? 1.3 : 1.15, yes ? GREEN : noC);
        }
      }
      /* 범례 — 채운 칸 · 테두리 칸 */
      const [l0] = R0['lg:' + a], L2 = M.leg;
      for (let m = 0; m < 2 * SW; m++) {
        const i = l0 + m, yes = m < SW, n = m % SW, x0 = yes ? L2.x : L2.nx, [x, y] = into(i, ...(yes ? fill(x0, L2.y - 6, 12, 12, SW, n) : rim(x0, L2.y - 6, 12, 12, SW, n)));
        put(o, i, x, y, (live2 ? 0.85 : 0.5) * dim * form, 0, 0.02, yes ? 1.2 : 1, yes ? GREEN : noC);
      }
    }
    const [t0, t1] = R0.tok, tn = t1 - t0;
    if (act && anchor(act.f, s, true) && anchor(act.t, s, false)) {
      const [fx, fy] = anchor(act.f, s, true), [tx2, ty2] = anchor(act.t, s, false), e = U.smooth(fly), gone = show(p, 0.42, 0.52), col = act.gold ? GOLD : ACCENT;
      const arc = Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      for (let m = 0; m < tn; m++) { const i = t0 + m, th = m * 2.399, r = Math.sqrt((m + 0.5) / tn) * 7; put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, U.lerp(fy, ty2, e) + Math.sin(th) * r - arc, (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, col); }
    } else hide('tok');
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  const samePos = (a, b) => (!a && !b) || (a && b && a.every((v, i) => v === b[i]));
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, ka = Math.min(k, NK - 1), kb = Math.min(next, NK - 1);
    const TA = TX[ka], TB = TX[kb], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
        const ps = G.pos[kk].get(lb);
        if (ps) place(lb, ...ps);
      }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true) && samePos(G.pos[ka].get(lb), G.pos[kb].get(lb));
      setO(lb, vis && txt && G.pos[kk].get(lb) ? dimO * (emph ? 1 : 0.5) * (same ? 1 : fade) : 0);
    }
    const s = S[ka], act = k < NK && s.step.act ? s.step.act : null;
    let o = act ? show(p, 0.06, 0.12) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, true) || [0, 0], [tx2, ty2] = anchor(act.t, s, false) || [0, 0], e = U.smooth(show(p, 0.08, 0.42));
      const arc = Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arc - 14);
      const [qx, qy, keep] = dockAt(F, tok.el, s, p, x, y, G.L, tx2, ty2); o *= keep;
      tok.el.style.transform = `translate(${qx}px, ${qy}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form;
    ctx.save();
    for (const a of MATS) {
      const mx = s[a], M = G.mat[a], g = TAGS[kk][a], cs = M.cs, W = SHAPE[a].c * cs, H = SHAPE[a].r * cs, lit = live(s, a) && !end;
      /* 격자 테두리 */
      ctx.globalAlpha = 0.25 * o; ctx.strokeStyle = css.faint; ctx.lineWidth = 1;
      ctx.strokeRect(M.x + 0.5, M.y + 0.5, W - 1, H - 1);
      /* 잰 칸의 점 — 칸 오른쪽 위 귀퉁이 · 범례의 점 */
      const meas = Object.keys(mx.meas || {});
      if (meas.length) {
        ctx.globalAlpha = (lit ? 0.85 : 0.45) * o; ctx.fillStyle = css.ink;
        const rr = Math.max(2, cs * 0.08);
        for (const key of meas) { const P = cellC(a, mx, key); if (!P) continue; ctx.beginPath(); ctx.arc(P[0] + cs / 2 - 3.5 - rr - 2, P[1] - cs / 2 + 3.5 + rr + 2, rr, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.arc(M.leg.mx + 4, M.leg.y, Math.max(2, rr), 0, Math.PI * 2); ctx.fill();
      }
      if (!lit) continue;
      /* 요청 · 보유의 띠 — on 칸의 행과 열 */
      ctx.globalAlpha = 0.09 * o; ctx.fillStyle = css.gold;
      for (const r of g.rows) { const i = mx.rows.indexOf(r); if (i >= 0) ctx.fillRect(M.x, M.y + i * cs, W, cs); }
      for (const c of g.cols) { const j = mx.cols.indexOf(c); if (j >= 0) ctx.fillRect(M.x + j * cs, M.y, cs, H); }
      for (const key of mx.on || []) {
        const P = cellC(a, mx, key); if (!P) continue;
        const [r, c] = key.split('/'), v = (mx.cells[mx.rows.indexOf(r)] || [])[mx.cols.indexOf(c)];
        if (v === '-' && !mx.no) { ctx.globalAlpha = 0.16 * o; ctx.fillStyle = css.red; ctx.fillRect(P[0] - cs / 2 + 4, P[1] - cs / 2 + 4, cs - 8, cs - 8); }
        ctx.globalAlpha = 0.9 * o; ctx.strokeStyle = css.gold; ctx.lineWidth = 1.5;
        ctx.strokeRect(P[0] - cs / 2 - 1.5, P[1] - cs / 2 - 1.5, cs + 3, cs + 3);
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); return HT; },
    theme() { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim(); css = { faint: v('--faint'), gold: v('--gold'), red: v('--red'), ink: v('--ink') }; },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
