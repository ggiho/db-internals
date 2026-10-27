/* 배우 명부 — 위치(lane)는 실제 아키텍처를 따른다.
   sql : storage 포맷을 모르는 층 / mem : InnoDB 메모리 / disk : 영속 저장소
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
  idx:  { nm:'PRIMARY KEY  (a)',  lane:'mem',  kind:'axis', w:'w2' },  /* 07 · 08 — a 가 PK 라야 등호는 레코드 락, 범위 끝은 gap 만이다 */
  wait: { nm:'WAIT-FOR',         lane:'mem',  kind:'graph', w:'w15' },
  tree: { nm:'B+TREE',           lane:'mem',  kind:'tree', w:'w2' },
  mdl:  { nm:'MDL QUEUE',        lane:'sql',  kind:'list', w:'w15' },
  rlog: { nm:'ROW LOG',          lane:'mem',  kind:'list'   },
  /* 11 — instant ADD · DROP. 열 사전(se_private_data)과 한 페이지의 레코드 — innodb-mvcc 세계가 둘을 격자로 그린다 */
  tbl:  { nm:'INNODB_TABLES',    lane:'mem',  kind:'kv'     },
  dd:   { nm:'DD 열 · se_private_data', lane:'sql', kind:'list', w:'w2' },
  pg:   { nm:'PAGE 4  레코드',     lane:'mem',  kind:'frames', w:'w2' },
  /* 12 — purge. SHOW ENGINE INNODB STATUS 의 세 줄과 purge view, undo 테이블스페이스 파일 */
  pur:  { nm:'PURGE',            lane:'mem',  kind:'kv'     },
  uts:  { nm:'UNDO 테이블스페이스',   lane:'disk', kind:'frames' },
  /* 13 — redo 파일. 쓰는 파일은 innodb-lsn 세계가 LSN 자 아래 띠로, 예비(_tmp)는 칸으로 그린다 */
  rcap: { nm:'REDO 용량 · Innodb_redo_log_*', lane:'mem',  kind:'kv'     },
  rf:   { nm:'#innodb_redo  쓰는 파일', lane:'disk', kind:'frames' },
  rsp:  { nm:'#innodb_redo  예비 _tmp', lane:'disk', kind:'frames' },
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
