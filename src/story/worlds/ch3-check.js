/* ch3 장면 세계(ch3-page)의 셈 맞추기와 글 풀기 — DOM 없이 돈다(node 로 증명을 돌릴 수 있게).
   세계가 그리는 수는 장면의 글(sub · kv · id) · 측정(pagedump · spacedump) 에서만 온다. 그 둘이 서로 맞아야 하는 곳을
   여기서 맞춘다 — 어긋나면 checkScene 이 문장을 돌려주고, 세계는 그것을 console.error 로 낸다(storysweep 의 errors).
     · 오프셋 + 폭이 빈틈없이 이어지고 헤더 · page 안에 든다(fil 38 · phd 36/56 · pg 16,384)
     · 16진 값과 옆에 적은 10진이 같다(02a 의 끝 오프셋 · 0x0006 · 0x03 · 04 의 헤더 값 · 04bv 의 version)
     · bit 칸을 다시 모으면 적힌 바이트가 된다(03a 의 다섯 바이트 · 02a 의 헤더 6 B · FSP flags)
     · 슬롯 주인의 n_owned 합 = record 수 + 2(06 · 08a), next 사슬이 record 를 키 순서로 한 번씩 돈다(08a)
     · PAGE_FREE 가 0 이면 목록이 비고, 아니면 목록의 머리다(09 · 09a). GARBAGE · HEAP_TOP 이 움직인 만큼이 record 크기다
     · 04c 의 header · descriptor · inode 값이 dump 를 푼 값과 같다 */
import { bake, valuesOf, stepsOf } from '../../bake.js';

export const PAGE = 16384;
/* 장면의 사실(fact)이 대는 상수 — FIL_PAGE_DATA 38 · FIL_PAGE_DATA_END 8 · PAGE_DATA = 38 + 36 + 2 × 10 */
export const FIL_DATA = 38, TRAILER = 8, PAGE_DATA = 38 + 36 + 2 * 10;
export const NEW_INF = PAGE_DATA + 5, NEW_SUP = PAGE_DATA + 2 * 5 + 8, NEW_SUP_END = NEW_SUP + 8;
export const OLD_SUP = PAGE_DATA + 2 + 2 * 6 + 8, OLD_SUP_END = OLD_SUP + 9;

export const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
export const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
export const nums = (v) => (bare(v).match(/\d[\d,]*/g) || []).map((x) => +x.replace(/,/g, ''));
/* 맨 앞의 수 — '+18  8B' · '26' · '0 · 4B' 의 18 · 26 · 0 */
export const lead = (v) => { const m = /^\s*\+?(\d[\d,]*)/.exec(bare(v)); return m ? +m[1].replace(/,/g, '') : null; };
/* 음수 오프셋 — '−4 −3' · '−6 에 있다'. U+2212 와 '-' 둘 다 */
export const negs = (v) => [...bare(v).matchAll(/(^|[\s(·])[−-](\d+)/g)].map((m) => -Number(m[2]));
/* 글 전체가 16진 바이트일 때만 — '00 00 10 0d 00 74' · '01' */
export const hexBytes = (v) => { const t = bare(v).trim(); return /^[0-9a-f]{2}(\s+[0-9a-f]{2})*$/i.test(t) ? t.split(/\s+/).map((x) => parseInt(x, 16)) : null; };
/* 'N B' · 'NB' 로 적은 바이트 수 */
export const bytesIn = (v) => { const m = /(\d[\d,]*)\s*B\b/.exec(bare(v)); return m ? +m[1].replace(/,/g, '') : null; };
export const bitW = (v) => { const m = /(\d+)\s*(?:비트|bit)/.exec(bare(v)); return m ? +m[1] : null; };
export const maskOf = (v) => { const m = /mask\s+(0x[0-9a-f]+)/i.exec(bare(v)); return m ? parseInt(m[1], 16) : null; };
export const eqv = (v) => { const m = /=\s*([+−-]?)(\d+)/.exec(bare(v)); return m ? (m[1] === '−' || m[1] === '-' ? -Number(m[2]) : Number(m[2])) : null; };
export const isMark = (it) => it.id === '◆' || /원점/.test(it.id);
export const isPlace = (it) => it.id === '—' || it.id === '(아직)';
const hexU = (h, o, w) => { let v = 0; for (let i = 0; i < w; i++) v = v * 256 + parseInt(h.slice((o + i) * 2, (o + i) * 2 + 2), 16); return v; };
export const hexAt = (h, o, w) => hexU(h, o, w);
const s16 = (v) => (v >= 0x8000 ? v - 0x10000 : v);

/* ── 레코드 헤더의 bit 칸 — 순서는 소스의 배치를 따른다 ──
   COMPACT  : info 4 · n_owned 4 · heap_no 13 · status 3 · next 16 (rec.h 의 REC_NEW_* · 07a 2 스텝의 why)
   REDUNDANT: info 4 · n_owned 4 · heap_no 13 · n_fields 10 · short 1 · next 16 ([iiiioooo][hhhhhhhh][hhhhhfff][fffffffs][p…][p…]) */
/* bake 상태(st[a].items)와 세계의 상태(s[a] = 항목 배열) 둘 다 */
const itemsIn = (st, a) => (Array.isArray(st[a]) ? st[a] : (st[a] && st[a].items) || []);
export const HB_ORDER = ['info bits', 'n_owned', 'heap_no', 'status', 'n_fields', 'short', 'next', 'next 오프셋'];
/* 폭은 칸마다 한 번 적힌 것(처음 나온 상태)을 쓴다 — 03a 의 info bits 는 1 스텝부터 폭 없이 mask 만 적는다 */
export function bitWidths(states, a) {
  const w = {};
  for (const st of states) for (const it of itemsIn(st, a)) if (w[it.id] == null && bitW(it.sub) != null) w[it.id] = bitW(it.sub);
  return w;
}
export function headerBits(items, W) {
  const out = [];
  let at = 0;
  for (const id of HB_ORDER) {
    const it = items.find((x) => x.id === id);
    if (!it || W[id] == null) continue;
    out.push({ id, at, w: W[id], it });
    at += W[id];
  }
  return { fields: out, bits: at };
}
/* 칸 하나를 읽는 쪽에서 본 mask — 칸이 걸친 바이트들(1 · 2 B)을 한 정수로 읽었을 때 */
export function maskAt(at, w) {
  const b0 = Math.floor(at / 8), b1 = Math.floor((at + w - 1) / 8), end = (b1 + 1) * 8;
  return ((2 ** w) - 1) * 2 ** (end - (at + w));
}
export function fieldVal(bytes, at, w) {
  let v = 0;
  for (let b = at; b < at + w; b++) v = v * 2 + ((bytes[b >> 3] >> (7 - (b & 7))) & 1);
  return v;
}

/* ── FSP flags — 칸 이름 · bit 범위(소스의 WIDTH 를 차례로 쌓은 것, 03a 5 스텝 · 10 6 스텝의 why) ── */
export const FSP_FLAGS = [['POST_ANTELOPE', 0, 0], ['ZIP_SSIZE', 1, 4], ['ATOMIC_BLOBS', 5, 5], ['PAGE_SSIZE', 6, 9],
  ['DATA_DIR', 10, 10], ['SHARED', 11, 11], ['TEMPORARY', 12, 12], ['ENCRYPTION', 13, 13], ['SDI', 14, 14]];
export const bitRange = (id) => { const m = /^bit\s+(\d+)(?:\s*[–~-]\s*(\d+))?/.exec(String(id)); return m ? [+m[1], m[2] != null ? +m[2] : +m[1]] : null; };
export const hexList = (v) => (bare(v).match(/0x[0-9a-f]+/gi) || []).map((x) => parseInt(x, 16));

/* ── FIL header 38 B · FSP header 112 B — 이름 · 오프셋 · 폭(소스 정의, 06b 세계 · ibdspace.js 와 같다) ── */
export const FIL_FIELDS = [['SPACE_OR_CHKSUM', 0, 4], ['OFFSET', 4, 4], ['PREV', 8, 4], ['NEXT', 12, 4], ['LSN', 16, 8], ['TYPE', 24, 2], ['FILE_FLUSH_LSN', 26, 8], ['SPACE_ID', 34, 4]];
export const FSP_FIELDS = [['SPACE_ID', 0, 4], ['NOT_USED', 4, 4], ['SIZE', 8, 4], ['FREE_LIMIT', 12, 4], ['SPACE_FLAGS', 16, 4], ['FRAG_N_USED', 20, 4],
  ['FREE', 24, 16], ['FREE_FRAG', 40, 16], ['FULL_FRAG', 56, 16], ['SEG_ID', 72, 8], ['SEG_INODES_FULL', 80, 16], ['SEG_INODES_FREE', 96, 16]];
export const XDES_SIZE = 40, INODE_AT = 50, INODE_SIZE = 192;
/* base node 16 B — 길이 4 B · 첫 주소(page 4 B · byte 2 B) · 끝 주소 */
export function flstAt(h, o) {
  const len = hexU(h, o, 4), pg = hexU(h, o + 4, 4), by = hexU(h, o + 8, 2);
  return { len, first: pg === 0xffffffff ? null : { page: pg, byte: by } };
}
export const fileOf = (SD, name) => Object.values(SD.files).find((f) => f.file === String(name).trim()) || null;
/* page 별 FIL_PAGE_TYPE — dump 가 가진 page 만(0 · 2 는 spacedump, 3 – 14 는 pagedump) */
export function typesOf(MEAS) {
  const t = {}, sm = MEAS.SPACE.files.small;
  t[0] = sm.p0.hex.slice(48, 52); t[2] = sm.p2.hex.slice(48, 52);
  for (const [no, p] of Object.entries(MEAS.DUMP)) t[no] = p.hex.slice(48, 52);
  return t;
}

/* ── 08a 의 record — 'Tom · 126' 의 이름과 원점, sub 의 heap · next ── */
export const recOf = (it) => { const m = /^(.+?)\s*·\s*(\d+)$/.exec(it.id); return m ? { name: m[1], org: +m[2] } : null; };
export const nextName = (sub) => {
  const t = bare(sub), m = /(?:next\s*(?:([+−-]\d+)\s*)?|=\s*([+−-]\d+)\s*)→\s*(\S+)/.exec(t);
  const r = m && (m[1] || m[2]);
  return m ? { rel: r ? Number(r.replace('−', '-')) : null, to: m[3] } : null;
};
export const heapOf = (sub) => { const m = /heap\s+(\d+)/.exec(bare(sub)); return m ? +m[1] : null; };
export const ownedOf = (sub) => { const m = /n_owned\s+(\d+)/.exec(bare(sub)); return m ? +m[1] : null; };

/* ── 슬롯 → 셀 — '슬롯 1 → 셀 3' · 'slot 0 → 99' ── */
export const slotTo = (id) => { const m = /→\s*(.+)$/.exec(String(id)); return m ? m[1].trim() : null; };
export const keyOfSub = (sub) => { const t = bare(sub).split(/\s+[·←]/)[0].trim(); const m = /k\s*=\s*(\d+)/.exec(t); return m ? +m[1] : t; };

/* 06 — 슬롯이 맡은 record 수 : '하나만' 1, '레코드 8개 소유' 8, '레코드 4개 + supremum' 5. 처음 적힌 sub 에서 */
export function owns06(states) {
  const o = {};
  for (const st of states) for (const x of itemsIn(st, 'dir')) {
    if (o[x.id] != null) continue;
    if (/하나만/.test(x.sub)) o[x.id] = 1;
    else if (/(\d+)\s*개/.test(x.sub)) o[x.id] = +/(\d+)\s*개/.exec(x.sub)[1] + (/supremum/.test(x.sub) ? 1 : 0);
  }
  return o;
}
/* ── 그 장면의 모든 상태 — 손잡이 값마다 init + 스텝 ── */
export function statesOf(sc) {
  const vals = valuesOf(sc).length ? valuesOf(sc) : [null];
  const base = sc.vary ? String(sc.vary.base) : null;
  return vals.map((v) => {
    const key = v == null || String(v) === base ? null : String(v);
    return { key, list: [sc.init, ...bake(sc, key).map((f) => f.st)], steps: [null, ...stepsOf(sc, key)] };
  });
}

/* ════════ 셈 맞추기 ════════ */
export function checkScene(deck, sc) {
  const out = [], MEAS = deck.MEASURED, DUMP = MEAS.DUMP, SD = MEAS.SPACE;
  const runs = statesOf(sc);
  const allStates = runs.flatMap((r) => r.list);
  const W5 = bitWidths(allStates, 'bit5');
  /* 06 의 슬롯이 맡은 수 — 처음 적힌 sub 에서(3 스텝은 sub 를 '← 이 구간' 으로 바꾼다) */
  const OWN06 = owns06(allStates);
  /* 08a 의 next — 마지막으로 적힌 것을 들고 간다(6 스텝은 Leslie 의 sub 를 lock 이야기로 바꾼다) */
  const NEXT = new Map();
  for (const { key, list, steps } of runs) list.forEach((st, k) => {
    const say = (m) => out.push(`ch3 ${sc.num} 세계${key ? ' (' + sc.vary.knob + '=' + key + ')' : ''} : ${k ? k + ' 스텝' : 'init'} — ${m}`);
    const items = (a) => (st[a] && st[a].items) || [];
    const kv = (a) => (st[a] && st[a].kv) || {};
    const has = (a) => sc.cast.includes(a);

    /* 바이트 줄(fil · phd) — look 이 칸을 이름으로 고르면 금빛 칸은 그 안에만. 칸 줄과 hexdump 는 금빛 칸을 짚으므로,
       앞 스텝의 금빛을 끄지 않으면 이 스텝이 고른 칸과 다른 칸이 함께 짚인다(04b · 04bv 2 스텝) */
    const lk = steps[k] && steps[k].look;
    for (const a of ['fil', 'phd']) {
      if (!has(a) || !lk || !Array.isArray(lk[a])) continue;
      const stale = items(a).filter((it) => it.tag === 'gold' && !lk[a].includes(it.id)).map((it) => it.id);
      if (stale.length) say(`look 은 ${a} 의 ${lk[a].join(' · ')} 를 짚는데 ${stale.join(' · ')} 가 금빛이다`);
    }
    /* FIL header — 칸의 오프셋(sub 의 맨 앞 수) + 폭(sz)이 0 부터 38 까지 빈틈없이 */
    if (has('fil')) {
      let at = 0;
      for (const it of items('fil')) {
        const o = lead(it.sub);
        if (o !== at) say(`fil 의 ${it.id} 오프셋 ${o} 가 앞 칸의 끝 ${at} 과 다르다`);
        at = (o ?? at) + (it.sz || 0);
      }
      if (at !== FIL_DATA) say(`fil 의 끝 ${at} 이 FIL_PAGE_DATA ${FIL_DATA} 가 아니다`);
    }
    /* PAGE header — '+0 ~ +17' · '+18' … 이 이어지고 36 · 56 B 로 끝난다. 2 B 칸 아홉(fsp · fins)이 +0 ~ +17 을 채운다 */
    if (has('phd')) {
      let at = 0;
      for (const it of items('phd')) {
        const o = lead(it.sub);
        if (o !== at) say(`phd 의 ${it.id} 오프셋 +${o} 가 앞 칸의 끝 +${at} 과 다르다`);
        at = (o ?? at) + (it.sz || 0);
      }
      if (at !== 36 && at !== 56) say(`phd 의 끝 +${at} 이 36 · 56 이 아니다`);
      const two = [...items('fsp'), ...items('fins')].map((it) => lead(it.id)).sort((p, q) => p - q);
      const first = items('phd')[0];
      two.forEach((o, i) => { if (o !== i * 2) say(`2 B 칸 ${i} 번째의 오프셋 +${o} 가 +${i * 2} 이 아니다`); });
      if (first && two.length * 2 !== first.sz) say(`2 B 칸 ${two.length} 개 × 2 가 ${first.id} 의 ${first.sz} B 와 다르다`);
    }
    const lastN = (v) => nums(v).slice(-1)[0];
    if (has('addr') && /\d/.test(kv('addr').PAGE_DATA || '') && lastN(kv('addr').PAGE_DATA) !== PAGE_DATA) say(`PAGE_DATA ${lastN(kv('addr').PAGE_DATA)} 이 38 + 36 + 2 × 10 = ${PAGE_DATA} 가 아니다`);
    if (has('addr') && /\d/.test(kv('addr').infimum || '') && nums(kv('addr').infimum)[0] !== NEW_INF) say(`infimum ${kv('addr').infimum} 이 PAGE_DATA + 5 = ${NEW_INF} 가 아니다`);
    if (has('addr') && /\d/.test(kv('addr').supremum || '') && nums(kv('addr').supremum)[0] !== NEW_SUP) say(`supremum ${kv('addr').supremum} 이 PAGE_DATA + 2 × 5 + 8 = ${NEW_SUP} 가 아니다`);

    /* 04 · 04a 의 FIL 헤더 값(filv) — 그 page 의 dump 를 풀어 맞춘다 */
    const fv = has('filv') ? 'filv' : 'hdr';
    if (has(fv) && kv(fv).FIL_PAGE_OFFSET != null) {
      const no = pageNo(sc), f = DUMP[no] && DUMP[no].f, h = kv(fv);
      if (f) {
        const off = lead(h.FIL_PAGE_OFFSET), lsn = lead(h.FIL_PAGE_LSN), ty = nums(h.FIL_PAGE_TYPE).find((x) => x >= 10000);
        if (off != null && off !== f.FIL_PAGE_OFFSET) say(`FIL_PAGE_OFFSET ${off} 이 p:${no} dump 의 ${f.FIL_PAGE_OFFSET} 와 다르다`);
        if (lsn != null && lsn !== f.FIL_PAGE_LSN) say(`FIL_PAGE_LSN ${lsn} 이 p:${no} dump 의 ${f.FIL_PAGE_LSN} 와 다르다`);
        if (ty != null && ty !== f.FIL_PAGE_TYPE) say(`FIL_PAGE_TYPE ${ty} 가 p:${no} dump 의 ${f.FIL_PAGE_TYPE} 와 다르다`);
      }
    }
    /* 04bv — page 0 의 8 · 12 · 26 */
    if (has('fld') && kv('fld')['오프셋 8'] && /p:0/.test(kv('op')['페이지'] || '')) {
      const h = SD.files.small.p0.hex;
      const v8 = eqv(kv('fld')['오프셋 8']), v12 = eqv(kv('fld')['오프셋 12']);
      if (v8 != null && v8 !== hexU(h, 8, 4)) say(`SRV_VERSION ${v8} 이 page 0 dump 의 ${hexU(h, 8, 4)} 와 다르다`);
      if (v12 != null && v12 !== hexU(h, 12, 4)) say(`SPACE_VERSION ${v12} 가 page 0 dump 의 ${hexU(h, 12, 4)} 와 다르다`);
    }

    /* 02 — 길이 칸 0x0006 = 뒤 데이터의 바이트 수 */
    if (sc.num === '02') {
      const its = items('rec');
      its.forEach((it, i) => {
        const m = /^0x([0-9a-f]+)$/i.exec(it.id), nx = its[i + 1];
        if (m && nx && parseInt(m[1], 16) !== (nx.sz || 0)) say(`길이 칸 ${it.id} = ${parseInt(m[1], 16)} 이 뒤의 ${nx.id} ${nx.sz} B 와 다르다`);
        if (m && bytesIn(it.sub) !== it.sz) say(`길이 칸 ${it.id} 의 폭 ${it.sz} 가 '${it.sub}' 와 다르다`);
      });
      /* InnoDB 배치(4 스텝) — 원점 앞의 길이 바이트('06')는 원점 뒤 데이터 칸의 바이트 수 */
      const data = its.filter((x) => /^\S(\s\S)+$/.test(x.id)).pop();
      for (const it of its) if (/길이/.test(it.sub) && /^[0-9a-f]{2}$/i.test(it.id) && data && parseInt(it.id, 16) !== data.sz) say(`길이 바이트 ${it.id} 가 ${data.id} 의 ${data.sz} B 와 다르다`);
    }
    /* 02a — REDUNDANT 끝 오프셋 · 헤더 6 B, COMPACT 길이 · 헤더 5 B */
    if (has('rdx') && items('rdx').some((x) => !isPlace(x))) {
      const offs = items('rdx').filter((x) => /^[0-9a-f]{2}$/i.test(x.id));
      const data = items('rdat'), ends = [];
      data.reduce((a, x) => { ends.push(a + (x.sz || 0)); return a + (x.sz || 0); }, 0);
      const want = ends.slice().reverse();
      offs.forEach((x, i) => {
        const v = parseInt(x.id, 16), n = nums(x.sub).slice(-1)[0];
        if ((v & 0x7f) !== n) say(`끝 오프셋 0x${x.id} & 0x7f = ${v & 0x7f} 가 '${bare(x.sub)}' 의 ${n} 와 다르다`);
        if (/NULL/.test(x.sub) && !(v & 0x80)) say(`'${bare(x.sub)}' 인데 0x${x.id} 의 NULL bit(0x80)가 꺼져 있다`);
        if (want[i] !== n) say(`끝 오프셋 ${x.id} = ${n} 이 데이터 칸 누적 ${want[i]} 와 다르다`);
      });
      /* 헤더 6 B — 처음 들어올 때(add)의 sub 가 바이트, 그것을 푼 값은 칸의 sub 나 op 의 '헤더 풀이' */
      const hd = items('rdx').find((x) => /헤더/.test(x.id));
      const rawHd = sc.steps.flatMap((s2) => (s2.ops && s2.ops.rdx && s2.ops.rdx.add) || []).find((x) => /헤더/.test(x.id));
      const rb = rawHd && hexBytes(rawHd.sub);
      if (rb && rb.length !== rawHd.sz) say(`${rawHd.id} 의 바이트 ${rb.length} 개가 폭 ${rawHd.sz} 와 다르다`);
      const dec = hd && (/heap/.test(hd.sub) ? hd.sub : /heap/.test(kv('op')['헤더 풀이'] || '') ? kv('op')['헤더 풀이'] : null);
      if (rb && dec) {
        const got = { heap: fieldVal(rb, 8, 13), n_fields: fieldVal(rb, 21, 10), short: fieldVal(rb, 31, 1), next: fieldVal(rb, 32, 16) };
        for (const m of bare(dec).matchAll(/(heap|n_fields|short|next)\s+(\d+)/g)) if (got[m[1]] !== +m[2]) say(`헤더 ${rawHd.sub} 의 ${m[1]} 가 ${got[m[1]]} 인데 '${m[1]} ${m[2]}' 로 적혔다`);
        if (got.next !== OLD_SUP) say(`REDUNDANT next ${got.next} 가 supremum ${OLD_SUP} 이 아니다`);
        if (got.n_fields !== offs.length || got.n_fields !== data.length) say(`n_fields ${got.n_fields} 가 끝 오프셋 ${offs.length} 개 · 데이터 칸 ${data.length} 개와 다르다`);
      }
      const pre = items('rdx').filter((x) => !isMark(x)).reduce((a, x) => a + (x.sz || 0), 0);
      const org = nums(st.rdx.byl && st.rdx.byl.r)[0];
      if (org != null && org - pre !== OLD_SUP_END) say(`REDUNDANT 원점 ${org} − 앞 ${pre} B = ${org - pre} 이 supremum 끝 ${OLD_SUP_END} 가 아니다`);
      if (/=\s*\d+\s*B/.test(kv('op').REDUNDANT || '') && nums(kv('op').REDUNDANT).slice(-1)[0] !== pre) say(`op 의 REDUNDANT '${bare(kv('op').REDUNDANT)}' 이 앞 ${pre} B 와 다르다`);
    }
    /* 02a 6 — rec_get_offsets 의 배열 : 데이터 칸 끝의 누적, COMPACT 의 NULL(c0)은 0 B 라 앞 끝 그대로 */
    if (has('cdx') && kv('op')['offsets[]'] && /\d/.test(kv('op')['offsets[]'])) {
      const want = [];
      items('rdat').reduce((a, x) => { const e = a + (x.c0 ? 0 : x.sz || 0); want.push(e); return e; }, 0);
      const got = nums(kv('op')['offsets[]']);
      if (got.join() !== want.join()) say(`offsets[] ${got.join(' · ')} 가 COMPACT 데이터 칸의 끝 ${want.join(' · ')} 와 다르다`);
    }
    if (has('cdx') && items('cdx').some((x) => !isPlace(x))) {
      const pre = items('cdx').filter((x) => !isMark(x)).reduce((a, x) => a + (x.sz || 0), 0);
      const org = nums(st.cdx.byl && st.cdx.byl.r)[0];
      if (org != null && org - pre !== NEW_SUP_END) say(`COMPACT 원점 ${org} − 앞 ${pre} B = ${org - pre} 이 supremum 끝 ${NEW_SUP_END} 가 아니다`);
      if (/=\s*\d+\s*B/.test(kv('op').COMPACT || '') && nums(kv('op').COMPACT).slice(-1)[0] !== pre) say(`op 의 COMPACT '${bare(kv('op').COMPACT)}' 이 앞 ${pre} B 와 다르다`);
      const len = items('cdx').find((x) => /길이/.test(x.sub)), a = items('rdat').find((x) => bare(x.sub) === 'a');
      if (len && a && parseInt(len.id, 16) !== a.sz) say(`COMPACT 길이 0x${len.id} 가 a 의 ${a.sz} B 와 다르다`);
      const hd = items('cdx').find((x) => /헤더/.test(x.id)), hb = hd && hexBytes(hd.sub);
      if (hd && hb && hb.length !== hd.sz) say(`${hd.id} 의 바이트 ${hb.length} 개가 폭 ${hd.sz} 와 다르다`);
      if (hb && org != null && org + s16(fieldVal(hb, 24, 16)) !== NEW_SUP) say(`COMPACT next ${s16(fieldVal(hb, 24, 16))} 가 원점 ${org} 에서 supremum ${NEW_SUP} 로 가지 않는다`);
    }

    /* 03 — 바이트의 16진 = 옆에 적은 2진, 켠 플래그의 mask 를 OR 하면 그 바이트 */
    if (sc.num === '03') {
      for (const it of items('val')) {
        const m = /^0x([0-9a-f]{2})$/i.exec(it.id), b = /([01]{4})\s?([01]{4})/.exec(it.sub);
        if (m && b && parseInt(b[1] + b[2], 2) !== parseInt(m[1], 16)) say(`${it.id} 와 '${it.sub}' 가 다르다`);
      }
      const on = items('bits').filter((x) => /=\s*1/.test(x.sub)).map((x) => hexList(x.id)[0] || 0).reduce((a, x) => a | x, 0);
      const v = items('val').length === 1 && /^0x/.test(items('val')[0].id) ? parseInt(items('val')[0].id, 16) : null;
      if (items('bits').length && v != null && on !== v) say(`켠 플래그의 mask OR 0x${on.toString(16)} 가 바이트 ${items('val')[0].id} 와 다르다`);
      /* 셀 줄의 FIL_PAGE_TYPE — '24 · 45 bf = 17855' 의 두 바이트와 10진이 p:5 dump 의 오프셋 24 와 같다 */
      const ft = items('rec').find((x) => x.id === 'FIL_PAGE_TYPE'), hx = ft && /([0-9a-f]{2})\s([0-9a-f]{2})\s*=\s*(\d+)/i.exec(bare(ft.sub));
      if (hx && (hx[1] + hx[2] !== DUMP[5].hex.slice(48, 52) || +hx[3] !== DUMP[5].f.FIL_PAGE_TYPE)) say(`FIL_PAGE_TYPE '${bare(ft.sub)}' 가 p:5 dump 의 ${DUMP[5].hex.slice(48, 52)} = ${DUMP[5].f.FIL_PAGE_TYPE} 와 다르다`);
    }

    /* 03a · 07a — 헤더 bit 칸. 폭 합 = 8 × extra, 적힌 mask = 그 자리에서 셈한 mask, 바이트를 풀면 적힌 값 */
    if (has('bit5')) {
      const { fields, bits } = headerBits(items('bit5'), W5);
      const extra = sc.num === '07a' ? lead(kv('op')['extra 바이트']) : items('rhd').filter((x) => !isMark(x)).reduce((a, x) => a + (x.sz || 0), 0);
      if (extra && bits !== 8 * extra) say(`bit 칸 폭의 합 ${bits} 가 8 × ${extra} B 가 아니다`);
      for (const f of fields) { const mk = maskOf(f.it.sub); if (mk != null && mk !== maskAt(f.at, f.w)) say(`${f.id} 의 mask 0x${mk.toString(16)} 가 bit ${f.at}–${f.at + f.w - 1} 에서 셈한 0x${maskAt(f.at, f.w).toString(16)} 와 다르다`); }
      const hb = items('rhd').filter((x) => !isMark(x)).flatMap((x) => hexBytes(x.sub) || []);
      if (hb.length === bits / 8) for (const f of fields) {
        let v = fieldVal(hb, f.at, f.w); if (f.w === 16) v = s16(v);
        const want = eqv(f.it.sub);
        if (want != null && want !== v) say(`${f.id} 를 바이트에서 풀면 ${v} 인데 '${bare(f.it.sub)}' 로 적혔다`);
        const to = /→\s*(\d+)/.exec(bare(f.it.sub)), org = /원점\s*(\d+)/.exec(bare(kv('op')['레코드'] || ''));
        if (f.w === 16 && to && org && +org[1] + v !== +to[1]) say(`next ${v} 가 원점 ${org[1]} 에서 ${to[1]} 로 가지 않는다`);
      }
    }
    /* FSP flags — bit 범위가 0 부터 이어지고, 적힌 mask 가 범위와 같고, 실측 값이 그 칸들로 풀린다 */
    if (has('bits') && items('bits').some((x) => bitRange(x.id) && /[A-Z]{3}/.test(x.id + x.sub)) && sc.num === '03a') {
      let at = 0;
      for (const it of items('bits')) {
        const r = bitRange(it.id);
        if (!r) continue;
        if (r[0] !== at) say(`${it.id} 가 bit ${at} 에서 시작하지 않는다`);
        at = r[1] + 1;
        const mk = maskOf(it.sub);
        if (mk != null && mk !== ((2 ** (r[1] - r[0] + 1)) - 1) * 2 ** r[0]) say(`${it.id} 의 mask 0x${mk.toString(16)} 가 bit ${r[0]}–${r[1]} 와 다르다`);
        const ff = FSP_FLAGS.find(([n]) => it.id.includes(n));
        if (ff && (ff[1] !== r[0] || ff[2] !== r[1])) say(`${it.id} 의 범위가 FSP flags 의 ${ff[0]} ${ff[1]}–${ff[2]} 와 다르다`);
      }
      if (items('bits').length && /15\s*bit/.test(kv('op').FSP_SPACE_FLAGS || '') && at !== 15) say(`FSP flags 칸이 bit ${at} 에서 끝난다(15 bit 가 아니다)`);
      const vals = hexList(kv('op').FSP_SPACE_FLAGS);
      for (const it of items('bits')) {
        const r = bitRange(it.id), want = eqv(it.sub);
        if (!r || want == null || !vals.length) continue;
        const got = vals.map((v) => Math.floor(v / 2 ** r[0]) % 2 ** (r[1] - r[0] + 1));
        if (!got.includes(want)) say(`${it.id} '= ${want}' 이 실측 ${vals.map((x) => '0x' + x.toString(16)).join(' · ')} 어디에도 없다`);
      }
      for (const v of vals) if (v >= 2 ** 15) say(`FSP flags 0x${v.toString(16)} 가 15 bit 를 넘는다`);
    }

    /* 06 — 슬롯 주인 n_owned 합 = 레코드 수 + 2(infimum · supremum) */
    if (sc.num === '06' && items('dir').length) {
      const owned = items('dir').reduce((a, x) => a + (OWN06[x.id] ?? 0), 0);
      const n = lead(kv('op')['레코드 수']);
      if (n != null && owned !== n + 2) say(`슬롯 n_owned 합 ${owned} 이 레코드 ${n} + 2 와 다르다`);
    }
    /* 05v · 08 — 슬롯은 그 셀을 가리키고, 슬롯 순서 = 키 순서 */
    if (has('dir') && has('cells') && has('pg')) {
      const cells = items('cells'), keys = [];
      for (const d of items('dir')) {
        const to = slotTo(d.id);
        if (!to || !/^셀/.test(to)) continue;
        const c = cells.find((x) => x.id === to || x.id.startsWith(to + ' '));
        if (!c) { say(`${d.id} 가 가리키는 ${to} 가 셀에 없다`); continue; }
        const key = keyOfSub(d.sub);
        if (!c.id.includes(String(key))) say(`${d.id} 의 키 ${key} 가 ${c.id} 에 없다`);
        keys.push(key);
      }
      if (new Set(keys.map((x) => typeof x)).size === 1) for (let i = 1; i < keys.length; i++) if (!(keys[i - 1] < keys[i])) say(`슬롯 순서가 키 순서가 아니다 — ${keys.join(' · ')}`);
    }
    /* 08a — 사슬이 infimum 에서 supremum 까지 record 를 키 순서로 한 번씩, 상대 거리 = 원점의 차, n_owned 합 = N_HEAP */
    if (sc.num === '08a') {
      const recs = items('cells').map((it) => ({ it, r: recOf(it) })).filter((x) => x.r);
      const by = (nm) => recs.find((x) => x.r.name === nm);
      for (const x of recs) { const nx = nextName(x.it.sub); if (nx) NEXT.set(key + '|' + x.r.name, nx); }
      const find = (t) => (/^\d+$/.test(t) ? recs.find((x) => x.r.org === +t) : by(t));
      let cur = by('infimum'), seen = new Set(), names = [];
      while (cur && cur.r.name !== 'supremum' && !seen.has(cur.r.name)) {
        seen.add(cur.r.name);
        const nx = NEXT.get(key + '|' + cur.r.name), to = nx && find(nx.to);
        if (!to) { say(`${cur.it.id} 의 next 가 없는 record 를 가리킨다`); break; }
        if (nx.rel != null && cur.r.org + nx.rel !== to.r.org) say(`${cur.it.id} 의 next ${nx.rel} 가 ${to.it.id} 로 가지 않는다`);
        const hx = /([0-9a-f]{2})\s([0-9a-f]{2})\s*=\s*([−-]\d+)/i.exec(bare(cur.it.sub));
        if (hx && s16(parseInt(hx[1] + hx[2], 16)) !== Number(hx[3].replace('−', '-'))) say(`${hx[1]} ${hx[2]} 가 ${hx[3]} 가 아니다`);
        if (cur.r.name !== 'infimum') names.push(cur.r.name);
        cur = to;
      }
      const users = recs.filter((x) => !['infimum', 'supremum'].includes(x.r.name)).map((x) => x.r.name);
      if (users.some((u) => !names.includes(u)) || names.length !== users.length) say(`next 사슬이 record 를 한 번씩 돌지 않는다 — ${names.join(' → ')}`);
      for (let i = 1; i < names.length; i++) if (!(names[i - 1] < names[i])) say(`next 사슬이 키 순서가 아니다 — ${names.join(' → ')}`);
      const heaps = recs.map((x) => heapOf(x.it.sub)).filter((x) => x != null);
      const more = items('cells').filter((x) => !recOf(x)).reduce((a, x) => a + (/여섯/.test(x.id) ? 6 : 0), 0);
      const nHeap = lead(kv('hdr').N_HEAP), owned = items('dir').reduce((a, x) => a + (ownedOf(x.sub) || 0), 0);
      if (nHeap != null && nHeap !== heaps.length + more) say(`N_HEAP ${nHeap} 이 record ${heaps.length} + ${more} 와 다르다`);
      if (nHeap != null && owned !== nHeap) say(`슬롯 n_owned 합 ${owned} 이 N_HEAP ${nHeap} (record + 2) 와 다르다`);
      if (lead(kv('hdr').N_DIR_SLOTS) !== items('dir').length) say(`N_DIR_SLOTS ${kv('hdr').N_DIR_SLOTS} 가 슬롯 ${items('dir').length} 개와 다르다`);
      const hs = recs.filter((x) => !['infimum', 'supremum'].includes(x.r.name)).map((x) => heapOf(x.it.sub));
      for (let i = 1; i < hs.length; i++) if (!(hs[i - 1] < hs[i])) say(`heap 번호가 넣은 순서로 늘지 않는다 — ${hs.join(' · ')}`);
      for (const d of items('dir')) { const to = slotTo(d.id); if (to && /^\d+$/.test(to) && !recs.some((x) => x.r.org === +to)) say(`${d.id} 가 가리키는 원점 ${to} 에 record 가 없다`); }
    }
    /* 09 · 09a — PAGE_FREE 0 ⟺ 목록이 비었다, 수이면 그 머리. GARBAGE · HEAP_TOP 의 움직임 = 넣은 record 크기 */
    if (has('freeL') && has('hdr')) {
      const chain = items('freeL').filter((x) => x.tag !== 'x' && x.tag !== 'free');
      const pf = bare(kv('hdr').PAGE_FREE || ''), z = /^0(\s|$)/.test(pf);
      if (z && chain.length) say(`PAGE_FREE 가 0 인데 목록에 ${chain.length} 개가 있다`);
      if (!z && pf && !chain.length && !/그대로/.test(pf)) say(`PAGE_FREE '${pf}' 인데 목록이 비었다`);
      const po = /^(\d+)\s*(\(|$)/.exec(pf);
      if (po && +po[1] > 0 && chain[0] && lead(chain[0].sub) !== +po[1]) say(`PAGE_FREE ${pf} 가 목록 머리 ${chain[0].id} (${chain[0].sub}) 가 아니다`);
      if (!po && !z && chain[0] && /record/.test(pf) && !pf.startsWith(chain[0].id) && !/지운/.test(pf)) say(`PAGE_FREE '${pf}' 가 목록 머리 ${chain[0].id} 가 아니다`);
    }
    if (sc.num === '09a' && k > 0) {
      const prev = list[k - 1], h0 = (prev.hdr && prev.hdr.kv) || {}, h1 = kv('hdr'), need = nums((kv('op')['넣는 행'] || '').split('·')[1] || '')[0];
      const g0 = lead(h0.PAGE_GARBAGE), g1 = lead(h1.PAGE_GARBAGE), t0 = lead(h0.HEAP_TOP), t1 = lead(h1.HEAP_TOP);
      if (need && g0 != null && g1 != null && g0 !== g1 && g0 - g1 !== need && g1 !== 0) say(`GARBAGE ${g0} → ${g1} 이 record ${need} B 만큼 줄지 않았다`);
      if (need && t0 != null && t1 != null && t1 > t0 && t1 - t0 !== need && /HEAP_TOP/.test(kv('op')['결과'] || '')) say(`HEAP_TOP ${t0} → ${t1} 이 record ${need} B 만큼 늘지 않았다`);
      const ad = kv('addr'), g = lead(ad.GARBAGE), c = lead(ad['연속 여유']), mx = nums(ad['정리 후 최대'])[0], lim = nums(ad['1/32 문턱'])[0];
      if (lim != null && lim !== PAGE / 32) say(`1/32 문턱 ${lim} 이 16384 / 32 가 아니다`);
      if (g != null && c != null && mx != null && Math.abs(g + c - mx) > 0) say(`정리 후 최대 ${mx} 가 GARBAGE ${g} + 연속 여유 ${c} 와 다르다`);
      if (mx != null && lim != null) { const lt = /</.test(ad['정리 후 최대']), ge = /≥/.test(ad['정리 후 최대']); if ((lt && !(mx < lim)) || (ge && !(mx >= lim))) say(`'${bare(ad['정리 후 최대'])}' 의 비교가 ${mx} 대 ${lim} 와 맞지 않는다`); }
    }

    /* 04 · 11 — page 를 이루는 칸의 바이트 합 = 16,384, 11 은 crc32 가 덮는 바이트 = 검사 범위 */
    if (has('pg') && (sc.num === '04' || sc.num === '11')) {
      const its = items('pg').filter((x) => !isPlace(x));
      if (its.length) {
        const sum = its.reduce((a, x) => a + (bytesIn(x.sub) ?? bytesIn(x.id) ?? 0), 0);
        if (sum !== PAGE) say(`page 칸의 바이트 합 ${sum} 이 16,384 가 아니다`);
      }
      /* 04 의 trailer 8 B — crc32 면 머리 checksum(0–3) + LSN 하위(20–23) */
      const tr = sc.num === '04' && items('pg').find((x) => /^8\s*B$/.test(x.id)), tb = tr && (bare(tr.sub).match(/\b[0-9a-f]{2}\b/gi) || []).join('');
      if (tb && tb.length === 16 && tb !== DUMP[5].hex.slice(0, 8) + DUMP[5].hex.slice(40, 48)) say(`trailer '${bare(tr.sub)}' 가 p:5 의 머리 checksum + LSN 하위 와 다르다`);
      if (sc.num === '11') {
        const cov = COVER.reduce((a, [p, q]) => a + q - p, 0), want = lead(kv('op')['검사 범위']);
        if (want != null && /^\d/.test(kv('op')['검사 범위']) && want !== cov) say(`검사 범위 ${want} 가 crc32 가 덮는 ${cov} B 와 다르다`);
        const s = kv('sum'), lo = hexList(s['LSN 하위 (뒤 4 B)'])[0], f = DUMP[5].f;
        if (lo != null && lo !== f.FIL_PAGE_LSN % 2 ** 32) say(`LSN 하위 0x${lo.toString(16)} 가 p:5 dump 의 LSN ${f.FIL_PAGE_LSN} 하위 4 B 와 다르다`);
        const head = hexList(s['머리 (오프셋 0)'])[0];
        if (!key && head != null && head !== hexU(DUMP[5].hex, 0, 4)) say(`머리 checksum 0x${head.toString(16)} 가 p:5 dump 의 앞 4 B 와 다르다`);
      }
    }
    /* 10 — FIL_PAGE_TYPE 17855 = 0x45bf(실측 page 4 – 14), FSP FLAG 는 t.ibd page 0 의 값이고 적은 이름의 bit 가 켜져 있다 */
    if (sc.num === '10') {
      const h = kv('hdr'), ty = nums(h.FIL_PAGE_TYPE).find((x) => x >= 10000), fl = hexList(h['FSP FLAG'])[0];
      if (ty != null && ty !== hexU(DUMP[4].hex, 24, 2)) say(`FIL_PAGE_TYPE ${ty} 가 실측 INDEX page 의 0x${DUMP[4].hex.slice(48, 52)} 와 다르다`);
      if (fl != null && fl !== SD.files.small.p0.f.FSP_SPACE_FLAGS) say(`FSP FLAG 0x${fl.toString(16)} 가 t.ibd page 0 의 0x${SD.files.small.p0.f.FSP_SPACE_FLAGS.toString(16)} 와 다르다`);
      if (fl != null) for (const [n, a] of FSP_FLAGS) if (bare(h['FSP FLAG']).includes(n) && !(Math.floor(fl / 2 ** a) % 2)) say(`FSP FLAG 에 ${n} 이 적혔는데 bit ${a} 가 꺼져 있다`);
    }
    /* 04c — header 의 칸을 dump 에서 다시 풀어 kv 와 맞춘다. 파일은 그 스텝의 fsA.file — 그리고 그 파일이 이 스텝의
       실측 조건(src 의 파일)과 같아야 한다. fsA 를 fsA 자신의 file 하고만 맞췄더니 src 가 big.ibd 로 바뀐 스텝에
       t.ibd 의 header 가 남은 것(4 · 9 스텝)을 못 잡았다 */
    if (has('fsA')) {
      const fa = kv('fsA'), fl = kv('fsL'), f = fileOf(SD, fa.file);
      const sf = bare(kv('src')['파일'] || '').split('·')[0].trim();
      if (sf && sf !== '—') for (const [n, v] of [['fsA', fa], ['fsL', fl]]) {
        const ff = bare(v.file || '').trim();
        if (ff && ff !== '—' && ff !== sf) say(`${n}.file ${ff} 가 실측 조건의 파일 ${sf} 와 다르다`);
      }
      if (f) {
        const h = f.p0.hex, O = (n) => FIL_DATA + FSP_FIELDS.find((x) => x[0] === n)[1];
        const dec = { SPACE_ID: hexU(h, O('SPACE_ID'), 4), SIZE: hexU(h, O('SIZE'), 4), FREE_LIMIT: hexU(h, O('FREE_LIMIT'), 4), SPACE_FLAGS: hexU(h, O('SPACE_FLAGS'), 4), FRAG_N_USED: hexU(h, O('FRAG_N_USED'), 4), SEG_ID: hexU(h, O('SEG_ID'), 8) };
        for (const [n, v] of Object.entries(dec)) {
          if (f.p0.f['FSP_' + n] !== v) say(`FSP_${n} 을 dump 에서 풀면 ${v} 인데 저장된 값은 ${f.p0.f['FSP_' + n]}`);
          const t = bare(fa[n] || '');
          if (!t || t === '—') continue;
          const got = /^0x/.test(t) ? parseInt(t, 16) : lead(t);
          if (got !== v) say(`fsA.${n} '${t}' 가 ${f.file} 의 ${v} 와 다르다`);
        }
        for (const n of ['FREE', 'FREE_FRAG', 'FULL_FRAG', 'SEG_INODES_FULL', 'SEG_INODES_FREE']) {
          const b = flstAt(h, O(n)), t = bare(fl[n] || '');
          if (JSON.stringify(b) !== JSON.stringify({ len: f.p0.f['FSP_' + n].len, first: f.p0.f['FSP_' + n].first })) say(`FSP_${n} 을 dump 에서 풀면 ${JSON.stringify(b)}`);
          if (!t || t === '—' || bare(fl.file) !== f.file) continue;
          const m = /len\s+(\d+)(?:\s*→\s*(\d+):(\d+))?/.exec(t);
          if (!m || +m[1] !== b.len || (m[2] != null && (!b.first || +m[2] !== b.first.page || +m[3] !== b.first.byte))) say(`fsL.${n} '${t}' 가 ${f.file} 의 base node 와 다르다`);
        }
        const x0 = f.p0.f.xdes[0], fu = /used\s+(\d+)–(\d+)/.exec(items('xd')[0] ? items('xd')[0].sub : '');
        if (fu && (x0.used[0] !== +fu[1] || x0.used[x0.used.length - 1] !== +fu[2] || x0.used.length !== +fu[2] - +fu[1] + 1)) say(`extent 0 'used ${fu[1]}–${fu[2]}' 가 ${f.file} 의 bitmap 과 다르다`);
      }
      const src = fileOf(SD, (kv('src')['파일'] || '').split('·')[0]);
      if (src) {
        items('xd').forEach((it, e) => {
          const n = /(\d+)\s*장/.exec(it.sub), x = src.p0.f.xdes[e];
          if (n && x && x.used.length !== +n[1]) say(`${it.id} '${bare(it.sub)}' 가 ${src.file} 의 쓰인 page ${x.used.length} 와 다르다`);
        });
        items('ino').forEach((it) => {
          const at = lead(it.id), i = src.p2.f.find((q) => q.at === at), fr = /frag\s+(\d+)/.exec(it.sub), pg = /p\s+(\d+)(?:–(\d+))?/.exec(it.sub), n = /·\s*(\d+)\s*장/.exec(it.sub);
          if (!i) { say(`${it.id} 자리에 inode 가 없다`); return; }
          if (fr && i.frag.length !== +fr[1]) say(`${it.id} 'frag ${fr[1]}' 가 ${src.file} 의 낱장 ${i.frag.length} 와 다르다`);
          if (pg && (i.frag[0] !== +pg[1] || i.frag[i.frag.length - 1] !== +(pg[2] ?? pg[1]))) say(`${it.id} '${bare(it.sub)}' 가 낱장 ${i.frag.join(',')} 와 다르다`);
          const tot = i.frag.length + i.FSEG_NOT_FULL_N_USED + i.FSEG_FULL.len * 64;
          if (n && tot !== +n[1]) say(`${it.id} '${n[1]} 장' 이 ${src.file} 의 ${tot} 와 다르다`);
          const e1 = /extent\s+1\s*\((\d+)\s*장\)/.exec(it.sub);
          if (e1 && i.FSEG_NOT_FULL_N_USED !== +e1[1]) say(`${it.id} extent 1 '${e1[1]} 장' 이 NOT_FULL_N_USED ${i.FSEG_NOT_FULL_N_USED} 와 다르다`);
        });
      }
    }
  });
  return out;
}
/* crc32 가 덮는 바이트 — buf_calc_page_crc32 : [FIL_PAGE_OFFSET 4, FIL_PAGE_FILE_FLUSH_LSN 26) 과 [FIL_PAGE_DATA 38, 끝 − 8) */
export const COVER = [[4, 26], [FIL_DATA, PAGE - TRAILER]];
/* 그 장면이 보는 page 번호 — op 의 '페이지 p:N', 아니면 act 이름의 'page N' */
export function pageNo(sc) {
  const p = /p:(\d+)/.exec((sc.init.op && sc.init.op.kv && sc.init.op.kv['페이지']) || '');
  if (p) return +p[1];
  for (const s of sc.steps) { const m = s.act && /page\s+(\d+)/.exec(s.act.lb); if (m) return +m[1]; }
  return null;
}
