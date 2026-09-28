/* MongoDB 편 첫 덱 — 저장 엔진 WiredTiger 가 문서 한 건의 갱신을 어떻게 다루는가.
   InnoDB 는 행을 제자리에서 고치고 옛 값을 undo 로 뺀다. WiredTiger 는 디스크 이미지를
   그대로 두고 새 값을 메모리의 사슬 앞에 붙인다 — 그 한 가지가 이 덱의 장면을 만든다.
   근거 등급 :
     · 화면에 뜨는 발췌는 WiredTiger 11.3(GPLv2/v3) 코드다 — MongoDB 8.0.32 에 들어 있는 판.
     · MongoDB 서버 코드(SSPL)는 fact 로 대조만 하고 발췌로 띄우지 않는다(verify 가 막는다). */
const DECK = {
  title: 'MongoDB WiredTiger',
  brand: 'MONGODB 8.0.32',
  brand2: 'WIREDTIGER 11.3  ·  vs INNODB',
  favicon: '🍃',
};

export { DECK };
