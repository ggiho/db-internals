/* 알갱이 장(field) — opus-site 의 engine.js 를 옮겼다. 세계(worlds/)는 목표만 쓰고, 장이 알갱이를
   그 목표로 끌어간다 : 위치(tx · ty) · 투명도(ta) · 열(th) · 흔들림(tj) · 색(tc) · 크기(ts).
   색은 토큰 이름(잉크 · 금 · 청 · 녹 · 적 · 흐림)으로 고른다 — 덱의 tag 색(gold · green · red)과 같은 뜻이다.
   열은 같은 색을 밝히고, 어두운 테마에서 가장 높은 열은 더해 그린다(빛나 보이게).
   그리기는 (색 · 열 · 투명도) 칸으로 묶어 fillStyle 전환을 줄인다. */
export const INK = 0, GOLD = 1, ACCENT = 2, GREEN = 3, RED = 4, FAINT = 5;
const TOKENS = ['--ink', '--gold', '--accent', '--green', '--red', '--faint'];
const NC = TOKENS.length, LEVELS = 5, ALPHAS = 6, BUCKETS = NC * LEVELS * ALPHAS;

function parseColor(str) {
  const s = (str || '').trim();
  if (s.startsWith('#')) {
    const v = s.length === 4 ? s.slice(1).split('').map((c) => c + c).join('') : s.slice(1);
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  const m = s.match(/[\d.]+/g) || [0, 0, 0];
  return m.slice(0, 3).map(Number);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export function createField(canvas, N) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const f32 = () => new Float32Array(N);
  const F = {
    N, reduced, ctx,
    px: f32(), py: f32(), vx: f32(), vy: f32(), a: f32(), h: f32(), s: f32(),
    tx: f32(), ty: f32(), ta: f32(), th: f32(), tj: f32(), ts: f32(),
    c: new Uint8Array(N), tc: new Uint8Array(N), seed: f32(),
    W: innerWidth, H: innerHeight, dpr: 1, dark: true,
    overlay: null,    /* (ctx, t) => void — 알갱이 위에 그리는 가는 선 */
  };
  for (let i = 0; i < N; i++) {
    F.seed[i] = Math.random();
    F.px[i] = Math.random() * F.W; F.py[i] = Math.random() * F.H;
    F.s[i] = F.ts[i] = 1.4;
  }

  /* ── 색 : 토큰을 읽어 (색 · 열 · 투명도) 칸마다 fillStyle 을 만든다 ── */
  let styles = [], glowFrom = LEVELS;
  F.readTheme = function () {
    const cs = getComputedStyle(document.documentElement);
    const bg = parseColor(cs.getPropertyValue('--bg'));
    F.dark = (bg[0] + bg[1] + bg[2]) / 3 < 128;
    styles = [];
    for (let c = 0; c < NC; c++) {
      const base = parseColor(cs.getPropertyValue(TOKENS[c]));
      /* 밝게 : 어두운 바탕에서는 흰빛으로, 밝은 바탕에서는 같은 색을 진하게 */
      const hot = F.dark ? mix(base, [255, 248, 228], 0.82) : mix(base, [0, 0, 0], 0.45);
      for (let l = 0; l < LEVELS; l++) {
        const col = mix(base, hot, l / (LEVELS - 1));
        for (let a = 0; a < ALPHAS; a++) styles.push(`rgba(${col[0]},${col[1]},${col[2]},${((a + 1) / ALPHAS).toFixed(3)})`);
      }
    }
    glowFrom = F.dark ? LEVELS - 1 : LEVELS;
  };

  F.resize = function () {
    F.dpr = Math.min(2, window.devicePixelRatio || 1);
    F.W = innerWidth; F.H = innerHeight;
    canvas.width = Math.round(F.W * F.dpr);
    canvas.height = Math.round(F.H * F.dpr);
    ctx.setTransform(F.dpr, 0, 0, F.dpr, 0, 0);
  };

  /* ── 물리 : 목표로 끄는 용수철 + 감쇠 + 흔들림 ── */
  F.step = function (dt, t) {
    const K = reduced ? 150 : 62, damp = Math.exp(-(reduced ? 18 : 9) * dt);
    const aRate = Math.min(1, dt * 5), hRate = Math.min(1, dt * 3), sRate = Math.min(1, dt * 6);
    const { px, py, vx, vy, tx, ty, tj, seed } = F;
    for (let i = 0; i < N; i++) {
      const sd = seed[i] * 6.283, j = reduced ? 0 : tj[i];
      const gx = tx[i] + (j ? Math.sin(t * (1.1 + seed[i]) + sd) * j : 0);
      const gy = ty[i] + (j ? Math.cos(t * (0.9 + seed[i] * 1.3) + sd * 1.7) * j : 0);
      const ax = (gx - px[i]) * K, ay = (gy - py[i]) * K;
      vx[i] = (vx[i] + ax * dt) * damp; vy[i] = (vy[i] + ay * dt) * damp;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt;
      F.a[i] += (F.ta[i] - F.a[i]) * aRate;
      F.h[i] += (F.th[i] - F.h[i]) * hRate;
      F.s[i] += (F.ts[i] - F.s[i]) * sRate;
      F.c[i] = F.tc[i];
    }
  };

  /* ── 그리기 : 칸별 계수 정렬 후 칸마다 fillStyle 한 번 ── */
  const counts = new Uint32Array(BUCKETS + 1), order = new Uint32Array(N), keys = new Uint16Array(N);
  F.render = function (t) {
    ctx.clearRect(0, 0, F.W, F.H);
    counts.fill(0);
    for (let i = 0; i < N; i++) {
      const a = F.a[i];
      if (a < 0.03 || F.s[i] < 0.2) { keys[i] = BUCKETS; continue; }
      const l = Math.min(LEVELS - 1, Math.max(0, (F.h[i] * 0.5 * (LEVELS - 1) + 0.5) | 0));
      const k = (F.c[i] * LEVELS + l) * ALPHAS + Math.min(ALPHAS - 1, (a * ALPHAS) | 0);
      keys[i] = k; counts[k]++;
    }
    let acc = 0;
    for (let b = 0; b <= BUCKETS; b++) { const c = counts[b]; counts[b] = acc; acc += c; }
    for (let i = 0; i < N; i++) order[counts[keys[i]]++] = i;
    let start = 0;
    for (let b = 0; b < BUCKETS; b++) {
      const end = counts[b];
      if (end === start) continue;
      const glow = ((b / ALPHAS) | 0) % LEVELS >= glowFrom;
      ctx.fillStyle = styles[b];
      if (glow) ctx.globalCompositeOperation = 'lighter';
      for (let n = start; n < end; n++) {
        const i = order[n], s = F.s[i];
        ctx.fillRect(F.px[i] - s * 0.5, F.py[i] - s * 0.5, s, s);
      }
      if (glow) ctx.globalCompositeOperation = 'source-over';
      start = end;
    }
    if (F.overlay) F.overlay(ctx, t);
  };

  return F;
}

/* ── 모양 → 점 : 세계가 공유하는 도구 ── */
export const U = {
  clamp: (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)),
  range: (t, a, b) => U.clamp((t - a) / (b - a)),
  rng(seed) { /* mulberry32 — 같은 배치가 매번 같은 모양을 내게 */
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let r = Math.imul(s ^ (s >>> 15), 1 | s);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  },
};

/* draw() 가 w×h 상자에 칠한 픽셀 위로 count 개의 점을 흩어 (x,y) 쌍으로 준다. 위치는 (ox, oy) 기준 */
U.sampleDrawing = function (w, h, draw, count, ox, oy, rnd = Math.random) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  draw(g);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const hits = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 110) hits.push(x, y);
  const out = new Float32Array(count * 2), n = hits.length / 2;
  if (!n) return out.fill(-9999);
  for (let i = 0; i < count; i++) {
    const k = ((rnd() * n) | 0) * 2;
    out[i * 2] = ox + hits[k] + rnd(); out[i * 2 + 1] = oy + hits[k + 1] + rnd();
  }
  return out;
};

/* 한 줄 글자를 (cx, cy) 가운데에 size px 로 찍어 점으로 */
U.sampleText = function (text, font, cx, cy, count, rnd) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const m = probe.measureText(text);
  const size = parseFloat(/(\d+(\.\d+)?)px/.exec(font)[1]);
  const w = m.width + size * 0.4, h = size * 1.4;
  return U.sampleDrawing(w, h, (g) => {
    g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText(text, w / 2, h * 0.52);
  }, count, cx - w / 2, cy - h / 2, rnd);
};

/* 둥근 사각형 외곽선을 길이로 매개화 — s∈[0,1) → [x, y] */
U.rectPath = function (x, y, w, h) {
  const per = 2 * (w + h);
  return (s) => {
    let d = (((s % 1) + 1) % 1) * per;
    if (d < w) return [x + d, y];
    d -= w; if (d < h) return [x + w, y + d];
    d -= h; if (d < w) return [x + w - d, y + h];
    d -= w; return [x, y + h - d];
  };
};

export const box = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
};
