/* mysql innodb 07 · 08 · mysql locks — 레코드 락과 교착. 그리는 것은 모두 bake 상태에서 읽는다 —
     · 인덱스 = axis 배우. 수직선 위의 레코드 점(items 의 v), 그 위에 잠금 범위(spans) —
       next (a, b] = 왼쪽 빈 원 · 오른쪽 찬 원, gap (a, b) = 양끝 빈 원, rec = 레코드 위의 굵은 점, blk = 기다리는 요청(빨간 화살표)
     · wait-for 그래프 = graph 배우. 노드와 간선, 간선이 이루는 사이클은 세계가 찾아 빨갛게
       이웃한 노드 사이 간선은 곧은 화살표, 사이에 다른 노드가 있는 간선은 설명 아래로 내려가는 ㄷ 자 활(locks 16 — 셋이 A 하나를 기다린다).
       노드 설명에 'w N'(INNODB_TRX.trx_schedule_weight)이 있으면 그 장면의 그래프는 InnoDB 의 blocking_trx 다 — 기다리는 노드는 나가는 간선이
       꼭 하나, 기다리지 않는 노드는 없고, 무게는 1 + 들어오는 간선 시작 노드 무게의 합(CATS 규칙). 어긋나면 console.error
     · 나머지 kv 는 글 블록(SQL 층), 나머지 list 는 칸 줄
     · 셈 맞추기 — next 의 b 가 레코드가 아니거나 a 가 그 바로 앞 레코드(첫 레코드면 축의 시작)가 아니거나, gap 의 양끝이
       이웃한 레코드가 아니거나, rec 가 레코드 위에 있지 않거나, hot 으로 칠한 간선이 사이클 위에 없으면 console.error
       칸 줄의 id 가 data_locks 의 LOCK_MODE · LOCK_DATA 꼴('X 20' · 'X,GAP 50' · 'X,REC_NOT_GAP 30' · 'X,GAP,INSERT_INTENTION 30')이면
       축에 그 모양의 범위가 있어야 한다 — X = next (…, 20], X,GAP = gap (…, 50), X,REC_NOT_GAP = rec 20, INSERT_INTENTION = 그 레코드 앞 gap 안의
       blk · ii. 없으면 console.error (07 — 잰 data_locks 줄과 그림이 어긋나지 않게). 뒤에 ' · A' 처럼 임자를 붙여도 같고(08 — 두 트랜잭션이
       같은 레코드를 하나는 쥐고 하나는 기다린다), sub 에 WAITING 이 있으면 범위 대신 그 레코드의 blk 가 있어야 한다
       글 블록에 tables_locked 가 있으면(03) TABLE LOCKS 의 '표 · 모드' 칸 수와 같아야 한다 — INNODB_TRX 가 세는 것이 그 수다
     · 축은 여럿일 수 있다(locks 05 — idx_c 와 PRIMARY). 배우마다 따로 줄 · 띠 · 이름표를 갖고 cast 순서대로 위에서 아래로 놓인다.
       axis.nm 이 있으면 축 이름 대신 그것을 쓰고(INDEX · idx_c), 항목의 lb 가 있으면 레코드 이름으로 id 대신 그것을 쓰고('200, 20' —
       Lab 은 id 를 쓴다), axis.legend 가 참이면 이름 줄 오른쪽에 그 스텝에 있는 범위 종류의 범례를 이름표와 같은 색으로 적는다
       (들어가지 않으면 아래 줄). 축 하나뿐인 장면의 그림은 축이 하나이던 때와 같다
     · 축이 여럿일 때 data_locks 꼴 칸의 짝 — 칸은 제 INDEX_NAME 의 축에서만 범위를 찾는다(locks 08 — 부모 PRIMARY 와 자식 idx_pid) :
         칸   { id:'S,REC_NOT_GAP 1', index:'PRIMARY' } · { id:'X 1, 10', index:'idx_pid' }  — id 는 'LOCK_MODE LOCK_DATA[ · 임자]',
              LOCK_DATA 가 secondary 의 '키, PK' 여도 되고 첫 수를 축의 v 와 견준다. index = data_locks 의 INDEX_NAME
         축   그 index 에 답하는 축 하나 — axis.index 가 있으면 그것에만, 없으면 배우 열쇠(pk)나 이름(axis.nm, 없으면 배우 nm)을
              공백 · 괄호 · 쉼표로 가른 낱말 하나('PRIMARY  (id)' → PRIMARY, 'INDEX  idx_c  (c, id)' → idx_c)
         축이 하나면 index 를 안 적어도 그 축이다(innodb 07 · 08). 축이 여럿인데 index 가 없거나, 답하는 축이 없거나 둘 이상이거나
         (부모 · 자식 PRIMARY 처럼 — 그때는 axis.index:'parent.PRIMARY' 와 index:'parent.PRIMARY'), 그 축에 맞는 범위가 없으면 console.error
     · 글 블록의 'P_S.data_locks' 가 'N 줄 …' 이면(02 · 02v · 05) N = TABLE LOCKS 의 테이블 락 칸 + 모든 축의 범위(ii 제외 — 기다리지
       않은 insert intention 은 data_locks 에 줄이 없다). 한 글 블록에 SHOW ENGINE INNODB STATUS 의 'N lock struct(s), heap size H,
       M row lock(s)' 줄과 trx_rows_locked 가 함께 있으면 M = trx_rows_locked. 어긋나면 console.error
   손잡이가 있는 장면(07 격리 수준 · 08 innodb_deadlock_detect · 03 innodb_autoinc_lock_mode)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const SL = 44, TOK = 150, RECN = 10, SPN = 40, NODEN = 48, BN = 40, STRIP = 12;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
const SPC = { next: GOLD, gap: ACCENT, rec: INK, blk: RED, ii: GREEN };

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

/* 짝 장면(locks 02 · 02v, 06 · 06v)은 한 세계가 둘을 다 들고 setScene 으로 바꾼다 — Story 는 짝을 바꿔도 세계를 다시 만들지 않는다
   (열쇠가 짝의 A). 둘 다 없었을 때는 V 로 B 를 골라도 A 의 그림이 남았다. 둘은 더 높은 쪽의 높이로 가운데를 맞춘다 —
   제 높이로 맞췄더니 A ↔ B 에서 세계가 10 · 19px 뛰었다 */
function make({ F, deck, labels, scene }) {
  const sc = scene();
  const mate = (deck.SCENES || []).find((s) => s !== sc && (s.num === sc.pair || s.pair === sc.num) && s.steps.length === sc.steps.length);
  const W = new Map([[sc.num, one({ F, deck, labels, sc })]]);
  if (mate) W.set(mate.num, one({ F, deck, labels, sc: mate }));
  let cur = W.get(sc.num);
  return {
    build(L) { const ws = [...W.values()], T = Math.max(...ws.map((w) => w.build(L))); ws.forEach((w) => w.fin(T)); return T; },
    theme() { W.forEach((w) => w.theme()); },
    setScene(n2) { const w = W.get(n2); if (w && w !== cur) { cur.hide(); cur = w; cur.reset(); } },
    setVary(v) { W.forEach((w) => w.setVary(v)); },
    pose: (...a) => cur.pose(...a),
    paint: (...a) => cur.paint(...a),
    overlay: (...a) => cur.overlay(...a),
    dispose() { W.forEach((w) => w.dispose()); },
  };
}

function one({ F, deck, labels, sc }) {
  const N = F.N, A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      const x = st[a] || {};
      if (A[a].kind === 'kv') s[a] = x.kv || {};
      else s[a] = (x.items || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
      if (A[a].kind === 'axis') { s[a + '#ax'] = x.axis || { min: 0, max: 100 }; s[a + '#sp'] = (x.spans || []).map((q) => ({ ...q, id: String(q.id) })); }
      if (A[a].kind === 'graph') s[a + '#e'] = (x.edges || []).map((q) => ({ ...q, id: String(q.id) }));
    }
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k), S0 = read(sc.init);
    BAKES.set(k, { S0, S: frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch)), NK: frames.length });
  }
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const TEXTS = cast.filter((a) => A[a].kind === 'kv');
  /* 축은 여럿일 수 있다 — 05 는 idx_c 와 PRIMARY 를 따로 그린다(두 인덱스의 키가 다르다 : c 와 id) */
  const IXS = cast.filter((a) => A[a].kind === 'axis');
  const GR = cast.find((a) => A[a].kind === 'graph') || null;
  /* bitmap 띠(locks 13) — 배우 정의에 bitmap:true 인 list. Lab 은 칸 줄로 그리고, 여기서는 struct 하나를 page 의 heap_no 띠 하나로 그린다 */
  const BMS = cast.filter((a) => A[a].kind === 'list' && A[a].bitmap);
  const ROWS = cast.filter((a) => (A[a].kind === 'list' || A[a].kind === 'frames') && !A[a].bitmap);
  /* 층 — 배우의 lane 대로 위에서 아래로 : 서버(sql) | 경계 0 | InnoDB 메모리 | 경계 1 | 디스크.
     글 블록을 늘 맨 위에, 경계 0 을 그 바로 아래에 두었더니 MDL QUEUE(lane sql)가 InnoDB 쪽에 그려졌다(locks 01 · 11 · 12),
     경계 1 은 아예 그리지 않아 ROW LOCKS 와 행 (클러스터)(lane disk, '락은 여기 없다') 사이에 선이 없었다(locks 07 · 08 · 09) */
  const laneOf = (a) => (A[a].lane === 'sql' ? 0 : A[a].lane === 'disk' ? 2 : 1);
  const SQLT = TEXTS.filter((a) => laneOf(a) === 0), MEMT = TEXTS.filter((a) => laneOf(a) !== 0);
  const SQLR = ROWS.filter((a) => laneOf(a) === 0), MEMR = ROWS.filter((a) => laneOf(a) === 1), DSKR = ROWS.filter((a) => laneOf(a) === 2);
  const HAS = [SQLT.length + SQLR.length > 0, MEMT.length + MEMR.length + IXS.length + BMS.length + (GR ? 1 : 0) > 0, DSKR.length > 0];
  const EDGE_ON = [HAS[0] && (HAS[1] || HAS[2]), HAS[1] && HAS[2]];
  const ids = (a) => [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  const RECS = Object.fromEntries(IXS.map((X) => [X, ids(X)]));
  const BIDS = Object.fromEntries(BMS.map((a) => [a, ids(a)]));
  /* struct 하나가 세는 것 — bits 는 켜진 heap_no 의 [lo, hi] 들, rep 는 이 띠가 대신하는 같은 모양의 struct 수(13 의 page 6 ‥ 212 × 180) */
  const nBits = (it) => (it.bits || []).reduce((t, [lo, hi]) => t + hi - lo + 1, 0) * (it.rep || 1);
  const SPIDS = Object.fromEntries(IXS.map((X) => [X, [...new Set(all.flatMap((s) => s[X + '#sp'].map((q) => q.id)))]]));
  const NODES = GR ? ids(GR) : [];
  const EIDS = GR ? [...new Set(all.flatMap((s) => s[GR + '#e'].map((q) => q.id)))] : [];
  /* 사이에 다른 노드가 있는 두 노드 사이의 간선(locks 16 — 대기자 셋이 모두 A 를 기다린다)은 곧은 화살표로 그리면 사이 노드를 지나간다.
     그래서 노드 아래, 설명 아래로 내려가는 ㄷ 자 활로 그린다. 활끼리 가로로 겹치면 한 단 더 깊게 — 짧은 것부터 단을 정한다 */
  const arcLv = (s) => {
    const out = new Map(), put = [], on = new Set(GR ? s[GR].map((x) => NODES.indexOf(x.id)) : []);
    const E = GR ? s[GR + '#e'].map((e) => ({ e, a: NODES.indexOf(e.from), b: NODES.indexOf(e.to) })).filter((q) => q.a >= 0 && q.b >= 0) : [];
    for (const q of E.sort((p, r) => Math.abs(p.a - p.b) - Math.abs(r.a - r.b))) {
      const lo = Math.min(q.a, q.b), hi = Math.max(q.a, q.b);
      /* 사이 칸이 비어 있으면(locks 01 의 10 스텝 — C 가 아직 없다) 곧은 화살표로 둔다 */
      let mid = false; for (let j = lo + 1; j < hi; j++) if (on.has(j)) mid = true;
      if (!mid) { out.set(q.e.id, 0); continue; }
      const lv = 1 + Math.max(0, ...put.filter((r) => r.lo < hi && lo < r.hi).map((r) => r.lv));
      put.push({ lo, hi, lv }); out.set(q.e.id, lv);
    }
    return out;
  };
  const ARCMAX = Math.max(0, ...all.map((s) => Math.max(0, ...arcLv(s).values())));
  /* 사이클 위의 간선 — 간선마다, 그 끝에서 출발해 그 시작으로 돌아오는 길이 있으면 */
  const cycleOf = (s) => {
    if (!GR) return new Set();
    const E = s[GR + '#e'], out = new Map(); for (const e of E) { if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e.to); }
    const reach = (a, b) => { const seen = new Set([a]), st = [a]; while (st.length) { const x = st.pop(); if (x === b) return true; for (const y of out.get(x) || []) if (!seen.has(y)) { seen.add(y); st.push(y); } } return false; };
    return new Set(E.filter((e) => reach(e.to, e.from)).map((e) => e.id));
  };

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    const at = `${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    for (const X of IXS) {
      const vs = s[X].map((x) => x.v).sort((p, q) => p - q), ax = s[X + '#ax'];
      const prevOf = (v) => { const j = vs.indexOf(v); return j > 0 ? vs[j - 1] : ax.min; };
      for (const q of s[X + '#sp']) {
        if (q.kind === 'next' && (!vs.includes(q.to) || q.from !== prevOf(q.to))) console.error(`${at} : next-key ${q.id} (${q.from}, ${q.to}] 의 끝이 레코드와 맞지 않는다 — 레코드 ${vs.join(' · ')}`);
        if ((q.kind === 'gap' || q.kind === 'ii') && (!(vs.includes(q.from) || q.from === ax.min) || !vs.includes(q.to) || q.from !== prevOf(q.to))) console.error(`${at} : ${q.kind} ${q.id} (${q.from}, ${q.to}) 의 양끝이 이웃한 레코드가 아니다`);
        if (q.kind === 'rec' && (q.from !== q.to || !vs.includes(q.to))) console.error(`${at} : 레코드 락 ${q.id} 가 레코드 위에 있지 않다 (${q.from}–${q.to})`);
      }
    }
    if (IXS.length) {
      /* 줄은 제 INDEX_NAME 의 축에서만 찾는다(locks 08 — 부모 PRIMARY 와 자식 idx_pid). 어느 축에든 맞으면 된다고 두었더니
         idx_c 라고 적은 'X,REC_NOT_GAP 20' 이 PRIMARY 의 rec 20 에 맞아 지나갔다(망가뜨린 사본). 줄의 index 가 INDEX_NAME 이고, 축은 axis.index 가 있으면
         그것에만, 없으면 배우 열쇠나 이름(axis.nm · 배우 nm)의 낱말에 답한다. 축이 하나면 index 없이도 그 축이다 */
      const answers = (X, n) => { const ax = s[X + '#ax']; return ax.index ? ax.index === n : X === n || String(ax.nm || A[X].nm).split(/[\s(),]+/).includes(n); };
      const fits = (X, m, it) => {
        const vs = s[X].map((x) => x.v).sort((p, q) => p - q), ax = s[X + '#ax'], sp = s[X + '#sp'];
        const prevOf = (v) => { const j = vs.indexOf(v); return j > 0 ? vs[j - 1] : ax.min; };
        const v = +m[5];
        return m[4] ? sp.some((q) => (q.kind === 'blk' || q.kind === 'ii') && vs.includes(v) && q.from > prevOf(v) && q.from < v)
          : /WAITING/.test(it.sub || '') ? sp.some((q) => q.kind === 'blk' && q.from === v && q.to === v)
          : m[3] ? sp.some((q) => q.kind === 'rec' && q.to === v)
          : m[2] ? sp.some((q) => q.kind === 'gap' && q.to === v)
          : sp.some((q) => q.kind === 'next' && q.to === v);
      };
      for (const r of ROWS) for (const it of s[r]) {
        /* LOCK_DATA 는 PRIMARY 면 '20', secondary 면 '200, 20'(키, PK) — 첫 수를 축의 v 와 견준다 */
        const m = /^([XS])(,GAP)?(,REC_NOT_GAP)?(,INSERT_INTENTION)?\s+(\d+)(?:,\s*\d+)*(?:\s+·\s+\S+)?$/.exec(it.id);
        if (!m) continue;
        const ix = it.index == null ? null : String(it.index);
        const hit = ix == null ? (IXS.length === 1 ? IXS : []) : IXS.filter((X) => answers(X, ix));
        if (ix == null && IXS.length > 1) console.error(`${at} : 축이 ${IXS.length} 개(${IXS.join(' · ')})인데 data_locks 줄 ${it.id} 에 index(INDEX_NAME) 가 없다`);
        else if (!hit.length) console.error(`${at} : data_locks 줄 ${it.id} 의 index ${ix} 에 답하는 축이 없다 — 축 ${IXS.map((X) => s[X + '#ax'].index || s[X + '#ax'].nm || A[X].nm).join(' · ')}`);
        else if (hit.length > 1) console.error(`${at} : data_locks 줄 ${it.id} 의 index ${ix} 에 축 ${hit.join(' · ')} 가 다 답한다 — axis.index 로 가르라`);
        else if (!fits(hit[0], m, it)) console.error(`${at} : data_locks 줄 ${it.id} 에 맞는 범위가 ${hit[0]} 축(${ix ?? '하나뿐'})에 없다`);
      }
    }
    if (GR) { const cyc = cycleOf(s); for (const e of s[GR + '#e']) if (e.hot && !cyc.has(e.id)) console.error(`${at} : hot 간선 ${e.id} 가 사이클 위에 없다`); }
    /* 16 — 노드 설명에 'w N'(INNODB_TRX.trx_schedule_weight)이 있으면 그래프는 InnoDB 의 wait-for(trx->lock.blocking_trx)다 :
       기다리는 노드마다 나가는 간선이 꼭 하나, 무게는 lock_wait_compute_and_publish_weights_except_cycles 의 규칙대로
       1 + (그 노드로 들어오는 간선의 시작 노드 무게의 합). 잰 무게와 그린 간선이 어긋나면 console.error */
    if (GR && s[GR].some((it) => /(^|\s)w \d+/.test(it.sub))) {
      const E = s[GR + '#e'], wOf = (id) => { const it = s[GR].find((x) => x.id === id), m = it && /(?:^|\s)w (\d+)/.exec(it.sub); return m ? +m[1] : null; };
      for (const it of s[GR]) {
        const outN = E.filter((e) => e.from === it.id).length;
        if (it.tag === 'wait' && outN !== 1) console.error(`${at} : 기다리는 노드 ${it.id} 의 간선이 ${outN} 개 — blocking_trx 는 하나다`);
        if (it.tag !== 'wait' && outN) console.error(`${at} : 기다리지 않는 노드 ${it.id} 에서 간선이 나간다`);
        const w = wOf(it.id); if (w == null) continue;
        if (it.tag !== 'wait') { console.error(`${at} : 기다리지 않는 노드 ${it.id} 에 무게 w ${w} — 무게는 기다리는 trx 에만 실린다`); continue; }
        const want = 1 + E.filter((e) => e.to === it.id).reduce((t, e) => t + (wOf(e.from) ?? 1), 0);
        if (w !== want) console.error(`${at} : ${it.id} 의 w ${w} 인데 들어오는 간선으로 세면 ${want}`);
      }
    }
    /* 13 — bitmap 띠. n bits 는 RecLock::lock_size 의 규칙 8 × (1 + (n_heap + 64) / 8) 이어야 하고(STATUS 의 'n bits 624' 와 ibdpage 의
       PAGE_N_HEAP 555 를 따로 적으므로 둘이 어긋나면 하나가 틀렸다), 켜진 bit 는 그 page 의 heap_no 0 ‥ n_heap − 1 안이어야 한다.
       같은 trx · page · mode 의 struct 가 같은 크기로 둘이면 틀렸다 — lock_rec_add_to_queue 와 lock_rec_lock_fast 는 그때 bit 만 켠다 */
    for (const a of BMS) {
      const seen = new Map();
      for (const it of s[a]) {
        const nb = 8 * (1 + Math.floor((it.nheap + 64) / 8));
        if (it.nbits !== nb) console.error(`${at} : ${it.id} 의 n bits ${it.nbits} — n_heap ${it.nheap} 이면 규칙 8 × (1 + (n_heap + 64) / 8) 로 ${nb}`);
        for (const [lo, hi] of it.bits || []) if (!(lo >= 0 && lo <= hi && hi < it.nheap)) console.error(`${at} : ${it.id} 의 bit ${lo} ‥ ${hi} 가 heap_no 0 ‥ ${it.nheap - 1} 밖이다`);
        const k = `${it.trx} · ${it.page} · ${it.mode} · ${it.nbits}`;
        if (seen.has(k)) console.error(`${at} : ${seen.get(k)} 와 ${it.id} 는 같은 trx · page · mode · 크기 — struct 하나에 bit 만 켜졌어야 한다`);
        seen.set(k, it.id);
      }
    }
    /* 13 — 글 블록에 'trx' 와 STATUS 의 'N lock struct(s) … M row lock(s)' 가 함께 있으면, 그 trx 의 N = TABLE LOCKS 에서 그 trx 번호로 끝나는
       칸 + 그 trx 의 bitmap struct 수(rep 포함), M = 그 struct 들의 켜진 bit 수. 'trx_lock_structs K' 가 있으면 K = N */
    if (BMS.length) for (const t of TEXTS) {
      const kv = s[t], tr = /\d+/.exec(bare(kv['trx'] ?? ''));
      if (!tr) continue;
      for (const [k, v] of Object.entries(kv)) {
        const m = /(\d+) lock struct\(s\), heap size (\d+), (\d+) row lock\(s\)/.exec(bare(v)); if (!m) continue;
        const mine = BMS.flatMap((a) => s[a]).filter((it) => String(it.trx) === tr[0]);
        const tbl = ROWS.filter((a) => A[a].nm === 'TABLE LOCKS').flatMap((a) => s[a]).filter((it) => it.tag !== 'free' && new RegExp(`(^|\\D)${tr[0]}$`).test(it.id)).length;
        const ns = tbl + mine.reduce((p, it) => p + (it.rep || 1), 0), nr = mine.reduce((p, it) => p + nBits(it), 0);
        if (+m[1] !== ns) console.error(`${at} : ${k} 의 ${m[1]} lock struct(s) 인데 그림은 trx ${tr[0]} 의 테이블 락 ${tbl} + bitmap struct ${ns - tbl}`);
        if (+m[3] !== nr) console.error(`${at} : ${k} 의 ${m[3]} row lock(s) 인데 trx ${tr[0]} 의 bitmap 에 켜진 bit 는 ${nr}`);
        const ks = /trx_lock_structs\s+(\d+)/.exec(bare(kv['trx_rows_locked'] ?? ''));
        if (ks && +ks[1] !== +m[1]) console.error(`${at} : trx_lock_structs ${ks[1]} 와 STATUS 의 ${m[1]} lock struct(s) 가 다르다`);
      }
    }
    /* 03 — 글 블록의 tables_locked 는 INNODB_TRX.trx_tables_locked = lock_number_of_tables_locked 다. 테이블 수가 아니라 trx 가 쥔
       테이블 락 수(같은 t 의 IS · IX 는 2, AUTO_INC 도 하나)이므로, TABLE LOCKS 칸 가운데 '표 · 모드' 꼴('t · IS' · 'a · AUTO_INC')의 수와 같아야 한다 */
    for (const t of TEXTS) {
      const raw = s[t]['tables_locked']; if (raw == null) continue;
      const n = Number(bare(raw).trim().split(/\s/)[0]);
      const have = ROWS.filter((a) => A[a].nm === 'TABLE LOCKS').flatMap((a) => s[a]).filter((it) => it.tag !== 'free' && /^\S+ · (IS|IX|S|X|AUTO_INC)$/.test(it.id)).length;
      if (n !== have) console.error(`${at} : tables_locked ${n} 인데 TABLE LOCKS 의 테이블 락 칸은 ${have} 개다`);
    }
    /* 02 · 05 — 글 블록의 'P_S.data_locks' 는 잰 data_locks 의 줄 수다(모든 trx). 그림이 그 줄을 다 그려야 한다 : TABLE LOCKS 의
       테이블 락 칸 + 축들의 범위 하나하나(next · gap · rec · blk. ii 는 빼고 센다 — 기다리지 않은 insert intention 은 lock 을 만들지 않아
       data_locks 에 줄이 없다) */
    for (const t of TEXTS) {
      const raw = s[t]['P_S.data_locks']; if (raw == null) continue;
      const n = parseInt(bare(raw), 10);
      const tbl = ROWS.filter((a) => A[a].nm === 'TABLE LOCKS').flatMap((a) => s[a]).filter((it) => it.tag !== 'free').length;
      /* 13 — bitmap 의 켜진 bit 하나가 data_locks 의 한 줄이다(p_s.cc 는 struct 가 아니라 bit 마다 줄을 낸다) */
      const rec = IXS.flatMap((X) => s[X + '#sp']).filter((q) => q.kind !== 'ii').length + BMS.flatMap((a) => s[a]).reduce((p, it) => p + nBits(it), 0);
      if (n !== tbl + rec) console.error(`${at} : P_S.data_locks ${n} 줄인데 그림은 테이블 락 ${tbl} + 레코드 락 ${rec}`);
    }
    /* SHOW ENGINE INNODB STATUS 의 'N lock struct(s), heap size H, M row lock(s)' 와 INNODB_TRX.trx_rows_locked 는 같은 trx 의
       lock_number_of_rows_locked 를 읽는다 — 한 글 블록에 둘이 함께 있으면 M 과 trx_rows_locked 가 같아야 한다 */
    for (const t of TEXTS) {
      const kv = s[t], rl = kv['trx_rows_locked']; if (rl == null) continue;
      for (const [k, v] of Object.entries(kv)) {
        const m = /(\d+) lock struct\(s\), heap size (\d+), (\d+) row lock\(s\)/.exec(bare(v));
        if (m && +m[3] !== parseInt(bare(rl), 10)) console.error(`${at} : ${k} 의 row lock(s) ${m[3]} 와 trx_rows_locked ${bare(rl)} 가 다르다`);
      }
    }
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  for (const X of IXS) { take('line:' + X, 60); RECS[X].forEach((id) => take('r:' + X + ':' + id, RECN)); SPIDS[X].forEach((id) => take('s:' + X + ':' + id, SPN)); }
  NODES.forEach((id) => take('n:' + id, NODEN));
  if (GR) take('edges', 80);
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  for (const a of BMS) BIDS[a].forEach((id) => take('b:' + a + ':' + id, BN));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb lock 세계 : 알갱이가 모자란다');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') { const el = document.createElement('div'); el.className = 'wl ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; }
  function setText(lb, s, html = false) { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls)); }
  function place(lb, x, y, al = 'l', va = 't') { const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%'; lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`; }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const EDG = deck.EDGES || [];
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const recLb = Object.fromEntries(IXS.map((X) => [X, Object.fromEntries(RECS[X].map((id) => [id, label('aq aq-c')]))]));
  const spLb = Object.fromEntries(IXS.map((X) => [X, Object.fromEntries(SPIDS[X].map((id) => [id, label('aq')]))]));
  /* 범례 — axis.legend 가 켜진 축만. 그 스텝에 있는 범위 종류만, 이름표와 같은 색으로 */
  const lgLb = Object.fromEntries(IXS.map((X) => [X, label('aq')]));
  const LEG = { next: ['q-g', 'next-key (a, b]'], gap: ['', 'gap (a, b)'], rec: ['q-gr', '레코드만'], blk: ['q-r', '▼ 대기'], ii: ['q-gr', 'insert intention'] };
  const legendOf = (s, X) => (s[X + '#ax'].legend ? ['next', 'gap', 'rec', 'blk', 'ii'].filter((k) => s[X + '#sp'].some((q) => q.kind === k)).map((k) => `<span class="${LEG[k][0]}">${LEG[k][1]}</span>`).join('  ·  ') : '');
  const nLb = Object.fromEntries(NODES.map((id) => [id, { n: label('aq aq-c'), v: label('aq aq-c') }]));
  const eLb = Object.fromEntries(EIDS.map((id) => [id, label('aq')]));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  /* bitmap 띠의 이름(왼쪽, struct 의 id)과 셈(오른쪽, sub) */
  const bmL = Object.fromEntries(BMS.map((a) => [a, Object.fromEntries(BIDS[a].map((id) => [id, label('aq')]))]));
  const bmR = Object.fromEntries(BMS.map((a) => [a, Object.fromEntries(BIDS[a].map((id) => [id, label('aq')]))]));
  const edgeLb = EDG.map(() => label('aq')), tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || []), ...((c.span && [...c.span.add, ...c.span.mod]) || []), ...((c.edge && [...c.edge.add, ...c.edge.mod]) || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], focusOf(s, a)), on(a), '', true, true]);
    for (const X of IXS) {
      /* 축 이름 — 데이터의 axis.nm 이 있으면 그것(05 의 INDEX · idx_c) */
      t.set(hd[X], [s[X + '#ax'].nm || A[X].nm, on(X)]);
      const lg = legendOf(s, X); t.set(lgLb[X], [lg, on(X), '', !!lg, true]);
      /* 레코드 이름 — 항목의 lb 가 있으면 그것(05 의 '200, 20'). Lab 은 id 를 쓰는데 768 의 좁은 카드에서 '200, 20' 셋은 겹쳤다 */
      for (const id of RECS[X]) { const it = s[X].find((x) => x.id === id); t.set(recLb[X][id], [it ? it.lb || id : '', on(X), '', !!it]); }
      for (const id of SPIDS[X]) { const q = s[X + '#sp'].find((x) => x.id === id); t.set(spLb[X][id], [q ? q.lb || '' : '', !!q && on(X) && hotIt(s, X, id), q ? (q.kind === 'blk' ? 'red' : q.kind === 'next' ? 'gold' : q.kind === 'rec' || q.kind === 'ii' ? 'green' : '') : '', !!q && !!q.lb]); }
    }
    if (GR) {
      const cyc = cycleOf(s);
      for (const id of NODES) { const it = s[GR].find((x) => x.id === id); t.set(nLb[id].n, [it ? id : '', on(GR) && !!it && hotIt(s, GR, id), it && it.tag === 'x' ? 'red' : '', !!it]); t.set(nLb[id].v, [it ? it.sub : '', on(GR) && !!it, it && it.tag === 'x' ? 'red' : '', !!it && !!it.sub]); }
      /* 간선 이름(대기)은 그리지 않는다 — 제목이 '화살표 = 기다린다' 를 적는다 */
      for (const id of EIDS) t.set(eLb[id], ['', false, '', false]);
      t.set(hd[GR], [`${A[GR].nm}  ·  화살표 = 기다린다${cyc.size ? '  ·  사이클' : ''}`, on(GR), cyc.size ? 'red' : '']);
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && it.tag === 'x' ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    for (const a of BMS) for (const id of BIDS[a]) {
      const it = s[a].find((x) => x.id === id), hot = on(a) && !!it && hotIt(s, a, id), cls = it && it.tag === 'wait' ? 'red' : '';
      t.set(bmL[a][id], [it ? id : '', hot, cls, !!it]); t.set(bmR[a][id], [it ? it.sub || '' : '', hot, cls, !!it && !!it.sub]);
    }
    EDG.forEach((e, i) => t.set(edgeLb[i], [e.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === e.hot ? 'gold' : '', !!EDGE_ON[i]]));
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => { let w = 0, h = 0; const keep = lb.el.innerHTML; for (const t of TXALL) { const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); } lb.el.innerHTML = keep; return { w, h }; };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(59);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15, SROW = 22;
  const ixX = (s, X, v) => { const ax = s[X + '#ax'], g = G.ix[X]; return g.x0 + ((v - ax.min) / (ax.max - ax.min)) * (g.x1 - g.x0); };
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {}, ix: Object.fromEntries(IXS.map((X) => [X, { x0: L.x0 + 14, x1: L.x1 - 14 }])), barY: {} };
    /* 글 블록의 격자 — 층마다 따로(서버 층의 SESSION · STATEMENT, InnoDB 층의 READ VIEW) */
    const grid = (list) => {
      let tn = Math.max(1, Math.min(3, list.length));
      while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
      const tW = (ww - (tn - 1) * gap) / tn;
      for (const a of list) wrap(tx[a], tW);
      const tRows = Math.ceil(list.length / tn);
      return { list, tn, tW, tRows, tHs: Array.from({ length: tRows }, (_, r) => hMax(list.slice(r * tn, r * tn + tn).map((a) => tx[a]))) };
    };
    const GT = [grid(SQLT), grid(MEMT)];
    /* 범위의 줄 — 데이터의 row(0 이 수직선에 가깝다). 이름표는 그 줄의 막대 위에서 줄 나누기 —
       같은 줄의 (10,20] 과 (20,30] 이름표가 겹쳤다. 줄마다 이름표가 쌓인 만큼 띠를 높인다 */
    const nRow = Object.fromEntries(IXS.map((X) => [X, Math.max(1, ...all.flatMap((s) => s[X + '#sp'].map((q) => (q.row ?? 0) + 1)))]));
    const lrows = Object.fromEntries(IXS.map((X) => [X, Array(nRow[X]).fill(1)]));
    if (IXS.length) for (const b of BAKES.values()) b.SPL = b.S.map((s, kk) => {
      const T = b.TX[kk], wOf = (lb) => { const e = T.get(lb); const h = e && e[3] !== false ? e[0] : ''; if (!h) return 0; const keep = lb.el.innerHTML; lb.el.innerHTML = h; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };
      const out = {};
      for (const X of IXS) {
        out[X] = {};
        for (let r = 0; r < nRow[X]; r++) {
          const qs = s[X + '#sp'].filter((q) => (q.row ?? 0) === r).map((q) => { const xa = ixX(s, X, q.from), xb = ixX(s, X, q.to), w = wOf(spLb[X][q.id]), dot = q.kind === 'rec' || q.kind === 'blk'; return { id: q.id, cx: dot ? xa + 9 + w / 2 : (xa + xb) / 2, pins: [dot ? xa : (xa + xb) / 2], w }; }).filter((q) => q.w);
          const st = stagger(qs, L.x0, L.x1);
          lrows[X][r] = Math.max(lrows[X][r], st.rows);
          for (const q of st.out) out[X][q.id] = q;
        }
      }
      return out;
    });
    const bandH = Object.fromEntries(IXS.map((X) => [X, lrows[X].map((n) => 16 + n * RH)]));
    /* 범례가 축 이름 줄의 오른쪽에 들어가지 않으면 그 아래 줄에. 그 줄이 경계 0 의 이름표('MDL → INNODB', 오른쪽 끝)와 같은 높이면
       범례는 그 이름표 왼쪽에서 끝난다 — 1280×720 의 05 에서 축이 경계 바로 아래에 붙자 범례가 그 이름표를 덮었다 */
    const hdW = Object.fromEntries(IXS.map((X) => [X, most(hd[X]).w])), lgW = Object.fromEntries(IXS.map((X) => [X, most(lgLb[X]).w]));
    const eb0 = EDG[0] && EDGE_ON[0] ? most(edgeLb[0]) : null;
    /* 그래프 — 노드는 가로로, 칸 폭은 이름표만큼 */
    /* 노드 폭 — 설명이 한 줄로 들어가는 폭, 단 무대에 노드가 다 들어가는 폭까지. 넘치면 설명은 줄을 바꾼다 */
    const NG = 70, nCap = GR ? (ww - (NODES.length - 1) * NG) / Math.max(1, NODES.length) : 0;
    const nw = GR ? Math.min(nCap, Math.max(90, ...NODES.map((id) => Math.max(most(nLb[id].n).w, most(nLb[id].v).w) + 18))) : 0;
    if (GR) for (const id of NODES) wrap(nLb[id].v, nw - 10);
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    /* 그래프와 InnoDB 층의 첫 칸 줄은 나란히 — 반 폭에 들어갈 때 */
    const rc = ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    /* 칸 줄의 폭 — 한 상태에 함께 있는 칸들의 폭 중 가장 넓은 것. 줄이 가진 적 있는 id 를 모두 더했더니 '(비었다)' 처럼
       다른 칸과 함께 있지 않는 자리 칸까지 더해져, 설명이 칸 끝에서 150 – 480px 떨어졌다(locks 03 · 05 · 06 · 06v · 07) */
    const usedW = (a) => Math.max(0, ...all.map((s) => s[a].reduce((t, x) => t + sw[a][x.id] + 6, -6)));
    const side = GR && rc > 1 && NODES.length * (nw + NG) - NG <= rW && MEMR.length && usedW(MEMR[0]) <= rW;
    const sideR = side ? MEMR[0] : null;
    G.ng = NG;
    if (GR && NODES.length * (nw + NG) - NG > ww + 1) console.error(`innodb ${sc.num} 세계 : 그래프가 무대보다 넓다 (${L.W}×${L.H})`);
    /* 칸 줄이 제 폭(W0)을 넘으면 다음 줄로 — 한 줄에 다 들어가는 상태는 전과 같은 자리다. 줄 수는 가장 많이 접히는 상태의 것.
       접지 않던 동안 1024×768 에서 칸 다섯 개 · 스무 자쯤이 한계라 데이터 쪽에서 글을 줄였다 */
    const RL = 26 + 6;
    const wrapN = (s, a, W0) => { let x = 0, n = 1; for (const it of s[a]) { const w = sw[a][it.id]; if (x > 0 && x + w > W0 + 0.5) { n++; x = 0; } x += w + 6; } return n; };
    const rcH = {}, rSide = {}, rN = {}, rW0 = {};
    for (const a of ROWS) { rW0[a] = a === sideR ? rW : ww; rN[a] = Math.max(1, ...all.map((s) => wrapN(s, a, rW0[a]))); }
    for (const a of ROWS) {
      const W0 = a === sideR ? rW : ww, used = usedW(a), sideW = W0 - used - 12;
      wrap(rowCap[a], W0); const hb = most(rowCap[a]).h;
      let hs = Infinity; if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      rSide[a] = Math.max(26, hs) < 26 + 8 + hb ? used + 12 : 0; if (!rSide[a]) wrap(rowCap[a], W0);
      rcH[a] = rSide[a] ? hs : hb;
    }
    const nvH = GR ? hMax(NODES.map((id) => nLb[id].v)) : 0;
    /* bitmap 띠 한 줄 — 이름 줄(이름과 셈이 한 줄에 들어가지 않으면 두 줄), 3px, 띠, 아래 10px. 항목 수는 가장 많은 상태의 것 */
    const BMG = Object.fromEntries(BMS.map((a) => {
      const wl = Math.max(0, ...BIDS[a].map((id) => most(bmL[a][id]).w)), wr = Math.max(0, ...BIDS[a].map((id) => most(bmR[a][id]).w));
      const lh = hMax([...BIDS[a].map((id) => bmL[a][id]), ...BIDS[a].map((id) => bmR[a][id])]), two = wl + wr + 16 > ww;
      return [a, { lh, two, rh: (two ? 2 : 1) * lh + 3 + STRIP + 10, n: Math.max(1, ...all.map((s) => s[a].length)) }];
    }));
    const lay = (y0, k = 1) => {
      let y = y0;
      const texts = (g) => {
        const rowY = [y]; for (let r = 0; r < g.tRows; r++) rowY.push(rowY[r] + HD + g.tHs[r] + 12 * k);
        g.list.forEach((a, i) => { const x = L.x0 + (i % g.tn) * (g.tW + gap), yy = rowY[Math.floor(i / g.tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + g.tW - 18, y: yy + 8 }; });
        y = rowY[g.tRows];
      };
      const placeGraph = (x0, yy) => { place(hd[GR], x0, yy); G.gr = { x0, y: yy + HD + 15, nw, nvH }; G.anc[GR] = { x: x0 + nw / 2, y: yy + HD + 15 }; return HD + 30 + 6 + nvH + 6 + (ARCMAX ? 9 * (ARCMAX - 1) + 6 : 0); };
      const rows = (list) => {
        for (const a of list) {
          const x0 = a === sideR ? L.x0 + rW + gap : L.x0;
          place(hd[a], x0, y); G.slot[a] = { x0, y: y + HD, sw: sw[a], W0: rW0[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + 13 };
          let hh;
          if (rSide[a]) { G.cap[a] = y + HD + 4; place(rowCap[a], x0 + rSide[a], G.cap[a]); hh = HD + Math.max(26, rcH[a] + 4); }
          else { const ex = (rN[a] - 1) * RL; G.cap[a] = null; place(rowCap[a], x0, y + HD + 26 + 8 + ex); hh = HD + 26 + 8 + ex + rcH[a]; }
          if (a === sideR) hh = Math.max(hh, placeGraph(L.x0, y));
          y += hh + 14 * k;
        }
      };
      const edge = (i) => { if (!EDGE_ON[i] || !EDG[i]) return; y += (i ? 4 : 2) * k; G.edgeY[i] = y; place(edgeLb[i], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; };
      G.edgeY = [null, null]; G.cap = {}; G.bm = {};
      texts(GT[0]); rows(SQLR);
      edge(0);
      texts(GT[1]);
      for (const X of IXS) {
        place(hd[X], L.x0, y);
        const xr = eb0 && G.edgeY[0] != null && y < G.edgeY[0] + 2 + eb0.h + 2 ? L.x1 - eb0.w - 16 : L.x1;
        if (hdW[X] + lgW[X] + 16 > xr - L.x0) { place(lgLb[X], L.x0, y + HD); y += HD; } else place(lgLb[X], xr, y, 'r', 't');
        y += HD + 6;
        const g = G.ix[X], bh = bandH[X];
        g.top = y; y += bh.reduce((p, q) => p + q, 0) + 6; g.y = y; G.anc[X] = { x: L.x0 + ww / 2, y }; y += 10 + 16 + 10 * k;
        /* 줄 r 의 막대 y — 수직선에서 위로 띠를 쌓는다 */
        G.barY[X] = bh.map((_, r) => g.y - 12 - bh.slice(0, r).reduce((p, q) => p + q, 0));
      }
      rows(MEMR);
      for (const a of BMS) { place(hd[a], L.x0, y); G.bm[a] = { ...BMG[a], y0: y + HD }; G.anc[a] = { x: L.x0 + 30, y: y + HD + BMG[a].lh + 3 + STRIP / 2 }; y += HD + BMG[a].n * BMG[a].rh + 4 * k; }
      if (GR && !side) y += placeGraph(L.x0, y) + 10 * k;
      edge(1);
      rows(DSKR);
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`innodb ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    G.lay = lay; G.k = k; G.total = total;
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
    return total;
  }
  /* 가운데 맞추기 — T 는 짝까지 본 높이 */
  function fin(T) {
    const { L } = G, dy = L.narrow ? 0 : Math.max(0, (L.y1 - L.y0 - Math.max(G.total, T)) / 2);
    if (dy) G.lay(L.y0 + dy, G.k);
    shown = -2;
  }
  const rowSlot = (s, a, id) => { const g = G.slot[a]; let x = 0, n = 0; for (const it of s[a]) { const w = g.sw[it.id]; if (x > 0 && x + w > g.W0 + 0.5) { n++; x = 0; } if (it.id === id) return { x: g.x0 + x + w / 2, y: g.y + 13 + n * (26 + 6), w }; x += w + 6; } return null; };
  const nodeAt = (s, id) => { const j = NODES.indexOf(id); return j < 0 ? null : { x: G.gr.x0 + G.gr.nw / 2 + j * (G.gr.nw + G.ng), y: G.gr.y }; };
  /* 간선 — 두 노드 사이의 곧은 화살표. 오른쪽으로 가는 것은 위, 왼쪽으로 가는 것은 아래 */
  const edgeLine = (s, e) => {
    const A0 = nodeAt(s, e.from), B0 = nodeAt(s, e.to); if (!A0 || !B0) return null;
    const rt = B0.x > A0.x, sg = rt ? 1 : -1, lv = arcLv(s).get(e.id) || 0;
    if (!lv) { const y = A0.y + (rt ? -6 : 6), xa = A0.x + sg * (G.gr.nw / 2 + 4), xb = B0.x - sg * (G.gr.nw / 2 + 4); return { xa, xb, y, rt }; }
    /* ㄷ 자 활 — 다리는 노드 사이 틈에, 바닥은 설명 아래 단마다 9px 씩 */
    const off = G.gr.nw / 2 + 10 + 8 * (lv - 1), xa = A0.x + sg * off, xb = B0.x - sg * off, y0 = A0.y + 15, y1 = A0.y + 21 + G.gr.nvH + 6 + 9 * (lv - 1);
    return { arc: true, xa, xb, y: y0, y1, rt };
  };
  /* 간선 위의 점 u ∈ [0, 1] — 곧은 것은 선분, 활은 내려가는 다리 · 바닥 · 올라가는 다리를 길이대로 */
  const edgeAt = (ln, u) => {
    if (!ln.arc) return [U.lerp(ln.xa, ln.xb, u), ln.y];
    const h = ln.y1 - ln.y, w = Math.abs(ln.xb - ln.xa), d = u * (2 * h + w);
    if (d < h) return [ln.xa, ln.y + d];
    if (d < h + w) return [U.lerp(ln.xa, ln.xb, (d - h) / w), ln.y1];
    return [ln.xb, ln.y1 - (d - h - w)];
  };
  const spY = (X, q) => G.barY[X][q.row ?? 0];
  /* bitmap 띠 — j 번째 항목의 이름 줄 y, 띠의 위 y, bit 하나의 폭 */
  const bmAt = (s, a, id) => { const j = s[a].findIndex((x) => x.id === id); if (j < 0) return null; const g = G.bm[a], it = s[a][j], ry = g.y0 + j * g.rh; return { it, ry, sy: ry + (g.two ? 2 : 1) * g.lh + 3, bw: (G.L.x1 - G.L.x0) / it.nbits }; };
  function anchor(a, s, lbText) {
    if (IXS.includes(a) && G.ix[a].y) {
      /* 이름표의 수 가운데 그 축의 범위 안에 드는 첫 수 — 05 의 '200 → id=20' 은 idx_c 축에서 200, PRIMARY 축에서 20 이다
         — 첫 수만 보면 PRIMARY 축에서는 200 이 축 밖이다 */
      const ax = s[a + '#ax'], v = ((lbText || '').match(/\d+/g) || []).map(Number).find((x) => x >= ax.min && x <= ax.max);
      if (v != null) return [ixX(s, a, v), G.ix[a].y];
    }
    if (a === GR && G.gr) { const id = NODES.find((x) => (lbText || '').includes(x)) || [...modOf(s, GR)].find((x) => NODES.includes(x)); const P = id ? nodeAt(s, id) : null; if (P) return [P.x, P.y]; }
    if (ROWS.includes(a)) { const id = RIDS[a].find((x) => (lbText || '').includes(x)) || [...modOf(s, a)][0]; const P = id ? rowSlot(s, a, id) : null; if (P) return [P.x, P.y]; }
    /* bitmap — 이름표가 가리키는 struct(없으면 이 스텝에 바뀐 것)의 첫 켜진 bit */
    if (BMS.includes(a) && G.bm[a]) { const id = BIDS[a].find((x) => (lbText || '').includes(x)) || [...modOf(s, a)].find((x) => BIDS[a].includes(x)); const P = id ? bmAt(s, a, id) : null; if (P) { const lo = ((P.it.bits || [])[0] || [0])[0]; return [G.L.x0 + (lo + 0.5) * P.bw, P.sy + STRIP / 2]; } }
    const P = G.anc[a];
    return P ? [P.x, P.y] : [G.L.x0, G.L.y0];
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  function rim(cx, cy, w, h, n, m) { const per = 2 * (w + h), d = (m / n) * per; if (d < w) return [cx - w / 2 + d, cy - h / 2]; if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)]; if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2]; return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)]; }
  let O = null;
  const hide = (k) => { const [a, b] = R[k]; for (let i = a; i < b; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const { S, S0, NK } = cur, end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const src = act ? anchor(act.f, s, act.lb) : null;
    for (const X of IXS) {
      const on = s.touch.has(X) && !end, g = G.ix[X];
      { const [l0, l1] = R['line:' + X]; for (let i = l0; i < l1; i++) { const u = (i - l0) / (l1 - l0 - 1), [xx, yy] = into(i, U.lerp(g.x0, g.x1, u), g.y); put(o, i, xx, yy, (on ? 0.6 : 0.35) * dim * form, 0, 0.02, 1, INK); } }
      /* 레코드 — 수직선 위의 점, 새로 들어온 레코드(INSERT 25)는 금빛 */
      for (const id of RECS[X]) {
        const key = 'r:' + X + ':' + id, [r0] = R[key], it = s[X].find((x) => x.id === id), pv = prev[X].find((x) => x.id === id);
        if (!it) { hide(key); continue; }
        const born = !pv && !end;
        for (let m = 0; m < RECN; m++) { const i = r0 + m, th = (m / RECN) * Math.PI * 2, [xx, yy] = into(i, ixX(s, X, it.v) + Math.cos(th) * 3.2, g.y + Math.sin(th) * 3.2); put(o, i, xx, yy, (on ? 0.95 : 0.6) * dim * form, born ? 0.5 : 0, 0.02, 1.4, born ? GOLD : INK); }
      }
      /* 잠금 범위 — 막대 + 끝의 원(빈 원 = 열린 끝, 찬 원 = 닫힌 끝) */
      for (const id of SPIDS[X]) {
        const key = 's:' + X + ':' + id, [s0] = R[key], q = s[X + '#sp'].find((x) => x.id === id), pq = prev[X + '#sp'].find((x) => x.id === id);
        if (!q && !(pq && !end)) { hide(key); continue; }
        const z = q || pq, gone = q ? 0 : show(p, 0.1, 0.4), y = spY(X, z), xa = ixX(s, X, z.from), xb = ixX(s, X, z.to), col = SPC[z.kind] ?? INK;
        const lit = q && on && hotIt(s, X, id), lv = (lit ? 0.95 : on ? 0.6 : 0.4) * dim * form * (1 - gone);
        const born = q && !pq && !end, from = born && act && act.t === X ? src : null;
        for (let m = 0; m < SPN; m++) {
          const i = s0 + m, f = m / SPN;
          let x, yy = y, sz = 1.3, a0 = lv;
          if (z.kind === 'rec' || z.kind === 'blk') {
            /* 점 하나 — rec 는 레코드 위의 고리, blk 는 아래를 가리키는 화살표 */
            if (z.kind === 'rec') { const th = f * Math.PI * 2; x = xa + Math.cos(th) * 6; yy = y + Math.sin(th) * 6; }
            else { const r = Math.floor(m / 8), c = (m % 8) - 3.5; x = xa + c * (4 - r) * 0.6; yy = y - 8 + r * 4; if (r > 4) a0 = 0; }
          } else if (m < SPN - 12) {
            x = U.lerp(xa + 5, xb - 5, m / (SPN - 13));
          } else {
            /* 끝의 원 — 앞 여섯은 왼쪽, 뒤 여섯은 오른쪽. 찬 원은 안을 채운다 */
            const e = m - (SPN - 12), right = e >= 6, th = ((e % 6) / 6) * Math.PI * 2, closed = right ? z.kind === 'next' : false;
            const r = closed ? 2.2 : 4;
            x = (right ? xb : xa) + Math.cos(th) * r; yy = y + Math.sin(th) * r; sz = closed ? 1.8 : 1.1;
          }
          if (from) { const qq = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0], x, qq); yy = U.lerp(from[1], yy, qq) - Math.sin(qq * Math.PI) * 14; }
          if (gone) { x += jit[i * 2] * 24 * gone; yy += jit[i * 2 + 1] * 24 * gone; }
          const [xx, y2] = into(i, x, yy);
          put(o, i, xx, y2, a0, lit ? 0.4 : 0, 0.02, sz, col);
        }
      }
    }
    if (GR) {
      const on = s.touch.has(GR) && !end;
      for (const id of NODES) {
        const [n0] = R['n:' + id], it = s[GR].find((x) => x.id === id), P = nodeAt(s, id);
        if (!it || !P) { hide('n:' + id); continue; }
        const lv = (on ? (hotIt(s, GR, id) ? 0.95 : 0.6) : 0.45) * dim * form;
        for (let m = 0; m < NODEN; m++) { const [x, y] = rim(P.x, P.y, G.gr.nw, 30, NODEN, m), [xx, yy] = into(n0 + m, x, y); put(o, n0 + m, xx, yy, lv, it.tag === 'x' ? 0.3 : 0, 0.03, 1.1, TAGC[it.tag] ?? INK); }
      }
      /* 간선 — 노드 사이의 활, 위로 가는 것과 아래로 가는 것을 갈라 서로 겹치지 않게 */
      const [e0, e1] = R.edges, cyc = cycleOf(s), E = s[GR + '#e'];
      let i = e0;
      const per = Math.max(10, Math.floor((e1 - e0) / Math.max(1, E.length)));
      for (const e of E) {
        const ln = edgeLine(s, e); if (!ln) continue;
        for (let m = 0; m < per && i < e1; m++, i++) {
          const u = m / (per - 1), [px, py] = edgeAt(ln, u), [xx, yy] = into(i, px, py);
          put(o, i, xx, yy, (on ? 0.9 : 0.5) * dim * form, cyc.has(e.id) && on ? 0.5 : 0, 0.02, 1.3, cyc.has(e.id) ? RED : ACCENT);
        }
      }
      for (; i < e1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    }
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === a ? src : null, tg = (it || pv).tag;
      const lv = (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
      for (let m = 0; m < SL; m++) {
        const i = R[key][0] + m, f = m / SL;
        let [x, y] = rim(P.x, P.y, P.w, 24, SL, m);
        if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, lv * (1 - gone), 0, 0.03, 1.1, TAGC[tg] ?? INK);
      }
    }
    /* bitmap — 알갱이는 켜진 bit 위에(띠와 칸 경계는 overlay 가 그린다). 켜진 bit 수만큼 나눠 앉고, 새 struct 는 토큰 출발점에서 날아온다 */
    for (const a of BMS) for (const id of BIDS[a]) {
      const key = 'b:' + a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? bmAt(s, a, id) : bmAt(prev, a, id);
      if (!P) { hide(key); continue; }
      const runs = P.it.bits || [], tot = runs.reduce((t, [lo, hi]) => t + hi - lo + 1, 0) || 1;
      const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === a ? src : null;
      const lv = (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form, col = P.it.tag === 'wait' ? RED : GOLD;
      for (let m = 0; m < BN; m++) {
        const i = R[key][0] + m, f = m / BN;
        let u = (m + 0.5) / BN * tot, r = runs[0] || [0, 0];
        for (const q of runs) { const n = q[1] - q[0] + 1; if (u < n) { r = q; break; } u -= n; }
        let x = G.L.x0 + (r[0] + Math.min(u, r[1] - r[0] + 1)) * P.bw, y = P.sy + 2 + (m % 4) * ((STRIP - 4) / 3);
        if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, lv * (1 - gone), 0, 0.03, 1.1, col);
      }
    }
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
        put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, Math.max(G.L.y0 + 4, U.lerp(fy, ty2, e) + Math.sin(th) * r - arc), (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, act.gold ? GOLD : ACCENT);
      }
    } else hide('tok');
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK, TX } = cur;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = TX[Math.min(k, NK - 1)], TB = TX[Math.min(next, NK - 1)], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) { setText(lb, txt, html); for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c); }
      const s = S[kk];
      for (const X of IXS) {
        for (const it of s[X]) place(recLb[X][it.id], ixX(s, X, it.v), G.ix[X].y + 10, 'c', 't');
        /* 범위 이름 — 막대의 가운데 위, 점(rec · blk)은 그 오른쪽 */
        const SPL = cur.SPL[kk][X];
        for (const q of s[X + '#sp']) { const L2 = SPL[q.id]; if (L2) place(spLb[X][q.id], L2.l, spY(X, q) - 8 - L2.row * RH, 'l', 'b'); }
      }
      if (GR) for (const id of NODES) { const P = nodeAt(s, id); if (P) { place(nLb[id].n, P.x, P.y, 'c', 'c'); place(nLb[id].v, P.x, P.y + 21, 'c', 't'); } }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
      for (const a of BMS) for (const it of s[a]) { const P = bmAt(s, a, it.id); place(bmL[a][it.id], G.L.x0, P.ry); if (G.bm[a].two) place(bmR[a][it.id], G.L.x0, P.ry + G.bm[a].lh); else place(bmR[a][it.id], G.L.x1, P.ry, 'r', 't'); }
      /* 옆 설명은 그 스텝의 칸 끝 바로 옆 — 줄 폭(가장 넓은 상태)에 두면 칸이 적은 스텝에서 멀리 떨어졌다. 설명의 줄바꿈 폭은
         가장 넓은 상태의 것 그대로라 높이는 변하지 않는다. 칸이 바뀌면 설명 글도 바뀌므로(사라졌다 나타난다) 자리를 옮겨도 튀지 않는다 */
      for (const a of ROWS) if (G.cap[a] != null) place(rowCap[a], G.slot[a].x0 + Math.max(0, s[a].reduce((t, x) => t + G.slot[a].sw[x.id] + 6, -6)) + 12, G.cap[a]);
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    let o = act ? show(p, 0.06, 0.12) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, act.lb), [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(show(p, 0.08, 0.42));
      const arc = act.f === act.t ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arc - (act.f === act.t ? 30 : 14));
      const [qx, qy, keep] = dockAt(F, tok.el, s, p, x, y, G.L, tx2, ty2); o *= keep;
      tok.el.style.transform = `translate(${qx}px, ${qy}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const { S, NK } = cur, kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save(); ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]);
    for (const y of G.edgeY) if (y != null) seg(ctx, L.x0, y, L.x1, y);
    ctx.setLineDash([]);
    for (const X of IXS) {
      /* 축의 양 끝 값과 범위 막대 끝에서 레코드까지의 점선 */
      ctx.globalAlpha = 0.3 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([2, 3]);
      for (const q of s[X + '#sp']) { const y = spY(X, q); for (const v of q.from === q.to ? [q.from] : [q.from, q.to]) seg(ctx, ixX(s, X, v), y + 4, ixX(s, X, v), G.ix[X].y - 4); }
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.3 * o;
      const SPL = cur.SPL[kk][X];
      for (const q of s[X + '#sp']) { const L2 = SPL[q.id]; if (L2 && L2.row > 0) seg(ctx, L2.pins[0], spY(X, q) - 8 - L2.row * RH + 1, L2.pins[0], spY(X, q) - 7); }
    }
    /* bitmap 띠 — page 의 heap_no 0 ‥ n_heap − 1 은 옅게 채우고 그 뒤(64 비트 여유와 바이트 올림)는 비운다. n_heap 자리에 눈금,
       바이트 경계마다 아래 짧은 눈금(바이트 폭이 4px 이상일 때), 켜진 bit 는 금색(기다리는 요청은 빨강) */
    for (const a of BMS) for (const it of s[a]) {
      const P = bmAt(s, a, it.id), x0 = L.x0, w = L.x1 - L.x0, { sy, bw } = P;
      ctx.globalAlpha = 0.08 * o; ctx.fillStyle = css.ink; ctx.fillRect(x0, sy, it.nheap * bw, STRIP);
      ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.strokeRect(x0 + 0.5, sy + 0.5, w - 1, STRIP - 1);
      if (8 * bw >= 4) { ctx.globalAlpha = 0.3 * o; for (let b = 8; b < it.nbits; b += 8) seg(ctx, x0 + b * bw, sy + STRIP - 3, x0 + b * bw, sy + STRIP); }
      ctx.globalAlpha = 0.7 * o; ctx.strokeStyle = css.ink; seg(ctx, x0 + it.nheap * bw, sy - 2, x0 + it.nheap * bw, sy + STRIP + 2);
      ctx.globalAlpha = 0.85 * o; ctx.fillStyle = it.tag === 'wait' ? css.red : css.gold;
      for (const [lo, hi] of it.bits || []) ctx.fillRect(x0 + lo * bw, sy + 2, Math.max(2, (hi - lo + 1) * bw), STRIP - 4);
    }
    if (GR) {
      /* 간선 끝의 화살촉 */
      const cyc = cycleOf(s);
      for (const e of s[GR + '#e']) {
        const ln = edgeLine(s, e); if (!ln) continue;
        const sx = ln.rt ? -1 : 1;
        ctx.globalAlpha = 0.8 * o; ctx.strokeStyle = cyc.has(e.id) ? css.red : css.accent;
        if (ln.arc) { seg(ctx, ln.xb, ln.y, ln.xb - 4, ln.y + 6); seg(ctx, ln.xb, ln.y, ln.xb + 4, ln.y + 6); }
        else { seg(ctx, ln.xb, ln.y, ln.xb + sx * 6, ln.y - 4); seg(ctx, ln.xb, ln.y, ln.xb + sx * 6, ln.y + 4); }
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); return build(L); },
    fin,
    theme() { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim(); css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') }; },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    /* 짝으로 물러날 때 — 이름표를 감춘다. 돌아오면 글을 다시 쓴다 */
    hide() { for (const lb of made) { lb.el.style.opacity = '0'; lb.o = 0; } tokO = 0; },
    reset() { shown = -2; },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
