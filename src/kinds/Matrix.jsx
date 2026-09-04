import { motion } from 'framer-motion';
export default function Matrix({ a }) {
  const { rows, cols, cells } = a.mx;
  const on = new Set(a.mx.on || []), dim = new Set(a.mx.dim || []);
  return (
    <div className="mx">
      <table><thead><tr><th className="mx-c" />{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => (
          <tr key={r}><th className="mx-r">{r}</th>
            {cols.map((c, ci) => {
              const key = r + '/' + c, yes = cells[ri]?.[ci] === '+';
              const off = dim.size && !dim.has(key) && !on.has(key);
              return (
                <motion.td key={c} layout
                  className={'mx-v ' + (yes ? 'y' : 'n') + (on.has(key) ? ' on' : '') + (off ? ' off' : '')}
                  animate={{ opacity: off ? 0.26 : 1 }} transition={{ duration: 0.3 }}>
                  <i>{yes ? '허용' : '막힘'}</i>
                </motion.td>
              );
            })}
          </tr>))}
        </tbody></table>
      {a.mx.lb && <div className="mx-lb"><span>{a.mx.lb.l}</span><b>{a.mx.lb.r}</b></div>}
    </div>
  );
}
