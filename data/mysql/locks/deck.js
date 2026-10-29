/* 락 덱 — "언제 무엇이 잡히는가" 한 가지만 다룬다.
   락은 두 층에서 잡힌다(MDL · InnoDB)는 사실이 이 덱의 주제다. */
const DECK = {
  title: 'MySQL Lock Stage',
  blurb: 'MDL 과 InnoDB 락 두 층 — 테이블 락 · 호환표 · secondary → PK · FK · NOWAIT · SKIP LOCKED',
  brand: 'MYSQL 8.4.8',
  brand2: 'LOCKS',
  favicon: '🔒',
};

export { DECK };
