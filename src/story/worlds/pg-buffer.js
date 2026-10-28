/* postgres buffer — 02 장면부터 모든 장면이 같은 세계를 쓴다(01 은 시계 전용 세계 pg-buffer-01). 장면이 쓰는 배우만 그린다.
   그리는 것은 모두 bake 상태에서 읽는다 —
     · state 워드 = kv 에 refcount · usage_count · flags 가 있으면 32 비트 띠. 왼쪽이 31 번 비트 — 플래그 10 · usage 4 · refcount 18 칸.
       켠 플래그의 이름은 플래그 칸 오른쪽에 한 열로 쌓고 ㄱ 자 선으로 제 비트에 잇는다 — 아래 줄일수록 오른쪽 칸이라 선이 서로
       건너지 않는다(비트 위에 줄 나누기로 쌓았더니 1512 에서 지시선이 옆 이름을 관통했다).
       워드의 16진 값은 제목 줄 오른쪽, 그 밖의 키는 띠 아래 한 줄
     · list 항목의 u(usage_count) · pin(참조 수) = 칸 아래의 점. 다섯 칸 중 u 개를 채우고, 핀은 그 오른쪽 금빛 점
     · kv 의 값이 칸 줄 항목의 id 와 같으면(바늘 · 청소 위치) 그 칸 아래 화살표 — 값이 바뀌면 옛 칸에서 미끄러진다
     · list 항목의 io = 한 I/O 로 묶인 칸들. 칸 아래 괄호, 그 id 를 가진 다른 칸 줄의 항목(진행 중 I/O)으로 선을 잇는다
     · 나머지 kv 는 글 블록, 나머지 list 는 칸 줄. 공유 메모리 쪽 칸 줄과 디스크 쪽 칸 줄 사이에 점선(버퍼 → 파일)
     · 셈 맞추기 — 모르는 플래그 · 비트 순서가 어긋난 플래그 · 18 비트를 넘는 refcount · 5 를 넘는 usage_count,
       sub 의 'usage N' · '핀 N' 이 u · pin 과 다르면 console.error 로 알린다,
       글 블록의 'state 워드' 에 적은 0x… 가 그림의 띠(state kv 로 셈한 값)와 다르면 그것도 알린다
   손잡이가 있는 장면(02 shared_buffers)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const SL = 44, TOK = 150, PIPS = 8, PTRN = 10, ION = 60, BITN = 6;
const TRI = [[0, 0], [-0.5, 1], [0.5, 1], [-1, 2], [0, 2], [1, 2], [-1.5, 3], [-0.5, 3], [0.5, 3], [1.5, 3]];
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
/* dirty 는 빨강 — 01 의 세계(pg-buffer-01)와 같은 색. 금색이면 05 의 dirty buf 3 · 4 · 6 과 핀이 걸린 buf 7 이 똑같아 보였다 */
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, hdr: ACCENT, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
/* buf_internals.h 의 플래그 — 22 번 비트부터 차례로(BM_LOCKED (1U << 22) … BM_PERMANENT (1U << 31)) */
const FLAGS = ['BM_LOCKED', 'BM_DIRTY', 'BM_VALID', 'BM_TAG_VALID', 'BM_IO_IN_PROGRESS', 'BM_IO_ERROR', 'BM_JUST_DIRTIED', 'BM_PIN_COUNT_WAITER', 'BM_CHECKPOINT_NEEDED', 'BM_PERMANENT'];
const RC_BITS = 18, UC_BITS = 4, MAX_UC = 5;
const SKEYS = ['refcount', 'usage_count', 'flags'];
const WKEY = 'state 워드';
const flagsOf = (v) => { const t = bare(v).trim(); return !t || t === '—' ? [] : t.split(/\s*·\s*/); };
const intOf = (v) => { const m = /-?\d+/.exec(bare(v)); return m ? parseInt(m[0], 10) : null; };
/* 워드 → 칸(왼쪽이 31 번 비트) */
const wordOf = (kv) => {
  const rc = intOf(kv.refcount) ?? 0, uc = intOf(kv.usage_count) ?? 0, fl = flagsOf(kv.flags);
  let w = rc + uc * 2 ** RC_BITS;
  for (const f of fl) { const i = FLAGS.indexOf(f); if (i >= 0) w += 2 ** (22 + i); }
  return { rc, uc, fl, w, bit: (c) => Math.floor(w / 2 ** (31 - c)) % 2 };
};
const hex = (w) => '0x' + w.toString(16).toUpperCase().padStart(8, '0');
/* 칸 → 필드 : 0~9 flags · 10~13 usage_count · 14~31 refcount */
const fieldOf = (c) => (c < 10 ? 2 : c < 14 ? 1 : 0);
/* sub 의 글에서 읽은 usage · 핀 — 'usage 3 → 2' 는 화살표 뒤의 값 */
const subUsage = (s) => { const m = /usage\s+(\d+)(?:\s*→\s*(\d+))?/.exec(s || ''); return m ? +(m[2] ?? m[1]) : null; };
const subPin = (s) => { const m = /핀\s+(\d+)/.exec(s || ''); return m ? +m[1] : null; };

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
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
  const KV = cast.filter((a) => A[a].kind === 'kv');
  const STATES = KV.filter((a) => all.some((s) => SKEYS.every((k) => k in s[a])));
  const TEXTS = KV.filter((a) => !STATES.includes(a));
  const ROWS = cast.filter((a) => A[a].kind === 'list');
  const ids = (a) => [...new Set(all.flatMap((s) => (s[a] || []).map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  const hasU = Object.fromEntries(ROWS.map((a) => [a, all.some((s) => s[a].some((x) => x.u != null || x.pin != null))]));
  const hasIo = Object.fromEntries(ROWS.map((a) => [a, all.some((s) => s[a].some((x) => x.io != null))]));
  /* 화살표 — kv 의 값이 어느 칸 줄의 항목 id 와 같은 적이 있는 키 */
  const rowOfId = (v) => ROWS.find((a) => RIDS[a].includes(bare(v)));
  const PTRS = TEXTS.flatMap((a) => [...new Set(all.flatMap((s) => Object.keys(s[a]).filter((k) => rowOfId(s[a][k]))))].map((k) => ({ a, k })));
  const ptrRow = Object.fromEntries(ROWS.map((r) => [r, PTRS.some(({ a, k }) => all.some((s) => rowOfId(s[a][k]) === r))]));
  const rest = (kv) => Object.fromEntries(Object.entries(kv).filter(([k]) => !SKEYS.includes(k)));
  /* 칸 줄은 메모리 쪽끼리, 디스크 쪽끼리 묶는다 — 점선이 둘 사이에 선다 */
  const DISK = new Set(ROWS.filter((a) => A[a].lane === 'disk'));
  const MEMR = ROWS.filter((a) => !DISK.has(a)), DSKR = ROWS.filter((a) => DISK.has(a));

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    const at = `pg buffer ${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    for (const a of STATES) {
      const { rc, uc, fl } = wordOf(s[a]);
      fl.forEach((f, j) => {
        if (!FLAGS.includes(f)) console.error(`${at} 의 ${a} : 모르는 플래그 ${f}`);
        else if (j && FLAGS.indexOf(f) < FLAGS.indexOf(fl[j - 1])) console.error(`${at} 의 ${a} : 플래그는 비트 순서대로 — ${fl[j - 1]} 다음에 ${f}`);
      });
      if (rc < 0 || rc >= 2 ** RC_BITS) console.error(`${at} 의 ${a} : refcount ${rc} 가 ${RC_BITS} 비트를 넘는다`);
      if (uc < 0 || uc > MAX_UC) console.error(`${at} 의 ${a} : usage_count ${uc} 가 BM_MAX_USAGE_COUNT ${MAX_UC} 를 넘는다`);
    }
    for (const a of ROWS) for (const x of s[a]) {
      const su = subUsage(x.sub), sp = subPin(x.sub);
      if (su != null && su !== x.u) console.error(`${at} 의 ${a} ${x.id} : sub 는 usage ${su} 인데 u 는 ${x.u}`);
      if (x.u != null && (x.u < 0 || x.u > MAX_UC)) console.error(`${at} 의 ${a} ${x.id} : u ${x.u} 가 0~${MAX_UC} 밖이다`);
      if ((sp ?? 0) !== (x.pin ?? 0)) console.error(`${at} 의 ${a} ${x.id} : sub 는 핀 ${sp ?? 0} 인데 pin 은 ${x.pin ?? 0}`);
    }
    /* 잰 워드(또는 규칙으로 계산한 워드)를 글로 적었으면 그림의 띠가 같은 값이어야 한다 — 03 의 MEASURED · state 워드 */
    for (const a of TEXTS) {
      const m = /0x[0-9A-F]{8}/i.exec(bare(s[a][WKEY] ?? ''));
      if (!m) continue;
      if (!STATES.length) console.error(`${at} 의 ${a} : ${WKEY} ${m[0]} 를 적었는데 그릴 state 워드가 없다`);
      for (const b of STATES) if (hex(wordOf(s[b]).w) !== m[0].toUpperCase().replace('0X', '0x'))
        console.error(`${at} 의 ${a} : ${WKEY} ${m[0]} 인데 ${b} 의 띠는 ${hex(wordOf(s[b]).w)}`);
    }
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  for (const a of STATES) take('w:' + a, 32 * BITN);
  for (const a of ROWS) RIDS[a].forEach((id) => { take(a + ':' + id, SL); if (hasU[a]) take('u:' + a + ':' + id, PIPS); });
  for (const a of ROWS) if (hasIo[a]) take('io:' + a, ION);
  PTRS.forEach(({ a, k }) => take('p:' + a + '.' + k, PTRN));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('pg buffer 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표(DOM) ── */
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
  const W = Object.fromEntries(STATES.map((a) => [a, {
    hex: label('aq'), dig: Array.from({ length: 32 }, () => label('aq aq-c')),
    fl: Object.fromEntries(FLAGS.map((f) => [f, label('aq')])), fd: [0, 1, 2].map(() => label('aq')), cap: label('aq ml aq-b'),
  }]));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  /* 빈 칸 줄의 '—' 는 칸이 설 자리(제목 바로 아래 왼쪽)에 — 설명 자리에 두었더니 02 의 RING 은 제목에서 270 px, 06 의 READ STREAM 은 75 px 아래에 떴다 */
  const emp = Object.fromEntries(ROWS.map((a) => [a, label('aq')]));
  const pLb = Object.fromEntries(PTRS.map(({ a, k }) => [a + '.' + k, label('aq')]));
  const edgeLb = label('aq'), tok = label('stn-tok');

  /* 스텝마다의 글과 강조 — [글, 또렷한가, 색, 보이나, html] */
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, sep = '\n', hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join(sep);
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  /* 화살표가 가리키는 칸 — 같은 칸을 가리키는 키는 이름표 하나로 */
  const ptrsOf = (s) => {
    const by = new Map();
    for (const { a, k } of PTRS) { const r = rowOfId(s[a][k]); if (!r || !s[r].some((x) => x.id === bare(s[a][k]))) continue; const key = r + ':' + bare(s[a][k]); if (!by.has(key)) by.set(key, { r, id: bare(s[a][k]), ks: [] }); by.get(key).ks.push({ a, k }); }
    return [...by.values()];
  };
  const texts = (S, S0) => S.map((s, i) => {
    const t = new Map(), on = (a) => s.touch.has(a), pv = i ? S[i - 1] : S0;
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], '\n', focusOf(s, a)), on(a), '', true, true]);
    for (const a of STATES) {
      const w = wordOf(s[a]), w0 = wordOf(pv[a]), L = W[a];
      t.set(L.hex, [`state ${hex(w.w)}`, on(a), w.w !== w0.w ? 'gold' : '']);
      for (let c = 0; c < 32; c++) t.set(L.dig[c], [String(w.bit(c)), on(a) && w.bit(c) === 1, w.bit(c) !== w0.bit(c) ? 'gold' : '']);
      FLAGS.forEach((f) => { const has = w.fl.includes(f); t.set(L.fl[f], [has ? f : '', on(a), has && !w0.fl.includes(f) ? 'gold' : '', has]); });
      /* 필드 이름에 비트 폭(buf_internals.h 의 BUF_*_BITS) — 03/1 의 '세 칸' 이 몇 비트씩인지 띠만으로는 안 보였다.
         값에 |gold 를 달면 그 필드를 밝힌다 — 03/9 의 refcount 2 처럼 바뀌지 않았는데 요점인 값 */
      t.set(L.fd[0], [`refcount ${w.rc}  (${RC_BITS} 비트)`, on(a), tone(s[a].refcount) || (w.rc !== w0.rc ? 'gold' : '')]);
      t.set(L.fd[1], [`usage_count ${w.uc}  (${UC_BITS} 비트)`, on(a), tone(s[a].usage_count) || (w.uc !== w0.uc ? 'gold' : '')]);
      t.set(L.fd[2], [`flags  (${32 - RC_BITS - UC_BITS} 비트)`, on(a), tone(s[a].flags) || (w.fl.join() !== w0.fl.join() ? 'gold' : '')]);
      const r = rest(s[a]);
      t.set(L.cap, [kvHtml(r, '    '), on(a), '', Object.keys(r).length > 0, true]);
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && (it.tag === 'x' || it.tag === 'red') ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]), on(a), '', true, true]);
      t.set(emp[a], ['—', on(a), '', !s[a].length]);
    }
    const P = ptrsOf(s), lead = new Map(P.map((g) => [g.ks[0].a + '.' + g.ks[0].k, g]));
    for (const { a, k } of PTRS) {
      const g = lead.get(a + '.' + k), hot = g && g.ks.some((q) => on(q.a) && modOf(s, q.a).has(q.k));
      t.set(pLb[a + '.' + k], [g ? g.ks.map((q) => q.k).join(' · ') : '', !!g && g.ks.some((q) => on(q.a)), hot ? 'gold' : '', !!g]);
    }
    /* 점선은 메모리 쪽 칸 줄과 디스크 쪽 칸 줄이 둘 다 있을 때만 — 03 처럼 칸 줄이 없으면 이름표도 없다 */
    if (EDGE) t.set(edgeLb, [EDGE.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '', MEMR.length > 0 && DSKR.length > 0]);
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S, b.S0);
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
  const RH = 15, UH = 10, IH = 9;
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {}, state: {}, ptr: {} };
    let tn = Math.max(1, Math.min(3, TEXTS.length));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const tW = (ww - (tn - 1) * gap) / tn;
    for (const a of TEXTS) wrap(tx[a], tW);
    const tRows = Math.ceil(TEXTS.length / tn), tHs = Array.from({ length: tRows }, (_, r) => hMax(TEXTS.slice(r * tn, r * tn + tn).map((a) => tx[a])));
    const wc = new Map();
    const wOf = (lb, html) => {
      if (!html) return 0;
      let m = wc.get(lb);
      if (!m) wc.set(lb, (m = new Map()));
      if (!m.has(html)) { const keep = lb.el.innerHTML; lb.el.innerHTML = html; m.set(html, lb.el.getBoundingClientRect().width); lb.el.innerHTML = keep; }
      return m.get(html);
    };
    const g2 = (T, lb) => { const e = T.get(lb); return e && e[3] !== false ? e[0] : ''; };
    /* state 워드 — 켠 플래그 이름을 스텝마다 그 비트 위에 줄 나누어 놓는다 */
    const cw = ww / 32, cx = (c) => L.x0 + (c + 0.5) * cw;
    const SW = {};
    for (const a of STATES) {
      wrap(W[a].cap, ww);
      /* 켠 플래그 — 낮은 비트(오른쪽 칸)부터 아래 줄. 열은 플래그 칸(0~9) 오른쪽 */
      let fr = 1;
      const per = new Map(), xL = L.x0 + 10 * cw + 12, flW = Math.max(0, ...FLAGS.map((f) => most(W[a].fl[f]).w));
      if (xL + flW > L.x1 + 1) console.error(`pg buffer ${sc.num} 세계 : 플래그 이름 열(${Math.round(xL)} + ${Math.round(flW)})이 무대 오른쪽 ${Math.round(L.x1)} 을 넘는다 (${L.W}×${L.H})`);
      for (const b of BAKES.values()) b.S.forEach((s) => {
        const on = wordOf(s[a]).fl.filter((f) => FLAGS.includes(f)).map((f) => ({ id: f, c: 31 - (22 + FLAGS.indexOf(f)) })).sort((p, q) => q.c - p.c);
        fr = Math.max(fr, on.length);
        per.set(s, on.map((q, row) => ({ ...q, row, cx: cx(q.c) })));
      });
      const fdW = [0, 1, 2].map((i) => most(W[a].fd[i]).w);
      /* 필드 이름표 — usage_count 칸(4 칸)이 좁으면 refcount 이름표를 오른쪽 끝으로 민다 */
      const FD = stagger([[0, (14 + 32) / 2], [1, 12], [2, 5]].map(([i, c]) => ({ id: i, cx: L.x0 + c * cw, w: fdW[i] })), L.x0, L.x1);
      SW[a] = { fr, per, xL, fd: FD.out, fdr: FD.rows, capH: most(W[a].cap).h };
    }
    /* 칸 폭 — 이름표 + 여백, usage 점이 있으면 46 이상. 줄이 무대보다 넓으면 여백을 줄인다(1024 의 무대는 442) */
    const swOf = (a, pad, mn) => Object.fromEntries(RIDS[a].map((id) => [id, Math.max(mn, Math.ceil(most(rowLb[a][id]).w) + pad)]));
    const sw = Object.fromEntries(ROWS.map((a) => { let m = swOf(a, 14, hasU[a] ? 46 : 30); if (RIDS[a].reduce((t, id) => t + m[id] + 6, -6) > ww) m = swOf(a, 6, hasU[a] ? 40 : 24); return [a, m]; }));
    const rc = ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    /* 칸 줄 둘을 한 줄에 — 둘 다 반 폭 단에 칸이 다 들어갈 때만(1024 에서 칸 다섯인 READ STREAM 이 옆 단을 덮었다) */
    const used = (a) => RIDS[a].reduce((t, id) => t + sw[a][id] + 6, -6);
    const chunks = (rs) => { const o = []; const n = rc > 1 && rs.length >= 2 && rs.every((a) => used(a) <= rW) ? rc : 1; for (let i = 0; i < rs.length; i += n) o.push(rs.slice(i, i + n)); return o; };
    const BANDS = [...chunks(MEMR).map((c) => ({ c, disk: false })), ...chunks(DSKR).map((c) => ({ c, disk: true }))];
    const colW = (band) => (band.c.length > 1 ? rW : ww);
    const rowW = Object.fromEntries(BANDS.flatMap((band) => band.c.map((a) => [a, colW(band)])));
    for (const a of ROWS) if (used(a) > rowW[a] + 1) console.error(`pg buffer ${sc.num} 세계 : ${a} 칸 줄 ${Math.round(used(a))} 가 단 ${Math.round(rowW[a])} 보다 넓다 (${L.W}×${L.H})`);
    /* 화살표 이름표 — 스텝마다 칸 아래 줄 나누기. 칸 줄의 왼쪽 끝이 0 */
    const slotX = (s, a, id) => { let x = 0; for (const it of s[a]) { const w = sw[a][it.id]; if (it.id === id) return x + w / 2; x += w + 6; } return null; };
    let pr = 1;
    for (const b of BAKES.values()) b.PL = b.S.map((s, kk) => {
      const T = b.TX[kk], P = ptrsOf(s), out = {};
      for (const r of ROWS) {
        if (!ptrRow[r]) continue;
        const q = P.filter((g) => g.r === r).map((g) => { const lb = pLb[g.ks[0].a + '.' + g.ks[0].k]; return { lb, g, cx: slotX(s, r, g.id), w: wOf(lb, g2(T, lb)) }; }).filter((x) => x.w && x.cx != null);
        const st = stagger(q, 0, rowW[r]);
        pr = Math.max(pr, st.rows); out[r] = st.out;
      }
      return out;
    });
    /* 칸 아래 덧붙는 높이 — usage 점, I/O 괄호, 화살표와 그 이름표 */
    const extra = (a) => (hasU[a] ? UH : 0) + (hasIo[a] ? IH : 0) + (ptrRow[a] ? 10 + pr * RH : 0);
    const rcH = {}, rSide = {};
    for (const band of BANDS) for (const a of band.c) {
      const W0 = colW(band), u0 = used(a), sideW = W0 - Math.max(0, u0) - 12;
      wrap(rowCap[a], W0); const hb = most(rowCap[a]).h;
      let hs = Infinity;
      if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      const box = 26 + extra(a);
      rSide[a] = Math.max(box, hs) < box + 8 + hb ? Math.max(0, u0) + 12 : 0;
      if (!rSide[a]) wrap(rowCap[a], W0);
      rcH[a] = rSide[a] ? hs : hb;
    }
    const lay = (y0, k = 1) => {
      let y = y0;
      const rowY = [y]; for (let r = 0; r < tRows; r++) rowY.push(rowY[r] + HD + tHs[r] + 12 * k);
      TEXTS.forEach((a, i) => { const x = L.x0 + (i % tn) * (tW + gap), yy = rowY[Math.floor(i / tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + tW - 18, y: yy + 8 }; });
      y = rowY[tRows];
      for (const a of STATES) {
        place(hd[a], L.x0, y); place(W[a].hex, L.x1, y, 'r', 't');
        y += HD + SW[a].fr * RH + 14;
        G.state[a] = { y, cw, ...SW[a] }; G.anc[a] = { x: L.x0 + ww / 2, y };
        y += 12 + 6; G.state[a].fdY = y; y += SW[a].fdr * RH + 4;
        G.state[a].capY = y; y += SW[a].capH > 1 ? SW[a].capH + 6 : 0;
        y += 12 * k;
      }
      G.edgeY = null;
      for (const band of BANDS) {
        if (band.disk && G.edgeY == null && MEMR.length) { y += 4 * k; G.edgeY = y; if (EDGE) place(edgeLb, L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
        let hh = 0;
        band.c.forEach((a, j) => {
          const x0 = L.x0 + j * (rW + gap), box = 26 + extra(a);
          place(hd[a], x0, y); place(emp[a], x0 + 4, y + HD + 13, 'l', 'c'); G.slot[a] = { x0, y: y + HD, sw: sw[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + 13 };
          if (rSide[a]) { place(rowCap[a], x0 + rSide[a], y + HD + 4); hh = Math.max(hh, HD + Math.max(box, rcH[a] + 4)); }
          else { place(rowCap[a], x0, y + HD + box + 8); hh = Math.max(hh, HD + box + 8 + rcH[a]); }
        });
        y += hh + 14 * k;
      }
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`pg buffer ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    HT = total;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  /* 칸 아래 덧붙는 것들의 y — 점 · 괄호 · 화살표 */
  const pipY = (a) => G.slot[a].y + 26 + 4;
  const ioY = (a) => G.slot[a].y + 26 + (hasU[a] ? UH : 0) + 4;
  const ptrY = (a) => G.slot[a].y + 26 + (hasU[a] ? UH : 0) + (hasIo[a] ? IH : 0) + 4;
  const cellX = (c) => G.L.x0 + (c + 0.5) * (G.L.x1 - G.L.x0) / 32;
  function anchor(a, s, lbText, prev) {
    if (ROWS.includes(a)) {
      const id = RIDS[a].filter((x) => (lbText || '').includes(x)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, a)][0];
      const P = id ? rowSlot(s, a, id) : null;
      if (P) return [P.x, P.y];
    }
    if (STATES.includes(a) && G.state[a]) {
      /* 이름표가 플래그를 말하면 그 비트, 아니면 이번에 바뀐 비트들의 가운데 */
      const f = FLAGS.find((q) => (lbText || '').includes(q));
      if (f) return [cellX(31 - (22 + FLAGS.indexOf(f))), G.state[a].y];
      const w = wordOf(s[a]), w0 = prev ? wordOf(prev[a]) : w, cs = [];
      for (let c = 0; c < 32; c++) if (w.bit(c) !== w0.bit(c)) cs.push(c);
      if (cs.length) return [cs.reduce((t, c) => t + cellX(c), 0) / cs.length, G.state[a].y];
    }
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
  /* 한 칸 줄에서 io 가 같은 이웃 칸들 — [io, 첫 칸, 끝 칸] */
  const ioGroups = (s, a) => { const g = []; for (const it of s[a]) { if (it.io == null) continue; const last = g[g.length - 1]; if (last && last.io === it.io) last.ids.push(it.id); else g.push({ io: String(it.io), ids: [it.id] }); } return g; };
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const { S, S0, NK } = cur, end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const src = act ? anchor(act.f, s, act.lb, prev) : null, mv = show(p, 0.12, 0.42);
    const level = (a, id) => (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
    /* state 워드 — 켠 비트는 칸 바닥의 막대(알갱이 여섯), 끈 비트는 흐린 점 하나. 이번에 바뀐 비트는 금빛.
       눈금 셋 · 1px 로 그렸더니 이 장면의 주인공인 띠가 1512 에서 거의 보이지 않았다 */
    for (const a of STATES) {
      const [b0] = R['w:' + a], w = wordOf(s[a]), w0 = wordOf(prev[a]), on = s.touch.has(a) && !end, gap = Math.min(3, G.state[a].cw / 8);
      for (let c = 0; c < 32; c++) for (let m = 0; m < BITN; m++) {
        const i = b0 + c * BITN + m, bit = w.bit(c), ch = bit !== w0.bit(c) && on;
        if (!bit && m) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const [x, y] = into(i, cellX(c) + (bit ? (m - (BITN - 1) / 2) * gap : 0), G.state[a].y + 10);
        put(o, i, x, y, (bit ? (on ? 0.95 : 0.65) : ch ? 0.7 : 0.3) * dim * form, ch ? 0.5 : 0, 0.02, bit ? 2.2 : 1.4, ch ? GOLD : bit ? (fieldOf(c) === 2 ? ACCENT : INK) : FAINT);
      }
    }
    /* 칸 줄 + usage 점 · 핀 점 */
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); if (hasU[a]) hide('u:' + key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); if (hasU[a]) hide('u:' + key); continue; }
      const born = it && !pv && !end, from = born && act && act.t === a ? src : null, gone = it ? 0 : show(p, 0.1, 0.4);
      box(o, R[key][0], SL, P, P.w, 24, (it || pv).tag, level(a, id), it && modOf(s, a).has(id) && !end, from, gone, into, fly);
      if (!hasU[a]) continue;
      const x0 = R['u:' + key][0], q = it || pv, u = q.u, pin = q.pin ?? 0, u0 = pv ? pv.u : u, lit = s.touch.has(a) && !end;
      for (let m = 0; m < PIPS; m++) {
        const i = x0 + m;
        if (u == null || (m >= MAX_UC && m - MAX_UC >= pin)) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        /* usage 다섯 칸(채운 것 2.6px · 빈 것 1.8px), 그 오른쪽에 핀 수만큼 금빛 점 */
        const isPin = m >= MAX_UC, x = P.x + (isPin ? 14 + (m - MAX_UC) * 4 : (m - 2) * 5), [xx, yy] = into(i, x, pipY(a));
        const fill = isPin || m < u, ch = !isPin && lit && u0 != null && (m < u) !== (m < u0);
        put(o, i, xx, yy, (fill ? 1 : 0.45) * level(a, id) * (1 - gone), ch ? 0.5 : 0, 0.02, fill ? 2.6 : 1.8, isPin ? GOLD : ch ? GOLD : fill ? INK : FAINT);
      }
    }
    /* I/O 괄호 — 묶인 칸들의 아래 */
    for (const a of ROWS) {
      if (!hasIo[a]) continue;
      const [i0, i1] = R['io:' + a], gs = ioGroups(s, a), on = s.touch.has(a) && !end;
      let i = i0;
      const per = Math.max(6, Math.floor((i1 - i0) / Math.max(1, gs.length)));
      for (const g of gs) {
        const P0 = rowSlot(s, a, g.ids[0]), P1 = rowSlot(s, a, g.ids[g.ids.length - 1]), xa = P0.x - P0.w / 2, xb = P1.x + P1.w / 2, y = ioY(a);
        /* 이 스텝에 묶인 괄호는 금빛으로 굵게 — 06/3 의 '한 I/O 로 묶는다' 가 실선 한 가닥이라 거의 안 보였다 */
        const fresh = on && !g.ids.some((id) => prev[a].some((x) => x.id === id && String(x.io) === g.io));
        for (let m = 0; m < per && i < i1; m++, i++) {
          const u = m / (per - 1), [xx, yy] = into(i, U.lerp(xa, xb, u), y + (m === 0 || m === per - 1 ? -2 : 0));
          put(o, i, xx, yy, (fresh ? 1 : on ? 0.85 : 0.45) * dim * form, fresh ? 0.5 : 0, 0.02, fresh ? 1.8 : 1, fresh ? GOLD : ACCENT);
        }
      }
      for (; i < i1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    }
    /* 화살표 — 값이 바뀌면 옛 칸에서 미끄러진다 */
    for (const { a, k: key } of PTRS) {
      const [i0] = R['p:' + a + '.' + key], r = rowOfId(s[a][key]), id = bare(s[a][key]);
      const P = r ? rowSlot(s, r, id) : null;
      if (!P) { hide('p:' + a + '.' + key); continue; }
      const pid = bare(prev[a][key]), P0 = pid !== id && rowOfId(prev[a][key]) === r && !end ? rowSlot(prev, r, pid) : null;
      const x = P0 ? U.lerp(P0.x, P.x, mv) : P.x, y = ptrY(r), hot = s.touch.has(a) && !end && modOf(s, a).has(key);
      for (let m = 0; m < PTRN; m++) {
        const i = i0 + m, [col, row] = TRI[m];
        const [xx, yy] = into(i, x + col * 2.6, y + row * 2.2);
        put(o, i, xx, yy, (s.touch.has(a) && !end ? 0.95 : 0.55) * dim * form, hot ? 0.5 : 0, 0.02, 1.1, hot ? GOLD : ACCENT);
      }
    }
    /* act */
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, act.lb, prev), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
        /* 무대 위쪽 끝을 넘지 않는다 — 768×1024 에서 위 줄 글 블록 사이를 나는 덩어리가 그 위의 설명 글을 덮었다 */
        put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, Math.max(G.L.y0 + 4, U.lerp(fy, ty2, e) + Math.sin(th) * r - arc), (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, col);
      }
    } else hide('tok');
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, S0, NK, TX } = cur;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = TX[Math.min(k, NK - 1)], TB = TX[Math.min(next, NK - 1)], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
      }
      const s = S[kk];
      for (const a of STATES) {
        const g = G.state[a], L = W[a];
        for (const q of g.per.get(s) || []) place(L.fl[q.id], g.xL, g.y - 16 - q.row * RH, 'l', 'c');
        L.dig.forEach((lb, c) => place(lb, cellX(c), g.y, 'c', 'c'));
        for (const q of g.fd) place(L.fd[q.id], q.l, g.fdY + q.row * RH);
        place(L.cap, G.L.x0, g.capY);
      }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
      const PL = cur.PL[kk];
      for (const r of Object.keys(PL)) for (const q of PL[r]) place(q.lb, G.slot[r].x0 + q.l, ptrY(r) + 10 + q.row * RH);
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    const kq = Math.min(k, NK - 1), s = S[kq], act = k < NK && s.step.act ? s.step.act : null;
    let o = act ? show(p, 0.06, 0.12) * (1 - b) : 0;
    if (act) {
      const prev = kq > 0 ? S[kq - 1] : S0;
      const [fx, fy] = anchor(act.f, s, act.lb, prev), [tx2, ty2] = anchor(act.t, s, act.lb, prev), e = U.smooth(show(p, 0.08, 0.42));
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
    if (G.edgeY != null) { ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]); seg(ctx, L.x0, G.edgeY, L.x1, G.edgeY); ctx.setLineDash([]); }
    /* state 워드 — 칸 경계, 필드 사이는 진하게. 플래그 이름표의 지시선 */
    for (const a of STATES) {
      const g = G.state[a], cw = (L.x1 - L.x0) / 32;
      ctx.strokeStyle = css.faint;
      for (let c = 0; c <= 32; c++) { ctx.globalAlpha = (c === 0 || c === 10 || c === 14 || c === 32 ? 0.7 : 0.2) * o; seg(ctx, L.x0 + c * cw, g.y - 8, L.x0 + c * cw, g.y + 12); }
      /* 이름 → 제 비트 : 이름 왼쪽에서 가로로 그 칸 위까지, 거기서 칸으로 */
      for (const q of g.per.get(s) || []) {
        const y = g.y - 16 - q.row * RH;
        ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint;
        seg(ctx, g.xL - 4, y, q.cx, y); seg(ctx, q.cx, y, q.cx, g.y - 9);
      }
    }
    /* 줄을 내리거나 옆으로 민 화살표 이름표는 삼각형으로 잇는다 */
    ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint;
    for (const [r, qs] of Object.entries(cur.PL[kk])) for (const q of qs) {
      const x = G.slot[r].x0 + q.cx, y = ptrY(r) + 8;
      if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, x, y, x, ptrY(r) + 10 + q.row * RH - 1);
    }
    /* I/O 괄호 ↔ 진행 중 I/O 칸 */
    for (const a of ROWS) {
      if (!hasIo[a]) continue;
      for (const g of ioGroups(s, a)) {
        const r = ROWS.find((q) => q !== a && s[q].some((x) => x.id === g.io));
        if (!r) continue;
        const P0 = rowSlot(s, a, g.ids[0]), P1 = rowSlot(s, a, g.ids[g.ids.length - 1]), T = rowSlot(s, r, g.io);
        const x0 = (P0.x - P0.w / 2 + P1.x + P1.w / 2) / 2, y0 = ioY(a) + 2, hot = s.touch.has(r) && !end && hotIt(s, r, g.io);
        ctx.globalAlpha = (hot ? 0.55 : 0.25) * o; ctx.strokeStyle = css.accent;
        const ty = T.y + (T.y > y0 ? -12 : 14);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0, y0 + 30, T.x, ty + (T.y > y0 ? -30 : 30), T.x, ty); ctx.stroke();
      }
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
