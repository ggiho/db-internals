/* 각 ref#sym 의 실제 소스를 잘라 code.js 로 만든다.
   linemap.js 가 찾은 줄을 중심으로 위 6줄 · 아래 14줄. */
import fs from 'fs';
import path from 'path';
import { srcRoot } from './srcroot.js';

/* 데이터 로딩 — eval 이 아니라 import() 다. 데이터 파일이 export 를 갖게 되면서
   기존 eval 로더(^const → globalThis)는 export 문에서 깨진다. */
const __here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__here, '..');
async function loadDeck(deck) {
  const g = {};
  for (const f of ['deck', 'actors', 'scenes', 'linemap', 'code', 'booktext', 'booksrc']) {
    const p = path.join(ROOT, 'data', deck, f + '.js');
    if (!fs.existsSync(p)) continue;
    Object.assign(g, await import('file://' + p));
  }
  for (const f of ['knobmap', 'statusmap', 'tablemap']) {
    const p = path.join(ROOT, 'data', 'shared', f + '.js');
    if (fs.existsSync(p)) Object.assign(g, await import('file://' + p));
  }
  for (const [k, v] of Object.entries(g)) if (k !== 'default') globalThis[k] = v;
  return g;
}
/* MySQL 소스 위치. 기본값은 이 프로젝트의 형제 디렉터리 ../mysql-server 다 —
   절대경로를 박으면 다른 사람이 쓸 수 없고 사용자명이 저장소에 남는다.
   다른 곳에 있으면 MYSQL_SRC 로 지정한다. */
const B = 6, A = 14;
const DECK = process.argv[2];
if (!DECK) { console.error('사용법: node extract.js <덱경로>'); process.exit(2); }
const REPO = srcRoot(DECK, ROOT);
/* 데이터 파일이 ESM(export)으로 바뀐 뒤에도 이 한 줄만 eval 로 남아 있었다 —
   `export { LINES }` 에서 SyntaxError 로 죽는다. 위에 이미 있는 loadDeck 을 쓴다.
   (파일 상단 주석은 이미 import 를 쓴다고 적혀 있었는데 이 줄이 안 바뀌어 있었다.) */
await loadDeck(DECK);

/* 스텝이 인용한 fact 문자열을 ref#sym 별로 모은다.
   창이 정의 기준 21줄로 고정돼 있어서 긴 함수에서는 인용한 줄이 창 밖으로 나갔다 —
   실측 : book/ch3 06a 가 page_cur_search_with_match(328줄)를 열지만 인용한 조건은
   374줄이라 독자가 근거를 볼 수 없었다. 담을 수 있으면 창을 늘린다. */
const WANT = {};
for (const sc of SCENES) {
  for (const st of sc.steps || []) {
    if (!st.ref || !st.sym) continue;
    const key = st.ref + '#' + st.sym;
    for (const f of st.fact || []) {
      const [file, q] = Array.isArray(f) ? f : [st.ref, f];
      if (file !== st.ref) continue;          /* 다른 파일의 인용은 이 창과 무관하다 */
      (WANT[key] = WANT[key] || []).push(q);
    }
  }
}
const MAX_SPAN = 200;   /* 창을 늘릴 수 있는 최대 거리. 80·200·400 을 재봤다 —
                           담는 인용이 149 → 153 → 156 건이고 최대 발췌가 101 → 218 → 263 줄,
                           code.js 합이 202 → 219 → 237 KB 다. 200 이 이득 대비 대가가 맞다.
                           패널이 인용 줄로 스크롤하므로 창이 길어도 첫 화면에 근거가 온다. */

const out = {}; let ok = 0, bad = [], grew = 0, far = [], moved = [];
for (const [key, ln] of Object.entries(LINES)) {
  const file = key.split('#')[0];
  const full = path.join(REPO, file);
  if (!fs.existsSync(full)) { bad.push(key); continue; }
  const src = fs.readFileSync(full, 'utf8').split('\n');
  /* 창은 반드시 정의 줄을 담는다. 머리글이 '파일:정의줄 심볼' 을 적으므로,
     그 줄이 창에 없으면 머리글과 보이는 것이 어긋난다.
     (인용 뭉치 쪽으로 창을 옮겨 봤더니 정의 줄을 인용한 스텝이 근거를 잃었다 —
      한 심볼을 여러 스텝이 공유하고 서로 다른 곳을 인용하기 때문이다.)
     정의를 담은 채로 닿는 인용까지 늘리고, 못 담은 것은 보고한다. */
  let from = Math.max(1, ln - B), to = Math.min(src.length, ln + A);
  const MAX_WIN = B + A + 1 + MAX_SPAN;
  const targets = [];
  for (const q of WANT[key] || []) {
    let w = -1, best = Infinity;
    src.forEach((l, k) => {
      if (!l.includes(q)) return;
      const d = Math.abs(k + 1 - ln);
      if (d < best) { best = d; w = k + 1; }
    });
    if (w > 0) targets.push(w);
  }
  /* 가까운 것부터 늘린다 — 먼 것 하나가 창을 다 써 버리지 않게. */
  const missed = [];
  for (const t of [...new Set(targets)].sort((a, b) => Math.abs(a - ln) - Math.abs(b - ln))) {
    if (t >= from && t <= to) continue;
    const lo = Math.min(from, Math.max(1, t - 2));
    const hi = Math.max(to, Math.min(src.length, t + 2));
    if (hi - lo + 1 > MAX_WIN) { missed.push(t); continue; }
    from = lo; to = hi; grew++;
  }
  if (missed.length) {
    /* 어느 함수 안에 있는지 함께 적는다 — sym 이 인용을 담지 않는 함수를 가리키는
       경우가 실제로 있었다(trx_prepare 가 trx_flush_logs 의 줄을 인용했다).
       그러면 창을 어떻게 잡아도 머리글과 보이는 것이 어긋난다. sym 을 고쳐야 한다. */
    for (const t of missed) {
      let encl = 0, name = '';
      for (let k2 = 0; k2 < t; k2++) {
        const l = src[k2];
        if (/^[A-Za-z_][\w:<>,\s\*&~]*\(/.test(l) && !/;\s*$/.test(l)) { encl = k2 + 1; name = l.trim().slice(0, 48); }
      }
      far.push(key + '  인용 ' + t + '줄 은 ' + (encl ? encl + ' "' + name + '"' : '?') + ' 안');
    }
  }

  /* 인용한 줄의 번호를 함께 넘긴다 — 패널이 표시하고, 거기서부터 보여 줄 수 있게.
     담기만 하고 표시하지 않으면 정의 줄이 위에 세워지는 탓에 위쪽 인용은 화면 밖이다. */
  const marks = [];
  for (const q of WANT[key] || []) {
    for (let k = from; k <= to; k++) if (src[k - 1] && src[k - 1].includes(q)) { marks.push(k); break; }
  }
  out[key] = { from, hit: ln, marks: [...new Set(marks)].sort((a, b) => a - b),
    lines: src.slice(from - 1, to).map(l => l.replace(/\t/g, '  ').replace(/\s+$/, '')) };
  ok++;
}
/* lines.js 와 같은 이유로 ESM export 를 함께 쓴다 — 빼먹으면 앱이 발췌를 import 하지 못한다. */
fs.writeFileSync(path.join(ROOT, 'data', DECK, 'code.js'),
  'const CODE = ' + JSON.stringify(out) + ';\n\nexport { CODE };\n');
const kb = (fs.statSync(path.join(ROOT, 'data', DECK, 'code.js')).size / 1024).toFixed(1);
if (grew) console.log('  인용을 담으려고 창을 늘린 곳 ' + grew + '개');
if (moved.length) console.log('  창을 인용 쪽으로 옮긴 곳 ' + moved.length + '개');
if (far.length) console.log('  창에 못 담은 인용 ' + far.length + '개 :\n    ' + far.join('\n    '));
console.log('발췌 ' + ok + ' / ' + Object.keys(LINES).length + '  ·  code.js ' + kb + ' KB');
if (bad.length) console.log('  실패: ' + bad.join(', '));
