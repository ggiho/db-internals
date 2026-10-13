/* ch3 01 · 01v — Byte Order. 같은 알갱이가 두 장면을 오간다 : 01 은 big-endian(InnoDB 가 파일에 쓰는 순서),
   01v 는 little-endian(x86 메모리). 짝을 바꾸면 byte 네 개가 그 자리에서 반대 칸으로 날아간다.

   그리는 것은 모두 데이터에서 온다 —
     · 값 0xAABBCCDD 와 칸의 순서는 두 장면의 init(val.items) 그대로
     · 코드 판의 줄은 덱의 발췌(CODE) 그대로 — 번호도 발췌의 번호다(mach_write_to_4 129–132 · mach_read_from_4 141–143)
     · double 1.0 의 8 byte 와 0.1f 의 32 bit 는 이 파일이 계산한다(DataView · Math.fround) — 손으로 적지 않는다 */
import { INK, GOLD, ACCENT, GREEN, RED, FAINT, U } from '../field.js';
import { highlight } from '../../hl.js';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const WRITE = 'storage/innobase/include/mach0data.ic#mach_write_to_4';
const READ = 'storage/innobase/include/mach0data.ic#mach_read_from_4';

/* double 을 mach_double_write 가 쓰는 순서(little-endian)로 */
function doubleLE(v) {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, v, true);
  return [...Array(8).keys()].map((i) => dv.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
}
/* float 의 32 bit — 부호 1 · 지수 8 · 가수 23 */
function floatBits(v) {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, v);
  return dv.getUint32(0).toString(2).padStart(32, '0');
}
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const HANGUL = /[가-힣]/;

export default {
  count: (narrow) => (narrow ? 7200 : 12000),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, f = N / 12000;
  /* ── 알갱이 구역 ── */
  const sizes = { VAL: 2400, GLY: 3000, BOX: 640, STR: 520, DBL: 2600, SML: 1600 };
  const R = {};
  let at = 0;
  for (const [k, v] of Object.entries(sizes)) { const n = Math.round(v * f); R[k] = [at, at + n]; at += n; }
  R.DST = [at, N];
  const len = (k) => R[k][1] - R[k][0];
  const per = (n, k) => Math.floor(n / k);

  /* 두 장면의 byte 순서 — init 의 칸 순서에서 읽는다 */
  const bytesOf = (sc) => sc.init.val.items.map((it) => it.id);
  const sA = deck.SCENES.find((s) => s.num === '01'), sB = deck.SCENES.find((s) => s.num === '01v');
  const BYTES = bytesOf(sA);                          /* AA BB CC DD — 값의 자리 순서(큰 자리부터) */
  const ORDER = { '01': bytesOf(sA), '01v': bytesOf(sB) };
  let num = scene().num;
  /* byte b(큰 자리부터 0) 가 놓이는 칸 — 장면이 바뀌면 바뀐다 */
  const cellOf = (b) => ORDER[num].indexOf(BYTES[b]);
  const little = () => num === '01v';
  /* 짝을 바꾸면 byte 가 0.9 초 동안 호를 그리며 새 칸으로 간다 — 오른쪽으로 가는 것은 위로, 왼쪽은 아래로 넘어
     서로 부딪치지 않는다. 같은 줄의 칸(cells)이면 어느 단계에서든 같은 궤적을 쓴다 */
  let prev = null, swapT0 = -1;
  function cellAt(b, cells) {
    const c1 = cells[cellOf(b)];
    if (!prev) return c1;
    const u = (performance.now() - swapT0) / 900;
    if (u >= 1) { prev = null; return c1; }
    const c0 = cells[ORDER[prev].indexOf(BYTES[b])], e = U.smooth(U.clamp(u));
    const lift = Math.sin(e * Math.PI) * Math.abs(c1.x - c0.x) * 0.32 * (c1.x > c0.x ? -1 : 1);
    return { x: U.lerp(c0.x, c1.x, e), y: U.lerp(c0.y, c1.y, e) + lift, w: c1.w, h: c1.h };
  }

  const DBL = doubleLE(1.0);                          /* 00 00 00 00 00 00 F0 3F */
  const BITS = floatBits(0.1);
  const F32 = Math.fround(0.1);

  /* ── 모양(기준 크기로 한 번 떠 두고, 자리와 배율만 바꾼다) ── */
  const VREF = 100, GREF = 64;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `600 ${VREF}px ${MONO}`;
  const VCW = probe.measureText('0').width;           /* mono 한 글자 폭 */
  const goff = (g) => (2 * g + 1 - 5) * VCW;          /* 그룹 g(0x · AA · BB · CC · DD) 의 가운데 */
  const vn = per(len('VAL'), 5);
  const valG = ['0x', ...BYTES].map((t, g) => U.sampleText(t, `600 ${VREF}px ${MONO}`, goff(g), 0, vn, U.rng(11 + g)));
  const gn = per(len('GLY'), 4);
  const glyG = BYTES.map((t, g) => U.sampleText(t, `600 ${GREF}px ${MONO}`, 0, 0, gn, U.rng(31 + g)));
  const dn = Math.floor((len('DBL') * 0.78) / 8), dbn = per(len('DBL') - dn * 8, 8);
  const dblG = DBL.map((t, g) => U.sampleText(t, `600 ${GREF}px ${MONO}`, 0, 0, dn, U.rng(51 + g)));
  /* 반대 순서로 읽은 수(01v) */
  const MIS = '0x' + [...BYTES].reverse().join('');
  const misPts = U.sampleText(MIS, `600 ${VREF}px ${MONO}`, 0, 0, dn * 8, U.rng(71));
  const rnd = U.rng(97);
  const jit = new Float32Array(N * 2).map(() => (rnd() - 0.5) * 2);
  const unit = new Float32Array(N * 2).map(() => rnd());   /* 칸 안을 채우는 자리(0–1) */
  const dust = new Float32Array(N * 2), dustA = new Float32Array(N);

  /* ── 이름표 · 코드 판 (DOM) ── */
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
  function place(lb, x, y, al = 'c') {
    lb.x = x; lb.y = y;
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%';
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, -50%)`;
  }
  function codePanel(key, from, to) {
    const rows = highlight(deck.CODE[key]).filter((l) => l.n >= from && l.n <= to);
    const el = document.createElement('pre');
    el.className = 'code';
    el.innerHTML = rows.map((l) => `<span class="ln" data-n="${l.n}"><i>${l.n}</i>${l.toks.map((t) =>
      (t.c ? `<span class="${t.c}">${esc(t.v)}</span>` : esc(t.v))).join('')}</span>`).join('');
    labels.appendChild(el);
    return { el, lines: [...el.querySelectorAll('.ln')], o: -1 };
  }
  const cw = codePanel(WRITE, 126, 133);
  const cr = codePanel(READ, 139, 144);

  const addr = [0, 1, 2, 3].map((i) => label('a+' + i));
  const tagMSB = label('MSB', 'gold'), tagLSB = label('LSB');
  const axis = label('주소가 커진다', 'axis');
  const intLb = label('INT  0xAABBCCDD  ·  mach_write_to_4', 'ink');
  const dblLb = label('DOUBLE  1.0  ·  mach_double_write', 'ink');
  const dblAddr = [...Array(8).keys()].map((i) => label('+' + i));
  const bigInt = label('큰 자리', 'gold'), bigDbl = label('큰 자리', 'gold');
  const widLb = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => label('mach_write_to_' + w, w === 5 ? '' : 'ink'));
  const none5 = label('없다 — 5 byte 필드가 없다');
  const lenLb = { 6: label('DATA_TRX_ID_LEN', 'gold'), 7: label('DATA_ROLL_PTR_LEN', 'gold') };
  const misLb = label('그대로 파일에 쓰고 big-endian 기계가 읽으면', 'red');
  const okLb = label('x86 이 다시 읽으면', 'green');
  const misLb2 = label('big-endian 기계가 읽으면', 'red');
  const resLb = label('읽은 값', '');
  const bitLb = [label('sign 1', 'ink'), label('exponent 8', 'gold'), label('mantissa 23', 'ink')];
  const bitHex = label('0.1f  =  0x' + parseInt(BITS, 2).toString(16).toUpperCase(), 'ink big');
  const bitVal = label('실제로 저장되는 값  ' + F32.toPrecision(17) + ' …');
  const bitRep = label('가수는 끝없이 반복되는 1100 을 23 bit 에서 끊어 반올림한다');

  /* ── 자리 ── */
  let G = null;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, cx = (L.x0 + L.x1) / 2;
    const cs = Math.min(ww * 0.19, wh * 0.2, 118), gap = cs * 0.17;
    const rowW = 4 * cs + 3 * gap, left = cx - rowW / 2;
    const cy = L.y0 + wh * (L.narrow ? 0.42 : 0.44);
    const cells = [0, 1, 2, 3].map((i) => ({ x: left + i * (cs + gap), y: cy - cs / 2, w: cs, h: cs }));
    const vTop = { x: cx, y: L.y0 + wh * (L.narrow ? 0.09 : 0.13), sc: Math.min((ww * 0.66) / (10 * VCW), 0.64) };
    const vHero = { x: cx, y: L.y0 + wh * 0.42, sc: Math.min((ww * 0.92) / (10 * VCW), 1.08) };
    const vRes = { x: cx, y: L.y0 + wh * (L.narrow ? 0.96 : 0.9), sc: vTop.sc * 0.86 };
    /* 축 이름표(화살표 아래 +78) 밑에서 시작한다. 이름표가 숨는 폭(폰)에서만 당겨 올린다 */
    const codeY = cy + cs / 2 + (getComputedStyle(axis.el).display === 'none' ? 56 : 110);
    /* 3 : int 4 칸과 double 8 칸 */
    const cs2 = Math.min((ww * 0.92 - 7 * 8) / 8, cs * 0.72), gap2 = Math.max(6, cs2 * 0.12);
    const row2 = (k, y) => [...Array(k).keys()].map((i) => ({ x: cx - (k * cs2 + (k - 1) * gap2) / 2 + i * (cs2 + gap2), y: y - cs2 / 2, w: cs2, h: cs2 }));
    const intR = row2(4, L.y0 + wh * 0.28), dblR = row2(8, L.y0 + wh * 0.64);
    /* 4 : 폭 1 – 8 의 줄 — 왼쪽 이름(mach_write_to_N)과 오른쪽 이름(DATA_…_LEN · 없다)이 둘 다 세계 안에 들어가게
       칸 크기를 정한다. 1024 폭에서 오른쪽 이름이 레일 밑으로 들어갔다(storysweep label-out · rail-overlap) */
    const tw = (t, f) => { probe.font = f; return probe.measureText(t).width; };
    const MF = `400 12px ${MONO}`, SF = '400 13px Hahmlet, serif';
    const leftW = tw('mach_write_to_8', MF), wx = L.x0 + leftW + 16;
    const rightOf = { 5: tw('없다 — 5 byte 필드가 없다', SF), 6: tw('DATA_TRX_ID_LEN', MF), 7: tw('DATA_ROLL_PTR_LEN', MF) };
    const fitC = Math.min(...Object.entries(rightOf).map(([w, lw]) => (L.x1 - 6 - 16 - lw - wx) / (+w * 1.22)));
    const cs3 = Math.max(8, Math.min(ww * 0.058, wh * 0.065, 32, fitC)), gap3 = cs3 * 0.22, rh = Math.min(Math.max(cs3 * 1.55, 18), wh / 9);
    const wy0 = L.y0 + wh * 0.5 - 3.5 * rh;
    const widR = [1, 2, 3, 4, 5, 6, 7, 8].map((w, r) => [...Array(w).keys()].map((i) => ({ x: wx + i * (cs3 + gap3), y: wy0 + r * rh - cs3 / 2, w: cs3, h: cs3 })));
    /* 6 : 32 bit — 부호 · 지수 · 가수 사이를 띄운다 */
    const bw = Math.min((ww * 0.95) / 33.5, 26), bgap = bw * 0.5, bitW = 32 * bw + 2 * bgap;
    const bits = [...Array(32).keys()].map((i) => ({
      x: cx - bitW / 2 + i * bw + (i >= 1 ? bgap : 0) + (i >= 9 ? bgap : 0), y: L.y0 + wh * 0.4 - bw * 0.7, w: bw * 0.8, h: bw * 1.4 }));
    G = { L, ww, wh, cx, cy, cs, cells, vTop, vHero, vRes, codeY, intR, dblR, widR, cs2, cs3, rh, bits, bw };
    /* 먼지 — 세계 가운데에 모이고 가장자리로 갈수록 옅어진다(상자 모양이 보이지 않게) */
    const ecx = cx, ecy = L.y0 + wh * 0.46, rx = ww * 0.62, ry = wh * 0.56;
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(rnd()), th = rnd() * Math.PI * 2;
      dust[i * 2] = ecx + Math.cos(th) * r * rx; dust[i * 2 + 1] = ecy + Math.sin(th) * r * ry;
      dustA[i] = Math.pow(1 - r, 1.4);
    }

    addr.forEach((lb, i) => place(lb, cells[i].x + cs / 2, cy + cs / 2 + 20));
    place(tagMSB, 0, cy + cs / 2 + 40); place(tagLSB, 0, cy + cs / 2 + 40);
    place(axis, cells[3].x + cs, cy + cs / 2 + 78, 'r');
    /* 코드 판 — 줄이 긴 발췌(mach_read_from_4 의 143 줄)는 좁은 세계에서 넘쳤다. 실제 폭을 재서 남는 폭에 맞춰 글자를 줄인다 */
    [cw, cr].forEach((c) => {
      const x = Math.round(L.narrow ? L.x0 : left - 8);
      c.el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(c.el).fontSize), nat = c.el.scrollWidth, room = L.x1 - x - 6;
      if (nat > room) c.el.style.fontSize = Math.max(8, base * (room / nat)).toFixed(2) + 'px';
      /* 8px 로도 안 들어가면(390 폭의 mach_read_from_4) 이 배치에서는 띄우지 않는다 — 근거 버튼이 원문을 연다 */
      c.hide = nat * (8 / base) > room;
      c.el.style.display = c.hide ? 'none' : '';
      c.el.style.transform = `translate(${x}px, ${Math.round(codeY)}px)`;
    });
    place(intLb, intR[0].x, intR[0].y - 22, 'l');
    place(dblLb, dblR[0].x, dblR[0].y - 22, 'l');
    dblAddr.forEach((lb, i) => place(lb, dblR[i].x + cs2 / 2, dblR[i].y + cs2 + 16));
    place(bigInt, intR[0].x + cs2 / 2, intR[0].y + cs2 + 18);
    place(bigDbl, dblR[7].x + cs2 / 2, dblR[7].y + cs2 + 36);
    widLb.forEach((lb, r) => place(lb, wx - 16, wy0 + r * rh, 'r'));
    place(none5, widR[4][4].x + cs3 + 16, wy0 + 4 * rh, 'l');
    place(lenLb[6], widR[5][5].x + cs3 + 16, wy0 + 5 * rh, 'l');
    place(lenLb[7], widR[6][6].x + cs3 + 16, wy0 + 6 * rh, 'l');
    place(misLb, cx, vRes.y - 50);
    place(okLb, cx, intR[0].y + cs2 + 48);
    place(misLb2, cx, dblR[0].y + 2);
    place(resLb, cx, (vTop.y + cells[0].y) / 2 + 14);
    place(bitLb[0], bits[0].x + bits[0].w / 2, L.narrow ? bits[0].y + bits[0].h + 14 : bits[0].y - 18, L.narrow ? 'l' : 'c');
    place(bitLb[1], (bits[1].x + bits[8].x + bits[8].w) / 2, bits[0].y - 18);
    place(bitLb[2], (bits[9].x + bits[31].x + bits[31].w) / 2, bits[0].y - 18);
    place(bitHex, cx, bits[0].y + bits[0].h + 38);
    place(bitVal, cx, bits[0].y + bits[0].h + 70);
    place(bitRep, cx, bits[0].y + bits[0].h + 96);
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  /* 값 0xAABBCCDD — 그룹 g 의 점을 v(자리 · 배율)에. from[g] 가 있으면 그 점에서 퍼져 나온다 */
  function valAt(o, v, alphaOf, colorOf, heatOf, from = null) {
    const s0 = R.VAL[0];
    for (let g = 0; g < 5; g++) {
      const pts = valG[g], a = alphaOf(g), c = colorOf(g), h = heatOf(g), q = from && from[g];
      for (let n = 0; n < vn; n++) {
        const i = s0 + g * vn + n;
        let x = v.x + pts[n * 2] * v.sc, y = v.y + pts[n * 2 + 1] * v.sc;
        if (q) { x = U.lerp(q.x + jit[i * 2] * 6, x, q.k); y = U.lerp(q.y + jit[i * 2 + 1] * 6, y, q.k); }
        put(o, i, x, y, a, h, 0.35, 1.2, c);
      }
    }
    for (let i = s0 + 5 * vn; i < R.VAL[1]; i++) put(o, i, v.x, v.y, 0, 0, 0, 0, INK);
  }
  /* byte b 의 글자를 칸 c 에. src 가 있으면 값 글자(그 byte 의 두 자리) 모양에서 떨어져 나온다(k : 0 → 1) */
  function glyphIn(o, b, c, a, h, color, src = null, k = 1) {
    const pts = glyG[b], sc = (c.w * 0.4) / GREF, cx0 = c.x + c.w / 2, cy0 = c.y + c.h / 2, vp = valG[b + 1];
    for (let n = 0; n < gn; n++) {
      const i = R.GLY[0] + b * gn + n;
      let x = cx0 + pts[n * 2] * sc, y = cy0 + pts[n * 2 + 1] * sc;
      if (src) {
        const q = n % vn;
        x = U.lerp(src.x + vp[q * 2] * src.sc + jit[i * 2] * 0.8, x, k);
        y = U.lerp(src.y + vp[q * 2 + 1] * src.sc + jit[i * 2 + 1] * 0.8, y, k);
      }
      put(o, i, x, y, a, h, 0.25, c.w > 60 ? 1.3 : 1.05, color);
    }
  }
  function boxAt(o, base, count, c, a, color, draw = 1, h = 0) {
    const path = U.rectPath(c.x, c.y, c.w, c.h);
    for (let n = 0; n < count; n++) {
      const i = base + n, s = (n + 0.5) / count, ok = s <= draw;
      const p = path(ok ? s : draw);
      put(o, i, p[0] + jit[i * 2] * 0.6, p[1] + jit[i * 2 + 1] * 0.6, ok ? a : 0, h, 0.15, 1.05, color);
    }
  }
  function cellsBox(o, cells, a, draw = 1) {
    const bn = per(len('BOX'), 4);
    cells.forEach((c, k) => boxAt(o, R.BOX[0] + k * bn, bn, c, a, FAINT, draw));
    for (let i = R.BOX[0] + 4 * bn; i < R.BOX[1]; i++) put(o, i, 0, 0, 0, 0, 0, 0, INK);
  }
  function park(o, key, x = null, y = null) {
    for (let i = R[key][0]; i < R[key][1]; i++) put(o, i, x == null ? dust[i * 2] : x, y == null ? dust[i * 2 + 1] : y, 0, 0, 2.2, 1, FAINT);
  }
  function dustAll(o, a) {
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], a * dustA[i], 0, 3, 1, FAINT);
  }
  /* 흐름 — 코드 한 줄이 byte 하나를 옮기는 동안 두 점 사이를 오가는 알갱이 */
  function stream(o, from, to, k, color, t) {
    const [s0, s1] = R.STR;
    for (let i = s0; i < s1; i++) {
      const u = (F.seed[i] + t * 0.9) % 1, arc = Math.sin(u * Math.PI) * -30;
      put(o, i, U.lerp(from.x, to.x, u) + jit[i * 2] * 5, U.lerp(from.y, to.y, u) + arc + jit[i * 2 + 1] * 5,
        k * 0.85 * Math.sin(u * Math.PI), 1.1, 0.3, 1.2, color);
    }
  }
  function dblGlyphs(o, cells, a, draw, hot = 7) {
    const s0 = R.DBL[0];
    for (let g = 0; g < 8; g++) {
      const pts = dblG[g], c = cells[g], sc = (c.w * 0.4) / GREF, path = U.rectPath(c.x, c.y, c.w, c.h);
      const k = U.smooth(U.range(draw, g / 10, g / 10 + 0.3));
      for (let n = 0; n < dn; n++) {
        const i = s0 + g * dn + n;
        put(o, i, U.lerp(dust[i * 2], c.x + c.w / 2 + pts[n * 2] * sc, k), U.lerp(dust[i * 2 + 1], c.y + c.h / 2 + pts[n * 2 + 1] * sc, k),
          a * (k < 0.02 ? 0 : 0.2 + 0.8 * k), g === hot ? 0.7 : 0, 0.2, 1.05, g === hot ? GOLD : INK);
      }
      for (let n = 0; n < dbn; n++) {
        const i = s0 + 8 * dn + g * dbn + n, p = path((n + 0.5) / dbn);
        put(o, i, p[0], p[1], a * k * 0.8, 0, 0.1, 1, FAINT);
      }
    }
  }
  function textAt(o, key, pts, count, v, a, color, h = 0) {
    const s0 = R[key][0];
    for (let n = 0; n < count; n++) put(o, s0 + n, v.x + pts[n * 2] * v.sc, v.y + pts[n * 2 + 1] * v.sc, a, h, 0.3, 1.1, color);
    for (let i = s0 + count; i < R[key][1]; i++) put(o, i, v.x, v.y, 0, 0, 0, 0, color);
  }
  /* 작은 칸들의 외곽선 — SML 알갱이를 칸 수로 나눈다. dash 인 칸은 흐리게(없는 폭) */
  function smallCells(o, list, a) {
    const [s0, s1] = R.SML, each = Math.max(8, Math.floor((s1 - s0) / Math.max(1, list.length)));
    let i = s0;
    for (const c of list) {
      const path = U.rectPath(c.x, c.y, c.w, c.h);
      for (let m = 0; m < each && i < s1; m++, i++) {
        const p = path((m + 0.5) / each);
        put(o, i, p[0], p[1], c.dash ? a * 0.3 : a, 0, 0.1, c.dash ? 0.8 : 1.05, c.dash ? FAINT : c.color);
      }
    }
    for (; i < s1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
  }
  /* 줄 g 가 켜지는 구간 — 쓰기 · 읽기 모두 byte 하나에 8.5%, 넷이 p 0.42 에 끝난다.
     처음엔 15% 씩(0.16 – 0.76)이라 서는 자리(0.58)에 셋째 byte 가 쓰이는 중이었고 결과는 0.78 뒤에야 나왔다(storysweep hold-still) */
  const seg = (p, g) => U.range(p, 0.08 + g * 0.085, 0.165 + g * 0.085);
  const big = (g) => (g === 1 ? GOLD : INK);         /* 그룹 1 = 큰 자리 byte(AA) */
  const grpAt = (v, g) => ({ x: v.x + goff(g) * v.sc, y: v.y });

  function pose(k, p, t, o) {
    if (!G) return;
    const { cells, vTop, vHero, vRes, intR, dblR, widR, bits } = G;
    dustAll(o, 0.07);
    if (k === 0) {
      /* 제목 → 값이 위로 → 칸이 그려지고 → byte 가 값 글자에서 떨어져 나와 칸으로 */
      const up = U.smooth(U.range(p, 0.16, 0.34));
      const v = { x: U.lerp(vHero.x, vTop.x, up), y: U.lerp(vHero.y, vTop.y, up), sc: U.lerp(vHero.sc, vTop.sc, up) };
      valAt(o, v, () => 0.85, big, (g) => (g === 1 ? 0.5 * up : 0));
      cellsBox(o, cells, 0.75, U.smooth(U.range(p, 0.24, 0.42)));
      for (let b = 0; b < 4; b++) {
        const k2 = U.smooth(U.range(p, 0.38 + b * 0.05, 0.5 + b * 0.05));
        glyphIn(o, b, cellAt(b, cells), 0.9, b === 0 ? 0.9 * k2 : 0, b === 0 ? GOLD : INK, v, k2);
      }
      park(o, 'STR', vTop.x, vTop.y); park(o, 'DBL'); park(o, 'SML');
      return;
    }
    if (k === 1 || k === 4) {
      const read = k === 4;
      cellsBox(o, cells, 0.75, 1);
      for (let b = 0; b < 4; b++) glyphIn(o, b, cellAt(b, cells), 1, b === 0 ? 0.7 : 0, b === 0 ? GOLD : INK);
      park(o, 'SML');
      if (little() && !read) {
        /* 01v 2 : 메모리 순서 그대로 파일에 쓰면 — 다른 기계가 반대로 읽는다 */
        valAt(o, vTop, () => 0.85, big, () => 0);
        textAt(o, 'DBL', misPts, dn * 8, vRes, 0.9 * U.smooth(U.range(p, 0.12, 0.4)), RED, 0.4);
        park(o, 'STR', vTop.x, vTop.y);
        return;
      }
      park(o, 'DBL');
      let cur = -1;
      for (let b = 0; b < 4; b++) { const s = seg(p, b); if (s > 0 && s < 1) cur = b; }
      if (!read) {
        /* 01 2 : 129 – 132 가 한 줄에 한 byte — n >> 24 가 a+0 으로 */
        valAt(o, vTop, () => 0.9, big, (g) => (g >= 1 && g - 1 === cur ? 1.2 : 0));
        if (cur >= 0) {
          const c = cells[cellOf(cur)], s = grpAt(vTop, cur + 1);
          stream(o, { x: s.x, y: s.y + 34 }, { x: c.x + c.w / 2, y: c.y - 4 }, Math.sin(seg(p, cur) * Math.PI), cur === 0 ? GOLD : ACCENT, t);
        } else park(o, 'STR', vTop.x, vTop.y);
        return;
      }
      /* 5 : 칸의 byte 가 위의 값 자리로 다시 모인다 — 큰 자리부터. 01v 는 끝 칸(a+3)에서 시작한다 */
      const from = { 0: { x: vTop.x, y: vTop.y, k: U.smooth(U.range(p, 0.08, 0.18)) } };
      for (let b = 0; b < 4; b++) {
        const c = cellAt(b, cells);
        from[b + 1] = { x: c.x + c.w / 2, y: c.y + c.h / 2, k: U.smooth(seg(p, b)) };
      }
      const done = U.smooth(U.range(p, 0.42, 0.5));
      valAt(o, vTop, (g) => 0.92 * (g === 0 ? from[0].k : U.smooth(U.range(seg(p, g - 1), 0, 0.12))),
        (g) => (done > 0.5 ? (little() ? GOLD : GREEN) : big(g)), () => done * 0.5, from);
      if (cur >= 0) {
        const c = cells[cellOf(cur)], s = grpAt(vTop, cur + 1);
        stream(o, { x: c.x + c.w / 2, y: c.y - 4 }, { x: s.x, y: s.y + 34 }, Math.sin(seg(p, cur) * Math.PI), ACCENT, t);
      } else park(o, 'STR', vTop.x, vTop.y);
      return;
    }
    if (k === 2) {
      cellsBox(o, intR, 0.75, 1);
      for (let b = 0; b < 4; b++) glyphIn(o, b, cellAt(b, intR), 1, b === 0 ? 0.6 : 0, b === 0 ? GOLD : INK);
      park(o, 'STR'); park(o, 'SML');
      if (little()) {
        /* 01v 3 : 같은 byte 를 두 기계가 다르게 읽는다 */
        valAt(o, { x: G.cx, y: intR[0].y + G.cs2 + 86, sc: vTop.sc * 0.62 }, () => 0.9 * U.smooth(U.range(p, 0.1, 0.36)), () => GREEN, () => 0.3);
        textAt(o, 'DBL', misPts, dn * 8, { x: G.cx, y: dblR[0].y + 44, sc: vTop.sc * 0.62 }, 0.9 * U.smooth(U.range(p, 0.3, 0.56)), RED, 0.4);
        return;
      }
      /* 01 3 : 정수는 큰 자리부터, double 은 작은 자리부터 */
      valAt(o, { x: vTop.x, y: vTop.y - 30, sc: vTop.sc * 0.5 }, () => 0, big, () => 0);
      dblGlyphs(o, dblR, 1, U.range(p, 0.06, 0.5));
      return;
    }
    if (k === 3) {
      /* 4 : 폭마다 함수 — int 는 4 칸 줄로, double 은 8 칸 줄로 들어간다. 5 칸 줄은 비어 있다 */
      const row4 = widR[3], row8 = widR[7];
      cellsBox(o, row4, 0.8, 1);
      for (let b = 0; b < 4; b++) glyphIn(o, b, cellAt(b, row4), 0.95, 0, b === 0 ? GOLD : INK);
      dblGlyphs(o, row8, 0.9, 1, -1);
      const others = [];
      [0, 1, 2, 4, 5, 6].forEach((r) => widR[r].forEach((c) => others.push({ ...c, dash: r === 4, color: r === 5 || r === 6 ? GOLD : INK })));
      smallCells(o, others, 0.85);
      valAt(o, { x: vTop.x, y: vTop.y - 30, sc: vTop.sc * 0.5 }, () => 0, big, () => 0);
      park(o, 'STR');
      return;
    }
    if (k === 5) {
      /* 6 : float 0.1 의 32 bit — 1 은 채운 칸, 0 은 빈 칸. 가수의 1100 반복이 무늬로 보인다 */
      const [s0, s1] = R.SML, each = Math.floor((s1 - s0) / 32);
      for (let b = 0; b < 32; b++) {
        const c = bits[b], one = BITS[b] === '1', kk = U.smooth(U.range(p, 0.06 + b * 0.008, 0.2 + b * 0.008));
        const color = b === 0 ? ACCENT : b <= 8 ? GOLD : INK, path = U.rectPath(c.x, c.y, c.w, c.h);
        for (let m = 0; m < each; m++) {
          const i = s0 + b * each + m;
          const [tx, ty] = one ? [c.x + unit[i * 2] * c.w, c.y + unit[i * 2 + 1] * c.h] : path((m + 0.5) / each);
          put(o, i, U.lerp(dust[i * 2], tx, kk), U.lerp(dust[i * 2 + 1], ty, kk), (one ? 0.95 : 0.5) * kk, one ? 0.35 : 0, 0.12, one ? 1.25 : 0.9, color);
        }
      }
      for (let i = s0 + 32 * each; i < s1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
      cellsBox(o, cells, 0, 1);
      for (let b = 0; b < 4; b++) glyphIn(o, b, cellAt(b, cells), 0, 0, INK);
      valAt(o, vTop, () => 0, big, () => 0);
      park(o, 'STR'); park(o, 'DBL');
      return;
    }
    /* 끝 — 모든 알갱이가 먼지로 가라앉는다 */
    for (let i = 0; i < R.DST[0]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0.05 * dustA[i], 0, 3, 1, FAINT);
  }

  /* ── 이름표 · 코드 줄 ── */
  function vis(k, p) {
    const v = new Map(), L = little();
    const io = (on, a = 0, b2 = 0) => (on ? (b2 ? U.smooth(U.range(p, a, b2)) : 1) : 0);
    const main = k === 1 || k === 4;
    const lit = k === 0 ? U.smooth(U.range(p, 0.42, 0.55)) : main ? 1 : 0;
    addr.forEach((lb) => v.set(lb, lit));
    const tags = k === 0 ? U.smooth(U.range(p, 0.58, 0.66)) : main ? 1 : 0;
    v.set(tagMSB, tags); v.set(tagLSB, tags); v.set(axis, tags * 0.9);
    v.set(intLb, io(k === 2 && !L));
    v.set(dblLb, io(k === 2 && !L, 0.1, 0.3));
    dblAddr.forEach((lb) => v.set(lb, io(k === 2 && !L, 0.3, 0.45)));
    v.set(bigInt, io(k === 2 && !L, 0.38, 0.5)); v.set(bigDbl, v.get(bigInt));
    widLb.forEach((lb) => v.set(lb, io(k === 3)));
    v.set(none5, io(k === 3, 0.2, 0.35));
    v.set(lenLb[6], io(k === 3, 0.3, 0.45)); v.set(lenLb[7], v.get(lenLb[6]));
    v.set(misLb, io(L && k === 1, 0.2, 0.4));
    v.set(okLb, io(L && k === 2, 0.1, 0.3));
    v.set(misLb2, io(L && k === 2, 0.3, 0.5));
    v.set(resLb, io(k === 4, 0.44, 0.52));
    bitLb.forEach((lb) => v.set(lb, io(k === 5, 0.3, 0.45)));
    v.set(bitHex, io(k === 5, 0.32, 0.42));
    v.set(bitVal, io(k === 5, 0.38, 0.48));
    v.set(bitRep, io(k === 5, 0.44, 0.54));
    return v;
  }
  const codeVis = (kk, pp, which) => {
    const on = which === 'w' ? kk === 1 && !little() : kk === 4 && !little();
    return on ? U.smooth(U.range(pp, 0.04, 0.14)) * (1 - U.smooth(U.range(pp, 0.86, 0.95))) : 0;
  };
  function paint(k, p, b) {
    if (!G) return;
    const A = vis(k, p), B = b > 0 ? vis(k + 1, 0) : null;
    for (const lb of made) {
      const o = Math.min(1, B ? U.lerp(A.get(lb) || 0, B.get(lb) || 0, b) : A.get(lb) || 0);
      if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; }
    }
    /* MSB · LSB 의 자리는 장면(순서)을 따른다 */
    const msb = cellAt(0, G.cells), lsb = cellAt(3, G.cells);
    place(tagMSB, msb.x + G.cs / 2, tagMSB.y); place(tagLSB, lsb.x + G.cs / 2, tagLSB.y);
    const rt = little() ? '뒤집어 읽어 복원 — 읽는 쪽에 분기가 생긴다' : '쓴 순서 그대로 읽어 복원 — 왕복';
    if (resLb.el.textContent !== rt) { resLb.el.textContent = rt; resLb.el.className = 'wl serif ' + (little() ? 'gold' : 'green'); }
    for (const [c, w] of [[cw, 'w'], [cr, 'r']]) {
      const o = Math.max(codeVis(k, p, w), b > 0 ? codeVis(k + 1, 0, w) : 0);
      if (Math.abs(o - c.o) > 0.004) { c.el.style.opacity = o.toFixed(3); c.o = o; }
    }
    /* 쓰기 : 129 – 132 가 byte 하나씩. 읽기 : 141 – 143 세 줄에 byte 넷이 걸쳐 있다(0 · 1 · 2 · 3 → 141 · 142 · 143 · 143) */
    const onW = k === 1 ? [129, 130, 131, 132].filter((_, g) => seg(p, g) > 0) : [];
    cw.lines.forEach((el) => el.classList.toggle('on', onW.includes(+el.dataset.n) || (k === 1 && +el.dataset.n === 126)));
    const RL = [141, 142, 143, 143];
    const onR = k === 4 ? [0, 1, 2, 3].filter((g) => seg(p, g) > 0).map((g) => RL[g]) : [];
    cr.lines.forEach((el) => el.classList.toggle('on', onR.includes(+el.dataset.n) || (k === 4 && +el.dataset.n === 139)));
  }

  let faint = '#5E6B68';
  function overlay(ctx, k, p, b) {
    if (!G) return;
    const o = (k === 0 ? U.smooth(U.range(p, 0.58, 0.66)) : k === 1 || k === 4 ? 1 : 0) * (1 - b);
    if (o < 0.01) return;
    const y = G.cells[0].y + G.cs + 64, x0 = G.cells[0].x, x1 = G.cells[3].x + G.cs;
    ctx.save();
    ctx.globalAlpha = o * 0.7; ctx.strokeStyle = faint; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y);
    ctx.moveTo(x1 - 6, y - 4); ctx.lineTo(x1, y); ctx.lineTo(x1 - 6, y + 4); ctx.stroke();
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() { faint = getComputedStyle(document.documentElement).getPropertyValue('--faint').trim() || faint; },
    pose, paint, overlay,
    setScene(n2) { if (ORDER[n2] && n2 !== num) { prev = num; num = n2; swapT0 = performance.now(); } },
    dispose() { made.forEach((lb) => lb.el.remove()); cw.el.remove(); cr.el.remove(); },
  };
}
