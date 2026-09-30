/* PG 덱의 "실제 서버에서 보는 법" 이 가리키는 뷰 · 열이 대조하는 판(18)에 있는가.
   이 칸은 아무것도 대조하지 않았다 — wal 01 · 03 이 pg_stat_bgwriter 의 checkpoints_timed ·
   checkpoints_req 를 보라고 했는데, 그 열은 17 에서 pg_stat_checkpointer 의 num_timed ·
   num_requested 로 옮겨 갔다. 18 의 pg_stat_bgwriter 에는 buffers_clean 등 넷만 남았다.

   읽는 것 : src/backend/catalog/system_views.sql 의 CREATE VIEW (SELECT * FROM 다른뷰 는 그 열을
   물려받는다), src/include/catalog/<이름>.h (pg_class 같은 카탈로그), pg_proc.dat (함수).
   뷰 이름 뒤 설명에 있는 snake_case 낱말은 그 뷰의 열이거나 설정 이름(guc_tables.c)이어야 한다.
   확장(pageinspect 등)과 도구(pg_waldump)는 대조하지 않는다. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { srcRoot } from './srcroot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = srcRoot('postgres/x', ROOT);
const read = (f) => fs.readFileSync(path.join(P, f), 'utf8');
if (!fs.existsSync(path.join(P, 'src/backend/catalog/system_views.sql'))) {
  console.log('pgwatch : PostgreSQL 트리를 못 찾았다 — 미검증이다 (' + P + ')');
  process.exit(1);
}
const sql = read('src/backend/catalog/system_views.sql');
const guc = read('src/backend/utils/misc/guc_tables.c');
const procs = read('src/include/catalog/pg_proc.dat');

const views = {};
for (const m of sql.matchAll(/CREATE (?:OR REPLACE )?VIEW (\w+)(?:\([^)]*\))? AS([\s\S]*?);/g)) {
  const cols = new Set([...m[2].matchAll(/\b([a-z_][a-z0-9_]*)\b/g)].map((x) => x[1]));
  const star = /SELECT\s+\*\s+FROM\s+(\w+)/.exec(m[2]);
  views[m[1]] = { cols, from: star && star[1] };
}
for (const v of Object.values(views)) if (v.from && views[v.from]) for (const c of views[v.from].cols) v.cols.add(c);
const catFile = (v) => path.join(P, 'src/include/catalog', v + '.h');
const catCols = (v) => new Set([...fs.readFileSync(catFile(v), 'utf8')
  .matchAll(/\b(\w+)\s*(?:BKI_[A-Z_]+(?:\([^)]*\))?\s*)*;/g)].map((x) => x[1]));
const TOOLS = ['pg_buffercache', 'pageinspect', 'pgstattuple', 'pg_visibility', 'pg_waldump',
  'pg_controldata', 'pg_walinspect', 'pg_freespacemap'];

const { DECKS } = await import(path.join(ROOT, 'src/decks.js'));
let bad = 0, seen = 0;
for (const d of Object.keys(DECKS).filter((d) => d.startsWith('postgres/'))) {
  const { SCENES } = await import(path.join(ROOT, 'data', d, 'scenes.js'));
  for (const sc of SCENES) for (const [what, desc] of sc.watch || []) {
    for (const [, v] of String(what).matchAll(/\b(pg_\w+)\b/g)) {
      seen++;
      if (TOOLS.includes(v)) continue;
      if (views[v]) {
        for (const [, c] of String(desc).matchAll(/\b([a-z]+_[a-z0-9_]+)\b/g)) {
          if (views[v].cols.has(c) || guc.includes('{"' + c + '"')) continue;
          bad++; console.log(`  ! ${d} ${sc.num} : ${v} 에 ${c} 열이 없다  [${desc}]`);
        }
      } else if (fs.existsSync(catFile(v))) {
        for (const [, c] of String(what).matchAll(new RegExp(v + '\\.(\\w+)', 'g')))
          if (!catCols(v).has(c)) { bad++; console.log(`  ! ${d} ${sc.num} : ${v} 에 ${c} 열이 없다`); }
      } else if (!procs.includes("proname => '" + v + "'")) {
        bad++; console.log(`  ! ${d} ${sc.num} : ${v} — 뷰도 카탈로그도 함수도 아니다  [${what}]`);
      }
    }
  }
}
console.log(`pgwatch : 이름 ${seen}개 대조 · 없는 것 ${bad}`);
process.exit(bad ? 1 : 0);
