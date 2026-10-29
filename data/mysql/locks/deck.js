/* 락 덱 — "언제 무엇이 잡히는가" 한 가지만 다룬다.
   락은 두 층에서 잡힌다(MDL · InnoDB)는 사실이 이 덱의 주제다. */
const DECK = {
  title: 'MySQL Lock Stage',
  blurb: '평범한 SELECT 는 행 락을 몇 개 잡을까. MDL 부터 gap lock 까지 data_locks 로 하나씩 센다.',
  brand: 'MYSQL 8.4.8',
  brand2: 'LOCKS',
  favicon: '🔒',
};

export { DECK };
