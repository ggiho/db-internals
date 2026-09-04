import { motion } from 'framer-motion';
export default function Kv({ a, chg }) {
  const keys = new Set(chg?.keys || []);
  return (
    <div className="kv-wrap">
      {Object.entries(a.kv || {}).map(([k, raw]) => {
        const [v, cls] = String(raw).split('|');
        return (
          <motion.div key={k} layout className={'kv' + (keys.has(k) ? ' chg' : '') + (cls ? ' ' + cls : '')}>
            <span className="k">{k}</span><span className="d" /><span className="v">{v}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
