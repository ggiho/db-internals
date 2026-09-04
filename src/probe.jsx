/* A 의 축·그래프·트리 컴포넌트만 따로 띄운다 — App.jsx 를 거치지 않으므로
   다른 에이전트의 편집 중 상태와 무관하게 측정할 수 있다. */
import { createRoot } from 'react-dom/client';
import Axis from './kinds/Axis.jsx';
import Graph from './kinds/Graph.jsx';
import Tree from './kinds/Tree.jsx';
import { bake } from './bake.js';
import './style.css';
import './kinds.css';
import './probe.css';

const CASES = [];
for (const [deck, mod] of Object.entries(import.meta.glob('../data/*/index.js', { eager: true }))) {
  const name = deck.split('/')[2];
  for (const sc of mod.SCENES) {
    const frames = bake(sc);
    for (const id of sc.cast || []) {
      const kind = mod.ACTORS[id]?.kind;
      if (!['axis', 'graph', 'tree'].includes(kind)) continue;
      frames.forEach((fr, i) => {
        if (fr.st[id]) CASES.push({ deck: name, num: sc.num, step: i + 1, id, kind, a: fr.st[id], chg: fr.chg[id] });
      });
    }
  }
}
const K = { axis: Axis, graph: Graph, tree: Tree };
createRoot(document.getElementById('root')).render(
  <div id="probe">
    {CASES.map((c, k) => {
      const C = K[c.kind];
      return (
        <div className="act probe-card" key={k}
          data-case={c.deck + '/' + c.num + '/' + c.step + '/' + c.id} data-kind={c.kind}>
          <div className="a-hd"><span className="a-nm">{c.deck} {c.num}.{c.step} {c.id}</span></div>
          <div className="a-bd"><C a={c.a} chg={c.chg} /></div>
        </div>
      );
    })}
  </div>
);
