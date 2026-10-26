const LANES = [
  { id:'sql',  lb:'서버',   note:'문장 · 락 표' },
  { id:'heap', lb:'HEAP',   note:'튜플' },
];
const ACTORS = {
  stmt: { nm:'STATEMENT',  lane:'sql',  kind:'kv' },
  tbl:  { nm:'TABLE LOCKS', lane:'sql', kind:'list' },
  cmx:  { nm:'충돌 행렬',   lane:'sql',  kind:'matrix' },
  tup:  { nm:'TUPLE',      lane:'heap', kind:'kv' },
  cmp:  { nm:'vs INNODB',  lane:'heap', kind:'kv' },
  /* 교착 장면용 — 기다리는 백엔드와 그 사이의 간선. InnoDB 덱의 wait 배우와 같은 역할이다. */
  wait: { nm:'WAIT QUEUE', lane:'sql',  kind:'graph' },
  /* 04 — 행 락은 락 표가 아니라 튜플의 xmax 에 있다(01 장면). TABLE LOCKS 의 칸으로 그렸더니 01 의 요점과 어긋났다 */
  rows: { nm:'ROW LOCKS  ·  xmax', lane:'heap', kind:'list' },
  /* SSI 장면용 — 막지 않는 SIREAD 락과, 읽기·쓰기 사이의 conflict 방향. */
  sir:  { nm:'SIREAD LOCKS', lane:'sql', kind:'list' },
  /* rw-conflict 도 predicate.c 의 공유 메모리(RWConflictPool)에 있다 — 튜플이 아니다. heap 에 두었더니 05 의 경계선이
     SIREAD 와 RW-CONFLICT 사이가 아닌 엉뚱한 자리에 섰다 */
  rw:   { nm:'RW-CONFLICT', lane:'sql', kind:'graph' },
  /* 06 · 08 — LOCK 객체 하나의 granted 와 wait queue. 항목의 q(granted · waiting) 와 mode 로 세계가 grantMask · waitMask 를 셈한다 */
  lq:   { nm:'LOCK  relation t', lane:'sql', kind:'list' },
  /* 07 — 행 락 네 단계의 충돌 표(heavyweight 모드로 대응해 셈한다) */
  rmx:  { nm:'행 락 충돌',  lane:'heap', kind:'matrix' },
  /* 08 — 락 표의 열쇠(16 바이트)와 파티션 */
  ltag: { nm:'LOCKTAG  ·  16 B', lane:'sql', kind:'bytes' },
  part: { nm:'LOCK PARTITIONS', lane:'sql', kind:'list' },
};
const EDGES = [
  /* 락 표는 공유 메모리에 있고 튜플은 힙에 있다 — 재시작하면 앞쪽만 사라진다. */
  { after:'sql', lb:'락 표 · 튜플', hot:'io' },
];

export { LANES, ACTORS, EDGES };
