/* 원칙 : 튜플 헤더의 필드 하나하나가 무엇을 결정하는지 소스로 짚는다.
   PG 는 가시성을 튜플이 스스로 들고 있으므로, 헤더를 읽는 것이 곧 MVCC 를 읽는 것이다. */
const SCENES = [
{
  num:'01', tab:'튜플 헤더', title:'가시성이 튜플 안에 산다',
  sub:'23바이트 헤더에 누가 넣었고 누가 지웠는지가 적혀 있다',
  cast:['op','tup','hdr'],
  knobs:[
    ['—','—','이 구조는 설정이 아니라 저장 형식이 정한다']],
  watch:[
    ['pageinspect','heap_page_items() 로 t_xmin·t_xmax·t_ctid 를 그대로 볼 수 있다'],
    ['SELECT xmin, xmax, ctid FROM t','시스템 열로도 보인다 — 별도 확장 없이']],
  links:[['02','누가 보는가'],['03','죽은 튜플']],
  init:{
    op:{ kv:{ 'SQL':'—', '단계':'대기' } },
    tup:{ items:[{ id:'(비었다)', tag:'free', sub:'아직' }] },
    hdr:{ kv:{ 't_xmin':'—', 't_xmax':'—', 't_ctid':'—', 't_infomask':'—' } },
  },
  steps:[
  { act:{ f:'op', t:'tup', lb:'INSERT' },
    note:'INSERT 는 튜플을 하나 쓰고 t_xmin 에 자기 XID 를 적는다',
    why:'HeapTupleFields 의 첫 필드가 t_xmin 이고 주석이 "inserting xact ID" 다. 즉 "누가 이 행을 만들었나" 가 행 자신에 적힌다 — 별도 버전 저장소가 없다.',
    key:'InnoDB 는 행에 <em>DB_TRX_ID + 롤백 포인터</em>를 두고 옛 버전을 undo 에 보관한다. PG 는 <em>옛 버전도 같은 힙에</em> 둔다 — 그 차이가 이 덱 전체를 만든다.',
    ref:'src/include/access/htup_details.h', sym:'HeapTupleFields',
    fact:[['src/include/access/htup_details.h','TransactionId t_xmin;'],
          ['src/include/access/htup_details.h','inserting xact ID']],
    ops:{ op:{ set:{ 'SQL':'INSERT INTO t VALUES (1)', '단계':'튜플 쓰기' } },
          tup:{ del:['(비었다)'], add:[{ id:'튜플 A', tag:'clean', sub:'v=1' }] },
          hdr:{ set:{ 't_xmin':'100', 't_xmax':'0', 't_ctid':'자기 자신' } } } },

  { look:{ hdr:true },
    note:'t_xmax 는 두 가지 일을 한다 — 삭제와 행 락',
    why:'주석이 "deleting or locking xact ID" 다. 삭제도 여기에, 행 락도 여기에 쓴다. 둘을 구분하는 것은 별도 필드가 아니라 infomask 의 HEAP_XMAX_LOCK_ONLY(0x0080) 비트다.',
    key:'InnoDB 는 행 락을 <em>메모리의 락 구조체</em>로 만든다. PG 는 <em>튜플에 적는다</em> — 그래서 PG 에는 "락 테이블이 넘친다" 는 말이 없고, 대신 락을 잡으면 그 페이지가 더러워진다.',
    ref:'src/include/access/htup_details.h', sym:'HeapTupleFields',
    fact:[['src/include/access/htup_details.h','deleting or locking xact ID'],
          ['src/include/access/htup_details.h','#define HEAP_XMAX_LOCK_ONLY']] },

  { look:{ hdr:true },
    note:'헤더는 23바이트다 — 소스가 그 자리에 적어 두었다',
    why:'HeapTupleHeaderData 의 t_hoff 다음에 /* ^ - 23 bytes - ^ */ 주석이 있다. t_choice(xmin·xmax·cid) 12 + t_ctid 6 + t_infomask2 2 + t_infomask 2 + t_hoff 1 = 23 이다. 그 뒤로 NULL 비트맵과 데이터가 붙는다.',
    key:'행 하나가 <em>최소 23바이트의 판정 정보</em>를 들고 다닌다. 좁은 테이블에서는 이것이 데이터보다 클 수 있다 — MVCC 를 튜플 안에 두는 값이다.',
    ref:'src/include/access/htup_details.h', sym:'SizeofHeapTupleHeader',
    fact:[['src/include/access/htup_details.h','/* ^ - 23 bytes - ^ */'],
          ['src/include/access/htup_details.h','#define SizeofHeapTupleHeader']] },

  { look:{ hdr:true },
    note:'t_ctid 는 자기 자신을 가리키다가, 갱신되면 다음 버전을 가리킨다',
    why:'주석이 "current TID of this or newer tuple" 이다. 갱신 전에는 자기 TID 이고, UPDATE 뒤에는 새 튜플의 TID 가 된다. 그래서 옛 튜플에서 새 튜플로 따라갈 수 있다.',
    key:'이 포인터가 <em>갱신 사슬</em>이다. InnoDB 의 롤백 포인터가 <em>과거로</em> 가는 반면, PG 의 ctid 는 <em>미래로</em> 간다 — 방향이 반대다.',
    ref:'src/include/access/htup_details.h', sym:'HeapTupleHeaderData',
    fact:[['src/include/access/htup_details.h','current TID of this or newer tuple']],
    beat:1 },
  ],
},
{
  num:'02', tab:'누가 보는가', title:'스냅샷이 튜플을 판정한다',
  sub:'그리고 판정 결과를 튜플에 적어 둔다 — 읽기가 페이지를 더럽힌다',
  cast:['op','tup','hdr'],
  knobs:[
    ['—','—','판정은 설정이 아니라 스냅샷과 헤더가 정한다']],
  watch:[
    ['pg_stat_user_tables','읽기만 했는데 페이지가 더러워지면 여기 통계가 움직인다'],
    ['pageinspect','t_infomask 의 HEAP_XMIN_COMMITTED 비트가 켜졌는지 볼 수 있다']],
  links:[['01','튜플 헤더'],['03','죽은 튜플']],
  init:{
    op:{ kv:{ 'SQL':'SELECT * FROM t', '스냅샷':'—', '판정':'—' } },
    tup:{ items:[{ id:'튜플 A', tag:'clean', sub:'xmin 100 · xmax 0' }] },
    hdr:{ kv:{ 't_xmin':'100', 't_xmax':'0', 't_infomask':'비어 있음', '힌트':'없음' } },
  },
  steps:[
  { act:{ f:'op', t:'tup', lb:'스냅샷으로 판정' },
    note:'판정은 xmin·xmax 를 스냅샷과 비교하는 것이다',
    why:'HeapTupleSatisfiesMVCC 가 그 일을 한다. t_xmin 을 넣은 트랜잭션이 내 스냅샷 기준으로 끝났는지, t_xmax 를 적은 쪽이 끝났는지를 보고 이 튜플이 보이는지 정한다.',
    key:'InnoDB 는 read view 로 판정하고 안 보이면 <em>undo 를 거슬러 옛 버전을 만든다</em>. PG 는 만들 필요가 없다 — <em>옛 버전이 이미 힙에 있다</em>.',
    ref:'src/backend/access/heap/heapam_visibility.c', sym:'HeapTupleSatisfiesMVCC',
    fact:[['src/backend/access/heap/heapam_visibility.c','See SNAPSHOT_MVCC\'s definition for the intended behaviour.']],
    ops:{ op:{ set:{ '스냅샷':'xid 105 기준', '판정':'보인다' } } } },

  { look:{ hdr:true },
    note:'판정 결과를 헤더에 적어 둔다 — 다음 사람이 다시 계산하지 않게',
    why:'HEAP_XMIN_COMMITTED(0x0100) 를 켜 두면 다음 판정은 그 비트만 보고 끝난다. 안 켜 두면 매번 트랜잭션 상태를 다시 확인해야 하고, 주석이 그 비용을 "고트래픽 공유 구조에 접근해야 해서 경합을 만든다" 고 적는다.',
    key:'그래서 <em>SELECT 만 해도 페이지가 더러워진다</em>. InnoDB 에 대응물이 없는 현상이고, 대량 적재 직후 첫 조회가 유난히 느린 이유이기도 하다.',
    ref:'src/backend/access/heap/heapam_visibility.c', sym:'HeapTupleSatisfiesMVCC',
    fact:[['src/backend/access/heap/heapam_visibility.c','would require access to high-traffic'],
          ['src/include/access/htup_details.h','#define HEAP_XMIN_COMMITTED']],
    ops:{ hdr:{ set:{ 't_infomask':'XMIN_COMMITTED', '힌트':'적어 둠  ·  페이지 더러워짐' } } } },

  { look:{ hdr:true },
    note:'누가 적는가 — 처음 그 사실을 볼 수 있게 된 사람이다',
    why:'주석이 그대로 말한다 : 힌트 비트는 "그 트랜잭션이 끝난 것으로 보이는 스냅샷을 가진 첫 방문자" 가 갱신한다. 즉 쓰기 담당이 따로 없고, 읽는 쪽이 그때그때 남긴다.',
    key:'판정 비용이 <em>첫 독자에게 몰린다</em>. 그래서 같은 조회를 두 번 하면 두 번째가 빠르고, 그 차이를 캐시 효과로 착각하기 쉽다.',
    ref:'src/backend/access/heap/heapam_visibility.c', sym:'HeapTupleSatisfiesMVCC',
    fact:[['src/backend/access/heap/heapam_visibility.c','will be updated by the first visitor']],
    beat:1 },
  ],
},
{
  num:'03', tab:'죽은 튜플', title:'지운 튜플은 그 자리에 남는다',
  sub:'그래서 파일이 줄지 않고, 치우는 일이 따로 필요해진다',
  cast:['op','tup','hdr'],
  knobs:[
    ['—','—','정리 시점은 VACUUM 이 정한다']],
  watch:[
    ['pg_stat_user_tables','n_dead_tup 이 죽은 튜플 수다'],
    ['pgstattuple','dead_tuple_percent 로 낭비 비율을 본다']],
  links:[['01','튜플 헤더'],['02','누가 보는가']],
  init:{
    op:{ kv:{ 'SQL':'—', '단계':'대기', '죽은 튜플':'0' } },
    tup:{ items:[{ id:'튜플 A', tag:'clean', sub:'xmin 100 · xmax 0' }] },
    hdr:{ kv:{ 't_xmin':'100', 't_xmax':'0', 't_ctid':'자기 자신' } },
  },
  steps:[
  { act:{ f:'op', t:'tup', lb:'UPDATE' },
    note:'UPDATE 는 고치지 않는다 — 새 튜플을 쓰고 옛것에 xmax 를 적는다',
    why:'heap_update 는 새 버전을 삽입하고 옛 튜플의 t_xmax 에 자기 XID 를 넣는다. 옛 튜플은 지워지지 않는다 — 아직 그것을 봐야 하는 스냅샷이 있을 수 있기 때문이다.',
    key:'그래서 UPDATE 한 번에 <em>튜플이 하나 늘어난다</em>. InnoDB 는 행을 제자리에서 고치고 옛 값을 undo 에 두므로 힙이 커지지 않는다 — 여기서 두 엔진의 파일 크기 곡선이 갈린다.',
    ref:'src/backend/access/heap/heapam.c', sym:'heap_update',
    fact:[['src/include/access/htup_details.h','#define HEAP_UPDATED']],
    ops:{ op:{ set:{ 'SQL':'UPDATE t SET v=2', '단계':'새 튜플 삽입', '죽은 튜플':'1' } },
          tup:{ set:{ '튜플 A':{ tag:'x', sub:'xmin 100 · xmax 110  ·  죽음' } },
                add:[{ id:'튜플 B', tag:'dirty', sub:'xmin 110 · xmax 0  ·  새 버전' }] },
          hdr:{ set:{ 't_xmax':'110', 't_ctid':'→ 튜플 B' } } } },

  { look:{ tup:true },
    note:'죽은 튜플은 아무도 안 볼 때 비로소 치울 수 있다',
    why:'판정 기준은 "이 트랜잭션보다 오래된 스냅샷이 남아 있는가" 다. 그래서 오래 열린 트랜잭션 하나가 정리를 막는다 — 그 스냅샷이 옛 버전을 아직 볼 수 있기 때문이다.',
    key:'PG 의 부풀음은 <em>쓰기량이 아니라 가장 오래된 스냅샷</em>이 만든다. 유휴 상태로 열려 있는 트랜잭션이 디스크를 먹는 구조다.',
    ref:'src/backend/access/heap/pruneheap.c', sym:'heap_page_prune_opt',
    fact:[['src/backend/access/heap/pruneheap.c','Note: this is called quite often.']] },

  { look:{ tup:true, op:true },
    note:'그래서 정리에 두 층이 있다 — 페이지 안 즉시 정리와 VACUUM',
    why:'heap_page_prune_opt 는 페이지를 만질 때 그 페이지 안에서 값싸게 치울 수 있으면 바로 치운다. 주석이 "꽤 자주 불린다 — 치울 게 없으면 빨리 빠져나오는 것이 중요하다" 고 적는다. 그것으로 부족한 것은 VACUUM 이 맡는다.',
    key:'즉시 정리가 <em>보통의 경우를 흡수</em>하고 VACUUM 이 <em>나머지를 맡는다</em>. "VACUUM 이 돌기 전까지 공간이 안 돌아온다" 는 말은 절반만 맞다.',
    ref:'src/backend/access/heap/pruneheap.c', sym:'heap_page_prune_opt',
    fact:[['src/backend/access/heap/pruneheap.c','if there\'s not any use in pruning.']],
    beat:1 },
  ],
},
];

export { SCENES };
