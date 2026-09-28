/* 문항 생성기 — 덱 데이터에서 문제를 만든다. 순수 함수만 두어 브라우저 없이 검증한다.

   설계의 핵심 : **오답을 저작하지 않는다.** 정답이 데이터에 있고, 오답은 *같은 종류의
   다른 항목*에서 가져온다. links 의 오답은 다른 장면의 links 이고, watch 의 오답은
   다른 장면의 watch 다. 그래서 오답이 "그럴듯하지만 틀린" 성질을 자동으로 갖는다 —
   종류가 같으니 형태가 같고, 출처가 다르니 답이 아니다.

   예외가 하나 있다 — 핵심(core). 장면의 요점(beat 스텝)을 묻는 문제는 다른 장면의 문장을
   오답으로 쓰면 주제가 달라 한눈에 걸러진다. 요점 문제의 오답은 "그렇게 믿기 쉬운 틀린
   설명" 이어야 하므로 data/<덱>/quiz.js 에 사람이 쓴다. 정답도 같이 쓴다 — 스텝의 note 를
   그대로 쓰면 오답과 길이·말투가 달라 정답이 드러난다.

   난수를 쓰지 않는다. 문항 순서와 오답 선택이 매번 달라지면
     · 같은 문항을 두 번 만났는지 알 수 없고(복습이 성립하지 않는다)
     · 검증 도구가 "이 문항이 옳은가" 를 되풀이해 물을 수 없다.
   그래서 문항마다 고유 id 를 만들고, 그 id 로 결정적으로 섞는다. */

/* 문자열 해시 — 같은 입력에 항상 같은 수. 섞기와 오답 고르기에 쓴다. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* id 를 씨앗으로 쓰는 결정적 섞기 (Fisher-Yates).
   처음엔 선형 합동 생성기의 값을 % (i+1) 로 썼다 — 2^32 모듈러 LCG 의 하위 비트는 주기가
   짧아서(최하위 2비트는 주기 4) 4지선다 정답이 첫 칸에 36% 몰렸다. "항상 1번" 으로
   36% 를 맞히는 게임이 될 뻔했다. mulberry32 를 쓰고 [0,1) 로 바꿔 상위 비트로 고른다. */
function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, seed) {
  const a = arr.slice();
  const r = rng(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 오답을 뽑는다 — 같은 종류의 풀에서, 정답과 같지 않은 것만, 결정적으로. */
/* key 로 비교한다 — 풀이 객체 배열일 때가 있다. 처음엔 String(c) 로 비교해서
   객체가 전부 "[object Object]" 가 되었고, link·watch 문항이 0개가 나왔다. */
function pick(pool, correct, n, seed, key = (x) => x) {
  const seen = new Set([norm(key(correct))]);
  const out = [];
  for (const c of shuffle(pool, seed)) {
    const k = norm(key(c));
    if (seen.has(k)) continue;
    seen.add(k); out.push(c);
    if (out.length === n) break;
  }
  return out;
}
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
/* key 는 <em> 이 섞인 HTML 이다. 문항은 글자로만 보여 준다(dangerouslySetInnerHTML 을
   게임 화면까지 넓히지 않는다). */
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* stem 에서 선택지 값을 가린다. 결과(key)를 보여 주고 값을 묻는데, key 가 그 값을
   말하는 경우가 14개 중 5개였다 — 그대로("0 은 가장 짧은…"), 대소문자만 다르게
   ("REDUNDANT 레코드는"), 앞부분만("strict 는 거부하지"), 약자로("RC 는 팬텀을").
   정답만 가리면 남은 오답 값으로 소거가 되므로 선택지 전부를 가린다. */
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function mask(text, values) {
  let t = text;
  for (const v of values) {
    const forms = new Set([v]);
    const parts = v.split(/[-_]/).filter(Boolean);
    if (parts.length > 1) {
      if (parts[0].length >= 4) forms.add(parts[0]);                       // strict · READ · DETECT
      forms.add(parts.map((p) => p[0]).join('').toUpperCase());             // RC · RR
    }
    for (const f of [...forms].sort((a, b) => b.length - a.length)) {
      /* 영숫자·밑줄에 붙어 있으면 다른 낱말의 일부다 — 10 안의 0 을 가리지 않는다 */
      const rx = new RegExp('(^|[^A-Za-z0-9_])' + esc(f) + '(?![A-Za-z0-9_])', f.length <= 2 ? 'g' : 'gi');
      t = t.replace(rx, '$1□');
    }
  }
  return t;
}

/* ── 문항 만들기 ───────────────────────────────────────────────────────────
   각 문항은 { id, kind, deck, at, q, opts[], answer, why, ref, sym } 다.
   answer 는 opts 안의 색인이 아니라 값이다 — 섞어도 정답이 따라간다. */

/* 1) 관계 : 이 장면과 이어지는 것은 무엇인가 (links) */
function fromLinks(deck, SCENES, poolLinks) {
  const out = [];
  for (const sc of SCENES) for (const [num, desc] of (sc.links || [])) {
    const id = `link:${deck}/${sc.num}→${num}`;
    const wrong = pick(poolLinks.filter((x) => x.from !== sc.num), { desc }, 3, id, (x) => x.desc)
      .map((x) => x.desc);
    if (wrong.length < 3) continue;
    out.push({ id, kind: 'link', deck, at: `${deck}/${sc.num}/1`,
      q: `「${sc.title}」 장면이 다른 장면과 이어지는 이유로 맞는 것은?`,
      opts: shuffle([desc, ...wrong], id + '#o'), answer: desc,
      /* 상대 장면의 제목을 적는다 — 번호만으로는 무엇과 이어지는지 알 수 없다 */
      why: `${sc.num} 「${sc.title}」 → ${num} 「${(SCENES.find((x) => x.num === num) || {}).title || '?'}」`,
      at2: `${deck}/${num}/1`, scene: sc.num });
  }
  return out;
}

/* 2) 지표 : 이것을 서버에서 어떻게 보는가 (watch) */
function fromWatch(deck, SCENES, poolWatch) {
  const out = [];
  for (const sc of SCENES) for (const [wi, [where, what]] of (sc.watch || []).entries()) {
    if (where === '—' || what === '—') continue;
    /* 설명이 지표 이름을 이미 말하면(pg_visibility_map() 으로 … → pg_visibility) 문서로는
       옳지만 문제로는 정답을 알려 준다. 데이터를 고치지 않고 문항에서만 뺀다. */
    if (what.includes(where)) continue;
    /* 한 장면이 같은 지표를 두 번 적는 것은 정당하다 — SHOW ENGINE INNODB STATUS 의
       다른 절을 보라는 뜻이다. 그래서 id 에 행 번호를 넣는다. 이름만으로는 겹친다. */
    const id = `watch:${deck}/${sc.num}#${wi}`;
    const wrong = pick(poolWatch.filter((x) => x.from !== sc.num), { where }, 3, id, (x) => x.where)
      .map((x) => x.where);
    if (wrong.length < 3) continue;
    out.push({ id, kind: 'watch', deck, at: `${deck}/${sc.num}/1`,
      q: `「${what}」 — 이것을 보려면 어디를 봐야 하나?`,
      opts: shuffle([where, ...wrong], id + '#o'), answer: where,
      why: `${sc.num} 「${sc.title}」 에서 ${where} 를 본다.`, scene: sc.num });
  }
  return out;
}

/* 3) 상수 : 소스에 박힌 값 (fact 의 NAME = 값 꼴) */
function fromFacts(deck, SCENES) {
  const out = [], seen = new Set();
  const rx = /\b([A-Z][A-Z0-9_]{3,})\s*=\s*([0-9][0-9A-Fa-fxX,]*)/;
  for (const sc of SCENES) for (const [i, st] of (sc.steps || []).entries())
    for (const f of (st.fact || [])) {
      const line = Array.isArray(f) ? f[1] : f;
      const m = rx.exec(String(line));
      if (!m) continue;
      const [, name, val] = m;
      if (seen.has(name)) continue;
      seen.add(name);
      const id = `fact:${deck}/${name}`;
      /* 오답은 같은 값의 자릿수를 바꾼 것이 아니라 *다른 상수의 실제 값* 이다 —
         그래야 "그럴듯한 다른 상수" 가 되고, 자릿수 눈대중으로 맞힐 수 없다. */
      out.push({ id, kind: 'fact', deck, at: `${deck}/${sc.num}/${i + 1}`,
        q: `${name} 의 값은?`, _val: val, answer: val, opts: null,
        why: st.why || '', ref: st.ref, sym: st.sym, scene: sc.num });
    }
  /* 값 풀이 다 모인 뒤에 선택지를 만든다 */
  const vals = out.map((o) => o._val);
  for (const o of out) {
    const wrong = pick(vals, o._val, 3, o.id);
    if (wrong.length < 3) { o.opts = null; continue; }
    o.opts = shuffle([o._val, ...wrong], o.id + '#o');
    delete o._val;
  }
  return out.filter((o) => o.opts);
}

/* 4) 순서 : 이 장면의 스텝을 순서대로 (steps) — 오답이 필요 없다 */
function fromOrder(deck, SCENES) {
  const out = [];
  for (const sc of SCENES) {
    const notes = (sc.steps || []).map((s) => s.note).filter(Boolean);
    if (notes.length < 4) continue;
    /* 너무 길면 앞 다섯 개만 — 휴대폰에서 다섯 줄이 한 화면에 들어간다 */
    const use = notes.slice(0, 5);
    const id = `order:${deck}/${sc.num}`;
    /* 결정적 섞기는 항등 순열을 낼 수 있다 — 그러면 이미 정답이 보인다.
       씨앗을 바꿔 다르게 나올 때까지 돌린다(다섯 개면 금방 나온다). */
    let mixed = use, t = 0;
    while (JSON.stringify(mixed) === JSON.stringify(use) && t < 8) mixed = shuffle(use, id + '#o' + t++);
    out.push({ id, kind: 'order', deck, at: `${deck}/${sc.num}/1`,
      q: `「${sc.title}」 — 다음 ${use.length} 단계를 순서대로 놓으면?`,
      opts: mixed, answer: use, scene: sc.num,
      why: sc.sub || '' });
  }
  return out;
}

/* 5) 손잡이 : 이 설정을 이 값으로 두면 무엇이 달라지나 (vary) */
function fromVary(deck, SCENES) {
  const out = [];
  for (const sc of SCENES) {
    if (!sc.vary) continue;
    const { knob, base, alt } = sc.vary;
    for (const v of Object.keys(alt)) {
      const steps = alt[v];
      const first = steps[Object.keys(steps)[0]];
      if (!first || !first.key) continue;
      const id = `vary:${deck}/${sc.num}/${v}`;
      const others = Object.keys(alt).filter((x) => x !== v).concat([base]);
      if (others.length < 1) continue;
      /* 처음엔 "knob 를 v 로 두면?" 이라고 묻고 정답이 v 였다 — 질문이 답을 말한다.
         방향을 뒤집는다 : 그 값에서 일어나는 일(key)을 보여 주고, 어느 값인지 묻는다.
         기본값도 선택지에 넣는다 — "아무것도 안 바꿨다" 는 답이 있어야 헷갈린다. */
      out.push({ id, kind: 'vary', deck, at: `${deck}/${sc.num}/${Object.keys(steps)[0]}/v${v}`,
        q: `「${sc.title}」 — 이렇게 되는 ${knob} 값은?`,
        stem: mask(plain(first.key), [v, ...others]),
        opts: shuffle([v, ...others], id + '#o'), answer: v,
        why: plain(first.why || ''), scene: sc.num, knob });
    }
  }
  return out;
}

/* 6) 핵심 : beat 스텝의 요점 (저작한 오답) — CORE['장면/스텝'] = { q, a, x:[오답 3], stem? } */
function fromCore(deck, SCENES, CORE) {
  const out = [];
  for (const [addr, c] of Object.entries(CORE || {})) {
    const [num, n] = addr.split('/');
    const sc = SCENES.find((x) => x.num === num);
    const st = sc && (sc.steps || [])[+n - 1];
    const id = `core:${deck}/${addr}`;
    out.push({ id, kind: 'core', deck, at: `${deck}/${num}/${n}`,
      q: `「${sc ? sc.title : '?'}」 — ${c.q}`, stem: c.stem,
      opts: shuffle([c.a, ...(c.x || [])], id + '#o'), answer: c.a,
      /* 해설은 스텝의 key — 그 스텝이 무대에서 말하는 요점이다 */
      why: st ? plain(st.key) : '', ref: st && st.ref, sym: st && st.sym, scene: num,
      _beat: !!(st && st.beat), _x: c.x || [] });
  }
  return out;
}

/* 덱 하나에서 문항을 전부 만든다. CORE 는 덱의 quiz.js — 없으면 핵심 문항이 없다. */
export function buildQuiz(deck, SCENES, CORE) {
  const poolLinks = [];
  const poolWatch = [];
  for (const sc of SCENES) {
    for (const [, desc] of (sc.links || [])) poolLinks.push({ from: sc.num, desc });
    for (const [where] of (sc.watch || [])) if (where !== '—') poolWatch.push({ from: sc.num, where });
  }
  return [
    ...fromLinks(deck, SCENES, poolLinks),
    ...fromWatch(deck, SCENES, poolWatch),
    ...fromFacts(deck, SCENES),
    ...fromOrder(deck, SCENES),
    ...fromVary(deck, SCENES),
    ...fromCore(deck, SCENES, CORE),
  ];
}

export { hash, shuffle };
