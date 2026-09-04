import { useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* 우측 레일 — 무대가 "무엇이 일어나는가" 를 보여주는 동안
   레일은 "무엇을 돌릴 수 있고 / 실제 서버에서 어떻게 확인하며 /
   이 장면의 뼈대가 무엇이고 / 다음은 어디로 가는가" 를 붙들고 있다.

   레일은 폭이 정해진 열이라, 안에 든 것이 mono 긴 토큰
   (innodb_default_row_format 같은 것) 이면 조용히 잘린다 —
   실제로 옛 판에서 그런 잘림이 650건 측정됐다. 해법은 두 가지고 둘 다 필요하다:
   (1) rail.css 에서 grid-template-columns 를 *명시* 한다 (암시적 열은 auto = min-content 라
       272px 트랙을 320px 로 밀어내고, 밀린 만큼 잘려서 눈에는 안 보인다).
   (2) 긴 이름은 자르지 않고 어디서든 접는다 (overflow-wrap:anywhere). */

function Knobs({ knobs }) {
  if (!knobs || !knobs.length) return null;
  return (
    <div className="rl rl-knobs">
      <div className="rl-t">손잡이</div>
      <div className="rl-b">
        {knobs.map(([n, d, why], k) => (
          <div className="kn" key={n + '/' + k}>
            <div className="r"><span className="n">{n}</span><span className="sp" /><span className="d">{d}</span></div>
            <div className="w">{why}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Watch({ watch }) {
  if (!watch || !watch.length) return null;
  return (
    <div className="rl rl-watch">
      <div className="rl-t">실제 서버에서 보는 법</div>
      <div className="rl-b">
        {watch.map(([how, what], k) => (
          <div className="wt" key={how + '/' + k}>
            <div className="h">{how}</div>
            <div className="b">{what}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Steps({ steps, i, onStep }) {
  const ol = useRef(null);
  /* 재생 중에 현재 스텝이 창 밖으로 나가면 따라간다. 여기서는 rect 를 써도 된다 —
     두 값 모두 getBoundingClientRect 라서 zoom 이 양쪽에 똑같이 곱해지고 비교만 한다.
     (스크롤 위치를 *계산* 하는 소스 패널과 달리 여기서는 브라우저에 맡긴다.) */
  useLayoutEffect(() => {
    const box = ol.current;
    if (!box) return;
    const on = box.children[i];
    if (!on) return;
    const r = box.getBoundingClientRect(), b = on.getBoundingClientRect();
    if (b.top < r.top || b.bottom > r.bottom) on.scrollIntoView({ block: 'nearest' });
  }, [i, steps]);

  return (
    <div className="rl rl-steps">
      <div className="rl-t">이 장면의 스텝</div>
      <ol className="steps" ref={ol}>
        {steps.map((st, k) => (
          <li key={k} title={st.note}
            className={(st.beat ? 'beat' : '') + (k === i ? ' on' : k < i ? ' done' : '')}
            onClick={() => onStep(k)}>
            <b>{String(k + 1).padStart(2, '0')}</b>
            <span>{st.note}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Links({ links, scenes, onScene }) {
  if (!links || !links.length) return null;
  return (
    <div className="rl rl-links">
      <div className="rl-t">이어지는 장면</div>
      <div className="rl-b">
        {links.map(([num, why], k) => {
          const t = scenes.find((x) => x.num === num);
          return (
            <div className="lk" key={num + '/' + k} onClick={() => onScene(num)}>
              <b>{num}</b><span>{t ? t.tab + ' — ' + why : why}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Rail({ deck, scene, i, onStep, onScene }) {
  return (
    <AnimatePresence mode="wait">
      {/* 들어올 때 x 로 밀지 않는다 — 레일은 폭이 정해진 열의 오른쪽 끝에 붙어 있고
          .app 은 overflow:hidden 이라, 10px 밀린 동안 그만큼이 잘려 보인다.
          측정에서도 스텝 1 마다 '넘침 8px' 로 잡혔다. 페이드만 한다. */}
      <motion.aside className="rail" key={scene.num}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}>
        <Knobs knobs={scene.knobs} />
        <Watch watch={scene.watch} />
        <Steps steps={scene.steps} i={i} onStep={onStep} />
        <Links links={scene.links} scenes={deck.SCENES} onScene={onScene} />
      </motion.aside>
    </AnimatePresence>
  );
}
