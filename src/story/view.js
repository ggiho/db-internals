/* 세계 확대 — 세계는 검증된 크기의 가상 상자에 배치하고, 그 결과를 배율 s 로 키워 보인다.
   2026-10-23 측정 : 1920×1080 에서 세계가 영역 높이의 46% · 화면의 19% 만 썼고 이름표는 어디서나 11px 였다
   (제목은 38px). 영역만 넓히면 세계는 폭을 이미 다 쓰고 있어 옆으로 퍼질 뿐 커지지 않는다.
   그래서 배치는 가상 상자(영역 ÷ s)에서 하고, 알갱이는 canvas 변환으로, 이름표는 CSS 변환으로 같은 s 를 건다.

   세계들은 이름표를 getBoundingClientRect 로 잰다(25 파일). 변환이 걸린 이름표를 그대로 재면 s 배 큰 값이
   나와 가상 좌표의 배치가 어긋난다. 그래서 이름표 그릇 안의 요소가 재는 사각형만 가상 좌표로 되돌린다 —
   세계 코드는 그대로 둔다. offsetWidth 같은 배치 값은 변환과 무관해 이미 가상 좌표다.
   화면 좌표가 필요한 도구(storysweep)는 screenRect() 를 쓴다. */
export const VIEW = { s: 1, ox: 0, oy: 0, root: null };

const native = Element.prototype.getBoundingClientRect;
if (!Element.prototype.screenRect) {
  Element.prototype.screenRect = native;
  Element.prototype.getBoundingClientRect = function () {
    const r = native.call(this);
    const { s, ox, oy, root } = VIEW;
    if (s === 1 || !root || !root.contains(this)) return r;
    return new DOMRect(ox + (r.left - ox) / s, oy + (r.top - oy) / s, r.width / s, r.height / s);
  };
}

/* 가상 좌표 → 화면 좌표 (도구 · 검사용) */
export const toScreen = (x, y) => [VIEW.ox + (x - VIEW.ox) * VIEW.s, VIEW.oy + (y - VIEW.oy) * VIEW.s];

/* 배율 — 가상 상자가 700 × 600 아래로 줄지 않게(1280×720 의 옛 영역 587 × 558 이 모든 세계가 지나간 크기다),
   그리고 1.8 배까지 — 2 배에서는 2560 의 이름표(22px)가 왼쪽 key 글(15.5px)보다 커졌다.
   좁은 화면(< 820)은 글이 위에 오는 다른 배치라 키우지 않는다 */
export function zoomOf(w, h, narrow) {
  if (narrow) return 1;
  return Math.max(1, Math.min(1.8, w / 700, h / 600));
}

/* 세계 높이에 맞춰 더 키울 때의 한도(Story.jsx rebuild) — 가상 상자의 폭이 검증된 가장 좁은 폭 아래로 가지 않게.
   그 폭은 1024×768 의 영역 폭(배율 1, 2026-10-27 측정 583)이다 — 모든 세계가 8 크기 스윕에서 이 폭을 지나간다. 1.8 상한은 위와 같다 */
export const MIN_W = 590;
export const zoomMax = (w) => Math.max(1, Math.min(1.8, w / MIN_W));

/* 그릇에 변환을 건다 — 영역의 왼쪽 위(ox, oy)를 중심으로 키운다 */
export function applyView(labels, F, s, ox, oy) {
  VIEW.s = s; VIEW.ox = ox; VIEW.oy = oy; VIEW.root = labels;
  if (labels) {
    labels.style.transformOrigin = '0 0';
    labels.style.transform = s === 1 ? '' : `translate(${ox}px, ${oy}px) scale(${s}) translate(${-ox}px, ${-oy}px)`;
  }
  if (F) F.view = { s, ox, oy };
}
