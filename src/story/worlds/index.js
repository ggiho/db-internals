/* 장면 → 세계. 전용 세계(BESPOKE)가 있으면 그것, 없으면 STORY 에 적힌 장면은 범용 무대다.
   전용 세계는 짝 장면이 같은 id 를 쓴다(01 · 01v) — 짝을 바꿔도 장을 다시 만들지 않고 알갱이가 그 자리에서 날아간다.
   무대는 장면마다 id 가 다르다 — 무대는 만들 때 그 장면의 배우 · 각본으로 상자를 짜므로, 짝을 바꾸면 새로 짜야 한다. */
import { STORY } from '../has.js';

const ch301 = { id: 'ch3-01', load: () => import('./ch3-01.js') };
const ch306b = { id: 'ch3-06b', load: () => import('./ch3-06b.js') };
/* ch3 의 나머지 21 장면은 한 세계(ch3-page)가 그린다. 짝(04b · 04bv, 05 · 05v)은 setScene 으로 바꾼다 */
const ch3Page = { id: 'ch3-page', load: () => import('./ch3-page.js') };
const CH3P = ['02', '02a', '03', '03a', '04', '04a', '04b', '04bv', '04c', '05', '05v', '06', '06a', '07', '07a', '08', '08a', '09', '09a', '10', '11'];
const pgBuf01 = { id: 'pg-buffer-01', load: () => import('./pg-buffer-01.js') };
/* aurora 는 덱 하나를 aurora.js 가 맡는다(05 quorum · 08 세그먼트는 그 안에서 aurora-05 를 부른다). 짝 장면이 없으므로 id 는 장면마다 —
   같은 id 를 쓰면 스텝 수가 같은 두 장면(03 · 06, 05 · 07) 사이를 메뉴로 옮길 때 세계를 다시 만들지 않는다 */
const auroraDeck = (n) => ({ id: 'aurora:' + n, load: () => import('./aurora.js') });
const wt01 = { id: 'wt-01', load: () => import('./wt-01.js') };
const wtDeck = { id: 'wt-deck', load: () => import('./wt-deck.js') };
const innodb01 = { id: 'innodb-01', load: () => import('./innodb-01.js') };
const pgBtree = { id: 'pg-btree', load: () => import('./pg-btree.js') };
const pgMvcc = { id: 'pg-mvcc', load: () => import('./pg-mvcc.js') };
const pgHeap = { id: 'pg-heap', load: () => import('./pg-heap.js') };
const pgWal = { id: 'pg-wal', load: () => import('./pg-wal.js') };
const pgLocks = { id: 'pg-locks', load: () => import('./pg-locks.js') };
const pgBuffer = { id: 'pg-buffer', load: () => import('./pg-buffer.js') };
const innodbMvcc = { id: 'innodb-mvcc', load: () => import('./innodb-mvcc.js') };
const innodbLru = { id: 'innodb-lru', load: () => import('./innodb-lru.js') };
const innodbLsn = { id: 'innodb-lsn', load: () => import('./innodb-lsn.js') };
const innodbLock = { id: 'innodb-lock', load: () => import('./innodb-lock.js') };
const innodbTree = { id: 'innodb-tree', load: () => import('./innodb-tree.js') };
const innodbMdl = { id: 'innodb-mdl', load: () => import('./innodb-mdl.js') };
const innodbMx = (n) => ({ id: 'innodb-mx:' + n, load: () => import('./innodb-mx.js') });
const bookCh2 = { id: 'book-ch2', load: () => import('./ch2.js') };
const loadStage = () => import('./stage.js');

export const BESPOKE = {
  'book/ch2': Object.fromEntries(['01', '02', '03', '03v', '04', '05', '05v', '06', '06a', '07', '08', '08a', '08b', '09', '10', '10a', '11'].map((n) => [n, bookCh2])),
  'book/ch3': { '01': ch301, '01v': ch301, '06b': ch306b, ...Object.fromEntries(CH3P.map((n) => [n, ch3Page])) },
  'postgres/buffer': { '01': pgBuf01, ...Object.fromEntries(['02', '03', '04', '05', '06'].map((n) => [n, pgBuffer])) },
  'aurora/mysql': Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08'].map((n) => [n, auroraDeck(n)])),
  'mongodb/wiredtiger': { '01': wt01, ...Object.fromEntries(['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'].map((n) => [n, wtDeck])) },
  'mysql/innodb': { '01': innodb01, '02': innodbMvcc, '03': innodbLsn, '04': innodbLsn, '05': innodbLru, '05v': innodbLru, '06': innodbLru, '07': innodbLock, '08': innodbLock, '09': innodbMdl, '10': innodbTree, '11': innodbMvcc, '12': innodbMvcc, '13': innodbLsn },
  'mysql/locks': { ...Object.fromEntries(['01', '02', '02v', '03', '05', '06', '06v', '07', '08', '09', '12'].map((n) => [n, innodbLock])), '04': innodbMx('04'), '10': innodbMx('10'), '11': innodbMdl },
  'postgres/btree': Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08'].map((n) => [n, pgBtree])),
  'postgres/locks': Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08'].map((n) => [n, pgLocks])),
  'postgres/wal': Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08'].map((n) => [n, pgWal])),
  'postgres/heap': Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((n) => [n, pgHeap])),
  'postgres/mvcc': Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map((n) => [n, pgMvcc])),
};

export function worldOf(deck, num) {
  const b = BESPOKE[deck] && BESPOKE[deck][num];
  if (b) return b;
  return STORY[deck] && STORY[deck].nums.includes(num) ? { id: 'stage:' + deck + '/' + num, load: loadStage } : null;
}
