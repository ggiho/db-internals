import { useLayoutEffect, useRef, useState } from 'react';
import { delta, looks } from './delta.js';
import { SourceInline } from './Source.jsx';
import './delta.css';

/* 무대 아래 — "이 스텝이 바꾼 것" 과 앞뒤 스텝, 그리고 자리가 넉넉하면 소스 발췌.
   바꾼 것은 저작하지 않는다 — 무대와 같은 프레임(bake)에서 직전 상태와 비교해 만든다.

   배치는 남는 높이가 정한다.
     · 1080 이하 : 페이지가 스크롤되므로 바꾼 것을 늘 넣는다(발췌는 창으로)
     · DL_MIN 미만 : 넣지 않는다 — 무대에 전부 준다
     · 바꾼 것 아래에 발췌 몇 줄이 들어갈 만큼 남으면 : 그 아래를 전부 발췌에 준다
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
    f();
    const ro = new ResizeObserver(f);
    ro.observe(wrap); ro.observe(sw);
    for (const l of sw.querySelectorAll('.lane')) ro.observe(l);
    mq.addEventListener('change', f);
    return () => { ro.disconnect(); mq.removeEventListener('change', f); };
  }, [key]);
  return room;
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
  if (room !== Infinity && hasSrc && dh > 0 && room - dh - GAP >= SRC_MIN) {
    return (
      <div className="band" style={{ height: room }}>
        <Panel {...p} />
        <SourceInline deck={deck} step={steps[i]} at={at} onOpen={onOpenSrc} />
      </div>
    );
  }
  return <Panel {...p} style={room === Infinity ? undefined : { maxHeight: room }} />;
}
