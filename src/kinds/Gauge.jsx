import { motion } from 'framer-motion';

/* gg 는 kind 가 아니라 덧붙는 것이다 — 어떤 배우든 items/kv 아래에 한 줄 게이지를 달 수 있다.
   그래서 종류별 컴포넌트가 각자 마지막에 이것을 렌더한다. gg 가 없으면 아무것도 그리지 않는다. */
export default function Gauge({ a }) {
  const gg = a?.gg;
  if (!gg || typeof gg.v !== 'number') return null;
  const v = Math.max(0, Math.min(1, gg.v));
  return (
    <div className={'gg' + (v > 0.85 ? ' crit' : v > 0.6 ? ' warn' : '')}>
      <div className="gg-tr">
        <motion.i
          initial={false}
          animate={{ width: Math.round(v * 100) + '%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
      </div>
      <div className="gg-lb"><span>{gg.l}</span><b>{gg.r}</b></div>
    </div>
  );
}
