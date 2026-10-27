/* postgres wal — 모든 장면이 같은 세계를 쓴다. 장면이 쓰는 배우만 그린다. 그리는 것은 모두 bake 상태에서 읽는다 —
     · LSN 자 = kv 의 값이 LSN(X/Y)으로 시작하면 그 키 이름으로 자 위에 선다(Insert · Write · Flush · RedoRecPtr ·
       페이지 LSN …). list 항목에 lsn 이 있으면 자 아래 눈금(페이지), lsn 과 end 가 있으면 자 위의 구간(WAL 레코드).
       값 사이가 넓으면 자를 끊는다 — 거리는 로그 눈금이라 순서와 대소만 읽는다
     · lsn 을 가진 list 의 칸은 자기 눈금으로 선을 긋는다(페이지 ↔ 그 페이지 LSN)
     · bytes 배우 = 확대한 띠. 칸의 폭이 sz, 이름은 위 · 설명은 아래
     · 나머지 kv 는 글 블록, 나머지 list 는 칸 줄
     · 셈 맞추기 — Insert ≥ Write ≥ Flush 가 깨지거나, 데이터 파일(heap)에 새로 쓰인 페이지의 LSN 이 그 순간의 Flush 보다
       크면(WAL-before-data), 또는 레코드 구간의 end 가 lsn 보다 작으면 console.error 로 알린다.
       슬롯(09) — kv 에 restart_lsn · wal_status 와 pg_current_wal_lsn · max_wal_size · max_slot_wal_keep_size 가 있으면 잰 wal_status ·
       safe_wal_size 를 GetWALAvailability · KeepLogSeg 의 규칙으로 다시 셈해 맞추고, 살아 있는 슬롯의 restart_lsn 이 칸 줄의
       세그먼트(lsn ‥ end) 안에 있는지 본다
   손잡이가 있는 장면(04 synchronous_commit)은 값마다 따로 bake 해 두고 setVary 로 바꾼다.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { kvLine } from './kvline.js';
import { dockAt } from './dock.js';
import { bake, stepsOf, valuesOf } from '../../bake.js';
import { stagger } from './stagger.js';

const HANGUL = /[가-힣]/;
const SB = 120, SL = 44, AXN = 160, TOK = 150;
const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: GOLD, gold: GOLD, hold: GOLD, pin: GOLD, hdr: ACCENT, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT, sep: ACCENT };
/* LSN — "X/Y" 두 16진수(위 32 비트 / 아래 32 비트). 값의 맨 앞에 있을 때만 읽는다 */
const LSNRE = /^\s*([0-9A-Fa-f]{1,8})\/([0-9A-Fa-f]{1,8})\b/;
const lsnOf = (v) => { const m = LSNRE.exec(bare(v)); return m ? parseInt(m[1], 16) * 2 ** 32 + parseInt(m[2], 16) : null; };
const lsnTx = (n) => (Math.floor(n / 2 ** 32)).toString(16).toUpperCase() + '/' + (n % 2 ** 32).toString(16).toUpperCase();
const itLsn = (x) => (x && x.lsn != null ? lsnOf(x.lsn) : null);
const itEnd = (x) => (x && x.end != null ? lsnOf(x.end) : null);

export default {
  count: (narrow) => (narrow ? 3400 : 4600),
  make,
};

function make({ F, deck, labels, scene }) {
  const N = F.N, sc = scene(), A = deck.ACTORS;
  const cast = sc.cast.filter((a) => A[a]);

  /* ── 상태 읽기 — 손잡이 값마다 ── */
  const VALS = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  const keyOf = (v) => (v == null || String(v) === base ? null : String(v));
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      if (A[a].kind === 'kv') s[a] = (st[a] && st[a].kv) || {};
      else s[a] = ((st[a] && st[a].items) || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
      if (A[a].kind === 'bytes') s[a].byl = (st[a] && st[a].byl) || null;
    }
    return s;
  };
  const BAKES = new Map();
  for (const v of VALS) {
    const k = keyOf(v), frames = bake(sc, k), steps = stepsOf(sc, k), S0 = read(sc.init);
    const S = frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch));
    BAKES.set(k, { S0, S, NK: S.length });
  }
  const all = [...BAKES.values()].flatMap((b) => [b.S0, ...b.S]);
  const STRIPS = cast.filter((a) => A[a].kind === 'bytes');
  const TEXTS = cast.filter((a) => A[a].kind === 'kv');
  const ROWS = cast.filter((a) => A[a].kind === 'list');
  /* 자에 서는 것 — kv 의 LSN 값(위), list 의 lsn(아래 눈금) · lsn+end(위 구간) */
  const KMARK = TEXTS.flatMap((a) => [...new Set(all.flatMap((s) => Object.keys(s[a]).filter((k) => lsnOf(s[a][k]) != null)))].map((k) => ({ a, k })));
  const PAGES = ROWS.filter((a) => all.some((s) => s[a].some((x) => itLsn(x) != null && itEnd(x) == null)));
  const RECS = ROWS.filter((a) => all.some((s) => s[a].some((x) => itLsn(x) != null && itEnd(x) != null)));
  const RULER = KMARK.length + PAGES.length + RECS.length > 0;
  const ids = (a) => [...new Set(all.flatMap((s) => (s[a] || []).map((x) => x.id)))];
  const SIDS = Object.fromEntries(STRIPS.map((a) => [a, ids(a)]));
  const RIDS = Object.fromEntries(ROWS.map((a) => [a, ids(a)]));
  /* 자의 눈금 — 값을 정렬해 이웃 사이를 로그 거리로. 64 KB 를 넘게 벌어지면 끊는다 */
  const AXU = (() => {
    if (!RULER) return null;
    const xs = [...new Set(all.flatMap((s) => [
      ...KMARK.map(({ a, k }) => lsnOf(s[a][k])),
      ...[...PAGES, ...RECS].flatMap((a) => s[a].flatMap((x) => [itLsn(x), itEnd(x)])),
    ]).filter((x) => x != null))].sort((p, q) => p - q);
    if (!xs.length) return null;
    const pos = new Map(), brk = [];
    let u = 1;
    xs.forEach((x, i) => { if (i) { const d = x - xs[i - 1]; if (d > 65536) { brk.push(u + 1.2); u += 2.4; } else u += 0.6 + Math.log2(1 + d / 32) * 0.35; } pos.set(x, u); });
    return { pos, n: u + 1, brk };
  })();

  /* 셈 맞추기 */
  const flushOf = (s) => { for (const a of TEXTS) if ('Flush' in s[a]) return lsnOf(s[a].Flush); return null; };
  for (const [k, b] of BAKES) [b.S0, ...b.S].forEach((s, i, arr) => {
    const at = `pg wal ${sc.num} 세계${k ? ' (' + sc.vary.knob + '=' + k + ')' : ''} : ${i ? i + ' 스텝' : 'init'}`;
    for (const a of TEXTS) {
      const I = lsnOf(s[a].Insert), W = lsnOf(s[a].Write), Fl = lsnOf(s[a].Flush);
      if (I != null && W != null && I < W) console.error(`${at} 의 ${a} : Insert ${lsnTx(I)} < Write ${lsnTx(W)}`);
      if (W != null && Fl != null && W < Fl) console.error(`${at} 의 ${a} : Write ${lsnTx(W)} < Flush ${lsnTx(Fl)}`);
    }
    for (const a of RECS) for (const x of s[a]) if (itLsn(x) != null && itEnd(x) != null && itEnd(x) < itLsn(x)) console.error(`${at} 의 ${x.id} : end 가 lsn 보다 앞이다`);
    /* WAL-before-data — heap(데이터 파일) 항목의 lsn 이 이번 스텝에 바뀌었으면 그 lsn 까지 WAL 이 내려가 있어야 한다 */
    const fl = flushOf(s), pv = i ? arr[i - 1] : null;
    if (fl != null && pv && cast.includes('heap')) for (const x of s.heap) {
      const o = pv.heap.find((q) => q.id === x.id), L0 = itLsn(x);
      if (L0 != null && (!o || itLsn(o) !== L0) && L0 > fl) console.error(`${at} 의 heap ${x.id} 가 LSN ${lsnTx(L0)} 로 쓰였는데 Flush 는 ${lsnTx(fl)} — WAL 이 먼저가 아니다`);
    }
  });
  /* 슬롯이 붙잡는 WAL(09) — xlog.c GetWALAvailability : 세그먼트 = 16 MB, max_wal_size 안(지금 세그먼트 − (max_wal_size/16 + 1) 이후)이면
     reserved, 슬롯 때문에 그보다 오래 남기면 extended, max_slot_wal_keep_size 를 넘었지만 아직 안 지웠으면 unreserved.
     slotfuncs.c 의 safe_wal_size = (restart 세그먼트 + keep 세그먼트 + 1) 의 시작 − 지금 LSN. 잰 값이 이 셈과 다르면 알린다 */
  const SEG = 16 * 2 ** 20;
  const int = (v) => { const m = /^\s*(-?[\d,]+)/.exec(bare(v)); return m ? Number(m[1].replace(/,/g, '')) : null; };
  for (const [k, b] of BAKES) b.S.forEach((s, i) => {
    const sl = TEXTS.map((a) => s[a]).find((x) => 'restart_lsn' in x && 'wal_status' in x);
    const op = TEXTS.map((a) => s[a]).find((x) => 'pg_current_wal_lsn' in x && 'max_wal_size' in x && 'max_slot_wal_keep_size' in x);
    if (!sl || !op) return;
    const at = `pg wal ${sc.num} 세계${k ? ' (' + sc.vary.knob + '=' + k + ')' : ''} : ${i + 1} 스텝`, st = bare(sl.wal_status).split(/\s/)[0];
    if (!['reserved', 'extended', 'unreserved'].includes(st)) return;
    const R0 = lsnOf(sl.restart_lsn), C = lsnOf(op.pg_current_wal_lsn), mw = int(op.max_wal_size), kp = int(op.max_slot_wal_keep_size);
    if (R0 == null || C == null || mw == null || kp == null) { console.error(`${at} : 슬롯이 ${st} 인데 restart_lsn · 지금 LSN · 설정을 읽지 못했다`); return; }
    const cs = Math.floor(C / SEG), ts = Math.floor(R0 / SEG), keepMax = Math.floor(mw / 16) + 1, oMax = cs > keepMax ? cs - keepMax : 1;
    const oSlot = kp >= 0 && cs - ts > Math.floor(kp / 16) ? cs - Math.floor(kp / 16) : ts;
    const want = ts >= oSlot ? (ts >= oMax ? 'reserved' : 'extended') : 'unreserved';
    if (want !== st) console.error(`${at} : wal_status 가 ${st} 인데 규칙으로 셈하면 ${want} (restart 세그먼트 ${ts.toString(16)} · 지금 ${cs.toString(16)})`);
    const safe = int(sl.safe_wal_size), wantSafe = kp >= 0 ? (ts + Math.floor(kp / 16) + 1) * SEG - C : null;
    if (safe !== wantSafe) console.error(`${at} : safe_wal_size ${safe} 인데 규칙으로 셈하면 ${wantSafe}`);
    const segs = ROWS.flatMap((a) => s[a]).filter((x) => itLsn(x) != null && itEnd(x) != null);
    if (segs.length && !segs.some((x) => itLsn(x) <= R0 && R0 < itEnd(x))) console.error(`${at} : 슬롯이 ${st} 인데 restart_lsn ${lsnTx(R0)} 이 든 세그먼트가 칸 줄에 없다`);
  });
  let cur = BAKES.get(null) || [...BAKES.values()][0];

  /* ── 알갱이 구역 ── */
  const R = {};
  let at = 0;
  const take = (k, n) => { R[k] = [at, at + n]; at += n; };
  for (const a of STRIPS) take('s:' + a, SB);
  for (const a of ROWS) RIDS[a].forEach((id) => take(a + ':' + id, SL));
  if (RULER) take('ax', AXN);
  take('tok', TOK);
  R.DST = [at, N];
  if (at > N) throw new Error('pg wal 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표(DOM) ── */
  const made = [];
  /* 이름표 뒤의 선(페이지 ↔ 눈금, 줄을 내린 이름표의 끈)이 글자를 긋지 않게 바탕색 테두리를 두른다 —
     02 · 03 · 04 의 페이지 선이 '버퍼 p:9 0/5F001280' 과 PROCARRAY 칸 글을, 05 · 06 · 08 의 끈이 이웃 이름표를 그었다 */
  const HALO = '0 0 2px var(--bg), 0 0 3px var(--bg), 0 0 5px var(--bg)';
  function label(cls = '') {
    const el = document.createElement('div');
    el.className = 'wl ' + cls;
    if (!/stn-tok/.test(cls)) el.style.textShadow = HALO;
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
  /* 'WAL 먼저 · 그다음 페이지' 경계는 디스크 쪽 배우가 있는 장면에서만 — 05 · 07 은 메모리뿐인데 선이 WAL BUFFERS 와
     INSERTERS 사이를 갈랐다 */
  const EDGE = cast.some((a) => A[a].lane === 'disk') ? (deck.EDGES || [])[0] || null : null;
  const hd = Object.fromEntries(cast.map((a) => [a, label('aq')]));
  const tx = Object.fromEntries(TEXTS.map((a) => [a, label('aq ml aq-b')]));
  const sLb = Object.fromEntries(STRIPS.map((a) => [a, Object.fromEntries(SIDS[a].map((id) => [id, { n: label('aq'), v: label('aq') }]))]));
  const sCap = Object.fromEntries(STRIPS.map((a) => [a, label('aq ml aq-b')]));
  const rowLb = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, label('aq aq-c')]))]));
  const rowCap = Object.fromEntries(ROWS.map((a) => [a, label('aq ml aq-b')]));
  const kLb = Object.fromEntries(KMARK.map(({ a, k }) => [a + '.' + k, label('aq')]));
  const pLb = Object.fromEntries([...PAGES, ...RECS].flatMap((a) => RIDS[a].map((id) => [a + ':' + id, label('aq')])));
  const edgeLb = label('aq'), tok = label('stn-tok');

  /* 스텝마다의 글과 강조 — [글, 또렷한가, 색, 보이나, html] */
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const kvHtml = (kv, hot) => Object.entries(kv).map(kvLine(esc, val, hot)).join('\n');
  const capOf = (its) => its.filter((x) => x.sub).map((x) => `<span class="q-i">${esc(x.id)}</span> ${esc(x.sub)}`).join('\n');
  const texts = (S) => S.map((s) => {
    const t = new Map(), on = (a) => s.touch.has(a);
    /* 칸이 없는 띠(06 의 WAL PAGE HEADER, 4 스텝 전)는 제목도 숨긴다 — 빈 자리 위에 제목만 떠 있었다 */
    for (const a of cast) t.set(hd[a], [A[a].nm, on(a), '', !(STRIPS.includes(a) && !s[a].length)]);
    for (const a of TEXTS) t.set(tx[a], [kvHtml(s[a], focusOf(s, a)), on(a), '', true, true]);
    for (const a of STRIPS) {
      const mod = modOf(s, a);
      for (const id of SIDS[a]) {
        const it = s[a].find((x) => x.id === id), hot = on(a) && !!it && hotIt(s, a, id);
        t.set(sLb[a][id].n, [it ? id : '', hot, mod.has(id) && on(a) ? 'gold' : '', !!it]);
        t.set(sLb[a][id].v, [it ? esc(it.sub) : '', hot, '', !!it && !!it.sub, true]);
      }
      const byl = s[a].byl;
      t.set(sCap[a], [byl ? `${esc(byl.l || '')}${byl.r ? '  ·  ' + esc(byl.r) : ''}` : '', on(a), '', !!byl, true]);
    }
    for (const a of ROWS) {
      for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id); t.set(rowLb[a][id], [it ? id : '', on(a) && !!it && hotIt(s, a, id), it && (it.tag === 'x' || it.tag === 'red') ? 'red' : '', !!it]); }
      t.set(rowCap[a], [capOf(s[a]) || (s[a].length ? '' : '—'), on(a), '', true, true]);
    }
    if (RULER) {
      /* 같은 LSN 에 선 kv 는 이름표 하나로 — 'Insert · Write · Flush 0/30000A8' */
      const seen = new Map();
      for (const { a, k } of KMARK) { const v = lsnOf(s[a][k]); if (v != null) { if (!seen.has(v)) seen.set(v, []); seen.get(v).push({ a, k }); } }
      for (const { a, k } of KMARK) {
        const v = lsnOf(s[a][k]), grp = v != null ? seen.get(v) : null, lead = grp && grp[0].a === a && grp[0].k === k;
        const hot = grp && grp.some((q) => on(q.a));
        /* 키마다 제 색 — 'Insert · Write · Flush 0/30000A8' 가 통째로 금색이라 Flush 의 초록이 사라졌다 */
        const tn = grp ? grp.map((q) => tone(s[q.a][q.k]) || (q.k === 'Flush' ? 'green' : '')) : [];
        if (!lead) { t.set(kLb[a + '.' + k], ['', hot, '', false]); continue; }
        if (new Set(tn).size <= 1) t.set(kLb[a + '.' + k], [`${grp.map((q) => q.k).join(' · ')} ${lsnTx(v)}`, hot, tn[0] || '', true]);
        else t.set(kLb[a + '.' + k], [`${grp.map((q, j) => (tn[j] ? `<span class="${span[tn[j]]}">${esc(q.k)}</span>` : esc(q.k))).join(' · ')} ${lsnTx(v)}`, hot, '', true, true]);
      }
      /* 페이지 이름표에는 배우의 짧은 이름(short) — 버퍼의 p:7 과 파일의 p:7 을 가른다 */
      for (const a of [...PAGES, ...RECS]) for (const id of RIDS[a]) { const it = s[a].find((x) => x.id === id), v = itLsn(it), pre = A[a].short ? A[a].short + ' ' : ''; t.set(pLb[a + ':' + id], [v != null ? (itEnd(it) != null ? id : `${pre}${id} ${lsnTx(v)}`) : '', on(a) && !!it && hotIt(s, a, id), it && it.tag === 'x' ? 'red' : '', v != null]); }
    }
    if (EDGE) t.set(edgeLb, [EDGE.lb, false, (s.step.hot || (s.step.act && s.step.act.hot)) === EDGE.hot ? 'gold' : '']);
    return t;
  });
  for (const b of BAKES.values()) b.TX = texts(b.S);
  const TXALL = [...BAKES.values()].flatMap((b) => b.TX);
  const most = (lb) => {
    let w = 0, h = 0;
    const keep = lb.el.innerHTML;
    for (const t of TXALL) {
      const e = t.get(lb);
      if (!e || e[3] === false) continue;
      lb.el.innerHTML = e[0];
      const r = lb.el.getBoundingClientRect();
      w = Math.max(w, r.width); h = Math.max(h, r.height);
    }
    lb.el.innerHTML = keep;
    return { w, h };
  };
  const hMax = (lbs) => Math.max(14, ...lbs.map((lb) => most(lb).h));

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(29);
  const dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const RH = 15;
  const axX = (v) => G.ax.x0 + ((AXU.pos.get(v) ?? 0) / AXU.n) * (G.ax.x1 - G.ax.x0);
  /* build 가 짠 높이 — Story 가 남는 높이만큼 세계를 더 키운다(Story.jsx rebuild) */
  let HT = 0;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = 18, HD = 18;
    G = { L, anc: {}, slot: {}, strip: {}, HD };
    /* 글 블록은 세 단까지 — 한 단이 150px 보다 좁아지면 한 단 줄인다(좁은 단은 줄바꿈이 늘어 오히려 높아진다) */
    let tn = Math.max(1, Math.min(3, TEXTS.length));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const tW = (ww - (tn - 1) * gap) / tn, tRows = Math.ceil(TEXTS.length / tn);
    /* 글 블록은 줄마다 그 줄에서 가장 긴 것만큼. spread 면 모자란 끝 줄의 글이 그 줄의 폭을 나눠 쓴다
       (04 : 1024×768 에서 vs INNODB 혼자 한 단 폭에 다섯 줄 — 무대가 낮을 때만) */
    let tWs, tHs;
    const cols = (spread) => {
      tWs = Array.from({ length: tRows }, (_, r) => { const m = Math.min(tn, TEXTS.length - r * tn); return spread ? (ww - (m - 1) * gap) / m : tW; });
      TEXTS.forEach((a, i) => wrap(tx[a], tWs[Math.floor(i / tn)]));
      tHs = Array.from({ length: tRows }, (_, r) => hMax(TEXTS.slice(r * tn, r * tn + tn).map((a) => tx[a])));
    };
    cols(false);
    /* 글자 폭을 스텝마다 재는 도구 — 이름표 줄 나누기에 쓴다 */
    const wc = new Map();
    const wOf = (lb, html) => {
      if (!html) return 0;
      let m = wc.get(lb);
      if (!m) wc.set(lb, (m = new Map()));
      if (!m.has(html)) { const keep = lb.el.innerHTML; lb.el.innerHTML = html; m.set(html, lb.el.getBoundingClientRect().width); lb.el.innerHTML = keep; }
      return m.get(html);
    };
    const SW = {};
    for (const a of STRIPS) {
      wrap(sCap[a], ww);
      /* 칸 폭의 기준은 그 띠가 가장 길 때의 합 — 스텝마다 합으로 나누면 01 의 구멍 뺀 FPI(8 → 5)가 줄지 않고
         이웃 칸만 넓어졌고, 05 의 레코드도 FPI 가 붙어도 길어지지 않았다 */
      const sum = (s) => s[a].reduce((p, x) => p + (x.sz || 1), 0);
      const TOT = Math.max(1, ...all.map(sum));
      const pos = (s) => { const its = s[a]; let x = L.x0; return Object.fromEntries(its.map((it) => { const w = (ww * (it.sz || 1)) / TOT, r = [x, w]; x += w; return [it.id, r]; })); };
      let nr = 1, vr = 1;
      const per = new Map();
      for (const b of BAKES.values()) b.S.forEach((s, kk) => {
        const P = pos(s), T = b.TX[kk], g2 = (lb) => { const e = T.get(lb); return e && e[3] !== false ? e[0] : ''; };
        const NM = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: wOf(sLb[a][it.id].n, g2(sLb[a][it.id].n)) })).filter((q) => q.w), L.x0, L.x1);
        const VL = stagger(s[a].map((it) => ({ id: it.id, cx: P[it.id][0] + P[it.id][1] / 2, w: wOf(sLb[a][it.id].v, g2(sLb[a][it.id].v)) })).filter((q) => q.w), L.x0, L.x1);
        nr = Math.max(nr, NM.rows); vr = Math.max(vr, VL.rows);
        per.set(b.S[kk], { P, NM: NM.out, VL: VL.out, xe: L.x0 + (ww * sum(s)) / TOT });
      });
      SW[a] = { nr, vr, per, capH: most(sCap[a]).h };
    }
    /* LSN 자 — 위 이름표(kv 의 LSN · 레코드 이름), 아래 이름표(페이지 LSN)를 스텝마다 나눈다 */
    G.ax = { x0: L.x0 + 6, x1: L.x1 - 6, y: 0 };
    let upR = 1, dnR = 1;
    if (RULER && AXU) for (const b of BAKES.values()) {
      b.AXL = b.S.map((s, kk) => {
        const T = b.TX[kk], g2 = (lb) => { const e = T.get(lb); return e && e[3] !== false ? e[0] : ''; };
        const up = [], dn = [];
        for (const { a, k } of KMARK) { const v = lsnOf(s[a][k]), lb = kLb[a + '.' + k]; if (v != null) up.push({ lb, cx: axX(v), w: wOf(lb, g2(lb)) }); }
        for (const a of RECS) for (const it of s[a]) { const v = itLsn(it), e = itEnd(it), lb = pLb[a + ':' + it.id]; if (v != null && e != null) up.push({ lb, cx: (axX(v) + axX(e)) / 2, w: wOf(lb, g2(lb)), pins: [(axX(v) + axX(e)) / 2] }); }
        for (const a of PAGES) for (const it of s[a]) { const v = itLsn(it), lb = pLb[a + ':' + it.id]; if (v != null) dn.push({ lb, cx: axX(v), w: wOf(lb, g2(lb)) }); }
        const U2 = stagger(up.filter((q) => q.w), L.x0, L.x1), D2 = stagger(dn.filter((q) => q.w), L.x0, L.x1);
        upR = Math.max(upR, U2.rows); dnR = Math.max(dnR, D2.rows);
        return { up: U2.out, dn: D2.out };
      });
    }
    const sw = Object.fromEntries(ROWS.map((a) => [a, Object.fromEntries(RIDS[a].map((id) => [id, Math.max(30, Math.ceil(most(rowLb[a][id]).w) + 14)]))]));
    /* 칸 줄 블록이 셋 이상이면 두 단 — 배우 순서대로 둘씩 */
    const rc = ROWS.length >= 3 && ww >= 400 ? 2 : 1, rW = (ww - (rc - 1) * gap) / rc;
    /* 설명은 칸 줄 오른쪽이 더 낮으면 옆에 — 아니면 아래 */
    const rcH = {}, rSide = {};
    for (const a of ROWS) {
      const used = RIDS[a].reduce((t, id) => t + sw[a][id] + 6, -6), sideW = rW - Math.max(0, used) - 12;
      wrap(rowCap[a], rW); const hb = most(rowCap[a]).h;
      let hs = Infinity;
      if (sideW >= 150) { wrap(rowCap[a], sideW); hs = most(rowCap[a]).h; }
      rSide[a] = Math.max(26, hs) < 26 + 8 + hb ? Math.max(0, used) + 12 : 0;
      if (!rSide[a]) wrap(rowCap[a], rW);
      rcH[a] = rSide[a] ? hs : hb;
    }
    /* 칸 줄 둘을 한 줄에 — 메모리 쪽과 디스크 쪽(buf · heap 처럼 같은 페이지를 가진 두 배우)은 나란히 */
    const lay = (y0, k = 1) => {
      let y = y0;
      const rowY = [y]; for (let r = 0; r < tRows; r++) rowY.push(rowY[r] + HD + tHs[r] + 12 * k);
      TEXTS.forEach((a, i) => { const w = tWs[Math.floor(i / tn)], x = L.x0 + (i % tn) * (w + gap), yy = rowY[Math.floor(i / tn)]; place(hd[a], x, yy); place(tx[a], x, yy + HD); G.anc[a] = { x: x + w - 18, y: yy + 8 }; });
      y = rowY[tRows];
      for (const a of STRIPS) {
        place(hd[a], L.x0, y); y += HD + 6 + SW[a].nr * RH;
        G.strip[a] = { y, ...SW[a] }; G.anc[a] = { x: L.x0 + ww / 2, y: y + 13 };
        y += 26 + 5 + SW[a].vr * RH + 4; G.strip[a].capY = y; place(sCap[a], L.x0, y); y += SW[a].capH + (SW[a].capH > 1 ? 6 : 0) + 12 * k;
      }
      if (RULER) {
        y += upR * RH + 16;
        G.ax.y = y; G.anc.ax = { x: L.x0 + ww / 2, y };
        y += 14 + dnR * RH + 8 + 4 * k;
      }
      y += 6 * k; G.edgeY = y; if (EDGE) place(edgeLb, L.x1, y + 2, 'r', 't'); y += 8 + 8 * k;
      for (let i = 0; i < ROWS.length; i += rc) {
        let hh = 0;
        ROWS.slice(i, i + rc).forEach((a, j) => {
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
    if (total > wh && TEXTS.length % tn) { cols(true); total = lay(L.y0, k); }
    if (total > wh + 1) console.error(`pg wal ${sc.num} 세계 : 높이 ${Math.round(total)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    HT = total;
    const dy = L.narrow ? 0 : Math.max(0, (wh - total) / 2);
    if (dy) lay(L.y0 + dy, k);
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  const rowSlot = (s, a, id) => { let x = G.slot[a].x0; for (const it of s[a]) { const w = G.slot[a].sw[it.id]; if (it.id === id) return { x: x + w / 2, y: G.slot[a].y + 13, w }; x += w + 6; } return null; };
  function anchor(a, s, lbText) {
    if (ROWS.includes(a)) {
      const id = RIDS[a].filter((x) => (lbText || '').includes(x)).sort((p, q) => q.length - p.length)[0] || [...modOf(s, a)][0];
      const P = id ? rowSlot(s, a, id) : null;
      if (P) return [P.x, P.y];
    }
    const P = G.anc[a];
    return P ? [P.x, P.y] : [G.L.x0, G.L.y0];
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
  const hide = (k) => { const [a, b] = R[k]; for (let i = a; i < b; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  function box(o, r0, n, P, w, h, tg, a0, lit, from, gone, into, fly) {
    for (let m = 0; m < n; m++) {
      const i = r0 + m, f = m / n;
      let [x, y] = rim(P.x, P.y, w, h, n, m);
      if (from) { const q = show(fly, f * 0.4, 0.6 + f * 0.4); x = U.lerp(from[0] + jit[i * 2] * 10, x, q); y = U.lerp(from[1] + jit[i * 2 + 1] * 10, y, q) - Math.sin(q * Math.PI) * 18; }
      if (gone) { x += jit[i * 2] * 24 * gone; y += jit[i * 2 + 1] * 24 * gone + 8 * gone; }
      [x, y] = into(i, x, y);
      put(o, i, x, y, a0 * (1 - gone) * (tg === 'free' ? 0.5 * (m % 2) : 1), lit ? 0.4 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
    }
  }
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const { S, S0, NK } = cur, end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = R.DST[0]; i < R.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    const src = act ? anchor(act.f, s, act.lb) : null, mv = show(p, 0.12, 0.42);
    const level = (a, id) => (s.touch.has(a) && !end ? (hotIt(s, a, id) ? 0.95 : 0.6) : 0.45) * dim * form;
    /* 확대 띠 */
    for (const a of STRIPS) {
      const [s0, s1] = R['s:' + a], n = s1 - s0, info = G.strip[a].per.get(s), mod = modOf(s, a), on = s.touch.has(a) && !end;
      if (!info || !s[a].length) { hide('s:' + a); continue; }
      const cuts = Object.values(info.P).map(([x]) => x).slice(1), nc = Math.min(cuts.length * 4, 40), nl = n - nc;
      for (let m = 0; m < n; m++) {
        const i = s0 + m;
        let x, y, col = INK, hot = false;
        if (m < nl) {
          const u = Math.floor(m / 2) / Math.ceil(nl / 2); x = G.L.x0 + u * (info.xe - G.L.x0); y = G.strip[a].y + (m % 2 ? 26 : 0);
          const id = Object.keys(info.P).find((q) => x >= info.P[q][0] && x < info.P[q][0] + info.P[q][1]);
          const it = id && s[a].find((q) => q.id === id);
          hot = !!id && mod.has(id) && on; col = hot ? GOLD : it && it.tag && it.tag !== 'hdr' && it.tag !== 'clean' ? TAGC[it.tag] ?? INK : INK;
        } else { const c = Math.floor((m - nl) / 4); if (c >= cuts.length) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; } x = cuts[c]; y = G.strip[a].y + 5 + ((m - nl) % 4) * 5.3; }
        const [xx, yy] = into(i, x, y);
        put(o, i, xx, yy, (on ? 0.85 : 0.45) * dim * form, hot ? 0.5 : 0, 0.02, 1.05, col);
      }
    }
    /* LSN 자 — 위로 선 눈금(kv), 위쪽 띠(레코드 구간), 아래 눈금(페이지). 값이 바뀐 눈금은 옛 자리에서 미끄러진다 */
    if (RULER && AXU) {
      const [x0, x1] = R.ax, marks = [];
      for (const { a, k: key } of KMARK) {
        const v = lsnOf(s[a][key]), pv = lsnOf(prev[a][key]);
        if (v == null) continue;
        const xv = pv != null && pv !== v && !end ? U.lerp(axX(pv), axX(v), mv) : axX(v), hot = s.touch.has(a) && !end && modOf(s, a).has(key);
        marks.push(['up', xv, hot ? GOLD : key === 'Flush' ? GREEN : key === 'RedoRecPtr' ? ACCENT : INK, hot]);
      }
      for (const a of RECS) for (const it of s[a]) { const v = itLsn(it), e = itEnd(it); if (v != null && e != null) marks.push(['span', axX(v), axX(e), TAGC[it.tag] ?? INK, s.touch.has(a) && !end && hotIt(s, a, it.id)]); }
      for (const a of PAGES) for (const it of s[a]) {
        const v = itLsn(it); if (v == null) continue;
        const o2 = prev[a].find((q) => q.id === it.id), pv = itLsn(o2), xv = pv != null && pv !== v && !end ? U.lerp(axX(pv), axX(v), mv) : axX(v);
        marks.push(['dn', xv, TAGC[it.tag] ?? INK, s.touch.has(a) && !end && hotIt(s, a, it.id)]);
      }
      let i = x0;
      for (const mk of marks) {
        const n = mk[0] === 'span' ? 14 : 6;
        for (let m = 0; m < n && i < x1; m++, i++) {
          let x, y, col, hot;
          if (mk[0] === 'up') { x = mk[1]; y = G.ax.y - 3 - m * 2; col = mk[2]; hot = mk[3]; }
          else if (mk[0] === 'dn') { x = mk[1]; y = G.ax.y + 3 + m * 1.6; col = mk[2]; hot = mk[3]; }
          else { x = U.lerp(mk[1], mk[2], m / (n - 1)); y = G.ax.y - 7; col = mk[3]; hot = mk[4]; }
          const [xx, yy] = into(i, x, y);
          put(o, i, xx, yy, (hot ? 0.95 : 0.6) * dim * form, hot ? 0.4 : 0, 0.02, 1.15, col);
        }
      }
      for (; i < x1; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT);
    }
    /* 칸 줄 */
    for (const a of ROWS) for (const id of RIDS[a]) {
      const key = a + ':' + id, it = s[a].find((x) => x.id === id), pv = prev[a].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide(key); continue; }
      const P = it ? rowSlot(s, a, id) : rowSlot(prev, a, id);
      if (!P) { hide(key); continue; }
      const born = it && !pv && !end, from = born && act && act.t === a ? src : null;
      box(o, R[key][0], SL, P, P.w, 24, (it || pv).tag, level(a, id), it && modOf(s, a).has(id) && !end, from, it ? 0 : show(p, 0.1, 0.4), into, fly);
    }
    /* act */
    const [t0, t1] = R.tok, tn = t1 - t0;
    if (act) {
      const [fx, fy] = src, [tx2, ty2] = anchor(act.t, s, act.lb), e = U.smooth(fly), gone = show(p, 0.42, 0.52), self = act.f === act.t;
      const arc = self ? 0 : Math.sin(e * Math.PI) * Math.min(50, Math.hypot(tx2 - fx, ty2 - fy) * 0.25), col = act.gold ? GOLD : ACCENT;
      /* 덩어리 가운데는 무대 위 끝(y0) 아래에 — 좁은 화면에서 무대가 글 바로 밑으로 올라오자 위로 휘는 호가 글 위를 지났다(wal 04/5, 768) */
      const cy = Math.max(G.L.y0 + 10, U.lerp(fy, ty2, e) - arc);
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, th = m * 2.399, r = self ? 8 + e * 7 + (m % 3) * 0.7 : Math.sqrt((m + 0.5) / tn) * 7;
        put(o, i, U.lerp(fx, tx2, e) + Math.cos(th) * r, cy + Math.sin(th) * r, (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, col);
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
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
      }
      const s = S[kk];
      for (const a of STRIPS) {
        const info = G.strip[a].per.get(s);
        if (!info) continue;
        for (const q of info.NM) place(sLb[a][q.id].n, q.l, G.strip[a].y - 3 - q.row * RH, 'l', 'b');
        for (const q of info.VL) place(sLb[a][q.id].v, q.l, G.strip[a].y + 26 + 5 + q.row * RH, 'l', 't');
        place(sCap[a], G.L.x0, G.strip[a].capY);
      }
      if (RULER && cur.AXL) {
        const al = cur.AXL[kk];
        for (const q of al.up) place(q.lb, q.l, G.ax.y - 14 - q.row * RH, 'l', 'b');
        for (const q of al.dn) place(q.lb, q.l, G.ax.y + 14 + q.row * RH, 'l', 't');
      }
      for (const a of ROWS) for (const it of s[a]) { const P = rowSlot(s, a, it.id); if (P) place(rowLb[a][it.id], P.x, P.y, 'c', 'c'); }
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
    if (EDGE) { ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]); seg(ctx, L.x0, G.edgeY, L.x1, G.edgeY); ctx.setLineDash([]); }
    for (const a of STRIPS) {
      const info = G.strip[a].per.get(s);
      if (!info) continue;
      ctx.globalAlpha = 0.4 * o; ctx.strokeStyle = css.faint;
      const y = G.strip[a].y, off = (q) => q.row > 0 || q.cx < q.l || q.cx > q.r;
      for (const q of info.NM) if (off(q)) seg(ctx, q.cx, y - 3 - q.row * RH + 1, q.cx, y - 2);
      for (const q of info.VL) if (off(q)) seg(ctx, q.cx, y + 28, q.cx, y + 26 + 5 + q.row * RH - 1);
    }
    if (RULER && AXU && cur.AXL) {
      /* 자 — 끊긴 자리는 비우고 // */
      ctx.globalAlpha = 0.55 * o; ctx.strokeStyle = css.ink;
      const W = G.ax.x1 - G.ax.x0, cut = AXU.brk.map((u) => G.ax.x0 + (u / AXU.n) * W);
      let x = G.ax.x0;
      for (const c of cut) { seg(ctx, x, G.ax.y, c - 5, G.ax.y); seg(ctx, c - 6, G.ax.y + 4, c - 2, G.ax.y - 4); seg(ctx, c + 2, G.ax.y + 4, c + 6, G.ax.y - 4); x = c + 5; }
      seg(ctx, x, G.ax.y, G.ax.x1, G.ax.y);
      /* Flush 까지는 디스크에 있다 — 자의 왼쪽 끝부터 Flush 까지 초록 띠 */
      const fl = flushOf(s);
      if (fl != null) { ctx.globalAlpha = 0.22 * o; ctx.fillStyle = css.green; ctx.fillRect(G.ax.x0, G.ax.y - 2, axX(fl) - G.ax.x0, 4); }
      /* 줄을 내린 이름표는 제 자리로 잇는다 */
      ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint;
      const al = cur.AXL[kk];
      for (const q of al.up) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, G.ax.y - 14 - q.row * RH + 1, q.cx, G.ax.y - 9);
      for (const q of al.dn) if (q.row > 0 || q.cx < q.l || q.cx > q.r) seg(ctx, q.cx, G.ax.y + 13, q.cx, G.ax.y + 14 + q.row * RH - 1);
      /* 레코드 구간의 양 끝 — 07 의 B1 · B2 · B3 가 점선 하나로 이어져 경계가 안 보였다 */
      ctx.globalAlpha = 0.5 * o; ctx.strokeStyle = css.ink;
      for (const a of RECS) for (const it of s[a]) {
        const v = itLsn(it), e = itEnd(it);
        if (v == null || e == null) continue;
        for (const x of [axX(v), axX(e)]) seg(ctx, x, G.ax.y - 12, x, G.ax.y - 2);
      }
      /* 페이지 칸 ↔ 그 페이지의 LSN 이름표(눈금 바로 아래) — 이름표의 아래 끝에서 멈춘다. 눈금까지 그으면 제 이름표를 그었다.
         첫 줄 아래의 칸(02 · 04 의 HEAP FILE)은 곧게 그으면 위 줄의 칸을 지난다 — 04 의 선이 PROCARRAY 'xid 101' 을,
         02 의 선이 WAL SEGMENT 의 rec A 를 그었다. 그 칸은 제 제목 위로 나와 왼쪽 여백을 타고 올라가, 경계선 바로 위를 따라 간다 */
      const top = Math.min(...PAGES.filter((a) => G.slot[a]).map((a) => G.slot[a].y));
      let nd = 0;
      for (const a of PAGES) for (const it of s[a]) {
        const v = itLsn(it), P = rowSlot(s, a, it.id);
        if (v == null || !P) continue;
        const q = al.dn.find((d) => d.lb === pLb[a + ':' + it.id]);
        const ex = q ? Math.max(q.l + 4, Math.min(q.r - 4, q.cx)) : axX(v), ey = q ? G.ax.y + 14 + q.row * RH + 14 : G.ax.y + 12;
        ctx.globalAlpha = (s.touch.has(a) && !end && hotIt(s, a, it.id) ? 0.45 : 0.18) * o; ctx.strokeStyle = css.ink;
        ctx.beginPath(); ctx.moveTo(P.x, P.y - 12);
        if (G.slot[a].y <= top + 1) ctx.bezierCurveTo(P.x, P.y - 40, ex, ey + 28, ex, ey);
        else {
          const gx = L.x0 - 8 - nd * 4, ty = G.slot[a].y - G.HD - 4 - nd * 2, hy = G.edgeY - 6 - nd * 3, r = 4; nd++;
          ctx.arcTo(P.x, ty, gx, ty, r); ctx.arcTo(gx, ty, gx, hy, r); ctx.arcTo(gx, hy, ex, hy, r); ctx.arcTo(ex, hy, ex, ey, r); ctx.lineTo(ex, ey);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); return HT; },
    theme() {
      const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      css = { faint: v('--faint'), gold: v('--gold'), ink: v('--ink'), red: v('--red'), accent: v('--accent'), green: v('--green') };
    },
    setVary(v) { const b = BAKES.get(keyOf(v)); if (b && b !== cur) { cur = b; shown = -2; } },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
