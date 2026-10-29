/* 첫 화면 — 빈 주소로 들어오면 덱을 고른다(2026-10-29 사용자 결정).
   예전에는 book/ch3 01(바이트 순서)이 열렸다 — 프로젝트가 그 덱 하나로 시작했고(2026-09-04) 기본값이 그대로 남았다.

   두 번째 판(같은 날, 사용자 : "첫화면 퀄리티가 너무 떨어짐"). 첫 판은 글 목록이었고 글꼴도 싣지 않아 대체 글꼴로 그려졌다.
   이 사이트의 말투 — 알갱이가 모여 page · tree 를 이루고, 수는 잰 값 — 를 첫 화면에서 보인다.
     · 오른쪽 그림 : 알갱이가 먼지에서 모여 B-tree 가 되고, 가득 찬 leaf 가 한 번 나뉜다. 수는 postgres/btree 01 에서 잰 것
       (leaf 하나에 407, 408 번째에서 367 : 42, root 항목 2 → 3). 이 페이지에서 움직이는 것은 이것 하나다.
     · 덱마다 그 세계를 닮은 점 그림(정지) — 카드 테두리 · 그림자 없이.
   장면 · 소스 데이터는 싣지 않는다 — deck.js(제목 · 한 줄 설명)와 has.js 의 장면 목록만. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { STORY } from './has.js';
import { DECK as innodb } from '../../data/mysql/innodb/deck.js';
import { DECK as mylocks } from '../../data/mysql/locks/deck.js';
import { DECK as mvcc } from '../../data/postgres/mvcc/deck.js';
import { DECK as heap } from '../../data/postgres/heap/deck.js';
import { DECK as buffer } from '../../data/postgres/buffer/deck.js';
import { DECK as btree } from '../../data/postgres/btree/deck.js';
import { DECK as pglocks } from '../../data/postgres/locks/deck.js';
import { DECK as wal } from '../../data/postgres/wal/deck.js';
import { DECK as wt } from '../../data/mongodb/wiredtiger/deck.js';
import { DECK as aurora } from '../../data/aurora/mysql/deck.js';
import { DECK as ch2 } from '../../data/book/ch2/deck.js';
import { DECK as ch3 } from '../../data/book/ch3/deck.js';
import './story.css';

/* Story 와 같은 글꼴 — 첫 판은 이것을 싣지 않아 제목이 대체 글꼴(AppleMyungjo)로 나왔다. 같은 id 라 Story 가 다시 싣지 않는다 */
const FONTS = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
function useFonts() {
  useEffect(() => {
    if (document.getElementById('st-fonts')) return;
    const l = document.createElement('link');
    l.id = 'st-fonts'; l.rel = 'stylesheet'; l.href = FONTS;
    document.head.appendChild(l);
  }, []);
}

/* 덱 — 엔진 순서대로. 이름은 첫 화면에서 읽히는 짧은 것(덱 제목 'MySQL Actor Stage' 같은 것은 Story 머리말용이다) */
const DECKS = [
  ['mysql/innodb', 'MySQL 8.4.8', 'InnoDB', innodb],
  ['mysql/locks', 'MySQL 8.4.8', 'Locks', mylocks],
  ['postgres/mvcc', 'PostgreSQL 18.6', 'MVCC · VACUUM', mvcc],
  ['postgres/heap', 'PostgreSQL 18.6', 'Heap Pages', heap],
  ['postgres/buffer', 'PostgreSQL 18.6', 'Shared Buffers', buffer],
  ['postgres/btree', 'PostgreSQL 18.6', 'B-tree', btree],
  ['postgres/locks', 'PostgreSQL 18.6', 'Locks', pglocks],
  ['postgres/wal', 'PostgreSQL 18.6', 'WAL · 복구', wal],
  ['mongodb/wiredtiger', 'MongoDB 8.0 · WiredTiger', 'WiredTiger', wt],
  ['aurora/mysql', 'Aurora MySQL · 논문 인용', 'Storage · Quorum', aurora],
  ['book/ch2', 'Database Internals', '2장 B-Tree 기초', ch2],
  ['book/ch3', 'Database Internals', '3장 파일 형식', ch3],
];
/* 숨은 짝 장면(05v · 02v · 04bv …)은 세지 않는다 — 메뉴에도 짝의 A 하나로 보인다 */
const scenesOf = (id) => STORY[id].nums.filter((n) => !/v$/.test(n)).length;

const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
const palette = () => {
  const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
  return { ink: v('--ink'), body: v('--body'), faint: v('--faint'), mid: v('--mid'), gold: v('--gold'), accent: v('--accent'), red: v('--red'), green: v('--green') };
};

/* ── 점 그리기 — 모든 그림은 알갱이(작은 네모)로만 그린다. Story 세계와 같은 말투 ── */
const P = 4;   /* 알갱이 간격(css px) */
function outline(out, x, y, w, h, c = 'ink', a = 0.9, step = P) {
  for (let i = 0; i <= w; i += step) { out.push([x + i, y, c, a]); out.push([x + i, y + h, c, a]); }
  for (let j = step; j < h; j += step) { out.push([x, y + j, c, a]); out.push([x + w, y + j, c, a]); }
}
function fill(out, x, y, w, h, c = 'ink', a = 0.8, step = P) {
  for (let j = 0; j <= h; j += step) for (let i = 0; i <= w; i += step) out.push([x + i, y + j, c, a]);
}
function line(out, x0, y0, x1, y1, c = 'faint', a = 0.7, step = P * 1.5) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let k = 0; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c, a]);
}
function ring(out, cx, cy, r, n, c = 'ink', a = 0.85) {
  for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2 - Math.PI / 2; out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r, c, a]); }
}

/* 덱마다의 점 그림 — 그 덱의 세계가 그리는 것을 줄여서. (W, H) 안에 */
const SIGILS = {
  /* 쓰기 경로 : log buffer · buffer pool · 디스크 세 층, dirty page 하나가 금색 */
  'mysql/innodb': (o, W, H) => {
    const x0 = W * 0.1, w = W * 0.8;
    fill(o, x0, H * 0.16, w * 0.34, 8, 'gold', 0.9); outline(o, x0, H * 0.12, w, 16, 'faint', 0.6);
    for (let i = 0; i < 8; i++) { const bx = x0 + (i * w) / 8; outline(o, bx + 2, H * 0.42, w / 8 - 8, 22, i === 5 ? 'gold' : 'ink', i === 5 ? 0.95 : 0.55); }
    line(o, x0, H * 0.82, x0 + w, H * 0.82, 'ink', 0.6, P);
    for (let i = 0; i <= 10; i++) line(o, x0 + (i * w) / 10, H * 0.78, x0 + (i * w) / 10, H * 0.86, 'faint', 0.6, P);
    line(o, x0 + w * 0.72, H * 0.42 + 26, x0 + w * 0.72, H * 0.76, 'gold', 0.8);
  },
  /* MDL · InnoDB 호환표 : 5 × 5 칸, 막힘은 비고 허용은 차고, 한 칸이 금색 */
  'mysql/locks': (o, W, H) => {
    const n = 5, s = Math.min(W * 0.11, H * 0.15), x0 = W / 2 - (n * s) / 2, y0 = H / 2 - (n * s) / 2;
    const ok = [[1, 1, 1, 1, 0], [1, 1, 0, 0, 0], [1, 0, 1, 0, 0], [1, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = x0 + c * s + 3, y = y0 + r * s + 3, z = s - 6;
      if (r === 1 && c === 2) fill(o, x, y, z, z, 'gold', 0.95); else if (ok[r][c]) fill(o, x, y, z, z, 'ink', 0.55); else outline(o, x, y, z, z, 'faint', 0.55);
    }
  },
  /* 튜플 버전 사슬 : 옛 버전 둘은 흐리고 지금 버전은 진하다 — t_ctid 로 잇는다 */
  'postgres/mvcc': (o, W, H) => {
    const bw = W * 0.2, bh = H * 0.3, y = H * 0.36;
    [0.1, 0.4, 0.7].forEach((fx, i) => {
      const x = W * fx; outline(o, x, y, bw, bh, i < 2 ? 'faint' : 'ink', i < 2 ? 0.5 : 0.9);
      fill(o, x + 6, y + 6, bw * 0.35, 6, i === 2 ? 'gold' : 'faint', i === 2 ? 0.95 : 0.5);
      if (i < 2) line(o, x + bw + 4, y + bh / 2, W * [0.4, 0.7][i] - 4, y + bh / 2, 'faint', 0.7);
    });
  },
  /* heap page : 앞의 line pointer 줄, 끝에서 앞으로 쌓인 튜플, 가운데 빈자리 */
  'postgres/heap': (o, W, H) => {
    const x = W * 0.12, y = H * 0.14, w = W * 0.76, h = H * 0.72;
    outline(o, x, y, w, h, 'ink', 0.8);
    fill(o, x + 4, y + 4, w * 0.12, 6, 'faint', 0.7);
    for (let i = 0; i < 6; i++) fill(o, x + w * 0.14 + i * 14, y + 4, 8, 6, i === 3 ? 'gold' : 'ink', i === 3 ? 0.95 : 0.6);
    fill(o, x + w * 0.42, y + h * 0.56, w * 0.54, h * 0.38, 'ink', 0.55);
    fill(o, x + w * 0.42, y + h * 0.56, w * 0.14, h * 0.38, 'gold', 0.9);
  },
  /* clock sweep : 버퍼 고리, usage 가 짙고 옅고, 시계 바늘이 금색 */
  'postgres/buffer': (o, W, H) => {
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.32;
    const us = [5, 3, 0, 1, 4, 2, 0, 5, 1, 0, 3, 2, 0, 4, 1, 0, 2, 5, 0, 1, 3, 0, 2, 1];
    us.forEach((u, k) => { const t = (k / us.length) * Math.PI * 2 - Math.PI / 2; const x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r; fill(o, x - 3, y - 3, 6, 6, 'ink', 0.2 + u * 0.15, 3); });
    line(o, cx, cy, cx + Math.cos(-Math.PI / 2 + 1.1) * r * 0.82, cy + Math.sin(-Math.PI / 2 + 1.1) * r * 0.82, 'gold', 0.95, 3);
  },
  /* nbtree : root 와 leaf 셋, 오른쪽으로 잇는 right-link */
  'postgres/btree': (o, W, H) => {
    const rw = W * 0.26, rx = W / 2 - rw / 2, ry = H * 0.14;
    outline(o, rx, ry, rw, 18, 'ink', 0.85);
    const lw = W * 0.24, ly = H * 0.6;
    [0.08, 0.38, 0.68].forEach((fx, i) => {
      const lx = W * fx; outline(o, lx, ly, lw, 22, 'ink', 0.75);
      fill(o, lx + 4, ly + 4, (lw - 8) * [0.9, 0.9, 0.1][i], 14, i === 2 ? 'gold' : 'ink', i === 2 ? 0.95 : 0.5);
      line(o, rx + rw * (0.2 + i * 0.3), ry + 20, lx + lw / 2, ly - 3, i === 2 ? 'gold' : 'faint', 0.75);
      if (i < 2) line(o, lx + lw + 3, ly + 11, W * [0.38, 0.68][i] - 3, ly + 11, 'faint', 0.6, P);
    });
  },
  /* 대기 줄 : 잡은 쪽 하나, 기다리는 줄, AccessExclusive 요청이 금색 */
  'postgres/locks': (o, W, H) => {
    const y = H * 0.4, s = H * 0.24;
    fill(o, W * 0.1, y, s, s, 'ink', 0.7);
    line(o, W * 0.1 + s + 6, y + s / 2, W * 0.88, y + s / 2, 'faint', 0.5, P);
    [0.36, 0.52, 0.68].forEach((fx, i) => outline(o, W * fx, y, s * 0.8, s, i === 0 ? 'gold' : 'faint', i === 0 ? 0.95 : 0.6));
  },
  /* WAL 자 : segment 경계, 레코드 구간, 첫 변경의 FPI 가 긴 금색 */
  'postgres/wal': (o, W, H) => {
    const x0 = W * 0.08, x1 = W * 0.92, y = H * 0.56;
    line(o, x0, y, x1, y, 'ink', 0.6, 3);
    for (let i = 0; i <= 4; i++) line(o, x0 + ((x1 - x0) * i) / 4, y - 14, x0 + ((x1 - x0) * i) / 4, y + 8, 'faint', 0.7, 3);
    let x = x0 + 4;
    [[0.05, 'ink'], [0.22, 'gold'], [0.04, 'ink'], [0.06, 'ink'], [0.03, 'ink'], [0.08, 'ink'], [0.04, 'ink']].forEach(([f, c]) => {
      const w = (x1 - x0) * f; fill(o, x, y - 10, w - 4, 6, c, c === 'gold' ? 0.95 : 0.55, 3); x += w;
    });
  },
  /* update chain : page 위 키 하나에 매달린 버전들, 가장 새것이 금색 */
  'mongodb/wiredtiger': (o, W, H) => {
    const x = W * 0.18, w = W * 0.64, y = H * 0.7;
    outline(o, x, y, w, 20, 'ink', 0.75);
    const kx = x + w * 0.45;
    [0.48, 0.3, 0.12].forEach((fy, i) => { outline(o, kx - 12, H * fy, 24, 14, i === 2 ? 'gold' : 'faint', i === 2 ? 0.95 : 0.6, 3); });
    line(o, kx, H * 0.12 + 16, kx, y - 3, 'faint', 0.6, 3);
  },
  /* 6 copy quorum : AZ 셋에 copy 둘씩, 하나는 고장(빈칸), 4/6 막대 */
  'aurora/mysql': (o, W, H) => {
    const aw = W * 0.24, ah = H * 0.4, y = H * 0.18;
    [0.08, 0.38, 0.68].forEach((fx, i) => {
      const x = W * fx; outline(o, x, y, aw, ah, 'faint', 0.5);
      [0, 1].forEach((j) => { const bx = x + 8 + j * (aw / 2), dead = i === 2 && j === 1; if (dead) outline(o, bx, y + 12, aw / 2 - 16, ah - 24, 'red', 0.7, 3); else fill(o, bx, y + 12, aw / 2 - 16, ah - 24, 'ink', 0.55, 3); });
    });
    fill(o, W * 0.08, H * 0.74, W * 0.84 * (4 / 6), 6, 'gold', 0.9, 3);
    outline(o, W * 0.08, H * 0.72, W * 0.84, 10, 'faint', 0.5, 3);
  },
  /* fan-out : 넓게 퍼진 B-Tree 한 층 */
  'book/ch2': (o, W, H) => {
    const rx = W / 2 - 18, ry = H * 0.16; fill(o, rx, ry, 36, 10, 'ink', 0.7, 3);
    for (let i = 0; i < 9; i++) { const x = W * 0.06 + (i * W * 0.88) / 8; line(o, W / 2, ry + 14, x, H * 0.64, i === 6 ? 'gold' : 'faint', i === 6 ? 0.85 : 0.45, P * 1.6); outline(o, x - 10, H * 0.66, 20, 14, i === 6 ? 'gold' : 'ink', i === 6 ? 0.95 : 0.55, 3); }
  },
  /* 바이트 띠 : 칸 줄, 한 필드(4 B)가 금색, 끝에 slot 디렉터리 */
  'book/ch3': (o, W, H) => {
    const n = 16, x0 = W * 0.08, cw = (W * 0.84) / n, y = H * 0.36;
    for (let i = 0; i < n; i++) { const g = i >= 4 && i < 8; if (g) fill(o, x0 + i * cw + 2, y, cw - 6, 22, 'gold', 0.9, 3); else outline(o, x0 + i * cw + 2, y, cw - 6, 22, 'ink', 0.55, 3); }
    for (let i = 0; i < 5; i++) fill(o, x0 + W * 0.84 - (i + 1) * cw, H * 0.72, cw - 6, 8, 'faint', 0.65, 3);
  },
};

function drawDots(cv, dots, pal, alphaOf = () => 1) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  for (let i = 0; i < dots.length; i++) {
    const [x, y, c, a] = dots[i], k = alphaOf(i);
    if (k <= 0) continue;
    g.globalAlpha = a * k; g.fillStyle = pal[c] || pal.ink; g.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
  }
  g.globalAlpha = 1;
}

function Sigil({ id, theme }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const draw = () => { const r = cv.getBoundingClientRect(); const o = []; SIGILS[id](o, r.width, r.height); drawDots(cv, o, palette()); };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(cv);
    return () => ro.disconnect();
  }, [id, theme]);
  return <canvas ref={ref} className="hub-sig" aria-hidden="true" />;
}

/* ── 첫 화면 그림 : B-tree 의 오른쪽 끝 leaf 가 나뉜다(postgres/btree 01 에서 잰 값) ──
   1 단계 0 – 1.1 s : 먼지에서 root 와 leaf 둘이 모인다. 왼쪽 leaf 는 앞선 split 으로 90%, 오른쪽은 407 / 407.
   2 단계 1.5 – 2.5 s : 오른쪽 leaf 가 367 : 42 로 나뉘고 새 leaf 와 root 의 세 번째 downlink 가 금색으로 선다 */
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function heroScene(W, H) {
  const pts = [];   /* [ax, ay, bx, by, c, a, born] — born 이면 2 단계에 나타난다 */
  const add = (arr, born, map = (x, y) => [x, y]) => { for (const [x, y, c, a] of arr) { const [bx, by] = map(x, y); pts.push([x, y, bx, by, c, a, born]); } };
  const lh = Math.max(56, H * 0.17), ly = H * 0.6, rh = 30, ry = H * 0.18, pad = 8;
  /* 1 단계의 자리 : leaf 둘 / 2 단계 : leaf 셋 — 같은 page 가 옆으로 비킨다 */
  const lw1 = W * 0.4, lw2 = W * 0.29, gap1 = W * 0.06, gap2 = W * 0.035;
  const A = [W / 2 - lw1 - gap1 / 2, W / 2 + gap1 / 2], B = [(W - 3 * lw2 - 2 * gap2) / 2, 0, 0];
  B[1] = B[0] + lw2 + gap2; B[2] = B[1] + lw2 + gap2;
  const rw = W * 0.42, rx = W / 2 - rw / 2;
  /* root — 항목 칸 셋 중 둘이 차 있고, 셋째(금색)가 2 단계에 찬다 */
  let o = []; outline(o, rx, ry, rw, rh, 'ink', 0.9); add(o, false);
  const kw = (rw - 4 * pad) / 3;
  for (let k = 0; k < 3; k++) { o = []; fill(o, rx + pad + k * (kw + pad), ry + pad, kw, rh - 2 * pad, k === 2 ? 'gold' : 'ink', k === 2 ? 0.95 : 0.6); add(o, k === 2); }
  /* leaf 테두리 */
  const box = (x, w, c = 'ink', a = 0.85) => { const q = []; outline(q, x, ly, w, lh, c, a); return q; };
  const scaleX = (x0, w0, x1, w1) => (x, y) => [x1 + ((x - x0) / w0) * w1, y];
  add(box(A[0], lw1), false, scaleX(A[0], lw1, B[0], lw2));
  add(box(A[1], lw1), false, scaleX(A[1], lw1, B[1], lw2));
  o = box(B[2], lw2, 'gold', 0.95); for (const [x, y, c, a] of o) pts.push([x - lw2 * 0.6, y, x, y, c, a, true]);
  /* 채움 — 왼쪽 leaf 90% · 오른쪽 leaf 가득. 오른쪽 것의 앞 90% 는 제 page 에, 끝 10% 는 새 page 로 */
  const inner = (x, w, f) => { const q = []; fill(q, x + pad, ly + pad, (w - 2 * pad) * f, lh - 2 * pad, 'ink', 0.6); return q; };
  add(inner(A[0], lw1, 0.9), false, scaleX(A[0] + pad, lw1 - 2 * pad, B[0] + pad, lw2 - 2 * pad));
  for (const [x, y, c, a] of inner(A[1], lw1, 1)) {
    const u = (x - A[1] - pad) / (lw1 - 2 * pad);
    const bx = u < 0.9 ? B[1] + pad + u * (lw2 - 2 * pad) : B[2] + pad + ((u - 0.9) / 0.1) * 0.1 * (lw2 - 2 * pad);
    /* 새 page 로 갈 끝 10% 는 처음에는 먹색 — 나뉘기 전부터 금색이면 결과를 먼저 보여 준다 */
    pts.push([x, y, bx, y, u < 0.9 ? c : 'ink>gold', a, false]);
  }
  /* downlink — root 칸에서 leaf 위로. 셋째는 2 단계에 금색으로 */
  const keyX = (k) => rx + pad + k * (kw + pad) + kw / 2;
  for (let k = 0; k < 3; k++) {
    const ax = k < 2 ? A[k] + lw1 / 2 : B[2] + lw2 / 2, bx = B[k] + lw2 / 2;
    o = []; line(o, keyX(k), ry + rh + 4, k < 2 ? ax : bx, ly - 6, k === 2 ? 'gold' : 'faint', k === 2 ? 0.9 : 0.7);
    if (k < 2) add(o, false, (x, y) => [x + ((bx - ax) * (y - ry - rh - 4)) / (ly - 6 - ry - rh - 4), y]);
    else add(o, true);
  }
  /* right-link — leaf 사이 */
  o = []; line(o, A[0] + lw1 + 4, ly + lh / 2, A[1] - 4, ly + lh / 2, 'faint', 0.7, P * 1.2);
  add(o, false, scaleX(A[0] + lw1 + 4, A[1] - A[0] - lw1 - 8, B[0] + lw2 + 4, gap2 - 8));
  o = []; line(o, B[1] + lw2 + 4, ly + lh / 2, B[2] - 4, ly + lh / 2, 'gold', 0.85, P * 1.2); add(o, true);
  /* 이름표 자리(1 단계 · 2 단계, 그림 상자 안의 비율) */
  const lab = {
    root: [W / 2, ry - 10], full: [A[1] + lw1 / 2, ly + lh + 18], first: [A[0] + lw1 / 2, ly + lh + 18], first2: [B[0] + lw2 / 2, ly + lh + 18],
    left: [B[1] + lw2 / 2, ly + lh + 18], right: [B[2] + lw2 / 2, ly + lh + 18],
  };
  return { pts, lab };
}

function Hero({ theme }) {
  const ref = useRef(null), [lab, setLab] = useState(null), [phase, setPhase] = useState(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    let raf = 0, t0 = 0, scene = null, seeds = null, done = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const build = () => {
      const r = cv.getBoundingClientRect(); scene = heroScene(r.width, r.height);
      setLab(Object.fromEntries(Object.entries(scene.lab).map(([k, [x, y]]) => [k, [(x / r.width) * 100, (y / r.height) * 100]])));
      /* 출발점(먼지) — 자리마다 같은 씨앗이라 다시 짜도 같은 그림 */
      let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      seeds = scene.pts.map(() => [rnd() * r.width, rnd() * r.height, rnd() * 0.35, rnd() * 0.3]);
    };
    const frame = (now) => {
      if (!t0) t0 = now;
      const t = reduce || done ? 99 : (now - t0) / 1000, pal = palette();
      const P1 = (i) => ease((t - seeds[i][2]) / 1.1), P2 = (i) => ease((t - 1.5 - seeds[i][3]) / 1.0);
      const dots = scene.pts.map(([ax, ay, bx, by, c, a, born], i) => {
        const p1 = P1(i), p2 = P2(i);
        if (born) return [ax + (bx - ax) * p2, ay + (by - ay) * p2, c, a * p2];
        const x1 = seeds[i][0] + (ax - seeds[i][0]) * p1, y1 = seeds[i][1] + (ay - seeds[i][1]) * p1;
        const cc = c === 'ink>gold' ? (p2 > 0.5 ? 'gold' : 'ink') : c;
        return [x1 + (bx - ax) * p2, y1 + (by - ay) * p2, cc, a * (0.15 + 0.85 * p1)];
      });
      drawDots(cv, dots, pal);
      const ph = t < 1.2 ? 0 : t < 2.6 ? 1 : 2;
      setPhase((q) => (q === ph ? q : ph));
      if (t < 3.2) raf = requestAnimationFrame(frame); else done = true;
    };
    build(); raf = requestAnimationFrame(frame);
    /* 크기가 정말 바뀔 때만 다시 짠다 — ResizeObserver 는 붙는 순간에도 한 번 불러서, 그것을 '바뀜' 으로 받았더니
       첫 그림이 움직이지 않고 끝 모습으로 바로 섰다 */
    let size = cv.getBoundingClientRect(), sw = size.width, sh = size.height;
    const ro = new ResizeObserver(() => {
      const r = cv.getBoundingClientRect();
      if (Math.abs(r.width - sw) < 1 && Math.abs(r.height - sh) < 1) return;
      sw = r.width; sh = r.height; build(); done = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    });
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [theme]);
  const at = (k) => (lab ? { left: lab[k][0] + '%', top: lab[k][1] + '%' } : { display: 'none' });
  return (
    <figure className="hub-fig">
      <div className="hub-fig-box">
        <canvas ref={ref} aria-hidden="true" />
        <span className={'hub-lb' + (phase >= 1 ? ' on' : '')} style={at('root')}>root · 항목 {phase >= 2 ? <b>3</b> : '2'}</span>
        {/* 왼쪽 leaf 는 앞선 split 의 왼쪽 — 같은 90% 규칙이라 367 */}
        <span className={'hub-lb' + (phase === 1 ? ' on' : '')} style={at('first')}>367</span>
        <span className={'hub-lb' + (phase >= 2 ? ' on' : '')} style={at('first2')}>367</span>
        <span className={'hub-lb' + (phase === 1 ? ' on' : '')} style={at('full')}>407 / 407 — 가득</span>
        <span className={'hub-lb' + (phase >= 2 ? ' on' : '')} style={at('left')}>367</span>
        <span className={'hub-lb gold' + (phase >= 2 ? ' on' : '')} style={at('right')}>42</span>
      </div>
      <figcaption>
        PostgreSQL 18.6 에 int4 키를 차례로 넣었다. leaf 한 장이 407 개로 차고, 408 번째에서 367 : 42 로 갈라지며
        root 에 downlink 가 하나 는다. <a href="#postgres/btree/01/1">B-tree 01 에서 보기</a>
      </figcaption>
    </figure>
  );
}

export default function Hub() {
  useFonts();
  const [dark, setDark] = useState(isDark);
  const toggleTheme = useCallback(() => {
    const mode = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('theme', mode); } catch { /* 저장 못 해도 이번 화면은 바뀐다 */ }
    setDark(mode === 'dark');
  }, []);
  const theme = dark ? 'dark' : 'light';
  const total = DECKS.reduce((a, [id]) => a + scenesOf(id), 0);

  return (
    <div className="st hub">
      <header className="hub-top">
        <span className="st-brand">db-internals</span>
        <span className="hub-tools">
          <a className="st-btn" href="?lab">Lab</a>
          <button type="button" className="st-btn" onClick={toggleTheme} aria-label="테마 바꾸기">{dark ? '밝게' : '어둡게'}</button>
        </span>
      </header>

      <main>
        <section className="hub-hero">
          <div className="hub-intro">
            <h1>엔진 속을,<br />추측 없이.</h1>
            <p>
              InnoDB · PostgreSQL · WiredTiger 를 소스에서 직접 빌드해 띄우고, 스텝마다 page 와 로그에 무엇이 남는지 쟀다.
              재지 못한 수는 '규칙으로 계산' 이라고 밝혔고, 설명마다 근거가 붙어 있다 — 소스의 줄, 논문, 책의 문장.
              재 보니 흔한 설명과 다르게 움직이는 곳도 여럿이었다.
            </p>
            <a className="hub-go" href="#mysql/innodb/01/1">UPDATE 한 줄 따라가기</a>
            {/* 장면 안의 잰 값 그대로 — mysql/innodb 01 · postgres/wal 05 · mongodb/wiredtiger 10(1,496 / 551 = 2.7) */}
            <dl className="hub-meas">
              <div><dt>+813 B</dt><dd>UPDATE 한 줄이 남긴 redo<small>InnoDB 8.4.8</small></dd></div>
              <div><dt>71 B</dt><dd>HOT update 한 번의 WAL 레코드<small>PostgreSQL 18.6</small></dd></div>
              <div><dt>2.7 배</dt><dd>_id 를 UUID 로 바꾸면 늘어나는 잎 — 1,496&nbsp;대&nbsp;551<small>WiredTiger 11.3</small></dd></div>
            </dl>
          </div>
          <Hero theme={theme} />
        </section>

        <section className="hub-cat" aria-labelledby="hub-cat-h">
          <h2 id="hub-cat-h">어디서부터 볼까 <span>{DECKS.length} 덱 · {total} 장면</span></h2>
          <ul className="hub-grid">
            {DECKS.map(([id, eng, nm, d]) => (
              <li key={id}>
                <a href={'#' + id + '/' + STORY[id].first + '/1'}>
                  <Sigil id={id} theme={theme} />
                  <small>{eng}</small>
                  <b>{nm}</b>
                  <span>{d.blurb}</span>
                  <i>{scenesOf(id)} 장면</i>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="hub-foot">
        소스 발췌 MySQL 8.4.8 Community (GPLv2) · PostgreSQL 18.6 (PostgreSQL License) · WiredTiger 11.3 (GPLv2/v3) ·
        인용 AWS Aurora 문서 · Verbitski et al., SIGMOD 2017 · Database Internals — Alex Petrov (O’Reilly)
      </footer>
    </div>
  );
}
