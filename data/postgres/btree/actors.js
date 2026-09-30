const LANES = [
  { id:'sql', lb:'SQL 계층', note:'문장' },
  { id:'idx', lb:'인덱스',   note:'트리 · 페이지' },
];
const ACTORS = {
  op:    { nm:'OPERATION',   lane:'sql', kind:'kv' },
  cmp:   { nm:'vs INNODB',   lane:'sql', kind:'kv' },
  bt:    { nm:'B-TREE',      lane:'idx', kind:'tree', w:'w2' },
  leaf:  { nm:'LEAF PAGE',   lane:'idx', kind:'list' },
  right: { nm:'RIGHT PAGE',  lane:'idx', kind:'list' },
};
const EDGES = [
  /* SQL 계층과 인덱스 사이는 index access method 다 — access/amapi.h 의 IndexAmRoutine 이
     그 경계이고 bthandler 가 B-tree 구현을 돌려준다. */
  { after:'sql', lb:'INDEX AM', hot:'boundary' },
];

export { LANES, ACTORS, EDGES };
