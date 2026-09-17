const LANES = [
  { id:'comp', lb:'컴퓨트',  note:'DB 인스턴스' },
  { id:'stor', lb:'스토리지', note:'클러스터 볼륨' },
];
const ACTORS = {
  op:   { nm:'OPERATION',      lane:'comp', kind:'kv' },
  wr:   { nm:'WRITER',         lane:'comp', kind:'kv' },
  rd:   { nm:'READERS',        lane:'comp', kind:'list' },
  vol:  { nm:'CLUSTER VOLUME', lane:'stor', kind:'list' },
  cmp:  { nm:'vs INNODB',      lane:'stor', kind:'kv' },
  grade:{ nm:'근거 등급',       lane:'stor', kind:'kv' },
};
const EDGES = [];

export { LANES, ACTORS, EDGES };
