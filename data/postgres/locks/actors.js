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
const EDGES = [];

export { LANES, ACTORS, EDGES };
