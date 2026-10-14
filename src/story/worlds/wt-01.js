/* mongodb wiredtiger 01 — update chain. 위는 메모리(CACHE)의 사슬, 아래는 디스크(DISK)의 이미지, 사이가 reconciliation 경계다.
   그리는 것은 모두 장면의 bake 상태에서 읽는다(손으로 적은 값이 없다) —
     · 사슬 = UPDATE CHAIN 의 항목, 앞이 새것(머리). tag 'free' 는 빈 사슬의 자리표시라 덩어리 없이 테두리만
     · 커밋 전(wait)은 금빛, 커밋됨(ok)은 먹색. 이미지 = DISK IMAGE 의 항목
     · head 는 사슬의 첫 항목을 가리키고, 사슬의 끝에서 이미지로 점선 — 더 옛 값은 이미지에 있다
     · act 는 그 update 의 알갱이가 f(OPERATION)에서 t(사슬의 머리)로 날아가 덩어리가 된다
     · 사슬은 그대로인데 OPERATION 의 명령이 바뀐 스텝(4 : 다른 세션의 갱신)은 그 명령이 머리에 다가갔다가 튕겨 흩어진다 —
       사슬에 못 들어갔다는 것은 데이터(bake 의 변경에 chain 이 없다)이고, 움직임은 그것을 보일 뿐이다
     · 사슬을 보기만 하는 스텝(3 : CAS)은 head 가 한 번 밝아진다
     · 그 스텝이 건드린 배우(touch)는 또렷하게, 나머지는 흐리게
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, FAINT, U } from '../field.js';
import { bake, stepsOf } from '../../bake.js';

const HANGUL = /[가-힣]/;
const NODE = 220, IMG = 320, HEAD = 36, GHOST = 140;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));

export default {
  count: (narrow) => (narrow ? 3000 : 4200),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const frames = bake(sc, null), steps = stepsOf(sc, null), NK = frames.length;

  /* ── 상태 읽기 ── */
  const read = (st, step, chg, touch) => ({
    chain: st.chain.items.map((it) => ({ id: it.id, tag: it.tag, sub: it.sub || '' })), img: st.img.items,
    op: st.op.kv, cmp: st.cmp.kv, step: step || {}, touch: touch || new Set(),
    chainMod: new Set(chg && chg.chain ? [...chg.chain.mod, ...chg.chain.add] : []),
    imgMod: new Set(chg && chg.img ? chg.img.mod : []),
    /* 사슬은 그대로인데 명령이 바뀌었다 — 그 명령은 사슬에 들어가지 못했다 */
    bounced: !!(chg && chg.op && chg.op.keys.includes('명령') && !chg.chain),
  });
  const S0 = read(sc.init), S = frames.map((fr, k) => read(fr.st, steps[k], fr.chg, fr.touch));
  /* 사슬을 보기만 하는 스텝(3 : CAS) — 바꾸지도, 튕겨 내지도 않는다(4 의 요점은 head 가 아니라 사슬을 걷는 검사다) */
  S.forEach((s, k) => { s.looked = !!(s.step.look && s.step.look.chain && !frames[k].chg.chain && !s.bounced); });
  const live = (s) => s.chain.filter((x) => x.tag !== 'free');
  const NIDS = [...new Set([S0, ...S].flatMap((s) => s.chain.map((x) => x.id)))];
  const MAXN = Math.max(1, ...[S0, ...S].map((s) => s.chain.length));
  if ([S0, ...S].some((s) => s.img.length !== 1)) console.error('wt 01 세계 : DISK IMAGE 의 항목이 하나가 아니다 — 이 세계는 행 하나를 그린다');

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  NIDS.forEach((id) => take('n:' + id, NODE));
  take('img', IMG); take('head', HEAD); take('ghost', GHOST);
  R.DST = [at, N];
  if (at > N) throw new Error('wt 01 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

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
  const LN = deck.LANES || [], lane = (id) => LN.find((l) => l.id === id);
  const EDGE = (deck.EDGES || []).find((e) => e.after === 'mem' && e.before === 'disk') || null;
  const hdOp = label('aq'), txOp = label('aq ml');
  const memLb = label('aq'), diskLb = label('aq'), edgeLb = label('aq');
  const headLb = label('aq');
  const nodeLb = Object.fromEntries(NIDS.map((id) => [id, label('aq ml aq-c')]));
  const imgLb = label('aq ml aq-c');
  const hdCmp = label('aq'), txCmp = label('aq ml');
  const tok = label('stn-tok');

  /* 스텝마다의 글과 강조 — [글, 또렷한가, 색, 보이나, html] */
  const TX = S.map((s) => {
    const t = new Map(), on = (id) => s.touch.has(id);
    t.set(hdOp, [A.op.nm, on('op')]);
    t.set(txOp, [Object.entries(s.op).map(([k, v]) => `<span class="q-i">${esc(k)}</span>  ${val(v)}`).join('\n'), on('op'), '', true, true]);
    const mem = lane('mem'), disk = lane('disk');
    if (mem) t.set(memLb, [`${mem.lb}  ·  ${mem.note}`, on('chain')]);
    if (disk) t.set(diskLb, [`${disk.lb}  ·  ${disk.note}`, on('img')]);
    if (EDGE) t.set(edgeLb, [EDGE.lb, false]);
    t.set(headLb, [`${A.chain.nm}  ·  head`, on('chain'), s.looked ? 'gold' : '']);
    for (const id of NIDS) {
      const it = s.chain.find((x) => x.id === id);
      if (!it) { t.set(nodeLb[id], ['', false, '', false, true]); continue; }
      const cls = it.tag === 'wait' ? 'q-g' : '';
      t.set(nodeLb[id], [`<span class="q-i">${esc(id)}</span>\n<span class="${cls}">${esc(it.sub)}</span>`, on('chain') && (s.chainMod.size ? s.chainMod.has(id) : true), '', true, true]);
    }
    const im = s.img[0] || { id: '?', sub: '' };
    t.set(imgLb, [`<span class="q-i">${esc(A.img.nm)}  ·  ${esc(im.id)}</span>\n<span class="${s.imgMod.size ? 'q-g' : ''}">${esc(im.sub || '')}</span>`, on('img'), '', true, true]);
    t.set(hdCmp, [A.cmp.nm, on('cmp')]);
    t.set(txCmp, [Object.entries(s.cmp).map(([k, v]) => `<span class="q-i">${esc(k)}</span>\n${val(v)}`).join('\n'), on('cmp'), '', true, true]);
    return t;
  });
  /* 재는 동안 넣은 글은 되돌린다 — 글꼴이 늦게 와 다시 짤 때 다음 paint 전까지 마지막 스텝의 글이 남아,
     그 사이에 잰 storysweep 이 wiredtiger 01 / 2 에서 5 스텝의 글을 보았다 */
  const most = (lb) => {
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const t of TX) {
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
  const rnd = U.rng(3);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0;
    /* 사슬 — head 칸 다음에 마디가 왼쪽부터(새것이 앞). head · 마디 · 이미지를 세계의 가운데 세로줄에 */
    const gap = 44, cw = Math.round(U.clamp((ww - 66 - (MAXN - 1) * gap) / MAXN, 90, Math.min(170, ww * 0.3))), ch = Math.round(cw * 0.52);
    const chainW = 66 + MAXN * cw + (MAXN - 1) * gap, hx = L.x0 + Math.max(0, (ww - chainW) / 2), nx0 = hx + 66;
    for (const id of NIDS) wrap(nodeLb[id], cw + gap - 10);
    /* 위 줄 — OPERATION 은 왼쪽, vs INNODB 는 오른쪽 */
    const cx = L.x0 + ww * 0.62;
    wrap(txOp, cx - 24 - L.x0); wrap(txCmp, L.x1 - cx); wrap(imgLb, Math.min(ww, cw * 2.4));
    const opH = most(txOp).h, topH = Math.max(opH, most(txCmp).h), nodeH = Math.max(...NIDS.map((id) => most(nodeLb[id]).h)), imgH = most(imgLb).h;
    const iw = Math.round(Math.min(ww * 0.62, cw * 1.6)), ih = Math.round(ch * 0.9);
    /* 세로 — 위에서부터 쌓아 높이를 재고, 넓은 화면은 가운데로 */
    const memY = 18 + topH + 34, chainY = memY + 44 + ch / 2;
    const edgeY = chainY + ch / 2 + 10 + nodeH + 30, diskY = edgeY + 10, imgY = diskY + 40 + ih / 2, total = imgY + ih / 2 + 10 + imgH;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2), Y = (v) => L.y0 + dy + v;
    const nodes = Array.from({ length: MAXN }, (_, j) => ({ x: nx0 + cw / 2 + j * (cw + gap), y: Y(chainY) }));
    G = { L, cw, ch, iw, ih, hx, nodes, head: { x: hx + 12, y: Y(chainY) }, img: { x: nodes[0].x, y: Y(imgY) }, edgeY: Y(edgeY), opA: { x: L.x0 + 40, y: Y(18 + opH + 12) } };   /* act 의 출발점 — OPERATION 글 바로 아래(글 위에서 출발하면 덮는다) */
    place(hdOp, L.x0, Y(0)); place(txOp, L.x0, Y(18));
    place(hdCmp, cx, Y(0)); place(txCmp, cx, Y(18));
    /* 레인 이름은 오른쪽 — 사슬 끝에서 이미지로 내려가는 점선이 글자를 가로지르지 않게 */
    place(memLb, L.x1, Y(memY), 'r');
    /* head 이름표는 마디 위 — 마디 덩어리에 얹히지 않게 */
    place(headLb, nx0, Y(chainY) - ch / 2 - 6, 'l', 'b');
    if (EDGE) place(edgeLb, L.x1, Y(edgeY) - 3, 'r', 'b');
    place(diskLb, L.x1, Y(diskY), 'r');
    place(imgLb, G.img.x, Y(imgY) + ih / 2 + 10, 'c', 't');
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  const nodeAt = (s, id) => G.nodes[Math.max(0, s.chain.findIndex((x) => x.id === id))];

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  /* 격자 — 줄 수를 내림으로 잡는다(올림이면 마지막 줄이 덜 차 덩어리 아래가 이가 빠졌다). 남는 알갱이는 셋째 값이 false — 숨긴다 */
  function grid(cx, cy, w, h, n, m) {
    const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h)))), rows = Math.max(1, Math.floor(n / cols));
    return [cx - w / 2 + ((m % cols) + 0.5) / cols * w, cy - h / 2 + (Math.floor(m / cols) % rows + 0.5) / rows * h, m < cols * rows];
  }
  /* 테두리 위의 m 번째 점(빈 자리표시) */
  function rim(cx, cy, w, h, n, m) {
    const per = 2 * (w + h), d = (m / n) * per;
    if (d < w) return [cx - w / 2 + d, cy - h / 2];
    if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)];
    if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2];
    return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)];
  }
  function pose(k, p, t, o) {
    if (!G) return;
    const end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    const { cw, ch, iw, ih, img } = G;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const chainOn = s.touch.has('chain') && !end;
    /* 사슬의 마디 */
    for (const id of NIDS) {
      const [n0] = R['n:' + id], it = s.chain.find((x) => x.id === id), pv = prev.chain.find((x) => x.id === id);
      if (!it && !(pv && !end)) { for (let m = 0; m < NODE; m++) put(o, n0 + m, dust[(n0 + m) * 2], dust[(n0 + m) * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
      const P = it ? nodeAt(s, id) : nodeAt(prev, id), gone = it ? 0 : show(p, 0.1, 0.3);
      const born = it && !pv && !end, mod = it && pv && pv.tag !== it.tag && !end;
      /* 새 마디는 act 의 f 에서 날아온다 — 알갱이마다 조금씩 늦게 */
      const src = born && act && act.f === 'op' ? G.opA : null;
      const hot = s.chainMod.size ? s.chainMod.has(id) : true;
      const base = (chainOn ? (hot ? 0.92 : 0.55) : 0.5) * dim * form * (1 - gone);
      const free = (it || pv).tag === 'free', wait = it && it.tag === 'wait';
      /* 4 : 튕겨 나간 명령이 머리를 짚는 동안 이 마디(커밋 전)를 검사한다 — 잠깐 빨갛게 */
      const probe = !end && s.bounced && s.chain[0] && s.chain[0].id === id ? show(p, 0.24, 0.3) * (1 - show(p, 0.36, 0.44)) : 0;
      for (let m = 0; m < NODE; m++) {
        const i = n0 + m, f = m / NODE;
        let [x, y, ing = true] = free ? rim(P.x, P.y, cw, ch, NODE, m) : grid(P.x, P.y, cw, ch, NODE, m);
        if (src) { const e = show(p, 0.08 + f * 0.16, 0.26 + f * 0.16); x = U.lerp(src.x + jit[i * 2] * 16, x, e); y = U.lerp(src.y + jit[i * 2 + 1] * 16, y, e) - Math.sin(e * Math.PI) * 30; }
        [x, y] = into(i, x, y);
        /* 커밋 전 → 커밋됨(5) : 금빛이 알갱이마다 차례로 먹색이 된다 */
        const tw = mod && pv.tag === 'wait' ? p < 0.12 + f * 0.24 : false;
        const col = probe > 0.5 ? RED : free ? FAINT : wait || tw ? GOLD : INK;
        put(o, i, x, y, (free ? base * 0.5 * (m % 2) : base) * ing, probe * 0.8 + (wait && chainOn ? 0.3 : 0), 0.05, 1.15, col);
      }
    }
    /* 이미지 — 디스크의 행. 사슬이 무엇을 하든 그대로다 */
    const [g0] = R.img, imgOn = s.touch.has('img') && !end;
    for (let m = 0; m < IMG; m++) {
      const i = g0 + m, [gx, gy, ing] = grid(img.x, img.y, iw, ih, IMG, m), [x, y] = into(i, gx, gy);
      put(o, i, x, y, (imgOn ? 0.9 : 0.5) * dim * form * ing, imgOn && s.imgMod.size ? 0.4 : 0, 0.04, 1.1, INK);
    }
    /* head 칸 */
    const [h0] = R.head;
    for (let m = 0; m < HEAD; m++) { const i = h0 + m, [gx, gy, ing] = grid(G.head.x, G.head.y, 14, 14, HEAD, m), [x, y] = into(i, gx, gy); put(o, i, x, y, (chainOn ? 0.95 : 0.5) * dim * form * ing, s.looked && !end ? 0.7 : 0, 0.03, 1.2, s.looked && !end ? GOLD : INK); }
    /* 튕겨 나간 명령 — OPERATION 에서 머리 앞까지 가서 흔들리고 흩어진다(0.5 까지) */
    const [q0] = R.ghost;
    if (!end && s.bounced) {
      const tx = G.head.x, ty = G.head.y - 40, e = U.smooth(show(p, 0.08, 0.26)), sh = show(p, 0.26, 0.36), gone = show(p, 0.36, 0.5);
      for (let m = 0; m < GHOST; m++) {
        const i = q0 + m, r = Math.sqrt((m + 0.5) / GHOST) * 12, th = m * 2.399;
        const wob = Math.sin(sh * Math.PI * 6) * 6 * (1 - sh);
        const x = U.lerp(G.opA.x, tx, e) + Math.cos(th) * r * (1 + gone * 4) + wob, y = U.lerp(G.opA.y, ty, e) + Math.sin(th) * r * (1 + gone * 4) + gone * 26;
        put(o, i, x, y, (p > 0.08 ? 0.92 : 0) * (1 - gone), 0.6, 0.15, 1.2, RED);
      }
    } else for (let m = 0; m < GHOST; m++) put(o, q0 + m, dust[(q0 + m) * 2], dust[(q0 + m) * 2 + 1], 0, 0, 2, 1, FAINT);
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = TX[Math.min(k, NK - 1)], TB = TX[Math.min(next, NK - 1)], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
      }
      for (const it of S[kk].chain) { const P = nodeAt(S[kk], it.id); place(nodeLb[it.id], P.x, P.y + G.ch / 2 + 10, 'c', 't'); }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    /* act 이름표 — 새 마디의 알갱이를 따라가고 0.52 까지 사라진다. 세계 밖으로 나가지 않게 묶는다 */
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act) {
      const T0 = s.chain[0] ? nodeAt(s, s.chain[0].id) : G.nodes[0], e = show(p, 0.08, 0.42);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(G.opA.x, T0.x, e) + 14)), y = Math.max(G.L.y0, U.lerp(G.opA.y, T0.y - G.ch / 2, e) - Math.sin(e * Math.PI) * 30 - 18);
      tok.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  function arrow(ctx, x0, y0, x1, y1) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 7 * Math.cos(a - 0.45), y1 - 7 * Math.sin(a - 0.45));
    ctx.moveTo(x1, y1); ctx.lineTo(x1 - 7 * Math.cos(a + 0.45), y1 - 7 * Math.sin(a + 0.45)); ctx.stroke();
  }
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L, cw, ch, iw, ih, img, head, edgeY } = G;
    const chainOn = s.touch.has('chain') && !end;
    ctx.save();
    /* reconciliation · journal 경계 */
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(L.x0, edgeY); ctx.lineTo(L.x1, edgeY); ctx.stroke();
    /* head → 첫 마디. 빈 사슬이면 점선(가리킬 update 가 없다). 3 의 CAS 는 한 번 밝아진다 */
    const c0 = s.chain[0], P0 = c0 ? nodeAt(s, c0.id) : G.nodes[0], empty = !c0 || c0.tag === 'free';
    const pulse = s.looked && k === kk && !end ? show(p, 0.1, 0.24) * (1 - show(p, 0.32, 0.46)) : 0;
    ctx.globalAlpha = (empty ? 0.4 : chainOn ? 0.9 : 0.5) * o; ctx.strokeStyle = s.looked && !end ? css.gold : css.ink;
    ctx.lineWidth = 1.5 + pulse * 2; ctx.setLineDash(empty ? [3, 4] : []);
    arrow(ctx, head.x + 9, head.y, P0.x - cw / 2 - 4, P0.y);
    /* 마디 → 다음 마디, 끝에서 이미지로(더 옛 값은 이미지) */
    const nodes = live(s);
    ctx.lineWidth = 1.2; ctx.strokeStyle = css.ink;
    for (let j = 0; j + 1 < nodes.length; j++) {
      const A0 = nodeAt(s, nodes[j].id), B0 = nodeAt(s, nodes[j + 1].id);
      ctx.globalAlpha = (chainOn ? 0.8 : 0.45) * o; ctx.setLineDash([]); arrow(ctx, A0.x + cw / 2 + 4, A0.y, B0.x - cw / 2 - 4, B0.y);
    }
    if (nodes.length) {
      const Z = nodeAt(s, nodes[nodes.length - 1].id);
      ctx.globalAlpha = 0.5 * o; ctx.setLineDash([2, 4]); arrow(ctx, Z.x, Z.y + ch / 2 + 6 + G.nodeLbH, Z.x, img.y - ih / 2 - 6);
    }
    ctx.restore();
  }

  return {
    build(L) {
      this.theme(); build(L);
      /* 마디 이름표의 높이 — 끝 마디에서 이미지로 가는 점선이 그 아래에서 시작한다 */
      G.nodeLbH = Math.max(...NIDS.map((id) => most(nodeLb[id]).h));
    },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink') };
    },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
