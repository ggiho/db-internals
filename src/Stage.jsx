/* 무대 — 위아래 밴드 배치 위에 흐름을 얹는다.

   흐름 데이터는 지어내지 않는다. 이미 저작돼 있는 두 가지만 쓴다.
     · frame.touch  — 이 스텝이 실제로 바꾼 배우 집합 (bake 가 계산해 둔 것)
     · deck.EDGES   — 레인 경계의 저작된 라벨 ({after:'mem', lb:'메모리 · 디스크'}).
                      이전 렌더러는 이걸 쓰지 않아 죽은 데이터였다.
   그래서 선은 "이 스텝이 건드린 배우들" 을 레인 순서로 이은 것이고,
   토큰이 경계를 넘을 때 그 경계의 저작된 라벨이 함께 켜진다.

   레인을 칼럼으로 세우는 배치도 만들어 봤으나 걷어냈다 — 이유는 stage.css 머리말에 적었다. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
    <motion.div layout layoutId={'card-' + id} data-act={id}
      className={'act' + (hot ? ' hot' : '')}
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

/* 스텝이 건드린 배우들의 카드 위치를 재서 경로를 만든다.
   framer-motion 이 카드를 스프링으로 옮기는 동안에도 선이 붙어 있어야 하므로
   스텝이 바뀌면 짧게 rAF 로 따라간다(정착하면 멈춘다 — 계속 돌리지 않는다). */
function useRails(wrapRef, touchIds, key) {
  const [geo, setGeo] = useState(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0, t0 = 0, stopAt = 0, last = '';
    const measure = (now) => {
      if (!t0) { t0 = now; stopAt = now + 900; }
      const box = wrap.getBoundingClientRect();
      const pts = [];
      for (const id of touchIds) {
        const el = wrap.querySelector('[data-act="' + CSS.escape(id) + '"]');
        if (!el) continue;
        const r = el.getBoundingClientRect();
        pts.push({
          id,
          x: r.left - box.left + r.width / 2,
          y: r.top - box.top + r.height / 2,
          w: r.width, h: r.height,
          top: r.top - box.top, bot: r.bottom - box.top,
          left: r.left - box.left, right: r.right - box.left,
        });
      }
      /* 서명에 상자 크기를 넣는다. 점 좌표만 보던 탓에, 카드 위치는 그대로인데
         무대 높이만 줄어드는 전환(01/6 → 01/7 : 387px → 301px)에서 setGeo 가 다시
         불리지 않아 SVG 가 387px 로 남았다 — 2초 뒤에도 그대로였고, 무대를 62px 넘쳤다. */
      const sig = box.width.toFixed(1) + 'x' + box.height.toFixed(1) + ' '
        + pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
      if (sig !== last) {
        last = sig;
        const byId = {};
        /* 유령선은 지금 무대에 있는 배우 전부의 좌표가 필요하다 —
           이번 스텝이 건드린 것만으로는 지나온 경로를 못 그린다. */
        for (const el of wrap.querySelectorAll('[data-act]')) {
          const r = el.getBoundingClientRect();
          byId[el.getAttribute('data-act')] = {
            x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2,
            top: r.top - box.top, bot: r.bottom - box.top,
            left: r.left - box.left, right: r.right - box.left,
          };
        }
        setGeo({ w: box.width, h: box.height, pts, byId });
      }
      if (now < stopAt) raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => { t0 = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
    ro.observe(wrap);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [wrapRef, key, touchIds.join('|')]);
  return geo;
}

/* 두 점을 잇는 경로.
   레인이 다르면(세로로 떨어져 있으면) 아래로 내려가는 S 곡선.
   같은 레인이면 카드 사이를 옆으로 지난다 — 예전에는 위로 호를 그렸는데
   그 호가 위쪽 레인 영역까지 솟아올라 엉뚱한 곳에 떠 보였다(녹화로 확인). */
/* 두 점을 잇는 경로. 좌표는 무대 상자 안으로 묶는다 — 묶지 않았을 때
   아래 카드가 위 카드보다 위에 있으면 곡선이 크게 휘돌아 무대 밖으로 100.5px 나갔다. */
function link(a, b, box) {
  const H = box && box.h ? box.h : Infinity;
  const W = box && box.w ? box.w : Infinity;
  const cy = (v) => Math.max(1, Math.min(H - 1, v));
  const cx = (v) => Math.max(1, Math.min(W - 1, v));
  const dy = b.y - a.y;
  /* 레인이 다르면 위에서 아래로 떨어진다 — 밴드 배치에서 쓰기가 내려가는 방향이다. */
  if (Math.abs(dy) > 24) {
    const [u, d] = a.y <= b.y ? [a, b] : [b, a];
    const m = cy((u.bot + d.top) / 2);
    return `M${cx(u.x)},${cy(u.bot)} C${cx(u.x)},${m} ${cx(d.x)},${m} ${cx(d.x)},${cy(d.top)}`;
  }
  /* 같은 레인이면 카드 사이를 옆으로 지난다. 위로 호를 그리면 그 호가
     위쪽 레인 영역까지 솟아올라 엉뚱한 곳에 떠 보인다(녹화로 확인). */
  const y = cy((a.y + b.y) / 2);
  const bow = (b.x - a.x) * 0.5;
  const x0 = cx(a.x < b.x ? a.right : a.left);
  const x1 = cx(a.x < b.x ? b.left : b.right);
  return `M${x0},${y} C${cx(x0 + bow * 0.25)},${cy(y - 9)} ${cx(x1 - bow * 0.25)},${cy(y - 9)} ${x1},${y}`;
}

export default function Stage({ deck, scene, frame, stage, step }) {
  const lanes = deck.LANES;
  const byLane = new Map(lanes.map((l) => [l.id, []]));
  for (const id of stage) {
    const actor = deck.ACTORS[id];
    if (actor && byLane.has(actor.lane)) byLane.get(actor.lane).push(id);
  }
  const live = lanes.filter((l) => byLane.get(l.id).length);
  const shown = live.reduce((n, l) => n + byLane.get(l.id).length, 0);

  /* 흐름의 순서 : 레인 순서 → 그 레인 안의 배치 순서.
     레인은 위에서 아래로 저작돼 있고(sql → mem → disk), 그게 쓰기가 내려가는 방향이다. */
  const order = [];
  live.forEach((l) => byLane.get(l.id).forEach((id) => order.push(id)));
  const touch = order.filter((id) => frame.touch.has(id));

  const si = Math.max(0, (scene.steps || []).indexOf(step));

  /* 지나온 스텝들의 경로를 흐릿하게 남긴다 — 장면이 진행되면 궤적이 쌓인다.
     2PC 처럼 메모리와 디스크를 왕복하는 장면은 그 왕복이 그림으로 남는다.
     각 스텝이 건드린 배우는 ops 키에 저작돼 있으므로 지어낸 것이 없다.
     다만 위치는 '지금 배치' 에 투영한 것이다 — 그때의 배치가 아니다. */
  const onNow = new Set(order);
  const ghosts = [];
  for (let j = Math.max(0, si - 6); j < si; j++) {
    const st = (scene.steps || [])[j];
    if (!st || !st.ops) continue;
    const ids = order.filter((id) => Object.prototype.hasOwnProperty.call(st.ops, id) && onNow.has(id));
    if (ids.length > 1) ghosts.push({ j, ids, age: si - j });
  }
  const wrapRef = useRef(null);
  const geo = useRails(wrapRef, touch, scene.num + '/' + si);


  /* 이 스텝이 넘은 경계 : 건드린 배우들이 걸쳐 있는 레인 구간 */
  const laneOf = (id) => deck.ACTORS[id] && deck.ACTORS[id].lane;
  const tLanes = new Set(touch.map(laneOf));
  const idxOf = new Map(live.map((l, i) => [l.id, i]));
  const spanLo = Math.min(...[...tLanes].map((l) => idxOf.get(l) ?? 99));
  const spanHi = Math.max(...[...tLanes].map((l) => idxOf.get(l) ?? -1));
  const crossed = (li) => tLanes.size > 1 && li >= spanLo && li < spanHi;

  const edgeFor = (laneId) => (deck.EDGES || []).find((e) => e.after === laneId);

  return (
    <LayoutGroup>
      <div className="stage" ref={wrapRef}>
        {geo && (touch.length > 1 || ghosts.length > 0) && (
          <svg className="rails" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
            {ghosts.map((g) => {
              const pts = g.ids.map((id) => geo.byId && geo.byId[id]).filter(Boolean);
              return pts.slice(0, -1).map((p, i) => (
                <path key={g.j + '-' + i} className="rail-ghost" d={link(p, pts[i + 1], geo)}
                  style={{ opacity: Math.max(0.06, 0.3 - g.age * 0.04) }} />
              ));
            })}
            {geo.pts.slice(0, -1).map((p, i) => {
              const d = link(p, geo.pts[i + 1], geo);
              return (
                <g key={p.id + '>' + geo.pts[i + 1].id}>
                  <path className="rail" d={d} />
                  <path className="rail-lit" d={d} />
                  {[0, 1, 2].map((k) => (
                    <circle key={k} className={'tok' + (k ? ' tail' : '')}
                      r={k ? 5.2 - k * 1.5 : 5.4} opacity={k ? 0.5 - k * 0.16 : 1}>
                      <animateMotion key={scene.num + '/' + si + '/' + i + '/' + k}
                        dur="0.9s" begin={(i * 0.18 + k * 0.055) + 's'} fill="freeze"
                        keyPoints="0;1" keyTimes="0;1" calcMode="spline"
                        keySplines="0.4 0 0.2 1" path={d} />
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        )}

        <AnimatePresence initial={false} mode="popLayout">
          {live.map((lane, li) => (
            <motion.div key={lane.id} layout className="lane" data-lane={lane.id}
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
              {li < live.length - 1 && (() => {
                const e = edgeFor(lane.id);
                return (
                  <div className={'edge' + (crossed(li) ? ' lit' : '') + (e ? ' named' : '')}
                    data-hot={e ? e.hot : undefined}>
                    <span />
                    {e && <b>{e.lb}</b>}
                  </div>
                );
              })()}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 스텝 척추 : 이 장면의 전 스텝을 한 줄로 두고, 지나온 구간을 밝힌다.
          칸의 색은 그 스텝이 건드린 레인에서 나온다 — 장면의 리듬이 보인다. */}
      <div className="spine" aria-hidden="true">
        {(scene.steps || []).map((s, i) => {
          const ids = Object.keys(s.ops || {});
          const ls = [...new Set(ids.map((id) => deck.ACTORS[id] && deck.ACTORS[id].lane).filter(Boolean))];
          const li = ls.length ? Math.min(...ls.map((l) => lanes.findIndex((x) => x.id === l))) : -1;
          return (
            <i key={i} className={(i < si ? 'past ' : i === si ? 'now ' : '') + (s.look ? 'look' : '')}
              data-lane={li >= 0 ? li : undefined}
              style={{ '--n': (scene.steps || []).length }} />
          );
        })}
      </div>

      <div className="stage-foot">
        이 스텝의 배우 {shown} / {(scene.cast || []).length}
        {step.act && <em>{step.act.lb}</em>}
        {touch.length > 1 && <span className="fl">흐름 {touch.length}단계{tLanes.size > 1 ? ' · 경계 넘음' : ''}</span>}
      </div>
    </LayoutGroup>
  );
}
