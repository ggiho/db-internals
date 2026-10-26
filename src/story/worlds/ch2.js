/* book/ch2 — B-Tree Basics 의 모든 장면이 같은 세계를 쓴다. 장면이 쓰는 배우만 그린다. 그리는 것은 모두 bake 상태에서 읽는다 —
     · 논리 층(위) : kv 글 블록(op · cost), 트리(bst · bt), 분리 키 수직선(sep), 노드 목록(node)
       ── 덱의 EDGES '블록 경계' 점선 ──
       물리 층(아래) : kv 글 블록(io · hdd · ssd), HDD 원판 · SSD 지우기 블록(ftl) · 전송 블록 줄(io), 16KB 블록 띠(blk)
     · 트리 = page 상자. 위에 이름(id), 가운데 키 칸(분리 키 · 키 · [짚은 키]) 이나 글, 바닥에 fill 만큼 찬 막대.
       page 를 여럿 줄인 칸(×N · N page)은 바닥에 작은 page N 장(16 장까지) 이나 page 눈금 띠(띠의 폭 = page 수 비례).
       부모 → 자식 선은 자식이 드는 분리 키 사이(gap)에서 — InnoDB 식(레코드마다 자식)이면 그 칸에서. 낡은 분리 키는 빨갛게
       키 칸은 값으로 이어진다 : 분할 · 병합 · root raise 에서 같은 키가 옮겨 가고, 부모로 올리는 키는 그 자리에서 복사된다
       BST 는 키 값이 가로 자리(01), 레벨마다 블록 하나인 탑(02 · 05v)
     · HDD = 원판(트랙 · 섹터)과 헤드 팔. io '작업' 이 임의 읽기면 섹터마다 시크, 순차면 한 번 시크하고 원판이 돈다
     · SSD = ftl 의 블록 = page 칸 격자(live · dead · 빈 칸). 가비지 컬렉션은 살아 있는 page 가 다른 블록으로 날아간다
     · 전송 줄 = io 의 KB ÷ 16 KB(또는 논리 읽기) 만큼 블록. 새 블록은 읽은 노드에서 날아온다. 시크는 위의 눈금
     · 블록 띠 = sz 비례 칸. 칸 안은 키(이름이 키 줄), 레코드 눈금(×N · N × M B), 바이트(레코드 띠) 중 데이터가 가진 것
     · 셈 맞추기는 ch2-model.js — 어긋나면 console.error(storysweep 의 errors 가 잡는다)
   짝 장면(03 · 03v, 05 · 05v)은 같은 세계 — 장면마다 모형을 따로 짜되 알갱이 번호를 같은 차례로 나눠, 짝을 바꾸면 알갱이가 날아간다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf } from '../../bake.js';
import { stagger } from './stagger.js';
import { bare, tone, nums, fmt, parseNode, treeState, chipIdentity, checks } from './ch2-model.js';

const HANGUL = /[가-힣]/;
const ONE = /\bbyte\b|바이트/;   /* io '작업' 이 1 byte 읽기 — HDD 는 섹터 하나를 통째로 옮긴다(03/3) */
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: GOLD, gold: GOLD, hold: GOLD, pin: GOLD, hdr: ACCENT, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
const TONEC = { gold: GOLD, red: RED, green: GREEN };
/* 알갱이 몫 */
const TOK = 150, RIM = 96, GAU = 28, CHIP = 26, STUB = 22, MINI = 16, BAND = 200, BKEY = 40, TOWR = 34;
const AXL = 110, TICK = 9, SPAN = 52, MARK = 12, SL = 48, CELL = 20, BLKR = 56, SPK = 6, TWK = 6, TWE = 4;
const PLAT = 120, SPIN = 16, TRK = 5, SEC = 28, SECG = 3, HEAD = 12, SQ = 16, SEEK = 3, STRIP = 200, CUTS = 40, IMAX = 820;
const NG = 14, PADX = 7, PADY = 5, IDH = 15, CHH = 19, GAH = 9, RH = 15, BKG = 16, BKW = 44;

export default {
  count: (narrow) => (narrow ? 3800 : 4800),
  make,
};

/* ── 장면 하나의 계획 : 상태 · 역할 · 알갱이 구역(DOM 없음) ── */
function plan(deck, sc) {
  const A = deck.ACTORS, cast = sc.cast.filter((a) => A[a]);
  const steps = stepsOf(sc, null), frames = bake(sc, null);
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      if (A[a].kind === 'kv') s[a] = (st[a] && st[a].kv) || {};
      else {
        s[a] = ((st[a] && st[a].items) || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
        s[a].byl = st[a] && st[a].byl; s[a].axis = st[a] && st[a].axis; s[a].spans = (st[a] && st[a].spans) || [];
      }
    }
    return s;
  };
  const S0 = read(sc.init), S = frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch)), all = [S0, ...S];
  const lane = (a) => A[a].lane || 'logic';
  const TL = cast.filter((a) => A[a].kind === 'kv' && lane(a) !== 'phys');
  const TP = cast.filter((a) => A[a].kind === 'kv' && lane(a) === 'phys');
  const TREES = cast.filter((a) => A[a].kind === 'tree');
  const NODE = cast.find((a) => A[a].kind === 'list' && lane(a) !== 'phys') || null;
  const SEP = cast.find((a) => A[a].kind === 'axis') || null;
  const BLK = cast.filter((a) => A[a].kind === 'bytes');
  const HDD = cast.includes('hdd') ? 'hdd' : null, SSD = cast.includes('ssd') ? 'ssd' : null;
  const FTL = SSD ? cast.find((a) => A[a].kind === 'list' && lane(a) === 'phys' && all.some((s) => s[a].length)) || null : null;
  const IO = cast.includes('io') ? 'io' : null;
  const sqOf = (s) => { if (!IO) return 0; const io = s[IO], u = nums(io['전송 단위'])[0] || 16, kb = nums(io['누적 전송'] ?? io['읽은 바이트'])[0]; return kb > 0 ? Math.round(kb / u) : nums(io['논리 읽기'])[0] || 0; };
  const skOf = (s) => (IO ? nums(s[IO]['시크'])[0] || 0 : 0);
  const TRAY = IO && !HDD && !SSD && all.some((s) => sqOf(s) > 0) ? IO : null;
  /* 트리 — 스텝마다 상태, 키 칸의 정체 */
  const TS = {};
  for (const a of TREES) {
    const st = all.map((s) => treeState(s[a], a, NODE ? s[NODE] : null));
    const real = st.some((t) => !t.empty);
    const mode = !real ? 'none' : st.find((t) => !t.empty).bst || 'bt';
    const ids = [...new Set(st.flatMap((t) => (t.nodes || []).map((n) => n.id)))];
    const chips = mode === 'bt' ? chipIdentity(st) : { per: st.map(() => []), n: 0 };
    const aggMax = Object.fromEntries(ids.map((id) => [id, Math.max(0, ...st.map((t) => { const n = (t.nodes || []).find((x) => x.id === id); return n && n.agg ? n.agg : 0; }))]));
    const stubN = Math.max(0, ...st.map((t) => (t.stubs || []).length));
    const rows = Math.max(0, ...st.map((t) => (t.rows || []).length));
    TS[a] = { st, real, mode, ids, chips, aggMax, stubN, rows, label: st[0].label || (st.find((t) => t.empty) || {}).label || '' };
  }
  /* 블록 띠의 칸 안 — 키 · 레코드 눈금 · 바이트 */
  const marksOf = (a, s) => {
    const its = s[a], rec = !all.some((q) => q[a].some((x) => x.tag === 'free'));
    return its.map((x) => {
      const toks = String(x.id).split(/\s+/);
      if (toks.length && toks.every((t) => /^\d+$/.test(t))) return { kind: 'key', n: toks.length, keys: toks };
      const r = /×\s*([\d,]+)/.exec(String(x.id)) || /([\d,]+)\s*×\s*[\d,]+\s*B/.exec(String(x.sub));
      if (r) return { kind: 'rec', n: Math.min(400, +r[1].replace(/,/g, '')) };
      if (rec) return { kind: 'byte', n: x.sz };
      return { kind: 'tex', n: 14 + Math.round(x.sz * 2) };
    });
  };
  const grainOfMark = (m) => (m.kind === 'key' ? m.n * BKG : m.kind === 'rec' ? m.n * 2 : m.kind === 'byte' ? m.n * 12 : m.n);
  const BMX = Object.fromEntries(BLK.map((a) => [a, Math.min(IMAX, Math.max(0, ...all.map((s) => marksOf(a, s).reduce((t, m) => t + grainOfMark(m), 0))))]));
  /* SSD 블록의 page 수 — 어느 스텝에서든 live + dead 의 가장 큰 값 */
  const PG = FTL ? Math.max(1, ...all.flatMap((s) => s[FTL].map((b) => (b.live || 0) + (b.dead || 0)))) : 0;
  const FIDS = FTL ? [...new Set(all.flatMap((s) => s[FTL].map((b) => b.id)))] : [];
  const NIDS = NODE ? [...new Set(all.flatMap((s) => s[NODE].map((x) => x.id)))] : [];
  const SIDS = SEP ? [...new Set(all.flatMap((s) => s[SEP].map((x) => x.id)))] : [];
  const PIDS = SEP ? [...new Set(all.flatMap((s) => s[SEP].spans.map((x) => x.id)))] : [];
  const SQN = TRAY ? Math.max(...all.map(sqOf)) : 0, SKN = TRAY ? Math.max(...all.map(skOf)) : 0;
  const READS = (HDD || SSD) && IO ? Math.max(0, ...all.map((s) => nums(bare(s[IO]['작업'] || ''))[0] || 0)) : 0;

  /* ── 알갱이 구역 — 짝 장면은 같은 차례로 나눈다(HDD ↔ SSD, bst ↔ bt 가 같은 번호에서 시작한다) ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  take('tok', TOK);
  if (HDD) take('hdd', PLAT + SPIN + TRK * SEC * SECG + HEAD + 20 * SPK);
  if (FTL) { FIDS.forEach((id) => take('fb:' + id, BLKR + PG * CELL)); take('spk', Math.max(1, READS) * SPK); }
  for (const a of TREES) {
    const T = TS[a];
    if (T.mode === 'bt') {
      T.ids.forEach((id) => take(`n:${a}:${id}`, RIM + GAU + (T.aggMax[id] > 16 ? BAND : T.aggMax[id] > 1 ? T.aggMax[id] * MINI : 0)));
      for (let c = 0; c < T.chips.n; c++) take(`c:${a}:${c}`, CHIP);
      for (let j = 0; j < T.stubN; j++) take(`st:${a}:${j}`, STUB);
    } else if (T.mode === 'keyed') T.ids.forEach((id) => take(`k:${a}:${id}`, BKEY));
    else if (T.mode === 'tower') for (let j = 0; j < T.rows; j++) take(`w:${a}:${j}`, TOWR);
  }
  if (SEP) { take('ax', AXL); SIDS.forEach((id) => take('sx:' + id, TICK)); PIDS.forEach((id) => take('sp:' + id, SPAN)); take('mk', MARK); }
  if (NODE) NIDS.forEach((id) => take('nl:' + id, SL));
  if (TRAY) { take('sq', Math.max(1, SQN) * SQ); take('sk', Math.max(1, SKN) * SEEK); }
  for (const a of BLK) take('b:' + a, STRIP + CUTS + BMX[a]);
  return { A, cast, S0, S, all, NK: S.length, TL, TP, TREES, NODE, SEP, BLK, HDD, SSD, FTL, IO, TRAY, TS, marksOf, PG, FIDS, NIDS, SIDS, PIDS, SQN, SKN, READS, sqOf, skOf, R, need: at };
}

function make({ F, deck, labels, scene }) {
  const models = new Map();
  let cur = null, LL = null, css = {};
  const sceneOf = (num) => deck.SCENES.find((s) => s.num === num);
  const partnerOf = (sc) => (sc.pair ? sc.pair : (deck.SCENES.find((s) => s.pair === sc.num) || {}).num);
  const get = (num) => {
    if (!models.has(num)) models.set(num, model(F, deck, labels, sceneOf(num), () => css));
    return models.get(num);
  };
  const sc0 = scene();
  cur = get(sc0.num);
  if (partnerOf(sc0)) get(partnerOf(sc0));
  const theme = () => {
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
    css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') };
  };
  return {
    build(L) { theme(); LL = L; for (const m of models.values()) m.build(L); },
    theme,
    pose: (...a) => cur.pose(...a),
    paint: (...a) => cur.paint(...a),
    overlay: (...a) => cur.overlay(...a),
    setScene(num) {
      if (!sceneOf(num) || num === cur.num) return;
      const m = get(num);
      if (LL && !m.built()) m.build(LL);
      cur.hide();
      cur = m;
      m.reset();
    },
    dispose() { for (const m of models.values()) m.dispose(); },
  };
}

function model(F, deck, labels, sc, cssOf) {
  const N = F.N, PL = plan(deck, sc);
  const { A, cast, S0, S, all, NK, TL, TP, TREES, NODE, SEP, BLK, HDD, SSD, FTL, IO, TRAY, TS, marksOf, PG, FIDS, NIDS, SIDS, PIDS, sqOf, skOf, R } = PL;
  if (PL.need > N) throw new Error(`book/ch2 ${sc.num} 세계 : 알갱이가 모자란다 (${PL.need} > ${N})`);
  R.DST = [PL.need, N];
  for (const e of checks(deck, sc)) console.error(e);
  const EDGE = (deck.EDGES || [])[0] || null;
  const PHYS = TP.length || BLK.length || FTL || HDD || TRAY;
  const LOGIC = TL.length || TREES.some((a) => TS[a].real) || SEP || NODE;
  /* 표본이 바뀐 스텝(10a 의 4 · 6)의 앞 상태는 같은 표본의 마지막 스텝 — 실험이 돌아오면 그 트리에서 이어진다 */
  const smp = (s) => bare((s.op || {})['표본'] || '');
  const prevIdx = S.map((s, k) => {
    if (k === 0) return -1;
    if (!cast.includes('op') || smp(S[k - 1]) === smp(s)) return k - 1;
    for (let j = k - 1; j >= 0; j--) if (smp(S[j]) === smp(s)) return j;
    return smp(S0) === smp(s) ? -1 : k - 1;
  });
  const stOf = (i) => (i < 0 ? S0 : S[i]);
  const TI = (a, i) => TS[a].st[i + 1];                /* 트리 상태 — i = -1 이 init */
  const CI = (a, i) => TS[a].chips.per[i + 1];

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') {
    const el = document.createElement('div');
    el.className = 'wl ' + cls;
    labels.appendChild(el);
    const lb = { el, cls, t: null, o: -1 };
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
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`;
  }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  /* 배우 머리 이름 — 장면이 names 로 바꿀 수 있다(06a 의 띠는 16KB 블록이 아니라 node pointer 레코드 하나다) */
  const nmOf = (a) => (sc.names && sc.names[a]) || A[a].nm;
  const DRAWN = [...TL, ...TP, ...TREES, ...(SEP ? [SEP] : []), ...(NODE ? [NODE] : []), ...(FTL ? [FTL] : []), ...BLK];
  const hd = Object.fromEntries(DRAWN.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries([...TL, ...TP].map((a) => [a, label('aq ml aq-b')]));
  const TLB = {};
  for (const a of TREES) {
    const T = TS[a];
    TLB[a] = { ph: label('aq'), id: {}, tx: {}, no: {}, ch: [] };
    for (const id of T.ids) { TLB[a].id[id] = label('aq'); TLB[a].tx[id] = label('aq aq-c ml'); TLB[a].no[id] = label('aq gold'); }
    for (let c = 0; c < T.chips.n; c++) TLB[a].ch.push(label('aq aq-c'));
  }
  const sepLb = SEP ? { v: Object.fromEntries(SIDS.map((id) => [id, label('aq aq-c')])), sp: Object.fromEntries(PIDS.map((id) => [id, label('aq aq-c')])), lo: label('aq aq-c'), hi: label('aq aq-c'), mk: label('aq aq-c gold') } : null;
  const nlLb = NODE ? Object.fromEntries(NIDS.map((id) => [id, label('aq aq-c')])) : {};
  const nlCap = NODE ? label('aq ml aq-b') : null;
  const ftLb = FTL ? Object.fromEntries(FIDS.map((id) => [id, { n: label('aq aq-c'), v: label('aq aq-c ml') }])) : {};
  const ftMv = FTL ? label('aq aq-c gold') : null;
  const sqCap = TRAY ? label('aq') : null;
  const hdLb = HDD ? label('aq gold') : null;
  const bLb = Object.fromEntries(BLK.map((a) => [a, { n: {}, v: {}, cap: label('aq ml aq-b') }]));
  const BIDS = Object.fromEntries(BLK.map((a) => [a, [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))]]));
  for (const a of BLK) for (const id of BIDS[a]) { bLb[a].n[id] = label('aq'); bLb[a].v[id] = label('aq'); }
  const edgeLb = EDGE && LOGIC && PHYS ? label('aq') : null;
  const tok = label('stn-tok');

  /* ── 스텝마다의 글 — [글, 또렷한가, 색, 보이나, html] ── */
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const nodeText = (n) => (n.P.chips && n.P.chips.length ? '' : n.P.text);
  const texts = () => S.map((s, k) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of DRAWN) t.set(hd[a], [nmOf(a), on(a)]);
    for (const a of [...TL, ...TP]) t.set(tx[a], [kvHtml(s[a]), on(a), '', true, true]);
    for (const a of TREES) {
      const T = TS[a], st = TI(a, k), lb = TLB[a];
      t.set(lb.ph, [T.real ? '' : '— ' + T.label, false, '', !T.real]);
      for (const id of T.ids) {
        const n = (st.nodes || []).find((x) => x.id === id), hot = !!n && on(a) && hotIt(s, a, ownOf(n, id));
        if (T.mode === 'keyed') {
          t.set(lb.id[id], [n ? id : '', hot, n && n.ghost ? '' : '', !!n]);
          t.set(lb.tx[id], [n ? n.cap : '', hot, '', !!n && !!n.cap]);
          t.set(lb.no[id], ['', false, '', false]);
        } else if (T.mode === 'tower') {
          t.set(lb.id[id], [n ? `${id}  ·  ${n.cap}` : '', hot, '', !!n]);
          t.set(lb.tx[id], ['', false, '', false]); t.set(lb.no[id], ['', false, '', false]);
        } else {
          const over = n && n.cap && n.has > n.cap;
          t.set(lb.id[id], [n ? id + (n.it && n.it.page != null ? '  ·  page ' + n.it.page : '') : '', hot, over ? 'red' : '', !!n]);
          t.set(lb.tx[id], [n ? esc(nodeText(n)) : '', hot, '', !!n && !!nodeText(n), true]);
          t.set(lb.no[id], [n && n.P.note ? '← ' + n.P.note : '', hot, 'gold', !!n && !!n.P.note]);
        }
      }
      const ci = CI(a, k);
      lb.ch.forEach((cl, c) => {
        const q = ci.find((x) => x.id === c), n = q && st.nodes.find((x) => x.id === q.node);
        const stale = q && n && n.par ? false : false;
        const bad = q && staleOf(a, k).has(c);
        t.set(cl, q ? [q.t, bad || (on(a) && (hotIt(s, a, q.node) || q.c.hot)), bad ? 'red' : q.c.hot ? 'gold' : over1(n, q) ? 'red' : '', true] : ['', false, '', false]);
        void stale;
      });
    }
    if (SEP) {
      for (const id of SIDS) { const it = s[SEP].find((x) => x.id === id); t.set(sepLb.v[id], [it ? String(it.v) : '', on(SEP), '', !!it]); }
      for (const id of PIDS) { const sp = s[SEP].spans.find((x) => x.id === id); t.set(sepLb.sp[id], [sp ? sp.lb || '' : '', on(SEP) && !!sp && (sp.kind === 'ii' || hotIt(s, SEP, id)), sp && sp.kind === 'ii' ? 'gold' : '', !!sp]); }
      const ax = s[SEP].axis || {};
      t.set(sepLb.lo, [String(ax.min ?? ''), false, '', ax.min != null]); t.set(sepLb.hi, [String(ax.max ?? ''), false, '', ax.max != null]);
      const mk = markOf(s);
      t.set(sepLb.mk, [mk != null ? String(mk) : '', true, 'gold', mk != null]);
    }
    if (NODE) {
      for (const id of NIDS) { const it = s[NODE].find((x) => x.id === id); t.set(nlLb[id], [it ? id : '', on(NODE) && !!it && hotIt(s, NODE, id), it && (it.tag === 'x' || it.tag === 'red') ? 'red' : '', !!it]); }
      t.set(nlCap, [capOf(s[NODE]) || (s[NODE].length ? '' : '—'), on(NODE), '', true, true]);
    }
    if (FTL) {
      /* 재매핑된 page 의 이름 — 이 스텝에 살아 있던 칸 하나가 버려지고(L → D) 다른 블록에 새로 쓰였을 때, 금색 화살 위에 */
      const pv = stOf(prevIdx[k])[FTL], was = (id) => pv.find((x) => x.id === id) || {};
      const turned = s[FTL].some((b) => (b.live || 0) < (was(b.id).live || 0) && (b.dead || 0) > (was(b.id).dead || 0));
      const pg = IO && /p:\d+/.exec(bare(s[IO]['작업'] || ''));
      t.set(ftMv, [turned && pg ? pg[0] : '', on(FTL), 'gold', !!(turned && pg)]);
    }
    if (FTL) for (const id of FIDS) { const b = s[FTL].find((x) => x.id === id); t.set(ftLb[id].n, [b ? id : '', on(FTL) && !!b && hotIt(s, FTL, id), b && b.tag === 'x' ? 'red' : '', !!b]); t.set(ftLb[id].v, [b ? b.sub : '', on(FTL) && !!b && hotIt(s, FTL, id), '', !!b && !!b.sub]); }
    if (HDD) {
      /* 헤드 옆 이름 — 제자리 쓰기는 그 page, 1 byte 읽기는 실제로 오는 단위(섹터 하나) */
      const job = bare(s[IO]['작업'] || ''), pg = /제자리|갱신/.test(job) && /p:\d+/.exec(job), one = ONE.test(job);
      t.set(hdLb, [pg ? pg[0] : one ? '섹터 1개' : '', on(IO), 'gold', !!pg || one]);
    }
    if (TRAY) { const n = sqOf(s), m = skOf(s); t.set(sqCap, [n ? `블록 ${n} × 16 KB${m ? '  ·  시크 ' + m : ''}` : '', on(TRAY), '', n > 0]); }
    for (const a of BLK) {
      const mod = modOf(s, a);
      for (const id of BIDS[a]) {
        const it = s[a].find((x) => x.id === id), hot = on(a) && !!it && hotIt(s, a, id);
        t.set(bLb[a].n[id], [it ? id : '', hot, mod.has(id) && on(a) ? 'gold' : '', !!it]);
        t.set(bLb[a].v[id], [it ? esc(it.sub) : '', hot, '', !!it && !!it.sub, true]);
      }
      const byl = s[a].byl;
      t.set(bLb[a].cap, [byl ? `${esc(byl.l || '')}${byl.r ? '  ·  ' + esc(byl.r) : ''}` : '', on(a), '', !!byl, true]);
    }
    if (edgeLb) t.set(edgeLb, [EDGE.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '']);
    return t;
  });
  /* 낡은 분리 키(그 다음에 부모가 바뀔 때 바로잡히는 것)의 칸 정체 */
  function staleOf(a, k) {
    const st = TI(a, k), ci = CI(a, k), out = new Set();
    if (!st || st.empty || st.bst) return out;
    for (const n of st.nodes) for (const b of n.bad || []) for (const v of b.stale) { const q = ci.find((x) => x.node === n.id && x.v === v); if (q) out.add(q.id); }
    return out;
  }
  const over1 = (n, q) => !!(n && n.cap && n.has > n.cap && q.k >= n.cap);
  /* BST 의 잎(kids) · 사슬 끝(upto)은 그것을 그리게 한 항목과 함께 밝다 — 바뀐 항목만 밝히면 잎이 유령처럼 흐렸다(01) */
  function ownOf(n, id) { return n && (n.kid || n.ghost) ? n.up : id; }
  /* 수직선의 짚은 값 — 'ii' 구간 이름의 '← 45' */
  function markOf(s) {
    if (!SEP) return null;
    const sp = s[SEP].spans.find((x) => x.kind === 'ii');
    const m = sp && /←\s*([\d,]+)/.exec(String(sp.lb || ''));
    return m ? +m[1].replace(/,/g, '') : null;
  }
  const TX = texts();
  const most = (lb) => {
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const t of TX) {
      const e = t.get(lb);
      if (!e || e[3] === false || !e[0]) continue;
      lb.el.innerHTML = e[0];
      const r = lb.el.getBoundingClientRect();
      w = Math.max(w, r.width); h = Math.max(h, r.height);
    }
    lb.el.innerHTML = keep;
    return { w, h };
  };
  const wOf = (lb, txt) => { const keep = lb.el.innerHTML; lb.el.innerHTML = txt; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };

  /* ── 자리 ── */
  let G = null, built = false;
  const rnd = U.rng(29);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, HD = 18, gap = 18;
    G = { L, ww, anc: {}, tree: {}, blk: {} };
    /* 글 블록 — 층마다 한 줄, 열은 셋까지(열 폭 150 아래로는 줄인다) */
    const cols = (list) => { let tn = Math.max(1, Math.min(3, list.length)); while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--; return tn; };
    const TB = {};
    const textZones = (tight) => { for (const [z, list] of [['L', TL], ['P', TP]]) {
      const tn = cols(list), tW = (ww - (tn - 1) * gap) / tn;
      for (const a of list) {
        wrap(tx[a], tW);
        /* 가장 좁은 배치 — 글 블록이 하나뿐이고 줄이 넷 이상이면 두 단으로 흘린다 */
        const two = tight && list.length === 1 && tW >= 440 && Math.max(...S.map((s) => Object.keys(s[a]).length)) >= 4;
        tx[a].el.style.columnCount = two ? '2' : ''; tx[a].el.style.columnGap = two ? '24px' : ''; tx[a].el.style.width = two ? Math.floor(tW) + 'px' : '';
      }
      const rows = Math.ceil(list.length / tn), rh = Array.from({ length: rows }, (_, r) => Math.max(14, ...list.slice(r * tn, r * tn + tn).map((a) => most(tx[a]).h)));
      TB[z] = { list, tn, tW, rows, rh, h: list.length ? rh.reduce((t, x) => t + x + HD + 10, 0) : 0 };
    } };
    textZones(false);
    /* 트리 — 노드 폭은 그 노드의 글 · 칸이 가장 넓을 때, 단 같은 레벨에 함께 놓이는 수가 다 들어가는 폭까지 */
    for (const a of TREES) {
      const T = TS[a], lb = TLB[a], Z = { mode: T.mode };
      G.tree[a] = Z;
      if (!T.real) { Z.h = HD + 2; continue; }
      if (T.mode === 'bt') {
        const chipW = lb.ch.map((cl) => Math.max(20, Math.ceil(most(cl).w) + 10));
        Z.chipW = chipW;
        const rowW = (st, n, k) => { const ci = CI(a, k).filter((q) => q.node === n.id), cap = n.cap && n.has > n.cap ? n.cap : ci.length; return ci.slice(0, cap).reduce((t, q) => t + chipW[q.id] + 4, -4); };
        const nat = {}, avail = {};
        /* 글의 제 폭(접기 전) — 접기는 아래에서 노드 폭이 정해진 뒤에 */
        for (const id of T.ids) { lb.tx[id].el.classList.remove('st-wrap'); lb.tx[id].el.style.maxWidth = ''; }
        const txw = Object.fromEntries(T.ids.map((id) => [id, Math.ceil(most(lb.tx[id]).w)]));
        T.st.forEach((st, i) => {
          if (st.empty) return;
          for (const L2 of st.levels) {
            const per = (ww - (L2.length - 1) * NG) / L2.length;
            for (const n of L2) {
              avail[n.id] = Math.min(avail[n.id] ?? Infinity, per);
              const idw = most(lb.id[n.id]).w + (n.P.note ? most(lb.no[n.id]).w + 10 : 0);
              const cw = Math.max(0, rowW(st, n, i - 1));
              const mini = n.agg > 1 && n.agg <= 16 ? n.agg * 13 + (n.agg - 1) * 4 : 0;
              nat[n.id] = Math.max(nat[n.id] || 60, idw + 2 * PADX, cw + 2 * PADX + 4, mini + 2 * PADX, txw[n.id] + 2 * PADX + 2);
            }
          }
        });
        /* 글은 그 폭에서 접는다 — 접힌 글의 높이가 노드 높이를 정한다 */
        const maxBand = Math.max(1, ...T.ids.map((id) => T.aggMax[id] > 16 ? T.aggMax[id] : 0));
        Z.w = {}; Z.band = {};
        for (const id of T.ids) {
          if (T.aggMax[id] > 16) { Z.band[id] = true; Z.w[id] = ww; }
          else Z.w[id] = Math.max(56, Math.min(nat[id] || 60, avail[id] ?? ww));
          wrap(lb.tx[id], Z.w[id] - 2 * PADX);
          lb.tx[id].el.style.textAlign = 'center';
        }
        Z.maxBand = maxBand;
        const txH = Math.max(0, ...T.ids.map((id) => most(lb.tx[id]).h));
        Z.cH = Math.max(T.chips.n ? CHH : 0, txH, 14);
        Z.NH = PADY + IDH + Z.cH + 4 + GAH + PADY;
        Z.lvls = Math.max(...T.st.map((st) => st.depth || 0));
        Z.LG = 30;
        Z.h = HD + 4 + Z.lvls * Z.NH + (Z.lvls - 1) * Z.LG + 6;
      } else if (T.mode === 'keyed') {
        Z.vmax = Math.max(...T.st.map((st) => st.vmax || 0));
        Z.bw = 36; Z.bh = 28; Z.LG = 18;
        Z.lvls = Math.max(...T.st.map((st) => st.depth || 0));
        Z.h = HD + 4 + Z.lvls * Z.bh + (Z.lvls - 1) * Z.LG + 6;
      } else {
        /* 탑의 블록 폭 — 옆의 이름이 들어가는 만큼 넓게(좁으면 16KB 상자가 점 기둥으로 보였다, 02 · 05v) */
        const lw = Math.max(0, ...T.ids.map((id) => most(lb.id[id]).w));
        Z.rows = T.rows; Z.rh = 10; Z.rg = 3; Z.bw = Math.round(U.clamp(Math.min(ww * 0.45, ww - lw - 24), 90, 300));
        Z.h = HD + 4 + Z.rows * (Z.rh + Z.rg) + 6;
      }
    }
    /* 수직선 — 위에 분리 키 값, 아래로 구간 줄(row) */
    if (SEP) {
      const rows = Math.max(1, ...all.flatMap((s) => s[SEP].spans.map((x) => (x.row || 0) + 1)));
      G.sep = { rows, h: HD + 16 + 12 + rows * 30 + 4 };
    }
    /* 노드 목록 — 칸 줄, 설명은 옆(남는 폭이 넉넉하면) 아니면 아래 */
    if (NODE) {
      const sw = Object.fromEntries(NIDS.map((id) => [id, Math.max(34, Math.ceil(most(nlLb[id]).w) + 16)]));
      const rowsOf = (lim) => { let r = 1; for (const s of all) { let x = 0, rr = 1; for (const it of s[NODE]) { const w = sw[it.id]; if (x && x + w > lim) { rr++; x = 0; } x += w + 6; } r = Math.max(r, rr); } return r; };
      const used = Math.max(0, ...all.map((s) => s[NODE].reduce((t, it) => t + sw[it.id] + 6, -6)));
      wrap(nlCap, ww); const capB = most(nlCap).h;
      let side = 0, capH = capB, lim = ww;
      if (ww - used - 20 >= 200) { wrap(nlCap, ww - used - 20); const hs = most(nlCap).h; if (hs <= Math.max(26, capB)) { side = used + 20; capH = hs; } else wrap(nlCap, ww); }
      if (side) lim = used;
      const rows = rowsOf(lim);
      G.nl = { sw, side, capH, rows, lim, h: HD + rows * 32 + (side ? Math.max(0, capH - rows * 32 + 6) : capH + 8) };
    }
    /* SSD — 블록마다 page 격자 */
    if (FTL) {
      const cols = Math.ceil(Math.sqrt(PG)), rows = Math.ceil(PG / cols), cs = Math.round(U.clamp(ww / 28, 18, 28)), cg = 5, bw = cols * cs + (cols - 1) * cg + 16, bh = rows * cs + (rows - 1) * cg + 16;
      const nb = FIDS.length, bgap = Math.min(110, (ww - nb * bw) / Math.max(1, nb));
      for (const id of FIDS) { wrap(ftLb[id].v, Math.max(bw, bw + bgap - 16)); }
      const vh = Math.max(14, ...FIDS.map((id) => most(ftLb[id].v).h));
      G.ssd = { cols, rows, cs, cg, bw, bh, bgap, vh, h: HD + 16 + bh + 8 + vh };
    }
    if (HDD) { const R0 = U.clamp(Math.min(ww * 0.28, wh * 0.27), 46, 150); G.hdd = { R: R0, h: 2 * R0 + 16 }; }
    if (TRAY) G.tray = { h: (PL.SKN ? 14 : 0) + SQ + 6 + 15 + RH * 0.7 };
    /* 블록 띠 — 이름 · 설명의 줄은 모든 스텝의 칸 자리로 나눈다 */
    for (const a of BLK) {
      wrap(bLb[a].cap, ww);
      const pos = (s) => { const its = s[a], tot = its.reduce((p, x) => p + (x.sz || 1), 0) || 1; let x = L.x0; return Object.fromEntries(its.map((it) => { const w = (ww * (it.sz || 1)) / tot, r = [x, w]; x += w; return [it.id, r]; })); };
      let nr = 1, vr = 1;
      const per = new Map();
      S.forEach((s, kk) => {
        const P = pos(s), T = TX[kk];
        const tw = (lb) => { const e = T.get(lb); return !e || e[3] === false || !e[0] ? 0 : wOf(lb, e[0]); };
        const NM = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: tw(bLb[a].n[it.id]) })).filter((q) => q.w), L.x0, L.x1);
        const VL = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: tw(bLb[a].v[it.id]) })).filter((q) => q.w), L.x0, L.x1);
        nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows);
        per.set(s, { P, NM: NM.out, VL: VL.out });
      });
      const p0 = pos(S0);
      per.set(S0, { P: p0, NM: [], VL: [] });
      G.blk[a] = { nr, vr, per, capH: most(bLb[a].cap).h, h: HD + 6 + nr * RH + 26 + 5 + vr * RH + 4 + most(bLb[a].cap).h };
    }
    const lay = (y0, k) => {
      let y = y0;
      const textRow = (z) => {
        const B = TB[z];
        if (!B.list.length) return;
        let yy = y;
        for (let r = 0; r < B.rows; r++) {
          B.list.slice(r * B.tn, r * B.tn + B.tn).forEach((a, j) => { const x = L.x0 + j * (B.tW + gap); place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + Math.min(B.tW, 160) - 18, y: yy + 8 }; });
          yy += HD + B.rh[r] + 10 * k;
        }
        y = yy + 4 * k;
      };
      textRow('L');
      for (const a of TREES) {
        const Z = G.tree[a];
        place(hd[a], L.x0, y);
        if (!TS[a].real) { place(TLB[a].ph, L.x0 + wOf(hd[a], nmOf(a)) + 10, y); y += Z.h + 6 * k; continue; }
        Z.y = y + HD + 4;
        if (Z.mode === 'bt') { Z.LGk = k < 0.1 ? 12 : k < 0.5 ? 18 : Math.max(18, Z.LG * (0.6 + 0.4 * k)); y += HD + 4 + Z.lvls * Z.NH + (Z.lvls - 1) * Z.LGk + 6; }
        else if (Z.mode === 'keyed') { Z.LGk = Math.max(8, Z.LG * (0.5 + 0.5 * k)); y += HD + 4 + Z.lvls * Z.bh + (Z.lvls - 1) * Z.LGk + 6; }
        else { Z.rhk = k < 1 ? 7 : Z.rh; y += HD + 4 + Z.rows * (Z.rhk + Z.rg) + 6; }
        G.anc[a] = { x: L.x0 + ww / 2, y: Z.y + 12 };
        y += 12 * k;
      }
      if (SEP) { place(hd[SEP], L.x0, y); G.sep.y = y + HD + 16 + 6; G.anc[SEP] = { x: L.x0 + ww / 2, y: G.sep.y }; y += G.sep.h + 12 * k; }
      if (NODE) {
        place(hd[NODE], L.x0, y); G.nl.y = y + HD; G.anc[NODE] = { x: L.x0 + 30, y: y + HD + 13 };
        G.nl.capAt = G.nl.side ? [L.x0 + G.nl.side, y + HD + 2] : [L.x0, y + HD + G.nl.rows * 32 + 2];
        place(nlCap, ...G.nl.capAt);
        y += G.nl.h + 12 * k;
      }
      G.edgeY = null;
      if (edgeLb) { y += 2 * k; G.edgeY = y; place(edgeLb, L.x1, y + 3, 'r', 't'); y += 20 + 8 * k; }
      textRow('P');
      if (FTL) {
        place(hd[FTL], L.x0, y); G.ssd.y = y + HD + 16;
        const nb = FIDS.length, tot = nb * G.ssd.bw + (nb - 1) * G.ssd.bgap;
        G.ssd.x0 = L.x0 + Math.max(0, (ww - tot) / 2);
        FIDS.forEach((id, j) => { const bx = G.ssd.x0 + j * (G.ssd.bw + G.ssd.bgap); place(ftLb[id].n, bx + G.ssd.bw / 2, G.ssd.y - 3, 'c', 'b'); place(ftLb[id].v, bx + G.ssd.bw / 2, G.ssd.y + G.ssd.bh + 6, 'c', 't'); });
        G.anc[FTL] = { x: G.ssd.x0 + G.ssd.bw / 2, y: G.ssd.y + G.ssd.bh / 2 };
        y += G.ssd.h + 12 * k;
      }
      if (HDD) { G.hdd.cx = L.x0 + Math.max(G.hdd.R + 8, (ww - G.hdd.R * 3.6) / 2 + G.hdd.R); G.hdd.cy = y + G.hdd.R + 4; G.anc[HDD + ':disk'] = { x: G.hdd.cx, y: G.hdd.cy }; y += G.hdd.h + 10 * k; }
      if (TRAY) { G.tray.y = y + (PL.SKN ? 14 : 0); G.anc[TRAY + ':tray'] = { x: L.x0 + 40, y: G.tray.y + SQ / 2 }; y += G.tray.h + 8 * k; }
      for (const a of BLK) {
        const B = G.blk[a];
        place(hd[a], L.x0, y); y += HD + 6 + B.nr * RH;
        B.y = y; G.anc[a] = { x: L.x0 + ww / 2, y: y + 13 };
        y += 26 + 5 + B.vr * RH + 4; B.capY = y; place(bLb[a].cap, L.x0, y); y += B.capH + 12 * k;
      }
      return y - y0;
    };
    NC = new Map(); CC = new Map();
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.25; total = lay(L.y0, k); }
    if (total > wh) { k = 0; textZones(true); total = lay(L.y0, k); }
    if (total > wh && HDD) { G.hdd.R = Math.max(40, G.hdd.R - (total - wh) / 2); G.hdd.h = 2 * G.hdd.R + 16; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`book/ch2 ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    NC = new Map(); CC = new Map();
    if (HDD) hddPlan();
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2; built = true;
  }

  /* ── 트리의 자리 ── */
  let NC = new Map(), CC = new Map();
  function nodesAt(a, i) {
    const T = TS[a], Z = G.tree[a], st = TI(a, i);
    if (!st || st.empty) return { box: new Map(), stubs: [] };
    if (NC.has(a + i)) return NC.get(a + i);
    const box = new Map(), L = G.L, ww = G.ww;
    if (T.mode === 'bt') {
      st.levels.forEach((lvN) => {
        const l = lvN[0].lvl, y = Z.y + l * (Z.NH + Z.LGk) + Z.NH / 2;
        const ws = lvN.map((n) => (Z.band[n.id] ? Math.max(130, Math.min(ww, (ww * (n.agg || 1)) / Z.maxBand)) : Z.w[n.id]));
        const tot = ws.reduce((t, w) => t + w, 0) + (lvN.length - 1) * NG;
        let x = L.x0 + Math.max(0, (ww - tot) / 2);
        lvN.forEach((n, j) => { box.set(n.id, { x: x + ws[j] / 2, y, w: ws[j], h: Z.NH, n }); x += ws[j] + NG; });
      });
      /* stub — 가장 깊은 레벨 아래, 자식이 드는 차례대로 고르게 */
      const stubs = [];
      if (st.stubs && st.stubs.length) {
        const l = st.levels.length, y = Z.y + l * (Z.NH + Z.LGk) + 12, sw = 30, n = st.stubs.length, tot = n * sw + (n - 1) * 10;
        st.stubs.forEach((sb, j) => stubs.push({ x: L.x0 + (ww - tot) / 2 + sw / 2 + j * (sw + 10), y, w: sw, h: 22, par: sb.par.id, g: sb.g }));
      }
      NC.set(a + i, { box, stubs });
      return NC.get(a + i);
    }
    if (T.mode === 'keyed') {
      const cw = ww / Z.vmax;
      for (const n of st.nodes) box.set(n.id, { x: L.x0 + (n.v - 0.5) * cw, y: Z.y + n.lvl * (Z.bh + Z.LGk) + Z.bh / 2, w: Z.bw, h: Z.bh, n });
      NC.set(a + i, { box, stubs: [] });
      return NC.get(a + i);
    }
    st.rows.forEach((n, j) => box.set('row:' + j, { x: L.x0 + Z.bw / 2 + 4, y: Z.y + j * (Z.rhk + Z.rg) + Z.rhk / 2, w: Z.bw, h: Z.rhk, n }));
    NC.set(a + i, { box, stubs: [] });
    return NC.get(a + i);
  }
  /* 키 칸의 자리 — 노드 상자의 가운데 줄, 용량을 넘는 칸은 상자 오른쪽 밖으로 */
  function chipsAt(a, i) {
    if (CC.has(a + i)) return CC.get(a + i);
    const out = new Map(), Z = G.tree[a], { box } = nodesAt(a, i), ci = CI(a, i);
    for (const [id, b] of box) {
      const qs = ci.filter((q) => q.node === id);
      if (!qs.length) continue;
      const n = b.n, cap = n.cap && n.has > n.cap ? n.cap : qs.length;
      const inW = qs.slice(0, cap).reduce((t, q) => t + Z.chipW[q.id] + 4, -4);
      let x = b.x - inW / 2;
      const y = b.y - b.h / 2 + PADY + IDH + Z.cH / 2;
      /* 용량을 넘는 칸은 상자 테두리 밖에서 시작한다 — 안쪽 여백에서 이어 놓으면 테두리가 글자를 지났다(09/2) */
      qs.forEach((q, k) => { if (k === cap && cap < qs.length) x = b.x + b.w / 2 + 6; const w = Z.chipW[q.id]; out.set(q.id, { x: x + w / 2, y, w, h: CHH - 2, q }); x += w + 4; });
    }
    CC.set(a + i, out);
    return out;
  }
  /* page 묶음(16 장까지)의 작은 page 들 — 상자 바닥 줄 */
  function miniOf(B) {
    if (!B || !B.n || !(B.n.agg > 1 && B.n.agg <= 16)) return null;
    const gw = B.w - 2 * PADX, nm = B.n.agg, mw = Math.min(13, (gw - (nm - 1) * 4) / nm), tot = nm * mw + (nm - 1) * 4, gy = B.y + B.h / 2 - PADY - GAH / 2;
    return Array.from({ length: nm }, (_, q) => ({ x: B.x - tot / 2 + mw / 2 + q * (mw + 4), y: gy - 1, h: GAH + 2 }));
  }
  /* 자식이 드는 자리(부모 상자 바닥) — gap 은 칸 사이, InnoDB 식이면 그 칸, 모르면 고르게 */
  function anchorOf(a, i, par, child, j, nk) {
    const { box } = nodesAt(a, i), P = box.get(par.id);
    if (!P) return null;
    const ch = chipsAt(a, i), ci = CI(a, i).filter((q) => q.node === par.id), g = par.gapOf ? par.gapOf.get(child) : null;
    const yb = P.y + P.h / 2;
    if (g != null && ci.length) {
      if (par.rec && g >= 1) { const c = ch.get(ci[g - 1].id); if (c) return [c.x, yb]; }
      if (g === 0) { const c = ch.get(ci[0].id); return [c.x - c.w / 2 - 3, yb]; }
      if (g >= ci.length) { const c = ch.get(ci[ci.length - 1].id); return [c.x + c.w / 2 + 3, yb]; }
      const c0 = ch.get(ci[g - 1].id), c1 = ch.get(ci[g].id);
      return [(c0.x + c0.w / 2 + c1.x - c1.w / 2) / 2, yb];
    }
    if (ci.length >= 2 && ci.length === nk) { const c = ch.get(ci[j].id); if (c) return [c.x, yb]; }
    return [P.x - P.w / 2 + (P.w * (j + 0.5)) / nk, yb];
  }

  /* ── HDD : 원판 · 헤드 · 스텝마다 할 일 ── */
  let HP = null;
  function hddPlan() {
    const { R: Rr, cx, cy } = G.hdd, rad = (t) => Rr * (0.36 + (0.56 * t) / (TRK - 1));
    const piv = { x: cx + Rr * 1.42, y: cy + Rr * 0.62 }, d = Math.hypot(piv.x - cx, piv.y - cy), arm = d - Rr * 0.1;
    /* 헤드 = 원판 중심을 지나는 원(반지름 r)과 축을 지나는 원(팔 길이)의 교점 중 위쪽 */
    const head = (r) => {
      const a2 = (r * r - arm * arm + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r * r - a2 * a2));
      const ux = (piv.x - cx) / d, uy = (piv.y - cy) / d, mx = cx + ux * a2, my = cy + uy * a2;
      const p1 = { x: mx - uy * h, y: my + ux * h }, p2 = { x: mx + uy * h, y: my - ux * h };
      return p1.y < p2.y ? p1 : p2;
    };
    const angOf = (p) => Math.atan2(p.y - cy, p.x - cx);
    const secA = (s) => (s / SEC) * Math.PI * 2;
    let r = 0, phi = 0, last = null;
    const per = S.map((s, k) => {
      const io = s[IO] || {}, job = bare(io['작업'] || ''), ch = modOf(s, IO);
      const n = nums(job)[0] || 0, live = ch.has('작업') || ch.has('비용');
      /* io 가 그대로인 스텝은 앞 스텝이 한 일을 그대로 보인다(움직이지 않는다) */
      if (!live) return last ? { ...last, live: false } : { mode: 'idle', tg: [], seq: [], from: { r, phi }, live: false };
      const rr = U.rng(101 + k);
      let mode = 'idle', tg = [];
      if (/임의/.test(job) && n) { mode = 'rand'; for (let q = 0; q < n; q++) tg.push({ t: Math.floor(rr() * TRK), s: Math.floor(rr() * SEC), u: 0 }); tg.forEach((g) => { g.u = g.s; }); }
      else if (/순차/.test(job) && n) { mode = 'seq'; const t = 1, s0 = Math.floor(rr() * SEC); for (let q = 0; q < Math.min(n, SEC - 2); q++) tg.push({ t, s: (s0 + q) % SEC, u: s0 + q }); }
      else if (/제자리|갱신/.test(job)) { mode = 'write'; tg.push({ t: 3, s: 7, u: 7 }); }
      else if (ONE.test(job)) { mode = 'one'; tg.push({ t: 4, s: 18, u: 18 }); }
      /* 각 대상의 끝 자세 — 그 섹터가 헤드 밑에 온 원판 각도(순차는 감지 않은 섹터 번호로 — 한 바퀴를 넘어도 이어서 돈다) */
      const seq = tg.map((g) => { const H = head(rad(g.t)); return { r: g.t, phi: angOf(H) - secA(g.u) }; });
      const from = { r, phi };
      if (seq.length) { r = seq[seq.length - 1].r; phi = seq[seq.length - 1].phi; }
      last = { mode, tg, seq, from, live, job };
      return last;
    });
    HP = { rad, piv, arm, head, angOf, secA, per };
  }
  /* 스텝 k 의 p 에서 원판 각도 · 헤드 트랙(실수) · 몇 개를 읽었나 */
  function hddAt(k, p) {
    const P = HP.per[Math.min(k, NK - 1)];
    const lerpA = (a0, a1, e) => { let d = a1 - a0; d = ((d % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return a0 + d * e; };
    if (!P.seq.length || !P.live || k >= NK) { const e = P.seq.length ? P.seq[P.seq.length - 1] : P.from; return { phi: e.phi, r: e.r, done: P.tg.length }; }
    const u = U.range(p, 0.08, 0.5);
    if (P.mode === 'seq') {
      /* 한 번 시크(앞 25%) — 그다음 원판이 돌며 섹터가 차례로 헤드 밑을 지난다 */
      const a = U.smooth(U.range(u, 0, 0.25)), b = U.range(u, 0.25, 1), n = P.seq.length;
      const first = P.seq[0], last = P.seq[n - 1];
      const phiSeek = lerpA(P.from.phi, first.phi, a);
      const phiRun = first.phi + (last.phi - first.phi) * b;
      return { phi: b > 0 ? phiRun : phiSeek, r: U.lerp(P.from.r, first.r, a), done: b > 0 ? Math.min(n, Math.floor(b * (n - 1) + 1.0001)) : 0 };
    }
    const n = P.seq.length, q = Math.min(n - 1, Math.floor(u * n)), e = U.smooth(u * n - q), a0 = q ? P.seq[q - 1] : P.from, a1 = P.seq[q];
    return { phi: lerpA(a0.phi, a1.phi, e), r: U.lerp(a0.r, a1.r, U.smooth(U.range(e, 0, 0.6))), done: u >= 1 ? n : q + (e > 0.97 ? 1 : 0) };
  }

  /* ── 붙는 자리(act) ── */
  const word = (lb, id) => new RegExp(`(^|[^A-Za-z0-9])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`).test(lb || '');
  function anchor(a, s, k, lbText) {
    if (TREES.includes(a) && TS[a].real && G.tree[a].y != null) {
      const { box } = nodesAt(a, k), st = TI(a, k);
      const ids = [...box.keys()].filter((id) => !id.startsWith('row:') && word(lbText, id)).sort((p, q) => q.length - p.length);
      const id = ids[0] || [...modOf(s, a)].find((x) => box.has(x)) || [...box.keys()][0];
      const P = id ? box.get(id) : null;
      if (P) return [P.x, P.y];
      void st;
    }
    if (a === NODE) { const id = NIDS.find((x) => word(lbText, x)) || [...modOf(s, NODE)][0]; const P = id ? nlSlot(s, id) : null; if (P) return [P.x, P.y]; }
    if (BLK.includes(a)) { const info = G.blk[a].per.get(s), id = info && (Object.keys(info.P).find((x) => word(lbText, x)) || [...modOf(s, a)].find((x) => info.P[x])); if (id) return [info.P[id][0] + info.P[id][1] / 2, G.blk[a].y + 13]; }
    if (a === FTL) { const id = [...modOf(s, FTL)][0] || FIDS[0], j = FIDS.indexOf(id); return [G.ssd.x0 + j * (G.ssd.bw + G.ssd.bgap) + G.ssd.bw / 2, G.ssd.y + G.ssd.bh / 2]; }
    if (a === HDD && G.hdd) return [G.hdd.cx, G.hdd.cy];
    if (a === SSD && FTL) return [G.ssd.x0 + G.ssd.bw / 2, G.ssd.y - 20];
    const P = G.anc[a];
    return P ? [P.x, P.y] : [G.L.x0, G.L.y0];
  }
  function nlSlot(s, id) {
    let x = G.L.x0, y = G.nl.y, lim = G.L.x0 + G.nl.lim;
    for (const it of s[NODE]) { const w = G.nl.sw[it.id]; if (x > G.L.x0 && x + w > lim + 0.5) { x = G.L.x0; y += 32; } if (it.id === id) return { x: x + w / 2, y: y + 13, w }; x += w + 6; }
    return null;
  }

  /* ── 자세 ── */
  const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
  const show = (p, a, b) => U.smooth(U.range(p, a, b));
  function rim(cx, cy, w, h, n, m) {
    const per = 2 * (w + h), d = (m / n) * per;
    if (d < w) return [cx - w / 2 + d, cy - h / 2];
    if (d < w + h) return [cx + w / 2, cy - h / 2 + (d - w)];
    if (d < 2 * w + h) return [cx + w / 2 - (d - w - h), cy + h / 2];
    return [cx - w / 2, cy + h / 2 - (d - 2 * w - h)];
  }
  let O = null;
  const hideR = (r0, r1) => { for (let i = r0; i < r1; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  const hide = (key) => { if (R[key]) hideR(R[key][0], R[key][1]); };
  /* 날아오기 · 사라지기를 한 점에 입힌다 */
  function moveIn(i, x, y, from, fly, f) {
    if (!from) return [x, y];
    const q = show(fly, f * 0.4, 0.6 + f * 0.4);
    return [U.lerp(from[0] + jit[i * 2] * 10, x, q), U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18];
  }
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], pi = prevIdx[kk], prev = stOf(pi);
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1, mv = end ? 1 : show(p, 0.12, 0.42);
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const src = act ? anchor(act.f, s, kk, act.lb) : null;
    const lvOf = (a, id) => (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;

    /* 트리 */
    for (const a of TREES) {
      const T = TS[a], Z = G.tree[a];
      if (!T.real) continue;
      const st = TI(a, kk), sp = TI(a, pi), on = s.touch.has(a) && !end;
      const NB = nodesAt(a, kk), PB = nodesAt(a, pi);
      if (T.mode === 'bt') {
        for (const id of T.ids) {
          const key = `n:${a}:${id}`, [r0, r1] = R[key], b1 = NB.box.get(id), b0 = PB.box.get(id);
          if (!b1 && !(b0 && !end)) { hideR(r0, r1); continue; }
          const n = (b1 || b0).n, B = b1 && b0 && !end ? { x: U.lerp(b0.x, b1.x, mv), y: U.lerp(b0.y, b1.y, mv), w: U.lerp(b0.w, b1.w, mv), h: b1.h } : b1 || b0;
          const gone = b1 ? 0 : show(p, 0.1, 0.4), born = b1 && !b0 && !end;
          const lifter = !b1 ? [...NB.box.values()].find((q) => q.n.it && q.n.it.lift === id) : null;
          const from = born && src ? src : null;
          const hot = on && hotIt(s, a, id), a0 = (on ? (hot ? 0.92 : 0.55) : 0.45) * dim * form;
          const over = n.cap && n.has > n.cap, col = over ? RED : hot && modOf(s, a).has(id) ? GOLD : INK;
          let i = r0;
          const bandNow = Z.band[id] && (n.agg || 0) > 16;
          for (let m = 0; m < RIM; m++, i++) {
            let [x, y] = bandNow ? [B.x - B.w / 2 + PADX + (m / (RIM - 1)) * (B.w - 2 * PADX), B.y + B.h / 2 - PADY + 1] : rim(B.x, B.y, B.w, B.h, RIM, m);
            [x, y] = moveIn(i, x, y, from, fly, m / RIM);
            if (lifter) { const e = show(p, 0.12, 0.42); x = U.lerp(x, lifter.x + jit[i * 2] * lifter.w * 0.8, e); y = U.lerp(y, lifter.y + jit[i * 2 + 1] * 10, e); }
            else if (gone) { x += jit[i * 2] * 30 * gone; y += jit[i * 2 + 1] * 30 * gone; }
            [x, y] = into(i, x, y);
            put(o, i, x, y, a0 * (1 - (lifter ? show(p, 0.3, 0.45) : gone)) * (bandNow ? 0.5 : 0.85), hot && modOf(s, a).has(id) ? 0.35 : 0, 0.03, 1.05, col);
          }
          /* 바닥 줄 — fill 막대, page 묶음이면 작은 page 들 · page 눈금 */
          const f0 = b0 ? b0.n.fill : n.fill, f1 = b1 ? b1.n.fill : f0, fill = end ? f1 : U.lerp(f0, f1, show(p, 0.2, 0.42));
          const gy = B.y + B.h / 2 - PADY - GAH / 2, gx0 = B.x - B.w / 2 + PADX, gw = B.w - 2 * PADX;
          const agg = n.agg || 0, fc = over ? RED : hot && modOf(s, a).has(id) ? GOLD : INK;
          for (let m = 0; m < GAU; m++, i++) {
            const u = m / (GAU - 1), filled = u <= fill + 1e-6 && fill > 0;
            let x = gx0 + u * gw, y = gy;
            if (agg > 1) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
            [x, y] = moveIn(i, x, y, from, fly, u);
            if (gone && !lifter) { x += jit[i * 2] * 30 * gone; y += jit[i * 2 + 1] * 30 * gone; }
            if (lifter) { const e = show(p, 0.12, 0.42); x = U.lerp(x, lifter.x, e); y = U.lerp(y, lifter.y, e); }
            [x, y] = into(i, x, y);
            put(o, i, x, y, (filled ? 0.95 : 0.3) * a0 * (1 - (lifter ? show(p, 0.3, 0.45) : gone)), 0, 0.02, filled ? 1.9 : 1, filled ? fc : FAINT);
          }
          const extra = r1 - i;
          if (agg > 16) {
            /* page 눈금 — 눈금 하나가 page 하나(폭이 모자라면 몇 장씩), 높이가 그 page 의 fill */
            const nt = Math.min(Math.floor(extra / 4), agg, Math.floor(gw / 5));
            for (let m = 0; m < extra; m++, i++) {
              const tk = m >> 2;
              if (tk >= nt) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
              const th = (GAH + 1) * Math.max(0.2, fill);
              let x = gx0 + ((tk + 0.5) / nt) * gw, y = B.y + B.h / 2 - PADY - 2 - ((m & 3) / 3) * th;
              [x, y] = moveIn(i, x, y, from, fly, tk / nt);
              if (gone) { x += jit[i * 2] * 30 * gone; y += jit[i * 2 + 1] * 30 * gone; }
              [x, y] = into(i, x, y);
              put(o, i, x, y, 0.85 * a0 * (1 - gone), 0, 0.02, 1.1, fc);
            }
          } else if (agg > 1 || extra > 0) {
            const nm = Math.min(agg, Math.floor(extra / MINI)), mw = Math.min(13, (gw - (nm - 1) * 4) / Math.max(1, nm)), tot = nm * mw + (nm - 1) * 4;
            for (let q = 0; q < Math.floor(extra / MINI); q++) for (let m = 0; m < MINI; m++, i++) {
              if (q >= nm) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
              const cx = B.x - tot / 2 + mw / 2 + q * (mw + 4);
              let [x, y] = m < 12 ? rim(cx, gy - 1, mw, GAH + 2, 12, m) : [cx - mw / 2 + 2 + ((m - 12) / 3) * Math.max(0, (mw - 4) * fill), gy + GAH / 2 - 1];
              [x, y] = moveIn(i, x, y, from, fly, q / Math.max(1, nm));
              if (lifter) { const e = show(p, 0.12, 0.42); x = U.lerp(x, lifter.x + (q - nm / 2) * 4, e); y = U.lerp(y, lifter.y, e); }
              else if (gone) { x += jit[i * 2] * 30 * gone; y += jit[i * 2 + 1] * 30 * gone; }
              [x, y] = into(i, x, y);
              put(o, i, x, y, (m < 12 ? 0.85 : 0.95) * a0 * (1 - (lifter ? show(p, 0.3, 0.45) : gone)), 0, 0.02, m < 12 ? 1 : 1.5, m < 12 ? INK : fc);
            }
            for (; i < r1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
          }
        }
        /* 키 칸 — 정체를 따라 옮겨 가고, 새로 나면 옛 자리(복사) · act 의 출발점에서, 사라지면 흩어진다 */
        const C1 = chipsAt(a, kk), C0 = chipsAt(a, pi), stale = staleOf(a, kk);
        const ci1 = CI(a, kk);
        for (let c = 0; c < T.chips.n; c++) {
          const key = `c:${a}:${c}`, [r0] = R[key], P1 = C1.get(c), P0 = C0.get(c);
          if (!P1 && !(P0 && !end)) { hide(key); continue; }
          const q = P1 ? P1.q : P0.q, n1 = P1 ? NB.box.get(q.node) : null;
          let from = null;
          if (P1 && !P0 && !end) {
            const cp = q.src && C0.get(q.src.id);
            if (cp) from = [cp.x, cp.y];
            else {
              /* 앞 상태의 다른 노드 글에 그 값이 있으면 거기서(08b 의 811) */
              const nb = [...PB.box.values()].find((b) => b.n.P && new RegExp(`(^|[^\\d,])${q.t}([^\\d,]|$)`).test(b.n.P.raw));
              from = nb ? [nb.x, nb.y] : src;
            }
          }
          const gone = P1 ? 0 : show(p, 0.1, 0.4), moving = P1 && P0 && (P0.x !== P1.x || P0.y !== P1.y) && !end;
          const e = moving ? show(p, 0.12, 0.42) : 1, cx = moving ? U.lerp(P0.x, P1.x, e) : (P1 || P0).x, cy = moving ? U.lerp(P0.y, P1.y, e) - Math.sin(e * Math.PI) * Math.min(40, Math.abs(P1.x - P0.x) * 0.2 + Math.abs(P1.y - P0.y) * 0.3) : (P1 || P0).y;
          const w = (P1 || P0).w, bad = stale.has(c), hot = bad || (on && (hotIt(s, a, q.node) || q.c.hot)), over = over1(n1 && n1.n, q);
          const col = bad || over ? RED : q.c.hot ? GOLD : q.c.gap ? FAINT : q.c.min ? ACCENT : INK;
          const a0 = (on ? (hot ? 0.95 : 0.6) : 0.45) * dim * form * (1 - gone) * (q.c.gap ? 0.5 : 1);
          for (let m = 0; m < CHIP; m++) {
            const i = r0 + m;
            let [x, y] = rim(cx, cy, w, CHH - 2, CHIP, m);
            [x, y] = moveIn(i, x, y, from, fly, m / CHIP);
            if (gone) { x += jit[i * 2] * 22 * gone; y += jit[i * 2 + 1] * 22 * gone + 6 * gone; }
            [x, y] = into(i, x, y);
            put(o, i, x, y, a0, bad || q.c.hot ? 0.5 : 0, 0.02, 1.1, col);
          }
          void ci1;
        }
        /* stub — 그리지 않은 자식 page */
        for (let j = 0; j < T.stubN; j++) {
          const key = `st:${a}:${j}`, [r0] = R[key], b1 = NB.stubs[j], b0 = PB.stubs[j];
          if (!b1 && !(b0 && !end)) { hide(key); continue; }
          const B = b1 && b0 && !end ? { x: U.lerp(b0.x, b1.x, mv), y: U.lerp(b0.y, b1.y, mv), w: b1.w, h: b1.h } : b1 || b0, gone = b1 ? 0 : show(p, 0.1, 0.4);
          for (let m = 0; m < STUB; m++) { const i = r0 + m; let [x, y] = rim(B.x, B.y, B.w, B.h, STUB, m); if (gone) { x += jit[i * 2] * 20 * gone; y += jit[i * 2 + 1] * 20 * gone; } [x, y] = into(i, x, y); put(o, i, x, y, 0.4 * dim * form * (1 - gone), 0, 0.02, 1, FAINT); }
        }
      } else if (T.mode === 'keyed') {
        for (const id of T.ids) {
          const key = `k:${a}:${id}`, [r0] = R[key], b1 = NB.box.get(id), b0 = PB.box.get(id);
          /* '…' 이 품은 키 — 그 자리에 접힌다 */
          const fold = (bx, stx) => { const v = +id; if (!bx && stx && stx.folded && stx.folded.includes(v)) { const d = [...nodesAt(a, stx === st ? kk : pi).box.values()].find((q) => q.n.id === '…'); return d || null; } return bx; };
          const f1 = fold(b1, st), f0 = fold(b0, sp);
          if (!f1 && !(f0 && !end)) { hide(key); continue; }
          const B = f1 && f0 && !end ? { x: U.lerp(f0.x, f1.x, mv), y: U.lerp(f0.y, f1.y, mv), w: f1.w, h: f1.h } : f1 || f0;
          const vis = b1 ? 1 : f1 ? 1 - show(p, 0.2, 0.42) : 1 - show(p, 0.1, 0.4);
          const n = (b1 || b0 || f1 || f0).n, hot = on && hotIt(s, a, ownOf(n, id));
          const from = b1 && !b0 && !f0 && !end ? src : null;
          const a0 = (on ? (hot ? 0.92 : 0.6) : 0.45) * dim * form * vis;
          for (let m = 0; m < BKEY; m++) {
            const i = r0 + m, inner = m >= 32;
            let [x, y] = inner ? [B.x - B.w / 2 + 4 + ((m - 32) / 7) * (B.w - 8) * (n ? n.fill : 0), B.y + B.h / 2 - 4] : rim(B.x, B.y, B.w, B.h, 32, m);
            [x, y] = moveIn(i, x, y, from, fly, m / BKEY);
            [x, y] = into(i, x, y);
            put(o, i, x, y, a0 * (inner ? 0.9 : 1), hot && modOf(s, a).has(id) ? 0.35 : 0, 0.02, inner ? 1.4 : 1.05, INK);
          }
        }
      } else {
        for (let j = 0; j < T.rows; j++) {
          const key = `w:${a}:${j}`, [r0] = R[key], b1 = NB.box.get('row:' + j), b0 = PB.box.get('row:' + j);
          if (!b1 && !(b0 && !end)) { hide(key); continue; }
          const B = b1 || b0, n = B.n, hot = on && hotIt(s, a, n.id), lit = readRow(kk, p, j, end, T.rows);
          const a0 = (on ? (hot ? 0.92 : 0.6) : 0.45) * dim * form;
          /* 줄 하나 = 블록 하나 : 왼쪽에 fill 만큼 키, 그 뒤 빈 자리를 점선으로 블록 끝까지, 끝에 세로 눈금 */
          const NR = TOWR - TWK - TWE;
          for (let m = 0; m < TOWR; m++) {
            const i = r0 + m, key1 = m < TWK, cap = m >= TOWR - TWE, kw = Math.max(4, B.w * (n.fill || 0));
            let [x, y] = key1 ? [B.x - B.w / 2 + ((m + 0.5) / TWK) * kw, B.y + (m % 2 ? 1.2 : -1.2)]
              : cap ? [B.x + B.w / 2, B.y - B.h / 2 + ((m - (TOWR - TWE)) / (TWE - 1)) * B.h]
              : [B.x - B.w / 2 + kw + 3 + ((m - TWK + 0.5) / NR) * (B.w - kw - 3), B.y];
            [x, y] = into(i, x, y);
            put(o, i, x, y, a0 * (key1 ? 1 : 0.7), lit && key1 ? 0.7 : 0, 0.02, key1 ? 1.6 : 1, key1 ? (lit ? ACCENT : INK) : INK);
          }
        }
      }
    }
    /* 분리 키 수직선 */
    if (SEP) {
      const ax = s[SEP].axis || { min: 0, max: 1 }, X = (v) => G.L.x0 + ((v - ax.min) / (ax.max - ax.min)) * G.ww, y = G.sep.y, on = s.touch.has(SEP) && !end;
      const [a0] = R.ax;
      for (let m = 0; m < AXL; m++) { const i = a0 + m, [x, yy] = into(i, G.L.x0 + (m / (AXL - 1)) * G.ww, y); put(o, i, x, yy, (m % 2 ? 0.35 : 0.6) * dim * form, 0, 0.02, 1, INK); }
      for (const id of SIDS) {
        const it = s[SEP].find((x) => x.id === id), [r0] = R['sx:' + id];
        if (!it) { hide('sx:' + id); continue; }
        for (let m = 0; m < TICK; m++) { const i = r0 + m, [x, yy] = into(i, X(it.v), y - 6 + (m / (TICK - 1)) * 12); put(o, i, x, yy, (on ? 0.95 : 0.6) * dim * form, on ? 0.3 : 0, 0.02, 1.4, ACCENT); }
      }
      for (const id of PIDS) {
        const sp = s[SEP].spans.find((x) => x.id === id), [r0] = R['sp:' + id];
        if (!sp) { hide('sp:' + id); continue; }
        const yy = y + 18 + (sp.row || 0) * 30, x0 = X(sp.from) + 3, x1 = X(sp.to) - 3, ii = sp.kind === 'ii', pv = prev[SEP].spans.find((x) => x.id === id);
        const born = !pv && !end, col = ii ? GOLD : sp.kind === 'next' ? INK : INK;
        for (let m = 0; m < SPAN; m++) {
          const i = r0 + m, u = m / (SPAN - 1);
          let x = U.lerp(x0, x1, u), yv = yy + (m % 3 === 1 ? -1.5 : m % 3 === 2 ? 1.5 : 0);
          if (born) { const e = show(p, 0.1 + u * 0.2, 0.3 + u * 0.2); x = U.lerp(X(sp.from), x, e); }
          const [xx, y2] = into(i, x, yv);
          put(o, i, xx, y2, (ii ? 0.95 : sp.kind === 'gap' ? 0.5 : 0.75) * dim * form * (born ? show(p, 0.1, 0.3) : 1), ii && !end ? 0.5 : 0, 0.02, ii ? 1.5 : 1.15, col);
        }
      }
      const mk = markOf(s), [m0] = R.mk;
      if (mk != null) for (let m = 0; m < MARK; m++) { const i = m0 + m, [x, yy] = into(i, X(mk) + (m % 2 ? 1 : -1), y - 10 + (m / (MARK - 1)) * 20); put(o, i, x, yy, 0.95 * dim * form * show(p, 0.2, 0.4), 1, 0.02, 1.4, GOLD); }
      else hide('mk');
    }
    /* 노드 목록 칸 */
    if (NODE) for (const id of NIDS) {
      const key = 'nl:' + id, [r0] = R[key], it = s[NODE].find((x) => x.id === id), pv = prev[NODE].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? nlSlot(s, id) : nlSlot(prev, id), P0 = pv ? nlSlot(prev, id) : null;
      if (!P) { hide(key); continue; }
      const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === NODE ? src : null;
      const B = P0 && it && !end && (P0.x !== P.x || P0.y !== P.y) ? { x: U.lerp(P0.x, P.x, mv), y: U.lerp(P0.y, P.y, mv), w: P.w } : P;
      const tg = (it || pv).tag, lv = lvOf(NODE, id) * (1 - gone);
      for (let m = 0; m < SL; m++) {
        const i = r0 + m;
        let [x, y] = rim(B.x, B.y, B.w, 24, SL, m);
        [x, y] = moveIn(i, x, y, from, fly, m / SL);
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone; }
        [x, y] = into(i, x, y);
        put(o, i, x, y, lv * (tg === 'free' ? 0.5 * (m % 2) : 1), it && modOf(s, NODE).has(id) && !end ? 0.4 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
      }
    }
    /* SSD 블록 — page 칸 : live 먼저, 그 뒤 dead, 나머지 빈 칸. 지운 블록의 live 는 새로 live 가 는 블록으로 날아간다 */
    if (FTL) {
      const { cols, cs, cg, bw, bh, bgap, x0, y: by } = G.ssd;
      const cell = (j, c) => { const bx = x0 + j * (bw + bgap); return [bx + 8 + (c % cols) * (cs + cg) + cs / 2, by + 8 + Math.floor(c / cols) * (cs + cg) + cs / 2]; };
      const kind = (b, c) => (!b ? 'E' : c < (b.live || 0) ? 'L' : c < (b.live || 0) + (b.dead || 0) ? 'D' : 'E');
      const on = s.touch.has(FTL) && !end;
      /* 옮겨 가는 live — 줄어든 블록의 옛 live 칸에서 늘어난 블록의 새 live 칸으로 */
      const lost = [];
      FIDS.forEach((id, j) => { const b = s[FTL].find((x) => x.id === id), pb = prev[FTL].find((x) => x.id === id); const l1 = b ? b.live || 0 : 0, l0 = pb ? pb.live || 0 : 0; if (b && l1 === 0 && l0 > 0 && !((b.dead || 0) > 0)) for (let c = 0; c < l0; c++) lost.push(cell(j, c)); });
      let li = 0;
      const wroteFlash = modOf(s, SSD).has('쓰기') && !end;
      FIDS.forEach((id, j) => {
        const [r0] = R['fb:' + id], b = s[FTL].find((x) => x.id === id), pb = prev[FTL].find((x) => x.id === id), bx = x0 + j * (bw + bgap);
        const hot = on && hotIt(s, FTL, id), a0 = (on ? (hot ? 0.92 : 0.6) : 0.45) * dim * form;
        const erased = pb && b && (pb.live || 0) + (pb.dead || 0) > 0 && (b.live || 0) + (b.dead || 0) === 0 && !end;
        let i = r0;
        for (let m = 0; m < BLKR; m++, i++) { const [x, y] = into(i, ...rim(bx + bw / 2, by + bh / 2, bw, bh, BLKR, m)); put(o, i, x, y, a0 * 0.8, erased ? 0.6 * (1 - show(p, 0.3, 0.5)) : 0, 0.02, 1.05, b && b.tag === 'x' ? RED : INK); }
        for (let c = 0; c < PG; c++) {
          const k1 = kind(b, c), k0 = kind(pb, c), [cx, cy] = cell(j, c);
          const newLive = k1 === 'L' && k0 !== 'L' && !end, from = newLive && li < lost.length ? lost[li++] : null;
          for (let m = 0; m < CELL; m++, i++) {
            if (m < 10) {
              const [x, y] = into(i, ...rim(cx, cy, cs, cs, 10, m));
              put(o, i, x, y, a0 * 0.55, 0, 0.02, 1, FAINT);
              continue;
            }
            const q = Math.min(8, m - 10), dd = k1 === 'D' || (k1 === 'E' && k0 === 'D');
            const X9 = [[-1, -1], [-0.5, -0.5], [0, 0], [0.5, 0.5], [1, 1], [1, -1], [0.5, -0.5], [-0.5, 0.5], [-1, 1]];
            const gx = dd ? cx + X9[q][0] * (cs / 2 - 4) : cx + ((q % 3) - 1) * (cs / 2 - 4), gy = dd ? cy + X9[q][1] * (cs / 2 - 4) : cy + (Math.floor(q / 3) - 1) * (cs / 2 - 4);
            let x = gx, y = gy, al = k1 === 'E' ? 0 : m - 10 > 8 ? 0 : 1;
            if (k1 === 'E' && k0 !== 'E' && erased) al = 1 - show(p, 0.25, 0.45);
            if (from) { const e = show(p, 0.12, 0.42); x = U.lerp(from[0] + (gx - cx), gx, e); y = U.lerp(from[1] + (gy - cy), gy, e) - Math.sin(e * Math.PI) * 26; }
            const turned = k1 === 'D' && k0 === 'L' && !end;
            const col = k1 === 'D' || (k1 === 'E' && k0 === 'D') ? RED : k1 === 'L' ? (newLive ? GREEN : INK) : k0 === 'L' ? INK : FAINT;
            const heat = (turned ? 0.7 * (1 - show(p, 0.35, 0.5)) : 0) + (wroteFlash && k1 !== 'E' ? 0.6 * show(p, 0.3, 0.38) * (1 - show(p, 0.42, 0.5)) : 0);
            [x, y] = into(i, x, y);
            put(o, i, x, y, a0 * al * (dd ? 0.9 : 0.95), heat, 0.02, dd ? 1.6 : 2.2, col);
          }
        }
        for (; i < R['fb:' + id][1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
      });
      /* 읽기 — 헤드가 없으니 한꺼번에 여러 page 로(SSD 의 임의 읽기) */
      const [k0, k1] = R.spk, rd = nums(bare(s[IO]['작업'] || ''))[0] || 0, reading = /읽기/.test(bare(s[IO]['작업'] || '')) && modOf(s, IO).has('작업') && !end;
      const live = []; FIDS.forEach((id, j) => { const b = s[FTL].find((x) => x.id === id); for (let c = 0; c < (b ? (b.live || 0) + (b.dead || 0) : 0); c++) live.push(cell(j, c)); });
      const io0 = G.anc[IO] ? [G.anc[IO].x, G.anc[IO].y + 20] : [x0, by - 30];
      for (let i = k0; i < k1; i++) {
        const r = Math.floor((i - k0) / SPK);
        if (!reading || r >= rd || !live.length) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const T0 = live[(r * 7) % live.length], e = show(p, 0.12, 0.34), out = show(p, 0.34, 0.46), m = (i - k0) % SPK;
        const x = U.lerp(io0[0], T0[0], e) + jit[i * 2] * 4, y = U.lerp(io0[1], T0[1], e) + (m - SPK / 2) * 1.2;
        put(o, i, x, y, 0.9 * (1 - out) * (e > 0 ? 1 : 0), 0.8, 0.05, 1.2, GREEN);
      }
    }
    /* HDD 원판 */
    if (HDD) {
      const [h0] = R.hdd, { cx, cy, R: Rr } = G.hdd, H = hddAt(k, p), Pk = HP.per[kk], on = (s.touch.has(HDD) || s.touch.has(IO)) && !end;
      const sectorLit = s.touch.has('op') && !end && /섹터/.test(bare((s.op || {})['최소 전송 단위'] || ''));
      let i = h0;
      const a0 = (on ? 0.85 : 0.55) * dim * form;
      for (let m = 0; m < PLAT; m++, i++) { const th = (m / PLAT) * Math.PI * 2, [x, y] = into(i, cx + Math.cos(th) * Rr, cy + Math.sin(th) * Rr); put(o, i, x, y, a0 * 0.8, 0, 0.02, 1.05, INK); }
      for (let m = 0; m < SPIN; m++, i++) { const th = (m / SPIN) * Math.PI * 2 + H.phi, [x, y] = into(i, cx + Math.cos(th) * Rr * 0.13, cy + Math.sin(th) * Rr * 0.13); put(o, i, x, y, a0, 0, 0.02, 1.1, INK); }
      /* 섹터 — 지금 스텝이 읽은 것은 밝게(임의 = 빨강, 순차 = 초록, 제자리 쓰기 = 금) */
      const done = new Map();
      Pk.tg.slice(0, H.done).forEach((g) => done.set(g.t * SEC + g.s, Pk.mode));
      for (let tr = 0; tr < TRK; tr++) for (let sc2 = 0; sc2 < SEC; sc2++) {
        const th = HP.secA(sc2) + H.phi, r = HP.rad(tr), d = done.get(tr * SEC + sc2);
        const big = d === 'write' || d === 'one', col = d === 'rand' ? RED : d === 'seq' ? GREEN : big ? GOLD : FAINT;
        for (let m = 0; m < SECG; m++, i++) {
          /* 금색(쓴 · 통째로 옮긴) 섹터는 섹터 폭만큼 넓게 — 헤드 표시에 가려지지 않게 */
          const t2 = th + m * (big ? 0.085 : 0.055), [x, y] = into(i, cx + Math.cos(t2) * r, cy + Math.sin(t2) * r);
          put(o, i, x, y, (d ? 0.95 : sectorLit ? 0.7 : 0.38) * dim * form, d ? 0.5 : 0, 0.02, d ? (big ? 3.6 : 2) : 1.05, d ? col : sectorLit ? INK : FAINT);
        }
      }
      const hp = HP.head(HP.rad(H.r));
      for (let m = 0; m < HEAD; m++, i++) { const th = (m / HEAD) * Math.PI * 2, rr = m < 6 ? 4 : 2, [x, y] = into(i, (m < 6 ? hp.x : HP.piv.x) + Math.cos(th) * rr, (m < 6 ? hp.y : HP.piv.y) + Math.sin(th) * rr); put(o, i, x, y, 0.95 * dim * form, m < 6 && on ? 0.6 : 0, 0.02, 1.2, m < 6 ? ACCENT : INK); }
      for (; i < R.hdd[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
      G.hddNow = { hp, H };
    }
    /* 전송 블록 줄 — 새 블록은 읽은 노드(탑의 줄 · 레벨마다의 노드)에서 날아온다 */
    if (TRAY) {
      const n1 = sqOf(s), n0 = end ? n1 : refly(kk) ? 0 : sqOf(prev), [q0] = R.sq, phys = nums(s[IO]['물리 읽기'])[0], on = s.touch.has(IO) && !end;
      const srcs = n1 > n0 ? sourcesOf(kk, n1 - n0, src) : [];
      for (let j = 0; j < PL.SQN; j++) {
        const x = G.L.x0 + j * (SQ + 4) + SQ / 2, y = G.tray.y + SQ / 2;
        const isNew = j >= n0 && j < n1, from = isNew ? srcs[j - n0] : null, f = isNew ? (j - n0) / Math.max(1, n1 - n0) : 0;
        const disk = phys != null && j >= n1 - phys && j < n1;
        for (let m = 0; m < SQ; m++) {
          const i = q0 + j * SQ + m;
          if (j >= n1) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
          let [xx, yy] = m < 12 ? rim(x, y, SQ - 3, SQ - 3, 12, m) : [x + ((m - 12) % 2 ? 1.6 : -1.6), y + (m - 12 > 1 ? 1.6 : -1.6)];
          if (from) { const e = show(p, 0.08 + f * 0.3, 0.2 + f * 0.3); xx = U.lerp(from[0] + (xx - x), xx, e); yy = U.lerp(from[1] + (yy - y), yy, e) - Math.sin(e * Math.PI) * 30; }
          [xx, yy] = into(i, xx, yy);
          put(o, i, xx, yy, (on ? 0.92 : 0.6) * dim * form * (from ? (show(p, 0.06 + f * 0.3, 0.1 + f * 0.3)) : 1), isNew ? 0.4 : 0, 0.02, 1.15, phys != null ? (disk ? RED : GREEN) : ACCENT);
        }
      }
      const m1 = skOf(s), m0 = end ? m1 : skOf(prev), [k0] = R.sk, tc = TONEC[tone(s[IO]['시크'])] ?? INK;
      for (let j = 0; j < PL.SKN; j++) for (let m = 0; m < SEEK; m++) {
        const i = k0 + j * SEEK + m;
        if (j >= m1) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const isNew = j >= m0, e = isNew ? show(p, 0.1 + ((j - m0) / Math.max(1, m1 - m0)) * 0.3, 0.16 + ((j - m0) / Math.max(1, m1 - m0)) * 0.3) : 1;
        const [x, y] = into(i, G.L.x0 + j * 6 + 2, G.tray.y - 12 + m * 3.5);
        put(o, i, x, y, (on ? 0.9 : 0.55) * dim * form * e, 0, 0.02, 1.2, isNew && !end ? tc : INK);
      }
    }
    /* 블록 띠 */
    for (const a of BLK) {
      const [s0, s1] = R['b:' + a], info = G.blk[a].per.get(s), mod = modOf(s, a), on = s.touch.has(a) && !end, by = G.blk[a].y;
      if (!info || !s[a].length) { hideR(s0, s1); continue; }
      const cuts = Object.values(info.P).map(([x]) => x).slice(1), nc = Math.min(cuts.length * 4, CUTS);
      let i = s0;
      for (let m = 0; m < STRIP; m++, i++) {
        const u = Math.floor(m / 2) / Math.ceil(STRIP / 2), x = G.L.x0 + u * G.ww, y = by + (m % 2 ? 26 : 0);
        const id = Object.keys(info.P).find((q) => x >= info.P[q][0] && x < info.P[q][0] + info.P[q][1]), it = id && s[a].find((q) => q.id === id);
        const hot = !!id && mod.has(id) && on, col = hot ? GOLD : it && it.tag !== 'hdr' && it.tag !== 'clean' && it.tag !== '' ? TAGC[it.tag] ?? INK : INK;
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, (on ? 0.85 : 0.45) * dim * form, hot ? 0.5 : 0, 0.02, 1.05, col);
      }
      for (let m = 0; m < CUTS; m++, i++) {
        const c = Math.floor(m / 4);
        if (m >= nc || c >= cuts.length) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const [x, y] = into(i, cuts[c], by + 5 + (m % 4) * 5.3);
        put(o, i, x, y, (on ? 0.85 : 0.45) * dim * form, 0, 0.02, 1.05, INK);
      }
      /* 칸 안 — 이 칸이 무엇을 담았나 */
      const marks = marksOf(a, s);
      let budget = s1 - i;
      s[a].forEach((it, j) => {
        const mk = marks[j], [rx, rw] = info.P[it.id], hot = on && hotIt(s, a, it.id), lv = (on ? (hot ? 0.95 : 0.6) : 0.45) * dim * form;
        const col = it.tag === 'hdr' ? ACCENT : it.tag === 'free' ? FAINT : TAGC[it.tag] ?? INK;
        if (mk.kind === 'key') {
          /* 키 칸은 칸 폭을 나눠 채운다(최대 BKW) — 18px 로 묶으면 꽉 찬 칸이 가운데만 찬 빈 칸으로 보였다(08/1) */
          const cw = Math.min(BKW, (rw - 6) / mk.n - 3), tot = mk.n * cw + (mk.n - 1) * 3;
          for (let q = 0; q < mk.n && budget >= BKG; q++, budget -= BKG) for (let m = 0; m < BKG; m++, i++) { const [x, y] = into(i, ...rim(rx + rw / 2 - tot / 2 + cw / 2 + q * (cw + 3), by + 13, cw, 14, BKG, m)); put(o, i, x, y, lv, 0, 0.02, 1.05, it.tag === 'red' ? RED : INK); }
        } else if (mk.kind === 'rec') {
          for (let q = 0; q < mk.n && budget >= 2; q++, budget -= 2) for (let m = 0; m < 2; m++, i++) { const [x, y] = into(i, rx + 2 + ((q + 0.5) / mk.n) * (rw - 4), by + 7 + m * 12); put(o, i, x, y, lv * 0.9, 0, 0.02, 1, it.tag === 'gold' ? GOLD : INK); }
        } else if (mk.kind === 'byte') {
          const cw = rw / mk.n;
          for (let q = 0; q < mk.n && budget >= 12; q++, budget -= 12) for (let m = 0; m < 12; m++, i++) { const [x, y] = into(i, ...rim(rx + (q + 0.5) * cw, by + 13, cw - 5, 16, 12, m)); put(o, i, x, y, lv, 0, 0.02, 1.1, col); }
        } else {
          for (let q = 0; q < mk.n && budget >= 1; q++, budget--, i++) { const cols = Math.max(1, Math.round(mk.n / 2)), [x, y] = into(i, rx + 3 + ((q % cols) + 0.5) / cols * (rw - 6), by + 9 + (Math.floor(q / cols) % 2) * 8); put(o, i, x, y, lv * (it.tag === 'free' ? 0.45 : 0.8), 0, 0.02, 1, col); }
        }
      });
      for (; i < s1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    }
    /* act — 덩어리가 f 에서 t 로 */
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, kk, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
        put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, Math.max(G.L.y0 + 4, U.lerp(fy, ty2, e) + Math.sin(th) * r - arc), (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, col);
      }
    } else hide('tok');
  }
  /* 탑(BST)의 줄 j 를 지금 읽었나 — 하강하는 스텝에서 위부터 차례로 */
  function readRow(k, p, j, end, rows) {
    if (end || !TRAY) return false;
    const s = S[k], n1 = sqOf(s), n0 = refly(k) ? 0 : sqOf(stOf(prevIdx[k]));
    if (n1 <= n0) return false;
    /* 하강(트리에서 시작하는 act)이거나 첫 읽기(02/1 의 루트)면 위부터, 아니면 다시 읽는 것은 아래 줄이다 — 02/4 의 회전은 리프 가까이에서 일어난다 */
    const r = (s.step.act && TREES.includes(s.step.act.f)) || n0 === 0 ? j : rows - 1 - j;
    return r >= 0 && r < n1 - n0 && p >= 0.08 + (r / Math.max(1, n1 - n0)) * 0.3;
  }
  /* 트리에서 io 로 가는 act — 수가 그대로여도(init 에 이미 적힌 셈) 그 하강을 다시 보인다 */
  function refly(k) { const a = S[k].step.act; return !!(a && a.t === IO && TREES.includes(a.f)); }
  /* 새 전송 블록이 날아오는 곳 — 이 스텝에 바뀐 트리 노드, 아니면 act 가 트리에서 시작하면 레벨마다 하나(탑은 줄마다) */
  function sourcesOf(k, n, src) {
    const s = S[k], act = s.step.act;
    for (const a of TREES) {
      if (!TS[a].real) continue;
      const { box } = nodesAt(a, k), mod = [...modOf(s, a)].filter((id) => box.has(id));
      if (mod.length && !(act && act.f === a && act.t === IO)) return Array.from({ length: n }, (_, j) => { const b = box.get(mod[Math.min(j, mod.length - 1)]); return [b.x, b.y]; });
      if (act && act.f === a) {
        const bs = [...box.values()];
        if (TS[a].mode === 'tower') return Array.from({ length: n }, (_, j) => { const b = bs[Math.min(j, bs.length - 1)]; return [b.x, b.y]; });
        const per = [];
        for (const b of bs) if (!per.some((q) => q.n.lvl === b.n.lvl)) per.push(b);
        return Array.from({ length: n }, (_, j) => { const b = per[Math.min(j, per.length - 1)]; return [b.x, b.y]; });
      }
    }
    /* act 없이 늘어난 읽기 — 탑이 있으면 첫 읽기는 루트 줄부터(02/1), 다시 읽기는 아래 줄들에서(02/4 의 회전) */
    const first = sqOf(stOf(prevIdx[k])) === 0;
    for (const a of TREES) {
      if (!TS[a].real || TS[a].mode !== 'tower') continue;
      const bs = [...nodesAt(a, k).box.values()];
      if (bs.length) return Array.from({ length: n }, (_, j) => { const b = bs[first ? Math.min(j, bs.length - 1) : Math.max(0, bs.length - 1 - j)]; return [b.x, b.y]; });
    }
    return Array.from({ length: n }, () => src || [G.L.x0, G.L.y0]);
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK;
    const TA = TX[Math.min(k, NK - 1)], TB = TX[Math.min(next, NK - 1)], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
      }
      placeLabels(kk);
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    /* 옮겨 가거나 새로 난 키 칸의 이름은 칸이 내려앉은 뒤에 */
    const late = new Set();
    if (b < 0.5 && k < NK) for (const a of TREES) if (TS[a].mode === 'bt') {
      const C1 = chipsAt(a, k), C0 = chipsAt(a, prevIdx[k]);
      for (const [c, P1] of C1) { const P0 = C0.get(c); if (!P0 || P0.x !== P1.x || P0.y !== P1.y) late.add(TLB[a].ch[c]); }
    }
    const lateO = show(p, 0.4, 0.5);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a2 = TA.get(lb), c = TB.get(lb), same = a2 && c && a2[0] === c[0] && (a2[3] ?? true) === (c[3] ?? true);
      setO(lb, vis ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) * (late.has(lb) ? lateO : 1) : 0);
      void txt;
    }
    const s = S[Math.min(k, NK - 1)], act = k < NK && s.step.act ? s.step.act : null;
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchor(act.f, s, Math.min(k, NK - 1), act.lb), [tx2, ty2] = anchor(act.t, s, Math.min(k, NK - 1), act.lb), e = U.smooth(show(p, 0.08, 0.42));
      const arc = act.f === act.t ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arc - (act.f === act.t ? 30 : 14));
      tok.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }
  function placeLabels(kk) {
    const s = S[kk];
    for (const a of TREES) {
      const T = TS[a], lb = TLB[a];
      if (!T.real) continue;
      const { box } = nodesAt(a, kk);
      if (T.mode === 'bt') {
        for (const [id, B] of box) {
          const top = B.y - B.h / 2 + PADY;
          place(lb.id[id], B.x - B.w / 2 + PADX, top - 1, 'l', 't');
          place(lb.no[id], B.x + B.w / 2 - PADX, top - 1, 'r', 't');
          place(lb.tx[id], B.x, top + IDH, 'c', 't');
        }
        for (const [c, P] of chipsAt(a, kk)) place(lb.ch[c], P.x, P.y, 'c', 'c');
      } else if (T.mode === 'keyed') {
        for (const [id, B] of box) { place(lb.id[id], B.x, B.y - 1, 'c', 'c'); place(lb.tx[id], B.x + B.w / 2 + 5, B.y, 'l', 'c'); }
      } else {
        for (const n of TI(a, kk).nodes) {
          const b0 = box.get('row:' + n.row0), b1 = box.get('row:' + (n.row0 + n.rep - 1));
          place(lb.id[n.id], b0.x + b0.w / 2 + 12, (b0.y + b1.y) / 2, 'l', 'c');
        }
      }
    }
    if (SEP) {
      const ax = s[SEP].axis || { min: 0, max: 1 }, X = (v) => G.L.x0 + ((v - ax.min) / (ax.max - ax.min)) * G.ww, y = G.sep.y;
      for (const it of s[SEP]) place(sepLb.v[it.id], X(it.v), y - 9, 'c', 'b');
      for (const sp of s[SEP].spans) place(sepLb.sp[sp.id], (X(sp.from) + X(sp.to)) / 2, y + 18 + (sp.row || 0) * 30 + 4, 'c', 't');
      place(sepLb.lo, X(ax.min) + 6, y + 4, 'c', 't'); place(sepLb.hi, X(ax.max) - 8, y + 4, 'c', 't');
      const mk = markOf(s); if (mk != null) place(sepLb.mk, X(mk), y - 12, 'c', 'b');
    }
    if (NODE) for (const it of s[NODE]) { const P = nlSlot(s, it.id); if (P) place(nlLb[it.id], P.x, P.y, 'c', 'c'); }
    /* 빈 목록의 '—' 는 칸이 놓일 자리(머리 이름 바로 아래)에 — 설명 열에 두면 머리에서 300px 떨어져 떠 있었다(04/1 · 07/1) */
    if (NODE) { if (s[NODE].length) place(nlCap, ...G.nl.capAt); else place(nlCap, G.L.x0 + 4, G.nl.y + 6); }
    if (TRAY) place(sqCap, G.L.x0, G.tray.y + SQ + 5, 'l', 't');
    if (FTL) place(ftMv, G.ssd.x0 + G.ssd.bw + G.ssd.bgap / 2, G.ssd.y + G.ssd.bh / 2 - 6, 'c', 'b');
    if (HDD && HP) {
      const P = HP.per[kk], last = P.seq[P.seq.length - 1];
      if (last) {
        const hp = HP.head(HP.rad(last.r)), { cx, cy, R: Rr } = G.hdd, d = Math.hypot(hp.x - cx, hp.y - cy) || 1, ux = (hp.x - cx) / d, uy = (hp.y - cy) / d;
        G.hdLbAt = { x: cx + ux * (Rr + 16), y: cy + uy * (Rr + 16), from: hp, ux, uy };
        place(hdLb, G.hdLbAt.x, G.hdLbAt.y, ux < -0.2 ? 'r' : ux > 0.2 ? 'l' : 'c', uy < -0.2 ? 'b' : uy > 0.2 ? 't' : 'c');
      }
    }
    for (const a of BLK) {
      const info = G.blk[a].per.get(s), B = G.blk[a];
      if (!info) continue;
      for (const q of info.NM) place(bLb[a].n[q.id], q.l, B.y - 3 - q.row * RH, 'l', 'b');
      for (const q of info.VL) place(bLb[a].v[q.id], q.l, B.y + 26 + 5 + q.row * RH, 'l', 't');
      place(bLb[a].cap, G.L.x0, B.capY);
    }
  }

  const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  function arrow(ctx, x0, y0, x1, y1, head = 5) {
    const an = Math.atan2(y1 - y0, x1 - x0);
    seg(ctx, x0, y0, x1, y1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(an - 0.45), y1 - head * Math.sin(an - 0.45));
    ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(an + 0.45), y1 - head * Math.sin(an + 0.45)); ctx.stroke();
  }
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const css = cssOf(), kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save(); ctx.lineWidth = 1;
    if (G.edgeY != null) { ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]); seg(ctx, L.x0, G.edgeY, L.x1, G.edgeY); ctx.setLineDash([]); }
    for (const a of TREES) {
      const T = TS[a];
      if (!T.real) continue;
      const st = TI(a, kk), { box, stubs } = nodesAt(a, kk), on = s.touch.has(a) && !end;
      if (T.mode === 'bt') {
        for (const n of st.nodes) {
          if (!n.par) continue;
          const C = box.get(n.id);
          n.par.forEach((par, pj) => {
            const ks = par.kidsOf, j = ks.indexOf(n), A0 = anchorOf(a, kk, par, n, j, ks.length);
            if (!A0) return;
            const bad = (par.bad || []).some((q) => q.c === n), shared = par.gapOf && par.gapOf.get(n) != null && ks.some((x) => x !== n && par.gapOf.get(x) === par.gapOf.get(n));
            /* 이 스텝에 새로 할당된 빈 노드 — 부모에는 아직 그 포인터가 없다(08/2 의 책 1단계). 칸을 나눠 갖는 자식처럼 점선 */
            const fresh = par.P.pipes && n.P.lo == null && n.P.hi == null && !(n.P.chips && n.P.chips.length) && !(TI(a, prevIdx[kk]).nodes || []).some((x) => x.id === n.id);
            const band = n.par.length > 1, cx = band ? C.x - C.w / 2 + (C.w * (pj + 0.5)) / n.par.length : C.x;
            ctx.globalAlpha = (bad ? 0.85 : on ? 0.55 : 0.35) * o; ctx.strokeStyle = bad ? css.red : css.ink; ctx.lineWidth = bad ? 1.4 : 1;
            ctx.setLineDash(bad || shared || fresh ? [3, 3] : []);
            const PM = miniOf(box.get(par.id)), CM = miniOf(C), top = C.y - C.h / 2 - 1;
            if (PM && C.n.agg > 16) PM.forEach((m, q) => seg(ctx, m.x, m.y + m.h / 2 + 1, C.x - C.w / 2 + PADX + ((q + 0.5) / PM.length) * (C.w - 2 * PADX), top));
            else if (CM) CM.forEach((m) => seg(ctx, A0[0], A0[1], m.x, top));
            else seg(ctx, A0[0], A0[1], cx, top);
            ctx.setLineDash([]);
          });
        }
        for (const sb of stubs) {
          const par = st.nodes.find((x) => x.id === sb.par), P = box.get(sb.par);
          if (!par || !P) continue;
          const ch = chipsAt(a, kk), ci = CI(a, kk).filter((q) => q.node === par.id);
          let ax = P.x;
          if (ci.length) { const g = sb.g; if (g <= 0) { const c = ch.get(ci[0].id); ax = c.x - c.w / 2 - 3; } else if (g >= ci.length) { const c = ch.get(ci[ci.length - 1].id); ax = c.x + c.w / 2 + 3; } else { const c0 = ch.get(ci[g - 1].id), c1 = ch.get(ci[g].id); ax = (c0.x + c0.w / 2 + c1.x - c1.w / 2) / 2; } }
          ctx.globalAlpha = 0.28 * o; ctx.strokeStyle = css.faint;
          seg(ctx, ax, P.y + P.h / 2, sb.x, sb.y - sb.h / 2 - 1);
        }
        /* 형제 링크 — 노드 목록에 FIL_PAGE_NEXT · PREV/NEXT 가 있을 때, 같은 레벨 이웃끼리 양방향 */
        const sib = NODE && s[NODE].some((x) => /FIL_PAGE_NEXT|PREV\/NEXT/.test(x.id + ' ' + x.sub));
        if (sib) {
          const deep = st.levels[st.levels.length - 1], lit = s.touch.has(NODE) && !end;
          ctx.globalAlpha = (lit ? 0.85 : 0.35) * o; ctx.strokeStyle = lit ? css.accent : css.ink;
          for (let j = 0; j + 1 < deep.length; j++) {
            const P0 = box.get(deep[j].id), P1 = box.get(deep[j + 1].id);
            arrow(ctx, P0.x + P0.w / 2 + 1, P0.y + 4, P1.x - P1.w / 2 - 1, P1.y + 4, 4);
            arrow(ctx, P1.x - P1.w / 2 - 1, P1.y + 10, P0.x + P0.w / 2 + 1, P0.y + 10, 4);
          }
          if (deep.length === 1 && s[NODE].some((x) => /추적/.test(x.id))) {
            const P0 = box.get(deep[0].id); ctx.setLineDash([3, 3]);
            arrow(ctx, P0.x + P0.w / 2 + 2, P0.y, Math.min(L.x1, P0.x + P0.w / 2 + 60), P0.y, 5); ctx.setLineDash([]);
          }
        }
      } else if (T.mode === 'keyed') {
        /* 트리 안의 act(회전)가 고쳐 쓴 포인터 — 앞 스텝에 없던 부모 → 자식 짝은 금색 */
        const sp = TI(a, prevIdx[kk]), self = on && s.step.act && s.step.act.f === a && s.step.act.t === a && sp && !sp.empty;
        for (const n of st.nodes) {
          const P = box.get(n.up), C = box.get(n.id);
          if (!P || !C) continue;
          const re = self && !sp.nodes.some((q) => q.id === n.id && q.up === n.up);
          ctx.globalAlpha = (re ? 0.85 : on ? 0.6 : 0.4) * o; ctx.strokeStyle = re ? css.gold : n.ghost ? css.faint : css.ink; ctx.lineWidth = re ? 1.6 : 1;
          ctx.setLineDash(n.ghost ? [2, 4] : []);
          seg(ctx, P.x + (C.x - P.x) * (P.h / 2) / Math.hypot(C.x - P.x, C.y - P.y), P.y + P.h / 2, C.x, C.y - C.h / 2);
          ctx.setLineDash([]); ctx.lineWidth = 1;
        }
      } else {
        const rows = [...box.values()];
        ctx.globalAlpha = 0.3 * o; ctx.strokeStyle = css.ink;
        const kx = (r) => r.x - r.w / 2 + Math.max(4, r.w * (r.n.fill || 0)) / 2;
        for (let j = 0; j + 1 < rows.length; j++) seg(ctx, kx(rows[j]), rows[j].y + 2, kx(rows[j + 1]), rows[j + 1].y - 2);
      }
    }
    if (HDD && G.hddNow) {
      const { hp } = G.hddNow;
      ctx.globalAlpha = 0.8 * o; ctx.strokeStyle = css.ink; ctx.lineWidth = 2;
      const d = Math.hypot(hp.x - HP.piv.x, hp.y - HP.piv.y), u = Math.max(0, (d - 7) / d);
      seg(ctx, HP.piv.x, HP.piv.y, HP.piv.x + (hp.x - HP.piv.x) * u, HP.piv.y + (hp.y - HP.piv.y) * u); ctx.lineWidth = 1;
      const hl = G.hdLbAt, wr = HP.per[kk] && (HP.per[kk].mode === 'write' || HP.per[kk].mode === 'one') && !end;
      if (hl && wr) { const { cx, cy, R: Rr } = G.hdd; ctx.globalAlpha = 0.6 * o * show(k === kk ? p : 1, 0.4, 0.5); ctx.strokeStyle = css.gold; ctx.setLineDash([2, 3]); seg(ctx, cx + hl.ux * (Rr + 2), cy + hl.uy * (Rr + 2), cx + hl.ux * (Rr + 12), cy + hl.uy * (Rr + 12)); ctx.setLineDash([]); }
    }
    if (FTL && s[FTL].length) {
      /* FTL — 매핑이 바뀌는 스텝(블록 글이 바뀐다)에 논리 page → 물리 page 선. 지운 블록 → 새 블록 */
      const mod = [...modOf(s, FTL)];
      if (mod.length && !end) {
        const { bw, bgap, x0, y: by, bh } = G.ssd;
        ctx.globalAlpha = 0.6 * o * show(k === kk ? p : 0, 0.1, 0.3); ctx.strokeStyle = css.gold; ctx.setLineDash([3, 3]);
        if (mod.length >= 2) arrow(ctx, x0 + bw + 4, by + bh / 2, x0 + bw + bgap - 4, by + bh / 2, 6);
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  return {
    num: sc.num,
    build,
    built: () => built,
    pose, paint, overlay,
    reset() { shown = -2; tokO = -1; },
    hide() { for (const lb of made) { lb.el.style.opacity = '0'; lb.o = 0; } },
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
