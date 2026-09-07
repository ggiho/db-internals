/* 원칙 : InnoDB 와 같은 문제(가변 길이 레코드를 한 페이지에 담기)를
   어떻게 다르게 풀었는지 바이트로 보인다. book/ch3 05·06 과 짝이 되는 덱이다. */
const SCENES = [
{
  num:'01', tab:'8KB', title:'페이지는 8KB 다 — InnoDB 의 절반',
  sub:'그리고 고를 수 있는 값도 2의 거듭제곱뿐이다',
  cast:['op','sp','cmp'],
  knobs:[
    ['—','—','컴파일 시점에 정해진다 — 실행 중 바꿀 수 없다']],
  watch:[
    ['SHOW block_size','8192 가 나온다 — 읽기 전용이다'],
    ['pg_settings','block_size 의 context 가 internal 이다']],
  links:[['02','페이지 헤더'],['03','라인 포인터']],
  init:{
    op:{ kv:{ '무엇':'페이지 한 장을 읽는다', '크기':'—' } },
    sp:{ kv:{ '전체':'—', '헤더':'—', '데이터':'—' } },
    cmp:{ kv:{ 'PostgreSQL':'—', 'InnoDB':'—' } },
  },
  steps:[
  { look:{ op:true },
    note:'기본 8KB — configure 의 blocksize 가 8(kB)로 잡혀 있다',
    why:'configure.ac 의 blocksize 기본값이 8 이고 meson 쪽 선택지는 1·2·4·8·16·32 다. 즉 컴파일 시점에 정해지고 실행 중에는 바꿀 수 없다.',
    key:'InnoDB 는 <em>16KB</em>이고 innodb_page_size 로 재시작 없이는 못 바꾸지만 설정 값이다. PG 는 <em>빌드 시점 상수</em>다 — 바꾸려면 다시 컴파일하고 데이터를 새로 적재해야 한다.',
    ref:'src/include/storage/bufpage.h', sym:'PageHeaderData',
    fact:[['configure.ac','[blocksize=8])']],
    ops:{ op:{ set:{ '크기':'8,192바이트' } },
          cmp:{ set:{ 'PostgreSQL':'8KB  ·  빌드 상수', 'InnoDB':'16KB  ·  설정' } } } },

  { look:{ sp:true },
    note:'선택지가 2의 거듭제곱뿐인 것도 같다',
    why:'1·2·4·8·16·32 kB 중에서만 고를 수 있다. 페이지 안 오프셋 계산이 비트 연산으로 끝나게 하려는 제약이고, InnoDB 가 UNIV_PAGE_SIZE_DEF 를 1 << 14 로 정의한 것과 같은 이유다.',
    key:'두 엔진이 <em>다른 크기를 고르고 같은 제약을 지킨다</em>. InnoDB 쪽 근거는 BOOK CH2 의 블록 장면에 있다 — 여기서는 그 선택지 목록이 그 제약을 드러낸다.',
    ref:'src/include/storage/bufpage.h', sym:'SizeOfPageHeaderData',
    fact:[['configure.ac','set table block size in kB']],
    ops:{ sp:{ set:{ '전체':'8,192', '헤더':'24', '데이터':'8,168 (트레일러 없음)' } } },
    beat:1 },
  ],
},
{
  num:'02', tab:'페이지 헤더', title:'24바이트 헤더를 한 칸씩',
  sub:'InnoDB 의 38바이트 FIL 헤더와 같은 자리를 다르게 쓴다',
  cast:['hdr','cmp'],
  knobs:[
    ['—','—','배치는 구조체 정의가 정한다']],
  watch:[
    ['pageinspect','page_header() 가 이 필드들을 그대로 돌려준다'],
    ['pg_controldata','페이지 버전은 여기와 맞아야 한다']],
  links:[['01','8KB'],['03','라인 포인터']],
  init:{
    /* 칸 폭이 실제 바이트 수를 나타낸다 — sz 가 그 폭이다. 합이 24 여야 한다. */
    hdr:{ items:[
      { id:'pd_lsn',    sz:8, sub:'0 · LSN',        tag:'hdr' },
      { id:'pd_checksum', sz:2, sub:'8 · 체크섬',    tag:'hdr' },
      { id:'pd_flags',  sz:2, sub:'10 · 플래그',     tag:'hdr' },
      { id:'pd_lower',  sz:2, sub:'12 · 빈 곳 시작', tag:'hdr' },
      { id:'pd_upper',  sz:2, sub:'14 · 빈 곳 끝',   tag:'hdr' },
      { id:'pd_special', sz:2, sub:'16 · special',  tag:'hdr' },
      { id:'pd_size_ver', sz:2, sub:'18 · pd_pagesize_version', tag:'hdr' },
      { id:'pd_prune_xid', sz:4, sub:'20 · 정리 XID', tag:'hdr' }] },
    cmp:{ kv:{ 'PostgreSQL':'—', 'InnoDB':'—' } },
  },
  steps:[
  { look:{ hdr:['pd_lsn'] },
    note:'첫 8바이트가 LSN 이다 — InnoDB 도 같은 값을 갖지만 자리가 다르다',
    why:'PageHeaderData 의 첫 필드가 pd_lsn 이고 주석이 "이 페이지의 마지막 변경에 대한 xlog 레코드의 마지막 바이트 다음" 이라고 적는다. 복구가 이 값을 보고 재생 여부를 정한다.',
    key:'InnoDB 는 LSN 을 <em>오프셋 16</em>에 두고 트레일러에 하위 4바이트를 한 번 더 쓴다(book/ch3 11). PG 는 <em>맨 앞에 한 번만</em> 둔다 — 대신 체크섬을 따로 갖는다.',
    ref:'src/include/storage/bufpage.h', sym:'PageHeaderData',
    fact:[['src/include/storage/bufpage.h','PageXLogRecPtr pd_lsn;']],
    ops:{ cmp:{ set:{ 'PostgreSQL':'LSN 오프셋 0', 'InnoDB':'LSN 오프셋 16 + 트레일러' } } } },

  { look:{ hdr:['pd_lower','pd_upper'] },
    note:'빈 공간을 두 오프셋으로 표시한다 — 아래와 위',
    why:'pd_lower 는 빈 공간의 시작, pd_upper 는 끝이다. 라인 포인터가 앞에서 자라며 pd_lower 를 밀고, 튜플이 뒤에서 자라며 pd_upper 를 당긴다. 둘이 만나면 그 페이지가 꽉 찬 것이다.',
    key:'InnoDB 는 <em>PAGE_HEAP_TOP 과 슬롯 배열</em>로 같은 일을 한다(book/ch3 05v). 구조가 거울처럼 같다 — <em>두 방향으로 자라 가운데서 만난다</em>.',
    ref:'src/include/storage/bufpage.h', sym:'PageHeaderData',
    fact:[['src/include/storage/bufpage.h','LocationIndex pd_lower;'],
          ['src/include/storage/bufpage.h','LocationIndex pd_upper;']],
    ops:{ cmp:{ set:{ 'PostgreSQL':'pd_lower / pd_upper', 'InnoDB':'PAGE_HEAP_TOP / PAGE_DIR' } } } },

  { look:{ hdr:['pd_prune_xid'] },
    note:'마지막 4바이트는 "여기 치울 것이 있다" 는 쪽지다',
    why:'pd_prune_xid 는 이 페이지에서 정리 가능한 가장 오래된 XID 다. 0 이면 치울 것이 없다는 뜻이라 즉시 정리가 그 자리에서 빠져나온다 — mvcc 덱 03 의 heap_page_prune_opt 가 이 값을 먼저 본다.',
    key:'MVCC 를 힙에 두었기 때문에 <em>페이지 헤더에 정리용 필드가 필요해진다</em>. InnoDB 헤더에는 이런 필드가 없다 — 옛 버전이 undo 에 있으니 페이지가 정리를 알 필요가 없다.',
    ref:'src/include/storage/bufpage.h', sym:'PageHeaderData',
    fact:[['src/include/storage/bufpage.h','TransactionId pd_prune_xid;']],
    ops:{ cmp:{ set:{ 'PostgreSQL':'pd_prune_xid 있음', 'InnoDB':'대응 필드 없음' } } } },

  { look:{ hdr:true },
    note:'그리고 24 라는 수는 코드에 적혀 있지 않다',
    why:'SizeOfPageHeaderData 는 offsetof(PageHeaderData, pd_linp) 로 정의된다. 즉 필드를 더하면 24 가 되지만 그 수를 쓰지 않는다 — 필드를 바꾸면 값이 따라 움직인다.',
    key:'InnoDB 의 <em>FIL_PAGE_DATA = 38</em> 은 리터럴이고 PG 의 <em>SizeOfPageHeaderData</em> 는 계산이다. 같은 문제에 대한 두 가지 태도이고, 뒤쪽이 필드 추가에 강하다.',
    ref:'src/include/storage/bufpage.h', sym:'SizeOfPageHeaderData',
    fact:[['src/include/storage/bufpage.h','#define SizeOfPageHeaderData (offsetof(PageHeaderData, pd_linp))']],
    beat:1 },
  ],
},
{
  num:'03', tab:'라인 포인터', title:'라인 포인터는 4바이트에 세 값을 담는다',
  sub:'InnoDB 슬롯은 2바이트에 오프셋 하나뿐이다',
  cast:['lp','cmp','sp'],
  knobs:[
    ['—','—','비트 폭은 구조체가 정한다']],
  watch:[
    ['pageinspect','heap_page_items() 의 lp_off · lp_flags · lp_len'],
    ['pg_visibility','LP_DEAD 가 많으면 정리가 밀린 것이다']],
  links:[['02','페이지 헤더'],['01','8KB']],
  init:{
    lp:{ items:[
      { id:'lp 1', tag:'clean', sub:'NORMAL · off 8100 · len 60' },
      { id:'lp 2', tag:'x',     sub:'DEAD · len 0' },
      { id:'lp 3', tag:'hold',  sub:'REDIRECT → lp 4' },
      { id:'lp 4', tag:'clean', sub:'NORMAL · off 7900 · len 64' }] },
    cmp:{ kv:{ 'PostgreSQL':'—', 'InnoDB':'—' } },
    sp:{ kv:{ '포인터당':'—', '레코드당':'—' } },
  },
  steps:[
  { look:{ lp:true },
    note:'한 항목이 32비트다 — 오프셋 15 · 상태 2 · 길이 15',
    why:'ItemIdData 는 비트필드다 : lp_off:15, lp_flags:2, lp_len:15. 합이 정확히 32비트이므로 항목 하나가 4바이트다. 오프셋에 15비트면 32,768 까지라 8KB 페이지를 충분히 덮는다.',
    key:'InnoDB 슬롯은 <em>2바이트에 오프셋만</em> 담는다(PAGE_DIR_SLOT_SIZE = 2). PG 는 <em>길이와 상태까지</em> 넣어 4바이트를 쓴다 — 그 대가로 튜플 길이를 헤더에서 바로 알 수 있다.',
    ref:'src/include/storage/itemid.h', sym:'ItemIdData',
    fact:[['src/include/storage/itemid.h','unsigned	lp_off:15,		/* offset to tuple (from start of page) */'],
          ['src/include/storage/itemid.h','lp_len:15;		/* byte length of tuple */']],
    ops:{ cmp:{ set:{ 'PostgreSQL':'4바이트 · off+상태+길이', 'InnoDB':'2바이트 · off 만' } },
          sp:{ set:{ '포인터당':'4바이트' } } } },

  { look:{ lp:true },
    note:'상태는 넷이고 2비트에 정확히 들어맞는다',
    why:'LP_UNUSED 0 · LP_NORMAL 1 · LP_REDIRECT 2 · LP_DEAD 3 이다. 2비트가 표현할 수 있는 네 값을 하나도 남기지 않고 쓴다.',
    key:'폭이 <em>남지도 부족하지도 않다</em>. book/ch3 03 에서 본 "비트를 접어 넣는" 방식이고, PG 도 같은 절약을 한다.',
    ref:'src/include/storage/itemid.h', sym:'LP_REDIRECT',
    fact:[['src/include/storage/itemid.h','#define LP_UNUSED		0'],
          ['src/include/storage/itemid.h','#define LP_REDIRECT		2'],
          ['src/include/storage/itemid.h','#define LP_DEAD			3']] },

  { look:{ lp:true, cmp:true },
    note:'LP_REDIRECT 가 HOT 사슬의 이음매다',
    why:'HOT 갱신에서 인덱스는 옛 라인 포인터를 계속 가리킨다. 즉시 정리가 옛 튜플을 치우면 그 포인터를 지울 수 없으므로 REDIRECT 로 바꿔 새 튜플을 가리키게 한다 — lp_len 은 0 이 된다.',
    key:'mvcc 덱 07 의 HOT 이 <em>이 두 비트로 성립한다</em>. InnoDB 는 세컨더리 인덱스가 항상 클러스터를 다시 찾으므로 이런 이음매가 필요 없다 — 대신 매번 두 번 찾는다.',
    ref:'src/include/storage/itemid.h', sym:'LP_REDIRECT',
    fact:[['src/include/storage/itemid.h','#define LP_REDIRECT		2		/* HOT redirect (should have lp_len=0) */']],
    ops:{ cmp:{ set:{ 'PostgreSQL':'REDIRECT 로 사슬 유지', 'InnoDB':'세컨더리 → 클러스터 재탐색' } } } },

  { look:{ sp:true },
    note:'그래서 포인터 비용도 다르다 — 튜플마다 하나씩',
    why:'PG 는 튜플마다 라인 포인터 하나가 필요하다(4바이트). InnoDB 는 슬롯을 4~8개 레코드마다 하나만 둔다(book/ch3 06) — 레코드 하나당 평균 0.25~0.5바이트다.',
    key:'같은 8KB 에서 <em>PG 는 포인터에 더 쓰고 대신 길이를 얻는다</em>. 어느 쪽이 낫다기보다, 가시성을 힙에 둔 설계가 헤더 비용을 계속 요구한다는 점이 일관된다.',
    ref:'src/include/storage/bufpage.h', sym:'PageHeaderData',
    fact:[['src/include/storage/itemid.h','lp_flags:2,		/* state of line pointer, see below */']],
    ops:{ sp:{ set:{ '레코드당':'PG 4B  ·  InnoDB 0.25~0.5B' } } },
    beat:1 },
  ],
},
];

export { SCENES };
