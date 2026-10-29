/* 핵심 문항 — beat 스텝의 요점. 형식과 원칙은 postgres/mvcc/quiz.js 머리말. */
export const CORE = {
  '01/11': {
    q: 'UPDATE 한 건이 잡은 MDL · 테이블 IX · 행 X 는 언제 풀리나?',
    a: '셋 다 트랜잭션이 끝날 때',
    x: ['MDL 은 문장 끝, 행 락은 커밋 때', '행 락은 문장 끝, MDL 은 커밋 때', 'IX 는 행 락을 잡은 직후 바로'],
  },
  '02/5': {
    q: '평범한 SELECT(잠금 없는 읽기)가 행을 읽는 동안 다른 세션의 UPDATE 는?',
    a: '바로 진행된다 — 테이블 락도 행 락도 없다',
    x: ['행 S 락 때문에 SELECT 가 끝날 때까지 기다린다', '테이블 IS 락과 충돌해 기다린다', '읽은 행이 커밋될 때까지 기다린다'],
  },
  '02/6': {
    q: 'SELECT 만 하고 커밋하지 않은 트랜잭션이 쥐고 있는 것은?',
    a: 'MDL_SHARED_READ 하나뿐 — InnoDB 층은 비어 있다',
    x: ['읽은 행마다 S 레코드 락, 그리고 테이블 IS 락', '테이블 IS 락과 MDL_SHARED_READ 두 개', '아무것도 없다 — 읽기만 한 트랜잭션은 락을 안 남긴다'],
  },
  '02v/5': {
    q: 'SELECT … FOR UPDATE 로 읽은 행을 다른 세션이 UPDATE 하려 하면?',
    a: '기다린다 — X 는 어떤 모드와도 호환되지 않는다',
    x: ['진행된다 — 읽기 락이라 쓰기와 공존한다', '진행된다 — snapshot 을 읽었으니 충돌이 없다', '1205 로 즉시 실패한다'],
  },
  '02v/6': {
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
  '04/6': {
    q: '강도 표(lock_strength_matrix)가 테이블 층과 행 층에서 하는 일은?',
    a: '이미 충분한 락을 쥐었으면 새로 안 만든다',
    x: ['남의 락과 함께 설 수 있는지 판정한다', '대기 중인 락 중 누구를 먼저 깨울지 정한다', '테이블 락을 행 락으로 낮출지 정한다'],
  },
  '05/8': {
    q: 'RR 에서 UNIQUE 가 아닌 idx_c 로 찾아 UPDATE 하면 data_locks 의 RECORD 줄은?',
    a: 'idx_c 에 둘(200 · 300 앞 gap), PRIMARY 에 하나',
    x: ['idx_c 에 하나, PRIMARY 에 하나 — 지나간 레코드마다 한 줄', 'PRIMARY 에만 하나 — 레코드 락은 클러스터에만', '세 행 모두에 하나씩 — 테이블을 훑었으므로'],
  },
  '06/1': {
    q: 'RR 에서 UPDATE … WHERE c=200 이 UNIQUE 아닌 c 인덱스를 탈 때 잠기는 곳은?',
    a: 'c=200 항목 · 그 행 · c=300 앞의 gap',
    x: ['테이블의 모든 행 — 조건 판정 전에 잠그므로', 'c=200 항목과 그 행뿐 — 조건에 맞는 것만', 'c=200 과 앞뒤 이웃 행 전부'],
  },
  '06/6': {
    q: '인덱스를 탄 이 UPDATE 가 실행 중일 때 id=10 · id=30 행은?',
    a: '자유롭다 — 다른 세션이 지금 고칠 수 있다',
    x: ['읽기만 된다 — S 락이 걸려 있다', '같은 페이지에 있어 함께 잠긴다', '테이블 IX 때문에 UPDATE 가 막힌다'],
  },
  '06v/1': {
    q: 'c 에 인덱스가 없을 때 UPDATE … WHERE c=200 은 어떻게 행을 찾나?',
    a: '클러스터 인덱스를 처음부터 훑으며 행마다 읽고 잠근다',
    x: ['c=200 인 행만 골라 읽는다 — 조건을 먼저 판정한다', '임시 인덱스를 만들어 c=200 으로 내려간다', '테이블 락으로 올려 한 번에 잠근다'],
  },
  '06v/6': {
    q: 'REPEATABLE READ 에서, 인덱스 없이 훑으며 잠근 행 중 조건에 안 맞은 행의 락은?',
    a: '커밋까지 그대로 유지된다',
    x: ['조건 판정 직후 바로 풀린다', '문장이 끝날 때 풀린다', 'gap lock 으로 약해져 남는다'],
  },
  '07/8': {
    q: '평온한 INSERT(충돌 없음, 유니크 인덱스 없음) 뒤 P_S.data_locks 에 남는 레코드 락은?',
    a: '없다 — 새 행의 X 는 implicit 이라 보이지 않는다',
    x: ['새 행의 X 레코드 락 한 줄', 'X,GAP,INSERT_INTENTION 한 줄', '새 행 X 와 insert intention 두 줄'],
  },
  '08/4': {
    q: '자식 테이블에 INSERT 한 트랜잭션이 열려 있는 동안 부모 id=20 의 DELETE 는?',
    a: '막힌다 — 부모 행에 S 락이 걸려 있다',
    x: ['진행된다 — 자식이 커밋 전이라 참조가 없다', '진행되고 자식 행이 CASCADE 로 지워진다', '막힌다 — 자식 테이블 전체가 X 로 잠겨 있다'],
  },
  '08/6': {
    q: 'foreign_key_checks=OFF 로 두면?',
    a: '부모 확인·잠금을 건너뛴다 — 무결성도 보장하지 않는다',
    x: ['부모 락만 없애고 존재 확인은 그대로 한다', '검사를 커밋 시점으로 미룬다', '자식 쪽 락도 함께 없앤다 — 대신 커밋 때 검사한다'],
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
  '11/1': {
    q: 'BEGIN; SELECT …; 뒤 방치된 세션이 ALTER 를 막을 때 P_S.data_locks 는?',
    a: '비어 있다 — 쥔 것은 MDL_SHARED_READ 뿐이다',
    x: ['그 SELECT 가 읽은 행의 S 락이 보인다', '테이블 IS 락 한 줄이 보인다', 'ALTER 가 요청한 X 가 PENDING 으로 보인다'],
  },
  '11/5': {
    q: 'MDL 대기 줄을 푸는 방법은?',
    a: 'GRANTED 를 쥔 쪽이 COMMIT 하거나 KILL 된다',
    x: ['ALTER 를 KILL 한다 — 그러면 다시 해도 된다', 'lock_wait_timeout 을 늘린다', '뒤에 쌓인 SELECT 들을 KILL 한다'],
  },
  '12/6': {
    q: '테이블 이름 단위 대기와 행 단위 대기는 각각 어느 P_S 표에서 보나?',
    a: 'metadata_locks 와 data_locks',
    x: ['둘 다 data_locks', 'data_lock_waits 와 metadata_locks', 'events_waits_current 와 data_locks'],
  },
};
