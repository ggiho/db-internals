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
  /* 06 쓰기 경로 — 인스턴스가 네트워크로 내보내는 쓰기와, 그것을 받는 storage 노드의 8 단계 */
  io:   { nm:'NETWORK WRITES',  lane:'comp', kind:'list' },
  sn:   { nm:'STORAGE NODE',    lane:'stor', kind:'list' },
  /* 07 일관성 지점 — 데이터베이스가 들고 있는 LSN 들과 커밋을 기다리는 목록 */
  /* 08 세그먼트와 수리 — 볼륨을 이루는 PG 의 셈과, 고장 하나를 고치는 데 드는 시간(규칙으로 계산) */
  seg:  { nm:'SEGMENT · PG',    lane:'stor', kind:'kv' },
  rep:  { nm:'REPAIR TIME',     lane:'stor', kind:'kv' },
  lsn:  { nm:'LSN POINTS',      lane:'comp', kind:'kv' },
  cq:   { nm:'COMMIT QUEUE',    lane:'comp', kind:'list' },
};
const EDGES = [
  /* 이 덱의 주제 자체가 이 경계다 — 문서가 compute 와 storage 를 나눠 설명한다. */
  { after:'comp', lb:'compute · storage', hot:'io' },
];

export { LANES, ACTORS, EDGES };
