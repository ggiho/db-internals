/* 저장소에서 innodb_* 시스템 변수의 실제 이름과 기본값을 뽑는다.
   변수 이름을 손으로 쓰면 오타나 이미 없어진 이름을 적게 된다. */
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
const src = fs.readFileSync(R + '/storage/innobase/handler/ha_innodb.cc', 'utf8');
const out = {};
/* MYSQL_SYSVAR_* ( name , var , flags , "desc" , check , update , default , min , max , blk ) */
/* SYSVAR 와 THDVAR 둘 다 — 세션 변수(lock_wait_timeout 등) 11개가 THDVAR 로 선언돼 있다 */
const re = /MYSQL_(?:SYS|THD)VAR_(\w+)\(\s*([a-z0-9_]+)\s*,([\s\S]*?)\);/g;
let m;
while ((m = re.exec(src))) {
  const kind = m[1], name = 'innodb_' + m[2], body = m[3];
  if (/^(STR|BOOL|ENUM|SET|UINT|ULONG|LONG|LONGLONG|ULONGLONG|INT|DOUBLE)$/.test(kind) === false) continue;
  /* 설명 문자열 뒤의 인자들에서 기본값을 고른다 */
  const after = body.replace(/"(?:[^"\\]|\\.)*"/g, '"S"');
  const args = after.split(',').map(s => s.trim()).filter(Boolean);
  const i = args.findIndex(a => a === '"S"' || a.startsWith('"S"'));
  let def = null;
  if (i >= 0) {
    const tail = args.slice(i + 1).filter(a => !/^(nullptr|NULL|innodb_\w+|check_\w+|\w+_validate|\w+_update)$/.test(a));
    if (tail.length) def = tail[0];
  }
  out[name] = { kind: kind.toLowerCase(), def };
}
fs.writeFileSync(__dirname + '/knobmap.js', 'const KNOBS = ' + JSON.stringify(out) + ';\n');
console.log('innodb_* 변수 ' + Object.keys(out).length + '개 추출');
for (const n of ['innodb_old_blocks_pct','innodb_old_blocks_time','innodb_read_ahead_threshold',
                 'innodb_buffer_pool_size','innodb_doublewrite','innodb_flush_log_at_trx_commit',
                 'innodb_lock_wait_timeout','innodb_online_alter_log_max_size','innodb_page_cleaners',
                 'innodb_deadlock_detect','innodb_max_dirty_pages_pct','innodb_io_capacity'])
  console.log('  ' + n.padEnd(36) + (out[n] ? '기본 ' + out[n].def : '✗ 없음'));
