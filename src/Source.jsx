import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { highlight } from './hl.js';

/* 인라인 소스 : 무대가 쓰지 않은 높이를 이 스텝의 "근거" 로 채운다.
   한 레인짜리 장면은 무대의 70% 가 비어 있었고, 레인을 늘려봐도 여백이 카드 *안* 으로
   옮겨갈 뿐이었다. 그 높이에 넣을 정보는 이미 데이터에 있다 — CODE 발췌는
   저장소 원문과 글자까지 대조한 것들이다.
   남는 높이가 한 줌이면 보여주지 않는다. 문턱은 "코드 창이 몇 줄을 보여주는가" 로 정한다:
   머리 17px + 패딩 8px 을 빼고 10줄(160px)이 남아야 한다 → 184px.
   (144px 짜리 상자는 7줄 창에 21줄 발췌를 담아 스크롤바만 남겼다.) */
export const SRC_MIN = 184;

/* ── 줄 경계 스냅 ──────────────────────────────────────────────
   여기가 이 파일에서 가장 조심할 곳이다.

   1) offsetHeight · scrollTop · scrollHeight · clientHeight 는 모두 *확대 전* CSS px 이다.
      getBoundingClientRect() 는 CSS zoom 이 곱해진 값을 준다. 둘을 섞으면 초광폭
      (zoom 1.5) 에서 줄높이가 rect 로는 24px, CSS 로는 16px 이라 계산이 통째로 어긋난다.
      그래서 이 함수는 rect 를 한 번도 쓰지 않는다.
   2) 넣은 값을 다시 읽어 확인한다. 브라우저는 scrollTop 을 클램프하고 장치 픽셀로
      양자화하므로, 계산한 한계(48)가 실제 한계(47.2)보다 클 수 있고 그러면 배수가 아닌
      값이 들어간다. 배수가 아니면 한 줄 *내린다* — 내리는 방향이라 다시 잘릴 일이 없다.
   3) 한 번만 계산하면 안 된다. 카드 높이 전환이 끝나기 전에 재면 그때의 최대값과
      최종 최대값이 달라 어긋난 채로 남는다 → 상자 크기가 바뀔 때마다 (ResizeObserver)
      다시 세운다. scrollTop 을 바꾸는 것은 크기를 바꾸지 않으므로 순환하지 않는다. */
export function snapSrc(cd) {
  if (!cd) return;
  const l = cd.querySelector('.ln');
  if (!l) return;
  const lh = l.offsetHeight || 16;
  const max = Math.max(0, cd.scrollHeight - cd.clientHeight);
  const cur = Math.min(cd.scrollTop, max);
  cd.scrollTop = Math.max(0, Math.min(Math.round(cur / lh) * lh, Math.floor(max / lh) * lh));
  if (cd.scrollTop % lh > 0.5) cd.scrollTop = Math.floor(cd.scrollTop / lh) * lh;
}

function Line({ n, toks, hit }) {
  return (
    <span className={'ln' + (n === hit ? ' hit' : '')}>
      <i>{n}</i>
      {toks.map((t, k) => (t.c ? <span key={k} className={t.c}>{t.v}</span> : t.v))}
    </span>
  );
}

function key(step) {
  return step && step.ref && step.sym ? step.ref + '#' + step.sym : null;
}

/* ══════════ 인라인 패널 ══════════ */
export default function Source({ deck, step, off, onVisible }) {
  const k = key(step);
  const code = k ? deck.CODE[k] : null;
  const lines = useMemo(() => highlight(code), [code]);
  const box = useRef(null);
  const cd = useRef(null);
  const [small, setSmall] = useState(false);

  /* 강조 줄을 위쪽에 세운다. 픽셀을 재지 않고 *줄 번호* 로 계산한다 —
     발췌는 from 부터 한 줄씩이므로 몇 번째 줄인지 이미 알고 있다.
     그래야 zoom 이나 offsetParent 와 무관하게 항상 맞는다.
     (rect 로 재던 옛 방식은 zoom 1.5 · 2.6 에서 277/600 회 어긋났다.)

     "이미 세워 뒀는가" 를 의존성 배열이 아니라 *DOM 노드 자신* 에 적어 둔다.
     [code] 로 걸면 비교 모드를 껐다 켤 때 어긋난다 — 그때 상자가 언마운트되어
     새 노드(scrollTop 0)로 다시 붙지만 code 는 같은 객체라 효과가 다시 돌지 않는다.
     실측으로 잡혔다: V 를 두 번 누르면 scrollTop 64 → 0 이 되고 innodb/05/4 에서는
     강조 줄이 창 밖으로 나갔다. 새 노드에는 dataset.k 가 없으므로 이 방식은 늘 맞는다. */
  useLayoutEffect(() => {
    const el = cd.current;
    if (!el || !code || el.dataset.k === k) return;
    el.dataset.k = k;
    const l = el.querySelector('.ln');
    const lh = (l && l.offsetHeight) || 16;
    el.scrollTop = Math.max(0, (code.hit - code.from - 2) * lh);
    snapSrc(el);
  });

  /* 상자가 커지거나 작아질 때마다 다시 스냅하고, 남는 높이가 문턱 아래면 감춘다.
     감추기는 display:none 이 아니라 visibility:hidden 이다 — 상자를 없애면
     "남는 높이" 를 잴 대상이 사라져서, 다음 스텝에 다시 보여줄지 판단할 수 없다.
     (무대는 내용만큼만 차지하므로 상자를 없애도 레이아웃은 같다. 그래서
      숨긴 상태로 자리만 지켜도 눈에 보이는 차이가 없고 측정은 계속 가능하다.) */
  useLayoutEffect(() => {
    const b = box.current, el = cd.current;
    if (!b || !el) return;
    const measure = () => { snapSrc(el); setSmall(b.offsetHeight < SRC_MIN); };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(el);
    return () => ro.disconnect();
  }, [code]);

  const shown = !off && !!code && !small;
  /* 인라인 소스가 보이면 캡션의 ref 줄은 같은 것을 두 번 말하는 셈이다 → App 이 흐리게 한다 */
  useEffect(() => { if (onVisible) onVisible(shown); }, [shown, onVisible]);

  /* ↑ 훅은 전부 이 위에 있다. 조건부 훅은 React #310 으로 화면을 통째로 날린다. */
  if (off || !code) return null;

  return (
    <section ref={box} className={'srcin' + (small ? ' small' : '')} aria-label="이 스텝의 소스"
      aria-hidden={small ? 'true' : 'false'}>
      <div className="srcin-hd">
        <b>{step.ref}:{code.hit}</b>
        <span>{step.sym}</span>
        <i>이 스텝의 근거</i>
      </div>
      <div className="srcin-cd" ref={cd}>
        {lines.map((l) => <Line key={l.n} n={l.n} toks={l.toks} hit={code.hit} />)}
      </div>
    </section>
  );
}

/* ══════════ 모달 (S 키 · 캡션의 ref 클릭) ══════════
   인라인이 감춰졌거나 발췌를 크게 읽고 싶을 때. 여기서는 늘 맨 위에서 시작하므로
   (옛 판도 scrollTop = 0 이었다) 줄 경계 문제가 없다 — 그래도 줄높이는 정수로 못박는다. */
export function SourceModal({ deck, step, open, onClose }) {
  const k = key(step);
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
              {lines.map((l) => <Line key={l.n} n={l.n} toks={l.toks} hit={code.hit} />)}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
