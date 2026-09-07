#!/bin/sh
# 데이터 층 검증 — 렌더러가 React 로 바뀌어도 이 검사들은 그대로다.
# 옛 build.sh 의 검증 부분을 옮긴 것. 오류가 있으면 1 로 끝난다.
set -e
cd "$(dirname "$0")/.."
FAIL=0
for d in mysql/innodb mysql/locks postgres/mvcc book/ch2 book/ch3; do
  printf '── %s\n' "$d"
  node tools/verify.js     "$d" || FAIL=1
  node tools/mxcheck.js    "$d" || FAIL=1
  node tools/claimcheck.js "$d" || FAIL=1
done
[ "$FAIL" = 0 ] && echo "── 전부 통과" || { echo "── 실패 있음"; exit 1; }
