/* book/ch2 세계의 모형 — DOM 없이 장면 데이터만 읽는다. 그리는 쪽(ch2.js)과 증명 도구가 함께 쓴다.
     · parseNode — tree 항목의 keys 글을 칸(chips) · 범위 · 행 수 · page 수로 푼다
         '| 20 | 40 | 60 |'  분리 키 칸(pipes) · '7 8 9 10 12 13'  키 칸 · '[45]' 짚은 키 · '−∞(1)' MIN_REC
         '< 20' · '20 ‥ 39' · '≥ 60' · '첫 키 32428'  범위 · '54행' · '601개'  행 수 · '3,705 page'  page 수
         ' ← 읽음'  곁말(note)
     · treeState — 한 스텝의 트리 : 레벨 · 부모 · 자식이 드는 분리 키 사이(gap) · 아래에 그리지 않은 자식(stub)
       BST 는 키 값으로 자리를 잡는다(kids · upto), 탑(rep)은 레벨마다 블록 하나
     · checks — 데이터 끼리의 셈 맞추기. 어긋나면 글 한 줄씩 돌려준다(세계가 console.error 로 낸다) */
import { bake, stepsOf } from '../../bake.js';

export const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
export const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const NUMRE = /^-?\d[\d,]*(\.\d+)?$/;
const num = (s) => +String(s).replace(/,/g, '');
export const nums = (v) => (bare(v).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(num);
export const fmt = (n) => Number(n).toLocaleString('en-US');
const EPS = 1e-9;

/* ── keys 글 → 칸 · 범위 · 수 ── */
export function parseNode(raw) {
  const s0 = String(raw ?? '');
  const m = /\s*←\s*(.*)$/.exec(s0);
  const note = m ? m[1].trim() : '';
  const main = (m ? s0.slice(0, m.index) : s0).trim();
  const P = { raw: s0, main, note, chips: null, text: '', pipes: false, lo: null, hi: null, first: null, count: null, pages: null, kids: null };
  const chipTok = (t) => {
    const b = /^\[(.+)\]$/.exec(t), u = b ? b[1] : t;
    if (NUMRE.test(u)) return { t: u, v: num(u), hot: !!b };
    if (/^−∞(\(\d+\))?$/.test(u)) return { t: u, v: -Infinity, hot: !!b, min: true, key: /\((\d+)\)/.test(u) ? +/\((\d+)\)/.exec(u)[1] : null };
    if (u === '…') return { t: u, v: null, hot: false, gap: true };
    return null;
  };
  if (/^\|.*\|$/.test(main)) {
    P.pipes = true;
    const toks = main.slice(1, -1).split('|').map((x) => x.trim()).filter(Boolean);
    const cs = toks.map(chipTok);
    if (cs.every(Boolean)) P.chips = cs; else { P.chips = []; P.text = toks.join(' '); }
  } else if (/^\(.*\)$/.test(main)) { P.chips = []; P.text = main; }
  else {
    const toks = main.split(/\s+/).filter(Boolean), cs = toks.map(chipTok);
    if (toks.length && cs.every((c) => c && !c.gap && !c.min)) P.chips = cs; else P.text = main;
  }
  if (P.chips && P.chips.length) {
    const vs = P.chips.filter((c) => c.v != null && Number.isFinite(c.v)).map((c) => c.v);
    if (vs.length) { P.lo = Math.min(...vs); P.hi = Math.max(...vs); }
  }
  if (P.text && !P.pipes) {
    const vals = [];
    for (const seg of P.main.split(/\s+·\s+/)) {
      let r;
      if ((r = /^<\s*([\d,]+)$/.exec(seg))) { P.lo = -Infinity; P.hi = num(r[1]) - 1e-6; }
      else if ((r = /^≥\s*([\d,]+)$/.exec(seg))) { P.lo = num(r[1]); P.hi = Infinity; }
      else if ((r = /^([\d,]+)\s*‥\s*([\d,]+)$/.exec(seg))) vals.push(num(r[1]), num(r[2]));
      else if (NUMRE.test(seg)) vals.push(num(seg));
      else if ((r = /^첫 키\s*([\d,]+)$/.exec(seg))) { P.first = num(r[1]); P.lo = P.first; }
      else if ((r = /^리프\s*([\d,]+)\s*개$/.exec(seg))) P.kids = num(r[1]);
      else if ((r = /^자식\s*([\d,]+)$/.exec(seg)) || (r = /·?\s*자식\s*([\d,]+)/.exec(seg))) P.kids = num(r[1]);
      else if ((r = /^([\d,]+)\s*page\b/.exec(seg))) P.pages = num(r[1]);
      if (!P.count && (r = /([\d,]+(?:\.\d+)?)\s*(행|개)/.exec(seg)) && !/^리프/.test(seg) && !/^자식/.test(seg)) P.count = { n: num(r[1]), unit: r[2] };
    }
    if (vals.length) { P.lo = Math.min(...vals); P.hi = Math.max(...vals); }
  }
  return P;
}
/* 노드가 page 여럿을 한 칸으로 줄여 그린 것인가 — 'internal ×8' · '3,705 page' */
export function aggOf(it, P) {
  const m = /×\s*([\d,]+)/.exec(String(it.id));
  if (m) return num(m[1]);
  return P.pages && P.pages > 1 ? P.pages : null;
}
export const isPlaceholder = (items) => items.length === 1 && String(items[0].id) === '—';

/* ── 한 스텝의 트리 ── */
export function treeState(items, kind, nodeList) {
  if (!items || !items.length || isPlaceholder(items)) return { empty: true, label: items && items[0] ? items[0].keys || '' : '', nodes: [], levels: [], depth: 0 };
  const isBst = kind === 'bst';
  const allNum = items.every((it) => /^\d+$/.test(String(it.id)) || String(it.id) === '…');
  if (isBst && allNum) return bstKeyed(items);
  if (isBst) return bstTower(items);
  const nodes = items.map((it, i) => {
    const P = parseNode(it.keys);
    return { id: String(it.id), lvl: it.lvl ?? 0, fill: it.fill ?? 0, P, agg: aggOf(it, P), it, i };
  });
  const lv = [...new Set(nodes.map((n) => n.lvl))].sort((a, b) => a - b);
  const levels = lv.map((l) => nodes.filter((n) => n.lvl === l));
  /* 부모 — 바로 위 레벨. 하나면 모두, 여럿이면 차례로 고르게(데이터에 링크가 없다). 아래가 한 칸으로 줄인 page 묶음이면 위 레벨 모두가 그것을 가리킨다 */
  for (let j = 1; j < levels.length; j++) {
    const up = levels[j - 1], dn = levels[j];
    const band = dn.length === 1 && dn[0].agg > 1 && up.length > 1;
    dn.forEach((c, k) => { c.par = band ? up : [up[Math.min(up.length - 1, Math.floor((k * up.length) / dn.length))]]; });
  }
  for (const n of nodes) n.kidsOf = [];
  for (const n of nodes) for (const p of n.par || []) p.kidsOf.push(n);
  /* 자식이 드는 분리 키 사이 — gap g 는 칸 g-1 과 칸 g 사이(0 은 맨 앞). 레벨 맨 왼쪽 page 의 첫 칸은 MIN_REC 처럼 −∞ 로 본다 */
  for (const p of nodes) {
    if (!p.P.pipes || !p.kidsOf.length) continue;
    const cs = p.P.chips, m = cs.length, leftmost = levels[lv.indexOf(p.lvl)][0] === p && p.kidsOf.length === m;
    const below = (g) => { if (g === 1 && leftmost && cs[0] && cs[0].v != null) return -Infinity; for (let q = g - 1; q >= 0; q--) if (cs[q].v != null) return cs[q].v; return -Infinity; };
    const above = (g) => { for (let q = g; q < m; q++) if (cs[q].v != null) return cs[q].v; return Infinity; };
    let g0 = 0;
    p.gapOf = new Map(); p.bad = [];
    for (const c of p.kidsOf) {
      if (c.P.lo == null && c.P.hi == null) { p.gapOf.set(c, null); continue; }
      const lo = c.P.lo ?? -Infinity, hi = c.P.hi ?? lo;
      let g = -1;
      for (let q = g0; q <= m; q++) { const up = above(q); if (lo >= below(q) - EPS && (up === Infinity || hi < up - EPS)) { g = q; break; } }
      if (g < 0) { p.bad.push({ c, lo, hi, stale: cs.filter((x) => x.v != null && x.v > lo && x.v <= hi).map((x) => x.v) }); p.gapOf.set(c, null); continue; }
      p.gapOf.set(c, g); g0 = g;
    }
    /* InnoDB 식(레코드 하나 = 자식 하나) — 칸 수와 자식 수가 같고, 첫 칸이 −∞ 이거나 자식의 첫 키가 그 칸과 같을 때. 아니면 책 식(칸 사이에서 내려간다) */
    const ks = p.kidsOf;
    p.rec = m >= 2 && ks.length === m && (cs[0].min || ks.every((c, k) => (k === 0 && leftmost) || (c.P.lo != null && cs[k].v === c.P.lo)));
  }
  /* 아래에 자식을 그리지 않은 비리프(가장 깊은 레벨이 분리 키 칸) — 책 식으로 칸 수 + 1 개, −∞ 로 시작하면 칸 수만큼 stub */
  const deep = levels[levels.length - 1];
  const stubs = [];
  if (deep.every((n) => n.P.pipes)) deep.forEach((n) => { const c = n.P.chips || []; const k = c.length && c[0].min ? c.length : c.length + 1; for (let q = 0; q < k; q++) stubs.push({ par: n, g: c[0] && c[0].min ? q + 1 : q }); });
  /* 노드 목록(node 배우)의 같은 이름 항목 — 'a / b' 는 키 수 / 용량, 'N%' 는 채움 */
  for (const n of nodes) {
    const li = nodeList && nodeList.find((x) => String(x.id) === n.id);
    if (!li) continue;
    const sub = String(li.sub || '');
    const r = /(\d+)\s*\/\s*(\d+)/.exec(sub), c = /N\s*=\s*(\d+)/.exec(sub), pc = /(\d+)\s*%/.exec(sub);
    n.cap = r ? +r[2] : c ? +c[1] : null; n.has = r ? +r[1] : null; n.pct = pc ? +pc[1] : null;
  }
  return { nodes, levels, depth: levels.length + (stubs.length ? 1 : 0), stubs, lv };
}
function bstKeyed(items) {
  /* 키 값이 곧 가로 자리(중위 순서), lvl 이 세로. kids 는 그 노드의 두 자식(잎), upto 는 '…' 사슬이 닿는 끝 */
  const nodes = [];
  const maxK = Math.max(0, ...items.filter((it) => /^\d+$/.test(String(it.id))).map((it) => +it.id));
  for (const it of items) {
    const id = String(it.id);
    const v = id === '…' ? maxK + 1 : +id;
    nodes.push({ id, v, lvl: it.lvl ?? 0, fill: it.fill ?? 0, cap: it.keys || '', it, item: true });
    if (Array.isArray(it.kids)) for (const k of it.kids) nodes.push({ id: String(k), v: k, lvl: (it.lvl ?? 0) + 1, fill: it.fill ?? 0, cap: '', kid: true, up: id });
    if (it.upto) nodes.push({ id: String(it.upto), v: it.upto, lvl: (it.lvl ?? 0) + (it.upto - v), fill: it.fill ?? 0, cap: '', ghost: true, up: id, from: v });
  }
  /* 부모 — kids 는 그 노드, 아니면 바로 위 레벨에서 값이 가장 가까운 노드(사슬 · 회전 한 번 뒤의 2(1, 3 → …)) */
  for (const n of nodes) if (!n.up) {
    const ps = nodes.filter((q) => q.item && q.lvl === n.lvl - 1).sort((x, y) => Math.abs(x.v - n.v) - Math.abs(y.v - n.v));
    if (ps.length) n.up = ps[0].id;
  }
  /* '…' 이 품은 값(사이의 키) — 그리지 않은 노드는 '…' 자리에 접힌다 */
  const hide = [];
  for (const n of nodes) if (n.ghost) for (let v = n.from; v < n.v; v++) hide.push(v);
  const lvMax = Math.max(...nodes.map((n) => n.lvl));
  return { bst: 'keyed', nodes, depth: lvMax + 1, folded: hide, vmax: Math.max(...nodes.map((n) => n.v)) };
}
function bstTower(items) {
  /* 레벨마다 블록 하나 — rep 이 있으면 그 수만큼(…  18 레벨) */
  const rows = [], nodes = [];
  for (const it of items) {
    const n = { id: String(it.id), lvl: it.lvl ?? 0, fill: it.fill ?? 0, cap: it.keys || '', rep: it.rep || 1, row0: rows.length, it };
    nodes.push(n);
    for (let q = 0; q < n.rep; q++) rows.push(n);
  }
  return { bst: 'tower', nodes, rows, depth: rows.length };
}

/* ── 키 칸의 정체 — 같은 값이 스텝 사이에서 그대로 있거나 옮겨 가거나 복사된다 ──
   같은 노드에 남은 값은 그대로, 남은 것끼리는 차례로 짝지어 옮기고, 짝이 없으면 새로(복사면 옛 자리에서) 나거나 사라진다 */
export function chipIdentity(states) {
  let next = 0;
  const out = [];
  let prev = [];
  for (const T of states) {
    const cur = [];
    if (!T.empty && !T.bst) for (const n of T.nodes) (n.P.chips || []).forEach((c, k) => cur.push({ node: n.id, k, t: c.t, v: c.v, c }));
    const used = new Set();
    /* 같은 레코드 — 같은 노드 같은 자리에서 키가 같으면(MIN_REC 표시가 붙은 '−∞(1)' 은 키 1) 글이 바뀌어도 그 칸이다 */
    const keyOf = (c) => (c.min ? c.key : c.v);
    for (const q of cur) {
      const p = prev.find((x) => !used.has(x) && x.t === q.t && x.node === q.node)
        || prev.find((x) => !used.has(x) && x.node === q.node && x.k === q.k && keyOf(x.c) != null && keyOf(x.c) === keyOf(q.c));
      if (p) { used.add(p); q.id = p.id; q.from = 'stay'; }
    }
    for (const q of cur) {
      if (q.id != null) continue;
      const p = prev.find((x) => !used.has(x) && x.t === q.t && !cur.some((y) => y.id === x.id));
      if (p) { used.add(p); q.id = p.id; q.from = 'move'; }
      else { q.id = next++; q.from = prev.some((x) => x.t === q.t) ? 'copy' : 'born'; q.src = prev.find((x) => x.t === q.t) || null; }
    }
    out.push(cur);
    prev = cur;
  }
  return { per: out, n: next };
}

/* ── 셈 맞추기 ── */
const KVH = ['트리 높이', '높이'];
export function checks(deck, sc) {
  const A = deck.ACTORS, cast = (sc.cast || []).filter((a) => A[a]);
  const steps = stepsOf(sc, null), frames = bake(sc, null);
  const states = [sc.init, ...frames.map((f) => f.st)];
  const at = (i) => `book/ch2 ${sc.num} 세계 : ${i ? i + ' 스텝' : 'init'}`;
  const E = [];
  const kvOf = (st, a) => (st[a] && st[a].kv) || {};
  const itemsOf = (st, a) => (st[a] && st[a].items) || [];
  const trees = cast.filter((a) => A[a].kind === 'tree');
  const op = cast.find((a) => A[a].kind === 'kv' && a === 'op');
  const nodeA = cast.find((a) => a === 'node');
  /* 트리마다 스텝별 상태 */
  for (const a of trees) {
    const T = states.map((st) => treeState(itemsOf(st, a), a, nodeA ? itemsOf(st, nodeA) : null));
    T.forEach((t, i) => {
      if (t.empty) return;
      /* C3 fill 0..1 */
      for (const n of t.nodes) if (n.fill < 0 || n.fill > 1) E.push(`${at(i)} 의 ${a} ${n.id} fill ${n.fill} 가 0‥1 밖이다`);
      if (t.bst === 'keyed') {
        /* C12 BST — 왼쪽 자식 < 노드 < 오른쪽 자식, 사슬은 내려갈수록 커진다(오른쪽 자식) */
        for (const n of t.nodes) {
          const p = t.nodes.find((q) => q.id === n.up);
          if (!p) continue;
          const sib = t.nodes.filter((q) => q.up === p.id && q.kid);
          if (n.kid && sib.length === 2 && !(sib[0].v < p.v && p.v < sib[1].v)) E.push(`${at(i)} 의 ${a} ${p.id} 의 자식 ${sib.map((q) => q.v).join(', ')} 이 BST 순서가 아니다`);
          if (!n.kid && !n.ghost && p.item && t.nodes.filter((q) => q.up === p.id && !q.kid).length === 1 && !(n.v > p.v)) E.push(`${at(i)} 의 ${a} 사슬 ${p.id} → ${n.id} 가 오름차순이 아니다`);
        }
      }
      if (!t.bst) {
        for (const n of t.nodes) {
          /* C1 칸 안의 키는 오름차순(−∞ 이 맨 앞) */
          const vs = (n.P.chips || []).filter((c) => c.v != null).map((c) => c.v);
          for (let k = 1; k < vs.length; k++) if (!(vs[k] > vs[k - 1])) E.push(`${at(i)} 의 ${a} ${n.id} 의 키가 오름차순이 아니다 — ${vs.join(' ')}`);
          /* C4a 노드 목록의 'a / b'(키 수 / 용량) 와 칸 수 · fill */
          if (n.cap && n.has != null && n.P.chips) {
            const keys = n.P.chips.filter((c) => !c.gap).length;
            if (keys !== n.has) E.push(`${at(i)} 의 ${a} ${n.id} 칸 ${keys} 개가 노드 목록의 ${n.has}/${n.cap} 와 다르다`);
            if (Math.abs(n.fill - Math.min(1, n.has / n.cap)) > 0.02) E.push(`${at(i)} 의 ${a} ${n.id} fill ${n.fill} 이 ${n.has}/${n.cap} 와 맞지 않는다`);
          }
          if (n.pct != null && Math.abs(n.fill * 100 - n.pct) > 1.5) E.push(`${at(i)} 의 ${a} ${n.id} fill ${n.fill} 이 노드 목록의 ${n.pct}% 와 다르다`);
          /* C2 자식이 분리 키 사이에 든다 — 부모가 다음에 바뀌는 스텝에서 바로잡히면 그 사이는 낡은 분리 키(그림에 빨갛게) */
          for (const b of n.bad || []) {
            let fixed = false;
            for (let j = i + 1; j < T.length; j++) {
              const pj = T[j].nodes && T[j].nodes.find((x) => x.id === n.id);
              if (!pj) break;
              if (pj.P.raw === n.P.raw) continue;
              fixed = !(pj.bad || []).some((x) => x.c.id === b.c.id);
              break;
            }
            b.ok = fixed;
            if (!fixed) E.push(`${at(i)} 의 ${a} ${b.c.id} [${b.lo}, ${b.hi}] 가 부모 ${n.id} 의 분리 키 사이에 들지 않는다`);
          }
        }
        /* C6 레벨의 page 수 — 부모가 밝힌 자식 수(자식 N · 'N개' 의 합) = 아래 레벨의 page 수(×N · N page) */
        for (let j = 0; j + 1 < t.levels.length; j++) {
          const up = t.levels[j], dn = t.levels[j + 1];
          if (!dn.every((c) => c.agg)) continue;
          const below = dn.reduce((s, c) => s + c.agg, 0);
          const stated = up.every((p) => p.P.kids != null) ? up.reduce((s, p) => s + p.P.kids, 0)
            : up.every((p) => p.P.count && p.P.count.unit === '개') ? up.reduce((s, p) => s + p.P.count.n, 0) : null;
          if (stated != null && stated !== below) E.push(`${at(i)} 의 ${a} 레벨 ${up[0].lvl} 이 밝힌 자식 ${fmt(stated)} 이 아래 레벨 page ${fmt(below)} 와 다르다`);
          const fo = op ? nums(kvOf(states[i], op)['fan-out'])[0] : null;
          const upN = up.reduce((s, p) => s + (p.agg || 1), 0);
          if (fo > 2 && stated == null && Math.ceil(below / fo) !== upN) E.push(`${at(i)} 의 ${a} 레벨 ${up[0].lvl} 의 page ${upN} 개가 fan-out ${fo} 로 ${fmt(below)} 를 덮는 수 ${Math.ceil(below / fo)} 와 다르다`);
        }
      }
      /* C5b 탑의 줄 수 — id 가 'N 레벨' 을 밝히면 rep 이 그 수다 */
      if (t.bst === 'tower') for (const n of t.nodes) { const r = /(\d+)\s*레벨/.exec(n.id); if (r && +r[1] !== n.rep) E.push(`${at(i)} 의 ${a} ${n.id} 가 ${r[1]} 레벨인데 rep 은 ${n.rep} 이다`); }
      /* C5 레벨 수 = '트리 높이' */
      if (op) {
        const kv = kvOf(states[i], op), key = KVH.find((k) => kv[k] != null);
        const h = key ? nums(kv[key])[0] : null;
        if (h != null && h !== t.depth) E.push(`${at(i)} 의 ${a} 가 ${t.depth} 레벨인데 op ${key} 는 ${h} 다`);
      }
    });
    /* C4b 행 수와 fill — 같은 표본 · 같은 단위 · 리프 여부마다 fill / 행 이 같은 비율 */
    const groups = new Map();
    T.forEach((t, i) => {
      if (t.empty || t.bst) return;
      const smp = op ? bare(kvOf(states[i], op)['표본'] || '') : '';
      t.levels.forEach((L, j) => L.forEach((n) => {
        if (!n.P.count || n.fill <= 0) return;
        const g = `${smp}|${n.P.count.unit}|${j === t.levels.length - 1}`;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push({ i, n });
      }));
    });
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const r = list.map(({ n }) => n.P.count.n / n.fill).sort((x, y) => x - y)[list.length >> 1];
      for (const { i, n } of list) if (Math.abs(n.fill - n.P.count.n / r) > 0.02) E.push(`${at(i)} 의 ${a} ${n.id} fill ${n.fill} 이 ${n.P.count.n}${n.P.count.unit} 와 맞지 않는다 (같은 묶음은 ${(1 / r).toFixed(4)} / ${n.P.count.unit})`);
    }
  }
  /* C7 블록 띠 — 16KB 블록이면 칸 크기의 합이 스텝마다 같다. byl 의 'a/b' 는 쓰는 칸 / 전체, 'N × M B' 는 KB 단위의 칸 크기 */
  for (const a of cast.filter((x) => A[x].kind === 'bytes')) {
    const S = states.map((st) => st[a] || {});
    const block = S.some((s) => (s.items || []).some((x) => x.tag === 'free'));
    const tot = S.map((s) => (s.items || []).reduce((t, x) => t + (x.sz || 0), 0));
    S.forEach((s, i) => {
      const its = s.items || [];
      if (block && tot[i] !== tot[0]) E.push(`${at(i)} 의 ${a} 칸 크기 합 ${tot[i]} 이 init 의 ${tot[0]} 와 다르다`);
      const fr = /^(\d+)\/(\d+)$/.exec(String((s.byl || {}).r || ''));
      if (fr) { const used = its.filter((x) => x.tag !== 'free').reduce((t, x) => t + x.sz, 0); if (used * +fr[2] !== tot[i] * +fr[1]) E.push(`${at(i)} 의 ${a} 쓰는 칸 ${used}/${tot[i]} 이 ${fr[0]} 와 다르다`); }
      if (block && /16\s*KB/.test(String((s.byl || {}).l || '')) && tot[i] === 16) for (const x of its) {
        const r = /([\d,]+)\s*×\s*([\d,]+)\s*B/.exec(String(x.sub || ''));
        if (r && Math.abs(x.sz - (num(r[1]) * num(r[2])) / 1024) > 1) E.push(`${at(i)} 의 ${a} ${x.id} 크기 ${x.sz} KB 가 ${x.sub} = ${fmt(num(r[1]) * num(r[2]))} B 와 1 KB 넘게 다르다`);
      }
    });
    if (!block) {
      /* 바이트 띠(블록이 아닌 레코드) — 스텝마다 그 스텝의 byl.r 이 밝힌 B 를 넘지 않고, 밝힌 수에 한 번은 닿는다(byl 은 스텝마다 바뀔 수 있다) */
      const want = S.map((s) => nums((s.byl || {}).r || '').pop());
      S.forEach((s, i) => { if (want[i] && tot[i] > want[i]) E.push(`${at(i)} 의 ${a} 칸 크기 합 ${tot[i]} B 가 밝힌 ${want[i]} B 를 넘는다`); });
      for (const w of new Set(want.filter(Boolean))) if (!S.some((s, i) => want[i] === w && tot[i] === w)) E.push(`${at(0)} ‥ 끝 의 ${a} 칸 크기 합이 한 번도 밝힌 ${w} B 가 되지 않는다`);
    }
  }
  /* C8 전송 — KB = 16 × 전송 블록 수, 물리 ≤ 논리 */
  if (cast.includes('io')) states.forEach((st, i) => {
    const io = kvOf(st, 'io'), unit = nums(io['전송 단위'])[0] || 16;
    const kb = nums(io['누적 전송'] ?? io['읽은 바이트'])[0];
    const blocks = nums((kvOf(st, 'cost')['블록 전송']) ?? (kvOf(st, 'op')['읽은 블록']))[0];
    if (kb > 0 && blocks != null && kb !== unit * blocks) E.push(`${at(i)} 의 io 전송 ${kb} KB 가 ${unit} KB × 블록 ${blocks} 와 다르다`);
    const lg = nums(io['논리 읽기'])[0], ph = nums(io['물리 읽기'])[0];
    if (lg != null && ph != null && ph > lg) E.push(`${at(i)} 의 io 물리 읽기 ${ph} 가 논리 읽기 ${lg} 보다 크다`);
    if (lg != null && blocks != null && cast.includes('cost') && lg !== blocks) E.push(`${at(i)} 의 io 논리 읽기 ${lg} 가 블록 전송 ${blocks} 와 다르다`);
  });
  /* C9 HDD — 임의 읽기 N 회는 시크 N 회, 순차 · 제자리 갱신은 시크 1 회 */
  if (cast.includes('hdd') && cast.includes('io')) states.forEach((st, i) => {
    const io = kvOf(st, 'io'), job = bare(io['작업'] || ''), seek = /시크\s*(\d+)/.exec(bare(io['비용'] || ''));
    if (!seek) return;
    const r = /임의 읽기\s*(\d+)/.exec(job);
    if (r && +r[1] !== +seek[1]) E.push(`${at(i)} 의 HDD 임의 읽기 ${r[1]} 회인데 시크 ${seek[1]} 회다`);
    if (/순차|제자리/.test(job) && +seek[1] !== 1) E.push(`${at(i)} 의 HDD ${job} 인데 시크 ${seek[1]} 회다`);
  });
  /* C10 SSD 블록 — sub 의 수 = live · dead, 쓴 page 는 지우기 전에는 줄지 않는다, 지우면 살아 있던 것은 다른 블록으로 */
  if (cast.includes('ssd') && cast.includes('ftl')) {
    const S = states.map((st) => itemsOf(st, 'ftl'));
    S.forEach((its, i) => {
      for (const b of its) {
        const want = [b.live || 0, b.dead || 0].filter((x) => x > 0), got = nums(b.sub);
        if (want.join() !== got.join()) E.push(`${at(i)} 의 ftl ${b.id} 글의 수 ${got.join(' · ') || '없음'} 이 live ${b.live || 0} · dead ${b.dead || 0} 와 다르다`);
        const pv = i ? S[i - 1].find((x) => x.id === b.id) : null;
        if (!pv) continue;
        const w0 = (pv.live || 0) + (pv.dead || 0), w1 = (b.live || 0) + (b.dead || 0);
        if (w1 < w0 && w1 !== 0) E.push(`${at(i)} 의 ftl ${b.id} 쓴 page 가 지우기 없이 ${w0} → ${w1} 로 줄었다`);
        if (w1 === 0 && w0 > 0) {
          const moved = its.filter((x) => x.id !== b.id).reduce((t, x) => t + (x.live || 0) - ((S[i - 1].find((y) => y.id === x.id) || {}).live || 0), 0);
          if (moved !== (pv.live || 0)) E.push(`${at(i)} 의 ftl ${b.id} 를 지웠는데 살아 있던 ${pv.live || 0} page 중 ${moved} 만 다른 블록으로 갔다`);
        }
      }
    });
  }
  /* C11 분리 키 수직선 — 수직선의 키 = 내부 노드의 분리 키, 구간은 빈틈 없이 [min, max] 를 덮고 경계는 분리 키 */
  for (const a of cast.filter((x) => A[x].kind === 'axis')) states.forEach((st, i) => {
    const s = st[a] || {}, ax = s.axis || {}, sv = (s.items || []).map((x) => x.v).sort((p, q) => p - q);
    const bt = trees.length ? itemsOf(st, trees[0]).map((it) => parseNode(it.keys)).find((P) => P.pipes && P.chips && P.chips.length) : null;
    if (bt) { const kv = bt.chips.map((c) => c.v).join(); if (kv !== sv.join()) E.push(`${at(i)} 의 ${a} 키 ${sv.join(', ')} 가 내부 노드의 분리 키 ${kv} 와 다르다`); }
    const sp = [...(s.spans || [])].sort((p, q) => p.from - q.from);
    if (!sp.length) return;
    if (sp[0].from !== ax.min || sp[sp.length - 1].to !== ax.max) E.push(`${at(i)} 의 ${a} 구간이 [${ax.min}, ${ax.max}] 를 다 덮지 않는다`);
    for (let k = 1; k < sp.length; k++) if (sp[k].from !== sp[k - 1].to) E.push(`${at(i)} 의 ${a} 구간 ${sp[k - 1].id} 와 ${sp[k].id} 사이가 비거나 겹친다`);
    for (const x of sp.slice(1)) if (!sv.includes(x.from)) E.push(`${at(i)} 의 ${a} 구간 ${x.id} 의 경계 ${x.from} 이 분리 키가 아니다`);
  });
  return E;
}
