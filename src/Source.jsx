import { useLayoutEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { highlight } from './hl.js';

/* 소스 발췌는 두 곳에 뜬다 — 무대 아래 남는 자리(SourceInline)와 창(SourceModal).
   예전에는 인라인 발췌가 그 자리를 혼자 차지했고(남는 높이가 184px 미만이면 감춤),
   그다음에는 "이 스텝이 바꾼 것" 이 그 자리를 받고 발췌는 창으로만 열었다. 그랬더니
   넓은 화면에서 바꾼 것이 한두 줄일 때 그 아래가 통째로 비었다(1728×1117 에서 약 285px).
   이제 자리가 넉넉하면 바꾼 것 아래를 발췌가 채운다 — 배치 판단은 Delta.jsx 에. */

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

/* ══════════ 무대 아래 발췌 ══════════
   높이는 부모가 정한다(남는 자리). 그 안에서 스크롤하고, 처음 보여 주는 자리는 인용한 줄이다 —
   창은 맨 위에서 시작하지만 여기는 몇 줄밖에 안 보이므로, 정의 머리보다 근거가 먼저 보여야 한다.
   인용한 줄이 없으면 정의 줄(hit)을 위에서 1/4 쯤에 둔다. 머리글을 누르면 창으로 크게 연다. */
export function SourceInline({ deck, step, at, onOpen }) {
  const k = key(step, deck, at);
  const code = k ? deck.CODE[k] : null;
  const lines = useMemo(() => highlight(code), [code]);
  const cd = useRef(null);

  useLayoutEffect(() => {
    const el = cd.current;
    if (!el || !code) return;
    const target = el.querySelector('.ln.cited') || el.querySelector('.ln.hit');
    const first = el.firstElementChild;
    if (!target || !first) { el.scrollTop = 0; return; }
    /* 줄 높이 단위로 맞춘다 — 반쯤 잘린 줄이 맨 위에 걸리면 읽는 자리를 놓친다.
       offsetTop 은 가장 가까운 위치 지정 조상 기준이라 발췌 영역 기준이 아니다 — 첫 줄과의
       차이로 잰다. 처음엔 offsetTop 을 그대로 써서 맨 윗줄이 반쯤 잘렸다. */
    const lh = target.offsetHeight || 18;
    const rel = target.offsetTop - first.offsetTop;
    const want = rel - Math.round(el.clientHeight / 4);
    el.scrollTop = Math.max(0, Math.round(want / lh) * lh);
  }, [code]);

  if (!code) return null;
  return (
    <section className="srci" aria-label="소스 발췌">
      <button type="button" className="srci-hd" onClick={onOpen} title="크게 보기 (S)">
        <span className="f">{step.ref}:{code.hit}</span>
        <span className="s">{step.sym}</span>
        <i>크게 보기  S</i>
      </button>
      <div className="srci-cd" ref={cd}>
        {lines.map((l, i) => <Line key={l.n + '/' + i} n={l.n} toks={l.toks} gap={l.gap} hit={code.hit} cite={!l.gap && (code.marks||[]).includes(l.n)} />)}
      </div>
    </section>
  );
}

/* ══════════ 창 ══════════ */
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
