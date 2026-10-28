/* 핵심 문항 — beat 스텝의 요점. 형식과 원칙은 postgres/mvcc/quiz.js 머리말. */
export const CORE = {
  '01/1': {
    q: '평소 WAL 레코드에는 무엇이 적히나?',
    a: '페이지 안에서 바뀐 바이트만',
    x: ['바뀐 페이지 8KB 전체 이미지', '실행한 SQL 문장 그대로', '바뀌기 전과 후의 행 전체'],
  },
  '01/3': {
    q: 'WAL 에 페이지 전체 이미지(FPI)를 넣을지는 무엇으로 정하나?',
    a: 'checkpoint 이후 그 페이지의 첫 수정인가',
    x: ['바뀐 바이트가 페이지의 절반을 넘는가', '그 페이지가 checksum 오류를 낸 적이 있는가', 'full_page_writes 가 켜진 동안 항상 넣는다'],
  },
  '01/4': {
    q: 'checkpoint 직후에 쓰기가 몰리면 WAL 생성량은?',
    a: '몇 배로 는다 — 첫 수정마다 페이지 이미지가 붙어서',
    x: ['줄어든다 — dirty page 가 방금 비워져서', '그대로다 — 레코드 크기는 변경분에만 달려서', '잠깐 멈춘다 — checkpoint 가 WAL 쓰기를 막아서'],
  },
  '01/7': {
    q: 'checkpoint 뒤 이미 한 번 고친 페이지를 같은 주기 안에서 또 고치면, 그 WAL 레코드는?',
    a: '변경분만 — 페이지 LSN 이 RedoRecPtr 보다 커서',
    x: ['이미지를 또 붙인다 — 수정마다 FPI 가 들어간다', '이미지에서 바뀐 바이트만 골라 다시 넣는다', '다음 checkpoint 가 끝날 때까지 기록을 미룬다'],
  },
  '01/9': {
    q: 'torn page(torn page)를 InnoDB 와 PG 는 각각 어떻게 대비하나?',
    a: 'InnoDB 는 doublewrite 버퍼, PG 는 WAL 안의 페이지 이미지',
    x: ['둘 다 doublewrite 버퍼에 먼저 쓴다', 'InnoDB 는 redo 안의 페이지 이미지, PG 는 별도 doublewrite 버퍼', '둘 다 checksum 으로 찾아 replica 에서 받아 온다'],
  },
  '02/1': {
    q: '크래시 뒤 절반만 기록된 페이지 p:7 은 무엇으로 되살리나?',
    a: 'WAL 에 들어 있는 그 페이지의 온전한 이미지',
    x: ['checksum 이 틀린 바이트를 스스로 고친다', '데이터 파일에 남은 이전 세그먼트 사본', 'doublewrite 영역에 먼저 써 둔 사본'],
  },
  '02/5': {
    q: 'full_page_writes on 에서, 디스크의 p:9 가 이미 rec C 의 끝 LSN 까지 반영돼 있다. 이미지가 붙은 rec C 를 replay 하면?',
    a: '이미지로 덮는다 — 이미지가 있으면 LSN 을 견주지 않는다',
    x: ['건너뛴다 — 페이지 LSN 이 레코드 끝과 같아서', '디스크 쪽을 믿고 이미지를 버린 뒤 checksum 만 다시 셈한다', '두 쪽이 달라 복구를 멈추고 오류로 알린다'],
  },
  '02/6': {
    q: '크래시 복구가 redo done 을 찍은 뒤, 복원한 페이지는 언제 디스크에 가나?',
    a: '연결을 받기 전 end-of-recovery checkpoint 가 쓴다',
    x: ['다음 checkpoint_timeout 이 돌아올 때 쓴다', '버퍼에서 밀려날 때 bgwriter 가 쓴다', '쓰지 않는다 — WAL 에 있으니 다시 replay 하면 된다'],
  },
  '02/7': {
    q: 'full_page_writes = off 로 쓴 WAL 로, 찢긴 p:7 을 고치는 레코드를 replay 하면?',
    a: 'checksum 이 틀려 startup 이 FATAL 로 멈춘다',
    x: ['checksum 이 틀린 바이트를 WAL 로 고쳐 쓴다', '찢긴 페이지만 건너뛰고 나머지를 replay 한다', '변경분을 얹으면 찢긴 반도 저절로 맞춰진다'],
  },
  '02/8': {
    q: 'full_page_writes off 에서, 이미지 없는 rec C 의 끝 LSN 이 디스크 p:9 의 페이지 LSN 이하라면?',
    a: '그 레코드를 건너뛴다 — 이미 반영된 변경이다',
    x: ['덮어쓴다 — 로그가 항상 데이터보다 옳다', '복구를 멈추고 checksum 오류로 보고한다', '그 페이지의 FPI 를 찾아 먼저 복원한다'],
  },
  '02/9': {
    q: 'InnoDB 와 비교해 PG 크래시 복구가 읽는 자료는?',
    a: 'WAL 하나를 앞에서 뒤로 한 번',
    x: ['doublewrite 사본을 먼저, 그다음 WAL', 'WAL 을 거꾸로 읽어 undo 부터', 'WAL 과 clog 를 번갈아 두 번'],
  },
  '03/1': {
    q: 'checkpoint 를 부르는 두 문턱은?',
    a: 'max_wal_size 만큼 쌓임, checkpoint_timeout 경과',
    x: ['shared_buffers 가 가득 참, 커밋 수', 'wal_buffers 가 가득 참, bgwriter 주기', 'dirty page 비율 90% 도달, checkpoint_timeout 경과'],
  },
  '03/2': {
    q: 'online checkpoint 가 시작되자마자(아직 flush 전) 페이지를 고치면?',
    a: '어느 페이지든 첫 수정이 되어 이미지가 붙는다',
    x: ['flush 가 끝난 페이지만 이미지가 붙는다', '이미지는 checkpoint 가 끝날 때까지 붙지 않는다', 'dirty 였던 적 없는 페이지만 이미지가 붙는다'],
  },
  '03/4': {
    q: 'checkpoint 의 약속("redo 지점 앞의 변경은 데이터 파일에 있다")이 서는 때는?',
    a: 'pg_control 이 새 checkpoint 레코드를 가리킬 때',
    x: ['RedoRecPtr 를 새 위치로 옮기는 순간', 'dirty page flush 를 시작하는 순간', '옛 WAL 세그먼트를 지우거나 재활용할 때'],
  },
  '03/5': {
    q: 'checkpoint 를 자주 하면?',
    a: '복구는 짧아지지만 FPI 가 늘어 WAL 이 커진다',
    x: ['복구도 짧아지고 WAL 도 줄어든다', 'WAL 은 줄지만 복구가 길어진다', '복구 시간은 그대로고 쓰기만 줄어든다'],
  },
  '04/6': {
    q: 'synchronous_commit=on 에서 COMMIT 이 기다리는 디스크 작업은?',
    a: '커밋 레코드 끝까지 WAL 을 쓰고 fsync',
    x: ['바뀐 heap 페이지를 데이터 파일에 쓰기', 'pg_xact 페이지를 디스크에 쓰기', 'WAL 과 heap 페이지를 함께 fsync'],
  },
  '04/11': {
    q: '커밋한 변경이 다른 세션의 새 snapshot 에 보이기 시작하는 때는?',
    a: 'ProcArray 에서 그 xid 가 빠진 뒤',
    x: ['WAL fsync 가 끝난 직후', 'pg_xact 에 COMMITTED 가 적힌 직후', 'heap 페이지가 디스크에 쓰인 뒤'],
  },
  '04/15': {
    q: 'COMMIT 응답을 받은 순간 디스크에 반드시 있는 것은?',
    a: 'UPDATE 와 COMMIT 의 WAL 레코드',
    x: ['바뀐 heap 페이지', 'pg_xact 의 COMMITTED 표시', 'WAL 레코드와 바뀐 heap 페이지'],
  },
  '05/2': {
    q: 'WAL 레코드에서 xl_rmid 10 · xl_info 0x40 이 뜻하는 것은?',
    a: 'Heap 자원 관리자의 HOT_UPDATE 레코드',
    x: ['트랜잭션 10 이 쓴 레코드의 네 번째 블록', '레코드 길이 10, 페이지 이미지 포함', 'B-tree 의 페이지 분할 레코드'],
  },
  '05/4': {
    q: '복구가 레코드를 읽을 때 xl_prev 를 바로 앞에 지나온 위치와 견주는 까닭은?',
    a: '재활용된 파일에 남은 낡은 레코드를 걸러 내려고',
    x: ['레코드의 CRC 를 셈하는 시작점을 정하려고', '어느 트랜잭션의 레코드인지 알아내려고', '다음 레코드가 어디서 시작하는지 셈하려고'],
  },
  '06/2': {
    q: '세그먼트 16MB · 타임라인 1 일 때 LSN 0/3000060 이 들어 있는 WAL 파일은?',
    a: '000000010000000000000003',
    x: ['000000010000000003000060', '000000000000000100000003', '000000010000000300000000'],
  },
  '06/4': {
    q: '세그먼트 파일의 첫 WAL 페이지 머리가 다른 페이지보다 긴 까닭은?',
    a: '클러스터 ID · 세그먼트 크기 · 블록 크기를 더 적어서',
    x: ['그 세그먼트의 레코드 목록을 앞에 모아 두어서', 'checkpoint 위치를 적어 두는 자리여서', '파일 전체의 CRC 를 따로 적어 두어서'],
  },
  '07/5': {
    q: 'B2 · B3 는 복사를 끝냈고 앞 자리의 B1 은 아직 복사 중이다. WAL 은 어디까지 쓸 수 있나?',
    a: 'B1 의 시작 앞까지 — 구멍 없이 써야 한다',
    x: ['B3 의 끝까지 — 끝난 레코드는 다 쓴다', 'B2 · B3 만 먼저 쓰고 B1 자리는 비워 둔다', '셋 모두 끝날 때까지 아무것도 못 쓴다'],
  },
  '07/7': {
    q: 'pg_stat_wal 의 wal_buffers_full 이 늘어난다는 것은?',
    a: '자리가 없어 backend 가 WAL 을 직접 써야 했다',
    x: ['WAL 세그먼트 파일이 디스크를 다 채웠다', 'checkpoint 가 제때 끝나지 못했다', '삽입 락 여덟 개가 모두 쥐어져 있었다'],
  },
  '08/2': {
    q: 'checkpoint 가 끝났는데도 pg_wal 의 옛 세그먼트가 지워지지 않는 흔한 까닭은?',
    a: '복제 슬롯의 restart_lsn 이 그 세그먼트를 붙잡고 있다',
    x: ['wal_recycle 이 꺼져 있어 지우지 않는다', 'min_wal_size 가 그 세그먼트를 지킨다', 'checkpoint 는 세그먼트를 지우지 않고 VACUUM 이 지운다'],
  },
  '08/4': {
    q: 'archive_mode = on 일 때 checkpoint 가 세그먼트를 지우거나 재활용할 수 있는 조건은?',
    a: '그 세그먼트의 상태 파일이 .done 이 되었을 것',
    x: ['.ready 파일이 만들어졌을 것', 'archive_timeout 이 지났을 것', 'standby 가 그 세그먼트를 받았을 것'],
  },
  '08/5': {
    q: 'max_slot_wal_keep_size 를 정해 두었고 슬롯이 그보다 오래된 WAL 을 붙잡으면?',
    a: '그 슬롯이 무효(wal_removed)가 되고 WAL 은 지워진다',
    x: ['WAL 을 계속 남기고 경고만 낸다', '새 WAL 쓰기를 멈추고 기다린다', '슬롯의 restart_lsn 을 앞으로 당겨 준다'],
  },
  '09/1': {
    q: '슬롯 없이 max_wal_size 64MB 에서 WAL 을 160 MB 쓰고 CHECKPOINT 하면 pg_wal 은?',
    a: '세 개 · 48 MB 쯤 — 지난 세그먼트는 재활용되거나 지워진다',
    x: ['160 MB 그대로 — checkpoint 는 파일을 안 지운다', '0 개 — checkpoint 가 모두 지운다', '64 MB 를 넘으면 쓰기가 멈춘다'],
  },
  '09/4': {
    q: '읽히지 않는 슬롯의 restart_lsn 이 max_wal_size 거리보다 오래되면 wal_status 는?',
    a: 'extended — 슬롯이 max_wal_size 너머까지 남긴다',
    x: ['lost — 그 순간 버려진다', 'unreserved — 다음 checkpoint 가 지운다', 'reserved — 슬롯이 있으면 늘 reserved'],
  },
  '09/7': {
    q: 'max_slot_wal_keep_size 를 슬롯이 붙잡은 양보다 작게 reload 한 직후, checkpoint 전의 상태는?',
    a: 'unreserved — 파일은 아직 있고 safe_wal_size 는 음수',
    x: ['lost — 설정을 바꾸는 순간 슬롯이 버려진다', 'extended — 설정은 재시작해야 먹는다', 'reserved — safe_wal_size 가 0 으로 돌아간다'],
  },
  '09/8': {
    q: 'unreserved 인 슬롯이 있는 채로 checkpoint 가 돌면?',
    a: '슬롯을 wal_removed 로 버리고 그 세그먼트를 지운다',
    x: ['슬롯 때문에 checkpoint 가 실패한다', '슬롯의 restart_lsn 을 앞으로 옮기고 살려 둔다', '세그먼트를 보관하고 슬롯은 그대로 둔다'],
  },
};
