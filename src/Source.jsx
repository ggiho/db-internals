import { useLayoutEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { highlight } from './hl.js';

/* 소스 발췌는 창(SourceModal)으로만 연다 — 캡션의 근거 줄과 S 키.
   예전에는 무대가 쓰지 않은 높이를 인라인 발췌로 채웠다(남는 높이가 184px 미만이면 감춤).
   그 자리는 이제 "이 스텝이 바꾼 것" 이 받는다(Delta.jsx). 그 판단의 근거는 Delta.jsx 에. */

function Line({ n, toks, hit, cite, gap }) {
  return (
    <span className={'ln' + (gap ? ' gap' : '') + (!gap && n === hit ? ' hit' : '') + (cite ? ' cited' : '')}>
      <i>{n}</i>
      {toks.map((t, k) => (t.c ? <span key={k} className={t.c}>{t.v}</span> : t.v))}
    </span>
  );
}

/* 조회 키. 스텝 전용 발췌가 있으면 그것을 먼저 쓴다 —
   한 심볼을 여러 스텝이 공유하면서 서로 다른 곳을 인용할 때, 창 하나로는 다 담을 수 없다.
   at 은 '장면/스텝' 이고, 없거나 전용 발췌가 없으면 심볼 키로 떨어진다. */
function key(step, deck, at) {
  if (!(step && step.ref && step.sym)) return null;
  const base = step.ref + '#' + step.sym;
  if (deck && at && deck.CODE[base + '@' + at]) return base + '@' + at;
  return base;
}
export function srcKeyOf(deck, step, at) { return key(step, deck, at); }

/* ══════════ 인라인 패널 ══════════ */
export function SourceModal({ deck, step, at, open, onClose }) {
  const k = key(step, deck, at);
  const code = k ? deck.CODE[k] : null;
  const lines = useMemo(() => highlight(code), [code]);
  const cd = useRef(null);

  useLayoutEffect(() => { if (open && cd.current) cd.current.scrollTop = 0; }, [open, code]);

  return (
    <AnimatePresence>
      {open && code && (
        <motion.div className="src" role="presentation" key="src"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}>
          <div className="src-bd" onClick={onClose} />
          <motion.div className="src-box" role="dialog" aria-label="소스 발췌" aria-modal="true"
            initial={{ x: 22, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            exit={{ x: 22, opacity: 0, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <div className="src-hd">
              <div className="f">{step.ref}:{code.hit}</div>
              <div className="s">{step.sym}</div>
              <div className="n">{step.note}</div>
              <button className="src-x" onClick={onClose}>닫기  ESC</button>
            </div>
            <div className="src-cd" ref={cd}>
              {lines.map((l, i) => <Line key={l.n + '/' + i} n={l.n} toks={l.toks} gap={l.gap} hit={code.hit} cite={!l.gap && (code.marks||[]).includes(l.n)} />)}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
