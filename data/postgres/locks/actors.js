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
};
const EDGES = [
  /* 락 표는 공유 메모리에 있고 튜플은 힙에 있다 — 재시작하면 앞쪽만 사라진다. */
  { after:'sql', lb:'락 표 · 튜플', hot:'io' },
];

export { LANES, ACTORS, EDGES };
