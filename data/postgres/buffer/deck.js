/* PG 편 다섯 번째 덱 — shared buffers 가 빈 자리를 어떻게 만드는가.
   mysql/innodb 05·06(LRU · 축출)과 정면으로 대조된다. InnoDB 는 목록 셋(LRU · free · flush)을
   두고 LRU 를 young · old 로 나눈다. PG 는 목록 대신 버퍼마다 사용 횟수 하나를 두고 시계
   바늘이 그것을 깎으며 돈다 — 그리고 큰 스캔은 아예 따로 작은 링 안에서만 돈다. */
const DECK = {
  title: 'PostgreSQL shared buffers',
  brand: 'POSTGRESQL 18.6',
  brand2: 'SHARED BUFFERS  ·  vs INNODB',
  favicon: '🐘',
};

export { DECK };
