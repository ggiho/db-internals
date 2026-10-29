/* 첫 화면 — 빈 주소로 들어오면 덱을 고른다(2026-10-29 사용자 결정).
   예전에는 book/ch3 01(바이트 순서)이 열렸다 — 프로젝트가 그 덱 하나로 시작했고(2026-09-04) 기본값이 그대로 남았다.
   덱이 12 개로 늘어난 지금, 그 장면은 입구로는 너무 지엽적이었다.
   장면 · 소스 데이터는 싣지 않는다 — 덱마다 deck.js(제목 · 한 줄 설명, 합쳐 5 KB)와 has.js 의 장면 목록만 쓴다. */
import { useCallback, useState } from 'react';
import { STORY } from './has.js';
import { DECK as innodb } from '../../data/mysql/innodb/deck.js';
import { DECK as mylocks } from '../../data/mysql/locks/deck.js';
import { DECK as mvcc } from '../../data/postgres/mvcc/deck.js';
import { DECK as heap } from '../../data/postgres/heap/deck.js';
import { DECK as buffer } from '../../data/postgres/buffer/deck.js';
import { DECK as btree } from '../../data/postgres/btree/deck.js';
import { DECK as pglocks } from '../../data/postgres/locks/deck.js';
import { DECK as wal } from '../../data/postgres/wal/deck.js';
import { DECK as wt } from '../../data/mongodb/wiredtiger/deck.js';
import { DECK as aurora } from '../../data/aurora/mysql/deck.js';
import { DECK as ch2 } from '../../data/book/ch2/deck.js';
import { DECK as ch3 } from '../../data/book/ch3/deck.js';
import './story.css';

/* 엔진별 묶음 — 이름은 첫 화면에서 읽히는 짧은 것(덱 제목 'MySQL Actor Stage' 같은 것은 Story 머리말용이다) */
const ENGINES = [
  { nm: 'MySQL', v: '8.4.8 · InnoDB', decks: [['mysql/innodb', 'InnoDB', innodb], ['mysql/locks', 'Locks', mylocks]] },
  { nm: 'PostgreSQL', v: '18.6', decks: [['postgres/mvcc', 'MVCC · VACUUM', mvcc], ['postgres/heap', 'Heap Pages', heap],
    ['postgres/buffer', 'Shared Buffers', buffer], ['postgres/btree', 'B-tree', btree], ['postgres/locks', 'Locks', pglocks],
    ['postgres/wal', 'WAL · 복구', wal]] },
  { nm: 'MongoDB', v: '8.0.32 · WiredTiger 11.3', decks: [['mongodb/wiredtiger', 'WiredTiger', wt]] },
  { nm: 'Aurora MySQL', v: '논문 · AWS 문서', decks: [['aurora/mysql', 'Storage · Quorum', aurora]] },
  { nm: 'Database Internals', v: '책 · Alex Petrov', decks: [['book/ch2', '2장 B-Tree 기초', ch2], ['book/ch3', '3장 파일 형식', ch3]] },
];
/* 숨은 짝 장면(05v · 02v · 04bv …)은 세지 않는다 — 메뉴에도 짝의 A 하나로 보인다 */
const scenesOf = (id) => STORY[id].nums.filter((n) => !/v$/.test(n)).length;

const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

export default function Hub() {
  const [dark, setDark] = useState(isDark);
  const toggleTheme = useCallback(() => {
    const mode = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('theme', mode); } catch { /* 저장 못 해도 이번 화면은 바뀐다 */ }
    setDark(mode === 'dark');
  }, []);
  const total = ENGINES.reduce((a, e) => a + e.decks.reduce((b, [id]) => b + scenesOf(id), 0), 0);

  return (
    <div className="st hub">
      <header className="hub-top">
        <span className="st-brand">db-internals</span>
        <span className="hub-tools">
          <a className="st-btn" href="?lab">Lab</a>
          <button type="button" className="st-btn" onClick={toggleTheme} aria-label="테마 바꾸기">{dark ? '밝게' : '어둡게'}</button>
        </span>
      </header>

      <main>
        <section className="hub-hero">
          <h1>데이터베이스 엔진이 데이터를 어떻게 쓰고, 읽고, 지키는가</h1>
          <p>
            InnoDB · PostgreSQL · WiredTiger 의 안쪽을 장면으로 따라간다. 아래로 넘길 때마다 한 스텝이고, 화면의 값은
            그 소스 버전을 빌드한 서버에서 쟀다. 근거는 소스의 줄이다 — Aurora 는 논문과 AWS 문서, 책 덱은 Database
            Internals 의 문장이다.
          </p>
          {/* 장면 안의 잰 값 그대로(mysql/innodb 01 · postgres/wal 05 · postgres/btree 08) — 지어낸 예가 아니다 */}
          <p className="hub-meas">
            <span>UPDATE 한 번의 redo <b>+813 B</b></span>
            <span>HOT_UPDATE 레코드 <b>71 B</b> · CRC <b>0x2AC44C8D</b></span>
            <span>bottom-up 삭제로 12 회차 동안 <b>2 page</b></span>
          </p>
        </section>

        {ENGINES.map((e) => (
          <section className="hub-eng" key={e.nm} aria-labelledby={'hub-' + e.nm}>
            <h2 id={'hub-' + e.nm}>{e.nm}<small>{e.v}</small></h2>
            <ul className="hub-decks">
              {e.decks.map(([id, nm, d]) => (
                <li key={id}>
                  <a href={'#' + id + '/' + STORY[id].first + '/1'}>
                    <b>{nm}</b>
                    <i>{scenesOf(id)} 장면</i>
                    <span>{d.blurb}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <footer className="hub-foot">
        <p>{ENGINES.reduce((a, e) => a + e.decks.length, 0)} 덱 · {total} 장면</p>
        <p>
          소스 발췌 MySQL 8.4.8 Community (GPLv2) · PostgreSQL 18.6 (PostgreSQL License) · WiredTiger 11.3 (GPLv2/v3) ·
          인용 AWS Aurora 문서 · Verbitski et al., SIGMOD 2017 · Database Internals — Alex Petrov (O’Reilly)
        </p>
      </footer>
    </div>
  );
}
