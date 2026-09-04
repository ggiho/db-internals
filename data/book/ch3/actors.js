/* 3장의 배우 — 바이트에서 시작해 셀, 페이지, 파일로 올라간다.
   lane 이 그 계층을 그대로 따른다. */
const ACTORS = {
  /* ── 값 : 원시 타입에서 셀까지 ── */
  op:   { nm:'OPERATION',        lane:'val',  kind:'kv', w:'w2' },
  val:  { nm:'VALUE',            lane:'val',  kind:'bytes', w:'w2' },
  rec:  { nm:'CELL  (RECORD)',   lane:'val',  kind:'bytes', w:'w2' },
  bits: { nm:'FLAGS  (BITS)',    lane:'val',  kind:'list', w:'w15' },

  /* ── 페이지 : 슬롯 배치 ── */
  pg:   { nm:'PAGE  (16KB)',     lane:'page', kind:'bytes', w:'w2' },
  dir:  { nm:'SLOT DIRECTORY',   lane:'page', kind:'list', w:'w15' },
  cells:{ nm:'CELLS',            lane:'page', kind:'list', w:'w15' },
  freeL:{ nm:'FREE LIST',        lane:'page', kind:'list', w:'w15' },
  hdr:  { nm:'PAGE HEADER',      lane:'page', kind:'kv', w:'w15' },

  /* ── 파일 : 헤더 · 페이지 · 트레일러 ── */
  fil:  { nm:'FIL 헤더 (38B)',      lane:'page', kind:'bytes', w:'wide' },
  fld:  { nm:'이 필드',             lane:'page', kind:'kv', w:'w15' },
  phd:  { nm:'PAGE 헤더 (36B)',     lane:'page', kind:'bytes', w:'wide' },
  addr: { nm:'주소 산술',            lane:'page', kind:'kv', w:'w15' },
  flds: { nm:'2B 필드 아홉 개',        lane:'page', kind:'list', w:'w2' },
  rhd:  { nm:'원점 앞  ·  extra 5B',  lane:'val',  kind:'bytes', w:'w2' },
  rdat: { nm:'원점 뒤  ·  데이터',      lane:'val',  kind:'bytes', w:'w2' },
  bit5: { nm:'5바이트 안의 다섯 값',    lane:'val',  kind:'list', w:'w2' },
  file: { nm:'FILE  (.ibd)',     lane:'file', kind:'bytes', w:'w2' },
  sum:  { nm:'CHECKSUM',         lane:'file', kind:'kv', w:'w15' },
  ver:  { nm:'VERSION',          lane:'file', kind:'kv' },
};
const LANES = [
  { id:'val',  lb:'값 · 셀',  note:'바이트로 직렬화' },
  { id:'page', lb:'페이지',   note:'슬롯 배치' },
  { id:'file', lb:'파일',     note:'헤더 · 페이지 · 트레일러' },
];
const EDGES = [
  { after:'val',  lb:'셀 → 페이지', hot:'cell' },
  { after:'page', lb:'페이지 → 파일', hot:'file' },
];

export { ACTORS, LANES, EDGES };
