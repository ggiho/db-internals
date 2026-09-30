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
   빼앗는다(1366×768 실측) — 그래서 문턱은 남긴다.
   96 에서 80 으로 내렸다가(남는 높이 80~95 인 화면이 패널 없이 최대 108px 을 비웠다 — 1512 에서
   14 화면, 1366 에서 35), 문턱을 한 값으로 두지 않게 됐다. 80 은 "상태는 그대로다" 패널(79px)에만
   맞았다. 변경이 한 줄인 패널은 92px 이라 80~91 에서는 첫 변경 줄이 잘려 제목과 배우 이름만
   읽혔다(1366 innodb 01/1 : 18px 중 11px). 그래서 내용이 문턱을 정한다 — 첫 줄이 온전히 들어가야
   띄우고, 앞뒤 줄까지 들어갈 자리가 없으면 앞뒤 줄을 뺀다(앞뒤 스텝은 레일의 목록과 ← → 에 있다).
   치수는 delta.css 에서 : 테두리와 위 여백 10 · 제목과 틈 17 · 배우 이름 13 · 한 줄 18 · 앞뒤 줄과 틈 34.
   남는 높이는 무대가 쓰지 않는 자리라 무대를 누르지도 않는다. */
const DL_TOP = 10 + 17, DL_NAME = 13, DL_LINE = 18, DL_NAV = 34;
const DL_MIN = DL_TOP + DL_LINE;                  /* 가장 작은 패널 — "상태는 그대로다" 한 줄 */
/* 발췌 머리글 한 줄 + 코드 세 줄 — 인용한 줄과 그 위아래 한 줄씩. 처음엔 네 줄 남짓(110)이었는데,
   1512×982 에서 바꾼 것만 뜬 145 화면 중 40 이 82~109px 을 남기고 그만큼(최대 124px)을 비워 두었다
   (innodb 01/1 은 4px 모자랐다). 그보다 작으면 읽을 것이 없다. */
const SRC_MIN = 82;
const GAP = 14;                                   /* .mid 의 gap 과 같다 */
/* 무대를 따라가는 프레임 상한(약 2.5초) — 스윕이 정착을 기다리는 상한(130프레임)보다 길게 */
const FOLLOW_MAX = 150;

/* 남는 높이를 잰다. .mid 는 패널 유무에 따라 크기가 바뀌므로(:has) 기준으로 쓸 수 없다 —
   고정 높이인 .wrap 과 무대의 *내용* 높이로 잰다. 내용 높이는 stage-wrap 의 scrollHeight 다 :
   처음엔 .scol 의 높이를 썼는데, 무대가 눌리면 .scol 도 같이 눌려서 "남는다" 고 판정했다
   (05/5 에서 10px 조각이 남았다). scrollHeight 는 눌려도 내용만큼이다.
   1080 이하에서는 페이지가 스크롤되므로 늘 넣는다.

   예전엔 크기(.wrap · 무대 칸 · 장면 시작 때 있던 레인)가 바뀔 때 scrollHeight 를 한 번 쟀다.
   1512 에서 넘기는 순서대로 527 스텝 : 옛 값을 쓴 스텝 57, 무대가 제 칸에서 스크롤한 스텝 29,
   자리가 있는데 패널이 없는 스텝 9(innodb 01/5~01/9 : 222px 남는데 없음). 틀린 것이 둘이었다.
     · scrollHeight 는 그려진 모습까지 센다. 애니메이션 도중에는 그 모습이 레이아웃보다 크다 —
       빠지는 레인·카드는 popLayout 이 절대 위치로 띄워 두고(data-motion-pop-id), 새 자리로
       옮겨 가는 카드는 transform 으로 옛 자리에서 출발한다(innodb 03/2→3 : ibd 카드가
       레이아웃보다 86px 아래에 그려진 채 5프레임에 걸쳐 올라왔다). 그 사이 근거 칸이 빠졌다
       붙었다. 그래서 잴 때만 둘을 끄고 잰다 — 붙였다 떼는 것이 한 작업 안에서 끝나므로
       그 사이에 그려지지 않는다.
     · 한 번 재고 끝났다. 빠지는 요소가 DOM 에서 떨어져도 칸 크기는 그대로라 관찰이 울리지
       않았고, 커밋 뒤에도 레이아웃이 몇 프레임 더 바뀐다(2px, ch3 04b 에서 21px). 그래서 DOM
       변화도 보고(새 레인도 여기서 관찰에 붙인다), 무엇이든 울리면 높이가 3프레임 그대로일
       때까지 매 프레임 따라가며 잰다. 크기 관찰과 렌더 때 한 번 재기만으로는 옛 값 7 ·
       무대 스크롤 5 가 남았다.
   고친 뒤 같은 527 스텝에서 셋 다 0, 전환 441개에서 패널·근거 칸이 빠졌다 붙는 것 0
   (1512 · 1728). "빠지는 동안 줄이지 않기" 와 "렌더마다 그리기 전에 재기" 도 넣어 봤는데
   재 보니 효과가 0 이라 뺐다. */
function useRoom(key) {
  const [room, setRoom] = useState(0);            /* 남는 높이(px). 0 이면 넣지 않는다, Infinity 면 제한 없음 */
  useLayoutEffect(() => {
    const wrap = document.querySelector('.wrap'), sw = document.querySelector('.stage-wrap');
    if (!wrap || !sw) return undefined;
    const mq = matchMedia('(max-width:1080px)');
    const still = document.createElement('style');
    still.textContent = '.stage-wrap [data-motion-pop-id]{display:none!important}'
      + ' .stage-wrap *{transform:none!important}';
    const content = () => {
      document.head.appendChild(still);
      const h = sw.scrollHeight;
      still.remove();
      return h;
    };
    const f = () => {
      if (mq.matches) { setRoom(Infinity); return; }
      const left = wrap.clientHeight - content() - GAP;
      setRoom(left >= DL_MIN ? left : 0);
    };
    let raf = 0;
    const g = () => {
      f();
      if (raf) return;                              /* 이미 따라가는 중 */
      let last = -1, same = 0, n = 0;
      const tick = () => {
        const h = content();
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

function Panel({ rows, lk, prev, next, i, onSeek, style, pref, tight, sig }) {
  return (
    <section className={'delta' + (tight ? ' tight' : '')} aria-label="이 스텝이 바꾼 것" style={style} ref={pref}
      data-sig={sig}>
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
  /* 첫 항목의 실제 아래 끝 — 배우 이름이나 첫 변경이 두 줄로 접히면 치수보다 크다(1366 wal 02/3 :
     첫 변경이 35px). 무엇을 쟀는지(내용과 폭)와 함께 둔다 — 다른 내용에는 치수로 어림한다. */
  const [f1, setF1] = useState({ sig: '', h: 0 });
  useLayoutEffect(() => {
    const el = pref.current;
    const h = el ? el.offsetHeight : 0;
    if (h !== dh) setDh(h);
    const f = el && el.querySelector('.dl-row li, .dl-none');
    if (!f) return;
    /* 내용마다 한 번만 잰다 — 잰 값이 앞뒤 줄을 빼고 넣는 것을 정하고, 그것이 패널 높이를 바꿔
       다시 재면 값이 1px 씩 흔들려 끝없이 다시 그렸다(Maximum update depth). */
    if (el.dataset.sig === f1.sig) return;
    /* rect 는 배율(2000 이상의 zoom)이 곱해진 값이고 남는 높이는 CSS px 이다 — 나눠서 맞춘다.
       안 나누면 2560(1.5배)에서 첫 항목이 1.5배로 잡혀 들어갈 패널까지 빠졌다. 배율은 0.25 단위다
       (style.css) — rect 와 offsetHeight 의 비는 반올림 차로 1 에서도 1.005 쯤이 나온다. */
    const box = el.getBoundingClientRect();
    const z = el.offsetHeight ? Math.round(box.height / el.offsetHeight * 4) / 4 || 1 : 1;
    setF1({ sig: el.dataset.sig, h: Math.ceil((f.getBoundingClientRect().bottom - box.top) / z) });
  });
  if (!room) return null;
  const rows = delta(scene, frames, i, ACTORS);
  const lk = looks(steps[i], ACTORS);
  const sig = innerWidth + ' ' + scene.num + '/' + i + ' ' + lk.join(',') + ' '
    + rows.map((r) => r.who + ':' + r.lines.map((l) => l.s + l.t).join(',')).join(';');
  /* 첫 줄 — 변경이 있으면 배우 이름과 그 첫 변경, 없으면 "상태는 그대로다" — 이 온전히 들어가야 띄운다 */
  const first = f1.sig === sig ? f1.h : DL_TOP + (rows.length ? DL_NAME : 0) + DL_LINE;
  if (room < first) return null;
  const p = { rows, lk, sig,
    prev: steps[i - 1], next: steps[i + 1], i, onSeek, pref, tight: room < first + DL_NAV };
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
