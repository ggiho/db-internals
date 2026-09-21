/* 덱마다 소스 트리가 다르다 — mysql/* 는 MySQL, postgres/* 는 PostgreSQL 이다.
   book/* 은 책과 InnoDB 를 대조하는 덱이므로 MySQL 을 본다.
   경로를 도구마다 박아 두면 엔진을 늘릴 때 전부 고쳐야 하므로 한 곳에 모은다.

   후보를 순서대로 본다. 저장소가 옮겨 다니기 때문이다 —
   MySQL 트리가 ../mysql-server 에서 ~/src/github.com/mysql/mysql-server 로 옮겨갔고,
   그때 도구 넷이 한꺼번에 "파일 없음" 이 됐다. 환경변수를 매번 주는 것으로 때우면
   잊는 순간 조용히 실패하므로(실제로 stderr 를 버려 낡은 결과를 읽은 적이 있다)
   찾을 수 있는 곳을 아예 적어 둔다.

   절대경로에 사용자 이름을 박지 않는다 — 공개 저장소에 남는다. homedir() 로 푼다. */
import path from 'path';
import os from 'os';
import fs from 'fs';

/* 대조하는 버전. 트리가 사라졌을 때 무엇을 되살려야 하는지 이것 말고는 알 방법이 없다 —
   실제로 PostgreSQL 트리가 없어졌을 때 버전이 어디에도 없어 짐작으로 클론해야 했다.
   버전이 바뀌면 fact 대조가 어긋나므로 도구가 알려 준다.
     MySQL      8.4.8      ~/src/github.com/mysql/mysql-server
     PostgreSQL 17.11    (REL_17_STABLE) 얕은 클론으로 충분하다 :
       git clone --depth 1 --filter=blob:none --branch REL_17_STABLE \
         https://github.com/postgres/postgres.git */

/* 그 트리인지 확인하는 표식 — 빈 디렉터리를 붙잡지 않도록. */
const MARK = {
  mysql: 'storage/innobase/trx/trx0trx.cc',
  postgres: 'src/include/access/htup_details.h',
};

function pick(kind, env, cands) {
  if (env) return env;                       /* 명시한 경로는 그대로 쓴다 — 확인도 하지 않는다 */
  for (const c of cands) {
    if (c && fs.existsSync(path.join(c, MARK[kind]))) return c;
  }
  return cands[0];                           /* 못 찾으면 첫 후보를 돌려 호출부가 제 메시지를 내게 한다 */
}

export function srcRoot(deck, ROOT) {
  const g = String(deck || '').split('/')[0];
  const home = os.homedir();
  if (g === 'postgres') {
    return pick('postgres', process.env.PG_SRC, [
      path.resolve(ROOT, '..', '..', 'PostgreSQL', 'postgres'),
      path.join(home, 'src', 'github.com', 'postgres', 'postgres'),
    ]);
  }
  /* mysql/* · book/* · aurora/* · 그 밖 — aurora 는 닫힌 소스라 대조할 코드가 없다.
     이 덱의 ref/sym 은 Aurora 가 '무엇을 바꿨는지' 의 대상인 InnoDB 를 가리킨다. */
  return pick('mysql', process.env.MYSQL_SRC, [
    path.resolve(ROOT, '..', 'mysql-server'),
    path.join(home, 'src', 'github.com', 'mysql', 'mysql-server'),
  ]);
}
