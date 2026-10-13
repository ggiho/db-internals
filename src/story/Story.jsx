import { useCallback, useEffect, useRef, useState } from 'react';
import { DECKS } from '../decks.js';
import { parse, env } from '../route.js';
import { stepsOf, valuesOf } from '../bake.js';
import { DEFAULT_DECK, STORY, toLab } from './has.js';
import { SourceModal, srcKeyOf } from '../Source.jsx';
import { createField, U } from './field.js';
import { worldOf } from './worlds/index.js';
import './story.css';

/* ══════════ Story — 한 장면을 scroll 로 넘기는 화면 ══════════
   Lab(App) 과 같은 데이터를 읽는다 : 스텝의 note · why · key 가 글이 되고, 세계(worlds/)가 같은
   스텝을 알갱이로 그린다. 스텝 하나가 화면 높이의 구간 하나다 — 구간 안에서 scroll 위치가 곧
   시간이고(p : 0 → 1), 구간 끝에서 다음 스텝의 자세로 섞여 넘어간다(컷이 없다).
   주소는 Lab 과 같다(#덱/장면/스텝) — 읽는 자리가 바뀔 때마다 replaceState 로 따라 적는다. */

const FONTS = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
/* 구간 길이(화면 높이 배수) — 첫 스텝은 장면 제목을 먼저 보이므로 길다 */
const LEN_FIRST = 2.2, LEN_STEP = 1.1, LEN_LOOK = 0.9, LEN_END = 1.1;
/* 길이 실측(innodb 01 · 25 스텝 · 1512×900) : 1.35 로 두었을 때 34.7 화면, 스텝마다 413px 가 아무것도 바뀌지 않는
   scroll 이었다(움직임이 끝난 0.5 에서 넘어가기 시작하는 0.84 까지). 보기만 하는 스텝(act · ops 없음)은 더 짧게 둔다 */
const lenOf = (j, s) => (j === 0 ? LEN_FIRST : !s.act && !s.ops ? LEN_LOOK : LEN_STEP);
/* 요점만 — 이만큼 긴 장면에서만 내준다(짧은 장면은 이미 요점뿐이다) */
const SKIM_MIN = 14;
/* 바로가기(←/→ · 레일)로 갔을 때 서는 자리 — 스텝의 움직임이 끝난 뒤 */
const HOLD_FIRST = 0.66, HOLD = 0.58;

/* note 는 평문이다(verify 가 태그를 막는다). 식별자 · 오프셋 · 16진수만 mono 로 가른다 —
   'HEAP_TOP' · '+2' · '0xAABBCCDD' · 'MSB' 같은 것은 찾아볼 이름이고, 나머지 문장은 serif 로 읽힌다. */
const TOKEN = /(0x[0-9A-Fa-f]+|\+\d+|[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+(?:\(\))?|\b[A-Z][A-Z0-9]+\b(?:\(\*\))?)/g;
function rich(text) {
  const out = [];
  let last = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<code key={m.index} className="t">{m[0]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* 'Big-Endian' 이 줄 끝에서 'Big-' 로 갈리지 않게 — 하이픈이 든 단어를 한 덩어리로 둔다 */
function keepHyphen(text) {
  return text.split(/(\S*-\S*)/).map((w, k) => (/-/.test(w) ? <span key={k} className="nb">{w}</span> : w));
}

/* 짝 장면의 이름 — vsLabel 'A  ·  BIG-ENDIAN  (InnoDB 가 고른 것)' 에서 이름과 덧말을 뗀다 */
function abLabel(sc) {
  const raw = (sc.vsLabel || '').split('·').slice(1).join('·').trim() || sc.tab || sc.num;
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(raw);
  return { name: (m ? m[1] : raw).trim().toLowerCase(), note: m ? m[2] : '' };
}

function credit(deckId) {
  if (deckId.startsWith('postgres/')) return '소스 발췌 PostgreSQL 18.6 (PostgreSQL License)';
  if (deckId.startsWith('mongodb/')) return '소스 발췌 WiredTiger 11.3 (GPLv2/v3) · 대조 MongoDB Server (SSPL)';
  const base = '소스 발췌 MySQL 8.4.8 Community (GPLv2)';
  if (deckId.startsWith('book/')) return base + ' · 인용 Database Internals — Alex Petrov (O’Reilly)';
  return base;
}

/* 글꼴 — Story 에서만 싣는다(Lab 은 시스템 글꼴). 세계는 글자를 점으로 떠서 그리므로
   글꼴이 내려온 뒤에 떠야 한다 — 대체 글꼴로 뜨면 알갱이 글자가 다른 모양으로 박힌다.
   stylesheet 가 실린 다음에야 document.fonts.load 가 그 글꼴을 찾는다. 3초가 지나면 그냥 간다. */
let fontsP = null;
function loadFonts() {
  if (fontsP) return fontsP;
  fontsP = new Promise((resolve) => {
    const ready = () => Promise.all([
      document.fonts.load('600 64px "IBM Plex Mono"'),
      document.fonts.load('500 30px "IBM Plex Mono"'),
      document.fonts.load('400 30px "Hahmlet"'),
    ]).then(resolve, resolve);
    let l = document.getElementById('st-fonts');
    if (!l) {
      l = document.createElement('link');
      l.id = 'st-fonts'; l.rel = 'stylesheet'; l.href = FONTS;
      l.onload = ready; l.onerror = () => resolve();
      document.head.appendChild(l);
    } else ready();
    setTimeout(resolve, 3000);
  });
  return fontsP;
}

const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

export default function Story() {
  const [route, setRoute] = useState(() => parse(location.hash.slice(1)));
  const deckId = route.deck || DEFAULT_DECK;
  const num = route.num || STORY[deckId].first;
  const [deck, setDeck] = useState(null);
  const [mod, setMod] = useState(null);           /* 불러온 세계 모듈 */
  const [active, setActive] = useState(Math.max(0, route.step - 1));
  const [srcOpen, setSrcOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(isDark);

  const root = useRef(null), cv = useRef(null), lbl = useRef(null);
  const api = useRef({});                          /* 엔진이 내주는 조작(goStep · setScene · theme) */

  const [fontsOk, setFontsOk] = useState(false);
  useEffect(() => { let live = true; loadFonts().then(() => { if (live) setFontsOk(true); }); return () => { live = false; }; }, []);

  useEffect(() => {
    const f = () => setRoute(parse(location.hash.slice(1)));
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    let live = true;
    setDeck(null);
    DECKS[deckId].load().then((m) => { if (live) setDeck(m); });
    return () => { live = false; };
  }, [deckId]);

  const scene = deck ? deck.SCENES.find((s) => s.num === num) : null;
  const wdef = worldOf(deckId, num);
  const wid = wdef ? wdef.id : null;
  useEffect(() => {
    let live = true;
    setMod(null);
    if (wdef) wdef.load().then((m) => { if (live) setMod(m.default); });
    return () => { live = false; };
  }, [wid]);   /* eslint-disable-line react-hooks/exhaustive-deps — 같은 세계면 다시 부르지 않는다 */

  /* 짝 : pair 를 가진 쪽이 A 다. 스텝 수가 같아야 같은 자리에서 바꿀 수 있다 */
  const partner = deck && scene ? (scene.pair ? deck.SCENES.find((s) => s.num === scene.pair)
    : deck.SCENES.find((s) => s.pair === scene.num)) : null;
  const pairAB = partner && partner.steps.length === scene.steps.length
    ? (scene.pair ? [scene, partner] : [partner, scene]) : null;

  /* 손잡이 — 주소의 /v<값> 이 이 장면에 실제로 있는 값일 때만 받는다. 기본값은 주소에 싣지 않는다(Lab 과 같은 규칙) */
  const vals = scene ? valuesOf(scene) : [];
  const vNow = scene && scene.vary && route.v != null && String(route.v) !== String(scene.vary.base)
    && vals.includes(String(route.v)) ? String(route.v) : null;
  const steps = scene ? stepsOf(scene, vNow) : [];
  const n = steps.length;
  /* 구간 = 원래 스텝 번호의 목록. 요점만 켜면 beat 스텝만 남는다 — 주소의 스텝 번호는 언제나 원래 번호다 */
  const beats = steps.map((x, i) => (x.beat ? i : -1)).filter((i) => i >= 0);
  const canSkim = n >= SKIM_MIN && beats.length >= 2;
  const [skimOn, setSkim] = useState(false);
  const skim = canSkim && skimOn;
  const idx = skim ? beats : steps.map((_, i) => i);
  const ns = idx.length;
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const vRef = useRef(vNow);
  vRef.current = vNow;

  /* ── 엔진 : 장 · 세계 · scroll · 글 보이기 · 주소 ── */
  useEffect(() => {
    if (!deck || !scene || !mod || !fontsOk || !cv.current) return undefined;
    history.scrollRestoration = 'manual';
    const narrow0 = innerWidth < 820;
    /* 알갱이 수는 세계가 장면을 보고 정한다(무대는 쓰는 칩만큼) */
    const F = createField(cv.current, mod.count(narrow0, deck, sceneRef.current));
    F.resize(); F.readTheme();
    const world = mod.make({ F, deck, labels: lbl.current, scene: () => sceneRef.current });
    const N = F.N;
    const buf = () => ({ x: new Float32Array(N), y: new Float32Array(N), a: new Float32Array(N),
      h: new Float32Array(N), j: new Float32Array(N), s: new Float32Array(N), c: new Uint8Array(N) });
    const A = buf(), B = buf();

    const secs = [...root.current.querySelectorAll('.st-sec')];
    const pins = secs.map((s) => s.querySelector('.st-pin'));
    const hero = root.current.querySelector('.st-hero');
    const LAST = secs.length - 1;                 /* 마지막 구간은 '이어지는 장면' */
    let tops = [], lens = [];

    const gutter = () => Math.min(56, Math.max(20, innerWidth * 0.032));
    function layout() {
      const W = innerWidth, H = innerHeight, narrow = W < 820;
      if (narrow) {
        /* 위 끝은 이 장면에서 가장 긴 글(제목 포함) 아래 — 화면의 54% 로 고정했을 때 글 아래가 70 – 130px 비어
           무대가 그만큼 더 줄었다(storysweep text-small). 54% 는 상한으로 남긴다 */
        const cb = Math.max(0, ...[...root.current.querySelectorAll('.st-copy, .st-hero')].map((c) => c.offsetTop + c.offsetHeight));
        return { W, H, narrow, x0: 16, x1: W - 16, y0: Math.round(Math.min(H * 0.54, cb + 18)), y1: H - 30 };
      }
      const copyR = gutter() + Math.min(W * 0.4, 600);
      /* 위 끝은 머리글 아래 — 머리글은 다 안 들어가면 두 줄이 된다 */
      const top = root.current.querySelector('.st-top'), y0 = Math.max(92, Math.ceil(top ? top.getBoundingClientRect().bottom : 0) + 16);
      return { W, H, narrow, x0: Math.round(Math.max(copyR + 56, W * 0.46)), x1: W - 84, y0, y1: H - 70 };
    }
    function measure() { secs.forEach((s, k) => { tops[k] = s.offsetTop; lens[k] = s.offsetHeight; }); }
    const span = (k) => (k === LAST ? Math.max(1, lens[k] - innerHeight) : lens[k]);
    function state() {
      const y = scrollY;
      let k = 0;
      while (k < LAST && y >= tops[k + 1]) k++;
      const p = U.clamp((y - tops[k]) / span(k));
      const b = k < LAST ? U.smooth(U.range(p, 0.86, 1)) : 0;
      return { k, p, b };
    }
    const hold = (k) => tops[k] + span(k) * (k === 0 ? HOLD_FIRST : HOLD);
    /* 구간 j 의 원래 스텝 — 끝 구간은 스텝 수(세계는 이것을 '끝' 으로 그린다) */
    const ix = idxRef.current, I = (j) => (j < ix.length ? ix[j] : n);
    /* 원래 스텝 k 가 든 구간 — 요점만일 때 요점이 아닌 스텝이면 그다음 요점 */
    const secOf = (k) => { const j = ix.findIndex((x) => x >= k); return j < 0 ? ix.length - 1 : j; };
    const goSec = (j, smooth = true) => {
      const jj = Math.max(0, Math.min(ix.length - 1, j));
      scrollTo({ top: Math.round(hold(jj)), behavior: smooth && !F.reduced ? 'smooth' : 'instant' });
    };
    const goStep = (k, smooth = true) => goSec(secOf(k), smooth);

    /* 글 : 구간 안에서 들어오고 나간다. 첫 스텝은 제목이 먼저 보이고 글이 뒤따른다 */
    function showOf(k, p) {
      if (k === LAST) return U.smooth(U.range(p, 0.05, 0.2));
      const inn = k === 0 ? U.smooth(U.range(p, 0.3, 0.4)) : U.smooth(U.range(p, 0.03, 0.12));
      return Math.min(inn, 1 - U.smooth(U.range(p, 0.84, 0.92)));
    }
    let shownAct = -1;
    function paint(st) {
      pins.forEach((pin, k) => {
        const p = k === st.k ? st.p : k < st.k ? 1 : 0;
        const show = showOf(k, p);
        const lift = (p < 0.5 ? 1 : -1) * (1 - show) * 18;
        pin.style.setProperty('--show', show.toFixed(3));
        pin.style.setProperty('--lift', lift.toFixed(1) + 'px');
        pin.style.visibility = show > 0.004 ? 'visible' : 'hidden';
      });
      if (hero) {
        const hp = st.k === 0 ? st.p : 1;
        const hs = 1 - U.smooth(U.range(hp, 0.16, 0.27));
        hero.style.setProperty('--show', hs.toFixed(3));
        hero.style.visibility = hs > 0.004 ? 'visible' : 'hidden';
      }
      const act = I(Math.min(ix.length - 1, st.b > 0.5 ? st.k + 1 : st.k));
      const sc = sceneRef.current;
      /* 덱을 다시 불러오는 사이(장면이 잠깐 null) 에 남은 프레임이 돌 수 있다 */
      if (sc && act !== shownAct) {
        shownAct = act;
        setActive(act);
        const h = '#' + deckId + '/' + sc.num + '/' + (act + 1) + (vRef.current ? '/v' + env(vRef.current) : '');
        if (location.hash !== h) history.replaceState(null, '', h);
      }
    }

    function rebuild() {
      /* 머리글 높이를 먼저 — 좁은 화면의 글(그래서 세계의 위 끝)이 이 높이 아래에서 시작한다 */
      const top = root.current.querySelector('.st-top');
      if (top) root.current.style.setProperty('--top-h', Math.ceil(top.getBoundingClientRect().bottom) + 'px');
      F.resize(); measure();
      world.build(layout());
    }
    rebuild();
    /* 주소가 가리킨 스텝에 선다 — 1 이면 맨 위(장면 제목)부터 */
    const want = Math.max(0, Math.min(n - 1, parse(location.hash.slice(1)).step - 1));
    if (want > 0) goStep(want, false); else scrollTo({ top: 0, behavior: 'instant' });

    let raf = 0, last = performance.now();
    function frame(now) {
      const dt = Math.min(1 / 30, (now - last) / 1000), t = now / 1000;
      last = now;
      const st = state();
      const kA = I(st.k), kB = I(st.k + 1);
      world.pose(kA, st.p, t, A);
      if (st.b > 0) world.pose(kB, 0, t, B);
      const b = st.b;
      for (let i = 0; i < N; i++) {
        if (b > 0) {
          F.tx[i] = A.x[i] + (B.x[i] - A.x[i]) * b; F.ty[i] = A.y[i] + (B.y[i] - A.y[i]) * b;
          F.ta[i] = A.a[i] + (B.a[i] - A.a[i]) * b; F.th[i] = A.h[i] + (B.h[i] - A.h[i]) * b;
          F.tj[i] = A.j[i] + (B.j[i] - A.j[i]) * b; F.ts[i] = A.s[i] + (B.s[i] - A.s[i]) * b;
          F.tc[i] = b > 0.5 ? B.c[i] : A.c[i];
        } else {
          F.tx[i] = A.x[i]; F.ty[i] = A.y[i]; F.ta[i] = A.a[i]; F.th[i] = A.h[i];
          F.tj[i] = A.j[i]; F.ts[i] = A.s[i]; F.tc[i] = A.c[i];
        }
      }
      paint(st);
      world.paint(kA, st.p, st.b, t, kB);
      F.overlay = (ctx) => world.overlay && world.overlay(ctx, kA, st.p, st.b, t, kB);
      F.step(dt, t);
      F.render(t);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(rebuild, 160); };
    addEventListener('resize', onResize);

    /* 검사 도구(tools/storysweep.js)가 알갱이 · 세계 상태를 직접 잰다 — 개발 서버이거나 주소에 ?probe 가 있을 때만.
       스윕은 배포본(build)을 재야 하므로 build 에서도 열 수 있어야 한다 */
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('probe')) {
      window.__story = { F, world, state, layout, tops: () => tops, lens: () => lens, hold, goStep, secOf, idx: () => idxRef.current };
    }
    api.current = {
      goStep, goSec, secOf, relayout: rebuild,
      setScene: (num2) => world.setScene && world.setScene(num2),
      setVary: (v) => world.setVary && world.setVary(v),
      readTheme: () => { F.readTheme(); if (world.theme) world.theme(); },
    };
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      if (world.dispose) world.dispose();
      if (lbl.current) lbl.current.innerHTML = '';
    };
  }, [deck, mod, n, ns, skim, fontsOk]);   /* eslint-disable-line react-hooks/exhaustive-deps — 짝을 바꿔도 장은 그대로 */

  /* 장면 번호가 어떤 길로 바뀌든(짝 버튼 · 뒤로가기 · 주소 고치기) 세계에 알린다 — 같은 세계 안의 짝이면
     장을 다시 만들지 않으므로, 알리지 않으면 세계는 옛 장면의 순서로 그린다(실측 : 주소는 01 인데 AA 가 a+3) */
  /* 머리글 높이 — 좁은 화면에서는 줄이 접혀 두 · 세 줄이 된다. 글과 진행 막대는 이 높이 아래에서 시작한다
     (실측 : 390 · 768 폭에서 머리글이 95px 까지 내려왔는데 글은 64px 에 고정돼 있어 덮였다) */
  useEffect(() => {
    const top = root.current && root.current.querySelector('.st-top');
    if (!top) return undefined;
    let last = -1;
    const set = () => {
      const hb = Math.ceil(top.getBoundingClientRect().bottom);
      if (!root.current || hb === last) return;
      root.current.style.setProperty('--top-h', hb + 'px');
      /* 머리글 높이가 바뀌면 세계도 다시 짠다 — 데스크톱의 세계는 머리글 아래에서 시작한다 */
      if (last >= 0 && api.current.relayout) api.current.relayout();
      last = hb;
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(top);
    return () => ro.disconnect();
  }, [deck, scene && scene.num]);   /* eslint-disable-line react-hooks/exhaustive-deps */
  useEffect(() => { if (api.current.setScene) api.current.setScene(num); }, [num]);
  useEffect(() => { if (api.current.setVary) api.current.setVary(vNow); }, [vNow]);

  /* 손잡이 값을 바꾼다 — 장면 · 스텝은 그대로, 그 값의 스텝으로 글과 세계가 함께 갈린다 */
  const setKnob = useCallback((v) => {
    if (!scene || !scene.vary) return;
    const keep = String(v) === String(scene.vary.base) ? null : String(v);
    const h = '#' + deckId + '/' + num + '/' + (active + 1) + (keep ? '/v' + env(keep) : '');
    history.replaceState(null, '', h);
    setRoute(parse(h.slice(1)));
  }, [scene, deckId, num, active]);

  /* 짝을 바꾼다 — 스텝은 그대로, 주소의 장면만 바뀐다. 세계는 알갱이를 그 자리에서 옮긴다 */
  const switchTo = useCallback((sc) => {
    if (!sc || sc.num === num) return;
    const h = '#' + deckId + '/' + sc.num + '/' + (active + 1);
    history.replaceState(null, '', h);
    setRoute(parse(h.slice(1)));
    if (api.current.setScene) api.current.setScene(sc.num);
  }, [deckId, num, active]);

  const toggleTheme = useCallback(() => {
    const mode = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('theme', mode); } catch { /* 저장 못 해도 이번 화면은 바뀐다 */ }
    setDark(mode === 'dark');
    if (api.current.readTheme) api.current.readTheme();
  }, []);

  const here = deckId + '/' + num + '/' + (active + 1) + (vNow ? '/v' + env(vNow) : '');
  const step = steps[Math.min(active, n - 1)];
  const at = num + '/' + (active + 1);
  const srcKey = deck && step ? srcKeyOf(deck, step, at) : null;
  const hasSrc = !!(srcKey && deck.CODE[srcKey]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const a = api.current;
        if (a.goSec) a.goSec(a.secOf(active) + (e.key === 'ArrowRight' ? 1 : -1));
      }
      else if ((e.key === 'b' || e.key === 'B') && canSkim) setSkim((x) => !x);
      else if (e.key === 'Escape') { setSrcOpen(false); setMenu(false); }
      else if (e.key === 's' || e.key === 'S') { if (hasSrc) setSrcOpen((o) => !o); }
      else if (e.key === 'l' || e.key === 'L') toLab(here);
      else if ((e.key === 'v' || e.key === 'V') && pairAB) switchTo(pairAB[0].num === num ? pairAB[1] : pairAB[0]);
      else if ((e.key === 'v' || e.key === 'V') && vals.length) setKnob(vals[(vals.indexOf(vNow || String(scene.vary.base)) + 1) % vals.length]);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [active, hasSrc, here, pairAB, num, switchTo, vals, vNow, setKnob, scene, canSkim]);

  if (!deck || !scene) return <div className="boot">불러오는 중…</div>;

  const visible = deck.SCENES.filter((s) => !s.hidden);
  const tabOf = (nm) => (deck.SCENES.find((s) => s.num === nm) || {}).tab || '';
  const storyNums = (STORY[deckId] || { nums: [] }).nums;

  return (
    <div className={'st' + (pairAB || (scene.vary && vals.length > 1) ? ' has-ab' : '')} ref={root} data-scene={num}>
      <canvas ref={cv} className="st-field" aria-hidden="true" />
      <div ref={lbl} className="st-labels" aria-hidden="true" />

      <header className="st-top">
        <a className="st-brand" href={'#' + deckId + '/' + STORY[deckId].first + '/1'}>db-internals</a>
        <button type="button" className="st-where" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <span className="d">{deck.DECK.title}</span>
          <span className="s">{scene.hidden && pairAB ? pairAB[0].num : scene.num} {scene.hidden && pairAB ? pairAB[0].tab : scene.tab}</span>
        </button>
        {scene.vary && vals.length > 1 && (
          <div className="st-ab st-knob" role="group" aria-label={scene.vary.knob}>
            <span className="st-kn">{scene.vary.knob}</span>
            {vals.map((v) => {
              const on = (vNow || String(scene.vary.base)) === v;
              return (
                <button type="button" key={v} className={on ? 'on' : ''} aria-pressed={on} onClick={() => setKnob(v)} title="값을 바꾸면 그 값의 스텝으로 다시 흐른다 (V)">{v}</button>
              );
            })}
          </div>
        )}
        {pairAB && (
          <div className="st-ab" role="group" aria-label="짝 장면">
            {pairAB.map((sc) => {
              const lb = abLabel(sc);
              return (
                <button type="button" key={sc.num} className={sc.num === num ? 'on' : ''}
                  aria-pressed={sc.num === num} onClick={() => switchTo(sc)} title={lb.note + ' (V)'}>
                  {lb.name}{lb.note && <small>{lb.note}</small>}
                </button>
              );
            })}
          </div>
        )}
        <span className="st-r">
          {canSkim && (
            <button type="button" className={'st-btn st-skim' + (skim ? ' on' : '')} aria-pressed={skim}
              onClick={() => setSkim((x) => !x)} title={`요점(beat) ${beats.length} 스텝만 따라간다 — 다시 누르면 ${n} 스텝 전부 (B)`}>
              요점만 <b>{beats.length}</b>
            </button>
          )}
          <button type="button" className="st-btn" onClick={() => toLab(here)} title="표 · source · delta 로 본다 (L)">Lab</button>
          <button type="button" className="st-btn st-thm" onClick={toggleTheme} aria-label="테마 바꾸기">
            {dark ? '밝게' : '어둡게'}
          </button>
        </span>
      </header>

      {menu && (
        <nav className="st-menu" aria-label="이 덱의 장면">
          {visible.map((s) => (
            <a key={s.num} href={'#' + deckId + '/' + s.num + '/1'} onClick={() => setMenu(false)}
              className={(s.num === num || (pairAB && pairAB.some((x) => x.num === s.num)) ? 'on' : '') + (storyNums.includes(s.num) ? ' story' : '')}>
              <b>{s.num}</b><span>{s.tab}</span>{!storyNums.includes(s.num) && <i>Lab</i>}
            </a>
          ))}
        </nav>
      )}

      {/* 레일 — 요점(beat)에서 묶음이 끝난다. 긴 장면(SKIM_MIN 이상)은 촘촘하게 */}
      <nav className={'st-rail' + (ns >= SKIM_MIN ? ' dense' : '')} aria-label="스텝">
        {idx.map((k, j) => {
          const s2 = steps[k];
          return (
            <button type="button" key={k} className={(k === active ? 'on' : '') + (s2.beat ? ' beat' : '') + (!skim && s2.beat && j < ns - 1 ? ' end' : '')}
              title={s2.note} onClick={() => api.current.goStep && api.current.goStep(k)}>
              <span>{k + 1}</span><i />
            </button>
          );
        })}
      </nav>
      {/* 좁은 화면에는 레일이 없다 — 대신 머리글 아래 가는 막대로 위치를 보인다 */}
      <div className="st-prog" aria-hidden="true">
        {idx.map((k) => <i key={k} className={(k === active ? 'on' : k < active ? 'past' : '') + (steps[k].beat ? ' beat' : '')} />)}
      </div>

      <main>
        {idx.map((k, j) => [k, steps[k], j]).map(([k, s, j]) => (
          <section className="st-sec" key={j} style={{ '--len': lenOf(j, s) }}>
            <div className="st-pin">
              {j === 0 && (
                <div className="st-hero">
                  <p className="st-deck">{deck.DECK.title}</p>
                  <h1 className="st-title">{keepHyphen(scene.title)}</h1>
                  <p className="st-sub">{scene.sub}</p>
                  <p className="st-hint">{skim ? `요점 ${ns} 스텝 (전체 ${n})` : `${n} 스텝`} · 아래로 넘긴다{canSkim && !skim ? ' · B 로 요점만' : ''}</p>
                </div>
              )}
              <div className="st-copy">
                <p className="st-k"><b>{k + 1}</b> / {n}{skim && <span className="sk">  ·  요점 {j + 1} / {ns}</span>}{!skim && s.beat && <span className="sk">  ·  요점</span>}</p>
                <h2 className="st-note">{rich(s.note)}</h2>
                {s.why && <p className="st-why">{s.why}</p>}
                {s.key && <p className="st-key" dangerouslySetInnerHTML={{ __html: s.key }} />}
                {s.ref && (
                  <button type="button" className="st-ref" disabled={!hasSrc || k !== active}
                    onClick={() => setSrcOpen(true)} title="소스 발췌를 연다 (S)">
                    <span>근거</span>
                    <code>{s.ref.split('/').pop()}{deck.LINES[s.ref + '#' + s.sym] ? ':' + deck.LINES[s.ref + '#' + s.sym] : ''}</code>
                    {s.sym && <code className="sym">{s.sym}</code>}
                  </button>
                )}
              </div>
            </div>
          </section>
        ))}
        <section className="st-sec st-end" style={{ '--len': LEN_END }}>
          <div className="st-pin">
            <div className="st-copy">
              <p className="st-k">이어지는 장면</p>
              <div className="st-next">
                {(scene.links || []).map(([nm, desc]) => (
                  <a key={nm} href={'#' + deckId + '/' + nm + '/1'}>
                    <b>{nm}</b><span className="tb">{tabOf(nm)}</span><span className="ds">{desc}</span>
                    {!storyNums.includes(nm) && <i>Lab 에서 열림</i>}
                  </a>
                ))}
              </div>
              <button type="button" className="st-again" onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>
                처음부터 다시
              </button>
            </div>
          </div>
        </section>
      </main>


      <p className="st-cred">{credit(deckId)}</p>
      <SourceModal deck={deck} step={step} at={at} open={srcOpen} onClose={() => setSrcOpen(false)} />
    </div>
  );
}
