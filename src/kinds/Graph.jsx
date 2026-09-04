import { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Gauge from './Gauge.jsx';

const LANE_H = 13;   /* 간선 높이 11px + 1px */
const LANE_0 = 8;

/* 간선의 양 끝이 노드 중심에 닿아야 "누가 누구를 기다리는지" 가 읽힌다.
   옛 렌더러는 unit = 100/N 로 i+0.5 지점을 계산했는데, 노드는 space-around +
   gap 으로 배치되고 컨테이너에는 좌우 padding 8px 이 있어서 그 % 는 실제 중심이 아니다.
   노드 수가 적을 때 어긋남이 눈에 보인다. 그래서 중심을 직접 잰다. */
export default function Graph({ a, chg }) {
  const nodes = a.items || [];
  const edges = a.edges || [];
  const nAdd = new Set(chg?.add || []);
  const nMod = new Set(chg?.mod || []);
  const eAdd = new Set(chg?.edge?.add || []);

  const wrap = useRef(null);
  const cells = useRef(new Map());
  const [cx, setCx] = useState(null);

  /* getBoundingClientRect 로 재면 안 된다 — motion 의 layout 애니메이션은 transform 으로
     노드를 움직이므로, 노드가 새로 들어온 스텝에서는 재는 순간 값이 애니메이션 도중의 좌표다.
     실제로 locks/09/2 에서 간선이 노드 중심이 아니라 폭 126px(정답 242px)로 그려졌고,
     .gr 의 폭은 안 바뀌므로 ResizeObserver 도 이것을 되잡아주지 않았다.
     offsetLeft/offsetWidth 는 transform 을 무시하는 레이아웃 값이라 처음부터 최종 좌표다.
     그리고 절대 위치의 left 도 같은 기준(.gr 의 패딩 상자)이므로 그대로 넘기면 맞는다. */
  useLayoutEffect(() => {
    const ids = nodes.map((n) => n.id);
    const run = () => {
      if (!wrap.current) return;
      const next = {};
      for (const id of ids) {
        const el = cells.current.get(id);
        if (el) next[id] = el.offsetLeft + el.offsetWidth / 2;
      }
      setCx((prev) => {
        if (prev && Object.keys(prev).length === Object.keys(next).length &&
            Object.keys(next).every((k) => Math.abs((prev[k] ?? -1) - next[k]) < 0.5)) return prev;
        return next;
      });
    };
    run();
    const host = wrap.current;
    if (!host) return;
    const ro = new ResizeObserver(run);
    ro.observe(host);
    return () => ro.disconnect();
  }, [nodes]);

  const at = (id) => nodes.findIndex((n) => n.id === id);

  /* 같은 방향 간선끼리 가로 구간이 겹치면 라벨이 서로를 덮는다 — 레인을 나눈다.
     재서 얻은 좌표만 쓰므로 추가 측정은 없다. */
  const laid = [];
  const ends = { up: [], dn: [] };
  for (const e of edges) {
    const i = at(e.from), j = at(e.to);
    if (i < 0 || j < 0 || !cx || cx[e.from] === undefined || cx[e.to] === undefined) continue;
    const dn = j < i;                                  /* 되돌아오는 간선은 아래로 */
    const l = Math.min(cx[e.from], cx[e.to]), r = Math.max(cx[e.from], cx[e.to]);
    const bag = ends[dn ? 'dn' : 'up'];
    let k = 0;
    while (bag[k] !== undefined && l < bag[k] + 6) k++;
    bag[k] = r;
    laid.push({ e, dn, l, w: Math.max(r - l, 2), lane: k, toRight: j > i });
  }
  const padUp = Math.max(22, LANE_0 + ends.up.length * LANE_H + 4);
  const padDn = Math.max(24, LANE_0 + ends.dn.length * LANE_H + 6);

  return (
    <>
      <div className="gr" ref={wrap} style={{ paddingTop: padUp, paddingBottom: padDn }}>
        <AnimatePresence initial={false}>
          {laid.map(({ e, dn, l, w, lane, toRight }) => (
            <motion.div key={e.id}
              className={'gr-e' + (dn ? ' dn' : '') + (e.hot ? ' hot' : '') + (eAdd.has(e.id) ? ' new' : '')}
              style={{ left: l, width: w, [dn ? 'bottom' : 'top']: LANE_0 + lane * LANE_H }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <span>{e.lb || ''}</span>
              {/* 화살머리는 목적지 쪽 다리에 붙는다 — 방향이 없으면 대기 그래프가 아니다 */}
              <i className={'gr-ah' + (toRight ? ' r' : ' l')} />
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="popLayout">
          {nodes.map((n) => (
            <motion.div key={n.id} layout
              ref={(el) => { if (el) cells.current.set(n.id, el); else cells.current.delete(n.id); }}
              className={'gr-n ' + (n.tag || '') + (nAdd.has(n.id) ? ' new' : nMod.has(n.id) ? ' mod' : '')}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <span className="id">{n.id}</span>
              <span className="sub">{n.sub || ''}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {a.cycle && <div className="gr-cy on">{a.cycle}</div>}
      </div>
      <Gauge a={a} />
    </>
  );
}
