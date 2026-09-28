import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Play from './play/Play.jsx';
import './style.css';
import './kinds.css';   /* 축·그래프·트리 (에이전트 A)  */
import './rail.css';    /* 레일·소스·재생   (에이전트 B) */

/* #play 면 게임, 아니면 무대. App 은 덱이 아닌 주소를 기본 덱으로 고쳐 쓰므로
   #play 에서 App 을 띄우면 주소를 빼앗긴다 — 그래서 여기서 먼저 가른다. */
const isPlay = () => /^#play(\/|$)/.test(location.hash);
function Root() {
  const [play, setPlay] = useState(isPlay);
  useEffect(() => {
    const f = () => setPlay(isPlay());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return play ? <Play /> : <App />;
}
createRoot(document.getElementById('root')).render(<Root />);
