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
const WANT = {};        /* ref#sym → 그 심볼을 쓰는 모든 스텝의 인용 */
const STEP = {};        /* ref#sym@장면/스텝 → 그 스텝만의 인용 */
/* 변형 스텝도 포함한다 — 값마다 다른 곳을 인용하므로 전용 발췌가 필요할 수 있다.
   자리 이름은 '장면/스텝@값' 으로 구분한다. */
const withVary = (sc) => [
  ...(sc.steps || []).map((st, i) => [st, String(i + 1)]),
  ...Object.entries((sc.vary && sc.vary.alt) || {}).flatMap(([v, o]) =>
    Object.entries(o).map(([n, st]) => [st, n + 'v' + v])),
];
for (const sc of SCENES) {
  for (const [st, tag] of withVary(sc)) {
    if (!st.ref || !st.sym) continue;
    const key = st.ref + '#' + st.sym;
    const at = key + '@' + sc.num + '/' + tag;
    for (const f of st.fact || []) {
      const [file, q] = Array.isArray(f) ? f : [st.ref, f];
      if (file !== st.ref) continue;          /* 다른 파일의 인용은 이 창과 무관하다 */
      (WANT[key] = WANT[key] || []).push(q);
      (STEP[at] = STEP[at] || { key, qs: [] }).qs.push(q);
    }
  }
}

/* 그 줄을 감싸는 정의의 이름. 스텝별 발췌는 정의에서 멀리 떨어진 자리를 보여 주므로,
   머리글이 계속 원래 sym 을 적으면 거짓이 된다 — 실제로 그 자리를 감싸는 이름을 적는다. */
/* 감싸는 함수 이름을 추정해 머리글에 쓰려 했으나 버렸다.
   줄 모양만 보면 라이선스 주석의 "software" 나 static_assert 를 함수로 착각하고,
   중괄호 균형을 세도 헤더의 매크로·#ifdef 때문에 어긋났다(lock_check_trx_id_sanity).
   추정해서 틀린 이름을 적는 것보다, 심볼은 자기 정의 줄과 함께 적고
   보여 주는 구간을 따로 밝히는 편이 정직하다. */
/* 인용이 있는 줄을 찾는다. 한 줄에 다 있으면 그 줄, 없으면 여러 줄에 걸친 것이므로
   시작 줄을 돌려준다 — verify.js 는 공백을 정규화해 파일 전체에서 대조하므로
   두 줄에 걸친 인용도 통과하는데, 줄 단위로만 찾으면 표시할 자리를 못 찾았다.
   실측 : 172건 중 6건이 그랬다(mach_write_to_8(...) 같은 긴 호출, 두 줄 주석). */
const norm = (t) => t.replace(/\s+/g, ' ').trim();
const nearest = (src, q, anchor) => {
  let w = -1, best = Infinity;
  src.forEach((l, k) => {
    if (!l.includes(q)) return;
    const d = Math.abs(k + 1 - anchor);
    if (d < best) { best = d; w = k + 1; }
  });
  if (w > 0) return w;
  const nq = norm(q);
  for (let k = 0; k < src.length; k++) {
    let joined = '';
    for (let j = k; j < Math.min(src.length, k + 5); j++) {
      joined = norm(joined + ' ' + src[j]);
      if (!joined.includes(nq)) continue;
      const d = Math.abs(k + 1 - anchor);
      if (d < best) { best = d; w = k + 1; }
      break;
    }
  }
  return w;
};
const MAX_SPAN = 80;    /* 기본 창을 늘릴 수 있는 최대 거리. 스텝 전용 발췌가 먼 인용을 맡으므로
                           기본 창은 좁게 둔다 — 40/80/200 을 재봤더니 못 담는 인용이 6/1/1 건이고
                           code.js 합이 221/233/261 KB 다. 80 이 같은 적중률에 가장 작다. */

const out = {}, stepOut = {}; let ok = 0, bad = [], grew = 0, far = [], moved = [], perStep = 0;
const pending = [];
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
  if (missed.length) pending.push([key, missed, src]);
  if (false) {
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
    const w = nearest(src, q, ln);            /* 여러 줄 인용도 시작 줄로 잡힌다 */
    if (w >= from && w <= to) marks.push(w);
  }
  const cut = (a, b) => src.slice(a - 1, b).map(l => l.replace(/\t/g, '  ').replace(/\s+$/, ''));
  out[key] = { from, hit: ln, marks: [...new Set(marks)].sort((a, b) => a - b), lines: cut(from, to) };
  ok++;

  /* 기본 창이 못 담은 인용을 가진 스텝에는 그 스텝만의 발췌를 준다.
     한 심볼을 여러 스텝이 공유하고 서로 다른 곳을 인용하면 창 하나로는 불가능하다 —
     그래서 조회 키를 ref#sym@장면/스텝 으로 늘리고 앱이 그것을 먼저 본다. */
  for (const [at, v] of Object.entries(STEP)) {
    if (v.key !== key) continue;
    const ws = [...new Set(v.qs.map((q) => nearest(src, q, ln)).filter((w) => w > 0))].sort((a, b) => a - b);
    if (!ws.length || ws.every((w) => w >= from && w <= to)) continue;
    /* 인용들을 가까운 것끼리 묶어 구간 여럿으로 만든다. 한 창으로는 969·1947·8628줄
       떨어진 두 곳을 함께 담을 수 없었다 — 구간을 나누고 사이에 '생략' 줄을 넣는다.
       탭을 만들지 않아도 한 발췌 안에서 두 근거를 다 볼 수 있고, 무엇을 건너뛰었는지도
       숫자로 남는다. */
    const GROUP_GAP = 40;        /* 이보다 떨어지면 다른 구간으로 본다 */
    const CLUSTER_MAX = 140;     /* 구간 하나의 최대 줄 수 */
    const groups = [];
    for (const w of ws) {
      const g = groups[groups.length - 1];
      if (g && w - g[g.length - 1] <= GROUP_GAP) g.push(w);
      else groups.push([w]);
    }
    /* 정의가 어느 구간에도 없으면 정의 구간을 앞에 둔다 — 맥락이 남는다. */
    const spans = groups.map((g) => {
      let a = Math.max(1, g[0] - B), b = Math.min(src.length, g[g.length - 1] + A);
      if (b - a + 1 > CLUSTER_MAX) b = Math.min(src.length, a + CLUSTER_MAX - 1);
      return [a, b];
    });
    if (!spans.some(([a, b]) => ln >= a && ln <= b)) {
      spans.push([Math.max(1, ln - B), Math.min(src.length, ln + A)]);
      spans.sort((x, y) => x[0] - y[0]);
    }
    /* 겹치거나 붙은 구간은 합친다 */
    const merged = [];
    for (const sp of spans) {
      const last = merged[merged.length - 1];
      if (last && sp[0] <= last[1] + 3) last[1] = Math.max(last[1], sp[1]);
      else merged.push([...sp]);
    }
    const lines2 = [], nums2 = [];
    merged.forEach(([a, b], gi) => {
      if (gi) {
        const skipped = a - merged[gi - 1][1] - 1;
        lines2.push('⋯  ' + skipped.toLocaleString('en-US') + '줄 생략  ⋯');
        nums2.push(0);
      }
      for (let k = a; k <= b; k++) { lines2.push(src[k - 1].replace(/\t/g, '  ').replace(/\s+$/, '')); nums2.push(k); }
    });
    /* def : 심볼의 정의 줄. 머리글은 이것을 적고, 창은 인용 쪽을 보여 준다 —
       둘이 다르면 머리글이 '발췌 N–M' 을 함께 적어 어긋남을 밝힌다. */
    const inSpan = (w) => merged.some(([a, b]) => w >= a && w <= b);
    stepOut[at] = { from: merged[0][0], hit: ws[0], def: ln, ranges: merged,
      nums: nums2, marks: ws.filter(inSpan), lines: lines2 };
    perStep++;
  }
}
Object.assign(out, stepOut);

/* 스텝 전용 발췌가 담아 준 것은 제외하고, 정말 남은 것만 보고한다. */
for (const [key, missed, src] of pending) {
  for (const t of missed) {
    const covered = Object.entries(stepOut).some(([at, v]) =>
      at.startsWith(key + '@') && t >= v.from && t <= v.from + v.lines.length - 1);
    if (covered) continue;
    let encl = 0, name = '';
    for (let k2 = 0; k2 < t; k2++) {
      const l = src[k2];
      if (/^[A-Za-z_][\w:<>,\s\*&~]*\(/.test(l) && !/;\s*$/.test(l)) { encl = k2 + 1; name = l.trim().slice(0, 48); }
    }
    far.push(key + '  인용 ' + t + '줄 은 ' + (encl ? encl + ' "' + name + '"' : '?') + ' 안');
  }
}
/* lines.js 와 같은 이유로 ESM export 를 함께 쓴다 — 빼먹으면 앱이 발췌를 import 하지 못한다. */
fs.writeFileSync(path.join(ROOT, 'data', DECK, 'code.js'),
  'const CODE = ' + JSON.stringify(out) + ';\n\nexport { CODE };\n');
const kb = (fs.statSync(path.join(ROOT, 'data', DECK, 'code.js')).size / 1024).toFixed(1);
if (grew) console.log('  인용을 담으려고 창을 늘린 곳 ' + grew + '개');
if (perStep) console.log('  스텝 전용 발췌 ' + perStep + '개');
if (moved.length) console.log('  창을 인용 쪽으로 옮긴 곳 ' + moved.length + '개');
if (far.length) console.log('  창에 못 담은 인용 ' + far.length + '개 :\n    ' + far.join('\n    '));
console.log('발췌 ' + ok + ' / ' + Object.keys(LINES).length + '  ·  code.js ' + kb + ' KB');
if (bad.length) console.log('  실패: ' + bad.join(', '));
