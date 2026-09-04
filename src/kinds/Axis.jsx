import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Gauge from './Gauge.jsx';

const ROW_H = 15;   /* 띠 높이 13px + 붙은 띠 사이에 이음선을 남기는 2px */
const TOP = 2;

/* 데이터의 row 를 쓰지 않는 이유 —
   구간 라벨은 띠 중앙에 놓이므로 띠보다 라벨이 넓으면 양쪽으로 삐져나온다.
   몇 행이 필요한지는 카드 폭에 따라 달라지는데 row 는 손으로 적어둔 고정값이라
   어느 폭에서는 반드시 틀린다 — 1280px 에서 "c0 < 20" 과 "c1 20‥39" 가 겹쳐
   읽을 수 없었다. 컨테이너를 넘지는 않으므로 넘침 검사로도 안 잡힌다.
   그래서 붙인 뒤 라벨의 실제 위치를 재서 왼쪽부터 탐욕적으로 행을 나눈다. */
function pack(labels, ids) {
  const box = [];
  for (const id of ids) {
    const el = labels.get(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    box.push({ id, l: r.left, r: r.right });
  }
  box.sort((x, y) => x.l - y.l);
  const endOf = [];                 /* endOf[k] = k 행에 지금까지 찍은 오른쪽 끝 */
  const out = {};
  for (const b of box) {
    let k = 0;
    while (endOf[k] !== undefined && b.l < endOf[k] + 4) k++;
    endOf[k] = b.r;
    out[b.id] = k;
  }
  return out;
}

const sameRows = (a, b) => {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};

export default function Axis({ a, chg }) {
  const { min, max } = a.axis || { min: 0, max: 1 };
  const range = (max - min) || 1;
  const at = (v) => ((v - min) / range) * 100;

  const spans = a.spans || [];
  const items = a.items || [];
  const sAdd = new Set(chg?.span?.add || []);
  const sMod = new Set(chg?.span?.mod || []);
  const iAdd = new Set(chg?.add || []);

  const wrap = useRef(null);
  const labels = useRef(new Map());
  const [rows, setRows] = useState({});

  /* 라벨의 가로 위치는 행과 무관하므로 (top 만 바뀐다) 한 번 재면 충분하다.
     그래서 rows 를 갱신해도 이 효과가 다시 돌 필요가 없고, 루프도 생기지 않는다.
     폭이 바뀌면 필요한 행 수가 바뀌므로 ResizeObserver 로 다시 잰다. */
  useLayoutEffect(() => {
    const ids = spans.map((s) => s.id);
    const run = () => {
      const next = pack(labels.current, ids);
      setRows((prev) => (sameRows(prev, next) ? prev : next));
    };
    run();
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [spans]);

  const nRows = Math.max(1, ...Object.values(rows).map((k) => k + 1));
  /* 띠는 절대 위치라 아래 눈금선을 침범할 수 있다. 행이 늘어난 만큼 위를 비운다. */
  const padTop = Math.max(20, ROW_H * nRows + 5);

  return (
    <>
      {/* 좌우 여백이 margin 이어야 하는 이유 — 절대 위치의 left/width % 는
          컨테이닝 블록의 *패딩 상자* 를 기준으로 풀리므로 padding 을 키워도 띠는
          제자리에 있다. 실제로 padding 을 26px 로 늘려봤지만 라벨의 9px 초과는
          그대로였다. 라벨을 자르면 어느 구간인지 알 수 없게 되므로
          margin 으로 삐져나올 자리를 카드 안에 남긴다. */}
      <div className="ax" ref={wrap} style={{ paddingTop: padTop }}>
        {/* 사라지는 띠에 exit 애니메이션을 두면 안 된다 — AnimatePresence 는 나가는 요소를
            DOM 에 남겨두는데 그것은 spans 에 없으므로 행 배정에 참여하지 못하고 옛 top 을
            그대로 쥔다. innodb/07/9 (RC 로 낮춰 갭 락이 점 두 개가 되는 스텝) 에서
            나가던 "next-key (10,20]" 이 새로 생긴 "20" 과 16.5px 겹쳤다.
            풀린 락은 즉시 사라지는 것이 뜻에도 맞는다 — 옛 렌더러도 그랬다. */}
        {spans.map((s) => {
          const L = at(s.from), R = at(s.to);
          return (
            <motion.div key={s.id}
              className={'ax-sp ' + (s.kind || 'rec') +
                (sAdd.has(s.id) ? ' new' : sMod.has(s.id) ? ' mod' : '')}
              style={{
                left: L + '%',
                width: Math.max(R - L, 1.2) + '%',
                top: TOP + (rows[s.id] || 0) * ROW_H,
              }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              {/* 라벨을 직접 잰다 — 띠가 아니라 라벨이 겹치는 것이 문제이므로 */}
              <span ref={(el) => {
                if (el) labels.current.set(s.id, el); else labels.current.delete(s.id);
              }}>{s.lb || ''}</span>
            </motion.div>
          );
        })}

        {/* 눈금의 -50% 를 CSS transform 에 두면 motion 이 transform 을 덮어써서
            눈금이 반칸 오른쪽으로 밀린다. 그래서 motion 의 x 로 넘긴다. */}
        <div className="ax-line">
          {items.map((it) => (
            <motion.div key={it.id}
              className={'ax-rec' + (iAdd.has(it.id) ? ' new' : it.tag === 'x' ? ' gone' : '')}
              style={{ left: at(it.v) + '%' }}
              initial={{ opacity: 0, x: '-50%' }} animate={{ opacity: 1, x: '-50%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <i /><b>{it.id}</b>
            </motion.div>
          ))}
        </div>

        <div className="ax-lb">{min}  ‥  {max}</div>
      </div>
      <Gauge a={a} />
    </>
  );
}
