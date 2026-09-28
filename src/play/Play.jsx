import { useCallback, useEffect, useMemo, useState } from 'react';
import { DECKS } from '../decks.js';
import { buildQuiz } from './quiz.js';
import { load, save, record, pickRound, mastery } from './progress.js';
import './play.css';

/* 게임 화면. 무대와 같은 데이터를 쓰지만 무대를 띄우지 않는다 — 문항은 글과 선택지로
   완결되고, 맞히든 틀리든 "장면에서 보기" 로 그 순간의 무대에 간다. 무대는 문제가
   아니라 보상이다. 그래서 휴대폰에서도 한 손으로 돈다.

   scenes.js 만 읽는다. index.js 를 부르면 소스 발췌(code.js)까지 딸려 와 덱 9개에
   수백 KB 가 된다 — 문항에는 발췌가 필요 없다. */
const SCENE_FILES = import.meta.glob('../../data/*/*/scenes.js');
const CORE_FILES = import.meta.glob('../../data/*/*/quiz.js');
const KIND = { link: '관계', watch: '지표', fact: '상수', order: '순서', vary: '손잡이', core: '핵심' };
const MONO = new Set(['watch', 'fact', 'vary']);   /* 선택지가 식별자·값이면 고정폭 */
const GROUPS = ['ALL', ...new Set(Object.values(DECKS).map((d) => d.g))];
const N = 10;

/* 한 판은 sessionStorage 에 둔다 — "장면에서 보기" 로 나갔다 뒤로 와도 이어진다.
   복습 상태(상자)는 localStorage 다. 둘 다 막혀 있으면 이번 판만 메모리에서 돈다. */
const SS = 'dbi.play.round';
const ssGet = () => { try { return JSON.parse(sessionStorage.getItem(SS) || 'null'); } catch { return null; } };
const ssSet = (v) => { try { sessionStorage.setItem(SS, JSON.stringify(v)); } catch { /* 없어도 돈다 */ } };

export default function Play() {
  const [pool, setPool] = useState(null);
  const [st, setSt] = useState(load);
  const [run, setRun] = useState(ssGet);          /* { grp, ids, i, res:{id:true|false}, pick:{id:…} } */
  const [seq, setSeq] = useState([]);              /* 순서 문항에서 고른 순서 */

  /* 무대에서 고른 테마를 따른다 — 바로 #play 로 들어와도 같은 색이어야 한다 */
  useEffect(() => {
    try {
      const t = localStorage.getItem('theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    } catch { /* 시스템 설정을 따른다 */ }
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all(Object.entries(SCENE_FILES).map(async ([file, loadFn]) => {
      const deck = /data\/(.+)\/scenes\.js$/.exec(file)[1];
      if (!DECKS[deck]) return [];
      const cf = CORE_FILES[file.replace(/scenes\.js$/, 'quiz.js')];
      const [m, c] = await Promise.all([loadFn(), cf ? cf() : {}]);
      return buildQuiz(deck, m.SCENES, c.CORE).map((q) => ({ ...q, g: DECKS[deck].g }));
    })).then((all) => { if (live) setPool(all.flat()); });
    return () => { live = false; };
  }, []);

  const byId = useMemo(() => new Map((pool || []).map((q) => [q.id, q])), [pool]);
  useEffect(() => { if (run) ssSet(run); }, [run]);

  const start = useCallback((grp) => {
    const cand = pool.filter((q) => grp === 'ALL' || q.g === grp);
    setSeq([]);
    setRun({ grp, ids: pickRound(cand, st, N), i: 0, res: {}, pick: {} });
  }, [pool, st]);

  if (!pool) return <main className="pl"><p className="pl-meta">문항을 만드는 중…</p></main>;

  /* 저장된 판의 문항이 사라졌으면(덱이 바뀌었으면) 새 판으로 */
  const valid = run && run.ids.every((id) => byId.has(id));
  if (!valid) return <Lobby pool={pool} st={st} onStart={start} last={run && run.grp} />;

  const done = run.i >= run.ids.length;
  if (done) return <Summary run={run} byId={byId} st={st}
    onNext={() => { const s2 = { ...st, rounds: st.rounds + 1 }; setSt(s2); save(s2); setRun(null); }} />;

  const q = byId.get(run.ids[run.i]);
  const answered = q.id in run.res;

  const answer = (pick) => {
    if (answered) return;
    const ok = q.kind === 'order'
      ? JSON.stringify(pick.map((k) => q.opts[k])) === JSON.stringify(q.answer)
      : pick === q.answer;
    const s2 = record(st, q.id, ok);
    setSt(s2); save(s2);
    setRun({ ...run, res: { ...run.res, [q.id]: ok }, pick: { ...run.pick, [q.id]: pick } });
  };
  const next = () => { setSeq([]); setRun({ ...run, i: run.i + 1 }); };

  return (
    <main className="pl">
      <Top />
      <div className="pl-bar" aria-hidden="true">
        {run.ids.map((id, k) => (
          <i key={id} className={k === run.i ? 'now' : id in run.res ? (run.res[id] ? 'ok' : 'no') : ''} />
        ))}
      </div>
      <p className="pl-meta">
        <span>{KIND[q.kind]}</span><span>{q.deck}</span><span>{run.i + 1} / {run.ids.length}</span>
      </p>
      <h1 className="pl-q">{q.q}</h1>
      {q.stem && <p className="pl-stem">{q.stem}</p>}

      {q.kind === 'order'
        ? <Order q={q} seq={seq} setSeq={setSeq} answered={answered} pick={run.pick[q.id]} onSubmit={answer} />
        : <Choice q={q} answered={answered} pick={run.pick[q.id]} onPick={answer} />}

      {answered && <Feedback q={q} ok={run.res[q.id]} onNext={next} last={run.i === run.ids.length - 1} />}
    </main>
  );
}

function Top() {
  let from = 'book/ch3';
  try { from = sessionStorage.getItem('dbi.play.from') || from; } catch { /* 기본 덱 */ }
  return (
    <header className="pl-top">
      <b>DB-INTERNALS</b><span>PLAY</span>
      <a href={'#' + from}>← 무대로</a>
    </header>
  );
}

function Lobby({ pool, st, onStart, last }) {
  const [grp, setGrp] = useState(last || 'ALL');
  const cand = pool.filter((q) => grp === 'ALL' || q.g === grp);
  const m = mastery(st, cand.map((q) => q.id));
  const kinds = cand.reduce((a, q) => ({ ...a, [q.kind]: (a[q.kind] || 0) + 1 }), {});
  return (
    <main className="pl">
      <Top />
      <h1 className="pl-q">덱에서 만든 문제를 푼다</h1>
      <p className="pl-lead">
        정답은 전부 무대의 데이터에 있다. 틀린 답은 다른 장면에서 가져온 진짜 항목이고,
        핵심 문항만 흔히 하는 오해를 골라 따로 썼다. 틀린 문항은 다음 판에 먼저 나온다.
      </p>
      <div className="pl-grp" role="group" aria-label="엔진">
        {GROUPS.map((g) => (
          <button key={g} type="button" className={g === grp ? 'on' : ''} onClick={() => setGrp(g)}>{g}</button>
        ))}
      </div>
      <dl className="pl-stat">
        <div><dt>문항</dt><dd>{m.total}</dd></div>
        <div><dt>풀어 본 것</dt><dd>{m.seen}</dd></div>
        <div><dt>익힌 것</dt><dd>{m.known}</dd></div>
      </dl>
      <p className="pl-meta">{Object.entries(kinds).map(([k, n]) => `${KIND[k]} ${n}`).join(' · ')}</p>
      <button type="button" className="pl-next" onClick={() => onStart(grp)}>{N}문항 시작</button>
    </main>
  );
}

function Choice({ q, answered, pick, onPick }) {
  useKeys(!answered && ((k) => { const o = q.opts[k - 1]; if (o !== undefined) onPick(o); }));
  return (
    <ol className={'pl-opts' + (MONO.has(q.kind) ? ' mono' : '')}>
      {q.opts.map((o, k) => {
        const cls = !answered ? '' : o === q.answer ? 'ok' : o === pick ? 'no' : 'dim';
        return (
          <li key={o}>
            <button type="button" className={cls} disabled={answered} onClick={() => onPick(o)}>
              <i>{k + 1}</i><span>{o}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* 순서 : 아래에서 누른 순서대로 위에 쌓인다. 쌓인 것을 누르면 되돌린다. */
function Order({ q, seq, setSeq, answered, pick, onSubmit }) {
  const chosen = answered ? pick : seq;
  const left = q.opts.map((o, k) => k).filter((k) => !chosen.includes(k));
  return (
    <>
      <ol className="pl-seq">
        {chosen.map((k, pos) => {
          const cls = !answered ? '' : q.opts[k] === q.answer[pos] ? 'ok' : 'no';
          return (
            <li key={k}>
              <button type="button" className={cls} disabled={answered}
                onClick={() => setSeq(seq.filter((x) => x !== k))}>
                <i>{pos + 1}</i><span>{q.opts[k]}</span>
              </button>
            </li>
          );
        })}
        {!answered && Array.from({ length: q.opts.length - chosen.length }, (_, j) => (
          <li key={'e' + j} className="pl-slot"><i>{chosen.length + j + 1}</i></li>
        ))}
      </ol>
      {!answered && left.length > 0 && (
        <ul className="pl-opts">
          {left.map((k) => (
            <li key={k}><button type="button" onClick={() => setSeq([...seq, k])}><span>{q.opts[k]}</span></button></li>
          ))}
        </ul>
      )}
      {!answered && left.length === 0 && (
        <button type="button" className="pl-next" onClick={() => onSubmit(seq)}>이 순서로 확인</button>
      )}
      {answered && pick.some((k, pos) => q.opts[k] !== q.answer[pos]) && (
        <ol className="pl-right">{q.answer.map((a, pos) => <li key={pos}><i>{pos + 1}</i>{a}</li>)}</ol>
      )}
    </>
  );
}

function Feedback({ q, ok, onNext, last }) {
  useKeys((k) => { if (k === 'Enter') onNext(); });
  return (
    <section className={'pl-fb ' + (ok ? 'ok' : 'no')} aria-live="polite">
      <b>{ok ? '맞았다' : '틀렸다'}</b>
      {q.why && <p>{q.why}</p>}
      {q.ref && <code>{q.ref}{q.sym ? '  ·  ' + q.sym : ''}</code>}
      <a href={'#' + q.at}>장면에서 보기 →</a>
      {q.at2 && <a href={'#' + q.at2}>이어지는 장면 보기 →</a>}
      <button type="button" className="pl-next" onClick={onNext}>{last ? '결과 보기' : '다음'}</button>
    </section>
  );
}

function Summary({ run, byId, st, onNext }) {
  const miss = run.ids.filter((id) => !run.res[id]);
  const n = run.ids.length - miss.length;
  const m = mastery(st, [...byId.keys()].filter((id) => run.grp === 'ALL' || byId.get(id).g === run.grp));
  return (
    <main className="pl">
      <Top />
      <h1 className="pl-q">{n} / {run.ids.length}</h1>
      <dl className="pl-stat">
        <div><dt>풀어 본 것</dt><dd>{m.seen}</dd></div>
        <div><dt>익힌 것</dt><dd>{m.known}</dd></div>
        <div><dt>전체</dt><dd>{m.total}</dd></div>
      </dl>
      {miss.length > 0 && (
        <>
          <p className="pl-meta">틀린 문항 — 다음 판에 먼저 나온다</p>
          <ul className="pl-miss">
            {miss.map((id) => { const q = byId.get(id); return (
              <li key={id}><a href={'#' + q.at}><i>{KIND[q.kind]}</i>{q.q}</a></li>
            ); })}
          </ul>
        </>
      )}
      <button type="button" className="pl-next" onClick={onNext}>다음 판</button>
    </main>
  );
}

/* 숫자 1–4 로 고르고 Enter 로 넘긴다. fn 이 false 면 듣지 않는다. */
function useKeys(fn) {
  useEffect(() => {
    if (!fn) return undefined;
    const h = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') fn('Enter');
      else if (/^[1-9]$/.test(e.key)) fn(+e.key);
    };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  });
}
