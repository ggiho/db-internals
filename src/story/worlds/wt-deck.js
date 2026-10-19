/* mongodb wiredtiger 02 – 13 — 한 세계가 덱의 열두 장면을 그린다(01 은 wt-01.js). 장면이 쓰는 배우만, 그 데이터의 모양대로 —
     · 시각 축(TIME) — 시각이 둘 이상인 장면. 같은 눈금의 줄(lane)이 위에서 아래로 쌓인다. 왼쪽 여백에 줄 이름, 줄마다 가는 선.
         – 시각 배우(TIMESTAMPS · SECONDARY · CHECKPOINT 의 'checkpoint ts')의 값 = 눈금 위의 표시. 숫자가 없는 값은 줄 이름 아래 글
         – 문서의 버전(UPDATE CHAIN · DISK IMAGE · HISTORY STORE 의 'c = N') = 그 버전이 유효한 [start, stop) 막대.
           start 는 그 항목의 'ts N', stop 은 적힌 'stop ts N' · '[a, b)' 이거나 다음 버전의 start. 커밋 전 update 는 축 오른쪽 '커밋 전' 칸.
           사슬은 01 과 같은 뜻 — 금빛이 커밋 전, 먹색이 커밋됨, head 가 가장 새것을 가리키고 사슬은 새것 → 옛것으로 잇는다
         – 'ts N' 이 id 인 목록(OPLOG · JOURNAL) = 그 시각의 칸. JOURNAL 의 '까지' 는 축 왼쪽부터 그 시각까지의 띠
         – 읽기(READS 의 항목 · 'read_timestamp' · 'read ts') = 그 시각의 세로선. 선이 지나는 버전이 그 읽기가 보는 값(초록)이다
         – 축의 범위는 장면 전체 값의 [최소, 최대] — 어느 스텝의 값이 그 15 % 안에 몰리면 그 스텝의 범위(13 의 460 이 100 · 101 을 뭉개지 않게)
     · SNAPSHOT(snap_min 이 있을 때) = 트랜잭션 id 수직선. snap_min 아래는 보이고, snap_max 이상은 안 보이고, 사이는 동시 목록에 없을 때만
     · CACHE(사용 % 가 있을 때) = 캐시 한 칸. 사용 · dirty 의 채움과 fact 에 적힌 문턱(eviction_target · trigger · dirty_*), eviction 스레드
     · B-TREE(tree) = 층마다 page, 잎은 채움(fill) 막대. LOCK MANAGER(+ LOCK MODES · TICKETS) = 자원 층(Global · Database ·
       Collection)마다 허가된 요청과 기다리는 줄, 입장권 칸, 호환표. email_1 INDEX(axis) = 키 공간 위의 키와 범위
     · CHECKPOINT('마지막 checkpoint' 가 't = N s' 일 때) = 초 눈금 위에 찍힌 checkpoint 들과 주기, 그리고 각 checkpoint 가
       가리키는 블록으로 가는 화살표(새 것은 새 블록, 옛 것은 옛 블록 — 복사 후 쓰기). JOURNAL 에 fsync 전(dirty) · 됨(ok)이
       함께 있으면 칸 줄을 log buffer | journal 파일 둘로 나눈다 — 레코드가 그 경계를 건너는 것이 fsync 다
     · 나머지 kv 는 글 블록, 나머지 list 는 01 처럼 칸 줄(항목 하나가 덩어리 하나, 아래에 id · 설명)
     · 셈 맞추기(audit) — 버전의 시각이 사슬을 따라 줄지 않거나, stop 이 다음 버전의 start 와 다르거나, 읽기가 본다는 값이 그 시각의
       버전과 다르거나, oldest ≤ stable ≤ all_durable 같은 순서가 깨지거나, oldest 가 stable − 창이 아니거나, 캐시 크기가 식과 다르거나,
       eviction 상태가 문턱과 맞지 않거나, 잎의 키가 정렬되지 않았거나, 허가된 lock 끼리 호환되지 않거나, ticket 이 한도를 넘으면 console.error
   다 안 들어가면 두 열로, 그래도 모자라면 촘촘하게(줄 간격 · 판 사이 · 칸 높이) 다시 짠다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
/* RH 는 이름표 한 줄 — 높이가 모자라면 build 가 촘촘하게(DN) 바꾼다 */
let RH = 15, DN = false;
const HD = 17;
const SUF = /\|(gold|red|green)$/;
const bare = (v) => String(v ?? '').replace(SUF, '');
const tone = (v) => (SUF.exec(String(v ?? '')) || [])[1] || '';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TONE = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
/* 숫자와 단위는 한 덩어리 — '300 s' 가 '300 / s' 로 접혔다 */
const unit = (s) => s.replace(/(\d) (s|ms|%|GB|MB|KB)(?=$|[\s·)])/g, '$1\u00a0$2');
const val = (v) => (tone(v) ? `<span class="${TONE[tone(v)]}">${esc(unit(bare(v)))}</span>` : esc(unit(bare(v))));
/* 값의 앞 숫자 — '1300 s' · '96  ·  메모리' · 'ts 100' · '101|gold' · '100 (committed snapshot)'. '—' · 't = 60 s' · 'stable − 300 s' 는 없다 */
const lead = (v) => { const m = /^(?:ts\s+)?(\d[\d,]*(?:\.\d+)?)(?=$|\s|·|\(|→)/.exec(bare(v).trim()); return m ? +m[1].replace(/,/g, '') : null; };
const cOf = (s) => { const m = /\bc = (\d+)/.exec(String(s || '')); return m ? +m[1] : null; };
const tsOf = (s) => { const m = /\bts (\d+)/.exec(String(s || '')); return m ? +m[1] : null; };
const TAGC = { clean: INK, ok: INK, wait: GOLD, dirty: GOLD, hold: ACCENT, x: RED, red: RED, free: FAINT, green: GREEN, gold: GOLD, pin: GOLD };
const RANK = { cli: 0, mem: 1, disk: 2, repl: 3 };
const LEVELS = ['Global', 'Database', 'Collection'];

/* ══════════ 모델 — DOM 없이 bake 상태에서 역할 · 파생 값을 만든다(tools 의 증명 스크립트도 이것을 부른다) ══════════ */
export function model(deck, sc) {
  const A = deck.ACTORS, cast = sc.cast.filter((a) => A[a]);
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null], base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const kind = (a) => A[a].kind;
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      const x = st[a] || {}, k = kind(a);
      if (k === 'kv') s[a] = { ...(x.kv || {}) };
      else if (k === 'matrix') s[a] = x.mx ? { ...x.mx, on: x.mx.on || [], dim: x.mx.dim || [] } : null;
      else if (k === 'axis') s[a] = { axis: x.axis || { min: 0, max: 1 }, items: (x.items || []).map((it) => ({ ...it, id: String(it.id) })), spans: (x.spans || []).map((sp) => ({ ...sp })) };
      else s[a] = (x.items || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
    }
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), fr = bake(sc, k), st = stepsOf(sc, k);
    const S0 = read(sc.init), S = fr.map((f, i) => read(f.st, st[i], f.chg, f.touch));
    S0.prev = null; S.forEach((s, i) => { s.prev = i ? S[i - 1] : S0; s.at = i + 1; s.vkey = k; });
    S0.at = 0; S0.vkey = k;
    BAKES.set(k, { key: k, S0, S, NK: S.length });
  }
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const any = (f) => all.some(f);
  const kvs = cast.filter((a) => kind(a) === 'kv'), lists = cast.filter((a) => kind(a) === 'list');
  /* ── 역할 — 데이터가 그 모양일 때만 ── */
  const IDSNAP = kvs.find((a) => any((s) => 'snap_min' in s[a])) || null;
  const GAUGE = kvs.find((a) => any((s) => /%/.test(bare(s[a]['사용'] ?? '')))) || null;
  const TICK = kvs.find((a) => any((s) => 'write total' in s[a])) || null;
  const MTX = cast.find((a) => kind(a) === 'matrix') || null;
  const LOCKQ = MTX ? lists.find((a) => any((s) => s[a].some((x) => /\b(Global|Database|Collection)\b[^·]*\b(IS|IX|S|X)\b/.test(x.sub)))) || null : null;
  const TREE = cast.find((a) => kind(a) === 'tree') || null;
  const KEYAX = cast.find((a) => kind(a) === 'axis') || null;
  /* 시각 배우 — 값 전체가 시각인 것(TIMESTAMPS · SECONDARY), 또는 'ts' 키가 숫자를 든 CHECKPOINT */
  const isLane = (a) => ['TIMESTAMPS', 'SECONDARY'].includes(A[a].nm) || (A[a].nm === 'CHECKPOINT' && any((s) => Object.entries(s[a]).some(([k, v]) => /\bts\b/.test(k) && lead(v) != null)));
  const MLANES = kvs.filter((a) => a !== IDSNAP && isLane(a));
  /* 읽기 — READS(@ 가 든 id 의 목록) 가 있으면 그 항목이, 없으면 'read_timestamp' · 'read ts' 가 읽는 시각이다 */
  const RSRC = kvs.find((a) => any((s) => 'read_timestamp' in s[a])) || null;
  const READS = RSRC && RSRC !== IDSNAP ? lists.find((a) => any((s) => s[a].some((x) => /@/.test(x.id)))) || null : null;
  const RLANES = READS ? [] : kvs.filter((a) => any((s) => ('read_timestamp' in s[a] && a === IDSNAP) || 'read ts' in s[a]));
  const HOLD = lists.filter((a) => a !== READS && any((s) => s[a].some((x) => cOf(x.sub) != null)));
  const TPTS = lists.filter((a) => !HOLD.includes(a) && any((s) => s[a].some((x) => /^ts \d/.test(x.id))));
  const knob = (nm) => { const k = (sc.knobs || []).find((x) => x[0] === nm); return k ? lead(k[1]) : null; };
  const WIN = knob('minSnapshotHistoryWindowInSeconds');
  const FACTS = (sc.steps || []).flatMap((st) => (st.fact || []).map((f) => (Array.isArray(f) ? f[1] : f))).join('\n');
  const fnum = (re) => { const m = re.exec(FACTS); return m ? +m[1] : null; };

  /* ── 버전 — c 의 시각은 그 항목에 적힌 'ts N', 없으면 같은 스텝 · 장면의 다른 항목에 적힌 것(03 의 '이미지로 감') ── */
  const isZone = (a, it) => a === 'chain' && (it.tag === 'wait' || it.tag === 'hold' || /커밋 전|prepare/.test(it.sub));
  const own = (it) => tsOf(it.id) ?? tsOf(it.sub);
  const cTs = new Map(), cBad = [];
  for (const s of all) for (const h of HOLD) for (const it of s[h]) {
    const c = cOf(it.sub), t = own(it);
    if (c == null || t == null || isZone(h, it)) continue;
    if (cTs.has(c) && cTs.get(c) !== t) cBad.push([s, h, it.id, c, cTs.get(c), t]); else cTs.set(c, t);
  }
  const versOf = (s) => {
    const out = [];
    for (const h of HOLD) s[h].forEach((it, j) => {
      if (it.tag === 'free') return;
      const c = cOf(it.sub), zone = isZone(h, it);
      let start = zone ? null : own(it);
      if (start == null && !zone && c != null) start = cTs.get(c) ?? null;
      const xm = /\[(\d+),\s*(\d+)\)/.exec(it.sub), sm = /stop (?:ts )?(\d+)/.exec(it.sub);
      out.push({ h, j, id: it.id, tag: it.tag, c, start, zone, xstop: xm ? +xm[2] : sm ? +sm[1] : null });
    });
    const starts = [...new Set(out.filter((v) => v.start != null).map((v) => v.start))].sort((p, q) => p - q);
    for (const v of out) if (v.start != null) { v.next = starts.find((t) => t > v.start) ?? null; v.stop = v.xstop ?? v.next; }
    return out;
  };
  /* 그 시각에 보이는 버전 — start ≤ n 인 커밋된 것 중 가장 새것. n 이 없으면(최신) 가장 새것 */
  const visAt = (vers, n) => { let b = null; for (const v of vers) if (v.start != null && (n == null || v.start <= n) && (!b || v.start > b.start)) b = v; return b; };

  /* ── snapshot(트랜잭션 id) ── */
  const bound = (v) => { const s = bare(v); const m = /(\d+)\s*보다 크다/.exec(s); if (m) return +m[1] + 0.5; return lead(v); };
  const snapOf = (s) => {
    if (!IDSNAP) return null;
    const kv = s[IDSNAP], lo = bound(kv.snap_min), hi = bound(kv.snap_max), lm = /\[([^\]]*)\]/.exec(bare(kv['동시 트랜잭션'] || ''));
    if (lo == null || hi == null) return null;
    return { lo, hi, list: lm ? (lm[1].match(/\d+/g) || []).map(Number) : [] };
  };
  const idVis = (sn, id) => (!sn || id == null ? true : id < sn.lo ? true : id >= sn.hi ? false : !sn.list.includes(id));
  const txnId = (it) => { const m = /^txn (\d+)/.exec(it.id); return m ? +m[1] : null; };
  /* 사슬 걷기(02 · 07) — 앞에서부터, id 판정과 시각 판정을 둘 다 통과한 첫 update. prepare 된 것을 만나면 기다린다 */
  const walk = (s, readTs) => {
    const sn = snapOf(s);
    for (const it of s.chain || []) {
      if (it.tag === 'free' || it.tag === 'x') continue;
      const id = txnId(it), t = own(it) ?? (cOf(it.sub) != null && it.tag !== 'wait' ? cTs.get(cOf(it.sub)) : null);
      if (!idVis(sn, id)) continue;
      if (it.tag === 'hold') return { wait: true, it };
      if (it.tag === 'wait') continue;
      if (readTs != null && t != null && t > readTs) continue;
      return { c: cOf(it.sub), it };
    }
    return null;
  };

  /* ── 읽기의 시각 — READS 의 항목은 그것이 처음 나온 스텝의 read_timestamp 로 읽었다 ── */
  const RTS = new Map();
  if (READS) for (const b of BAKES.values()) {
    const m = new Map();
    for (const s of [b.S0, ...b.S]) {
      for (const it of s[READS]) if (!m.has(it.id) && it.tag !== 'free') {
        const rv = s[RSRC].read_timestamp;
        m.set(it.id, { n: lead(rv), latest: lead(rv) == null && /최신|없음/.test(bare(rv)) });
      }
      RTS.set(s, new Map(m));
    }
  }
  /* ── lock 요청 — sub 를 읽는다. 적지 않은 층은 같은 항목의 앞 스텝 그대로 ── */
  const parseLk = (sub) => {
    const out = new Map();
    let acc = [];
    for (const seg of String(sub || '').split('·').map((x) => x.trim())) {
      acc.push(...(seg.match(/\b(Global|Database|Collection)\b/g) || []));
      if (/없이/.test(seg)) { acc = []; continue; }
      const m = /\b(IS|IX|S|X)\b/.exec(seg.replace(/\b(Global|Database|Collection)\b/g, ''));
      if (m && acc.length) { for (const l of acc) out.set(l, { mode: m[1], st: /pending/.test(seg) ? 'pending' : 'granted' }); acc = []; }
    }
    return out;
  };
  const LKS = new Map();
  if (LOCKQ) for (const b of BAKES.values()) {
    let prev = new Map();
    for (const s of [b.S0, ...b.S]) {
      const cur = new Map();
      for (const it of s[LOCKQ]) { if (it.tag === 'free') continue; const p = parseLk(it.sub), q = new Map(prev.get(it.id) || []); for (const [l, r] of p) q.set(l, r); cur.set(it.id, q); }
      LKS.set(s, cur); prev = cur;
    }
  }

  /* ── 시각 축의 파생 값 — 스텝마다 ── */
  const TSD = new Map();
  for (const s of all) {
    const marks = new Map(), notes = new Map();
    for (const a of MLANES) {
      const ms = [], ns = [];
      for (const [k, v] of Object.entries(s[a])) {
        const ok = A[a].nm !== 'CHECKPOINT' || /\bts\b/.test(k), n = ok ? lead(v) : null;
        if (n != null) ms.push({ k, n, txt: `${k}  ${unit(bare(v))}`, tn: tone(v) }); else ns.push([k, v]);
      }
      marks.set(a, ms); notes.set(a, ns);
    }
    const readers = [];
    for (const a of RLANES) {
      const ms = [], ns = [];
      for (const [k, v] of Object.entries(s[a])) {
        if (k !== 'read_timestamp' && k !== 'read ts') continue;
        const n = lead(v);
        if (n != null) { ms.push({ k, n, txt: `${k}  ${bare(v)}`, tn: tone(v) || '' }); readers.push({ n, a }); } else ns.push([k, v]);
      }
      /* 거절된 요청 — read ts 는 비었고 상태가 SnapshotTooOld, 읽기에 atClusterTime 이 있다 */
      const st = bare(s[a]['상태'] || ''), rq = /atClusterTime (\d+)/.exec(bare(s[a]['읽기'] || ''));
      if (/SnapshotTooOld/.test(st) && rq && !ms.length) { ms.push({ k: 'atClusterTime', n: +rq[1], txt: `atClusterTime ${rq[1]} s  ·  ${st}`, tn: 'red', rej: true }); readers.push({ n: +rq[1], a, rej: true }); }
      marks.set(a, ms); notes.set(a, ns);
    }
    const vers = versOf(s);
    const pts = new Map();
    for (const a of TPTS) pts.set(a, s[a].filter((x) => x.tag !== 'free').map((it) => {
      const ns = (/^ts ([\d\s·]+)/.exec(it.id) || ['', ''])[1].match(/\d+/g) || [];
      return { id: it.id, tag: it.tag, ns: ns.map(Number), upto: /까지/.test(it.id) };
    }));
    const reads = [];
    if (READS) {
      const m = RTS.get(s);
      for (const it of s[READS]) { if (it.tag === 'free') continue; const r = m.get(it.id) || {}; reads.push({ id: it.id, tag: it.tag, n: r.n ?? null, latest: !!r.latest, c: cOf(it.sub) }); }
      const ch = s.chg[READS], cid = ch ? [...(ch.add || []), ...(ch.mod || [])].pop() : null, cr = cid && reads.find((r) => r.id === cid);
      if (cr && cr.tag !== 'x') readers.push({ n: cr.n, latest: cr.latest, a: READS, id: cr.id, wait: cr.tag === 'wait' });
    }
    for (const h of HOLD) for (const it of s[h]) { const m = /ts (\d+) 로 읽/.exec(it.sub); if (m) readers.push({ n: +m[1], a: h, mention: true }); }
    const vals = [];
    for (const ms of marks.values()) for (const m of ms) vals.push(m.n);
    for (const v of vers) { if (v.start != null) vals.push(v.start); if (v.xstop != null) vals.push(v.xstop); }
    for (const ps of pts.values()) for (const p of ps) vals.push(...p.ns);
    for (const r of reads) if (r.n != null) vals.push(r.n);
    for (const r of readers) if (r.n != null) vals.push(r.n);
    /* 이 스텝이 보는 값 — snapshot 이 있으면 사슬 걷기, 아니면 읽는 시각의 버전 */
    let seen = null;
    const rd = readers.find((r) => !r.rej && !r.wait), rsv = RSRC ? s[RSRC].read_timestamp : null;
    /* 'committed snapshot (≤ commit point)' 처럼 시각이 숫자로 적히지 않은 읽기는 무엇을 보는지 정할 수 없다 */
    const unknown = rsv != null && bare(rsv) !== '—' && lead(rsv) == null && !/없음|최신/.test(bare(rsv));
    if (unknown) seen = null;
    else if (IDSNAP && snapOf(s)) { const w = walk(s, rd ? rd.n : null); seen = w ? (w.wait ? { wait: true } : { c: w.c }) : null; }
    else if (rd) { const v = visAt(vers, rd.latest ? null : rd.n); seen = v ? { c: v.c } : null; }
    TSD.set(s, { marks, notes, vers, pts, reads, readers, vals, seen });
  }
  const allVals = [...new Set([...TSD.values()].flatMap((d) => d.vals))].sort((p, q) => p - q);
  const TIME = allVals.length >= 2;
  const zoneAny = TIME && [...TSD.values()].some((d) => d.vers.some((v) => v.zone));
  const LO = allVals[0], HI = allVals[allVals.length - 1];
  const domOf = (s) => {
    const vs = TSD.get(s).vals;
    let lo = LO, hi = HI;
    if (vs.length) { const a = Math.min(...vs), b = Math.max(...vs); if (b > a && b - a < 0.15 * (HI - LO)) { lo = a; hi = b; } }
    if (hi <= lo) { lo -= 1; hi += 1; }
    /* 가장 늦은 값이 가장 새 버전의 start 면 오른쪽을 더 둔다 — 그 버전은 끝이 열린 막대라, 같이 두면 보이지 않았다 */
    const open = TSD.get(s).vers.some((v) => v.start === hi && v.stop == null);
    return [lo - (hi - lo) * 0.08, hi + (hi - lo) * (open ? 0.24 : 0.08)];
  };
  return {
    A, cast, BAKES, all, kind, IDSNAP, GAUGE, TICK, MTX, LOCKQ, TREE, KEYAX, MLANES, RLANES, READS, RSRC, HOLD, TPTS, TIME, zoneAny,
    TSD, domOf, cTs, cBad, versOf, visAt, snapOf, idVis, txnId, walk, LKS, parseLk, WIN, FACTS, fnum, isZone,
  };
}

/* ══════════ 셈 맞추기 — 그리는 데이터끼리 맞아야 하는 것. 어긋나면 report(글) ══════════ */
export function audit(deck, sc, report, M = model(deck, sc)) {
  const { A, BAKES, TSD, HOLD, TPTS, MLANES, IDSNAP, GAUGE, TICK, MTX, LOCKQ, TREE, KEYAX, READS, LKS, WIN, FACTS, fnum } = M;
  const tag = (s) => `wiredtiger ${sc.num} 세계${s.vkey ? ' (' + sc.vary.knob + '=' + s.vkey + ')' : ''} : ${s.at ? s.at + ' 스텝' : 'init'}`;
  for (const [s, h, id, c, t0, t1] of M.cBad) report(`${tag(s)} 의 ${A[h].nm} ${id} — c = ${c} 의 시각이 ${t0} 와 ${t1} 둘이다`);
  const tsv = (s, key) => { for (const a of MLANES) { const v = s[a][key]; if (v != null && lead(v) != null) return lead(v); } return null; };
  for (const b of BAKES.values()) for (const s of [b.S0, ...b.S]) {
    const T = tag(s), d = TSD.get(s), chg = s.chg || {};
    if (M.TIME) {
      /* 사슬 — 커밋 전은 머리에만, 커밋된 것의 시각은 앞에서 뒤로 줄어든다(새것이 앞) */
      if (s.chain && HOLD.includes('chain')) {
        const cv = d.vers.filter((v) => v.h === 'chain');
        let seenC = false, last = Infinity;
        for (const v of cv) {
          if (v.zone) { if (seenC) report(`${T} 의 UPDATE CHAIN — 커밋 전 ${v.id} 가 커밋된 update 뒤에 있다`); continue; }
          seenC = true;
          if (v.start != null) { if (v.start >= last) report(`${T} 의 UPDATE CHAIN — ${v.id} 의 시각 ${v.start} 가 앞 update(${last}) 보다 작지 않다`); last = v.start; }
        }
      }
      /* 적힌 stop 은 다음 버전의 start 와 같다 */
      for (const v of d.vers) if (v.xstop != null && v.next != null && v.xstop !== v.next) report(`${T} 의 ${A[v.h].nm} ${v.id} — stop ${v.xstop} 가 다음 버전의 start ${v.next} 와 다르다`);
      /* 시각의 순서 — README 와 09 의 note 가 적는 것 */
      const g = (k) => tsv(s, k);
      const le = (a, b, ka, kb) => { if (a != null && b != null && a > b) report(`${T} — ${ka} ${a} 가 ${kb} ${b} 보다 크다`); };
      le(g('oldest'), g('stable'), 'oldest', 'stable'); le(g('stable'), g('all_durable'), 'stable', 'all_durable');
      le(g('all_durable'), g('최신 커밋'), 'all_durable', '최신 커밋'); le(g('pinned'), g('oldest'), 'pinned', 'oldest');
      le(g('stable'), g('commit point') ?? g('majority commit point'), 'stable', 'commit point');
      le(g('committed snapshot'), g('commit point'), 'committed snapshot', 'commit point');
      const rc = g('recovery ts'), ck = g('checkpoint ts');
      if (rc != null && ck != null && rc !== ck) report(`${T} — recovery ts ${rc} 가 checkpoint ts ${ck} 와 다르다`);
      if (WIN != null && g('oldest') != null && g('stable') != null && g('oldest') !== g('stable') - WIN) report(`${T} — oldest ${g('oldest')} 가 stable ${g('stable')} − ${WIN} 가 아니다`);
      /* oplog — 시각 순서, '끝' 은 가장 늦은 항목, 잘라 낸 뒤에는 truncate-after 뒤가 없다 */
      for (const a of TPTS) {
        const ns = d.pts.get(a).flatMap((p) => p.ns);
        if (A[a].nm === 'OPLOG') {
          for (let j = 1; j < ns.length; j++) if (ns[j] <= ns[j - 1]) report(`${T} 의 OPLOG — ts ${ns[j]} 가 ${ns[j - 1]} 뒤에 있다`);
          const end = g('oplog 끝');
          if (end != null && ns.length && end !== Math.max(...ns)) report(`${T} — oplog 끝 ${end} 가 OPLOG 의 마지막 ts ${Math.max(...ns)} 와 다르다`);
          const ta = s.prev ? tsv(s.prev, 'truncate-after') : null;
          if (chg[a] && chg[a].del.length && ta != null && ns.some((n) => n > ta)) report(`${T} — 잘라 낸 OPLOG 에 truncate-after ${ta} 뒤의 항목이 남았다`);
        }
      }
      /* secondary — 가져간 것보다 앞서 journal · 적용할 수 없다. 8.0 은 적용 전에 journal, committed snapshot 은 적용한 것까지 */
      for (const a of MLANES.filter((x) => A[x].nm === 'SECONDARY')) {
        const kv = s[a], n = (k) => (kv[k] != null ? lead(kv[k]) : null);
        le(n('journal'), n('가져감'), 'SECONDARY journal', '가져감'); le(n('적용'), n('가져감'), 'SECONDARY 적용', '가져감');
        for (const p of new Set(Object.keys(kv).map((k) => (/^(S\d+) /.exec(k) || [])[1]).filter(Boolean))) {
          le(n(p + ' lastApplied'), n(p + ' journal'), p + ' lastApplied', p + ' journal');
          le(n(p + ' committed snapshot'), n(p + ' lastApplied'), p + ' committed snapshot', p + ' lastApplied');
        }
        /* 과반 커밋 시점은 journal 에 쓴 노드가 있는 곳까지만 — 이 노드(JOURNAL 의 fsync 됨)와 secondary 중 앞선 쪽 */
        const cp = g('majority commit point') ?? g('commit point'), jr = TPTS.find((x) => A[x].nm === 'JOURNAL');
        const pd = jr ? Math.max(-Infinity, ...d.pts.get(jr).filter((p) => p.tag === 'ok').flatMap((p) => p.ns)) : null;
        const sj = n('journal') ?? n('S1 journal');
        if (cp != null && pd != null && sj != null && cp > Math.max(pd, sj)) report(`${T} — majority commit point ${cp} 가 journal 에 쓴 어느 노드보다 앞선다 (이 노드 ${pd} · secondary ${sj})`);
      }
      /* 이미지가 stable 보다 새것이라고 적으면 — 그 두 시각 */
      for (const v of d.vers) { const it = s[v.h][v.j], m = /ts (\d+) > stable (\d+)/.exec(it.sub); if (m && (+m[1] <= +m[2] || (g('stable') != null && g('stable') !== +m[2]))) report(`${T} 의 ${A[v.h].nm} — '${it.sub}' 가 시각과 맞지 않는다`); }
      /* 읽기가 본다는 값 — 판정 · 상태의 'c = N' 과, 사슬 · 버전에 붙은 '이것' · '안 보인다' */
      if (d.seen) {
        for (const [a, kv] of Object.entries(s).filter(([a]) => A[a] && A[a].kind === 'kv')) for (const k of ['판정', '상태']) {
          if (!(k in kv) || !(chg[a] && chg[a].keys.includes(k))) continue;
          const m = /^(?:다시 — )?c = (\d+)/.exec(bare(kv[k]));
          if (m && (d.seen.wait || +m[1] !== d.seen.c)) report(`${T} 의 ${A[a].nm} ${k} 'c = ${m[1]}' 가 이 읽기가 보는 값(${d.seen.wait ? '기다림' : 'c = ' + d.seen.c})과 다르다`);
          if (/기다린다/.test(bare(kv[k])) && !d.seen.wait) report(`${T} 의 ${A[a].nm} ${k} 는 기다린다는데 이 읽기는 c = ${d.seen.c} 를 본다`);
        }
        for (const v of d.vers) {
          const sub = s[v.h][v.j].sub, neg = /안 보|건너뜀/.test(sub), pos = !neg && /이것|찾는다|가 읽는다|보인다/.test(sub);
          if (pos && (d.seen.wait || v.c !== d.seen.c)) report(`${T} 의 ${A[v.h].nm} ${v.id} 는 보인다고 적었는데 이 읽기는 ${d.seen.wait ? '기다린다' : 'c = ' + d.seen.c + ' 를 본다'}`);
          if (neg && !d.seen.wait && v.c === d.seen.c) report(`${T} 의 ${A[v.h].nm} ${v.id} 는 안 보인다고 적었는데 이 읽기가 보는 값이다`);
        }
      }
      /* READS — 그 시각의 버전 · 기다림(committed snapshot 보다 늦은 시각) · 거절(oldest 보다 이른 시각) */
      if (READS) for (const r of d.reads) {
        const it = s[READS].find((x) => x.id === r.id);
        if (r.tag === 'wait') { const cs = g('committed snapshot'); if (cs != null && r.n != null && !(r.n > cs)) report(`${T} 의 READS ${r.id} 는 기다리는데 ${r.n} 가 committed snapshot ${cs} 보다 늦지 않다`); continue; }
        if (/SnapshotTooOld/.test(it.sub)) { const od = g('oldest'); if (od == null || r.n == null || !(r.n < od)) report(`${T} 의 READS ${r.id} 가 거절됐는데 ${r.n} 가 oldest ${od} 보다 이르지 않다`); continue; }
        if (r.c != null) { const v = M.visAt(d.vers, r.latest ? null : r.n); if (!v || v.c !== r.c) report(`${T} 의 READS ${r.id} 'c = ${r.c}' 가 ${r.latest ? '최신' : r.n} 의 버전(${v ? 'c = ' + v.c : '없음'})과 다르다`); }
      }
      for (const r of d.readers) if (r.rej) { const od = g('oldest'); if (od == null || !(r.n < od)) report(`${T} — 거절된 읽기 ${r.n} 가 oldest ${od} 보다 이르지 않다`); }
    }
    /* snapshot — 동시 목록은 [snap_min, snap_max) 안. 07 : '충돌' 이면 사슬 머리가 이 snapshot 에 안 보인다 */
    if (IDSNAP) {
      const sn = M.snapOf(s);
      if (sn) {
        if (sn.lo > sn.hi) report(`${T} — snap_min 이 snap_max 보다 크다`);
        for (const id of sn.list) if (id < sn.lo || id >= sn.hi) report(`${T} — 동시 트랜잭션 ${id} 가 [snap_min, snap_max) 밖이다`);
        for (const [a, kv] of Object.entries(s).filter(([a]) => A[a] && A[a].kind === 'kv')) {
          if (!/충돌/.test(bare(kv['상태'] || '')) || !(chg[a] && chg[a].keys.includes('상태'))) continue;
          const head = (s.chain || []).find((x) => x.tag !== 'free' && x.tag !== 'x');
          if (head && M.idVis(sn, M.txnId(head))) report(`${T} 의 ${A[a].nm} 는 충돌이라는데 사슬 머리 ${head.id} 가 snapshot 에 보인다`);
        }
      }
    }
    /* 캐시 — 크기의 식, 문턱의 순서, eviction 상태 */
    if (GAUGE) {
      const kv = s[GAUGE], sz = /([\d.]+)\s*GB\s*\(([\d.]+)\s*GB/.exec(bare(kv['크기'] || ''));
      if (sz && Math.abs(+sz[1] - Math.max((+sz[2] - 1) * 0.5, 0.25)) > 0.01) report(`${T} — 캐시 ${sz[1]} GB 가 (${sz[2]} − 1) × 0.5 가 아니다`);
      const use = lead(kv['사용']), dirty = lead(kv.dirty), tg = fnum(/eviction_target=(\d+)/), tr = fnum(/eviction_trigger=(\d+)/);
      if (use != null && dirty != null && dirty > use) report(`${T} — dirty ${dirty} % 가 사용 ${use} % 보다 크다`);
      if (chg[GAUGE] && chg[GAUGE].keys.includes('사용') && use != null && tg != null && tr != null) {
        const ev = bare(kv.eviction || ''), want = use > tr ? /애플리케이션/ : use > tg ? /스레드/ : /쉬는/;
        if (!want.test(ev)) report(`${T} — 사용 ${use} % (target ${tg} · trigger ${tr}) 인데 eviction 이 '${ev}' 다`);
      }
    }
    /* B-tree — root 의 칸 순서 = 잎의 순서, 잎의 RecordId 범위는 오름차순, fill 은 적힌 크기와 맞다 */
    if (TREE) {
      const its = s[TREE], root = its.find((x) => (x.lvl ?? 0) === 0), leaves = its.filter((x) => (x.lvl ?? 0) === 1);
      const toks = root ? String(root.keys || '').split('|').map((x) => x.trim()).filter(Boolean) : [];
      if (leaves.length && toks.length === leaves.length) toks.forEach((t, j) => { if (!leaves[j].id.includes(t)) report(`${T} — root 의 ${j + 1} 번째 칸 '${t}' 와 ${j + 1} 번째 잎 '${leaves[j].id}' 가 다르다`); });
      const rv = (x) => (x === 'n' ? 1e15 : x === 'n−1' ? 1e15 - 1 : +x);
      const rng = (k) => { const m = /RecordId (\S+)(?:\s*‥\s*(\S+))?/.exec(String(k || '')); return m ? [rv(m[1]), rv(m[2] || m[1])] : null; };
      for (let j = 1; j < leaves.length; j++) { const p = rng(leaves[j - 1].keys), q = rng(leaves[j].keys); if (p && q && !(q[0] > p[1])) report(`${T} — 잎 ${leaves[j - 1].id} 와 ${leaves[j].id} 의 RecordId 가 오름차순이 아니다`); }
      const cap = M.cast.filter((a) => A[a].kind === 'kv').map((a) => Object.values(s[a]).map(bare).join(' ')).join(' ');
      const mm = /(\d+)MB 의 (\d+) %/.exec(cap);
      /* 같은 id 의 잎 page(다른 배우)가 적는 크기 — 'footprint ≥ X MB' 면 fill 은 X / memory_page_max 이상, '(비었다)' 일 수 없다 */
      const pages = M.cast.filter((a) => A[a].kind === 'list').flatMap((a) => s[a]);
      for (const it of its) {
        const pg = pages.find((x) => x.id === it.id), fp = pg && /footprint ≥ (\d+)\s*MB/.exec(pg.sub);
        if (fp && mm && (it.fill ?? 0) < +fp[1] / +mm[1] - 0.02) report(`${T} — 잎 page ${it.id} 는 footprint ≥ ${fp[1]} MB 인데 트리의 fill 이 ${it.fill ?? 0} 다`);
        if (/비었다/.test(String(it.keys || '')) && ((it.fill ?? 0) > 0 || (pg && /footprint|RecordId \d/.test(pg.sub)))) report(`${T} — 트리의 ${it.id} 는 비었다는데 page 에 레코드가 있다`);
        if (it.fill != null && (it.fill < 0 || it.fill > 1)) report(`${T} — ${it.id} 의 fill ${it.fill} 가 0 ‥ 1 밖이다`);
        const m = /≈ (\d+) MB/.exec(String(it.keys || ''));
        if (m && mm && Math.abs(it.fill - +m[1] / +mm[1]) > 0.02) report(`${T} — ${it.id} 의 fill ${it.fill} 가 ${m[1]} MB / ${mm[1]} MB 와 다르다`);
      }
    }
    /* email_1 — KeyString 을 풀어 이메일과 맞추고, 범위 검색의 결과를 키의 자리와 맞춘다 */
    if (KEYAX) {
      const ax = s[KEYAX], kS = fnum(/kStringLike = (\d+)/), kEm = /kEnd = 0x([0-9a-f]+)/i.exec(FACTS), kE = kEm ? parseInt(kEm[1], 16) : null;
      /* 이메일은 장면 전체의 문장에서 — init 의 사슬 설명이 문장보다 먼저 같은 키를 적는다 */
      const mails = M.all.flatMap((x) => M.cast.filter((a) => A[a].kind === 'kv').flatMap((a) => Object.values(x[a]).map(bare))).join(' ').match(/email:'([^']+)'/g) || [];
      const texts = [...ax.spans.map((sp) => sp.lb), ...(s.chain || []).map((x) => x.sub)];
      for (const t of texts) {
        const m = /((?:[0-9A-F]{2} ){3,}[0-9A-F]{2})/.exec(String(t || ''));
        if (!m) continue;
        const by = m[1].split(' ').map((x) => parseInt(x, 16)), z = by.indexOf(0);
        const str = String.fromCharCode(...by.slice(1, z < 0 ? by.length - 1 : z));
        if (kS == null || kE == null) { report(`${T} — KeyString 을 풀 kStringLike · kEnd 가 장면의 fact 에 없다`); continue; }
        if (by[0] !== kS || by[by.length - 1] !== kE || z < 0 || !mails.some((x) => x.includes(`'${str}'`))) report(`${T} — KeyString ${m[1]} 가 이메일 '${str}' 의 문자열 키(${kS} … 00 ${kE})로 풀리지 않는다`);
      }
      const pv = s.prev ? s.prev[KEYAX].items : [];
      for (const sp of ax.spans) {
        if (sp.from === sp.to) continue;
        const inR = (x) => x.v >= sp.from && x.v <= sp.to;
        if (/없음/.test(sp.lb) && pv.some(inR)) report(`${T} — '${sp.lb}' 인데 범위 [${sp.from}, ${sp.to}] 에 앞 스텝의 키가 있다`);
        const rid = /RID (\d+)/.exec(sp.lb);
        if (rid && !ax.items.some((x) => inR(x) && x.id.endsWith('·' + rid[1]))) report(`${T} — '${sp.lb}' 인데 범위 [${sp.from}, ${sp.to}] 에 RecordId ${rid[1]} 의 키가 없다`);
      }
      for (const a of Object.keys(s).filter((a) => A[a] && A[a].kind === 'list')) for (const it of s[a]) {
        const m = /^2B ([0-9A-F]{2}) 04\s+\(_id:(\d+)\)/.exec(it.id);
        if (m && parseInt(m[1], 16) !== 2 * +m[2]) report(`${T} — _id_ 키 ${it.id} 의 가운데 바이트가 _id × 2 가 아니다`);
      }
    }
    /* lock — 허가된 모드끼리는 호환, 기다리는 요청은 허가된 것이나 앞에서 기다리는 것과 충돌해야 한다. ticket 은 한도 안 */
    if (LOCKQ && MTX && s[MTX]) {
      const mx = s[MTX], ok = (r, c) => { const i = mx.rows.indexOf(r), j = mx.cols.indexOf(c); return i >= 0 && j >= 0 && mx.cells[i][j] === '+'; };
      const reqs = LKS.get(s);
      for (const l of LEVELS) {
        const G = [], P = [];
        for (const [id, m] of reqs) { const r = m.get(l); if (r) (r.st === 'granted' ? G : P).push([id, r.mode]); }
        for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) if (!ok(G[i][1], G[j][1]) || !ok(G[j][1], G[i][1])) report(`${T} — ${l} 에 ${G[i][0]} ${G[i][1]} 와 ${G[j][0]} ${G[j][1]} 가 함께 허가됐다`);
        P.forEach(([id, md], j) => { if ([...G, ...P.slice(0, j)].every(([, m2]) => ok(md, m2))) report(`${T} — ${l} 의 ${id} ${md} 는 허가된 것 · 앞에서 기다리는 것과 모두 호환인데 기다린다`); });
      }
      if (mx.rows.join() === mx.cols.join()) for (let i = 0; i < mx.rows.length; i++) for (let j = i + 1; j < mx.cols.length; j++) if (mx.cells[i][j] !== mx.cells[j][i]) report(`${T} — LOCK MODES 가 대칭이 아니다 (${mx.rows[i]}/${mx.cols[j]})`);
      for (const c of [...mx.on, ...mx.dim]) { const [r, cc] = c.split('/'); if (!mx.rows.includes(r) || !mx.cols.includes(cc)) report(`${T} — LOCK MODES 에 없는 칸 ${c}`); }
    }
    if (TICK) {
      const kv = s[TICK];
      for (const p of ['write', 'read']) { const o = lead(kv[p + ' out']), t = lead(kv[p + ' total']); if (o != null && t != null && o > t) report(`${T} — ${p} ticket out ${o} 가 total ${t} 를 넘었다`); }
    }
    /* checkpoint 주기 — 마지막 checkpoint 가 옮겨 가면 그 간격이 주기다 */
    for (const a of Object.keys(s).filter((a) => A[a] && A[a].nm === 'CHECKPOINT' && A[a].kind === 'kv')) {
      const t1 = /t = (\d+) s/.exec(bare(s[a]['마지막 checkpoint'] || '')), t0 = s.prev && /t = (\d+) s/.exec(bare(s.prev[a]['마지막 checkpoint'] || '')), per = lead(s[a]['주기']);
      if (t1 && t0 && +t1[1] !== +t0[1] && per != null && +t1[1] - +t0[1] !== per) report(`${T} — checkpoint 가 t = ${t0[1]} → ${t1[1]} s 인데 주기는 ${per} s 다`);
    }
  }
}

export default {
  count: (narrow) => (narrow ? 3800 : 5200),
  make,
};

/* ══════════ 세계 ══════════ */
function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene();
  const M = model(deck, sc), { A, cast, BAKES, all, kind } = M;
  audit(deck, sc, (m) => console.error(m), M);
  let cur = BAKES.get(null) || [...BAKES.values()][0];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const gf = innerWidth < 820 ? 0.72 : 1;

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') {
    const el = document.createElement('div');
    el.className = 'wl ' + cls;
    labels.appendChild(el);
    const lb = { el, cls, t: null, o: -1, x: 0, y: 0 };
    made.push(lb);
    return lb;
  }
  function setText(lb, s, html = false) {
    if (lb.t === s) return;
    lb.t = s;
    if (html) lb.el.innerHTML = s; else lb.el.textContent = s;
    lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls));
  }
  function place(lb, x, y, al = 'l', va = 't') {
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%';
    lb.x = x; lb.y = y;
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`;
  }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const wcache = new Map();
  /* 한 줄 이름표의 폭 — 글마다 한 번 잰다(재고 나면 글을 되돌린다) */
  const widthOf = (lb, html) => {
    const key = lb.cls + '|' + html;
    if (wcache.has(key)) return wcache.get(key);
    const keep = lb.el.innerHTML; lb.el.innerHTML = html; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep;
    wcache.set(key, w); return w;
  };

  /* ── 상태 도우미 ── */
  const on = (s, a) => s.touch.has(a);
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  const itHtml = (it) => `<span class="q-i">${esc(it.id)}</span>${it.sub ? '\n' + esc(it.sub) : ''}`;
  const capHtml = (its) => its.map((x) => `<span class="q-i">${esc(x.id)}</span>  ${esc(x.sub || '')}`).join('\n');
  const idsOf = (a) => [...new Set(all.flatMap((s) => (s[a] || []).map((x) => x.id)))];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { n = Math.max(1, Math.round(n * gf)); R[k] = [at, at + n]; at += n; return R[k]; };

  /* ── 판(panel) — 글 블록 · 시각 축 · snapshot · 캐시 · B-tree · lock · 키 공간 · 칸 줄 ── */
  const P = [];
  const consumed = new Set();
  const panels = {};
  const laneOf = (as) => Math.min(...as.map((a) => RANK[A[a].lane] ?? 1));

  /* 글 블록에 남는 kv — 그림이 값을 다 그리는 배우는 뺀다 */
  if (M.IDSNAP) consumed.add(M.IDSNAP);
  if (M.GAUGE) consumed.add(M.GAUGE);
  if (M.TICK && M.LOCKQ) consumed.add(M.TICK);
  if (M.TIME) {
    M.MLANES.forEach((a) => consumed.add(a));
    [...M.HOLD, ...M.TPTS].forEach((a) => consumed.add(a));
    if (M.READS) consumed.add(M.READS);
  }
  /* checkpoint 시계 — '마지막 checkpoint' 가 't = N s' 인 배우(04). 찍은 시각들을 초 눈금 위에, 블록으로 가는 화살표와 */
  const CKPT = cast.find((a) => kind(a) === 'kv' && !consumed.has(a) && all.some((s) => /t = \d+ s/.test(bare(s[a]['마지막 checkpoint'] || '')))) || null;
  if (CKPT) consumed.add(CKPT);
  const TEXTS = cast.filter((a) => kind(a) === 'kv' && !consumed.has(a));
  const ROWS = cast.filter((a) => (kind(a) === 'list') && !consumed.has(a) && a !== M.LOCKQ);

  /* ═════ 글 블록 ═════ */
  if (TEXTS.length) {
    const hd = Object.fromEntries(TEXTS.map((a) => [a, label('aq')])), bd = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
    panels.text = {
      id: 'text', rank: 1, actors: TEXTS,
      tx(s, t) { for (const a of TEXTS) { t.set(hd[a], [A[a].nm, on(s, a)]); t.set(bd[a], [kvHtml(s[a]), on(s, a), '', true, true]); } },
      geo(w) {
        let tn = Math.min(3, TEXTS.length);
        while (tn > 1 && (w - (tn - 1) * 18) / tn < 150) tn--;
        const cw = (w - (tn - 1) * 18) / tn;
        for (const a of TEXTS) wrap(bd[a], cw);
        const hs = TEXTS.map((a) => most(bd[a]).h), rows = Math.ceil(TEXTS.length / tn), rh = [];
        TEXTS.forEach((a, i) => { const r = Math.floor(i / tn); rh[r] = Math.max(rh[r] || 0, hs[i]); });
        const pos = {}; let y = 0;
        for (let r = 0; r < rows; r++) { TEXTS.slice(r * tn, r * tn + tn).forEach((a, j) => { pos[a] = { x: j * (cw + 18), y }; }); y += HD + rh[r] + (r < rows - 1 ? (DN ? 6 : 12) : 0); }
        return { h: y, pos, cw };
      },
      lay(g, ox, oy) { for (const a of TEXTS) { place(hd[a], ox + g.pos[a].x, oy + g.pos[a].y); place(bd[a], ox + g.pos[a].x, oy + g.pos[a].y + HD); } },
      anchor(a) { const g = this.g; if (!g || !g.pos[a]) return null; return [this.ox + g.pos[a].x + Math.min(g.cw, 90), this.oy + g.pos[a].y + 7]; },
    };
    P.push(panels.text);
  }

  /* ═════ snapshot — 트랜잭션 id 수직선 ═════ */
  if (M.IDSNAP) {
    const a = M.IDSNAP, hd = label('aq'), note = label('aq ml aq-b');
    const keys = ['snap_min', 'snap_max', '동시 트랜잭션'];
    const mk = Object.fromEntries(keys.map((k) => [k, label('aq')]));
    const CH = M.HOLD.includes('chain') || cast.includes('chain') ? 'chain' : null;
    const tids = CH ? idsOf(CH).filter((id) => /^txn \d/.test(id)) : [];
    const tLb = Object.fromEntries(tids.map((id) => [id, label('aq')]));
    const nums = all.flatMap((s) => { const sn = M.snapOf(s); return sn ? [sn.lo, sn.hi, ...sn.list] : []; }).concat(tids.map((id) => +id.slice(4)));
    const lo = Math.min(...nums) - 1.5, hi = Math.max(...nums) + 1.5;
    tids.forEach((id) => take('sn:' + id, 16));
    take('sn:zone', 200);
    keys.forEach((k) => take('sn:k:' + k, 10));
    const entry = (s, k) => s[a][k];
    panels.snap = {
      id: 'snap', rank: 1, actors: [a],
      tx(s, t) {
        const sn = M.snapOf(s);
        t.set(hd, [A[a].nm + '  ·  트랜잭션 id', on(s, a)]);
        const rest = Object.entries(s[a]).filter(([k, v]) => !keys.includes(k) || !sn).filter(([k]) => k !== 'read_timestamp' || !M.TIME);
        t.set(note, [rest.map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n'), on(s, a), '', rest.length > 0, true]);
        for (const k of keys) t.set(mk[k], [sn ? `${k}  ${bare(entry(s, k))}` : '', on(s, a) && modOf(s, a).has(k), k === '동시 트랜잭션' ? 'red' : '', !!sn]);
        for (const id of tids) {
          const it = (s[CH] || []).find((x) => x.id === id), vis = M.idVis(sn, +id.slice(4));
          t.set(tLb[id], [it ? id : '', on(s, a) || on(s, CH), !it ? '' : it.tag === 'wait' || it.tag === 'hold' ? 'gold' : sn ? (vis ? 'green' : 'red') : '', !!it]);
        }
      },
      geo(w) {
        wrap(note, w);
        const nh = most(note).h, X = (n) => 10 + ((n - lo) / (hi - lo)) * (w - 20);
        const per = new Map();
        let rows = 1;
        for (const s of all) {
          const sn = M.snapOf(s), T = TXS.get(s);
          const it = sn ? keys.map((k) => ({ k, cx: X(k === '동시 트랜잭션' ? (sn.list[0] ?? (sn.lo + sn.hi) / 2) : k === 'snap_min' ? sn.lo : sn.hi), w: widthOf(mk[k], T.get(mk[k])[0]) })) : [];
          const st = stagger(it, 0, w);
          rows = Math.max(rows, st.rows);
          const tl = stagger(tids.filter((id) => (s[CH] || []).some((x) => x.id === id)).map((id) => ({ id, cx: X(+id.slice(4)), w: widthOf(tLb[id], id) })), 0, w);
          per.set(s, { st: st.out, tl: tl.out, tr: tl.rows });
        }
        const tr = Math.max(1, ...[...per.values()].map((p) => p.tr));
        const yL = HD + (nh > 1 ? nh + 4 : 0) + rows * RH + 6;
        return { h: yL + 10 + 12 + tr * RH, X, per, yL, nh };
      },
      lay(g, ox, oy) { place(hd, ox, oy); place(note, ox, oy + HD); },
      place(s) {
        const g = this.g, p = g.per.get(s);
        for (const q of p.st) place(mk[q.k], this.ox + q.l, this.oy + g.yL - 6 - q.row * RH, 'l', 'b');
        for (const q of p.tl) place(tLb[q.id], this.ox + q.l, this.oy + g.yL + 14 + q.row * RH);
      },
      pose(c) {
        const g = this.g, { s, prev } = c, sn = M.snapOf(s), X = (n) => this.ox + g.X(n), y = this.oy + g.yL;
        const [z0, z1] = R['sn:zone'], zn = z1 - z0, wl = on(s, a) && !c.end;
        for (let m = 0; m < zn; m++) {
          const i = z0 + m, u = (m + 0.5) / zn;
          if (!sn) { c.hide1(i); continue; }
          const x = this.ox + 10 + u * (g.X(hi) - 10), n = lo + u * (hi - lo), vis = M.idVis(sn, Math.floor(n + 0.5)) && n < sn.hi;
          c.put(i, x, y + ((m % 3) - 1) * 2.2, (wl ? 0.62 : 0.38) * c.dim * c.form, 0, 0.02, 1.1, n < sn.lo ? GREEN : n >= sn.hi ? RED : vis ? GREEN : RED);
        }
        for (const k of keys) {
          const [k0, k1] = R['sn:k:' + k];
          const n = sn ? (k === 'snap_min' ? sn.lo : k === 'snap_max' ? sn.hi : sn.list[0]) : null;
          for (let m = 0; m < k1 - k0; m++) { if (n == null) { c.hide1(k0 + m); continue; } c.put(k0 + m, X(n) + (k === '동시 트랜잭션' ? Math.cos(m) * 5 : 0), y - 7 + (m / (k1 - k0)) * 14, (wl ? 0.95 : 0.6) * c.dim * c.form, 0.2, 0.02, 1.2, k === '동시 트랜잭션' ? RED : INK); }
        }
        for (const id of tids) {
          const [t0, t1] = R['sn:' + id], it = (s[CH] || []).find((x) => x.id === id), pv = prev && (prev[CH] || []).find((x) => x.id === id);
          if (!it && !(pv && !c.end)) { c.hideK('sn:' + id); continue; }
          const n = +id.slice(4), vis = M.idVis(sn, n), col = (it || pv).tag === 'wait' || (it || pv).tag === 'hold' ? GOLD : sn ? (vis ? GREEN : RED) : INK;
          for (let m = 0; m < t1 - t0; m++) { const th = m * 2.4, r = 2 + (m % 4); c.put(t0 + m, X(n) + Math.cos(th) * r, y + 8 + Math.sin(th) * r * 0.6, 0.9 * c.dim * c.form * (it ? 1 : 1 - c.gone), 0.3, 0.02, 1.2, col); }
        }
      },
      over(ctx, s, o) { const g = this.g; ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.faint; seg(ctx, this.ox, this.oy + g.yL, this.ox + g.X(hi) + 10, this.oy + g.yL); },
      anchor() { return [this.ox + this.g.X((lo + hi) / 2), this.oy + this.g.yL]; },
    };
    P.push(panels.snap);
  }

  /* ═════ 시각 축 ═════ */
  if (M.TIME) {
    const ZW = M.zoneAny ? 78 : 0;
    /* 줄 — 읽기 · 시각 배우 · 버전 · 시각 칸. 층(cli → mem → disk → repl) 순서, 같은 층에서는 읽기 → 시각 → 읽는 시각 → 버전 → 칸 */
    const lanes = [];
    if (M.READS) lanes.push({ a: M.READS, k: 'rd', r: 0 });
    for (const a of M.MLANES) lanes.push({ a, k: 'mk', r: RANK[A[a].lane] * 10 + 1 });
    for (const a of M.RLANES) lanes.push({ a, k: 'rl', r: RANK[A[a].lane] * 10 + 2 });
    for (const a of M.HOLD) lanes.push({ a, k: 'ver', r: RANK[A[a].lane] * 10 + 3 });
    for (const a of M.TPTS) lanes.push({ a, k: 'pt', r: RANK[A[a].lane] * 10 + 4 });
    lanes.sort((p, q) => p.r - q.r || cast.indexOf(p.a) - cast.indexOf(q.a));
    for (const L of lanes) {
      L.title = label('aq');
      L.note = label('aq ml aq-b');
      L.cap = L.k === 'ver' || L.k === 'pt' ? label('aq ml aq-b') : null;
      if (L.k === 'mk' || L.k === 'rl') {
        L.keys = [...new Set(all.flatMap((s) => M.TSD.get(s).marks.get(L.a).map((m) => m.k)))];
        L.lb = Object.fromEntries(L.keys.map((k) => [k, label('aq')]));
        L.keys.forEach((k) => take(`t:${L.a}:${k}`, 16));
      } else {
        L.ids = idsOf(L.a);
        L.lb = Object.fromEntries(L.ids.map((id) => [id, label('aq')]));
        L.ids.forEach((id) => take(`t:${L.a}:${id}`, L.k === 'ver' ? 220 : L.k === 'rd' ? 22 : 44));
        if (L.k === 'rd') L.rows = Math.max(1, ...all.map((s) => M.TSD.get(s).reads.length));
      }
    }
    const TV = [...new Set(all.flatMap((s) => M.TSD.get(s).vals))].sort((p, q) => p - q);
    const tick = Object.fromEntries(TV.map((v) => [v, label('aq')]));
    const zoneLb = M.zoneAny ? label('aq') : null;
    take('t:rdr', 36);
    /* 층이 바뀌는 곳 — 덱의 EDGES 에 그 두 층의 경계가 있으면 점선과 이름(reconciliation · journal, oplog 복제) */
    const CUTS = [];
    lanes.forEach((L, li) => { if (!li) return; const pl = A[lanes[li - 1].a].lane, cl = A[L.a].lane, e = pl !== cl && (deck.EDGES || []).find((x) => x.after === pl && x.before === cl); if (e) CUTS.push({ li, lb: e.lb, hot: e.hot }); });
    const cutLb = CUTS.map(() => label('aq'));
    panels.time = {
      id: 'time', rank: 1, actors: lanes.map((L) => L.a), lanes,
      tx(s, t) {
        const d = M.TSD.get(s);
        for (const L of lanes) {
          const a = L.a, o = on(s, a);
          t.set(L.title, [A[a].nm, o]);
          if (L.k === 'mk' || L.k === 'rl') {
            const ms = d.marks.get(a), ns = d.notes.get(a);
            for (const k of L.keys) { const m = ms.find((x) => x.k === k); t.set(L.lb[k], [m ? esc(m.txt) : '', o && (modOf(s, a).has(k) || !s.chg[a]), m ? m.tn : '', !!m, true]); }
            /* 숫자가 없는 값 — 줄 이름 아래(한 줄에 하나)이거나 선 아래 한 줄에 이어서. 줄이 덜 높아지는 쪽을 geo 가 고른다 */
            t.set(L.note, [ns.map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join(L.nmode === 'g' ? '\n' : '    /    '), o, '', ns.length > 0, true]);
          } else {
            /* 이름표는 축 위에 자리가 있는 것만 — 시각을 모르는 버전 · 숫자가 없는 칸은 설명 줄에만 */
            const placed = (id) => (L.k === 'ver' ? !/^ts \d+$/.test(id) && d.vers.some((v) => v.h === a && v.id === id && (v.zone || v.start != null))
              : L.k === 'pt' ? false : d.reads.some((r) => r.id === id));
            for (const id of L.ids) {
              const it = s[a].find((x) => x.id === id && x.tag !== 'free');
              const txt = !it ? '' : L.k === 'rd' ? `<span class="q-i">${esc(id)}</span>  ${esc(it.sub)}` : esc(id);
              const sv = L.k === 'ver' && d.seen && !d.seen.wait && d.vers.some((v) => v.h === a && v.id === id && v.c === d.seen.c);
              t.set(L.lb[id], [txt, (o && !!it && hotIt(s, a, id)) || sv, it ? (it.tag === 'x' ? 'red' : sv ? 'green' : it.tag === 'wait' ? 'gold' : '') : '', !!it && placed(id), true]);
            }
            t.set(L.note, ['', false, '', false]);
            if (L.cap) t.set(L.cap, [s[a].length ? capHtml(s[a]) : '—', o, '', true, true]);
          }
        }
        for (const v of TV) t.set(tick[v], [String(v), false, '', d.vals.includes(v)]);
        if (zoneLb) t.set(zoneLb, ['커밋 전', false, '', true]);
        const hot = s.step.hot || (s.step.act && s.step.act.hot);
        CUTS.forEach((cu, j) => t.set(cutLb[j], [cu.lb, !!hot && hot === cu.hot, hot && hot === cu.hot ? 'gold' : '', true]));
      },
      geo(w) {
        const GW = Math.round(Math.min(Math.max(110, w * 0.2), 140, Math.max(78, ...lanes.map((L) => widthOf(L.title, A[L.a].nm) + 12))));
        const ax0 = GW, ax1 = w - (ZW ? ZW + 10 : 0);
        for (const L of lanes) { wrap(L.title, GW - 6); wrap(L.note, w - ax0); if (L.cap) wrap(L.cap, w - ax0); }
        const per = new Map();
        const XS = new Map();
        for (const s of all) { const [lo, hi] = M.domOf(s); XS.set(s, (n) => ax0 + ((n - lo) / (hi - lo)) * (ax1 - ax0)); }
        const zoneX = ax1 + 10 + ZW / 2;
        const rows = lanes.map(() => 1);
        for (const s of all) {
          const d = M.TSD.get(s), X = XS.get(s), T = TXS.get(s), info = { X, L: [] };
          lanes.forEach((L, li) => {
            let items = [];
            if (L.k === 'mk' || L.k === 'rl') {
              const st = pack(d.marks.get(L.a).map((m) => ({ id: m.k, cx: X(m.n), w: widthOf(L.lb[m.k], T.get(L.lb[m.k])[0]) })), ax0 - 4, w);
              rows[li] = Math.max(rows[li], st.rows); info.L[li] = st.out; return;
            }
            if (L.k === 'ver') {
              const zs = d.vers.filter((v) => v.h === L.a && v.zone);
              items = d.vers.filter((v) => v.h === L.a && !/^ts \d+$/.test(v.id)).map((v) => { const ww = widthOf(L.lb[v.id], esc(v.id)); const zi = zs.indexOf(v); const x = v.zone ? zoneX + (zi - (zs.length - 1) / 2) * 14 : v.start != null ? X(v.start) : null; return x == null ? null : { id: v.id, cx: v.zone ? x : x + ww / 2 - 2, w: ww, pins: [x] }; }).filter(Boolean);
            } else if (L.k === 'pt') { info.L[li] = []; rows[li] = 0; return; }   /* 칸의 id 는 'ts N' — 아래 눈금과 설명 줄의 첫머리가 이미 적는다 */
            else if (L.k === 'rd') {
              /* 읽기는 한 줄에 하나 — 점은 그 시각에, 글은 점의 넓은 쪽. 어느 쪽에도 안 들어가면 그 폭으로 접는다(아래 rdW) */
              info.L[li] = d.reads.map((r, j) => { const x = r.latest || r.n == null ? ax1 : X(r.n), nat = widthOf(L.lb[r.id], T.get(L.lb[r.id])[0]); const lb0 = j ? 0 : ax0 - 4, R2 = w - (x + 9), L2 = x - 9 - lb0, right = R2 >= nat ? true : L2 >= nat ? false : R2 >= L2; return { id: r.id, x, row: j, nat, right, room: right ? R2 : L2, lb0 }; });
              return;
            }
            const st = stagger(items, ax0 - 4, w);
            rows[li] = Math.max(rows[li], st.rows);
            info.L[li] = st.out;
          });
          per.set(s, info);
        }
        /* 줄의 높이 — 이름표 줄 · 선 · 설명. 왼쪽 여백(이름 + 글)보다 낮으면 그만큼 */
        let y = 0;
        const ly = [], cuts = [];
        lanes.forEach((L, li) => {
          /* 층이 바뀌는 곳 — 덱의 EDGES 에 그 두 층의 경계가 있으면 점선과 이름 */
          if (CUTS.some((cu) => cu.li === li)) { cuts.push({ y: y + 2 }); y += DN ? 21 : 24; }
          let gh = most(L.title).h, capH = L.cap ? most(L.cap).h : 0;
          if (L.k === 'mk' || L.k === 'rl') {
            const ct = Math.max(rows[li] * RH + 6, 14);
            L.nmode = 'g'; retext(); wrap(L.note, GW - 6); const hG = most(L.note).h;
            L.nmode = 'u'; retext(); wrap(L.note, w - ax0); const hU = most(L.note).h;
            const byG = Math.max(ct + 9, gh + (hG > 1 ? hG + 2 : 0)), byU = ct + (hU > 1 ? 11 + hU : 9);
            if (byG <= byU) { L.nmode = 'g'; retext(); wrap(L.note, GW - 6); gh += hG > 1 ? hG + 2 : 0; } else capH = hU > 1 ? hU : 0;
          }
          const top = y;
          const lg = DN ? 4 : 7;
          if (L.k === 'rd') {
            /* 읽기마다 접는 폭 — 모든 스텝에서 그 읽기가 쓸 수 있는 가장 좁은 쪽. 줄 높이는 그 접힌 높이 */
            const rw = {}, rh = {};
            for (const id of L.ids) { const qs = all.map((s2) => per.get(s2).L[li].find((q) => q.id === id)).filter(Boolean); rw[id] = qs.length ? Math.max(60, Math.min(Math.max(...qs.map((q) => q.nat)) + 1, ...qs.map((q) => q.room))) : 200; wrap(L.lb[id], rw[id]); rh[id] = Math.max(RH, most(L.lb[id]).h); }
            let yy = 0;
            /* 줄 j 의 위치 — 그 줄에 오는 읽기들(스텝마다 같은 j 는 같은 읽기다)의 높이 */
            const byRow = [];
            for (const s2 of all) for (const q of per.get(s2).L[li]) byRow[q.row] = Math.max(byRow[q.row] || 0, rh[q.id]);
            const rows2 = byRow.map((h2) => { const r0 = yy; yy += h2 + 1; return r0; });
            for (const s2 of all) for (const q of per.get(s2).L[li]) { const wd = Math.min(q.nat, rw[q.id]); q.l = q.right ? q.x + 9 : Math.max(q.lb0, q.x - 9 - wd); q.y = rows2[q.row]; q.h = rh[q.id]; }
            ly[li] = { top, yL: top + RH / 2 + 2, h: Math.max(yy + 3, gh) }; y = top + ly[li].h + lg; return;
          }
          const yL = top + Math.max(rows[li] * RH + 6, 14) + (L.k === 'ver' ? 6 : 0);
          const capY = yL + (L.k === 'ver' ? 16 : 11), bot = capH ? capY + capH : yL + 9;
          ly[li] = { top, yL, capY, h: Math.max(bot, top + gh) - top };
          y = top + ly[li].h + lg;
        });
        /* 눈금 숫자 — 맨 아래, 겹치면 줄을 바꾼다 */
        let tr = 1;
        for (const s of all) {
          const info = per.get(s), d = M.TSD.get(s);
          const st = stagger([...new Set(d.vals)].map((v) => ({ id: v, cx: info.X(v), w: widthOf(tick[v], String(v)) })), ax0 - 4, w);
          info.ticks = st.out; tr = Math.max(tr, st.rows);
        }
        const tickY = y + 2;
        return { h: tickY + tr * RH, GW, ax0, ax1, zoneX, per, ly, cuts, tickY };
      },
      lay(g, ox, oy) {
        lanes.forEach((L, li) => { place(L.title, ox, oy + g.ly[li].top); if (L.nmode === 'g') place(L.note, ox, oy + g.ly[li].top + 15); else place(L.note, ox + g.ax0, oy + g.ly[li].capY); if (L.cap) place(L.cap, ox + g.ax0, oy + g.ly[li].capY); });
        if (zoneLb) place(zoneLb, ox + g.zoneX, oy + g.tickY, 'c', 't');
        g.cuts.forEach((cu, j) => place(cutLb[j], ox + g.ax1, oy + cu.y + 4, 'r', 't'));
      },
      place(s) {
        const g = this.g, info = g.per.get(s);
        lanes.forEach((L, li) => {
          if (L.k === 'rd') { for (const q of info.L[li]) place(L.lb[q.id], this.ox + q.l, this.oy + g.ly[li].top + q.y, 'l', 't'); return; }
          for (const q of info.L[li]) place(L.lb[q.id], this.ox + q.l, this.oy + g.ly[li].yL - 7 - q.row * RH - (L.k === 'ver' ? 4 : 0), 'l', 'b');
        });
        for (const q of info.ticks) place(tick[q.id], this.ox + q.l, this.oy + g.tickY + q.row * RH);
      },
      vx(s, v, g) {
        const d = M.TSD.get(s), info = g.per.get(s);
        if (v.zone) { const zs = d.vers.filter((u) => u.h === v.h && u.zone); return g.zoneX + (zs.indexOf(v) - (zs.length - 1) / 2) * 14; }
        return v.start != null ? info.X(v.start) : null;
      },
      pose(c) {
        const g = this.g, { s, prev } = c, d = M.TSD.get(s), dp = prev ? M.TSD.get(prev) : null, info = g.per.get(s), ip = prev ? g.per.get(prev) : null;
        const ox = this.ox, oy = this.oy, end = c.end;
        const seenC = d.seen && !d.seen.wait ? d.seen.c : null;
        lanes.forEach((L, li) => {
          const yL = oy + g.ly[li].yL, lit = on(s, L.a) && !end;
          if (L.k === 'mk' || L.k === 'rl') {
            const ms = d.marks.get(L.a), mp = dp ? dp.marks.get(L.a) : [];
            for (const k of L.keys) {
              const key = `t:${L.a}:${k}`, [r0, r1] = R[key], m = ms.find((x) => x.k === k), q = mp.find((x) => x.k === k);
              if (!m && !(q && !end)) { c.hideK(key); continue; }
              const x1 = m ? ox + info.X(m.n) : ox + ip.X(q.n), x0 = q && ip ? ox + ip.X(q.n) : x1, x = U.lerp(x0, x1, c.mv);
              const col = m && m.tn === 'gold' ? GOLD : m && m.tn === 'green' ? GREEN : m && m.tn === 'red' ? RED : INK, hot = lit && (modOf(s, L.a).has(k) || !s.chg[L.a]);
              for (let j = 0; j < r1 - r0; j++) c.put(r0 + j, x + (j % 2) * 1.6 - 0.8, yL - 4 + (Math.floor(j / 2) / Math.max(1, Math.ceil((r1 - r0) / 2) - 1)) * 11, (hot ? 0.95 : 0.6) * c.dim * c.form * (m ? 1 : 1 - c.gone), hot ? 0.4 : 0, 0.02, 1.3, col);
            }
          } else if (L.k === 'ver') {
            for (const id of L.ids) {
              const key = `t:${L.a}:${id}`, [r0, r1] = R[key], n = r1 - r0;
              const v = d.vers.find((u) => u.h === L.a && u.id === id), pv = dp && dp.vers.find((u) => u.h === L.a && u.id === id);
              const xa = v ? this.vx(s, v, g) : null;
              if (xa == null && !(pv && !end && this.vx(prev, pv, g) != null)) { c.hideK(key); continue; }
              const span = (vv, st, gg) => { const x0 = this.vx(st, vv, gg); if (vv.zone) return [x0 - 22, x0 + 22]; const inf = gg.per.get(st); return [x0, vv.stop != null ? inf.X(vv.stop) - 3 : g.ax1]; };
              const [a1, b1] = v && xa != null ? span(v, s, g) : span(pv, prev, g);
              const [a0, b0] = pv && !end && this.vx(prev, pv, g) != null ? span(pv, prev, g) : [a1, b1];
              const lo = U.lerp(a0, a1, c.mv), hi2 = U.lerp(b0, b1, c.mv), born = v && !pv && !end, from = born && c.act && c.act.t === L.a ? c.src : null;
              const tg = (v || pv).tag, seen = v && seenC != null && v.c === seenC, hot = lit && hotIt(s, L.a, id);
              const col = seen ? GREEN : TAGC[tg] ?? INK, gone = v ? 0 : c.gone;
              /* 긴 막대는 위아래 두 줄(촘촘하게), 짧은 것은 네 줄로 채운다 — 같은 수로 고르게 펴면 긴 막대가 점선이 됐다 */
              const len = Math.max(2, hi2 - lo), rws = len > 160 ? 2 : len > 70 ? 3 : 4, cols = Math.min(Math.floor(n / rws), Math.max(2, Math.round(len / 2.6)));
              for (let m = 0; m < n; m++) {
                const i = r0 + m;
                if (m >= cols * rws) { c.hide1(i); continue; }
                const u = Math.floor(m / rws) / Math.max(1, cols - 1);
                let x = ox + lo + u * len, y = yL - 3.9 + (m % rws) * (7.8 / Math.max(1, rws - 1));
                if (from) { const f = m / n, q = c.show(c.fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q) - Math.sin(q * Math.PI) * 16; }
                if (gone) { x += c.jit(i, 0) * 30 * gone; y += c.jit(i, 1) * 24 * gone; }
                c.put(i, x, y, (hot || seen ? 0.95 : 0.55) * c.dim * c.form * (1 - gone), seen && !end ? 0.5 : hot ? 0.3 : 0, 0.02, 1.15, col);
              }
            }
          } else if (L.k === 'pt' || L.k === 'rd') {
            const list = L.k === 'pt' ? d.pts.get(L.a) : d.reads, lp = dp ? (L.k === 'pt' ? dp.pts.get(L.a) : dp.reads) : [];
            for (const id of L.ids) {
              const key = `t:${L.a}:${id}`, [r0, r1] = R[key], n = r1 - r0, p = list.find((x) => x.id === id), q = lp.find((x) => x.id === id);
              if (!p && !(q && !end)) { c.hideK(key); continue; }
              const pp = p || q, X = p ? info.X : ip.X, gone = p ? 0 : c.gone, hot = lit && hotIt(s, L.a, id);
              const born = p && !q && !end, from = born && c.act && c.act.t === L.a ? c.src : null;
              const col = pp.tag === 'x' ? RED : pp.tag === 'wait' || pp.tag === 'dirty' ? GOLD : pp.tag === 'hold' ? ACCENT : INK;
              const cur2 = L.k === 'rd' && d.readers.some((r) => r.id === id);
              for (let m = 0; m < n; m++) {
                const i = r0 + m;
                let x, y;
                if (L.k === 'rd') { const q = (p ? info : ip).L[li].find((z) => z.id === id), xx = q ? q.x : g.ax1, th = m * 2.399, r = 1.2 + (m % 4) * 1.1; x = ox + xx + Math.cos(th) * r; y = oy + g.ly[li].top + (q ? q.y + 7 : 7) + Math.sin(th) * r; }
                else if (pp.upto) { const u = m / (n - 1); x = ox + g.ax0 + u * (X(pp.ns[pp.ns.length - 1]) - g.ax0); y = yL + (m % 2 ? 2 : -2); }
                else { const k = m % pp.ns.length, j = Math.floor(m / pp.ns.length), per = Math.ceil(n / pp.ns.length), cols = Math.max(2, Math.round(Math.sqrt(per))); x = ox + X(pp.ns[k]) - 4 + (j % cols) * (8 / (cols - 1)); y = yL - 4 + Math.floor(j / cols) * (8 / Math.max(1, Math.ceil(per / cols) - 1)); }
                if (from) { const f = m / n, qq = c.show(c.fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, qq); y = U.lerp(from[1], y, qq) - Math.sin(qq * Math.PI) * 16; }
                if (gone) { x += c.jit(i, 0) * 26 * gone; y += c.jit(i, 1) * 20 * gone; }
                c.put(i, x, y, (hot || cur2 ? 0.95 : 0.55) * c.dim * c.form * (1 - gone), cur2 && !end ? 0.5 : 0, 0.02, 1.2, col);
              }
            }
          }
        });
        /* 읽는 시각 — 버전 줄마다 선 위아래로 짧게(글을 지나지 않게). 긴 선은 overlay 가 그린다 */
        const [q0, q1] = R['t:rdr'];
        const rd0 = d.readers.find((r) => (r.n != null || r.latest) && !r.mention) || d.readers.find((r) => r.n != null), vl = lanes.map((L, i2) => (L.k === 'ver' ? i2 : -1)).filter((x) => x >= 0);
        for (let m = 0; m < q1 - q0; m++) {
          if (!rd0 || !vl.length || end) { c.hide1(q0 + m); continue; }
          const li2 = vl[m % vl.length], j = Math.floor(m / vl.length), nj = Math.ceil((q1 - q0) / vl.length);
          const x = ox + (rd0.latest || rd0.n == null ? g.ax1 : info.X(rd0.n)), yL2 = oy + g.ly[li2].yL;
          c.put(q0 + m, x, yL2 - 8 + (j / Math.max(1, nj - 1)) * 16, 0.5 * c.form, 0, 0.02, 1.1, rd0.rej ? RED : rd0.wait ? GOLD : GREEN);
        }
      },
      over(ctx, s, o) {
        const g = this.g, info = g.per.get(s), d = M.TSD.get(s), ox = this.ox, oy = this.oy;
        ctx.lineWidth = 1;
        lanes.forEach((L, li) => { if (L.k === 'rd') return; ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint; seg(ctx, ox + g.ax0, oy + g.ly[li].yL, ox + g.ax1, oy + g.ly[li].yL); });
        /* 눈금 — 그 스텝의 값마다 위에서 아래까지 */
        ctx.setLineDash([1, 4]); ctx.globalAlpha = 0.28 * o;
        for (const v of new Set(d.vals)) seg(ctx, ox + info.X(v), oy + g.ly[0].top, ox + info.X(v), oy + g.tickY - 2);
        ctx.setLineDash([]);
        if (ZW) { ctx.globalAlpha = 0.3 * o; ctx.setLineDash([2, 3]); ctx.strokeRect(ox + g.ax1 + 10 + 0.5, oy + 0.5, ZW - 1, g.tickY - 4); ctx.setLineDash([]); }
        for (const cu of g.cuts) { ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]); seg(ctx, ox, oy + cu.y, ox + g.ax1, oy + cu.y); ctx.setLineDash([]); }
        /* 사슬 — 새것에서 옛것으로 휜 화살표, 끝 update 에서 이미지로 점선 */
        const li = lanes.findIndex((L) => L.k === 'ver' && L.a === 'chain');
        if (li >= 0) {
          const cv = d.vers.filter((v) => v.h === 'chain' && this.vx(s, v, g) != null), yL = oy + g.ly[li].yL;
          ctx.strokeStyle = css.ink; ctx.lineWidth = 1.1;
          for (let j = 0; j + 1 < cv.length; j++) {
            const xa = ox + this.vx(s, cv[j], g), xb = ox + this.vx(s, cv[j + 1], g);
            ctx.globalAlpha = (on(s, 'chain') ? 0.7 : 0.4) * o;
            arc(ctx, xa, yL + 5, xb + 4, yL + 5, 9);
          }
          const im = lanes.findIndex((L) => L.k === 'ver' && L.a !== 'chain' && A[L.a].lane === 'disk');
          /* 사슬의 끝 update 다음은 디스크의 값 — 그 이미지 버전의 시작으로 */
          const iv = im >= 0 ? d.vers.find((v) => v.h === lanes[im].a && v.start != null) : null;
          if (cv.length && iv) { const z = cv[cv.length - 1], x = ox + this.vx(s, z, g), x2 = ox + info.X(iv.start); ctx.globalAlpha = 0.4 * o; ctx.setLineDash([2, 4]); arrow(ctx, x, yL + 7, x2, oy + g.ly[im].yL - 8); ctx.setLineDash([]); }
        }
        /* 읽는 시각 */
        const vl = lanes.map((L, i) => (L.k === 'ver' ? i : -1)).filter((x) => x >= 0);
        if (vl.length) for (const r of d.readers) {
          if (r.n == null && !r.latest) continue;
          const x = ox + (r.latest || r.n == null ? g.ax1 : info.X(r.n));
          ctx.globalAlpha = 0.75 * o; ctx.strokeStyle = r.rej ? css.red : r.wait ? css.gold : css.green; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
          for (const i2 of vl) seg(ctx, x, oy + g.ly[i2].yL - 11, x, oy + g.ly[i2].yL + 10);
          ctx.setLineDash([]); ctx.lineWidth = 1;
        }
      },
      anchor(a, s, lb) {
        const g = this.g; if (!g) return null;
        const li = lanes.findIndex((L) => L.a === a); if (li < 0) return null;
        const L = lanes[li], info = g.per.get(s), d = M.TSD.get(s), yL = this.oy + g.ly[li].yL;
        const ns = (String(lb || '').match(/\d+/g) || []).map(Number).filter((n) => n >= M.domOf(s)[0] && n <= M.domOf(s)[1]);
        if (ns.length) return [this.ox + info.X(ns[ns.length - 1]), yL];
        const mod = [...modOf(s, a)];
        if (L.k === 'mk' || L.k === 'rl') { const m = d.marks.get(a).find((x) => mod.includes(x.k)); if (m) return [this.ox + info.X(m.n), yL]; }
        if (L.k === 'ver') { const v = d.vers.find((u) => u.h === a && mod.includes(u.id)) || d.vers.find((u) => u.h === a); if (v) { const x = this.vx(s, v, g); if (x != null) return [this.ox + x, yL]; } }
        if (L.k === 'pt') { const p = d.pts.get(a).find((x) => mod.includes(x.id)) || d.pts.get(a)[0]; if (p && p.ns.length) return [this.ox + info.X(p.ns[p.ns.length - 1]), yL]; }
        if (L.k === 'rd') { const r = d.reads.find((x) => mod.includes(x.id)); if (r) return [this.ox + (r.latest || r.n == null ? g.ax1 : info.X(r.n)), yL]; }
        return [this.ox + (g.ax0 + g.ax1) / 2, yL];
      },
    };
    P.push(panels.time);
  }

  /* ═════ 캐시 — 한 칸에 사용 · dirty, 문턱, eviction 스레드 ═════ */
  if (M.GAUGE) {
    const a = M.GAUGE, hd = label('aq'), szLb = label('aq'), evLb = label('aq ml aq-b');
    const TH = [['dirty_target', M.fnum(/eviction_dirty_target=(\d+)/), 'gold'], ['dirty_trigger', M.fnum(/eviction_dirty_trigger=(\d+)/), 'gold'],
      ['target', M.fnum(/eviction_target=(\d+)/), ''], ['trigger', M.fnum(/eviction_trigger=(\d+)/), 'red']].filter((x) => x[1] != null);
    const upd = /eviction_updates_target = cache->eviction_dirty_target \/ 2/.test(M.FACTS);
    if (upd) { const dt = TH.find((x) => x[0] === 'dirty_target'), dg = TH.find((x) => x[0] === 'dirty_trigger'); if (dt && dg) TH.push(['updates', dt[1] / 2, 'gold', dg[1] / 2]); }
    const thLb = TH.map(() => label('aq')), useLb = label('aq'), drLb = label('aq');
    const thr = M.fnum(/threads_min=(\d+)/) || 0;
    take('ca:rim', 140); take('ca:use', 820); take('ca:dirty', 300);
    for (let t = 0; t < thr + 1; t++) take('ca:w' + t, 14);
    const thLabel = (x) => `${x[0]} ${x[1]}${x[3] != null ? ' · ' + x[3] : ''} %`;
    panels.gauge = {
      id: 'gauge', rank: 1, actors: [a],
      tx(s, t) {
        const kv = s[a], o = on(s, a), m = modOf(s, a);
        t.set(hd, [A[a].nm, o]);
        t.set(szLb, [`크기  ${bare(kv['크기'])}`, o && m.has('크기'), '', true]);
        t.set(useLb, [`사용  ${bare(kv['사용'])}`, o && m.has('사용'), lead(kv['사용']) > (TH.find((x) => x[0] === 'trigger') || [0, 1e9])[1] ? 'red' : '', lead(kv['사용']) != null]);
        t.set(drLb, [`dirty  ${bare(kv.dirty)}`, o && m.has('dirty'), 'gold', lead(kv.dirty) != null]);
        t.set(evLb, [`eviction  <span class="q-v">${val(kv.eviction)}</span>`, o && m.has('eviction'), '', true, true]);
        TH.forEach((x, j) => t.set(thLb[j], [thLabel(x), false, x[2], true]));
      },
      geo(w) {
        wrap(evLb, w);
        const X = (pc) => (pc / 100) * w, per = new Map();
        const th = stagger(TH.map((x, j) => ({ id: j, cx: X(x[1]), w: widthOf(thLb[j], thLabel(x)) })), 0, w);
        let vr = 1;
        for (const s of all) {
          const kv = s[a], T = TXS.get(s), u = lead(kv['사용']), dd = lead(kv.dirty);
          const st = stagger([u != null && { id: 'u', cx: X(u), w: widthOf(useLb, T.get(useLb)[0]) }, dd != null && { id: 'd', cx: X(dd), w: widthOf(drLb, T.get(drLb)[0]) }].filter(Boolean), 0, w);
          vr = Math.max(vr, st.rows); per.set(s, st.out);
        }
        const barY = HD + 16 + vr * RH + 4, thY = barY + 12, wy = thY + th.rows * RH + 10;
        return { h: wy + 14 + most(evLb).h + 2, X, per, th: th.out, barY, thY, wy };
      },
      lay(g, ox, oy) {
        place(hd, ox, oy); place(szLb, ox + g.X(100), oy, 'r', 't');
        for (const q of g.th) place(thLb[q.id], ox + q.l, oy + g.thY + q.row * RH);
        place(evLb, ox, oy + g.wy + 14);
      },
      place(s) { const g = this.g; for (const q of g.per.get(s)) place(q.id === 'u' ? useLb : drLb, this.ox + q.l, this.oy + g.barY - 10 - q.row * RH, 'l', 'b'); },
      pose(c) {
        const g = this.g, { s, prev } = c, kv = s[a], pk = prev ? prev[a] : kv, ox = this.ox, y = this.oy + g.barY, w = g.X(100), lit = on(s, a) && !c.end;
        const u1 = lead(kv['사용']) ?? 0, u0 = lead(pk['사용']) ?? u1, d1 = lead(kv.dirty) ?? 0, d0 = lead(pk.dirty) ?? d1;
        const u = U.lerp(u0, u1, c.mv), dd = U.lerp(d0, d1, c.mv), trg = (TH.find((x) => x[0] === 'trigger') || [0, 1e9])[1], tgt = (TH.find((x) => x[0] === 'target') || [0, 1e9])[1];
        const [r0, r1] = R['ca:rim'];
        for (let m = 0; m < r1 - r0; m++) { const [x, yy] = rim(ox + w / 2, y + 1, w, 16, r1 - r0, m); c.put(r0 + m, x, yy, 0.3 * c.dim * c.form, 0, 0.02, 1, FAINT); }
        /* 채움 — 채운 폭에 2.5px 간격으로. 남는 알갱이는 숨긴다(같은 수를 고르게 펴면 96 % 가 점선이 됐다) */
        const fill = (key, pc, h, yy, col, hot) => { const [f0, f1] = R[key], n = f1 - f0, fw = Math.max(1, g.X(pc) - 4), cols = Math.max(2, Math.min(Math.floor(n / h), Math.round(fw / 2.5))); for (let m = 0; m < n; m++) { const cx = (m % cols + 0.5) / cols, cy = Math.floor(m / cols); if (pc <= 0.2 || cy >= h) { c.hide1(f0 + m); continue; } c.put(f0 + m, ox + 2 + cx * fw, yy + (cy - (h - 1) / 2) * 2.6, (lit ? 0.92 : 0.55) * c.dim * c.form, hot ? 0.3 : 0, 0.02, 1.15, col); } };
        fill('ca:use', u, 3, y - 2.5, u > trg ? RED : INK, lit && modOf(s, a).has('사용'));
        fill('ca:dirty', dd, 2, y + 4.5, GOLD, lit && modOf(s, a).has('dirty'));
        /* eviction 스레드 — threads_min 개. 사용이 target 을 넘으면 일하고(하나가 server), trigger 를 넘으면 애플리케이션 스레드도 */
        const busy = u1 > tgt, app = u1 > trg;
        for (let t = 0; t < thr + 1; t++) {
          const [w0, w1] = R['ca:w' + t], isApp = t === thr, cx = ox + 8 + t * 26 + (isApp ? 14 : 0), cy = this.oy + g.wy;
          for (let m = 0; m < w1 - w0; m++) { const th = m * 2.399, r = 1.5 + (m % 4) * 1.1; c.put(w0 + m, cx + Math.cos(th) * r, cy + Math.sin(th) * r, (isApp ? (app ? 0.95 : 0) : busy ? 0.9 : 0.3) * c.dim * c.form, (isApp ? app : busy) && lit ? 0.4 : 0, isApp || !busy ? 0.02 : 0.6, 1.2, isApp ? RED : t === 0 && busy ? GOLD : INK); }
        }
      },
      over(ctx, s, o) {
        const g = this.g, ox = this.ox, y = this.oy + g.barY;
        TH.forEach((x) => { ctx.globalAlpha = 0.7 * o; ctx.strokeStyle = x[2] === 'gold' ? css.gold : x[2] === 'red' ? css.red : css.ink; seg(ctx, ox + g.X(x[1]), y - 9, ox + g.X(x[1]), y + 9); if (x[3] != null) seg(ctx, ox + g.X(x[3]), y - 9, ox + g.X(x[3]), y + 9); });
      },
      anchor(a2, s) { const g = this.g; return [this.ox + g.X(lead(s[a]['사용']) ?? 50), this.oy + g.barY]; },
    };
    P.push(panels.gauge);
  }

  /* ═════ B-tree ═════ */
  if (M.TREE) {
    const a = M.TREE, hd = label('aq'), ids = idsOf(a);
    const lb = Object.fromEntries(ids.map((id) => [id, label('aq ml aq-c')]));
    ids.forEach((id) => { take('bt:' + id, 90); take('bf:' + id, 40); });
    const levels = (s) => { const by = new Map(); for (const it of s[a]) { const l = it.lvl ?? 0; if (!by.has(l)) by.set(l, []); by.get(l).push(it); } return [...by.entries()].sort((p, q) => p[0] - q[0]).map(([, v]) => v); };
    const maxPer = Math.max(1, ...all.map((s) => Math.max(...levels(s).map((l) => l.length)))), nLv = Math.max(1, ...all.map((s) => levels(s).length));
    panels.tree = {
      id: 'tree', rank: 1, actors: [a],
      tx(s, t) { t.set(hd, [A[a].nm, on(s, a)]); for (const id of ids) { const it = s[a].find((x) => x.id === id); t.set(lb[id], [it ? `<span class="q-i">${esc(id)}</span>\n${esc(it.keys || '')}` : '', on(s, a) && !!it && hotIt(s, a, id), '', !!it, true]); } },
      geo(w) {
        const nw = Math.min(170, (w - (maxPer - 1) * 16) / maxPer), NH = DN ? 18 : 22;
        for (const id of ids) wrap(lb[id], nw + 12);
        const lh = Math.max(...ids.map((id) => most(lb[id]).h));
        /* 층마다 높이 — page 가 하나뿐인 층(root)은 이름표를 옆에 두므로 상자 높이만 */
        const solo = (l) => l < nLv - 1 && all.every((s) => { const ls = levels(s); return !ls[l] || ls[l].length === 1; });
        const LVs = Array.from({ length: nLv }, (_, l) => (solo(l) ? NH + 26 : NH + 8 + lh + (DN ? 12 : 20)));
        const top = LVs.map((_, l) => LVs.slice(0, l).reduce((p, q) => p + q, 0));
        return { h: HD + 6 + top[nLv - 1] + LVs[nLv - 1] - (DN ? 12 : 20), nw, NH, LVs, top };
      },
      lay(g, ox, oy) { place(hd, ox, oy); },
      at(s, id) {
        const g = this.g, ls = levels(s), w = this.w;
        for (let l = 0; l < ls.length; l++) { const j = ls[l].findIndex((x) => x.id === id); if (j < 0) continue; const n = ls[l].length, span = n * g.nw + (n - 1) * 16, x0 = (w - span) / 2; return { x: this.ox + x0 + g.nw / 2 + j * (g.nw + 16), y: this.oy + HD + 6 + g.NH / 2 + g.top[l], l }; }
        return null;
      },
      /* 층에 page 가 하나면(root) 이름표를 옆에 — 아래에 두면 그 층의 높이가 이름표만큼 늘었다 */
      place(s) { const g = this.g, ls = levels(s); for (const it of s[a]) { const P2 = this.at(s, it.id); if (!P2) continue; if (ls[P2.l].length === 1 && P2.l < nLv - 1) { lb[it.id].el.style.textAlign = 'left'; place(lb[it.id], P2.x + g.nw / 2 + 10, P2.y, 'l', 'c'); } else { lb[it.id].el.style.textAlign = ''; place(lb[it.id], P2.x, P2.y + g.NH / 2 + 6, 'c', 't'); } } },
      pose(c) {
        const g = this.g, { s, prev } = c, lit = on(s, a) && !c.end;
        for (const id of ids) {
          const it = s[a].find((x) => x.id === id), pv = prev && prev[a].find((x) => x.id === id), P1 = it ? this.at(s, id) : null, P0 = pv ? this.at(prev, id) : null;
          if (!P1 && !(P0 && !c.end)) { c.hideK('bt:' + id); c.hideK('bf:' + id); continue; }
          const Q = P1 && P0 && !c.end ? { x: U.lerp(P0.x, P1.x, c.mv), y: U.lerp(P0.y, P1.y, c.mv) } : P1 || P0;
          const gone = it ? 0 : c.gone, hot = lit && !!it && hotIt(s, a, id), lv = (hot ? 0.95 : lit ? 0.6 : 0.45) * c.dim * c.form * (1 - gone);
          const born = it && !pv && !c.end, from = born && c.act && c.act.t === a ? c.src : null;
          const [b0, b1] = R['bt:' + id];
          for (let m = 0; m < b1 - b0; m++) {
            let [x, y] = rim(Q.x, Q.y, g.nw, g.NH, b1 - b0, m);
            if (from) { const q = c.show(c.fly, (m / (b1 - b0)) * 0.4, 0.6 + (m / (b1 - b0)) * 0.4); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q) - Math.sin(q * Math.PI) * 16; }
            if (gone) { x += c.jit(b0 + m, 0) * 24 * gone; y += c.jit(b0 + m, 1) * 24 * gone; }
            c.put(b0 + m, x, y, lv, hot ? 0.3 : 0, 0.03, 1.1, INK);
          }
          const fl = it ? it.fill ?? 0 : pv.fill ?? 0, f0 = pv && pv.fill != null ? pv.fill : fl, ff = c.end ? fl : U.lerp(f0, fl, c.mv), [f0i, f1i] = R['bf:' + id];
          /* 채움은 잎에만 — root 의 fill 은 그림의 자리 표시다 */
          if ((it || pv).lvl === 0 || ((it || pv).lvl ?? 0) === 0) { c.hideK('bf:' + id); continue; }
          for (let m = 0; m < f1i - f0i; m++) { const u2 = m / (f1i - f0i - 1), x = Q.x - g.nw / 2 + 4 + u2 * (g.nw - 8), filled = u2 <= ff && ff > 0.005; c.put(f0i + m, x, Q.y + g.NH / 2 - 5, (filled ? 0.95 : 0.22) * lv, filled && hot ? 0.4 : 0, 0.02, filled ? 2.2 : 1.1, filled ? (fl >= 0.85 ? GREEN : fl >= 0.6 ? GOLD : INK) : FAINT); }
        }
      },
      over(ctx, s, o) {
        const ls = levels(s), g = this.g;
        ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.ink;
        for (let l = 0; l + 1 < ls.length; l++) for (const ch of ls[l + 1]) { const P2 = this.at(s, ls[l][0].id), C = this.at(s, ch.id); if (P2 && C) seg(ctx, P2.x, P2.y + g.NH / 2 + 2 + (ls[l].length === 1 ? 0 : 30), C.x, C.y - g.NH / 2 - 2); }
      },
      anchor(a2, s, lbt) { const id = ids.find((x) => String(lbt || '').includes(x)) || [...modOf(s, a)].find((x) => ids.includes(x)) || (s[a][0] || {}).id; const P2 = id ? this.at(s, id) : null; return P2 ? [P2.x, P2.y] : null; },
    };
    P.push(panels.tree);
  }

  /* ═════ lock manager — 층마다 허가된 요청과 기다리는 줄 · 입장권 · 호환표 ═════ */
  if (M.LOCKQ) {
    const a = M.LOCKQ, mx = M.MTX, tk = M.TICK, ids = idsOf(a).filter((id) => all.some((s) => M.LKS.get(s).has(id)));
    const hd = label('aq'), lvLb = LEVELS.map(() => label('aq')), gLb = label('aq'), pLb = label('aq'), cap = label('aq ml aq-b');
    const tok = Object.fromEntries(ids.flatMap((id) => LEVELS.map((l) => [id + '|' + l, label('aq aq-c')])));
    ids.forEach((id) => LEVELS.forEach((l) => take(`lk:${id}|${l}`, 48)));
    const tkHd = tk ? label('aq') : null, tkAl = tk ? label('aq ml aq-b') : null, tkW = tk ? label('aq') : null, tkR = tk ? label('aq') : null;
    const WT = tk ? Math.max(1, ...all.map((s) => lead(s[tk]['write total']) || 0)) : 0, RT = tk ? Math.max(1, ...all.map((s) => lead(s[tk]['read total']) || 0)) : 0;
    if (tk) { take('tk:w', WT * 9); take('tk:r', Math.min(RT, 128) * 3); }
    const mxHd = mx ? label('aq') : null, mxR = mx ? label('aq ml aq-b') : null, s0 = all.find((s) => s[mx]);
    const MR = s0 && s0[mx] ? s0[mx].rows : [], MC = s0 && s0[mx] ? s0[mx].cols : [];
    const mxRow = MR.map(() => label('aq')), mxCol = MC.map(() => label('aq'));
    MR.forEach((r) => MC.forEach((cc) => take(`mx:${r}/${cc}`, 22)));
    const tokTxt = (id, r) => `${esc(id)} ${r.mode}`;
    panels.lock = {
      id: 'lock', rank: 1, actors: [a, ...(mx ? [mx] : []), ...(tk ? [tk] : [])],
      tx(s, t) {
        const o = on(s, a), reqs = M.LKS.get(s);
        t.set(hd, [A[a].nm, o]);
        LEVELS.forEach((l, j) => t.set(lvLb[j], [l, o]));
        t.set(gLb, ['허가', false]); t.set(pLb, ['기다림 (도착 순)', false]);
        for (const id of ids) for (const l of LEVELS) { const r = reqs.get(id) && reqs.get(id).get(l); t.set(tok[id + '|' + l], [r ? tokTxt(id, r) : '', o && hotIt(s, a, id), r ? (r.st === 'pending' ? 'gold' : 'green') : '', !!r, true]); }
        t.set(cap, [capHtml(s[a]), o, '', true, true]);
        if (tk) {
          const kv = s[tk], ot = on(s, tk), m = modOf(s, tk);
          t.set(tkHd, [A[tk].nm, ot]);
          t.set(tkAl, [`algorithm  <span class="q-v">${val(kv.algorithm)}</span>`, ot && m.has('algorithm'), '', true, true]);
          t.set(tkW, [`write  out ${bare(kv['write out'])} / total ${bare(kv['write total'])}`, ot && (m.has('write out') || m.has('write total')), tone(kv['write out']) || '', true]);
          t.set(tkR, [`read  total ${bare(kv['read total'])}`, ot && m.has('read total'), '', true]);
        }
        if (mx && s[mx]) {
          t.set(mxHd, [A[mx].nm, on(s, mx)]);
          t.set(mxR, [s[mx].lb ? `${esc(s[mx].lb.l || '')}  ·  ${esc(s[mx].lb.r || '')}` : '', on(s, mx), '', !!s[mx].lb, true]);
          const onC = new Set(s[mx].on);
          MR.forEach((r, j) => t.set(mxRow[j], [r, on(s, mx), [...onC].some((x) => x.startsWith(r + '/')) ? 'gold' : '', true]));
          MC.forEach((cc, j) => t.set(mxCol[j], [cc, on(s, mx), [...onC].some((x) => x.endsWith('/' + cc)) ? 'gold' : '', true]));
        }
      },
      geo(w) {
        const GW = Math.max(...LEVELS.map((l, j) => widthOf(lvLb[j], l))) + 14;
        /* 허가 칸의 폭 — 모든 스텝에서 가장 넓은 것. 줄은 그 오른쪽부터 */
        const tw = (id, r) => widthOf(tok[id + '|' + LEVELS[0]], tokTxt(id, r)) + 12;
        let gW = 80;
        const per = new Map();
        for (const s of all) {
          const reqs = M.LKS.get(s), info = {};
          for (const l of LEVELS) {
            let x = 0; const G = [], Pn = [];
            for (const id of ids) { const r = reqs.get(id) && reqs.get(id).get(l); if (r) (r.st === 'granted' ? G : Pn).push({ id, w: tw(id, r) }); }
            for (const q of G) { q.x = x; x += q.w + 6; }
            gW = Math.max(gW, x);
            info[l] = { G, P: Pn };
          }
          per.set(s, info);
        }
        const div = GW + gW + 10;
        for (const info of per.values()) for (const l of LEVELS) { let x = div + 12; for (const q of info[l].P) { q.x = x; x += q.w + 6; } }
        wrap(cap, w);
        const LH = DN ? 22 : 26, lanesH = HD + 14 + LEVELS.length * LH;
        const capY = lanesH + 4, capH = most(cap).h;
        let y2 = capY + capH + 14;
        /* 입장권 · 호환표 — 나란히(폭이 되면) */
        const cell = DN ? 16 : 18, mW = mx ? 40 + MC.length * (cell + 4) : 0, mH = mx ? HD + 16 + MR.length * (cell + 4) : 0;
        const side = tk && mx && w - mW - 30 >= 220;
        const tkWd = side ? w - mW - 30 - 10 : w;
        if (tkAl) wrap(tkAl, tkWd);
        const tkH = tk ? HD + most(tkAl).h + 8 + 2 * (RH + 14) : 0;
        /* 호환표의 설명은 입장권 칸 아래 — 표 옆은 좁아 세 줄로 접혔다 */
        if (mxR) wrap(mxR, side ? tkWd : Math.max(140, mW + 40));
        const mRH = mxR ? most(mxR).h : 0;
        const tkY = y2, mxX = side ? w - mW - 20 : 0, mxY = side ? y2 : y2 + tkH + 12;
        const mrX = side ? 0 : mxX, mrY = side ? y2 + tkH + 4 : mxY + mH + 4;
        const h = side ? y2 + Math.max(tkH + 4 + mRH, mH) : mrY + mRH + 2;
        return { h, GW, div, per, LH, capY, tkY, tkWd, mxX, mxY, mrX, mrY, cell, mW, mH, side };
      },
      lay(g, ox, oy) {
        place(hd, ox, oy);
        LEVELS.forEach((l, j) => place(lvLb[j], ox, oy + HD + 14 + j * g.LH + g.LH / 2, 'l', 'c'));
        place(gLb, ox + g.GW, oy + HD); place(pLb, ox + g.div + 12, oy + HD);
        place(cap, ox, oy + g.capY);
        if (tk) { place(tkHd, ox, oy + g.tkY); place(tkAl, ox, oy + g.tkY + HD); const y = oy + g.tkY + HD + most(tkAl).h + 8; place(tkW, ox, y); place(tkR, ox, y + RH + 14); this.tkRow = [y + RH + 1, y + 2 * RH + 15]; }
        if (mx) {
          place(mxHd, ox + g.mxX, oy + g.mxY);
          MC.forEach((cc, j) => place(mxCol[j], ox + g.mxX + 40 + j * (g.cell + 4) + g.cell / 2, oy + g.mxY + HD, 'c', 't'));
          MR.forEach((r, j) => place(mxRow[j], ox + g.mxX + 30, oy + g.mxY + HD + 16 + j * (g.cell + 4) + g.cell / 2, 'r', 'c'));
          place(mxR, ox + g.mrX, oy + g.mrY);
        }
      },
      tokAt(s, id, l) {
        const g = this.g, info = g.per.get(s)[l], j = LEVELS.indexOf(l), q = [...info.G, ...info.P].find((x) => x.id === id);
        if (!q) return null;
        const pend = info.P.includes(q);
        return { x: this.ox + (pend ? q.x : g.GW + q.x) + q.w / 2, y: this.oy + HD + 14 + j * g.LH + g.LH / 2, w: q.w, pend };
      },
      place(s) { for (const id of ids) for (const l of LEVELS) { const T = this.tokAt(s, id, l); if (T) place(tok[id + '|' + l], T.x, T.y, 'c', 'c'); } },
      pose(c) {
        const g = this.g, { s, prev } = c, lit = on(s, a) && !c.end;
        for (const id of ids) for (const l of LEVELS) {
          const key = `lk:${id}|${l}`, T1 = this.tokAt(s, id, l), T0 = prev ? this.tokAt(prev, id, l) : null;
          if (!T1 && !(T0 && !c.end)) { c.hideK(key); continue; }
          const T = T1 && T0 && !c.end ? { ...T1, x: U.lerp(T0.x, T1.x, c.mv) } : T1 || T0, gone = T1 ? 0 : c.gone, hot = lit && hotIt(s, a, id);
          const born = T1 && !T0 && !c.end, from = born && c.act && c.act.t === a ? c.src : null, [r0, r1] = R[key];
          for (let m = 0; m < r1 - r0; m++) {
            let [x, y] = rim(T.x, T.y, T.w, 18, r1 - r0, m);
            if (from) { const q = c.show(c.fly, (m / (r1 - r0)) * 0.4, 0.6 + (m / (r1 - r0)) * 0.4); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q) - Math.sin(q * Math.PI) * 14; }
            if (gone) { x += c.jit(r0 + m, 0) * 22 * gone; y += c.jit(r0 + m, 1) * 18 * gone; }
            c.put(r0 + m, x, y, (hot ? 0.95 : 0.55) * c.dim * c.form * (1 - gone), hot ? 0.3 : 0, 0.02, 1.15, T.pend ? GOLD : GREEN);
          }
        }
        if (tk) {
          const kv = s[tk], wt = lead(kv['write total']) || 0, wo = lead(kv['write out']) || 0, rt = Math.min(128, lead(kv['read total']) || 0), ltk = on(s, tk) && !c.end;
          const pool = (key, total, out, cap2, y, per2) => {
            const [p0, p1] = R[key], sw = Math.min(16, (g.tkWd - 4) / Math.max(1, cap2));   /* 입장권 칸의 폭 안에 — 패널 폭을 쓰자 128 칸이 호환표 밑까지 갔다 */
            for (let m = 0; m < p1 - p0; m++) {
              const k = Math.floor(m / per2), j = m % per2;
              if (k >= total) { c.hide1(p0 + m); continue; }
              /* 한 칸 = 입장권 하나. 9 알갱이면 3 × 3 의 네모, 3 알갱이면 세로 막대(128 칸이 들어가게) */
              const side2 = per2 >= 9 ? 3 : 1, cw2 = Math.min(3.2, (sw - 3) / Math.max(1, side2 - 1)), filled = k < out;
              const x = this.ox + 2 + k * sw + (side2 > 1 ? (j % 3) * cw2 : sw * 0.35), yy = y + (side2 > 1 ? Math.floor(j / 3) * 3.2 : j * 3.2);
              c.put(p0 + m, x, yy, (filled ? 0.95 : 0.35) * c.dim * c.form, filled && ltk ? 0.3 : 0, 0.02, filled ? 1.3 : 1, filled ? (wo >= wt ? RED : GOLD) : FAINT);
            }
          };
          pool('tk:w', wt, wo, WT, this.tkRow[0] + 3, 9);
          pool('tk:r', rt, 0, Math.min(RT, 128), this.tkRow[1] + 3, 3);
        }
        if (mx && s[mx]) {
          const mm = s[mx], onC = new Set(mm.on), dimC = new Set(mm.dim), lm = on(s, mx) && !c.end;
          MR.forEach((r, i2) => MC.forEach((cc, j) => {
            const key = `mx:${r}/${cc}`, [m0, m1] = R[key], yes = mm.cells[i2] && mm.cells[i2][j] === '+', k2 = r + '/' + cc, hot = onC.has(k2), dm = dimC.size && !dimC.has(k2) && !hot;
            const cx = this.ox + g.mxX + 40 + j * (g.cell + 4) + g.cell / 2, cy = this.oy + g.mxY + HD + 16 + i2 * (g.cell + 4) + g.cell / 2;
            for (let m = 0; m < m1 - m0; m++) { const [x, y] = yes ? grid(cx, cy, g.cell - 4, g.cell - 4, m1 - m0, m) : rim(cx, cy, g.cell - 4, g.cell - 4, m1 - m0, m); c.put(m0 + m, x, y, (hot ? 0.95 : dm ? 0.18 : lm ? 0.6 : 0.42) * c.dim * c.form, hot && lm ? 0.6 : 0, 0.02, 1.05, hot ? GOLD : yes ? GREEN : RED); }
          }));
        }
      },
      over(ctx, s, o) {
        const g = this.g;
        ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint;
        LEVELS.forEach((l, j) => { const y = this.oy + HD + 14 + j * g.LH + g.LH / 2; seg(ctx, this.ox + g.GW - 4, y, this.ox + this.w, y); });
        ctx.setLineDash([3, 3]); seg(ctx, this.ox + g.div, this.oy + HD + 14, this.ox + g.div, this.oy + HD + 14 + LEVELS.length * g.LH); ctx.setLineDash([]);
      },
      anchor(a2, s, lbt) {
        const g = this.g;
        if (a2 === tk) return [this.ox + 60, this.tkRow ? this.tkRow[0] : this.oy + g.tkY];
        if (a2 === mx && s[mx]) { const k = s[mx].on[0]; if (k) { const [r, cc] = k.split('/'); return [this.ox + g.mxX + 40 + MC.indexOf(cc) * (g.cell + 4) + g.cell / 2, this.oy + g.mxY + HD + 16 + MR.indexOf(r) * (g.cell + 4) + g.cell / 2]; } return [this.ox + g.mxX + g.mW / 2, this.oy + g.mxY + g.mH / 2]; }
        const mod = [...modOf(s, a)], id = ids.find((x) => mod.includes(x)) || ids.find((x) => M.LKS.get(s).has(x));
        if (id) for (const l of [...LEVELS].reverse()) { const T = this.tokAt(s, id, l); if (T) return [T.x, T.y]; }
        return [this.ox + g.div, this.oy + HD + 14 + g.LH];
      },
    };
    P.push(panels.lock);
  }

  /* ═════ 키 공간(axis) ═════ */
  if (M.KEYAX) {
    const a = M.KEYAX, hd = label('aq'), lo = label('aq'), hi = label('aq');
    const iids = [...new Set(all.flatMap((s) => s[a].items.map((x) => x.id)))], sids = [...new Set(all.flatMap((s) => s[a].spans.map((x) => x.id)))];
    const iLb = Object.fromEntries(iids.map((id) => [id, label('aq')])), sLb = Object.fromEntries(sids.map((id) => [id, label('aq')]));
    iids.forEach((id) => take('ki:' + id, 22)); sids.forEach((id) => take('ks:' + id, 90)); take('kx:line', 110);
    const RW = Math.max(1, ...all.flatMap((s) => s[a].spans.map((x) => (x.row || 0) + 1)));
    panels.keyax = {
      id: 'keyax', rank: 1, actors: [a],
      tx(s, t) {
        const o = on(s, a), ax = s[a], c2 = s.chg[a] || {}, sOn = new Set([...((c2.span && c2.span.add) || []), ...((c2.span && c2.span.mod) || [])]);
        t.set(hd, [A[a].nm + '  ·  KeyString 순서', o]);
        t.set(lo, [String(ax.axis.min), false]); t.set(hi, [String(ax.axis.max), false]);
        for (const id of iids) { const it = ax.items.find((x) => x.id === id); t.set(iLb[id], [it ? id : '', o && hotIt(s, a, id), '', !!it]); }
        for (const id of sids) { const sp = ax.spans.find((x) => x.id === id); t.set(sLb[id], [sp ? sp.lb || '' : '', o && sOn.has(id), sp && sp.kind === 'blk' ? 'red' : '', !!sp]); }
      },
      geo(w) {
        const x0 = 14, x1 = w - 14, per = new Map();
        let rr = 1;
        for (const s of all) {
          const ax = s[a].axis, X = (v) => x0 + ((v - ax.min) / ((ax.max - ax.min) || 1)) * (x1 - x0), T = TXS.get(s), rows = [];
          for (let r = 0; r < RW; r++) { const st = stagger(s[a].spans.filter((x) => (x.row || 0) === r).map((x) => ({ id: x.id, cx: (X(x.from) + X(x.to)) / 2, w: widthOf(sLb[x.id], T.get(sLb[x.id])[0]), pins: [X(x.from)] })), 0, w); rows.push(st); }
          const it = stagger(s[a].items.map((x) => ({ id: x.id, cx: X(x.v), w: widthOf(iLb[x.id], x.id) })), 0, w);
          rr = Math.max(rr, ...rows.map((r) => r.rows));
          per.set(s, { X, rows, it: it.out });
        }
        const band = rr * RH + 14;
        const lineY = HD + 6 + RW * band + 6;
        return { h: lineY + 12 + RH + 4, per, band, lineY, x0, x1 };
      },
      lay(g, ox, oy) { place(hd, ox, oy); place(lo, ox + g.x0, oy + g.lineY + 6, 'c', 't'); place(hi, ox + g.x1, oy + g.lineY + 6, 'c', 't'); },
      spanY(g, r) { return this.oy + HD + 6 + (RW - 1 - r) * g.band + g.band - 6; },
      place(s) {
        const g = this.g, p = g.per.get(s);
        p.rows.forEach((st, r) => { for (const q of st.out) place(sLb[q.id], this.ox + q.l, this.spanY(g, r) - 8 - q.row * RH, 'l', 'b'); });
        for (const q of p.it) place(iLb[q.id], this.ox + q.l, this.oy + g.lineY + 8 + q.row * RH);
      },
      pose(c) {
        const g = this.g, { s, prev } = c, p = g.per.get(s), ax = s[a], lit = on(s, a) && !c.end;
        const [l0, l1] = R['kx:line'];
        for (let m = 0; m < l1 - l0; m++) c.put(l0 + m, this.ox + g.x0 + (m / (l1 - l0 - 1)) * (g.x1 - g.x0), this.oy + g.lineY, 0.32 * c.dim * c.form, 0, 0.02, 1, FAINT);
        for (const id of iids) {
          const it = ax.items.find((x) => x.id === id), [i0, i1] = R['ki:' + id];
          if (!it) { c.hideK('ki:' + id); continue; }
          const born = prev && !prev[a].items.some((x) => x.id === id) && !c.end, from = born && c.act && c.act.t === a ? c.src : null;
          for (let m = 0; m < i1 - i0; m++) { const th = m * 2.399, r = 1.5 + (m % 4); let x = this.ox + p.X(it.v) + Math.cos(th) * r, y = this.oy + g.lineY + Math.sin(th) * r * 0.8; if (from) { const q = c.show(c.fly, 0.1, 0.9); x = U.lerp(from[0], x, q); y = U.lerp(from[1], y, q); } c.put(i0 + m, x, y, (lit ? 0.95 : 0.6) * c.dim * c.form, 0.3, 0.02, 1.25, INK); }
        }
        for (const id of sids) {
          const sp = ax.spans.find((x) => x.id === id), psp = prev && prev[a].spans.find((x) => x.id === id), [k0, k1] = R['ks:' + id];
          if (!sp && !(psp && !c.end)) { c.hideK('ks:' + id); continue; }
          const q = sp || psp, xa = this.ox + p.X(q.from), xb = this.ox + p.X(q.to), y = this.spanY(g, q.row || 0), gone = sp ? 0 : c.gone, pt = q.from === q.to;
          const col = q.kind === 'blk' ? RED : ACCENT, hot = lit && !!sp && (!psp || psp.lb !== sp.lb);
          for (let m = 0; m < k1 - k0; m++) {
            const u = m / (k1 - k0 - 1);
            let x = pt ? xa + Math.cos(m * 2.399) * (1.5 + (m % 5) * 0.9) : xa + Math.floor(m / 3) / Math.max(1, Math.ceil((k1 - k0) / 3) - 1) * (xb - xa), yy = pt ? y + Math.sin(m * 2.399) * (1.5 + (m % 5) * 0.9) * 0.8 : y + ((m % 3) - 1) * 2.4;
            if (gone) { x += c.jit(k0 + m, 0) * 20 * gone; yy += c.jit(k0 + m, 1) * 16 * gone; }
            c.put(k0 + m, x, yy, (hot ? 0.95 : 0.6) * c.dim * c.form * (1 - gone), hot ? 0.4 : 0, 0.02, 1.15, col);
          }
        }
      },
      over(ctx, s, o) { const g = this.g, p = g.per.get(s); ctx.globalAlpha = 0.25 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([1, 3]); for (const sp of s[a].spans) { const x = this.ox + p.X(sp.from); seg(ctx, x, this.spanY(g, sp.row || 0) + 3, x, this.oy + g.lineY - 3); } ctx.setLineDash([]); },
      anchor(a2, s) {
        const g = this.g, p = g.per.get(s), ax = s[a], c2 = s.chg[a] || {}, sid = c2.span && [...(c2.span.add || [])].pop(), sp = sid && ax.spans.find((x) => x.id === sid);
        if (sp) return [this.ox + p.X(sp.from), this.spanY(g, sp.row || 0)];
        const it = ax.items[ax.items.length - 1];
        return it ? [this.ox + p.X(it.v), this.oy + g.lineY] : [this.ox + (g.x0 + g.x1) / 2, this.oy + g.lineY];
      },
    };
    P.push(panels.keyax);
  }

  /* ═════ checkpoint 시계 ═════ */
  function ckptPanel(a) {
    const hd = label('aq'), note = label('aq ml aq-b'), perLb = label('aq');
    const tOf = (s) => { const m = /t = (\d+) s/.exec(bare(s[a]['마지막 checkpoint'] || '')); return m ? +m[1] : null; };
    /* 지금까지 찍힌 checkpoint — 옛것은 블록을 다시 쓸 수 있게 될 때까지 남는다(옛 checkpoint 가 아직 가리킨다) */
    const HIST = new Map();
    for (const b of BAKES.values()) { let h = []; for (const s of [b.S0, ...b.S]) { const t = tOf(s); if (t != null && !h.includes(t)) h = [...h, t]; HIST.set(s, h); } }
    const TT = [...new Set(all.flatMap((s) => HIST.get(s)))].sort((p, q) => p - q), Tmax = Math.max(1, ...TT);
    const tLb = Object.fromEntries(TT.map((t) => [t, label('aq')]));
    TT.forEach((t) => take('ck:' + t, 30));
    const BLK = cast.find((x) => kind(x) === 'list' && all.some((s) => s[x].some((it) => /checkpoint/.test(it.sub))));
    const txt = (s, t) => (t === tOf(s) ? `마지막 checkpoint  t = ${t} s` : `옛 checkpoint  t = ${t} s`);
    return {
      id: 'ckpt', rank: RANK[A[a].lane] ?? 2, actors: [a],
      tx(s, t) {
        const h = HIST.get(s), cur = tOf(s), o = on(s, a), m = modOf(s, a);
        t.set(hd, [A[a].nm + '  ·  초', o]);
        for (const tt of TT) t.set(tLb[tt], [h.includes(tt) ? txt(s, tt) : '', o && tt === cur, '', h.includes(tt)]);
        const pv = s[a]['주기'];
        t.set(perLb, [`주기  ${unit(bare(pv))}`, o && m.has('주기'), '', lead(pv) != null && h.length > 1]);
        const rest = Object.entries(s[a]).filter(([k, v]) => k !== '마지막 checkpoint' && !(k === '주기' && lead(v) != null && h.length > 1));
        t.set(note, [rest.map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('    /    '), o, '', rest.length > 0, true]);
      },
      geo(w) {
        const X = (t) => 20 + (t / Tmax) * Math.min(w - 220, w * 0.7), per = new Map();
        let rows = 1;
        for (const s of all) { const T = TXS.get(s); const st = stagger(HIST.get(s).map((t) => ({ id: t, cx: X(t), w: widthOf(tLb[t], T.get(tLb[t])[0]) })), 0, w); rows = Math.max(rows, st.rows); per.set(s, st.out); }
        /* 남은 값은 머리줄 오른쪽 — 아래에 두면 블록으로 가는 화살표가 그 글을 지났다 */
        wrap(note, Math.max(140, w - widthOf(hd, esc(A[a].nm + '  ·  초')) - 24));
        const nh = most(note).h, yL = Math.max(HD, nh + 4) + rows * RH + 8, pY = yL + 12;
        return { h: pY + RH + 2, X, per, yL, pY };
      },
      lay(g, ox, oy) { place(hd, ox, oy); place(note, ox + this.w, oy, 'r', 't'); },
      place(s) {
        const g = this.g, h = HIST.get(s);
        for (const q of g.per.get(s)) place(tLb[q.id], this.ox + q.l, this.oy + g.yL - 8 - q.row * RH, 'l', 'b');
        if (h.length > 1) { const a2 = h[h.length - 2], b2 = h[h.length - 1]; place(perLb, this.ox + (g.X(a2) + g.X(b2)) / 2, this.oy + g.pY, 'c', 't'); }
      },
      pose(c) {
        const g = this.g, { s, prev } = c, h = HIST.get(s), hp = prev ? HIST.get(prev) : [], cur = tOf(s), lit = on(s, a) && !c.end;
        for (const t of TT) {
          const key = 'ck:' + t, [r0, r1] = R[key];
          if (!h.includes(t)) { c.hideK(key); continue; }
          const born = !hp.includes(t) && !c.end, old = t !== cur;
          for (let m = 0; m < r1 - r0; m++) {
            let x = this.ox + g.X(t) + (m % 3 - 1) * 1.6, y = this.oy + g.yL - 6 + Math.floor(m / 3) * (12 / Math.max(1, Math.ceil((r1 - r0) / 3) - 1));
            if (born) { const q = c.show(c.p, 0.12, 0.42); y = U.lerp(this.oy + g.yL - 30, y, q); }
            c.put(r0 + m, x, y, (old ? 0.45 : lit ? 0.95 : 0.6) * c.dim * c.form, !old && lit ? 0.4 : 0, 0.02, 1.25, old ? FAINT : INK);
          }
        }
      },
      over(ctx, s, o) {
        const g = this.g, h = HIST.get(s), cur = tOf(s), y = this.oy + g.yL;
        ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint; seg(ctx, this.ox, y, this.ox + this.w, y);
        if (h.length > 1) { const xa = this.ox + g.X(h[h.length - 2]), xb = this.ox + g.X(h[h.length - 1]); ctx.globalAlpha = 0.55 * o; ctx.strokeStyle = css.ink; seg(ctx, xa, y + 8, xb, y + 8); seg(ctx, xa, y + 5, xa, y + 11); seg(ctx, xb, y + 5, xb, y + 11); }
        /* 각 checkpoint 가 가리키는 블록 — 새 것은 새 블록을, 옛 것은 옛 블록을(복사 후 쓰기) */
        const rp = BLK && panels['row:' + BLK];
        if (!rp || !rp.g) return;
        for (const t of h) {
          const re = t === cur ? /마지막 checkpoint|새 checkpoint/ : /옛 checkpoint/, it = s[BLK].find((x) => re.test(x.sub));
          if (!it) continue;
          const P2 = rp.at(s, it.id);
          if (!P2) continue;
          ctx.globalAlpha = (t === cur ? 0.6 : 0.35) * o; ctx.strokeStyle = t === cur ? css.ink : css.faint; ctx.setLineDash([2, 3]);
          arrow(ctx, this.ox + g.X(t), y + 12, P2.x, P2.y - rp.g.nh / 2 - 3); ctx.setLineDash([]);
        }
      },
      anchor(a2, s) { const g = this.g, t = tOf(s); return [this.ox + g.X(t ?? 0), this.oy + g.yL]; },
    };
  }

  /* ═════ 칸 줄 — 01 의 사슬처럼 항목 하나가 덩어리 하나, 아래에 id · 설명 ═════ */
  const SEQ = cast.filter((a) => ROWS.includes(a) || a === CKPT);
  for (const a of SEQ) {
    if (a === CKPT) { const pn = ckptPanel(a); panels[pn.id] = pn; P.push(pn); continue; }
    /* CURRENTOP 은 자리가 있는 것이 아니라 읽은 결과다 — 덩어리 없이 줄 글로 */
    if (A[a].nm === 'CURRENTOP') {
      const hd = label('aq'), bd = label('aq ml aq-b');
      const pn = {
        id: 'list:' + a, rank: RANK[A[a].lane] ?? 1, actors: [a],
        tx(s, t) { t.set(hd, [A[a].nm, on(s, a)]); t.set(bd, [s[a].map((x) => `<span class="${s.chg[a] && (s.chg[a].add.includes(x.id) || s.chg[a].mod.includes(x.id)) ? 'q-i' : ''}">${esc(x.id)}</span>  ${esc(x.sub || '')}`).join('\n'), on(s, a), '', true, true]); },
        geo(w) { wrap(bd, w); return { h: HD + most(bd).h }; },
        lay(g, ox, oy) { place(hd, ox, oy); place(bd, ox, oy + HD); },
        anchor() { return [this.ox + 40, this.oy + 8]; },
      };
      panels[pn.id] = pn; P.push(pn);
      continue;
    }
    const hd = label('aq'), ids = idsOf(a), lb = Object.fromEntries(ids.map((id) => [id, label('aq ml aq-c')])), cap = label('aq ml aq-b');
    const isChain = a === 'chain' || A[a].nm === 'UPDATE CHAIN';
    /* JOURNAL — 레코드는 log buffer(fsync 전, dirty)에서 journal 파일(fsync 됨, ok)로 건너간다. 두 칸을 나눠 그 경계가 fsync 다 */
    const ZONES = A[a].nm === 'JOURNAL' && all.some((s) => s[a].some((x) => x.tag === 'dirty')) && all.some((s) => s[a].some((x) => x.tag === 'ok'));
    const zoneOf = (it) => (it.tag === 'ok' ? 1 : 0);
    const zLb = ZONES ? [label('aq'), label('aq')] : null;
    const MAXN = ZONES ? 2 * Math.max(1, ...all.map((s) => Math.max(...[0, 1].map((z) => s[a].filter((x) => x.tag !== 'free' && zoneOf(x) === z).length)))) : Math.max(1, ...all.map((s) => s[a].length));
    ids.forEach((id) => take(`r:${a}:${id}`, 132));
    if (isChain) take(`r:${a}:@head`, 20);
    const pn = {
      id: 'row:' + a, rank: RANK[A[a].lane] ?? 1, actors: [a],
      tx(s, t) {
        t.set(hd, [A[a].nm + (isChain ? '  ·  head →' : ''), on(s, a)]);
        for (const id of ids) { const it = s[a].find((x) => x.id === id); t.set(lb[id], [it ? (this.capMode ? `<span class="q-i">${esc(id)}</span>` : itHtml(it)) : '', on(s, a) && !!it && hotIt(s, a, id), it && it.tag === 'x' ? 'red' : '', !!it, true]); }
        t.set(cap, [this.capMode ? capHtml(s[a]) : '', on(s, a), '', !!this.capMode, true]);
        if (ZONES) { t.set(zLb[0], ['log buffer  ·  fsync 전', false]); t.set(zLb[1], ['journal 파일  ·  fsync 됨', false]); }
      },
      capMode: false,
      geo(w) {
        const hx = isChain ? 22 : 0, sw = Math.min(190, (w - hx) / MAXN);
        const cm = sw < 124;
        if (cm !== this.capMode) { this.capMode = cm; retext(); }
        for (const id of ids) wrap(lb[id], sw - 8);
        wrap(cap, w);
        const lh = Math.max(14, ...ids.map((id) => most(lb[id]).h)), nh = DN ? 16 : 22;
        return { h: HD + 4 + nh + 8 + lh + (cm ? 6 + most(cap).h : 0), sw, hx, nh, lh, nw: Math.min(150, sw - 14) };
      },
      lay(g, ox, oy) {
        place(hd, ox, oy); if (this.capMode) place(cap, ox, oy + HD + 4 + g.nh + 8 + g.lh + 6);
        if (ZONES) { const zw = (this.w - g.hx) / 2; place(zLb[0], ox + g.hx + Math.max(widthOf(hd, A[a].nm) + 18, 0), oy); place(zLb[1], ox + g.hx + zw + 10, oy); }
      },
      at(s, id) {
        const g = this.g, j = s[a].findIndex((x) => x.id === id);
        if (j < 0) return null;
        if (ZONES) { const it = s[a][j], z = zoneOf(it), k = s[a].filter((x) => zoneOf(x) === z).indexOf(it), zw = (this.w - g.hx) / 2; return { x: this.ox + g.hx + z * zw + k * g.sw + g.sw / 2, y: this.oy + HD + 4 + g.nh / 2 }; }
        return { x: this.ox + g.hx + j * g.sw + g.sw / 2, y: this.oy + HD + 4 + g.nh / 2 };
      },
      place(s) { const g = this.g; for (const it of s[a]) { const P2 = this.at(s, it.id); place(lb[it.id], P2.x, P2.y + g.nh / 2 + 6, 'c', 't'); } },
      pose(c) {
        const g = this.g, { s, prev } = c, lit = on(s, a) && !c.end;
        for (const id of ids) {
          const key = `r:${a}:${id}`, it = s[a].find((x) => x.id === id), pv = prev && prev[a].find((x) => x.id === id);
          if (!it && !(pv && !c.end)) { c.hideK(key); continue; }
          const P1 = it ? this.at(s, id) : null, P0 = pv ? this.at(prev, id) : null, Q = P1 && P0 && !c.end ? { x: U.lerp(P0.x, P1.x, c.mv), y: P1.y } : P1 || P0;
          const born = it && !pv && !c.end, from = born && c.act && c.act.t === a ? c.src : null, gone = it ? 0 : c.gone;
          const tg = (it || pv).tag, free = tg === 'free', hot = lit && !!it && hotIt(s, a, id), lv = (hot ? 0.92 : lit ? 0.55 : 0.45) * c.dim * c.form * (1 - gone);
          const mod = it && pv && pv.tag !== it.tag && !c.end, [r0, r1] = R[key], n = r1 - r0;
          for (let m = 0; m < n; m++) {
            const i = r0 + m, f = m / n;
            let [x, y, ing = true] = free ? rim(Q.x, Q.y, g.nw, g.nh, n, m) : grid(Q.x, Q.y, g.nw, g.nh, n, m);
            if (from) { const q = c.show(c.fly, 0.08 + f * 0.16, 0.26 + f * 0.16); x = U.lerp(from[0] + c.jit(i, 0) * 14, x, q); y = U.lerp(from[1] + c.jit(i, 1) * 14, y, q) - Math.sin(q * Math.PI) * 24; }
            if (gone) { x += c.jit(i, 0) * 26 * gone; y += c.jit(i, 1) * 22 * gone; }
            const tw = mod && (pv.tag === 'wait' || pv.tag === 'dirty') ? c.p < 0.12 + f * 0.24 : false;
            const col = tw ? GOLD : TAGC[tg] ?? INK;
            c.put(i, x, y, (free ? lv * 0.5 * (m % 2) : lv) * ing, hot && (tg === 'wait' || tg === 'dirty') ? 0.3 : 0, 0.04, 1.12, col);
          }
        }
        if (isChain) {
          const [h0, h1] = R[`r:${a}:@head`], y = this.oy + HD + 4 + g.nh / 2;
          for (let m = 0; m < h1 - h0; m++) c.put(h0 + m, this.ox + 4 + (m % 5) * 2.2, y - 4 + Math.floor(m / 5) * 2.2, (lit ? 0.9 : 0.5) * c.dim * c.form, 0, 0.02, 1.1, INK);
        }
      },
      over(ctx, s, o) {
        if (ZONES) { const g = this.g, x = this.ox + g.hx + (this.w - g.hx) / 2; ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.gold; ctx.setLineDash([3, 3]); seg(ctx, x, this.oy + 2, x, this.oy + HD + 4 + g.nh + 6); ctx.setLineDash([]); }
        if (!isChain) return;
        const g = this.g, its = s[a].filter((x) => x.tag !== 'free'), y = this.oy + HD + 4 + g.nh / 2;
        ctx.strokeStyle = css.ink; ctx.lineWidth = 1.2;
        const first = its[0] ? this.at(s, its[0].id) : null;
        ctx.globalAlpha = (first ? 0.7 : 0.35) * o; if (!first) ctx.setLineDash([3, 4]);
        arrow(ctx, this.ox + 16, y, (first ? first.x : this.ox + g.hx + g.sw / 2) - g.nw / 2 - 4, y); ctx.setLineDash([]);
        for (let j = 0; j + 1 < its.length; j++) { const p1 = this.at(s, its[j].id), p2 = this.at(s, its[j + 1].id); ctx.globalAlpha = 0.6 * o; arrow(ctx, p1.x + g.nw / 2 + 3, y, p2.x - g.nw / 2 - 3, y); }
      },
      anchor(a2, s, lbt) { const mod = [...modOf(s, a)], id = mod.find((x) => ids.includes(x)) || (s[a][0] || {}).id; const P2 = id ? this.at(s, id) : null; return P2 ? [P2.x, P2.y] : null; },
    };
    panels[pn.id] = pn;
    P.push(pn);
  }

  /* ── 스텝마다의 글 — [글, 또렷한가, 색, 보이나, html]. 값마다 따로 ── */
  const TXS = new Map();
  function retext() { for (const s of all) { const t = new Map(); for (const p of P) p.tx(s, t); TXS.set(s, t); } }
  retext();
  /* 가장 큰 글 — 보이는 스텝만(init 의 글은 그려지지 않는다) */
  const most = (lb) => {
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const [st, t] of TXS) { if (!st.at) continue; const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); }
    lb.el.innerHTML = keep;
    return { w, h };
  };

  take('tok', 150);
  R.DST = [at, N];
  if (at > N) throw new Error('wiredtiger 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 자리 — 판을 위에서 아래로. 다 안 들어가면 두 열 ── */
  let G = null;
  const rnd = U.rng(41);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const EDGE = (deck.EDGES || []).find((e) => e.after === 'mem' && e.before === 'disk') || null;
  const edgeLb = label('aq'), tok = label('stn-tok');
  function build(L) {
    const W = L.x1 - L.x0, H = L.y1 - L.y0;
    const cache = new Map();
    const geoAt = (p, w) => { const k = p.id + '|' + Math.round(w) + '|' + DN; if (!cache.has(k)) { p.w = w; cache.set(k, p.geo(w)); } return cache.get(k); };
    /* 촘촘하게 — 줄 간격 · 이름표 줄 · 판 사이를 줄인다. 다 안 들어갈 때만 */
    const dense = (on) => { DN = on; RH = on ? 14 : 15; for (const lb of made) lb.el.style.lineHeight = on ? '1.28' : ''; };
    dense(false);
    const stack = (ps, w, gap) => { let y = 0; const out = []; ps.forEach((p, j) => { const e = j && ps[j - 1].rank <= 1 && p.rank >= 2; if (e) y += 26; const g = geoAt(p, w); out.push({ p, y, g, edge: e ? y - 16 : null }); y += g.h + gap; }); return { out, h: y - gap }; };
    /* 고르는 순서 — 덜 촘촘한 것, 판 사이가 넓은 것, 한 열을 먼저. 들어가는 첫 배치, 없으면 가장 낮은 것 */
    const lay2 = (gap, cols) => {
      if (cols === 1) { const one = stack(P, W, gap); return { cols: [{ x0: L.x0, w: W, n: P.length }], h: one.h, gap }; }
      const w2 = (W - 28) / 2;
      let best = null;
      for (let k = 1; k < P.length; k++) { const h = Math.max(stack(P.slice(0, k), w2, gap).h, stack(P.slice(k), w2, gap).h); if (!best || h < best.h) best = { cols: [{ x0: L.x0, w: w2, n: k }, { x0: L.x0 + w2 + 28, w: w2, n: P.length - k }], h, gap }; }
      return best;
    };
    let plan = null, low = null;
    for (const [dn, gap] of [[false, 22], [false, 14], [false, 8], [true, 10], [true, 6]]) {
      if (dn !== DN) { dense(dn); wcache.clear(); }
      for (const cols of W >= 640 && P.length >= 2 ? [1, 2] : [1]) {
        const c = lay2(gap, cols);
        c.dn = dn;
        if (!low || c.h < low.h) low = c;
        if (c.h <= H) { plan = c; break; }
      }
      if (plan) break;
    }
    plan = plan || low;
    if (plan.dn !== DN) { dense(plan.dn); wcache.clear(); cache.clear(); }
    /* 고른 배치를 다시 쌓는다 — 칸 줄은 폭에 따라 설명을 아래로 모으고(capMode), 그 글이 지금의 글이어야 한다 */
    let i0 = 0;
    for (const col of plan.cols) { const ps = P.slice(i0, i0 + col.n); i0 += col.n; cache.clear(); Object.assign(col, stack(ps, col.w, plan.gap)); }
    plan.h = Math.max(...plan.cols.map((c) => c.h));
    if (plan.h > H + 1) console.error(`wiredtiger ${sc.num} 세계 : 높이 ${Math.round(plan.h)} 가 무대 ${Math.round(H)} 를 넘는다 (${L.W}×${L.H})`);
    const dy = L.narrow ? 0 : Math.max(0, (H - plan.h) / 2);
    G = { L, edges: [] };
    for (const lb of made) place(lb, L.x0, L.y0);
    for (const col of plan.cols) for (const q of col.out) {
      q.p.w = col.w; q.p.g = q.g; q.p.ox = col.x0; q.p.oy = L.y0 + dy + q.y;
      q.p.lay(q.g, q.p.ox, q.p.oy);
      if (q.edge != null) G.edges.push({ x0: col.x0, x1: col.x0 + col.w, y: L.y0 + dy + q.edge });
    }
    if (EDGE && G.edges[0]) place(edgeLb, G.edges[0].x1, G.edges[0].y + 3, 'r', 't');
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * W; dust[i * 2 + 1] = L.y0 + rnd() * H; }
    shown = -2;
  }

  /* ── 자세 ── */
  const show = (p, a2, b2) => U.smooth(U.range(p, a2, b2));
  function anchor(a, s, lb) {
    for (const p of P) if (p.actors.includes(a) && p.anchor) { const r = p.anchor(a, s, lb); if (r) return r; }
    return [G.L.x0 + 20, G.L.y0 + 20];
  }
  function pose(k, p, t, o) {
    if (!G) return;
    const { S, S0, NK } = cur, end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = R.DST[0]; i < R.DST[1]; i++) { o.x[i] = dust[i * 2]; o.y[i] = dust[i * 2 + 1]; o.a[i] = end ? 0.02 : 0.05 * (0.4 + jit[i * 2]); o.h[i] = 0; o.j[i] = 3; o.s[i] = 1; o.c[i] = FAINT; }
    const c = {
      s, prev, end, act, fly, form, dim, p, show,
      mv: show(p, 0.12, 0.42), gone: show(p, 0.1, 0.4),
      src: act ? anchor(act.f, s, act.lb) : null,
      jit: (i, j) => jit[i * 2 + j],
      put(i, x, y, a, h, j, sz, col) { o.x[i] = U.lerp(dust[i * 2], x, form); o.y[i] = U.lerp(dust[i * 2 + 1], y, form); o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = sz; o.c[i] = col; },
      hide1(i) { o.x[i] = dust[i * 2]; o.y[i] = dust[i * 2 + 1]; o.a[i] = 0; o.h[i] = 0; o.j[i] = 2; o.s[i] = 1; o.c[i] = FAINT; },
      hideK(key) { const [a2, b2] = R[key]; for (let i = a2; i < b2; i++) c.hide1(i); },
    };
    for (const pn of P) if (pn.pose) pn.pose(c);
    /* act — 덩어리가 f 에서 t 로 */
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = c.src, [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arcH = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
        o.x[i] = U.lerp(fx, tx2, e) + Math.cos(th) * r; o.y[i] = Math.max(G.L.y0 + 4, U.lerp(fy, ty2, e) + Math.sin(th) * r - arcH);
        o.a[i] = (fly > 0.01 ? 0.95 : 0) * (1 - gone); o.h[i] = 1; o.j[i] = 0.2; o.s[i] = 1.25; o.c[i] = col;
      }
    } else for (let i = t0; i < t1; i++) c.hide1(i);
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = TXS.get(S[Math.min(k, NK - 1)]), TB = TXS.get(S[Math.min(next, NK - 1)]), T = TXS.get(S[kk]);
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const cc of ['gold', 'red', 'green']) lb.el.classList.toggle(cc, cls === cc);
      }
      for (const pn of P) if (pn.place) pn.place(S[kk]);
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis && txt ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    setO(edgeLb, EDGE && G.edges.length ? dimO * 0.42 : 0);
    if (EDGE && edgeLb.t !== EDGE.lb) setText(edgeLb, EDGE.lb);
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, act.lb), [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(show(p, 0.08, 0.42));
      const arcH = act.f === act.t ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arcH - (act.f === act.t ? 30 : 14));
      tok.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form;
    ctx.save(); ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]);
    for (const e of G.edges) seg(ctx, e.x0, e.y, e.x1, e.y);
    ctx.setLineDash([]);
    for (const pn of P) if (pn.over) { ctx.save(); pn.over(ctx, s, o); ctx.restore(); }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') };
    },
    setVary(v) { const b2 = BAKES.get(keyOf(v)); if (b2 && b2 !== cur) { cur = b2; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}

/* 눈금 위 이름표 — 같은 값의 이름표들은 그 눈금을 가운데 둔 한 줄의 띠로 오른쪽 · 왼쪽 끝에 번갈아 붙인다(가운데에 한 줄씩
   쌓으면 13 의 460 에서 다섯 줄이 됐다). 하나뿐이면 가운데, 막히면 옆, 그래도 막히면 윗줄 */
function pack(items, x0, x1, gap = 8) {
  const out = [], by = [];
  for (const it of [...items].sort((p, q) => p.cx - q.cx)) { const g = by.find((b) => Math.abs(b.cx - it.cx) < 2); if (g) g.its.push(it); else by.push({ cx: it.cx, its: [it] }); }
  const free = (l, r, row) => l >= x0 - 0.5 && r <= x1 + 0.5 && !out.some((q) => q.row === row && l < q.r + gap && q.l < r + gap);
  for (const g of by) {
    const strip = [];      /* 줄마다 이 값의 띠 [왼쪽 끝, 오른쪽 끝] */
    for (const it of g.its) {
      let pick = null;
      for (let row = 0; row < 10 && !pick; row++) {
        const sp = strip[row];
        const cands = g.its.length === 1 ? [it.cx - it.w / 2, it.cx + 3, it.cx - 3 - it.w]
          : sp ? (strip.length % 2 ? [sp[1] + gap, sp[0] - gap - it.w] : [sp[0] - gap - it.w, sp[1] + gap]) : [it.cx + 3, it.cx - 3 - it.w];
        for (const l of cands) if (free(l, l + it.w, row)) { pick = { l, r: l + it.w, row }; break; }
      }
      if (!pick) { const l = Math.max(x0, Math.min(x1 - it.w, it.cx - it.w / 2)); pick = { l, r: l + it.w, row: 0 }; }
      const sp = strip[pick.row];
      strip[pick.row] = sp ? [Math.min(sp[0], pick.l), Math.max(sp[1], pick.r)] : [pick.l, pick.r];
      out.push({ ...it, ...pick });
    }
  }
  return { out, rows: out.length ? Math.max(...out.map((q) => q.row)) + 1 : 0 };
}

/* ── 그리기 도구 ── */
function seg(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function arrow(ctx, x0, y0, x1, y1) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  seg(ctx, x0, y0, x1, y1);
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(a - 0.45), y1 - 6 * Math.sin(a - 0.45));
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(a + 0.45), y1 - 6 * Math.sin(a + 0.45)); ctx.stroke();
}
/* 아래로 휜 화살표 — 사슬의 next(새것 → 옛것) */
function arc(ctx, x0, y0, x1, y1, h) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + h, x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - (y0 + h), x1 - (x0 + x1) / 2);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(a - 0.45), y1 - 6 * Math.sin(a - 0.45));
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(a + 0.45), y1 - 6 * Math.sin(a + 0.45)); ctx.stroke();
}
function rim(cx, cy, w, h, n, m) {
  const per = 2 * (w + h), d = (m / n) * per;
  if (d < w) return [cx - w / 2 + d, cy - h / 2];
  if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)];
  if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2];
  return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)];
}
/* 격자 — 줄 수를 내림으로(마지막 줄이 덜 차지 않게). 남는 알갱이는 셋째 값이 false */
function grid(cx, cy, w, h, n, m) {
  const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h)))), rows = Math.max(1, Math.floor(n / cols));
  return [cx - w / 2 + ((m % cols) + 0.5) / cols * w, cy - h / 2 + (Math.floor(m / cols) % rows + 0.5) / rows * h, m < cols * rows];
}
