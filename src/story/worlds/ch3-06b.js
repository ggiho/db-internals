/* ch3 06b — INDEX page header, 실측. 알갱이 i 가 page 의 byte i 다(16,384 개 = 128 × 128).
   경계(HEAP_TOP · directory · trailer …)는 dump 의 헤더 값으로 그리고, 식은 scenes.js 의 것(MEASURED)을 그대로 쓴다.

   dump 는 page 마다 앞 94 B 만 갖고 있다. 그래서 —
     · 94 B 는 실제 바이트를 hexdump 로 보인다
     · 그 뒤의 byte 는 어느 영역인지만 보인다. 지워진 record 가 page 의 어디에 있는지는 그리지 않는다 —
       실측된 자리는 free list 의 머리(PAGE_FREE) 하나뿐이고, 나머지는 쌓은 막대로 양만 보인다.
   스텝마다 어느 page 의 어느 칸을 짚는지는 장면의 ops 와 bake 상태에서 읽는다 — '|gold' 가 붙은 칸이다.
   움직임은 구간의 앞 절반(p < 0.5)에 끝낸다 — ← · → 로 들어와 서는 자리(0.58)에서 실측된 끝 상태가 보이게. */
import { INK, GOLD, ACCENT, RED, FAINT, U } from '../field.js';
import { bake } from '../../bake.js';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const COLS = 128, PAGE = 16384, POOL = 7616, GREF = 64;
const HANGUL = /[가-힣]/;
const fmt = (n) => Number(n).toLocaleString('en-US');

export default {
  count: () => PAGE + POOL,
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N;
  const { DUMP, M, SUP_END, RS, GONE6, MOVED7, LEAVES, EMPTY, resv, MAXSZ, RESERVE, DIRN, PH, OFF, ROLE, heapN } = deck.MEASURED;
  const H = (no) => DUMP[no].f;
  const hex = (no) => DUMP[no].hex;
  const hb = (no, o) => hex(no).slice(o * 2, o * 2 + 2);
  const uint = (no, o, w) => { let v = 0n; for (let i = 0; i < w; i++) v = (v << 8n) | BigInt(parseInt(hb(no, o + i), 16)); return v; };
  const spaced = (no, o, w) => hex(no).slice(o * 2, (o + w) * 2).replace(/(..)/g, '$1 ').trim();

  /* ── 앞 94 B 의 칸 : FIL header 38 + PAGE header 56 ── */
  const FIELDS = [
    ['FIL_PAGE_SPACE_OR_CHKSUM', 0, 4], ['FIL_PAGE_OFFSET', 4, 4], ['FIL_PAGE_PREV', 8, 4], ['FIL_PAGE_NEXT', 12, 4],
    ['FIL_PAGE_LSN', 16, 8], ['FIL_PAGE_TYPE', 24, 2], ['FIL_PAGE_FILE_FLUSH_LSN', 26, 8], ['FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID', 34, 4],
  ].map(([n, o, w]) => ({ n, o, w, fil: true }))
    .concat(PH.map((k, i) => ({ k, n: k.startsWith('SEG_') ? 'PAGE_BTR_' + k : 'PAGE_' + k, o: 38 + OFF[i], w: (OFF[i + 1] ?? 56) - OFF[i] })));
  /* 이 세계의 오프셋이 dump 를 푼 값(ibdpage.js 가 소스 정의와 맞춘 것)과 같은지 — 다르면 그리지 않고 멈춘다 */
  for (const no of Object.keys(DUMP).map(Number)) {
    for (const x of FIELDS) {
      const v = H(no)[x.n];
      if (v == null || typeof v === 'object') continue;
      if (String(uint(no, x.o, x.w)) !== String(v)) throw new Error(`06b 세계의 칸 ${x.n} 이 dump 와 다르다 (p:${no})`);
    }
  }

  /* ── 스텝마다 짚는 page · 칸 ──
     phOps 는 짚는 칸이 든 덩어리(phA · phB · phC)만 다시 쓰고, 그 안에서도 값이 바뀐 key 만 내보낸다.
     누적 상태 전체를 읽으면 건드리지 않은 덩어리의 옛 '|gold' 가 섞이고(실측 : 7 번째 스텝이 FREE · GARBAGE 까지 짚었다),
     ops 만 읽으면 page 줄이 그대로인 덩어리에서 page 를 놓친다(7 번째가 p:6 을 짚었다). 건드린 덩어리를 ops 로 고르고
     값은 그 덩어리의 bake 상태에서 읽는다. ph 연산이 없는 스텝(p:6 → p:7)은 앞 스텝의 page 를 물려받는다 */
  const frames = bake(scene());
  const spec = [];
  scene().steps.forEach((stp, k) => {
    const touched = ['phA', 'phB', 'phC'].filter((w) => stp.ops && stp.ops[w]);
    if (!touched.length) { spec.push({ page: k ? spec[k - 1].page : 8, hot: [] }); return; }
    const kv = (w) => frames[k].st[w].kv;
    const m = /p:(\d+)/.exec(String(kv(touched[0]).page));
    const hot = touched.flatMap((w) => Object.entries(kv(w)).filter(([key, v]) => key !== 'page' && String(v).endsWith('|gold')).map(([key]) => key));
    spec.push({ page: m ? +m[1] : 8, hot });
  });
  const NS = spec.length;
  const regions = (no) => ({ top: H(no).PAGE_HEAP_TOP, dir0: PAGE - 8 - H(no).PAGE_N_DIR_SLOTS * 2 });

  /* MAX_TRX_ID 의 8 B 를 글자로 — 서로 다른 byte 만 한 번씩 뜬다 */
  const TRX = [8, 5].map((no) => [...Array(8).keys()].map((b) => hb(no, 38 + 18 + b)));
  const glyph = {};
  for (const t of new Set(TRX.flat())) glyph[t] = U.sampleText(t, `500 ${GREF}px ${MONO}`, 0, 0, 220, U.rng(parseInt(t, 16) + 3));

  /* ── 이름표 · hexdump (DOM) ── */
  const made = [];
  function label(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'wl ' + cls + (HANGUL.test(text) && !/serif/.test(cls) ? ' serif' : '');
    el.textContent = text;
    labels.appendChild(el);
    const lb = { el, x: 0, y: 0, o: -1 };
    made.push(lb);
    return lb;
  }
  /* va — 'c' 는 한 줄 이름표의 가운데, 't' 는 여러 줄(줄바꿈한) 이름표의 위 — 가운데로 두면 줄이 늘 때 위아래 이웃을 덮었다 */
  function place(lb, x, y, al = 'l', va = 'c') {
    lb.x = x; lb.y = y;
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%';
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${va === 't' ? '0%' : '-50%'})`;
  }
  /* 위에서부터 차례로 쌓는다 — 이름표마다 실제 높이를 재서 다음 것의 자리를 정한다 */
  const stack = (x, y, ...lbs) => { for (const lb of lbs) { place(lb, x, y, 'l', 't'); y += lb.el.offsetHeight + 6; } return y; };
  /* 남는 폭에 맞춰 줄바꿈한다 — 1024 폭의 오른쪽 패널(약 280px)에서 한 줄 이름표가 레일 밑까지 나갔다 */
  const wrapTo = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(80, Math.floor(w)) + 'px'; };
  const setText = (lb, s) => {
    if (lb.el.textContent === s) return;
    lb.el.textContent = s;
    lb.el.classList.toggle('serif', HANGUL.test(s));
  };

  const strip = document.createElement('div');
  strip.className = 'hexs';
  labels.appendChild(strip);
  let stripKey = '', stripO = -1;
  function drawStrip(no, hot) {
    const key = no + '|' + hot.join(',');
    if (key === stripKey) return;
    stripKey = key;
    const hotF = FIELDS.filter((x) => !x.fil && hot.includes(x.k));
    const isHot = (o) => hotF.some((x) => o >= x.o && o < x.o + x.w);
    let html = `<div class="hx-hd"><b>p:${no}</b>  ${ROLE[no] || 'PRIMARY leaf'}  ·  앞 94 B — FIL header 38 + PAGE header 56</div>`;
    for (let r = 0; r < 6; r++) {
      html += `<div class="hx-row"><i>${String(r * 16).padStart(4, '0')}</i>`;
      for (let c = 0; c < 16 && r * 16 + c < 94; c++) {
        const o = r * 16 + c;
        html += `<b class="${isHot(o) ? 'h' : o < 38 ? 'f' : 'p'}${c === 8 ? ' gap' : ''}">${hb(no, o)}</b>`;
      }
      html += '</div>';
    }
    /* 짚는 칸을 푼 값 — 바이트와 값을 나란히. 정리 스텝처럼 열네 칸을 다 짚으면 풀이가 격자를 덮으므로 넷까지만 */
    html = `<div class="hx-l">${html}</div><div class="hx-dec">` + (hotF.length > 4 ? [] : hotF).map((x) => {
      const v = H(no)[x.n];
      const val = typeof v === 'object' ? `(${v.space}, ${v.page}, ${v.offset})`
        : x.k === 'N_HEAP' ? `${fmt(heapN(no))} + compact` : x.k === 'DIRECTION' ? DIRN[v] : fmt(v);
      return `<span><em>${x.n}</em><i>${spaced(no, x.o, x.w)}</i><b>${val}</b></span>`;
    }).join('') + '</div>';
    strip.innerHTML = html;
  }

  const rg = {
    hdr: label('0–93  header 94 B', 'gold sm'), sys: label('94–119  infimum · supremum', 'sm'),
    heap: label('', 'ink sm'), top: label('', 'gold sm'), free: label('', 'sm'), dir: label('', 'sm'), trl: label('16,376–  trailer 8 B', 'sm'),
  };
  const zoomHd = label('', 'sm'), zoomDir = label('', 'sm'), ghost5 = label('', 'sm');
  const recLb = label('', 'red sm'), resLb = label('', 'sm');
  const tokLb = label('', 'ink sm'), lockLb = label('', 'gold sm');
  const barLive = label('', 'ink sm ml'), barGone = label('', 'red sm ml'), barNote = label('막대는 양이다 — 지워진 record 의 자리는 dump 밖', 'sm');
  const freeLb = label('', 'gold sm'), dsLb = label('', 'green sm');
  const splitA = label('', 'sm ml'), splitB = label('', 'red sm ml');
  const seqLb = label('', 'gold sm'), seqN = label('', 'ink sm');
  const colLb = LEAVES.map(() => label('', 'sm'));
  const sumLb = label('', 'green sm'), rootLb = label('', 'sm');
  const trxLb = [label('', 'ink sm'), label('', 'gold sm')], trxNote = label('', 'sm');
  const treeLb = { root: label('', 'ink sm ml'), leaf: label('', 'sm'), idx: label('', 'gold sm ml') };
  const OWN = [[3, 'SDI', 'top'], [3, 'SDI', 'leaf'], [4, 'PRIMARY', 'top'], [4, 'PRIMARY', 'leaf'], [5, 'idx_c', 'top'], [5, 'idx_c', 'leaf']];
  const inoLb = OWN.map(() => label('', 'sm ml'));
  const inoHd = label('page 2 · INODE — entry 하나 192 B, 50 부터 차례로', 'sm');
  const fsegLb = [3, 4, 5].map(() => label('', 'sm ml'));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(7);
  const scat = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0;
    strip.style.width = ww + 'px';
    strip.classList.toggle('narrow', L.narrow);
    /* 좁은 세계의 hexdump 는 푼 값의 줄뿐이고 스텝마다 줄 수가 다르다 — 66 으로 두자 768 에서 셋째 줄이 아래 막대 이름을 덮었다.
       모든 스텝의 글로 재서 가장 높은 만큼 비운다 */
    const stripH = L.narrow ? Math.max(66, ...spec.map((sp, k) => { drawStrip(sp.page, k === NS - 1 ? PH : sp.hot); return strip.offsetHeight + 10; })) : 168;
    stripKey = '';
    const fit = (w, h) => Math.max(1.4, Math.floor((Math.min(w, h) / COLS) * 10) / 10);
    const ppF = fit(L.narrow ? ww : ww - 214, wh - stripH);
    const ppL = fit(L.narrow ? ww * 0.5 : ww * 0.44, wh - stripH);
    const my = L.y0 + stripH;
    const full = { x: L.x0, y: my, pp: ppF }, left = { x: L.x0, y: my, pp: ppL };
    const px = L.x0 + COLS * ppL + (L.narrow ? 14 : 40);
    const panel = { x: px, y: my, w: L.x1 - px, h: COLS * ppL };
    /* 2 : 끝 384 B 확대 — 32 열 × 12 줄 */
    const zx = full.x + COLS * full.pp + 18, zp = Math.max(3, Math.min(6.4, (L.x1 - zx - 6) / 32));
    const zoom = { x: zx, y: full.y + COLS * full.pp - 12 * zp - 6, pp: zp, from: PAGE - 384 };
    G = { L, ww, wh, full, left, panel, my, zoom };
    for (let i = 0; i < N; i++) { scat[i * 2] = L.x0 + rnd() * ww; scat[i * 2 + 1] = L.y0 + rnd() * wh; }
    strip.style.transform = `translate(${L.x0}px, ${L.y0}px)`;
  }
  const at = (m, o) => [m.x + (o % COLS) * m.pp, m.y + Math.floor(o / COLS) * m.pp];
  const rowY = (m, o) => m.y + Math.floor(o / COLS) * m.pp + m.pp / 2;
  const zat = (o) => { const z = G.zoom, q = o - z.from; return [z.x + (q % 32) * z.pp, z.y + Math.floor(q / 32) * z.pp]; };

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  /* page 격자 — byte i 의 색과 밝기는 영역이 정한다. look(i) 가 값을 돌려주면 그것으로 덮는다 */
  function mapPose(o, m, no, dim, look, form = 1) {
    const { top, dir0 } = regions(no), s = Math.max(1, m.pp * 0.62);
    for (let i = 0; i < PAGE; i++) {
      let c, a, h = 0;
      if (i < 38) { c = FAINT; a = 0.6; } else if (i < 94) { c = INK; a = 0.75; }
      else if (i < SUP_END) { c = ACCENT; a = 0.55; } else if (i < top) { c = INK; a = 0.4; }
      else if (i < dir0) { c = FAINT; a = 0.13; } else if (i < PAGE - 8) { c = ACCENT; a = 0.6; } else { c = FAINT; a = 0.6; }
      const lk = look ? look(i) : null;
      if (lk) { if (lk.c != null) c = lk.c; if (lk.a != null) a = lk.a; if (lk.h != null) h = lk.h; }
      const [x, y] = at(m, i);
      const k = form >= 1 ? 1 : U.smooth(U.range(form, F.seed[i] * 0.5, F.seed[i] * 0.5 + 0.5));
      put(o, i, U.lerp(scat[i * 2], x, k), U.lerp(scat[i * 2 + 1], y, k), a * dim * (0.15 + 0.85 * k), h, 0, s, c);
    }
  }
  function poolOff(o) { for (let i = PAGE; i < N; i++) put(o, i, scat[i * 2], scat[i * 2 + 1], 0, 0, 1.5, 1, FAINT); }
  const hotLook = (hot) => {
    const fs = FIELDS.filter((x) => !x.fil && hot.includes(x.k));
    return (i) => (i < 94 && fs.some((x) => i >= x.o && i < x.o + x.w) ? { c: GOLD, a: 1, h: 1.2 } : null);
  };
  /* 사각형 r 을 n 개의 알갱이로 채우거나(격자) 외곽선만 */
  function block(o, i0, n, r, a, c, fill = true, h = 0, s = 1.1) {
    const cols = Math.max(1, Math.ceil(Math.sqrt((n * r.w) / Math.max(1, r.h)))), rows = Math.max(1, Math.ceil(n / cols));
    const path = fill ? null : U.rectPath(r.x, r.y, r.w, r.h);
    for (let m = 0; m < n; m++) {
      const i = i0 + m;
      const [x, y] = fill ? [r.x + ((m % cols) + 0.5) / cols * r.w, r.y + (Math.floor(m / cols) + 0.5) / rows * r.h] : path((m + 0.5) / n);
      put(o, i, x + jit[i * 2] * 0.5, y + jit[i * 2 + 1] * 0.5, a, h, 0.05, s, c);
    }
    return i0 + n;
  }
  const show = (p, a, b) => U.smooth(U.range(p, a, b));

  function pose(k, p, t, o) {
    if (!G) return;
    const sp = spec[Math.min(k, NS - 1)];
    const { full, left, panel } = G;
    poolOff(o);
    if (k === 0) {
      /* 제목 동안 알갱이가 격자로 내려앉고, 글이 뜨면 앞 94 B 가 빛난다 */
      const form = U.range(p, 0.02, 0.3), glow = show(p, 0.36, 0.48);
      mapPose(o, full, 8, 1, (i) => (i < 94 ? { c: GOLD, a: 0.5 + 0.5 * glow, h: glow * 1.1 } : null), form);
      return;
    }
    if (k === 1) {
      /* N_DIR_SLOTS — directory 는 page 끝에서 위로 자란다. p:8 은 60 B, p:5 는 294 B. 끝 384 B 를 확대해 같이 그린다 */
      const { dir0 } = regions(8), g = show(p, 0.08, 0.3), hl = hotLook(sp.hot);
      mapPose(o, full, 8, 1, (i) => (i >= dir0 && i < PAGE - 8 ? { c: ACCENT, a: 0.35 + 0.65 * g, h: g } : hl(i) || (i >= 120 && i < dir0 ? { a: 0.28 } : null)));
      const z = G.L.narrow ? 0 : show(p, 0.12, 0.3), s5 = PAGE - 8 - H(5).PAGE_N_DIR_SLOTS * 2;
      for (let q = 0; q < 384; q++) {
        const off = G.zoom.from + q, i = PAGE + q, [x, y] = zat(off), [mx, my] = at(full, off);
        const isDir = off >= dir0 && off < PAGE - 8, isTrl = off >= PAGE - 8, in5 = off >= s5 && off < dir0;
        const a = isDir ? 0.95 : isTrl ? 0.6 : in5 ? 0.32 : 0.16;
        put(o, i, U.lerp(mx, x, z), U.lerp(my, y, z), a * z, isDir ? g : 0, 0, Math.max(1, G.zoom.pp * 0.7), isDir ? ACCENT : FAINT);
      }
      return;
    }
    if (k === 2) {
      /* HEAP_TOP — heap 은 119 × 127 B 로 꽉 찼고, 남은 자리에 127 B 가 들어가려다 튕긴다 */
      const { top, dir0 } = regions(8), hl = hotLook(sp.hot);
      mapPose(o, full, 8, 1, (i) => hl(i) || (i >= top && i < dir0 ? { c: GOLD, a: 0.35, h: 0.2 } : i >= 120 && i < top ? { a: 0.55 } : null));
      const fly = show(p, 0.12, 0.3), out = show(p, 0.4, 0.52), red = U.range(p, 0.31, 0.36);
      const [gx, gy] = at(full, top + 2 * COLS + 20);
      const sx = full.x + COLS * full.pp + 120, sy = gy - 60;
      for (let m = 0; m < RS; m++) {
        const i = PAGE + m;
        const tx = U.lerp(sx, gx, fly) + out * 150, ty = U.lerp(sy, gy, fly) - out * 46;
        put(o, i, tx + (m % 32) * full.pp, ty + Math.floor(m / 32) * full.pp, (fly > 0.01 ? 0.95 : 0) * (1 - out * 0.8),
          red > 0 ? 1.1 : 0.3, 0.05, Math.max(1, full.pp * 0.62), red > 0 ? RED : INK);
      }
      return;
    }
    if (k === 3) {
      /* N_HEAP — p:6 의 heap 번호 121 = infimum · supremum 2 + 살아 있는 48 + 지워진 71. 자리가 아니라 수다 */
      mapPose(o, left, 6, 1, hotLook(sp.hot));
      const n = heapN(6), live = H(6).PAGE_N_RECS, cols = 11, ts = Math.min(17, panel.w / (cols * 1.35));
      let i = PAGE;
      for (let h = 0; h < n; h++) {
        const r = { x: panel.x + (h % cols) * ts * 1.3, y: (G.tokY || panel.y + 26) + Math.floor(h / cols) * ts * 1.3, w: ts, h: ts };
        const kind = h < 2 ? ACCENT : h < 2 + live ? INK : RED;
        i = block(o, i, 16, r, (kind === RED ? 0.6 : 0.9) * show(p, 0.08 + h * 0.0016, 0.2 + h * 0.0016), kind, true, kind === ACCENT ? 0.4 : 0);
      }
      const lb = 1 + Math.floor((n + 64) / 8), ly = G.lockY || panel.y + 26 + Math.ceil(n / cols) * ts * 1.3 + 46;
      for (let b = 0; b < lb; b++) {
        const r = { x: panel.x + (b % 12) * ts * 1.3, y: ly + Math.floor(b / 12) * ts * 1.3, w: ts, h: ts };
        i = block(o, i, 16, r, 0.9 * show(p, 0.3, 0.42), GOLD, false);
      }
      return;
    }
    if (k === 4 || k === 5) {
      /* FREE · GARBAGE — heap 15,113 B 를 살아 있는 것과 지워진 것으로 쌓는다(양). PAGE_FREE 의 자리만 실측이다 */
      const top = H(6).PAGE_HEAP_TOP, live = H(6).PAGE_N_RECS * RS, gone = H(6).PAGE_GARBAGE;
      const pull = k === 4 ? show(p, 0.08, 0.3) : 1, split = k === 5 ? show(p, 0.08, 0.3) : 0, moved = MOVED7 * RS;
      /* 막대의 알갱이 간격 — 지워진 쪽(더 긴 막대)이 남은 높이에 들어가게. 넓은 화면에서는 2px */
      const bw = Math.floor(Math.min(panel.w * 0.4, 150) / 2) * 2, pitch = Math.min(2, Math.sqrt(((panel.h - 70) * bw) / gone)), per = Math.floor(bw / pitch);
      const bx1 = panel.x, bx2 = panel.x + bw + 30, by = panel.y + 44;
      const hl = hotLook(sp.hot);
      mapPose(o, left, 6, 1, (i) => (i >= 120 && i < top ? { a: 0.4 * (1 - pull) + 0.04 } : hl(i)));
      for (let b = 0; b < live + gone; b++) {
        const i = 120 + b, [mx, my] = at(left, i), g = b >= live, q = g ? b - live : b;
        let x = (g ? bx2 : bx1) + (q % per) * pitch, y = by + Math.floor(q / per) * pitch, c = g ? RED : INK, a = g ? 0.62 : 0.85;
        if (g && split > 0) { if (q < moved) { c = ACCENT; x += split * 22; a = 0.75; } else y += split * 20; }
        put(o, i, U.lerp(mx, x, pull), U.lerp(my, y, pull), a, 0, 0.05, Math.min(1.2, pitch * 0.7 + 0.2), c);
      }
      return;
    }
    if (k === 6) {
      /* LAST_INSERT · DIRECTION · N_DIRECTION — 빈 page 에 119 개를 이어 붙인다. 막 들어온 record 가 빛난다 */
      const n8 = H(8).PAGE_N_RECS, q = U.range(p, 0.06, 0.48) * n8, r = Math.min(n8 - 1, Math.floor(q)), hl = hotLook(sp.hot);
      mapPose(o, full, 8, 1, (i) => {
        const h = hl(i);
        if (h) return h;
        if (i >= 120 && i < H(8).PAGE_HEAP_TOP) {
          const rec = Math.floor((i - 120) / RS);
          return rec > q ? { a: 0.06 } : rec === r ? { c: GOLD, a: 1, h: 1 } : { a: 0.5 };
        }
        return null;
      });
      return;
    }
    if (k === 7) {
      /* N_RECS — leaf 9 장의 record 를 세로로 쌓는다 : 합 = COUNT(*) */
      mapPose(o, left, 8, 0.5, hotLook(sp.hot));
      const cw = Math.min(26, panel.w / (LEAVES.length * 1.45)), lh = Math.min(3.2, (panel.h - 40) / 120);
      let i = PAGE;
      LEAVES.forEach((no, c) => {
        const n = H(no).PAGE_N_RECS, x0 = panel.x + c * cw * 1.45, base = panel.y + panel.h - 4;
        for (let r = 0; r < n; r++) {
          const s = show(p, 0.06 + c * 0.025 + r * 0.0009, 0.16 + c * 0.025 + r * 0.0009);
          for (let m = 0; m < 6; m++, i++) put(o, i, x0 + (m / 5) * cw, U.lerp(base + 40, base - r * lh, s), 0.85 * s, 0, 0.05, 1.1, no === 6 || no === 14 ? GOLD : INK);
        }
      });
      return;
    }
    if (k === 8) {
      /* MAX_TRX_ID — 8 B 를 01 장면의 칸처럼 : PRIMARY 는 전부 00, idx_c 는 …05 18 = 1304. 큰 자리가 앞(big-endian) */
      mapPose(o, full, 5, 0, null);
      const cs = Math.min(54, (G.ww - 7 * 10) / 8.6);
      let i = PAGE;
      TRX.forEach((bytes, row) => {
        const y = G.my + 40 + row * cs * 2.5;
        bytes.forEach((t, b) => {
          const r = { x: G.L.x0 + b * cs * 1.16, y, w: cs, h: cs }, s = show(p, 0.08 + row * 0.12 + b * 0.015, 0.22 + row * 0.12 + b * 0.015);
          const nz = t !== '00', pts = glyph[t], sc = (cs * 0.4) / GREF;
          i = block(o, i, 40, r, 0.75 * s, nz ? GOLD : FAINT, false);
          for (let m = 0; m < 220; m++, i++) put(o, i, r.x + cs / 2 + pts[m * 2] * sc, r.y + cs / 2 + pts[m * 2 + 1] * sc, (nz ? 1 : 0.6) * s, nz ? 0.6 : 0, 0.05, 1.1, nz ? GOLD : INK);
        });
      });
      G.trx = { cs };
      return;
    }
    if (k === 9) {
      /* LEVEL · INDEX_ID — root p:4(L1) 아래 leaf 9 장(L0). idx_c 는 p:5 하나가 root 이자 leaf — root 높이에 둔다 */
      mapPose(o, full, 4, 0, null);
      const tw = Math.min(44, G.ww / 13.5), gap = tw * 0.3, y0 = G.my + 30, y1 = G.my + 30 + tw * 3.4;
      const lx = G.L.x0, rowW = LEAVES.length * (tw + gap) - gap, rootX = lx + rowW / 2 - tw / 2, idxX = lx + rowW + tw * 0.9;
      let i = PAGE;
      const tile = (x, y, fillR, c, s) => {
        i = block(o, i, 48, { x, y, w: tw, h: tw }, 0.7 * s, FAINT, false);
        i = block(o, i, 160, { x: x + 3, y: y + 3 + (tw - 6) * (1 - fillR), w: tw - 6, h: (tw - 6) * fillR }, 0.85 * s, c, true);
      };
      tile(rootX, y0, H(4).PAGE_N_RECS / LEAVES.length, ACCENT, show(p, 0.06, 0.18));
      LEAVES.forEach((no, c) => tile(lx + c * (tw + gap), y1, H(no).PAGE_N_RECS / H(8).PAGE_N_RECS, INK, show(p, 0.14 + c * 0.02, 0.26 + c * 0.02)));
      tile(idxX, y0, 1, GOLD, show(p, 0.3, 0.42));
      G.tree = { tw, gap, y0, y1, lx, rootX, idxX };
      return;
    }
    if (k === 10) {
      /* FSEG — root 의 20 B 가 page 2 의 inode entry 를 가리킨다(50 + 192 × k). entry 하나 = 192 알갱이 */
      mapPose(o, full, 4, 0, null);
      const gap = 10, bw = Math.min(120, (G.ww - 5 * gap) / 6), bh = bw * 0.75, ey = G.my + 210;
      const col = { 3: FAINT, 4: GOLD, 5: ACCENT };
      let i = PAGE;
      OWN.forEach(([no], e) => { i = block(o, i, 192, { x: G.L.x0 + e * (bw + gap), y: ey, w: bw, h: bh }, 0.85 * show(p, 0.06 + e * 0.03, 0.18 + e * 0.03), col[no], true, no === 4 ? 0.3 : 0); });
      const tw = 40;
      [3, 4, 5].forEach((no, c) => {
        const x = G.L.x0 + c * (G.ww / 3), s = show(p, 0.2 + c * 0.04, 0.32 + c * 0.04);
        i = block(o, i, 60, { x, y: G.my + 30, w: tw, h: tw }, 0.8 * s, col[no], false);
        i = block(o, i, 80, { x: x + 4, y: G.my + 30 + tw - 14, w: tw - 8, h: 10 }, 0.9 * s, col[no], true, 0.5);
      });
      G.ino = { bw, bh, gap, ey, tw };
      return;
    }
    /* 12 · 끝 — p:8 의 영역 전부와 헤더 56 B */
    mapPose(o, full, 8, k >= NS ? 0.25 : 1, k >= NS ? null : (i) => (i >= 38 && i < 94 ? { c: GOLD, a: 1, h: 0.8 } : null));
  }

  /* ── 이름표 · hexdump ── */
  function vis(k, p) {
    const v = new Map();
    const io = (on, a = 0, b2 = 0) => (on ? (b2 ? show(p, a, b2) : 1) : 0);
    const fullMap = [0, 2, 6, 11].includes(k);
    const lit = k === 0 ? show(p, 0.36, 0.48) : fullMap ? 1 : 0;
    for (const key of Object.keys(rg)) v.set(rg[key], lit);
    if (k === 1) { v.set(rg.hdr, 1); v.set(rg.sys, 1); }
    /* 7 : LAST_INSERT · N_DIRECTION 이름표가 page 끝줄 자리를 쓴다 — 아래 넷과 겹쳤다(모든 데스크톱 크기에서 3–4 건) */
    if (k === 6) for (const key of ['top', 'free', 'dir', 'trl']) v.set(rg[key], 0);
    v.set(zoomHd, io(k === 1, 0.14, 0.26)); v.set(zoomDir, io(k === 1, 0.2, 0.3)); v.set(ghost5, io(k === 1, 0.28, 0.38));
    v.set(recLb, io(k === 2, 0.32, 0.37) * (1 - show(p, 0.5, 0.56)));
    v.set(resLb, io(k === 2, 0.16, 0.26));
    v.set(tokLb, io(k === 3, 0.1, 0.22)); v.set(lockLb, io(k === 3, 0.32, 0.42));
    v.set(barLive, io(k === 4 || k === 5, k === 4 ? 0.2 : 0, k === 4 ? 0.32 : 0.01));
    v.set(barGone, v.get(barLive) * (k === 5 ? 1 - show(p, 0.08, 0.22) : 1));
    v.set(barNote, io(k === 4 || k === 5, k === 4 ? 0.3 : 0, k === 4 ? 0.4 : 0.01));
    v.set(freeLb, io(k === 4, 0.3, 0.4)); v.set(dsLb, io(k === 4, 0.38, 0.48));
    v.set(splitA, io(k === 5, 0.2, 0.32)); v.set(splitB, v.get(splitA));
    v.set(seqLb, io(k === 6, 0.06, 0.12)); v.set(seqN, v.get(seqLb));
    colLb.forEach((lb, c) => v.set(lb, io(k === 7, 0.14 + c * 0.025, 0.24 + c * 0.025)));
    v.set(sumLb, io(k === 7, 0.38, 0.46)); v.set(rootLb, io(k === 7, 0.42, 0.5));
    trxLb.forEach((lb, r) => v.set(lb, io(k === 8, 0.08 + r * 0.12, 0.2 + r * 0.12)));
    v.set(trxNote, io(k === 8, 0.34, 0.44));
    v.set(treeLb.root, io(k === 9, 0.1, 0.2)); v.set(treeLb.leaf, io(k === 9, 0.24, 0.34)); v.set(treeLb.idx, io(k === 9, 0.34, 0.44));
    inoLb.forEach((lb, e) => v.set(lb, io(k === 10, 0.12 + e * 0.03, 0.22 + e * 0.03)));
    v.set(inoHd, io(k === 10, 0.06, 0.16));
    fsegLb.forEach((lb, c) => v.set(lb, io(k === 10, 0.24 + c * 0.04, 0.34 + c * 0.04)));
    return v;
  }
  function paint(k, p, b) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? k + 1 : k, NS - 1);
    const A = vis(k, p), B = b > 0 ? vis(k + 1, 0) : null;
    for (const lb of made) {
      const o = Math.min(1, B ? U.lerp(A.get(lb) || 0, B.get(lb) || 0, b) : A.get(lb) || 0);
      if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; }
    }
    /* hexdump — 나무 · inode(10 · 11)를 빼고 늘 위에 */
    const so = (kq, pq) => (kq >= NS ? 0 : kq === 0 ? show(pq, 0.38, 0.48) : kq === 9 || kq === 10 ? 0 : 1);
    const sO = Math.min(1, b > 0 ? U.lerp(so(k, p), so(k + 1, 0), b) : so(k, p));
    if (Math.abs(sO - stripO) > 0.004) { strip.style.opacity = sO.toFixed(3); stripO = sO; }
    drawStrip(spec[kk].page, kk === NS - 1 ? PH : spec[kk].hot);
    placeLabels(kk, k === kk ? p : 0);
  }
  function placeLabels(k, p) {
    const { full, left, panel } = G, m = [3, 4, 5, 7].includes(k) ? left : full;
    const no = spec[k].page, { top, dir0 } = regions(no);
    const rx = m.x + COLS * m.pp + 14;
    place(rg.hdr, rx, rowY(m, 0) - 2); place(rg.sys, rx, rowY(m, 0) + 15);
    setText(rg.heap, `120–${fmt(top - 1)}  ${H(no).PAGE_N_RECS} records` + (no === 6 ? '' : ` × ${RS} B`));
    place(rg.heap, rx, (rowY(m, 120) + rowY(m, top)) / 2);
    /* 아래 넷(HEAP_TOP · free · directory · trailer)은 page 끝 몇 줄 안에 몰려 있다 — 줄 위치 대신 차례로 쌓는다 */
    const yb = Math.min(rowY(m, top), m.y + COLS * m.pp - 40);
    setText(rg.top, `HEAP_TOP ${fmt(top)}`); place(rg.top, rx, yb);
    setText(rg.free, `${fmt(top)}–${fmt(dir0 - 1)}  free`); place(rg.free, rx, yb + 15);
    setText(rg.dir, `${fmt(dir0)}–  directory ${H(no).PAGE_N_DIR_SLOTS} slot`); place(rg.dir, rx, yb + 30);
    place(rg.trl, rx, yb + 45);
    /* 2 : 끝 384 B 확대 */
    const z = G.zoom, s5 = PAGE - 8 - H(5).PAGE_N_DIR_SLOTS * 2, d8 = regions(8).dir0;
    setText(zoomHd, `끝 384 B 확대  ·  ${fmt(z.from)} – 16,383`); place(zoomHd, z.x, z.y - 14);
    setText(zoomDir, `p:8  ${H(8).PAGE_N_DIR_SLOTS} slot × 2 = ${H(8).PAGE_N_DIR_SLOTS * 2} B  (${fmt(d8)}–)`);
    place(zoomDir, z.x, z.y - 46);
    setText(ghost5, `p:5  ${H(5).PAGE_N_DIR_SLOTS} slot × 2 = ${H(5).PAGE_N_DIR_SLOTS * 2} B  (${fmt(s5)}–)`);
    place(ghost5, z.x, z.y - 30);
    /* 3 : 127 B 를 받을 수 있나 */
    const mx = MAXSZ(H(8).PAGE_N_RECS);
    setText(resLb, `빈 page ${fmt(EMPTY)} − (데이터 ${fmt(H(8).PAGE_HEAP_TOP - SUP_END)} + slot 예약 ${resv(H(8).PAGE_N_RECS + 1)}) = ${fmt(mx)} B 남음  ·  남겨야 할 1/16 = ${fmt(RESERVE)} B`);
    wrapTo(resLb, G.ww - 6); place(resLb, full.x, Math.max(full.y + COLS * full.pp + 10, yb + 45 + 12), 'l', 't');
    setText(recLb, `${fmt(RESERVE)} + ${RS} = ${fmt(RESERVE + RS)} > ${fmt(mx)}  →  split`);
    place(recLb, rx, rowY(full, top) - 40);
    /* 4 : heap 번호 · lock bitmap */
    const n = heapN(6), lbB = 1 + Math.floor((n + 64) / 8), ts = Math.min(17, panel.w / (11 * 1.35));
    setText(tokLb, `heap 번호 ${n} = infimum · supremum 2 + 살아 있는 ${H(6).PAGE_N_RECS} + 지워진 ${GONE6}`);
    wrapTo(tokLb, panel.w - 6); place(tokLb, panel.x, panel.y, 'l', 't');
    G.tokY = panel.y + tokLb.el.offsetHeight + 8;
    setText(lockLb, `record lock 하나의 bitmap  1 + (${n} + 64) / 8 = ${lbB} B`);
    wrapTo(lockLb, panel.w - 6); place(lockLb, panel.x, G.tokY + Math.ceil(n / 11) * ts * 1.3 + 14, 'l', 't');
    G.lockY = G.tokY + Math.ceil(n / 11) * ts * 1.3 + 14 + lockLb.el.offsetHeight + 8;
    /* 5 · 6 : 막대 */
    const bw = Math.floor(Math.min(panel.w * 0.4, 150) / 2) * 2, pitch = Math.min(2, Math.sqrt(((panel.h - 70) * bw) / H(6).PAGE_GARBAGE));
    setText(barLive, `살아 있는 record\n${H(6).PAGE_N_RECS} × ${RS} = ${fmt(H(6).PAGE_N_RECS * RS)} B`); place(barLive, panel.x, panel.y + 14);
    setText(barGone, `GARBAGE\n${GONE6} × ${RS} = ${fmt(H(6).PAGE_GARBAGE)} B`); place(barGone, panel.x + bw + 30, panel.y + 14);
    wrapTo(barNote, G.ww - 6);
    setText(freeLb, `PAGE_FREE → ${fmt(H(6).PAGE_FREE)}  free list 의 머리 · 실측된 자리`);
    const [fx, fy] = at(left, H(6).PAGE_FREE);
    wrapTo(freeLb, G.ww - 6);
    G.freeAt = [fx + left.pp / 2, fy + left.pp / 2];
    setText(dsLb, `HEAP_TOP − 120 − GARBAGE = ${fmt(H(6).PAGE_HEAP_TOP - SUP_END - H(6).PAGE_GARBAGE)} B  =  I_S DATA_SIZE ${fmt(M.bufpage[6].data)}`);
    wrapTo(dsLb, G.ww - 6);
    stack(left.x, left.y + COLS * left.pp + 16, freeLb, dsLb, barNote);
    setText(splitA, `split 으로 p:7 에\n${MOVED7} 행 = ${fmt(MOVED7 * RS)} B`); place(splitA, panel.x + bw + 30 + 22, panel.y + 14, 'l');
    setText(splitB, `DELETE id 10 – 20\n${GONE6 - MOVED7} 행 = ${fmt((GONE6 - MOVED7) * RS)} B`);
    place(splitB, panel.x + bw + 30, panel.y + 44 + Math.ceil(H(6).PAGE_GARBAGE / Math.floor(bw / pitch)) * pitch + 42);
    /* 7 : 이어 붙이기 — 서는 자리(0.58)에서는 끝 상태 = 실측값 */
    const n8 = H(8).PAGE_N_RECS, q = U.range(p, 0.06, 0.48) * n8, r = Math.min(n8 - 1, Math.floor(q));
    const origin = SUP_END + r * RS + (H(8).PAGE_LAST_INSERT - (H(8).PAGE_HEAP_TOP - RS));
    setText(seqLb, `LAST_INSERT ${fmt(origin)}`); place(seqLb, rx, rowY(full, origin));
    /* 세계 오른쪽 끝까지의 폭에 맞춰 접고, 위 이름표 아래에 윗변을 맞춘다 — 한 줄로 두었더니 insert 가 내려가는 동안
       레일 밑을 지나갔다(storysweep flight, 1280 · 1728 · 1920 · 2560) */
    setText(seqN, `${r + 1} 번째 insert  ·  ${r ? 'RIGHT' : 'NO_DIRECTION'}  ·  N_DIRECTION ${Math.max(0, r)}`);
    wrapTo(seqN, G.L.x1 - rx - 6); place(seqN, rx, rowY(full, origin) + 9, 'l', 't');
    /* 8 : leaf 9 장 */
    const cw = Math.min(26, panel.w / (LEAVES.length * 1.45));
    LEAVES.forEach((no2, c) => { setText(colLb[c], `${H(no2).PAGE_N_RECS}`); place(colLb[c], panel.x + c * cw * 1.45 + cw / 2, panel.y + panel.h + 14, 'c'); });
    const recs = LEAVES.map((x) => H(x).PAGE_N_RECS);
    setText(sumLb, `${recs[0]} + ${recs[1]} × 7 + ${recs[8]} = ${fmt(recs.reduce((a, x) => a + x, 0))} = COUNT(*)`);
    wrapTo(sumLb, panel.w - 6);
    setText(rootLb, `root p:4 의 N_RECS ${H(4).PAGE_N_RECS} = leaf ${LEAVES.length} 장의 node pointer`);
    wrapTo(rootLb, panel.w - 6);
    stack(panel.x, panel.y + panel.h + 26, sumLb, rootLb);
    /* 9 : MAX_TRX_ID */
    if (G.trx) {
      const cs = G.trx.cs;
      setText(trxLb[0], 'PRIMARY  p:8  MAX_TRX_ID  =  0'); place(trxLb[0], G.L.x0, G.my + 26);
      setText(trxLb[1], `idx_c  p:5  MAX_TRX_ID  =  ${fmt(H(5).PAGE_MAX_TRX_ID)}`); place(trxLb[1], G.L.x0, G.my + 26 + cs * 2.5);
      setText(trxNote, `trx  INSERT ${M.trx.insert} · DELETE ${M.trx.delete} · UPDATE ${M.trx.update}  →  남은 값은 UPDATE 의 것`);
      wrapTo(trxNote, G.ww - 6); place(trxNote, G.L.x0, G.my + 40 + cs * 3.9);
    }
    /* 10 : 나무 */
    if (G.tree) {
      const T = G.tree;
      setText(treeLb.root, `p:4  PRIMARY root\nLEVEL ${H(4).PAGE_LEVEL} · INDEX_ID ${H(4).PAGE_INDEX_ID}`); place(treeLb.root, T.rootX + T.tw + 10, T.y0 + T.tw / 2);
      setText(treeLb.leaf, `p:6 – p:14  leaf  ·  LEVEL 0  ·  INDEX_ID ${H(8).PAGE_INDEX_ID}`); place(treeLb.leaf, T.lx, T.y1 + T.tw + 18);
      setText(treeLb.idx, `p:5  idx_c\nLEVEL ${H(5).PAGE_LEVEL} · INDEX_ID ${H(5).PAGE_INDEX_ID}\nroot 이 곧 leaf`);
      /* 세계 오른쪽 끝을 넘으면 tile 오른쪽 끝에 맞춘다(1024 · 1280 에서 레일 밑으로 나갔다) */
      const wIdx = treeLb.idx.el.offsetWidth;
      if (T.idxX + wIdx > G.L.x1 - 4) place(treeLb.idx, T.idxX + T.tw, T.y0 + T.tw + 34, 'r'); else place(treeLb.idx, T.idxX, T.y0 + T.tw + 34);
    }
    /* 11 : inode */
    if (G.ino) {
      const I = G.ino;
      /* 상자가 이름표보다 좁으면 한 칸씩 엇갈려 둔다(1024 에서 '626 PRIMARY leaf' 와 '818 idx_c top' 이 겹쳤다) */
      OWN.forEach(([, who, part], e) => {
        setText(inoLb[e], `${50 + 192 * e}\n${who} ${part}`);
        const tight = inoLb[e].el.offsetWidth > I.bw + I.gap - 4;
        place(inoLb[e], G.L.x0 + e * (I.bw + I.gap), I.ey + I.bh + 26 + (tight && e % 2 ? 34 : 0));
      });
      place(inoHd, G.L.x0, I.ey - 18);
      [3, 4, 5].forEach((no2, c) => {
        const f = H(no2);
        setText(fsegLb[c], `p:${no2}  ${no2 === 3 ? 'SDI' : no2 === 4 ? 'PRIMARY' : 'idx_c'} root\ntop ${f.PAGE_BTR_SEG_TOP.offset} · leaf ${f.PAGE_BTR_SEG_LEAF.offset}`);
        /* 제 칸(세계 폭의 1/3) 안에서 접는다 — 1024 폭에서 셋째 이름표가 세계 끝을 28px 넘어 레일 5px 앞까지 갔고,
           레일 폭이 바뀌는 동안 겹쳤다(storysweep rail-overlap). ml(pre-line)이라 \n 은 지킨다 */
        fsegLb[c].el.style.maxWidth = Math.max(80, Math.floor(G.ww / 3 - I.tw - 16)) + 'px';
        place(fsegLb[c], G.L.x0 + c * (G.ww / 3) + I.tw + 10, G.my + 30 + I.tw / 2);
      });
    }
  }

  let css = {};
  function overlay(ctx, k, p, b) {
    if (!G) return;
    const kk = b > 0.5 ? k + 1 : k, pk = kk === k ? p : 0, v1 = b > 0.5 ? b : 1 - b;
    ctx.save();
    ctx.lineWidth = 1;
    if (kk === 1) {
      /* 확대 칸으로 잇는 선, 그리고 p:5 의 directory 가 올 자리(점선) */
      const z = G.zoom, m = G.full, [bx, by] = at(m, z.from);
      ctx.globalAlpha = 0.5 * v1 * show(pk, 0.12, 0.26); ctx.strokeStyle = css.faint; ctx.setLineDash([2, 3]);
      ctx.strokeRect(bx - 1, by - 1, COLS * m.pp + 1, 3 * m.pp + 1);
      ctx.beginPath(); ctx.moveTo(m.x + COLS * m.pp, by); ctx.lineTo(z.x - 4, z.y); ctx.stroke();
      const s5 = PAGE - 8 - H(5).PAGE_N_DIR_SLOTS * 2, [gx, gy] = zat(s5);
      ctx.globalAlpha = 0.9 * v1 * show(pk, 0.28, 0.38); ctx.strokeStyle = css.gold; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(gx - 1, gy - 1); ctx.lineTo(z.x + 32 * z.pp, gy - 1);
      ctx.moveTo(z.x - 1, gy + z.pp); ctx.lineTo(gx - 1, gy + z.pp); ctx.lineTo(gx - 1, gy - 1);
      ctx.stroke();
    }
    if ((kk === 4 || kk === 5) && G.freeAt) {
      /* 비운 heap 의 테두리, 그리고 PAGE_FREE 의 자리 — 실측된 단 하나의 garbage 자리 */
      const m = G.left, [hx, hy] = at(m, 120), [ex, ey] = at(m, H(6).PAGE_HEAP_TOP);
      ctx.globalAlpha = 0.5 * v1; ctx.strokeStyle = css.faint; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(m.x + COLS * m.pp, hy); ctx.lineTo(m.x + COLS * m.pp, ey);
      ctx.lineTo(ex, ey); ctx.lineTo(ex, ey + m.pp); ctx.lineTo(m.x, ey + m.pp); ctx.lineTo(m.x, hy + m.pp); ctx.lineTo(hx, hy + m.pp); ctx.closePath(); ctx.stroke();
      if (kk === 4) {
        ctx.globalAlpha = v1 * show(pk, 0.3, 0.4); ctx.strokeStyle = css.gold; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(G.freeAt[0], G.freeAt[1], 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(G.freeAt[0], G.freeAt[1] + 6); ctx.lineTo(G.freeAt[0], m.y + COLS * m.pp + 12); ctx.stroke();
      }
    }
    if (kk === 9 && G.tree) {
      const T = G.tree;
      ctx.globalAlpha = 0.5 * v1 * show(pk, 0.14, 0.3); ctx.strokeStyle = css.faint; ctx.setLineDash([]);
      LEAVES.forEach((_, c) => { ctx.beginPath(); ctx.moveTo(T.rootX + T.tw / 2, T.y0 + T.tw); ctx.lineTo(T.lx + c * (T.tw + T.gap) + T.tw / 2, T.y1); ctx.stroke(); });
    }
    if (kk === 10 && G.ino) {
      const I = G.ino;
      ctx.globalAlpha = 0.7 * v1 * show(pk, 0.3, 0.44); ctx.setLineDash([]);
      [3, 4, 5].forEach((no2, c) => {
        const f = H(no2), x = G.L.x0 + c * (G.ww / 3) + I.tw / 2, y = G.my + 30 + I.tw;
        for (const off of [f.PAGE_BTR_SEG_TOP.offset, f.PAGE_BTR_SEG_LEAF.offset]) {
          const e = (off - 50) / 192, tx = G.L.x0 + e * (I.bw + I.gap) + I.bw / 2, ty = I.ey - 2;
          ctx.strokeStyle = no2 === 4 ? css.gold : no2 === 5 ? css.accent : css.faint;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x, y + 60, tx, ty - 60, tx, ty); ctx.stroke();
        }
      });
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement);
      css = { faint: cs.getPropertyValue('--faint').trim(), gold: cs.getPropertyValue('--gold').trim(), accent: cs.getPropertyValue('--accent').trim() };
    },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); strip.remove(); },
  };
}
