/* Story 가 있는 장면 — 세계(worlds/)를 불러오지 않고 판정한다. main.jsx 가 첫 화면을 고를 때와
   Lab 머리글이 STORY 링크를 낼지 정할 때 쓴다. 세계를 늘리면 여기와 worlds/index.js 에 함께 적는다.
   first 는 장면 없이 들어온 주소(#book/ch3 · 빈 주소)가 열 장면이다 — Lab 이 같은 경우 첫 장면을 연다. */
/* first 는 그 덱의 첫 장면이다. 숨은 짝 장면(05v · 02v · 03v)도 적는다.
   ch3 의 01 · 01v · 06b 는 전용 세계, 나머지는 범용 무대(worlds/stage.js — 배우 종류 여덟 가지를 그린다)다.
   목록은 덱의 장면 순서대로 뽑아 적었다(2026-10-13, 98 장면 전부). storysweep.js 가 시작할 때 무대 장면이
   정말 그 조건에 맞는지 먼저 본다 */
export const STORY = {
  'mysql/innodb':       { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '05v'] },
  'mysql/locks':        { first: '01', nums: ['01', '02', '02v', '03', '04', '05', '06', '06v', '07', '08', '09', '10', '11', '12'] },
  'postgres/mvcc':      { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'] },
  'postgres/heap':      { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'] },
  'postgres/buffer':    { first: '01', nums: ['01', '02', '03', '04', '05', '06'] },
  'postgres/btree':     { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07'] },
  'postgres/locks':     { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07', '08'] },
  'postgres/wal':       { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07', '08'] },
  'aurora/mysql':       { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07'] },
  'mongodb/wiredtiger': { first: '01', nums: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'] },
  'book/ch2':           { first: '01', nums: ['01', '02', '03', '03v', '04', '05', '05v', '06', '06a', '07', '08', '08a', '08b', '09', '10', '10a', '11'] },
  'book/ch3':           { first: '01', nums: ['01', '01v', '02', '02a', '03', '03a', '04', '04a', '04b', '04bv', '04c', '05', '05v', '06', '06a', '06b', '07', '07a', '08', '08a', '09', '09a', '10', '11'] },
};
export const DEFAULT_DECK = 'book/ch3';

export function hasStory(r) {
  if (!r) return false;
  const s = STORY[r.deck || DEFAULT_DECK];
  return !!s && s.nums.includes(r.num || s.first);
}

/* 두 화면은 주소의 ?lab 하나로 갈린다 — 해시(장면 · 스텝)는 그대로 둔다.
   pushState 는 hashchange 를 내지 않으므로 popstate 를 직접 내서 main.jsx 가 다시 고르게 한다.
   뒤로가기는 브라우저가 내는 popstate 로 같은 길을 탄다. */
function go(search, hash) {
  history.pushState(null, '', location.pathname + search + '#' + hash);
  dispatchEvent(new PopStateEvent('popstate'));
}
export const toLab = (hash) => go('?lab', hash);
export const toStory = (hash) => go('', hash);
export const isLab = () => new URLSearchParams(location.search).has('lab');
