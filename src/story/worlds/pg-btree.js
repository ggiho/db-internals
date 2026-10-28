/* postgres btree — 모든 장면이 같은 세계를 쓴다. 위에 글(kv 배우), 가운데 트리(tree 배우), 아래에 페이지의 항목(list 배우).
   그리는 것은 모두 장면의 bake 상태에서 읽는다(손으로 적은 값이 없다) —
     · 트리 = B-TREE 의 항목. 층(lvl) 마다 페이지 상자, 찬 만큼(fill) 알갱이가 채운다.
       부모 → 자식은 downlink(자식의 up, 없으면 그 위층의 페이지가 하나일 때 그것), 형제는 next 가 right-link
     · 페이지의 항목 = list 배우의 항목 하나가 칸 하나. tag : clean 먹색 · x(LP_DEAD) 빨간 테두리 · dirty 금빛 ·
       sep(high key) 파란 테두리 · ok 초록 · free 흐린 테두리. 칸의 이름은 항목 id, 설명(sub)은 줄 아래에 모아 적는다
     · OPERATION 의 '경로'(페이지 id 를 → 로 이은 것)가 있으면 reader 가 그 페이지들을 따라 내려가고 옆으로 간다
     · 페이지의 grp(08 : 인덱스 둘)가 있으면 grp 마다 옆으로 나란한 칸에 그 인덱스의 트리를 따로 세운다
     · 셈 맞추기 — high key 가 있는 페이지는 모든 키가 high key 보다 작고 오름차순이어야 한다(숫자 키일 때).
       페이지에 잰 free(bt_page_stats 의 free_size)가 있으면 fill 이 1 − free / 8148 과 맞아야 하고,
       list(그 페이지를 보이는 list 배우)와 live 가 있으면 그 줄의 항목 수(칸마다 n, 없으면 1)의 합이 live 와 같아야 한다 —
       LP_DEAD 칸(x)은 빼고 따로 dead(dead_items, 없으면 0)와 맞춘다.
       어긋나면 console.error 로 알린다(storysweep 의 errors 가 잡는다)
     · act 는 덩어리가 f 에서 t 로 — 트리는 act 이름이 짚는 페이지, 없으면 그 스텝에서 바뀐 페이지
     · 그 스텝이 건드린 배우(touch)는 또렷하게, 나머지는 흐리게
   손잡이가 있는 장면(02 deduplicate_items)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';

const HANGUL = /[가-힣]/;
const PG = 150, SL = 48, TOK = 150, RD = 40;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, dirty: GOLD, sep: ACCENT, ok: GREEN, free: FAINT, hold: GOLD, pin: GOLD, wait: GOLD };
/* 칸은 모두 테두리로 그린다 — 안을 알갱이로 채우자 칸의 이름(키)이 점에 묻혔다(storysweep label-grain, 크기마다 112 곳).
   종류는 테두리의 색으로, 새로 온 칸(dirty)은 테두리를 두 겹으로 */
const DOUBLE = new Set(['dirty', 'ok']);
const num = (id) => (/^-?\d+$/.test(String(id).trim()) ? +id : null);

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);
  const TEXTS = cast.filter((a) => A[a].kind === 'kv'), LISTS = cast.filter((a) => A[a].kind === 'list');
  const TREE = cast.find((a) => A[a].kind === 'tree') || null;

  /* ── 상태 읽기 — 손잡이 값마다 ── */
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of TEXTS) s[a] = (st[a] && st[a].kv) || {};
    for (const a of LISTS) s[a] = ((st[a] && st[a].items) || []).map((it) => ({ id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '', n: it.n }));
    s.pages = TREE ? ((st[TREE] && st[TREE].items) || []).map((it) => ({ ...it, id: String(it.id) })) : [];
    const path = TEXTS.map((a) => s[a]['경로']).find((v) => v && bare(v) !== '—');
    s.path = path ? bare(path).split('→').map((x) => x.trim()).filter((x) => s.pages.some((p) => p.id === x)) : [];
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k), S0 = read(sc.init);
    const S = frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch));
    /* 셈 맞추기 — high key 가 있는 페이지 : 키는 오름차순이고 모두 high key 보다 작다 */
    const tag = `pg btree ${sc.num} 세계${k ? ' (' + sc.vary.knob + '=' + k + ')' : ''}`;
    [S0, ...S].forEach((s, i) => {
      const at = i ? `${i} 스텝` : 'init';
      for (const a of LISTS) {
        const hk = s[a].find((x) => x.tag === 'sep'), hn = hk ? num(hk.id.replace(/^high key\s*/, '')) : null;
        const ks = s[a].filter((x) => x.tag !== 'sep').map((x) => num(x.id));
        if (ks.some((x) => x == null)) continue;
        for (let j = 1; j < ks.length; j++) if (ks[j] <= ks[j - 1]) console.error(`${tag} : ${at} 의 ${A[a].nm} 키가 오름차순이 아니다 — ${ks[j - 1]} 다음 ${ks[j]}`);
        if (hn != null && ks.some((x) => x >= hn)) console.error(`${tag} : ${at} 의 ${A[a].nm} 에 high key ${hn} 이상인 키가 있다 — ${ks.filter((x) => x >= hn).join(', ')}`);
      }
      for (const p of s.pages) {
        if (p.next && !s.pages.some((x) => x.id === p.next)) console.error(`${tag} : ${at} 의 ${p.id} 가 없는 페이지 ${p.next} 를 오른쪽으로 가리킨다`);
        /* up '—' 는 부모에서 떼어 낸 페이지(06 의 half-dead)다 */
        if (p.up && p.up !== '—' && !s.pages.some((x) => x.id === p.up)) console.error(`${tag} : ${at} 의 ${p.id} 가 없는 부모 ${p.up} 를 가리킨다`);
        /* 빈 leaf 의 free_size = 8192 − 헤더 24 − special(BTPageOpaqueData) 16 − line pointer 4 = 8148 */
        if (typeof p.free === 'number' && typeof p.fill === 'number' && Math.abs(p.fill - (1 - p.free / 8148)) > 0.01)
          console.error(`${tag} : ${at} 의 ${p.id} fill ${p.fill} 가 free_size ${p.free} 로 셈한 ${(1 - p.free / 8148).toFixed(3)} 와 다르다`);
        if (p.list && typeof p.live === 'number' && s[p.list]) {
          /* LP_DEAD 칸(x)은 bt_page_stats 의 dead_items 다 — live_items 에 들지 않는다(01 의 leaf 1) */
          const cnt = (f) => s[p.list].filter(f).reduce((t, x) => t + (typeof x.n === 'number' ? x.n : 1), 0);
          const sum = cnt((x) => x.tag !== 'x'), dead = cnt((x) => x.tag === 'x'), pd = typeof p.dead === 'number' ? p.dead : 0;
          if (sum !== p.live) console.error(`${tag} : ${at} 의 ${p.id} live ${p.live} 와 ${A[p.list].nm} 의 항목 합 ${sum} 이 다르다`);
          if (dead !== pd) console.error(`${tag} : ${at} 의 ${p.id} dead ${pd} 와 ${A[p.list].nm} 의 LP_DEAD 칸 합 ${dead} 이 다르다`);
        }
      }
    });
    BAKES.set(k, { S0, S, NK: S.length });
  }
  let cur = BAKES.get(null) || [...BAKES.values()][0];
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const PIDS = [...new Set(all.flatMap((s) => s.pages.map((p) => p.id)))];
  const LV = [...new Set(all.flatMap((s) => s.pages.map((p) => p.lvl || 0)))].sort((a, b) => a - b);
  /* grp — 처음 나온 순서대로 옆으로 나란한 칸. 없으면 칸 하나 */
  const GRPS = [...new Set(all.flatMap((s) => s.pages.map((p) => p.grp || '')))];
  const sameRow = (x, p) => (x.lvl || 0) === (p.lvl || 0) && (x.grp || '') === (p.grp || '');
  /* grp 마다 한 줄에 가장 많이 놓이는 페이지 수 — 칸의 폭을 그 비로 나눈다(08 : bu_k 는 1 장, bu_v 는 leaf 넷) */
  const PERG = Object.fromEntries(GRPS.map((g) => [g, Math.max(1, ...all.flatMap((s) => s.pages.filter((p) => (p.grp || '') === g).map((p) => s.pages.filter((x) => sameRow(x, p)).length)))]));
  const IIDS = Object.fromEntries(LISTS.map((a) => [a, [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))]]));
  const MAXI = Object.fromEntries(LISTS.map((a) => [a, Math.max(1, ...all.map((s) => s[a].length))]));

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  PIDS.forEach((id) => take('p:' + id, PG));
  for (const a of LISTS) IIDS[a].forEach((id) => take(a + ':' + id, SL));
  take('tok', TOK); take('rd', RD);
  R.DST = [at, N];
  if (at > N) throw new Error('pg btree 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표(DOM) — 모두 읽어야 하는 값이라 .sm(좁은 화면에서 숨는 곁말)을 쓰지 않는다 ── */
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
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(60, Math.floor(w)) + 'px'; };
  const EDGE = (deck.EDGES || [])[0] || null;
  const hd = Object.fromEntries([...TEXTS, ...LISTS, ...(TREE ? [TREE] : [])].map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const pgLb = Object.fromEntries(PIDS.map((id) => [id, label('aq ml aq-c aq-b')]));
  const slLb = Object.fromEntries(LISTS.map((a) => [a, Object.fromEntries(IIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const capLb = Object.fromEntries(LISTS.map((a) => [a, label('aq ml aq-b')]));
  const edgeLb = label('aq'), tok = label('stn-tok');

  /* 스텝마다의 글과 강조 — [글, 또렷한가, 색, 보이나, html]. 값마다 따로 */
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join('\n');
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of Object.keys(hd)) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], focusOf(s, a)), on(a), '', true, true]);
    for (const id of PIDS) {
      const p = s.pages.find((x) => x.id === id);
      t.set(pgLb[id], p ? [`<span class="q-i">${esc(id)}</span>\n${esc(p.keys || '')}`, on(TREE) && (s.path.includes(id) || hotIt(s, TREE, id)), '', true, true] : ['', false, '', false, true]);
    }
    for (const a of LISTS) {
      for (const id of IIDS[a]) {
        const it = s[a].find((x) => x.id === id);
        t.set(slLb[a][id], it ? [id, on(a) && hotIt(s, a, id), it.tag === 'x' ? 'red' : it.tag === 'dirty' ? 'gold' : ''] : ['', false, '', false]);
      }
      const notes = s[a].filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`);
      /* 설명 줄은 pre-line 이라 공백 여럿이 하나로 접힌다 — 항목 사이를 │ 로 가른다 */
      t.set(capLb[a], [notes.join('  │  ') || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    if (EDGE) t.set(edgeLb, [EDGE.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '']);
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
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

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(13);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    /* 위 — 글 블록, 열로 */
    const tn = Math.max(1, TEXTS.length), tW = (ww - (tn - 1) * gap) / tn;
    for (const a of TEXTS) wrap(tx[a], tW);
    const tH = Math.max(16, ...TEXTS.map((a) => most(tx[a]).h));
    /* 트리 — 층마다 페이지 상자. 폭은 한 층에 가장 많이 놓이는 수로 */
    /* 이름표는 상자보다 18 넓다(wrap pw + 18) — 줄이 칸을 다 채워도 양 끝 이름표가 칸 · 무대 밖으로 나가지 않게 그만큼 뺀다 */
    const GG = 40, tot = GRPS.reduce((t, g) => t + PERG[g], 0), avail = ww - (GRPS.length - 1) * GG;
    const colW = Object.fromEntries(GRPS.map((g) => [g, (avail * PERG[g]) / tot]));
    const pw = Math.round(Math.min(...GRPS.map((g) => U.clamp((colW[g] - 18 - (PERG[g] - 1) * 22) / PERG[g], 70, 138)))), ph = 26;
    const colX = {}; GRPS.reduce((x, g) => { colX[g] = x; return x + colW[g] + GG; }, L.x0);
    for (const id of PIDS) wrap(pgLb[id], pw + 18);
    const pH = Math.max(16, ...PIDS.map((id) => most(pgLb[id]).h));
    /* 항목 줄 — 칸 폭은 그 칸의 이름이 가장 길 때 */
    const sh = 26, sg = 6;
    const sw = Object.fromEntries(LISTS.map((a) => [a, Object.fromEntries(IIDS[a].map((id) => [id, Math.max(28, Math.ceil(most(slLb[a][id]).w) + 14)]))]));
    for (const a of LISTS) wrap(capLb[a], ww);
    const cH = Object.fromEntries(LISTS.map((a) => [a, most(capLb[a]).h]));
    /* 한 줄에 다 안 들어가면 칸을 줄바꿈 — 줄 수는 가장 넓은 상태로 잰다 */
    const rowsOf = (a) => {
      let rows = 1;
      for (const s of all) { let x = 0, r = 1; for (const it of s[a]) { const w = sw[a][it.id]; if (x && x + w > ww) { r++; x = 0; } x += w + sg; } rows = Math.max(rows, r); }
      return rows;
    };
    const lvGap = pH + 30;
    const treeH = TREE ? HD + LV.length * ph + (LV.length - 1) * lvGap + 8 + pH : 0;
    const listH = LISTS.reduce((acc, a) => acc + HD + rowsOf(a) * (sh + 8) + cH[a] + 22, 0);
    const total = HD + tH + 36 + treeH + 30 + listH;
    HT = total;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    let y = L.y0 + dy;
    G = { L, pw, ph, pH, sh, sg, sw, colW, colX, slot: {}, page: {}, anc: {}, rowY: {}, edgeY: 0 };
    TEXTS.forEach((a, i) => { const x = L.x0 + i * (tW + gap); place(hd[a], x, y); place(tx[a], x, y + HD); G.anc[a] = { x: x + tW - 18, y: y + 8 }; });
    y += HD + tH + 18;
    G.edgeY = y; if (EDGE) place(edgeLb, L.x1, y - 3, 'r', 'b');
    y += 18;
    if (TREE) {
      place(hd[TREE], L.x0, y);
      G.treeY = y + HD; G.lvGap = lvGap;
      y += treeH + 30;
    }
    for (const a of LISTS) {
      place(hd[a], L.x0, y);
      G.rowY[a] = y + HD; G.anc[a] = { x: L.x0 + 30, y: y + HD + sh / 2 };
      y += HD + rowsOf(a) * (sh + 8);
      G.capY = G.capY || {}; G.capY[a] = y;
      place(capLb[a], L.x0, y);
      y += cH[a] + 22;
    }
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 페이지 자리 — 층마다 가운데로 모은다 */
  function pageAt(s, id) {
    const p = s.pages.find((x) => x.id === id);
    if (!p || !G) return null;
    const lv = p.lvl || 0, row = s.pages.filter((x) => sameRow(x, p)), j = row.indexOf(p);
    const g = p.grp || '', span = row.length * G.pw + (row.length - 1) * 22, x0 = G.colX[g] + (G.colW[g] - span) / 2;
    return { x: x0 + G.pw / 2 + j * (G.pw + 22), y: G.treeY + LV.indexOf(lv) * (G.ph + G.lvGap) + G.ph / 2 };
  }
  function parentOf(s, p) {
    if (p.up === '—') return null;
    if (p.up) return s.pages.find((x) => x.id === p.up) || null;
    const li = LV.indexOf(p.lvl || 0);
    if (li <= 0) return null;
    const ups = s.pages.filter((x) => (x.lvl || 0) === LV[li - 1] && (x.grp || '') === (p.grp || ''));
    return ups.length === 1 ? ups[0] : null;
  }
  /* 항목 칸 자리 — 줄을 왼쪽부터, 넘치면 다음 줄 */
  function slotAt(s, a, id) {
    let x = G.L.x0, y = G.rowY[a];
    for (const it of s[a]) {
      const w = G.sw[a][it.id];
      if (x > G.L.x0 && x + w > G.L.x1) { x = G.L.x0; y += G.sh + 8; }
      if (it.id === id) return { x: x + w / 2, y: y + G.sh / 2, w };
      x += w + G.sg;
    }
    return null;
  }
  function anchor(a, s, lbText) {
    if (a === TREE) {
      const m = PIDS.filter((id) => (lbText || '').includes(id)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, TREE)][0] || s.pages[0]?.id;
      const P = m ? pageAt(s, m) : null;
      return P ? [P.x, P.y] : [G.L.x0, G.treeY];
    }
    if (LISTS.includes(a)) {
      const id = IIDS[a].filter((x) => (lbText || '').split(/\s+/).includes(x))[0] || [...modOf(s, a)][0];
      const P = id ? slotAt(s, a, id) : null;
      return P ? [P.x, P.y] : [G.anc[a].x, G.anc[a].y];
    }
    const P = G.anc[a];
    return P ? [P.x, P.y] : [G.L.x0, G.L.y0];
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  function grid(cx, cy, w, h, n, m) {
    const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h)))), rows = Math.max(1, Math.floor(n / cols));
    return [cx - w / 2 + ((m % cols) + 0.5) / cols * w, cy - h / 2 + (Math.floor(m / cols) % rows + 0.5) / rows * h, m < cols * rows, (m % cols + 0.5) / cols];
  }
  function rim(cx, cy, w, h, n, m) {
    const per = 2 * (w + h), d = (m / n) * per;
    if (d < w) return [cx - w / 2 + d, cy - h / 2];
    if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)];
    if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2];
    return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)];
  }
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
    /* 트리의 페이지 — 찬 만큼(fill) 왼쪽부터 먹색, 나머지는 테두리. 새 페이지는 갈라진 이웃(왼쪽)에서 나온다 */
    if (TREE) {
      const on = s.touch.has(TREE) && !end;
      for (const id of PIDS) {
        const key = 'p:' + id, [r0] = R[key], pg = s.pages.find((x) => x.id === id), pv = prev.pages.find((x) => x.id === id);
        if (!pg && !(pv && !end)) { hide(key); continue; }
        const P = pg ? pageAt(s, id) : pageAt(prev, id), PV = pv ? pageAt(prev, id) : null;
        const gone = pg ? 0 : show(p, 0.1, 0.4), born = pg && !pv && !end;
        const left = born ? s.pages[s.pages.indexOf(pg) - 1] : null, BP = left && prev.pages.some((x) => x.id === left.id) ? pageAt(prev, left.id) : null;
        const mv = PV && (PV.x !== P.x || PV.y !== P.y) && !end ? show(p, 0.12, 0.4) : 1;
        const f0 = pv && typeof pv.fill === 'number' ? pv.fill : (pg && pg.fill) || 0, f1 = pg && typeof pg.fill === 'number' ? pg.fill : f0;
        const fill = end ? f1 : U.lerp(f0, f1, show(p, 0.2, 0.42));
        const lit = on && (s.path.includes(id) || modOf(s, TREE).has(id));
        const a0 = (on ? (hotIt(s, TREE, id) || s.path.includes(id) ? 0.92 : 0.55) : 0.45) * dim * form * (1 - gone);
        for (let m = 0; m < PG; m++) {
          const i = r0 + m;
          const cx = PV && mv < 1 ? U.lerp(PV.x, P.x, mv) : P.x, cy = PV && mv < 1 ? U.lerp(PV.y, P.y, mv) : P.y;
          let [x, y, ing, u] = grid(cx, cy, G.pw, G.ph, PG, m);
          const inFill = u <= fill;
          if (!inFill) { [x, y] = rim(cx, cy, G.pw, G.ph, PG, m); }
          if (BP) { const e = show(p, 0.12 + (m % 9) * 0.015, 0.36 + (m % 9) * 0.015); x = U.lerp(BP.x, x, e); y = U.lerp(BP.y, y, e); }
          if (gone) { x += jit[i * 2] * 30 * gone; y += jit[i * 2 + 1] * 30 * gone; }
          [x, y] = into(i, x, y);
          put(o, i, x, y, (inFill ? a0 : a0 * 0.45 * (m % 2)) * ing, lit ? 0.45 : 0, 0.04, inFill ? 1.15 : 1, inFill ? (lit ? GOLD : INK) : FAINT);
        }
      }
    }
    /* 항목 칸 — 생기면 act 의 f 에서(act 가 그 배우로 가면) 날아오고, 자리가 바뀌면 옮겨 가고, 지우면 흩어진다 */
    for (const a of LISTS) {
      const on = s.touch.has(a) && !end;
      for (const id of IIDS[a]) {
        const key = a + ':' + id, [r0] = R[key], it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
        if (!it && !(pv && !end)) { hide(key); continue; }
        const P = it ? slotAt(s, a, id) : slotAt(prev, a, id), PV = pv ? slotAt(prev, a, id) : null;
        if (!P) { hide(key); continue; }
        /* 다른 줄에서 옮겨 온 항목(분할 : leaf → right)은 그 줄의 옛 자리에서 */
        let from = null;
        if (it && !pv && !end) {
          const other = LISTS.find((b) => b !== a && prev[b].some((x) => x.id === id) && !s[b].some((x) => x.id === id));
          from = other ? (() => { const Q = slotAt(prev, other, id); return Q ? [Q.x, Q.y] : null; })() : act && act.t === a ? src : null;
        }
        const gone = it ? 0 : show(p, 0.1, 0.4), mv = it && PV && (PV.x !== P.x || PV.y !== P.y) && !end ? show(p, 0.12, 0.4) : 1;
        const tg = (it || pv).tag, ptg = pv && pv.tag, retag = it && pv && ptg !== tg && !end;
        const lit = on && hotIt(s, a, id) && modOf(s, a).has(id);
        const a0 = (on ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form * (1 - gone);
        for (let m = 0; m < SL; m++) {
          const i = r0 + m, f = m / SL;
          const cx = PV && mv < 1 ? U.lerp(PV.x, P.x, mv) : P.x, cy = PV && mv < 1 ? U.lerp(PV.y, P.y, mv) : P.y;
          /* 두 겹 테두리는 좁은 칸에만 — 넓은 칸(70px 넘게)은 알갱이 48 개를 두 겹으로 나누면 점만 흩어진다. 색이 이미 새 것을 말한다 */
          const dbl = DOUBLE.has(tg) && P.w <= 70, inner = dbl && m % 2 === 1, ww2 = inner ? P.w - 5 : P.w, hh2 = inner ? G.sh - 5 : G.sh;
          let [x, y] = rim(cx, cy, ww2, hh2, dbl ? SL / 2 : SL, inner ? (m - 1) / 2 : dbl ? m / 2 : m), ing = true;
          if (from) { const e = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, e); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, e) - Math.sin(e * Math.PI) * 18; }
          if (gone) { x += jit[i * 2] * 26 * gone; y += jit[i * 2 + 1] * 26 * gone + 8 * gone; }
          [x, y] = into(i, x, y);
          const col = retag && p < 0.14 + f * 0.24 ? TAGC[ptg] ?? INK : TAGC[tg] ?? INK;
          put(o, i, x, y, a0 * 0.9 * ing, lit ? 0.4 : 0, 0.03, 1.1, col);
        }
      }
    }
    /* reader — '경로' 의 페이지를 따라 내려가고 옆으로 간다. 서는 자리에서는 마지막 페이지에 머문다 */
    const [d0] = R.rd;
    if (s.path.length >= 2 && !end) {
      const pts = s.path.map((id) => pageAt(s, id)), seg = pts.length - 1, q = show(p, 0.1, 0.46) * seg, j = Math.min(seg - 1, Math.floor(q)), e = U.smooth(q - j);
      const A0 = pts[j], B0 = pts[Math.min(seg, j + 1)], cx = U.lerp(A0.x, B0.x, e), cy = U.lerp(A0.y, B0.y, e) - G.ph / 2 - 10;
      for (let m = 0; m < RD; m++) { const i = d0 + m, r = Math.sqrt((m + 0.5) / RD) * 5, th = m * 2.399; put(o, i, cx + Math.cos(th) * r, cy + Math.sin(th) * r, 0.95 * form, 0.9, 0.1, 1.2, ACCENT); }
    } else hide('rd');
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
      for (const pg of s.pages) { const P = pageAt(s, pg.id); place(pgLb[pg.id], P.x, P.y + G.ph / 2 + 6, 'c', 't'); }
      for (const a of LISTS) for (const it of s[a]) { const P = slotAt(s, a, it.id); if (P) place(slLb[a][it.id], P.x, P.y, 'c', 'c'); }
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
  function arrow(ctx, x0, y0, x1, y1, head = 6) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
    ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45)); ctx.stroke();
  }
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save();
    /* INDEX AM 경계 */
    ctx.globalAlpha = (((s.step.hot || (s.step.act && s.step.act.hot)) === (EDGE && EDGE.hot) && !end) ? 0.9 : 0.45) * o;
    ctx.strokeStyle = css.faint; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(L.x0, G.edgeY); ctx.lineTo(L.x1, G.edgeY); ctx.stroke();
    if (TREE) {
      const on = s.touch.has(TREE) && !end;
      /* 경로에서 바로 이어진 두 페이지만 밝힌다 — 경로에 둘 다 있다고 밝히면 root → leaf L → leaf L′ 에서 root → leaf L′ 도 밝았다 */
      const step = (u, v) => s.path.some((x, i) => x === u && s.path[i + 1] === v);
      /* downlink — 부모의 이름표 아래에서 자식 상자의 위로(상자 바로 아래에서 내리자 선이 부모의 이름표를 가로질렀다) */
      for (const pg of s.pages) {
        const par = parentOf(s, pg); if (!par) continue;
        const A0 = pageAt(s, par.id), B0 = pageAt(s, pg.id), hot = step(par.id, pg.id);
        ctx.globalAlpha = (hot ? 0.9 : on ? 0.55 : 0.35) * o; ctx.strokeStyle = hot ? css.accent : css.ink; ctx.lineWidth = hot ? 1.5 : 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(A0.x, A0.y + G.ph / 2 + 6 + G.pH + 3); ctx.lineTo(B0.x, B0.y - G.ph / 2 - 2); ctx.stroke();
      }
      /* right-link — next 로 이웃한 상자 사이에 화살표. 금빛은 그 스텝에 새로 생긴 링크만 —
         페이지의 다른 값(03 의 9 스텝 : 보이는 leaf 를 바꾼 list)이 바뀌었다고 링크까지 금빛이면 링크가 바뀐 것으로 읽힌다 */
      const prev = kk > 0 ? S[kk - 1] : cur.S0;
      for (const pg of s.pages) {
        if (!pg.next) continue;
        const A0 = pageAt(s, pg.id), B0 = pageAt(s, pg.next); if (!A0 || !B0) continue;
        const was = prev.pages.find((x) => x.id === pg.id);
        const fresh = !end && (!was || was.next !== pg.next), hot = step(pg.id, pg.next);
        ctx.globalAlpha = (hot || fresh ? 0.95 : on ? 0.6 : 0.4) * o * (fresh ? show(p, 0.3, 0.46) : 1);
        ctx.strokeStyle = hot ? css.accent : fresh ? css.gold : css.ink; ctx.lineWidth = hot || fresh ? 1.6 : 1.1; ctx.setLineDash([]);
        const y = A0.y + G.ph / 2 - 6, row = s.pages.filter((x) => sameRow(x, pg));
        if (Math.abs(row.findIndex((x) => x.id === pg.next) - row.indexOf(pg)) > 1) {
          /* 이웃이 아닌 형제(06 : A → C, 떼어 낸 B 를 건너뛴다) — 상자 위로 휘어 간다 */
          const x0 = A0.x + G.pw / 4, x1 = B0.x - G.pw / 4, top = A0.y - G.ph / 2 - 14;
          ctx.beginPath(); ctx.moveTo(x0, A0.y - G.ph / 2 - 2); ctx.quadraticCurveTo((x0 + x1) / 2, top - 18, x1, B0.y - G.ph / 2 - 3); ctx.stroke();
          const a = Math.atan2(B0.y - G.ph / 2 - 3 - (top - 18), x1 - (x0 + x1) / 2);
          ctx.beginPath(); ctx.moveTo(x1, B0.y - G.ph / 2 - 3); ctx.lineTo(x1 - 5 * Math.cos(a - 0.45), B0.y - G.ph / 2 - 3 - 5 * Math.sin(a - 0.45));
          ctx.moveTo(x1, B0.y - G.ph / 2 - 3); ctx.lineTo(x1 - 5 * Math.cos(a + 0.45), B0.y - G.ph / 2 - 3 - 5 * Math.sin(a + 0.45)); ctx.stroke();
        } else arrow(ctx, A0.x + G.pw / 2 + 2, y, B0.x - G.pw / 2 - 3, y, 5);
      }
      /* 경로의 한 걸음에 그어 둔 선이 없으면(옛 downlink — 떼어 낸 페이지로 내려간 스캔) 점선으로 그 걸음을 보인다 */
      if (!end) s.path.forEach((u, i) => {
        const v = s.path[i + 1]; if (!v) return;
        const pu = s.pages.find((x) => x.id === u), pv = s.pages.find((x) => x.id === v);
        if (!pu || !pv || pu.next === v || (parentOf(s, pv) || {}).id === u) return;
        const A0 = pageAt(s, u), B0 = pageAt(s, v);
        ctx.globalAlpha = 0.85 * o; ctx.strokeStyle = css.accent; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(A0.x, A0.y + G.ph / 2 + 6 + G.pH + 3); ctx.lineTo(B0.x, B0.y - G.ph / 2 - 2); ctx.stroke(); ctx.setLineDash([]);
      });
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); return HT; },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent') };
    },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
