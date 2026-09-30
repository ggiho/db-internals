/* PG 편 여섯 번째 덱 — B-tree 인덱스가 자리를 만드는 방식.
   mysql/innodb 10(페이지 분할)과 book/ch2 의 분할 장면과 대조된다. InnoDB 는 페이지가 차면
   가르고, 같은 키도 항목마다 따로 둔다. PG 는 가르기 전에 세 번 치워 보고, 같은 키는
   TID 배열 하나로 묶는다 — 그리고 읽는 쪽은 락 없이 오른쪽 링크를 따라간다. */
const DECK = {
  title: 'PostgreSQL B-tree',
  brand: 'POSTGRESQL 18.6',
  brand2: 'NBTREE  ·  vs INNODB',
  favicon: '🐘',
};

export { DECK };
