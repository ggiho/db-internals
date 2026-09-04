/* 정적 검증 — 빌드가 호출하고, 오류가 있으면 1 로 끝난다.
   무대는 연산으로 굴러가므로, 연산이 존재하지 않는 항목을 건드리면 조용히 아무 일도 안 일어난다.
   그 침묵이 가장 위험하다 → 연산을 실제로 재생해서 검사한다. */
import fs from 'fs';
import path from 'path';

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
const DECK = process.argv[2];
if (!DECK) { console.error('사용법: node verify.js <덱경로>'); process.exit(2); }
await loadDeck(DECK);
if (typeof BOOKTEXT === 'undefined') globalThis.BOOKTEXT = null;

let E = 0, W = 0; const es = [], ws = [];
/* 덱이 LANES·EDGES 를 빠뜨리면 무대 만들기가 예외로 죽고 화면이 통째로 빈다.
   락 덱에서 실제로 그랬는데 검증은 통과했다 — 화면이 비는 것을 검증이 못 보면 안 된다. */
if (typeof LANES === 'undefined' || !Array.isArray(LANES) || !LANES.length)
  { E++; es.push('덱에 LANES 가 없다 — 무대를 만들 수 없다'); }
if (typeof EDGES === 'undefined' || !Array.isArray(EDGES))
  { E++; es.push('덱에 EDGES 가 없다 (빈 배열이라도 필요하다)'); }
/* fact : 산문이 주장한 구조적 사실을 저장소 문자열에 묶는다.
   이번 점검에서 틀린 3건은 모두 key·why 산문이었고 어떤 검사도 걸지 않았다 —
   인용은 cite 가 잡는데 내가 직접 한 주장은 잡을 것이 없었다. 그 구멍을 메운다.
   각 문자열은 그 스텝의 ref 파일 안에 실제로 있어야 한다. 공백만 정규화한다
   (clang-format 이 인자를 다음 줄로 넘기므로). */
/* MySQL 소스 위치. 기본값은 이 프로젝트의 형제 디렉터리 ../mysql-server 다 —
   절대경로를 박으면 다른 사람이 쓸 수 없고 사용자명이 저장소에 남는다.
   다른 곳에 있으면 MYSQL_SRC 로 지정한다. */
const REPO = process.env.MYSQL_SRC || path.resolve(ROOT, '..', 'mysql-server');
const srcCache = new Map();
const srcOf = rel => {
  if (!srcCache.has(rel)) {
    try { srcCache.set(rel, fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\s+/g, ' ')); }
    catch (e) { srcCache.set(rel, null); }
  }
  return srcCache.get(rel);
};
/* 태그 어휘는 배우 종류마다 다르다 — bytes 의 칸은 목록 항목과 다른 CSS 클래스를 쓴다 */
const TAGS  = ['clean','dirty','pin','free','x','ok','hold','sep','wait'];
const BYTAGS = ['hdr','free','gold','red',''];
const SPANS = ['rec','gap','next','ii','blk'];   /* axis 의 잠금 구간 종류 */
const err = m => { E++; if (es.length < 40) es.push(m); };
const wrn = m => { W++; if (ws.length < 20) ws.push(m); };

const nums = new Set();
for (const sc of SCENES) {
  const T = 'SCENE ' + sc.num;
  ['num','tab','title','sub','cast','init','steps'].forEach(k =>
    { if (!sc[k]) err(T + ' 필드 누락 : ' + k); });
  if (nums.has(sc.num)) err(T + ' 번호 중복');
  nums.add(sc.num);

  /* 비교 모드의 짝 — 스텝 수가 다르면 같은 인덱스를 나란히 놓는 것이 무의미하다 */
  if (sc.pair) {
    const o = SCENES.find(x => x.num === sc.pair);
    if (!o) err(T + ' pair 가 없는 장면을 가리킨다 : ' + sc.pair);
    else {
      if (o.steps.length !== sc.steps.length)
        err(T + ' pair 의 스텝 수가 다르다 — ' + sc.steps.length + ' vs ' + o.steps.length +
            ' (같은 인덱스를 나란히 놓을 수 없다)');
      if (!sc.vsLabel || !o.vsLabel) err(T + ' 비교 장면은 양쪽 다 vsLabel 이 필요하다');
      if (!o.hidden) wrn(T + ' pair 대상 ' + o.num + ' 이 탭에도 나온다 (hidden:true 를 권한다)');
      if (o.pair) err(T + ' pair 가 양방향이다 — 한쪽만 pair 를 갖는다');
    }
  }
  if (sc.hidden && sc.tab !== '—') wrn(T + ' hidden 장면의 tab 은 쓰이지 않는다');

  /* 책 원문 대조 — cite 에 적은 영어 구절이 그 장 원문에 실제로 있어야 한다.
     정규화가 핵심이다 : PDF 추출은 문장 중간에 줄바꿈을 넣고, 대소문자와
     둥근 따옴표가 다르다. 이번 점검에서 그 셋 때문에 검사가 두 번 틀렸다. */
  if (typeof BOOKTEXT === 'string' && BOOKTEXT) {
    /* 하이픈도 지운다 — PDF 추출은 줄 끝 하이픈을 삼켜서
       "key-value" 가 "keyvalue" 로 붙는다. 구별할 방법이 없으므로 양쪽에서 없앤다. */
    const norm = x => x.replace(/\s+/g, ' ')
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
      .replace(/[-\u2010-\u2015]/g, '').toLowerCase();
    (sc.cite || []).forEach(q => {
      if (!norm(BOOKTEXT).includes(norm(q)))
        err(T + ' cite 구절이 책 원문에 없다 — "' + q.slice(0, 56) + '"');
    });
    if (!sc.cite || !sc.cite.length) wrn(T + ' cite 가 없다 — 책에 귀속시킨 주장의 근거가 없다');
  } else if (sc.cite) {
    wrn(T + ' 책 원문이 없어 cite 대조를 건너뛴다');
  }

  /* 손잡이 : innodb_* 이름은 저장소에 실제로 있어야 한다 (오타·폐기된 이름을 막는다).
     innodb_ 로 시작하지 않는 서버 변수는 이 목록에 없으므로 검사하지 않는다. */
  (sc.knobs || []).forEach(([n, d, w]) => {
    if (!n || !d || !w) err(T + ' knobs 항목은 [이름, 기본값, 설명] 세 칸이 다 필요하다 : ' + n);
    /* 기본값 칸은 레일에서 오른쪽 정렬된 좁은 칸이다. 이름 칸에 '—' 를 넣고 값 칸에
       긴 문장을 넣었더니 250px 레일을 16px 넘었다 — 다른 덱은 최장 18자다. */
    if (d && d.length > 20)
      err(T + ' knobs 기본값이 ' + d.length + '자다 — 값 칸은 20자까지다 (이름 칸을 쓰라) : ' + d);
    if (/^innodb_/.test(n) && !KNOBS[n])
      err(T + ' 저장소에 없는 innodb 변수 : ' + n);
    /* 기본값이 저장소 추출값과 어긋나는지 — 표기 차이는 정규화해서 걸러낸다.
       숫자로 단정할 수 없는 것(코어 수 의존 등)은 서술로 적었으므로 검사에서 빼둔다. */
    const k = KNOBS[n];
    if (k && k.def != null && /^[\d.]+$/.test(String(d).replace(/,/g, ''))) {
      const rd = String(k.def).replace(/[\s_,]/g, '')
        .replace('100*3/8', '37').replace(/L$/, '');
      const mine = String(d).replace(/[\s,]/g, '').replace(/\.0$/, '');
      const rn = /^[\d.]+$/.test(rd) ? String(parseFloat(rd)) : rd;
      if (/^[\d.]+$/.test(rn) && String(parseFloat(mine)) !== rn)
        err(T + ' ' + n + ' 기본값이 저장소와 다르다 — 쓴 값 ' + d + ' / 저장소 ' + k.def);
    }
  });
  (sc.watch || []).forEach(([h, b]) => {
    if (!h || !b) err(T + ' watch 항목은 [보는 곳, 무엇을] 두 칸이 필요하다 : ' + h);
    /* Innodb_* 상태 변수는 저장소의 status 배열에 실제로 있어야 한다.
       Innodb_deadlocks 는 Percona/MariaDB 변수인데 있는 줄 알고 썼다가 이 검사로 잡았다. */
    const m = /^Innodb_([a-z0-9_]+)$/.exec(h);
    if (m && !STATUS.includes(m[1])) err(T + ' MySQL 에 없는 상태 변수 : ' + h);
    /* I_S. · P_S. 로 시작하는 테이블 이름도 실제로 있어야 한다.
       INNODB_INDEXES 에 페이지 수가 있는 줄 알고 썼다가(실은 INNODB_TABLESTATS) 이 부류를 점검하게 됐다 */
    const t = /^(?:I_S|P_S)\.([A-Za-z_0-9]+)/.exec(h);
    if (t && !TABLES.includes(t[1].toUpperCase()))
      err(T + ' MySQL 에 없는 테이블 : ' + h);
  });
  (sc.links || []).forEach(([num, why]) => {
    if (!SCENES.some(x => x.num === num)) err(T + ' links 가 없는 장면을 가리킨다 : ' + num);
    if (num === sc.num) err(T + ' links 가 자기 자신을 가리킨다');
    if (!why) err(T + ' links 에 이유가 없다 : ' + num);
  });
  if (!sc.knobs) wrn(T + ' 손잡이(knobs)가 없다');
  if (!sc.watch) wrn(T + ' 관측 방법(watch)이 없다');
  if (!sc.links) wrn(T + ' 관련 장면(links)이 없다');

  sc.cast.forEach(c => { if (!ACTORS[c]) err(T + ' cast 에 없는 배우 : ' + c); });
  Object.keys(sc.init).forEach(k => {
    if (!ACTORS[k]) err(T + ' init 에 없는 배우 : ' + k);
    else if (!sc.cast.includes(k)) err(T + ' init 에 있는데 cast 에 없다 : ' + k);
  });
  sc.cast.forEach(c => { if (!sc.init[c]) err(T + ' cast 에 있는데 init 이 없다 : ' + c); });

  /* 배우 종류와 init 모양이 맞는가 */
  for (const [k, v] of Object.entries(sc.init)) {
    const kind = ACTORS[k] && ACTORS[k].kind;
    if (kind === 'kv' && !v.kv) err(T + ' ' + k + ' 는 kv 인데 init 에 kv 가 없다');
    if ((kind === 'list' || kind === 'frames') && !v.items)
      err(T + ' ' + k + ' 는 ' + kind + ' 인데 init 에 items 가 없다');
    if (kind === 'axis') {
      if (!v.axis || typeof v.axis.min !== 'number' || typeof v.axis.max !== 'number')
        err(T + ' ' + k + ' 는 axis 인데 init 에 axis:{min,max} 가 없다');
      else if (v.axis.max <= v.axis.min) err(T + ' ' + k + ' axis 의 max 가 min 보다 작다');
      if (!v.items) err(T + ' ' + k + ' axis 는 items(레코드)가 필요하다');
      else v.items.forEach(r => {
        if (typeof r.v !== 'number') err(T + ' ' + k + ' 레코드 ' + r.id + ' 에 값(v)이 없다');
        else if (v.axis && (r.v < v.axis.min || r.v > v.axis.max))
          err(T + ' ' + k + ' 레코드 ' + r.id + ' 의 값 ' + r.v + ' 이 축 범위를 벗어난다');
      });
    }
    if (kind === 'matrix') {
      /* 행렬은 소스의 표를 그대로 옮긴 것이라, 모양이 어긋나면 사실이 어긋난다 */
      if (!v.mx) err(T + ' ' + k + ' 는 matrix 인데 init 에 mx 가 없다');
      else {
        const { rows, cols, cells } = v.mx;
        if (!Array.isArray(rows) || !rows.length) err(T + ' ' + k + ' mx.rows 가 없다');
        else if (!Array.isArray(cols) || !cols.length) err(T + ' ' + k + ' mx.cols 가 없다');
        else if (!Array.isArray(cells) || cells.length !== rows.length)
          err(T + ' ' + k + ' mx.cells 행 수가 rows 와 다르다 — ' +
              (cells ? cells.length : 0) + ' vs ' + rows.length);
        else cells.forEach((r, i) => {
          if (!Array.isArray(r) || r.length !== cols.length)
            err(T + ' ' + k + ' mx.cells[' + i + '] 칸 수가 cols 와 다르다 — ' +
                (Array.isArray(r) ? r.length : 0) + ' vs ' + cols.length);
          else r.forEach((c2, j) => {
            if (c2 !== '+' && c2 !== '-')
              err(T + ' ' + k + " mx.cells[" + i + '][' + j + "] 은 '+' 또는 '-' 여야 한다 — " + c2);
          });
        });
      }
    }
    if (kind === 'graph' && !v.items) err(T + ' ' + k + ' 는 graph 인데 init 에 items(노드)가 없다');
    if (kind === 'bytes') {
      if (!v.items) err(T + ' ' + k + ' 는 bytes 인데 init 에 items 가 없다');
      else v.items.forEach(x => {
        if (typeof x.sz !== 'number' || x.sz <= 0)
          err(T + ' ' + k + ' 칸 ' + x.id + ' 에 크기(sz)가 없다 — 폭이 크기를 나타내야 한다');
        if (x.tag !== undefined && !BYTAGS.includes(x.tag))
          err(T + ' ' + k + ' 칸 ' + x.id + ' 의 태그가 bytes 어휘에 없다 — ' + x.tag);
        /* 라벨이 칸 폭에 비해 지나치게 길면 줄임표로 끝난다 — 읽히지 않는 라벨이다.
           브라우저 측정으로 15건을 찾아낸 뒤 넣은 근사 검사다 (한글은 2배로 센다) */
        const w = [...String(x.id)].reduce((t, ch) => t + (/[\uAC00-\uD7A3]/.test(ch) ? 2 : 1), 0);
        if (w > (x.sz || 1) * 6)
          wrn(T + ' ' + k + ' 칸 라벨이 폭에 비해 길다 — "' + x.id + '" (sz ' + (x.sz || 1) + ')');
      });
    }
    if (kind === 'tree') {
      if (!v.items) err(T + ' ' + k + ' 는 tree 인데 init 에 items 가 없다');
      else v.items.forEach(x => {
        if (typeof x.lvl !== 'number') err(T + ' ' + k + ' 노드 ' + x.id + ' 에 lvl 이 없다');
        if (x.fill !== undefined && (x.fill < 0 || x.fill > 1))
          err(T + ' ' + k + ' 노드 ' + x.id + ' 의 fill 은 0~1 이어야 한다 — ' + x.fill);
      });
      /* 예시 트리의 레벨 개수가 팬아웃과 맞는지 — 산문이 여기서 파생된 수치를 인용한다.
         2장에서 leaf ×2,700 위에 internal ×371 을 두었는데 371 개면 137,641 리프를
         덮으므로 51배 과다였다. 거기서 "372블록 · 6MB" 라는 틀린 값이 나왔다
         (실제는 8 + 1 = 9블록 · 144KB). 자기모순이라 저장소 대조로는 잡히지 않는다. */
      const fanRaw = v.items && sc.init.op && sc.init.op.kv && sc.init.op.kv['팬아웃'];
      const fan = fanRaw ? parseFloat(String(fanRaw).replace(/[^0-9.]/g, '')) : 0;
      if (fan > 1 && v.items) {
        const cnt = new Map();
        v.items.forEach(x => {
          const m = /×\s*([\d,]+)/.exec(x.id || '');
          cnt.set(x.lvl, (m ? parseInt(m[1].replace(/,/g, ''), 10) : 1));
        });
        const lv = [...cnt.keys()].sort((a2, b2) => a2 - b2);
        /* 레벨을 생략한 그림은 검사 대상이 아니다 — 팬아웃 2 · 높이 20 인 트리를
           세 레벨로 축약해 보여주는 비교 장면이 있다. 선언된 높이와 그린 레벨 수가
           같을 때만, 즉 트리 전체를 그린 경우만 정합성을 따진다. */
        const hRaw = sc.init.op.kv['트리 높이'];
        const h = hRaw ? parseFloat(String(hRaw).replace(/[^0-9.]/g, '')) : 0;
        const whole = h > 0 && lv.length === h;
        for (let i2 = 0; whole && i2 + 1 < lv.length; i2++) {
          const up = cnt.get(lv[i2]), dn = cnt.get(lv[i2 + 1]);
          if (up * fan < dn)
            err(T + ' ' + k + ' 레벨 ' + lv[i2] + ' 이 ' + up + '개인데 아래 레벨 ' + dn +
                '개를 팬아웃 ' + fan + ' 으로 덮을 수 없다 (필요 ' + Math.ceil(dn / fan) + '개)');
          else if (up > 1 && up > Math.ceil(dn / fan) * 8)
            err(T + ' ' + k + ' 레벨 ' + lv[i2] + ' 이 ' + up + '개인데 ' +
                Math.ceil(dn / fan) + '개면 충분하다 — 예시가 자기모순이다');
          else if (up > 1 && up > Math.ceil(dn / fan) * 2)
            wrn(T + ' ' + k + ' 레벨 ' + lv[i2] + ' 이 ' + up + '개 — ' +
                Math.ceil(dn / fan) + '개면 충분하다');
        }
      }
    }
  }

  /* 연산을 재생하며 검사한다 — 없는 항목을 지우거나 고치려는 시도를 잡는다 */
  let st = JSON.parse(JSON.stringify(sc.init));
  sc.steps.forEach((step, i) => {
    const S = T + '.' + String(i + 1).padStart(2, '0');
    if (!step.note) err(S + ' note 없음');
    if (!step.why)  wrn(S + ' why 없음');
    if (!step.key)  wrn(S + ' key 없음');
    if (step.note && step.why && overlap(step.note, step.why) >= .62)
      wrn(S + ' note 와 why 가 ' + Math.round(overlap(step.note, step.why) * 100) + '% 겹친다');
    if (step.ref && !step.sym) wrn(S + ' ref 는 있는데 sym 이 없다');
    if (step.ref && step.sym && !LINES[step.ref + '#' + step.sym])
      err(S + ' 심볼을 저장소에서 못 찾았다 : ' + step.ref + ' # ' + step.sym);

    /* 근거 없는 주장을 눈에 보이게 한다.
       락 덱을 전수조사했더니 58스텝 중 13곳이 틀렸는데, 틀린 곳은 거의 다 fact 가
       없는 스텝이었다. 원인은 "검증이 선택 사항" 이었다는 것 — 생각난 곳에만 붙였다.
       기계는 어떤 산문이 검증 가능한지 판단할 수 없지만, *식별자를 인용한 산문*은
       가려낼 수 있다. 그것을 경고로 남겨 구멍이 보이게 한다. */
    /* 산문이 가리키는 장면 번호가 이 덱에 실제로 있는가.
       "08 장면의 wait-for 그래프" 라고 썼는데 그 덱의 wait-for 는 09 장면이었다 —
       사람이 읽어야 찾는 오류가 아니라 기계가 잡는 종류다. links 는 이미 검사하는데
       산문 속 참조는 검사하지 않고 있었다. */
    {
      const txt = (step.note || '') + ' ' + (step.why || '') + ' ' + (step.key || '');
      const seen = new Set();
      let m;
      const re = /(\d{2})\s*장면/g;
      while ((m = re.exec(txt))) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        if (!nums.has(m[1]) && !SCENES.some(x => x.num === m[1]))
          err(S + ' 산문이 없는 장면을 가리킨다 : ' + m[1] + ' 장면');
      }
    }

    if (!(step.fact || []).length) {
      const txt = (step.note || '') + ' ' + (step.why || '') + ' ' + (step.key || '');
      const re2 = /\b(LOCK_[A-Z_]+|MDL_[A-Z_]+|TL_[A-Z_]+|lock_[a-z0-9_]{4,}|row_[a-z0-9_]{4,}|btr_[a-z0-9_]{4,}|buf_[a-z0-9_]{4,}|trx_[a-z0-9_]{4,}|page_[a-z0-9_]{4,})/g;
      let mm, hit = null;
      while ((mm = re2.exec(txt))) {
        const id = mm[1];
        /* 이미 다른 검사가 대조하는 이름은 근거 없는 주장이 아니다 :
           P_S · I_S 테이블 이름은 tablemap 이, innodb_* 변수는 knobmap 이 본다.
           이것을 안 걸러서 22건 중 6건이 거짓 경고였다. */
        if (typeof TABLES === 'object' && TABLES[id.toUpperCase()]) continue;
        if (/^(DATA_LOCKS|DATA_LOCK_WAITS|METADATA_LOCKS|data_locks|data_lock_waits|metadata_locks)$/.test(id)) continue;
        if (/^LOCK_(STATUS|TYPE|MODE|DATA)$/.test(id)) continue;   /* P_S 컬럼 이름이다 */
        hit = id; break;
      }
      if (hit) wrn(S + ' 식별자(' + hit + ')를 인용하는데 fact 가 없다 — 근거 없는 주장이다');
    }

    /* 산문의 구조적 주장 ↔ 저장소 문자열 */
    if (step.fact) {
      /* 문자열이면 그 스텝의 ref 파일에서 찾는다. [파일, 문자열] 이면 그 파일에서 찾는다 —
         상수 정의가 ref 와 다른 헤더에 있는 경우가 흔하다. */
      step.fact.forEach(f => {
        const rel = Array.isArray(f) ? f[0] : step.ref;
        const q   = Array.isArray(f) ? f[1] : f;
        if (!rel) { err(S + ' fact 에 파일이 없다 — ref 도 없고 [파일, 문자열] 도 아니다'); return; }
        const src = srcOf(rel);
        if (src == null) { err(S + ' fact 의 파일을 못 읽었다 : ' + rel); return; }
        if (!src.includes(q.replace(/\s+/g, ' ')))
          err(S + ' fact 가 저장소에 없다 — ' + rel + ' 에 "' + q.slice(0, 64) + '"');
      });
    }

    if (step.act) {
      ['f','t'].forEach(d => {
        if (!ACTORS[step.act[d]]) err(S + ' act.' + d + ' 가 배우가 아니다 : ' + step.act[d]);
        else if (!sc.cast.includes(step.act[d]))
          err(S + ' act.' + d + ' 가 이 장면 cast 에 없다 : ' + step.act[d]);
      });
      if (!step.act.lb) err(S + ' act 에 라벨(lb)이 없다');
    }
    /* matrix 연산 : 없는 셀을 지목하면 조용히 아무 일도 안 일어난다.
       그리고 *알아먹을 수 없는 연산*도 조용히 무시된다 — 실제로 op 를 mx:{on:…} 로
       중첩해 썼다가 15곳이 전부 먹통이 됐는데 검증은 통과했다. 그래서 둘 다 잡는다. */
    const MXOPS = ['on', 'dim', 'mlb', 'clear'];
    for (const [who, op] of Object.entries(step.ops || {})) {
      const mx = (st[who] || {}).mx;
      if (!mx) {
        if (MXOPS.some(f => op[f] !== undefined))
          err(S + ' ' + who + ' 에 mx 가 없는데 행렬 연산을 한다');
        continue;
      }
      const used = Object.keys(op);
      if (!used.some(f => MXOPS.includes(f)))
        err(S + ' ' + who + ' 는 matrix 인데 알아먹을 수 있는 연산이 없다 : ' +
            used.join(',') + '  (쓸 수 있는 것 : ' + MXOPS.join(' · ') + ')');
      const valid = new Set();
      mx.rows.forEach(r => mx.cols.forEach(c2 => valid.add(r + '/' + c2)));
      ['on', 'dim'].forEach(f => (op[f] || []).forEach(key => {
        if (!valid.has(key)) err(S + ' ' + who + ' ' + f + ' 가 없는 셀을 지목한다 : ' + key);
      }));
    }
    if (step.hot && !EDGES.some(e => e.hot === step.hot)) err(S + ' hot 이 경계와 안 맞다 : ' + step.hot);
    if (step.act && step.act.hot && !EDGES.some(e => e.hot === step.act.hot))
      err(S + ' act.hot 이 경계와 안 맞다 : ' + step.act.hot);

    let moved = 0;
    for (const [who, op] of Object.entries(step.ops || {})) {
      if (!ACTORS[who]) { err(S + ' ops 에 없는 배우 : ' + who); continue; }
      if (!sc.cast.includes(who)) { err(S + ' ops 가 cast 밖의 배우를 건드린다 : ' + who); continue; }
      const a = st[who], kind = ACTORS[who].kind;

      if (op.set && kind === 'kv') {
        for (const k of Object.keys(op.set)) {
          if (!(k in a.kv)) err(S + ' ' + who + ' : init 에 없는 키를 set 한다 — ' + k);
          const cls = String(op.set[k]).split('|')[1];
          if (cls && !['gold','red','green'].includes(cls))
            err(S + ' ' + who + '.' + k + ' 색 이름이 없다 : ' + cls);
          if (String(a.kv[k]) === String(op.set[k]))
            wrn(S + ' ' + who + '.' + k + ' 를 같은 값으로 set 한다 (변화 없음)');
          a.kv[k] = op.set[k]; moved++;
        }
      } else if (op.set && kind !== 'kv') {
        for (const [id, patch] of Object.entries(op.set)) {
          const it = a.items.find(x => x.id === id);
          if (!it) err(S + ' ' + who + ' : 없는 항목을 set 한다 — ' + id);
          else { Object.assign(it, patch); moved++; }
        }
      }
      if (op.del) op.del.forEach(id => {
        const j = a.items ? a.items.findIndex(x => x.id === id) : -1;
        if (j < 0) err(S + ' ' + who + ' : 없는 항목을 del 한다 — ' + id);
        else { a.items.splice(j, 1); moved++; }
      });
      if (op.add) op.add.forEach(it => {
        if (!it.id) err(S + ' ' + who + ' : add 항목에 id 가 없다');
        else if (a.items.some(x => x.id === it.id))
          err(S + ' ' + who + ' : 이미 있는 id 를 add 한다 — ' + it.id);
        else if (it.tag !== undefined &&
                 !(kind === 'bytes' ? BYTAGS : TAGS).includes(it.tag))
          err(S + ' ' + who + ' : ' + kind + ' 에 없는 태그 — ' + it.tag);
        else { a.items.push(JSON.parse(JSON.stringify(it))); moved++; }
      });
      if (op.move) op.move.forEach(([id, to]) => {
        const j = a.items.findIndex(x => x.id === id);
        if (j < 0) err(S + ' ' + who + ' : 없는 항목을 move 한다 — ' + id);
        else if (to < 0 || to >= a.items.length)
          err(S + ' ' + who + ' : move 위치가 범위를 벗어난다 — ' + to);
        else { const [x] = a.items.splice(j, 1); a.items.splice(to, 0, x); moved++; }
      });
      /* axis 의 잠금 구간 · graph 의 간선도 재생해서 검사한다 */
      for (const [collKey, bag, need] of [['span','spans','axis'], ['edge','edges','graph']]) {
        if (!op[collKey]) continue;
        if (kind !== need) { err(S + ' ' + who + ' : ' + collKey + ' 연산은 ' + need + ' 배우만 쓴다'); continue; }
        a[bag] = a[bag] || [];
        const o = op[collKey];
        if (o.del) o.del.forEach(id => {
          const j = a[bag].findIndex(x => x.id === id);
          if (j < 0) err(S + ' ' + who + ' : 없는 ' + collKey + ' 를 del 한다 — ' + id);
          else { a[bag].splice(j, 1); moved++; }
        });
        if (o.set) for (const [id, patch] of Object.entries(o.set)) {
          const it = a[bag].find(x => x.id === id);
          if (!it) err(S + ' ' + who + ' : 없는 ' + collKey + ' 를 set 한다 — ' + id);
          else { Object.assign(it, patch); moved++; }
        }
        if (o.add) o.add.forEach(x => {
          if (!x.id) { err(S + ' ' + who + ' : ' + collKey + ' 에 id 가 없다'); return; }
          if (a[bag].some(y => y.id === x.id))
            { err(S + ' ' + who + ' : 이미 있는 ' + collKey + ' id — ' + x.id); return; }
          if (collKey === 'span') {
            if (typeof x.from !== 'number' || typeof x.to !== 'number')
              { err(S + ' ' + who + ' : 구간 ' + x.id + ' 에 from/to 가 없다'); return; }
            if (x.to < x.from) { err(S + ' ' + who + ' : 구간 ' + x.id + ' 의 to < from'); return; }
            const ax = a.axis || {};
            if (x.from < ax.min || x.to > ax.max)
              { err(S + ' ' + who + ' : 구간 ' + x.id + ' 이 축 범위를 벗어난다'); return; }
            if (x.kind && !SPANS.includes(x.kind))
              { err(S + ' ' + who + ' : 없는 잠금 종류 — ' + x.kind); return; }
          }
          if (collKey === 'edge') {
            const ids = (a.items || []).map(y => y.id);
            if (!ids.includes(x.from)) { err(S + ' ' + who + ' : 간선의 from 노드가 없다 — ' + x.from); return; }
            if (!ids.includes(x.to)) { err(S + ' ' + who + ' : 간선의 to 노드가 없다 — ' + x.to); return; }
          }
          a[bag].push(JSON.parse(JSON.stringify(x))); moved++;
        });
      }
      if (op.gg) {
        if (typeof op.gg.v !== 'number' || op.gg.v < 0 || op.gg.v > 1)
          err(S + ' ' + who + ' : 게이지 v 는 0~1 이어야 한다 — ' + op.gg.v);
        a.gg = Object.assign({}, a.gg, op.gg); moved++;
      }
    }
    /* free list 를 무대에 올린 장면이라면, 버퍼풀에 페이지가 생길 때
       반드시 프레임을 하나 써야 한다. 안 그러면 화면이 물리적으로 모순된다
       (FREE LIST 는 0 인데 페이지가 계속 늘어나는 그림). 눈으로 잡은 버그를 규칙으로 남긴다. */
    if (sc.cast.includes('fr') && sc.cast.includes('bp')) {
      const addN = ((step.ops || {}).bp || {}).add || [];
      const useN = ((step.ops || {}).fr || {}).del || [];
      if (addN.length && addN.length !== useN.length)
        err(S + ' 버퍼풀에 ' + addN.length + '개 담는데 free 프레임은 ' +
            useN.length + '개만 쓴다 — 프레임 없이 페이지가 생긴다');
    }

    /* 아무것도 안 바뀌고 토큰도 안 날고 요점도 아니면, 그 스텝은 무대에서 아무 일도 안 한다 */
    /* beat 만으로는 통과시키지 않는다 — 아래 글만 바뀌고 무대는 가만히 있는 스텝이 된다.
       상태를 바꾸지 않는 요점 스텝은 look 으로 무엇을 보라고 가리켜야 한다. */
    if (!moved && !step.act && !step.look)
      err(S + ' 상태 변화도 act 도 look 도 없다 — 무대가 반응하지 않는 스텝');
    for (const who of Object.keys(step.look || {})) {
      if (!ACTORS[who]) { err(S + ' look 에 없는 배우 : ' + who); continue; }
      if (!sc.cast.includes(who)) { err(S + ' look 이 cast 밖을 가리킨다 : ' + who); continue; }
      const v = step.look[who];
      if (v !== true && !Array.isArray(v)) { err(S + ' look.' + who + ' 는 true 나 배열이어야 한다'); continue; }
      /* axis 는 레코드와 잠금 구간, graph 는 노드와 간선 — 컬렉션이 둘 이상이다.
         items 만 보면 구간을 가리키는 look 이 전부 오탐이 된다 */
      if (Array.isArray(v)) {
        const pool = [
          ...((st[who].items  || []).map(x => x.id)),
          ...((st[who].spans  || []).map(x => x.id)),
          ...((st[who].edges  || []).map(x => x.id)),
        ];
        v.forEach(id => {
          if (!pool.includes(id)) err(S + ' look.' + who + ' 가 없는 것을 가리킨다 — ' + id);
        });
      }
    }
  });

  /* 항목 수가 한 배우 안에서 너무 커지면 무대 높이가 무너진다 */
  let peak = {};
  let s2 = JSON.parse(JSON.stringify(sc.init));
  for (const [k, v] of Object.entries(s2))
    peak[k] = v.items ? v.items.length : Object.keys(v.kv || {}).length;
  if (Math.max(...Object.values(peak)) > 8)
    wrn(T + ' 한 배우의 항목이 8개를 넘는다 — 무대가 좁아진다');
}

function overlap(a, b) {
  const t = s => new Set(s.replace(/[^가-힣\w]/g, ' ').split(/\s+/).filter(w => w.length > 1));
  const A = t(a), B = t(b); if (!A.size) return 0;
  let n = 0; A.forEach(w => { if (B.has(w)) n++; });
  return n / A.size;
}

/* ── 원문 검사 : 한 ops 안에 같은 배우 키가 두 번 나오면 뒤가 앞을 조용히 덮는다.
   JS 객체 리터럴의 중복 키는 오류가 아니라 침묵이므로, 파싱된 값으로는 절대 알 수 없다.
   그래서 scenes.js 를 텍스트로 다시 읽는다. (실제로 07.09 에서 이 사고가 났다) ── */
{
  const src = fs.readFileSync(path.join(ROOT, 'data', DECK, 'scenes.js'), 'utf8');
  let at = 0, n = 0;
  while ((at = src.indexOf('ops:{', at)) >= 0) {
    let d = 0, i = at + 4, end = -1;
    for (; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (!d) { end = i; break; } }
    }
    if (end < 0) break;
    const body = src.slice(at + 5, end);
    /* 깊이 1 의 키만 센다 */
    const seen = {}; let dd = 0;
    for (let j = 0; j < body.length; j++) {
      const ch = body[j];
      if (ch === '{' || ch === '[') dd++;
      else if (ch === '}' || ch === ']') dd--;
      else if (dd === 0) {
        const m = /^(\w+)\s*:/.exec(body.slice(j));
        if (m && (j === 0 || /[\s,]/.test(body[j - 1]))) {
          seen[m[1]] = (seen[m[1]] || 0) + 1;
          j += m[0].length - 1;
        }
      }
    }
    for (const [k, cnt] of Object.entries(seen))
      if (cnt > 1) { err('ops 안에 배우 키 "' + k + '" 가 ' + cnt +
        '번 나온다 — 뒤가 앞을 덮어 연산이 조용히 사라진다 (원문 위치 ' + at + ')'); n++; }
    at = end;
  }
}

const steps = SCENES.reduce((n, s) => n + s.steps.length, 0);
console.log('verify: 장면 ' + SCENES.length + ' · 스텝 ' + steps +
  ' · 배우 ' + Object.keys(ACTORS).length + ' · 심볼 ' + Object.keys(LINES).length);
if (W) { console.log('  WARN ' + W); ws.forEach(m => console.log('    ~ ' + m)); }
if (E) { console.log('  ERR  ' + E); es.forEach(m => console.log('    ! ' + m)); process.exit(1); }
console.log('  ✓ 통과 (오류 0)');
