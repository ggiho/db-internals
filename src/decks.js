/* 덱 이름은 <묶음>/<덱> 두 단계다 — 엔진을 늘릴 것이므로 처음부터 계층을 둔다.
   평평하게 두면 PostgreSQL 의 mvcc·locks 와 InnoDB 의 것이 이름부터 부딪히고,
   나중에 바꾸면 그전에 공유된 링크가 전부 깨진다. 그래서 지금 정한다.
   묶음 라벨(g)은 상단 메뉴에서 덱들을 묶는 데 쓴다. */
export const DECKS = {
  'mysql/innodb': { g: 'MYSQL', lb: 'innodb', load: () => import('../data/mysql/innodb/index.js') },
  'mysql/locks':  { g: 'MYSQL', lb: 'locks',  load: () => import('../data/mysql/locks/index.js') },
  'postgres/mvcc':{ g: 'POSTGRES', lb: 'mvcc', load: () => import('../data/postgres/mvcc/index.js') },
  'postgres/heap':{ g: 'POSTGRES', lb: 'heap', load: () => import('../data/postgres/heap/index.js') },
  'postgres/locks':{ g: 'POSTGRES', lb: 'locks', load: () => import('../data/postgres/locks/index.js') },
  'postgres/wal': { g: 'POSTGRES', lb: 'wal',   load: () => import('../data/postgres/wal/index.js') },
  'aurora/mysql': { g: 'AURORA', lb: 'mysql', load: () => import('../data/aurora/mysql/index.js') },
  'book/ch2':     { g: 'BOOK',  lb: 'ch2',    load: () => import('../data/book/ch2/index.js') },
  'book/ch3':     { g: 'BOOK',  lb: 'ch3',    load: () => import('../data/book/ch3/index.js') },
};
