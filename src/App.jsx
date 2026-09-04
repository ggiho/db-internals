import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import Stage from './Stage.jsx';
import Rail from './Rail.jsx';
import Playback, { REDUCED } from './Playback.jsx';
import Source, { SourceModal } from './Source.jsx';
import { bake, onStage } from './bake.js';

/* 덱 이름은 <묶음>/<덱> 두 단계다 — 엔진을 늘릴 것이므로 처음부터 계층을 둔다.
   평평하게 두면 PostgreSQL 의 mvcc·locks 와 InnoDB 의 것이 이름부터 부딪히고,
   나중에 바꾸면 그전에 공유된 링크가 전부 깨진다. 그래서 지금 정한다.
   묶음 라벨(g)은 상단 메뉴에서 덱들을 묶는 데 쓴다. */
const DECKS = {
  'mysql/innodb': { g: 'MYSQL', lb: 'innodb', load: () => import('../data/mysql/innodb/index.js') },
  'mysql/locks':  { g: 'MYSQL', lb: 'locks',  load: () => import('../data/mysql/locks/index.js') },
  'book/ch2':     { g: 'BOOK',  lb: 'ch2',    load: () => import('../data/book/ch2/index.js') },
  'book/ch3':     { g: 'BOOK',  lb: 'ch3',    load: () => import('../data/book/ch3/index.js') },
};
const DEFAULT_DECK = 'book/ch3';

/* 상단 메뉴용 : 묶음 순서를 지키면서 묶음별로 덱을 모은다 */
const GROUPS = Object.entries(DECKS).reduce((acc, [id, d]) => {
  const g = acc.find((x) => x.g === d.g) || (acc.push({ g: d.g, decks: [] }), acc[acc.length - 1]);
  g.decks.push({ id, lb: d.lb });
  return acc;
}, []);

/* 주소가 곧 상태다 : #<묶음>/<덱>/<장면>/<스텝>. 스텝은 1 부터 센다 (사람이 읽는 번호).
   덱 이름에 '/' 가 들어가므로 앞에서부터 자를 수 없다 — 등록된 이름 중
   이 주소의 접두어인 가장 긴 것을 덱으로 본다. 그래야 장면 번호에 무엇이 와도 안전하다. */
function parse(h) {
  const raw = String(h || '').replace(/^\/+/, '');
  let deck = '';
  for (const id of Object.keys(DECKS)) {
    if ((raw === id || raw.startsWith(id + '/')) && id.length > deck.length) deck = id;
  }
  if (!deck) return { deck: '', num: '', step: 1 };
  const [n, s] = raw.slice(deck.length).replace(/^\//, '').split('/');
  return { deck, num: n || '', step: Math.max(1, parseInt(s, 10) || 1) };
}

export default function App() {
  const [route, setRoute] = useState(() => parse(location.hash.slice(1)));
  /* 처음 열 때 장면이 지정돼 있었나 — 지정돼 있으면 자동 재생하지 않는다.
     링크를 받아 특정 스텝을 보러 온 사람에게서 그 스텝을 빼앗지 않기 위해서다. */
  const deep = useRef(!!parse(location.hash.slice(1)).num);
  const booted = useRef(false);

  const [deck, setDeck] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [split, setSplit] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);
  const [srcVisible, setSrcVisible] = useState(false);

  const deckName = DECKS[route.deck] ? route.deck : DEFAULT_DECK;

  useEffect(() => {
    const f = () => setRoute(parse(location.hash.slice(1)));
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    let live = true;
    DECKS[deckName].load().then((m) => live && setDeck(m));
    return () => { live = false; };
  }, [deckName]);

  /* 훅은 조건보다 위에 전부 놓는다 — early return 뒤에 useMemo 를 두어
     React #310(훅 개수가 렌더마다 달라짐)로 화면이 통째로 안 떴다. */
  const visible = useMemo(() => (deck ? deck.SCENES.filter((s) => !s.hidden) : []), [deck]);
  /* 하위 장면(04a·04b·06a·07a)을 부모 탭에 붙인다 — 평평하게 늘어놓으면 book-ch3 가
     15개가 되어 1366px 에서 72px 잘렸다. 부모는 이름을, 자식은 글자 하나만 갖는다.
     'v' 로 끝나는 비교용 장면은 애초에 hidden 이라 여기 오지 않는다. */
  const tabs = useMemo(() => {
    const out = [];
    for (const sc of visible) {
      const m = /^(\d+)([a-z])$/.exec(sc.num);
      const parent = m ? out.find((g) => g.sc.num === m[1]) : null;
      if (parent) parent.kids.push({ sc, k: m[2] });
      else out.push({ sc, kids: [] });
    }
    return out;
  }, [visible]);
  const scene = deck ? (deck.SCENES.find((s) => s.num === route.num) || visible[0]) : null;
  const frames = useMemo(() => (scene ? bake(scene) : []), [scene]);
  const i = frames.length
    ? Math.max(0, Math.min(frames.length - 1, route.step - 1)) : 0;

  /* 짝 장면 : 같은 스텝 수여야 나란히 세울 수 있다. 수가 다르면 한쪽이 없는 스텝을
     그리게 되므로 버튼 자체를 내주지 않는다 (들어가기 전에 확인한다). */
  const alt = deck && scene && scene.pair ? deck.SCENES.find((x) => x.num === scene.pair) : null;
  const pairOK = !!(alt && alt.steps.length === scene.steps.length);
  const framesB = useMemo(() => (pairOK ? bake(alt) : []), [pairOK, alt]);

  const nav = useCallback((num, step, push) => {
    const h = '#' + deckName + '/' + num + '/' + (step + 1);
    /* 스텝 이동은 replaceState 다 — 한 장면을 다 보면 히스토리에 항목 열 개가 쌓여서
       뒤로가기가 "이전 장면" 이 아니라 "이전 스텝" 이 된다. 장면 이동만 쌓는다. */
    if (push) location.hash = h;
    else history.replaceState(null, '', h);
    setRoute(parse(h.slice(1)));
  }, [deckName]);

  const seek = useCallback((k) => { if (scene) nav(scene.num, k); }, [scene, nav]);
  const goScene = useCallback((num) => { nav(num, 0, true); }, [nav]);
  const goSceneIndex = useCallback((k) => {
    const s = visible[k];
    if (s) nav(s.num, 0, true);
  }, [visible, nav]);

  /* 주소를 정규화한다 — '#innodb' 처럼 장면 없이 들어오거나 스텝이 범위를 넘으면
     실제로 보고 있는 것과 주소가 달라진다. 링크를 복사했을 때 같은 화면이 떠야 한다. */
  const canon = scene ? deckName + '/' + scene.num + '/' + (i + 1) : null;
  useEffect(() => {
    if (!canon) return;
    if (location.hash.slice(1) !== canon) {
      history.replaceState(null, '', '#' + canon);
      setRoute(parse(canon));
    }
  }, [canon]);

  useEffect(() => { setPlaying(false); setSrcOpen(false); }, [scene && scene.num, deckName]);
  useEffect(() => { if (!pairOK && split) setSplit(false); }, [pairOK, split]);

  /* 처음 열면 저절로 재생된다 — 단, 링크로 특정 스텝에 들어온 경우와
     동작 줄이기를 켠 경우는 건드리지 않는다. */
  useEffect(() => {
    if (booted.current || !scene) return;
    booted.current = true;
    if (REDUCED || deep.current) return;
    const t = setTimeout(() => setPlaying(true), 900);
    return () => clearTimeout(t);
  }, [scene]);

  const toggleSplit = useCallback(() => {
    if (!pairOK) return;
    setPlaying(false);
    setSplit((s) => !s);
  }, [pairOK]);
  const closeSrc = useCallback(() => setSrcOpen(false), []);
  const openSrc = useCallback(() => setSrcOpen(true), []);

  if (!deck || !scene || !frames.length) return <div className="boot">불러오는 중…</div>;

  const frame = frames[i];
  const step = scene.steps[i];
  const stage = onStage(scene, frames, i, 4);
  const srcKey = step.ref && step.sym ? step.ref + '#' + step.sym : null;
  const hasSrc = !!(srcKey && deck.CODE[srcKey]);
  const line = srcKey ? deck.LINES[srcKey] : null;
  const on = split && pairOK;

  /* 비교 모드에서는 두 장면이 같은 스텝 번호를 각자의 설정으로 보여준다.
     Stage 의 계약(deck·scene·frame·stage·step)은 그대로 두 번 쓴다. */
  const cols = on
    ? [{ sc: scene, fr: frames, lb: scene.vsLabel || 'A' },
       { sc: alt, fr: framesB, lb: alt.vsLabel || 'B' }]
    : [{ sc: scene, fr: frames, lb: null }];

  return (
    <div className="app" id="app">
      <header className="top">
        <b>{deck.DECK.brand}</b><span>{deck.DECK.brand2}</span>
        <nav className="decks">
          {GROUPS.map((grp) => (
            <span key={grp.g} className="grp">
              <b>{grp.g}</b>
              {grp.decks.map((d) => (
                <a key={d.id} className={d.id === deckName ? 'on' : ''} href={'#' + d.id}>{d.lb}</a>
              ))}
            </span>
          ))}
        </nav>
      </header>

      <nav className="tabs">
        {tabs.map((g) => {
          const here = g.sc.num === scene.num;
          const inKid = g.kids.some((k) => k.sc.num === scene.num);
          return (
            <span key={g.sc.num} className={'tab' + (here || inKid ? ' in' : '')}>
              <a href={'#' + deckName + '/' + g.sc.num + '/1'}
                 className={here ? 'on' : ''}>{g.sc.num} {g.sc.tab}</a>
              {g.kids.map((k) => (
                <a key={k.sc.num} className={'kid' + (k.sc.num === scene.num ? ' on' : '')}
                   href={'#' + deckName + '/' + k.sc.num + '/1'}
                   title={k.sc.num + ' ' + k.sc.tab}>{k.k}</a>
              ))}
            </span>
          );
        })}
      </nav>

      <AnimatePresence mode="wait">
        <motion.section key={scene.num} className="head"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.24 }}>
          <h1>{scene.title}</h1><p>{scene.sub}</p>
        </motion.section>
      </AnimatePresence>

      <Playback
        steps={scene.steps} i={i} onSeek={seek}
        playing={playing} setPlaying={setPlaying}
        sceneCount={visible.length} onSceneIndex={goSceneIndex}
        hasPair={pairOK} split={on} onToggleSplit={toggleSplit} vsLabel={scene.vsLabel}
        hasSrc={hasSrc} srcOpen={srcOpen} onOpenSrc={openSrc} onCloseSrc={closeSrc} />

      {/* 767px 아래에서는 무대를 만들지 않는다 — style.css 가 무대·탭·재생막대를 감추고
          이 안내만 남긴다. CSS 는 A 가 썼고 마크업은 여기(App)에 있어야 해서 함께 둔다. */}
      <p className="narrow-note"><b>넓은 화면에서 보세요</b>
        이 페이지는 배우들을 가로로 나란히 놓고 그 줄을 계층으로 읽습니다.
        768px 아래에서는 카드가 여러 줄로 흩어져 그 문법이 사라집니다 —
        기기를 가로로 돌리거나 태블릿·데스크톱에서 열어 주세요.</p>

      <div className={'wrap' + (on ? ' solo' : '')}>
        <div className="mid">
          <div className={'stage-wrap' + (on ? ' split' : '')}>
            {cols.map((c) => (
              /* 열마다 layoutId 이름공간을 따로 준다. Stage 의 카드는 layoutId='card-<배우>' 를
                 쓰는데 그 이름은 전역이라, 비교 모드에서 두 열이 같은 배우를 그리면 둘이
                 *같은 요소* 로 취급된다 — 실제로 A 열의 카드가 B 열 좌표(x=820)에 그려졌다.
                 LayoutGroup 의 id 는 하위 layoutId 앞에 붙고(inherit 기본값), Stage 안쪽의
                 id 없는 LayoutGroup 은 이 id 를 물려받으므로 '01-card-trx' / '01v-card-trx' 로 갈린다. */
              <LayoutGroup id={c.sc.num} key={c.sc.num}>
                <div className="scol">
                  {c.lb && (
                    <div className="scol-hd">
                      <div className="v">{c.lb}</div>
                      <div className="n">{c.sc.steps[i].note}</div>
                    </div>
                  )}
                  <Stage deck={deck} scene={c.sc} frame={c.fr[i]}
                    stage={onStage(c.sc, c.fr, i, 4)} step={c.sc.steps[i]} />
                </div>
              </LayoutGroup>
            ))}
          </div>
          <Source deck={deck} step={step} off={on} onVisible={setSrcVisible} />
        </div>
        {/* 비교 모드에서는 두 열이 이미 빽빽하다 — 레일을 접는다 */}
        {!on && (
          <Rail deck={deck} scene={scene} i={i}
            onStep={(k) => { setPlaying(false); seek(k); }}
            onScene={(num) => { setPlaying(false); goScene(num); }} />
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.footer key={scene.num + '.' + i} className="cap"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          <div className="cap-l">
            <h2>{step.note}</h2>
            {step.why && <p>{step.why}</p>}
            {step.ref && (
              hasSrc
                ? <button type="button" className={'o-ref has' + (srcVisible ? ' dim' : '')}
                    onClick={() => { setPlaying(false); openSrc(); }}>
                    {step.ref}{line ? ':' + line : ''}{step.sym ? '   ' + step.sym : ''}
                  </button>
                : <code className="o-ref">{step.ref}{line ? ':' + line : ''}{step.sym ? '   ' + step.sym : ''}</code>
            )}
          </div>
          {step.key && <div className="cap-r"><span>이 순간의 요점</span>
            <p dangerouslySetInnerHTML={{ __html: step.key }} /></div>}
        </motion.footer>
      </AnimatePresence>

      <div className="foot">
        <span><b>SPACE</b> 재생 · 일시정지</span>
        <span><b>← →</b> 한 스텝</span>
        <span><b>1–9</b> 장면</span>
        <span><b>HOME</b> 처음으로</span>
        <span><b>S</b> 소스 보기</span>
        {pairOK && <span><b>V</b> 나란히 보기</span>}
        {/* 공개 배포용 출처 — 소스 발췌는 GPLv2, 책 인용은 짧은 구절이다. */}
        <span className="cred">
          소스 발췌 <b>MySQL 8.4.8 Community</b> (GPLv2)
          {deckName.startsWith('book/') && <> · 인용 <b>Database Internals</b> — Alex Petrov (O&apos;Reilly)</>}
        </span>
      </div>

      <SourceModal deck={deck} step={step} open={srcOpen} onClose={closeSrc} />
    </div>
  );
}
