import { useEffect, useRef } from 'react';

const clamp = (n, a, b) => (n < a ? a : n > b ? b : n);
export const REDUCED = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 요점 스텝(beat)은 더 머문다 — 읽을 것이 많다. 행위가 있는 스텝도 조금 더. */
const hold = (s) => (s && s.beat ? 4200 : s && s.act ? 2600 : 2200);

const ICON = {
  play: <svg viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z" /></svg>,
  pause: <svg viewBox="0 0 12 12"><path d="M2 1h3v10H2zM7 1h3v10H7z" /></svg>,
};

/* ══════════ 재생 · 스크럽 · 키보드 ══════════
   타이머를 명령형 체인(setTimeout 안에서 다시 setTimeout)으로 두지 않는다.
   React 에서는 (playing, i) 가 바뀔 때마다 효과를 다시 걸면 되고, 그러면
   스크럽·키보드로 i 가 바뀔 때 옛 타이머가 자동으로 취소된다 —
   옛 판에서 clearTimeout 을 빠뜨려 두 개가 동시에 도는 일이 있었다. */
export default function Playback({
  steps, i, onSeek,               // 타임라인
  playing, setPlaying,
  sceneCount, onSceneIndex,       // 1–9
  hasPair, split, onToggleSplit, vsLabel,
  hasSrc, srcOpen, onOpenSrc, onCloseSrc,
}) {
  const last = steps.length - 1;
  const track = useRef(null);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (i >= last) setPlaying(false);          // 끝에서 멈춘다
      else onSeek(i + 1);
    }, hold(steps[i]));
    return () => clearTimeout(t);
  }, [playing, i, last, steps, onSeek, setPlaying]);

  /* 키보드. 소스 패널이 열려 있으면 무대 조작을 막는다 —
     안 그러면 패널 뒤에서 스텝이 넘어가서 보고 있던 발췌와 캡션이 어긋난다. */
  useEffect(() => {
    const key = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (srcOpen) {
        if (k === 'Escape' || k === 's' || k === 'S') { e.preventDefault(); onCloseSrc(); }
        return;
      }
      if (k === 's' || k === 'S') { if (hasSrc) { setPlaying(false); onOpenSrc(); } return; }
      if (k === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      else if (k === 'ArrowRight' || k === 'j') { setPlaying(false); onSeek(Math.min(i + 1, last)); }
      else if (k === 'ArrowLeft' || k === 'k') { setPlaying(false); onSeek(Math.max(i - 1, 0)); }
      else if (k === 'Home') { setPlaying(false); onSeek(0); }
      else if (k === 'End') { setPlaying(false); onSeek(last); }
      else if (k === 'v' || k === 'V') { if (hasPair) onToggleSplit(); }
      else if (/^[1-9]$/.test(k) && +k <= sceneCount) onSceneIndex(+k - 1);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [i, last, srcOpen, hasSrc, hasPair, sceneCount,
      onSeek, setPlaying, onOpenSrc, onCloseSrc, onToggleSplit, onSceneIndex]);

  /* 스크럽 : 트랙 안에서의 비율 → 스텝. 여기서는 rect 를 써도 된다 —
     rect 대 rect 의 비율이라 zoom 이 분자·분모에 똑같이 곱해지고 약분된다. */
  const seek = (e) => {
    const t = track.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const p = clamp((e.clientX - r.left) / (r.width || 1), 0, 1);
    onSeek(Math.round(p * last));
  };

  const at = (k) => (last > 0 ? (k / last) * 100 : 0);

  return (
    <div className="play">
      <button className="pp" aria-label={playing ? '일시정지' : '재생'}
        onClick={() => setPlaying((p) => !p)}>
        {playing ? ICON.pause : ICON.play}
      </button>

      <div className="track" ref={track} role="slider" tabIndex={0}
        aria-label="타임라인" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1}
        onPointerDown={(e) => {
          setPlaying(false);
          try { track.current.setPointerCapture(e.pointerId); } catch { /* 캡처 실패는 무해 */ }
          seek(e);
        }}
        onPointerMove={(e) => { if (track.current && track.current.hasPointerCapture(e.pointerId)) seek(e); }}>
        <div className="fill" style={{ width: at(i) + '%' }} />
        <div className="ticks">
          {steps.map((s, k) => (
            <i key={k} className={(s.beat ? 'beat' : '') + (k <= i ? ' done' : '')}
              style={{ left: at(k) + '%' }} />
          ))}
        </div>
        <div className="knob" style={{ left: at(i) + '%' }} />
      </div>

      <div className="cnt"><b>{String(i + 1).padStart(2, '0')}</b> / {String(steps.length).padStart(2, '0')}</div>

      {hasPair && (
        <button className={'vs' + (split ? ' on' : '')} onClick={onToggleSplit}
          title={vsLabel || ''}>
          {split ? '한 개로  V' : '나란히 보기  V'}
        </button>
      )}
    </div>
  );
}
