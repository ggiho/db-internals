/* kv 한 줄 — 스텝의 look 이 이 배우의 키를 배열로 가리키면 그 줄만 밝힌다(.q-hot, story.css).
   예전에는 kv 를 보라고 해도 상자 전체가 밝아질 뿐이었고, verify 는 kv 키를 가리키는 look 을 거부했다 —
   한 줄을 짚으려고 값을 바꾸거나 '|gold' 를 덧칠했다(pg mvcc 01/2 · ch2 10a/7 · wiredtiger 12/2). 2026-10-27 */
export const kvLine = (esc, val, hot) => ([k, v]) => {
  const t = `${esc(k)}  <span class="q-v">${val(v)}</span>`;
  return hot && hot.has(String(k)) ? `<span class="q-hot">${t}</span>` : t;
};
