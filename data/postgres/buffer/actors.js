/* 그림의 shared buffers 는 여섯 칸으로 줄였다 — 실제로는 기본 16384 칸(128MB)이다. */
const LANES = [
  { id:'proc', lb:'프로세스', note:'백엔드 · bgwriter' },
  { id:'mem',  lb:'공유 메모리', note:'매핑 표 · 버퍼' },
  { id:'disk', lb:'디스크', note:'힙 파일' },
];
const ACTORS = {
  be:   { nm:'BACKEND',          lane:'proc', kind:'kv' },
  bgw:  { nm:'BGWRITER',         lane:'proc', kind:'kv' },
  map:  { nm:'BUFFER MAPPING',   lane:'mem',  kind:'kv' },
  pool: { nm:'SHARED BUFFERS',   lane:'mem',  kind:'list' },
  ring: { nm:'RING (BULKREAD)',  lane:'mem',  kind:'list' },
  heap: { nm:'HEAP FILE',        lane:'disk', kind:'list' },
  cmp:  { nm:'vs INNODB',        lane:'disk', kind:'kv' },
};
const EDGES = [
  /* 버퍼를 비우려면 먼저 써야 한다 — 쓰는 쪽이 누구냐가 01 장면의 요점이다 */
  { after:'mem', lb:'버퍼 → 파일', hot:'io' },
];

export { LANES, ACTORS, EDGES };
