/* ch3 — 3장 'File Formats' 에서 전용 세계가 없던 21 장면(01 · 01v · 06b 밖)이 함께 쓰는 세계.
   01 의 칸과 글자 알갱이, 06b 의 바이트 하나 = 알갱이 하나인 page 격자와 hexdump 를 그대로 잇는다.
   그리는 것은 모두 그 장면의 bake 상태와 측정(pagedump · spacedump)에서 읽는다 — 손으로 적은 자리가 없다.

     · bytes 배우 = 바이트 줄. 칸 폭은 바이트 수에 비례한다(sub · id 의 'N B', 아니면 sz). 오프셋을 아는 줄(fil · phd ·
       record)은 칸 경계에 오프셋 눈금을 단다. 원점(◆)이 있는 줄은 원점에 맞춰 앞(extra) · 뒤(데이터)로 놓는다
     · record 헤더(rhd · bit5) = 바이트 칸 + 그 아래 bit 줄. bit 칸은 rec.h 의 배치(info 4 · n_owned 4 · heap_no 13 …)
     · FIL · PAGE header = 칸 줄 + 측정한 page 의 hexdump(짚는 칸의 바이트가 금빛)
     · 16 KB page = 128 × 128 알갱이(06b 와 같다). 영역 · 경계 · record 자리 · free list · checksum 범위가 바이트 자리에
     · slot directory 는 page 끝에서 거꾸로, 슬롯 → record 화살표. next 사슬은 heap 순서로 놓은 record 위로 키 순서의 호
     · 04c 는 page 0 의 FSP header 칸(값은 fsA · fsL), extent 마다 page 64 칸(쓰인 bit · 주인), page 2 의 inode 와 그 낱장
     · 나머지 kv 는 글 블록, 나머지 list 는 칸 줄
   셈 맞추기는 ch3-check.js — 어긋나면 console.error(storysweep 의 errors).
   짝 장면(04b · 04bv, 05 · 05v)은 한 세계가 둘을 다 들고 있다가 setScene 으로 바꾼다 — 같은 배우 · 같은 칸의 알갱이가 날아간다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, ACCENT, GREEN, RED, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';
import * as C from './ch3-check.js';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const HANGUL = /[가-힣]/;
const { bare, tone, PAGE } = C;
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const fmt = (n) => Number(n).toLocaleString('en-US');
/* 그리는 동안의 검사는 매 프레임 돈다 — 같은 문장은 한 번만 낸다 */
const said = new Set();
const once = (m) => { if (!said.has(m)) { said.add(m); console.error(m); } };
const TAGC = { clean: INK, '': INK, hdr: ACCENT, gold: GOLD, red: RED, free: FAINT, x: RED, ok: GREEN, hold: GOLD, pin: GOLD, wait: ACCENT, dirty: GOLD };
const TAGL = { gold: 'gold', red: 'red', x: 'red', ok: 'green', hold: 'gold', pin: 'gold' };
/* 짝 — B 쪽이 A 의 세계를 쓴다(index.js 와 같은 짝) */
export const PAIR = { '04bv': '04b', '05v': '05' };
const RH = 15, HD = 18, SL = 44, TOK = 150, GLN = 220;

export default {
  count: (narrow, deck, sc) => {
    if (!deck || !sc) return 9000;
    const need = new Map();
    for (const s2 of pairOf(deck, sc)) for (const sp of specsOf(modelOf(deck, s2))) for (const [k, n] of sp.need) need.set(k, Math.max(need.get(k) || 0, n));
    const n = [...need.values()].reduce((a, x) => a + x, 0) + TOK;
    return n + (narrow ? 1600 : 2400);
  },
  make,
};

const pairOf = (deck, sc) => {
  const a = PAIR[sc.num] || sc.num, b = Object.keys(PAIR).find((k) => PAIR[k] === a);
  return [a, b].filter(Boolean).map((n) => deck.SCENES.find((s) => s.num === n)).filter(Boolean);
};

/* ── 장면의 상태 — 손잡이 값마다 init + 스텝 ── */
function modelOf(deck, sc) {
  const A = deck.ACTORS, cast = sc.cast.filter((a) => A[a]);
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch, i) => {
    const s = { i, step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {}, byl: {} };
    for (const a of cast) {
      if (A[a].kind === 'kv') s[a] = { ...((st[a] && st[a].kv) || {}) };
      else {
        /* k = 칸의 열쇠 — 같은 id 가 한 상태에 둘 이상이면(03 의 0x01 · 0x00 · 0x01) 두 번째부터 '#n' 을 붙인다.
           id 로만 열쇠를 삼았더니 두 0x01 이 한 칸으로 합쳐져 세 바이트가 두 칸으로 그려졌다 */
        const seen = new Map();
        s[a] = ((st[a] && st[a].items) || []).map((it) => {
          const id = String(it.id), n = seen.get(id) || 0;
          seen.set(id, n + 1);
          return { ...it, id, k: n ? id + '#' + n : id, tag: it.tag || 'clean', sub: it.sub || '' };
        });
      }
      s.byl[a] = (st[a] && st[a].byl) || null;
    }
    return s;
  };
  const B = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k);
    B.set(k, { S0: read(sc.init, null, null, null, -1), S: frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch, i)), NK: frames.length });
  }
  const all = [...B.values()].flatMap((b) => [b.S0, ...b.S]);
  return { deck, sc, A, cast, B, keyOf, all, MEAS: deck.MEASURED };
}
const ids = (M, a) => [...new Set(M.all.flatMap((s) => (s[a] || []).map((x) => x.id)))];
/* 칸 열쇠(k) — 바이트 줄은 id 가 아니라 이것으로 알갱이 · 이름표를 나눈다 */
const keysOf = (M, a) => [...new Set(M.all.flatMap((s) => (s[a] || []).map((x) => x.k)))];

/* ── 장면 → 그림판(panel). 배우의 모양과 이름으로 고른다 ── */
function specsOf(M) {
  const has = (a) => M.cast.includes(a), used = new Set(), P = [];
  const use = (...as) => as.forEach((a) => used.add(a));
  const n = M.sc.num;
  if (has('fsA')) { P.push(spaceSpec(M)); use('fsA', 'fsL', 'xd', 'ino'); }
  if (has('rdx') || has('cdx')) { P.push(bytesSpec(M, { rows: [['rdx', 'rdat'], ['cdx', 'rdat']].filter((r) => has(r[0])), arcs: 'rdx' })); use('rdx', 'cdx', 'rdat'); }
  if (has('rhd')) {
    P.push(bytesSpec(M, { rows: [has('rdat') ? ['rhd', 'rdat'] : ['rhd']], glyph: !has('rdat') }));
    use('rhd', 'rdat');
    if (has('bit5')) { P.push(bitsSpec(M, 'bit5', 'rhd')); use('bit5'); }
  }
  if (has('fil')) { P.push(bytesSpec(M, { rows: [['fil']], ruler: 'abs' })); P.push(hexSpec(M, 'fil')); use('fil'); }
  if (has('phd')) { P.push(bytesSpec(M, { rows: [['phd']], ruler: 'rel', subs: ['fsp', 'fins'] })); P.push(hexSpec(M, 'phd')); use('phd', 'fsp', 'fins'); }
  /* 02 · 03 · 07 — 값(val)과 셀(rec)을 한 그림판에 두 줄로. 바이트 폭이 같은 눈금이 되게 */
  const vr = ['val', 'rec'].filter((a) => has(a) && !used.has(a));
  if (vr.length && n === '03') {
    /* 03 은 값 바로 아래에 그 바이트의 8 bit — 셀 줄은 그 아래 */
    P.push(bytesSpec(M, { rows: [['val']], glyph: true }));
    if (has('bits')) P.push(byteBitsSpec(M));
    if (has('rec')) P.push(bytesSpec(M, { rows: [['rec']] }));
    use(...vr, 'bits');
  } else if (vr.length) {
    P.push(bytesSpec(M, { rows: vr.map((a) => [a]), glyph: n !== '07' }));
    use(...vr);
  }
  if (has('bits') && !used.has('bits') && n === '03a') { P.push(flagsSpec(M, 'bits')); use('bits'); }
  if (has('file') && !used.has('file')) {
    const many = M.all.some((s) => (s.file || []).length > 1);
    P.push(many ? tilesSpec(M) : chipsSpec(M, 'file'));
    use('file');
  }
  if (n === '10') P.push(flagsSpec(M, null));
  if (has('pg')) {
    if (n === '04') { P.push(hexSpec(M, 'hdr')); P.push(mapSpec(M, n)); }
    else if (n === '11') { P.push(coverSpec(M, 'head')); P.push(mapSpec(M, n)); P.push(coverSpec(M, 'tail')); }
    else if (n === '06') { P.push(pstripSpec(M)); P.push(chain06Spec(M)); use('dir', 'cells'); }
    else { P.push(pstripSpec(M)); use('dir', 'cells'); if (has('freeL')) { P.push(fchainSpec(M)); use('freeL'); } }
    use('pg');
  }
  if (n === '06a') { P.push(mapSpec(M, n)); use('dir', 'addr'); }
  if (n === '08a') { P.push(raxisSpec(M)); use('cells', 'dir'); }
  if (n === '09a') { P.push(mapSpec(M, n)); P.push(fchainSpec(M)); P.push(gaugeSpec(M)); use('freeL'); }
  if (n === '11') use('sum');
  const texts = M.cast.filter((a) => M.A[a].kind === 'kv' && !used.has(a));
  const out = [];
  if (texts.length) out.push({ kind: 'text', as: texts, need: [] });
  out.push(...P);
  for (const a of M.cast) if (!used.has(a) && M.A[a].kind === 'list' && M.all.some((s) => (s[a] || []).length)) out.push(chipsSpec(M, a));
  return out;
}

/* ── 그림판마다 쓰는 알갱이 — count 가 먼저 셀 수 있게 DOM 없이 ── */
function chipsSpec(M, a) { return { kind: 'chips', a, need: ids(M, a).map((id) => ['c:' + a + ':' + id, SL]) }; }
const unitsOf = (a, it) => {
  if (C.isMark(it)) return 0;
  const b = C.bytesIn(it.sub) ?? C.bytesIn(it.id);
  /* 'N B' 가 sz 와 다르면(여분 5B · sz 2) 그 줄은 비례가 아니다 — 글이 말한 바이트를 쓴다 */
  return b != null && b > 0 && b < 200 && !/[~]/.test(it.sub) ? b : it.sz || 1;
};
const bkey = (r, a, it) => 'b:' + r + ':' + a + ':' + it.k;
function bytesSpec(M, o) {
  const need = new Map();
  /* 줄마다 따로 — 한 배우가 두 줄에 나오면(02a 의 rdat) 줄마다 제 알갱이를 갖는다. 줄 번호 없이 열쇠를 삼았더니
     COMPACT 줄이 REDUNDANT 줄의 데이터 알갱이를 가져가 REDUNDANT 칸이 비었다 */
  o.rows.forEach((row, r) => { for (const a of row) for (const s of M.all) for (const it of s[a] || []) {
    const u = unitsOf(a, it), k = bkey(r, a, it);
    need.set(k, Math.max(need.get(k) || 0, C.isMark(it) ? 40 : Math.min(520, 80 + 14 * Math.min(32, u))));
    if (o.glyph) tokensOf(it).forEach((_, j) => need.set(k.replace(/^b:/, 'g:') + ':' + j, GLN));
  } });
  return { kind: 'bytes', ...o, need: [...need] };
}
/* 칸 안에 글자로 그릴 바이트 — 16진 id(0x0006 → 00 06), 글자 id('L e s l i e'), 16진 sub('00 02') */
const tokSrc = (it) => { const sz = it.sz || 1; if (/^0x[0-9a-f]+$/i.test(it.id) || (it.id.split(/\s+/).length === sz && sz > 1 && it.id.split(/\s+/).every((x) => x.length === 1))) return 'id'; const hb = C.hexBytes(it.sub); return hb && hb.length === sz ? 'sub' : null; };
function tokensOf(it) {
  const sz = it.sz || 1;
  if (/^0x[0-9a-f]+$/i.test(it.id)) { const h = it.id.slice(2).padStart(sz * 2, '0'); return h.length === sz * 2 ? h.match(/../g) : []; }
  const sp = it.id.split(/\s+/);
  if (sp.length === sz && sz > 1 && sp.every((x) => x.length === 1)) return sp;
  const hb = C.hexBytes(it.sub);
  if (hb && hb.length === sz) return bare(it.sub).trim().split(/\s+/);
  return [];
}
const BITN = 12;
function bitsSpec(M, a, src) { return { kind: 'bits', a, src, need: [['bits:' + a, 48 * BITN], ['bitz:' + a, 80]] }; }
function byteBitsSpec(M) { return { kind: 'bbits', a: 'bits', need: [['bb', 3 * 8 * BITN + 80]] }; }
function flagsSpec(M, a) { return { kind: 'flags', a, need: [['fl', 4 * 15 * BITN + 40]] }; }
function hexSpec(M, a) { return { kind: 'hex', a, need: [] }; }
function tilesSpec(M) { return { kind: 'tiles', a: 'file', need: [['tl', 17 * 34]] }; }
function mapSpec(M, n) { return { kind: 'map', n, need: [['map', PAGE], ['mk', 160]] }; }
function coverSpec(M, part) { return { kind: 'cover', part, need: [['cv:' + part, part === 'head' ? 38 * 8 : 8 * 10]] }; }
/* page 띠(비례) + 셀 · 슬롯 칸 줄 — 06 은 띠만(슬롯은 chain06 이 그린다) */
function pstripSpec(M) {
  const lists = M.sc.num === '06' ? [] : ['cells', 'dir'].filter((a) => M.cast.includes(a));
  const need = [...bytesSpec(M, { rows: [['pg']] }).need, ...lists.flatMap((a) => chipsSpec(M, a).need)];
  return { kind: 'pstrip', lists, need };
}
function chain06Spec(M) { return { kind: 'chain06', need: [['ch', 18 * 22 + 4 * 30]] }; }
function raxisSpec(M) { return { kind: 'raxis', need: [['ra', 12 * 50 + 4 * 40 + 120]] }; }
function fchainSpec(M) { return { kind: 'fchain', need: [['fc0', SL], ...ids(M, 'freeL').map((id) => ['fc:' + id, SL])] }; }
function gaugeSpec(M) { return { kind: 'gauge', need: [['gg', 160]] }; }
function spaceSpec(M) { return { kind: 'space', need: [['sp0', 160], ['sph', 12 * 30], ['spx', 3 * 64 * 4 + 120], ['spi', 6 * 40]] }; }

/* ═════════════════════════════════════════ 세계 ═════════════════════════════════════════ */
function make({ F, deck, labels, scene }) {
  const N = F.N;
  const SCS = pairOf(deck, scene());
  const MS = Object.fromEntries(SCS.map((s) => [s.num, modelOf(deck, s)]));
  let num = MS[scene().num] ? scene().num : SCS[0].num;
  /* 셈 맞추기 — 장면을 실을 때 한 번(짝도) */
  for (const s of SCS) for (const m of C.checkScene(deck, s)) console.error(m);

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const needs = new Map();
  const specs = Object.fromEntries(SCS.map((s) => [s.num, specsOf(MS[s.num])]));
  for (const sp of Object.values(specs).flat()) for (const [k, n] of sp.need) needs.set(k, Math.max(needs.get(k) || 0, n));
  for (const [k, n] of needs) { R[k] = [at, at + n]; at += n; }
  R.tok = [at, at + TOK]; at += TOK;
  R.DST = [at, N];
  if (at > N) throw new Error('ch3 page 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') {
    const el = document.createElement('div');
    el.className = 'wl ' + cls;
    labels.appendChild(el);
    const lb = { el, cls, t: null, o: -1, owner: null, uid: made.length };
    made.push(lb);
    return lb;
  }
  function setText(lb, s, html = false) {
    if (lb.t === s) return;
    lb.t = s;
    if (html) lb.el.innerHTML = s; else lb.el.textContent = s;
    lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls));
  }
  /* layout 이 놓는 이름표는 배치(mask)마다 기록해 두었다가 그 배치로 바꿀 때 다시 놓는다 */
  let rec = null;
  function place(lb, x, y, al = 'l', va = 't') {
    if (rec) rec.push([lb, x, y, al, va]);
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%';
    const tr = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`;
    if (lb.tr !== tr) { lb.el.style.transform = tr; lb.tr = tr; }
    lb.x = x; lb.y = y; lb.al = al; lb.va = va;
  }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const tok = label('stn-tok');

  const rnd = U.rng(31);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  const probe = document.createElement('canvas').getContext('2d');
  const tw = (t, f = `400 11px ${MONO}`) => { probe.font = f; return probe.measureText(t).width; };
  const glyphs = new Map();
  const glyph = (t) => { if (!glyphs.has(t)) glyphs.set(t, U.sampleText(t, `600 64px ${MONO}`, 0, 0, GLN, U.rng(t.charCodeAt(0) * 7 + t.length))); return glyphs.get(t); };

  const W = { F, N, R, label, setText, place, wrap, put, show, dust, jit, tw, glyph, deck, A: deck.ACTORS, MEAS: deck.MEASURED, css: {}, geo: {}, labels };
  /* 장면마다 그림판 — 짝은 둘 다 만든다 */
  const PN = {};
  for (const s of SCS) {
    const M = MS[s.num];
    PN[s.num] = specs[s.num].map((sp) => Object.assign(PANEL[sp.kind](W, M, sp), { kind: sp.kind }));
    for (const pn of PN[s.num]) for (const lb of pn.lbs || []) lb.owner = s.num;
  }
  /* 글 표 — 손잡이 값 · 스텝마다 [글, 또렷한가, 색, 보이나, html] */
  const TX = {};
  for (const s of SCS) {
    const M = MS[s.num];
    TX[s.num] = new Map([...M.B].map(([k, b]) => [k, b.S.map((st) => { const T = new Map(); for (const pn of PN[s.num]) pn.texts(st, T); return T; })]));
  }
  const TXALL = Object.values(TX).flatMap((m) => [...m.values()].flat());
  /* 모든 스텝의 글로 재서 가장 큰 것 — 이름표 자리는 이 크기로 비운다. 잰 뒤 글을 되돌린다 */
  const mostC = new Map(), wC = new Map();
  /* 줄 폭(maxWidth)마다 따로 — 글 블록은 열 수를 바꿔 가며 잰다 */
  W.most = (lb) => {
    const mk = lb.uid + '|' + lb.el.style.maxWidth;
    if (mostC.has(mk)) return mostC.get(mk);
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const t of TXALL) {
      const e = t.get(lb);
      if (!e || e[3] === false) continue;
      if (e[4]) lb.el.innerHTML = e[0]; else lb.el.textContent = e[0];
      const r = lb.el.getBoundingClientRect();
      w = Math.max(w, r.width); h = Math.max(h, r.height);
    }
    lb.el.innerHTML = keep;
    const out = { w, h };
    mostC.set(mk, out);
    return out;
  };
  /* 그 이름표의 글 하나를 재서 폭 — 스텝마다 자리를 정할 때 */
  W.wOf = (lb, e) => {
    if (!e || e[3] === false || !e[0]) return 0;
    const ck = lb.uid + '\u0000' + lb.el.style.maxWidth + '\u0000' + e[0];
    if (wC.has(ck)) return wC.get(ck);
    const keep = lb.el.innerHTML;
    if (e[4]) lb.el.innerHTML = e[0]; else lb.el.textContent = e[0];
    const w = lb.el.getBoundingClientRect().width;
    lb.el.innerHTML = keep;
    wC.set(ck, w);
    return w;
  };
  W.TX = TX;

  /* ── 자리 ──
     배치(mask) = 이 스텝에 그리는 그림판의 집합. 다 들어가면 배치는 하나(모든 스텝이 같다). 안 들어가면
       ① 덧붙인 실측 그림(hexdump — 무대에 없던 것)을 빼고, 그래도 안 되면
       ② 스텝마다 그 스텝 · 앞 스텝이 건드린 배우의 그림판만(글 블록과, 그림판이 기대는 원천은 늘) — 무대의 초점 배치와 같은 규칙.
     틈(k)과 늘일 수 있는 것(z : page 격자 · 칸 높이)은 모든 배치에 같은 값을 쓴다 — 스텝마다 크기가 흔들리지 않게 */
  let G = null;
  const LAYS = {}, MASK = {};
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0;
    G = { L, ww, wh };
    W.L = L;
    for (const s of SCS) {
      const P = PN[s.num], M = MS[s.num];
      const lay = (vis, y0, k, z) => {
        let y = y0, first = true;
        const out = [];
        for (let i = 0; i < P.length; i++) {
          if (!vis.has(i)) continue;
          y += first ? 0 : 14 + 10 * k; first = false;
          rec = [];
          const h = P[i].layout(L.x0, y, ww, k, z, s.num);
          out[i] = { g: P[i].snap(), fixed: rec, y };
          rec = null;
          y += h;
        }
        return { h: y - y0, out };
      };
      const fit = (masks) => {
        const ok = (k, z) => masks.every((v) => lay(v, L.y0, k, z).h <= wh);
        if (ok(1, 1)) return { k: 1, z: 1, ok: true };
        for (let z = 1; z > 0.19; z -= 0.04) if (ok(0.15, z)) return { k: 0.15, z, ok: true };
        return { k: 0.15, z: 0.2, ok: false };
      };
      const idx = [...P.keys()], all = new Set(idx), keep = new Set(idx.filter((i) => !P[i].optional));
      const always = new Set(idx.filter((i) => P[i].acts.every((a) => M.A[a] && M.A[a].kind === 'kv') && !P[i].optional && idx.length > 1 && i === 0));
      /* 스텝 → 배치 */
      const maskOf = (st) => {
        const tch = st.touch;
        const v = new Set([...always].filter((i) => P[i].acts.some((a) => tch.has(a))));
        idx.forEach((i) => { if (keep.has(i) && P[i].acts.some((a) => tch.has(a))) v.add(i); });
        for (const i of [...v]) for (const a of P[i].needs || []) idx.forEach((j) => { if (keep.has(j) && P[j].acts.includes(a)) v.add(j); });
        if (!v.size) idx.forEach((i) => { if (keep.has(i)) v.add(i); });
        return v;
      };
      const per = new Map();
      let masks, plan = fit([all]);
      if (plan.ok) masks = [all];
      else { plan = fit([keep]); if (plan.ok) masks = [keep]; }
      if (!masks) {
        const seen = new Map();
        for (const [, b] of M.B) b.S.forEach((st) => { const v = maskOf(st), key2 = [...v].sort((p, q) => p - q).join(','); seen.set(key2, v); per.set(st, key2); });
        masks = [...seen.values()];
        plan = fit(masks);
        if (!plan.ok) console.error(`ch3 ${s.num} 세계 : 초점 배치로도 무대 ${Math.round(wh)} 에 들어가지 않는다 (${L.W}×${L.H})`);
      }
      const L2 = new Map();
      for (const v of masks) {
        const key2 = [...v].sort((p, q) => p - q).join(','), h = lay(v, L.y0, plan.k, plan.z).h;
        if (h > wh + 1) console.error(`ch3 ${s.num} 세계 : 높이 ${Math.round(h)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
        const dy = L.narrow ? 0 : Math.max(0, (wh - h) / 2);
        L2.set(key2, { vis: v, ...lay(v, L.y0 + dy, plan.k, plan.z) });
      }
      LAYS[s.num] = L2;
      const one = masks.length === 1 ? [...L2.keys()][0] : null;
      MASK[s.num] = (st) => one || per.get(st) || [...L2.keys()][0];
    }
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    applied = null;
    shown = -2;
  }
  let applied = null;
  /* 배치를 쓴다 — 그림판의 자리(snap)를 되돌리고, 이름표까지면 layout 이 놓았던 자리로 */
  function applyMask(key2, labelsToo) {
    const Lm = LAYS[num].get(key2);
    if (!Lm) return;
    if (applied === key2 && !labelsToo) return;
    PN[num].forEach((pn, i) => {
      const e = Lm.out[i];
      if (e) { pn.use(e.g); setOff(pn, false); if (labelsToo) for (const f of e.fixed) place(...f); }
      else setOff(pn, true);
    });
    applied = labelsToo ? null : key2;
  }
  const maskAt = (k) => { const b = curB(); return MASK[num](b.S[Math.min(k, b.NK - 1)]); };

  const curM = () => MS[num];
  const curB = () => { const M = curM(); return M.B.get(vary) || M.B.get(null); };
  let vary = null;

  function setOff(pn, off) { pn.off = off; for (const lb of pn.lbs || []) lb.off = off; }
  /* act 의 두 끝 — 그림판이 그 배우를 그리면 그 자리, 아니면 그 배우의 머리 이름표 */
  function anchor(a, s, lb) {
    for (const pn of PN[num]) { if (pn.off) continue; const P = pn.anchor && pn.anchor(a, s, lb); if (P) return P; }
    return [G.L.x0 + 20, G.L.y0 + 10];
  }

  /* ── 자세 ── */
  function pose(k, p, t, o) {
    if (!G) return;
    const { S, S0, NK } = curB(), end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    applyMask(maskAt(kk), false);
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = 0; i < R.DST[0]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.045 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const src = act ? anchor(act.f, s, act.lb) : null;
    const P = { o, p, t, s, prev, end, form, dim, act, fly, mv: show(p, 0.12, 0.42), into, src, k: kk,
      level: (a, hot) => (s.touch.has(a) && !end ? (hot ? 1 : 0.78) : 0.58) * dim };
    for (const pn of PN[num]) if (!pn.off) pn.pose(s, P);
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
        put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, Math.max(G.L.y0 + 4, U.lerp(fy, ty2, e) + Math.sin(th) * r - arc), (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, act.gold ? GOLD : ACCENT);
      }
    }
  }

  /* ── 글 ── */
  let shown = -2, shownN = '', tokO = -1, tokW = 0, swapT = -1e9;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = curB(), T0 = TX[num].get(vary) || TX[num].get(null);
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = T0[Math.min(k, NK - 1)], TB = T0[Math.min(next, NK - 1)], T = T0[kk];
    applyMask(maskAt(kk), false);
    if (kk !== shown || shownN !== num + '|' + vary) {
      shown = kk; shownN = num + '|' + vary;
      applyMask(maskAt(kk), true);
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
      }
      for (const pn of PN[num]) if (!pn.off) pn.place(S[kk]);
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    /* 배치가 바뀌는 스텝 사이 — 자리가 달라지는 그림판의 이름표는 흐려졌다가 새 자리에서 */
    const mA = LAYS[num].get(maskAt(Math.min(k, NK - 1))), mB = LAYS[num].get(maskAt(Math.min(next, NK - 1)));
    PN[num].forEach((pn, i) => { const a2 = mA && mA.out[i], b2 = mB && mB.out[i], mv = mA !== mB && (!a2 || !b2 || a2.y !== b2.y); for (const lb of pn.lbs || []) lb.moves = mv; });
    /* 짝을 바꾼 직후 0.35 초 동안 새 장면의 이름표가 떠오른다 */
    const sw = U.smooth(U.clamp((performance.now() - swapT) / 350));
    for (const lb of made) {
      if (lb === tok) continue;
      if (lb.owner !== num) { setO(lb, 0); continue; }
      const e = T.get(lb);
      if (!e) { setO(lb, 0); continue; }
      const [txt, emph, , vis = true] = e, a = TA.get(lb), c = TB.get(lb);
      const same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true) && !lb.moves;
      setO(lb, vis && txt !== '' ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) * sw * (lb.hide || lb.off ? 0 : 1) : 0);
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

  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = curB(), kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, sw = U.smooth(U.clamp((performance.now() - swapT) / 350));
    const O = { o: (end ? 0.25 : 1) * form * sw, s, p: kk === k ? p : 0, end, css: W.css, fade: Math.abs(1 - 2 * b) };
    applyMask(maskAt(kk), false);
    const mA = LAYS[num].get(maskAt(Math.min(k, NK - 1))), mB = LAYS[num].get(maskAt(Math.min(next, NK - 1)));
    ctx.save(); ctx.lineWidth = 1;
    PN[num].forEach((pn, i) => {
      if (!pn.draw || pn.off) return;
      const a2 = mA && mA.out[i], b2 = mB && mB.out[i], mv = mA !== mB && (!a2 || !b2 || a2.y !== b2.y);
      ctx.save(); pn.draw(ctx, s, mv ? { ...O, o: O.o * O.fade } : O); ctx.restore();
    });
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n2) => cs.getPropertyValue(n2).trim();
      W.css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green'), body: v('--body'), line: v('--line') };
    },
    setVary(v) { const M = curM(), k2 = M.keyOf(v); if (M.B.has(k2) && k2 !== vary) { vary = k2; shown = -2; } else if (v == null && vary != null) { vary = null; shown = -2; } },
    setScene(n2) { if (MS[n2] && n2 !== num) { num = n2; shown = -2; applied = null; swapT = performance.now(); } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); for (const pn of Object.values(PN).flat()) if (pn.dispose) pn.dispose(); },
  };
}

/* ═════════════════════════════════════════ 그림판 ═════════════════════════════════════════ */
const touchOf = (s, a) => s.touch.has(a);
const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : s.look[a] === true; };
/* act 이름이 그 칸을 대는가 — '헤더 38바이트를 읽는다' 는 'FIL 헤더' 를 짚는다 */
const actNames = (s, a, id) => { const t = s.step.act; return !!t && (t.f === a || t.t === a) && String(id).split(/\s+/).some((w) => w.length >= 2 && !/^[0-9]+B?$/.test(w) && t.lb.includes(w)); };
const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${val(x.sub)}`).join('\n');
function rim(cx, cy, w, h, n, m) {
  const per = 2 * (w + h), d = (m / n) * per;
  if (d < w) return [cx - w / 2 + d, cy - h / 2];
  if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)];
  if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2];
  return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)];
}
const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
function arrowHead(ctx, x, y, ang, s = 4) {
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(ang - 0.45) * s, y - Math.sin(ang - 0.45) * s); ctx.lineTo(x, y); ctx.lineTo(x - Math.cos(ang + 0.45) * s, y - Math.sin(ang + 0.45) * s);
  ctx.stroke();
}
/* 그 배우의 머리 이름표(배우 이름) — 그림판 위 왼쪽 */
function heads(W, as) { return Object.fromEntries(as.map((a) => [a, W.label('aq')])); }
/* stagger 의 줄 수를 모든 스텝에서 가장 큰 것으로 — 스텝마다 높이가 흔들리지 않게 */
function rowsOf(W, list, x0, x1, gap = 6) {
  return stagger(list.filter((q) => q.w > 0), x0, x1, gap);
}

const PANEL = {};
/* bit 칸 하나 — 1 은 채운 칸(알갱이 4 × 3), 0 은 테두리, 모르는 값은 흐린 테두리. BITN 알갱이를 쓴다 */
function bitCell(W, P, i0, x, y, w, h, one, lv, hot, col) {
  for (let m = 0; m < BITN; m++) {
    const i = i0 + m;
    let px, py;
    if (one) { px = x + ((m % 4) + 0.5) / 4 * w; py = y + (Math.floor(m / 4) + 0.5) / 3 * h; }
    else [px, py] = rim(x + w / 2, y + h / 2, w, h, BITN, m);
    const [xx, yy] = P.into(i, px, py);
    W.put(P.o, i, xx, yy, lv * (one ? 0.95 : one === 0 ? 0.5 : 0.62), hot && one ? 0.5 : 0, 0.02, one ? Math.max(1.3, Math.min(2.6, w / 5)) : 1, col);
  }
  return i0 + BITN;
}

/* ── kv 글 블록 — 머리 이름 + 한 줄에 'key  value' ── */
PANEL.text = (W, M, sp) => {
  const as = sp.as, hd = heads(W, as), tx = Object.fromEntries(as.map((a) => [a, W.label('aq ml aq-b')]));
  const lbs = [...Object.values(hd), ...Object.values(tx)];
  let geo = {};
  return {
    lbs, acts: as, snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) { for (const a of as) { T.set(hd[a], [M.A[a].nm, touchOf(s, a)]); T.set(tx[a], [kvHtml(s[a]), touchOf(s, a), '', true, true]); } },
    layout(x0, y, ww, k) {
      /* 열 수 — 블록 높이의 합이 가장 작은 것(열이 좁아 줄이 접히면 오히려 높아진다). 열 폭은 120px 이상 */
      const tryN = (n) => {
        const cw2 = (ww - (n - 1) * 18) / n;
        for (const a of as) { W.wrap(tx[a], cw2); W.most(tx[a]); }
        const rows2 = Math.ceil(as.length / n), rh2 = [];
        for (let r = 0; r < rows2; r++) rh2.push(Math.max(14, ...as.slice(r * n, r * n + n).map((a) => W.most(tx[a]).h)));
        return { n, cw: cw2, rows: rows2, rh: rh2, h: rh2.reduce((p, q) => p + q + HD, 0) };
      };
      let best = null;
      for (let n = Math.min(3, as.length); n >= 1; n--) { if (n > 1 && (ww - (n - 1) * 18) / n < 120) continue; const t = tryN(n); if (!best || t.h < best.h - 0.5) best = t; }
      const { n: tn, cw, rows, rh } = best;
      for (const a of as) { W.wrap(tx[a], cw); W.most(tx[a]); }
      let yy = y;
      geo = {};
      as.forEach((a, i) => {
        const r = Math.floor(i / tn), x = x0 + (i % tn) * (cw + 18), y1 = y + rh.slice(0, r).reduce((p, q) => p + q + HD + 10 * k, 0);
        geo[a] = { x, y: y1, w: cw };
        W.place(hd[a], x, y1); W.place(tx[a], x, y1 + HD);
        yy = Math.max(yy, y1 + HD + rh[r]);
      });
      return yy - y;
    },
    place() {},
    pose() {},
    anchor(a) { const g = geo[a]; return g ? [g.x + Math.min(g.w - 10, 110), g.y + 8] : null; },
  };
};

/* ── list 칸 줄 — 칸 안에 id, 아래에 'id sub' 를 모은 설명(무대의 목록과 같은 글) ── */
PANEL.chips = (W, M, sp) => {
  const a = sp.a, hd = W.label('aq'), II = ids(M, a);
  const cl = Object.fromEntries(II.map((id) => [id, W.label('aq aq-c')])), cap = W.label('aq ml aq-b');
  let g = null;
  /* 칸 자리 — 왼쪽부터 차례로, 넘치면 다음 줄. rtl 이면 오른쪽 끝부터(슬롯은 page 끝에서 거꾸로 자란다) */
  const slot = (s, id) => {
    if (!g) return null;
    let x = 0, row = 0;
    for (const it of s[a] || []) {
      const w = g.w[it.id];
      if (x + w > g.x1 - g.x0 + 0.5 && x > 0) { x = 0; row++; }
      if (it.id === id) return { x: sp.rtl ? g.x1 - x - w / 2 : g.x0 + x + w / 2, y: g.y + row * 32 + 13, w };
      x += w + 6;
    }
    return null;
  };
  return {
    lbs: [hd, cap, ...Object.values(cl)], acts: [a], snap: () => g, use: (q) => { g = q; },
    texts(s, T) {
      const on = touchOf(s, a);
      T.set(hd, [M.A[a].nm, on]);
      for (const id of II) { const it = s[a].find((x) => x.id === id); T.set(cl[id], [it ? id : '', on && !!it && hotIt(s, a, id), it ? TAGL[it.tag] || '' : '', !!it]); }
      T.set(cap, [capOf(s[a]) || (s[a].length ? '' : '—'), on, '', true, true]);
    },
    layout(x0, y, ww) {
      const w = Object.fromEntries(II.map((id) => [id, Math.max(32, Math.ceil(W.most(cl[id]).w) + 16)]));
      let rows = 1;
      for (const s of M.all) { let x = 0, r = 1; for (const it of s[a] || []) { if (x + w[it.id] > ww + 0.5 && x > 0) { x = 0; r++; } x += w[it.id] + 6; } rows = Math.max(rows, r); }
      g = { x0, x1: x0 + ww, y: y + HD, w, rows };
      W.place(hd, x0, y);
      if (sp.noCap) return HD + rows * 32;
      W.wrap(cap, ww);
      const ch = W.most(cap).h;
      g.capY = y + HD + rows * 32 + 2;
      W.place(cap, x0, g.capY);
      return HD + rows * 32 + 2 + ch;
    },
    place(s) { for (const it of s[a]) { const P = slot(s, it.id); if (P) W.place(cl[it.id], P.x, P.y, 'c', 'c'); } },
    pose(s, P) {
      for (const id of II) {
        const key = 'c:' + a + ':' + id, [r0, r1] = W.R[key], it = s[a].find((x) => x.id === id), pv = P.prev[a] && P.prev[a].find((x) => x.id === id);
        if (!it && !(pv && !P.end)) continue;
        const Q = it ? slot(s, id) : slot(P.prev, id);
        if (!Q) continue;
        const gone = it ? 0 : W.show(P.p, 0.1, 0.4), tg = (it || pv).tag, lv = P.level(a, it && hotIt(s, a, id)) * P.form;
        const born = it && !pv && !P.end && P.act && P.act.t === a;
        for (let m = 0; m < r1 - r0; m++) {
          const i = r0 + m;
          let [x, y] = rim(Q.x, Q.y, Q.w, 24, r1 - r0, m);
          if (born) { const q = W.show(P.fly, (m / (r1 - r0)) * 0.4, 0.6 + (m / (r1 - r0)) * 0.4); x = U.lerp(P.src[0], x, q); y = U.lerp(P.src[1], y, q) - Math.sin(q * Math.PI) * 16; }
          if (gone) { x += W.jit[i * 2] * 24 * gone; y += W.jit[i * 2 + 1] * 24 * gone; }
          const [xx, yy] = P.into(i, x, y);
          W.put(P.o, i, xx, yy, lv * (1 - gone) * (tg === 'free' ? 0.5 + 0.5 * (m % 2) : 1), it && hotIt(s, a, id) && touchOf(s, a) ? 0.35 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
        }
      }
    },
    slotAt: (s, id) => slot(s, id),
    cap,
    anchor(a2, s, lb) {
      if (a2 !== a || !g) return null;
      const id = II.find((x) => (lb || '').includes(x)) || [...modOf(s, a)][0] || (s[a][0] && s[a][0].id);
      const Q = id ? slot(s, id) : null;
      return Q ? [Q.x, Q.y] : [g.x0 + 30, g.y + 13];
    },
  };
};

/* ── 바이트 줄 — 칸 폭 ∝ 바이트. 줄 하나가 배우 하나 · 둘(원점 앞 + 원점 뒤)이다 ──
   원점이 있는 줄은 원점(ox)에 맞춰 앞 칸은 왼쪽으로, 뒤 칸은 오른쪽으로 놓는다. 음수 오프셋이 적힌 칸(rhd 의 −5 · −4 −3)은
   그 자리에, 오프셋이 없는 앞 칸(varlen · 널)은 그보다 왼쪽에 차례로(폭이 정해지지 않은 칸 — 점선).
   이름은 칸 위, 설명은 칸 아래(겹치면 줄을 바꾸고 지시선), 오프셋 눈금은 칸 바로 아래. 글자로 그릴 바이트(0x0006 · Leslie ·
   16진 sub)는 칸이 넉넉하면(바이트당 30px 이상) 01 장면처럼 칸 안에 알갱이 글자로 */
const TRUE_B = new Set(['fil', 'phd', 'rdx', 'cdx', 'rdat', 'rhd']);
PANEL.bytes = (W, M, sp) => {
  const rows = sp.rows.map((acts, r) => ({ r, acts, pre: acts.length > 1 ? acts[0] : null, post: acts.length > 1 ? acts[1] : null }));
  const RN = rows.length, SUBS0 = sp.subs || [];
  const zeroIn = (row, it) => row.r > 0 && row.post != null && !!it.c0;
  /* 줄마다 · 상태마다 칸 목록 — 같은 칸(배우 · id)은 같은 알갱이 */
  const cellsOf = (s, row) => {
    const out = [];
    if (row.pre) {
      const pre = s[row.pre] || [], real = pre.some((x) => !C.isPlace(x));
      for (const it of pre) if (!C.isMark(it)) out.push({ a: row.pre, it, side: -1 });
      /* COMPACT 줄의 데이터는 cdx 가 생긴 뒤에만 — 그 줄에서 NULL 칸은 0 B(02a 5 스텝의 c0). 두 줄이 rdat 하나를 함께 쓰므로
         0 B 는 sub 가 아니라 c0 로 적는다 — sub 를 바꾸면 REDUNDANT 줄의 '00 00 00 00' 까지 바뀌었다 */
      if (real || row.r === 0) for (const it of s[row.post] || []) if (!C.isMark(it)) out.push({ a: row.post, it, side: 1, zero: zeroIn(row, it) });
      return { cells: out, origin: true };
    }
    const its = s[row.acts[0]] || [], mi = its.findIndex(C.isMark);
    its.forEach((it, i) => { if (!C.isMark(it)) out.push({ a: row.acts[0], it, side: mi < 0 ? 0 : i < mi ? -1 : 1 }); });
    return { cells: out, origin: mi >= 0, mark: mi >= 0 ? its[mi] : null };
  };
  /* 칸의 바이트 자리(원점 기준 또는 왼쪽 기준) — 단위는 바이트.
     원점도 눈금도 없는 줄(02 · 03 · 07 의 값 · 셀)은 그림판 폭(모든 상태에서 가장 넓은 줄)의 가운데에 놓는다 — 왼쪽에
     붙였더니 짧은 스텝(02 의 1 – 3)에서 세계의 오른쪽 절반이 비었다 */
  let SPAN = null;
  const spanU = () => {
    if (SPAN != null) return SPAN;
    let lo = 0, hi = 0, tot = 0;
    for (const s of M.all) for (const row of rows) { const q = geomOf(s, row, true); if (q.origin) { lo = Math.min(lo, q.lo); hi = Math.max(hi, q.hi); } else tot = Math.max(tot, q.hi); }
    return (SPAN = Math.max(hi - lo, tot) || 1);
  };
  const centred = (row) => !sp.ruler && !SUBS0.length && !row.acts.some((a) => TRUE_B.has(a));
  const geomOf = (s, row, raw = false) => {
    const { cells, origin, mark } = cellsOf(s, row);
    const g = [];
    if (origin) {
      const pre = cells.filter((c) => c.side < 0), post = cells.filter((c) => c.side > 0);
      let lo = 0;
      const fixed = pre.map((c) => ({ c, n: C.negs(c.it.id + ' ' + c.it.sub) })).filter((x) => x.n.length);
      for (const { c, n } of fixed) { const a0 = Math.min(...n), a1 = Math.max(...n); g.push({ ...c, u0: a0, u1: a1 + 1, off: a0 }); lo = Math.min(lo, a0); }
      const seq = pre.filter((c) => !fixed.some((x) => x.c === c));
      /* 오프셋이 적힌 칸이 없으면 앞 칸 전부를 원점에 붙여 차례로. 있으면 그 왼쪽에 */
      for (let i = seq.length - 1; i >= 0; i--) { const u = unitsOf(seq[i].a, seq[i].it); g.push({ ...seq[i], u0: lo - u, u1: lo, var: fixed.length > 0 }); lo -= u; }
      let hi = 0;
      for (const c of post) { const u = c.zero ? 0 : unitsOf(c.a, c.it); g.push({ ...c, u0: hi, u1: hi + u }); hi += u; }
      /* 원점 표시(◆ · '← 원점')도 폭 0 의 칸으로 — 이름 · 설명이 원점 자리에 */
      const mk = mark || (row.pre ? (s[row.pre] || []).find(C.isMark) : null);
      if (mk) g.push({ a: row.pre || row.acts[0], it: mk, side: 0, u0: 0, u1: 0, mark: true });
      for (const c of g) c.org = true;
      return { g, lo, hi, origin, mark };
    }
    let x = 0;
    for (const c of cells) { const u = unitsOf(c.a, c.it); g.push({ ...c, u0: x, u1: x + u }); x += u; }
    const sh = !raw && centred(row) ? Math.max(0, (spanU() - x) / 2) : 0;
    if (sh) for (const c of g) { c.u0 += sh; c.u1 += sh; }
    return { g, lo: 0, hi: x + sh, origin: false, mark: null };
  };
  const ruler = (row) => sp.ruler || (row.pre || row.acts.some((a) => a === 'rhd') ? 'org' : null);
  /* 이름표 — 줄 · 배우 · id 마다 이름과 설명, 줄마다 눈금 */
  const L = { nm: new Map(), sb: new Map(), rl: [], hd: new Map(), cap: [] };
  const key = (r, a, id) => r + '|' + a + '|' + id;
  for (const row of rows) {
    for (const a of row.acts) {
      if (!L.hd.has(key(row.r, a, ''))) L.hd.set(key(row.r, a, ''), W.label('aq'));
      for (const id of keysOf(M, a)) { L.nm.set(key(row.r, a, id), W.label('aq')); L.sb.set(key(row.r, a, id), W.label('aq')); }
    }
    L.rl[row.r] = Array.from({ length: 16 }, () => W.label('aq'));
  }
  const capActs = [...new Set(rows.flatMap((r) => r.acts))].filter((a) => M.all.some((s) => s.byl[a]));
  const cap = Object.fromEntries(capActs.map((a) => [a, W.label('aq ml aq-b')]));
  /* 06a — PAGE header 의 앞 18 B 를 2 B 칸 아홉으로(fsp · fins). 칸 줄은 눈금, 목록은 아래 설명 */
  const SUBS = sp.subs || [];
  const subCap = Object.fromEntries(SUBS.map((a) => [a, { hd: W.label('aq'), tx: W.label('aq ml aq-b') }]));
  const twoOf = (s) => SUBS.flatMap((a) => (s[a] || []).map((it) => ({ a, it, o: C.lead(it.id) }))).filter((x) => x.o != null).sort((p, q) => p.o - q.o);
  const lbs = [...L.nm.values(), ...L.sb.values(), ...L.rl.flat(), ...L.hd.values(), ...Object.values(cap), ...Object.values(subCap).flatMap((x) => [x.hd, x.tx])];

  const lead = (a, s) => s.byl[a];
  let geo = null;
  /* 짚는 칸 — 그 배우에 금빛 칸이 있으면 금빛 칸(04a 의 '← 지금'), 없으면 look · 바뀐 칸, act 이름이 대는 칸 */
  const isHot = (s, a, it) => {
    if (!touchOf(s, a)) return false;
    if ((s[a] || []).some((x) => x.tag === 'gold') && TRUE_B.has(a)) return it.tag === 'gold' || it.tag === 'red';
    return hotIt(s, a, it.id) || actNames(s, a, it.id) || it.tag === 'gold' || it.tag === 'red';
  };
  const cellX = (row, c) => { const b = c.org ? geo.ox : geo.left; return [b + c.u0 * geo.px, b + c.u1 * geo.px]; };
  const reg = () => { for (const row of rows) for (const a of row.acts) W.geo[a] = { geo, row, cells: (s2) => geomOf(s2, row).g.map((c) => ({ ...c, x: cellX(row, c) })) }; };
  return {
    lbs, acts: [...new Set(rows.flatMap((r) => r.acts)), ...SUBS], snap: () => geo, use: (g) => { geo = g; reg(); },
    texts(s, T) {
      for (const row of rows) {
        const { g } = geomOf(s, row), here = new Set(g.map((c) => c.a + '|' + c.it.k));
        for (const a of row.acts) {
          const on = touchOf(s, a);
          /* 배우 이름 — 02a 의 원점 뒤(rdat)는 첫 줄에만 */
          T.set(L.hd.get(key(row.r, a, '')), [row.r > 0 && a === row.post ? '' : M.A[a].nm, on, '', !(row.r > 0 && a === row.post)]);
          for (const id of keysOf(M, a)) {
            const it = (s[a] || []).find((x) => x.k === id), vis = !!it && here.has(a + '|' + id);
            const hot = vis && isHot(s, a, it), cls = it ? TAGL[it.tag] || (hot && it.tag !== 'free' ? 'gold' : '') : '';
            /* 칸 안에 id 를 글자로 그리면(0x0006 · L e s l i e) 위 이름표는 겹말이다 — 크게 그릴 때만 숨긴다 */
            const glyphName = sp.glyph && it && tokSrc(it) === 'id';
            /* 0 B 칸(COMPACT 줄의 NULL)은 이름 첫 낱말과 '0 B' 만 — 이름 전체를 두면 옆 칸 이름과 붙어 읽혔다 */
            const z = !!it && a === row.post && zeroIn(row, it);
            T.set(L.nm.get(key(row.r, a, id)), [vis && !z ? it.id : '', hot || (on && !focusOf(s, a)), z ? '' : cls, vis && !glyphName && !z]);
            const onlyOff = sp.ruler && it && /^\+?\d+$/.test(bare(it.sub).trim());
            const sb = !it ? '' : z ? it.id.split(/\s+/)[0] + ' · 0 B' : it.sub;
            T.set(L.sb.get(key(row.r, a, id)), [vis && sb ? sb : '', hot || (on && !focusOf(s, a)), '', vis && !!sb && !onlyOff]);
          }
        }
        /* 눈금 — 칸 경계의 오프셋 */
        const marks = this.marks(s, row);
        L.rl[row.r].forEach((lb, j) => T.set(lb, [marks[j] ? marks[j].t : '', false, '', !!marks[j]]));
      }
      for (const a of capActs) { const b = lead(a, s); T.set(cap[a], [b ? `${esc(b.l || '')}${b.r ? '  ·  ' + esc(b.r) : ''}` : '', touchOf(s, a), '', !!b, true]); }
      for (const a of SUBS) { T.set(subCap[a].hd, [M.A[a].nm, touchOf(s, a)]); T.set(subCap[a].tx, [capOf(s[a]), touchOf(s, a), '', true, true]); }
    },
    /* 눈금 자리 — fil 은 0 · 4 · 8 …(절대), phd 는 +0 · +18 …, 원점 줄은 −12 … 0 … +30 */
    marks(s, row) {
      const mode = ruler(row);
      if (!mode) return [];
      const { g, origin } = geomOf(s, row), out = [], seen = new Set();
      const add = (u, t) => { if (seen.has(u)) return; seen.add(u); out.push({ u, t }); };
      if (mode === 'abs') { for (const c of g) add(c.u0, String(C.lead(c.it.sub) ?? c.u0)); const e = g[g.length - 1]; if (e) add(e.u1, String((C.lead(e.it.sub) ?? e.u0) + (e.u1 - e.u0))); }
      else if (mode === 'rel') { for (const c of g) add(c.u0, '+' + (C.lead(c.it.sub) ?? c.u0)); const e = g[g.length - 1]; if (e) add(e.u1, '+' + ((C.lead(e.it.sub) ?? e.u0) + (e.u1 - e.u0))); }
      else if (origin) {
        const lab = (u) => (u > 0 ? '+' + u : u < 0 ? '−' + -u : '0'), real = g.filter((c) => !c.var && !C.isPlace(c.it) && !c.mark);
        const lo2 = Math.min(0, ...real.map((c) => c.u0));
        add(lo2, lab(lo2)); add(0, '0');
        for (const c of real) { if (c.side < 0 && c.u1 - c.u0 >= 2) { add(c.u0, lab(c.u0)); } if (c.side < 0 && C.negs(c.it.id + ' ' + c.it.sub).length) add(c.u0, lab(c.u0)); if (c.side > 0) add(c.u1, lab(c.u1)); }
      }
      return out.sort((p, q) => p.u - q.u).slice(0, 16);
    },
    layout(x0, y, ww, k, z) {
      /* 바이트 폭 — 모든 상태에서 원점 앞 · 뒤의 가장 큰 것 */
      let lo = 0, hi = 0, tot = 0;
      for (const s of M.all) for (const row of rows) { const q = geomOf(s, row); if (q.origin) { lo = Math.min(lo, q.lo); hi = Math.max(hi, q.hi); } else tot = Math.max(tot, q.hi); }
      const span = Math.max(hi - lo, tot) || 1, glyphy = !!sp.glyph;
      const cap0 = glyphy ? 74 : 80;
      const px = Math.min(cap0 * z, (ww - 8) / span);
      const used = span * px, left = x0 + Math.max(0, (ww - used) / 2);
      const ox = tot > hi - lo ? left : left - lo * px;
      const big = glyphy;
      const BH = big ? Math.min(px * 0.95, 70) : Math.round(16 + 10 * z);
      geo = { x0, ww, px, ox, left, BH, big, rows: [], per: new Map() };
      reg();
      /* 줄마다 — 이름 줄 수 · 설명 줄 수를 모든 상태에서 재서 가장 많은 것 */
      let yy = y;
      const capDone = new Set();
      for (const row of rows) {
        let nr = 0, vr = 0, rr = 0;
        for (const [bk, b] of M.B) b.S.forEach((s, si) => {
          const T = W.TX[M.sc.num].get(bk)[si], { g } = geomOf(s, row);
          const xs = (c) => { const [a0, a1] = cellX(row, c); return (a0 + a1) / 2; };
          const NM = rowsOf(W, g.map((c) => ({ c, cx: xs(c), w: W.wOf(L.nm.get(key(row.r, c.a, c.it.k)), T.get(L.nm.get(key(row.r, c.a, c.it.k)))) })), x0, x0 + ww);
          /* 설명 줄은 이름보다 틈을 넓게 — 6 px 이면 '길이 a' 와 헤더 바이트가 한 문장처럼 붙어 읽혔다(02a COMPACT) */
          const VL = rowsOf(W, g.map((c) => ({ c, cx: xs(c), w: W.wOf(L.sb.get(key(row.r, c.a, c.it.k)), T.get(L.sb.get(key(row.r, c.a, c.it.k)))) })), x0, x0 + ww, 12);
          const mk = this.marks(s, row);
          const RL = rowsOf(W, mk.map((m, j) => ({ j, cx: geo.ox + m.u * px, w: W.tw(m.t) + 2 })), x0, x0 + ww, 3);
          nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows); rr = Math.max(rr, RL.rows);
          geo.per.set(s, { ...(geo.per.get(s) || {}), ['r' + row.r]: { NM: NM.out, VL: VL.out, RL: RL.out } });
        });
        const arcs = sp.arcs && row.acts[0] === sp.arcs ? 8 + 6 * 6 : 0;
        /* 그 배우의 띠 설명(byl)은 머리 이름 바로 아래 — 원점 앞 배우는 왼쪽, 뒤 배우는 원점 오른쪽. 띠 아래에 두었더니
           03a · 07a 에서 바이트 → bit 확대 선이 그 글을 지나갔다 */
        let ch = 0;
        for (const a of row.acts.filter((q) => cap[q] && !capDone.has(q))) {
          capDone.add(a);
          const right = a === row.post, cx = right ? Math.min(x0 + ww - 120, ox + 6) : x0, cw = right ? x0 + ww - cx : row.post ? Math.max(120, ox - x0 - 10) : ww;
          W.wrap(cap[a], cw); W.place(cap[a], cx, yy + HD - 2);
          ch = Math.max(ch, W.most(cap[a]).h);
        }
        const top = yy + HD + (ch ? ch + 2 : 0);
        const ry = { hd: yy, nm: top, arc: top + nr * RH };
        ry.band = ry.arc + arcs + 3;
        ry.rl = ry.band + geo.BH + 4;
        ry.sb = ry.rl + (rr ? rr * 13 + 3 : 0);
        ry.end = ry.sb + vr * RH;
        geo.rows[row.r] = { ...ry, nr, vr, rr, arcs };
        yy = ry.end + 6 * k + 4;
      }
      /* 2 B 칸 설명(06a) — 두 열 */
      if (SUBS.length) {
        const cw = (ww - 18 * (SUBS.length - 1)) / SUBS.length;
        SUBS.forEach((a, i) => { W.wrap(subCap[a].tx, cw); W.place(subCap[a].hd, x0 + i * (cw + 18), yy); W.place(subCap[a].tx, x0 + i * (cw + 18), yy + HD); });
        yy += HD + Math.max(...SUBS.map((a) => W.most(subCap[a].tx).h)) + 6 * k + 4;
      }
      geo.y1 = yy;
      return yy - y;
    },
    place(s) {
      const per = geo.per.get(s);
      if (!per) return;
      for (const row of rows) {
        const q = per['r' + row.r], ry = geo.rows[row.r];
        /* 배우 이름 — 앞 배우는 왼쪽, 뒤 배우는 원점 오른쪽 */
        for (const a of row.acts) {
          const lb = L.hd.get(key(row.r, a, ''));
          if (a === row.post) W.place(lb, Math.min(geo.x0 + geo.ww - W.most(lb).w, geo.ox + 6), ry.hd);
          else W.place(lb, geo.x0, ry.hd);
        }
        for (const it of q.NM) W.place(L.nm.get(key(row.r, it.c.a, it.c.it.k)), it.l, ry.nm + (ry.nr - 1 - it.row) * RH);
        for (const it of q.VL) W.place(L.sb.get(key(row.r, it.c.a, it.c.it.k)), it.l, ry.sb + it.row * RH);
        for (const it of q.RL) W.place(L.rl[row.r][it.j], it.l, ry.rl + it.row * 13);
      }
    },
    pose(s, P) {
      const pv = P.prev;
      /* 한 상태의 칸 둘이 한 알갱이 구역을 나눠 쓰면 뒤 칸이 앞 칸을 지운다(03 의 두 0x01, 02a 의 두 줄에 나오는 rdat) */
      const took = new Set();
      for (const row of rows) for (const c of geomOf(s, row).g) if (!c.mark) {
        const kk = bkey(row.r, c.a, c.it);
        if (took.has(kk)) once(`ch3 ${M.sc.num} 세계 : ${c.a} 의 칸 ${c.it.id} 가 다른 칸과 알갱이 구역 ${kk} 를 나눠 쓴다`);
        took.add(kk);
      }
      for (const row of rows) {
        const ry = geo.rows[row.r], { g } = geomOf(s, row), q0 = geomOf(pv, row), H = geo.BH;
        for (const c of g) {
          const kk = bkey(row.r, c.a, c.it), [r0, r1] = W.R[kk], n = r1 - r0;
          const [a0, a1] = cellX(row, c), was = q0.g.find((x) => x.a === c.a && x.it.k === c.it.k);
          const [b0, b1] = was ? cellX(row, was) : [a0, a1];
          const x0 = U.lerp(b0, a0, P.mv), x1 = U.lerp(b1, a1, P.mv), w = Math.max(0, x1 - x0);
          const hot = isHot(s, c.a, c.it), col = hot && c.it.tag !== 'red' ? GOLD : TAGC[c.it.tag] ?? INK, lv = P.level(c.a, hot) * P.form;
          const born = !was && !P.end && P.act && (P.act.t === c.a || P.act.t === row.acts[0]), from = born ? P.src : null;
          if (c.mark) continue;
          const free = c.it.tag === 'free' || c.var, bytes = Math.round(c.u1 - c.u0), per = TRUE_B.has(c.a) && geo.px >= 7 && bytes > 0 && bytes <= 40 && !geo.big && !C.isPlace(c.it);
          const toks = sp.glyph && geo.big ? tokensOf(c.it) : [];
          for (let m = 0; m < n; m++) {
            const i = r0 + m;
            if (w < 0.5 || (row.r > 0 && c.zero)) { W.put(P.o, i, x0, ry.band + H / 2, 0, 0, 0.5, 1, FAINT); continue; }
            let x, y;
            const f = m / n;
            if (per) {
              /* 바이트마다 작은 칸 — 칸 수를 셀 수 있게 */
              const bw = w / bytes, b = Math.min(bytes - 1, Math.floor(f * bytes)), mm = m - Math.floor((b * n) / bytes), nb = Math.max(1, Math.floor(((b + 1) * n) / bytes) - Math.floor((b * n) / bytes));
              [x, y] = rim(x0 + b * bw + bw / 2, ry.band + H / 2, Math.max(1, bw - 2.5), H - 2, nb, mm);
            } else if (C.isPlace(c.it)) [x, y] = rim(x0 + w / 2, ry.band + H / 2, Math.min(w - 2, 26), Math.min(H, 18), n, m);
            else [x, y] = rim(x0 + w / 2, ry.band + H / 2, Math.max(1, w - 2), H, n, m);
            if (from) { const qq = W.show(P.fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + W.jit[i * 2] * 10, x, qq); y = U.lerp(from[1] + W.jit[i * 2 + 1] * 10, y, qq) - Math.sin(qq * Math.PI) * 16; }
            const [xx, yy] = P.into(i, x, y);
            W.put(P.o, i, xx, yy, lv * (free ? 0.3 + 0.4 * (m % 2) : toks.length ? 0.6 : 0.9), hot ? 0.45 : 0, 0.03, toks.length ? 1 : 1.15, free ? FAINT : col);
          }
          /* 칸 안의 글자 바이트 */
          toks.forEach((t, j) => {
            const kk2 = kk.replace(/^b:/, 'g:') + ':' + j;
            if (!W.R[kk2]) return;
            const [g0, g1] = W.R[kk2], pts = W.glyph(t), bw = w / Math.max(1, toks.length), sc = Math.min(bw * 0.5, H * 0.62) / 64, cx = x0 + bw * (j + 0.5), cy = ry.band + H / 2;
            for (let m = 0; m < g1 - g0; m++) {
              const i = g0 + m;
              let x = cx + pts[m * 2] * sc, y = cy + pts[m * 2 + 1] * sc;
              if (from) { const qq = W.show(P.fly, 0.1, 0.9); x = U.lerp(from[0], x, qq); y = U.lerp(from[1], y, qq); }
              const [xx, yy] = P.into(i, x, y);
              W.put(P.o, i, xx, yy, Math.min(1, lv * 1.1), hot ? 0.7 : 0.15, 0.2, 1.3, hot ? GOLD : col === FAINT ? INK : col);
            }
          });
        }
        /* 원점 — 세로 점선 */
        const mk = row.pre ? (s[row.pre] || []).find(C.isMark) : (s[row.acts[0]] || []).find(C.isMark);
        const mkA = row.pre || row.acts[0];
        if (mk && W.R[bkey(row.r, mkA, mk)]) {
          const [m0, m1] = W.R[bkey(row.r, mkA, mk)], hot = isHot(s, mkA, mk);
          for (let m = 0; m < m1 - m0; m++) {
            const i = m0 + m, u = m / (m1 - m0), [xx, yy] = P.into(i, geo.ox, ry.band - 6 + u * (geo.BH + 12));
            W.put(P.o, i, xx, yy, P.level(mkA, hot) * P.form * (m % 3 === 2 ? 0 : 0.9), hot ? 0.6 : 0.2, 0.02, 1.3, hot ? GOLD : ACCENT);
          }
        }
      }
    },
    draw(ctx, s, O) {
      const per = geo.per.get(s);
      if (!per) return;
      for (const row of rows) {
        const ry = geo.rows[row.r], q = per['r' + row.r], { g } = geomOf(s, row);
        /* 이름 · 설명이 칸에서 비켜 놓였으면 지시선 */
        ctx.globalAlpha = 0.35 * O.o; ctx.strokeStyle = O.css.faint; ctx.setLineDash([]);
        for (const it of q.NM) { const ly = ry.nm + (ry.nr - 1 - it.row) * RH + RH - 2; if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, ly, it.cx, ry.band - 1); }
        for (const it of q.VL) { const ly = ry.sb + it.row * RH + 1; if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, ry.band + geo.BH + 1, it.cx, ly); }
        /* 눈금 — 칸 경계의 짧은 선 */
        ctx.globalAlpha = 0.55 * O.o;
        for (const it of q.RL) { const m = this.marks(s, row)[it.j]; if (!m) continue; const x = geo.ox + m.u * geo.px; seg(ctx, x, ry.band + geo.BH, x, ry.rl + it.row * 13); }
        /* 06a 의 2 B 칸 경계 */
        if (SUBS.length) { ctx.globalAlpha = 0.4 * O.o; for (const x of twoOf(s)) if (x.o > 0) { const X = geo.ox + x.o * geo.px; seg(ctx, X, ry.band + 3, X, ry.band + geo.BH - 3); } }
        /* 02a — REDUNDANT 의 끝 오프셋 바이트에서 그 오프셋의 데이터 자리로 */
        if (ry.arcs) {
          const offs = g.filter((c) => c.side < 0 && /^[0-9a-f]{2}$/i.test(c.it.id));
          const hot = touchOf(s, row.acts[0]);
          offs.forEach((c, j) => {
            const n = C.nums(c.it.sub).slice(-1)[0];
            if (n == null) return;
            /* 가장 먼 끝(1e → +30)이 맨 위 — 짧은 호가 안쪽에 들어가 서로 가로지르지 않는다 */
            const [a0, a1] = cellX(row, c), xa = (a0 + a1) / 2, xb = geo.ox + n * geo.px, top = ry.arc + 4 + (offs.length - 1 - j) * 6, base = ry.band - 1;
            ctx.globalAlpha = (hot ? 0.75 : 0.35) * O.o; ctx.strokeStyle = /NULL/.test(c.it.sub) || c.it.tag === 'red' ? O.css.red : hot ? O.css.gold : O.css.faint;
            ctx.beginPath(); ctx.moveTo(xa, base); ctx.lineTo(xa, top); ctx.lineTo(xb, top); ctx.lineTo(xb, base); ctx.stroke();
            arrowHead(ctx, xb, base, Math.PI / 2, 3.5);
          });
        }
      }
    },
    anchor(a, s) {
      if (!geo) return null;
      for (const row of rows) if (row.acts.includes(a)) {
        const { g } = geomOf(s, row), hot = g.filter((c) => c.a === a && isHot(s, a, c.it)), list = hot.length ? hot : g.filter((c) => c.a === a);
        if (!list.length) return [geo.ox, geo.rows[row.r].band + geo.BH / 2];
        const xs = list.flatMap((c) => cellX(row, c));
        return [(Math.min(...xs) + Math.max(...xs)) / 2, geo.rows[row.r].band + geo.BH / 2];
      }
      return null;
    },
  };
};

/* ── 레코드 헤더의 bit 줄(03a · 07a) — 원점 앞 5 · 6 B 를 bit 로 펼친다. 칸 순서는 rec.h 의 배치(ch3-check 의 HB_ORDER).
   바이트를 아는 스텝(03a 의 실측 01 00 02 00 31 …)은 1 bit 를 채운 칸, 0 을 빈 칸으로. 칸마다 아래에 이름과 푼 값 ── */
PANEL.bits = (W, M, sp) => {
  const a = sp.a, src = sp.src, WD = C.bitWidths(M.all, a), II = ids(M, a);
  const hd = W.label('aq'), fl = Object.fromEntries(II.map((id) => [id, W.label('aq')])), cap = W.label('aq ml aq-b');
  const byl = Array.from({ length: 6 }, () => W.label('aq'));
  const lbs = [hd, cap, ...Object.values(fl), ...byl];
  const bytesOf = (s) => (s[src] || []).filter((x) => !C.isMark(x) && C.negs(x.id + ' ' + x.sub).length).flatMap((x) => C.hexBytes(x.sub) || []);
  const offsOf = (s) => [...new Set((s[src] || []).flatMap((x) => C.negs(x.id + ' ' + x.sub)))].sort((p, q) => p - q);
  const decode = (s) => {
    const { fields, bits } = C.headerBits(s[a] || [], WD), hb = bytesOf(s), known = hb.length * 8 === bits && bits > 0;
    return { fields: fields.map((f) => { let v = known ? C.fieldVal(hb, f.at, f.w) : null; if (v != null && f.w === 16 && v >= 0x8000) v -= 0x10000; return { ...f, v }; }), bits, hb, known };
  };
  let geo = null;
  const bitX = (b) => geo.x0 + b * geo.bw + Math.floor(b / 8) * geo.gap;
  return {
    lbs, acts: [a], needs: [src], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const on = touchOf(s, a), { fields } = decode(s), offs = offsOf(s);
      T.set(hd, [M.A[a].nm + '  ·  bit', on]);
      for (const id of II) {
        const f = fields.find((x) => x.id === id), it = (s[a] || []).find((x) => x.id === id);
        const vs = f && f.v != null ? (f.w === 16 ? (f.v >= 0 ? ' +' : ' ') + f.v : ' ' + f.v) : '';
        T.set(fl[id], [f ? `${id}${vs}` : '', on && !!it && hotIt(s, a, id), it ? TAGL[it.tag] || '' : '', !!f]);
      }
      byl.forEach((lb, j) => T.set(lb, [offs[j] != null ? '−' + -offs[j] : '', false, '', offs[j] != null]));
      T.set(cap, [capOf(s[a] || []), on, '', true, true]);
    },
    layout(x0, y, ww, k, z) {
      const nb = Math.max(...M.all.map((s) => C.headerBits(s[a] || [], WD).bits), 8), gap = 5;
      const bw = Math.min(18 * z + 2, (ww - gap * (nb / 8 - 1)) / nb);
      const used = nb * bw + gap * (nb / 8 - 1);
      geo = { x0: x0 + Math.max(0, (ww - used) / 2), y, bw, gap, nb, per: new Map() };
      W.place(hd, x0, y);
      geo.byY = y + HD; geo.band = y + HD + 16; geo.bh = Math.max(8, bw * 0.9);
      let fr = 0;
      for (const [bk, b] of M.B) b.S.forEach((s, si) => {
        const T = W.TX[M.sc.num].get(bk)[si], { fields } = decode(s);
        const st = rowsOf(W, fields.map((f) => ({ f, cx: bitX(f.at) + (bitX(f.at + f.w - 1) + bw - bitX(f.at)) / 2, w: W.wOf(fl[f.id], T.get(fl[f.id])) })), x0, x0 + ww);
        fr = Math.max(fr, st.rows);
        geo.per.set(s, st.out);
      });
      geo.fy = geo.band + geo.bh + 9;
      W.wrap(cap, ww);
      geo.capY = geo.fy + fr * RH + 6;
      W.place(cap, x0, geo.capY);
      return geo.capY + W.most(cap).h - y;
    },
    place(s) {
      for (const q of geo.per.get(s) || []) W.place(fl[q.f.id], q.l, geo.fy + q.row * RH);
      const offs = offsOf(s);
      byl.forEach((lb, j) => { if (offs[j] != null) W.place(lb, bitX(j * 8) + 4 * geo.bw, geo.byY, 'c', 't'); });
    },
    pose(s, P) {
      const [r0, r1] = W.R['bits:' + a], { fields, hb, known } = decode(s), on = touchOf(s, a);
      let i = r0;
      for (const f of fields) {
        const it = f.it, hot = on && hotIt(s, a, f.id), col = hot ? GOLD : TAGC[it.tag] ?? INK, lv = P.level(a, hot) * P.form;
        for (let b = f.at; b < f.at + f.w; b++) {
          const one = known ? (hb[b >> 3] >> (7 - (b & 7))) & 1 : null;
          if (i + BITN <= r1) i = bitCell(W, P, i, bitX(b) + 1, geo.band, geo.bw - 3, geo.bh, one, lv, hot, col);
        }
      }
      /* 바이트 경계 아래의 작은 눈금 */
      const [z0, z1] = W.R['bitz:' + a];
      for (let m = 0; m < z1 - z0; m++) {
        const i = z0 + m, b = Math.floor(m / 10), on2 = b < geo.nb / 8, x = bitX(b * 8) + ((m % 10) / 9) * (8 * geo.bw - 2);
        const [xx, yy] = P.into(i, x, geo.band - 4);
        W.put(P.o, i, xx, yy, on2 && b * 8 < (known || fields.length ? fields.reduce((q, f) => Math.max(q, f.at + f.w), 0) : 0) ? 0.35 * P.dim * P.form : 0, 0, 0.02, 0.9, FAINT);
      }
    },
    draw(ctx, s, O) {
      const { fields } = decode(s);
      ctx.strokeStyle = O.css.faint; ctx.setLineDash([]);
      /* 칸의 괄호 — bit 아래 */
      ctx.globalAlpha = 0.6 * O.o;
      for (const f of fields) {
        const xa = bitX(f.at) + 1, xb = bitX(f.at + f.w - 1) + geo.bw - 1, yb = geo.band + geo.bh + 3;
        ctx.beginPath(); ctx.moveTo(xa, yb - 2); ctx.lineTo(xa, yb); ctx.lineTo(xb, yb); ctx.lineTo(xb, yb - 2); ctx.stroke();
      }
      ctx.globalAlpha = 0.3 * O.o;
      for (const q of geo.per.get(s) || []) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, geo.band + geo.bh + 4, q.cx, geo.fy + q.row * RH + 1);
      /* 위의 바이트 칸에서 그 8 bit 로 — 확대 선 */
      const S = W.geo[src];
      if (S) {
        const g0 = S.geo, ry = g0.rows[S.row.r], y0 = ry.sb + ry.vr * RH + 2, nbyte = Math.round(Math.max(...fields.map((f) => f.at + f.w), 0) / 8);
        ctx.globalAlpha = 0.22 * O.o;
        for (let j = 0; j < nbyte; j++) {
          const u = -nbyte + j, xa = g0.ox + u * g0.px, xb = xa + g0.px;
          seg(ctx, xa + 1, y0, bitX(j * 8) + 1, geo.byY - 2); seg(ctx, xb - 1, y0, bitX(j * 8 + 7) + geo.bw - 1, geo.byY - 2);
        }
      }
    },
    anchor(a2) { return a2 === a && geo ? [geo.x0 + (geo.nb * geo.bw) / 2, geo.band + 4] : null; },
  };
};

/* ── 03 — 바이트마다 8 bit(높은 자리가 왼쪽). bits 목록의 mask(0x01 · 0x02 · 0x04)가 가리키는 자리에 그 플래그의 이름 ── */
PANEL.bbits = (W, M, sp) => {
  const a = sp.a, II = ids(M, a), fl = Object.fromEntries(II.map((id) => [id, W.label('aq')])), cap = W.label('aq ml aq-b'), hd = W.label('aq');
  /* 그 칸의 bit 자리 — id 의 16진 mask 가 있으면 그것, 없으면 'bit #4~8'(책의 셈 — 1 부터 센 자리) */
  const posOf = (it) => { const m = C.hexList(it.id)[0]; if (m) return [Math.log2(m), Math.log2(m)]; const r = C.bitRange(String(it.id).replace('#', '')); return r ? [r[0] - 1, r[1] - 1] : null; };
  let geo = null;
  const bytesOf = (s) => (W.geo.val ? W.geo.val.cells(s) : []).filter((c) => /^0x[0-9a-f]{2}$/i.test(c.it.id));
  /* 바이트마다 8 bit 를 크게 — 바이트 칸들의 가운데 아래에 나란히(01 의 확대와 같다) */
  const groups = (s) => {
    const cs = bytesOf(s);
    if (!cs.length || !geo) return [];
    const n = cs.length, gap = 14, bw = Math.min(30, (geo.ww - (n - 1) * gap) / (8 * n)), tot = n * 8 * bw + (n - 1) * gap;
    const mid = (cs[0].x[0] + cs[n - 1].x[1]) / 2, x0 = Math.max(geo.x0, Math.min(geo.x0 + geo.ww - tot, mid - tot / 2));
    return cs.map((c, j) => ({ c, x: x0 + j * (8 * bw + gap), bw }));
  };
  const bitAt = (gq, b) => gq.x + (7 - b) * gq.bw;
  return {
    lbs: [hd, cap, ...Object.values(fl)], acts: [a, 'val'], needs: ['val'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const on = touchOf(s, a);
      T.set(hd, [s[a].length ? M.A[a].nm : '', on, '', !!s[a].length]);
      for (const id of II) { const it = s[a].find((x) => x.id === id); T.set(fl[id], [it ? (posOf(it) ? it.sub.split('=')[0].trim() || id : id) : '', on && !!it, it ? TAGL[it.tag] || '' : '', !!it]); }
      T.set(cap, [capOf(s[a]), on, '', s[a].length > 0, true]);
    },
    layout(x0, y, ww, k, z) {
      geo = { x0, ww, y, bh: Math.round(14 + 10 * z), per: new Map() };
      W.place(hd, x0, y);
      geo.band = y + HD + 10;
      let fr = 0;
      for (const [bk, b] of M.B) b.S.forEach((s, si) => {
        const T = W.TX[M.sc.num].get(bk)[si], gq = groups(s)[0];
        if (!gq) { geo.per.set(s, []); return; }
        const st = rowsOf(W, s[a].map((it) => ({ it, pr: posOf(it), w: W.wOf(fl[it.id], T.get(fl[it.id])) })).filter((q) => q.pr).map((q) => ({ ...q, cx: (bitAt(gq, q.pr[1]) + bitAt(gq, q.pr[0]) + gq.bw) / 2 })), x0, x0 + ww);
        fr = Math.max(fr, st.rows); geo.per.set(s, st.out);
      });
      geo.fy = geo.band + geo.bh + 8;
      W.wrap(cap, ww);
      geo.capY = geo.fy + fr * RH + 6;
      W.place(cap, x0, geo.capY);
      return geo.capY + W.most(cap).h - y;
    },
    place(s) { for (const q of geo.per.get(s) || []) W.place(fl[q.it.id], q.l, geo.fy + q.row * RH); },
    pose(s, P) {
      const [r0, r1] = W.R.bb, gs = groups(s);
      let i = r0;
      for (const gq of gs) {
        const c = gq.c, v = parseInt(c.it.id, 16), w = gq.bw, hot = touchOf(s, 'val') && hotIt(s, 'val', c.it.id);
        for (let b = 7; b >= 0; b--) {
          const one = (v >> b) & 1, x = bitAt(gq, b), item = s[a].find((it) => { const pr = posOf(it); return pr && b >= pr[0] && b <= pr[1]; });
          const col = item ? (item.tag === 'free' ? FAINT : item.tag === 'ok' ? GREEN : INK) : INK;
          if (i + BITN <= r1) i = bitCell(W, P, i, x + 2, geo.band, w - 4, geo.bh, one, P.level('val', hot) * P.form, hot, hot ? GOLD : col);
        }
      }
    },
    draw(ctx, s, O) {
      const gs = groups(s);
      if (!gs.length) return;
      ctx.globalAlpha = 0.3 * O.o; ctx.strokeStyle = O.css.faint;
      for (const q of geo.per.get(s) || []) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, geo.band + geo.bh + 2, q.cx, geo.fy + q.row * RH + 1);
      /* 바이트 칸에서 그 8 bit 로 — 확대 선 */
      const S = W.geo.val;
      if (S) { const ry = S.geo.rows[S.row.r], y0 = ry.sb + ry.vr * RH + 1; ctx.globalAlpha = 0.25 * O.o; for (const gq of gs) { seg(ctx, gq.c.x[0] + 1, y0, gq.x, geo.band - 3); seg(ctx, gq.c.x[1] - 1, y0, gq.x + 8 * gq.bw, geo.band - 3); } }
      /* bit 번호 — 1 부터(책의 셈) 오른쪽이 1 */
    },
    anchor(a2, s) { if (a2 !== a || !geo) return null; const gq = groups(s)[0]; return gq ? [gq.x + 4 * gq.bw, geo.band + geo.bh / 2] : [geo.x0 + 40, geo.band]; },
  };
};

/* ── FSP flags 한 word(03a · 10) — bit 14 가 왼쪽. 칸은 bits 목록의 'bit a–b'(03a), 10 은 소스의 WIDTH 를 쌓은 배치.
   실측 값(03a 의 0x4000 · 0x4021 · 0x4029, 10 의 0x4021)은 값마다 한 줄 — 1 bit 를 채운 칸 ── */
PANEL.flags = (W, M, sp) => {
  const a = sp.a, hd = W.label('aq'), cap = a ? W.label('aq ml aq-b') : null;
  const FL = C.FSP_FLAGS;
  const fieldsOf = (s) => (a ? (s[a] || []).map((it) => ({ it, r: C.bitRange(it.id) })).filter((x) => x.r).map((x) => ({ id: x.it.id, lo: x.r[0], hi: x.r[1], it: x.it })) : FL.map(([n, lo, hi]) => ({ id: n, lo, hi })));
  const valsOf = (s) => C.hexList(a ? s.op && s.op.FSP_SPACE_FLAGS : s.hdr && s.hdr['FSP FLAG']);
  const fids = a ? ids(M, a) : FL.map((x) => x[0]);
  const fl = Object.fromEntries(fids.map((id) => [id, W.label('aq')])), vl = Array.from({ length: 4 }, () => W.label('aq'));
  let geo = null;
  const bitX = (b) => geo.x0 + (14 - b) * geo.bw;
  const nameOf = (f) => (a ? f.id.replace(/^bit\s+[\d–~-]+\s*/, '') : f.id);
  return {
    lbs: [hd, ...(cap ? [cap] : []), ...Object.values(fl), ...vl], acts: [a || 'hdr'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const fs = fieldsOf(s), vs = valsOf(s), on = a ? touchOf(s, a) : touchOf(s, 'hdr'), vis = fs.length > 0 && (a || vs.length > 0);
      T.set(hd, [vis ? 'FSP_SPACE_FLAGS  ·  page 0 의 4 B 중 15 bit' : '', on, '', vis]);
      for (const id of fids) { const f = fs.find((x) => x.id === id); T.set(fl[id], [f && vis ? `${f.lo === f.hi ? f.lo : f.lo + '–' + f.hi}${nameOf(f) ? ' ' + nameOf(f) : ''}` : '', on && (!a || hotIt(s, a, id)), f && f.it ? TAGL[f.it.tag] || '' : '', !!f && vis]); }
      vl.forEach((lb, j) => T.set(lb, [vs[j] != null ? '0x' + vs[j].toString(16) : '', on, 'gold', vs[j] != null]));
      if (cap) T.set(cap, [capOf(s[a] || []), on, '', (s[a] || []).length > 0, true]);
    },
    layout(x0, y, ww, k, z) {
      const lw = 52, bw = Math.min(26 * z + 4, (ww - lw) / 15);
      geo = { x0: x0 + lw, y, bw, per: new Map() };
      W.place(hd, x0, y);
      let fr = 0;
      for (const [bk, b] of M.B) b.S.forEach((s, si) => {
        const T = W.TX[M.sc.num].get(bk)[si];
        const st = rowsOf(W, fieldsOf(s).map((f) => ({ f, cx: (bitX(f.hi) + bitX(f.lo) + bw) / 2, w: W.wOf(fl[f.id], T.get(fl[f.id])) })), x0, x0 + ww);
        fr = Math.max(fr, st.rows); geo.per.set(s, st.out);
      });
      geo.fy = y + HD;
      geo.band = geo.fy + fr * RH + 6;
      const nv = Math.max(1, ...M.all.map((s) => valsOf(s).length));
      geo.rh = Math.max(12, bw * 0.75) + 4;
      geo.nv = nv;
      let yy = geo.band + nv * geo.rh + 4;
      if (cap) { W.wrap(cap, ww); W.place(cap, x0, yy); yy += W.most(cap).h; }
      return yy - y;
    },
    place(s) {
      for (const q of geo.per.get(s) || []) W.place(fl[q.f.id], q.l, geo.fy + (geo.per.get(s).reduce((m, x) => Math.max(m, x.row), 0) - q.row) * RH);
      vl.forEach((lb, j) => W.place(lb, geo.x0 - 8, geo.band + j * geo.rh + geo.rh / 2 - 2, 'r', 'c'));
    },
    pose(s, P) {
      const [r0, r1] = W.R.fl, fs = fieldsOf(s), vs = valsOf(s), on = a ? touchOf(s, a) : touchOf(s, 'hdr');
      const vis = fs.length > 0 && (a || vs.length > 0);
      let i = r0;
      const rowsN = vs.length || 1;
      for (let r = 0; r < rowsN && vis; r++) for (let b = 14; b >= 0; b--) {
        const v = vs[r], one = v != null ? (v >> b) & 1 : null, f = fs.find((x) => b >= x.lo && b <= x.hi), hot = on && f && (!a || hotIt(s, a, f.id));
        if (i + BITN <= r1) i = bitCell(W, P, i, bitX(b) + 1.5, geo.band + r * geo.rh, geo.bw - 3, geo.rh - 4, one, P.level(a || 'hdr', hot) * P.form, hot, hot ? GOLD : INK);
      }
    },
    draw(ctx, s, O) {
      const fs = fieldsOf(s), vs = valsOf(s);
      if (!fs.length || (!a && !vs.length)) return;
      ctx.strokeStyle = O.css.faint; ctx.globalAlpha = 0.55 * O.o; ctx.setLineDash([]);
      for (const f of fs) { const xa = bitX(f.hi) + 1, xb = bitX(f.lo) + geo.bw - 2, yt = geo.band - 3; ctx.beginPath(); ctx.moveTo(xa, yt + 2); ctx.lineTo(xa, yt); ctx.lineTo(xb, yt); ctx.lineTo(xb, yt + 2); ctx.stroke(); }
      const per = geo.per.get(s) || [], top = per.reduce((m, x) => Math.max(m, x.row), 0);
      ctx.globalAlpha = 0.3 * O.o;
      for (const q of per) { const ly = geo.fy + (top - q.row) * RH + RH - 2; if (q.row < top || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, ly, q.cx, geo.band - 4); }
    },
    anchor(a2) { return (a2 === a || (!a && a2 === 'hdr')) && geo ? [geo.x0 + 7 * geo.bw, geo.band + 6] : null; },
  };
};

/* ── hexdump — 그 page 의 실측 바이트(06b 와 같은 모양). 짚는 칸의 바이트가 금빛.
   fil : op 의 '페이지' 가 p:0 이면 t.ibd page 0(spacedump), 아니면 p:5(pagedump)의 앞 38 B. phd : p:5 의 38 – 93 ── */
PANEL.hex = (W, M, sp) => {
  const a = sp.a, el = document.createElement('div');
  el.className = 'hexs';
  /* 이름표 하나를 빌려 hexdump 판으로 쓴다 — 불투명도 · 자리 · 크기 재기가 다른 이름표와 같은 길로 간다 */
  const host = W.label('aq');
  host.el.remove();
  host.el = el;
  W.labels.appendChild(el);
  const pageOf = (s) => (/p:0/.test(String(s.op && s.op['페이지'])) || M.sc.num === '04bv' ? 0 : 5);
  const range = a === 'phd' ? [38, 94] : [0, 38];
  const hexOf = (no) => (no === 0 ? W.MEAS.SPACE.files.small.p0.hex : W.MEAS.DUMP[no].hex);
  /* 04 — PAGE HEADER kv 의 칸이 앞 38 B 의 어디인가(fil0types.h 의 오프셋) */
  const HDR = { FIL_PAGE_OFFSET: [4, 8], FIL_PAGE_LSN: [16, 24], FIL_PAGE_TYPE: [24, 26] };
  /* 금빛 바이트 = 그 스텝이 짚는 칸 — 금빛 칸, look 이 이름으로 고른 칸, act 이름이 대는 칸. 바뀐 칸 전부를 세었더니
     금빛을 끄는 칸(앞 스텝의 '← 지금' 을 hdr 로 되돌리는 set)까지 금빛으로 남았다(04a 3 – 7 스텝) */
  const pointed = (s, b, it) => {
    if (!touchOf(s, b)) return false;
    const f = focusOf(s, b);
    return it.tag === 'gold' || (f ? f.has(it.id) : false) || actNames(s, b, it.id) || ((it.tag === 'x' || it.tag === 'red') && modOf(s, b).has(it.id));
  };
  /* 06a — PAGE header 의 2 B 칸(fsp · fins)도 제 두 바이트를 짚는다('+4  N_HEAP' → 42 – 43) */
  const SUBS = a === 'phd' ? ['fsp', 'fins'] : [];
  const hotItems = (s) => {
    if (a === 'hdr') return [];
    const out = [], base = a === 'phd' ? 38 : 0;
    for (const it of s[a] || []) { const o = C.lead(it.sub); if (o != null && pointed(s, a, it)) out.push({ it, r: [base + o, base + o + (it.sz || 0)] }); }
    for (const b of SUBS) for (const it of s[b] || []) { const o = C.lead(it.id); if (o != null && pointed(s, b, it)) out.push({ it, r: [base + o, base + o + 2] }); }
    return out;
  };
  const hotRanges = (s) => {
    if (a === 'hdr') return Object.entries(HDR).filter(([k2]) => s.hdr && s.hdr[k2] && bare(s.hdr[k2]) !== '—').map(([, r]) => r);
    return hotItems(s).map((x) => x.r);
  };
  /* 검사 — 이 스텝에서 금빛을 잃은 칸(앞 상태 gold → 지금 아님)의 바이트가 금빛이면 칸 줄과 hexdump 가 서로 다른 것을 짚는다 */
  const prevOf = new Map();
  for (const b of M.B.values()) b.S.forEach((s, i) => prevOf.set(s, i ? b.S[i - 1] : b.S0));
  const guard = (s) => {
    const pv = prevOf.get(s);
    if (!pv) return;
    for (const { it } of hotItems(s)) {
      const was = (pv[a] || []).find((x) => x.k === it.k);
      if (was && was.tag === 'gold' && it.tag !== 'gold' && !(focusOf(s, a) && focusOf(s, a).has(it.id)) && !actNames(s, a, it.id)) once(`ch3 ${M.sc.num} 세계 : ${s.i + 1} 스텝 — ${it.id} 는 금빛을 껐는데 hexdump 에서 금빛이다`);
    }
  };
  const html = (s) => {
    const no = pageOf(s), h = hexOf(no), hot = hotRanges(s), isH = (o) => hot.some(([p, q]) => o >= p && o < q);
    const r0 = Math.floor(range[0] / 16), r1 = Math.ceil(range[1] / 16);
    let out = `<div class="hx-hd"><b>${no === 0 ? 'page 0' : 'p:' + no}</b>  ${no === 0 ? 'FSP_HDR' : 'idx_c root · leaf'}  ·  ${range[0]}–${range[1] - 1}  ·  실측 t.ibd</div>`;
    for (let r = r0; r < r1; r++) {
      out += `<div class="hx-row"><i>${String(r * 16).padStart(4, '0')}</i>`;
      for (let c = 0; c < 16; c++) {
        const o = r * 16 + c, inR = o >= range[0] && o < range[1];
        out += `<b class="${!inR ? 'f' : isH(o) ? 'h' : 'p'}${c === 8 ? ' gap' : ''}" style="${inR ? '' : 'opacity:.25'}">${h.slice(o * 2, o * 2 + 2)}</b>`;
      }
      out += '</div>';
    }
    return `<div class="hx-l">${out}</div>`;
  };
  return {
    optional: true,
    lbs: [host], acts: [a], snap: () => null, use: () => {},
    texts(s, T) { guard(s); const vis = a !== 'hdr' || hotRanges(s).length > 0; T.set(host, [vis ? html(s) : html(s), touchOf(s, a) || a !== 'hdr', '', vis, true]); },
    layout(x0, y, ww) {
      el.style.width = '';
      W.place(host, x0, y);
      return W.most(host).h + 2;
    },
    place() {},
    pose() {},
    dispose() { el.remove(); },
  };
};

/* ── 파일 = 같은 크기 page 의 줄(04 · 10). t.ibd 의 실측 page 수(pagedump meta 17)만큼 칸. 배우의 항목이 칸 묶음이다
   (p0 · p1 · p2 · 'p3 … INDEX' → 3 – 16). 10 은 칸 아래에 실측 FIL_PAGE_TYPE 두 바이트(0 · 2 는 spacedump, 3 – 14 는 pagedump) ── */
PANEL.tiles = (W, M, sp) => {
  const a = sp.a, NP = W.MEAS.M.nPages, II = ids(M, a);
  const nm = Object.fromEntries(II.map((id) => [id, W.label('aq')])), sb = Object.fromEntries(II.map((id) => [id, W.label('aq')]));
  const hd = W.label('aq'), no = Array.from({ length: NP }, () => W.label('aq')), cap = W.label('aq ml aq-b'), off = W.label('aq gold');
  const TY = M.sc.num === '10' ? C.typesOf(W.MEAS) : null;
  const runs = [];
  if (TY) { let cur = null; for (let p = 0; p < NP; p++) { const t = TY[p] || null; if (cur && cur.t === t) cur.b = p; else { cur = { a: p, b: p, t }; runs.push(cur); } } }
  const tyl = runs.map(() => W.label('aq'));
  const startOf = (it) => { const m = /(?:^|\s)p(?:age)?\s*(\d+)/.exec(it.id); return m ? +m[1] : null; };
  const spans = (s) => { const its = (s[a] || []).map((it) => ({ it, p: startOf(it) })).filter((x) => x.p != null).sort((p, q) => p.p - q.p); return its.map((x, i) => ({ ...x, q: i + 1 < its.length ? its[i + 1].p - 1 : NP - 1 })); };
  const pick = (s) => { const m = s.step.act && /page\s+(\d+)/.exec(s.step.act.lb); return m ? +m[1] : null; };
  /* 10 — 타입 두 바이트의 금빛은 그 스텝이 대는 타입에만. hdr 가 바뀌기만 하면 45 bf 를 켰더니 page 0 의 FSP FLAG 를
     말하는 2 스텝에서 INDEX 줄이 금빛이었다. FIL_PAGE_TYPE 이 바뀌면 그 값(17855)의 줄, hdr 전체를 보면 INDEX 계열(≥ 0x45bd),
     FSP FLAG 가 바뀌면 page 0 */
  const hk = (s) => modOf(s, 'hdr');
  const typeNo = (s) => C.nums((s.hdr || {}).FIL_PAGE_TYPE).find((x) => x >= 10000) ?? null;
  const flagOn = (s) => hk(s).has('FSP FLAG');
  const runHot = (s, r) => {
    if (!r.t || !touchOf(s, 'hdr')) return false;
    const v = parseInt(r.t, 16);
    if (hk(s).has('FIL_PAGE_TYPE')) return v === typeNo(s);
    if (flagOn(s)) return r.a === 0;
    return s.look.hdr === true && v >= 0x45bd;
  };
  if (TY) for (const b of M.B.values()) for (const s of b.S) {
    const t = hk(s).has('FIL_PAGE_TYPE') && typeNo(s);
    if (t && !runs.some((r) => r.t && parseInt(r.t, 16) === t)) console.error(`ch3 ${M.sc.num} 세계 : ${s.i + 1} 스텝 — FIL_PAGE_TYPE ${t} 인 page 가 실측 ${W.MEAS.M.file} 에 없다`);
  }
  let geo = null;
  const tx = (p) => geo.x0 + p * (geo.ts + geo.gap);
  return {
    lbs: [hd, cap, off, ...Object.values(nm), ...Object.values(sb), ...no, ...tyl], acts: [a, 'hdr'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const on = touchOf(s, a), sps = spans(s), pk = pick(s);
      T.set(hd, [`${M.A[a].nm}  ·  ${W.MEAS.M.file}  ${NP} page × 16,384 B`, on]);
      for (const id of II) {
        const x = sps.find((q) => q.it.id === id), fh = !!x && flagOn(s) && x.p === 0;
        T.set(nm[id], [x ? id : '', (on && hotIt(s, a, id)) || fh, x ? TAGL[x.it.tag] || (fh ? 'gold' : '') : '', !!x]);
        T.set(sb[id], [x ? x.it.sub : '', (on && hotIt(s, a, id)) || fh, '', !!x && !!x.it.sub]);
      }
      no.forEach((lb, p) => T.set(lb, [String(p), pk === p, pk === p ? 'gold' : '', true]));
      tyl.forEach((lb, j) => { const r = runs[j], h = runHot(s, r); T.set(lb, [r.t ? `${r.t.slice(0, 2)} ${r.t.slice(2)}${r.b > r.a ? ' × ' + (r.b - r.a + 1) : ''}` : '', touchOf(s, 'hdr'), h ? 'gold' : '', !!r.t]); });
      T.set(off, [pk != null ? `${pk} × 16,384 = ${fmt(pk * 16384)}` : '', true, 'gold', pk != null]);
      T.set(cap, [s.byl[a] ? `${esc(s.byl[a].l || '')}  ·  ${esc(s.byl[a].r || '')}` : '', on, '', !!s.byl[a], true]);
    },
    layout(x0, y, ww, k, z) {
      const gap = 3, ts = Math.max(12, Math.min(34 * z, (ww - (NP - 1) * gap) / NP));
      geo = { x0, ts, gap, per: new Map() };
      W.place(hd, x0, y);
      let nr = 0, vr = 0;
      for (const [bk, b] of M.B) b.S.forEach((s, si) => {
        const T = W.TX[M.sc.num].get(bk)[si], sps = spans(s);
        const cx = (q) => (tx(q.p) + tx(q.q) + ts) / 2;
        const NM = rowsOf(W, sps.map((q) => ({ id: q.it.id, cx: cx(q), w: W.wOf(nm[q.it.id], T.get(nm[q.it.id])) })), x0, x0 + ww);
        const VL = rowsOf(W, [...sps.map((q) => ({ id: q.it.id, k: 'sb', cx: cx(q), w: W.wOf(sb[q.it.id], T.get(sb[q.it.id])) })), ...runs.map((r, j) => ({ j, k: 'ty', cx: (tx(r.a) + tx(r.b) + ts) / 2, w: W.wOf(tyl[j], T.get(tyl[j])) }))], x0, x0 + ww);
        nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows); geo.per.set(s, { NM: NM.out, VL: VL.out });
      });
      geo.nm = y + HD; geo.band = geo.nm + nr * RH + 4; geo.no = geo.band + ts + 3; geo.sb = geo.no + 15; geo.off = geo.sb + vr * RH + 2;
      geo.nr = nr;
      W.wrap(cap, ww);
      W.place(cap, x0, geo.off + 16);
      return geo.off + 16 + W.most(cap).h - y;
    },
    place(s) {
      const q = geo.per.get(s);
      if (!q) return;
      for (const it of q.NM) W.place(nm[it.id], it.l, geo.nm + (geo.nr - 1 - it.row) * RH);
      for (const it of q.VL) W.place(it.k === 'ty' ? tyl[it.j] : sb[it.id], it.l, geo.sb + it.row * RH);
      no.forEach((lb, p) => W.place(lb, tx(p) + geo.ts / 2, geo.no, 'c', 't'));
      const pk = pick(s);
      if (pk != null) W.place(off, Math.min(tx(pk), geo.x0 + 9999), geo.off);
    },
    pose(s, P) {
      const [r0, r1] = W.R.tl, per = Math.floor((r1 - r0) / NP), sps = spans(s), pk = pick(s), on = touchOf(s, a);
      for (let p = 0; p < NP; p++) {
        const q = sps.find((x) => p >= x.p && p <= x.q), it = q && q.it, hot = pk === p || (it && on && hotIt(s, a, it.id) && !pk) || (flagOn(s) && p === 0);
        const col = hot ? GOLD : it ? TAGC[it.tag] ?? INK : FAINT, lv = P.level(a, hot) * P.form;
        for (let m = 0; m < per; m++) {
          const i = r0 + p * per + m, [x, y] = m < per - 6 ? rim(tx(p) + geo.ts / 2, geo.band + geo.ts / 2, geo.ts - 2, geo.ts - 2, per - 6, m) : [tx(p) + geo.ts * (0.3 + 0.2 * ((m - per + 6) % 3)), geo.band + geo.ts * (0.4 + 0.25 * Math.floor((m - per + 6) / 3))];
          const [xx, yy] = P.into(i, x, y);
          W.put(P.o, i, xx, yy, lv * (m < per - 6 ? 0.85 : hot ? 0.9 : 0.35), hot ? 0.5 : 0, 0.02, 1.1, col);
        }
      }
    },
    draw(ctx, s, O) {
      const q = geo.per.get(s);
      if (!q) return;
      ctx.globalAlpha = 0.3 * O.o; ctx.strokeStyle = O.css.faint;
      for (const it of q.NM) { const ly = geo.nm + (geo.nr - 1 - it.row) * RH + RH - 2; if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, ly, it.cx, geo.band - 1); }
      for (const it of q.VL) if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, geo.no + 14, it.cx, geo.sb + it.row * RH + 1);
      /* 묶음의 괄호 — 칸 위 */
      ctx.globalAlpha = 0.45 * O.o;
      for (const sp2 of spans(s)) if (sp2.q > sp2.p) { const xa = tx(sp2.p) + 1, xb = tx(sp2.q) + geo.ts - 1, yy = geo.band - 3; ctx.beginPath(); ctx.moveTo(xa, yy + 2); ctx.lineTo(xa, yy); ctx.lineTo(xb, yy); ctx.lineTo(xb, yy + 2); ctx.stroke(); }
    },
    anchor(a2, s) { if (a2 !== a || !geo) return null; const pk = pick(s); return [tx(pk ?? 0) + geo.ts / 2, geo.band + geo.ts / 2]; },
  };
};

/* ── 16 KB page 지도 — 알갱이 i 가 바이트 i(128 × 128, 06b 와 같다). 영역 · 경계 · 가리키는 자리는 장면마다 다른 데이터에서 —
     04 : pg 항목의 바이트(38 B · 16338 B · 8B)를 차례로       06a : addr 가 밝힌 경계 + p:5 실측(HEAP_TOP · slot 147)
     09a : hdr 의 HEAP_TOP, freeL sub 의 오프셋(1375 · 1151)   11 : 칸 + crc32 가 덮는 범위 [4, 26) ∪ [38, 16376) ── */
const COLS = 128;
PANEL.map = (W, M, sp) => {
  const n = sp.n, P5 = W.MEAS.DUMP[5].f;
  const hd = W.label('aq'), side = Array.from({ length: 8 }, () => W.label('aq'));
  const lbs = [hd, ...side];
  const hdrOf = (s) => s.hdr || {};
  /* 영역 — [lo, hi) · 색 · 밝기 · 이름(옆 이름표) · 짚음 */
  function regions(s) {
    const R0 = [];
    if (n === '04' || n === '11') {
      let x = 0;
      for (const it of (s.pg || []).filter((q) => !C.isPlace(q))) {
        const b = C.bytesIn(it.sub) ?? C.bytesIn(it.id) ?? 0;
        R0.push({ lo: x, hi: x + b, c: TAGC[it.tag] ?? INK, a: it.tag === 'free' ? 0.15 : it.tag === '' || it.tag === 'clean' ? 0.22 : 0.75, t: `${fmt(x)}–${fmt(x + b - 1)}  ${it.id}${it.sub ? '  ' + it.sub : ''}`, hot: touchOf(s, 'pg') && (Array.isArray(s.look.pg) ? hotIt(s, 'pg', it.id) : actNames(s, 'pg', it.id) || modOf(s, 'pg').has(it.id)), it });
        x += b;
      }
      return R0;
    }
    const A = s.addr || {};
    if (n === '06a') {
      /* 이름표 = addr 의 칸과 값(글 그대로) + 그 영역의 바이트. directory 의 끝은 p:5 실측 slot 147 개 */
      const dir0 = PAGE - 8 - P5.PAGE_N_DIR_SLOTS * 2, set = (k) => A[k] && bare(A[k]) !== '—', kv = (k) => `${esc(k)} <span class="q-v">${val(A[k])}</span>`;
      R0.push({ lo: 0, hi: 38, c: FAINT, a: 0.6, t: '0–37  FIL header 38 B' });
      if (set('PAGE_HEADER')) R0.push({ lo: 38, hi: 74, c: GOLD, a: 0.8, t: `${kv('PAGE_HEADER')}  ·  38–73 header 36 B`, html: true, hot: modOf(s, 'addr').has('PAGE_HEADER') || touchOf(s, 'phd') });
      if (set('PAGE_DATA')) R0.push({ lo: 74, hi: 94, c: INK, a: 0.6, t: `${kv('PAGE_DATA')}  ·  74–93 FSEG`, html: true, hot: modOf(s, 'addr').has('PAGE_DATA') });
      if (set('infimum')) R0.push({ lo: 94, hi: 120, c: ACCENT, a: 0.75, t: `${kv('infimum')}  ·  ${set('supremum') ? kv('supremum') : 'supremum —'}`, html: true, hot: modOf(s, 'addr').has('infimum') });
      if (set('infimum')) R0.push({ lo: 120, hi: P5.PAGE_HEAP_TOP, c: INK, a: 0.32, t: '' });
      if (set('디렉터리 시작')) R0.push({ lo: dir0, hi: PAGE - 8, c: ACCENT, a: 0.7, t: `${kv('디렉터리 시작')}  ·  p:5 ${P5.PAGE_N_DIR_SLOTS} slot → ${fmt(dir0)}`, html: true, hot: modOf(s, 'addr').has('디렉터리 시작') });
      R0.push({ lo: PAGE - 8, hi: PAGE, c: FAINT, a: 0.6, t: '16,376–  trailer 8 B' });
      return R0;
    }
    if (n === '09a') {
      const ht = C.lead(hdrOf(s).HEAP_TOP);
      R0.push({ lo: 0, hi: 120, c: FAINT, a: 0.5, t: '0–119  header · infimum · supremum' });
      if (ht) {
        R0.push({ lo: 120, hi: ht, c: INK, a: 0.34, t: `120–${fmt(ht - 1)}  records` });
        R0.push({ lo: ht, hi: PAGE - 8, c: FAINT, a: 0.12, t: `HEAP_TOP ${fmt(ht)}  →  빈 곳`, cls: modOf(s, 'hdr').has('HEAP_TOP') ? 'gold' : '' });
      }
      R0.push({ lo: PAGE - 8, hi: PAGE, c: FAINT, a: 0.6, t: '16,376–  trailer 8 B' });
      return R0;
    }
    return R0;
  }
  /* 11 — crc32 가 덮는 바이트. 손잡이 none 이면 계산하지 않는다 */
  const algo = (s) => bare((s.op || {})['알고리즘'] || '');
  const covered = (i) => C.COVER.some(([p, q]) => i >= p && i < q);
  /* 가리키는 자리 — [바이트, 색, 이름] */
  function rings(s) {
    const out = [];
    if (n === '09a') for (const it of s.freeL || []) { const o = C.lead(it.sub); if (o && o > 120 && o < PAGE) out.push({ at: o, c: it.tag === 'x' ? RED : GOLD, id: it.id, it }); }
    if (n === '06a') for (const it of s.dir || []) { const to = /\((\d+)\)/.exec(it.sub); if (to) out.push({ at: +to[1], c: ACCENT, id: it.id, it, from: /슬롯 0/.test(it.id) ? PAGE - 8 - 2 : PAGE - 8 - 2 * P5.PAGE_N_DIR_SLOTS }); }
    return out;
  }
  let geo = null;
  const at = (o) => [geo.x + (o % COLS) * geo.pp, geo.y + Math.floor(o / COLS) * geo.pp];
  return {
    lbs, acts: ['pg', 'addr', 'hdr', 'freeL', 'dir', 'sum', 'phd'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const R0 = regions(s), on = touchOf(s, 'pg') || touchOf(s, 'addr') || touchOf(s, 'hdr') || touchOf(s, 'freeL');
      const t = n === '06a' ? 'p:5  ·  16 KB = 128 × 128 B' : n === '09a' ? `16 KB page  ·  ${bare((s.op || {})['실측'] || '')}` : n === '11' ? 'page 5  ·  16 KB = 128 × 128 B' : 'page 5  ·  16 KB = 128 × 128 B';
      T.set(hd, [t, on]);
      side.forEach((lb, j) => {
        const r = R0[j];
        if (n === '11' && j === R0.length) { const lit = algo(s) !== 'none'; T.set(lb, [`crc32 가 덮는 바이트  ${fmt(C.COVER.reduce((q, [p0, p1]) => q + p1 - p0, 0))} B  =  4–25 · 38–16,375`, lit && touchOf(s, 'pg'), lit ? 'green' : '', true]); return; }
        T.set(lb, [r ? r.t : '', !!r && (r.hot || on), r && (r.hot ? 'gold' : r.cls || ''), !!r, !!(r && r.html)]);
      });
    },
    layout(x0, y, ww, k, z) {
      const sideW = Math.min(250, Math.max(150, ww * 0.42));
      const pp = Math.max(0.72, Math.min(3.2 * z, (ww - sideW - 16) / COLS, (W.L.y1 - W.L.y0) * 0.62 * z / COLS));
      geo = { x: x0, y: y + HD + 6, pp, sx: x0 + COLS * pp + 16, sw: ww - COLS * pp - 16 };
      W.place(hd, x0, y);
      side.forEach((lb) => W.wrap(lb, geo.sw));
      /* 옆 이름표가 page 보다 길면 그만큼 비운다 — page 높이에 가뒀더니 좁은 화면에서 이름표가 위로 밀려 제목을 덮었다 */
      const nl = Math.max(...M.all.map((s) => regions(s).filter((r) => r.t !== '').length + (n === '11' ? 1 : 0)));
      geo.lh = Math.max(...side.map((lb) => W.most(lb).h), 14) + 3;
      geo.bot = geo.y + Math.max(COLS * pp, nl * geo.lh);
      return geo.bot - y + 2;
    },
    place(s) {
      /* 옆 이름표 — 영역이 시작하는 줄 높이에, 겹치면 아래로 민다. 맨 아래를 넘으면 위로 */
      const R0 = regions(s), ys = [], bot = geo.bot;
      const list = side.map((lb, j) => ({ lb, r: R0[j] || (n === '11' && j === R0.length ? { lo: 38 + COLS * 3 } : null) })).filter((x) => x.r && (x.r.t !== '' || !R0[side.indexOf(x.lb)]));
      for (const q of list) { const [, y0] = at(q.r.lo); q.y = y0 - 4; q.h = q.lb.el.offsetHeight || 14; }
      list.sort((p, q) => p.y - q.y);
      for (let i = 0; i < list.length; i++) list[i].y = Math.max(list[i].y, i ? list[i - 1].y + list[i - 1].h + 3 : geo.y);
      for (let i = list.length - 1; i >= 0; i--) list[i].y = Math.min(list[i].y, (i < list.length - 1 ? list[i + 1].y : bot + 2) - list[i].h - 3);
      for (const q of list) { W.place(q.lb, geo.sx, q.y); ys.push(q); }
      geo.ys = ys;
    },
    pose(s, P) {
      const [r0] = W.R.map, R0 = regions(s), ri = rings(s), sz = Math.max(1, geo.pp * 0.62), lit = n === '11' && algo(s) !== 'none' && (touchOf(s, 'pg') || touchOf(s, 'sum') || touchOf(s, 'file'));
      const lsnOnly = n === '11' && algo(s) === 'none' && touchOf(s, 'file');
      /* 09a — HEAP_TOP 이 넣은 record 크기만큼 밀렸으면(3864 → 4388 = 524 B) 그 바이트가 새 record. 다른 page 로 넘어간 스텝은 아니다 */
      const need = n === '09a' ? C.nums(((s.op || {})['넣는 행'] || '').split('·')[1] || '')[0] : null;
      const prevHT0 = n === '09a' && P.prev.hdr ? C.lead(P.prev.hdr.HEAP_TOP) : null, ht = n === '09a' ? C.lead(hdrOf(s).HEAP_TOP) : null;
      const prevHT = prevHT0 && ht && need && ht - prevHT0 === need ? prevHT0 : null;
      let j = 0;
      for (let i = 0; i < PAGE; i++) {
        while (j < R0.length - 1 && i >= R0[j].hi) j++;
        const r = R0[j] && i >= R0[j].lo && i < R0[j].hi ? R0[j] : null;
        let c = r ? r.c : FAINT, a = r ? r.a : 0.08, h = 0;
        /* 짚는 영역은 밝게 — 단 page 의 몸통(수천 바이트)은 금빛 덩어리가 되지 않게 그대로 두고 조금만 */
        if (r && r.hot) { if (r.hi - r.lo > 4096) a = Math.max(a, 0.4); else { c = r.c2 || (r.c === FAINT ? GOLD : r.c); a = Math.max(a, 0.85); h = 0.6; } }
        if (n === '11') { const cv = covered(i); if (lit && cv) { c = GREEN; a = i < 38 ? 0.95 : 0.5; } else if (!cv && i >= 4 && i < 38) { c = FAINT; a = 0.4; } if (lsnOnly && ((i >= 20 && i < 24) || i >= PAGE - 4)) { c = GOLD; a = 1; h = 1; } }
        /* 09a — 이번에 HEAP_TOP 이 밀어 낸 바이트(새 record) */
        if (prevHT && ht && ht > prevHT && i >= prevHT && i < ht && !P.end) { c = GOLD; a = 0.9; h = 0.8; }
        const [x, y] = at(i), k2 = P.form >= 1 ? 1 : U.smooth(U.range(P.form, W.F.seed[r0 + i] * 0.5, W.F.seed[r0 + i] * 0.5 + 0.5));
        W.put(P.o, r0 + i, U.lerp(W.dust[(r0 + i) * 2], x, k2), U.lerp(W.dust[(r0 + i) * 2 + 1], y, k2), a * P.dim * (0.15 + 0.85 * k2), h, 0, sz, c);
      }
      /* 고리 — 가리키는 바이트 둘레 */
      const [m0, m1] = W.R.mk, per = Math.max(8, Math.floor((m1 - m0) / Math.max(1, ri.length)));
      ri.forEach((q, e) => {
        const [x, y] = at(q.at);
        for (let m = 0; m < per && m0 + e * per + m < m1; m++) {
          const i = m0 + e * per + m, th = (m / per) * Math.PI * 2, [xx, yy] = P.into(i, x + geo.pp / 2 + Math.cos(th) * 6, y + geo.pp / 2 + Math.sin(th) * 6);
          W.put(P.o, i, xx, yy, 0.95 * P.dim * P.form, 0.6, 0.02, 1.2, q.c);
        }
      });
    },
    draw(ctx, s, O) {
      /* 옆 이름표의 지시선 */
      ctx.strokeStyle = O.css.faint; ctx.globalAlpha = 0.35 * O.o;
      for (const q of geo.ys || []) { const [x, y] = at(q.r.lo); ctx.beginPath(); ctx.moveTo(geo.sx - 3, q.y + 7); ctx.lineTo(geo.x + COLS * geo.pp + 2, q.y + 7); ctx.lineTo(x + geo.pp, y + geo.pp / 2); ctx.stroke(); }
      /* 06a — 슬롯(page 끝)에서 record(앞)로 */
      for (const q of rings(s)) if (q.from != null) {
        const [x0, y0] = at(q.from), [x1, y1] = at(q.at), hot = touchOf(s, 'dir');
        ctx.globalAlpha = (hot ? 0.8 : 0.45) * O.o; ctx.strokeStyle = O.css.accent; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x0 + geo.pp / 2, y0); ctx.bezierCurveTo(x0 + 40, y0 - 60, x1 + 40, y1 + 60, x1 + geo.pp, y1 + geo.pp); ctx.stroke();
        arrowHead(ctx, x1 + geo.pp, y1 + geo.pp, Math.atan2(-60, -40), 4);
      }
      geo.chainAt = (o) => { const [x, y] = at(o); return [x + geo.pp / 2, y + geo.pp / 2]; };
      W.geo.map = geo;
    },
    anchor(a, s) {
      if (!geo) return null;
      if (a === 'pg' || a === 'addr' || a === 'hdr') { const R0 = regions(s), r = R0.find((x) => x.hot) || R0[0]; if (!r) return null; const [x, y] = at(Math.min(PAGE - 1, r.lo)); return [x + 4, y + 2]; }
      return null;
    },
  };
};

/* ── 11 의 page 앞 38 B · 끝 8 B 확대 — 바이트 칸 하나가 바이트 하나. 위의 괄호가 crc32 가 덮는 범위,
   칸 아래에 sum 의 값(머리 · 꼬리 · LSN 하위)과 판정 ── */
PANEL.cover = (W, M, sp) => {
  const head = sp.part === 'head', B0 = head ? 0 : PAGE - 8, NB = head ? 38 : 8;
  const hd = W.label('aq'), vl = Array.from({ length: 3 }, () => W.label('aq')), br = Array.from({ length: 3 }, () => W.label('aq'));
  const sumOf = (s) => s.sum || {};
  const algo = (s) => bare((s.op || {})['알고리즘'] || '');
  const parts = (s) => {
    const S = sumOf(s);
    if (head) return [{ lo: 0, hi: 4, k: '머리 (오프셋 0)', v: S['머리 (오프셋 0)'] }];
    return [{ lo: PAGE - 8, hi: PAGE - 4, k: '꼬리 (trailer 앞 4 B)', v: S['꼬리 (trailer 앞 4 B)'] }, { lo: PAGE - 4, hi: PAGE, k: 'LSN 하위 (뒤 4 B)', v: S['LSN 하위 (뒤 4 B)'] }, { k: '판정', v: S['판정'], cap: true }];
  };
  const brk = head ? [{ lo: 0, hi: 4, t: '0–3  checksum' }, { lo: 4, hi: 26, t: '4–25  crc32 ①', cov: true }, { lo: 26, hi: 38, t: '26–37  CRC 밖' }] : [{ lo: PAGE - 8, hi: PAGE, t: '16,376–16,383  trailer 8 B' }];
  let geo = null;
  const bx = (o) => geo.x0 + (o - B0) * geo.bw;
  return {
    lbs: [hd, ...vl, ...br], acts: ['sum', 'pg'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const on = touchOf(s, 'sum') || touchOf(s, 'pg');
      T.set(hd, [head ? 'page 앞 38 B  ·  FIL header' : 'page 끝 8 B  ·  trailer', on]);
      parts(s).forEach((q, j) => { const v = q.v && bare(q.v) !== '—' ? q.v : null; T.set(vl[j], [v ? `${q.k}  ${val(v)}` : `${q.k}  —`, on && modOf(s, 'sum').has(q.k), '', true, true]); });
      br.forEach((lb, j) => { const b = brk[j]; T.set(lb, [b ? b.t : '', !!b && b.cov && algo(s) !== 'none' && on, b && b.cov && algo(s) !== 'none' ? 'green' : '', !!b]); });
    },
    layout(x0, y, ww, k, z) {
      const bw = Math.min(head ? 18 : 30, (ww - 4) / NB);
      geo = { x0, ww, bw, bh: Math.round(14 + 4 * z) };
      W.place(hd, x0, y);
      geo.br = y + HD; geo.band = geo.br + RH + 4;
      geo.vl = geo.band + geo.bh + 6;
      const vw = Math.max(...vl.map((lb) => W.most(lb).h));
      return geo.vl + (head ? vw : vw * 2 + 4) + 2 - y;
    },
    place(s) {
      brk.forEach((b, j) => W.place(br[j], Math.min(bx(b.lo), geo.x0 + geo.ww - 80), geo.br));
      /* 첫 칸 이름표가 둘째와 겹치면 둘째를 오른쪽 끝에 붙인다 */
      if (head && br[1].el.offsetWidth && bx(4) < bx(0) + br[0].el.offsetWidth + 6) W.place(br[1], bx(0) + br[0].el.offsetWidth + 8, geo.br);
      if (head && br[2].el.offsetWidth) W.place(br[2], Math.max(br[1].x + br[1].el.offsetWidth + 8, bx(26)), geo.br);
      if (head) W.place(vl[0], geo.x0, geo.vl);
      else { W.place(vl[0], geo.x0, geo.vl); W.place(vl[1], Math.max(geo.x0 + vl[0].el.offsetWidth + 14, bx(PAGE - 4)), geo.vl); W.place(vl[2], geo.x0, geo.vl + vl[0].el.offsetHeight + 4); }
    },
    pose(s, P) {
      const [r0, r1] = W.R['cv:' + sp.part], per = Math.floor((r1 - r0) / NB), lit = algo(s) !== 'none' && (touchOf(s, 'pg') || touchOf(s, 'sum') || touchOf(s, 'file'));
      const ps = parts(s), lsnOnly = algo(s) === 'none' && touchOf(s, 'file');
      for (let b = 0; b < NB; b++) {
        const o = B0 + b, cv = C.COVER.some(([p, q]) => o >= p && o < q);
        const isSum = ps.some((q) => q.lo != null && o >= q.lo && o < q.hi), hotSum = isSum && ps.some((q) => q.lo != null && o >= q.lo && o < q.hi && modOf(s, 'sum').has(q.k));
        const isLsn = !head && o >= PAGE - 4;
        let col = cv ? (lit ? GREEN : INK) : isSum ? GOLD : FAINT;
        if (isLsn) col = ACCENT;
        if (hotSum) col = GOLD;
        if (lsnOnly && isLsn) col = GOLD;
        const al = (cv ? (lit ? 0.95 : 0.55) : isSum ? 0.9 : 0.4) * P.dim * P.form;
        for (let m = 0; m < per; m++) {
          const i = r0 + b * per + m, [x, y] = rim(bx(o) + geo.bw / 2, geo.band + geo.bh / 2, geo.bw - 3, geo.bh, per, m);
          const [xx, yy] = P.into(i, x, y);
          W.put(P.o, i, xx, yy, al, hotSum ? 0.6 : 0, 0.02, 1.1, col);
        }
      }
    },
    draw(ctx, s, O) {
      ctx.strokeStyle = O.css.faint; ctx.globalAlpha = 0.6 * O.o;
      for (const b of brk) { const xa = bx(b.lo) + 1, xb = bx(b.hi) - 1, yy = geo.band - 4; ctx.strokeStyle = b.cov && algo(s) !== 'none' ? O.css.green : O.css.faint; ctx.beginPath(); ctx.moveTo(xa, yy + 3); ctx.lineTo(xa, yy); ctx.lineTo(xb, yy); ctx.lineTo(xb, yy + 3); ctx.stroke(); }
    },
    anchor(a, s) { if (a === 'sum' && geo) return [bx(head ? 2 : PAGE - 6), geo.band + geo.bh / 2]; return null; },
  };
};

/* ── page 띠(비례) + 셀 · 슬롯 칸 줄(05 · 05v · 08 · 09) — 띠는 pg 의 항목 그대로, 아래 칸 줄의 셀은 넣은 순서,
   슬롯은 page 끝에서 거꾸로(슬롯 0 이 오른쪽). 슬롯 → 셀 화살표('슬롯 1 → 셀 3') ── */
PANEL.pstrip = (W, M, sp) => {
  const band = PANEL.bytes(W, M, { rows: [['pg']] });
  /* 한 번도 항목이 없는 목록(05 의 슬롯)은 그리지 않는다 */
  const live = sp.lists.filter((a) => M.all.some((s) => (s[a] || []).length));
  const lists = Object.fromEntries(live.map((a) => [a, PANEL.chips(W, M, { a, rtl: a === 'dir', noCap: live.length > 1 })]));
  const parts = [band, ...Object.values(lists)];
  const caps = live.length > 1 ? live.map((a) => lists[a].cap) : [];
  const slotOf = (s, d) => { const t = C.slotTo(d.id); return t && (s.cells || []).find((c) => c.id === t || c.id.startsWith(t + ' ')); };
  return {
    lbs: parts.flatMap((p) => p.lbs), acts: ['pg', ...live], snap: () => parts.map((p) => p.snap()), use: (g) => parts.forEach((p, i) => p.use(g[i])),
    texts(s, T) { for (const p of parts) p.texts(s, T); },
    layout(x0, y, ww, k, z) {
      let yy = y;
      parts.forEach((p, i) => { const g = i ? (i === 1 ? 10 + 6 * k : 20 + 6 * k) : 0; yy += g + p.layout(x0, yy + g, ww, k, z); });
      if (caps.length) {
        const cw = (ww - 18) / caps.length;
        caps.forEach((c, i) => { W.wrap(c, cw); W.place(c, x0 + i * (cw + 18), yy + 6); });
        yy += 6 + Math.max(...caps.map((c) => W.most(c).h));
      }
      return yy - y;
    },
    place(s) { for (const p of parts) p.place(s); },
    pose(s, P) { for (const p of parts) p.pose(s, P); },
    draw(ctx, s, O) {
      band.draw(ctx, s, O);
      const cl = lists.cells, dl = lists.dir;
      if (!cl || !dl) return;
      /* 슬롯 → 셀 */
      for (const d of s.dir || []) {
        const c = slotOf(s, d), A2 = dl.slotAt(s, d.id), B2 = c && cl.slotAt(s, c.id);
        if (!A2 || !B2) continue;
        const hot = touchOf(s, 'dir') && hotIt(s, 'dir', d.id);
        ctx.globalAlpha = (hot ? 0.85 : 0.45) * O.o; ctx.strokeStyle = hot ? O.css.gold : O.css.body; ctx.setLineDash([]);
        const y0 = A2.y - 12, y1 = B2.y + 12;
        ctx.beginPath(); ctx.moveTo(A2.x, y0); ctx.bezierCurveTo(A2.x, y0 - 14, B2.x, y1 + 14, B2.x, y1); ctx.stroke();
        arrowHead(ctx, B2.x, y1, -Math.PI / 2, 4);
      }
    },
    anchor(a, s, lb) { for (const p of parts) { const q = p.anchor && p.anchor(a, s, lb); if (q) return q; } return null; },
  };
};

/* ── 06 — record 를 키 순서로(infimum · 16 개 · supremum), 슬롯 하나가 무리 하나를 맡는다. 무리의 마지막 record 가 주인이고
   슬롯은 그것을 가리킨다(n_owned 는 주인 record 의 헤더에). 무리 크기는 dir 의 sub('레코드 8개 소유' …) ── */
PANEL.chain06 = (W, M, sp) => {
  const OWN = C.owns06(M.all), dl = W.label('aq'), cl = W.label('aq ml aq-b'), hd = W.label('aq');
  const SI = ids(M, 'dir'), slb = Object.fromEntries(SI.map((id) => [id, W.label('aq aq-c')])), gl = Object.fromEntries(SI.map((id) => [id, W.label('aq')]));
  const inf = W.label('aq'), sup = W.label('aq');
  const NREC = C.lead(((M.sc.init.op || {}).kv || {})['레코드 수']) || 16;
  let geo = null;
  const rx = (j) => geo.x0 + j * (geo.rw + geo.gap);
  const groups = (s) => { let j = 0; return (s.dir || []).map((d) => { const n = OWN[d.id] || 0, g = { d, a: j, b: j + n - 1 }; j += n; return g; }); };
  return {
    lbs: [dl, cl, hd, inf, sup, ...Object.values(slb), ...Object.values(gl)], acts: ['dir', 'cells'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const on = touchOf(s, 'dir') || touchOf(s, 'cells');
      T.set(hd, [`record ${NREC + 2} 개 — 키 순서 · next 로 잇는다`, on]);
      T.set(inf, ['infimum', touchOf(s, 'pg') && hotIt(s, 'pg', 'i·s'), touchOf(s, 'pg') && hotIt(s, 'pg', 'i·s') ? 'gold' : '']);
      T.set(sup, ['supremum', touchOf(s, 'pg') && hotIt(s, 'pg', 'i·s'), touchOf(s, 'pg') && hotIt(s, 'pg', 'i·s') ? 'gold' : '']);
      for (const id of SI) { const d = (s.dir || []).find((x) => x.id === id); T.set(slb[id], [d ? id : '', touchOf(s, 'dir') && !!d && hotIt(s, 'dir', id), d ? TAGL[d.tag] || '' : '', !!d]); T.set(gl[id], [d ? `× ${OWN[id]}` : '', touchOf(s, 'dir') && !!d && hotIt(s, 'dir', id), '', !!d]); }
      T.set(dl, [capOf(s.dir || []), touchOf(s, 'dir'), '', (s.dir || []).length > 0, true]);
      T.set(cl, [capOf(s.cells || []), touchOf(s, 'cells'), '', true, true]);
    },
    layout(x0, y, ww, k, z) {
      const n = NREC + 2, gap = 4, rw = Math.min(30 * z + 4, (ww - (n - 1) * gap) / n);
      geo = { x0, rw, gap, n, y: y + HD, rh: Math.min(26, rw * 0.9 + 6) };
      W.place(hd, x0, y);
      geo.lab = geo.y + geo.rh + 6;
      geo.slot = geo.lab + RH + 14;
      geo.cap = geo.slot + 26 + 8;
      W.wrap(dl, (ww - 18) / 2); W.wrap(cl, (ww - 18) / 2);
      W.place(cl, x0, geo.cap); W.place(dl, x0 + (ww + 18) / 2, geo.cap);
      return geo.cap + Math.max(W.most(dl).h, W.most(cl).h) - y;
    },
    place(s) {
      W.place(inf, rx(0), geo.lab);
      W.place(sup, rx(geo.n - 1) + geo.rw, geo.lab, 'r');
      for (const g of groups(s)) { W.place(slb[g.d.id], rx(g.b) + geo.rw / 2, geo.slot + 13, 'c', 'c'); W.place(gl[g.d.id], (rx(g.a) + rx(g.b) + geo.rw) / 2, geo.lab, 'c', 't'); }
      /* infimum · supremum 이름표가 무리 이름표와 겹치면 숨긴다 */
      const gs = groups(s);
      inf.hide = gs.length > 0; sup.hide = gs.length > 0;
    },
    pose(s, P) {
      const [r0, r1] = W.R.ch, gs = groups(s), on = touchOf(s, 'cells') || touchOf(s, 'dir'), ish = touchOf(s, 'pg') && hotIt(s, 'pg', 'i·s');
      let i = r0;
      for (let j = 0; j < geo.n; j++) {
        const g = gs.find((q) => j >= q.a && j <= q.b), hotG = g && touchOf(s, 'dir') && hotIt(s, 'dir', g.d.id) && g.d.tag === 'hold';
        const bound = j === 0 || j === geo.n - 1, owner = gs.some((q) => q.b === j);
        const col = bound && ish ? GOLD : hotG ? GOLD : bound ? ACCENT : owner ? INK : INK, lv = P.level(bound ? 'pg' : 'cells', hotG || (bound && ish)) * P.form;
        for (let m = 0; m < 22 && i < r1; m++, i++) {
          let x, y;
          if (m < 16) [x, y] = rim(rx(j) + geo.rw / 2, geo.y + geo.rh / 2, geo.rw - 2, geo.rh, 16, m);
          else { x = rx(j) + geo.rw * (0.3 + 0.2 * ((m - 16) % 3)); y = geo.y + geo.rh * (0.35 + 0.3 * Math.floor((m - 16) / 3)); }
          const [xx, yy] = P.into(i, x, y);
          W.put(P.o, i, xx, yy, lv * (m < 16 ? 0.85 : owner || bound ? 0.9 : 0.3), hotG ? 0.4 : 0, 0.02, 1.1, col);
        }
      }
      for (const g of gs) {
        const hot = touchOf(s, 'dir') && hotIt(s, 'dir', g.d.id), x = rx(g.b) + geo.rw / 2, w = Math.max(40, W.tw(g.d.id) + 14);
        for (let m = 0; m < 30 && i < r1; m++, i++) { const [x2, y2] = rim(x, geo.slot + 13, w, 24, 30, m), [xx, yy] = P.into(i, x2, y2); W.put(P.o, i, xx, yy, P.level('dir', hot) * P.form, hot ? 0.4 : 0, 0.03, 1.1, hot ? GOLD : TAGC[g.d.tag] ?? INK); }
      }
    },
    draw(ctx, s, O) {
      const gs = groups(s);
      ctx.strokeStyle = O.css.faint; ctx.setLineDash([]);
      /* next — 이웃한 record 사이의 짧은 화살 */
      ctx.globalAlpha = 0.45 * O.o;
      for (let j = 0; j + 1 < geo.n; j++) { const x0 = rx(j) + geo.rw - 1, x1 = rx(j + 1) + 1, y = geo.y + geo.rh / 2; seg(ctx, x0, y, x1, y); }
      /* 무리 괄호와 슬롯 → 주인 */
      for (const g of gs) {
        const hot = touchOf(s, 'dir') && hotIt(s, 'dir', g.d.id), xa = rx(g.a) + 1, xb = rx(g.b) + geo.rw - 1, yb = geo.y + geo.rh + 3;
        ctx.globalAlpha = (hot ? 0.9 : 0.5) * O.o; ctx.strokeStyle = hot ? O.css.gold : O.css.faint;
        ctx.beginPath(); ctx.moveTo(xa, yb - 2); ctx.lineTo(xa, yb); ctx.lineTo(xb, yb); ctx.lineTo(xb, yb - 2); ctx.stroke();
        const x = rx(g.b) + geo.rw / 2;
        ctx.strokeStyle = hot ? O.css.gold : O.css.accent; seg(ctx, x, geo.slot, x, yb + 1 + RH + 2); arrowHead(ctx, x, geo.y + geo.rh + 1, -Math.PI / 2, 4); seg(ctx, x, yb + RH + 3, x, geo.y + geo.rh + 1);
      }
    },
    anchor(a, s) {
      if (!geo) return null;
      if (a === 'dir') { const g = groups(s).find((q) => hotIt(s, 'dir', q.d.id)) || groups(s)[0]; return g ? [rx(g.b) + geo.rw / 2, geo.slot + 13] : [geo.x0 + 40, geo.slot + 13]; }
      if (a === 'cells') return [rx(Math.floor(geo.n / 2)), geo.y + geo.rh / 2];
      return null;
    },
  };
};

/* ── 08a — record 를 page 의 실제 원점(99 · 112 · 126 · 148 · 173)에, 넣은 순서 = 주소 순서. 왼쪽은 page 앞 94 – 200,
   오른쪽은 끝 16,360 – 16,384(슬롯 2 B 씩, 16384 − 8 − 2(n+1)). next 사슬은 키 순서의 호 — 앞으로 가면 위, 뒤로 가면 아래.
   슬롯 → 주인 record 는 맨 아래의 긴 호. 원점이 없는 항목('+ 여섯')은 줄 아래 칸으로 ── */
PANEL.raxis = (W, M, sp) => {
  const A0 = C.PAGE_DATA, A1 = 200, B0 = PAGE - 24, B1 = PAGE;
  const CI = ids(M, 'cells'), DI = ids(M, 'dir');
  const nm = new Map(), sb = new Map();
  for (const id of CI) { nm.set('c|' + id, W.label('aq')); sb.set('c|' + id, W.label('aq')); }
  for (const id of DI) { nm.set('d|' + id, W.label('aq')); sb.set('d|' + id, W.label('aq')); }
  const hd = W.label('aq'), rl = [W.label('aq'), W.label('aq'), W.label('aq')], xchip = Object.fromEntries(CI.map((id) => [id, W.label('aq aq-c')]));
  /* next 는 마지막으로 적힌 것을 들고 간다 — 6 스텝은 Leslie 의 sub 를 lock 이야기로 바꾼다 */
  const NEXT = new Map();
  for (const [bk, b] of M.B) b.S.forEach((s) => { for (const it of s.cells || []) { const r = C.recOf(it), nx = C.nextName(it.sub); if (r && nx) NEXT.set(bk + '|' + s.i + '|' + r.name, nx); } });
  const nextOf = (s, name) => { for (let i = s.i; i >= -1; i--) { const v = [...NEXT.entries()].find(([kk]) => kk.endsWith('|' + i + '|' + name)); if (v) return v[1]; } return null; };
  const recs = (s) => (s.cells || []).map((it) => ({ it, r: C.recOf(it) })).filter((x) => x.r);
  const loose = (s) => (s.cells || []).filter((it) => !C.recOf(it));
  const slots = (s) => (s.dir || []).map((d, j) => ({ d, at: PAGE - 8 - 2 * (j + 1), to: C.slotTo(d.id) }));
  let geo = null;
  const X = (o) => (o < 1000 ? geo.x0 + (o - A0) * geo.px : geo.x0 + (A1 - A0) * geo.px + geo.gw + (o - B0) * geo.px);
  const items = (s) => [...recs(s).map((x) => ({ k: 'c|' + x.it.id, cx: X(x.r.org) - (x.r.name === 'infimum' || x.r.name === 'supremum' ? 0 : 0), it: x.it, a: 'cells' })), ...slots(s).map((q) => ({ k: 'd|' + q.d.id, cx: X(q.at) + geo.px, it: q.d, a: 'dir' }))];
  return {
    lbs: [hd, ...rl, ...nm.values(), ...sb.values(), ...Object.values(xchip)], acts: ['cells', 'dir'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      T.set(hd, [`page 앞 ${A0}–${A1}  ≈  끝 ${fmt(B0)}–${fmt(B1)}  ·  1 B = 1 칸`, touchOf(s, 'cells')]);
      const here = new Set([...recs(s).map((x) => 'c|' + x.it.id), ...slots(s).map((q) => 'd|' + q.d.id)]);
      for (const [kk, lb] of nm) { const [t, id] = [kk[0], kk.slice(2)], a = t === 'c' ? 'cells' : 'dir', it = (s[a] || []).find((x) => x.id === id), on = touchOf(s, a) && !!it && hotIt(s, a, id); T.set(lb, [it && here.has(kk) ? id : '', on, it ? TAGL[it.tag] || (on ? 'gold' : '') : '', !!it && here.has(kk)]); }
      for (const [kk, lb] of sb) { const [t, id] = [kk[0], kk.slice(2)], a = t === 'c' ? 'cells' : 'dir', it = (s[a] || []).find((x) => x.id === id), on = touchOf(s, a) && !!it && hotIt(s, a, id); T.set(lb, [it && here.has(kk) ? it.sub : '', on, '', !!it && here.has(kk) && !!it.sub]); }
      for (const id of CI) { const it = loose(s).find((x) => x.id === id); T.set(xchip[id], [it ? `${id}  ${it.sub}` : '', touchOf(s, 'cells'), '', !!it]); }
      T.set(rl[0], [String(A0), false, '', true]); T.set(rl[1], [String(C.NEW_SUP_END), false, '', true]); T.set(rl[2], ['16,376 trailer', false, '', true]);
    },
    layout(x0, y, ww, k, z) {
      const gw = 26, px = (ww - gw) / ((A1 - A0) + (B1 - B0));
      geo = { x0, ww, px, gw, per: new Map() };
      W.place(hd, x0, y);
      let nr = 0, vr = 0;
      for (const [bk, b] of M.B) b.S.forEach((s, si) => {
        const T = W.TX[M.sc.num].get(bk)[si], its = items(s);
        const NM = rowsOf(W, its.map((q) => ({ ...q, w: W.wOf(nm.get(q.k), T.get(nm.get(q.k))) })), x0, x0 + ww);
        const VL = rowsOf(W, its.map((q) => ({ ...q, w: W.wOf(sb.get(q.k), T.get(sb.get(q.k))) })), x0, x0 + ww);
        nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows); geo.per.set(s, { NM: NM.out, VL: VL.out });
      });
      geo.nm = y + HD; geo.nr = nr;
      geo.up = geo.nm + nr * RH + 2; geo.band = geo.up + 34; geo.bh = 20;
      geo.dn = geo.band + geo.bh; geo.rl = geo.dn + 50; geo.sb = geo.rl + 15; geo.vr = vr;
      geo.xy = geo.sb + vr * RH + 6;
      const hasLoose = M.all.some((s) => loose(s).length);
      return geo.xy + (hasLoose ? 28 : 0) - y;
    },
    place(s) {
      const q = geo.per.get(s);
      if (!q) return;
      for (const it of q.NM) W.place(nm.get(it.k), it.l, geo.nm + (geo.nr - 1 - it.row) * RH);
      for (const it of q.VL) W.place(sb.get(it.k), it.l, geo.sb + it.row * RH);
      W.place(rl[0], X(A0), geo.rl, 'l'); W.place(rl[1], X(C.NEW_SUP_END), geo.rl, 'c'); W.place(rl[2], X(PAGE - 8), geo.rl, 'r');
      let x = geo.x0;
      for (const it of loose(s)) { const w = W.tw(`${it.id}  ${it.sub}`) + 18; W.place(xchip[it.id], x + w / 2, geo.xy + 13, 'c', 'c'); x += w + 8; }
    },
    pose(s, P) {
      const [r0, r1] = W.R.ra;
      let i = r0;
      const box = (o0, o1, c, a, h = 0, n = 22) => { for (let m = 0; m < n && i < r1; m++, i++) { const [x, y] = rim((X(o0) + X(o1)) / 2, geo.band + geo.bh / 2, Math.max(2, X(o1) - X(o0) - 1), geo.bh, n, m), [xx, yy] = P.into(i, x, y); W.put(P.o, i, xx, yy, a * P.dim * P.form, h, 0.02, 1.1, c); } };
      /* 바닥 — page 앞 94 – 200 과 끝, 흐린 점선 */
      for (let m = 0; m < 50 && i < r1; m++, i++) { const u = m / 49, o = m < 36 ? A0 + u * (36 / 49 > 0 ? (A1 - A0) * (m / 35) : 0) : B0 + ((m - 36) / 13) * (B1 - B0), [xx, yy] = P.into(i, X(Math.min(o, m < 36 ? A1 : B1)), geo.band + geo.bh + 3); W.put(P.o, i, xx, yy, 0.3 * P.dim * P.form, 0, 0.02, 0.9, FAINT); }
      for (const x of recs(s)) {
        const hot = touchOf(s, 'cells') && hotIt(s, 'cells', x.it.id), sys = x.r.name === 'infimum' || x.r.name === 'supremum', col = hot ? GOLD : sys ? ACCENT : TAGC[x.it.tag] ?? INK;
        box(x.r.org - 5, x.r.org, col, P.level('cells', hot) * 0.95, hot ? 0.5 : 0);
        if (sys) box(x.r.org, x.r.org + 8, col, P.level('cells', hot) * 0.6, 0, 16);
      }
      for (const q of slots(s)) { const hot = touchOf(s, 'dir') && hotIt(s, 'dir', q.d.id); box(q.at, q.at + 2, hot ? GOLD : ACCENT, P.level('dir', hot), hot ? 0.5 : 0, 16); }
      box(PAGE - 8, PAGE, FAINT, 0.5, 0, 16);
      let x0 = geo.x0;
      for (const it of loose(s)) { const w = W.tw(`${it.id}  ${it.sub}`) + 18; for (let m = 0; m < 30 && i < r1; m++, i++) { const [x, y] = rim(x0 + w / 2, geo.xy + 13, w, 24, 30, m), [xx, yy] = P.into(i, x, y); W.put(P.o, i, xx, yy, P.level('cells', true) * P.form * (m % 2 ? 0.4 : 0.85), 0, 0.03, 1.05, FAINT); } x0 += w + 8; }
    },
    draw(ctx, s, O) {
      const q = geo.per.get(s);
      if (!q) return;
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.3 * O.o; ctx.strokeStyle = O.css.faint;
      for (const it of q.NM) { const ly = geo.nm + (geo.nr - 1 - it.row) * RH + RH - 2; if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, ly, it.cx, geo.up); }
      for (const it of q.VL) if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, geo.rl + 13, it.cx, geo.sb + it.row * RH + 1);
      /* 끊긴 자리 ≈ */
      const xb = X(A1) + geo.gw / 2;
      ctx.globalAlpha = 0.6 * O.o; seg(ctx, xb - 5, geo.band + geo.bh + 7, xb - 1, geo.band - 7); seg(ctx, xb + 1, geo.band + geo.bh + 7, xb + 5, geo.band - 7);
      /* next 사슬 — 키 순서 */
      const rs = recs(s), by = (t) => (/^\d+$/.test(t) ? rs.find((x) => x.r.org === +t) : rs.find((x) => x.r.name === t));
      const lit = touchOf(s, 'cells');
      let cur = by('infimum'), seen = new Set();
      while (cur && cur.r.name !== 'supremum' && !seen.has(cur.r.name)) {
        seen.add(cur.r.name);
        const nx = nextOf(s, cur.r.name), to = nx && by(nx.to);
        if (!to) break;
        const xa = X(cur.r.org), xt = X(to.r.org), fwd = xt > xa, hgt = Math.min(30, 10 + Math.abs(xt - xa) * 0.12);
        const hot = lit && (hotIt(s, 'cells', cur.it.id) || modOf(s, 'cells').has(to.it.id));
        ctx.globalAlpha = (hot ? 0.9 : 0.5) * O.o; ctx.strokeStyle = hot ? O.css.gold : O.css.body;
        const y0 = fwd ? geo.band - 1 : geo.band + geo.bh + 1, yc = fwd ? geo.band - hgt : geo.band + geo.bh + hgt;
        ctx.beginPath(); ctx.moveTo(xa, y0); ctx.bezierCurveTo(xa, yc, xt, yc, xt, y0); ctx.stroke();
        arrowHead(ctx, xt, y0, fwd ? Math.PI / 2 : -Math.PI / 2, 4);
        cur = to;
      }
      /* 슬롯 → 주인 record */
      for (const sl of slots(s)) {
        const to = sl.to && /^\d+$/.test(sl.to) ? rs.find((x) => x.r.org === +sl.to) : null;
        const hot = touchOf(s, 'dir') && hotIt(s, 'dir', sl.d.id), xa = X(sl.at) + geo.px, yb = geo.band + geo.bh + 40;
        ctx.globalAlpha = (hot ? 0.9 : 0.45) * O.o; ctx.strokeStyle = hot ? O.css.gold : O.css.accent;
        if (to) {
          const xt = X(to.r.org);
          ctx.beginPath(); ctx.moveTo(xa, geo.band + geo.bh + 1); ctx.bezierCurveTo(xa, yb, xt, yb, xt, geo.band + geo.bh + 1); ctx.stroke();
          arrowHead(ctx, xt, geo.band + geo.bh + 1, -Math.PI / 2, 4);
        }
      }
    },
    anchor(a, s, lb) {
      if (!geo) return null;
      if (a === 'cells') { const rs = recs(s), id = [...modOf(s, 'cells')].find((x) => rs.some((q) => q.it.id === x)), r = rs.find((q) => q.it.id === id) || rs[rs.length - 1]; return r ? [X(r.r.org), geo.band + geo.bh / 2] : null; }
      if (a === 'dir') { const sl = slots(s), q = sl[sl.length - 1]; return q ? [X(q.at), geo.band + geo.bh / 2] : null; }
      return null;
    },
  };
};

/* ── free list(09 · 09a) — PAGE_FREE 에서 시작하는 사슬. 원소는 지운 record(next 칸으로 잇는다), 목록에서 빠진 것(tag x)은
   사슬 밖에 빨갛게. 원소의 sub 에 오프셋(1375 · 1151)이 있으면 page 지도의 그 자리로, 09 는 PAGE_FREE 가 이름을 대는 띠의 칸으로 ── */
PANEL.fchain = (W, M, sp) => {
  const II = ids(M, 'freeL'), hd = W.label('aq'), head = W.label('aq aq-c'), nil = W.label('aq aq-c'), cap = W.label('aq ml aq-b');
  const cl = Object.fromEntries(II.map((id) => [id, W.label('aq aq-c')]));
  const chainOf = (s) => (s.freeL || []).filter((x) => x.tag !== 'x' && x.tag !== 'free');
  const outOf = (s) => (s.freeL || []).filter((x) => x.tag === 'x');
  const empty = (s) => (s.freeL || []).find((x) => x.tag === 'free');
  let geo = null;
  const wOf = (id) => geo.w[id] || 60;
  /* 칸 자리 — 머리 → 원소 … → ∅, 그 뒤에 목록에서 빠진 것. 줄이 넘치면 다음 줄로 */
  const pos = (s) => {
    const out = {}, x1 = geo.x0 + geo.ww;
    let x = geo.x0 + geo.hw + 26, row = 0;
    const at2 = (id, w, gap) => { if (x + w > x1 + 0.5) { x = geo.x0 + 26; row++; } out[id] = { x: x + w / 2, w, y: geo.y + row * 34 + 13 }; x += w + gap; };
    for (const it of chainOf(s)) at2(it.id, wOf(it.id), 26);
    at2('∅', 28, 30);
    for (const it of outOf(s)) at2(it.id, wOf(it.id), 12);
    out.rows = row + 1;
    return out;
  };
  const pfOf = (s) => bare((s.hdr || {}).PAGE_FREE || '');
  return {
    lbs: [hd, head, nil, cap, ...Object.values(cl)], acts: ['freeL', 'hdr'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const on = touchOf(s, 'freeL') || touchOf(s, 'hdr'), ch = new Set(chainOf(s).map((x) => x.id)), out = new Set(outOf(s).map((x) => x.id));
      T.set(hd, [M.A.freeL.nm + '  ·  PAGE_FREE 에서 next 로', on]);
      T.set(head, ['PAGE_FREE', touchOf(s, 'hdr') && modOf(s, 'hdr').has('PAGE_FREE'), touchOf(s, 'hdr') && modOf(s, 'hdr').has('PAGE_FREE') ? 'gold' : '']);
      T.set(nil, ['∅', false]);
      for (const id of II) { const it = (s.freeL || []).find((x) => x.id === id); T.set(cl[id], [it && (ch.has(id) || out.has(id)) ? id : '', touchOf(s, 'freeL') && !!it && hotIt(s, 'freeL', id), it ? TAGL[it.tag] || '' : '', !!it && (ch.has(id) || out.has(id))]); }
      T.set(cap, [capOf(s.freeL || []) || '—', touchOf(s, 'freeL'), '', true, true]);
    },
    layout(x0, y, ww) {
      geo = { x0, ww, y: y + HD, w: Object.fromEntries(II.map((id) => [id, Math.max(40, Math.ceil(W.most(cl[id]).w) + 16)])), hw: Math.max(80, Math.ceil(W.most(head).w) + 16) };
      W.place(hd, x0, y);
      W.wrap(cap, ww);
      const rows = Math.max(1, ...M.all.map((s) => pos(s).rows));
      geo.capY = geo.y + rows * 34 - 8 + 10;
      W.place(cap, x0, geo.capY);
      return geo.capY + W.most(cap).h - y;
    },
    place(s) {
      const P = pos(s);
      W.place(head, geo.x0 + geo.hw / 2, geo.y + 13, 'c', 'c');
      for (const it of [...chainOf(s), ...outOf(s)]) W.place(cl[it.id], P[it.id].x, P[it.id].y, 'c', 'c');
      W.place(nil, P['∅'].x, P['∅'].y, 'c', 'c');
    },
    pose(s, P) {
      const Q = pos(s), on = touchOf(s, 'freeL');
      const box = (key, cx, cy, w, col, lv, dash) => { const [r0, r1] = W.R[key]; for (let m = 0; m < r1 - r0; m++) { const i = r0 + m, [x, y] = rim(cx, cy, w, 24, r1 - r0, m), [xx, yy] = P.into(i, x, y); W.put(P.o, i, xx, yy, lv * (dash ? 0.4 + 0.4 * (m % 2) : 1) * P.form, 0, 0.03, 1.1, col); } };
      box('fc0', geo.x0 + geo.hw / 2, geo.y + 13, geo.hw, touchOf(s, 'hdr') && modOf(s, 'hdr').has('PAGE_FREE') ? GOLD : ACCENT, P.level('hdr', true));
      for (const it of [...chainOf(s), ...outOf(s)]) { const hot = on && hotIt(s, 'freeL', it.id); box('fc:' + it.id, Q[it.id].x, Q[it.id].y, Q[it.id].w, hot && it.tag !== 'x' ? GOLD : TAGC[it.tag] ?? INK, P.level('freeL', hot), it.tag === 'wait'); }
      const em = empty(s);
      if (em && W.R['fc:' + em.id]) box('fc:' + em.id, Q['∅'].x, Q['∅'].y, 28, FAINT, P.level('freeL', false), true);
    },
    draw(ctx, s, O) {
      const Q = pos(s), ch = chainOf(s), y = geo.y + 13;
      ctx.setLineDash([]); ctx.strokeStyle = O.css.body; ctx.globalAlpha = 0.6 * O.o;
      let xa = geo.x0 + geo.hw, ya = y;
      for (const it of [...ch, { id: '∅' }]) {
        const q = Q[it.id];
        if (q.y !== ya) { ctx.beginPath(); ctx.moveTo(xa + 2, ya); ctx.lineTo(xa + 8, ya); ctx.lineTo(xa + 8, ya + 17); ctx.lineTo(geo.x0 + 8, q.y - 17); ctx.lineTo(geo.x0 + 8, q.y); ctx.lineTo(q.x - q.w / 2 - 2, q.y); ctx.stroke(); }
        else seg(ctx, xa + 2, ya, q.x - q.w / 2 - 2, q.y);
        arrowHead(ctx, q.x - q.w / 2 - 2, q.y, 0, 4); xa = q.x + q.w / 2; ya = q.y;
      }
      /* page 의 자리로 — 09a 는 지도의 바이트, 09 는 띠의 칸 */
      const map = W.geo.map;
      ctx.globalAlpha = 0.4 * O.o; ctx.strokeStyle = O.css.gold; ctx.setLineDash([2, 3]);
      if (map && map.chainAt) for (const it of s.freeL || []) { const o = C.lead(it.sub); if (!o || o < 120 || !Q[it.id]) continue; const [x1, y1] = map.chainAt(o); seg(ctx, Q[it.id].x, Q[it.id].y - 12, x1, y1 + 6); }
      const pg = W.geo.pg, nm = pfOf(s).split(/\s/)[0];
      if (pg && nm && !/^0$/.test(nm)) { const c = pg.cells(s).find((q) => q.it.id.split(/\s/)[0] === nm); if (c) { const ry = pg.geo.rows[pg.row.r]; seg(ctx, geo.x0 + geo.hw / 2, y - 12, (c.x[0] + c.x[1]) / 2, ry.band + pg.geo.BH + 2); } }
    },
    anchor(a, s) { if (!geo) return null; if (a === 'freeL') { const c = chainOf(s)[0]; const Q = pos(s); return c ? [Q[c.id].x, Q[c.id].y] : [Q['∅'].x, Q['∅'].y]; } if (a === 'hdr' && !W.geo.map) return [geo.x0 + geo.hw / 2, geo.y + 13]; return null; },
  };
};

/* ── 09a 의 1/32 — 정리하면 생길 여유(GARBAGE + 연속 여유)를 막대로, 512 B 문턱에 금빛 선. 값은 addr 의 글 그대로 ── */
PANEL.gauge = (W, M, sp) => {
  const hd = W.label('aq'), lg = W.label('aq red'), lc = W.label('aq green'), lt = W.label('aq gold'), lm = W.label('aq');
  const v = (s) => { const A = s.addr || {}; return { g: C.lead(A.GARBAGE), c: C.lead(A['연속 여유']), mx: C.nums(A['정리 후 최대'])[0], lim: C.nums(A['1/32 문턱'])[0], t: A['정리 후 최대'] }; };
  const MAX = Math.max(1, ...M.all.map((s) => { const q = v(s); return Math.max(q.mx || 0, (q.g || 0) + (q.c || 0), q.lim || 0); })) * 1.08;
  let geo = null;
  const X = (b) => geo.x0 + (b / MAX) * geo.ww;
  return {
    lbs: [hd, lg, lc, lt, lm], acts: ['addr'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const q = v(s), vis = q.g != null && q.mx != null, on = touchOf(s, 'addr');
      T.set(hd, [vis ? '정리하면 생길 여유  ·  page 의 1/32' : '', on, '', vis]);
      T.set(lg, [vis ? `GARBAGE ${q.g}` : '', on, 'red', vis]);
      T.set(lc, [vis && q.c != null ? `연속 ${q.c}` : '', on, 'green', vis && q.c != null]);
      T.set(lt, [q.lim != null ? `${q.lim} = 16,384 / 32` : '', on, 'gold', vis && q.lim != null]);
      T.set(lm, [vis ? val(q.t) : '', on, '', vis, true]);
    },
    layout(x0, y, ww) { geo = { x0, ww, y: y + HD }; W.place(hd, x0, y); return HD + 14 + 4 + RH * 2 + 2; },
    place(s) {
      const q = v(s);
      if (q.g == null) return;
      W.place(lg, X(0), geo.y + 18); W.place(lc, Math.max(X(q.g) + 2, X(0) + lg.el.offsetWidth + 10), geo.y + 18);
      W.place(lt, X(q.lim), geo.y + 18 + RH, 'r'); W.place(lm, X(0), geo.y + 18 + RH);
      if (lm.el.offsetWidth + 12 > X(q.lim) - lt.el.offsetWidth - X(0)) W.place(lt, X(q.lim), geo.y - HD, 'r');
    },
    pose(s, P) {
      const q = v(s), [r0, r1] = W.R.gg, n = r1 - r0;
      for (let m = 0; m < n; m++) {
        const i = r0 + m, u = (m % 80) / 79, row = Math.floor(m / 80), b = u * (q.mx || 0), x = X(b), y = geo.y + 4 + row * 5;
        const col = b < (q.g || 0) ? RED : GREEN, ok = q.g != null && q.mx != null;
        const [xx, yy] = P.into(i, x, y);
        W.put(P.o, i, xx, yy, ok ? 0.85 * P.level('addr', true) * P.form : 0, 0, 0.02, 1.4, col);
      }
    },
    draw(ctx, s, O) {
      const q = v(s);
      if (q.lim == null || q.g == null) return;
      ctx.globalAlpha = 0.9 * O.o; ctx.strokeStyle = O.css.gold; ctx.lineWidth = 1.5; seg(ctx, X(q.lim), geo.y - 2, X(q.lim), geo.y + 16); ctx.lineWidth = 1;
    },
    anchor(a, s) { return a === 'addr' && geo && v(s).g != null ? [X(v(s).mx || 0), geo.y + 6] : null; },
  };
};

/* ── 04c — page 0 의 공간 지도와 page 2 의 inode, 실측 두 파일(t.ibd 17 page · big.ibd 576 page). 그 스텝의 파일은 fsA.file.
     page 0 띠 : FIL 38 · FSP header 112 · extent 마다 XDES 40(바이트 비례)
     FSP header : 칸 열둘을 바이트 비례로 — 위에 이름, 아래에 fsA · fsL 의 값
     extent    : 0 · 1 은 page 64 칸(쓰인 page 를 채우고 주인 segment 의 색), 2–8 은 한 줄(아직 깔리지 않음)
     inode     : page 2 의 50 + 192 × k 여섯 칸 — 칸에서 그 segment 의 낱장 page 로 선 ── */
PANEL.space = (W, M, sp) => {
  const SD = W.MEAS.SPACE, ROLE = {};
  /* 그 스텝의 파일 — 공간 지도(page 0 · extent · inode)는 src 의 '파일', FSP header 칸의 값은 fsA.file 의 것
     (9 스텝은 src 가 big.ibd 인데 fsA 는 5 스텝의 t.ibd 값 그대로다 — 무대도 그렇게 보였다) */
  const fileOfS = (s) => C.fileOf(SD, bare(((s.src || {})['파일'] || '').split('·')[0]) || bare((s.fsA || {}).file || '')) || SD.files.small;
  /* segment 의 이름 — root page 가 낱장에 든 segment 가 top, 그 다음 id 가 leaf(scenes.js 의 roleOf 와 같은 규칙) */
  const ROOT = { 3: 'SDI', 4: 'PRIMARY', 5: 'idx_c' };
  const roleOf = (f, id) => { for (const [no, nm] of Object.entries(ROOT)) { const t = f.p2.f.find((i) => i.frag.includes(+no)); if (t && t.FSEG_ID === id) return nm + ' top'; if (t && t.FSEG_ID + 1 === id) return nm + ' leaf'; } return '?'; };
  const SEGC = { 'SDI top': INK, 'SDI leaf': INK, 'PRIMARY top': GOLD, 'PRIMARY leaf': GOLD, 'idx_c top': ACCENT, 'idx_c leaf': ACCENT };
  const ownerOf = (f) => { const o = {}; for (const i of f.p2.f) for (const pg of i.frag) o[pg] = roleOf(f, i.FSEG_ID); return o; };
  const XI = ids(M, 'xd'), II = ids(M, 'ino');
  const hd0 = W.label('aq'), hdF = W.label('aq'), hdI = W.label('aq'), b0 = Array.from({ length: 3 }, () => W.label('aq'));
  const fn = Object.fromEntries(C.FSP_FIELDS.map(([n]) => [n, W.label('aq')])), fv = Object.fromEntries(C.FSP_FIELDS.map(([n]) => [n, W.label('aq')]));
  const xl = Object.fromEntries(XI.map((id) => [id, W.label('aq')]));
  const il = Object.fromEntries(II.map((id) => [id, { n: W.label('aq'), v: W.label('aq ml aq-b') }]));
  const lbs = [hd0, hdF, hdI, ...b0, ...Object.values(fn), ...Object.values(fv), ...Object.values(xl), ...Object.values(il).flatMap((x) => [x.n, x.v])];
  const valOf = (s, n) => { const a = s.fsA || {}, l = s.fsL || {}; const v = a[n] ?? l[n]; return v == null || bare(v) === '—' ? null : v; };
  const hotF = (s, n) => (touchOf(s, 'fsA') && modOf(s, 'fsA').has(n) && tone(s.fsA[n]) === 'gold') || (touchOf(s, 'fsL') && modOf(s, 'fsL').has(n) && tone(s.fsL[n]) === 'gold');
  let geo = null;
  const fx = (o) => geo.x0 + (o / 112) * geo.ww;
  const p0x = (o, f) => geo.x0 + (o / (150 + 40 * 9)) * geo.ww;
  const ix = (o) => geo.x0 + ((o - 0) / (C.INODE_AT + 6 * C.INODE_SIZE)) * geo.ww;
  const cx = (p) => geo.x0 + (p % 64) * geo.cw;
  return {
    lbs, acts: ['fsA', 'fsL', 'xd', 'ino'], snap: () => geo, use: (g) => { geo = g; },
    texts(s, T) {
      const f = fileOfS(s), on = touchOf(s, 'fsA') || touchOf(s, 'fsL');
      T.set(hd0, [`page 0  ·  ${f.file}  ·  FIL 38 · FSP header 112 · XDES 40 × ${f.p0.f.xdes.length}`, on || touchOf(s, 'xd')]);
      T.set(hdF, [`FSP header  ·  38 – 149  ·  ${bare((s.fsA || {}).file || '—')}`, on]);
      T.set(hdI, [`page 2  ·  INODE  ·  50 + 192 × k`, touchOf(s, 'ino')]);
      ['0', '38', '150'].forEach((t, j) => T.set(b0[j], [t, false, '', true]));
      for (const [n] of C.FSP_FIELDS) { const v = valOf(s, n), hot = hotF(s, n); T.set(fn[n], [n, hot || (on && !!v), hot ? 'gold' : '', true]); T.set(fv[n], [v ? bare(v) : '', hot || on, hot ? 'gold' : TAGL[tone(v)] || '', !!v]); }
      for (const id of XI) { const it = (s.xd || []).find((x) => x.id === id); T.set(xl[id], [it ? `${id}   ${it.sub}` : '', touchOf(s, 'xd') && hotIt(s, 'xd', id), '', !!it, false]); }
      for (const id of II) { const it = (s.ino || []).find((x) => x.id === id); T.set(il[id].n, [it ? id : '', touchOf(s, 'ino') && hotIt(s, 'ino', id), '', !!it]); T.set(il[id].v, [it ? it.sub : '', touchOf(s, 'ino') && hotIt(s, 'ino', id), / ←$/.test(it ? it.sub : '') ? 'gold' : '', !!it && bare(it.sub) !== '—']); }
    },
    layout(x0, y, ww, k, z) {
      geo = { x0, ww, per: new Map() };
      let yy = y;
      W.place(hd0, x0, yy); geo.p0 = yy + HD; yy = geo.p0 + 12 + 3; geo.b0 = yy; yy += 14 + 8 * k;
      /* FSP header 칸 — 이름(위)과 값(아래)의 줄 수를 모든 스텝에서 */
      W.place(hdF, x0, yy); geo.fh = yy + HD;
      let nr = 0, vr = 0;
      for (const [bk, b] of M.B) b.S.forEach((s, si) => {
        const T = W.TX[M.sc.num].get(bk)[si];
        const NM = rowsOf(W, C.FSP_FIELDS.map(([n, o, w]) => ({ n, cx: fx(o + w / 2), w: W.wOf(fn[n], T.get(fn[n])) })), x0, x0 + ww);
        const VL = rowsOf(W, C.FSP_FIELDS.map(([n, o, w]) => ({ n, cx: fx(o + w / 2), w: W.wOf(fv[n], T.get(fv[n])) })), x0, x0 + ww);
        nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows); geo.per.set(s, { NM: NM.out, VL: VL.out });
      });
      geo.nr = nr; geo.fb = geo.fh + nr * RH + 2; geo.fbh = 16; geo.fv = geo.fb + geo.fbh + 5; yy = geo.fv + vr * RH + 6 * k + 6;
      /* extent 줄 — 이름 한 줄 + page 칸 */
      geo.cw = Math.min(11 * z + 2, ww / 64); geo.ch = Math.max(5, geo.cw - 2);
      geo.xr = [];
      for (let e = 0; e < 3; e++) { geo.xr.push({ lb: yy, y: yy + RH }); yy += RH + geo.ch + 3 + 3 * k; }
      yy += 6 * k;
      W.place(hdI, x0, yy);
      const IST = rowsOf(W, II.map((id, k2) => ({ id, cx: ix(C.INODE_AT + k2 * C.INODE_SIZE + C.INODE_SIZE / 2), w: W.most(il[id].n).w })), x0, x0 + ww, 4);
      geo.ist = IST.out; geo.inr = IST.rows;
      geo.ih = yy + HD; geo.ib = geo.ih + IST.rows * RH + 2; geo.ibh = 14; geo.iv = geo.ib + geo.ibh + 5;
      const iw = (C.INODE_SIZE / (C.INODE_AT + 6 * C.INODE_SIZE)) * ww - 6;
      for (const id of II) W.wrap(il[id].v, iw);
      const ivh = Math.max(14, ...II.map((id) => W.most(il[id].v).h));
      yy = geo.iv + ivh;
      return yy - y;
    },
    place(s) {
      const q = geo.per.get(s);
      [0, 38, 150].forEach((o, j) => W.place(b0[j], p0x(o), geo.b0, j === 0 ? 'l' : 'c'));
      if (q) { for (const it of q.NM) W.place(fn[it.n], it.l, geo.fh + (geo.nr - 1 - it.row) * RH); for (const it of q.VL) W.place(fv[it.n], it.l, geo.fv + it.row * RH); }
      XI.forEach((id, e) => W.place(xl[id], geo.x0, geo.xr[e].lb));
      for (const q2 of geo.ist) W.place(il[q2.id].n, q2.l, geo.ih + (geo.inr - 1 - q2.row) * RH);
      II.forEach((id, k2) => { const o = C.INODE_AT + k2 * C.INODE_SIZE; W.place(il[id].v, ix(o) + 2, geo.iv); });
    },
    pose(s, P) {
      const f = fileOfS(s), own = ownerOf(f), xd = f.p0.f.xdes;
      /* page 0 띠 */
      let [r0, r1] = W.R.sp0, i = r0;
      const segs = [[0, 38, FAINT], [38, 150, INK], ...xd.map((x, e) => [150 + 40 * e, 190 + 40 * e, x.XDES_STATE === 'XDES_NOT_INITED' ? FAINT : ACCENT])];
      const per0 = Math.floor((r1 - r0) / segs.length);
      for (const [a0, a1, c] of segs) for (let m = 0; m < per0 && i < r1; m++, i++) { const [x, y] = rim((p0x(a0) + p0x(a1)) / 2, geo.p0 + 6, Math.max(2, p0x(a1) - p0x(a0) - 2), 12, per0, m), [xx, yy] = P.into(i, x, y); W.put(P.o, i, xx, yy, P.level('xd', touchOf(s, 'xd')) * P.form * (c === FAINT ? 0.5 : 0.85), 0, 0.02, 1.05, c); }
      /* FSP header 칸 */
      [r0, r1] = W.R.sph; i = r0;
      for (const [n, o, w] of C.FSP_FIELDS) {
        const hot = hotF(s, n), v = valOf(s, n), col = hot ? GOLD : v ? INK : FAINT;
        for (let m = 0; m < 30 && i < r1; m++, i++) { const [x, y] = rim(fx(o + w / 2), geo.fb + geo.fbh / 2, Math.max(2, fx(o + w) - fx(o) - 2), geo.fbh, 30, m), [xx, yy] = P.into(i, x, y); W.put(P.o, i, xx, yy, P.level('fsA', hot) * P.form * (v ? 0.9 : 0.4), hot ? 0.5 : 0, 0.02, 1.05, col); }
      }
      /* extent 줄 — 0 · 1 은 page 칸, 2–8 은 아직 깔리지 않은 한 줄 */
      [r0, r1] = W.R.spx; i = r0;
      for (let e = 0; e < 2; e++) {
        const x = xd[e], y = geo.xr[e].y, hot = touchOf(s, 'xd') && hotIt(s, 'xd', XI[e]);
        for (let p = 0; p < 64; p++) {
          const pg = e * 64 + p, inFile = pg < f.nPages, used = x && x.used.includes(pg), o = own[pg] || (pg < 3 ? 'sys' : e === 1 && x && x.XDES_STATE === 'XDES_FSEG' && used ? 'PRIMARY leaf' : null);
          const col = !used ? FAINT : o === 'sys' ? FAINT : SEGC[o] ?? INK, a = !x ? 0 : !inFile ? 0.12 : used ? 0.95 : 0.35;
          for (let m = 0; m < 4 && i < r1; m++, i++) {
            const px2 = cx(p) + (used ? 1 + (m % 2) * (geo.cw - 3) * 0.5 + (geo.cw - 3) * 0.25 : m % 2 ? geo.cw - 2 : 1), py2 = y + (used ? (Math.floor(m / 2) + 0.5) / 2 * geo.ch : (m < 2 ? 0 : geo.ch));
            const [xx, yy] = P.into(i, px2, py2);
            W.put(P.o, i, xx, yy, a * P.level('xd', hot) * P.form, used && hot ? 0.4 : 0, 0.02, used ? Math.max(1.2, geo.cw * 0.42) : 1, col);
          }
        }
      }
      { const y = geo.xr[2].y, rest = xd.length > 2, hot = touchOf(s, 'xd') && hotIt(s, 'xd', XI[2]);
        for (let m = 0; m < 120 && i < r1; m++, i++) { const [x, y2] = rim(geo.x0 + 32 * geo.cw, y + geo.ch / 2, 64 * geo.cw - 2, geo.ch, 120, m), [xx, yy] = P.into(i, x, y2); W.put(P.o, i, xx, yy, (rest ? 0.45 : 0.12) * (m % 2) * P.level('xd', hot) * P.form, 0, 0.02, 1, FAINT); } }
      /* inode 여섯 칸 */
      [r0, r1] = W.R.spi; i = r0;
      II.forEach((id, k2) => {
        const it = (s.ino || []).find((x) => x.id === id), hot = touchOf(s, 'ino') && hotIt(s, 'ino', id), o = C.INODE_AT + k2 * C.INODE_SIZE, role = roleOf(f, C.lead(id.split('seg')[1] || '') || k2 + 1);
        const col = hot ? GOLD : SEGC[role] ?? INK;
        for (let m = 0; m < 40 && i < r1; m++, i++) { const [x, y] = rim((ix(o) + ix(o + C.INODE_SIZE)) / 2, geo.ib + geo.ibh / 2, ix(o + C.INODE_SIZE) - ix(o) - 3, geo.ibh, 40, m), [xx, yy] = P.into(i, x, y); W.put(P.o, i, xx, yy, (it ? 0.85 : 0.3) * P.level('ino', hot) * P.form, hot ? 0.4 : 0, 0.02, 1.05, col); }
      });
    },
    draw(ctx, s, O) {
      const f = fileOfS(s), q = geo.per.get(s);
      ctx.setLineDash([]); ctx.strokeStyle = O.css.faint; ctx.globalAlpha = 0.3 * O.o;
      if (q) { for (const it of q.NM) { const ly = geo.fh + (geo.nr - 1 - it.row) * RH + RH - 2; if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, ly, it.cx, geo.fb - 1); } for (const it of q.VL) if (it.row > 0 || it.cx < it.l || it.cx > it.r) seg(ctx, it.cx, geo.fb + geo.fbh + 1, it.cx, geo.fv + it.row * RH + 1); }
      for (const q2 of geo.ist || []) if (q2.row > 0) seg(ctx, q2.cx, geo.ih + (geo.inr - 1 - q2.row) * RH + RH - 2, q2.cx, geo.ib - 1);
      /* FSP header 가 page 0 띠의 38 – 149 를 확대한 것 */
      ctx.globalAlpha = 0.25 * O.o; seg(ctx, p0x(38), geo.p0 + 12, geo.x0, geo.fh - 2); seg(ctx, p0x(150), geo.p0 + 12, geo.x0 + geo.ww, geo.fh - 2);
      /* 목록의 머리 — FREE_FRAG → 0:158(XDES 0 + 8), SEG_INODES_FREE → 2:38 */
      for (const [n, pg, by] of [['FREE_FRAG', 0, 158], ['SEG_INODES_FREE', 2, 38]]) {
        const v = valOf(s, n);
        if (!v || !/→/.test(v)) continue;
        const [, o, w] = C.FSP_FIELDS.find((x) => x[0] === n), xa = fx(o + w / 2), hot = hotF(s, n);
        ctx.globalAlpha = (hot ? 0.85 : 0.3) * O.o; ctx.strokeStyle = hot ? O.css.gold : O.css.faint;
        if (pg === 0) { const xb = p0x(by); ctx.beginPath(); ctx.moveTo(xa, geo.fb); ctx.bezierCurveTo(xa, geo.fb - 30, xb, geo.p0 + 40, xb, geo.p0 + 12); ctx.stroke(); arrowHead(ctx, xb, geo.p0 + 12, -Math.PI / 2, 4); }
        else { const xb = ix(by); ctx.beginPath(); ctx.moveTo(xa, geo.fb + geo.fbh); ctx.bezierCurveTo(xa, geo.ib - 40, xb, geo.ib - 30, xb, geo.ib); ctx.stroke(); arrowHead(ctx, xb, geo.ib, Math.PI / 2, 4); }
      }
      /* inode → 그 segment 의 낱장 page(extent 0 · 1 의 칸). NOT_FULL extent 는 그 줄 전체로 */
      II.forEach((id, k2) => {
        const node = f.p2.f[k2];
        if (!node) return;
        const hot = touchOf(s, 'ino') && hotIt(s, 'ino', id), o = C.INODE_AT + k2 * C.INODE_SIZE, xa = (ix(o) + ix(o + C.INODE_SIZE)) / 2;
        ctx.globalAlpha = (hot ? 0.55 : 0.12) * O.o; ctx.strokeStyle = hot ? O.css.gold : O.css.faint;
        for (const pg of node.frag) { const e = Math.floor(pg / 64); if (e > 1) continue; const xb = cx(pg) + geo.cw / 2, yb = geo.xr[e].y + geo.ch; ctx.beginPath(); ctx.moveTo(xa, geo.ib); ctx.bezierCurveTo(xa, geo.ib - 24, xb, yb + 24, xb, yb + 1); ctx.stroke(); }
        if (node.FSEG_NOT_FULL.len) { const yb = geo.xr[1].y + geo.ch; ctx.beginPath(); ctx.moveTo(xa, geo.ib); ctx.bezierCurveTo(xa, geo.ib - 24, geo.x0 + 32 * geo.cw, yb + 30, geo.x0 + 32 * geo.cw, yb + 1); ctx.stroke(); }
      });
    },
    anchor(a, s) {
      if (!geo) return null;
      if (a === 'fsA' || a === 'fsL') { const n = C.FSP_FIELDS.find(([n2]) => hotF(s, n2)) || C.FSP_FIELDS[2]; return [fx(n[1] + n[2] / 2), geo.fb + geo.fbh / 2]; }
      if (a === 'xd') { const e = Math.max(0, XI.findIndex((id) => hotIt(s, 'xd', id))); return [geo.x0 + 16 * geo.cw, geo.xr[e].y + geo.ch / 2]; }
      if (a === 'ino') { const k2 = Math.max(0, II.findIndex((id) => hotIt(s, 'ino', id))); return [ix(C.INODE_AT + k2 * C.INODE_SIZE + 96), geo.ib + geo.ibh / 2]; }
      return null;
    },
  };
};
