const LANES = [
  { id:'op',   lb:'연산',   note:'무엇을 하는가' },
  { id:'page', lb:'PAGE',   note:'8KB 한 장' },
];
const ACTORS = {
  op:  { nm:'OPERATION',   lane:'op',   kind:'kv' },
  hdr: { nm:'PAGE HEADER', lane:'page', kind:'bytes' },
  lp:  { nm:'LINE POINTERS', lane:'page', kind:'list' },
  sp:  { nm:'FREE SPACE',  lane:'page', kind:'kv' },
  cmp: { nm:'vs INNODB',   lane:'page', kind:'kv' },
};
const EDGES = [
  /* 연산은 페이지 한 장을 단위로 일어난다 — PG 의 기본 블록은 8KB 다. */
  { after:'op', lb:'8KB 페이지 경계', hot:'block' },
];

export { LANES, ACTORS, EDGES };
