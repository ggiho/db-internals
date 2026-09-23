/* 덱이 화면에 띄우는 버전과 실제로 대조하는 소스 트리의 버전이 같은지 본다.
   이 검사가 없어서 PG 덱이 18.6 이라고 적는 동안 17.11 을 대조했고, 두 버전에서 모두
   성립하는 인용들 덕에 아무 경고 없이 통과했다 — 그러다 한 건이 어긋났을 때 소스가
   아니라 덱이 틀렸다고 판단해 맞는 인용을 고쳤다.
   대조가 통과하는 것은 "버전이 맞다" 가 아니다. 버전은 따로 확인해야 한다. */
import fs from 'fs';
import path from 'path';
import { srcRoot } from './srcroot.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DECKS = ['mysql/innodb', 'mysql/locks', 'postgres/mvcc', 'postgres/heap',
  'postgres/locks', 'aurora/mysql', 'book/ch2', 'book/ch3'];

/* 트리에서 버전을 읽는다 — 엔진마다 적어 두는 자리가 다르다. */
function treeVer(kind, root) {
  try {
    if (kind === 'mysql') {
      const v = fs.readFileSync(path.join(root, 'MYSQL_VERSION'), 'utf8');
      const g = (k) => (v.match(new RegExp(k + '=(\\d+)')) || [])[1];
      return g('MYSQL_VERSION_MAJOR') + '.' + g('MYSQL_VERSION_MINOR') + '.' + g('MYSQL_VERSION_PATCH');
    }
    const c = fs.readFileSync(path.join(root, 'configure.ac'), 'utf8');
    return (c.match(/AC_INIT\(\[PostgreSQL\],\s*\[([\d.]+)\]/) || [])[1] || '?';
  } catch { return null; }
}

let bad = 0, n = 0;
for (const deck of DECKS) {
  const m = await import(path.join(ROOT, 'data', deck, 'deck.js'));
  const brand = String(m.DECK.brand || '');
  /* brand 에 버전이 없는 덱(책·Aurora)은 대조할 대상이 없다 — 건너뛴다. */
  const want = (brand.match(/(\d+\.\d+(?:\.\d+)?)/) || [])[1];
  if (!want) { console.log('  ' + deck.padEnd(15) + ' brand "' + brand + '" — 버전 없음 · 건너뜀'); continue; }
  const kind = deck.startsWith('postgres') ? 'postgres' : 'mysql';
  const root = srcRoot(deck, ROOT);
  const got = treeVer(kind, root);
  n++;
  if (got === null) { console.log('  ! ' + deck.padEnd(15) + ' 트리를 읽지 못했다 : ' + root); bad++; continue; }
  const ok = got === want || got.startsWith(want + '.') || want.startsWith(got + '.');
  console.log((ok ? '  ' : '  ! ') + deck.padEnd(15) + ' 덱 ' + want + '  ·  트리 ' + got + (ok ? '' : '  ← 어긋난다'));
  if (!ok) bad++;
}
console.log(bad ? '버전 불일치 ' + bad + '건 / ' + n : '버전 일치 ' + n + '건');
process.exit(bad ? 1 : 0);
