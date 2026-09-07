/* 원칙 : "어디에 사는가" 로 시작한다. 그 한 가지가 mysql/locks 와의 모든 차이를 만든다.
   충돌 표는 소스의 LOCKMASK 배열에서 유도해 옮겼고 tools/pgmx.js 가 칸 단위로 대조한다. */
const SCENES = [
{
  num:'01', tab:'어디에 사는가', title:'행 락은 튜플에, 테이블 락은 표에 산다',
  sub:'그래서 행 락은 메모리를 안 먹고, 테이블 락은 넘칠 수 있다',
  cast:['stmt','tbl','tup','cmp'],
  knobs:[
    ['max_locks_per_transaction','64','공유 락 표의 크기를 이 가정으로 잡는다']],
  watch:[
    ['pg_locks','locktype 이 relation 인 것과 tuple 인 것을 나눠 보라'],
    ['SELECT xmax FROM t','행 락은 여기 보인다 — 별도 표가 아니다']],
  links:[['02','8단계'],['03','충돌 표']],
  init:{
    stmt:{ kv:{ 'SQL':'—', '테이블 락':'—', '행 락':'—' } },
    tbl:{ items:[{ id:'(비었다)', tag:'free', sub:'아직' }] },
    tup:{ kv:{ 't_xmax':'0', '락 여부':'없음' } },
    cmp:{ kv:{ 'PostgreSQL':'—', 'InnoDB':'—' } },
  },
  steps:[
  { act:{ f:'stmt', t:'tbl', lb:'테이블 락' },
    note:'테이블 락은 공유 메모리의 락 표에 들어간다',
    why:'lock.c 가 그 표를 관리한다. 크기는 max_locks_per_transaction(기본 64)에 접속 수를 곱한 가정으로 잡히고, 주석이 "공유 락 표는 최대 이만큼이라는 가정으로 크기가 정해진다" 고 적는다.',
    key:'그래서 PG 도 <em>락 표가 넘칠 수 있다</em>. 파티션이 많은 테이블을 한 트랜잭션에서 훑으면 객체 락이 64를 넘어 실패한다 — 행을 많이 잠글 때가 아니라 <em>객체를 많이 건드릴 때</em> 터진다.',
    ref:'src/backend/storage/lmgr/lock.c', sym:'max_locks_per_xact',
    fact:[['src/backend/utils/misc/guc_tables.c','Sets the maximum number of locks per transaction.'],
          ['src/backend/storage/lmgr/lock.c','int			max_locks_per_xact; /* used to set the lock table size */'],
          ['src/backend/storage/lmgr/lock.c','mul_size(max_locks_per_xact, add_size(MaxBackends, max_prepared_xacts))']],
    ops:{ stmt:{ set:{ 'SQL':'UPDATE t SET v=2 WHERE id=1', '테이블 락':'RowExclusiveLock' } },
          tbl:{ del:['(비었다)'], add:[{ id:'t', tag:'hold', sub:'RowExclusive  ·  공유 표' }] },
          cmp:{ set:{ 'PostgreSQL':'객체 락 = 공유 표', 'InnoDB':'테이블 락 = 메모리 구조체' } } } },

  { act:{ f:'stmt', t:'tup', lb:'행 락' },
    note:'행 락은 표에 안 들어간다 — 튜플의 xmax 에 적는다',
    why:'t_xmax 주석이 "deleting or locking xact ID" 다. 락임을 나타내는 것은 HEAP_XMAX_LOCK_ONLY 비트다. 즉 행 락 하나에 공유 메모리가 한 바이트도 쓰이지 않는다.',
    key:'백만 행을 잠가도 <em>락 표는 그대로</em>다. 대신 백만 페이지가 더러워진다 — 비용이 메모리에서 <em>디스크 쓰기로</em> 옮겨간 것이다. mvcc 덱 01 에서 같은 필드를 봤다.',
    ref:'src/include/access/htup_details.h', sym:'HeapTupleFields',
    fact:[['src/include/access/htup_details.h','deleting or locking xact ID'],
          ['src/include/access/htup_details.h','#define HEAP_XMAX_LOCK_ONLY']],
    ops:{ stmt:{ set:{ '행 락':'xmax 에 기록' } },
          tup:{ set:{ 't_xmax':'110', '락 여부':'LOCK_ONLY 비트' } },
          cmp:{ set:{ 'PostgreSQL':'행 락 = 튜플 안', 'InnoDB':'행 락 = 메모리 구조체' } } } },

  { look:{ cmp:true },
    note:'그래서 두 엔진의 한계가 다른 자리에 있다',
    why:'InnoDB 는 행 락도 메모리에 두므로 대량 갱신이 락 메모리를 먹는다. PG 는 그 부담이 없지만 객체 락 표가 좁고, 행 락을 잡는 것만으로 페이지가 더러워져 WAL 과 체크포인트에 실린다.',
    key:'"어디에 두는가" 하나가 <em>어디서 터지는가</em>를 정한다. mysql/locks 01 에서 InnoDB 가 락을 두 층에서 잡는 것을 봤고, 여기서는 그 두 층이 <em>서로 다른 매체</em>에 있다.',
    ref:'src/backend/storage/lmgr/lock.c', sym:'LockConflicts',
    beat:1 },
  ],
},
{
  num:'02', tab:'8단계', title:'테이블 락은 여덟 단계다',
  sub:'그리고 어떤 문장이 무엇을 잡는지 소스 주석에 적혀 있다',
  cast:['tbl','stmt','cmp'],
  knobs:[
    ['—','—','모드는 코드에 박힌 상수다']],
  watch:[
    ['pg_locks','mode 열에 이 이름이 그대로 나온다'],
    ['LOCK TABLE t IN … MODE','여덟 이름을 직접 쓸 수 있다']],
  links:[['01','어디에 사는가'],['03','충돌 표']],
  init:{
    tbl:{ items:[
      { id:'1 AccessShare', tag:'clean', sub:'SELECT' },
      { id:'2 RowShare', tag:'clean', sub:'SELECT FOR UPDATE / FOR SHARE' },
      { id:'3 RowExclusive', tag:'hold', sub:'INSERT · UPDATE · DELETE' },
      { id:'4 ShareUpdateExclusive', tag:'hold', sub:'VACUUM · ANALYZE' },
      { id:'5 Share', tag:'hold', sub:'CREATE INDEX' },
      { id:'6 ShareRowExclusive', tag:'x', sub:'EXCLUSIVE 유사 · ROW SHARE 허용' },
      { id:'7 Exclusive', tag:'x', sub:'ROW SHARE 를 막는다' },
      { id:'8 AccessExclusive', tag:'x', sub:'ALTER · DROP · VACUUM FULL' }] },
    stmt:{ kv:{ '모드 수':'8', '최강':'AccessExclusive' } },
    cmp:{ kv:{ 'PostgreSQL':'—', 'InnoDB':'—' } },
  },
  steps:[
  { look:{ tbl:true },
    note:'이름이 곧 문장 목록이다 — 주석에 그렇게 적혀 있다',
    why:'lockdefs.h 는 각 상수 뒤에 그 락을 잡는 문장을 주석으로 달아 둔다 — AccessShareLock 은 SELECT, RowExclusiveLock 은 INSERT·UPDATE·DELETE, AccessExclusiveLock 은 ALTER TABLE·DROP TABLE·VACUUM FULL 이다.',
    key:'"내 ALTER 가 왜 막히나" 를 <em>헤더 파일 하나로</em> 답할 수 있다. InnoDB 는 MDL 아홉 단계와 InnoDB 다섯 모드가 따로라 두 표를 봐야 한다(mysql/locks 03·10).',
    ref:'src/include/storage/lockdefs.h', sym:'AccessExclusiveLock',
    fact:[['src/include/storage/lockdefs.h','#define AccessShareLock			1	/* SELECT */'],
          ['src/include/storage/lockdefs.h','#define RowExclusiveLock		3	/* INSERT, UPDATE, DELETE */'],
          ['src/include/storage/lockdefs.h','#define MaxLockMode				8	/* highest standard lock mode */']] },

  { look:{ tbl:['4 ShareUpdateExclusive'] },
    note:'VACUUM 이 자기 모드를 갖는다 — 4단계다',
    why:'ShareUpdateExclusiveLock 주석에 VACUUM(non-FULL)·ANALYZE 가 적혀 있다. 이 모드는 자기 자신과 충돌하므로 같은 테이블에 VACUUM 두 개가 동시에 돌지 않는다. 그러나 3단계(INSERT·UPDATE·DELETE)와는 충돌하지 않는다.',
    key:'그래서 <em>VACUUM 은 쓰기를 막지 않는다</em>. mvcc 덱 04 의 정리가 서비스 중에 돌 수 있는 근거가 이 한 칸이고, VACUUM FULL 이 8단계라 모든 것을 막는 것과 대비된다.',
    ref:'src/include/storage/lockdefs.h', sym:'ShareUpdateExclusiveLock',
    fact:[['src/include/storage/lockdefs.h','#define ShareUpdateExclusiveLock 4	/* VACUUM (non-FULL), ANALYZE, CREATE']],
    ops:{ cmp:{ set:{ 'PostgreSQL':'VACUUM 전용 모드 있음', 'InnoDB':'purge 는 락 모드가 없다' } } } },

  { look:{ tbl:['8 AccessExclusive'] },
    note:'8단계는 모든 것을 막는다 — 읽기까지',
    why:'AccessExclusiveLock 은 AccessShareLock(SELECT)과도 충돌한다. ALTER TABLE·DROP TABLE·VACUUM FULL 이 이것을 잡으므로, 그 문장이 대기하는 동안 뒤에 온 SELECT 도 함께 막힌다.',
    key:'대기 줄이 <em>뒤를 막는다</em>는 점이 InnoDB 의 MDL 과 같다(mysql/locks 11). 짧은 ALTER 라도 앞에 긴 트랜잭션이 있으면 전체가 멈추는 사고가 두 엔진에서 같은 모양으로 일어난다.',
    ref:'src/include/storage/lockdefs.h', sym:'AccessExclusiveLock',
    fact:[['src/include/storage/lockdefs.h','#define AccessExclusiveLock		8	/* ALTER TABLE, DROP TABLE, VACUUM FULL,']],
    beat:1 },
  ],
},
{
  num:'03', tab:'충돌 표', title:'무엇이 무엇을 막는가',
  sub:'8×8 — 소스의 비트마스크에서 유도한 표다',
  cast:['cmx','stmt'],
  knobs:[
    ['—','—','표는 설정이 아니라 코드에 박힌 배열이다']],
  watch:[
    ['pg_locks','granted 가 false 인 행이 이 표에서 막힌 것이다'],
    ['pg_blocking_pids()','누가 막고 있는지 프로세스로 알려준다']],
  links:[['02','8단계'],['01','어디에 사는가']],
  init:{
    stmt:{ kv:{ '모드':'8', '충돌 칸':'38 / 64', '대칭':'성립' } },
    cmx:{ mx:{
      rows:['AS','RS','RE','SUE','S','SRE','X','AX'],
      cols:['AS','RS','RE','SUE','S','SRE','X','AX'],
      cells:[
        ['+','+','+','+','+','+','+','-'],
        ['+','+','+','+','+','+','-','-'],
        ['+','+','+','+','-','-','-','-'],
        ['+','+','+','-','-','-','-','-'],
        ['+','+','-','-','+','-','-','-'],
        ['+','+','-','-','-','-','-','-'],
        ['+','-','-','-','-','-','-','-'],
        ['-','-','-','-','-','-','-','-']],
      lb:{ l:'행 = 이미 걸린 락  ·  열 = 새 요청', r:'LockConflicts' } } },
  },
  steps:[
  { look:{ cmx:true },
    note:'표는 코드에 격자로 없다 — 비트마스크 배열이다',
    why:'LockConflicts 는 모드마다 "이 모드와 충돌하는 모드들" 을 LOCKBIT_ON 으로 OR 한 값이다. 격자로 보려면 그 마스크를 펼쳐야 한다. InnoDB 는 주석에 ASCII 표를 갖고 있어 눈으로 읽히지만 PG 는 계산해야 보인다.',
    key:'그래서 이 덱의 64칸은 <em>손으로 옮긴 것이 아니라 유도한 것</em>이다. tools/pgmx.js 가 매번 소스에서 다시 유도해 칸 단위로 대조한다 — 옮겨 적는 순간 틀리기 때문이다.',
    ref:'src/backend/storage/lmgr/lock.c', sym:'LockConflicts',
    fact:[['src/backend/storage/lmgr/lock.c','static const LOCKMASK LockConflicts[] = {']] },

  { look:{ cmx:true, stmt:true },
    note:'충돌은 64칸 중 38칸이고, 표는 대칭이다',
    why:'유도한 결과가 대칭이다 — A 가 B 를 막으면 B 도 A 를 막는다. 계단 모양으로 아래·오른쪽이 채워지는데, 이는 모드가 강도 순으로 번호를 갖고 있어서다(1 AccessShare … 8 AccessExclusive).',
    key:'InnoDB 의 5×5 호환 표는 <em>AI 행이 대칭을 깬다</em>(mysql/locks 04). PG 는 AUTO_INCREMENT 같은 특례 모드가 없어 표가 깨끗한 계단이다 — 대신 모드가 여덟이라 외울 것이 많다.',
    ref:'src/backend/storage/lmgr/lock.c', sym:'LockConflicts',
    fact:[['src/backend/storage/lmgr/lock.c','LOCKBIT_ON(AccessExclusiveLock),']] },

  { look:{ cmx:true },
    note:'실전에서 가장 자주 부딪히는 칸 — 3단계와 5단계',
    why:'RowExclusive(INSERT·UPDATE·DELETE)와 Share(CREATE INDEX)가 서로 막는다. 그래서 CONCURRENTLY 없이 인덱스를 만들면 그동안 쓰기가 전부 멈춘다.',
    key:'표에서 <em>한 칸을 알면 사고 하나를 안다</em>. CREATE INDEX CONCURRENTLY 가 대신 4단계(ShareUpdateExclusive)를 잡아 쓰기를 허용하는 것도 같은 표에서 읽힌다.',
    ref:'src/include/storage/lockdefs.h', sym:'ShareLock',
    fact:[['src/include/storage/lockdefs.h','#define ShareLock				5	/* CREATE INDEX (WITHOUT CONCURRENTLY) */']],
    beat:1 },
  ],
},
];

export { SCENES };
