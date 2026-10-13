/* 무대(stage) — 덱의 배우 · lane · 경계와 장면의 각본(ops · act · look)을 그대로 읽어 그리는 범용 세계.
   전용 세계(ch3-01 · ch3-06b)처럼 장면마다 손으로 그리지 않는다 — 배우가 kv · list · frames 인 장면이면 붙는다.

     · lane 하나가 한 층이다(SQL 계층 · 메모리 · 디스크). 층 사이의 선은 덱의 EDGES — 스텝의 hot 이 그 선을 밝힌다
     · 배우는 상자다. 글(이름 · 값 · 항목)은 DOM, 테두리와 항목의 칩은 알갱이
     · 항목(list · frames 의 items)은 id 마다 알갱이를 정해 둔다 — 스텝이 넘어가도 같은 알갱이가 그 항목이다.
       그래서 act 가 있는 스텝에서 새로 생긴 항목은 act 의 출발 배우(같은 id 의 칩이 있으면 그 칩)에서 날아온다
       (innodb 01 의 3 : .ibd 의 p:5 가 buffer pool 로 읽혀 들어온다)
     · act 는 알갱이 덩어리가 f 에서 t 로 날아가는 것, look 은 그 배우 · 항목이 빛나는 것
   상자의 크기는 모든 스텝 · 모든 손잡이 값의 내용을 미리 재서 가장 큰 것으로 고정한다 — 스텝마다 상자가 흔들리지 않게.
   다 들어가지 않으면(글이 8px 아래로 줄면) 스텝마다 그 스텝이 무대에 올릴 배우만 펼치고(Lab 의 onStage 규칙),
   나머지는 이름만 남긴 꼬리표로 접는다 — 줄이기만 했더니 폰에서 innodb 01 의 글이 2.5px 이었다(storysweep text-small). */
import { INK, GOLD, ACCENT, GREEN, RED, FAINT, U } from '../field.js';
import { bake, stepsOf, onStage } from '../../bake.js';

const KINDS = new Set(['kv', 'list', 'frames']);
const TAG = { dirty: RED, red: RED, pin: GOLD, hold: GOLD, gold: GOLD, ok: GREEN, green: GREEN, free: FAINT, wait: ACCENT, hdr: ACCENT };
const SUF = /\|(gold|red|green)$/;
const clsOf = (v) => { const m = SUF.exec(String(v)); return m ? m[1] : ''; };
const bare = (v) => String(v).replace(SUF, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/* 긴 식별자는 낱말 경계(camelCase 의 대문자 앞 · _ 뒤)에서 접히게 — 칸보다 긴 id 가 아무 데서나 잘려
   'ShareUpdateExclusi / ve' 가 됐다(postgres locks 02, 1512 폭) */
const brk = (s) => esc(s).replace(/([a-z])([A-Z])/g, '$1<wbr>$2').replace(/_(?=\w)/g, '_<wbr>');
/* 상자 글이 읽히는 가장 작은 배율 — 가장 작은 글(10px)이 8px 이 되는 곳 */
const MIN_Z = 0.8;

export default {
  count: (narrow) => (narrow ? 4200 : 6400),
  /* 이 세계가 그릴 수 있는 장면인가 — cast 가 전부 kv · list · frames 여야 한다 */
  fits: (deck, sc) => (sc.cast || []).every((id) => deck.ACTORS[id] && KINDS.has(deck.ACTORS[id].kind)),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, ACT = deck.ACTORS;
  const sc = scene();
  const cast = sc.cast.filter((id) => ACT[id] && KINDS.has(ACT[id].kind));
  const lanes = deck.LANES.filter((ln) => cast.some((id) => ACT[id].lane === ln.id));
  const VALS = [null, ...Object.keys((sc.vary && sc.vary.alt) || {})];
  let vary = null;
  const bakes = new Map(VALS.map((v) => [v, { frames: bake(sc, v), steps: stepsOf(sc, v) }]));
  const cur = () => bakes.get(vary) || bakes.get(null);

  /* 항목 id — 배우마다 모든 스텝 · 값에 걸쳐 한 번이라도 나온 것 */
  const ids = {};
  for (const id of cast) {
    const set = new Set();
    for (const { frames } of bakes.values()) for (const f of frames) for (const it of (f.st[id] && f.st[id].items) || []) set.add(it.id);
    for (const it of (sc.init[id] && sc.init[id].items) || []) set.add(it.id);
    ids[id] = [...set];
  }

  /* ── 알갱이 구역 : 상자 테두리 · 항목 칩 · 게이지 · 날아가는 덩어리 · 먼지 ── */
  const f = N / 6400, R = {};
  let at = 0;
  const take = (key, n) => { R[key] = [at, at + n]; at += n; };
  const BOXN = Math.round(110 * f), CHIP = Math.round(54 * f), PAGEN = Math.round(96 * f);
  cast.forEach((id) => take('box:' + id, BOXN));
  cast.forEach((id) => ids[id].forEach((it) => take('it:' + id + ':' + it, ACT[id].kind === 'frames' ? PAGEN : CHIP)));
  /* 게이지 — init 에 있거나 어느 스텝이든 gg 를 쓰는 배우만 */
  for (const id of cast) if ((sc.init[id] && sc.init[id].gg) || [...bakes.values()].some(({ frames }) => frames.some((fr) => fr.st[id] && fr.st[id].gg))) take('gg:' + id, Math.round(120 * f));
  take('tok', Math.round(260 * f));
  R.DST = [at, N];
  if (at > N) throw new Error('stage 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── DOM : 배우 상자 · 층 이름 · 경계 이름 · act 이름표 ── */
  const made = [];
  function el(cls, html = '') {
    const e = document.createElement('div');
    e.className = cls; e.innerHTML = html;
    labels.appendChild(e);
    made.push(e);
    return e;
  }
  const boxEl = Object.fromEntries(cast.map((id) => [id, el('stn')]));
  const laneEl = Object.fromEntries(lanes.map((ln) => [ln.id, el('stn-lane', `${esc(ln.lb)}<i>${esc(ln.note || '')}</i>`)]));
  /* 경계 — 이웃한 두 층(a, b) 사이에 after === a 이고 before 가 없거나 b 인 것(Lab 의 Stage.jsx 와 같은 규칙).
     before 를 보지 않았더니 wiredtiger 에서 mem 뒤에 경계 둘(→ disk · → repl)이 같은 자리에 겹쳤다(storysweep 567 건).
     어느 층이 보이는지는 배치마다 다르므로(꼬리표를 뺀 배치) 쓸 수 있는 경계를 다 만들어 둔다 */
  const EDG = (deck.EDGES || []).filter((e) => lanes.some((ln) => ln.id === e.after) && (!e.before || lanes.some((ln) => ln.id === e.before)));
  const edgeEl = EDG.map((e) => el('stn-edge', esc(e.lb)));
  const tokEl = el('stn-tok');
  const measurer = el('stn stn-measure');

  /* 상자 안의 글 — 스텝 k 의 상태. 칩 자리는 <s> 로 비워 두고 알갱이가 채운다 */
  function inner(id, st, chg) {
    const a = ACT[id], c = chg || {};
    let h = `<div class="s-hd">${esc(a.nm)}</div>`;
    if (st.kv) for (const [k, v] of Object.entries(st.kv)) {
      h += `<div class="s-kv${(c.keys || []).includes(k) ? ' chg' : ''}"><i>${brk(k)}</i><b class="${clsOf(v)}">${brk(bare(v))}</b></div>`;
    }
    if (st.gg) h += `<div class="s-gg"><s data-gg="1"></s><i>${esc(st.gg.l || '')}</i><b>${esc(st.gg.r || '')}</b></div>`;
    if (st.items) {
      const fr = a.kind === 'frames';
      h += fr ? '<div class="s-frs">' : '';
      for (const it of st.items) {
        const on = (c.add || []).includes(it.id) || (c.mod || []).includes(it.id);
        h += fr
          ? `<div class="s-fr${on ? ' chg' : ''}"><s data-it="${esc(it.id)}"></s><b>${brk(it.id)}</b><span>${brk(it.sub || '')}</span></div>`
          /* id 와 설명 사이의 공백 — 붙여 썼더니 'RowExclusive' 와 'INSERT' 가 한 낱말이 되어 'INSER / T' 로 잘렸다 */
          : `<div class="s-li${on ? ' chg' : ''}"><s data-it="${esc(it.id)}"></s><p><b>${brk(it.id)}</b>${it.sub ? ` <span>${brk(it.sub)}</span>` : ''}</p></div>`;
      }
      if (!st.items.length) h += `<div class="s-li none"><span>비어 있다</span></div>`;
      h += fr ? '</div>' : '';
    }
    return h;
  }
  const tagged = (id) => `<div class="s-hd">${esc(ACT[id].nm)}</div>`;

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(5);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const units = (id) => (ACT[id].w === 'w2' ? 2 : ACT[id].w === 'w15' ? 1.5 : ACT[id].w === 'wide' ? 4 : 1);
  function build(L) {
    /* 열 수는 상자 폭이 MIN_COL 을 넘게 — 1024 폭에서 4 열로 나눴더니 상자가 101px 이라
       'trx_rows_locked'(99px) 이 상자 밖으로 나갔다(storysweep box-overflow 49 건) */
    const ww = L.x1 - L.x0, gap = L.narrow ? 8 : 12, MIN_COL = 150;
    const cols = Math.max(2, Math.min(4, Math.floor((ww + gap) / (MIN_COL + gap)))), colW = (ww - (cols - 1) * gap) / cols;
    /* 1 : 상자 폭을 정하고, 모든 스텝 · 값의 내용을 재서 높이를 정한다 */
    const width = {}, height = {}, chips = new Map(), hk = new Map();
    for (const id of cast) {
      const u = Math.min(cols, units(id));
      width[id] = u * colW + (u - 1) * gap;
      measurer.style.width = width[id] + 'px';
      let hmax = 0;
      for (const [v, { frames }] of bakes) {
        frames.forEach((fr, k) => {
          const st = fr.st[id] || {};
          measurer.innerHTML = inner(id, st, fr.chg[id]);
          hk.set(v + '|' + k + '|' + id, measurer.offsetHeight);
          hmax = Math.max(hmax, measurer.offsetHeight);
          /* 칩의 자리 — 상자 왼쪽 위 기준 */
          const base = measurer.getBoundingClientRect(), m = {};
          measurer.querySelectorAll('s[data-it]').forEach((s) => { const r = s.getBoundingClientRect(); m[s.dataset.it] = { dx: r.left - base.left, dy: r.top - base.top, w: r.width, h: r.height }; });
          const g = measurer.querySelector('s[data-gg]');
          if (g) { const r = g.getBoundingClientRect(); m['@gg'] = { dx: r.left - base.left, dy: r.top - base.top, w: r.width, h: r.height }; }
          chips.set(v + '|' + k + '|' + id, m);
        });
      }
      /* init(스텝 0 의 앞) 도 잰다 — 첫 스텝의 출발 자리 */
      measurer.innerHTML = inner(id, sc.init[id] || {}, null);
      hmax = Math.max(hmax, measurer.offsetHeight);
      height[id] = hmax;
    }
    /* 꼬리표(접힌 배우) — 이름만, 폭은 글대로 */
    measurer.className = 'stn tag stn-measure'; measurer.style.width = '';
    const tagW = {};
    let tagH = 0;
    for (const id of cast) { measurer.innerHTML = tagged(id); tagW[id] = measurer.offsetWidth; tagH = Math.max(tagH, measurer.offsetHeight); }
    measurer.className = 'stn stn-measure'; measurer.innerHTML = '';
    G = { L, chips, gap, cols, colW, width, height, hk, tagW, tagH, lays: new Map() };
    G.full = pack(new Set(cast), false, (id) => height[id]);
    G.focus = G.full.z < MIN_Z;
    /* 4 : 데스크톱은 세계를 세로 가운데로 — 글은 가운데에 서는데 무대만 위에 붙어, 상자가 적은 장면은 오른쪽 아래
       절반이 비었다(1512 contact sheet, aurora · wiredtiger). 초점 배치는 모든 스텝 · 값 가운데 가장 높은 것에 맞춘
       한 값으로 민다 — 스텝마다 위아래로 흔들리지 않게. 좁은 화면은 글 바로 아래가 낫다 */
    if (!L.narrow) {
      const all = G.focus ? VALS.flatMap((v) => [...Array(bakes.get(v).frames.length).keys()].map((k) => layOf(v, k))) : [G.full];
      const dy = Math.max(0, (L.y1 - L.y0 - Math.max(...all.map((l) => l.h))) / 2);
      if (dy > 0) for (const l of new Set(all)) {
        for (const b of Object.values(l.box)) b.Y += dy;
        for (const id in l.lane) l.lane[id] += dy;
        for (const e of l.edge) e.Y += dy;
      }
    }
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * (L.x1 - L.x0); dust[i * 2 + 1] = L.y0 + rnd() * (L.y1 - L.y0); }
  }
  /* 2 : 층마다 줄로 채운다 — 펼친 상자는 열에 맞춰(줄의 폭 ≤ cols), 접힌 배우(꼬리표)는 그 아래 줄에 글 폭대로.
     tags 가 false 면 접힌 배우는 그리지 않고, 그 배우만 있는 층도 뺀다.
     층 사이 56px(좁은 화면 46px) — 위에서부터 경계 이름(오른쪽) · 경계선 · 다음 층 이름(왼쪽). 40px 일 때 경계 이름이
     위 층 상자를 덮었다. 좁은 화면의 46 은 이름 둘(14 + 19px)과 선이 겹치지 않는 가장 작은 값에 여유 5px.
     hOf — 상자 높이. 전체 배치는 모든 스텝의 최대(흔들리지 않게), 초점 배치는 그 스텝의 내용(어차피 스텝마다 다르다).
     열 수는 cols 부터 cols + 3 까지 해 보고 배율이 가장 큰 것 — 높이 때문에 줄이면 폭도 같이 줄어 오른쪽이 비므로,
     그 폭에 열을 더 두면 같은 층의 상자가 옆으로 서고 높이가 준다 */
  function pack(open, tags, hOf) {
    let best = null;
    for (let nc = G.cols; nc <= G.cols + 3; nc++) {
      const lay = pack1(open, tags, hOf, nc);
      if (!best || lay.z > best.z + 1e-6) best = lay;
      if (lay.z >= 1) break;
    }
    return best;
  }
  function pack1(open, tags, hOf, cols) {
    const { L, gap, colW, width, tagW, tagH } = G, nar = L.narrow, laneGap = nar ? 46 : 56;
    const xR = L.x0 + cols * colW + (cols - 1) * gap;
    const vis = lanes.filter((ln) => cast.some((id) => ACT[id].lane === ln.id && (tags || open.has(id))));
    const box = {}, laneY = {}, bottom = {};
    let y = L.y0 + 22;
    vis.forEach((ln, li) => {
      laneY[ln.id] = y - (nar ? 12 : 14);
      const ids2 = cast.filter((id) => ACT[id].lane === ln.id);
      let row = [], used = 0;
      const flush = () => {
        if (!row.length) return;
        const h = Math.max(...row.map(hOf));
        let x = L.x0;
        for (const id of row) { box[id] = { x, y, w: width[id], h: hOf(id) }; x += width[id] + gap; }
        y += h + gap; row = []; used = 0;
      };
      for (const id of ids2.filter((id) => open.has(id))) {
        const u = Math.min(cols, units(id));
        if (used + u > cols + 0.01) flush();
        row.push(id); used += u;
      }
      flush();
      if (tags) {
        let x = L.x0, any = false;
        for (const id of ids2.filter((id) => !open.has(id))) {
          if (any && x + tagW[id] > xR) { x = L.x0; y += tagH + gap; }
          box[id] = { x, y, w: tagW[id], h: tagH, tag: true }; x += tagW[id] + gap; any = true;
        }
        if (any) y += tagH + gap;
      }
      bottom[ln.id] = y - gap;
      y += li < vis.length - 1 ? laneGap - gap : 0;
    });
    /* 3 : 높이가 모자라면 세계 전체를 줄인다(z) — 층 · 경계 이름도 상자와 같은 배율로. 상자만 줄였더니
       좁은 화면에서 이름이 첫 상자를 덮었다(341 건) */
    const z = Math.min(1, (L.y1 - L.y0) / (y - L.y0), (L.x1 - L.x0) / (xR - L.x0));
    const X = (v) => L.x0 + (v - L.x0) * z, Y = (v) => L.y0 + (v - L.y0) * z;
    const out = { z, h: (y - L.y0) * z, box: {}, lane: {}, edge: [] };
    for (const id in box) { const b = box[id]; out.box[id] = { X: X(b.x), Y: Y(b.y), w: b.w, h: b.h, tag: !!b.tag }; }
    for (const ln of vis) out.lane[ln.id] = Y(laneY[ln.id]);
    /* 경계선 — 위 층의 가장 낮은 것 아래 24px. 이름(11px)은 선 바로 위, 다음 층 이름은 선 아래(중심 +42px).
       처음에 bottom - gap + 24(= +12px)로 적어서 이름이 위 층 오른쪽 상자를 4px 쯤 덮었다(storysweep 168 건) */
    for (let i = 0; i + 1 < vis.length; i++) {
      const ei = EDG.findIndex((e) => e.after === vis[i].id && (!e.before || e.before === vis[i + 1].id));
      if (ei >= 0) out.edge.push({ ei, Y: Y(bottom[vis[i].id] + (nar ? 20 : 24)) });
    }
    return out;
  }
  /* 스텝 k 의 배치 — 다 들어가면 전체(모든 스텝이 같다). 안 들어가면 그 스텝이 무대에 올릴 배우만 펼친다
     (bake.js 의 onStage : 건드린 것 + 직전 맥락, 4 장까지). 펼친 것 + 꼬리표 → 펼친 것만 → 건드린 것 + 꼬리표 →
     건드린 것만 → 핵심(act 의 두 끝 · look) + 꼬리표 → 핵심만 의 차례로, 배율이 MIN_Z 이상인 첫 배치.
     다 모자라면 가장 큰 것. 핵심 단계는 폰 때문이다 — 층(SQL · 메모리 · 디스크)은 위아래로 쌓이므로 세 층이면
     세계 높이 358px 에 0.8 배로 들어가지 않았다(storysweep text-small, innodb 05 의 2 가 4.6px) */
  function layOf(v, k) {
    if (!G.focus) return G.full;
    const key = v + '|' + k;
    let lay = G.lays.get(key);
    if (lay) return lay;
    const { frames, steps } = bakes.get(v) || bakes.get(null), kk = Math.min(k, frames.length - 1), st = steps[kk] || {};
    const tries = [], hOf = (id) => G.hk.get((bakes.has(v) ? v : null) + '|' + kk + '|' + id) ?? G.height[id];
    const sets = [onStage(sc, frames, kk, 4), onStage(sc, frames, kk, 1), [...(st.act ? [st.act.f, st.act.t] : []), ...Object.keys(st.look || {})]];
    for (const ids2 of sets) {
      const open = new Set(ids2.filter((id) => cast.includes(id)));
      if (open.size) tries.push(pack(open, true, hOf), pack(open, false, hOf));
    }
    lay = tries.find((t) => t.z >= MIN_Z) || tries.reduce((a, b) => (b.z > a.z ? b : a));
    G.lays.set(key, lay);
    return lay;
  }
  /* 화면 좌표 — 배치 lay 에서 상자 안의 점(dx, dy)을 배율까지 적용해 */
  const abs = (lay, id, dx, dy) => { const b = lay.box[id]; return [b.X + dx * lay.z, b.Y + dy * lay.z]; };
  const center = (lay, id) => abs(lay, id, lay.box[id].w / 2, lay.box[id].h / 2);
  const chipOf = (k, id, it) => { const m = G.chips.get(vary + '|' + k + '|' + id) || G.chips.get('null|' + k + '|' + id); return m ? m[it] : null; };

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  function pose(k, p, t, o) {
    if (!G) return;
    const { frames, steps } = cur(), nk = frames.length, kk = Math.min(k, nk - 1), lay = layOf(vary, kk);
    const end = k >= nk, fr = frames[kk], step = steps[kk] || {}, prev = kk > 0 ? frames[kk - 1] : null;
    const act = !end && step.act ? step.act : null, look = (!end && step.look) || {};
    const touch = end ? new Set() : fr.touch;
    const fly = act ? show(p, 0.08, 0.42) : 1;
    /* 첫 스텝은 장면 제목이 먼저 보인다 — 그동안 상자가 먼지에서 모인다 */
    const form = k === 0 ? show(p, 0.1, 0.34) : 1;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const hide = (a, b) => { for (let i = a; i < b; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
    for (const id of cast) {
      const b = lay.box[id], [i0] = R['box:' + id];
      /* 이 배치에 없는 배우(꼬리표를 뺀 배치) — 그 알갱이는 먼지로 */
      if (!b) {
        hide(i0, i0 + BOXN);
        for (const it of ids[id]) hide(...R['it:' + id + ':' + it]);
        if (R['gg:' + id]) hide(...R['gg:' + id]);
        continue;
      }
      const path = U.rectPath(0, 0, b.w, b.h);
      const lit = b.tag ? 0 : look[id] === true ? 1 : touch.has(id) ? 0.6 : 0;
      for (let m = 0; m < BOXN; m++) {
        const [px, py] = path((m + 0.5) / BOXN), [x, y] = abs(lay, id, px, py), i = i0 + m;
        put(o, i, U.lerp(dust[i * 2], x + jit[i * 2] * 0.6, form), U.lerp(dust[i * 2 + 1], y + jit[i * 2 + 1] * 0.6, form),
          (end ? 0.08 : b.tag ? 0.22 : 0.35 + 0.5 * lit) * form, lit * 0.8, 0.1, b.tag ? 0.9 : 1.05, lit > 0.9 ? GOLD : lit > 0 ? INK : FAINT);
      }
      /* 항목 칩 — 이 스텝의 상태에 있으면 그 칩 자리에, 없으면(꼬리표도) 상자 가운데로 사라진다 */
      const items = (!b.tag && fr.st[id] && fr.st[id].items) || [];
      for (const it of ids[id]) {
        const [s0, s1] = R['it:' + id + ':' + it], n = s1 - s0;
        const here = items.find((x) => x.id === it), ch = here ? chipOf(kk, id, it) : null;
        const ch0 = !end && fr.chg[id], moved = ch0 && ((ch0.add || []).includes(it) || (ch0.mod || []).includes(it));
        const lk = (Array.isArray(look[id]) && look[id].includes(it)) || moved;
        const born = here && act && act.t === id && prev && !((prev.st[id] && prev.st[id].items) || []).some((x) => x.id === it);
        let ox = null, oy = null;
        if (born) {
          /* 새로 생긴 항목 — act 의 출발 배우에서. 같은 id 의 칩이 있으면 그 칩에서(같은 page 가 디스크에서 올라온다) */
          const src = chipOf(kk, act.f, it) || chipOf(kk - 1, act.f, it);
          [ox, oy] = src ? abs(lay, act.f, src.dx + src.w / 2, src.dy + src.h / 2) : center(lay, act.f);
        }
        const c = here ? (TAG[here.tag] ?? INK) : FAINT, free = here && here.tag === 'free';
        const cols = Math.max(2, Math.round(Math.sqrt(n * ((ch ? ch.w : 10) / Math.max(1, ch ? ch.h : 10)))));
        for (let m = 0; m < n; m++) {
          const i = s0 + m;
          let x, y, a;
          if (ch) {
            const gx = ((m % cols) + 0.5) / cols, gy = (Math.floor(m / cols) + 0.5) / Math.ceil(n / cols);
            [x, y] = free ? abs(lay, id, ...U.rectPath(ch.dx, ch.dy, ch.w, ch.h)((m + 0.5) / n)) : abs(lay, id, ch.dx + gx * ch.w, ch.dy + gy * ch.h);
            a = end ? 0.08 : free ? 0.45 : lk ? 1 : 0.85;
            if (born) { const q = show(fly, (m % 7) * 0.02, 0.85 + (m % 7) * 0.02); x = U.lerp(ox + jit[i * 2] * 10, x, q); y = U.lerp(oy + jit[i * 2 + 1] * 10, y, q); }
          } else { [x, y] = center(lay, id); a = 0; }
          put(o, i, U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form), a * form, lk ? 1 : 0, 0.05, free ? 0.9 : 1.15, lk ? GOLD : c);
        }
      }
      /* 게이지 */
      if (R['gg:' + id]) {
        const [g0, g1] = R['gg:' + id], gg = fr.st[id] && fr.st[id].gg, ch = b.tag ? null : chipOf(kk, id, '@gg');
        for (let m = 0; m < g1 - g0; m++) {
          const i = g0 + m, u = (m + 0.5) / (g1 - g0);
          if (!ch) { const [cx, cy] = center(lay, id); put(o, i, cx, cy, 0, 0, 0, 1, FAINT); continue; }
          const [x, y] = abs(lay, id, ch.dx + u * ch.w, ch.dy + ch.h / 2 + jit[i * 2] * ch.h * 0.6);
          const on = gg && u <= gg.v;
          put(o, i, x, y, end ? 0.06 : on ? 0.95 : 0.25, on ? 0.5 : 0, 0.05, 1.1, on ? GOLD : FAINT);
        }
      }
    }
    /* act — 덩어리가 f 에서 t 로. 자기 자신에게(bin → bin) 면 그 자리에서 고리를 그린다 */
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act && lay.box[act.f] && lay.box[act.t]) {
      const [fx, fy] = center(lay, act.f), [tx, ty] = center(lay, act.t), self = act.f === act.t;
      /* 도착(0.42) 뒤 0.52 까지 흩어진다 — 0.46 – 0.6 이었을 때 서는 자리(0.58)에 덩어리가 5% 로 남았다 */
      const q = fly, gone = show(p, 0.42, 0.52), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, r = Math.sqrt((m + 0.5) / tn) * 9, th = m * 2.399;
        let x, y;
        if (self) {
          const ang = q * Math.PI * 2 + th, rr = 26 + r;
          x = fx + Math.cos(ang) * rr; y = fy + Math.sin(ang) * rr * 0.5;
        } else {
          const e = U.smooth(q), arc = Math.sin(e * Math.PI) * Math.min(80, Math.hypot(tx - fx, ty - fy) * 0.25);
          x = U.lerp(fx, tx, e) + Math.cos(th) * r; y = U.lerp(fy, ty, e) + Math.sin(th) * r - arc;
        }
        put(o, i, x, y, (q > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.3, col);
      }
    } else for (let m = 0; m < tn; m++) put(o, t0 + m, dust[(t0 + m) * 2], dust[(t0 + m) * 2 + 1], 0, 0, 2, 1, FAINT);
  }

  /* ── 글 : 활성 스텝이 바뀌면 상자 안을 그 스텝의 상태로 ── */
  let shown = -2, shownV = 'x', shownL = null, tokO = -1, tokW = 0;
  const opa = new Map();
  const setO = (e, o) => { if (Math.abs(o - (opa.get(e) ?? -1)) > 0.004) { e.style.opacity = o.toFixed(3); opa.set(e, o); } };
  /* 섞는 동안(b) 두 배치에서 자리가 다른 것은 흐려졌다가 새 자리에서 나타난다 — 알갱이는 이어서 움직인다 */
  const pair = (k, next, nk) => { const A = layOf(vary, Math.min(k, nk - 1)), B = layOf(vary, Math.min(next, nk - 1)); return [A, B]; };
  const sameBox = (A, B, id) => { const a = A.box[id], c = B.box[id]; return A === B || (a && c && a.X === c.X && a.Y === c.Y && a.tag === c.tag && A.z === B.z); };
  const sameEdge = (A, B, ei) => { const a = A.edge.find((x) => x.ei === ei), c = B.edge.find((x) => x.ei === ei); return A === B || (a && c && a.Y === c.Y && A.z === B.z); };
  /* next — 다음 구간의 스텝(요점만 보기에서는 k + 1 이 아니다) */
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const { frames, steps } = cur(), nk = frames.length;
    const kk = Math.min(b > 0.5 ? next : k, nk - 1), end = (b > 0.5 ? next : k) >= nk;
    const [A, B] = pair(k, next, nk), C = b > 0.5 ? B : A;
    if (kk !== shown || vary !== shownV || C !== shownL) {
      shown = kk; shownV = vary; shownL = C;
      const fr = frames[kk];
      for (const id of cast) {
        const bx = C.box[id], e = boxEl[id];
        if (!bx) continue;
        e.className = bx.tag ? 'stn tag' : 'stn';
        e.innerHTML = bx.tag ? tagged(id) : inner(id, fr.st[id] || {}, fr.chg[id]);
        Object.assign(e.style, { width: bx.tag ? '' : bx.w + 'px', transform: `translate(${bx.X}px, ${bx.Y}px) scale(${C.z})`, transformOrigin: '0 0' });
      }
      for (const ln of lanes) {
        const y = C.lane[ln.id];
        if (y != null) Object.assign(laneEl[ln.id].style, { transform: `translate(${G.L.x0}px, ${y}px) scale(${C.z}) translate(0, -50%)`, transformOrigin: '0 0' });
      }
      for (const { ei, Y } of C.edge) Object.assign(edgeEl[ei].style, { transform: `translate(${G.L.x1}px, ${Y}px) scale(${C.z}) translate(-100%, -118%)`, transformOrigin: '0 0' });
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const id of cast) setO(boxEl[id], C.box[id] ? dimO * (sameBox(A, B, id) ? 1 : fade) : 0);
    for (const ln of lanes) setO(laneEl[ln.id], C.lane[ln.id] != null ? dimO * (A === B || (A.lane[ln.id] === B.lane[ln.id] && A.z === B.z) ? 1 : fade) : 0);
    EDG.forEach((e, ei) => setO(edgeEl[ei], C.edge.some((x) => x.ei === ei) ? dimO * (sameEdge(A, B, ei) ? 1 : fade) : 0));
    /* act 이름표 — 덩어리를 따라간다 */
    const step = steps[Math.min(k, nk - 1)], act = k < nk && step.act ? step.act : null;
    /* 이름표도 0.52 까지 — 0.5 – 0.6 이었을 때 서는 자리에 불투명도 0.11 의 잔상이 남았다(storysweep hold-still) */
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act && A.box[act.f] && A.box[act.t]) {
      const [fx, fy] = center(A, act.f), [tx, ty] = center(A, act.t), e = U.smooth(show(p, 0.08, 0.42));
      const arc = act.f === act.t ? 40 : Math.sin(e * Math.PI) * Math.min(80, Math.hypot(tx - fx, ty - fy) * 0.25);
      if (tokEl.textContent !== act.lb) { tokEl.textContent = act.lb; tokW = 0; }
      tokEl.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tokEl.offsetWidth;
      /* 이름표는 세계 안에 — 덩어리 오른쪽 16px 에 붙였더니 오른쪽 상자로 갈 때 폰에서는 화면 밖으로, 데스크톱에서는
         레일 위로 나갔다(storysweep flight) */
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx, e) + 16)), y = Math.max(G.L.y0, U.lerp(fy, ty, e) - arc - 14);
      tokEl.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tokEl.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { steps } = cur(), nk = steps.length, kk = Math.min(b > 0.5 ? next : k, nk - 1), step = steps[kk] || {};
    const [A, B] = pair(k, next, nk), C = b > 0.5 ? B : A, fade = Math.abs(1 - 2 * b);
    const hot = step.hot || (step.act && step.act.hot);
    ctx.save();
    for (const { ei, Y } of C.edge) {
      const lit = hot && hot === EDG[ei].hot;
      ctx.globalAlpha = (lit ? 0.95 : 0.45) * (sameEdge(A, B, ei) ? 1 : fade); ctx.strokeStyle = lit ? css.gold : css.faint; ctx.lineWidth = lit ? 1.5 : 1;
      ctx.setLineDash(lit ? [] : [3, 4]);
      ctx.beginPath(); ctx.moveTo(G.L.x0, Y); ctx.lineTo(G.L.x1, Y); ctx.stroke();
    }
    ctx.restore();
    edgeEl.forEach((el2, i) => el2.classList.toggle('gold', !!(hot && hot === EDG[i].hot)));
  }

  return {
    build(L) { this.theme(); build(L); shown = -2; },
    theme() {
      const cs = getComputedStyle(document.documentElement);
      css = { faint: cs.getPropertyValue('--faint').trim(), gold: cs.getPropertyValue('--gold').trim() };
    },
    pose, paint, overlay,
    setVary(v) { const vv = v == null ? null : String(v); if (bakes.has(vv)) vary = vv; },
    dispose() { made.forEach((e) => e.remove()); },
  };
}
