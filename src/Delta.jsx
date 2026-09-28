import { useLayoutEffect, useState } from 'react';
import { delta, looks } from './delta.js';
import './delta.css';

/* 무대 아래 — "이 스텝이 바꾼 것" 과 앞뒤 스텝. 예전에는 이 자리에 소스 발췌가 늘 붙어
   있었다. 발췌는 캡션의 근거 줄과 S 키로 여는 창으로 옮겼다 : 무대가 가장 빡빡한
   1366×768 에서는 발췌가 어차피 5번 중 5번 숨겨져 빈칸만 남았고, 넉넉한 화면에서는
   무대가 아니라 코드가 그 자리를 차지했다.

   바꾼 것은 저작하지 않는다 — 무대와 같은 프레임(bake)에서 직전 상태와 비교해 만든다. */
/* 남는 높이가 이만큼 안 되면 패널을 빼고 무대에 전부 준다 — 제목 한 줄 + 변경 한 묶음 +
   앞뒤 줄 + 여백. 1366×768 실측 : 배우가 많은 스텝은 패널이 10~30px 로 쪼그라들어 내용
   0줄을 보이면서 그 높이와 간격 14px 을 무대에서 빼앗았다(무대 404→400, 내부 스크롤 +4).
   인라인 발췌는 같은 판단을 visibility:hidden 으로 했는데, 그러면 자리가 남아 빈칸이 된다 —
   이번에는 요소를 빼서 .mid 가 무대를 세로 가운데에 두게 한다. */
const DL_MIN = 118;
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

export default function Delta({ scene, frames, i, ACTORS, steps, onSeek }) {
  /* 장면이 바뀌면 레인 요소가 새로 생긴다 — 관찰 대상을 다시 붙인다 */
  const room = useRoom(scene.num);
  if (!room) return null;
  const cap = room === Infinity ? undefined : { maxHeight: room };
  const rows = delta(scene, frames, i, ACTORS);
  const lk = looks(steps[i], ACTORS);
  const prev = steps[i - 1], next = steps[i + 1];
  return (
    <section className="delta" aria-label="이 스텝이 바꾼 것" style={cap}>
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
