import { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Gauge from './Gauge.jsx';

export default function Tree({ a, chg }) {
  const items = a.items || [];
  const add = new Set(chg?.add || []), mod = new Set(chg?.mod || []);
  const lvls = [...new Set(items.map((x) => x.lvl || 0))].sort((x, y) => x - y);
  const last = lvls[lvls.length - 1];

  return (
    <>
      <div className="tr">
        {lvls.map((L) => (
          <Fragment key={L}>
            <motion.div layout className="tr-lv">
              <AnimatePresence initial={false} mode="popLayout">
                {items.filter((x) => (x.lvl || 0) === L).map((x) => {
                  const f = typeof x.fill === 'number' ? x.fill : null;
                  return (
                    <motion.div key={x.id} layout
                      className={'tr-n' + (add.has(x.id) ? ' new' : mod.has(x.id) ? ' mod' : '') +
                        (f !== null && f > 0.92 ? ' full' : '')}
                      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                      <span className="id">{x.id}</span>
                      {/* 키 범위 라벨은 길다. nowrap 이면 노드 테두리를 넘어 흘러나가므로
                          kinds.css 에서 keep-all + anywhere 로 접히게 한다. */}
                      <span className="kv2">{x.keys || ''}</span>
                      {f !== null && (
                        <span className="fb">
                          <motion.i initial={false}
                            animate={{ width: Math.round(f * 100) + '%' }}
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
            {/* 마지막 레벨만 leaf 라고 적는다 — 레벨이 늘어나면 이 표시가 아래로 따라간다 */}
            {L === last && <div className="tr-lb">leaf</div>}
          </Fragment>
        ))}
      </div>
      <Gauge a={a} />
    </>
  );
}
