/* 그림의 shared buffers 는 여섯 칸으로 줄였다 — 실제로는 기본 16384 칸(128MB)이다.
   list 항목의 u · pin 은 세계가 읽는 구조 필드다(usage_count · 참조 수). sub 의 글은 Lab 이 보여 준다. */
const LANES = [
  { id:'proc', lb:'프로세스', note:'백엔드 · bgwriter · IO worker' },
  { id:'mem',  lb:'공유 메모리', note:'매핑 표 · 버퍼 · 헤더' },
  { id:'disk', lb:'디스크', note:'heap 파일' },
];
const ACTORS = {
  be:   { nm:'BACKEND',          lane:'proc', kind:'kv' },
  ba:   { nm:'BACKEND A',        lane:'proc', kind:'kv' },
  bb:   { nm:'BACKEND B',        lane:'proc', kind:'kv' },
  vac:  { nm:'VACUUM',           lane:'proc', kind:'kv' },
  bgw:  { nm:'BGWRITER',         lane:'proc', kind:'kv' },
  iow:  { nm:'IO WORKERS',       lane:'proc', kind:'kv' },
  map:  { nm:'BUFFER MAPPING',   lane:'mem',  kind:'kv' },
  clk:  { nm:'STRATEGY CONTROL', lane:'mem',  kind:'kv' },
  /* 버퍼 하나의 헤더 — state 워드(refcount · usage_count · flags)와 그 밖의 칸 */
  st:   { nm:'BUFFER STATE  ·  buf 7', lane:'mem', kind:'kv' },
  cl:   { nm:'CONTENT LOCK  ·  buf 7', lane:'mem', kind:'kv' },
  tag:  { nm:'BUFFER TAG',       lane:'mem',  kind:'list' },
  strm: { nm:'READ STREAM',      lane:'mem',  kind:'list' },
  ios:  { nm:'IN-PROGRESS I/O',  lane:'mem',  kind:'list' },
  pool: { nm:'SHARED BUFFERS',   lane:'mem',  kind:'list' },
  ring: { nm:'RING (BULKREAD)',  lane:'mem',  kind:'list' },
  heap: { nm:'HEAP FILE',        lane:'disk', kind:'list' },
  cmp:  { nm:'vs INNODB',        lane:'disk', kind:'kv' },
  /* 진짜 서버(PG 18.6)에서 잰 값 — 그림의 줄인 칸들과 따로, 그 서버의 shared buffers 전체 · 뷰의 수를 본다 */
  pbc:  { nm:'MEASURED  ·  PG 18.6', lane:'mem', kind:'kv' },
};
const EDGES = [
  /* 버퍼를 비우려면 먼저 써야 한다 — 쓰는 쪽이 누구냐가 01 장면의 요점이다 */
  { after:'mem', lb:'버퍼 → 파일', hot:'io' },
];

export { LANES, ACTORS, EDGES };
