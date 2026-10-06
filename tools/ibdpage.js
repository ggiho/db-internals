/* .ibd 를 페이지 단위로 읽어 FIL 헤더와 INDEX 페이지 헤더를 푼다.
   book/ch3 06b 가 무대에 띄우는 값은 이 도구가 실제 파일에서 뜬 것이다 — 설명용 예시가 아니다.

   오프셋은 여기 손으로 적되, 쓰기 전에 소스 트리의 정의와 글자 단위로 맞춰 본다.
   오프셋 하나를 잘못 적으면 "실측" 이 틀린 자리를 정확하게 잰다 — 그래서 어긋나면 멈춘다.

     node tools/ibdpage.js <t.ibd>                       페이지 목록 + INDEX 헤더 표
     node tools/ibdpage.js <t.ibd> --js --meta=<file>    덱이 읽는 모듈을 stdout 으로 (meta 는 측정 기록 JSON)
     node tools/ibdpage.js --check <pagedump.js>         저장된 바이트를 다시 풀어 저장된 값과 맞춘다
                                                         (.ibd 없이 돈다 — check.sh 가 부른다) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { srcRoot } from './srcroot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PS = 16384;      /* innodb_page_size 기본값 — 다른 크기의 파일이면 page 1 의 번호가 어긋나 멈춘다 */
const HEAD = 94;       /* FIL 38 + PAGE 36 + FSEG 20 — PAGE_DATA 까지 */
const SUPREMUM_END = HEAD + 2 * 5 + 8 + 8;   /* PAGE_NEW_SUPREMUM_END = 120 — 아래 식 셋을 따라간다 */

/* [이름, 시작, 폭] — FIL 헤더는 페이지 처음부터, PAGE_* 는 PAGE_HEADER(38) 부터 센다 */
const FIL = [
  ['FIL_PAGE_OFFSET', 4, 4], ['FIL_PAGE_PREV', 8, 4], ['FIL_PAGE_NEXT', 12, 4],
  ['FIL_PAGE_LSN', 16, 8], ['FIL_PAGE_TYPE', 24, 2], ['FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID', 34, 4]];
const PAGE = [
  ['PAGE_N_DIR_SLOTS', 0, 2], ['PAGE_HEAP_TOP', 2, 2], ['PAGE_N_HEAP', 4, 2], ['PAGE_FREE', 6, 2],
  ['PAGE_GARBAGE', 8, 2], ['PAGE_LAST_INSERT', 10, 2], ['PAGE_DIRECTION', 12, 2],
  ['PAGE_N_DIRECTION', 14, 2], ['PAGE_N_RECS', 16, 2], ['PAGE_MAX_TRX_ID', 18, 8],
  ['PAGE_LEVEL', 26, 2], ['PAGE_INDEX_ID', 28, 8]];
const FSEG = [['PAGE_BTR_SEG_LEAF', 36], ['PAGE_BTR_SEG_TOP', 46]];
const DIRS = { 1: 'PAGE_LEFT', 2: 'PAGE_RIGHT', 3: 'PAGE_SAME_REC', 4: 'PAGE_SAME_PAGE', 5: 'PAGE_NO_DIRECTION' };
/* B-tree 페이지는 둘이다 — SDI(사전 정보)도 같은 헤더를 쓰는 B-tree 다 */
const TYPES = { 17855: 'FIL_PAGE_INDEX', 17853: 'FIL_PAGE_SDI', 3: 'FIL_PAGE_INODE', 5: 'FIL_PAGE_IBUF_BITMAP', 8: 'FIL_PAGE_TYPE_FSP_HDR', 0: 'FIL_PAGE_TYPE_ALLOCATED' };
const BTREE = new Set([17855, 17853]);

/* 위 표가 소스와 같은지 — 정의 문자열이 그대로 있어야 한다 */
function checkSource() {
  const repo = srcRoot('book/ch3', ROOT);
  const read = (f) => fs.readFileSync(path.join(repo, 'storage/innobase/include', f), 'utf8');
  const fil = read('fil0types.h'), pg = read('page0types.h'), fsp = read('fsp0types.h'), fl = read('fil0fil.h');
  const rec = fs.readFileSync(path.join(repo, 'storage/innobase/rem/rec.h'), 'utf8');
  const need = [
    [fil, 'constexpr uint32_t FIL_PAGE_DATA = 38;'],
    [fsp, 'constexpr uint32_t FSEG_PAGE_DATA = FIL_PAGE_DATA;'],
    [pg, 'constexpr uint32_t PAGE_HEADER = FSEG_PAGE_DATA;'],
    [pg, 'constexpr uint32_t PAGE_BTR_SEG_TOP = 36 + FSEG_HEADER_SIZE;'],
    [fsp, 'constexpr uint32_t FSEG_HEADER_SIZE = 10;'],
    [fsp, 'constexpr uint32_t FSEG_HDR_SPACE = 0;'],
    [fsp, 'constexpr uint32_t FSEG_HDR_PAGE_NO = 4;'],
    [fsp, 'constexpr uint32_t FSEG_HDR_OFFSET = 8;'],
    ...Object.entries(TYPES).map(([v, n]) => [fl, `constexpr page_type_t ${n} = ${v};`]),
    ...FIL.map(([n, o]) => [fil, `constexpr uint32_t ${n} = ${o};`]),
    ...PAGE.map(([n, o]) => [pg, `constexpr uint32_t ${n} = ${o};`]),
    [pg, 'constexpr uint32_t PAGE_BTR_SEG_LEAF = 36;'],
    [pg, 'constexpr uint32_t PAGE_DATA = PAGE_HEADER + 36 + 2 * FSEG_HEADER_SIZE;'],
    [pg, '#define PAGE_NEW_SUPREMUM (PAGE_DATA + 2 * REC_N_NEW_EXTRA_BYTES + 8)'],
    [pg, '#define PAGE_NEW_SUPREMUM_END (PAGE_NEW_SUPREMUM + 8)'],
    [rec, 'constexpr int32_t REC_N_NEW_EXTRA_BYTES = 5;'],
    ...Object.entries(DIRS).map(([v, n]) => [pg, `${n} = ${v}`]),
  ];
  const miss = need.filter(([t, s]) => !t.includes(s)).map(([, s]) => s);
  if (miss.length) { console.error('소스와 다른 오프셋 :\n  ' + miss.join('\n  ')); process.exit(1); }
  return need.length;
}

const be = (b, o, w) => { let v = 0n; for (let i = 0; i < w; i++) v = (v << 8n) | BigInt(b[o + i]); return v; };
const num = (v) => (v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString());

/* 94 바이트 하나를 푼다 — 값은 소스의 이름을 키로 쓴다 */
function decode(b) {
  const f = {};
  for (const [n, o, w] of FIL) f[n] = num(be(b, o, w));
  if (!BTREE.has(f.FIL_PAGE_TYPE)) return f;
  for (const [n, o, w] of PAGE) f[n] = num(be(b, 38 + o, w));
  for (const [n, o] of FSEG) {
    const a = 38 + o;
    f[n] = { space: num(be(b, a, 4)), page: num(be(b, a + 4, 4)), offset: num(be(b, a + 8, 2)) };
  }
  return f;
}

const hex = (b) => Buffer.from(b).toString('hex');
const unhex = (h) => Uint8Array.from(Buffer.from(h, 'hex'));

const ARG = process.argv.slice(2);
const opt = (k) => { const a = ARG.find((x) => x.startsWith('--' + k)); return a ? (a.split('=').slice(1).join('=') || '1') : null; };
const nSrc = checkSource();

if (opt('check')) {
  const file = path.resolve(ARG.find((x) => !x.startsWith('--')) || opt('check'));
  const { PAGEDUMP } = await import(pathToFileURL(file).href);
  let bad = 0;
  for (const [no, p] of Object.entries(PAGEDUMP.pages)) {
    const again = JSON.stringify(decode(unhex(p.hex)));
    if (again !== JSON.stringify(p.f)) { bad++; console.error('  page ' + no + ' : 저장된 값이 바이트와 다르다'); }
    if (p.f.FIL_PAGE_OFFSET !== Number(no)) { bad++; console.error('  page ' + no + ' : FIL_PAGE_OFFSET 이 ' + p.f.FIL_PAGE_OFFSET); }
    /* 버퍼 풀이 본 값(I_S)과도 맞춘다 — DATA_SIZE 는 헤더 필드 셋으로 계산되는 값이다(i_s.cc) */
    const bp = (PAGEDUMP.meta.bufpage || {})[no];
    if (bp && (bp.recs !== p.f.PAGE_N_RECS || bp.data !== p.f.PAGE_HEAP_TOP - SUPREMUM_END - p.f.PAGE_GARBAGE)) {
      bad++; console.error('  page ' + no + ' : I_S.INNODB_BUFFER_PAGE 의 값과 헤더가 맞지 않는다');
    }
  }
  const nbp = Object.keys(PAGEDUMP.meta.bufpage || {}).length;
  console.log(`ibdpage : 소스 정의 ${nSrc}개 대조 · 페이지 ${Object.keys(PAGEDUMP.pages).length}장 다시 풂 · I_S 대조 ${nbp}장 · 불일치 ${bad}`);
  process.exit(bad ? 1 : 0);
}

const file = ARG.find((x) => !x.startsWith('--'));
if (!file) { console.error('usage: node tools/ibdpage.js <t.ibd> [--js --meta=<file>] | --check <pagedump.js>'); process.exit(2); }
const buf = fs.readFileSync(file);
if (buf.length % PS) { console.error('파일 크기가 ' + PS + ' 의 배수가 아니다'); process.exit(1); }
const pages = {}, kinds = [];
for (let no = 0; no < buf.length / PS; no++) {
  const b = buf.subarray(no * PS, no * PS + HEAD);
  const f = decode(b);
  if (f.FIL_PAGE_OFFSET !== no && f.FIL_PAGE_TYPE !== 0) { console.error('page ' + no + ' 의 FIL_PAGE_OFFSET 이 ' + f.FIL_PAGE_OFFSET + ' — 페이지 크기가 다르다'); process.exit(1); }
  kinds.push(no + ':' + (TYPES[f.FIL_PAGE_TYPE] || f.FIL_PAGE_TYPE).replace(/^FIL_PAGE_(TYPE_)?/, ''));
  if (BTREE.has(f.FIL_PAGE_TYPE)) pages[no] = { hex: hex(b), f };
}

if (opt('js')) {
  const meta = opt('meta') ? JSON.parse(fs.readFileSync(opt('meta'), 'utf8')) : {};
  console.log(`/* tools/ibdpage.js 가 실제 .ibd 에서 뜬 B-tree 페이지(INDEX · SDI)의 앞 ${HEAD}바이트 — 손으로 고치지 않는다.
   hex 가 원본이고 f 는 그것을 푼 값이다. check.sh 가 hex 를 다시 풀어 f 와 맞춘다. */
export const PAGEDUMP = ${JSON.stringify({ meta: { file: path.basename(file), pageSize: PS, nPages: buf.length / PS, ...meta }, pages }, null, 1)};`);
  process.exit(0);
}

console.log('페이지 종류  ' + kinds.join('  '));
const cols = ['no', 'lvl', 'idx', 'recs', 'heap', 'slots', 'top', 'free', 'garb', 'last', 'dir', 'ndir', 'maxtrx', 'prev', 'next', 'seg leaf', 'seg top'];
console.log(cols.join('\t'));
const nul = (v) => (v === 0xffffffff ? '—' : v);
for (const [no, { f }] of Object.entries(pages)) {
  const h = f.PAGE_N_HEAP;
  const seg = (s) => (s.space || s.page || s.offset ? `${s.space}:${s.page}:${s.offset}` : '0');
  console.log([no, f.PAGE_LEVEL, f.PAGE_INDEX_ID, f.PAGE_N_RECS, `${h & 0x7fff}${h & 0x8000 ? 'c' : ''}`, f.PAGE_N_DIR_SLOTS,
    f.PAGE_HEAP_TOP, f.PAGE_FREE, f.PAGE_GARBAGE, f.PAGE_LAST_INSERT, (DIRS[f.PAGE_DIRECTION] || f.PAGE_DIRECTION).replace('PAGE_', ''),
    f.PAGE_N_DIRECTION, f.PAGE_MAX_TRX_ID, nul(f.FIL_PAGE_PREV), nul(f.FIL_PAGE_NEXT), seg(f.PAGE_BTR_SEG_LEAF), seg(f.PAGE_BTR_SEG_TOP)].join('\t'));
}
