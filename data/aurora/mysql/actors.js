const LANES = [
  { id:'comp', lb:'compute',  note:'DB 인스턴스' },
  { id:'stor', lb:'storage', note:'클러스터 볼륨' },
];
const ACTORS = {
  op:   { nm:'OPERATION',      lane:'comp', kind:'kv' },
  wr:   { nm:'WRITER',         lane:'comp', kind:'kv' },
  rd:   { nm:'READERS',        lane:'comp', kind:'list' },
  vol:  { nm:'CLUSTER VOLUME', lane:'stor', kind:'list' },
  cmp:  { nm:'vs INNODB',      lane:'stor', kind:'kv' },
  pc:   { nm:'PAGE CACHE',      lane:'comp', kind:'kv' },
  chk:  { nm:'검증 파이프라인',   lane:'comp', kind:'kv' },
  grade:{ nm:'근거 등급',       lane:'stor', kind:'kv' },
};
const EDGES = [
  /* 이 덱의 주제 자체가 이 경계다 — 문서가 compute 와 storage 를 나눠 설명한다. */
  { after:'comp', lb:'compute · storage', hot:'io' },
];

export { LANES, ACTORS, EDGES };
