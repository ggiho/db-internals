/* watch 절이 인용하는 I_S · P_S 테이블 이름이 실제로 있는지 검사하기 위한 목록. */
import fs from 'fs';
import path from 'path';

/* 데이터 로딩 — eval 이 아니라 import() 다. 데이터 파일이 export 를 갖게 되면서
   기존 eval 로더(^const → globalThis)는 export 문에서 깨진다. */
const __here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__here, '..');
async function loadDeck(deck) {
  const g = {};
  for (const f of ['deck', 'actors', 'scenes', 'linemap', 'code', 'booktext', 'booksrc']) {
    const p = path.join(ROOT, 'data', deck, f + '.js');
    if (!fs.existsSync(p)) continue;
    Object.assign(g, await import('file://' + p));
  }
  for (const f of ['knobmap', 'statusmap', 'tablemap']) {
    const p = path.join(ROOT, 'data', 'shared', f + '.js');
    if (fs.existsSync(p)) Object.assign(g, await import('file://' + p));
  }
  for (const [k, v] of Object.entries(g)) if (k !== 'default') globalThis[k] = v;
  return g;
}
/* 기본값은 형제 디렉터리 ../mysql-server — MYSQL_SRC 로 덮어쓸 수 있다. */
/* 이 도구는 덱과 무관하게 MySQL 소스에서 전역 표를 만든다 — 덱별 소스 루트가 필요 없다. */
const R = process.env.MYSQL_SRC || path.resolve(ROOT, '..', 'mysql-server');
const names = new Set();
/* InnoDB 의 I_S 플러그인 테이블 */
const is = fs.readFileSync(R + '/storage/innobase/handler/i_s.cc', 'utf8');
[...is.matchAll(/STRUCT_FLD\(name,\s*"([A-Z_0-9]+)"\)/g)].forEach(m => names.add(m[1]));
/* 서버 쪽 I_S 뷰 */
try {
  const dir = R + '/sql/dd/impl/system_views';
  fs.readdirSync(dir).filter(f => f.endsWith('.cc')).forEach(f => {
    const t = fs.readFileSync(dir + '/' + f, 'utf8');
    [...t.matchAll(/set_view_name\("([A-Za-z_0-9]+)"\)/g)].forEach(m => names.add(m[1].toUpperCase()));
  });
} catch (e) {}
/* Performance Schema 테이블 */
try {
  const dir = R + '/storage/perfschema';
  fs.readdirSync(dir).filter(f => f.startsWith('table_') && f.endsWith('.cc')).forEach(f => {
    const t = fs.readFileSync(dir + '/' + f, 'utf8');
    [...t.matchAll(/"([a-z_0-9]{4,})",?\s*$/gm)].forEach(m => {
      if (/^[a-z][a-z_0-9]*$/.test(m[1])) names.add(m[1].toUpperCase());
    });
  });
} catch (e) {}
/* system_views 디렉터리의 파일명 자체도 뷰 이름이다 (tables.cc → TABLES) */
try {
  const dir = R + '/sql/dd/impl/system_views';
  fs.readdirSync(dir).filter(f => f.endsWith('.cc')).forEach(f =>
    names.add(f.replace(/\.cc$/, '').toUpperCase()));
} catch (e) {}
fs.writeFileSync(__dirname + '/tablemap.js', 'const TABLES = ' + JSON.stringify([...names]) + ';\n');
console.log('I_S · P_S 테이블 이름 ' + names.size + '개 추출');
for (const t of ['INNODB_TRX','INNODB_TABLESTATS','INNODB_TABLESPACES','DATA_LOCKS',
                 'DATA_LOCK_WAITS','METADATA_LOCKS','EVENTS_TRANSACTIONS_CURRENT',
                 'EVENTS_ERRORS_SUMMARY_GLOBAL_BY_ERROR','TABLES'])
  console.log('  ' + (names.has(t) ? '✓ ' : '✗ ') + t);
