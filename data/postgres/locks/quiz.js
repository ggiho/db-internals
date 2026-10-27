/* 핵심 문항 — beat 스텝의 요점. 형식과 원칙은 postgres/mvcc/quiz.js 머리말. */
export const CORE = {
  '01/2': {
    q: 'SELECT 가 잡는 AccessShareLock 은 보통 어디에 기록되나?',
    a: '자기 백엔드의 fast-path 칸',
    x: ['공유 메모리의 락 해시 표', '그 테이블의 첫 페이지 헤더', '디스크의 pg_locks 카탈로그'],
  },
  '01/5': {
    q: 'PG 가 행 락을 튜플의 xmax 에 적는 대가는?',
    a: '락 메모리는 안 들지만 행 락만 잡아도 페이지가 더러워진다',
    x: ['행마다 shared lock table 항목을 먹어 표가 넘친다', '대량 갱신 때 락 메모리가 모자라 에스컬레이션한다', 'xmax 를 쓰려면 테이블 락을 8단계로 올려야 한다'],
  },
  '02/3': {
    q: 'BEGIN; UPDATE t … WHERE id = 2; 뒤 pg_locks 에 남는 relation 락은? (t 에 인덱스 둘)',
    a: 't 와 인덱스 둘에 RowExclusiveLock — 셋 다 fastpath t',
    x: ['t 에 RowExclusiveLock 하나 — 인덱스는 락 없이 고친다', '고친 행마다 tuple 락 한 줄씩', 't 에 ExclusiveLock 하나 — 공유 표에'],
  },
  '02/5': {
    q: 'VACUUM 이 본 테이블을 끝내고 toast 를 도는 동안 pg_locks 의 본 테이블 줄은?',
    a: '4단계가 session lock 으로 남는다',
    x: ['사라진다 — 본 테이블의 트랜잭션이 커밋됐다', 'AccessExclusiveLock 으로 올라간다', '인덱스 줄과 함께 남는다 — 같은 트랜잭션이다'],
  },
  '02/8': {
    q: 'ALTER TABLE 이 AccessExclusiveLock 을 기다리는 동안 뒤에 온 SELECT 는?',
    a: '함께 막힌다 — 대기 중인 락이 뒤의 요청을 막는다',
    x: ['ALTER 를 앞질러 바로 읽는다 — SELECT 는 락이 필요 없다', '막히지 않는다 — MVCC 라 읽기는 락과 무관하다', '옛 snapshot 으로 읽는다 — ALTER 가 끝날 때까지'],
  },
  '03/3': {
    q: 'CONCURRENTLY 없이 CREATE INDEX 를 하는 동안 INSERT 는?',
    a: 'Share 락이 RowExclusive 와 충돌해 INSERT 가 기다린다',
    x: ['INSERT 는 진행되고 인덱스가 끝난 뒤 따라잡는다', 'SELECT 만 기다리고 INSERT 는 그대로 진행된다', 'ShareUpdateExclusive 를 잡으므로 INSERT 와 부딪히지 않는다'],
  },
  '03/4': {
    q: 'A 가 SELECT 를 연 채 B 의 ALTER 가 기다리고, 그 뒤 C 의 SELECT 도 기다린다. pg_blocking_pids(C) 는?',
    a: '{B} — 줄 앞에서 충돌하는 락을 청하고 있는 ALTER',
    x: ['{A} — 테이블 락을 먼저 쥔 SELECT', '{A, B} — 앞에 있는 모든 세션', '{} — C 는 SELECT 라 아무도 막지 않는다'],
  },
  '03/7': {
    q: 'BEGIN; ANALYZE t; 를 연 채 다른 세션이 VACUUM t 를 내면?',
    a: '기다린다 — ShareUpdateExclusive 끼리 충돌한다',
    x: ['바로 돈다 — VACUUM 과 ANALYZE 는 서로 다른 모드다', 'ANALYZE 가 취소된다 — VACUUM 이 우선이다', '바로 돈다 — 둘 다 쓰기를 막지 않는 약한 락이다'],
  },
  '03/9': {
    q: 'UPDATE 를 연 트랜잭션이 있을 때 CREATE INDEX CONCURRENTLY 가 pg_locks 에서 granted f 로 기다리는 줄은?',
    a: '그 트랜잭션의 virtualxid 에 대한 ShareLock',
    x: ['t 의 ShareLock — 쓰기와 충돌해서', 't 의 ShareUpdateExclusiveLock — UPDATE 와 충돌해서', 'UPDATE 한 행의 tuple 락'],
  },
  '04/1': {
    q: 'A 가 행 1, B 가 행 2 를 각자 잠근 시점의 상태는?',
    a: '아무 문제 없다 — 서로 다른 행이라 부딪히지 않는다',
    x: ['이미 deadlock 이다 — 검출기가 곧 한쪽을 죽인다', '잠재 deadlock 으로 표시되어 deadlock_timeout 이 시작된다', '두 락이 shared lock table 에 올라 서로를 감시한다'],
  },
  '04/3': {
    q: 'B 가 행 1 을 요청해 사이클이 닫힌 순간, 누가 그것을 아나?',
    a: '아직 아무도 모른다 — 대기 타이머가 끝나야 검사한다',
    x: ['상시 도는 검출 스레드가 즉시 안다', '락 관리자가 요청을 받는 순간 거절한다', 'postmaster 가 다음 주기에 알아챈다'],
  },
  '04/4': {
    q: 'deadlock_timeout(1초)이 지나면 deadlock 검사는 누가 하나?',
    a: '기다리고 있던 그 백엔드가 스스로',
    x: ['상시 도는 deadlock detector 프로세스', 'autovacuum launcher 가 대신', '락을 쥐고 있는 쪽 백엔드가'],
  },
  '04/6': {
    q: 'A·B 사이클이 대기 줄 재배열(soft)로 풀리지 않는 이유는?',
    a: '둘 다 이미 행 하나씩을 쥔 채 기다리기 때문에',
    x: ['재배열은 테이블 락에만 쓸 수 있어서', '대기자가 둘뿐이라 바꿀 순서가 없어서', 'deadlock_timeout 이 이미 지나서'],
  },
  '04/7': {
    q: 'hard deadlock 으로 판정되면 PG 는 누구의 트랜잭션을 중단하나?',
    a: '검사를 실행한 백엔드 자신',
    x: ['되돌릴 양이 가장 적은 트랜잭션', '가장 나중에 시작한 트랜잭션', '락을 가장 많이 쥔 트랜잭션'],
  },
  '04/8': {
    q: '대기 줄을 막고 있는 것이 autovacuum 작업자면 PG 는?',
    a: '그 작업자에게 취소 시그널을 보낸다',
    x: ['사용자 트랜잭션을 deadlock 으로 중단한다', 'autovacuum 이 끝날 때까지 기다린다', 'autovacuum 을 희생자 후보에서 빼고 다시 검사한다'],
  },
  '04/9': {
    q: 'InnoDB 와 비교한 PG deadlock 처리의 거래는?',
    a: '평시 검사 비용을 없애고 탐지를 최소 1초 늦춘다',
    x: ['상시 검사로 즉시 알아내고 희생자를 고른다', 'deadlock 을 막으려고 락을 항상 같은 순서로 잡게 한다', '타임아웃만 쓰고 사이클은 찾지 않는다'],
  },
  '05/2': {
    q: 'SERIALIZABLE 에서 A 와 B 가 남긴 SIREAD 락은 서로를 어떻게 하나?',
    a: '막지 않는다 — 읽은 자리를 기록할 뿐이다',
    x: ['나중에 온 쪽이 먼저 온 쪽을 기다린다', '같은 범위면 S lock 처럼 겹치고 쓰기는 막는다', '범위가 겹치면 바로 40001 로 실패한다'],
  },
  '05/4': {
    q: 'SSI 가 중단 판정을 위해 찾는 것은?',
    a: '들어오고 나가는 rw-conflict 를 함께 가진 트랜잭션',
    x: ['의존 그래프에서 완전히 닫힌 사이클', '같은 행을 두 트랜잭션이 함께 쓴 경우(write-write 충돌)', '읽은 행이 커밋 전에 바뀐 모든 경우'],
  },
  '05/5': {
    q: 'A·B 가 막힘 없이 끝까지 온 이 장면에서, 실패는 언제 어떻게 오나?',
    a: '커밋하려는 시점에 40001 로',
    x: ['두 번째 간선이 생기는 UPDATE 에서 40P01 로', '다음 SELECT 에서 락 대기 타임아웃으로', '다음 VACUUM 이 돌 때 롤백된다'],
  },
  '05/7': {
    q: 'SIREAD 락을 둘 메모리가 부족해지면?',
    a: '세밀한 락 여럿을 굵은 락 하나로 합친다',
    x: ['가장 오래된 SIREAD 부터 버리고 계속한다', '새 SIREAD 를 만들지 않고 그 읽기를 건너뛴다', '그 트랜잭션을 REPEATABLE READ 로 낮춘다'],
  },
  '05/8': {
    q: '2PL 과 비교하면 SSI 는 직렬성을 무엇으로 사나?',
    a: '대기 대신 커밋 시점의 실패와 재시도로',
    x: ['대기 대신 더 긴 락 보유 시간으로', '읽기에도 S lock 을 잡는 대기로', '모든 쓰기를 한 줄로 세우는 직렬 실행으로'],
  },
  '06/3': {
    q: 'T1 의 SELECT 가 걸려 있고 T2 의 ALTER 가 기다리는 중에 T3 가 SELECT 를 하면?',
    a: 'T2 뒤에 선다 — 기다리는 요청과 충돌하므로',
    x: ['곧바로 받는다 — T1 의 SELECT 와는 충돌하지 않는다', 'T2 앞에 끼어든다 — 더 약한 락이므로', '오류를 낸다 — 같은 테이블에 DDL 이 기다린다'],
  },
  '06/4': {
    q: 'PG 가 새 요청을 걸린 락뿐 아니라 기다리는 요청과도 견주는 까닭은?',
    a: '가벼운 요청이 끝없이 앞질러 무거운 요청을 굶기지 않게',
    x: ['deadlock 을 기다리기 전에 빨리 찾아내려고', 'backend 의 fast-path 칸을 아껴 쓰려고', '락 표 파티션의 LWLock 경합을 줄이려고'],
  },
  '06/5': {
    q: '06 장면의 T3 에게 pg_blocking_pids() 가 돌려주는 것은?',
    a: 'T2 — 줄 앞에서 충돌하는 락을 기다리는 쪽',
    x: ['T1 — 테이블을 먼저 쥔 쪽', 'T1 과 T2 둘 다', '빈 배열 — T3 는 아무 락과도 충돌하지 않는다'],
  },
  '06/6': {
    q: 'ALTER 앞에 SET lock_timeout = \'2s\' 를 두면 2 초 뒤 무슨 일이?',
    a: 'ALTER 가 물러나고 뒤에 선 SELECT 들이 풀린다',
    x: ['T1 의 긴 SELECT 가 취소된다', 'ALTER 가 AccessShare 로 낮춰 다시 시도한다', '뒤에 선 SELECT 들이 모두 오류로 끝난다'],
  },
  '07/2': {
    q: 'PG 는 행 락 네 단계의 충돌을 어떻게 판정하나?',
    a: '각 단계를 테이블 락 모드에 대응시켜 같은 충돌 표로',
    x: ['행 락 전용 4 × 4 표를 따로 둔다', '튜플 헤더의 비트끼리 직접 견준다', 'MultiXact 의 멤버 수로 정한다'],
  },
  '07/5': {
    q: '행 락을 기다리는 backend 가 상대 XID 를 기다리기 전에 먼저 하는 일은?',
    a: '그 튜플의 heavyweight 락을 잡아 줄 순서를 정한다',
    x: ['그 튜플을 pg_locks 에서 지운다', 'xmax 를 자기 XID 로 덮어쓴다', 'deadlock_timeout 만큼 먼저 잔다'],
  },
  '08/3': {
    q: 'wait_event 가 LockManager 인 backend 가 기다리는 것은?',
    a: '락 표 파티션의 LWLock — 표를 고칠 차례',
    x: ['다른 트랜잭션이 쥔 테이블 락', 'deadlock 검사가 끝나기를', '자기 fast-path 칸이 비기를'],
  },
  '08/5': {
    q: 'fast-path 로 잡혀 공유 표에 없는 락도 pg_locks 에 보이나?',
    a: '보인다 — fastpath 열이 true 로',
    x: ['안 보인다 — 공유 표만 펼친다', '보인다 — 다만 granted 가 false 로', '세션이 끝난 뒤에야 보인다'],
  },
};
