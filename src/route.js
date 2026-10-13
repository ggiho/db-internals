import { DECKS } from './decks.js';

/* 주소가 곧 상태다 : #<묶음>/<덱>/<장면>/<스텝>. 스텝은 1 부터 센다 (사람이 읽는 번호).
   덱 이름에 '/' 가 들어가므로 앞에서부터 자를 수 없다 — 등록된 이름 중
   이 주소의 접두어인 가장 긴 것을 덱으로 본다. 그래야 장면 번호에 무엇이 와도 안전하다.
   App(Lab) 과 Story 가 같은 주소를 읽으므로 한 곳에 둔다. */
export function parse(h) {
  const raw = String(h || '').replace(/^\/+/, '');
  let deck = '';
  for (const id of Object.keys(DECKS)) {
    if ((raw === id || raw.startsWith(id + '/')) && id.length > deck.length) deck = id;
  }
  if (!deck) return { deck: '', num: '', step: 1, v: null };
  /* 4번째 칸이 손잡이 값이다 — '#덱/장면/스텝/v2' 처럼 붙는다.
     링크 하나로 "이 값일 때의 이 스텝" 이 재현돼야 하므로 주소에 싣는다. */
  const [n, s, v] = raw.slice(deck.length).replace(/^\//, '').split('/');
  const vv = /^v(.+)$/.exec(v || '');
  return { deck, num: n || '', step: Math.max(1, parseInt(s, 10) || 1), v: vv ? unv(vv[1]) : null };
}
/* 손잡이 값은 주소에 인코딩해서 싣는다 — PG 의 격리 수준은 'repeatable read' 처럼 공백이 들고
   별칭이 없다. 브라우저는 해시의 공백을 %20 으로 바꾸므로 날것으로 실으면 값이 맞지 않는다.
   지금까지의 값(2 · OFF · READ-COMMITTED · strict_crc32 …)은 인코딩해도 글자가 같다. */
export const env = (v) => encodeURIComponent(v);
export function unv(v) { try { return decodeURIComponent(v); } catch { return v; } }
