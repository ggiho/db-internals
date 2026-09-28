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
  /* 표 구성(V · Vw · Vr)과 쓰기·읽기 가용성은 Protection Group 의 성질이다. 처음엔
     "ack 를 세는 것은 데이터베이스" 라서 compute 에 두었는데, 05 장면에서 compute 레인에
     이 카드 하나만 남아 레인 한 줄을 차지했고 넓은 화면에서 무대가 42px 넘쳤다. */
  qm:   { nm:'QUORUM',          lane:'stor', kind:'kv' },
  mdl:  { nm:'복제 모델',        lane:'stor', kind:'kv' },
};
const EDGES = [
  /* 이 덱의 주제 자체가 이 경계다 — 문서가 compute 와 storage 를 나눠 설명한다. */
  { after:'comp', lb:'compute · storage', hot:'io' },
];

export { LANES, ACTORS, EDGES };
