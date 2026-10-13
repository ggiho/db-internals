/* 장면 → 세계. 전용 세계(BESPOKE)가 있으면 그것, 없으면 STORY 에 적힌 장면은 범용 무대다.
   전용 세계는 짝 장면이 같은 id 를 쓴다(01 · 01v) — 짝을 바꿔도 장을 다시 만들지 않고 알갱이가 그 자리에서 날아간다.
   무대는 장면마다 id 가 다르다 — 무대는 만들 때 그 장면의 배우 · 각본으로 상자를 짜므로, 짝을 바꾸면 새로 짜야 한다. */
import { STORY } from '../has.js';

const ch301 = { id: 'ch3-01', load: () => import('./ch3-01.js') };
const ch306b = { id: 'ch3-06b', load: () => import('./ch3-06b.js') };
const pgBuf01 = { id: 'pg-buffer-01', load: () => import('./pg-buffer-01.js') };
const loadStage = () => import('./stage.js');

export const BESPOKE = {
  'book/ch3': { '01': ch301, '01v': ch301, '06b': ch306b },
  'postgres/buffer': { '01': pgBuf01 },
};

export function worldOf(deck, num) {
  const b = BESPOKE[deck] && BESPOKE[deck][num];
  if (b) return b;
  return STORY[deck] && STORY[deck].nums.includes(num) ? { id: 'stage:' + deck + '/' + num, load: loadStage } : null;
}
