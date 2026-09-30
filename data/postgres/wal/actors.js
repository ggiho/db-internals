const LANES = [
  /* 04 커밋 경로에서만 쓴다 — 배우가 없는 레인은 무대에 안 나온다 */
  { id:'proc', lb:'프로세스', note:'백엔드 · walwriter' },
  { id:'mem',  lb:'메모리', note:'버퍼 · WAL 버퍼' },
  { id:'disk', lb:'디스크', note:'WAL 세그먼트 · 힙 파일' },
];
const ACTORS = {
  op:   { nm:'OPERATION',   lane:'mem',  kind:'kv' },
  buf:  { nm:'SHARED BUFFER', lane:'mem', kind:'list' },
  rec:  { nm:'WAL RECORD',  lane:'mem',  kind:'bytes' },
  seg:  { nm:'WAL SEGMENT', lane:'disk', kind:'list' },
  heap: { nm:'HEAP FILE',   lane:'disk', kind:'list' },
  cmp:  { nm:'vs INNODB',   lane:'disk', kind:'kv' },
  be:   { nm:'BACKEND',     lane:'proc', kind:'kv' },
  wwr:  { nm:'WALWRITER',   lane:'proc', kind:'kv' },
  wbuf: { nm:'WAL BUFFERS', lane:'mem',  kind:'kv' },
  xact: { nm:'PG_XACT',     lane:'mem',  kind:'list' },
  parr: { nm:'PROCARRAY',   lane:'mem',  kind:'list' },
};
const EDGES = [
  /* WAL 이 먼저 디스크에 가야 한다 — 그 경계가 이 덱의 주제다. */
  { after:'mem', lb:'WAL 먼저 · 그다음 페이지', hot:'io' },
];

export { LANES, ACTORS, EDGES };
