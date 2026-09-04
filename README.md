# db-internals

데이터베이스 엔진의 내부 동작을 **스텝 단위로 넘겨 보는** 시각화.
한 화면에 한 순간만 담고, 배우(버퍼풀·페이지·락·redo…)가 스텝마다 상태를 바꾼다.

**https://db-internals.pages.dev**

지금은 MySQL 8.4.8 과 *Database Internals* 2·3장 대조를 담고 있고,
PostgreSQL · MongoDB 로 넓힐 것을 전제로 주소와 디렉터리가 엔진 계층을 갖는다.

    #mysql/innodb/01/1        #mysql/locks/04/3        #book/ch3/04a/5
    #<엔진>/<덱>/<장면>/<스텝>  ← 주소가 곧 상태다

## 왜 이런 구조인가

**주장에 근거를 붙인다.** 각 스텝은 소스 파일·심볼을 가리키고, 화면 아래에 그 발췌가
붙는다. 줄 번호는 손으로 쓰지 않는다 — `tools/lines.js` 가 매번 저장소에서 찾는다.
그래야 MySQL 버전이 올라가도 썩지 않는다.

**검사를 사람 판단에 맡기지 않는다.** 락 호환/강도 행렬 150칸은 소스의 배열과
칸 단위로 대조하고(`tools/mxcheck.js`), `NAME = 값` 형태의 주장은 저장소에서
grep 해 확인한다(`tools/claimcheck.js`). 레이아웃은 14폭 × 4,400방문을 훑어
넘침·글자잘림·라벨겹침을 잡는다(`tools/sweep.js`).

## 실행

    npm i
    npm run dev          # http://localhost:5199
    npm run build

## 검사

`MYSQL_SRC` 는 MySQL 소스 위치다. 기본값은 형제 디렉터리 `../mysql-server`.

    bash tools/check.sh                      # verify + 행렬 대조 + 상수 주장 대조
    node tools/lines.js  mysql/locks         # 심볼 → 줄 번호 (linemap.js 생성)
    node tools/extract.js mysql/locks        # 줄 번호 → 소스 발췌 (code.js 생성)

레이아웃 스윕은 playwright 가 필요하다. 설치하지 않았다면 경로를 준다.

    PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
      node tools/sweep.js --base=http://localhost:5180 --widths=1366

검사가 정말 발동하는지 확인하려면 일부러 망가뜨린다.

    node tools/sweep.js --break=overflow --widths=1366 --decks=mysql/locks

`tools/sweep-report.md` 에 그 발동 증거와, 만들면서 밟은 함정 18개가 적혀 있다.

## 저장소에 없는 것

`data/*/*/booktext.js` 는 *Database Internals* 의 장 전문이다. 검증 도구가
"덱의 인용이 실제 책에 있는지" 대조하는 데만 쓰고 앱과 배포물은 쓰지 않는다.
공개 저장소에 두면 저작물 재배포가 되므로 제외했다. 만들려면 PDF 를 준비해
`data/<덱>/booksrc.js` 에 위치를 적고 `node tools/book.js <덱>` 을 돌린다.

## 출처

- 소스 발췌 : MySQL 8.4.8 Community (GPLv2)
- 인용 : *Database Internals* — Alex Petrov (O'Reilly)
