/* Aurora MySQL — 무엇을 InnoDB 에서 떼어냈나.
   Aurora 는 닫힌 소스다. 그래서 이 덱은 근거 등급이 둘로 나뉜다 :
     · Aurora 쪽 주장 → AWS 공식 문서 인용(cite). "문서가 이렇게 말한다" 까지 보증한다.
     · InnoDB 쪽 주장 → MySQL 8.4.8 소스 대조(fact). 다른 덱과 같은 등급이다.
   quorum 수(6중 복제·4/6 쓰기)나 10GB 세그먼트 같은 값은 SIGMOD 논문 소관이고
   문서에서 확인하지 못했으므로 이 덱은 주장하지 않는다. */
const DECK = {
  title: 'Aurora MySQL 아키텍처',
  brand: 'AURORA MYSQL',
  brand2: '문서 인용  ·  vs INNODB 8.4.8',
  favicon: '☁️',
};

export { DECK };
