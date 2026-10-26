import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
/* CSS 는 이 순서로 실린다 — style · kinds → (App 이 가져오는) stage · delta · play → rail.
   빌드는 probe.html 과 함께 쓰는 style · kinds 를 공유 청크로 떼어 늘 먼저 싣는다. 예전엔 App 을
   먼저 가져와서 개발 서버에서만 stage.css 가 style.css 보다 앞에 실렸고, 같은 우선순위의 규칙이
   반대로 이겼다(경계 .edge 의 grid-column · opacity, 레인 이름의 자간). 스윕은 개발 서버를 재므로
   배포본과 다른 화면을 재고 있었다 — 1512 innodb 05/5 비교 모드에서 무대 넘침 12px 대 64px. */
import './style.css';
import './kinds.css';   /* 축·그래프·트리 (에이전트 A)  */
import App from './App.jsx';
import Play from './play/Play.jsx';
import './rail.css';    /* 레일·소스·재생   (에이전트 B) */
import { parse } from './route.js';
import { hasStory, isLab } from './story/has.js';

/* 저장한 테마를 그리기 전에 건다 — Lab(App.jsx)만 이것을 읽어서, Story 에서 '어둡게' 를 누르고 새로 열면
   시스템 설정으로 돌아갔다(Story 는 data-theme 이 없으면 prefers-color-scheme 을 따른다). 'auto' 는 저장하지 않는다 */
try { const t = localStorage.getItem('theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch { /* 저장소를 못 쓰면 시스템 설정 */ }

/* Story 는 그 장면에 세계가 있을 때만 받는다 — Lab 만 보는 사람은 내려받지 않는다 */
const Story = lazy(() => import('./story/Story.jsx'));

/* #play 면 게임. 아니면 Story 가 기본이고, ?lab 이거나 세계가 없는 장면이면 Lab(App) 이다.
   App 은 덱이 아닌 주소를 기본 덱으로 고쳐 쓰므로 #play 에서 App 을 띄우면 주소를 빼앗긴다 —
   그래서 여기서 먼저 가른다. */
const isPlay = () => /^#play(\/|$)/.test(location.hash);
function modeOf() {
  if (isPlay()) return 'play';
  if (!isLab() && hasStory(parse(location.hash.slice(1)))) return 'story';
  return 'lab';
}
function Root() {
  const [mode, setMode] = useState(modeOf);
  useEffect(() => {
    const f = () => setMode(modeOf());
    addEventListener('hashchange', f);
    addEventListener('popstate', f);
    return () => { removeEventListener('hashchange', f); removeEventListener('popstate', f); };
  }, []);
  if (mode === 'play') return <Play />;
  if (mode === 'story') return <Suspense fallback={<div className="boot">불러오는 중…</div>}><Story /></Suspense>;
  return <App />;
}
createRoot(document.getElementById('root')).render(<Root />);
