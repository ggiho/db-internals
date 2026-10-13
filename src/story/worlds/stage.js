/* 무대(stage) — 덱의 배우 · lane · 경계와 장면의 각본(ops · act · look)을 그대로 읽어 그리는 범용 세계.
   전용 세계(ch3-01 · ch3-06b)처럼 장면마다 손으로 그리지 않는다 — 배우가 KINDS 의 종류이면 붙는다.

     · lane 하나가 한 층이다(SQL 계층 · 메모리 · 디스크). 층 사이의 선은 덱의 EDGES — 스텝의 hot 이 그 선을 밝힌다
     · 배우는 상자다. 글(이름 · 값 · 항목)은 DOM, 테두리와 칩은 알갱이
     · 칩은 HTML 의 <s data-it> 자리다. 모양(data-sh) · 색(data-c) · 채움(data-f) · 밝힘(data-on) · 흐림(data-dim)을
       그 자리에 적어 두고, 알갱이 쪽은 종류를 모른 채 그것만 읽는다 — 칸(bytes) · 노드(tree · graph) · 막대(axis) ·
       칸(matrix) 이 모두 같은 길로 그려진다
     · 칩은 key 마다 알갱이를 정해 둔다 — 스텝이 넘어가도 같은 알갱이가 그 항목이다.
       그래서 act 가 있는 스텝에서 새로 생긴 칩은 act 의 출발 배우(같은 key 의 칩이 있으면 그 칩)에서 날아온다
       (innodb 01 의 3 : .ibd 의 p:5 가 buffer pool 로 읽혀 들어온다)
     · act 는 알갱이 덩어리가 f 에서 t 로 날아가는 것, look 은 그 배우 · 항목이 빛나는 것
   상자의 크기는 모든 스텝 · 모든 손잡이 값의 내용을 미리 재서 가장 큰 것으로 고정한다 — 스텝마다 상자가 흔들리지 않게.
   다 들어가지 않으면(글이 8px 아래로 줄면) 스텝마다 그 스텝이 무대에 올릴 배우만 펼치고(Lab 의 onStage 규칙),
   나머지는 이름만 남긴 꼬리표로 접는다 — 줄이기만 했더니 폰에서 innodb 01 의 글이 2.5px 이었다(storysweep text-small). */
import { INK, GOLD, ACCENT, GREEN, RED, FAINT, U } from '../field.js';
import { bake, stepsOf, onStage } from '../../bake.js';

const KINDS = new Set(['kv', 'list', 'frames', 'bytes', 'tree', 'axis', 'graph', 'matrix']);
const TAG = { dirty: RED, red: RED, pin: GOLD, hold: GOLD, gold: GOLD, ok: GREEN, green: GREEN, free: FAINT, wait: ACCENT, hdr: ACCENT };
/* data-c 의 이름 — TAG 와 달리 덱의 tag 가 아니라 그리는 색 그 자체 */
const COL = { ink: INK, gold: GOLD, accent: ACCENT, green: GREEN, red: RED, faint: FAINT };
const cname = (tag) => ({ [RED]: 'red', [GOLD]: 'gold', [GREEN]: 'green', [FAINT]: 'faint', [ACCENT]: 'accent' })[TAG[tag]] || 'ink';
const SUF = /\|(gold|red|green)$/;
const clsOf = (v) => { const m = SUF.exec(String(v)); return m ? m[1] : ''; };
const bare = (v) => String(v).replace(SUF, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/* 긴 식별자는 낱말 경계(camelCase 의 대문자 앞 · _ 뒤)에서 접히게 — 칸보다 긴 id 가 아무 데서나 잘려
   'ShareUpdateExclusi / ve' 가 됐다(postgres locks 02, 1512 폭) */
const brk = (s) => esc(s).replace(/([a-z])([A-Z])/g, '$1<wbr>$2').replace(/_(?=\w)/g, '_<wbr>');
/* 상자 글이 읽히는 가장 작은 배율 — 가장 작은 글(10px)이 8px 이 되는 곳 */
const MIN_Z = 0.8;
const has = (arr, x) => (arr || []).includes(x);

/* 배우마다 칩 key 와 그 알갱이 수 — 모든 스텝 · 값 · init 에 한 번이라도 나온 것.
   bytes 는 칸 폭이 크기에 비례하므로 알갱이도 폭(그 스텝 띠에서의 몫)에 비례해 나눈다 — 칸마다 같은 수를 주면
   2 byte 칸이 8 byte 칸보다 빽빽해져 뜻이 뒤집힌다 */
function chipKeys(deck, sc, bakes, f) {
  const out = {};
  for (const id of sc.cast) {
    const a = deck.ACTORS[id];
    if (!a || !KINDS.has(a.kind)) continue;
    const m = new Map(), put = (k, n) => m.set(k, Math.max(m.get(k) || 0, Math.round(n * f)));
    const sts = [sc.init[id] || {}];
    for (const { frames } of bakes.values()) for (const fr of frames) sts.push(fr.st[id] || {});
    for (const st of sts) {
      const items = st.items || [];
      if (a.kind === 'list') items.forEach((it) => put(it.id, 54));
      else if (a.kind === 'frames') items.forEach((it) => put(it.id, 96));
      else if (a.kind === 'tree') items.forEach((it) => put(it.id, 44));
      else if (a.kind === 'graph') items.forEach((it) => put(it.id, 40));
      else if (a.kind === 'bytes') {
        const tot = items.reduce((s, x) => s + (x.sz || 1), 0) || 1;
        items.forEach((it) => put(it.id, Math.max(14, (360 * (it.sz || 1)) / tot)));
      } else if (a.kind === 'axis') {
        put('@line', 90);
        items.forEach((it) => put('r:' + it.id, 12));
        (st.spans || []).forEach((sp) => put('sp:' + sp.id, 40));
      /* 칸마다 28 — 12 였을 때 채운 칸은 성긴 점, 빈 칸은 한 변에 점 셋이라 허용 · 막힘이 한눈에 갈리지 않았다(locks 04 · 10) */
      } else if (a.kind === 'matrix' && st.mx) st.mx.rows.forEach((r) => st.mx.cols.forEach((c) => put('mx:' + r + '/' + c, 28)));
    }
    out[id] = m;
  }
  return out;
}
const scaleOf = (narrow) => (narrow ? 0.66 : 1);
const BOX = 110, TOK = 260, GG = 120, DUST = 1200;
function budget(deck, sc, bakes, narrow) {
  const f = scaleOf(narrow), keys = chipKeys(deck, sc, bakes, f);
  let n = Math.round((TOK + DUST) * f);
  for (const id of Object.keys(keys)) {
    n += Math.round(BOX * f) + [...keys[id].values()].reduce((s, x) => s + x, 0);
    if ((sc.init[id] && sc.init[id].gg) || [...bakes.values()].some(({ frames }) => frames.some((fr) => fr.st[id] && fr.st[id].gg))) n += Math.round(GG * f);
  }
  return { keys, n };
}
const bakesOf = (sc) => new Map([null, ...Object.keys((sc.vary && sc.vary.alt) || {})].map((v) => [v, { frames: bake(sc, v), steps: stepsOf(sc, v) }]));

export default {
  /* 알갱이 수 — 장면이 쓰는 칩만큼. 고정(6400)으로 두면 10 × 10 matrix 같은 장면은 모자란다 */
  count: (narrow, deck, sc) => Math.max(narrow ? 4200 : 6400, deck && sc ? budget(deck, sc, bakesOf(sc), narrow).n : 0),
  /* 이 세계가 그릴 수 있는 장면인가 — cast 가 전부 KINDS 여야 한다 */
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
  const bakes = bakesOf(sc);
  const cur = () => bakes.get(vary) || bakes.get(null);

  /* ── 알갱이 구역 : 상자 테두리 · 칩 · 게이지 · 날아가는 덩어리 · 먼지 ── */
  const narrow0 = innerWidth < 820, f = scaleOf(narrow0), { keys } = budget(deck, sc, bakes, narrow0), R = {};
  let at = 0;
  const take = (key, n) => { R[key] = [at, at + n]; at += n; };
  const BOXN = Math.round(BOX * f);
  cast.forEach((id) => take('box:' + id, BOXN));
  cast.forEach((id) => keys[id].forEach((n, k) => take('it:' + id + ':' + k, n)));
  /* 게이지 — init 에 있거나 어느 스텝이든 gg 를 쓰는 배우만 */
  for (const id of cast) if ((sc.init[id] && sc.init[id].gg) || [...bakes.values()].some(({ frames }) => frames.some((fr) => fr.st[id] && fr.st[id].gg))) take('gg:' + id, Math.round(GG * f));
  take('tok', Math.round(TOK * f));
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

  /* ── 상자 안의 글 — 스텝 k 의 상태. 칩 자리는 <s> 로 비워 두고 알갱이가 채운다 ── */
  const chip = (key, o = {}) => `<s data-it="${esc(key)}" data-sh="${o.sh || 'fill'}" data-c="${o.c || 'ink'}"`
    + (o.f != null ? ` data-f="${o.f}"` : '') + (o.on ? ' data-on="1"' : '') + (o.dim ? ' data-dim="1"' : '')
    + (o.lvl != null ? ` data-l="${o.lvl}"` : '') + (o.style ? ` style="${o.style}"` : '') + '></s>';
  function inner(id, st, chg) {
    const a = ACT[id], c = chg || {};
    let h = `<div class="s-hd">${esc(a.nm)}</div>`;
    if (st.kv) for (const [k, v] of Object.entries(st.kv)) {
      h += `<div class="s-kv${has(c.keys, k) ? ' chg' : ''}"><i>${brk(k)}</i><b class="${clsOf(v)}">${brk(bare(v))}</b></div>`;
    }
    if (st.gg) h += `<div class="s-gg"><s data-gg="1"></s><i>${esc(st.gg.l || '')}</i><b>${esc(st.gg.r || '')}</b></div>`;
    const items = st.items || [], on = (x) => has(c.add, x) || has(c.mod, x);
    if (a.kind === 'list' || a.kind === 'frames') {
      const fr = a.kind === 'frames';
      h += fr ? '<div class="s-frs">' : '';
      for (const it of items) {
        const o = { sh: it.tag === 'free' ? 'line' : 'fill', c: cname(it.tag), on: on(it.id) };
        h += fr
          ? `<div class="s-fr${o.on ? ' chg' : ''}">${chip(it.id, o)}<b>${brk(it.id)}</b><span>${brk(it.sub || '')}</span></div>`
          /* id 와 설명 사이의 공백 — 붙여 썼더니 'RowExclusive' 와 'INSERT' 가 한 낱말이 되어 'INSER / T' 로 잘렸다 */
          : `<div class="s-li${o.on ? ' chg' : ''}">${chip(it.id, o)}<p><b>${brk(it.id)}</b>${it.sub ? ` <span>${brk(it.sub)}</span>` : ''}</p></div>`;
      }
      if (!items.length) h += `<div class="s-li none"><span>비어 있다</span></div>`;
      h += fr ? '</div>' : '';
    }
    /* bytes — 칸 폭 ∝ 크기(Lab 의 Bytes 와 같은 규칙). 이름은 칸보다 넓을 수 있어 칸 아래 줄에 따로 두고,
       어느 줄에 둘지는 재서 정한다(post) */
    if (a.kind === 'bytes') {
      h += `<div class="s-by">${items.map((it) => chip(it.id, { sh: it.tag === 'free' ? 'line' : 'fill', c: cname(it.tag), on: on(it.id), style: `flex-grow:${it.sz || 1}` })).join('')}</div>`;
      h += `<div class="s-byl">${items.map((it) => `<span data-lb="${esc(it.id)}"${on(it.id) ? ' class="chg"' : ''}><b>${brk(it.id)}</b>${it.sub ? `<i>${brk(it.sub)}</i>` : ''}</span>`).join('')}</div>`;
      if (!items.length) h += `<div class="s-li none"><span>비어 있다</span></div>`;
      if (st.byl) h += `<div class="s-kv"><i>${brk(st.byl.l || '')}</i><b>${brk(st.byl.r || '')}</b></div>`;
    }
    /* tree — 레벨마다 한 줄. 노드의 막대는 채움(fill)만큼 밝다, 92% 넘으면 금색(Lab 의 .tr-n.full) */
    if (a.kind === 'tree') {
      const lv = [...new Set(items.map((x) => x.lvl || 0))].sort((x, y) => x - y);
      h += '<div class="s-tr">' + lv.map((L, li) => `<div class="s-tl">${items.filter((x) => (x.lvl || 0) === L).map((x) => {
        const fl = typeof x.fill === 'number' ? x.fill : 1;
        return `<div class="s-tn${on(x.id) ? ' chg' : ''}">${chip(x.id, { sh: 'bar', f: fl, c: fl > 0.92 ? 'gold' : 'ink', on: on(x.id), lvl: L })}<b>${brk(x.id)}</b>${x.keys ? `<span>${brk(x.keys)}</span>` : ''}</div>`;
      }).join('')}</div>${li === lv.length - 1 ? '<div class="s-tlb">leaf</div>' : ''}`).join('') + '</div>';
    }
    /* axis — 수직선 위의 레코드(점)와 락 범위(막대). 범위 이름이 겹치지 않게 줄을 나누는 것은 재서 정한다(post) */
    if (a.kind === 'axis') {
      const { min = 0, max = 1 } = st.axis || {}, rg = (max - min) || 1, pc = (v) => (((v - min) / rg) * 100).toFixed(3) + '%';
      const sOn = (x) => has(c.span && c.span.add, x) || has(c.span && c.span.mod, x);
      h += '<div class="s-ax"><div class="s-axs">' + (st.spans || []).map((sp) => {
        const pt = sp.from === sp.to, kc = { next: 'gold', gap: 'gold', rec: 'accent', ii: 'green', blk: 'red' }[sp.kind] || 'accent';
        return `<div class="s-sp${pt ? ' pt' : ''}${sOn(sp.id) ? ' chg' : ''}" style="left:${pc(sp.from)};width:${pt ? '0' : `calc(${pc(sp.to)} - ${pc(sp.from)})`}">`
          + `<span class="k-${esc(sp.kind || 'rec')}">${esc(sp.lb || '')}</span>${chip('sp:' + sp.id, { sh: sp.kind === 'gap' ? 'line' : 'fill', c: kc, on: sOn(sp.id) })}</div>`;
      }).join('') + '</div><div class="s-axl">' + chip('@line', { sh: 'hline', c: 'faint' })
        + items.map((it) => `<div class="s-ar${it.tag === 'x' ? ' gone' : ''}" style="left:${pc(it.v)}">${chip('r:' + it.id, { sh: 'fill', c: it.tag === 'x' ? 'faint' : 'ink', on: on(it.id), dim: it.tag === 'x' })}<b>${esc(it.id)}</b></div>`).join('')
        + `<i class="lo">${esc(min)}</i><i class="hi">${esc(max)}</i></div></div>`;
    }
    /* graph — 노드는 한 줄, 간선은 호(앞으로 가는 것은 위, 되돌아오는 것은 아래). 간선 이름 자리는 재서 정한다(post) */
    if (a.kind === 'graph') {
      const eOn = (x) => has(c.edge && c.edge.add, x);
      h += '<div class="s-gr"><div class="s-gns">' + items.map((n) => `<div class="s-gn${on(n.id) ? ' chg' : ''}${n.tag === 'x' ? ' gone' : ''}">`
        + chip(n.id, { sh: n.tag === 'x' ? 'line' : 'fill', c: { hold: 'gold', wait: 'red', x: 'red' }[n.tag] || 'accent', on: on(n.id) })
        + `<b>${brk(n.id)}</b>${n.sub ? `<span>${brk(n.sub)}</span>` : ''}</div>`).join('') + '</div>'
        + (st.edges || []).map((e) => `<span class="s-ge${e.hot ? ' hot' : ''}${eOn(e.id) ? ' chg' : ''}" data-e="${esc(e.id)}" data-f="${esc(e.from)}" data-t="${esc(e.to)}">${esc(e.lb || '')}</span>`).join('')
        + (st.cycle ? `<div class="s-gcy">${esc(st.cycle)}</div>` : '') + '</div>';
    }
    /* matrix — + 는 채운 칸, - 는 빈 칸. 칸의 뜻은 덱이 적는다(mx.yes · no, 없으면 허용 · 막힘 — 강도 행렬은 예 · 아니오).
       on 은 밝히고, dim 이 있으면 나머지를 흐린다 */
    if (a.kind === 'matrix' && st.mx) {
      const { rows, cols, cells } = st.mx, mOn = new Set(st.mx.on || []), mDim = new Set(st.mx.dim || []);
      h += `<div class="s-mx" style="grid-template-columns:auto repeat(${cols.length},minmax(0,1fr))"><i></i>${cols.map((cc) => `<i class="ch">${esc(cc)}</i>`).join('')}`
        + rows.map((r, ri) => `<i class="rh">${esc(r)}</i>` + cols.map((cc, ci) => {
          const key = r + '/' + cc, yes = cells[ri] && cells[ri][ci] === '+';
          return chip('mx:' + key, { sh: yes ? 'fill' : 'line', c: yes ? 'green' : 'red', on: mOn.has(key), dim: mDim.size && !mDim.has(key) && !mOn.has(key) });
        }).join('')).join('') + `</div><div class="s-mxk"><span><s class="y"></s>${esc(st.mx.yes || '허용')}</span><span><s class="n"></s>${esc(st.mx.no || '막힘')}</span></div>`;
      if (st.mx.lb) h += `<div class="s-kv"><i>${brk(st.mx.lb.l || '')}</i><b>${brk(st.mx.lb.r || '')}</b></div>`;
    }
    return h;
  }
  /* 재서 놓는 것들 — 측정기 안에서 글의 실제 폭을 재고 자리를 정해 그 자리를 HTML 에 적는다(그대로 그린다).
     줄 나누기는 Lab 의 Axis 와 같은 탐욕법 : 왼쪽부터, 앞 것의 오른쪽 끝 + 6px 을 넘는 첫 줄에 */
  function post(id, root) {
    const kind = ACT[id].kind, rel = (e) => e.getBoundingClientRect();
    const lanesOf = (bx) => { const end = [], row = []; for (const [l, r] of bx) { let k = 0; while (end[k] !== undefined && l < end[k] + 6) k++; end[k] = r; row.push(k); } return { row, n: end.length }; };
    if (kind === 'bytes') {
      const wrap = root.querySelector('.s-byl');
      if (!wrap) return;
      const W = wrap.clientWidth, x0 = rel(wrap).left, lbs = [...wrap.children];
      /* 잰 폭을 못 박는다 — 절대 위치는 left 만큼 쓸 폭이 줄어, 오른쪽으로 옮긴 이름이 더 접히고 키가 커져
         다음 줄 · 아래 꼬리말을 덮었다(storysweep inbox-overlap, ch3 11 · heap 04) */
      lbs.forEach((lb) => { lb.style.width = Math.ceil(rel(lb).width + 0.5) + 'px'; });   /* offsetWidth 는 정수로 깎여 '헤더' 가 '헤 / 더' 로 접혔다 */
      const want = lbs.map((lb) => {
        const s = root.querySelector(`.s-by s[data-it="${CSS.escape(lb.dataset.lb)}"]`), r = rel(s), w = lb.offsetWidth;
        return Math.max(0, Math.min(W - w, r.left - x0 + r.width / 2 - w / 2));
      });
      const ord = lbs.map((_, i) => i).sort((p, q) => want[p] - want[q]);
      const { row, n } = lanesOf(ord.map((i) => [want[i], want[i] + lbs[i].offsetWidth]));
      const rowH = [];
      ord.forEach((i, j) => { rowH[row[j]] = Math.max(rowH[row[j]] || 0, lbs[i].offsetHeight); });
      const top = rowH.map((_, k) => rowH.slice(0, k).reduce((s, x) => s + x + 4, 0));
      ord.forEach((i, j) => Object.assign(lbs[i].style, { left: want[i].toFixed(1) + 'px', top: top[row[j]] + 'px' }));
      wrap.style.height = (n ? top[n - 1] + rowH[n - 1] : 0) + 'px';
    }
    if (kind === 'axis') {
      const wrap = root.querySelector('.s-axs');
      if (!wrap) return;
      const W = wrap.clientWidth, x0 = rel(wrap).left, sps = [...wrap.children];
      /* 이름은 막대 가운데 — 상자 끝을 넘으면 안으로 민다 */
      const bx = sps.map((sp) => {
        const lb = sp.firstElementChild, r = rel(sp), w = lb.offsetWidth, c = r.left - x0 + r.width / 2;
        const l = Math.max(0, Math.min(W - w, c - w / 2));
        lb.style.marginLeft = (l - (c - w / 2)).toFixed(1) + 'px';
        return [l, l + w];
      });
      const ord = sps.map((_, i) => i).sort((p, q) => bx[p][0] - bx[q][0]);
      const { row, n } = lanesOf(ord.map((i) => bx[i]));
      ord.forEach((i, j) => { sps[i].style.top = row[j] * 22 + 'px'; });
      wrap.style.height = Math.max(1, n) * 22 + 'px';
    }
    if (kind === 'graph') {
      const gr = root.querySelector('.s-gr');
      if (!gr) return;
      const ns = root.querySelector('.s-gns'), g0 = rel(gr), cx = {};
      ns.querySelectorAll('s[data-it]').forEach((s) => { const r = rel(s); cx[s.dataset.it] = r.left - g0.left + r.width / 2; });
      const order = [...ns.querySelectorAll('s[data-it]')].map((s) => s.dataset.it);
      /* 짧은 간선부터 노드에 가까운 줄에 — 긴 간선이 짧은 것을 가로지르지 않게 */
      const span = (e) => Math.abs(cx[e.dataset.f] - cx[e.dataset.t]);
      const es = [...gr.querySelectorAll('.s-ge')].filter((e) => cx[e.dataset.f] != null && cx[e.dataset.t] != null).sort((p, q) => span(p) - span(q));
      const bag = { up: [], dn: [] }, place = [];
      for (const e of es) {
        const i = order.indexOf(e.dataset.f), j = order.indexOf(e.dataset.t), dn = j < i;
        const l = Math.min(cx[e.dataset.f], cx[e.dataset.t]), r = Math.max(cx[e.dataset.f], cx[e.dataset.t]);
        const b = bag[dn ? 'dn' : 'up'];
        let k = 0;
        while (b[k] !== undefined && l < b[k] + 6) k++;
        b[k] = r;
        place.push({ e, dn, k, c: (l + r) / 2 });
      }
      const LH = 18, up = bag.up.length, dn = bag.dn.length, pt = up ? up * LH + 6 : 4, pb = dn ? dn * LH + 6 : 4;
      ns.style.paddingTop = pt + 'px';
      ns.style.paddingBottom = pb + 'px';
      const nr = rel(ns), top = nr.top - g0.top + pt, bot = nr.bottom - g0.top - pb;
      for (const { e, dn: d, k, c } of place) {
        const w = e.offsetWidth, l = Math.max(0, Math.min(gr.clientWidth - w, c - w / 2));
        const y = d ? bot + k * LH + 4 : top - (k + 1) * LH + 2;
        Object.assign(e.style, { left: l.toFixed(1) + 'px', top: y.toFixed(1) + 'px' });
        e.dataset.d = d ? '1' : '';
      }
      gr.querySelectorAll('.s-ge').forEach((e) => { if (!es.includes(e)) e.remove(); });
    }
  }
  const tagged = (id) => `<div class="s-hd">${esc(ACT[id].nm)}</div>`;

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(5);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  /* bytes 는 최소 두 칸 — 폭이 크기에 비례하는 띠라 가로가 곧 정보다. 한 칸(172px)에 8 칸을 넣었더니 이름이 7 줄로
     밀리고 지시선이 서로 엇갈렸다(postgres heap 02). matrix 도 열이 5 개를 넘으면 두 칸(pg locks 03 의 8 × 8) */
  const mxCols = (id) => Math.max(0, ...[...bakes.values()].flatMap(({ frames }) => frames.map((fr) => (fr.st[id] && fr.st[id].mx ? fr.st[id].mx.cols.length : 0))));
  const units = (id) => {
    const a = ACT[id], u = a.w === 'w2' ? 2 : a.w === 'w15' ? 1.5 : a.w === 'wide' ? 4 : 1;
    return a.kind === 'bytes' || (a.kind === 'matrix' && mxCols(id) > 5) ? Math.max(2, u) : u;
  };
  /* 측정기 안의 칩 · 이름 · 간선 자리 — 상자 왼쪽 위 기준 */
  function readChips() {
    const base = measurer.getBoundingClientRect(), m = {}, rel = (r) => ({ dx: r.left - base.left, dy: r.top - base.top, w: r.width, h: r.height });
    measurer.querySelectorAll('s[data-it]').forEach((s) => {
      const d = s.dataset;
      m[d.it] = { ...rel(s.getBoundingClientRect()), sh: d.sh, c: COL[d.c] ?? INK, f: d.f != null ? +d.f : null, on: !!d.on, dim: !!d.dim, lvl: d.l != null ? +d.l : null };
      /* graph 노드의 아래 끝(이름까지) — 되돌아오는 간선은 여기서 나간다. 칩 아래에서 나가게 했더니 세로선이 노드 이름 위를
         지나갔다(innodb 08 · pg locks 04 · 05) */
      const gn = s.closest('.s-gn');
      if (gn) m[d.it].nb = gn.getBoundingClientRect().bottom - base.top;
    });
    const g = measurer.querySelector('s[data-gg]');
    if (g) m['@gg'] = rel(g.getBoundingClientRect());
    /* bytes 이름 — 칸에서 비켜 놓였으면 지시선을 긋는다 */
    measurer.querySelectorAll('.s-byl [data-lb]').forEach((lb) => { m['lb:' + lb.dataset.lb] = rel(lb.getBoundingClientRect()); });
    /* graph 간선 — 두 끝은 노드 칩, 꼭대기는 이름 자리 */
    measurer.querySelectorAll('.s-ge').forEach((e) => { m['e:' + e.dataset.e] = { ...rel(e.getBoundingClientRect()), from: e.dataset.f, to: e.dataset.t, dn: !!e.dataset.d, hot: e.classList.contains('hot') }; });
    return m;
  }
  function build(L) {
    /* 열 수는 상자 폭이 MIN_COL 을 넘게 — 1024 폭에서 4 열로 나눴더니 상자가 101px 이라
       'trx_rows_locked'(99px) 이 상자 밖으로 나갔다(storysweep box-overflow 49 건) */
    const ww = L.x1 - L.x0, gap = L.narrow ? 8 : 12, MIN_COL = 150;
    const cols = Math.max(2, Math.min(4, Math.floor((ww + gap) / (MIN_COL + gap)))), colW = (ww - (cols - 1) * gap) / cols;
    /* 1 : 상자 폭을 정하고, 모든 스텝 · 값의 내용을 재서 높이를 정한다. 재서 놓은 HTML 은 그대로 그리도록 둔다 */
    const width = {}, height = {}, chips = new Map(), hk = new Map(), html = new Map();
    for (const id of cast) {
      const u = Math.min(cols, units(id));
      width[id] = u * colW + (u - 1) * gap;
      measurer.style.width = width[id] + 'px';
      let hmax = 0;
      for (const [v, { frames }] of bakes) {
        frames.forEach((fr, k) => {
          measurer.innerHTML = inner(id, fr.st[id] || {}, fr.chg[id]);
          post(id, measurer);
          html.set(v + '|' + k + '|' + id, measurer.innerHTML);
          hk.set(v + '|' + k + '|' + id, measurer.offsetHeight);
          hmax = Math.max(hmax, measurer.offsetHeight);
          chips.set(v + '|' + k + '|' + id, readChips());
        });
      }
      /* init(스텝 0 의 앞) 도 잰다 — 첫 스텝의 출발 자리 */
      measurer.innerHTML = inner(id, sc.init[id] || {}, null);
      post(id, measurer);
      hmax = Math.max(hmax, measurer.offsetHeight);
      height[id] = hmax;
    }
    /* 꼬리표(접힌 배우) — 이름만, 폭은 글대로 */
    measurer.className = 'stn tag stn-measure'; measurer.style.width = '';
    const tagW = {};
    let tagH = 0;
    for (const id of cast) { measurer.innerHTML = tagged(id); tagW[id] = measurer.offsetWidth; tagH = Math.max(tagH, measurer.offsetHeight); }
    measurer.className = 'stn stn-measure'; measurer.innerHTML = '';
    G = { L, chips, html, gap, cols, colW, width, height, hk, tagW, tagH, lays: new Map() };
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
  const chipsAt = (k, id) => G.chips.get(vary + '|' + k + '|' + id) || G.chips.get('null|' + k + '|' + id) || {};
  const chipOf = (k, id, it) => chipsAt(k, id)[it] || null;
  const baseKey = (key) => key.replace(/^(sp|r|mx):/, '');

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  /* 칩 안의 m 번째 알갱이 자리 — fill · bar 는 격자, line 은 테두리, hline 은 가운데 가로선 */
  function chipPt(ch, n, m) {
    if (ch.sh === 'line') return U.rectPath(ch.dx, ch.dy, ch.w, ch.h)((m + 0.5) / n);
    if (ch.sh === 'hline') return [ch.dx + ((m + 0.5) / n) * ch.w, ch.dy + ch.h / 2];
    const cols = Math.max(2, Math.round(Math.sqrt(n * (ch.w / Math.max(1, ch.h)))));
    return [ch.dx + (((m % cols) + 0.5) / cols) * ch.w, ch.dy + ((Math.floor(m / cols) + 0.5) / Math.ceil(n / cols)) * ch.h];
  }
  function pose(k, p, t, o) {
    if (!G) return;
    const { frames, steps } = cur(), nk = frames.length, kk = Math.min(k, nk - 1), lay = layOf(vary, kk);
    const end = k >= nk, fr = frames[kk], step = steps[kk] || {};
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
        for (const key of keys[id].keys()) hide(...R['it:' + id + ':' + key]);
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
      /* 칩 — 이 스텝에 있으면 그 자리에, 없으면(꼬리표도) 상자 가운데로 사라진다 */
      const here = b.tag ? {} : chipsAt(kk, id), prevC = kk > 0 ? chipsAt(kk - 1, id) : null;
      for (const key of keys[id].keys()) {
        const [s0, s1] = R['it:' + id + ':' + key], n = s1 - s0, ch = here[key] || null;
        const lk = ch && ((Array.isArray(look[id]) && look[id].includes(baseKey(key))) || (!end && ch.on));
        /* 새로 생긴 칩 — act 의 출발 배우에서. 같은 key 의 칩이 있으면 그 칩에서(같은 page 가 디스크에서 올라온다) */
        const born = ch && act && act.t === id && prevC && !prevC[key];
        let ox = null, oy = null;
        if (born) {
          const src = chipOf(kk, act.f, key) || chipOf(kk - 1, act.f, key);
          [ox, oy] = src && lay.box[act.f] ? abs(lay, act.f, src.dx + src.w / 2, src.dy + src.h / 2) : lay.box[act.f] ? center(lay, act.f) : center(lay, id);
        }
        const line = ch && (ch.sh === 'line' || ch.sh === 'hline');
        for (let m = 0; m < n; m++) {
          const i = s0 + m;
          let x, y, a, bg = false;
          if (ch) {
            [x, y] = abs(lay, id, ...chipPt(ch, n, m));
            a = end ? 0.08 : line ? 0.45 : lk ? 1 : 0.85;
            /* bar — 앞 f 만큼 밝게, 나머지는 흐린 바탕(Lab 의 채움 막대) */
            if (ch.sh === 'bar') {
              const cols = Math.max(2, Math.round(Math.sqrt(n * (ch.w / Math.max(1, ch.h)))));
              if (((m % cols) + 0.5) / cols > ch.f) { a = end ? 0.05 : 0.2; bg = true; }
            }
            if (ch.dim) a *= 0.3;
            if (born) { const q = show(fly, (m % 7) * 0.02, 0.85 + (m % 7) * 0.02); x = U.lerp(ox + jit[i * 2] * 10, x, q); y = U.lerp(oy + jit[i * 2 + 1] * 10, y, q); }
          } else { [x, y] = center(lay, id); a = 0; }
          put(o, i, U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form), a * form, lk && !bg ? 1 : 0, 0.05, line ? 0.9 : 1.15, !ch || bg ? FAINT : lk ? GOLD : ch.c);
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
      for (const id of cast) {
        const bx = C.box[id], e = boxEl[id];
        if (!bx) continue;
        e.className = bx.tag ? 'stn tag' : 'stn';
        e.innerHTML = bx.tag ? tagged(id) : G.html.get(vary + '|' + kk + '|' + id) ?? G.html.get('null|' + kk + '|' + id);
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
  /* 상자 안의 선 — tree 의 부모 → 자식, graph 의 간선, bytes 의 이름 지시선. 칩 자리에서 잇는다 */
  function inLines(ctx, C, kk, id, o) {
    const ch = chipsAt(kk, id), P = (dx, dy) => abs(C, id, dx, dy), kind = ACT[id].kind;
    if (kind === 'tree') {
      /* 위 레벨에 노드가 하나뿐이면 그것이 아래 레벨 전부의 부모다 — 그때만 잇는다(데이터에 없는 연결을 지어내지 않게) */
      const lv = {};
      for (const [key, c] of Object.entries(ch)) if (c.lvl != null) (lv[c.lvl] ||= []).push(c);
      const ls = Object.keys(lv).map(Number).sort((x, y) => x - y);
      ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.faint; ctx.lineWidth = 1; ctx.setLineDash([]);
      for (let i = 0; i + 1 < ls.length; i++) {
        if (lv[ls[i]].length !== 1) continue;
        const pa = lv[ls[i]][0], [x0, y0] = P(pa.dx + pa.w / 2, pa.dy + pa.h);
        for (const cc of lv[ls[i + 1]]) { const [x1, y1] = P(cc.dx + cc.w / 2, cc.dy); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      }
    }
    if (kind === 'graph') {
      for (const [key, e] of Object.entries(ch)) {
        if (!key.startsWith('e:')) continue;
        const a = ch[e.from], b2 = ch[e.to];
        if (!a || !b2) continue;
        /* 가로선은 이름 한가운데로 — 이름에 바탕을 깔아 선이 글자 밑으로 지나가게 */
        const ya = e.dn ? (a.nb ?? a.dy + a.h) + 2 : a.dy, yb = e.dn ? (b2.nb ?? b2.dy + b2.h) + 2 : b2.dy, apex = e.dy + e.h / 2;
        const [x0, y0] = P(a.dx + a.w / 2, ya), [x1, y1] = P(b2.dx + b2.w / 2, yb), [, yc] = P(0, apex);
        ctx.globalAlpha = (e.hot ? 0.95 : 0.6) * o; ctx.strokeStyle = e.hot ? css.gold : css.body; ctx.lineWidth = e.hot ? 1.5 : 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, yc); ctx.lineTo(x1, yc); ctx.lineTo(x1, y1); ctx.stroke();
        /* 화살머리 — 목적지 쪽 다리 끝 */
        const s = 4 * C.z, dir = e.dn ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(x1 - s, y1 - dir * s * 1.6); ctx.lineTo(x1, y1); ctx.lineTo(x1 + s, y1 - dir * s * 1.6); ctx.stroke();
      }
    }
    if (kind === 'bytes') {
      ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint; ctx.lineWidth = 1; ctx.setLineDash([]);
      for (const [key, lb] of Object.entries(ch)) {
        if (!key.startsWith('lb:')) continue;
        const c = ch[key.slice(3)];
        if (!c) continue;
        const cx = c.dx + c.w / 2, lx = lb.dx + lb.w / 2;
        if (Math.abs(cx - lx) < 2 && lb.dy - (c.dy + c.h) < 10) continue;
        const [x0, y0] = P(cx, c.dy + c.h + 1), [x1, y1] = P(lx, lb.dy - 1);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
  }
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { steps } = cur(), nk = steps.length, kk = Math.min(b > 0.5 ? next : k, nk - 1), step = steps[kk] || {};
    const [A, B] = pair(k, next, nk), C = b > 0.5 ? B : A, fade = Math.abs(1 - 2 * b);
    const hot = step.hot || (step.act && step.act.hot), end = (b > 0.5 ? next : k) >= nk;
    const form = k === 0 ? show(p, 0.18, 0.36) : 1;
    ctx.save();
    for (const { ei, Y } of C.edge) {
      const lit = hot && hot === EDG[ei].hot;
      ctx.globalAlpha = (lit ? 0.95 : 0.45) * (sameEdge(A, B, ei) ? 1 : fade); ctx.strokeStyle = lit ? css.gold : css.faint; ctx.lineWidth = lit ? 1.5 : 1;
      ctx.setLineDash(lit ? [] : [3, 4]);
      ctx.beginPath(); ctx.moveTo(G.L.x0, Y); ctx.lineTo(G.L.x1, Y); ctx.stroke();
    }
    for (const id of cast) {
      const bx = C.box[id];
      if (!bx || bx.tag || !['tree', 'graph', 'bytes'].includes(ACT[id].kind)) continue;
      inLines(ctx, C, kk, id, (end ? 0.18 : 1) * form * (sameBox(A, B, id) ? 1 : fade));
    }
    ctx.restore();
    edgeEl.forEach((el2, i) => el2.classList.toggle('gold', !!(hot && hot === EDG[i].hot)));
  }

  return {
    build(L) { this.theme(); build(L); shown = -2; },
    theme() {
      const cs = getComputedStyle(document.documentElement);
      css = { faint: cs.getPropertyValue('--faint').trim(), gold: cs.getPropertyValue('--gold').trim(), body: cs.getPropertyValue('--body').trim() };
    },
    pose, paint, overlay,
    setVary(v) { const vv = v == null ? null : String(v); if (bakes.has(vv)) vary = vv; },
    dispose() { made.forEach((e) => e.remove()); },
  };
}
