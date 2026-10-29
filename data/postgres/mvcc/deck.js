/* PostgreSQL 편 첫 덱 — MVCC 가 튜플 안에 사는 방식과 그 대가(VACUUM).
   InnoDB 는 옛 버전을 undo 에 두지만 PG 는 힙 안에 그대로 남긴다 —
   그 한 가지 차이가 이 덱의 모든 장면을 만든다. */
const DECK = {
  title: 'PostgreSQL MVCC · VACUUM',
  blurb: 'PostgreSQL 은 옛 버전을 지우지 않고 힙에 그대로 둔다. 그 쓰레기를 누가, 언제 치우나.',
  brand: 'POSTGRESQL 18.6',
  brand2: 'MVCC  ·  vs INNODB',
  favicon: '🐘',
};

export { DECK };
