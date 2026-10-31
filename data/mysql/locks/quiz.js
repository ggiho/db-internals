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
  '09/5': {
    q: 'FOR UPDATE · NOWAIT · SKIP LOCKED 의 차이는?',
    a: '막혔을 때 기다리기 · 에러 · 건너뛰기로 갈린다',
    x: ['잠그는 락 모드가 X · S · 없음으로 다르다', '잠그는 범위가 행 · gap · 테이블로 다르다', '읽는 버전이 최신 · snapshot · 둘 다로 다르다'],
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
};
