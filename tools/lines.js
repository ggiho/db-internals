/* scenes.js 의 ref(경로) + sym(심볼) 을 저장소에서 찾아 줄 번호로 바꾼다.
   줄 번호를 손으로 쓰면 반드시 썩는다 — 빌드가 매번 다시 찾게 한다. */
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
const DECK = process.argv[2];
if (!DECK) { console.error('사용법: node lines.js <덱경로>'); process.exit(2); }
const REPO = srcRoot(DECK, ROOT);
/* 데이터 파일이 ESM(export)으로 바뀐 뒤에도 이 한 줄만 eval 로 남아 있었다 —
   `export { SCENES }` 에서 SyntaxError 로 죽는다. 위에 이미 있는 loadDeck 을 쓴다.
   (파일 상단 주석은 이미 import 를 쓴다고 적혀 있었는데 이 줄이 안 바뀌어 있었다.) */
await loadDeck(DECK);

const want = new Map();
SCENES.forEach(s => s.steps.forEach(st => {
  if (st.ref && st.sym) want.set(st.ref + '#' + st.sym, { f: st.ref, s: st.sym });
}));

const out = {}; let ok = 0, miss = [];
for (const [key, { f, s }] of want) {
  const p = path.join(REPO, f);
  if (!fs.existsSync(p)) { miss.push(key + '  (파일 없음)'); continue; }
  const src = fs.readFileSync(p, 'utf8').split('\n');
  const bare = s.includes('::') ? s.split('::').pop() : s;
  const cls  = s.includes('::') ? s.split('::')[0] : null;
  let hit = -1;
  /* 정의를 찾는다 : 줄 앞쪽에 심볼이 오고 여는 괄호가 따르는 형태를 우선한다 */
  /* 정의를 찾는다. 마지막 패턴은 [[nodiscard]] 같은 속성이 붙은 클래스 내부 메서드용으로
     느슨하게 열어 두고, 호출부(-> 나 . 뒤에 오는 것)는 코드로 걸러낸다. */
  const pats = [
    new RegExp('^[\\w:<>,\\s\\*&~]*\\b' + esc(s) + '\\s*\\('),
    cls ? new RegExp('^[\\w:<>,\\s\\*&~]*\\b' + esc(cls) + '::' + esc(bare) + '\\s*\\(') : null,
    new RegExp('^\\s*\\w[\\w:<>,\\s\\*&]*\\b' + esc(bare) + '\\s*\\('),
    new RegExp('^[\\s\\w:<>,\\*&~\\[\\]]*\\b' + esc(bare) + '\\s*\\('),
  ].filter(Boolean);
  for (const re of pats) {
    for (let i = 0; i < src.length; i++) {
      const ln = src[i];
      if (!re.test(ln)) continue;
      if (/;\s*$/.test(ln) && !/\)\s*$/.test(ln)) continue;    // 선언만인 줄은 건너뛴다
      const at = ln.search(new RegExp('\\b' + esc(bare) + '\\s*\\('));
      if (at > 0 && /(->|\.)\s*$/.test(ln.slice(0, at))) continue;   // 호출부다 (Class:: 는 정의다)
      if (/^\s*(return|if|while|for|ut_ad|ut_a|ib::|ASSERT)\b/.test(ln)) continue;
      /* 주석 줄은 정의가 아니다 — 마지막 패턴이 접두어에 '*' 를 허용하므로
         " *  HeapTupleSatisfiesMVCC()" 같은 문서 주석의 함수 목록이 정의로 잡힌다.
         실측 : PostgreSQL heapam_visibility.c 에서 960(정의) 대신 40(주석)이 나왔다. */
      if (/^\s*(\/\*|\*|\/\/)/.test(ln)) continue;
      hit = i + 1; break;
    }
    if (hit > 0) break;
  }
  /* 함수로 못 찾았으면 *상수 정의* 를 찾는다 — 이 프로젝트는 FIL/PAGE 오프셋 같은
     헤더 상수가 주제의 절반인데, 위 패턴은 전부 '심볼(' 을 요구해 상수를 놓친다.
     constexpr·enum·#define 세 형태를 본다. 함수 뒤에 두므로 기존 해석은 바뀌지 않는다. */
  if (hit <= 0) {
    const cpats = [
      new RegExp('^\\s*(?:static\\s+)?constexpr\\b[^=]*\\b' + esc(bare) + '\\s*='),
      new RegExp('^\\s*#\\s*define\\s+' + esc(bare) + '\\b'),
      new RegExp('^\\s*' + esc(bare) + '\\s*=\\s*[^;]*,\\s*$'),
    ];
    for (const re of cpats) {
      for (let i = 0; i < src.length; i++) {
        if (re.test(src[i])) { hit = i + 1; break; }
      }
      if (hit > 0) break;
    }
  }
  /* 함수도 상수도 아니면 *타입 정의* 를 찾는다 — struct·union·enum·typedef.
     PostgreSQL 편은 구조체(HeapTupleHeaderData 등)를 직접 지목하는 일이 많다.
     세 형태를 본다 : 앞에 오는 정의, typedef 의 꼬리(} 이름;), 그리고 typedef 한 줄. */
  if (hit <= 0) {
    const tpats = [
      new RegExp('^\\s*(?:typedef\\s+)?(?:struct|union|enum)\\s+' + esc(bare) + '\\b'),
      new RegExp('^\\s*\\}\\s*' + esc(bare) + '\\s*;'),
      new RegExp('^\\s*typedef\\b.*\\b' + esc(bare) + '\\s*;'),
      /* 배열·변수 정의도 찾는다 — PostgreSQL 의 LockConflicts[] 처럼
         함수도 상수도 타입도 아닌 "표" 가 심볼일 수 있다. */
      new RegExp('^\\s*(?:static\\s+)?(?:const\\s+)?\\w[\\w\\s\\*]*\\b' + esc(bare) + '\\s*\\[\\s*\\]\\s*='),
      /* 초기화 없는 전역 변수 선언도 정의다 — PostgreSQL 의
         "int\t\tmax_locks_per_xact;" 처럼 GUC 값을 받는 변수가 그렇다. */
      new RegExp('^(?:static\\s+)?\\w[\\w\\s\\*]*?\\b' + esc(bare) + '\\s*;'),
    ];
    for (const re of tpats) {
      for (let i = 0; i < src.length; i++) {
        if (re.test(src[i])) { hit = i + 1; break; }
      }
      if (hit > 0) break;
    }
  }
  if (hit > 0) { out[key] = hit; ok++; } else miss.push(key);
}
function esc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ESM export 를 반드시 함께 쓴다 — 이것을 빼먹으면 앱이 linemap 을 import 할 수 없고,
   extract.js 도 LINES 를 못 찾는다(ESM 이전 때 남은 잔재였다). */
fs.writeFileSync(path.join(ROOT, 'data', DECK, 'linemap.js'),
  'const LINES = ' + JSON.stringify(out, null, 0) + ';\n\nexport { LINES };\n');
console.log('심볼 해석: ' + ok + ' / ' + want.size);
if (miss.length) console.log('  못 찾음: ' + miss.join('\n           '));
