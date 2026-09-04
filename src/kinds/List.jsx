import { motion, AnimatePresence } from 'framer-motion';
export default function List({ a, chg }) {
  const add = new Set(chg?.add || []), mod = new Set(chg?.mod || []);
  const items = a.items || [];
  return (
    <div className="list">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.length === 0 && (
          <motion.div key="__empty" layout className="it hole"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="id">비었다</span>
          </motion.div>
        )}
        {items.map((it) => (
          <motion.div key={it.id} layout
            className={'it' + (add.has(it.id) ? ' new' : mod.has(it.id) ? ' mod' : '') +
              (it.tag === 'free' ? ' hole' : '') + (it.tag === 'sep' ? ' sep' : '')}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 14, transition: { duration: 0.22 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
            <span className="id">{it.tag === 'free' ? '·' : it.id}</span>
            <span className="sp" />
            <span className="sub">{it.sub || ''}</span>
            {it.tag && it.tag !== 'sep' && it.tag !== 'free' && <span className={'tag ' + it.tag}>{it.tag}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
