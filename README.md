# db-internals

데이터베이스 엔진의 내부 동작을 **스텝 단위로 넘겨 보는** 시각화.
한 화면에 한 순간만 담고, 배우(버퍼풀·페이지·락·redo…)가 스텝마다 상태를 바꾼다.

**https://db-internals.pages.dev**

지금은 MySQL(InnoDB·락), PostgreSQL(MVCC·힙·락), Aurora, 그리고
*Database Internals* 2·3장 대조를 담고 있다. 주소와 디렉터리가 엔진 계층을 가지므로
엔진을 늘려도 도구와 검사가 그대로 붙는다.

    #mysql/innodb/01/1        #mysql/locks/04/3        #book/ch3/04a/5
    #<엔진>/<덱>/<장면>/<스텝>  ← 주소가 곧 상태다

## 왜 이런 구조인가

**주장에 근거를 붙인다.** 각 스텝은 소스 파일·심볼을 가리키고, 화면 아래에 그 발췌가
붙는다. 줄 번호는 손으로 쓰지 않는다 — `tools/lines.js` 가 매번 저장소에서 찾는다.
그래야 MySQL 버전이 올라가도 썩지 않는다.

**검사를 사람 판단에 맡기지 않는다.** 락 호환/강도 행렬 150칸은 소스의 배열과
칸 단위로 대조하고(`tools/mxcheck.js`), `NAME = 값` 형태의 주장은 저장소에서
grep 해 확인한다(`tools/claimcheck.js`). 레이아웃은 14폭 × 5,800방문을 훑어
넘침·글자잘림·라벨겹침을 잡는다(`tools/sweep.js`).

**손잡이를 돌리면 흐름이 바뀐다.** 무대 옆 손잡이 패널의 값은 설명이 아니라 입력이다.
값을 누르면 그 장면이 그 설정의 동작으로 다시 재생된다 — 스텝의 문장·근거·배우 상태가
함께 갈린다. 주소에 `/v<값>` 이 붙어 그 상태도 링크가 된다.

    #mysql/innodb/07/3/vREAD-COMMITTED    갭 락이 레코드 락이 되는 같은 장면

지금 배선된 것 :

| 장면 | 손잡이 | 값 |
|---|---|---|
| innodb 01 커밋 | `innodb_flush_log_at_trx_commit` | 2 · 0 |
| innodb 03 크래시 복구 | `innodb_doublewrite` | DETECT_ONLY · OFF |
| innodb 07 갭 락 | `transaction_isolation` | READ-COMMITTED |
| innodb 08 교착 | `innodb_deadlock_detect` | OFF |

값마다 `verify.js` 가 스텝을 따로 재생해 검사한다 — 없는 배우를 보거나, 바뀌지 않는
값을 set 하거나, 기본 스텝의 ops 를 잘못 물려받은 것을 잡는다. 실제로 저작할 때마다
잡혔다. 나머지 손잡이는 아직 값을 읽는 설명이다.

## 실행

    npm i
    npm run dev          # http://localhost:5199
    npm run build

## 검사

소스 트리는 도구가 스스로 찾는다 — 형제 디렉터리, 그다음 `~/src/github.com/…` 순서로
표식 파일을 확인한다. `MYSQL_SRC` · `PG_SRC` 로 덮어쓸 수 있다. 대조하는 버전은
`tools/srcroot.js` 에 적혀 있다.

    MySQL       8.4.8
    PostgreSQL  17.11      git clone --depth 1 --filter=blob:none \
                             --branch REL_17_STABLE https://github.com/postgres/postgres.git

소스가 없으면 `verify.js` 는 "파일을 못 읽었다" 만 낸다 — 그것은 통과가 아니라 미검증이다.
실제로 PostgreSQL 트리가 사라져 있는 동안 인용 오류 한 건이 가려져 있었다.

    bash tools/check.sh                      # verify + 행렬 대조 + 상수 주장 대조
    node tools/lines.js  mysql/locks         # 심볼 → 줄 번호 (linemap.js 생성)
    node tools/extract.js mysql/locks        # 줄 번호 → 소스 발췌 (code.js 생성)

레이아웃 스윕은 playwright 가 필요하다. 이 프로젝트에 설치하지 않고(브라우저까지
수백 MB) 머신에 있는 것을 찾아 쓴다 — 브라우저가 실제로 내려와 있는 설치를 고른다.
`PLAYWRIGHT_PATH` 로 지정할 수도 있다. 먼저 개발 서버를 5180 에 띄운다.

    npx vite --port 5180 --strictPort &
    node tools/sweep.js --widths=1366
    node tools/sweep.js --widths=1024,1080,1100,1366   # 나눠 돌릴 수 있다

검사가 정말 발동하는지 확인하려면 일부러 망가뜨린다.

    node tools/sweep.js --break=overflow --widths=1366 --decks=mysql/locks

`tools/sweep-report.md` 에 그 발동 증거와, 만들면서 밟은 함정 23개가 적혀 있다.

## 저장소에 없는 것

`data/*/*/booktext.js` 는 *Database Internals* 의 장 전문이다. 검증 도구가
"덱의 인용이 실제 책에 있는지" 대조하는 데만 쓰고 앱과 배포물은 쓰지 않는다.
공개 저장소에 두면 저작물 재배포가 되므로 제외했다. 만들려면 PDF 를 준비해
`data/<덱>/booksrc.js` 에 위치를 적고 `node tools/book.js <덱>` 을 돌린다.

## 출처

- 소스 발췌 : MySQL 8.4.8 Community (GPLv2) · PostgreSQL 17.11 (PostgreSQL License)
- 인용 : *Database Internals* — Alex Petrov (O'Reilly)
