/* PG 편 세 번째 덱 — 락이 어디에 사는가.
   행 락은 튜플에, 테이블·객체 락은 공유 메모리 표에 산다.
   mysql/locks 와 짝이 되는 덱이다. */
const DECK = {
  title: 'PostgreSQL Locks',
  blurb: '락이 어디에 어떻게 사나 — 모드 · 충돌표 · deadlock · SSI · 대기 줄 · 행 락 · fast-path',
  brand: 'POSTGRESQL 18.6',
  brand2: 'LOCKS  ·  vs INNODB',
  favicon: '🐘',
};

export { DECK };
