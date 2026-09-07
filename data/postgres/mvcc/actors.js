/* 배우는 InnoDB 것을 쓸 수 없다 — PG 는 옛 버전을 힙에 두고 VACUUM 이 치운다. */
const LANES = [
  { id:'sql',  lb:'SQL 계층',  note:'문장' },
  { id:'heap', lb:'HEAP',      note:'튜플 · 페이지' },
];
const ACTORS = {
  op:  { nm:'OPERATION',    lane:'sql',  kind:'kv' },
  tup: { nm:'HEAP TUPLES',  lane:'heap', kind:'list' },
  hdr: { nm:'TUPLE HEADER', lane:'heap', kind:'kv' },
};

/* 흐름 화살표 — 아직 장면 간 이동만 있어 비어 있다 */
const EDGES = [];

export { LANES, ACTORS, EDGES };
