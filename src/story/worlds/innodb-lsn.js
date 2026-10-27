/* mysql innodb 03 · 04 · 13 — 복구와 checkpoint 나이, redo 파일과 용량. 그리는 것은 모두 bake 상태에서 읽는다 —
     · LSN 자 = redo 배우('Last checkpoint at' 을 가진 kv)의 위치 값들. 숫자 하나인 값은 바늘(나이 · age 는 거리라 빼고),
       'a → b' 인 값은 자 위의 구간(replay 구간)
     · list · frames 항목의 sub 에 'LSN N' · 'oldest_modification N' 이 있으면 자 아래 눈금 — 칸에서 선으로 잇는다.
       같은 id 가 같은 값을 두 배우에서 가지면(buffer 의 p:20 과 flush list 의 p:20) 눈금 하나로
     · redo 의 gg 에 cap(용량) · marks(문턱 비율)가 있으면 checkpoint 부터 cap 만큼이 redo 의 창 — 문턱을 그 비율 자리에 세우고,
       checkpoint ~ LSN 의 나이를 채운다. 문턱을 넘은 만큼 금빛 · 빨강
     · redo 파일 띠(13) = 항목이 lsn [START_LSN, END_LSN] 을 가진 배우. 자 바로 아래, 그 LSN 자리에 막대 하나 — 같은 크기의 파일
       n 개가 이어진 묶음이면 막대 안에 파일 경계를 n − 1 개 긋는다. full 0 인 항목(지금 쓰는 파일)은 금빛, END_LSN 이 checkpoint
       이하인 항목(지워도 되는데 남은 파일)은 흐리게. 이름표는 항목의 nm(없으면 id), 그 아래 sub 를 한 줄씩
     · 나머지 kv 는 글 블록(SQL 층), 나머지 list · frames 는 칸 줄. SQL 층과 InnoDB 사이 · 메모리와 디스크 사이에 점선
     · 셈 맞추기(13) — 파일이 LSN 으로 이어지지 않거나(앞의 END ≠ 뒤의 START), 묶음의 폭이 n × (size − hdr) 가 아니거나,
       지금 쓰는 파일이 하나가 아니거나 LSN 이 그 안에 없거나, checkpoint 가 가장 오래된 파일보다 앞이거나,
       physical_size(Innodb_redo_log_physical_size) 가 쓰는 파일 크기의 합(Σ n × size)과 다르면 console.error
     · 셈 맞추기 — checkpoint 가 다른 LSN 바늘보다 앞서거나, 'checkpoint age' 가 LSN − checkpoint 와 다르거나, gg.v 가
       나이 / cap 과 1% 넘게 다르거나, checkpoint 가 flush list 의 가장 오래된 oldest_modification 을 넘으면 console.error
   손잡이가 있는 장면(03 innodb_doublewrite)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const SL = 44, TOK = 150, TKN = 7, AGEN = 60;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: RED, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
const num = (s) => +String(s).replace(/,/g, '');
/* 값이 숫자 하나로 시작하면 위치, 'a → b' 면 구간 */
const posOf = (v) => { const m = /^\s*(\d[\d,]*)(?!\s*→)/.exec(bare(v)); return m && !/→/.test(bare(v)) ? num(m[1]) : null; };
const bandOf = (v) => { const m = /^\s*(\d[\d,]*)\s*→\s*(\d[\d,]*)/.exec(bare(v)); return m ? [num(m[1]), num(m[2])] : null; };
const tickOf = (sub) => { const m = /(?:LSN|oldest_modification)\s+(\d[\d,]*)/.exec(sub || ''); return m ? num(m[1]) : null; };
const fmt = (n) => n.toLocaleString('en-US');

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      if (A[a].kind === 'kv') { s[a] = (st[a] && st[a].kv) || {}; s[a + '#gg'] = (st[a] && st[a].gg) || null; }
      else s[a] = ((st[a] && st[a].items) || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
    }
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k), S0 = read(sc.init);
    BAKES.set(k, { S0, S: frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch)), NK: frames.length });
  }
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const KV = cast.filter((a) => A[a].kind === 'kv');
  const RV = KV.find((a) => all.some((s) => 'Last checkpoint at' in s[a])) || null;
  const TEXTS = KV;
  /* redo 파일 띠 — lsn 을 가진 항목의 배우. 칸 줄에서 빼고 자 아래에 LSN 자리로 그린다 */
  const FS = cast.find((a) => A[a].kind !== 'kv' && all.some((s) => s[a].some((x) => Array.isArray(x.lsn)))) || null;
  const ROWS = cast.filter((a) => A[a].kind !== 'kv' && a !== FS);
  const ids = (a) => [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))];
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  /* 자의 바늘과 구간 — redo 의 키 중 위치 값을 가진 적이 있는 것(나이는 뺀다) */
  const KM = RV ? [...new Set(all.flatMap((s) => Object.keys(s[RV]).filter((k) => !/age|나이/i.test(k) && (posOf(s[RV][k]) != null || bandOf(s[RV][k])))))] : [];
  const TROWS = ROWS.filter((a) => all.some((s) => s[a].some((x) => tickOf(x.sub) != null)));
  const ckptOf = (s) => (RV ? posOf(s[RV]['Last checkpoint at']) : null);
  const lsnOf = (s) => (RV ? posOf(s[RV]['Log sequence number']) : null);
  const ggOf = (s) => (RV ? s[RV + '#gg'] : null);
  /* 눈금 — 같은 id · 같은 값은 하나로, 열쇠도 id@값. 배우:id 를 열쇠로 했더니 03 의 5 스텝에서 buffer 의 p:12 가
     .ibd 의 p:12 와 합쳐지며 열쇠가 바뀌어 이름표가 갈리고 알갱이가 자리를 옮겼다. 그 값을 가진 배우는 모두 as 에 —
     어느 쪽을 건드려도 눈금이 밝아진다(04 의 2 스텝 : flush list 의 p:20) */
  const ticksOf = (s) => { const out = [], by = new Map(); for (const a of TROWS) for (const it of s[a]) { const v = tickOf(it.sub); if (v == null) continue; const key = it.id + '@' + v, q = by.get(key); if (q) { q.as.push(a); q.its.push(it); continue; } const n = { a, it, v, key, as: [a], its: [it] }; by.set(key, n); out.push(n); } return out; };
  const TKEYS = [...new Set(all.flatMap((s) => ticksOf(s).map((q) => q.key)))];

  /* 자의 범위 — 나온 위치 · 구간 · 눈금 전부, 그리고 redo 창의 끝 */
  const XS = all.flatMap((s) => {
    const out = [];
    if (FS) for (const it of s[FS]) if (it.lsn) out.push(...it.lsn);
    if (RV) for (const k of KM) { const p = posOf(s[RV][k]), b = bandOf(s[RV][k]); if (p != null) out.push(p); if (b) out.push(...b); }
    for (const q of ticksOf(s)) out.push(q.v);
    const g = ggOf(s), c = ckptOf(s); if (g && g.cap && c != null) out.push(c + g.cap);
    return out;
  });
  const AXS = new Map();
  if (FS) for (const st of all) {
    const v = [...st[FS].filter((x) => x.lsn).flatMap((x) => x.lsn), ...(RV ? KM.map((k) => posOf(st[RV][k])).filter((x) => x != null) : [])];
    if (v.length) { const lo = Math.min(...v), hi = Math.max(...v), pad = Math.max(20, (hi - lo) * 0.04); AXS.set(st, { lo: lo - pad, hi: hi + pad }); }
  }
  const AX = XS.length ? (() => { const lo = Math.min(...XS), hi = Math.max(...XS), pad = Math.max(20, (hi - lo) * 0.04); return { lo: lo - pad, hi: hi + pad }; })() : null;

  /* 셈 맞추기 */
  for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    if (!RV) return;
    const at = `innodb ${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    const c = ckptOf(s), l = lsnOf(s), kv = s[RV];
    if (c == null) return;
    for (const k of KM) { const p = posOf(kv[k]); if (p != null && k !== 'Last checkpoint at' && p < c) console.error(`${at} : ${k} ${fmt(p)} 가 checkpoint ${fmt(c)} 보다 앞이다`); }
    const ageK = Object.keys(kv).find((k) => /age|나이/i.test(k)), age = ageK ? posOf(kv[ageK]) : null;
    if (age != null && l != null && age !== l - c) console.error(`${at} : ${ageK} ${fmt(age)} 가 LSN − checkpoint = ${fmt(l - c)} 와 다르다`);
    const g = ggOf(s);
    if (g && g.cap && l != null && Math.abs((l - c) / g.cap - g.v) > 0.01) console.error(`${at} : 계기 ${g.v} 가 나이/용량 ${((l - c) / g.cap).toFixed(3)} 와 다르다`);
    const fl = cast.find((a) => A[a].nm === 'FLUSH LIST');
    if (fl) { const om = s[fl].map((x) => tickOf(x.sub)).filter((x) => x != null); if (om.length && c > Math.min(...om)) console.error(`${at} : checkpoint ${fmt(c)} 가 flush list 의 가장 오래된 oldest_modification ${fmt(Math.min(...om))} 를 넘었다`); }
  });
  if (FS) for (const [kk, b] of BAKES) [b.S0, ...b.S].forEach((s, i) => {
    const at = `innodb ${sc.num} 세계${kk ? ' (' + sc.vary.knob + '=' + kk + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    const fs = s[FS].filter((x) => x.lsn).sort((p, q) => p.lsn[0] - q.lsn[0]);
    if (!fs.length) return;
    for (let j = 1; j < fs.length; j++) if (fs[j].lsn[0] !== fs[j - 1].lsn[1]) console.error(`${at} : ${fs[j - 1].id} 의 END_LSN ${fmt(fs[j - 1].lsn[1])} 와 ${fs[j].id} 의 START_LSN ${fmt(fs[j].lsn[0])} 가 이어지지 않는다`);
    for (const f of fs) { const n = f.n || 1, span = f.lsn[1] - f.lsn[0]; if (f.size != null && f.hdr != null && span !== n * (f.size - f.hdr)) console.error(`${at} : ${f.id} 의 폭 ${fmt(span)} 가 ${n} × (${fmt(f.size)} − ${f.hdr}) 가 아니다`); }
    const curF = fs.filter((x) => x.full === 0), c = ckptOf(s), l = lsnOf(s);
    if (curF.length !== 1) console.error(`${at} : 지금 쓰는 파일(full 0)이 ${curF.length} 개다`);
    else if (l != null && (l < curF[0].lsn[0] || l > curF[0].lsn[1])) console.error(`${at} : LSN ${fmt(l)} 이 지금 쓰는 파일 ${curF[0].id} [${fmt(curF[0].lsn[0])}, ${fmt(curF[0].lsn[1])}] 밖이다`);
    if (c != null && c < fs[0].lsn[0]) console.error(`${at} : checkpoint ${fmt(c)} 가 가장 오래된 파일 ${fs[0].id} 의 START_LSN ${fmt(fs[0].lsn[0])} 보다 앞이다`);
    /* 상태 변수 Innodb_redo_log_physical_size — 글 블록에서는 접두어를 뺀 physical_size 로 적는다 */
    const pk = KV.find((a) => Object.keys(s[a]).some((k) => /physical_size$/.test(k))), pkk = pk ? Object.keys(s[pk]).find((k) => /physical_size$/.test(k)) : null, ps = pk ? posOf(s[pk][pkk]) : null;
    const sum = fs.reduce((t, f) => t + (f.n || 1) * (f.size || 0), 0);
    if (ps != null && ps !== sum) console.error(`${at} : physical_size ${fmt(ps)} 가 쓰는 파일의 합 ${fmt(sum)} 와 다르다`);
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  /* 자의 알갱이 — 바늘 · 눈금마다 고정된 TKN 개, 그리고 나이 띠. 순서대로 나눠 주었더니 눈금 하나가 생기면 뒤의 눈금이
     모두 옆 눈금의 알갱이를 받아 자를 가로질러 미끄러졌다(03 의 4 · 6 스텝) */
  if (AX) take('ax', (KM.length + TKEYS.length) * TKN + AGEN);
  const FIDS = FS ? [...new Set(all.flatMap((s) => s[FS].filter((x) => x.lsn).map((x) => x.id)))] : [];
  const FSN = 72;
  FIDS.forEach((id) => take('f:' + id, FSN));
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('innodb lsn 세계 : 알갱이가 모자란다');

  /* ── 이름표 ── */
  const made = [];
  function label(cls = '') { const el = document.createElement('div'); el.className = 'wl ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; }
  function setText(lb, s, html = false) { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; lb.el.classList.toggle('serif', HANGUL.test(lb.el.textContent) && !/\baq\b/.test(lb.cls)); }
  function place(lb, x, y, al = 'l', va = 't') { const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%'; lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`; }
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  const EDG = deck.EDGES || [];
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const kLb = Object.fromEntries(KM.map((k) => [k, label('aq')]));
  const fLb = Object.fromEntries(FIDS.map((id) => [id, label('aq')])), fCap = FS ? label('aq ml aq-b') : null;
  const tLb = Object.fromEntries(TKEYS.map((k) => [k, label('aq')]));
  /* 한 id 가 두 배우의 눈금을 함께 가지면(03 : .ibd 의 p:5 4,900 과 buffer 의 p:5 5,900) 이름표 앞에 배우를 — 'BP' · '.ibd' */
  const short = (a) => { const w = A[a].nm.trim().split(/\s+/); return w.length === 1 || w[0].startsWith('.') ? w[0] : w.map((x) => x[0]).join(''); };
  const tagCls = (tg) => (tg === 'x' || tg === 'dirty' ? 'red' : tg === 'hold' || tg === 'pin' || tg === 'gold' ? 'gold' : '');
  const MK = (() => { for (const s of all) { const g = ggOf(s); if (g && g.marks) return g.marks; } return []; })();
  const mLb = MK.map(() => label('aq')), axHd = label('aq');
  const edgeLb = EDG.map(() => label('aq')), tok = label('stn-tok');

  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  /* 눈금을 밝히는 배우 — 그 값을 가진 배우 중 이번 스텝에 건드려 그 항목이 뜨거운 것. { a, it } 또는 null */
  const hotOf = (s, q) => { const j = q.as.findIndex((a) => s.touch.has(a) && hotIt(s, a, q.it.id)); return j < 0 ? null : { a: q.as[j], it: q.its[j] }; };
  const kvHtml = (kv, hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const DISK = new Set(ROWS.filter((a) => A[a].lane === 'disk'));
  const MEMR = ROWS.filter((a) => !DISK.has(a)), DSKR = ROWS.filter((a) => DISK.has(a));
  /* 붙은 문턱(sync 15/16 과 쓰기 멈춤)은 이름표 하나로 — 1% 안. 이름마다 제 문턱을 넘었을 때만 색을 입힌다 — 묶음 전체를 첫 문턱으로
     칠했더니 sync(83.1%)를 넘은 05 에서 '쓰기 멈춤'(83.3%) 까지 빨갛게 보였다. 넘은 이름은 금빛, 마지막 문턱(멈춤)만 빨강.
     나이 띠와 문턱 눈금은 async 부터 금빛, 멈춤부터 빨강 */
  const MGROUP = MK.map((m, i) => (i && m[0] - MK[i - 1][0] < 0.01 ? null : MK.filter((q) => q[0] >= m[0] && q[0] - m[0] < 0.01)));
  const GCUT = 0.775, RCUT = MK.length ? MK[MK.length - 1][0] : 0.83;
  const cutCol = (f) => (f >= RCUT ? 'red' : f >= GCUT ? 'gold' : '');
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], focusOf(s, a)), on(a), '', true, true]);
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && (it.tag === 'x' || it.tag === 'dirty') ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    if (AX) {
      const rvOn = on(RV), mod = modOf(s, RV);
      /* 같은 자리의 바늘은 이름표 하나로 */
      const byPos = new Map();
      for (const k of KM) { const p = posOf(s[RV][k]); if (p != null) { if (!byPos.has(p)) byPos.set(p, []); byPos.get(p).push(k); } }
      for (const k of KM) {
        const p = posOf(s[RV][k]), b = bandOf(s[RV][k]), grp = p != null ? byPos.get(p) : null, lead = grp && grp[0] === k;
        const txt = b ? `${k}  ${fmt(b[0])} → ${fmt(b[1])}` : lead ? `${grp.map((q) => (q === 'Last checkpoint at' ? 'checkpoint' : q === 'Log sequence number' ? 'LSN' : q)).join(' · ')}  ${fmt(p)}` : '';
        const cls = tone(s[RV][k]) || (k === 'Last checkpoint at' ? 'green' : '');
        t.set(kLb[k], [txt, rvOn && (mod.size ? grp ? grp.some((q) => mod.has(q)) : mod.has(k) : true), cls, !!txt]);
      }
      const T = ticksOf(s);
      for (const key of TKEYS) {
        const q = T.find((x) => x.key === key), two = q && T.some((x) => x !== q && x.it.id === q.it.id && x.a !== q.a);
        const h = q ? hotOf(s, q) : null;
        t.set(tLb[key], [q ? `${two ? short(q.a) + ' ' : ''}${q.it.id} ${fmt(q.v)}` : '', !!h, q ? tagCls((h || q).it.tag) : '', !!q]);
      }
      const g = ggOf(s), c = ckptOf(s), l = lsnOf(s), has = !!(g && g.cap && c != null), f = has && l != null ? (l - c) / g.cap : -1;
      MK.forEach((m, i) => {
        const grp = MGROUP[i], html = grp ? grp.map((q) => (f >= q[0] ? `<span class="${span[q[0] >= RCUT ? 'red' : 'gold']}">${esc(q[1])}</span>` : esc(q[1]))).join(' · ') : '';
        t.set(mLb[i], [has && grp ? html : '', rvOn, '', has && !!grp, true]);
      });
      t.set(axHd, [has ? `LSN  ·  redo 창 = checkpoint + ${fmt(g.cap)}` : 'LSN', rvOn, '']);
    }
    if (FS) {
      const fs = s[FS].filter((x) => x.lsn);
      for (const id of FIDS) { const it = fs.find((x) => x.id === id); t.set(fLb[id], [it ? it.nm ?? it.id : '', on(FS) && !!it && hotIt(s, FS, id), it && it.full === 0 ? 'gold' : '', !!it]); }
      t.set(fCap, [fs.filter((x) => x.sub).sort((p, q) => p.lsn[0] - q.lsn[0]).map((x) => `<span class="q-i">${esc(x.nm ?? x.id)}</span> ${esc(x.sub)}`).join('\n'), on(FS), '', fs.length > 0, true]);
    }
    EDG.forEach((e, i) => t.set(edgeLb[i], [e.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === e.hot ? 'gold' : '', i === 0 ? TEXTS.length > 0 : MEMR.length > 0 && DSKR.length > 0]));
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => { let w = 0, h = 0; const keep = lb.el.innerHTML; for (const t of TXALL) { const e = t.get(lb); if (!e || e[3] === false) continue; lb.el.innerHTML = e[0]; const r = lb.el.getBoundingClientRect(); w = Math.max(w, r.width); h = Math.max(h, r.height); } lb.el.innerHTML = keep; return { w, h }; };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(53);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15;
  /* 자의 범위 — 파일 띠가 있는 장면(13)은 스텝마다 그 스텝의 파일과 바늘에 맞춘다. 장면 전체로 잡았더니 8 MiB 의 파일 스물여덟이
     자의 4% 에 몰려 경계가 보이지 않았다. 스텝을 넘어갈 때 바늘과 막대는 옛 눈금의 자리에서 새 눈금의 자리로 미끄러진다 */
  const axX = (v, st) => { const r = (st && AXS.get(st)) || AX; return G.ax.x0 + ((v - r.lo) / (r.hi - r.lo)) * (G.ax.x1 - G.ax.x0); };
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {}, ax: { x0: L.x0 + 6, x1: L.x1 - 6, y: 0 } };
    let tn = Math.max(1, Math.min(3, TEXTS.length));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const tW = (ww - (tn - 1) * gap) / tn;
    for (const a of TEXTS) wrap(tx[a], tW);
    const tRows = Math.ceil(TEXTS.length / tn), tHs = Array.from({ length: tRows }, (_, r) => hMax(TEXTS.slice(r * tn, r * tn + tn).map((a) => tx[a])));
    const wc = new Map();
    const wOf = (lb, html) => { if (!html) return 0; let m = wc.get(lb); if (!m) wc.set(lb, (m = new Map())); if (!m.has(html)) { const keep = lb.el.innerHTML; lb.el.innerHTML = html; m.set(html, lb.el.getBoundingClientRect().width); lb.el.innerHTML = keep; } return m.get(html); };
    /* 자의 이름표 — 위 : 바늘 · 구간, 아래 : 페이지 눈금. 문턱 이름은 위의 맨 윗줄과 따로 */
    let upR = 1, dnR = 1, mkR = 0, fR = 1;
    const GAUGE = MK.length > 0;
    if (AX) for (const b of BAKES.values()) b.AXL = b.S.map((s, kk) => {
      const T = b.TX[kk], g2 = (lb) => { const e = T.get(lb); return e && e[3] !== false ? e[0] : ''; };
      const up = [], dn = [], mk = [];
      for (const k of KM) { const p = posOf(s[RV][k]), bd = bandOf(s[RV][k]), lb = kLb[k], w = wOf(lb, g2(lb)); if (!w) continue; up.push({ lb, cx: bd ? (axX(bd[0], s) + axX(bd[1], s)) / 2 : axX(p, s), w }); }
      for (const q of ticksOf(s)) { const lb = tLb[q.key], w = wOf(lb, g2(lb)); if (w) dn.push({ lb, cx: axX(q.v, s), w }); }
      /* 문턱은 자 위에 따로 띄운 redo 창 띠에 단다 — 자의 바늘 이름과 같은 줄에 두었더니 지시선이 서로를 관통했다 */
      const g = ggOf(s), c = ckptOf(s);
      if (g && g.cap && c != null) MK.forEach((m, i) => { const lb = mLb[i], w = wOf(lb, g2(lb)); if (w) mk.push({ lb, cx: axX(c + m[0] * g.cap, s), w }); });
      const U2 = stagger(up, L.x0, L.x1), D2 = stagger(dn, L.x0, L.x1), M2 = stagger(mk, L.x0, L.x1);
      upR = Math.max(upR, U2.rows); dnR = Math.max(dnR, D2.rows); mkR = Math.max(mkR, M2.rows);
      /* 파일 띠의 이름표 — 막대 가운데 아래, 겹치면 줄을 내린다 */
      const fl = FS ? s[FS].filter((x) => x.lsn).map((x) => { const lb = fLb[x.id], w = wOf(lb, g2(lb)); return w ? { lb, cx: (axX(x.lsn[0], s) + axX(x.lsn[1], s)) / 2, w } : null; }).filter(Boolean) : [];
      const F2 = stagger(fl, L.x0, L.x1); fR = Math.max(fR, F2.rows);
      return { up: U2.out, dn: D2.out, mk: M2.out, fs: F2.out };
    });
    if (fCap) wrap(fCap, ww);
    const fcH = fCap ? most(fCap).h : 0;
    const swOf = (a, pad, mn) => Object.fromEntries(RIDS[a].map((id) => [id, Math.max(mn, Math.ceil(most(rowLb[a][id]).w) + pad)]));
    const usedW = (a, m) => RIDS[a].reduce((t, id) => t + m[id] + 6, -6);
    const sw = Object.fromEntries(ROWS.map((a) => { let m = swOf(a, 14, 30); if (usedW(a, m) > ww) m = swOf(a, 6, 24); return [a, m]; }));
    const rc = ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    const chunks = (rs) => { const o = []; let i = 0; while (i < rs.length) { const a = rs[i], b = rs[i + 1]; if (rc > 1 && b && usedW(a, sw[a]) <= rW && usedW(b, sw[b]) <= rW) { o.push([a, b]); i += 2; } else { o.push([a]); i += 1; } } return o; };
    const BANDS = [...chunks(MEMR).map((c) => ({ c, disk: false })), ...chunks(DSKR).map((c) => ({ c, disk: true }))];
    const rowW = Object.fromEntries(BANDS.flatMap((band) => band.c.map((a) => [a, band.c.length > 1 ? rW : ww])));
    for (const a of ROWS) if (usedW(a, sw[a]) > rowW[a] + 1) console.error(`innodb ${sc.num} 세계 : ${a} 칸 줄이 단 ${Math.round(rowW[a])} 보다 넓다 (${L.W}×${L.H})`);
    const rcH = {}, rSide = {};
    for (const band of BANDS) for (const a of band.c) {
      const W0 = rowW[a], used = usedW(a, sw[a]), sideW = W0 - used - 12;
      wrap(rowCap[a], W0); const hb = most(rowCap[a]).h;
      let hs = Infinity; if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      rSide[a] = Math.max(26, hs) < 26 + 8 + hb ? used + 12 : 0; if (!rSide[a]) wrap(rowCap[a], W0);
      rcH[a] = rSide[a] ? hs : hb;
    }
    const lay = (y0, k = 1) => {
      let y = y0;
      const rowY = [y]; for (let r = 0; r < tRows; r++) rowY.push(rowY[r] + HD + tHs[r] + 12 * k);
      TEXTS.forEach((a, i) => { const x = L.x0 + (i % tn) * (tW + gap), yy = rowY[Math.floor(i / tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + tW - 18, y: yy + 8 }; });
      y = rowY[tRows];
      G.edgeY = [null, null];
      if (TEXTS.length && EDG[0]) { y += 2 * k; G.edgeY[0] = y; place(edgeLb[0], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
      /* 자 — 제목, 문턱 이름, 바늘 이름, 자, 눈금 이름 */
      if (AX) {
        place(axHd, L.x0, y); y += HD;
        if (GAUGE) { y += mkR * RH + 4; G.gy = y + 4; y += 8 + 10; }
        y += upR * RH + 16; G.ax.y = y; if (RV) G.anc[RV] = { x: L.x0 + ww / 2, y };
        y += 14 + dnR * RH + 10 * k;
      }
      /* redo 파일 띠 — 제목, 막대(자와 같은 x), 이름표 줄, sub 글 */
      if (FS && AX) {
        place(hd[FS], L.x0, y); y += HD;
        G.fs = { y: y + 2 }; G.anc[FS] = { x: L.x0 + ww / 2, y: y + 8 };
        y += 2 + 12 + 4 + fR * RH + 4;
        place(fCap, L.x0, y); y += fcH + 10 * k;
      }
      for (const band of BANDS) {
        if (band.disk && G.edgeY[1] == null && MEMR.length && EDG[1]) { y += 4 * k; G.edgeY[1] = y; place(edgeLb[1], L.x1, y + 2, 'r', 't'); y += 8 + 8 * k; }
        let hh = 0;
        band.c.forEach((a, j) => {
          const x0 = L.x0 + j * (rW + gap);
          place(hd[a], x0, y); G.slot[a] = { x0, y: y + HD, sw: sw[a] }; G.anc[a] = { x: x0 + 30, y: y + HD + 13 };
          if (rSide[a]) { place(rowCap[a], x0 + rSide[a], y + HD + 4); hh = Math.max(hh, HD + Math.max(26, rcH[a] + 4)); }
          else { place(rowCap[a], x0, y + HD + 26 + 8); hh = Math.max(hh, HD + 26 + 8 + rcH[a]); }
        });
        y += hh + 14 * k;
      }
      return y - y0;
    };
    let k = 1, total = lay(L.y0, 1);
    if (total > wh) { k = 0.2; total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`innodb ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    HT = total;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  function anchor(a, s, lbText) {
    if (a === FS && G.fs) {
      const fs = s[FS].filter((x) => x.lsn), it = fs.find((x) => (lbText || '').includes(x.nm ?? x.id)) || fs.find((x) => modOf(s, FS).has(x.id)) || fs.find((x) => x.full === 0);
      if (it) return [(axX(it.lsn[0], s) + axX(it.lsn[1], s)) / 2, G.fs.y + 6];
    }
    if (ROWS.includes(a)) {
      const id = RIDS[a].filter((x) => (lbText || '').includes(x)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, a)][0];
      const P = id ? rowSlot(s, a, id) : null;
      if (P) return [P.x, P.y];
    }
    if (a === RV && AX && G.ax.y) { const c = ckptOf(s), l = lsnOf(s); return [axX(l ?? c ?? AX.lo, s), G.ax.y]; }
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
    const src = act ? anchor(act.f, s, act.lb) : null, mv = show(p, 0.12, 0.42);
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const gone = it ? 0 : show(p, 0.1, 0.4), born = it && !pv && !end, from = born && act && act.t === a ? src : null, tg = (it || pv).tag;
      const lv = (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form, lit = it && modOf(s, a).has(id) && !end;
      for (let m = 0; m < SL; m++) {
        const i = R[key][0] + m, f = m / SL;
        let [x, y] = rim(P.x, P.y, P.w, 24, SL, m);
        if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
        if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone + 8 * gone; }
        [x, y] = into(i, x, y);
        put(o, i, x, y, lv * (1 - gone) * (tg === 'free' ? 0.5 * (m % 2) : 1), lit ? 0.4 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
      }
    }
    /* 자 — 바늘(위로), 페이지 눈금(아래로), 나이 띠(문턱을 넘은 만큼 금빛 · 빨강). 값이 바뀐 바늘은 옛 자리에서 미끄러진다 */
    if (AX && RV) {
      const [a0, a1] = R.ax, rvOn = s.touch.has(RV) && !end, marks = [];
      for (let i = a0; i < a1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
      KM.forEach((k, j) => {
        const pp = posOf(s[RV][k]), p0 = posOf(prev[RV][k]);
        if (pp == null) return;
        const x = p0 != null && (p0 !== pp || AXS.size) && !end ? U.lerp(axX(p0, prev), axX(pp, s), mv) : axX(pp, s), hot = rvOn && modOf(s, RV).has(k);
        marks.push([a0 + j * TKN, 'up', x, hot ? GOLD : k === 'Last checkpoint at' ? GREEN : INK, hot || rvOn]);
      });
      for (const q of ticksOf(s)) { const h = end ? null : hotOf(s, q); marks.push([a0 + (KM.length + TKEYS.indexOf(q.key)) * TKN, 'dn', axX(q.v, s), TAGC[(h || q).it.tag] ?? INK, !!h]); }
      for (const [i0, kd, x, col, hot] of marks) for (let m = 0; m < TKN; m++) {
        const i = i0 + m, y = kd === 'up' ? G.ax.y - 3 - m * 2 : G.ax.y + 3 + m * 1.6;
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, (hot ? 0.95 : 0.55) * dim * form, hot ? 0.4 : 0, 0.02, 1.15, col);
      }
      const g = ggOf(s), c = ckptOf(s), l = lsnOf(s);
      if (g && g.cap && c != null && l != null) {
        const c0 = ckptOf(prev) ?? c, l0 = lsnOf(prev) ?? l, cc = end ? c : U.lerp(c0, c, mv), ll = end ? l : U.lerp(l0, l, mv);
        for (let m = 0, i = a0 + (KM.length + TKEYS.length) * TKN; m < AGEN; m++, i++) {
          const v = cc + (m / (AGEN - 1)) * (ll - cc), f = (v - cc) / g.cap, cl = cutCol(f), col = cl === 'red' ? RED : cl ? GOLD : ACCENT;
          const [xx, yy] = into(i, axX(v, s), G.gy - 1 + (m % 2) * 2);
          put(o, i, xx, yy, (rvOn ? 0.85 : 0.5) * dim * form, cl && rvOn ? 0.4 : 0, 0.02, 1.4, col);
        }
      }
    }
    /* redo 파일 띠 — 막대의 테두리 알갱이. 범위가 바뀐 파일은 옛 자리에서 늘어나거나 줄어든다 */
    if (FS && G.fs) {
      const c = ckptOf(s), on = s.touch.has(FS) && !end;
      for (const id of FIDS) {
        const it = s[FS].find((x) => x.id === id && x.lsn), pv = prev[FS].find((x) => x.id === id && x.lsn);
        if (!it && !(pv && !end)) { hide('f:' + id); continue; }
        const q = it || pv, gone = it ? 0 : show(p, 0.1, 0.4), sq = it ? s : prev;
        const slide = it && pv && !end, x0 = slide ? U.lerp(axX(pv.lsn[0], prev), axX(it.lsn[0], s), mv) : axX(q.lsn[0], sq);
        const x1 = Math.max(slide ? U.lerp(axX(pv.lsn[1], prev), axX(it.lsn[1], s), mv) : axX(q.lsn[1], sq), x0 + 2), col = q.full === 0 ? GOLD : c != null && q.lsn[1] <= c ? FAINT : INK;
        const lit = on && hotIt(s, FS, id);
        for (let m = 0; m < FSN; m++) {
          const i = R['f:' + id][0] + m;
          let [x, y] = rim((x0 + x1) / 2, G.fs.y + 6, x1 - x0, 12, FSN, m);
          if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone + 8 * gone; }
          [x, y] = into(i, x, y);
          put(o, i, x, y, (lit ? 0.95 : 0.55) * dim * form * (1 - gone), lit && q.full === 0 ? 0.4 : 0, 0.02, 1.1, col);
        }
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

  /* 칸 ↔ 눈금 — 이번 스텝에 건드린 항목만. 전부 이었더니 03 에서 곡선이 설명 글 위로 엇갈렸다.
     곡선은 눈금 이름표의 아래 끝에서 멈춘다 — 눈금까지 그었더니 자기 이름표를 뚫고 지나갔다 */
  function curvesOf(s, kk) {
    const al = cur.AXL[kk], out = [];
    for (const q0 of ticksOf(s)) {
      const j = q0.as.findIndex((a) => s.touch.has(a) && modOf(s, a).has(q0.it.id)); if (j < 0) continue;
      const q = { ...q0, a: q0.as[j], it: q0.its[j] }, P = rowSlot(s, q.a, q.it.id); if (!P) continue;
      const dq = al.dn.find((x) => x.lb === tLb[q.key]), tx2 = dq ? dq.cx : axX(q.v, s), ty = dq ? G.ax.y + 14 + (dq.row + 1) * RH + 1 : G.ax.y + 12;
      const c = [[P.x, P.y - 12], [P.x, P.y - 40], [tx2, ty + 40], [tx2, ty]];
      const pts = Array.from({ length: 25 }, (_, i) => { const t = i / 24, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; return [0, 1].map((d) => w.reduce((v, wi, j) => v + wi * c[j][d], 0)); });
      out.push({ ...q, c, pts });
    }
    return out;
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0, clear = new Set();
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
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
      if (AX && cur.AXL) {
        const al = cur.AXL[kk];
        for (const q of al.up) place(q.lb, q.l, G.ax.y - 14 - q.row * RH, 'l', 'b');
        for (const q of al.dn) place(q.lb, q.l, G.ax.y + 14 + q.row * RH, 'l', 't');
        for (const q of al.mk) place(q.lb, q.l, G.gy - 6 - q.row * RH, 'l', 'b');
        if (FS && G.fs) for (const q of al.fs) place(q.lb, q.l, G.fs.y + 16 + q.row * RH, 'l', 't');
      }
      /* 칸 ↔ 눈금 곡선은 글을 지나지 않을 때만 — 첫 칸은 줄 제목 바로 아래라, 늘 그었더니 03 · 04 의 곡선이
         'BUFFER POOL' · 'UNDO LOG' · '.ibd 데이터 파일' 제목과 칸 설명 글을 가로질렀다(1512, 03 의 4 · 5 · 6 스텝).
         눈금 이름표가 칸의 id 를 같은 색으로 적으므로 곡선이 없어도 짝은 읽힌다 */
      clear = new Set();
      if (AX && cur.AXL) {
        const boxes = made.filter((lb) => lb.t && T.get(lb) && T.get(lb)[3] !== false).map((lb) => [lb, lb.el.getBoundingClientRect()]);
        for (const q of curvesOf(s, kk)) {
          const own = [tLb[q.key], rowLb[q.a][q.it.id]];
          const hit = q.pts.some(([x, y]) => boxes.some(([lb, r]) => !own.includes(lb) && x > r.left - 2 && x < r.right + 2 && y > r.top - 2 && y < r.bottom + 2));
          if (!hit) clear.add(q.key);
        }
      }
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
    if (AX && RV && cur.AXL) {
      ctx.globalAlpha = 0.55 * o; ctx.strokeStyle = css.ink; seg(ctx, G.ax.x0, G.ax.y, G.ax.x1, G.ax.y);
      /* 구간(replay) — 자 위의 띠 */
      for (const k of KM) { const bd = bandOf(s[RV][k]); if (!bd) continue; ctx.globalAlpha = 0.22 * o; ctx.fillStyle = css.gold; ctx.fillRect(axX(bd[0], s), G.ax.y - 9, axX(bd[1], s) - axX(bd[0], s), 4); }
      /* redo 창과 문턱 — checkpoint 부터 cap */
      const g = ggOf(s), c = ckptOf(s);
      if (g && g.cap && c != null) {
        /* redo 창 띠 — checkpoint ~ checkpoint + cap 의 테두리, 문턱 눈금과 그 이름의 지시선은 이 띠 안에서만 */
        const x0 = axX(c, s), x1 = axX(c + g.cap, s), gy = G.gy;
        ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.strokeRect(x0, gy - 4, x1 - x0, 8);
        for (const m of MK) { const x = axX(c + m[0] * g.cap, s); ctx.globalAlpha = 0.65 * o; ctx.strokeStyle = ({ red: css.red, gold: css.gold })[cutCol(m[0])] || css.faint; seg(ctx, x, gy - 6, x, gy + 5); }
        ctx.globalAlpha = 0.3 * o; ctx.strokeStyle = css.faint;
        for (const q of cur.AXL[kk].mk) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, gy - 6 - q.row * RH + 1, q.cx, gy - 7);
        /* 띠의 양 끝을 자의 같은 자리로 — 점선 둘 */
        ctx.globalAlpha = 0.25 * o; ctx.setLineDash([2, 4]); seg(ctx, x0, gy + 4, x0, G.ax.y - 1); seg(ctx, x1, gy + 4, x1, G.ax.y - 1); ctx.setLineDash([]);
      }
      /* 파일 경계 — 같은 크기 n 개의 묶음이면 막대 안에 n − 1 개. 이름표를 내렸으면 지시선 */
      const al = cur.AXL[kk];
      if (FS && G.fs) {
        ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint;
        for (const f of s[FS]) if (f.lsn && (f.n || 1) > 1) for (let j = 1; j < f.n; j++) { const x = axX(f.lsn[0] + (j * (f.lsn[1] - f.lsn[0])) / f.n, s); seg(ctx, x, G.fs.y + 1, x, G.fs.y + 11); }
        ctx.globalAlpha = 0.3 * o;
        for (const q of al.fs) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, G.fs.y + 13, q.cx, G.fs.y + 16 + q.row * RH - 1);
      }
      ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint;
      for (const q of al.up) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, G.ax.y - 14 - q.row * RH + 1, q.cx, G.ax.y - 9);
      for (const q of al.dn) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, G.ax.y + 13, q.cx, G.ax.y + 14 + q.row * RH - 1);
      if (!end && shown === kk) for (const q of curvesOf(s, kk)) {
        if (!clear.has(q.key)) continue;
        const [c0, c1, c2, c3] = q.c;
        ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.ink;
        ctx.beginPath(); ctx.moveTo(...c0); ctx.bezierCurveTo(...c1, ...c2, ...c3); ctx.stroke();
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); return HT; },
    theme() { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim(); css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') }; },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
