/* 레이아웃 전수 스윕 — 덱 × 장면 × 스텝 × 폭 (+ 비교 모드).
 *
 * 앞선 프로젝트에서 이 측정 코드를 열 번 틀렸다. 틀린 것들과 그 교훈 :
 *
 *  1. 선택자가 틀려 0 스텝을 돌고 "문제 0" 을 보고했다.
 *     → 방문 수를 항상 함께 출력한다. 0 방문과 성공은 구별돼야 한다.
 *       거기에 렌더된 스텝 번호(.play .track[aria-valuenow])를 요청값과 대조해
 *       "확인" 수를 따로 센다. 확인 < 방문이면 통과가 아니다.
 *       (이번에도 걸렸다 : 다른 에이전트가 .bar 를 Playback 으로 바꿔서
 *        .bar button 을 세던 코드가 0 을 반환했다.)
 *  2. 퇴장 애니메이션이 opacity:0 으로 끝나는데 그것을 넘침으로 셌다 — 오탐 102건.
 *     → 가시성은 offsetParent !== null 과 조상 사슬의
 *       visibility:hidden / display:none / opacity<.05 를 함께 본다.
 *  3. scrollWidth/scrollHeight 로 넘침을 재려 했다 — 정수로 반올림되고
 *     넘치는 쪽(왼/오)을 구별하지 못한다.
 *     → 보이는 자손의 getBoundingClientRect() 를 컨테이너 *내용 상자* 와 비교한다.
 *  4. 오른쪽만 봤다 — 실제 문제 6건이 왼쪽으로 나가 있어서 안 잡혔다.
 *     → 좌·우 양쪽을 본다(세로도 함께).
 *  5. 일부러 스크롤되는 곳(탭 띠·코드 영역)을 넘침으로 셌다 — 오탐 650 + 400건.
 *     → 자손과 컨테이너 사이에 overflow-x/y:auto|scroll 이 있으면 건너뛴다.
 *       선택자 목록으로 관리하지 않는다 — 계산된 스타일로 판정한다.
 *       (목록으로 두면 다른 에이전트가 새 스크롤 상자를 만들 때마다 오탐이 돌아온다.)
 *  6. 여러 줄로 흐른 글자를 잘렸다고 셌다.
 *     → flex 아이템은 몇 줄을 흘러도 getClientRects() 가 한 개만 준다.
 *       내용에 Range 를 걸어 줄 조각 rect 를 얻고, *칸* 의 내용 상자와 비교한다.
 *  7. 라벨끼리 겹친 것은 컨테이너를 넘지 않으므로 넘침 검사로 영원히 안 잡힌다.
 *     → 형제 라벨 rect 를 쌍으로 비교해 두 축이 모두 겹치면 실패.
 *  8. zoom 상태에서 좌표계를 섞었다. getBoundingClientRect() 는 zoom 이 곱해진 값,
 *     getComputedStyle 의 padding/border 는 곱해지지 않은 CSS px 이다.
 *     → currentCSSZoom 으로 환산한다. 안 섞으면 zoom 2.5 에서 6px 씩 틀린다.
 *  9. 애니메이션 도중에 재면 transform 이 rect 에 섞인다. rect 를 정수로 반올림한
 *     서명은 스프링의 마지막 scale 0.9995 를 놓쳐서 1.5px 넘침으로 보고했다.
 *     → 0.1px 단위 서명 + transform 문자열 + getAnimations() 가 멎을 때까지 기다린다.
 * 10. 일부러 스크롤되는 상자의 *가로* 넘침은 스크롤바나 hidden 에 숨는다 — 650건.
 *     → overflow-x 가 hidden|clip 인데 scrollWidth 가 넘치면 따로 보고한다
 *       (auto|scroll 이면 의도된 가로 스크롤이므로 넘긴다).
 *
 * 15. 조상이 스크롤하는 축의 넘침을 결함으로 셌다. `.stage{flex:0 1 auto;min-height:0}` 이
 *     줄고 `.stage-wrap{overflow-y:auto}` 가 받는 구조이므로 세로 넘침은 정상 동작이다
 *     — 뷰포트에 높이를 가두는 폭에서 오탐이 쏟아졌다(1366×768 3,527건 · 1100×825 1,575건).
 *     → 자신이 자르지 않고 조상이 그 축으로 스크롤하면 그 축을 넘긴다.
 * 14. 최적화로 조상 사슬을 메모하면서 offsetParent 검사를 사슬에 섞었다 — <html> 은
 *     offsetParent 가 null 이라 모든 요소가 "안 보임" 이 됐고, 상자·요소·칸·줄조각·라벨쌍이
 *     전부 0 인 채로 "문제 0" 이 나왔다. 다섯 개 수를 찍어 두었기에 즉시 잡혔다(교훈 1).
 * 13. 해시 이동은 같은 문서 안의 이동이라 page.goto 로도 문서가 새로 실리지 않는다.
 *     앞 덱의 탭·스텝 수를 그대로 읽어 계획이 실행마다 달라졌다(장면 46/50 · 스텝 307/305).
 *     → 덱·장면·스텝이 *바뀐 것을 확인하고* 읽는다. 이것이 교훈 1 과 같은 종류다.
 * 12. 축·그래프·트리를 다른 상자처럼 쟀다 — 이 종류는 라벨이 삐져나올 자리를
 *     스스로 margin 으로 남긴다. 진짜 경계는 카드(.act)다. 상자 목록에서 뺀다.
 * 11. 기준 상자를 하나로 봤다 — 흐름 자손은 내용 상자, 절대 위치 자손은 패딩 상자다.
 *     라벨이 삐져나올 자리를 패딩으로 마련한 축·그래프·트리에서 오탐이 쏟아졌다.
 *     그리고 text-overflow:ellipsis 로 일부러 자르는 것을 잘림으로 셌다.
 *
 * 그리고 비교 모드(V) 를 함께 돈다 — 옛 판에서 접힌 배우 24개가 전부 빈 띠였던
 * 문제가 이 모드에만 있었고, 그때까지 한 번도 스윕된 적이 없었다.
 *
 * 실행 : node tools/sweep.js
 *        [--widths=768,1512] [--decks=innodb] [--every=1] [--split=0]
 *        [--base=http://localhost:5180] [--json=out.json] [--break=NAME]
 *
 * --break 는 검사가 정말 발동하는지 확인하는 용도다 (발동하지 않는 검사는 무가치하다) :
 *   overflow · text-clip · label-overlap · zoom · narrow
 */
/* playwright 는 이 프로젝트에 설치하지 않는다(브라우저까지 수백 MB). 경로를
   PLAYWRIGHT_PATH 로 받고, 없으면 평소대로 'playwright' 를 찾는다.
   정적 import 는 변수를 못 쓰므로 동적 import 다(ESM 최상위 await). */
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')
  .catch(() => { console.error('playwright 를 찾을 수 없다. PLAYWRIGHT_PATH 로 경로를 주거나 npm i -D playwright 하라.'); process.exit(2); });
import { writeFileSync } from 'node:fs';

const ARG = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? '1' : m[2]] : [a, '1'];
  }),
);

const BASE = ARG.base || 'http://localhost:5180';

/* 폭 : 미디어 쿼리 경계 양쪽을 낀다 — 1080/1100 · 1559/1561 · zoom 분기 2000/2560/3400/4600 */
const WIDTHS = ARG.widths
  ? ARG.widths.split(',').map(Number)
  : [768, 834, 1024, 1080, 1100, 1366, 1512, 1559, 1561, 1728, 2000, 2560, 3440, 5120];

/* 높이는 그 폭의 실제 장치를 따른다 — 100vh 를 쓰므로 높이가 결과를 바꾼다 */
const HEIGHT = {
  390: 844, 767: 1024, 768: 1024, 834: 1112, 1024: 768, 1080: 810, 1100: 825, 1366: 768,
  1512: 982, 1559: 900, 1561: 900, 1728: 1117, 2000: 1125, 2560: 1080, 3440: 1440, 5120: 2160,
};
const hOf = (w) => HEIGHT[w] || Math.round(w * 0.58);

const DECKS = ARG.decks ? ARG.decks.split(',') : ['mysql/innodb', 'mysql/locks', 'book/ch2', 'book/ch3'];
const EVERY = Math.max(1, parseInt(ARG.every || '1', 10)); /* 1 = 모든 스텝 */
const DO_SPLIT = ARG.split !== '0';
const BREAK = ARG.break || '';
/* App.jsx 에 .narrow-note 요소가 아직 없다 — 767 아래 안내 CSS(기본 규칙을 @media 앞에
   두는 것)가 정말 동작하는지 확인하려면 요소가 있어야 한다. 확인용으로만 끼워 넣는다. */
const INJECT_NOTE = ARG['inject-note'] === '1';

/* zoom 분기 : 배율은 코드 줄높이 16px 을 정수로 유지하는 값만 쓴다.
   1.3 → 20.8 · 2.6 → 41.6 은 브라우저가 스크롤을 장치 픽셀로 양자화할 때 깨진다. */
const ZOOM = [[4600, 2.5], [3400, 2], [2560, 1.5], [2000, 1.25]];
const zoomFor = (w) => (ZOOM.find(([min]) => w >= min) || [0, 1])[1];

/* ─────────────────────────── 브라우저 안에서 도는 측정기 ─────────────────────────── */

const MEASURE = (CFG) => {
  const TOL = 0.75;
  const out = { problems: [], counts: { el: 0, cells: 0, labelPairs: 0, ranges: 0, containers: 0, clipBoxes: 0 } };
  const add = (check, detail) => out.problems.push({ check, ...detail });

  /* 한 번의 측정 동안 레이아웃은 바뀌지 않는다 — 계산된 스타일과 rect 를 기억한다.
     상자 목록이 서로를 포함하므로(.app 이 전부를 담는다) 같은 요소를 여섯 번 넘게 본다.
     기억하지 않으면 폭 하나에 4분이 걸려 14폭 전수가 세 시간이 된다. */
  const CS = new Map(), RC = new Map(), VS = new Map();
  const cs = (el) => { let v = CS.get(el); if (v === undefined) { v = getComputedStyle(el); CS.set(el, v); } return v; };
  const rc = (el) => { let v = RC.get(el); if (v === undefined) { v = el.getBoundingClientRect(); RC.set(el, v); } return v; };

  const zoomOf = (el) => {
    if (typeof el.currentCSSZoom === 'number' && el.currentCSSZoom > 0) return el.currentCSSZoom;
    const w = rc(el).width, o = el.offsetWidth;
    return o > 0 ? w / o : 1;                       /* 예비 : rect / offsetWidth */
  };

  /* 교훈 2 — 퇴장 애니메이션(opacity:0)을 넘침으로 세지 않는다 */
  const selfVis = (el) => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    return parseFloat(s.opacity) >= 0.05;
  };
  /* 조상 사슬(display/visibility/opacity)만 부모의 결과를 물려받는다 — 사슬을 매번 걷지 않는다.
     교훈 14 : offsetParent 검사를 이 사슬에 섞으면 안 된다. <html> 은 offsetParent 가
     null 이므로 물려받는 순간 모든 요소가 "안 보임" 이 되고, 상자·요소·칸·줄조각·라벨쌍이
     전부 0 인 채로 "문제 0" 이 나온다. 방문 수와 함께 이 다섯 개를 찍어 두었기 때문에
     최적화를 넣은 즉시 잡혔다 — 교훈 1 이 여기서 값을 했다. */
  const chainVis = (el) => {
    let v = VS.get(el);
    if (v !== undefined) return v;
    v = selfVis(el);
    if (v) { const par = el.parentElement; if (par && par.nodeType === 1) v = chainVis(par); }
    VS.set(el, v);
    return v;
  };
  const visible = (el) => {
    if (el.offsetParent === null && cs(el).position !== 'fixed' && el !== document.body) return false;
    if (!chainVis(el)) return false;
    const r = rc(el);
    return r.width >= 0.5 && r.height >= 0.5;
  };

  /* 교훈 5 — 선택자 목록이 아니라 계산된 스타일로 판정한다 */
  const SCR = /^(auto|scroll)$/;
  const CLIP = /^(auto|scroll|hidden|clip)$/;
  const scrollsX = (el) => SCR.test(cs(el).overflowX);
  const scrollsY = (el) => SCR.test(cs(el).overflowY);
  const scrolls = (el) => scrollsX(el) || scrollsY(el);
  const clipsX = (el) => CLIP.test(cs(el).overflowX);
  const clipsY = (el) => CLIP.test(cs(el).overflowY);
  /* 교훈 15 : 자신은 자르지 않고 조상이 그 축으로 스크롤하면, 상자를 넘친 내용은
     스크롤로 닿을 수 있으므로 결함이 아니다. 이것을 빼먹어서 뷰포트에 높이를 가두는
     폭에서 오탐이 쏟아졌다 — 1366×768 에서 3,527건, 1100×825 에서 1,575건.
     (`.stage{flex:0 1 auto;min-height:0}` 이 줄어들고 `.stage-wrap{overflow-y:auto}` 가
      받는 구조라 세로 넘침은 정상 동작이다. 실제로 .stage-wrap 의 scrollHeight 는
      내용을 전부 덮는다 — 2560 실측 : .stage sh 360/ch 341, .stage-wrap sh 360/ch 353.) */
  const absorbed = (el, axis) => {
    if (axis === 'x' ? clipsX(el) : clipsY(el)) return false;   /* 자신이 자르면 결함이다 */
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      if (axis === 'x' ? scrollsX(n) : scrollsY(n)) return true;
      if (axis === 'x' ? clipsX(n) : clipsY(n)) return false;   /* 먼저 자르는 조상을 만나면 끝 */
    }
    return false;
  };

  /* 교훈 8 — rect 는 zoom 이 곱해진 값, padding/border 는 안 곱해진 CSS px. 섞지 않는다.
     교훈 11 — 기준 상자가 둘이다. 흐름 안의 자손은 *내용 상자* 에 배치되지만
     절대 위치 자손의 담는 상자는 *패딩 상자* 이고, overflow 도 패딩 경계에서 자른다.
     내용 상자로만 재면 라벨이 삐져나올 자리를 패딩으로 마련한 축·그래프·트리에서
     오탐이 쏟아진다 (`.ax{padding:20px 12px 26px}` 에서 한 스텝에 11건). */
  const boxOf = (el, pad) => {
    const r = rc(el), s = cs(el), z = zoomOf(el);
    const n = (v) => (parseFloat(v) || 0) * z;
    const p = pad ? 0 : 1;
    return {
      l: r.left + n(s.borderLeftWidth) + p * n(s.paddingLeft),
      r: r.right - n(s.borderRightWidth) - p * n(s.paddingRight),
      t: r.top + n(s.borderTopWidth) + p * n(s.paddingTop),
      b: r.bottom - n(s.borderBottomWidth) - p * n(s.paddingBottom),
    };
  };
  const contentBox = (el) => boxOf(el, false);
  const paddingBox = (el) => boxOf(el, true);
  const abs = (el) => /^(absolute|fixed)$/.test(cs(el).position);

  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34);
    return t ? s + ' “' + t + '”' : s;
  };

  /* ── 검사 1 : 컨테이너 넘침 ─────────────────────────────────────────────
     교훈 3·4·5 — scrollWidth 를 쓰지 않고, 좌·우·상·하 모두 보고,
     스크롤되는 축은 그 축을 넘기고, 자손과 컨테이너 사이에 스크롤 상자가 있으면 건너뛴다. */
  for (const sel of CFG.containers) {
    for (const c of document.querySelectorAll(sel)) {
      if (!visible(c)) continue;
      out.counts.containers++;
      /* 일부러 스크롤되는 축 · 조상 스크롤러가 흡수하는 축은 보지 않는다 */
      const okX = scrollsX(c) || absorbed(c, 'x');
      const okY = scrollsY(c) || absorbed(c, 'y');
      if (okX && okY) continue;
      const flowBox = contentBox(c), absBox = paddingBox(c);
      for (const d of c.querySelectorAll('*')) {
        let between = false, anyAbs = false;
        for (let n = d.parentElement; n && n !== c; n = n.parentElement) if (scrolls(n)) { between = true; break; }
        if (between || !visible(d)) continue;
        for (let n = d; n && n !== c; n = n.parentElement) if (abs(n)) { anyAbs = true; break; }
        const cb = anyAbs ? absBox : flowBox;
        out.counts.el++;
        const r = rc(d);
        if (!okX && r.left < cb.l - TOL) add('overflow', { side: 'left', by: +(cb.l - r.left).toFixed(1), box: sel, el: desc(d), clipped: clipsX(c) });
        if (!okX && r.right > cb.r + TOL) add('overflow', { side: 'right', by: +(r.right - cb.r).toFixed(1), box: sel, el: desc(d), clipped: clipsX(c) });
        if (!okY && r.top < cb.t - TOL) add('overflow', { side: 'top', by: +(cb.t - r.top).toFixed(1), box: sel, el: desc(d), clipped: clipsY(c) });
        if (!okY && r.bottom > cb.b + TOL) add('overflow', { side: 'bottom', by: +(r.bottom - cb.b).toFixed(1), box: sel, el: desc(d), clipped: clipsY(c) });
      }
    }
  }

  /* ── 검사 2 : 고정폭 칸 안의 글자 잘림 ──────────────────────────────────
     교훈 6 — 여러 줄로 흐른 것은 잘린 것이 아니다. flex 아이템의 rect 는
     몇 줄이든 하나뿐이므로 내용에 Range 를 걸어 *줄 조각* 을 얻고 칸과 비교한다. */
  for (const sel of CFG.cells) {
    for (const cell of document.querySelectorAll(sel)) {
      if (!visible(cell)) continue;
      out.counts.cells++;
      const cb = contentBox(cell);
      const ell = /ellipsis/.test(cs(cell).textOverflow);
      for (const el of [cell, ...cell.querySelectorAll('*')]) {
        if (!visible(el) || !el.firstChild) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
        if (ell || /ellipsis/.test(cs(el).textOverflow)) continue;   /* 의도된 생략 */
        const rg = document.createRange();
        rg.selectNodeContents(el);
        const frags = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
        out.counts.ranges += frags.length;
        for (const f of frags) {
          if (f.left < cb.l - TOL) add('text-clip', { side: 'left', by: +(cb.l - f.left).toFixed(1), cell: sel, el: desc(el) });
          else if (f.right > cb.r + TOL) add('text-clip', { side: 'right', by: +(f.right - cb.r).toFixed(1), cell: sel, el: desc(el) });
          else if (f.bottom > cb.b + TOL && clipsY(cell)) add('text-clip', { side: 'bottom', by: +(f.bottom - cb.b).toFixed(1), cell: sel, el: desc(el) });
          else if (f.top < cb.t - TOL && clipsY(cell)) add('text-clip', { side: 'top', by: +(cb.t - f.top).toFixed(1), cell: sel, el: desc(el) });
        }
      }
    }
  }

  /* ── 검사 3 : 라벨 겹침 ────────────────────────────────────────────────
     교훈 7 — 컨테이너를 넘지 않으므로 넘침 검사로는 영원히 안 잡힌다. */
  for (const sel of CFG.labelBoxes) {
    for (const box of document.querySelectorAll(sel)) {
      if (!visible(box)) continue;
      const kids = [...box.children].filter(visible);
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
        out.counts.labelPairs++;
        const a = rc(kids[i]), b = rc(kids[j]);
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 1 && oy > 1) add('label-overlap', { box: sel, by: +Math.min(ox, oy).toFixed(1), a: desc(kids[i]), b: desc(kids[j]) });
      }
    }
  }

  /* ── 검사 4 : 페이지 가로 스크롤 ──
     html{overflow:hidden} 이어도 scrollWidth 는 넘친 양을 그대로 알려준다. */
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) add('page-hscroll', { by: de.scrollWidth - de.clientWidth });

  /* ── 검사 5 : 잘려서 안 보이는 가로 넘침 (교훈 10) ──
     overflow-x 가 auto|scroll 이면 의도된 가로 스크롤이므로 넘긴다.
     hidden|clip 인데 scrollWidth 가 넘치면 눈에 안 보이는 잘림이다. */
  for (const el of document.querySelectorAll('*')) {
    const st = cs(el), ox = st.overflowX;
    if (!CLIP.test(ox) || SCR.test(ox)) continue;
    out.counts.clipBoxes++;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    if (!visible(el)) continue;
    if (/ellipsis/.test(st.textOverflow)) continue;        /* 의도된 생략 — 잘림이 보인다 */
    if (CFG.clipOk.some((s) => el.matches(s))) continue;   /* 일부러 줄여서 자르는 칸 */
    add('hidden-hclip', { by: el.scrollWidth - el.clientWidth, el: desc(el) });
  }

  /* ── 검사 6 : zoom 규약 (배율 · 높이 · 줄높이 정수성) ── */
  const app = document.querySelector('.app');
  if (app) {
    const z = zoomOf(app);
    if (Math.abs(z - CFG.zoom) > 0.001) add('zoom', { want: CFG.zoom, got: +z.toFixed(3) });
    if (Math.abs(16 * z - Math.round(16 * z)) > 1e-6) add('zoom-lineheight', { zoom: +z.toFixed(3), line: +(16 * z).toFixed(2) });
    const r = app.getBoundingClientRect();
    if (z > 1 && r.height > innerHeight + 1.5) add('zoom-height', { by: +(r.height - innerHeight).toFixed(1), note: 'height:calc(100vh / zoom) 이 안 걸렸다' });
  }

  /* ── 검사 7 : 좁은 폭 안내 ── */
  if (CFG.narrow) {
    const note = document.querySelector('.narrow-note');
    if (!note) add('narrow-note-missing', { note: '.narrow-note 요소가 DOM 에 없다 → App.jsx' });
    else if (!visible(note)) add('narrow-note-hidden', { note: '.narrow-note 가 안 보인다 — 기본 규칙이 @media 뒤에 있는지 확인' });
    for (const sel of ['.stage', '.stage-wrap', '.tabs', '.play']) {
      const e = document.querySelector(sel);
      if (e && visible(e)) add('narrow-shown', { el: sel, note: '767 아래에서 보인다' });
    }
  }

  /* ── 기록(문제가 아닌 측정값) : 남는 세로 높이 ── */
  const st = document.querySelector('.stage');
  const sw = document.querySelector('.stage-wrap');
  const cap = document.querySelector('.cap');
  const srcin = document.querySelector('.srcin');
  const appCb = app ? contentBox(app) : null;
  const inner = st ? [...st.children].filter(visible).reduce((a, e) => {
    const r = rc(e);
    return { t: Math.min(a.t, r.top), b: Math.max(a.b, r.bottom) };
  }, { t: 1e9, b: -1e9 }) : null;
  const trk = document.querySelector('.play .track');
  out.metrics = {
    stageH: st ? +st.getBoundingClientRect().height.toFixed(1) : 0,
    contentH: inner && inner.b > -1e9 ? +(inner.b - inner.t).toFixed(1) : 0,
    stageOver: sw ? Math.max(0, sw.scrollHeight - sw.clientHeight) : 0,
    emptyBelowCap: appCb && cap ? +(appCb.b - cap.getBoundingClientRect().bottom).toFixed(1) : 0,
    srcH: srcin && visible(srcin) ? +srcin.getBoundingClientRect().height.toFixed(1) : 0,
    acts: document.querySelectorAll('.act').length,
    lanes: document.querySelectorAll('.lane').length,
    now: trk ? +trk.getAttribute('aria-valuenow') : 0,
    split: !!document.querySelector('.stage-wrap.split'),
  };
  return out;
};

const CFG_BASE = {
  /* 검사할 상자 — 스크롤되는 축은 측정기가 계산된 스타일로 알아서 넘긴다.
     .play .track 은 넣지 않는다 : 손잡이(.knob)가 margin-left:-6.5px 로 일부러 걸쳐 있다. */
  containers: ['.app', '.wrap', '.mid', '.stage-wrap', '.scol', '.scol-hd', '.stage', '.lane', '.row',
    '.act', '.a-bd', '.by', '.by-c', '.mx', '.mx table', '.cap', '.cap-l', '.cap-r', '.list',
    '.kv-wrap', '.head', '.top', '.tabs', '.play', '.foot', '.rail', '.rl', '.srcin', '.srcin-hd',
    '.narrow-note'],
  /* 축·그래프·트리(.ax/.gr/.tr)는 컨테이너로 재지 않는다 — 라벨을 자르면 어느 구간인지
     알 수 없으므로 삐져나올 자리를 스스로 margin/padding 으로 남긴다(Axis.jsx 의 주석).
     실측 : 1512px 에서 .ax-sp 가 패딩 상자를 좌 11px · 우 13px 넘지만 .ax{margin:0 22px}
     안이고 .act 는 37px 여유가 있다. 진짜 경계는 카드이고 .act·.a-bd 로 이미 잰다.
     라벨끼리 겹치는지는 labelBoxes 로 따로 본다 (넘침 검사로는 영원히 안 잡히는 종류). */
  cells: ['.by-c', '.mx td', '.mx th', '.lane-lb', '.kv', '.it', '.a-hd', '.by-l', '.mx-lb',
    '.scol-hd', '.srcin-hd', '.foot span'],
  labelBoxes: ['.by-l', '.mx-lb', '.a-hd', '.kv', '.it', '.top', '.decks', '.stage-foot', '.cap',
    '.foot', '.srcin-hd', '.ax', '.ax-row', '.tr-lv', '.gr-row'],
  /* 컨테이너 질의로 줄여서 자르는 것이 설계인 칸 — 글자 잘림 검사가 따로 본다 */
  clipOk: ['.by-c'],
};

/* 애니메이션이 멎을 때까지 — 교훈 9 */
const SETTLE = () => new Promise((res) => {
  let last = '', same = 0, n = 0;
  /* rect 를 정수로 반올림한 서명은 스프링의 마지막 scale 0.9995 를 놓친다 —
     그 0.05% 가 1.5px 넘침으로 보고됐다. 0.1px 과 transform 문자열까지 본다.
     그리고 .by/.by-c 가 서명에서 빠져 있었다 — 바이트 칸은 조상(.act·.a-bd)이 멎은 뒤에도
     계속 움직이므로 "정착" 판정이 먼저 떨어졌다. 그 결과 zoom 폭 4개에서 overflow 36건이
     보고됐는데 (by 0.8~1.3px · clipped:false) 정착 후 실측은 0px 이고 애니메이션 중
     최고점은 453px 이었다 — 전부 진행 중 샘플이다. 행렬(.mx,.tr)도 같은 이유로 넣는다. */
  const q = (v) => Math.round(v * 10);
  const sig = () => [...document.querySelectorAll('.act,.lane,.row,.cap,.head,.a-bd,.srcin,.scol,.by,.by-c,.mx,.tr')].map((e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return [q(r.x), q(r.y), q(r.width), q(r.height), Math.round(parseFloat(s.opacity) * 100), s.transform].join(',');
  }).join('|');
  const running = () => document.getAnimations().some((a) => a.playState === 'running');
  const tick = () => {
    const s = sig();
    if (s === last && s !== '' && !running()) { if (++same >= 3) return res(n); } else { same = 0; last = s; }
    if (++n > 130) return res(n);                 /* 약 2.2s 상한 */
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

/* ── 일부러 망가뜨리기 : 검사가 정말 발동하는지 확인한다 ──
   발동하지 않는 검사는 무가치하다. 각 항목은 README 에 기록된 실제 사고를 재현한다. */
const BREAKS = {
  /* 1100px 에서 카드가 45px 로 짜부라졌던 자리 — 바닥을 없애고 줄넘김을 막는다 */
  overflow: '.row{flex-wrap:nowrap!important} .act{min-width:520px!important;flex-shrink:0!important}',
  /* 비교 모드의 접힌 배우 24개가 전부 빈 띠였던 자리 —
     16px 띠의 내용 상자가 2px 로 줄어 세로로 쓴 이름 9px 이 통째로 잘렸다. 칸을 그만큼 좁힌다. */
  'text-clip': '.a-hd{width:16px!important;overflow:hidden!important} .a-nm{white-space:nowrap!important}',
  /* 축 라벨이 c0<c2020..39 로 겹쳐 읽혔던 자리 — 라벨을 서로 끌어당긴다 */
  'label-overlap': '.by-l,.mx-lb,.foot{display:block!important;position:relative!important;height:12px!important} .by-l b,.mx-lb b,.foot span{position:absolute!important;left:0!important;top:0!important}',
  /* 1.3 이 16px 줄높이를 20.8 로 깨뜨렸던 자리 + height 를 배율로 안 나눈 자리 */
  zoom: '@media (min-width:2000px){#app.app{zoom:1.3!important;height:100vh!important}}',
  /* .narrow-note{display:none} 을 @media 뒤에 두어 안내가 영원히 안 떴던 자리 */
  narrow: '@media (max-width:767px){.narrow-note{display:block}} .narrow-note{display:none!important}',
};

/* ─────────────────────────────── 실행 ─────────────────────────────── */

async function main() {
  const t0 = Date.now();
  const browser = await chromium.launch();
  /* reducedMotion:'reduce' — App.jsx 는 REDUCED 일 때 자동 재생을 하지 않는다.
     자동 재생이 돌면 재는 동안 스텝이 저절로 넘어가 측정이 통째로 어긋난다. */
  const ctx = await browser.newContext({
    viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1, reducedMotion: 'reduce',
  });
  if (BREAK) {
    const css = BREAKS[BREAK];
    if (!css) { console.error('모르는 --break :', Object.keys(BREAKS).join(' · ')); process.exit(2); }
    await ctx.addInitScript(`(()=>{const put=()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.appendChild(s)};document.readyState==='loading'?addEventListener('DOMContentLoaded',put):put()})()`);
    console.log(`[--break=${BREAK}] 일부러 망가뜨린 상태로 돈다 : ${css.slice(0, 100)}…\n`);
  }
  if (INJECT_NOTE) {
    await ctx.addInitScript(`(()=>{const put=()=>{const a=document.querySelector('.app');
      if(!a){return setTimeout(put,60)}
      if(a.querySelector('.narrow-note'))return;
      const d=document.createElement('div');d.className='narrow-note';
      d.innerHTML='<b>화면이 좁습니다</b>이 페이지는 카드를 가로로 나란히 놓아 계층을 보여줍니다. 768px 이상에서 열어 주세요.';
      a.insertBefore(d,a.firstChild)};document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>setTimeout(put,60)):setTimeout(put,60)})()`);
    console.log('[--inject-note] 확인용 .narrow-note 를 끼워 넣는다 (App.jsx 에는 아직 없다)\n');
  }
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 200)));

  /* 교훈 13 : 해시 이동은 *같은 문서* 안의 이동이라 page.goto 로도 문서가 새로 실리지 않는다.
     덱을 바꾸면 App 은 deckName 을 즉시 바꾸지만 덱 모듈은 dynamic import 로 나중에 온다.
     그 사이 탭의 href 는 `#새덱/앞덱의 장면번호/1` 이 되어 어떤 검사로도 구별되지 않는다
     — 실측 : 계획이 실행마다 달라졌고(장면 22/23 · 스텝 104/105),
     768px 에서 스텝 불일치 29건이 나왔다. 앞 덱의 장면을 새 덱의 것으로 재고 있었다.
     그래서 덱을 바꿀 때는 쿼리를 붙여 문서를 정말 새로 싣는다 — 그러면 앞 덱이 없다. */
  let curDeck = null;
  const openDeck = async (d) => {
    await page.goto(`${BASE}/?deck=${d}#${d}`, { waitUntil: 'load' });
    await page.waitForSelector('.tabs a', { timeout: 20000 });
    await page.waitForFunction((deck) => {
      const on = document.querySelector('.decks a.on');
      const t = document.querySelector('.tabs a');
      /* 링크 *글자* 로 비교하면 안 된다 — 덱 이름이 mysql/locks 인데 라벨은 locks 다.
         href 는 덱 이름 그 자체이므로 라벨이 바뀌어도 안전하다. */
      return !!on && on.getAttribute('href') === '#' + deck
        && !!t && t.getAttribute('href').startsWith('#' + deck + '/');
    }, d, { timeout: 20000 });
    curDeck = d;
  };

  /* 덱·장면·스텝을 앱에서 직접 읽는다 — 데이터 파일을 따로 파싱하면 어긋난다 */
  const plan = [];
  for (const d of DECKS) {
    await openDeck(d);
    /* 장면 번호는 자리(index)로 꺼내면 안 된다 — 덱 이름이 mysql/locks 라 '/' 가 하나 더 있고
       split('/')[1] 은 'locks' 를 준다. 덱 접두어를 떼고 남은 첫 조각이 장면 번호다. */
    const scenes = await page.$$eval('.tabs a',
      (as, deck) => as.map((a) => a.getAttribute('href').replace('#' + deck + '/', '').split('/')[0]), d);
    for (const s of scenes) {
      await page.evaluate((h) => { location.hash = h; }, `${d}/${s}/1`);
      /* 스텝 수는 Playback 의 슬라이더가 알려준다 — .bar button 은 이제 없다.
         그 전에 '이 장면이 정말 켜졌는지' 를 활성 탭으로 확인한다. */
      await page.waitForFunction(([deck, num]) => {
        const on = document.querySelector('.tabs a.on');
        const t = document.querySelector('.play .track');
        return !!on && on.getAttribute('href') === '#' + deck + '/' + num + '/1'
          && !!t && +t.getAttribute('aria-valuemax') > 0;
      }, [d, s], { timeout: 20000 });
      const steps = await page.$eval('.play .track', (t) => +t.getAttribute('aria-valuemax'));
      const pair = await page.$$eval('.play .vs', (b) => b.length > 0);
      plan.push({ deck: d, scene: s, steps, pair });
    }
  }
  /* 계획이 실행마다 흔들리면 위 경합이 남아 있다는 뜻이다 — 지문을 함께 찍는다. */
  const fp = plan.map((p) => `${p.deck}/${p.scene}:${p.steps}${p.pair ? 'P' : ''}`).join(' ');
  const planSteps = plan.reduce((a, p) => a + Math.ceil(p.steps / EVERY), 0);
  const planSplit = DO_SPLIT ? plan.filter((p) => p.pair).length * 2 : 0;
  console.log(`계획 : 덱 ${DECKS.length} · 장면 ${plan.length} · 스텝 ${plan.reduce((a, p) => a + p.steps, 0)}`
    + ` (짝 있는 장면 ${plan.filter((p) => p.pair).length})`);
  console.log(`       폭 ${WIDTHS.length}개 × (${planSteps} + 비교 ${planSplit}) = `
    + `${WIDTHS.length * (planSteps + planSplit)} 방문 예정`);
  if (ARG.fp) console.log('       계획 지문 : ' + fp);
  console.log(`       계획 지문 ${fp.length}자 / ${plan.length}장면\n`);

  const byWidth = [];
  const allProblems = [];

  for (const w of WIDTHS) {
    const h = hOf(w), zoom = zoomFor(w), narrow = w <= 767;
    await page.setViewportSize({ width: w, height: h });
    const cfg = { ...CFG_BASE, zoom, narrow };
    const acc = {
      w, h, zoom, visits: 0, splitVisits: 0, confirmed: 0, mismatch: 0, el: 0, cells: 0, ranges: 0,
      labelPairs: 0, containers: 0, problems: 0, byCheck: {}, worstEmpty: 0, emptySum: 0,
      maxStageOver: 0, srcShown: 0, acts: 0, settleCap: 0, settleMax: 0,
    };

    const take = async (hash, tag) => {
      /* SETTLE 은 정착까지 쓴 프레임 수를 돌려준다. 그 값을 버리면 상한(130프레임)에
         걸렸는지 알 수 없고, 상한에 걸렸다는 것은 "정착 전에 쟀다" 는 뜻이다 —
         교훈 14 의 거짓 양성이 바로 그 상태에서 나왔다. 반드시 집계한다. */
      const settleFrames = await page.evaluate(SETTLE);
      if (settleFrames > 130) acc.settleCap++;
      if (settleFrames > acc.settleMax) acc.settleMax = settleFrames;
      const r = await page.evaluate(MEASURE, cfg);
      acc.el += r.counts.el; acc.cells += r.counts.cells; acc.ranges += r.counts.ranges;
      acc.labelPairs += r.counts.labelPairs; acc.containers += r.counts.containers;
      acc.acts += r.metrics.acts;
      acc.emptySum += r.metrics.emptyBelowCap;
      acc.worstEmpty = Math.max(acc.worstEmpty, r.metrics.emptyBelowCap);
      acc.maxStageOver = Math.max(acc.maxStageOver, r.metrics.stageOver);
      if (r.metrics.srcH > 0) acc.srcShown++;
      for (const pr of r.problems) {
        acc.problems++;
        acc.byCheck[pr.check] = (acc.byCheck[pr.check] || 0) + 1;
        if (allProblems.length < 600) allProblems.push({ w, at: hash + (tag ? ' [' + tag + ']' : ''), ...pr });
      }
      return r;
    };

    for (const p of plan) {
      const mid = Math.max(1, Math.ceil(p.steps / 2));
      if (p.deck !== curDeck) await openDeck(p.deck);   /* 덱이 바뀌면 문서를 새로 싣는다 */
      for (let s = 1; s <= p.steps; s += EVERY) {
        const hash = `${p.deck}/${p.scene}/${s}`;
        await page.evaluate((x) => { location.hash = x; }, hash);
        /* 요청한 스텝이 실제로 켜질 때까지 기다린다. 시간이 지나도 안 켜지면
           측정은 그대로 하고 불일치로 센다 — 조용히 앞 스텝을 재는 것이 최악이다. */
        await page.waitForFunction(
          ([deck, num, step]) => {
            const t = document.querySelector('.play .track');
            const on = document.querySelector('.tabs a.on');
            return !!t && +t.getAttribute('aria-valuenow') === step
              && !!on && on.getAttribute('href') === '#' + deck + '/' + num + '/1';
          }, [p.deck, p.scene, s], { timeout: 4000 },
        ).catch(() => {});
        const r = await take(hash, '');
        acc.visits++;
        /* 요청한 스텝이 정말 렌더됐는지 — "0 스텝 돌고 문제 0" 을 막는 보루 */
        if (r.metrics.now === s) acc.confirmed++;
        else {
          acc.mismatch++;
          acc.byCheck['step-mismatch'] = (acc.byCheck['step-mismatch'] || 0) + 1;
          acc.problems++;
          if (allProblems.length < 600) allProblems.push({ w, at: hash, check: 'step-mismatch', want: s, got: r.metrics.now });
        }

        /* 비교 모드 : 옛 판에서 한 번도 스윕된 적이 없던 모드다 */
        if (DO_SPLIT && p.pair && !narrow && (s === 1 || s === mid)) {
          await page.keyboard.press('v');
          await page.waitForFunction(() => !!document.querySelector('.stage-wrap.split'), null, { timeout: 5000 }).catch(() => {});
          const rs = await take(hash, 'split');
          acc.splitVisits++;
          if (!rs.metrics.split) acc.mismatch++;
          await page.keyboard.press('v');
          await page.waitForFunction(() => !document.querySelector('.stage-wrap.split'), null, { timeout: 5000 }).catch(() => {});
        }
      }
    }
    const n = acc.visits + acc.splitVisits;
    acc.avgEmpty = n ? +(acc.emptySum / n).toFixed(1) : 0;
    byWidth.push(acc);
    console.log(`W${String(w).padStart(4)} h${h} zoom ${zoom}  방문 ${acc.visits}+비교 ${acc.splitVisits}`
      + ` (확인 ${acc.confirmed}${acc.mismatch ? ` · 불일치 ${acc.mismatch}` : ''})`
      + `  상자 ${acc.containers} · 요소 ${acc.el} · 칸 ${acc.cells} · 줄조각 ${acc.ranges} · 라벨쌍 ${acc.labelPairs}`
      + `  → 문제 ${acc.problems}${acc.problems ? '  ' + JSON.stringify(acc.byCheck) : ''}`
      + `   [무대초과 ${acc.maxStageOver} · 소스보임 ${acc.srcShown}/${n}`
      + ` · 캡션아래 평균 ${acc.avgEmpty} 최대 ${acc.worstEmpty}`
      + ` · 정착 최대 ${acc.settleMax}프레임${acc.settleCap ? " · 상한초과 " + acc.settleCap + "회 ⚠" : ""}]`);
  }

  await browser.close();

  const T = byWidth.reduce((a, x) => {
    for (const k of ['visits', 'splitVisits', 'confirmed', 'mismatch', 'el', 'cells', 'ranges', 'labelPairs', 'containers', 'problems']) a[k] += x[k];
    for (const [k, v] of Object.entries(x.byCheck)) a.byCheck[k] = (a.byCheck[k] || 0) + v;
    return a;
  }, { visits: 0, splitVisits: 0, confirmed: 0, mismatch: 0, el: 0, cells: 0, ranges: 0, labelPairs: 0, containers: 0, problems: 0, byCheck: {} });

  console.log(`\n합계 : 방문 ${T.visits} + 비교 ${T.splitVisits} = ${T.visits + T.splitVisits}`
    + ` (확인 ${T.confirmed} · 불일치 ${T.mismatch})`);
  console.log(`       상자 ${T.containers} · 요소 ${T.el} · 칸 ${T.cells} · 줄조각 ${T.ranges} · 라벨쌍 ${T.labelPairs}`
    + `  → 문제 ${T.problems} ${JSON.stringify(T.byCheck)}`);
  if (pageErrors.length) console.log(`페이지 오류 ${pageErrors.length}건 : ${[...new Set(pageErrors)].slice(0, 5).join(' | ')}`);
  if (!T.visits || !T.el || !T.ranges || !T.labelPairs) {
    console.log('경고 : 방문·요소·줄조각·라벨쌍 중 0 이 있다 — 선택자가 틀렸을 때의 증상이다.');
    console.log('       이 상태의 "문제 0" 은 통과가 아니다.');
  }
  console.log(`걸린 시간 ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  if (ARG.json) writeFileSync(ARG.json, JSON.stringify({ byWidth, problems: allProblems, pageErrors }, null, 1));
  if (allProblems.length) {
    const seen = new Map();
    for (const p of allProblems) {
      const k = p.check + '|' + (p.box || p.cell || '') + '|' + (p.side || '') + '|' + (p.el || p.a || '');
      if (!seen.has(k)) seen.set(k, { ...p, n: 0 });
      seen.get(k).n++;
    }
    console.log(`\n문제 종류 ${seen.size}가지 (많은 것부터) :`);
    for (const v of [...seen.values()].sort((a, b) => b.n - a.n).slice(0, 40)) console.log(' ', JSON.stringify(v));
  }
  process.exitCode = T.problems || T.mismatch || !T.visits ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(2); });
