const LANES = [
  /* 04 커밋 경로에서만 쓴다 — 배우가 없는 레인은 무대에 안 나온다 */
  { id:'proc', lb:'프로세스', note:'백엔드 · walwriter' },
  { id:'mem',  lb:'메모리', note:'버퍼 · WAL 버퍼' },
  { id:'disk', lb:'디스크', note:'WAL 세그먼트 · heap 파일' },
];
const ACTORS = {
  op:   { nm:'OPERATION',   lane:'mem',  kind:'kv' },
  /* short — LSN 자 아래 이름표에 붙는 짧은 이름(버퍼의 p:7 과 파일의 p:7 을 가른다) */
  buf:  { nm:'SHARED BUFFER', lane:'mem', kind:'list', short:'버퍼' },
  rec:  { nm:'WAL RECORD',  lane:'mem',  kind:'bytes' },
  seg:  { nm:'WAL SEGMENT', lane:'disk', kind:'list' },
  heap: { nm:'HEAP FILE',   lane:'disk', kind:'list', short:'파일' },
  cmp:  { nm:'vs INNODB',   lane:'disk', kind:'kv' },
  be:   { nm:'BACKEND',     lane:'proc', kind:'kv' },
  wwr:  { nm:'WALWRITER',   lane:'proc', kind:'kv' },
  wbuf: { nm:'WAL BUFFERS', lane:'mem',  kind:'kv' },
  xact: { nm:'PG_XACT',     lane:'mem',  kind:'list' },
  parr: { nm:'PROCARRAY',   lane:'mem',  kind:'list' },
  /* 05 레코드 해부 — 24 바이트 머리와 그 뒤의 몸 */
  xr:   { nm:'XLogRecord  ·  24 B', lane:'mem', kind:'bytes' },
  xb:   { nm:'RECORD BODY', lane:'mem',  kind:'bytes' },
  /* 06 LSN 과 파일 — 세그먼트 첫 WAL 페이지의 긴 머리 */
  wp:   { nm:'WAL PAGE HEADER', lane:'disk', kind:'bytes' },
  /* 07 동시 삽입 — 자리를 받은 backend 들과 삽입 락 여덟 */
  ins:  { nm:'INSERTERS',   lane:'proc', kind:'list' },
  lk:   { nm:'WAL INSERT LOCKS', lane:'mem', kind:'list' },
  /* 08 세그먼트의 생애 — 보관 상태 파일과 복제 슬롯 */
  ar:   { nm:'archive_status', lane:'disk', kind:'list' },
  slot: { nm:'REPLICATION SLOT', lane:'proc', kind:'kv' },
};
const EDGES = [
  /* WAL 이 먼저 디스크에 가야 한다 — 그 경계가 이 덱의 주제다. */
  { after:'mem', lb:'WAL 먼저 · 그다음 페이지', hot:'io' },
];

export { LANES, ACTORS, EDGES };
