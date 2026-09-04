import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import Kv from './kinds/Kv.jsx';
import List from './kinds/List.jsx';
import Bytes from './kinds/Bytes.jsx';
import Matrix from './kinds/Matrix.jsx';
import Axis from './kinds/Axis.jsx';
import Graph from './kinds/Graph.jsx';
import Tree from './kinds/Tree.jsx';

const KIND = { kv: Kv, list: List, frames: List, bytes: Bytes, matrix: Matrix, axis: Axis, graph: Graph, tree: Tree };

function Card({ id, actor, a, chg, hot }) {
  const K = KIND[actor.kind] || Kv;
  return (
    <motion.div layout layoutId={'card-' + id} className={'act' + (hot ? ' hot' : '')}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <div className="a-hd">
        <span className="a-nm">{actor.nm}</span>
        <span className="a-sp" />
        <span className="a-ct">{count(actor, a)}</span>
      </div>
      <div className="a-bd">{a ? <K a={a} chg={chg} /> : null}</div>
    </motion.div>
  );
}
function count(actor, a) {
  if (!a) return '';
  if (actor.kind === 'matrix' && a.mx) return a.mx.rows.length + '×' + a.mx.cols.length;
  if (actor.kind === 'bytes') return (a.items || []).length + ' 칸';
  if (a.items) return a.items.filter((x) => x.tag !== 'free' && x.tag !== 'sep').length + '개';
  return '';
}

export default function Stage({ deck, scene, frame, stage, step }) {
  const lanes = deck.LANES;
  const byLane = new Map(lanes.map((l) => [l.id, []]));
  for (const id of stage) {
    const actor = deck.ACTORS[id];
    if (actor && byLane.has(actor.lane)) byLane.get(actor.lane).push(id);
  }
  const live = lanes.filter((l) => byLane.get(l.id).length);
  /* 실제로 그린 장수. stage.length 와 보통 같지만, 배우의 lane 이 LANES 에 없으면
     렌더되지 않으므로 그 경우까지 맞추려면 배치 결과를 세야 한다. */
  const shown = live.reduce((n, l) => n + byLane.get(l.id).length, 0);

  return (
    <LayoutGroup>
      <div className="stage">
        <AnimatePresence initial={false} mode="popLayout">
          {live.map((lane, li) => (
            <motion.div key={lane.id} layout className="lane"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="lane-lb">{lane.lb}<i>{lane.note}</i></div>
              <div className="row">
                <AnimatePresence initial={false} mode="popLayout">
                  {byLane.get(lane.id).map((id) => (
                    <Card key={id} id={id} actor={deck.ACTORS[id]}
                      a={frame.st[id]} chg={frame.chg[id]}
                      hot={frame.touch.has(id)} />
                  ))}
                </AnimatePresence>
              </div>
              {li < live.length - 1 && <div className="edge"><span /></div>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="stage-foot">
        이 스텝의 배우 {shown} / {(scene.cast || []).length}
        {step.act && <em>{step.act.lb}</em>}
      </div>
    </LayoutGroup>
  );
}
