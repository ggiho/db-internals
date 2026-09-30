/* 배우는 InnoDB 것을 쓸 수 없다 — 옛 버전이 undo 가 아니라 메모리의 사슬과
   history store 에 있고, 페이지는 제자리에 쓰이지 않는다. */
const LANES = [
  /* 07 쓰기 충돌 · 09 시각으로 읽기에서 쓴다 — 배우가 없는 레인은 무대에 안 나온다 */
  { id:'cli',  lb:'CLIENT', note:'클라이언트 연결' },
  { id:'mem',  lb:'CACHE', note:'WiredTiger 캐시 — 메모리' },
  { id:'disk', lb:'DISK',  note:'데이터 파일 · journal' },
  /* 06 쓰기 경로에서만 쓴다 — 복제는 다른 노드다 */
  { id:'repl', lb:'REPLICA SET', note:'secondary · 과반' },
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
  oplog: { nm:'OPLOG',         lane:'mem',  kind:'list' },
  ts:    { nm:'TIMESTAMPS',    lane:'mem',  kind:'kv' },
  sec:   { nm:'SECONDARY',     lane:'repl', kind:'kv' },
  sa:    { nm:'SESSION A',     lane:'cli',  kind:'kv' },
  sb:    { nm:'SESSION B',     lane:'cli',  kind:'kv' },
};
const EDGES = [
  /* 메모리의 페이지(이미지 + 사슬)가 디스크 이미지로 바뀌는 경계 — reconciliation 이다.
     reconcile/rec_write.c 의 __wt_reconcile 이 그 일을 한다. 로그는 같은 경계를 journal 로
     건넌다(04 · 06 · 08) — 이름에 둘 다 적는다. */
  { after:'mem', before:'disk', lb:'reconciliation · journal', hot:'io' },
  /* 이 노드와 다른 노드 사이 — oplog 를 끌어가는 복제다. DISK 가 무대에 없으면
     CACHE 바로 아래에 REPLICA SET 이 붙는다(06/8). */
  { after:'disk', before:'repl', lb:'oplog 복제', hot:'repl' },
  { after:'mem', before:'repl', lb:'oplog 복제', hot:'repl' },
];

export { LANES, ACTORS, EDGES };
