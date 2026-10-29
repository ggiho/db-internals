/* PG 편 네 번째 덱 — WAL 과 크래시 복구.
   mysql/innodb 03·04(크래시 복구·checkpoint)와 정면으로 대조된다.
   같은 문제를 두 엔진이 다르게 풀었다 : InnoDB 는 doublewrite 버퍼라는 별도 영역을 두고,
   PG 는 WAL 안에 페이지 전체 이미지를 넣는다. */
const DECK = {
  title: 'PostgreSQL WAL & Crash Recovery',
  blurb: 'checkpoint 뒤의 첫 변경은 page 를 통째로 WAL 에 쓴다. crash 뒤에는 무엇을 다시 하나.',
  brand: 'POSTGRESQL 18.6',
  brand2: 'WAL  ·  vs INNODB REDO',
  favicon: '🐘',
};

export { DECK };
