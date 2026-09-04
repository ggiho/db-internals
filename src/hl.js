/* 의존성 없는 C++ 강조기 — 옛 엔진 app.js 의 hl() 을 그대로 옮겼다.
   순서가 전부다: 문자열·주석을 *먼저* 떼어낸 뒤에 식별자를 칠한다.
   반대로 하면 "return" 이 들어 있는 주석이나 "if" 가 들어 있는 문자열까지
   키워드로 칠해져서, 코드가 아닌 곳이 코드처럼 보인다.

   옛 판은 HTML 문자열을 만들어 innerHTML 로 넣었다. React 에서는 토큰 배열을
   돌려주고 <span> 으로 그린다 — esc() 가 필요 없어지고(React 가 하고),
   innerHTML 을 쓰지 않으므로 발췌 안의 '<' 나 '&' 가 마크업으로 새지 않는다.
   토큰은 전부 인라인이라 줄높이(16px)에 영향을 주지 않는다 — 줄 경계 스냅의 전제다. */

const KW = new Set(('if else for while do switch case break continue return goto ' +
  'class struct union enum namespace template typename using typedef public private protected ' +
  'virtual override final static const constexpr inline explicit friend operator new delete ' +
  'this nullptr true false sizeof static_cast reinterpret_cast const_cast dynamic_cast ' +
  'try catch throw noexcept mutable volatile extern register auto decltype').split(' '));

const TY = new Set(('void bool char int long short unsigned signed float double size_t ' +
  'uint32_t uint64_t int32_t int64_t byte ulint ibool lsn_t trx_id_t page_no_t space_id_t ' +
  'dberr_t rec_t buf_block_t buf_page_t buf_pool_t dict_index_t trx_t mtr_t que_thr_t ' +
  'log_t fil_space_t page_id_t Log_file_handle ReadView').split(' '));

/* 식별자 · 숫자 · 구두점. 이 셋 밖은 공백이므로 그대로 흘린다. */
const CODE_RE = /([A-Za-z_]\w*)|(\b\d[\w.]*\b)|([{}()[\];,]|->|::|[+\-*/%<>=!&|^~?:])/g;

function push(out, c, v) { if (v) out.push({ c, v }); }

/* 코드 조각 하나를 칠한다 — 여기에는 문자열도 주석도 이미 없다 */
function paint(src, out) {
  CODE_RE.lastIndex = 0;
  let last = 0, m;
  while ((m = CODE_RE.exec(src)) !== null) {
    if (m.index > last) push(out, null, src.slice(last, m.index));
    const [full, id, num, punc] = m;
    if (id) {
      if (KW.has(id)) push(out, 'c-k', id);
      /* _t 로 끝나면 InnoDB 관례상 타입이다 — 목록에 없는 것까지 잡는다 */
      else if (TY.has(id) || /_t$/.test(id)) push(out, 'c-t', id);
      /* 전부 대문자 세 글자 이상은 매크로·상수 */
      else if (/^[A-Z][A-Z0-9_]{2,}$/.test(id)) push(out, 'c-n', id);
      else push(out, null, id);
    } else if (num) push(out, 'c-n', num);
    else push(out, 'c-p', punc);
    last = m.index + full.length;
  }
  if (last < src.length) push(out, null, src.slice(last));
}

/* 한 줄을 토큰으로 쪼갠다.
   inBlock : 앞줄에서 /* 가 열린 채 끝났는가. 블록 주석은 줄을 넘나들므로
   호출하는 쪽이 이 값을 이어서 넘겨줘야 한다 (돌려받은 block 을 다음 줄에). */
export function hl(line, inBlock) {
  const out = [];
  let i = 0;

  if (inBlock) {                                   // 앞줄에서 이어진 블록 주석
    const e = line.indexOf('*/');
    if (e < 0) return { toks: [{ c: 'c-c', v: line }], block: true };
    push(out, 'c-c', line.slice(0, e + 2));
    i = e + 2;
    inBlock = false;
  }

  const rest = line.slice(i);
  let buf = '', j = 0;
  while (j < rest.length) {
    const two = rest.slice(j, j + 2);
    if (two === '//') {                            // 줄 끝까지 주석
      paint(buf, out); buf = '';
      push(out, 'c-c', rest.slice(j));
      j = rest.length;
      break;
    }
    if (two === '/*') {
      paint(buf, out); buf = '';
      const e = rest.indexOf('*/', j + 2);
      if (e < 0) { push(out, 'c-c', rest.slice(j)); inBlock = true; j = rest.length; break; }
      push(out, 'c-c', rest.slice(j, e + 2));
      j = e + 2;
      continue;
    }
    const ch = rest[j];
    if (ch === '"' || ch === "'") {                // 문자열 · 문자
      paint(buf, out); buf = '';
      let k = j + 1;
      while (k < rest.length && !(rest[k] === ch && rest[k - 1] !== '\\')) k++;
      push(out, 'c-s', rest.slice(j, Math.min(k + 1, rest.length)));
      j = k + 1;
      continue;
    }
    buf += ch; j++;
  }
  paint(buf, out);

  return { toks: out, block: inBlock };
}

/* 발췌 하나를 줄 배열로 — 블록 주석 상태를 줄 사이로 이어 준다.
   c = { from, hit, lines } 이므로 절대 줄번호는 from + k 다. */
export function highlight(code) {
  if (!code) return [];
  let block = false;
  return code.lines.map((l, k) => {
    const r = hl(l, block);
    block = r.block;
    return { n: code.from + k, toks: r.toks };
  });
}
