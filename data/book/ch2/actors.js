/* 2장의 배우 — 책이 말하는 층과 그 아래 물리 층.
   lane 이 책의 논지를 그대로 따른다 : 논리 구조 → (블록이라는 경계) → 물리 매체 */
const ACTORS = {
  /* ── 논리 : 자료구조 ── */
  op:   { nm:'OPERATION',        lane:'logic', kind:'kv', w:'w2' },
  bst:  { nm:'BINARY TREE',      lane:'logic', kind:'tree', w:'w2' },
  bt:   { nm:'B-TREE',           lane:'logic', kind:'tree', w:'w2' },
  node: { nm:'NODE  (PAGE)',     lane:'logic', kind:'list', w:'w15' },
  sep:  { nm:'SEPARATOR KEYS',   lane:'logic', kind:'axis', w:'w2' },
  cost: { nm:'COST',             lane:'logic', kind:'kv' },

  /* ── 물리 : 블록·페이지 ── */
  blk:  { nm:'BLOCK  (16KB)',    lane:'phys',  kind:'bytes', w:'w2' },
  hdd:  { nm:'HDD',              lane:'phys',  kind:'kv' },
  ssd:  { nm:'SSD',              lane:'phys',  kind:'kv' },
  ftl:  { nm:'FTL',              lane:'phys',  kind:'list', w:'w15' },
  io:   { nm:'DISK I/O',         lane:'phys',  kind:'kv' },
};
const LANES = [
  { id:'logic', lb:'논리 구조', note:'책이 서술하는 층' },
  { id:'phys',  lb:'물리 매체',  note:'블록이 최소 단위' },
];
const EDGES = [
  { after:'logic', lb:'블록 경계', hot:'block' },
];

export { ACTORS, LANES, EDGES };
