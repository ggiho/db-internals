/* 원칙 : Aurora 가 "무엇을 없앴나" 를 보이려면 없앤 대상이 필요하다. 그 대상은 InnoDB 이고
   그쪽은 소스로 검증된다. Aurora 쪽은 AWS 문서 인용까지만 보증한다 — 등급을 화면에 적어 둔다. */
const SCENES = [
{
  num:'01', tab:'근거 등급', title:'이 덱은 근거가 두 등급이다',
  sub:'Aurora 는 닫힌 소스다 — 무엇을 보증하고 무엇을 보증하지 않는지 먼저 밝힌다',
  cast:['grade','cmp'],
  knobs:[
    ['—','—','이 장면은 읽는 법에 관한 것이다']],
  watch:[
    ['AWS 문서','docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/ — 2026-09-17 기준'],
    ['SIGMOD 2017·2018','쿼럼·세그먼트 수치는 논문 소관이고 이 덱은 다루지 않는다']],
  links:[['02','컴퓨트와 스토리지'],['03','리플리카']],
  init:{
    grade:{ kv:{ 'Aurora 주장':'AWS 문서 인용', 'InnoDB 주장':'MySQL 8.4.8 소스', '다루지 않는 것':'—' } },
    cmp:{ kv:{ '검증 도구':'—' } },
  },
  steps:[
  { look:{ grade:true },
    note:'다른 여섯 덱은 모든 주장을 소스 문자열에 묶는다. Aurora 는 그럴 수 없다',
    why:'MySQL 8.4.8 과 PostgreSQL 18.6 은 소스가 있어 lines.js 가 줄 번호를 찾고 verify.js 가 fact 문자열을 대조한다. Aurora 는 코드가 공개되지 않아 대조할 대상이 없다.',
    key:'그래서 이 덱은 <em>겉모습이 같아도 등급이 다르다</em>. Aurora 쪽 문장은 "AWS 문서가 이렇게 말한다" 까지가 보증 범위다 — 코드가 정말 그렇게 되어 있다는 보증이 아니다.',
    cite:["The Aurora DB cluster illustrates the separation of compute capacity and storage."],
    ref:'storage/innobase/trx/trx0trx.cc', sym:'trx_prepare',
    ops:{ cmp:{ set:{ '검증 도구':'cite = 문서 · fact = 소스' } } } },

  { look:{ grade:true },
    note:'그래서 이 덱이 말하지 않는 것도 적어 둔다',
    why:'6중 복제, 4/6 쓰기 쿼럼, 10GB 보호 세그먼트 같은 수치는 SIGMOD 논문에 있고 AWS 문서에서 확인하지 못했다. 확인하지 못한 값은 적지 않는다 — 기억으로 쓰면 이 프로젝트의 나머지와 성질이 달라진다.',
    key:'문서가 말하는 것은 <em>"세 개 가용 영역에 걸친 복사본"</em>까지다. 그 이상의 숫자를 보고 싶으면 논문을 원문으로 넣어야 하고, 그때는 책 덱과 같은 방식으로 검증할 수 있다.',
    cite:["A cluster volume consists of copies of the data across three Availability Zones in a single AWS Region."],
    ref:'storage/innobase/trx/trx0trx.cc', sym:'trx_prepare',
    ops:{ grade:{ set:{ '다루지 않는 것':'쿼럼 수 · 세그먼트 크기' } } },
    beat:1 },
  ],
},
{
  num:'02', tab:'컴퓨트·스토리지', title:'컴퓨트와 스토리지를 갈라 놓았다',
  sub:'인스턴스가 하나여도 클러스터다 — 볼륨이 여러 노드에 흩어져 있으므로',
  cast:['op','wr','vol','cmp'],
  knobs:[
    ['—','—','복제 정도는 인스턴스 수와 무관하다']],
  watch:[
    ['SHOW ENGINE INNODB STATUS','Aurora 에서도 InnoDB 계층은 그대로 보인다'],
    ['CloudWatch VolumeBytesUsed','볼륨은 인스턴스와 별개로 자란다']],
  links:[['01','근거 등급'],['03','리플리카']],
  init:{
    op:{ kv:{ 'SQL':'UPDATE t SET c=200 WHERE id=5', '단계':'—' } },
    wr:{ kv:{ '역할':'쓰기 전담', '버퍼풀':'로컬', '데이터 파일':'—' } },
    vol:{ items:[
      { id:'AZ-a 복사본', tag:'clean', sub:'클러스터 볼륨' },
      { id:'AZ-b 복사본', tag:'clean', sub:'클러스터 볼륨' },
      { id:'AZ-c 복사본', tag:'clean', sub:'클러스터 볼륨' }] },
    cmp:{ kv:{ 'Aurora':'—', 'InnoDB':'—' } },
  },
  steps:[
  { look:{ wr:true, vol:true },
    note:'데이터는 인스턴스가 아니라 클러스터 볼륨에 있다',
    why:'문서는 볼륨을 "세 개 가용 영역에 걸친 복사본으로 이뤄진 하나의 가상 볼륨" 이라 하고, 인스턴스가 하나여도 클러스터인 이유를 "저장 볼륨이 여러 가용 영역의 여러 스토리지 노드에 흩어져 있기 때문" 이라 적는다.',
    key:'InnoDB 에서 <em>.ibd 파일이 인스턴스에 붙어 있던 것</em>이 여기서 떨어져 나갔다. mysql/innodb 01 의 마지막 스텝이 "커밋이 보장하는 것은 redo 에 있다이지 데이터 파일에 있다가 아니다" 였는데, Aurora 는 그 데이터 파일 자체를 인스턴스 밖으로 옮겼다.',
    cite:["the underlying storage volume involves multiple storage nodes distributed across multiple Availability Zones",
          "A cluster volume consists of copies of the data across three Availability Zones in a single AWS Region."],
    ref:'storage/innobase/fil/fil0fil.cc', sym:'fil_space_create',
    ops:{ cmp:{ set:{ 'Aurora':'볼륨 = 인스턴스 밖', 'InnoDB':'.ibd = 인스턴스에 붙음' } },
          wr:{ set:{ '데이터 파일':'없음  ·  볼륨에 있다' } } } },

  { act:{ f:'op', t:'wr', lb:'쓰기는 한 곳만' },
    note:'쓰기는 프라이머리 하나가 전담한다',
    why:'문서가 "프라이머리(쓰기) DB 인스턴스 — 읽기와 쓰기를 지원하고 클러스터 볼륨에 대한 모든 데이터 수정을 수행한다" 고 적는다. 즉 다중 쓰기가 아니다.',
    key:'InnoDB 의 <em>단일 쓰기 노드 가정이 그대로 남아 있다</em>. 락도 MVCC 도 그 가정 위에 있으므로(mysql/locks 전체) 그 부분은 Aurora 에서도 같은 규칙으로 움직인다.',
    cite:["Primary (writer) DB instance - Supports read and write operations, and performs all of the data modifications to the cluster volume."],
    ref:'storage/innobase/trx/trx0trx.cc', sym:'trx_commit_in_memory',
    ops:{ op:{ set:{ '단계':'프라이머리에서 수정' } },
          wr:{ set:{ '역할':'쓰기 전담  ·  유일' } } } },

  { look:{ vol:true },
    note:'인스턴스를 늘려도 데이터를 복사하지 않는다',
    why:'문서가 "Aurora 는 테이블 데이터의 새 복사본을 만들지 않는다. 대신 그 DB 인스턴스가 이미 모든 데이터를 담고 있는 공유 볼륨에 연결한다" 고 적는다. 복제 정도는 인스턴스 수와 무관하다고도 못박는다.',
    key:'읽기 노드를 늘리는 비용이 <em>데이터 크기와 무관</em>해진다. MySQL 복제에서 리플리카 하나를 추가하려면 전체 데이터를 복사해야 했던 것과 갈리는 지점이다.',
    cite:["you can add a DB instance quickly because Aurora doesn't make a new copy of the table data. Instead, the DB instance connects to the shared volume that already contains all your data.",
          "The amount of replication is independent of the number of DB instances in your cluster."],
    ref:'storage/innobase/fil/fil0fil.cc', sym:'fil_space_create',
    ops:{ cmp:{ set:{ 'Aurora':'노드 추가 = 볼륨 연결', 'InnoDB':'리플리카 추가 = 전체 복사' } } },
    beat:1 },
  ],
},
{
  num:'03', tab:'리플리카', title:'클러스터 안에서는 binlog 를 쓰지 않는다',
  sub:'그런데 리전을 넘으면 다시 binlog 다 — 같은 제품 안에 두 방식이 있다',
  cast:['wr','rd','vol','cmp'],
  knobs:[
    ['—','—','리플리카 수 상한은 15 다']],
  watch:[
    ['AuroraReplicaLag','문서 기준 보통 100ms 미만'],
    ['SHOW REPLICA STATUS','리전 간 복제에서는 이것이 의미를 갖는다']],
  links:[['02','컴퓨트·스토리지'],['01','근거 등급']],
  init:{
    wr:{ kv:{ '역할':'쓰기 전담', '변경 전달':'—' } },
    rd:{ items:[
      { id:'리더 1', tag:'clean', sub:'같은 볼륨에 연결' },
      { id:'리더 2', tag:'clean', sub:'같은 볼륨에 연결' }] },
    vol:{ items:[{ id:'단일 논리 볼륨', tag:'hold', sub:'모두가 같은 것을 본다' }] },
    cmp:{ kv:{ 'Aurora 클러스터 내':'—', 'Aurora 리전 간':'—', 'MySQL 복제':'—' } },
  },
  steps:[
  { look:{ rd:true, vol:true },
    note:'리더는 쓰기 노드의 로그를 재생하지 않는다 — 같은 볼륨을 본다',
    why:'문서가 "프라이머리와 Aurora 리플리카는 클러스터 볼륨의 데이터를 하나의 논리 볼륨으로 본다" 고 적는다. 그래서 "클러스터 볼륨이 모든 인스턴스에 공유되므로 각 리플리카를 위해 데이터 복사본을 복제하는 추가 작업이 거의 필요 없다" 고 이어진다.',
    key:'MySQL 복제의 <em>relay log 재생이 없다</em>. mysql/innodb 01 에서 본 binlog 는 그 재생을 위한 것이었는데, 클러스터 안에서는 그 경로가 쓰이지 않는다.',
    cite:["The DB cluster volume is physically made up of multiple copies of the data for the DB cluster. The primary instance and the Aurora Replicas in the DB cluster all see the data in the cluster volume as a single logical volume.",
          "Because the cluster volume is shared among all DB instances in your DB cluster, minimal additional work is required to replicate a copy of the data for each Aurora Replica."],
    ref:'sql/binlog.cc', sym:'MYSQL_BIN_LOG::process_flush_stage_queue',
    ops:{ wr:{ set:{ '변경 전달':'볼륨 공유' } },
          cmp:{ set:{ 'Aurora 클러스터 내':'binlog 재생 없음', 'MySQL 복제':'binlog → relay log 재생' } } } },

  { look:{ rd:true },
    note:'그래도 지연이 0 은 아니다 — 문서는 보통 100ms 미만이라 적는다',
    why:'"모든 Aurora 리플리카가 최소한의 리플리카 지연으로 같은 데이터를 돌려준다. 이 지연은 보통 프라이머리가 갱신을 쓴 뒤 100밀리초보다 훨씬 작다" 고 적고, 쓰기가 많은 구간에서는 지연이 늘 수 있다고 덧붙인다.',
    key:'볼륨을 공유해도 <em>리더의 버퍼풀은 각자</em>다. 문서가 지연을 0 이라 하지 않는 이유가 거기 있다 — 캐시에 남은 옛 페이지를 무효화하는 일이 남는다.',
    cite:["As a result, all Aurora Replicas return the same data for query results with minimal replica lag. This lag is usually much less than 100 milliseconds after the primary instance has written an update."],
    ref:'storage/innobase/buf/buf0buf.cc', sym:'buf_page_get_gen',
    ops:{ rd:{ set:{ '리더 1':{ tag:'chg', sub:'지연 < 100ms  ·  버퍼풀은 각자' } } } } },

  { look:{ cmp:true },
    note:'그런데 리전을 넘으면 binlog 가 다시 등장한다',
    why:'문서가 "MySQL 바이너리 로그(binlog) 복제를 사용해 다른 AWS 리전에 Aurora MySQL DB 클러스터의 읽기 복제본을 만들 수 있다" 고 적고, 같은 리전의 두 Aurora 클러스터 사이에도 binlog 복제를 쓸 수 있다고 적는다.',
    key:'같은 제품 안에 <em>두 가지 복제가 공존한다</em> — 클러스터 안은 공유 볼륨, 클러스터·리전을 넘으면 binlog. 그래서 mysql/innodb 01 에서 고친 2PC 순서(redo 그룹 fsync → binlog 쓰기 → binlog fsync)는 <em>리전 간 복제를 쓰는 순간 다시 그대로 의미를 갖는다</em>.',
    cite:["You can create an Aurora read replica of an Aurora MySQL DB cluster in a different AWS Region, by using MySQL binary log (binlog) replication. Each cluster can have up to five read replicas created this way, each in a different Region.",
          "Two Aurora MySQL DB clusters in the same Region, by using MySQL binary log (binlog) replication."],
    ref:'sql/binlog.cc', sym:'MYSQL_BIN_LOG::process_flush_stage_queue',
    ops:{ cmp:{ set:{ 'Aurora 리전 간':'binlog 복제  ·  최대 5' } } } },

  { look:{ rd:true, wr:true },
    note:'그리고 페일오버는 볼륨을 옮기는 일이 아니라 역할을 바꾸는 일이다',
    why:'문서가 "쓰기 인스턴스가 사용 불가가 되면 Aurora 가 리더 인스턴스 하나를 새 쓰기 인스턴스로 자동 승격한다" 고 적고, "페일오버로 리플리카를 승격하는 것이 프라이머리를 다시 만드는 것보다 훨씬 빠르다" 고 적는다.',
    key:'데이터가 이미 공유돼 있으니 <em>옮길 것이 없다</em>. 승격이 빠른 이유가 그것이고, 리플리카가 없으면 그 이점도 없다고 문서가 함께 적는다.',
    cite:["If the writer instance in a cluster becomes unavailable, Aurora automatically promotes one of the reader instances to take its place as the new writer.",
          "Promoting an Aurora Replica by failover is much faster than recreating the primary instance."],
    ref:'sql/binlog.cc', sym:'MYSQL_BIN_LOG::recover',
    ops:{ rd:{ set:{ '리더 1':{ tag:'hold', sub:'프라이머리로 승격' } } },
          wr:{ set:{ '역할':'교체됨' } } },
    beat:1 },
  ],
},
];

export { SCENES };
