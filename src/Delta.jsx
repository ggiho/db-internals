import { useLayoutEffect, useRef, useState } from 'react';
import { delta, looks } from './delta.js';
import { SourceInline, CiteInline, TrailInline } from './Source.jsx';
import './delta.css';

/* 무대 아래 — "이 스텝이 바꾼 것" 과 앞뒤 스텝, 그리고 자리가 넉넉하면 근거 칸.
   바꾼 것은 저작하지 않는다 — 무대와 같은 프레임(bake)에서 직전 상태와 비교해 만든다.

   배치는 남는 높이가 정한다.
     · 1080 이하 : 페이지가 스크롤되므로 바꾼 것을 늘 넣는다(발췌는 창으로)
     · DL_MIN 미만 : 넣지 않는다 — 무대에 전부 준다
     · 바꾼 것 아래에 근거 몇 줄이 들어갈 만큼 남으면 : 그 아래를 전부 근거 칸에 준다
       (소스 발췌 → 인용한 원문 → 장면의 근거 목록 순서로, 있는 것을)
     · 아니면 : 바꾼 것만, 내용만큼
   발췌를 되살린 이유 : 바꾼 것은 대개 한두 줄이라 넓은 화면에서 그 아래가 통째로 비었다
   (측정 : 빈 높이 중앙값 1512×982 160px · 1728×1117 295px · 1920×1080 258px). 발췌를 창으로만
   연 것은 1366×768 처럼 자리가 없는 화면 때문이었는데, 자리가 있는 화면까지 비워 두었다.
   처음엔 두 칸(왼쪽 바꾼 것 · 오른쪽 발췌)으로 두었는데, 바꾼 것이 한 줄이면 왼쪽 칸 아래가
   그대로 비었다. 위아래로 쌓으면 바꾼 것은 내용만큼, 발췌는 나머지 전부다. */
/* 제목 한 줄 + 변경 한 묶음 + 앞뒤 줄 + 여백. 처음엔 118 이었는데, 1512×982 의 innodb 01/13 에서
   남는 높이가 117 이라 패널이 통째로 빠지고 130px 이 빈칸으로 남았다. 96 이면 한 묶음과 앞뒤
   줄이 들어간다. 그보다 작으면 10~30px 로 쪼그라들어 내용 0줄을 보이며 무대에서 높이만
   빼앗는다(1366×768 실측) — 그래서 문턱은 남긴다. */
const DL_MIN = 96;
/* 발췌 머리글 한 줄 + 코드 네 줄 남짓 — 그보다 작으면 읽을 것이 없다 */
const SRC_MIN = 110;
const GAP = 14;                                   /* .mid 의 gap 과 같다 */
/* 무대를 따라가는 프레임 상한(약 2.5초) — 스윕이 정착을 기다리는 상한(130프레임)보다 길게.
   실측 정착은 길어야 81프레임이었다(15폭 스윕) */
const FOLLOW_MAX = 150;

/* 남는 높이를 잰다. .mid 는 패널 유무에 따라 크기가 바뀌므로(:has) 기준으로 쓸 수 없다 —
   고정 높이인 .wrap 과 무대의 *내용* 높이로 잰다. 내용 높이는 stage-wrap 의 scrollHeight 다 :
   처음엔 .scol 의 높이를 썼는데, 무대가 눌리면 .scol 도 같이 눌려서 "남는다" 고 판정했다
   (05/5 에서 10px 조각이 남았다). scrollHeight 는 눌려도 내용만큼이다.
   카드는 스텝이 바뀐 뒤 애니메이션으로 자라므로 레인마다 크기를 관찰한다 — 레인은
   줄어들지 않는 격자라 내용만큼이다. 1080 이하에서는 페이지가 스크롤되므로 늘 넣는다. */
function useRoom(key) {
  const [room, setRoom] = useState(0);            /* 남는 높이(px). 0 이면 넣지 않는다, Infinity 면 제한 없음 */
  useLayoutEffect(() => {
    const wrap = document.querySelector('.wrap'), sw = document.querySelector('.stage-wrap');
    if (!wrap || !sw) return undefined;
    const mq = matchMedia('(max-width:1080px)');
    const f = () => {
      if (mq.matches) { setRoom(Infinity); return; }
      const left = wrap.clientHeight - sw.scrollHeight - GAP;
      setRoom(left >= DL_MIN ? left : 0);
    };
    /* 다시 잴 계기가 없으면 애니메이션 도중에 잰 값이 그대로 남는다. 예전엔 크기만 관찰했는데
       (.wrap · 무대 칸 · 레인), 그 크기는 그대로인 채 내용 높이만 달라지는 경우가 있었다 —
         · 빠지는 요소는 framer-motion(popLayout)이 절대 위치로 띄워 두므로 칸 크기에 안 들어가고
           scrollHeight 에만 들어간다. 그것이 DOM 에서 떨어져도 관찰이 울리지 않았다
           (1512 innodb 01/5~01/9 : 남는 높이 222 인데 패널 없음)
         · 장면 시작 때 있던 레인만 관찰해서, 스텝 중에 생긴 레인이 자라도 모른다
         · 카드의 layout 애니메이션은 transform 이라 크기 관찰에 안 잡히는데 scrollHeight 는 부풀린다
       1512 에서 넘기는 순서대로 527 스텝을 잰 결과 : 옛 값을 쓴 스텝 57, 무대가 스크롤한 스텝 29.
       그래서 DOM 이 바뀌는 것도 보고(떨어지는 요소 · 새 레인), 무엇이든 울리면 무대 높이가
       3프레임 그대로일 때까지 매 프레임 따라가며 잰다 — 스윕의 정착 판정과 같은 기준이다. */
    let raf = 0;
    const g = () => {
      f();
      if (raf) return;                              /* 이미 따라가는 중 */
      let last = -1, same = 0, n = 0;
      const tick = () => {
        const h = sw.scrollHeight;
        if (h === last) same++; else { same = 0; last = h; f(); }
        if (same >= 3 || ++n > FOLLOW_MAX) { raf = 0; f(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    g();
    const ro = new ResizeObserver(g);
    const seen = new WeakSet();
    const watch = () => {
      for (const l of sw.querySelectorAll('.lane')) if (!seen.has(l)) { seen.add(l); ro.observe(l); }
    };
    ro.observe(wrap); ro.observe(sw); watch();
    const mo = new MutationObserver(() => { watch(); g(); });
    mo.observe(sw, { childList: true, subtree: true });
    mq.addEventListener('change', g);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', g); };
  }, [key]);
  return room;
}

/* 장면의 근거 목록 — 스텝들이 가리킨 소스 심볼, 없으면 인용 첫 구절을 스텝 순서대로.
   한 심볼을 여러 스텝이 이어서 가리키므로 같은 심볼은 처음 스텝 하나만 둔다. */
function trailOf(steps, i) {
  const seen = new Set(), rows = [];
  steps.forEach((s, k) => {
    if (k === i) return;
    if (s.ref && s.sym) {
      const id = s.ref + '#' + s.sym;
      if (!seen.has(id)) { seen.add(id); rows.push({ k, note: s.note, sym: s.sym, file: s.ref.split('/').pop() }); }
    } else if (s.cite && s.cite.length) rows.push({ k, note: s.note, q: s.cite[0] });
  });
  return rows;
}

function Panel({ rows, lk, prev, next, i, onSeek, style, pref }) {
  return (
    <section className="delta" aria-label="이 스텝이 바꾼 것" style={style} ref={pref}>
      <div className="dl-bd">
        <b className="dl-t">이 스텝이 바꾼 것</b>
        {rows.length ? rows.map((r) => (
          <div className="dl-row" key={r.who}>
            <em>{r.nm}</em>
            <ul>{r.lines.map((l, k) => (
              <li key={k} className={l.s === '+' ? 'add' : l.s === '−' ? 'del' : 'mod'}><i>{l.s}</i><span>{l.t}</span></li>
            ))}</ul>
          </div>
        )) : (
          <p className="dl-none">상태는 그대로다{lk.length ? ` — 보는 곳 : ${lk.join(' · ')}` : ''}</p>
        )}
      </div>
      <nav className="dl-nb" aria-label="앞뒤 스텝">
        {prev ? <button type="button" onClick={() => onSeek(i - 1)}><i>← {String(i).padStart(2, '0')}</i><span>{prev.note}</span></button> : <span />}
        {next ? <button type="button" onClick={() => onSeek(i + 1)}><i>{String(i + 2).padStart(2, '0')} →</i><span>{next.note}</span></button> : <span />}
      </nav>
    </section>
  );
}

export default function Delta({ scene, frames, i, ACTORS, steps, onSeek, deck, at, hasSrc, onOpenSrc }) {
  /* 장면이 바뀌면 레인 요소가 새로 생긴다 — 관찰 대상을 다시 붙인다 */
  const room = useRoom(scene.num);
  /* 바꾼 것의 실제 높이 — 발췌에 몇 줄이 남는지는 이것을 재야 안다(줄 수가 스텝마다 다르다).
     그리기 전에 재고 다시 그리므로 깜박이지 않는다(useLayoutEffect). */
  const pref = useRef(null);
  const [dh, setDh] = useState(0);
  useLayoutEffect(() => {
    const h = pref.current ? pref.current.offsetHeight : 0;
    if (h !== dh) setDh(h);
  });
  if (!room) return null;
  const p = { rows: delta(scene, frames, i, ACTORS), lk: looks(steps[i], ACTORS),
    prev: steps[i - 1], next: steps[i + 1], i, onSeek, pref };
  /* 근거 칸 — 소스 발췌가 먼저, 없으면 스텝의 인용, 그것도 없으면 장면의 인용,
     그것도 없으면 장면의 근거 목록(정리 스텝) */
  const st = steps[i];
  const own = !!(st.cite && st.cite.length);
  const quotes = own ? st.cite : scene.cite;
  const trail = hasSrc || (quotes && quotes.length) ? [] : trailOf(steps, i);
  const fill = hasSrc ? <SourceInline deck={deck} step={st} at={at} onOpen={onOpenSrc} />
    : quotes && quotes.length ? <CiteInline quotes={quotes} whose={own ? '이 스텝이' : '이 장면이'} />
    : trail.length ? <TrailInline rows={trail} onSeek={onSeek} /> : null;
  if (room !== Infinity && fill && dh > 0 && room - dh - GAP >= SRC_MIN) {
    return (
      <div className="band" style={{ height: room }}>
        <Panel {...p} />
        {fill}
      </div>
    );
  }
  return <Panel {...p} style={room === Infinity ? undefined : { maxHeight: room }} />;
}
