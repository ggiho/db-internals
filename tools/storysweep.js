/* Story 스윕 — 세계가 있는 장면 × 스텝 × 화면 크기 (+ 손잡이 값이 바꾸는 스텝). 배포본(build)을 잰다.
 *
 *   npx vite build && npx vite preview --port 5181 &
 *   node tools/storysweep.js --base=http://localhost:5181
 *   node tools/storysweep.js --sizes=1280x720,390x844 --decks=book/ch3
 *   node tools/storysweep.js --break=copy-fit          검사가 정말 발동하는지(발동하지 않는 검사는 무가치하다)
 *   node tools/storysweep.js --shots=/tmp/shots        잰 자리마다 화면을 저장한다 — 눈으로 보는 검토용
 *                                                      (기하 검사는 겹침만 본다 — 모양이 맞는지 · 읽히는지는 못 본다)
 *
 * sweep.js(Lab) 의 교훈 중 이 화면에도 그대로 걸리는 것 —
 *   · 방문 수와 "확인" 수를 함께 찍는다. 확인 = 요청한 스텝이 주소 · 레일 · 글의 번호에 모두 나타난 것.
 *     확인 < 방문이면 통과가 아니다(0 방문을 "문제 0" 으로 보고한 적이 있다).
 *   · 보이는지는 조상 사슬의 display · visibility · opacity 를 곱해서 본다(퇴장 중인 글을 재지 않게).
 *   · 넘침은 rect 의 네 변을 다 본다. 라벨끼리의 겹침은 넘침으로 안 잡히므로 쌍으로 비교한다.
 *   · 해시만 바꾸는 이동은 같은 문서다 — 장면을 바꿀 때는 쿼리를 바꿔 문서를 새로 싣는다.
 * Story 에만 있는 것 —
 *   · 서는 자리(goStep, p 0.58)에서 잰다. 움직임이 끝난 상태가 실측된 끝 상태다.
 *   · 알갱이의 *목표*(tx · ty · ta)를 잰다 — 물리로 따라가는 실제 위치보다 먼저 정해지고 흔들리지 않는다.
 */
import fs from 'node:fs';
import { loadChromium } from './pw.js';
import { STORY } from '../src/story/has.js';
import { DECKS } from '../src/decks.js';
import { valuesOf } from '../src/bake.js';
import { BESPOKE } from '../src/story/worlds/index.js';
import stage from '../src/story/worlds/stage.js';

const ARG = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] === undefined ? '1' : m[2]] : [a, '1'];
}));
const BASE = ARG.base || 'http://localhost:5181';
/* 크기 — 태블릿 · 낮은 노트북(720 · 768) · 흔한 데스크톱 · 넓은 화면. 높이가 글이 들어가는지를 정한다.
   폰(390 × 844)은 당분간 대상이 아니다(2026-10-13 결정) — 필요하면 --sizes=390x844 로 따로 잰다 */
const SIZES = (ARG.sizes || '768x1024,1024x768,1280x720,1366x768,1512x900,1728x1117,1920x1080,2560x1440')
  .split(',').map((s) => s.split('x').map(Number));
const ONLY = ARG.decks ? ARG.decks.split(',') : Object.keys(STORY);
const JOBS = Math.max(1, parseInt(ARG.jobs || '4', 10));
const BREAK = ARG.break || null;
const SHOTS = ARG.shots || null;

/* ── --break : 일부러 망가뜨려 그 검사만 발동하는지 본다 ── */
const BREAKS = {
  'page-overflow': { css: 'main::after{content:"";display:block;width:160vw;height:1px}' },
  'copy-fit': { css: '.st-copy{top:auto !important;bottom:-240px !important;transform:none !important}' },
  'copy-overlap': { css: '.st-copy{left:58vw !important}' },
  'label-out': { css: '.st-labels > *{margin-left:3000px !important}' },
  'label-overlap': { css: '.st-labels .wl,.st-labels .stn{transform:translate(62vw,46vh) !important}' },
  'rail-overlap': { css: '.st-rail{right:auto !important;left:62vw !important}' },
  'header-overlap': { css: '.st-top{top:42vh !important}' },
  'text-clip': { css: '.st-btn{max-width:22px !important;overflow:hidden !important;white-space:nowrap !important}' },
  'box-overflow': { css: '.st-labels .stn{width:56px !important}' },
  'grain-out': { js: true },
  confirm: { off: 1 },
  /* Lab 의 이름을 Story 요소에 붙인다 — 실제로 .wrap(display:grid) 이 이름표를 음절마다 접었다 */
  'css-leak': { js: true },
  'word-split': { css: '.st-copy *{word-break:break-all !important}' },
  /* 실제로 있었던 결함을 되살린다 — 항목의 id 와 설명 사이 공백을 지운다('INSER / T'). 낱말이 줄보다 넓으면 빼는
     예외가 이것까지 가리지 않는지 본다 */
  'word-glue': { js: true, kind: 'word-split' },
  'text-small': { css: '.st-labels *{font-size:6px !important}' },
  'header-wrap': { css: '.st-top *{white-space:normal !important;max-width:34px !important}' },
  /* 상자 안의 이름을 한 자리로 모은다 — bytes 의 칸 이름 · axis 의 범위 이름은 상자 안에서 재서 놓는다 */
  'inbox-overlap': { css: '.st-labels .stn .s-byl span,.st-labels .stn .s-sp{left:0 !important;top:0 !important}' },
  /* 서는 자리 뒤에도 이름표 하나가 p 를 따라 흐려지게 한다 */
  'hold-still': { js: true },
  /* act 이름표를 글 위로 띄운다 — 서는 자리에서는 이미 사라져 있어 다른 검사는 못 본다 */
  flight: { css: '.st-labels .stn-tok{margin-left:-60vw !important}' },
};
if (BREAK && !BREAKS[BREAK]) { console.error('모르는 --break : ' + BREAK + '  (' + Object.keys(BREAKS).join(' · ') + ')'); process.exit(2); }

/* ── 계획 : 장면마다 스텝 수와, 손잡이 값이 바꾸는 스텝 ── */
const plan = [];
for (const deck of ONLY) {
  if (!STORY[deck]) { console.error('Story 가 없는 덱 : ' + deck); process.exit(2); }
  const m = await DECKS[deck].load();
  for (const num of STORY[deck].nums) {
    const sc = m.SCENES.find((s) => s.num === num);
    if (!sc) { console.error('STORY 에 적힌 장면이 덱에 없다 : ' + deck + '/' + num); process.exit(2); }
    /* 범용 무대 장면은 그 조건(cast 가 전부 kv · list · frames)에 맞아야 한다 — 안 맞으면 세계가 상자를 못 짠다 */
    if (!BESPOKE[deck]?.[num] && !stage.fits(m, sc)) { console.error('STORY 에 적힌 무대 장면이 무대 조건에 안 맞는다 : ' + deck + '/' + num); process.exit(2); }
    const vals = valuesOf(sc).slice(1);
    plan.push({ deck, num, n: sc.steps.length, variants: vals.map((v) => ({ v, steps: Object.keys(sc.vary.alt[v]).map(Number) })) });
  }
}
const perSize = plan.reduce((a, p) => a + p.n + p.variants.reduce((b, x) => b + x.steps.length, 0), 0);
console.log(`계획 : 장면 ${plan.length} · 스텝 ${plan.reduce((a, p) => a + p.n, 0)} · 손잡이 변형 스텝 ${perSize - plan.reduce((a, p) => a + p.n, 0)} · 크기 ${SIZES.length} → 방문 ${perSize * SIZES.length}${BREAK ? '   (--break=' + BREAK + ')' : ''}`);

/* ── 한 자리를 잰다(페이지 안) ── */
function measure() {
  const W = innerWidth, H = innerHeight, P = [];
  const vis = (el) => {
    let e = el, op = 1;
    while (e && e.nodeType === 1) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      op *= parseFloat(cs.opacity);
      e = e.parentElement;
    }
    return op;
  };
  const R = (el) => el.getBoundingClientRect();
  const nm = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase())
    + (el.textContent ? ' "' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 28) + '"' : '');
  const bx = (r) => `${r.left | 0},${r.top | 0} ${r.width | 0}×${r.height | 0}`;
  const ov = (a, b, t = 1) => a.left < b.right - t && b.left < a.right - t && a.top < b.bottom - t && b.top < a.bottom - t;

  if (document.documentElement.scrollWidth > W + 1) P.push(['page-overflow', `scrollWidth ${document.documentElement.scrollWidth} > ${W}`]);
  const tops = [...document.querySelectorAll('.st-top > *')].filter((e) => vis(e) > 0.05).map(R);
  const headB = Math.max(0, ...tops.map((r) => r.bottom));
  const prog = document.querySelector('.st-prog');
  const lineB = Math.max(headB, prog && vis(prog) > 0.05 ? R(prog).bottom : 0);

  const copies = [...document.querySelectorAll('.st-copy')].filter((e) => vis(e) > 0.5);
  if (copies.length !== 1) P.push(['copy-fit', `보이는 글 ${copies.length} 개`]);
  const copy = copies[0], cr = copy ? R(copy) : null;
  if (cr) {
    if (cr.top < lineB + 4) P.push(['copy-fit', `위 ${cr.top | 0} < 머리글 끝 ${lineB | 0}`]);
    if (cr.bottom > H - 4) P.push(['copy-fit', `아래 ${cr.bottom | 0} > ${H}`]);
    if (cr.left < 0 || cr.right > W) P.push(['copy-fit', `좌우 ${cr.left | 0}–${cr.right | 0}`]);
  }
  /* 세계의 DOM — 이름표 · 상자 · 코드 판 · hexdump. 퇴장 중(opacity < .3)인 것은 뺀다 */
  const world = [...document.querySelectorAll('.st-labels > *')]
    .filter((e) => !e.classList.contains('stn-measure') && vis(e) > 0.3)
    .map((e) => ({ e, r: R(e) })).filter((o) => o.r.width > 0 && o.r.height > 0);
  for (const { e, r } of world) if (r.left < -1 || r.right > W + 1 || r.top < lineB - 1 || r.bottom > H + 1) P.push(['label-out', `${nm(e)} ${bx(r)}`]);
  for (let i = 0; i < world.length; i++) for (let j = i + 1; j < world.length; j++) {
    if (ov(world[i].r, world[j].r, 1.5)) P.push(['label-overlap', `${nm(world[i].e)} × ${nm(world[j].e)}`]);
  }
  if (cr) for (const { e, r } of world) if (ov(cr, r)) P.push(['copy-overlap', nm(e)]);
  const rail = document.querySelector('.st-rail');
  if (rail && vis(rail) > 0.05) {
    const rr = R(rail);
    for (const { e, r } of world) if (ov(rr, r)) P.push(['rail-overlap', nm(e)]);
    if (cr && ov(rr, cr)) P.push(['rail-overlap', '글']);
    if (rr.top < headB || rr.bottom > H) P.push(['rail-overlap', `레일 ${rr.top | 0}–${rr.bottom | 0} · 머리글 끝 ${headB | 0}`]);
  }
  for (const t of tops) {
    for (const { e, r } of world) if (ov(t, r)) P.push(['header-overlap', nm(e)]);
    if (cr && ov(t, cr)) P.push(['header-overlap', '글']);
  }
  for (const el of document.querySelectorAll('.st-top *, .st-copy *, .st-labels *')) {
    if (el.closest('.stn-measure') || vis(el) < 0.3) continue;
    const cs = getComputedStyle(el);
    if (/hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) P.push(['text-clip', nm(el)]);
  }
  /* 상자 안의 글끼리 — 무대의 bytes · axis · graph 는 이름을 상자 안에 직접 놓는다. 위의 label-overlap 은 상자끼리만 본다.
     글을 직접 가진 요소의 줄 조각(Range rect)을 쌍으로 견준다 */
  for (const stn of document.querySelectorAll('.st-labels .stn:not(.stn-measure)')) {
    if (vis(stn) < 0.3) continue;
    const rr = [], rg2 = document.createRange();
    for (const el of stn.querySelectorAll('*')) {
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.data.trim()) continue;
        rg2.selectNodeContents(n);
        for (const r of rg2.getClientRects()) if (r.width > 0.5 && r.height > 0.5) rr.push({ el, r });
      }
    }
    let hit = null;
    for (let i = 0; i < rr.length && !hit; i++) for (let j = i + 1; j < rr.length; j++) {
      if (rr[i].el === rr[j].el) continue;
      if (ov(rr[i].r, rr[j].r, 1.5)) { hit = [rr[i].el, rr[j].el]; break; }
    }
    if (hit) P.push(['inbox-overlap', `${nm(stn)} : ${nm(hit[0])} × ${nm(hit[1])}`]);
  }
  for (const stn of document.querySelectorAll('.st-labels .stn:not(.stn-measure)')) {
    if (vis(stn) < 0.3) continue;
    const sr = R(stn);
    for (const c of stn.querySelectorAll('div, b, span, i')) {
      const r = R(c);
      if (r.width && (r.right > sr.right + 1 || r.left < sr.left - 1 || r.bottom > sr.bottom + 1)) { P.push(['box-overflow', `${nm(stn)} ⊃ ${nm(c)}`]); break; }
    }
  }
  /* Lab 의 전역 규칙이 Story 요소에 걸리는가 — 장면을 새로 실을 때 한 번.
     class 를 쓰는 selector 만 본다(요소 · * · :root 같은 바탕 규칙은 일부러 함께 쓴다). 문법 색(.c-*)도 일부러 쓴다.
     실측 : .wrap{display:grid} 가 이름표를 음절마다 접었고, .kv{gap · font · padding} 이 무대 상자에 섞였고,
     .kn{border-bottom} 이 손잡이 이름에 점선을 그었다 */
  if (window.__leakAt !== location.search) {
    window.__leakAt = location.search;
    const sels = [];
    const take = (rules) => { for (const r of rules) {
      if (r.cssRules && r.media && !matchMedia(r.media.mediaText).matches) continue;
      if (r.cssRules && !r.selectorText) { take(r.cssRules); continue; }
      if (!r.selectorText) continue;
      for (const sel of r.selectorText.split(',')) {
        const t = sel.trim();
        if (!/\.[A-Za-z]/.test(t) || /\.st\b|\.st-|\.stn/.test(t) || /^\.c-[ktsncp]\b/.test(t)) continue;
        sels.push(t);
      }
    } };
    for (const sh of document.styleSheets) { try { take(sh.cssRules); } catch { /* 다른 출처(글꼴) */ } }
    const els = [...document.querySelectorAll('.st *')];
    const hit = new Map();
    for (const t of sels) {
      let m = null;
      try { m = els.find((e) => e.matches(t)); } catch { continue; }
      if (m && !hit.has(t)) hit.set(t, m);
    }
    for (const [t, e] of hit) P.push(['css-leak', `${t}  ⇒  ${nm(e)}`]);
  }
  /* 글이 읽히는 크기인가 — 무대는 높이가 모자라면 세계 전체를 줄인다. 폰에서 innodb 01 의 상자 글이 3 – 6px 로 줄었는데
     겹치지는 않아서 다른 검사를 모두 통과했다. 그려진 크기 = font-size × 그 이름표의 배율(rect 폭 / layout 폭).
     8px 은 코드 판(ch3 01)이 줄어들 수 있는 하한과 같다 */
  {
    let small = 0, worst = Infinity, worstEl = null;
    for (const top of world) {
      const sc = top.e.offsetWidth ? top.r.width / top.e.offsetWidth : 1;
      for (const el of [top.e, ...top.e.querySelectorAll('*')]) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) || vis(el) < 0.3) continue;
        const px = parseFloat(getComputedStyle(el).fontSize) * sc;
        if (px < 8) { small++; if (px < worst) { worst = px; worstEl = el; } }
      }
    }
    if (small) P.push(['text-small', `${small} 곳 · 가장 작은 ${worst.toFixed(1)}px ${nm(worstEl)}`]);
  }
  /* 머리글 글이 접혔는가 — 손잡이 값이 긴 장면(postgres mvcc 08 · 1024 폭)에서 'db-internals' 가 'db- / internals' 로,
     장면 이름 · 손잡이 값이 두 줄로 접혔다. 머리글은 낱말이 아니라 항목이 접히면 안 된다. 글 조각의 줄(top)이 둘 이상이면 */
  {
    const hw = document.createTreeWalker(document.querySelector('.st-top'), NodeFilter.SHOW_TEXT), r2 = document.createRange();
    for (let tn = hw.nextNode(); tn; tn = hw.nextNode()) {
      if (!tn.data.trim() || vis(tn.parentElement) < 0.3) continue;
      r2.selectNodeContents(tn);
      const ys = [...r2.getClientRects()].filter((r) => r.width > 0).map((r) => r.top);
      if (ys.length > 1 && Math.max(...ys) - Math.min(...ys) > 4) P.push(['header-wrap', `${nm(tn.parentElement)}`]);
    }
  }
  /* 낱말이 글자 사이에서 접혔는가 — 이웃한 두 글자가 모두 한글 · 라틴 · 숫자인데 그 사이에서 줄이 바뀌면.
     실측 : 항목 설명에 keep-all 이 없어 '커밋됨' 이 '커 / 밋됨' 으로(wiredtiger 06), id 와 설명을 공백 없이 붙여 써서
     'INSERT' 가 'INSER / T' 로(postgres locks 02) 접혔다. 낱말(공백 사이)이 그 줄 폭보다 넓어 어쩔 수 없이 잘린 것은 뺀다.
     글자마다 Range 의 줄(top)을 견준다 */
  const WC = /[\uAC00-\uD7A3A-Za-z0-9]/, rg = document.createRange();
  const rectAt = (tn, i) => { rg.setStart(tn, i); rg.setEnd(tn, i + 1); return rg.getBoundingClientRect(); };
  const lineW = (el) => {
    let b = el;
    while (b.parentElement && getComputedStyle(b).display === 'inline') b = b.parentElement;
    const cs = getComputedStyle(b), sc = b.offsetWidth ? b.getBoundingClientRect().width / b.offsetWidth : 1;
    return (b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * sc;
  };
  const tw = document.createTreeWalker(document.querySelector('.st'), NodeFilter.SHOW_TEXT);
  for (let tn = tw.nextNode(); tn; tn = tw.nextNode()) {
    const el = tn.parentElement, s = tn.data;
    if (!el.closest('.st-labels, .st-copy, .st-top') || el.closest('.stn-measure') || !WC.test(s) || vis(el) < 0.3) continue;
    let prev = null;
    for (let i = 0; i + 1 < s.length; i++) {
      if (!WC.test(s[i]) || !WC.test(s[i + 1])) { prev = null; continue; }
      if (!prev) prev = rectAt(tn, i);
      const r = rectAt(tn, i + 1);
      if (r.height && prev.height && r.top > prev.top + prev.height * 0.5) {
        let a = i, b = i + 1;
        while (a > 0 && !/\s/.test(s[a - 1])) a--;
        while (b + 1 < s.length && !/\s/.test(s[b + 1])) b++;
        let w = 0;
        for (let j = a; j <= b; j++) w += rectAt(tn, j).width;
        if (w <= lineW(el) + 1) { P.push(['word-split', `${nm(el)} … "${s.slice(Math.max(0, i - 4), i + 1)} / ${s.slice(i + 1, i + 5)}"`]); break; }
      }
      prev = r;
    }
  }
  /* 알갱이 목표 — 밝은 것(ta ≥ .3)이 화면 밖이거나 글 위에 있으면 */
  const F = window.__story.F;
  let total = 0, out = 0, onCopy = 0;
  for (let i = 0; i < F.N; i++) {
    if (F.ta[i] < 0.3) continue;
    total++;
    const x = F.tx[i], y = F.ty[i];
    if (x < -4 || x > W + 4 || y < -4 || y > H + 4) out++;
    else if (cr && x > cr.left && x < cr.right && y > cr.top && y < cr.bottom) onCopy++;
  }
  if (out) P.push(['grain-out', `${out} / ${total}`]);
  if (onCopy) P.push(['grain-over-copy', `${onCopy} / ${total}`]);
  return { P, n: { world: world.length, grains: total } };
}

/* ── 서는 자리가 멈춰 있는가(페이지 안) — 서는 자리와 p 0.85(섞기 0.86 전)의 세계를 견준다.
   0.8 로 견줬을 때는 0.8 – 0.88 에 나타나는 결과 이름표(ch3 01 의 5)를 놓쳤다.
   실측 : act 이름표가 p 0.5–0.6 에 사라지게 짜여 서는 자리(0.58)에 불투명도 0.1 의 잔상이 남았다(wiredtiger 06/4).
   기하 검사는 불투명도 .3 미만을 빼므로 이것을 못 본다 ── */
async function holdStill() {
  const S = window.__story, j = S.state().k;
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const snap = () => ({
    L: [...document.querySelectorAll('.st-labels > *')].filter((e) => !e.classList.contains('stn-measure')).map((e) => {
      const r = e.getBoundingClientRect();
      return { e, o: parseFloat(getComputedStyle(e).opacity), x: r.left, y: r.top };
    }),
    tx: Float32Array.from(S.F.tx), ty: Float32Array.from(S.F.ty), ta: Float32Array.from(S.F.ta),
  });
  await raf();
  const A = snap();
  scrollTo({ top: Math.round(S.tops()[j] + S.lens()[j] * 0.85), behavior: 'instant' });
  await raf(); await raf();
  const B = snap(), P = [];
  const nm = (el) => (typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase())
    + ' "' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  for (const a of A.L) {
    const b = B.L.find((x) => x.e === a.e);
    if (!b || Math.max(a.o, b.o) < 0.02) continue;
    if (Math.abs(a.o - b.o) > 0.03) P.push(`${nm(a.e)} 불투명도 ${a.o.toFixed(2)} → ${b.o.toFixed(2)}`);
    else if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1.5) P.push(`${nm(a.e)} 자리 ${Math.round(b.x - a.x)},${Math.round(b.y - a.y)}px`);
  }
  let moved = 0;
  for (let i = 0; i < S.F.N; i++) {
    const lit = Math.max(A.ta[i], B.ta[i]);
    if (Math.abs(A.ta[i] - B.ta[i]) > 0.05 || (lit >= 0.3 && Math.abs(A.tx[i] - B.tx[i]) + Math.abs(A.ty[i] - B.ty[i]) > 2)) moved++;
  }
  if (moved) P.push(`알갱이 ${moved} / ${S.F.N}`);
  return P;
}

/* ── 날아가는 동안(페이지 안) — act 덩어리 · 이름표가 지나가는 길(p 0.15 · 0.25 · 0.35)에서 글 · 레일을 덮거나
   화면 · 머리글 밖으로 나가는가. 서는 자리만 쟀더니 이름표는 그때 이미 사라져 있어(0.52 까지) 한 번도 재지 않았다.
   알갱이는 밝은 것(ta ≥ .3)의 목표가 글 위에 있으면. 첫 스텝은 제목이 먼저이고 세계가 모이는 중이라 뺀다 ── */
async function flight() {
  const S = window.__story, j = S.state().k;
  if (j === 0) return [];
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const vis = (el) => { let e = el, op = 1; while (e && e.nodeType === 1) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; op *= parseFloat(cs.opacity); e = e.parentElement; } return op; };
  const ov = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const nm = (el) => (typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase())
    + ' "' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  const P = new Map();
  for (const p of [0.15, 0.25, 0.35]) {
    scrollTo({ top: Math.round(S.tops()[j] + S.lens()[j] * p), behavior: 'instant' });
    await raf(); await raf();
    const W = innerWidth, H = innerHeight;
    const copy = [...document.querySelectorAll('.st-copy')].find((e) => vis(e) > 0.5), cr = copy && copy.getBoundingClientRect();
    const headB = Math.max(0, ...[...document.querySelectorAll('.st-top > *')].filter((e) => vis(e) > 0.05).map((e) => e.getBoundingClientRect().bottom));
    const rail = document.querySelector('.st-rail'), rr = rail && vis(rail) > 0.05 ? rail.getBoundingClientRect() : null;
    for (const e of document.querySelectorAll('.st-labels > *')) {
      if (e.classList.contains('stn-measure') || vis(e) < 0.3) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < -1 || r.right > W + 1 || r.top < headB - 1 || r.bottom > H + 1) P.set(nm(e) + ' 화면 밖', p);
      if (cr && ov(cr, r)) P.set(nm(e) + ' × 글', p);
      if (rr && ov(rr, r)) P.set(nm(e) + ' × 레일', p);
    }
    if (cr) {
      let on = 0;
      for (let i = 0; i < S.F.N; i++) if (S.F.ta[i] >= 0.3 && S.F.tx[i] > cr.left && S.F.tx[i] < cr.right && S.F.ty[i] > cr.top && S.F.ty[i] < cr.bottom) on++;
      if (on) P.set(`알갱이 ${on} 개 × 글`, p);
    }
  }
  return [...P].map(([d, p]) => `${d} (p ${p})`);
}

/* ── 크기 하나를 다 돈다 ── */
async function runSize(browser, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  const res = { size: `${w}×${h}`, visits: 0, ok: 0, world: 0, grains: 0, problems: [] };
  for (const p of plan) {
    /* 쿼리를 바꿔 문서를 새로 싣는다 — 해시만 바꾸면 앞 장면의 세계가 남는다 */
    await page.goto(`${BASE}/?probe&r=${w}x${h}-${p.deck.replace('/', '-')}-${p.num}#${p.deck}/${p.num}/1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__story && window.__story.tops().length > 1, null, { timeout: 20000 });
    if (BREAK && BREAKS[BREAK].css) await page.addStyleTag({ content: BREAKS[BREAK].css });
    if (BREAK === 'grain-out') await page.evaluate(() => { const S = window.__story, L = S.layout(); S.world.build({ ...L, x0: innerWidth + 40, x1: innerWidth + 640 }); });
    if (BREAK === 'css-leak') await page.evaluate(() => { const e = document.querySelector('.st-labels > *, .st-copy'); if (e) e.classList.add('wrap'); });
    if (BREAK === 'word-glue') await page.evaluate(() => {
      const W = window.__story.world, paint = W.paint;
      W.paint = (...a) => {
        paint(...a);
        document.querySelectorAll('.st-labels .s-li p').forEach((p) => {
          /* <wbr> 를 지우면 글 조각이 나뉜 채 남는다 — 합쳐야 원래 마크업(한 조각)과 같다 */
          p.querySelectorAll('wbr').forEach((w) => w.remove());
          p.normalize();
          [...p.childNodes].forEach((n) => { if (n.nodeType === 3 && !n.data.trim()) n.remove(); });
        });
      };
    });
    if (BREAK === 'hold-still') await page.evaluate(() => {
      const W = window.__story.world, paint = W.paint;
      W.paint = (k, p, ...a) => { paint(k, p, ...a); const e = document.querySelector('.st-labels > *:not(.stn-measure)'); if (e) e.style.opacity = String(1 - p); };
    });
    const runs = [{ v: null, steps: [...Array(p.n).keys()].map((k) => k + 1) }, ...p.variants];
    for (const run of runs) {
      if (run.v != null) {
        await page.evaluate((hh) => { location.hash = hh; }, `${p.deck}/${p.num}/${run.steps[0]}/v${encodeURIComponent(run.v)}`);
        await page.waitForFunction((v) => document.querySelector('.st-knob button.on')?.textContent === v, String(run.v), { timeout: 5000 }).catch(() => {});
      }
      for (const k of run.steps) {
        res.visits++;
        const go = BREAK === 'confirm' ? k : k - 1;     /* confirm 깨기 : 한 칸 옆에 선다 */
        await page.evaluate((kk) => window.__story.goStep(kk, false), go);
        const want = `${p.deck}/${p.num}/${k}` + (run.v != null ? '/v' + encodeURIComponent(run.v) : '');
        const confirmed = await page.waitForFunction(({ want, k }) => {
          const copy = [...document.querySelectorAll('.st-copy')].find((e) => parseFloat(getComputedStyle(e).opacity) > 0.9 && getComputedStyle(e.closest('.st-pin')).visibility === 'visible');
          return location.hash === '#' + want && document.querySelector('.st-rail button.on span')?.textContent === String(k)
            && copy && copy.querySelector('.st-k b')?.textContent === String(k);
        }, { want, k }, { timeout: 2500, polling: 'raf' }).then(() => true).catch(() => false);
        const at = `${p.deck}/${p.num}/${k}${run.v != null ? '/v' + run.v : ''}`;
        if (!confirmed) { res.problems.push([res.size, at, 'confirm', '주소 · 레일 · 글 번호가 요청과 다르다']); continue; }
        res.ok++;
        const m = await page.evaluate(measure);
        res.world += m.n.world; res.grains += m.n.grains;
        for (const [kind, detail] of m.P) res.problems.push([res.size, at, kind, detail]);
        while (errs.length) res.problems.push([res.size, at, 'errors', errs.shift()]);
        if (SHOTS) {
          /* 알갱이가 목표에 닿을 때까지(밝은 것의 98% 가 4px 안) — 목표는 이미 쟀고, 그림은 따라가는 중일 수 있다.
             흐려지는 중인 것도 기다린다 — 사라진 칩이 상자 가운데에 덩어리로 남은 채 찍혀 결함처럼 보였다(ch2 02 · 06 · 08) */
          await page.waitForFunction(() => {
            const F = window.__story.F;
            let n = 0, far = 0, fading = 0;
            for (let i = 0; i < F.N; i++) {
              if (Math.max(F.a[i], F.ta[i]) > 0.12 && Math.abs(F.a[i] - F.ta[i]) > 0.08) fading++;
              if (F.ta[i] < 0.3) continue;
              n++; if (Math.abs(F.px[i] - F.tx[i]) + Math.abs(F.py[i] - F.ty[i]) > 4) far++;
            }
            return far <= n * 0.02 && fading <= 3;
          }, null, { timeout: 4000, polling: 200 }).catch(() => {});
          const dir = `${SHOTS}/${w}x${h}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${p.deck.replace('/', '-')}-${p.num}-${String(k).padStart(2, '0')}${run.v != null ? '-v' + String(run.v).replace(/[^\w.-]+/g, '_') : ''}.png` });
        }
        for (const d of await page.evaluate(holdStill)) res.problems.push([res.size, at, 'hold-still', d]);
        for (const d of await page.evaluate(flight)) res.problems.push([res.size, at, 'flight', d]);
      }
    }
  }
  await ctx.close();
  return res;
}

const chromium = await loadChromium();
const browser = await chromium.launch();
const t0 = Date.now();
const results = [];
const queue = [...SIZES];
await Promise.all([...Array(Math.min(JOBS, queue.length))].map(async () => {
  while (queue.length) {
    const sz = queue.shift();
    const r = await runSize(browser, sz);
    const kinds = {};
    for (const [, , k] of r.problems) kinds[k] = (kinds[k] || 0) + 1;
    console.log(`${r.size.padStart(10)}  방문 ${r.visits} (확인 ${r.ok})  세계 요소 ${r.world} · 알갱이 ${r.grains}  → 문제 ${r.problems.length}  ${Object.keys(kinds).length ? JSON.stringify(kinds) : ''}`);
    results.push(r);
  }
}));
await browser.close();

const all = results.flatMap((r) => r.problems);
const visits = results.reduce((a, r) => a + r.visits, 0), ok = results.reduce((a, r) => a + r.ok, 0);
const kinds = {};
for (const [, , k] of all) kinds[k] = (kinds[k] || 0) + 1;
console.log(`\n합계 : 방문 ${visits} (확인 ${ok} · 불일치 ${visits - ok})  → 문제 ${all.length} ${JSON.stringify(kinds)}`);
console.log(`걸린 시간 ${Math.round((Date.now() - t0) / 1000)}s`);
const show = parseInt(ARG.show || '40', 10);
for (const [size, at, kind, detail] of all.slice(0, show)) console.log(`  ${size.padStart(10)}  ${at.padEnd(24)} ${kind.padEnd(16)} ${detail}`);
if (all.length > show) console.log(`  … ${all.length - show} 건 더 (--show=N)`);
if (BREAK) {
  const hit = kinds[BREAKS[BREAK].kind || BREAK] || 0;
  console.log(hit ? `\n--break=${BREAK} : 발동 ${hit} 건 — 검사가 살아 있다` : `\n--break=${BREAK} : 발동 0 건 — 이 검사는 죽어 있다`);
  process.exit(hit ? 0 : 1);
}
process.exit(all.length || visits !== ok || !visits ? 1 : 0);
