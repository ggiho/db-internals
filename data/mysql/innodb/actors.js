/* 배우 명부 — 위치(lane)는 실제 아키텍처를 따른다.
   sql : 스토리지 포맷을 모르는 층 / mem : InnoDB 메모리 / disk : 영속 저장소
   경계선 두 개(SQL|InnoDB, 메모리|디스크)가 이 무대의 주제다. */
const ACTORS = {
  ses:  { nm:'SESSION · TRX',    lane:'sql',  kind:'kv'     },
  stmt: { nm:'STATEMENT',        lane:'sql',  kind:'kv', w:'w2' },
  bin:  { nm:'BINLOG',           lane:'sql',  kind:'kv'     },
  bp:   { nm:'BUFFER POOL',      lane:'mem',  kind:'frames', w:'w15' },  /* 실측 최대 필요 234px */
  lb:   { nm:'LOG BUFFER',       lane:'mem',  kind:'kv'     },   /* 실측 163px */
  undo: { nm:'UNDO LOG',         lane:'mem',  kind:'list', w:'w15' },  /* 버전 사슬을 담는다 */
  lock: { nm:'LOCK TABLE',       lane:'mem',  kind:'list'   },
  rv:   { nm:'READ VIEW',        lane:'mem',  kind:'kv'     },
  fl:   { nm:'FLUSH LIST',       lane:'mem',  kind:'list', w:'w15' },  /* oldest_modification 251px */
  fr:   { nm:'FREE LIST',        lane:'mem',  kind:'list'   },
  /* 목록으로는 그릴 수 없는 구조들 — 인덱스 구간 · 대기 사이클 · B+tree */
  idx:  { nm:'INDEX  idx_a',     lane:'mem',  kind:'axis', w:'w2' },
  wait: { nm:'WAIT-FOR',         lane:'mem',  kind:'graph', w:'w15' },
  tree: { nm:'B+TREE',           lane:'mem',  kind:'tree', w:'w2' },
  mdl:  { nm:'MDL QUEUE',        lane:'sql',  kind:'list', w:'w15' },
  rlog: { nm:'ROW LOG',          lane:'mem',  kind:'list'   },
  dw:   { nm:'DOUBLEWRITE',      lane:'disk', kind:'list'   },
  ibd:  { nm:'.ibd  데이터 파일',      lane:'disk', kind:'frames' },
  redo: { nm:'#ib_redo*  WAL',   lane:'disk', kind:'kv'     },   /* 실측 최대 필요 196px */
};
const LANES = [
  { id:'sql',  lb:'SQL 계층',  note:'포맷을 모른다' },
  { id:'mem',  lb:'INNODB',   note:'메모리' },
  { id:'disk', lb:'디스크',    note:'영속' },
];
const EDGES = [
  { after:'sql',  lb:'handler API',  hot:'boundary' },
  { after:'mem',  lb:'메모리 · 디스크', hot:'io' },
];

export { ACTORS, LANES, EDGES };
