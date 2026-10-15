/* 핵심 문항 — beat 스텝의 요점을 묻는다. 키는 '장면/스텝'.
   a 가 정답, x 가 오답 셋이다. 오답은 흔한 오해 — 다른 엔진에서는 맞거나, 절반만 맞거나,
   예전 버전에서 맞던 설명 — 에서 고른다. 해설은 그 스텝의 key 를 쓴다(quiz.js). */
export const CORE = {
  '01/7': {
    q: 'UPDATE 뒤 옛 튜플의 t_ctid 는 어디를 가리키나?',
    a: '새로 쓴 다음 버전 튜플',
    x: ['undo 에 남긴 이전 버전', '여전히 자기 자신의 TID', '그 행을 가리키는 인덱스 항목'],
  },
  '02/5': {
    q: '힌트 비트(visibility 판정 결과)는 누가 튜플 헤더에 적나?',
    a: '그 결과를 처음 확인한 방문자',
    x: ['커밋하는 트랜잭션이 커밋 시점에', 'VACUUM 이 돌 때에만', 'checkpointer 가 페이지를 쓸 때'],
  },
  '02/7': {
    q: '튜플 B 에 XMIN_COMMITTED 힌트가 켜졌는데, 104 가 진행 중일 때 잡은 snapshot 에서는?',
    a: '안 보인다 — xip 에 104 가 있다',
    x: ['보인다 — 힌트가 커밋을 확인해 준다', '힌트를 지우고 pg_xact 를 다시 본다', '오류가 난다 — snapshot 이 낡았다'],
  },
  '03/6': {
    q: '인덱스가 있는 테이블에서 즉시 정리(pruning)가 죽은 튜플을 치우면 그 line pointer 는?',
    a: 'LP_DEAD 로 남아 VACUUM 을 기다린다',
    x: ['곧바로 LP_UNUSED 가 되어 새 튜플이 쓴다', '인덱스 항목과 함께 곧바로 지워진다', '새 버전을 가리키는 LP_REDIRECT 가 된다'],
  },
  '03/8': {
    q: '죽은 튜플이 차지한 공간은 어떤 경로로 돌아오나?',
    a: '페이지를 만질 때의 즉시 정리(pruning)와 VACUUM',
    x: ['VACUUM(또는 autovacuum)이 돌 때에만 돌아온다', '커밋 시점에 그 트랜잭션이 바로 지운다', 'autovacuum 이 파일 끝을 잘라 돌려준다'],
  },
  '04/2': {
    q: '죽은 TID 가 maintenance_work_mem 에 다 안 담기면 VACUUM 은?',
    a: '멈추고 인덱스와 heap 을 한 바퀴 정리한 뒤 스캔을 잇는다',
    x: ['담기지 않은 TID 는 다음 VACUUM 으로 미룬다', '넘친 TID 를 임시 파일에 적어 두고 끝에 한 번에 지운다', 'heap 스캔을 처음부터 다시 시작한다'],
  },
  '04/5': {
    q: 'VACUUM 이 죽은 튜플의 line pointer(TID) 를 다시 쓸 수 있게 하는 것은 언제인가?',
    a: '인덱스에서 그 TID 를 모두 지운 뒤',
    x: ['heap 을 처음 훑으며 찾는 즉시', '인덱스를 지우기 전에 먼저', '다음 체크포인트가 끝난 뒤'],
  },
  '05/5': {
    q: 'VACUUM 이 visibility map 의 ALL_VISIBLE 페이지를 건너뛰는 조건은?',
    a: '그런 페이지가 32 장 이상 이어질 때',
    x: ['ALL_VISIBLE 이면 한 장이라도 늘 건너뛴다', 'ALL_FROZEN 까지 켜져 있을 때만', '테이블이 shared_buffers 보다 클 때만'],
  },
  '05/4': {
    q: 'ALL_VISIBLE 비트가 켜진 페이지에 UPDATE 가 한 번 생기면?',
    a: '비트가 꺼지고, 다음 VACUUM 이 검사해야 다시 켜진다',
    x: ['비트는 그대로 두고 커밋 때 다시 판정한다', '그 튜플만 따로 표시되고 페이지 비트는 켜진 채로 둔다', '비트가 꺼졌다가 그 트랜잭션이 커밋하면 켜진다'],
  },
  '06/3': {
    q: 'XID 가 wraparound 한계 3백만 앞까지 오면 PG 는?',
    a: '새 XID 가 필요한 명령을 거부한다',
    x: ['가장 오래된 튜플부터 자동으로 지운다', 'XID 를 64비트로 넓혀 계속 쓴다', '데이터베이스를 읽기 전용으로 재시작한다'],
  },
  '06/5': {
    q: 'frozen xmin 을 튜플 헤더는 어떻게 표시하나?',
    a: 'COMMITTED 와 INVALID 두 힌트 비트를 함께 켠다',
    x: ['t_infomask 에 FROZEN 전용 비트를 하나 더 둔다', 'xmax 에 freeze 전용 XID 를 적는다', 't_ctid 에 freeze 표식을 적는다'],
  },
  '08/4': {
    q: '다른 세션이 고치는 중인 행을 UPDATE 하면 pg_locks 에서 무엇을 기다리나?',
    a: '그 행을 고친 트랜잭션의 transactionid',
    x: ['그 행의 row 락', '그 테이블의 RowExclusiveLock', '그 페이지의 버퍼 락'],
  },
  '08/7': {
    q: '기다린 끝에 행이 먼저 갱신돼 있으면 REPEATABLE READ 의 UPDATE 는?',
    a: '직렬화 실패(40001) 오류로 끝난다',
    x: ['최신 버전으로 WHERE 를 다시 확인해 고친다', '자기 snapshot 의 old version 위에 그대로 쓴다', '상대가 끝날 때까지 다시 기다린다'],
  },
  '08/11': {
    q: 'InnoDB 와 PG 의 REPEATABLE READ 가 동시 UPDATE 에서 다른 점은?',
    a: 'InnoDB 는 최신 버전에 쓰고, PG 는 오류를 낸다',
    x: ['둘 다 직렬화 실패 오류를 낸다', 'InnoDB 는 오류를 내고, PG 는 최신 버전에 쓴다', '둘 다 자기 snapshot 의 값에 덮어쓴다'],
  },
  '07/6': {
    q: 'HOT 사슬의 앞쪽 버전들이 모두에게 안 보이게 되면 즉시 정리는 그 자리를 어떻게 하나?',
    a: '머리는 REDIRECT 로, 가운데는 곧바로 UNUSED 로',
    x: ['모두 LP_DEAD 로 두고 VACUUM 을 기다린다', '인덱스 항목을 새 버전으로 옮겨 적는다', '머리를 지우고 인덱스가 lp 3 을 가리키게 고친다'],
  },
  '07/4': {
    q: 'UPDATE 가 HOT 이 되려면 무엇이 필요한가?',
    a: '인덱스 키 열 불변, 같은 페이지에 빈 자리',
    x: ['인덱스 키 열 불변이면 충분하다', '키 불변, 그리고 fillfactor 가 100 미만', '테이블에 인덱스가 하나도 없어야 한다'],
  },
  '09/3': {
    q: 'REPEATABLE READ 세션 S1(xmin 500)이 열려 있을 때, 600 이 지우고 커밋한 튜플을 VACUUM 은?',
    a: '남긴다 — 600 이 OldestXmin 500 보다 뒤다',
    x: ['곧바로 치운다 — 600 은 이미 커밋됐다', 'S1 이 그 테이블을 읽은 적이 없으면 치운다', 'VACUUM 이 S1 이 끝날 때까지 기다렸다가 치운다'],
  },
  '09/5': {
    q: '"idle in transaction" 세션이 horizon 을 붙잡지 않는 경우는?',
    a: '읽기만 한 READ COMMITTED 세션 — 남은 snapshot 이 없다',
    x: ['REPEATABLE READ 로 SELECT 만 한 세션', '무엇이든 쓴 뒤 노는 READ COMMITTED 세션', 'idle 이면 수준과 무관하게 모두 붙잡는다'],
  },
  '09/8': {
    q: 'VACUUM 로그의 removable cutoff 가 계속 아주 오래됐다면 먼저 볼 것은?',
    a: 'backend_xmin 이 가장 작은 세션과 복제 슬롯의 xmin',
    x: ['autovacuum_max_workers 를 늘렸는지', '테이블의 fillfactor 와 HOT 비율', 'shared_buffers 와 checkpoint 간격'],
  },
  '10/4': {
    q: '부모 행에 FK 검사의 KEY SHARE 잠금 셋(MultiXact)이 걸려 있을 때 그 행의 DELETE 는?',
    a: '충돌하는 멤버마다 그 트랜잭션이 끝나길 기다린다',
    x: ['MultiXact 하나만 기다리면 되므로 바로 진행한다', '공유 잠금이라 기다리지 않고 지운다', '데드락으로 보고 곧바로 오류를 낸다'],
  },
  '10/6': {
    q: '부모 행에 KEY SHARE 잠금이 있을 때 기다리지 않고 진행하는 문장은?',
    a: '키가 아닌 열만 바꾸는 UPDATE',
    x: ['그 행의 DELETE', '키 열을 바꾸는 UPDATE', 'SELECT … FOR UPDATE'],
  },
  '10/8': {
    q: 'MultiXactId 의 wraparound 를 막는 문턱이 기본값(4억)보다 일찍 오는 때는?',
    a: '멤버 공간 사용량이 안전선을 넘었을 때',
    x: ['XID 나이가 2억을 넘었을 때', 'MultiXact 버퍼가 가득 찼을 때', '부모 행에 잠금이 셋 이상일 때'],
  },
  '11/5': {
    q: '한 세션의 하위 트랜잭션이 64 개를 넘으면 다른 세션들에게는 무슨 일이?',
    a: '하위 XID 를 판정할 때마다 pg_subtrans 를 읽는다',
    x: ['아무 일도 없다 — 그 세션 안에서만 느려진다', '그 세션의 새 하위 트랜잭션이 오류로 거절된다', '다른 세션의 snapshot 이 그 세션이 끝나길 기다린다'],
  },
  '11/6': {
    q: '넘친 뒤 ROLLBACK TO SAVEPOINT 로 하위 트랜잭션을 되돌리면 overflowed 는?',
    a: '그대로 — 최상위 트랜잭션이 끝나야 지워진다',
    x: ['캐시에 자리가 나면 곧바로 지워진다', 'SAVEPOINT 를 RELEASE 하면 지워진다', '다음 snapshot 을 잡을 때 지워진다'],
  },
  '11/8': {
    q: 'SubtransSLRU 대기가 늘었다. 근본 처방은?',
    a: '64 개를 넘기는 트랜잭션(행마다 EXCEPTION)을 고친다',
    x: ['subtransaction_buffers 를 크게 늘린다', 'max_connections 를 줄인다', 'autovacuum 을 더 자주 돌린다'],
  },
};
