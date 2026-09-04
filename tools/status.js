/* Innodb_* 상태 변수의 실제 이름을 뽑는다.
   ha_innodb.cc 의 innodb_status_variables 배열에는 접두어 없이 들어 있고,
   플러그인 프레임워크가 Innodb_ 를 붙인다. */
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
const R = process.env.MYSQL_SRC || path.resolve(ROOT, '..', 'mysql-server');
const src = fs.readFileSync(R + '/storage/innobase/handler/ha_innodb.cc', 'utf8');
const a = src.indexOf('innodb_status_variables[]');
const b = src.indexOf('{NullS,', a);
const seg = src.slice(a, b > 0 ? b : a + 40000);
const names = [...new Set([...seg.matchAll(/\{"([a-z0-9_]+)"/g)].map(m => m[1]))];
fs.writeFileSync(__dirname + '/statusmap.js', 'const STATUS = ' + JSON.stringify(names) + ';\n');
console.log('Innodb_* 상태 변수 ' + names.length + '개 추출');
