/* 핵심 문항 — beat 스텝의 요점. 형식과 원칙은 postgres/mvcc/quiz.js 머리말.
   오답은 InnoDB 에서는 맞는 설명(행 락 대기 · undo · doublewrite)을 많이 쓴다 — 이 덱에서
   가장 흔한 오해가 "MongoDB 도 InnoDB 처럼 동작한다" 이기 때문이다. */
export const CORE = {
  '01/4': {
    q: '다른 트랜잭션이 커밋 전에 고친 문서를 또 고치려 하면 WiredTiger 는?',
    a: '기다리지 않고 롤백을 요구한다 — MongoDB 는 WriteConflict 로 받는다',
    x: ['행 락이 풀릴 때까지 기다린다 — 상한은 lock wait timeout 이다', '두 update 를 모두 사슬에 붙이고 커밋 순서로 가린다', '나중 쓰기가 앞의 것을 덮어쓴다(last write wins)'],
  },
  '01/5': {
    q: '커밋 직후 그 문서의 디스크 이미지는?',
    a: '옛 값 그대로다 — 새 값은 메모리의 사슬에만 있다',
    x: ['커밋이 이미지를 새 값으로 제자리에서 고친다', '커밋이 doublewrite 사본을 먼저 쓴 뒤 고친다', '커밋 시점에 history store 로 옛 값을 옮긴다'],
  },
  '02/2': {
    q: '스냅샷 목록에 txn 14 가 있고 사슬이 txn 14 → txn 12 일 때 읽기가 고르는 값은?',
    a: 'txn 12 의 값 — txn 14 는 건너뛴다',
    x: ['txn 14 의 값 — 사슬 맨 앞이 최신이다', '디스크 이미지의 값 — 사슬은 커밋 뒤에만 읽는다', 'txn 14 가 끝날 때까지 기다린 뒤의 값'],
  },
  '02/4': {
    q: 'readConcern majority 읽기는 WiredTiger 에서 무엇으로 구현되나?',
    a: '과반 커밋 시점을 read timestamp 로 연 트랜잭션',
    x: ['과반 노드에 같은 읽기를 보내 결과가 같은지 비교한다', '과반이 복제할 때까지 읽기를 기다린다', 'oplog 를 거꾸로 적용해 과반 시점을 만든다'],
  },
  '03/3': {
    q: 'reconciliation 이 커밋 전 update 를 만나면?',
    a: '디스크에 쓰지 않고 메모리의 사슬에 남겨 둔다',
    x: ['이미지에 쓰고 undo 에 옛 값을 남긴다', '커밋 전이라는 표시를 붙여 이미지에 함께 쓴다', 'history store 에 먼저 옮겨 둔다'],
  },
  '03/5': {
    q: '사슬에서 보이는 버전을 못 찾은 읽기는 다음에 어디를 보나?',
    a: 'on-disk 값, 그래도 안 보이면 history store',
    x: ['곧바로 history store — 이미지는 늘 최신이다', 'undo 로그를 거슬러 옛 버전을 만든다', 'journal 에서 그 시점의 레코드를 찾는다'],
  },
  '04/3': {
    q: 'replica set 에서 사용자 컬렉션의 변경은 journal 에 적히나?',
    a: '아니다 — 복제되는 컬렉션은 log 를 끄고 oplog 만 적는다',
    x: ['그렇다 — 모든 컬렉션 변경이 journal 에 적힌다', '그렇다 — 다만 압축해서 적는다', '아니다 — journal 자체가 꺼져 있다'],
  },
  '04/4': {
    q: 'WiredTiger checkpoint 가 쓰다 찢어져도 안전한 이유는?',
    a: '새 블록에 쓰고, 저장 뒤에야 옛 블록을 재사용해서',
    x: ['doublewrite 영역에 사본을 먼저 써 두어서', '페이지마다 체크섬으로 찢어진 것을 고쳐서', 'journal 에 페이지 전체 이미지를 넣어 두어서'],
  },
  '04/5': {
    q: 'replica set 멤버가 크래시 뒤 컬렉션을 되살리는 방법은?',
    a: '마지막 stable checkpoint 에서 oplog 를 끝까지 다시 적용한다',
    x: ['journal 의 컬렉션 레코드를 재생하고 undo 로 되돌린다', '다른 멤버에서 전체 데이터를 다시 복사한다', 'history store 의 옛 버전으로 되감는다'],
  },
  '05/4': {
    q: '캐시 사용량이 eviction 문턱(95%)을 넘으면?',
    a: '쿼리 스레드도 eviction 에 끌려가 직접 치운다',
    x: ['새 쓰기를 거부하고 cache full 오류를 돌려준다', 'eviction 스레드 수를 자동으로 늘려 따라잡는다', '캐시 크기를 메모리 여유만큼 자동으로 늘린다'],
  },
  '05/5': {
    q: '오래 열린 스냅샷 하나가 eviction 을 느리게 만드는 이유는?',
    a: '버릴 수 없는 옛 버전을 history store 로 옮겨야 해서',
    x: ['스냅샷이 페이지에 락을 걸어 내보낼 수 없어서', 'checkpoint 가 스냅샷이 끝날 때까지 멈춰서', '스냅샷마다 캐시를 따로 복사해 두어서'],
  },
  '06/3': {
    q: '문서 갱신과 그 갱신의 oplog 항목은 어떻게 커밋되나?',
    a: '같은 WiredTiger 트랜잭션으로 함께 커밋된다',
    x: ['문서를 먼저 커밋하고 oplog 는 뒤에서 따로 쓴다', 'redo 와 binlog 처럼 두 단계 커밋으로 맞춘다', 'oplog 를 먼저 fsync 한 뒤에야 문서를 고친다'],
  },
  '06/8': {
    q: 'w: "majority" 가 기다리는 과반은 어떤 노드의 과반인가? (기본 설정)',
    a: '그 oplog 항목을 journal 에 쓴 노드',
    x: ['그 oplog 항목을 받기만 한 노드', '그 변경을 checkpoint 까지 한 노드', '그 항목을 적용만 하고 아직 쓰지 않은 노드'],
  },
  '06/11': {
    q: '기본 write concern 에서 커밋 응답을 받았다는 것은?',
    a: '과반이 journal 에 가져 되감기지 않는다는 뜻',
    x: ['이 노드의 로그 버퍼에 들어갔다는 뜻', '이 노드가 fsync 했고 복제는 따로라는 뜻', '모든 secondary 가 적용을 마쳤다는 뜻'],
  },
  '07/3': {
    q: 'B 의 스냅샷 뒤에 A 가 커밋한 문서를 B 가 고치려 하면?',
    a: 'B 에게 안 보이는 버전이라 충돌한다',
    x: ['A 가 커밋했으니 최신 값 위에 그대로 쓴다', 'A 의 행 락이 풀렸는지 확인하고 기다린다', 'B 가 본 값으로 A 의 값을 덮어쓴다'],
  },
  '07/6': {
    q: '트랜잭션 밖의 updateOne 이 WriteConflict 를 만나면 클라이언트는?',
    a: '오류를 보지 않는다 — 서버가 안에서 다시 한다',
    x: ['TransientTransactionError 를 받아 직접 다시 한다', 'lock wait timeout 까지 기다렸다가 쓴다', '충돌한 쓰기가 조용히 버려진다'],
  },
  '07/7': {
    q: '같은 문서를 두 트랜잭션이 고칠 때 InnoDB 와 WiredTiger 의 차이는?',
    a: 'InnoDB 는 락을 기다려 쓰고, WiredTiger 는 뒤에 온 쪽을 물린다',
    x: ['둘 다 락이 풀릴 때까지 기다린 뒤 최신 값에 쓴다', '둘 다 뒤에 온 쪽을 곧바로 롤백시킨다', 'InnoDB 가 뒤에 온 쪽을 물리고 WiredTiger 가 기다린다'],
  },
  '08/5': {
    q: '재시작 때 연 checkpoint(stable 90)에 ts 93 의 값이 들어 있을 수 있는 이유는?',
    a: 'eviction 이 먼저 쓴 깨끗한 페이지를 checkpoint 가 건너뛰어서',
    x: ['checkpoint 가 커밋 전 값도 함께 써서', 'journal 재생이 ts 93 을 데이터 파일에 다시 써서', '있을 수 없다 — checkpoint 는 stable 까지만 담는다'],
  },
  '08/8': {
    q: 'journal 에 fsync 된 oplog 항목 ts 100 이 재시작 뒤 사라지는 경우는?',
    a: '그 앞의 구멍 때문에 truncate-after point 뒤로 잘릴 때',
    x: ['없다 — fsync 된 기록은 모두 남는다', 'rollback to stable 이 stable 보다 새 oplog 를 지울 때', 'checkpoint 가 아직 그 항목을 담지 않았을 때'],
  },
  '08/10': {
    q: 'replica set 멤버의 크래시 복구는 어떤 순서인가?',
    a: 'checkpoint 의 stable 로 되감은 뒤 oplog 를 다시 적용한다',
    x: ['redo 를 재생한 뒤 커밋 전 것을 undo 로 되돌린다', 'journal 에서 컬렉션 변경을 재생하고 끝낸다', 'secondary 에서 데이터 파일을 통째로 받아 온다'],
  },
  '09/5': {
    q: 'oldest 가 1100 s 로 올라도 1050 s 로 읽던 트랜잭션이 계속 읽을 수 있는 이유는?',
    a: 'pinned 가 그 트랜잭션의 read timestamp 에 머물러서',
    x: ['그 트랜잭션이 끝날 때까지 oldest 가 오르지 않아서', '그 트랜잭션이 필요한 값을 미리 복사해 두어서', '읽을 수 없다 — 곧바로 SnapshotTooOld 가 난다'],
  },
  '09/8': {
    q: 'oldest(1100 s) 보다 이른 1050 s 로 새 snapshot 읽기를 열면?',
    a: 'SnapshotTooOld 로 거절된다',
    x: ['history store 에서 가장 가까운 값을 준다', 'read timestamp 를 1100 s 로 올려 읽는다', 'purge 가 따라올 때까지 기다린다'],
  },
  '09/9': {
    q: '옛 버전을 지워도 되는 경계가 InnoDB 와 WiredTiger 에서 어떻게 다른가?',
    a: 'WiredTiger 는 가장 오래된 읽기에 300초의 시간 창을 더한다',
    x: ['둘 다 가장 오래된 read view 까지만 둔다', 'WiredTiger 는 checkpoint 가 끝나면 옛 버전을 모두 지운다', 'InnoDB 도 300초의 시간 창을 두고 지운다'],
  },
};
