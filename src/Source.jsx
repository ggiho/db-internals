import { useLayoutEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { highlight } from './hl.js';

/* 소스 발췌는 두 곳에 뜬다 — 무대 아래 남는 자리(SourceInline)와 창(SourceModal).
   예전에는 인라인 발췌가 그 자리를 혼자 차지했고(남는 높이가 184px 미만이면 감춤),
   그다음에는 "이 스텝이 바꾼 것" 이 그 자리를 받고 발췌는 창으로만 열었다. 그랬더니
   넓은 화면에서 바꾼 것이 한두 줄일 때 그 아래가 통째로 비었다(1728×1117 에서 약 285px).
   이제 자리가 넉넉하면 바꾼 것 아래를 근거 칸이 채운다 — 소스 발췌, 없으면 인용한 원문,
   그것도 없으면 장면의 근거 목록(셋 다 이 파일에). 배치 판단은 Delta.jsx 에. */

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

  /* 인용한 줄에서 정수 줄 수만큼 위를 맨 위로 둔다. retarget 이 거짓이면 지금 위치에서
     가장 가까운 줄 경계로만 옮긴다 — 크기가 바뀔 때 읽던 자리를 빼앗지 않기 위해서다. */
  useLayoutEffect(() => {
    const el = cd.current;
    if (!el || !code) return undefined;
    const align = (retarget) => {
      const target = el.querySelector('.ln.cited') || el.querySelector('.ln.hit');
      const first = el.firstElementChild;
      if (!target || !first) { if (retarget) el.scrollTop = 0; return; }
      /* 절대값을 줄 높이로 반올림하면 안 된다 — 구간 사이 줄(···)은 높이가 달라서 그 아래
         줄들은 18 의 배수에 있지 않다(배포본 1512 에서 맨 윗줄이 또 반쯤 잘렸다). */
      const lh = target.offsetHeight || 18;
      const rel = target.offsetTop - first.offsetTop;
      let k = retarget ? Math.round(el.clientHeight / 4 / lh) : Math.round((rel - el.scrollTop) / lh);
      /* 인용한 줄이 끝 가까이면 원하는 값이 최댓값을 넘고, 브라우저가 최댓값으로 자른다 —
         그 값은 줄 경계가 아니다(mongodb 01/4 에서 10.5px 잘림). 넘지 않는 줄 수로 줄인다. */
      const max = el.scrollHeight - el.clientHeight;
      if (rel - k * lh > max) k = Math.ceil((rel - max) / lh);
      el.scrollTop = Math.max(0, rel - k * lh);
    };
    align(true);
    /* 같은 발췌를 쓰는 스텝으로 넘어가면 위 효과는 다시 돌지 않는데, 무대 높이가 바뀌어
       발췌 칸이 커지거나 줄면 브라우저가 스크롤을 새 최댓값으로 잘라 줄 경계가 어긋난다
       (스윕 : innodb 01/10 → 01/11 에서 5px). 크기가 바뀔 때마다 경계를 다시 맞춘다. */
    const ro = new ResizeObserver(() => align(false));
    ro.observe(el);
    return () => ro.disconnect();
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

/* ══════════ 무대 아래 인용 원문 ══════════
   ref 가 없는 스텝은 띄울 발췌가 없다 — Aurora 05 처럼 근거가 논문·문서 인용뿐인 스텝이
   그렇다. 그 자리를 비워 두지 않고 인용한 원문을 그대로 보인다(verify 가 원문과 글자 단위로
   대조한 문장이다). 스텝에 인용이 없으면 장면의 인용을 쓴다 — 책 덱의 정리 스텝이 그렇다. */
export function CiteInline({ quotes, whose }) {
  if (!quotes || !quotes.length) return null;
  return (
    <section className="srci cite" aria-label="인용한 원문">
      <div className="srci-hd"><span className="s">{whose} 인용한 원문</span><i>{quotes.length} 구절</i></div>
      <div className="srci-cd">
        {quotes.map((q, k) => <blockquote key={k}>{q}</blockquote>)}
      </div>
    </section>
  );
}

/* ══════════ 무대 아래 장면의 근거 목록 ══════════
   정리 스텝은 자기 코드도 인용도 없다 — innodb 01/25 "모든 배우가 제자리로 돌아왔다" 처럼
   장면이 앞에서 보인 것을 모아 말한다. 넓은 화면에서 그 아래가 300px 넘게 비었다(1728×1117).
   그 자리에 장면의 스텝들이 가리킨 근거를 스텝 순서대로 두고, 누르면 그 스텝으로 간다.
   저작하지 않고 스텝의 ref·cite 에서 모은다(Delta.jsx 의 trailOf). */
export function TrailInline({ rows, onSeek }) {
  return (
    <section className="srci trail" aria-label="이 장면의 근거">
      <div className="srci-hd"><span className="s">이 장면의 근거</span><i>{rows.length} 곳</i></div>
      <div className="srci-cd">
        {rows.map((r) => (
          <button type="button" key={r.k} onClick={() => onSeek(r.k)} title={r.note}>
            <i>{String(r.k + 1).padStart(2, '0')}</i>
            {r.sym ? <><b>{r.sym}</b><span>{r.file}</span></> : <q>{r.q}</q>}
          </button>
        ))}
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
