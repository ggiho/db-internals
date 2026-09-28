/* 배우는 InnoDB 것을 쓸 수 없다 — 옛 버전이 undo 가 아니라 메모리의 사슬과
   history store 에 있고, 페이지는 제자리에 쓰이지 않는다. */
const LANES = [
  { id:'mem',  lb:'CACHE', note:'WiredTiger 캐시 — 메모리' },
  { id:'disk', lb:'DISK',  note:'데이터 파일 · journal' },
];
const ACTORS = {
  op:    { nm:'OPERATION',     lane:'mem',  kind:'kv' },
  chain: { nm:'UPDATE CHAIN',  lane:'mem',  kind:'list' },
  snap:  { nm:'SNAPSHOT',      lane:'mem',  kind:'kv' },
  cache: { nm:'CACHE',         lane:'mem',  kind:'kv' },
  img:   { nm:'DISK IMAGE',    lane:'disk', kind:'list' },
  hs:    { nm:'HISTORY STORE', lane:'disk', kind:'list' },
  jr:    { nm:'JOURNAL',       lane:'disk', kind:'list' },
  ck:    { nm:'CHECKPOINT',    lane:'disk', kind:'kv' },
  cmp:   { nm:'vs INNODB',     lane:'disk', kind:'kv' },
};
const EDGES = [
  /* 메모리의 페이지(이미지 + 사슬)가 디스크 이미지로 바뀌는 경계 — reconciliation 이다.
     reconcile/rec_write.c 의 __wt_reconcile 이 그 일을 한다. */
  { after:'mem', lb:'reconciliation', hot:'io' },
];

export { LANES, ACTORS, EDGES };
