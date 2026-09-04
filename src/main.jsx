import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import './kinds.css';   /* 축·그래프·트리 (에이전트 A)  */
import './rail.css';    /* 레일·소스·재생   (에이전트 B) */
createRoot(document.getElementById('root')).render(<App />);
