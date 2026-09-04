/* 배우 명부 — 락이 잡히는 층을 그대로 배치한다.
   sql : MDL 이 사는 층(서버가 테이블 이름 단위로 잠근다)
   mem : InnoDB 의 락 테이블(테이블 락 IS/IX/S/X · 행 락 S/X)
   disk : 실제 데이터. 락은 디스크에 없다 — 그 사실이 보여야 한다. */
const ACTORS = {
  /* SQL 층 */
  ses:  { nm:'SESSION · TRX',   lane:'sql',  kind:'kv'  },
  stmt: { nm:'STATEMENT',       lane:'sql',  kind:'kv', w:'w2' },
  mdl:  { nm:'MDL QUEUE',       lane:'sql',  kind:'list', w:'w15' },
  mdlm: { nm:'MDL 호환표',          lane:'sql',  kind:'matrix', w:'w2' },

  /* InnoDB 층 */
  tl:   { nm:'TABLE LOCKS',     lane:'mem',  kind:'list', w:'w15' },
  rl:   { nm:'ROW LOCKS',       lane:'mem',  kind:'list', w:'w15' },
  cmx:  { nm:'호환 행렬',           lane:'mem',  kind:'matrix', w:'w15' },
  smx:  { nm:'강도 행렬',           lane:'mem',  kind:'matrix', w:'w15' },
  idx:  { nm:'INDEX',           lane:'mem',  kind:'axis', w:'w2' },
  rv:   { nm:'READ VIEW',       lane:'mem',  kind:'kv'  },
  wait: { nm:'WAIT-FOR',        lane:'mem',  kind:'graph', w:'w15' },
  ps:   { nm:'P_S 관찰',           lane:'mem',  kind:'list', w:'w15' },

  /* 디스크 */
  row:  { nm:'행 (클러스터)',        lane:'disk', kind:'list', w:'w15' },
  sec:  { nm:'세컨더리 인덱스',        lane:'disk', kind:'list', w:'w15' },
};

/* 레인 — 락이 잡히는 층. 경계선 두 개가 이 덱의 주제다 :
   서버가 테이블 이름을 잠그는 층 / InnoDB 가 테이블과 행을 잠그는 층 / 락이 없는 디스크. */
const LANES = [
  { id:'sql',  lb:'서버 계층',  note:'MDL · 테이블 이름' },
  { id:'mem',  lb:'INNODB',    note:'테이블 · 행 락' },
  { id:'disk', lb:'데이터',     note:'락은 여기 없다' },
];
const EDGES = [
  { after:'sql',  lb:'여기서 MDL 을 얻은 뒤에야 InnoDB 로 간다',  hot:'boundary' },
  { after:'mem',  lb:'락은 메모리에만 있다 — 재시작하면 사라진다', hot:'io' },
];

export { ACTORS, LANES, EDGES };
