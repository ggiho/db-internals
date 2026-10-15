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
  /* TOAST 장면용 — 줄여야 하는 튜플과, 밖으로 나간 조각이 쌓이는 딸림 테이블. */
  tup: { nm:'TUPLE',       lane:'op',   kind:'bytes' },
  tst: { nm:'TOAST TABLE', lane:'page', kind:'list' },
  /* FSM 장면용 — 한 바이트로 줄인 요약들과, 그것을 담은 3단 페이지 트리. */
  fsm: { nm:'FSM PAGE',    lane:'page', kind:'bytes' },
  tree:{ nm:'FSM TREE',    lane:'page', kind:'tree' },
  /* 페이지 한 장을 바이트 그대로 — 항목마다 off · len · k(hdr · lp · tup · pad · gap · spc). pd_lower · pd_upper 는 세계가 셈한다 */
  pg:  { nm:'PAGE 8KB',    lane:'page', kind:'list' },
  /* TOAST 포인터 18 바이트(04) · 열 순서 두 가지의 행(08) · 체크섬(10) · relation 의 블록들(09) */
  tp:  { nm:'TOAST POINTER', lane:'page', kind:'bytes' },
  r1:  { nm:'ROW  t1 (a bool, b int8, c bool, d int8)', lane:'page', kind:'bytes' },
  r2:  { nm:'ROW  t2 (b int8, d int8, a bool, c bool)', lane:'page', kind:'bytes' },
  ck:  { nm:'CHECKSUM',    lane:'op',   kind:'kv' },
  blk: { nm:'RELATION BLOCKS', lane:'page', kind:'list' },
};
const EDGES = [
  /* 연산은 페이지 한 장을 단위로 일어난다 — PG 의 기본 블록은 8KB 다. */
  { after:'op', lb:'8KB 페이지 경계', hot:'block' },
];

export { LANES, ACTORS, EDGES };
