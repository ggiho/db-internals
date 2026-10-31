/* 핵심 문항 — beat 스텝의 요점. 형식과 원칙은 postgres/mvcc/quiz.js 머리말. */
export const CORE = {
  '01/6': {
    q: 'RR 에서 BEGIN; UPDATE t … WHERE id=20(PK) 한 건 뒤 data_locks 에 보이는 것은?',
    a: 'TABLE IX 한 줄과 PRIMARY X,REC_NOT_GAP 20 한 줄',
    x: ['PRIMARY X 20 한 줄 — gap 까지 잠그는 next-key 다', 'TABLE X 한 줄 — 고치는 테이블 전체를 잠근다', 'TABLE IX 한 줄뿐 — 행 락은 암시적이라 안 보인다'],
  },
  '01/10': {
    q: 'A 가 UPDATE 를 커밋하지 않은 채, C 의 ALTER 와 B 의 같은 행 UPDATE 가 각각 기다린다. data_locks 에 WAITING 줄이 생기는 쪽은?',
    a: 'B 만 — C 는 MDL 에서 멈춰 InnoDB 에 닿지 않는다',
    x: ['C 만 — ALTER 는 테이블 X 를 기다린다', '둘 다 — 기다리는 락은 모두 data_locks 에 있다', '둘 다 아니다 — 대기는 metadata_locks 에만 보인다'],
  },
  '01/11': {
    q: 'BEGIN 안의 UPDATE 한 건이 잡은 t 의 SHARED_WRITE · 테이블 IX · 행 X 는 언제 풀리나?',
    a: '셋 다 트랜잭션이 끝날 때',
    x: ['MDL 은 문장 끝, 행 락은 커밋 때', '행 락은 문장 끝, MDL 은 커밋 때', 'IX 는 행 락을 잡은 직후 바로'],
  },
  '02/5': {
    q: '평범한 SELECT(잠금 없는 읽기)가 행을 읽는 동안 다른 세션의 UPDATE 는?',
    a: '바로 진행된다 — 테이블 락도 행 락도 없다',
    x: ['행 S 락 때문에 SELECT 가 끝날 때까지 기다린다', '테이블 IS 락과 충돌해 기다린다', '읽은 행이 커밋될 때까지 기다린다'],
  },
  '02/8': {
    q: 'SELECT 만 하고 커밋하지 않은 트랜잭션이 쥐고 있는 것은?',
    a: 'MDL_SHARED_READ 하나뿐 — InnoDB 층은 비어 있다',
    x: ['읽은 행마다 S 레코드 락, 그리고 테이블 IS 락', '테이블 IS 락과 MDL_SHARED_READ 두 개', '아무것도 없다 — 읽기만 한 트랜잭션은 락을 안 남긴다'],
  },
  '02v/5': {
    q: 'SELECT … FOR UPDATE 로 읽은 행을 다른 세션이 UPDATE 하려 하면?',
    a: '기다린다 — X 는 어떤 모드와도 호환되지 않는다',
    x: ['진행된다 — 읽기 락이라 쓰기와 공존한다', '진행된다 — snapshot 을 읽었으니 충돌이 없다', '1205 로 즉시 실패한다'],
  },
  '02v/7': {
    q: 'SELECT … FOR UPDATE 가 잡는 MDL 타입은?',
    a: 'MDL_SHARED_WRITE',
    x: ['MDL_SHARED_READ', 'MDL_EXCLUSIVE', 'MDL_SHARED_NO_WRITE'],
  },
  '03/5': {
    q: 'IS · IX 를 쥔 트랜잭션 뒤에서 ALTER TABLE … ADD INDEX 가 멈춘 동안 data_locks 에 ALTER 의 줄은?',
    a: '없다 — MDL 에서 멈춰 InnoDB 에 닿지 않았다',
    x: ['TABLE X WAITING 한 줄 — 남의 IX 와 충돌해 기다린다', 'TABLE S WAITING 한 줄 — 인덱스를 만들려고 쓰기를 막는다', 'TABLE IX GRANTED 한 줄 — LOCK=NONE 이라 IX 만 잡는다'],
  },
  '03/8': {
    q: 'InnoDB 락 모드에 AUTO_INC 가 따로 있는 이유는?',
    a: '문장 단위 binlog replay 에서 같은 번호가 나와야 해서',
    x: ['AUTO_INCREMENT 컬럼의 unique check 을 빠르게 하려고', '카운터가 디스크에 없어 재시작 때 잃지 않으려고', 'gap lock 없이 새 행 자리를 확보하려고'],
  },
  '04/1': {
    q: 'InnoDB 락 호환 표(5×5)의 대각선에서 자기 자신과도 충돌하는 모드는?',
    a: 'X 와 AUTO_INC',
    x: ['X 하나뿐 — AUTO_INC 끼리는 공존', 'S 와 X — 공유도 자기와 충돌', 'IX 와 X — intention lock 끼리 충돌'],
  },
  '04/5': {
    q: 'kill -9 뒤 되살아난 트랜잭션이 IX 를 쥔 테이블에 다른 세션이 LOCK TABLES … READ (autocommit 0) 를 하면?',
    a: 'MDL 은 얻고, InnoDB 의 TABLE S 가 WAITING 이 된다',
    x: ['MDL 에서 막혀 data_locks 에 줄이 없다', '바로 GRANTED — 되살아난 트랜잭션은 락이 없다', 'ERROR 1213 — 교착으로 판정되어 한쪽이 롤백된다'],
  },
  '04/10': {
    q: '강도 표(lock_strength_matrix)가 테이블 층과 행 층에서 하는 일은?',
    a: '이미 충분한 락을 쥐었으면 새로 안 만든다',
    x: ['남의 락과 함께 설 수 있는지 판정한다', '대기 중인 락 중 누구를 먼저 깨울지 정한다', '테이블 락을 행 락으로 낮출지 정한다'],
  },
  '05/8': {
    q: 'RR 에서 UNIQUE 가 아닌 idx_c 로 찾아 UPDATE 하면 data_locks 의 RECORD 줄은?',
    a: 'idx_c 에 둘(200 · 300 앞 gap), PRIMARY 에 하나',
    x: ['idx_c 에 하나, PRIMARY 에 하나 — 지나간 레코드마다 한 줄', 'PRIMARY 에만 하나 — 레코드 락은 클러스터에만', '세 행 모두에 하나씩 — 테이블을 훑었으므로'],
  },
  '05/9': {
    q: 'RR 에서 UPDATE … WHERE c=200 (UNIQUE 아닌 idx_c) 이 커밋 전일 때, 다른 세션의 INSERT 중 기다리는 것은?',
    a: 'c=150 과 c=250 — c=200 둘레의 빈자리',
    x: ['c=50 과 c=350 — 인덱스 양 끝의 빈자리', '없다 — 행 락은 id=20 하나뿐이다', '모든 INSERT — 테이블에 IX 가 걸렸다'],
  },
  '06/1': {
    q: 'c 에 인덱스가 없을 때 UPDATE … WHERE c=200 은 어떻게 행을 찾나?',
    a: '클러스터 인덱스(PRIMARY)를 처음부터 훑으며 행마다 읽고 잠근다',
    x: ['c=200 인 행만 골라 읽는다 — 조건을 먼저 판정한다', '임시 인덱스를 만들어 c=200 으로 내려간다', '테이블 락으로 올려 한 번에 잠근다'],
  },
  '06/4': {
    q: 'RR 에서 인덱스 없는 UPDATE … WHERE c=200 이 3 행 표에서 한 행을 고친 뒤 trx_rows_locked 는?',
    a: '4 — 세 행과 supremum',
    x: ['1 — 고친 행만', '3 — 읽은 세 행', '0 — 문장이 끝나면 풀린다'],
  },
  '06/7': {
    q: 'RR 에서 B 가 id=10(조건에 안 맞는 행)을 잠근 채일 때, A 의 인덱스 없는 UPDATE … WHERE c=200 은?',
    a: 'id=10 에서 기다린다 — c 를 보기도 전에',
    x: ['10 을 건너뛰고 20 만 고친다', '1205 로 바로 실패한다', 'B 의 락을 무시하고 마지막 커밋 버전으로 판정한다'],
  },
  '06/9': {
    q: 'c 에 인덱스 idx_c 를 더하면 RR 의 같은 UPDATE 가 PRIMARY 에서 잠그는 레코드는?',
    a: 'id=20 하나 (X,REC_NOT_GAP)',
    x: ['10 · 20 · 30 과 supremum 전부', 'id=20 과 그 앞 gap', '없다 — idx_c 만 잠근다'],
  },
  '06v/4': {
    q: 'READ COMMITTED 에서 인덱스 없는 UPDATE … WHERE c=200 이 끝난 뒤 data_locks 의 RECORD 줄은?',
    a: 'PRIMARY X,REC_NOT_GAP 20 한 줄',
    x: ['PRIMARY X 10 · 20 · 30 · supremum 네 줄', 'PRIMARY X,REC_NOT_GAP 10 · 20 · 30 세 줄', '없다 — RC 는 행 락을 문장 끝에 놓는다'],
  },
  '06v/7': {
    q: 'RC 에서 B 가 id=10(c=100)을 잠근 채일 때 A 의 인덱스 없는 UPDATE … WHERE c=200 은?',
    a: '기다리지 않고 커밋된 c=100 으로 건너뛴다',
    x: ['id=10 에서 B 가 끝날 때까지 기다린다', '1205 로 바로 실패하고 문장을 되돌린다', 'B 가 고치는 중인 값으로 판정한다'],
  },
  '06v/8': {
    q: 'RC 에서 B 가 조건에 맞는 행 id=20 을 잠근 채면 A 의 UPDATE … WHERE c=200 은?',
    a: '기다린다 — 맞는 행은 락을 기다리며 다시 읽는다',
    x: ['건너뛴다 — semi-consistent read 는 늘 건너뛴다', '마지막 커밋 버전을 고치고 끝낸다', 'id=10 에서도 함께 기다린다'],
  },
  '07/8': {
    q: '평온한 INSERT(충돌 없음, 유니크 인덱스 없음) 뒤 P_S.data_locks 에 남는 레코드 락은?',
    a: '없다 — 새 행의 X 는 implicit 이라 보이지 않는다',
    x: ['새 행의 X 레코드 락 한 줄', 'X,GAP,INSERT_INTENTION 한 줄', '새 행 X 와 insert intention 두 줄'],
  },
  '08/2': {
    q: '자식 테이블에 INSERT 한 트랜잭션(RR, 부모가 있다)의 data_locks 에 부모 쪽으로 남는 줄은?',
    a: '부모 TABLE IS 와 부모 PRIMARY S,REC_NOT_GAP',
    x: ['없다 — 자식 테이블에만 썼으니 자식 IX 뿐이다', '부모 TABLE IX 와 부모 PRIMARY X,REC_NOT_GAP', '부모 PRIMARY S (next-key) — 앞 gap 까지 잠근다'],
  },
  '08/5': {
    q: '자식 테이블에 INSERT 한 트랜잭션이 열려 있는 동안 부모 id=20 의 DELETE 는?',
    a: '막힌다 — 부모 행에 S 락이 걸려 있다',
    x: ['진행된다 — 자식이 커밋 전이라 참조가 없다', '진행되고 자식 행이 CASCADE 로 지워진다', '막힌다 — 자식 테이블 전체가 X 로 잠겨 있다'],
  },
  '08/8': {
    q: 'foreign_key_checks=0 인 세션이 넣고 커밋하지 않은 자식이 있을 때, 검사가 켜진 세션의 부모 DELETE 는 어디서 기다리나?',
    a: '자식 idx_pid 항목 — 부모 행에는 넣은 쪽의 락이 없다',
    x: ['부모 PRIMARY 의 그 행 — 넣은 쪽이 S 를 쥐고 있다', '기다리지 않는다 — 넣은 쪽이 검사를 껐으니 바로 지운다', '자식 테이블의 TABLE X — 검사가 꺼진 테이블은 통째로 잠긴다'],
  },
  '08/10': {
    q: '두 세션이 모두 foreign_key_checks=0 으로 자식을 넣고 부모를 지운 뒤 1 로 되돌리면?',
    a: '고아 행이 그대로 남는다 — 지난 위반은 다시 검사하지 않는다',
    x: ['켜는 순간 전체를 검사해 고아가 있으면 SET 이 실패한다', '고아 행이 CASCADE 로 함께 지워진다', '다음 커밋 때 검사해 고아가 있으면 1451 로 되돌린다'],
  },
  '09/4': {
    q: 'A 가 id=20 을 FOR UPDATE 로 쥔 동안 B 가 SELECT … WHERE id=20 FOR UPDATE NOWAIT 를 하면?',
    a: '즉시 3572 — data_lock_waits 에 줄도 남지 않는다',
    x: ['innodb_lock_wait_timeout 만큼 기다린 뒤 3572 를 받는다', '20 을 뺀 빈 결과를 돌려주고 끝난다', 'WAITING 줄을 남긴 채 곧바로 1205 로 끝난다'],
  },
  '09/7': {
    q: 'C 가 id=25 를 넣고 커밋하지 않았다. B 의 SELECT * … FOR UPDATE SKIP LOCKED 결과에 25 는?',
    a: '빠진다 — explicit 으로 세워 보고 건너뛴다',
    x: ['들어간다 — implicit 락은 락 표에 없어서 충돌하지 않는다', '25 에서 기다린다 — 커밋 전인 행은 건너뛸 수 없다', '들어간다 — 잠그는 읽기는 커밋 안 된 최신 행도 읽는다'],
  },
  '09/9': {
    q: '두 워커가 SELECT id … ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED 를 차례로 하면 둘째는?',
    a: '10 을 건너뛰고 20 을 받는다',
    x: ['첫째가 커밋할 때까지 10 에서 기다린다', '빈 결과를 받는다 — LIMIT 1 의 첫 행이 잠겨 있으니', '10 과 20 을 둘 다 잠그고 20 을 받는다'],
  },
  '09/10': {
    q: 'READ COMMITTED 의 SKIP LOCKED 전체 스캔이 RR 과 다른 점은?',
    a: '레코드만 REC_NOT_GAP — gap · supremum 은 없다',
    x: ['결과가 달라진다 — 잠긴 행도 마지막으로 커밋된 버전으로 돌려준다', '건너뛴 행에도 S 락을 남겨 두고 지나간다', '차이가 없다 — SKIP LOCKED 는 격리 수준과 상관없이 같은 락을 건다'],
  },
  '10/1': {
    q: 'MDL 의 락 단계가 InnoDB 보다 훨씬 많은 이유는?',
    a: 'ALTER · LOCK TABLES · I_S 가 각자 다른 단계를 써서',
    x: ['테이블마다 인덱스 수만큼 단계를 따로 두어야 해서', 'MyISAM 호환을 위해 옛 THR_LOCK 모드를 그대로 남겨 두어서', '행 락까지 MDL 이 대신 표현하려고 늘려서'],
  },
  '10/9': {
    q: 'A 가 SELECT 로 SHARED_READ 를 쥐고 DROP 의 EXCLUSIVE 가 기다릴 때, 새 SELECT 는?',
    a: 'PENDING — 기다리는 X 를 앞지르지 못한다',
    x: ['GRANTED — A 의 SHARED_READ 와 호환이다', 'GRANTED — 읽기는 대기 우선표를 보지 않는다', 'ERROR 1205 를 바로 받는다'],
  },
  '11/1': {
    q: 'BEGIN; SELECT …; 뒤 방치된 세션이 ALTER 를 막을 때 P_S.data_locks 는?',
    a: '비어 있다 — 쥔 것은 MDL_SHARED_READ 뿐이다',
    x: ['그 SELECT 가 읽은 행의 S 락이 보인다', '테이블 IS 락 한 줄이 보인다', 'ALTER 가 요청한 X 가 PENDING 으로 보인다'],
  },
  '11/7': {
    q: 'ALTER 가 lock_wait_timeout 으로 1205 를 받으면 그 뒤에 줄 선 SELECT 들은?',
    a: '같은 순간 모두 지나간다 — 원인 트랜잭션은 그대로 열려 있다',
    x: ['ALTER 와 함께 1205 를 받는다', '원인 트랜잭션이 끝날 때까지 계속 기다린다', '하나씩 차례로 lock_wait_timeout 만큼 더 기다린다'],
  },
  '11/9': {
    q: 'MDL 대기 줄을 푸는 방법은?',
    a: 'GRANTED 를 쥔 쪽이 COMMIT 하거나 KILL 된다',
    x: ['ALTER 를 KILL 한다 — 그러면 다시 해도 된다', 'lock_wait_timeout 을 늘린다', '뒤에 쌓인 SELECT 들을 KILL 한다'],
  },
  '12/1': {
    q: '테이블 이름 단위 대기와 행 단위 대기는 각각 어느 P_S 표에서 보나?',
    a: 'metadata_locks 와 data_locks',
    x: ['둘 다 data_locks', 'data_lock_waits 와 metadata_locks', 'events_waits_current 와 data_locks'],
  },
  '12/4': {
    q: 'sys.innodb_lock_waits 의 blocking_query 에 나오는 것은?',
    a: '막는 세션이 지금 실행 중인 문장 — 쉬고 있으면 NULL',
    x: ['그 락을 잡은 문장', '막힌 쪽이 기다리며 실행 중인 문장', '막는 트랜잭션이 지금까지 실행한 문장 전체'],
  },
  '12/7': {
    q: 'innodb_lock_wait_timeout 이 지나 1205 를 받은 트랜잭션은(기본 설정)?',
    a: '열려 있다 — 문장만 되돌아가고 앞서 얻은 락은 남는다',
    x: ['통째로 ROLLBACK 되어 락이 모두 풀린다', '그때까지 한 일이 자동으로 COMMIT 된다', '세션 연결이 끊긴다'],
  },
  '12/9': {
    q: '두 트랜잭션이 서로의 행을 기다리면(innodb_deadlock_detect ON)?',
    a: '하나가 바로 1213 을 받아 통째로 되돌아가고, 다른 하나는 이어서 진행한다',
    x: ['둘 다 innodb_lock_wait_timeout 이 지나 1205 를 받는다', '둘 다 1213 을 받고 되돌아간다', '하나가 1213 을 받지만 문장만 되돌아가고 트랜잭션은 열려 있다'],
  },
  '13/2': {
    q: '행 하나를 FOR UPDATE 로 잠갔는데 STATUS 는 그 struct 를 n bits 624 라고 한다. 624 를 정한 것은?',
    a: 'page 의 PAGE_N_HEAP 555 와 여유 64 비트',
    x: ['잠근 행 수 하나에 64 비트를 더한 값', 'innodb_page_size 16384 를 레코드 크기로 나눈 값', '테이블의 레코드 수 100,000 을 page 수로 나눈 값'],
  },
  '13/3': {
    q: '같은 trx 가 같은 page 의 레코드 10 개를 같은 모드로 잠그면 레코드 락 struct 는 몇 개인가?',
    a: '하나 — bitmap 에 bit 10 개가 켜진다',
    x: ['열 개 — 레코드마다 lock_t 를 하나씩 따로 만든다', '열 개를 넘는 순간 테이블 X 락 하나로 올라간다', '둘 — 다섯 개마다 새 struct 를 만든다'],
  },
  '13/7': {
    q: '잎 page 182 개에 100,000 행인 테이블을 SELECT … FOR UPDATE 로 전부 잠그면 STATUS 의 lock struct 수는?',
    a: '183 — page 마다 하나에 테이블 IX 하나',
    x: ['100,001 — 행마다 하나에 테이블 IX 하나', '2 — 테이블 X 하나와 그것을 적는 struct 하나', '1 — 일정 수를 넘으면 테이블 X 로 올라간다'],
  },
  '13/8': {
    q: '10 만 행을 FOR UPDATE 로 쥔 trx 가 있을 때, 다른 trx 의 id=50 FOR UPDATE 는 어디서 기다리나?',
    a: '행에서 — 테이블 IX 는 받고 레코드 50 에서 WAITING',
    x: ['테이블에서 — 행 락이 많아 테이블 X 로 올라갔다', 'MDL 에서 — 10 만 행을 쥔 trx 가 MDL_EXCLUSIVE 를 쥔다', '기다리지 않는다 — FOR UPDATE 는 MVCC 로 읽는다'],
  },
  '14/2': {
    q: 'A 가 INSERT 하고 커밋하지 않았다. data_locks 에 그 레코드의 줄이 없는데도 다른 trx 의 FOR SHARE 가 막히는 근거는?',
    a: '레코드의 DB_TRX_ID 가 살아 있는 A 를 가리킨다',
    x: ['INSERT 가 숨은 X 락 struct 를 data_locks 밖에 따로 쥔다', '테이블 IX 가 그 레코드의 S 를 막는다', 'A 의 undo 로그가 그 page 를 latch 로 잠가 둔다'],
  },
  '14/4': {
    q: 'B 가 A 의 커밋 전 INSERT 행을 FOR SHARE 로 읽으려 할 때, data_locks 에 새로 생기는 GRANTED 레코드 락의 임자는?',
    a: 'A — B 의 스레드가 A 의 이름으로 X,REC_NOT_GAP 을 만든다',
    x: ['B — S,REC_NOT_GAP 을 먼저 GRANTED 로 받고 기다린다', '아무도 아니다 — implicit 락은 끝까지 data_locks 에 안 나온다', 'A — A 가 다음 문장을 실행할 때 X 를 건다'],
  },
  '14/8': {
    q: 'secondary 인덱스 레코드에는 DB_TRX_ID 가 없다. 그 레코드의 implicit 락 임자는 어떻게 찾나?',
    a: 'page 의 max trx id, 그다음 클러스터 레코드의 버전',
    x: ['secondary 레코드 끝에 숨은 trx id 칸을 읽는다', 'secondary 에는 implicit 락이 없어 늘 explicit 락을 만든다', 'trx_sys 의 활성 목록에서 그 index_id 를 쓴 trx 를 찾는다'],
  },
  '15/2': {
    q: 'A 가 S,GAP 20 으로 틈 (10, 20) 을 쥐고 있다. 다른 trx B 의 DELETE … WHERE id=20 은?',
    a: '바로 된다 — 레코드 락은 gap 락을 기다리지 않는다',
    x: ['기다린다 — B 의 X 와 A 의 S 는 모드가 호환되지 않는다', '1205 로 끝난다 — gap 락은 그 레코드의 삭제를 금지한다', 'A 의 S,GAP 이 X,GAP 으로 올라간 뒤 B 가 기다린다'],
  },
  '15/6': {
    q: 'A 가 S,GAP 20 을 쥔 채, 남이 지운 20 이 purge 로 page 에서 떨어졌다. data_locks 의 A 줄은?',
    a: 'S,GAP 30 — 틈이 (10, 30) 으로 넓어졌다',
    x: ['없어진다 — 매달려 있던 레코드가 page 에서 사라졌다', 'S,GAP 20 그대로 — 지워진 키를 끝까지 가리킨다', 'S 30 — 다음 레코드의 next-key 락이 되어 30 까지 잠근다'],
  },
  '15/7': {
    q: '(10, 20) 을 쥔 A 의 gap 락이 purge 뒤 30 으로 옮겨 갔다. purge 전에는 0.001 sec 에 들어간 INSERT 25 는 이제?',
    a: '기다린다 — 30 의 gap 락이 막는다',
    x: ['바로 들어간다 — A 가 원래 잠근 틈은 (10, 20) 뿐이다', '바로 들어간다 — 물려받은 gap 락은 INSERT 를 막지 않는다', '1062 로 끝난다 — 지워진 20 의 자리가 아직 예약되어 있다'],
  },
  '15/10': {
    q: 'A 가 SAVEPOINT 뒤 넣은 25 를 B 가 FOR SHARE 로 기다린다. A 가 ROLLBACK TO SAVEPOINT 하면?',
    a: 'A 는 X,GAP 30, B 는 S,GAP 30 을 쥔다',
    x: ['B 는 1205 까지 기다린다 — savepoint 로는 A 의 X 가 풀리지 않는다', 'A 의 락은 다 풀리고 B 는 아무 락 없이 Empty set 을 받는다', 'B 가 S,REC_NOT_GAP 25 를 받고 A 는 X,REC_NOT_GAP 25 를 유지한다'],
  },
  '16/3': {
    q: 'A 가 X 20 을 쥔 동안 B · C · D 가 차례로 같은 X 를 기다린다(무게는 셋 다 1). A 가 커밋하면?',
    a: 'B 가 받고 C · D 는 이제 B 를 기다린다',
    x: ['셋이 모두 깨어나 다시 요청한 순서대로 다툰다', 'D 가 먼저 받는다 — 마지막에 온 요청부터 주는 LIFO 다', '셋이 함께 받는다 — 커밋한 trx 의 락이 모두에게 풀린다'],
  },
  '16/5': {
    q: 'A 가 S 20 을 쥐고 B 의 X 20 이 기다린다. 이때 C 가 같은 레코드에 S 를 요청하면?',
    a: 'B 뒤에서 기다린다 — 기다리는 X 와도 견준다',
    x: ['바로 받는다 — GRANTED 인 A 의 S 와 호환된다', '바로 받는다 — S 끼리는 큐의 순서를 보지 않는다', 'B 의 X 를 밀어내고 A 바로 뒤에 선다'],
  },
  '16/9': {
    q: 'C 가 먼저, B 가 나중에 같은 X 를 기다린다. B 는 다른 레코드를 쥐고 있어 E 가 B 를 기다린다. 쥔 trx 가 커밋하면 먼저 받는 쪽은?',
    a: 'B — 무게 2 로 무게 1 인 C 보다 앞선다',
    x: ['C — 8.4.8 의 락 큐는 언제나 먼저 온 쪽부터 준다', 'C 와 B 가 함께 받는다 — 둘 다 같은 trx 를 기다렸다', 'E — 가장 늦게 줄에 선 trx 의 무게가 가장 크다'],
  },
  '16/10': {
    q: 'A 가 X 를 쥐고 B · C · D 가 차례로 기다린다. 세션의 innodb_lock_wait_timeout 이 B 6 · C 2 · D 4 초면 먼저 1205 를 받는 쪽은?',
    a: 'C — 대기자마다 제 시계로 잰다',
    x: ['B — 줄의 맨 앞부터 차례로 포기한다', 'D — 맨 뒤에 선 대기자부터 줄에서 빠진다', '셋이 함께 — 가장 짧은 값이 줄 전체에 걸린다'],
  },
};
