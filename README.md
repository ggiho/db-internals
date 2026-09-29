# db-internals

데이터베이스 엔진의 내부 동작을 **스텝 단위로 넘겨 보는** 시각화.
한 화면에 한 순간만 담고, 배우(버퍼풀·페이지·락·redo…)가 스텝마다 상태를 바꾼다.

**https://db-internals.pages.dev**

지금은 MySQL(InnoDB·락), PostgreSQL(MVCC·힙·락·WAL), Aurora, MongoDB(WiredTiger), 그리고
*Database Internals* 2·3장 대조를 담고 있다. 주소와 디렉터리가 엔진 계층을 가지므로
엔진을 늘려도 도구와 검사가 그대로 붙는다.

용어는 소스와 문서가 쓰는 말을 쓴다 — `next-key lock`·`doublewrite`·`fan-out` 처럼
찾아볼 수 있어야 하는 것은 영어로 두고, 조사는 띄어 붙인다(`buffer pool 에`).
한국어에 자리 잡은 말(페이지·튜플·오프셋·슬롯·스냅샷)은 그대로 쓴다.

    #mysql/innodb/01/1        #postgres/wal/01/3       #book/ch3/04a/5
    #<엔진>/<덱>/<장면>/<스텝>  ← 주소가 곧 상태다

## 왜 이런 구조인가

**주장에 근거를 붙인다.** 각 스텝은 소스 파일·심볼을 가리키고, 캡션의 근거 줄(또는 `S` 키)을
누르면 그 발췌가 열린다. 줄 번호는 손으로 쓰지 않는다 — `tools/lines.js` 가 매번 저장소에서
찾는다. 그래야 MySQL 버전이 올라가도 썩지 않는다.

무대 아래에는 **이 스텝이 바꾼 것**이 붙는다 — 배우별로 무엇이 더해지고(+) 빠지고(−)
어떻게 바뀌었는지(~)와 앞뒤 스텝. 저작하지 않고 무대와 같은 프레임에서 직전 상태와
비교해 만든다. 그 아래에 자리가 남으면 근거가 나머지를 채운다 — 소스 발췌(인용한 줄에서
시작), ref 가 없는 스텝이면 인용한 원문, 그것도 없는 정리 스텝이면 장면의 스텝들이 가리킨
근거 목록(누르면 그 스텝으로 간다). 자리가 모자라면(1366×768 처럼) 근거 칸은 빠지고
캡션의 근거 줄이나 `S` 로 연다.
발췌를 창으로만 열던 동안에는 넓은 화면에서 무대 아래가 비었다 — 빈 높이 중앙값이
1512×982 에서 160px, 1728×1117 에서 295px 였다.

**검사를 사람 판단에 맡기지 않는다.** 락 호환/강도 행렬 150칸은 소스의 배열과
칸 단위로 대조하고(`tools/mxcheck.js`), `NAME = 값` 형태의 주장은 저장소에서
grep 해 확인한다(`tools/claimcheck.js`). 레이아웃은 15폭 × 7,400방문을 훑어
넘침·글자잘림·라벨겹침·레일 겹침을 잡는다(`tools/sweep.js`).

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
| innodb 09 온라인 DDL | `lock_wait_timeout` | 5 · 0 |
| locks 07 INSERT | `innodb_autoinc_lock_mode` | 1 · 0 |
| locks 08 외래키 | `foreign_key_checks` | OFF |
| ch3 07a 레코드 헤더 | `innodb_default_row_format` | redundant |
| ch3 11 체크섬 | `innodb_checksum_algorithm` | none · strict_crc32 |

값마다 `verify.js` 가 스텝을 따로 재생해 검사한다 — 없는 배우를 보거나, 바뀌지 않는
값을 set 하거나, 기본 스텝의 `ops`·`look`·`fact` 를 잘못 물려받은 것을 잡는다.
저작할 때마다 잡혔다.

**나머지 손잡이는 설명으로 둔다.** 73개 패널 중 흐름이 갈리는 것만 배선했다.
`innodb_io_capacity`·`buffer_pool_size`·`purge_threads` 같은 것은 비율을 바꾸고 사건의
순서를 바꾸지 않는다. 후보로 꼽았다가 물린 것도 있다 — `select_mode` 는 서버 설정이
아니라 문장 문법이고 기본 줄기가 이미 세 값을 걸어 보여 준다, `autovacuum_freeze_max_age`
는 랩어라운드 기제의 분기가 아니라 촉발 시점이다, `innodb_page_size` 는 페이지 수와
트리 높이를 바꾸지만 분할이 끝에서 일어나는지 가운데서 일어나는지는 그대로다.

**문제도 같은 데이터에서 만든다.** `#play` 는 덱에서 뽑은 문항을 푼다. 관계·지표·상수·
순서·손잡이 문항은 오답을 쓰지 않는다 — 다른 장면의 같은 종류 항목을 가져온다. 장면의
요점(beat 스텝)을 묻는 핵심 문항만 오답을 사람이 쓴다. 다른 장면의 문장은 주제가 달라
한눈에 걸러지기 때문이다. 핵심 문항은 `data/<덱>/quiz.js` 의 `CORE` 에 있고, 문항으로
만들지 않은 beat 는 `SKIP` 에 이유와 함께 적는다. `tools/quizcheck.js` 가 모든 beat 가
둘 중 하나에 있는지, 정답만 유난히 길거나 짧지 않은지 본다 — 처음 쓴 문항은 정답이
가장 긴 선택지인 비율이 42% 였다.

## 실행

    npm i
    npm run dev          # http://localhost:5199
    npm run build

배포는 푸시로 일어나지 않는다 — Pages 프로젝트에 Git 연동이 없다. 빌드한 뒤 올린다.

    npx wrangler pages deploy dist --project-name=db-internals --branch=main

## 검사

소스 트리는 도구가 스스로 찾는다 — 형제 디렉터리, 그다음 `~/src/github.com/…` 순서로
표식 파일을 확인한다. `MYSQL_SRC` · `PG_SRC` · `MONGO_SRC` 로 덮어쓸 수 있다. 대조하는
버전은 `tools/srcroot.js` 에 적혀 있다.

    MySQL       8.4.8
    PostgreSQL  18.6       git clone --depth 1 --filter=blob:none \
                             --branch REL_18_STABLE https://github.com/postgres/postgres.git
    MongoDB     8.0.32     git clone --depth 1 --filter=blob:none --sparse \
                             --branch r8.0.32 https://github.com/mongodb/mongo.git
                           git sparse-checkout set src/third_party/wiredtiger/src \
                             src/mongo/db/storage src/mongo/db/repl

MongoDB 덱이 화면에 띄우는 발췌는 WiredTiger(GPLv2/v3) 코드뿐이다. 그 위의 MongoDB
서버 코드는 SSPL 이라 성격이 달라서 `fact` 로 대조만 하고 띄우지 않는다 — verify 가
`src/third_party/wiredtiger/` 밖을 가리키는 ref 를 오류로 막는다.

덱 목록은 `src/decks.js` 한 곳에 있고 도구는 모두 거기서 읽는다. 도구마다 목록을 따로
적었을 때 레이아웃 스윕의 기본 목록에서만 `postgres/wal` 이 빠져 있었다.

소스가 없으면 `verify.js` 는 "파일을 못 읽었다" 만 낸다 — 그것은 통과가 아니라 미검증이다.
실제로 PostgreSQL 트리가 사라져 있는 동안 인용 오류 한 건이 가려져 있었다.

    bash tools/check.sh                      # 버전 일치 + verify + 행렬 대조 + 상수 주장 대조
    node tools/srcver.js                     # 덱이 띄우는 버전 = 대조하는 트리의 버전
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

`tools/sweep-report.md` 에 그 발동 증거와, 만들면서 밟은 함정 30개가 적혀 있다.

## 저장소에 없는 것

`data/*/*/booktext.js` 는 *Database Internals* 의 장 전문이다. 검증 도구가
"덱의 인용이 실제 책에 있는지" 대조하는 데만 쓰고 앱과 배포물은 쓰지 않는다.
공개 저장소에 두면 저작물 재배포가 되므로 제외했다. 만들려면 PDF 를 준비해
`data/<덱>/booksrc.js` 에 위치를 적고 `node tools/book.js <묶음>/<덱>` 을 돌린다.

`data/aurora/mysql/papertext.js` 는 같은 이유로 뺀 논문 원문이다(Verbitski et al.,
SIGMOD 2017). quorum 수와 세그먼트 크기는 AWS 문서에 없어서 논문을 인용한다. PDF 는
Amazon Science 의 논문 페이지가 거는 것을 쓰고, 판이 바뀌면 문장이 달라지므로
`papersrc.js` 에 sha256 을 적어 고정한다. `node tools/paper.js aurora/mysql` 이 만든다.
verify 는 논문에만 있는 구절을 인용한 스텝이 글에서 논문을 밝히는지도 본다 — 문서
인용과 논문 인용을 같은 말로 쓰지 않기 위해서다.

## 출처

- 소스 발췌 : MySQL 8.4.8 Community (GPLv2) · PostgreSQL 18.6 (PostgreSQL License) ·
  WiredTiger 11.3 (GPLv2/v3, MongoDB 8.0.32 에 들어 있는 판)
- 대조만 하는 소스 : MongoDB Server 8.0.32 (SSPL)
- 인용 : *Database Internals* — Alex Petrov (O'Reilly)
