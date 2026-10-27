/* 이동 이름표(act)가 정지 화면에 남는 자리 — 2026-10-27 사용자 결정("추천안대로").
   예전에는 덩어리가 도착하면(0.44 – 0.52) 이름표도 걷혔다. 그래서 이동만 있는 스텝은 정지 화면이 앞 스텝과 같았다
   (리뷰 g06 · g07 · g08 · g18a · g19b · nosql 이 따로따로 짚었다). 이제 도착한 뒤에도 이름표를 남긴다 —
   0.52 에 도착점 둘레에서 빈 자리를 찾아 0.56 까지 옮기고, 그 자리에 선다.
     빈 자리 = 무대(L) 안 · 보이는 다른 이름표와 3px 이상 떨어짐 · 밝은 알갱이(목표 ≥ 0.25)가 없음.
   자리는 스텝마다 한 번 정한다(key = 그 스텝의 상태 객체 — 손잡이 값마다 다르다, 배치 L 이 바뀌면 다시) —
   서 있는 동안 움직이면 storysweep hold-still 에 걸린다. 빈 자리가 없으면 예전처럼 걷힌다(0.52 – 0.56). */
import { U } from '../field.js';

const show = (p, a, b) => U.smooth(U.range(p, a, b));
const PAD = 3;
const memo = new WeakMap();

function find(F, el, L, x0, y0, ax, ay) {
  const w = el.offsetWidth, h = el.offsetHeight, box = el.parentElement;
  if (!w || !h || !box) return null;
  const others = [];
  for (const e of box.children) {
    if (e === el) continue;
    const o = e.style.opacity === '' ? 1 : parseFloat(e.style.opacity);
    if (!(o > 0.05)) continue;
    const r = e.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1) others.push(r);
  }
  const free = (x, y) => {
    if (x < L.x0 || y < L.y0 || x + w > L.x1 || y + h > L.y1) return false;
    const a0 = x - PAD, b0 = y - PAD, a1 = x + w + PAD, b1 = y + h + PAD;
    for (const r of others) if (r.left < a1 && r.right > a0 && r.top < b1 && r.bottom > b0) return false;
    for (let i = 0; i < F.N; i++) {
      if (F.ta[i] < 0.25) continue;
      const gx = F.tx[i], gy = F.ty[i];
      if (gx > x - 2 && gx < x + w + 2 && gy > y - 2 && gy < y + h + 2) return false;
    }
    return true;
  };
  /* 먼저 도착한 자리 그대로, 그다음 도착점 둘레를 넓혀 가며 — 오른쪽 위 · 오른쪽 아래 · 왼쪽 위 · 왼쪽 아래 · 위 · 아래 · 옆.
     84px 까지만 찾았을 때 1512 의 act 435 중 25 곳이 자리를 못 찾았다 */
  if (free(x0, y0)) return [x0, y0];
  for (const d of [12, 24, 40, 60, 84, 112, 144]) {
    for (const [x, y] of [[ax + d, ay - h - d * 0.5], [ax + d, ay + d * 0.5], [ax - w - d, ay - h - d * 0.5], [ax - w - d, ay + d * 0.5],
      [ax - w / 2, ay - h - d], [ax - w / 2, ay + d], [ax + d, ay - h / 2], [ax - w - d, ay - h / 2]]) if (free(x, y)) return [x, y];
  }
  return null;
}

/* 이동 이름표의 이 프레임 자리와 불투명도 배수 — (x, y) 는 세계가 계산한 날아가는 자리, (ax, ay) 는 도착점 */
export function dockAt(F, el, key, p, x, y, L, ax, ay) {
  if (p < 0.52 || !key) return [x, y, 1];
  let m = memo.get(key);
  if (!m || m.L !== L || m.t !== el.textContent) { m = { L, t: el.textContent, at: find(F, el, L, x, y, ax, ay) }; memo.set(key, m); }
  const q = show(p, 0.52, 0.56);
  if (!m.at) return [x, y, 1 - q];
  return [U.lerp(x, m.at[0], q), U.lerp(y, m.at[1], q), 1];
}
