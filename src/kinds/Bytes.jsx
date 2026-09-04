import { motion, AnimatePresence } from 'framer-motion';
/* 폭 ∝ 크기. 이 규칙은 크기가 서로 다를 때만 정보를 나르므로,
   sz 가 모두 같으면 목록으로 쓰라는 뜻이다 (그렇게 두 번 고쳤다). */
export default function Bytes({ a, chg }) {
  const add = new Set(chg?.add || []), mod = new Set(chg?.mod || []);
  const items = a.items || [];
  const total = items.reduce((s, x) => s + (x.sz || 1), 0) || 1;
  return (
    <div className="by-wrap">
      <div className="by">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.div key={it.id} layout
              className={'by-c ' + (it.tag || '') + (add.has(it.id) ? ' new' : mod.has(it.id) ? ' mod' : '')}
              style={{ flexGrow: it.sz || 1, flexBasis: 0 }}
              initial={{ opacity: 0, scaleX: 0.7 }} animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0.7, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              title={it.id + (it.sub ? ' · ' + it.sub : '')}>
              <b>{it.id}</b>{it.sub && <i>{it.sub}</i>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {a.byl && <div className="by-l"><span>{a.byl.l}</span><b>{a.byl.r}</b></div>}
    </div>
  );
}
