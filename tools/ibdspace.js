/* .ibd 의 공간 관리 구조를 푼다 — page 0 의 FSP header · extent descriptor(XDES), page 2 의 segment inode.
   book/ch3 04c 가 무대에 띄우는 값은 이 도구가 실제 파일에서 뜬 것이다(ibdpage.js 의 짝).

   오프셋은 소스의 식을 그대로 따라 계산하고, 쓰기 전에 그 식이 소스에 글자 그대로 있는지 맞춰 본다.

     node tools/ibdspace.js <a.ibd>                                  표
     node tools/ibdspace.js --js --meta=<file> small=<a.ibd> big=<b.ibd>  덱이 읽는 모듈을 stdout 으로
     node tools/ibdspace.js --check <spacedump.js>                     저장된 바이트를 다시 풀어 맞춘다(check.sh) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { srcRoot } from './srcroot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PS = 16384;
const EXTENT = 1048576 / PS;                        /* FSP_EXTENT_SIZE — 16 KB page 면 64 */
const FIL_PAGE_DATA = 38, FIL_ADDR_SIZE = 6;
const FLB = 4 + 2 * FIL_ADDR_SIZE;                  /* FLST_BASE_NODE_SIZE */
const FLN = 2 * FIL_ADDR_SIZE;                      /* FLST_NODE_SIZE */
const FSP = {
  FSP_SPACE_ID: [0, 4], FSP_NOT_USED: [4, 4], FSP_SIZE: [8, 4], FSP_FREE_LIMIT: [12, 4], FSP_SPACE_FLAGS: [16, 4],
  FSP_FRAG_N_USED: [20, 4], FSP_SEG_ID: [24 + 3 * FLB, 8] };
const FSPL = { FSP_FREE: 24, FSP_FREE_FRAG: 24 + FLB, FSP_FULL_FRAG: 24 + 2 * FLB, FSP_SEG_INODES_FULL: 32 + 3 * FLB, FSP_SEG_INODES_FREE: 32 + 4 * FLB };
const FSP_HEADER_SIZE = 32 + 5 * FLB;
const XDES_ARR = FIL_PAGE_DATA + FSP_HEADER_SIZE;
const XDES_STATE = FLN + 8, XDES_BITMAP = FLN + 12, XDES_SIZE = XDES_BITMAP + (EXTENT * 2) / 8;
const XST = { 0: 'XDES_NOT_INITED', 1: 'XDES_FREE', 2: 'XDES_FREE_FRAG', 3: 'XDES_FULL_FRAG', 4: 'XDES_FSEG', 5: 'XDES_FSEG_FRAG' };
const FSEG_ARR = FIL_PAGE_DATA + FLN;               /* FSEG_ARR_OFFSET */
const FRAG_SLOTS = EXTENT / 2;
const INODE = { FSEG_ID: 0, FSEG_NOT_FULL_N_USED: 8, FSEG_FREE: 12, FSEG_NOT_FULL: 12 + FLB, FSEG_FULL: 12 + 2 * FLB,
  FSEG_MAGIC_N: 12 + 3 * FLB, FSEG_FRAG_ARR: 16 + 3 * FLB };
const INODE_SIZE = 16 + 3 * FLB + FRAG_SLOTS * 4;
const MAGIC = 97937874, FIL_NULL = 0xffffffff;

function checkSource() {
  const repo = srcRoot('book/ch3', ROOT);
  const rd = (f) => fs.readFileSync(path.join(repo, 'storage/innobase', f), 'utf8');
  const fsp = rd('include/fsp0fsp.h'), fspic = rd('include/fsp0fsp.ic'), types = rd('include/fsp0types.h'),
    fil = rd('include/fil0types.h'), lst = rd('include/fut0lst.h'), lstic = rd('include/fut0lst.ic');
  const need = [
    [types, '? (1048576 / UNIV_PAGE_SIZE)'], [fil, 'constexpr uint32_t FIL_PAGE_DATA = 38;'], [fil, 'constexpr size_t FIL_ADDR_SIZE = 6;'],
    [fil, 'constexpr size_t FIL_ADDR_PAGE = 0;'], [fil, 'constexpr size_t FIL_ADDR_BYTE = 4;'],
    [lst, 'constexpr ulint FLST_BASE_NODE_SIZE = 4 + 2 * FIL_ADDR_SIZE;'], [lst, 'constexpr ulint FLST_NODE_SIZE = 2 * FIL_ADDR_SIZE;'],
    [lstic, 'constexpr uint32_t FLST_LEN = 0;'], [lstic, 'constexpr uint32_t FLST_FIRST = 4;'], [lstic, 'constexpr uint32_t FLST_LAST = 4 + FIL_ADDR_SIZE;'],
    [fsp, 'constexpr uint32_t FSP_HEADER_OFFSET = FIL_PAGE_DATA;'],
    [fsp, 'constexpr uint32_t FSP_SPACE_ID = 0;'], [fsp, 'constexpr uint32_t FSP_NOT_USED = 4;'], [fsp, 'constexpr uint32_t FSP_SIZE = 8;'],
    [fsp, 'constexpr uint32_t FSP_FREE_LIMIT = 12;'], [fsp, 'constexpr uint32_t FSP_SPACE_FLAGS = 16;'], [fsp, 'constexpr uint32_t FSP_FRAG_N_USED = 20;'],
    [fsp, 'constexpr uint32_t FSP_FREE = 24;'], [fsp, 'constexpr uint32_t FSP_FREE_FRAG = 24 + FLST_BASE_NODE_SIZE;'],
    [fsp, 'constexpr uint32_t FSP_FULL_FRAG = 24 + 2 * FLST_BASE_NODE_SIZE;'], [fsp, 'constexpr uint32_t FSP_SEG_ID = 24 + 3 * FLST_BASE_NODE_SIZE;'],
    [fsp, 'constexpr uint32_t FSP_SEG_INODES_FULL = 32 + 3 * FLST_BASE_NODE_SIZE;'], [fsp, 'constexpr uint32_t FSP_SEG_INODES_FREE = 32 + 4 * FLST_BASE_NODE_SIZE;'],
    [fsp, 'constexpr uint32_t FSP_HEADER_SIZE = 32 + 5 * FLST_BASE_NODE_SIZE;'], [fsp, 'constexpr uint32_t XDES_ARR_OFFSET = FSP_HEADER_OFFSET + FSP_HEADER_SIZE;'],
    [fsp, 'constexpr uint32_t XDES_ID = 0;'], [fsp, 'constexpr uint32_t XDES_FLST_NODE = 8;'], [fsp, 'constexpr uint32_t XDES_STATE = FLST_NODE_SIZE + 8;'],
    [fsp, 'constexpr uint32_t XDES_BITMAP = FLST_NODE_SIZE + 12;'], [fsp, 'constexpr uint32_t XDES_BITS_PER_PAGE = 2;'], [fsp, 'constexpr uint32_t XDES_FREE_BIT = 0;'],
    [fsp, '(XDES_BITMAP + UT_BITS_IN_BYTES(FSP_EXTENT_SIZE * XDES_BITS_PER_PAGE))'], [fspic, 'ulint index = bit + XDES_BITS_PER_PAGE * offset;'],
    ...Object.entries(XST).map(([v, n]) => [fsp, `${n} = ${v}`]),
    [fsp, 'constexpr uint32_t FSEG_ARR_OFFSET = FSEG_PAGE_DATA + FLST_NODE_SIZE;'], [fsp, 'constexpr uint32_t FSEG_ID = 0;'],
    [fsp, 'constexpr uint32_t FSEG_NOT_FULL_N_USED = 8;'], [fsp, 'constexpr uint32_t FSEG_FREE = 12;'],
    [fsp, 'constexpr uint32_t FSEG_NOT_FULL = 12 + FLST_BASE_NODE_SIZE;'], [fsp, 'constexpr uint32_t FSEG_FULL = 12 + 2 * FLST_BASE_NODE_SIZE;'],
    [fsp, 'constexpr uint32_t FSEG_MAGIC_N = 12 + 3 * FLST_BASE_NODE_SIZE;'], [fsp, 'constexpr uint32_t FSEG_FRAG_ARR = 16 + 3 * FLST_BASE_NODE_SIZE;'],
    [fsp, '#define FSEG_FRAG_ARR_N_SLOTS (FSP_EXTENT_SIZE / 2)'], [fsp, 'constexpr uint32_t FSEG_FRAG_SLOT_SIZE = 4;'],
    [fsp, '(16 + 3 * FLST_BASE_NODE_SIZE + FSEG_FRAG_ARR_N_SLOTS * FSEG_FRAG_SLOT_SIZE)'], [fsp, `constexpr uint32_t FSEG_MAGIC_N_VALUE = ${MAGIC};`],
  ];
  const miss = need.filter(([t, s]) => !t.includes(s)).map(([, s]) => s);
  if (miss.length) { console.error('소스와 다른 정의 :\n  ' + miss.join('\n  ')); process.exit(1); }
  return need.length;
}

const be = (b, o, w) => { let v = 0n; for (let i = 0; i < w; i++) v = (v << 8n) | BigInt(b[o + i]); return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString(); };
const addr = (b, o) => { const page = be(b, o, 4); return page === FIL_NULL ? null : { page, byte: be(b, o + 4, 2) }; };
const base = (b, o) => ({ len: be(b, o, 4), first: addr(b, o + 4), last: addr(b, o + 4 + FIL_ADDR_SIZE) });

/* page 0 : FSP header 와 그 뒤의 XDES 배열 — 파일 크기만큼의 extent 만 본다 */
function decodeP0(b) {
  const h = FIL_PAGE_DATA, f = {};
  for (const [n, [o, w]] of Object.entries(FSP)) f[n] = be(b, h + o, w);
  for (const [n, o] of Object.entries(FSPL)) f[n] = base(b, h + o);
  f.xdes = [];
  for (let e = 0; XDES_ARR + (e + 1) * XDES_SIZE <= b.length; e++) {
    const o = XDES_ARR + e * XDES_SIZE, state = be(b, o + XDES_STATE, 4), used = [];
    if (state) for (let p = 0; p < EXTENT; p++) {
      const i = p * 2;                                            /* XDES_FREE_BIT 의 자리 — 1 이면 빈 page */
      if (!((b[o + XDES_BITMAP + (i >> 3)] >> (i & 7)) & 1)) used.push(e * EXTENT + p);
    }
    f.xdes.push({ at: o, XDES_ID: be(b, o, 8), XDES_STATE: XST[state], used });
  }
  return f;
}
/* page 2 : inode 배열 — FSEG_ID 가 0 이면 빈 칸이다 */
function decodeP2(b) {
  const out = [];
  for (let k = 0; FSEG_ARR + (k + 1) * INODE_SIZE <= b.length; k++) {
    const o = FSEG_ARR + k * INODE_SIZE, id = be(b, o + INODE.FSEG_ID, 8);
    if (!id) continue;
    const frag = [];
    for (let s = 0; s < FRAG_SLOTS; s++) { const p = be(b, o + INODE.FSEG_FRAG_ARR + s * 4, 4); if (p !== FIL_NULL) frag.push(p); }
    out.push({ at: o, FSEG_ID: id, FSEG_NOT_FULL_N_USED: be(b, o + INODE.FSEG_NOT_FULL_N_USED, 4),
      FSEG_FREE: base(b, o + INODE.FSEG_FREE), FSEG_NOT_FULL: base(b, o + INODE.FSEG_NOT_FULL), FSEG_FULL: base(b, o + INODE.FSEG_FULL),
      FSEG_MAGIC_N: be(b, o + INODE.FSEG_MAGIC_N, 4), frag });
  }
  return out;
}
/* root page 의 앞 94 B 중 이 장면이 쓰는 셋 — 오프셋은 ibdpage.js 가 소스와 맞춘 PAGE_* 와 같다 */
function decodeRoot(b) {
  return { FIL_PAGE_OFFSET: be(b, 4, 4), PAGE_N_RECS: be(b, 38 + 16, 2), PAGE_LEVEL: be(b, 38 + 26, 2), PAGE_INDEX_ID: be(b, 38 + 28, 8) };
}
const hex = (b) => Buffer.from(b).toString('hex');
const unhex = (h) => Uint8Array.from(Buffer.from(h, 'hex'));

/* 저장된 값이 스스로 맞는지 — 측정이 바뀌어도 성립해야 하는 관계만 본다 */
function invariants(name, f0, ino, roots = {}) {
  const bad = [];
  /* index 마다 : root 가 든 segment 가 TOP, 그다음 id 가 LEAF(btr_create 가 TOP 을 먼저 만든다).
     root 가 level 1 이면 leaf page 수 = root 의 node pointer 수, level 0 이면 LEAF 는 비어 있다 */
  for (const [no, r] of Object.entries(roots)) {
    const top = ino.find((i) => i.frag.includes(Number(no))), leaf = top && ino.find((i) => i.FSEG_ID === top.FSEG_ID + 1);
    if (!leaf) { bad.push(`${name} : root ${no} 의 segment 를 찾지 못했다`); continue; }
    const n = leaf.frag.length + leaf.FSEG_NOT_FULL_N_USED + leaf.FSEG_FULL.len * EXTENT;
    const want = r.f.PAGE_LEVEL === 1 ? r.f.PAGE_N_RECS : r.f.PAGE_LEVEL === 0 ? 0 : null;
    if (want !== null && n !== want) bad.push(`${name} : root ${no} 아래 leaf ${n} 장 ≠ ${want}`);
  }
  const fragUsed = f0.xdes.filter((x) => x.XDES_STATE === 'XDES_FREE_FRAG').reduce((a, x) => a + x.used.length, 0);
  if (fragUsed !== f0.FSP_FRAG_N_USED) bad.push(`${name} : FREE_FRAG extent 의 사용 page ${fragUsed} ≠ FSP_FRAG_N_USED ${f0.FSP_FRAG_N_USED}`);
  for (const i of ino) {
    if (i.FSEG_MAGIC_N !== MAGIC) bad.push(`${name} : inode ${i.at} 의 magic ${i.FSEG_MAGIC_N}`);
    const own = f0.xdes.filter((x) => x.XDES_STATE === 'XDES_FSEG' && x.XDES_ID === i.FSEG_ID).reduce((a, x) => a + x.used.length, 0);
    /* segment 가 extent 에서 쓴 page = NOT_FULL 의 사용 수 + 꽉 찬 extent 수 × 64 */
    if (own !== i.FSEG_NOT_FULL_N_USED + i.FSEG_FULL.len * EXTENT) bad.push(`${name} : seg ${i.FSEG_ID} 의 extent page ${own} ≠ NOT_FULL_N_USED ${i.FSEG_NOT_FULL_N_USED} + FULL ${i.FSEG_FULL.len} × ${EXTENT}`);
  }
  if (f0.FSP_SEG_ID !== Math.max(0, ...ino.map((i) => i.FSEG_ID)) + 1) bad.push(`${name} : FSP_SEG_ID ${f0.FSP_SEG_ID} 가 다음 segment id 가 아니다`);
  return bad;
}

const ARG = process.argv.slice(2);
const opt = (k) => { const a = ARG.find((x) => x.startsWith('--' + k)); return a ? (a.split('=').slice(1).join('=') || '1') : null; };
const nSrc = checkSource();

function read(file, roots = []) {
  const buf = fs.readFileSync(file);
  if (buf.length % PS) { console.error(file + ' : 크기가 ' + PS + ' 의 배수가 아니다'); process.exit(1); }
  /* page 0 의 descriptor 는 앞 page_size 개 page(16 KB 면 256 extent)만 맡는다 — 그 뒤는 16384 page 마다 오는
     XDES page 의 몫이다. 이것을 넘겨 읽으면 page 1 의 바이트를 descriptor 로 읽는다. */
  const nX = Math.min(Math.ceil(buf.length / PS / EXTENT), PS / EXTENT);
  const p0 = buf.subarray(0, XDES_ARR + nX * XDES_SIZE);
  const ino = decodeP2(buf.subarray(2 * PS, 3 * PS));
  const p2 = buf.subarray(2 * PS, 2 * PS + FSEG_ARR + (ino.length ? (ino[ino.length - 1].at - FSEG_ARR) / INODE_SIZE + 1 : 0) * INODE_SIZE);
  const rt = Object.fromEntries(roots.map((no) => { const b = buf.subarray(no * PS, no * PS + 94); return [no, { hex: hex(b), f: decodeRoot(b) }]; }));
  return { file: path.basename(file), nPages: buf.length / PS, p0: { hex: hex(p0), f: decodeP0(p0) }, p2: { hex: hex(p2), f: decodeP2(p2) }, roots: rt };
}

if (opt('check')) {
  const file = path.resolve(ARG.find((x) => !x.startsWith('--')) || opt('check'));
  const { SPACEDUMP } = await import(pathToFileURL(file).href);
  const bad = [];
  for (const [name, d] of Object.entries(SPACEDUMP.files)) {
    if (JSON.stringify(decodeP0(unhex(d.p0.hex))) !== JSON.stringify(d.p0.f)) bad.push(name + ' : page 0 의 저장된 값이 바이트와 다르다');
    if (JSON.stringify(decodeP2(unhex(d.p2.hex))) !== JSON.stringify(d.p2.f)) bad.push(name + ' : page 2 의 저장된 값이 바이트와 다르다');
    for (const [no, r] of Object.entries(d.roots || {})) {
      if (JSON.stringify(decodeRoot(unhex(r.hex))) !== JSON.stringify(r.f) || r.f.FIL_PAGE_OFFSET !== Number(no)) bad.push(name + ' : root page ' + no + ' 이 바이트와 다르다');
    }
    bad.push(...invariants(name, d.p0.f, d.p2.f, d.roots));
  }
  bad.forEach((m) => console.error('  ' + m));
  console.log(`ibdspace : 소스 정의 ${nSrc}개 대조 · 파일 ${Object.keys(SPACEDUMP.files).length}개 다시 풂 · 불일치 ${bad.length}`);
  process.exit(bad.length ? 1 : 0);
}

if (opt('js')) {
  const meta = opt('meta') ? JSON.parse(fs.readFileSync(opt('meta'), 'utf8')) : {};
  const roots = (name) => Object.values((meta[name] && meta[name].index) || {}).map((r) => r.root);
  const files = Object.fromEntries(ARG.filter((x) => !x.startsWith('--') && x.includes('=')).map((x) => [x.split('=')[0], read(x.split('=')[1], roots(x.split('=')[0]))]));
  for (const [name, d] of Object.entries(files)) {
    const bad = invariants(name, d.p0.f, d.p2.f, d.roots);
    if (bad.length) { bad.forEach((m) => console.error('  ' + m)); process.exit(1); }
  }
  console.log(`/* tools/ibdspace.js 가 실제 .ibd 에서 뜬 page 0(FSP header · XDES) 과 page 2(inode) — 손으로 고치지 않는다.
   hex 가 원본이고 f 는 그것을 푼 값이다. check.sh 가 hex 를 다시 풀어 f 와 맞춘다. */
export const SPACEDUMP = ${JSON.stringify({ meta: { pageSize: PS, ...meta }, files }, null, 1)};`);
  process.exit(0);
}

const file = ARG.find((x) => !x.startsWith('--'));
if (!file) { console.error('usage: node tools/ibdspace.js <a.ibd> | --js --meta=<file> name=<a.ibd> ... | --check <spacedump.js>'); process.exit(2); }
const d = read(file), f = d.p0.f;
console.log(`${d.file}  ${d.nPages} page  ·  space ${f.FSP_SPACE_ID}  size ${f.FSP_SIZE}  free_limit ${f.FSP_FREE_LIMIT}  flags 0x${f.FSP_SPACE_FLAGS.toString(16)}  frag_n_used ${f.FSP_FRAG_N_USED}  seg_id ${f.FSP_SEG_ID}`);
for (const n of Object.keys(FSPL)) console.log(`  ${n.padEnd(20)} len ${f[n].len}  first ${f[n].first ? f[n].first.page + ':' + f[n].first.byte : '—'}`);
for (const x of f.xdes) console.log(`  xdes @${x.at}  extent ${(x.at - XDES_ARR) / XDES_SIZE}  seg ${x.XDES_ID}  ${x.XDES_STATE}  used ${x.used.length}`);
for (const i of d.p2.f) console.log(`  inode @${i.at}  seg ${i.FSEG_ID}  frag ${i.frag.length} [${i.frag.join(',')}]  not_full ${i.FSEG_NOT_FULL.len} (used ${i.FSEG_NOT_FULL_N_USED})  full ${i.FSEG_FULL.len}  free ${i.FSEG_FREE.len}`);
