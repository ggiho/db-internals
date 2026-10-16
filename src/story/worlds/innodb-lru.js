/* mysql innodb 05 · 05v · 06 — buffer pool 의 LRU 와 축출. 그리는 것은 모두 bake 상태에서 읽는다 —
     · LRU = sep 항목(midpoint)을 가진 frames 배우. 항목 순서가 LRU 의 자리이고(왼쪽이 head), sep 은 칸이 아니라 세로 경계다.
       경계 왼쪽이 young, 오른쪽이 old. sep 의 win 이 innodb_old_blocks_time(ms)
     · acc(첫 접근 뒤 경과 초)를 가진 페이지 = 칸 아래 시간 창 막대 — acc / win 만큼 채운다. 창을 넘으면 초록
     · kv 의 값이 칸 줄 항목의 id 와 같으면(훑는 곳) 그 칸 아래 화살표
     · 나머지 kv 는 글 블록(SQL 층), 나머지 list · frames 는 칸 줄. SQL 층과 InnoDB 사이 · 메모리와 디스크 사이에 점선
     · 셈 맞추기 — sep 이 둘 이상이거나, sub 가 'old' 로 시작하는 페이지가 경계 왼쪽(young)에 · 'young' 으로 시작하는 페이지가
       오른쪽(old)에 있거나, win 이 0 이 아닌데 시간 창 안(acc × 1000 < win)에서 old → young 으로 옮겨지면 console.error
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const SL = 44, TOK = 150, BARN = 16, PTRN = 10, SEPN = 24;
const TRI = [[0, 0], [-0.5, 1], [0.5, 1], [-1, 2], [0, 2], [1, 2], [-1.5, 3], [-0.5, 3], [0.5, 3], [1.5, 3]];
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };

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
  const ROWS = cast.filter((a) => A[a].kind !== 'kv');
  const LRU = ROWS.find((a) => all.some((s) => s[a].some((x) => x.tag === 'sep'))) || null;
  const ids = (a) => [...new Set(all.flatMap((s) => (s[a] || []).map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a).filter((id) => !(a === LRU && all.some((s) => s[a].some((x) => x.id === id && x.tag === 'sep'))))]));
  const hasAcc = Object.fromEntries(ROWS.map((a) => [a, all.some((s) => s[a].some((x) => x.acc != null))]));
  const rowOfId = (v) => ROWS.find((a) => RIDS[a].includes(bare(v)));
  const PTRS = TEXTS.flatMap((a) => [...new Set(all.flatMap((s) => Object.keys(s[a]).filter((k) => rowOfId(s[a][k]))))].map((k) => ({ a, k })));
  const ptrRow = Object.fromEntries(ROWS.map((r) => [r, PTRS.some(({ a, k }) => all.some((s) => rowOfId(s[a][k]) === r))]));
  const sepOf = (s) => (LRU ? s[LRU].find((x) => x.tag === 'sep') : null);
  const sideOf = (s, id) => { if (!LRU) return null; const its = s[LRU], j = its.findIndex((x) => x.id === id), k = its.findIndex((x) => x.tag === 'sep'); return j < 0 || k < 0 ? null : j < k ? 'young' : 'old'; };

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i, arr) => {
    if (!LRU) return;
    const at = `innodb ${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    const seps = s[LRU].filter((x) => x.tag === 'sep');
    if (seps.length > 1) console.error(`${at} : midpoint 가 ${seps.length} 개다`);
    const sep = seps[0], win = sep ? sep.win ?? 0 : 0, pv = i ? arr[i - 1] : null;
    for (const it of s[LRU]) {
      if (it.tag === 'sep') continue;
      const side = sideOf(s, it.id);
      if (/^old\b/.test(it.sub) && side === 'young') console.error(`${at} : ${it.id} 의 sub 는 old 인데 경계 왼쪽(young)에 있다`);
      if (/^young\b/.test(it.sub) && side === 'old') console.error(`${at} : ${it.id} 의 sub 는 young 인데 경계 오른쪽(old)에 있다`);
      if (pv && win > 0 && sideOf(pv, it.id) === 'old' && side === 'young' && (it.acc == null || it.acc * 1000 < win)) console.error(`${at} : ${it.id} 가 시간 창(${win}ms) 안에서 young 으로 올라갔다 — acc ${it.acc}`);
    }
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  for (const a of ROWS) RIDS[a].forEach((id) => { take(a + ':' + id, SL); if (hasAcc[a]) take('b:' + a + ':' + id, BARN); });
  if (LRU) take('sep', SEPN);
  PTRS.forEach(({ a, k }) => take('p:' + a + '.' + k, PTRN));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb lru 세계 : 알갱이가 모자란다');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') { const el = document.createElement('div'); el.className = 'wl ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; }
  function setText(lb, s, html = false) { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls)); }
  function place(lb, x, y, al = 'l', va = 't') { const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%'; lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`; }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const EDG = deck.EDGES || [];
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const pLb = Object.fromEntries(PTRS.map(({ a, k }) => [a + '.' + k, label('aq')]));
  const sepLb = label('aq'), yLb = label('aq'), oLb = label('aq');
  /* 시간 창 막대 아래의 경과 — '4ms / 1s' · '1.2s / 1s' · '창 없음' */
  const barLb = Object.fromEntries(ROWS.filter((a) => hasAcc[a]).flatMap((a) => RIDS[a].map((id) => [a + ':' + id, label('aq')])));
  const fmt = (x) => (x < 1 ? Math.round(x * 1000) + 'ms' : x + 's');
  const edgeLb = EDG.map(() => label('aq')), tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  const capOf = (its) => its.filter((x) => x.sub && x.tag !== 'sep').map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const ptrsOf = (s) => { const by = new Map(); for (const { a, k } of PTRS) { const r = rowOfId(s[a][k]); if (!r || !s[r].some((x) => x.id === bare(s[a][k]))) continue; const key = r + ':' + bare(s[a][k]); if (!by.has(key)) by.set(key, { r, id: bare(s[a][k]), ks: [] }); by.get(key).ks.push({ a, k }); } return [...by.values()]; };
  const DISK = new Set(ROWS.filter((a) => A[a].lane === 'disk'));
  const MEMR = ROWS.filter((a) => !DISK.has(a)), DSKR = ROWS.filter((a) => DISK.has(a));
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a]), on(a), '', true, true]);
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && (it.tag === 'x' || it.tag === 'dirty') ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    const sep = sepOf(s);
    if (LRU) {
      t.set(sepLb, [sep ? `${sep.id}  ·  old_blocks_time ${sep.win ?? 0} ms` : '', on(LRU) && (focusOf(s, LRU) ? focusOf(s, LRU).has(sep && sep.id) : true), sep && (sep.win ?? 0) === 0 ? 'red' : '', !!sep]);
      t.set(yLb, [sep ? '← young' : '', on(LRU), '', !!sep]);
      t.set(oLb, [sep ? 'old →' : '', on(LRU), '', !!sep]);
    }
    const win = sep ? sep.win ?? 0 : 0;
    for (const a of ROWS) if (hasAcc[a]) for (const id of RIDS[a]) {
      const it = s[a].find((x) => x.id === id), has = !!it && it.acc != null, over = has && win > 0 && it.acc * 1000 >= win;
      t.set(barLb[a + ':' + id], [has ? (win > 0 ? `${fmt(it.acc)} / ${win / 1000}s` : '창 없음') : '', on(a) && has && hotIt(s, a, id), win === 0 ? 'red' : over ? 'green' : 'gold', has]);
    }
    const P = ptrsOf(s), lead = new Map(P.map((g) => [g.ks[0].a + '.' + g.ks[0].k, g]));
    for (const { a, k } of PTRS) { const g = lead.get(a + '.' + k), hot = g && g.ks.some((q) => on(q.a) && modOf(s, q.a).has(q.k)); t.set(pLb[a + '.' + k], [g ? g.ks.map((q) => q.k).join(' · ') : '', !!g && g.ks.some((q) => on(q.a)), hot ? 'gold' : '', !!g]); }
    EDG.forEach((e, i) => t.set(edgeLb[i], [e.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === e.hot ? 'gold' : '', i === 0 ? TEXTS.length > 0 : MEMR.length > 0 && DSKR.length > 0]));
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => { let w = 0, h = 0; const keep = lb.el.innerHTML; for (const t of TXALL) { const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); } lb.el.innerHTML = keep; return { w, h }; };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(47);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15, BH = 9 + 15, SEPW = 14;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {} };
    let tn = Math.max(1, Math.min(3, TEXTS.length));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const tW = (ww - (tn - 1) * gap) / tn;
    for (const a of TEXTS) wrap(tx[a], tW);
    const tRows = Math.ceil(TEXTS.length / tn), tHs = Array.from({ length: tRows }, (_, r) => hMax(TEXTS.slice(r * tn, r * tn + tn).map((a) => tx[a])));
    /* 칸 폭 — 줄이 무대보다 넓으면 여백을 줄인다. LRU 는 경계 몫(SEPW)을 더 쓴다 */
    const swOf = (a, pad, mn) => Object.fromEntries(RIDS[a].map((id) => [id, Math.max(mn, Math.ceil(most(rowLb[a][id]).w) + pad)]));
    const usedW = (a, m) => RIDS[a].reduce((t, id) => t + m[id] + 6, -6) + (a === LRU ? SEPW + 6 : 0);
    const sw = Object.fromEntries(ROWS.map((a) => { let m = swOf(a, 14, hasAcc[a] ? 42 : 30); if (usedW(a, m) > ww) m = swOf(a, 6, 24); return [a, m]; }));
    /* 둘을 한 줄에 — 둘 다 반 폭 단에 들어갈 때만. LRU 는 늘 혼자 */
    const rc = ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    const chunks = (rs) => { const o = []; let i = 0; while (i < rs.length) { const a = rs[i], b = rs[i + 1]; if (rc > 1 && b && a !== LRU && b !== LRU && usedW(a, sw[a]) <= rW && usedW(b, sw[b]) <= rW) { o.push([a, b]); i += 2; } else { o.push([a]); i += 1; } } return o; };
    const BANDS = [...chunks(MEMR).map((c) => ({ c, disk: false })), ...chunks(DSKR).map((c) => ({ c, disk: true }))];
    const rowW = Object.fromEntries(BANDS.flatMap((band) => band.c.map((a) => [a, band.c.length > 1 ? rW : ww])));
    for (const a of ROWS) if (usedW(a, sw[a]) > rowW[a] + 1) console.error(`innodb ${sc.num} 세계 : ${a} 칸 줄이 단 ${Math.round(rowW[a])} 보다 넓다 (${L.W}×${L.H})`);
    const slotX = (s, a, id) => { let x = 0; for (const it of s[a]) { if (it.tag === 'sep') { x += SEPW + 6; continue; } const w = sw[a][it.id]; if (it.id === id) return x + w / 2; x += w + 6; } return null; };
    let pr = 1;
    for (const b of BAKES.values()) b.PL = b.S.map((s, kk) => {
      const T = b.TX[kk], P = ptrsOf(s), out = {};
      const wOf = (lb) => { const e = T.get(lb); const h = e && e[3] !== false ? e[0] : ''; if (!h) return 0; const keep = lb.el.innerHTML; lb.el.innerHTML = h; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };
      for (const r of ROWS) { if (!ptrRow[r]) continue; const q = P.filter((g) => g.r === r).map((g) => { const lb = pLb[g.ks[0].a + '.' + g.ks[0].k]; return { lb, cx: slotX(s, r, g.id), w: wOf(lb) }; }).filter((x) => x.w && x.cx != null); const st = stagger(q, 0, rowW[r]); pr = Math.max(pr, st.rows); out[r] = st.out; }
      return out;
    });
    const extra = (a) => (hasAcc[a] ? BH : 0) + (ptrRow[a] ? 10 + pr * RH : 0);
    const above = (a) => (a === LRU ? RH + 2 : 0);
    const rcH = {}, rSide = {};
    for (const band of BANDS) for (const a of band.c) {
      const W0 = rowW[a], used = usedW(a, sw[a]), sideW = W0 - used - 12;
      wrap(rowCap[a], W0); const hb = most(rowCap[a]).h;
      let hs = Infinity; if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      const box = 26 + extra(a);
      rSide[a] = Math.max(box, hs) < box + 8 + hb ? used + 12 : 0; if (!rSide[a]) wrap(rowCap[a], W0);
      rcH[a] = rSide[a] ? hs : hb;
    }
    const sepW = LRU ? most(sepLb).w : 0;
    const lay = (y0, k = 1) => {
      let y = y0;
      const rowY = [y]; for (let r = 0; r < tRows; r++) rowY.push(rowY[r] + HD + tHs[r] + 12 * k);
      TEXTS.forEach((a, i) => { const x = L.x0 + (i % tn) * (tW + gap), yy = rowY[Math.floor(i / tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + tW - 18, y: yy + 8 }; });
      y = rowY[tRows];
      G.edgeY = [null, null];
      if (TEXTS.length && EDG[0]) { y += 2 * k; G.edgeY[0] = y; place(edgeLb[0], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
      for (const band of BANDS) {
        if (band.disk && G.edgeY[1] == null && MEMR.length && EDG[1]) { y += 4 * k; G.edgeY[1] = y; place(edgeLb[1], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
        let hh = 0;
        band.c.forEach((a, j) => {
          const x0 = L.x0 + j * (rW + gap), box = 26 + extra(a), up = above(a);
          place(hd[a], x0, y); G.slot[a] = { x0, y: y + HD + up, sw: sw[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + up + 13 };
          if (a === LRU) { G.lruY = y + HD; }
          if (rSide[a]) { place(rowCap[a], x0 + rSide[a], y + HD + up + 4); hh = Math.max(hh, HD + up + Math.max(box, rcH[a] + 4)); }
          else { place(rowCap[a], x0, y + HD + up + box + 8); hh = Math.max(hh, HD + up + box + 8 + rcH[a]); }
        });
        y += hh + 14 * k;
      }
      /* 경계의 이름은 LRU 제목 줄 오른쪽 — 칸 줄 위에 따로 줄을 쓰지 않는다 */
      if (LRU) place(sepLb, L.x1, G.lruY - HD, 'r', 't');
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`innodb ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    if (LRU && sepW + most(hd[LRU]).w + 20 > ww) console.error(`innodb ${sc.num} 세계 : LRU 제목 줄에 경계 이름이 들어가지 않는다 (${L.W}×${L.H})`);
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 칸 자리 — LRU 의 sep 은 SEPW 폭의 경계 */
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { if (it.tag === 'sep') { if (it.id === id) return { x: x + SEPW / 2, y: G.slot[a].y + 13, w: SEPW, sep: true }; x += SEPW + 6; continue; } const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  const sepSlot = (s) => { const sp = sepOf(s); return sp ? rowSlot(s, LRU, sp.id) : null; };
  const barY = (a) => G.slot[a].y + 26 + 3;
  const ptrY = (a) => G.slot[a].y + 26 + (hasAcc[a] ? BH : 0) + 4;
  function anchor(a, s, lbText) {
    if (ROWS.includes(a)) {
      const id = RIDS[a].filter((x) => (lbText || '').includes(x)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, a)].find((x) => RIDS[a].includes(x));
      const P = id ? rowSlot(s, a, id) : null;
      if (P) return [P.x, P.y];
    }
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
    const level = (a, id) => (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
    const sep = sepOf(s), win = sep ? sep.win ?? 0 : 0;
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); if (hasAcc[a]) hide('b:' + key); continue; }
      const P1 = it ? rowSlot(s, a, id) : rowSlot(prev, a, id), P0 = it && pv ? rowSlot(prev, a, id) : null;
      if (!P1) { hide(key); if (hasAcc[a]) hide('b:' + key); continue; }
      /* 자리를 옮긴 칸(promote · 밀려남)은 옛 자리에서 미끄러진다 */
      const P = P0 && P0.x !== P1.x && !end ? { ...P1, x: U.lerp(P0.x, P1.x, mv) } : P1;
      const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === a ? src : null, tg = (it || pv).tag, lv = level(a, id), lit = it && modOf(s, a).has(id) && !end;
      for (let m = 0; m < SL; m++) {
        const i = R[key][0] + m, f = m / SL;
        let [x, y] = rim(P.x, P.y, P.w, 24, SL, m);
        if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone + 8 * gone; }
        [x, y] = into(i, x, y);
        put(o, i, x, y, lv * (1 - gone) * (tg === 'free' ? 0.5 * (m % 2) : 1), lit ? 0.4 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
      }
      if (!hasAcc[a]) continue;
      /* 시간 창 막대 — 바닥 점선 위에 acc / win 만큼. 창을 넘으면 초록, 안이면 금빛. win 0 이면 창이 없다(빨강 한 점) */
      const [b0] = R['b:' + key], q = it || pv, acc = q.acc;
      for (let m = 0; m < BARN; m++) {
        const i = b0 + m;
        if (acc == null) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const u = m / (BARN - 1), x = P.x - P.w / 2 + 4 + u * (P.w - 8), fill = win > 0 ? Math.min(1, (acc * 1000) / win) : 1;
        const filled = u <= fill, col = win === 0 ? RED : fill >= 1 ? GREEN : GOLD;
        const [xx, yy] = into(i, x, barY(a));
        put(o, i, xx, yy, (filled ? 0.95 : 0.25) * lv * (1 - gone), filled && lit ? 0.4 : 0, 0.02, filled ? 1.8 : 1.2, filled ? col : FAINT);
      }
    }
    /* midpoint — 칸 줄을 가로지르는 세로 경계 */
    if (LRU) {
      const [s0] = R.sep, P1 = sepSlot(s), P0 = sepSlot(prev), P = P1 && P0 && P0.x !== P1.x && !end ? { ...P1, x: U.lerp(P0.x, P1.x, mv) } : P1;
      const on = s.touch.has(LRU) && !end;
      for (let m = 0; m < SEPN; m++) {
        const i = s0 + m;
        if (!P) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const [xx, yy] = into(i, P.x, P.y - 18 + (m / (SEPN - 1)) * 36);
        put(o, i, xx, yy, (on ? 0.9 : 0.5) * dim * form, win === 0 ? 0.4 : 0, 0.02, 1.3, win === 0 ? RED : ACCENT);
      }
    }
    for (const { a, k: key } of PTRS) {
      const [i0] = R['p:' + a + '.' + key], r = rowOfId(s[a][key]), id = bare(s[a][key]), P = r ? rowSlot(s, r, id) : null;
      if (!P) { hide('p:' + a + '.' + key); continue; }
      const pid = bare(prev[a][key]), P0 = pid !== id && rowOfId(prev[a][key]) === r && !end ? rowSlot(prev, r, pid) : null;
      const x = P0 ? U.lerp(P0.x, P.x, mv) : P.x, y = ptrY(r), hot = s.touch.has(a) && !end && modOf(s, a).has(key);
      for (let m = 0; m < PTRN; m++) { const [col, row] = TRI[m], [xx, yy] = into(i0 + m, x + col * 2.6, y + row * 2.2); put(o, i0 + m, xx, yy, (s.touch.has(a) && !end ? 0.95 : 0.55) * dim * form, hot ? 0.5 : 0, 0.02, 1.1, hot ? GOLD : ACCENT); }
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
      for (const a of ROWS) for (const it of s[a]) { if (it.tag === 'sep') continue; const P = rowSlot(s, a, it.id); if (P) { place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); if (hasAcc[a]) place(barLb[a + ':' + it.id], P.x, barY(a) + 5, 'c', 't'); } }
      if (LRU) {
        /* young · old 이름 — 경계의 양쪽, 칸 줄 바로 위 */
        const P = sepSlot(s), y0 = G.slot[LRU].y - 2;
        /* young 이 한 칸뿐이면(06) 경계 왼쪽에 다 들어가지 않는다 — 무대 왼쪽 끝에 맞춘다 */
        if (P) { const w = yLb.el.offsetWidth, xr = P.x - SEPW / 2 - 4; if (xr - w < G.L.x0) place(yLb, G.L.x0, y0, 'l', 'b'); else place(yLb, xr, y0, 'r', 'b'); place(oLb, P.x + SEPW / 2 + 4, y0, 'l', 'b'); }
      }
      const PL = cur.PL[kk];
      for (const r of Object.keys(PL)) for (const q of PL[r]) place(q.lb, G.slot[r].x0 + q.l, ptrY(r) + 10 + q.row * RH);
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
    /* 시간 창 막대의 바닥 줄과 끝 눈금(old_blocks_time 에 닿는 곳) */
    const sp = sepOf(s), win = sp ? sp.win ?? 0 : 0;
    for (const a of ROWS) if (hasAcc[a]) for (const it of s[a]) {
      if (it.acc == null) continue;
      const P = rowSlot(s, a, it.id); if (!P) continue;
      ctx.globalAlpha = 0.45 * o; seg(ctx, P.x - P.w / 2 + 4, barY(a) + 2, P.x + P.w / 2 - 4, barY(a) + 2);
      if (win > 0) { ctx.globalAlpha = 0.6 * o; seg(ctx, P.x + P.w / 2 - 4, barY(a) - 3, P.x + P.w / 2 - 4, barY(a) + 4); }
    }
    ctx.globalAlpha = 0.35 * o;
    for (const [r, qs] of Object.entries(cur.PL[kk])) for (const q of qs) { const x = G.slot[r].x0 + q.cx; if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, x, ptrY(r) + 8, x, ptrY(r) + 10 + q.row * RH - 1); }
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
