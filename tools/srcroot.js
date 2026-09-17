/* 덱마다 소스 트리가 다르다 — mysql/* 는 MySQL, postgres/* 는 PostgreSQL 이다.
   book/* 은 책과 InnoDB 를 대조하는 덱이므로 MySQL 을 본다.
   경로를 도구마다 박아 두면 엔진을 늘릴 때 전부 고쳐야 하므로 한 곳에 모은다. */
import path from 'path';

export function srcRoot(deck, ROOT) {
  const g = String(deck || '').split('/')[0];
  if (g === 'postgres')
    return process.env.PG_SRC || path.resolve(ROOT, '..', '..', 'PostgreSQL', 'postgres');
  /* mysql/* · book/* · aurora/* · 그 밖 — aurora 는 닫힌 소스라 대조할 코드가 없다.
     이 덱의 ref/sym 은 Aurora 가 '무엇을 바꿨는지' 의 대상인 InnoDB 를 가리킨다. */
  return process.env.MYSQL_SRC || path.resolve(ROOT, '..', 'mysql-server');
}
