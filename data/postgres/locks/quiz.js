/* 핵심 문항 — beat 스텝의 요점. 형식과 원칙은 postgres/mvcc/quiz.js 머리말. */
export const CORE = {
  '01/3': {
    q: 'BEGIN; UPDATE t … WHERE id = 1; 뒤 이 백엔드의 pg_locks 넷(t · t_pkey · virtualxid · transactionid) 중 공유 lock table 에 든 것은?',
    a: 'transactionid 하나 — 남이 그 xid 를 기다리러 찾아온다',
    x: ['넷 다 — pg_locks 는 공유 표를 그대로 보여 준다', 't 와 t_pkey 의 RowExclusiveLock 둘', 'virtualxid 하나 — 트랜잭션마다 공유 표에 한 칸'],
  },
  '01/4': {
    q: 'A 가 t 에 Share 와 RowShare 를, B 가 Share 를 쥐었다. 공유 표의 LOCK · PROCLOCK 과 pg_locks 줄 수는?',
    a: 'LOCK 1 · PROCLOCK 2 · 줄 3',
    x: ['LOCK 3 · PROCLOCK 3 · 줄 3', 'LOCK 1 · PROCLOCK 3 · 줄 3', 'LOCK 2 · PROCLOCK 2 · 줄 2'],
  },
  '01/6': {
    q: '20,000 행을 SELECT … FOR UPDATE 로 잠근 트랜잭션 — pg_locks 와 페이지는?',
    a: 'pg_locks 는 넷 그대로, 행이 든 페이지가 모두 더러워지고 WAL 이 쌓인다',
    x: ['pg_locks 에 tuple 줄이 20,000 개 생긴다', '행 락이 많아 테이블 락 하나로 에스컬레이션된다', 'pg_locks 도 페이지도 그대로 — 행 락은 메모리에만 있다'],
  },
  '01/8': {
    q: 'max_locks_per_transaction 10 (공유 표를 460 칸으로 셈) 에서 한 트랜잭션이 테이블을 하나씩 잠그면?',
    a: '460 을 넘겨 쥐다가 out of shared memory',
    x: ['10 개째에서 실패 — 트랜잭션 하나의 상한', '정확히 460 개째에서 실패 — 표의 상한', '실패하지 않는다 — 넘친 락은 디스크로'],
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
  '04/5': {
    q: 'A·B 사이클이 대기 줄 재배열(soft)로 풀리지 않는 이유는?',
    a: '둘 다 이미 xid 락을 쥔 채 서로를 기다리기 때문에',
    x: ['재배열은 테이블 락에만 쓸 수 있어서', '대기자가 둘뿐이라 바꿀 순서가 없어서', 'deadlock_timeout 이 이미 지나서'],
  },
  '04/6': {
    q: 'A 가 먼저 기다렸지만 A 의 1초 검사 때는 사이클이 없었다. 0.4초 뒤 B 가 사이클을 닫으면 누가 중단되나?',
    a: 'B — 사이클이 닫힌 뒤 먼저 검사한 쪽',
    x: ['A — 가장 오래 기다린 쪽이 물러난다', '되돌릴 양이 더 적은 쪽이 물러난다', '둘 다 — 사이클의 모든 트랜잭션'],
  },
  '04/8': {
    q: 'C 의 AccessShare 가 쥔 사람 아닌 B 의 대기 요청 뒤에 서서 고리가 닫혔다. B 의 검사 결과는?',
    a: 'C 를 B 앞으로 옮겨 락을 준다 — 아무도 중단되지 않는다',
    x: ['C 를 중단한다 — 가장 늦게 기다린 쪽', 'B 를 중단한다 — 검사한 쪽', '아무것도 안 한다 — 테이블 락은 deadlock 이 아니다'],
  },
  '04/9': {
    q: '대기 줄을 막고 있는 것이 autovacuum 작업자면 PG 는?',
    a: '그 작업자에게 취소 시그널을 보낸다',
    x: ['사용자 트랜잭션을 deadlock 으로 중단한다', 'autovacuum 이 끝날 때까지 기다린다', 'autovacuum 을 희생자 후보에서 빼고 다시 검사한다'],
  },
  '04/10': {
    q: 'InnoDB 와 비교한 PG deadlock 처리의 거래는?',
    a: '평시 검사 비용을 없애고 탐지를 최소 1초 늦춘다',
    x: ['상시 검사로 즉시 알아내고 희생자를 고른다', 'deadlock 을 막으려고 락을 항상 같은 순서로 잡게 한다', '타임아웃만 쓰고 사이클은 찾지 않는다'],
  },
  '05/1': {
    q: 'SERIALIZABLE 에서 Index Scan(t_k)으로 k = 1 의 두 행을 읽은 뒤 pg_locks 의 SIReadLock 은?',
    a: '인덱스 leaf page 하나와 힙 tuple 둘',
    x: ['없다 — 읽기는 락을 남기지 않는다', 'tuple 둘만 — 읽은 행만 적는다', 'relation t 하나 — 읽기 락은 테이블 단위다'],
  },
  '05/2': {
    q: '같은 조회를 Seq Scan 으로 돌리면 SIReadLock 은?',
    a: 'relation t 한 줄 — 테이블 전체',
    x: ['tuple 둘 — 계획과 상관없이 맞는 행만', '55 쪽 모두 page 줄', '없다 — Seq Scan 은 술어를 몰라 건너뛴다'],
  },
  '05/3': {
    q: 'SERIALIZABLE 에서 A 와 B 가 남긴 SIREAD 락은 서로를 어떻게 하나?',
    a: '막지 않는다 — 읽은 자리를 기록할 뿐이다',
    x: ['나중에 온 쪽이 먼저 온 쪽을 기다린다', '같은 범위면 S lock 처럼 겹치고 쓰기는 막는다', '범위가 겹치면 바로 40001 로 실패한다'],
  },
  '05/5': {
    q: 'SSI 가 중단 판정을 위해 찾는 것은?',
    a: '들어오고 나가는 rw-conflict 를 함께 가진 트랜잭션',
    x: ['의존 그래프에서 완전히 닫힌 사이클', '같은 행을 두 트랜잭션이 함께 쓴 경우(write-write 충돌)', '읽은 행이 커밋 전에 바뀐 모든 경우'],
  },
  '05/7': {
    q: '두 UPDATE 가 막힘 없이 끝나고 A 가 먼저 커밋에 성공했다. B 의 COMMIT 은?',
    a: '40001 — 피벗으로 찍혀 중단된다',
    x: ['커밋된다 — A 가 이미 끝나 사이클이 없다', '40P01 deadlock detected 로 중단된다', 'A 의 커밋을 되돌리고 B 가 커밋된다'],
  },
  '05/8': {
    q: 'A 가 B 의 UPDATE 보다 먼저 커밋하면 B 는 어디서 실패하나?',
    a: 'A 가 읽은 행을 쓰는 그 UPDATE 에서 곧바로 (during write)',
    x: ['B 의 COMMIT 에서 (during commit attempt)', '실패하지 않는다 — A 가 끝나 위험한 구조가 없다', 'A 의 COMMIT 이 대신 실패한다'],
  },
  '05/9': {
    q: '기본 설정(max_pred_locks_per_relation −2)에서 한 트랜잭션이 t 의 서로 다른 32 쪽에서 한 줄씩 읽으면 pg_locks 는?',
    a: 'relation t 한 줄 — 64 / 2 − 1 = 31 을 넘었다',
    x: ['tuple 32 줄 — 튜플 락은 합치지 않는다', 'page 32 줄 — 튜플이 page 로 오른다', '오류 — max_pred_locks_per_transaction 64 의 절반을 넘었다'],
  },
  '05/10': {
    q: '2PL 과 비교하면 SSI 는 직렬성을 무엇으로 사나?',
    a: '대기 대신 나중 쪽의 실패와 재시도로',
    x: ['대기 대신 더 긴 락 보유 시간으로', '읽기에도 S lock 을 잡는 대기로', '모든 쓰기를 한 줄로 세우는 직렬 실행으로'],
  },
  '06/3': {
    q: 'T1 의 SELECT 가 걸려 있고 T2 의 ALTER 가 기다리는 중에 T3 가 SELECT 를 하면?',
    a: 'T2 뒤에 선다 — 기다리는 요청과 충돌하므로',
    x: ['곧바로 받는다 — T1 의 SELECT 와는 충돌하지 않는다', 'T2 앞에 끼어든다 — 더 약한 락이므로', '오류를 낸다 — 같은 테이블에 DDL 이 기다린다'],
  },
  '06/5': {
    q: 'PG 가 새 요청을 걸린 락뿐 아니라 기다리는 요청과도 견주는 까닭은?',
    a: '가벼운 요청이 끝없이 앞질러 무거운 요청을 굶기지 않게',
    x: ['deadlock 을 기다리기 전에 빨리 찾아내려고', 'backend 의 fast-path 칸을 아껴 쓰려고', '락 표 파티션의 LWLock 경합을 줄이려고'],
  },
  '06/6': {
    q: '06 장면의 T3 · T4 에게 pg_blocking_pids() 가 돌려주는 것은?',
    a: 'T2 — 줄 앞에서 충돌하는 락을 기다리는 쪽',
    x: ['T1 — 테이블을 먼저 쥔 쪽', 'T1 과 T2 둘 다', '빈 배열 — T3 는 아무 락과도 충돌하지 않는다'],
  },
  '06/7': {
    q: 'T1 의 긴 SELECT 가 끝났다. 줄(T2 ALTER · T3 SELECT · T4 SELECT)에서 무엇이 먼저 받나?',
    a: 'T2 의 ALTER 만 — T3 · T4 는 이제 T2 가 쥔 락에 막힌다',
    x: ['T3 · T4 의 SELECT — 약한 락이라 앞지른다', '셋이 함께 받는다', 'T3 만 — 줄에서 가장 오래 기다린 SELECT'],
  },
  '06/9': {
    q: 'ALTER 앞에 SET lock_timeout = \'2s\' 를 두면 2 초 뒤 무슨 일이?',
    a: 'ALTER 가 물러나고 뒤에 선 SELECT 들이 풀린다',
    x: ['T1 의 긴 SELECT 가 취소된다', 'ALTER 가 AccessShare 로 낮춰 다시 시도한다', '뒤에 선 SELECT 들이 모두 오류로 끝난다'],
  },
  '07/2': {
    q: 'FOR UPDATE 와 FOR NO KEY UPDATE 로 잠근 행은 t_infomask 가 둘 다 0x01C0 이었다. 둘을 가르는 것은?',
    a: 't_infomask2 의 HEAP_KEYS_UPDATED 비트',
    x: ['pg_locks 의 tuple 줄에 남는 heavyweight 모드', 'xmax 가 MultiXactId 인지', '공유 메모리에 따로 둔 행 락 표'],
  },
  '07/3': {
    q: 'PG 는 행 락 네 단계의 충돌을 어떻게 판정하나?',
    a: '각 단계를 테이블 락 모드에 대응시켜 같은 충돌 표로',
    x: ['행 락 전용 4 × 4 표를 따로 둔다', '튜플 헤더의 비트끼리 직접 견준다', 'MultiXact 의 멤버 수로 정한다'],
  },
  '07/5': {
    q: 'A 의 자식 INSERT(FK 검사)가 부모 행을 잠근 채, B 가 그 부모 행의 키 아닌 열을 UPDATE 하면?',
    a: '기다리지 않는다 — xmax 가 MultiXact 가 된다',
    x: ['A 가 끝날 때까지 기다린다 — 행 락끼리는 모두 충돌한다', '기다리지 않는다 — FK 검사는 부모 행을 잠그지 않는다', 'B 가 A 의 잠금을 지우고 xmax 에 자기 XID 를 쓴다'],
  },
  '07/7': {
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
  '09/4': {
    q: '기본 설정(64)에서 한 트랜잭션이 테이블 65 개를 차례로 SELECT 하면 65 번째의 AccessShareLock 은? (oid 가 고르게 퍼졌다)',
    a: '공유 락 표로 간다 — 그 묶음 16 칸이 찼다',
    x: ['fast-path 에 든다 — 칸 수에는 상한이 없다', 'out of shared memory 로 실패한다', '가장 오래된 fast-path 락을 밀어내고 그 칸에 든다'],
  },
  '09/5': {
    q: '기본 설정에서 테이블 17 개만 잡았는데 하나가 fastpath f 다. 왜인가?',
    a: '17 개가 모두 한 묶음에 걸렸다',
    x: ['18 도 트랜잭션마다 16 칸이 고정이다', '17 번째는 늘 공유 표로 간다', '다른 세션이 그 테이블을 SELECT 했다'],
  },
  '09/6': {
    q: 'max_locks_per_transaction 을 16 으로 두고 재시작하면 fast-path 칸은?',
    a: '묶음 하나, 16 칸',
    x: ['그대로 64 칸 — 공유 표만 준다', '0 칸 — fast-path 가 꺼진다', '묶음 넷에 4 칸씩'],
  },
  '09/8': {
    q: '같은 트랜잭션에서 LOCK TABLE … IN SHARE UPDATE EXCLUSIVE MODE 의 pg_locks.fastpath 는?',
    a: 'f — 4 단계는 칸에 못 든다',
    x: ['t — 4 단계는 쓰기를 막지 않는 약한 락이다', 't — 칸이 남으면 모드와 상관없다', 'f 이고 남의 칸까지 공유 표로 옮긴다'],
  },
  '09/10': {
    q: '다른 세션이 f13 의 AccessShareLock 을 fast-path 로 쥔 뒤 내가 f13 에 ShareLock 을 잡으면, 그 세션의 줄은?',
    a: 'fastpath f 로 바뀐다 — 내가 공유 표로 옮겼다',
    x: ['fastpath t 그대로 — 남의 칸은 건드리지 않는다', '그 세션의 락이 풀린다', '내 ShareLock 이 칸이 빌 때까지 기다린다'],
  },
};
