const LANES = [
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
};
const EDGES = [
  /* WAL 이 먼저 디스크에 가야 한다 — 그 경계가 이 덱의 주제다. */
  { after:'mem', lb:'WAL 먼저 · 그다음 페이지', hot:'io' },
];

export { LANES, ACTORS, EDGES };
