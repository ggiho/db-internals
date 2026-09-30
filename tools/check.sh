#!/bin/sh
# 데이터 층 검증 — 렌더러가 React 로 바뀌어도 이 검사들은 그대로다.
# 옛 build.sh 의 검증 부분을 옮긴 것. 오류가 있으면 1 로 끝난다.
set -e
cd "$(dirname "$0")/.."
FAIL=0
# 덱이 화면에 띄우는 버전과 실제 대조 트리의 버전이 같은지 먼저 본다 —
# 이것이 없어서 18.6 이라고 적는 덱을 17.11 로 대조한 적이 있다.
node tools/srcver.js || FAIL=1
# 덱 목록은 src/decks.js 에서 읽는다 — 도구마다 목록을 적었더니 서로 어긋났다
DECKS=$(node -e "import('./src/decks.js').then(m => console.log(Object.keys(m.DECKS).join(' ')))")
for d in $DECKS; do
  printf '── %s\n' "$d"
  node tools/verify.js     "$d" || FAIL=1
  # mxcheck 는 InnoDB 주석의 ASCII 표를 읽는다 — PG · MongoDB 덱에는 그 파일이 없다
  case "$d" in postgres/*|mongodb/*) : ;; *) node tools/mxcheck.js "$d" || FAIL=1 ;; esac
  # PG 는 충돌 표가 비트마스크 배열이라 형식이 달라 별도 도구다
  case "$d" in postgres/*) node tools/pgmx.js "$d" || FAIL=1 ;; esac
  node tools/claimcheck.js "$d" || FAIL=1
done
# PG 덱의 "보는 법" 이 가리키는 뷰 · 열 — 17 에서 옮겨 간 열을 18 덱이 가리키고 있었다
printf '── pgwatch\n'
node tools/pgwatch.js || FAIL=1
# 게임 문항과 복습 상태 — 덱 데이터에서 만들어지므로 덱이 바뀌면 함께 깨질 수 있다
printf '── play\n'
# | tail 로 줄이면 종료 코드가 tail 의 것이 되어 실패가 사라진다 — 먼저 받고 나서 줄인다
out=$(node tools/quizcheck.js) || FAIL=1; printf '%s\n' "$out" | tail -3
out=$(node tools/progcheck.js) || FAIL=1; printf '%s\n' "$out" | tail -1
# "이 스텝이 바꾼 것" — 모든 스텝(손잡이 값별 변형 포함)에서 던지지 않고 빈 줄이 없는지
out=$(node tools/deltacheck.js) || FAIL=1; printf '%s\n' "$out" | tail -2
[ "$FAIL" = 0 ] && echo "── 전부 통과" || { echo "── 실패 있음"; exit 1; }
