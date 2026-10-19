/* aurora mysql — 덱의 모든 장면을 이 모듈이 맡는다. 그리는 것은 모두 장면의 bake 상태에서 읽는다(손으로 적은 값이 없다).
   05 처럼 kv 키가 'quorum' 으로 끝나는(쓰기 quorum · 읽기 quorum) 장면은 aurora-05(AZ 칸 · 표 막대)를 그대로 부른다. 나머지는 데이터의 모양으로 역할을 고른다 —
     · 근거(01) — list 가 없고, 키에 괄호로 출처를 적은 kv('cite (문서)' · 'fact (소스)')가 있으면. 괄호 속 이름마다 말뭉치 더미 하나.
       값에 수가 있으면(말뭉치 26문장) 그 수만큼 문장 띠, 없으면 문서 · 코드 모양. 값이 '—' 가 아니면 대조된 더미(초록).
       다른 kv 의 주장은 값이 그 이름(문서 · 논문 · 소스)을 부르는 더미 아래에 놓고 선으로 잇는다
     · compute 층 — '역할' 을 가진 kv 는 WRITER 인스턴스, 항목이 처음부터 끝까지 같은 list 는 리더 인스턴스들(설명에 buffer pool ·
       캐시가 있으면 상자 안에 page 칸). '사는 곳' 을 가진 kv 는 page cache — 값에 '별개' 가 있으면 DB 인스턴스 밖의 상자로 나가고,
       '재시작 후' 가 '비어 …' 면 빈 칸, '따뜻 …' 하면 찬 칸. 나머지 compute kv 는 글 블록
     · 'CPL · VCL · VDL' 을 가진 kv = LSN 자. 값의 수가 자 위의 자리다(선형). compute kv 의 'commit LSN' 도 자 위에, LAL 은 자 밖(→)
     · 항목 id 에 'commit LSN N' 이 있는 list = 커밋 대기열
     · compute 의 나머지 list = 네트워크 쓰기. 항목마다 record 줄기가 경계를 건넌다. 설명의 'A → B → …' 는 목적지 —
       끝 마디가 수사로 시작하면(여섯 storage 노드) PG 의 노드가 그만큼, 아니면 이름 붙은 사슬(EBS → 미러 → standby → 미러)
     · storage 의 list 중 id 가 단계 번호로 시작하는 것(1 받기 · 2 쓰고 ack · 5 ~ 8 배경) = storage 노드의 단계 칸, 번호 없는 항목은 page
     · 나머지 storage list = 클러스터 볼륨 : id 가 AZ-x 면 AZ 칸과 복사본(05 와 같은 모양), LSN 자가 있는 장면이면 자에 맞춘 log 띠
       (설명의 '‥ N 빠짐없이' · '‥ M durable'), 아니면 볼륨 판 하나(설명에 'N 중 M' 이 있으면 세그먼트 N 개 중 M 개를 밝힌다).
       tag x 인 항목은 잘라낸 구간 — 'A ‥ B' 의 두 끝 이름을 눈금에 적는다
     · storage 의 나머지 kv 는 아래 글 블록. 두 키의 값이 같은 이름의 수를 가지면(트랜잭션당 I/O 7.4 · 0.95) 그 옆에 막대
   셈 맞추기는 audit() 가 한다 — make 가 console.error 로 낸다(storysweep 의 errors 가 잡는다). 무엇을 보는지는 audit 의 주석에.
   움직임은 p 0.52 안에 끝낸다(서는 자리 0.58 = 끝 상태). 포인터에 반응하지 않는다. */
import { INK, GOLD, RED, GREEN, ACCENT, FAINT, U } from '../field.js';
import { bake, stepsOf } from '../../bake.js';
import { stagger } from './stagger.js';
import quorum from './aurora-05.js';

const bare = (v) => String(v ?? '').replace(/\|(gold|red|green)$/, '');
const tone = (v) => (/\|(gold|red|green)$/.exec(String(v ?? '')) || [])[1] || '';
const span = { gold: 'q-g', red: 'q-r', green: 'q-gr' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const val = (v) => (tone(v) ? `<span class="${span[tone(v)]}">${esc(bare(v))}</span>` : esc(bare(v)));
const TAGC = { clean: INK, x: RED, red: RED, dirty: GOLD, gold: GOLD, hold: GOLD, pin: GOLD, free: FAINT, ok: GREEN, green: GREEN, wait: ACCENT };
/* 글 속의 수사 — '여섯 storage 노드' · '네 곳에' · '넷을 기다린다' · 'three Availability Zones'. 앞은 한글이 아니고, 뒤는 빈칸 · 조사 · 끝 */
const KN = { 하나: 1, 한: 1, 둘: 2, 두: 2, 셋: 3, 세: 3, 넷: 4, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, two: 2, three: 3, six: 6 };
const KW = Object.keys(KN).sort((a, b) => b.length - a.length).join('|');
const knums = (s) => { const re = new RegExp(`(?:^|[^가-힣A-Za-z])(${KW})(?=[\\s을를이가에은는개]|$)`, 'g'), out = []; let m; while ((m = re.exec(String(s ?? '')))) out.push(KN[m[1]]); return out; };
const knumBefore = (s, word) => { const m = new RegExp(`(?:^|[^가-힣])(${KW})\\s*${word}`).exec(String(s ?? '')); return m ? KN[m[1]] : null; };
const nums = (s) => (bare(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => +x.replace(/,/g, ''));
const zoneOf = (id) => (/^(AZ-[a-z])\b/.exec(id) || [])[1] || null;
const isHold = (it) => it.tag === 'free' && /^\(.*\)$/.test(it.id);
const PAREN = /^(.*?)\s*\(([^)]+)\)$/;
/* 단계 번호 — '1 받기 · 2 쓰고 ack' → 1 · 2, '5 ~ 8 배경' → 5 ‥ 8 */
const stagesOf = (id) => {
  const r = /^(\d+)\s*~\s*(\d+)\s/.exec(id);
  if (r) return Array.from({ length: +r[2] - +r[1] + 1 }, (_, i) => +r[1] + i);
  return [...String(id).matchAll(/(?:^|·\s*)(\d+)\s/g)].map((m) => +m[1]);
};
/* 'A ‥ B' 의 두 끝 이름 — '새 VDL 뒤 ‥ VDL + LAL 까지 무효' → 새 VDL · VDL + LAL */
const rangeNames = (sub) => {
  const m = /^(.*?)\s*‥\s*(.*)$/.exec(String(sub || ''));
  if (!m) return null;
  const a = m[1].replace(/\s*뒤$/, '').trim(), b = m[2].split(/\s+까지|\s+·/)[0].trim();
  return a && b ? [a, b] : null;
};
const quorumScene = (deck, sc) => !!sc && (sc.cast || []).some((a) => deck.ACTORS[a] && deck.ACTORS[a].kind === 'kv'
  && Object.keys((sc.init[a] && sc.init[a].kv) || {}).some((k) => /\squorum$/.test(k)));

export default {
  count: (narrow, deck, sc) => (deck && sc && quorumScene(deck, sc) ? quorum.count(narrow) : narrow ? 3600 : 5200),
  make: (o) => (quorumScene(o.deck, o.scene()) ? quorum.make(o) : make(o)),
};

/* ── 상태와 역할 — audit 과 make 가 같이 쓴다 ── */
function stateOf(deck, sc) {
  const A = deck.ACTORS, cast = sc.cast.filter((a) => A[a]);
  const frames = bake(sc, null), steps = stepsOf(sc, null);
  const read = (st, step, chg, touch) => {
    const s = { step: step || {}, touch: touch || new Set(), chg: chg || {}, look: (step && step.look) || {} };
    for (const a of cast) {
      if (A[a].kind === 'kv') s[a] = (st[a] && st[a].kv) || {};
      else s[a] = ((st[a] && st[a].items) || []).map((it) => ({ ...it, id: String(it.id), tag: it.tag || 'clean', sub: it.sub || '' }));
    }
    return s;
  };
  const S0 = read(sc.init), S = frames.map((fr, i) => read(fr.st, steps[i], fr.chg, fr.touch));
  return { A, cast, S0, S, NK: S.length, steps };
}
function rolesOf(A, cast, all) {
  const lane = (a) => A[a].lane;
  const kv = cast.filter((a) => A[a].kind === 'kv'), li = cast.filter((a) => A[a].kind === 'list');
  const keysOf = (a) => [...new Set(all.flatMap((s) => Object.keys(s[a] || {})))];
  const paren = (a) => keysOf(a).filter((k) => PAREN.test(k)).length;
  if (!li.length && kv.some((a) => paren(a) >= 2)) {
    const CHK = kv.reduce((p, a) => (paren(a) > paren(p) ? a : p));
    return { EVID: true, CHK, GRADES: kv.filter((a) => a !== CHK) };
  }
  const LSNK = kv.find((a) => ['CPL', 'VCL', 'VDL'].filter((k) => keysOf(a).includes(k)).length >= 2) || null;
  const WRITER = kv.find((a) => a !== LSNK && lane(a) === 'comp' && keysOf(a).includes('역할')) || null;
  const CACHE = kv.find((a) => a !== LSNK && lane(a) === 'comp' && keysOf(a).includes('사는 곳')) || null;
  const OPK = kv.filter((a) => lane(a) === 'comp' && ![LSNK, WRITER, CACHE].includes(a));
  const TEXTS = kv.filter((a) => lane(a) !== 'comp' && a !== LSNK);
  const CQ = li.find((a) => all.some((s) => s[a].some((x) => /commit LSN\s*\d/.test(x.id)))) || null;
  const SN = li.find((a) => lane(a) === 'stor' && all.some((s) => s[a].some((x) => stagesOf(x.id).length))) || null;
  const VOL = li.find((a) => lane(a) === 'stor' && a !== SN) || null;
  /* 리더 — 항목이 처음부터 끝까지 같은 compute list(인스턴스는 스텝 사이에 생기고 사라지지 않는다) */
  const idl = (s, a) => s[a].map((x) => x.id).join('|');
  const READERS = li.find((a) => lane(a) === 'comp' && a !== CQ && all.every((s) => idl(s, a) === idl(all[0], a)) && all[0][a].some((x) => !isHold(x))) || null;
  const IO = li.find((a) => lane(a) === 'comp' && a !== CQ && a !== READERS) || null;
  return { EVID: false, LSNK, WRITER, CACHE, OPK, TEXTS, CQ, SN, VOL, READERS, IO };
}
/* 목적지 — 네트워크 쓰기의 설명 'A → B → …'. 끝 마디가 수사로 시작하면 PG(그 수만큼의 노드), 아니면 이름 붙은 사슬 */
function destOf(s, IO) {
  if (!IO) return null;
  const it = s[IO].find((x) => !isHold(x) && /→/.test(x.sub));
  if (!it) return null;
  const seg = it.sub.split('→').map((q) => q.trim()).filter(Boolean), last = seg[seg.length - 1], n = knums(last)[0];
  if (n && knums(last.split(/\s+/)[0])[0] === n) return { kind: 'pg', n, names: [], cap: last, from: it.id };
  return { kind: 'chain', n: seg.length, names: seg, cap: '', from: it.id };
}
/* LSN 자의 값들 — 스텝 하나 */
function lsnOf(s, R) {
  const k = s[R.LSNK] || {}, one = (key) => (bare(k[key]) === '—' ? null : nums(k[key])[0] ?? null);
  const cmtK = R.OPK.find((a) => Object.keys(s[a]).some((q) => /commit LSN/.test(q)));
  const cmtKey = cmtK && Object.keys(s[cmtK]).find((q) => /commit LSN/.test(q));
  const lal = Object.keys(k).find((q) => /LAL/.test(q));
  return { cpl: bare(k.CPL) === '—' ? [] : nums(k.CPL), ell: /^\s*…/.test(bare(k.CPL)), vcl: one('VCL'), vdl: one('VDL'),
    cmt: cmtK && bare(s[cmtK][cmtKey]) !== '—' ? nums(s[cmtK][cmtKey])[0] ?? null : null, cmtKey: cmtKey || 'commit LSN', lal, lalV: lal && bare(k[lal]) !== '—' ? bare(k[lal]) : null };
}
const logOf = (it) => {
  const c = /‥\s*(\d[\d,]*)\s*빠짐없이/.exec(it.sub || ''), d = /‥\s*(\d[\d,]*)\s*(?:까지\s*)?durable/.exec(it.sub || '');
  return { full: c ? +c[1].replace(/,/g, '') : null, dur: d ? +d[1].replace(/,/g, '') : null };
};
const rangeOf = (it) => { const m = /(\d[\d,]*)\s*‥\s*(\d[\d,]*)/.exec(it.id); return m ? [+m[1].replace(/,/g, ''), +m[2].replace(/,/g, '')] : null; };
/* 두 키가 같은 이름의 수를 가진 값 — 'MySQL 미러링 : 트랜잭션당 I/O 7.4 · 30 분에 78 만' · 'Aurora : 트랜잭션당 I/O 0.95 · 30 분에 2,738 만'.
   수의 자릿수를 함께 적어 둔다 — 반올림한 값이라 비율은 구간으로 셈한다 */
function metricsOf(kv) {
  const keys = Object.keys(kv || {});
  if (keys.length !== 2) return [];
  const seg = keys.map((k) => bare(kv[k]).split('·').map((q) => q.trim())), out = [];
  for (let i = 0; i < Math.min(seg[0].length, seg[1].length); i++) {
    const p = seg.map((sg) => /^(.*?)\s(\d[\d,]*(?:\.\d+)?)\s*(만)?$/.exec(sg[i]));
    if (!p[0] || !p[1] || p[0][1].trim() !== p[1][1].trim() || p[0][1].trim().length < 2) continue;
    out.push({ name: p[0][1].trim(), keys, v: p.map((m) => +m[2].replace(/,/g, '') * (m[3] ? 1e4 : 1)),
      half: p.map((m) => (m[3] ? 5e3 : 0.5 * 10 ** -((m[2].split('.')[1] || '').length))), txt: p.map((m) => m[2] + (m[3] ? ' ' + m[3] : '')) });
  }
  return out;
}

/* ── 셈 맞추기 — 장면 하나. 어긋나면 그 글을 돌려준다(make 가 console.error 로 낸다) ──
     근거 : '대조되는 것' 이 적은 더미 = 값이 '—' 가 아닌 출처 키들 · 주장의 값이 부르는 출처는 하나
     AZ : 복사본의 AZ 수 = 글(why · cite)이 말하는 AZ 수('three Availability Zones' · '세 개 가용 영역')
     리더 : tag 와 설명 — dirty 는 '적용', free 는 '버림'
     볼륨 : 'N 중 M' 은 M < N, 그 스텝의 why 도 같은 'N 중 M' 을 말한다 · tag x 구간의 두 끝은 VDL 과 LAL 을 부른다(04)
     네트워크 쓰기 : 'N 종류' = 그 스텝의 항목 수 · 'N 곳' = 사슬의 길이 · act 이 '여섯에 … 넷을' 이면 여섯 = PG 의 노드 수, 넷 ≤ 여섯
     storage 단계 : 번호가 겹치지 않고, 마지막 스텝에서 1 부터 빠짐없이
     막대 : note 의 'N 배' · 'N 분의 1' 이 두 값의 비(반올림 구간)와 맞는다
     LSN : CPL 은 오름차순 · VDL ≤ VCL · VDL = VCL 이하의 가장 큰 CPL · log 띠의 '‥ N 빠짐없이' = VCL, '‥ M durable' = VDL ·
           잘린 구간 'LSN a ‥ b' = (VDL, VCL] · 대기열의 commit LSN = WRITER 의 commit LSN, 설명의 'VDL v' = VDL, 부등호와 tag 가 맞는다 */
export function audit(deck, sc) {
  if (quorumScene(deck, sc)) return [];
  const st = stateOf(deck, sc), all = [st.S0, ...st.S], R = rolesOf(st.A, st.cast, all), out = [];
  const at = (i) => `aurora ${sc.num} 세계 : ${i < 0 ? 'init' : i + 1 + ' 스텝'}`;
  const text = (i) => { const p = st.steps[i] || {}; return [p.note, p.why, p.key, ...(p.cite || [])].join(' '); };
  /* 그 스텝이 그 키(kv) · 항목(list)을 직접 적었나 — 앞 스텝에서 이어진 값은 그 스텝의 글과 견주지 않는다 */
  const setHere = (i, a, key) => { const op = i >= 0 && st.steps[i].ops && st.steps[i].ops[a]; return !!op && ((op.set && key in op.set) || (op.add || []).some((x) => x.id === key)); };
  if (R.EVID) {
    const piles = Object.keys(st.S0[R.CHK]).map((k) => PAREN.exec(k)).filter(Boolean).map((m) => ({ key: m[0], g: m[1], name: m[2] }));
    const sumKey = Object.keys(st.S0[R.CHK]).find((k) => !PAREN.test(k));
    st.S.forEach((s, i) => {
      const c = s[R.CHK], set = piles.filter((p) => bare(c[p.key]) !== '—').map((p) => p.key).sort();
      if (sumKey && bare(c[sumKey]) !== '—') {
        const named = bare(c[sumKey]).split('·').map((q) => q.trim().split(/\s+/)).map((w) => {
          const hit = piles.filter((p) => w.includes(p.g) && (w.includes(p.name) || piles.filter((q) => q.g === p.g).length === 1));
          return hit.length === 1 ? hit[0].key : null;
        });
        if (named.includes(null)) out.push(`${at(i)} 의 '${sumKey}' "${bare(c[sumKey])}" 에 더미를 못 찾는 조각이 있다`);
        const ns = [...new Set(named.filter(Boolean))].sort();
        if (ns.join('|') !== set.join('|')) out.push(`${at(i)} 의 '${sumKey}' 가 ${ns.join(' · ') || '없음'} 인데 대조된 출처는 ${set.join(' · ') || '없음'}`);
      }
      for (const a of R.GRADES) for (const [k, v] of Object.entries(s[a])) {
        const hit = piles.filter((p) => bare(v).includes(p.name));
        if (hit.length > 1) out.push(`${at(i)} 의 ${a}.${k} "${bare(v)}" 가 출처를 둘 이상 부른다`);
      }
    });
    return out;
  }
  all.forEach((s, j) => {
    const i = j - 1;
    if (R.VOL) {
      const zs = new Set(s[R.VOL].map((x) => zoneOf(x.id)).filter(Boolean));
      if (zs.size && i >= 0) {
        const t = st.steps.map((_, q) => text(q)).join(' '), m = new RegExp(`(?:^|[^가-힣A-Za-z])(${KW})\\s+(?:개\\s+)?(?:가용 영역|Availability Zones)`).exec(t), want = m ? KN[m[1]] : null;
        if (want && zs.size !== want) out.push(`${at(i)} 의 복사본 AZ 가 ${zs.size} 곳인데 글은 ${want} 곳을 말한다`);
      }
      for (const it of s[R.VOL]) {
        const m = new RegExp(`(${KW})\\s*중\\s*(${KW})`).exec(it.sub);
        if (m) {
          if (KN[m[2]] >= KN[m[1]]) out.push(`${at(i)} 의 ${it.id} '${m[0]}' — 고르는 수가 전체보다 작지 않다`);
          if (setHere(i, R.VOL, it.id) && !text(i).includes(m[0])) out.push(`${at(i)} 의 ${it.id} 는 '${m[0]}' 인데 그 스텝의 글은 그렇게 말하지 않는다`);
        }
        if (it.tag === 'x' && !rangeOf(it) && /‥/.test(it.sub)) {
          const nm = rangeNames(it.sub);
          if (!nm || !/VDL/.test(nm[0]) || !/LAL/.test(nm[1])) out.push(`${at(i)} 의 ${it.id} 구간 '${it.sub}' 의 두 끝이 VDL · LAL 이 아니다`);
        }
      }
    }
    if (R.READERS) for (const it of s[R.READERS]) {
      if (it.tag === 'dirty' && !/적용/.test(it.sub)) out.push(`${at(i)} 의 ${it.id} 는 dirty(적용)인데 설명 "${it.sub}" 에 적용이 없다`);
      if (it.tag === 'free' && !/버림/.test(it.sub)) out.push(`${at(i)} 의 ${it.id} 는 free(버림)인데 설명 "${it.sub}" 에 버림이 없다`);
    }
    if (R.IO && i >= 0) {
      const its = s[R.IO].filter((x) => !isHold(x)), d = destOf(s, R.IO);
      for (const a of [...R.OPK, ...R.TEXTS]) for (const [key, v] of Object.entries(s[a])) {
        if (!setHere(i, a, key)) continue;
        const kinds = knumBefore(bare(v), '종류'), places = knumBefore(bare(v), '곳');
        if (kinds && kinds !== its.length) out.push(`${at(i)} 의 "${bare(v)}" 는 ${kinds} 종류인데 쓰기 항목은 ${its.length}`);
        if (places && (!d || d.kind !== 'chain' || d.n !== places)) out.push(`${at(i)} 의 "${bare(v)}" 는 ${places} 곳인데 목적지 사슬은 ${d ? d.n : 0}`);
      }
      const act = st.steps[i].act;
      if (act && act.f === R.IO && act.t === R.SN) {
        const [sent, wait] = knums(act.lb);
        if (!d || d.kind !== 'pg' || sent !== d.n) out.push(`${at(i)} 의 act '${act.lb}' 는 ${sent} 곳에 보내는데 PG 노드는 ${d && d.kind === 'pg' ? d.n : 0}`);
        if (!(wait > 0) || wait > sent) out.push(`${at(i)} 의 act '${act.lb}' — 기다리는 수 ${wait} 가 보낸 수 ${sent} 를 넘는다`);
      }
    }
    if (R.SN && i >= 0) {
      const seen = new Map();
      for (const it of s[R.SN]) for (const n of stagesOf(it.id)) { if (seen.has(n)) out.push(`${at(i)} 의 단계 ${n} 이 ${seen.get(n)} 와 ${it.id} 에 겹친다`); seen.set(n, it.id); }
      if (i === st.NK - 1) { const mx = Math.max(0, ...seen.keys()); for (let n = 1; n <= mx; n++) if (!seen.has(n)) out.push(`${at(i)} 의 단계 ${n} 이 빠졌다 (1 ‥ ${mx})`); }
    }
    if (i >= 0) for (const a of R.TEXTS) {
      const ms = metricsOf(s[a]);
      if (!ms.length) continue;
      const note = st.steps[i].note || '', ratio = (m) => { const big = m.v[0] > m.v[1] ? 0 : 1; return [(m.v[big] - m.half[big]) / (m.v[1 - big] + m.half[1 - big]), (m.v[big] + m.half[big]) / (m.v[1 - big] - m.half[1 - big])]; };
      for (const c of [...note.matchAll(/(\d+(?:\.\d+)?)\s*(배|분의 1)/g)]) {
        const want = +c[1], h = 0.5 * 10 ** -((c[1].split('.')[1] || '').length);
        if (!ms.some((m) => { const [lo, hi] = ratio(m); return want + h >= lo && want - h <= hi; })) out.push(`${at(i)} 의 note '${c[0]}' 가 ${a} 의 어느 두 값의 비와도 맞지 않는다 (${ms.map((m) => m.name + ' ' + m.txt.join(' / ')).join(' · ')})`);
      }
    }
    if (R.LSNK) {
      const L = lsnOf(s, R);
      for (let q = 1; q < L.cpl.length; q++) if (L.cpl[q] <= L.cpl[q - 1]) out.push(`${at(i)} 의 CPL 이 오름차순이 아니다 (${L.cpl.join(' · ')})`);
      if (L.vcl != null && L.vdl != null) {
        if (L.vdl > L.vcl) out.push(`${at(i)} 의 VDL ${L.vdl} 가 VCL ${L.vcl} 보다 크다`);
        const under = L.cpl.filter((c) => c <= L.vcl);
        if (under.length && Math.max(...under) !== L.vdl) out.push(`${at(i)} 의 VDL ${L.vdl} ≠ VCL ${L.vcl} 이하의 가장 큰 CPL ${Math.max(...under)}`);
      }
      if (R.VOL) for (const it of s[R.VOL]) {
        const g = logOf(it), r = rangeOf(it);
        if (g.full != null && L.vcl != null && g.full !== L.vcl) out.push(`${at(i)} 의 ${it.id} '‥ ${g.full} 빠짐없이' ≠ VCL ${L.vcl}`);
        if (g.dur != null && L.vdl != null && g.dur !== L.vdl) out.push(`${at(i)} 의 ${it.id} '‥ ${g.dur} durable' ≠ VDL ${L.vdl}`);
        if (r && it.tag === 'x' && L.vcl != null && L.vdl != null && (r[0] !== L.vdl + 1 || r[1] !== L.vcl)) out.push(`${at(i)} 의 잘린 구간 ${r.join(' ‥ ')} 가 (VDL ${L.vdl}, VCL ${L.vcl}] 이 아니다`);
      }
      if (R.CQ) for (const it of s[R.CQ]) {
        const m = /commit LSN\s*(\d[\d,]*)/.exec(it.id);
        if (!m) continue;
        const c = +m[1].replace(/,/g, ''), w = /VDL\s*(\d[\d,]*)\s*([<>≥≤=]+)\s*(\d[\d,]*)/.exec(it.sub);
        if (L.cmt != null && c !== L.cmt) out.push(`${at(i)} 의 대기열 ${it.id} ≠ ${L.cmtKey} ${L.cmt}`);
        if (w) {
          const v = +w[1].replace(/,/g, ''), rhs = +w[3].replace(/,/g, ''), ok = { '<': v < rhs, '≥': v >= rhs, '>': v > rhs, '≤': v <= rhs, '=': v === rhs }[w[2]];
          if (L.vdl != null && v !== L.vdl) out.push(`${at(i)} 의 ${it.id} 설명의 VDL ${v} ≠ VDL ${L.vdl}`);
          if (rhs !== c || !ok) out.push(`${at(i)} 의 ${it.id} 설명 '${w[0]}' 가 거짓이다`);
          if ((it.tag === 'ok') !== (v >= c)) out.push(`${at(i)} 의 ${it.id} tag ${it.tag} 인데 VDL ${v} ${v >= c ? '≥' : '<'} ${c}`);
        }
      }
    }
  });
  return out;
}

/* ── 이름표 도구 ── */
function kit(labels) {
  const made = [];
  const label = (cls = '') => { const el = document.createElement('div'); el.className = 'wl aq ' + cls; labels.appendChild(el); const lb = { el, cls, t: null, o: -1 }; made.push(lb); return lb; };
  const setText = (lb, s, html = false) => { if (lb.t === s) return; lb.t = s; if (html) lb.el.innerHTML = s; else lb.el.textContent = s; };
  const place = (lb, x, y, al = 'l', va = 't') => {
    const tx = al === 'c' ? '-50%' : al === 'l' ? '0%' : '-100%', ty = va === 'c' ? '-50%' : va === 'b' ? '-100%' : '0%';
    lb.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${tx}, ${ty})`;
  };
  const wrap = (lb, w) => { lb.el.classList.add('st-wrap'); lb.el.style.maxWidth = Math.max(40, Math.floor(w)) + 'px'; };
  /* 한 이름표의 모든 스텝 글 중 가장 큰 폭 · 높이 — 재는 동안 넣은 글은 되돌린다 */
  const most = (lb, TX) => {
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
  const widthOf = (lb, html) => { if (!html) return 0; const keep = lb.el.innerHTML; lb.el.innerHTML = html; const w = lb.el.getBoundingClientRect().width; lb.el.innerHTML = keep; return w; };
  return { made, label, setText, place, wrap, most, widthOf };
}
const kvHtml = (kv) => Object.entries(kv).map(([k, v]) => `${esc(k)}  <span class="q-v">${val(v)}</span>`).join('\n');
const put = (o, i, x, y, a, h, j, s, c) => { o.x[i] = x; o.y[i] = y; o.a[i] = a; o.h[i] = h; o.j[i] = j; o.s[i] = s; o.c[i] = c; };
const show = (p, a, b) => U.smooth(U.range(p, a, b));
function rim(x, y, w, h, n, m) {
  const per = 2 * (w + h), d = ((m + 0.5) / n) * per;
  if (d < w) return [x + d, y];
  if (d < w + h) return [x + w, y + (d - w)];
  if (d < 2 * w + h) return [x + w - (d - w - h), y + h];
  return [x, y + h - (d - 2 * w - h)];
}
/* 격자 — 줄 수를 내림으로(마지막 줄이 덜 차 이가 빠지지 않게). 남는 알갱이는 셋째 값이 false */
function grid(x, y, w, h, n, m) {
  const cols = Math.max(2, Math.round(Math.sqrt(n * (w / Math.max(1, h))))), rows = Math.max(1, Math.floor(n / cols));
  return [x + (((m % cols) + 0.5) / cols) * w, y + ((Math.floor(m / cols) % rows) + 0.5) / rows * h, m < cols * rows];
}

function make({ F, deck, labels, scene }) {
  const sc = scene(), st = stateOf(deck, sc), all = [st.S0, ...st.S], R = rolesOf(st.A, st.cast, all);
  for (const m of audit(deck, sc)) console.error(m);
  return R.EVID ? makeEvid(F, deck, labels, sc, st, R) : makeLanes(F, deck, labels, sc, st, R);
}

/* ══════════ 근거(01) — 출처 더미 · 대조 · 주장 ══════════ */
function makeEvid(F, deck, labels, sc, st, R) {
  const N = F.N, { A, S0, S, NK } = st, all = [S0, ...S];
  const { made, label, setText, place, wrap, most } = kit(labels);
  const keys0 = Object.keys(S0[R.CHK]);
  const PILES = keys0.map((k) => PAREN.exec(k)).filter(Boolean).map((m) => ({ key: m[0], g: m[1], name: m[2] }));
  const SUM = keys0.filter((k) => !PAREN.test(k));
  /* 주장 — 값이 부르는 출처(어느 스텝에서든). 부르지 않으면 아래 줄 */
  const CLAIMS = R.GRADES.flatMap((a) => Object.keys(S0[a]).map((k) => {
    const hit = PILES.findIndex((p) => all.some((s) => bare(s[a][k]).includes(p.name)));
    return { a, k, pile: hit };
  }));
  /* 문장 띠의 수 — 그 출처 값이 어느 스텝에서든 'N문장' 을 적으면(말뭉치 26문장). 없으면 문서 · 코드 모양만 */
  const STRIPS = PILES.map((p) => Math.max(0, ...all.map((s) => +((/(\d+)\s*문장/.exec(bare(s[R.CHK][p.key])) || [])[1] || 0))));
  const PN = 520, R0 = {};
  let at = 0;
  const take = (k, n) => { R0[k] = [at, at + n]; at += n; };
  PILES.forEach((p, j) => take('p:' + j, PN));
  take('lnk', 120);
  R0.DST = [at, N];

  const pHd = PILES.map(() => label('')), pV = PILES.map(() => label('ml aq-b'));
  const cLb = CLAIMS.map(() => label('ml aq-b'));
  const gHd = R.GRADES.map(() => label('')), sumLb = label('ml aq-b'), chkHd = label('');
  const on = (s, a) => s.touch.has(a);
  const TX = S.map((s) => {
    const t = new Map(), c = s[R.CHK];
    PILES.forEach((p, j) => {
      const v = c[p.key], done = bare(v) !== '—';
      t.set(pHd[j], [p.key, on(s, R.CHK), done ? 'green' : '']);
      t.set(pV[j], [val(v), on(s, R.CHK), '', true, true]);
    });
    CLAIMS.forEach((q, j) => t.set(cLb[j], [`${esc(q.k)}\n<span class="q-v">${val(s[q.a][q.k])}</span>`, on(s, q.a), '', true, true]));
    R.GRADES.forEach((a, j) => t.set(gHd[j], [A[a].nm, on(s, a)]));
    t.set(chkHd, [A[R.CHK].nm, on(s, R.CHK)]);
    t.set(sumLb, [SUM.map((k) => `${esc(k)}  <span class="q-v">${val(c[k])}</span>`).join('\n'), on(s, R.CHK), '', SUM.length > 0, true]);
    return t;
  });

  let G = null;
  const rnd = U.rng(11), dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = ww < 560 ? 14 : 22, n = PILES.length, cw = (ww - (n - 1) * gap) / n;
    PILES.forEach((p, j) => { wrap(pV[j], cw); });
    CLAIMS.forEach((q, j) => wrap(cLb[j], q.pile >= 0 ? cw : ww));
    wrap(sumLb, ww);
    const vH = Math.max(14, ...pV.map((lb) => most(lb, TX).h));
    const colClaims = PILES.map((_, j) => CLAIMS.map((q, i) => (q.pile === j ? i : -1)).filter((i) => i >= 0));
    const cH = colClaims.map((ix) => ix.reduce((t, i) => t + most(cLb[i], TX).h + 8, 0));
    const loose = CLAIMS.map((q, i) => (q.pile < 0 ? i : -1)).filter((i) => i >= 0);
    const lH = loose.reduce((t, i) => t + most(cLb[i], TX).h + 8, 0), sH = most(sumLb, TX).h;
    const lay = (z) => {
      const ph = Math.round(U.clamp(wh * 0.3, 70, 150) * z), lg = 24 * z;
      return { ph, lg, h: 18 + 18 + vH + 10 + ph + lg + Math.max(0, ...cH) + 10 + 18 + lH + 14 + sH };
    };
    let z = 1, Ls = lay(z);
    while (Ls.h > wh && z > 0.45) { z -= 0.08; Ls = lay(z); }
    if (Ls.h > wh + 1) console.error(`aurora ${sc.num} 세계 : 높이 ${Math.round(Ls.h)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    const y0 = L.y0 + (L.narrow ? 0 : Math.max(0, (wh - Ls.h) / 2));
    G = { L, cw, gap, piles: [], claims: [], pos: new Map() };
    const P = (lb, x, y, al, va) => G.pos.set(lb, [x, y, al, va]);
    let y = y0;
    P(chkHd, L.x0, y, 'l', 't'); y += 18;
    PILES.forEach((p, j) => { const x = L.x0 + j * (cw + gap); P(pHd[j], x, y, 'l', 't'); P(pV[j], x, y + 18, 'l', 't'); });
    y += 18 + vH + 10;
    PILES.forEach((p, j) => G.piles.push({ x: L.x0 + j * (cw + gap), y, w: Math.min(cw, 220), h: Ls.ph }));
    y += Ls.ph + Ls.lg;
    PILES.forEach((_, j) => { let yy = y; for (const i of colClaims[j]) { P(cLb[i], L.x0 + j * (cw + gap), yy, 'l', 't'); G.claims[i] = { x: L.x0 + j * (cw + gap), y: yy }; yy += most(cLb[i], TX).h + 8; } });
    y += Math.max(0, ...cH);
    y += 10;
    R.GRADES.forEach((a, j) => P(gHd[j], L.x0, y, 'l', 't'));
    y += 18;
    for (const i of loose) { P(cLb[i], L.x0, y, 'l', 't'); G.claims[i] = null; y += most(cLb[i], TX).h + 8; }
    y += 14; P(sumLb, L.x0, y, 'l', 't');
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* 더미 모양 — 문장 띠(수가 있으면 그 수), 아니면 문서(가는 줄 여럿) · 코드(들여 쓴 줄) */
  function pilePt(j, m, n) {
    const g = G.piles[j], k = STRIPS[j];
    if (k > 0) {
      const per = Math.floor(n / k), r = Math.floor(m / per), q = m % per;
      if (r >= k) return null;
      const cols = 2, rows = Math.ceil(k / cols), c = Math.floor(r / rows), rr = r % rows, sw = (g.w - 8) / cols;
      return [g.x + c * sw + 2 + ((q + 0.5) / per) * (sw - 8) * (0.55 + 0.45 * ((r * 7) % 5) / 4), g.y + ((rr + 0.5) / rows) * g.h];
    }
    const lines = 9, per = Math.floor(n / lines), r = Math.floor(m / per), q = m % per;
    if (r >= lines) return null;
    const code = PILES[j].g === 'fact', ind = code ? [0, 1, 2, 2, 1, 2, 3, 1, 0][r] * 10 : 0, len = code ? [0.6, 0.7, 0.5, 0.8, 0.4, 0.65, 0.55, 0.3, 0.2][r] : [0.9, 1, 0.95, 0.7, 1, 0.9, 0.98, 0.85, 0.5][r];
    return [g.x + 4 + ind + ((q + 0.5) / per) * (g.w - 12 - ind) * len, g.y + ((r + 0.5) / lines) * g.h];
  }
  function pose(k, p, t, o) {
    if (!G) return;
    const end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1;
    for (let i = R0.DST[0]; i < R0.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    PILES.forEach((pl, j) => {
      const [r0] = R0['p:' + j], done = bare(s[R.CHK][pl.key]) !== '—', was = bare(prev[R.CHK][pl.key]) !== '—', fresh = done && !was && !end;
      const lit = s.touch.has(R.CHK) && !end, used = CLAIMS.some((q) => q.pile === j && bare(s[q.a][q.k]) !== '—');
      for (let m = 0; m < PN; m++) {
        const i = r0 + m, P = pilePt(j, m, PN);
        if (!P) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        /* 대조되는 순간 — 띠가 위에서부터 차례로 초록이 된다 */
        const q = fresh ? show(p, 0.1 + (m / PN) * 0.25, 0.2 + (m / PN) * 0.25) : done ? 1 : 0;
        const [x, y] = into(i, P[0] + jit[i * 2] * 0.6, P[1] + jit[i * 2 + 1] * 0.6);
        put(o, i, x, y, ((used || done) ? (lit ? 0.9 : 0.6) : 0.3) * dim * form, q > 0.5 && lit ? 0.4 : 0, 0.03, 1.05, q > 0.5 ? GREEN : used ? INK : FAINT);
      }
    });
    /* 주장 → 출처 — 짧은 세로줄 알갱이 */
    const [l0, l1] = R0.lnk, live = CLAIMS.map((q, i) => (q.pile >= 0 && G.claims[i] && bare(s[q.a][q.k]) !== '—' ? i : -1)).filter((i) => i >= 0);
    for (let m = 0; m < l1 - l0; m++) {
      const i = l0 + m, ci = live.length ? live[m % live.length] : -1;
      if (ci < 0) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
      const g = G.piles[CLAIMS[ci].pile], c = G.claims[ci], u = Math.floor(m / live.length) / Math.ceil((l1 - l0) / live.length);
      const x = c.x + 6, y0 = g.y + g.h + 4, y1 = c.y - 4, [xx, yy] = into(i, x, U.lerp(y0, y1, u));
      const lit = s.touch.has(CLAIMS[ci].a) && !end;
      put(o, i, xx, yy, (lit ? 0.7 : 0.35) * dim * form, 0, 0.02, 1, lit ? GOLD : FAINT);
    }
  }
  let shown = -2;
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
        const ps = G.pos.get(lb);
        if (ps) place(lb, ...ps);
      }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true);
      setO(lb, vis && txt ? dimO * (emph ? 1 : 0.5) * (same ? 1 : fade) : 0);
    }
  }
  let css = {};
  function overlay(ctx, k, p, b) {
    if (!G) return;
    const end = (b > 0.5 ? k + 1 : k) >= NK, form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form;
    ctx.save(); ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    for (const g of G.piles) { ctx.globalAlpha = 0.35 * o; ctx.strokeStyle = css.faint; ctx.beginPath(); ctx.roundRect(g.x - 4.5, g.y - 6.5, g.w + 1, g.h + 13, 6); ctx.stroke(); }
    ctx.restore();
  }
  return {
    build(L) { this.theme(); build(L); },
    theme() { const cs = getComputedStyle(document.documentElement); css = { faint: cs.getPropertyValue('--faint').trim() }; },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}

/* ══════════ compute · storage — 인스턴스 · 네트워크 · 볼륨 · LSN ══════════ */
const BOXN = 120, CELLN = 16, NCELL = 8, COPY = 200, SLAB = 720, STRIP = 210, STREAM = 120, NODEN = 64, MAXNODE = 6,
  PIPEN = 24, PAGEN = 64, FANN = 160, AXN = 160, MARKN = 18, SLOG = 450, CHIPN = 44, BARN = 60, TOK = 150;
function makeLanes(F, deck, labels, sc, st, R) {
  const N = F.N, { A, S0, S, NK } = st, all = [S0, ...S];
  const { made, label, setText, place, wrap, most, widthOf } = kit(labels);
  const LN = deck.LANES || [], EDGE = (deck.EDGES || [])[0] || null;
  const comp = LN.find((l) => l.id === 'comp'), stor = LN.find((l) => l.id === 'stor');
  const idsOf = (a) => (a ? [...new Set(all.flatMap((s) => s[a].map((x) => x.id)))] : []);
  const real = (a, s) => (a ? s[a].filter((x) => !isHold(x)) : []);
  const focusOf = (s, a) => (Array.isArray(s.look[a]) ? new Set(s.look[a].map(String)) : null);
  const modOf = (s, a) => { const c = s.chg[a]; return new Set(c ? [...(c.mod || []), ...(c.add || []), ...(c.keys || [])].map(String) : []); };
  const hotIt = (s, a, id) => { const f = focusOf(s, a); if (f) return f.has(id); const m = modOf(s, a); return m.size ? m.has(id) : true; };
  const on = (s, a) => !!a && s.touch.has(a);

  /* ── 인스턴스 ── */
  const cacheIn = (s) => !R.CACHE || !/별개/.test(bare(s[R.CACHE]['사는 곳'] || ''));
  const cacheFill = (s) => { const v = bare((R.CACHE && s[R.CACHE]['재시작 후']) || ''); return /비어/.test(v) ? 0 : /따뜻/.test(v) ? 2 : 1; };
  const INST = [];
  if (R.WRITER) INST.push({ key: 'w', name: A[R.WRITER].nm, kv: R.WRITER, grid: all.some((s) => 'buffer pool' in s[R.WRITER]) });
  if (R.READERS) for (const id of idsOf(R.READERS)) INST.push({ key: 'r:' + id, name: id, item: id, grid: all.some((s) => s[R.READERS].some((x) => /buffer pool|캐시/.test(x.sub))) });
  if (!R.WRITER && (R.CACHE || R.IO)) INST.push({ key: 'db', name: comp ? comp.note : 'DB', kv: R.CACHE, grid: !!R.CACHE });
  const SEP = !!R.CACHE && all.some((s) => !cacheIn(s));
  const COLS = [...R.OPK.map((a) => ({ kind: 'text', a })), ...(R.LSNK ? [{ kind: 'text', a: R.LSNK }] : []), ...INST.map((b) => ({ kind: 'inst', b })),
    ...(SEP ? [{ kind: 'cbox' }] : []), ...(R.CQ ? [{ kind: 'cq' }] : [])];
  const TXA = COLS.filter((c) => c.kind === 'text').map((c) => c.a);
  const failed = (s, b) => b.kv && /교체/.test(bare(s[b.kv]['역할'] || ''));

  /* ── 볼륨 ── */
  const VOLMODE = !R.VOL ? null : all.some((s) => s[R.VOL].some((x) => zoneOf(x.id))) ? 'az' : R.LSNK ? 'log' : 'slab';
  const VIDS = idsOf(R.VOL);
  const ZONES = VOLMODE === 'az' ? [...new Set(VIDS.map(zoneOf).filter(Boolean))] : [];
  const segOf = (it) => { const m = new RegExp(`(${KW})\\s*중\\s*(${KW})`).exec(it.sub); return m ? [KN[m[1]], KN[m[2]]] : null; };
  const RANGE = VOLMODE === 'slab' ? VIDS.find((id) => all.some((s) => s[R.VOL].some((x) => x.id === id && x.tag === 'x' && rangeNames(x.sub)))) || null : null;
  const SLABID = VOLMODE === 'slab' ? VIDS.find((id) => id !== RANGE) : null;
  /* ── 네트워크 · storage 노드 ── */
  const IOIDS = idsOf(R.IO).filter((id) => all.some((s) => s[R.IO].some((x) => x.id === id && !isHold(x))));
  const IOMAX = Math.max(1, ...all.map((s) => real(R.IO, s).length));
  const SNIDS = idsOf(R.SN);
  const NCELLS = Math.max(0, ...SNIDS.flatMap(stagesOf));
  const PAGES = SNIDS.filter((id) => !stagesOf(id).length && all.some((s) => s[R.SN].some((x) => x.id === id && !isHold(x))));
  const CQIDS = idsOf(R.CQ);
  const DESTMAX = Math.min(MAXNODE, Math.max(0, ...all.map((s) => (destOf(s, R.IO) || { n: 0 }).n)));
  /* ── LSN 자 ── */
  const LS = R.LSNK ? all.map((s) => lsnOf(s, R)) : [];
  const CPLMAX = Math.max(0, ...LS.map((l) => l.cpl.length));
  const AXV = R.LSNK ? [...LS.flatMap((l) => [...l.cpl, l.vcl, l.vdl, l.cmt]), ...(R.VOL ? all.flatMap((s) => s[R.VOL].flatMap((it) => { const g = logOf(it), r = rangeOf(it); return [g.full, g.dur, ...(r || [])]; })) : [])].filter((v) => v != null) : [];
  /* ── 막대 ── */
  const BARS = R.TEXTS.find((a) => all.some((s) => metricsOf(s[a]).length)) || null;
  const BMAX = BARS ? Math.max(...all.map((s) => metricsOf(s[BARS]).length)) : 0;

  /* ── 알갱이 구역 ── */
  const R0 = {};
  let at = 0;
  const take = (k, n) => { R0[k] = [at, at + n]; at += n; };
  INST.forEach((b) => { take('b:' + b.key, BOXN); if (b.grid) take('g:' + b.key, NCELL * CELLN); });
  if (SEP) take('cb', BOXN);
  if (VOLMODE === 'az') VIDS.forEach((id) => take('c:' + id, COPY));
  if (VOLMODE === 'slab') { take('slab', SLAB); if (RANGE) take('strip', STRIP); }
  if (VOLMODE === 'log') take('slog', SLOG);
  IOIDS.forEach((id) => take('io:' + id, STREAM));
  for (let j = 0; j < DESTMAX; j++) take('n:' + j, NODEN);
  if (R.SN && R.IO) take('fan', FANN);
  for (let j = 0; j < NCELLS; j++) take('p:' + j, PIPEN);
  PAGES.forEach((id) => take('pg:' + id, PAGEN));
  if (R.LSNK) { take('ax', AXN); for (let j = 0; j < CPLMAX; j++) take('mk:c' + j, MARKN); for (const m of ['vcl', 'vdl', 'cmt']) take('mk:' + m, MARKN); }
  CQIDS.forEach((id) => take('q:' + id, CHIPN));
  for (let j = 0; j < BMAX * 2; j++) take('bar:' + j, BARN);
  take('tok', TOK);
  R0.DST = [at, N];
  if (at > N) throw new Error('aurora 세계 : 알갱이가 모자란다 (' + at + ' > ' + N + ')');

  /* ── 이름표 ── */
  const compLb = label(''), storLb = label(''), edgeLb = label(''), tok = label('stn-tok');
  tok.el.className = 'wl stn-tok';
  const hd = {}, tx = {};
  for (const a of [...TXA, ...R.TEXTS]) { hd[a] = label(''); tx[a] = label('ml aq-b'); }
  const nm = {}, bd = {};
  for (const b of INST) { nm[b.key] = label(''); bd[b.key] = label('ml aq-b'); }
  const cbHd = SEP ? label('') : null;
  const zoneLb = ZONES.map(() => label('')), copyLb = Object.fromEntries((VOLMODE === 'az' ? VIDS : []).map((id) => [id, label('ml aq-c')]));
  const volLb = Object.fromEntries((VOLMODE === 'slab' || VOLMODE === 'log' ? VIDS : []).map((id) => [id, label('ml aq-b')]));
  const rgLb = RANGE ? [label(''), label('')] : null;
  const ioHd = R.IO ? label('') : null, ioLb = Object.fromEntries(idsOf(R.IO).map((id) => [id, label('ml aq-b')]));
  const destLb = Array.from({ length: DESTMAX }, () => label('aq-c')), pgCap = R.IO ? label('') : null;
  const snHd = R.SN ? label('') : null, snLb = Object.fromEntries(SNIDS.map((id) => [id, label('ml aq-b')]));
  const cqHd = R.CQ ? label('') : null, cqN = Object.fromEntries(CQIDS.map((id) => [id, label('ml aq-c')])), cqS = Object.fromEntries(CQIDS.map((id) => [id, label('ml aq-b')]));
  const cplLb = Array.from({ length: CPLMAX }, () => label('aq-c')), mkLb = R.LSNK ? { vcl: label('aq-c'), vdl: label('aq-c'), cmt: label('aq-c') } : null, lalLb = R.LSNK ? label('') : null;
  const barT = Array.from({ length: BMAX }, () => label('')), barL = Array.from({ length: BMAX * 2 }, () => label(''));

  const ioHtml = (it) => `<span class="q-i">${esc(it.id)}</span>${it.sub ? '\n' + esc(it.sub) : ''}`;
  const TX = S.map((s, kk) => {
    const t = new Map(), hotE = (s.step.hot || (s.step.act && s.step.act.hot)) === (EDGE && EDGE.hot);
    if (comp) t.set(compLb, [`${comp.lb}  ·  ${comp.note}`, INST.some((b) => on(s, b.kv) || (b.item && on(s, R.READERS))) || on(s, R.IO)]);
    if (stor) t.set(storLb, [`${stor.lb}  ·  ${stor.note}`, on(s, R.VOL) || on(s, R.SN)]);
    if (EDGE) t.set(edgeLb, [EDGE.lb, hotE, hotE ? 'gold' : '']);
    for (const a of [...TXA, ...R.TEXTS]) { t.set(hd[a], [A[a].nm, on(s, a)]); t.set(tx[a], [kvHtml(s[a]), on(s, a), '', true, true]); }
    for (const b of INST) {
      if (b.item) {
        const it = s[R.READERS].find((x) => x.id === b.item), lit = on(s, R.READERS) && hotIt(s, R.READERS, b.item);
        t.set(nm[b.key], [b.name, lit, it && it.tag === 'hold' ? 'gold' : '']);
        t.set(bd[b.key], [it && it.sub ? esc(it.sub) : '', lit, '', !!(it && it.sub), true]);
      } else if (b.kv) {
        t.set(nm[b.key], [b.name, on(s, b.kv) || on(s, R.IO), failed(s, b) ? 'red' : '']);
        t.set(bd[b.key], [(b.key === 'db' ? `<span class="q-i">${esc(A[b.kv].nm)}</span>\n` : '') + kvHtml(s[b.kv]), on(s, b.kv), '', true, true]);
      } else t.set(nm[b.key], [b.name, on(s, R.IO)]);
    }
    if (SEP) t.set(cbHd, [A[R.CACHE].nm, on(s, R.CACHE), '', !cacheIn(s)]);
    if (VOLMODE === 'az') {
      ZONES.forEach((z, j) => { const its = s[R.VOL].filter((x) => zoneOf(x.id) === z); t.set(zoneLb[j], [z, on(s, R.VOL), its.length && its.every((x) => x.tag === 'x') ? 'red' : '']); });
      for (const id of VIDS) { const it = s[R.VOL].find((x) => x.id === id); t.set(copyLb[id], [it ? `<span class="q-i">${esc(id)}</span>${it.sub ? '\n' + esc(it.sub) : ''}` : '', on(s, R.VOL) && !!it && hotIt(s, R.VOL, id), '', !!it, true]); }
    }
    if (VOLMODE === 'slab' || VOLMODE === 'log') for (const id of VIDS) {
      const it = s[R.VOL].find((x) => x.id === id);
      t.set(volLb[id], [it ? ioHtml(it).replace('class="q-i"', `class="${it.tag === 'x' ? 'q-r' : 'q-i'}"`) : '', on(s, R.VOL) && !!it && hotIt(s, R.VOL, id), '', !!it, true]);
    }
    if (RANGE) { const it = s[R.VOL].find((x) => x.id === RANGE), nmz = it ? rangeNames(it.sub) : null; t.set(rgLb[0], [nmz ? nmz[0] : '', on(s, R.VOL), 'green', !!nmz]); t.set(rgLb[1], [nmz ? nmz[1] : '', on(s, R.VOL), 'red', !!nmz]); }
    if (R.IO) {
      t.set(ioHd, [A[R.IO].nm, on(s, R.IO)]);
      for (const id of idsOf(R.IO)) { const it = s[R.IO].find((x) => x.id === id); t.set(ioLb[id], [it ? ioHtml(it) : '', on(s, R.IO) && !!it && hotIt(s, R.IO, id), '', !!it, true]); }
      const d = destOf(s, R.IO);
      for (let j = 0; j < DESTMAX; j++) t.set(destLb[j], [d && d.kind === 'chain' && j < d.n ? d.names[j] : '', on(s, R.IO), '', !!(d && d.kind === 'chain' && j < d.n)]);
      t.set(pgCap, [d && d.kind === 'pg' ? d.cap : '', on(s, R.IO) || on(s, R.SN), '', !!(d && d.kind === 'pg')]);
    }
    if (R.SN) {
      t.set(snHd, [A[R.SN].nm, on(s, R.SN)]);
      for (const id of SNIDS) { const it = s[R.SN].find((x) => x.id === id); t.set(snLb[id], [it ? ioHtml(it) : '', on(s, R.SN) && !!it && hotIt(s, R.SN, id), '', !!it, true]); }
    }
    if (R.CQ) {
      t.set(cqHd, [A[R.CQ].nm, on(s, R.CQ)]);
      for (const id of CQIDS) {
        const it = s[R.CQ].find((x) => x.id === id), lit = on(s, R.CQ) && !!it && hotIt(s, R.CQ, id);
        t.set(cqN[id], [it ? id : '', lit, it && it.tag === 'ok' ? 'green' : '', !!it]);
        t.set(cqS[id], [it && it.sub ? esc(it.sub) : '', lit, '', !!(it && it.sub), true]);
      }
    }
    if (R.LSNK) {
      const l = LS[kk + 1], lit = on(s, R.LSNK);
      cplLb.forEach((lb, j) => t.set(lb, [j < l.cpl.length ? `${l.ell && j === 0 ? '… ' : ''}CPL ${l.cpl[j]}` : '', lit, 'gold', j < l.cpl.length]));
      t.set(mkLb.vcl, [l.vcl != null ? `VCL ${l.vcl}` : '', lit, '', l.vcl != null]);
      t.set(mkLb.vdl, [l.vdl != null ? `VDL ${l.vdl}` : '', lit, 'green', l.vdl != null]);
      t.set(mkLb.cmt, [l.cmt != null ? `${l.cmtKey} ${l.cmt}` : '', R.OPK.some((a) => on(s, a)) || on(s, R.CQ), 'gold', l.cmt != null]);
      t.set(lalLb, [l.lalV ? `${l.lal}  ${l.lalV}  →` : '', lit, '', !!l.lalV]);
    }
    if (BARS) {
      const ms = metricsOf(s[BARS]);
      barT.forEach((lb, j) => t.set(lb, [j < ms.length ? ms[j].name : '', on(s, BARS), '', j < ms.length]));
      /* 막대의 색은 그 값의 색 표시(|green) 그대로 — 큰 것 · 작은 것 중 어느 쪽이 나은지는 세계가 정하지 않는다 */
      barL.forEach((lb, j) => { const m = ms[j >> 1]; t.set(lb, [m ? `${m.keys[j & 1]}  ${m.txt[j & 1]}` : '', on(s, BARS), m ? tone(s[BARS][m.keys[j & 1]]) : '', !!m]); });
    }
    return t;
  });

  /* ── 자리 ── */
  let G = null;
  const rnd = U.rng(7), dust = new Float32Array(N * 2), jit = new Float32Array(N * 2).map(() => rnd() - 0.5);
  const LH = 16, HD = 18;
  function build(L) {
    const ww = L.x1 - L.x0, wh = L.y1 - L.y0, gap = ww < 560 ? 12 : 18;
    /* 열 — 글 · 대기열은 좁게, 인스턴스는 남는 폭을 나눈다 */
    const nI = COLS.filter((c) => c.kind === 'inst' || c.kind === 'cbox').length, nT = COLS.length - nI, ng = (COLS.length - 1) * gap;
    let tW = 0, iW = 0;
    if (nI && nT) { tW = U.clamp(ww * 0.34, 140, 280); if (nT * tW + nI * 100 + ng > ww) tW = Math.max(110, (ww - nI * 100 - ng) / nT); iW = (ww - nT * tW - ng) / nI; }
    else if (nI) iW = (ww - ng) / nI; else tW = (ww - ng) / nT;
    let cx = L.x0;
    for (const c of COLS) { c.w = c.kind === 'inst' || c.kind === 'cbox' ? iW : tW; c.x = cx; cx += c.w + gap; }
    for (const c of COLS) {
      if (c.kind === 'text') wrap(tx[c.a], c.w);
      if (c.kind === 'inst') wrap(bd[c.b.key], c.w);
      if (c.kind === 'cq') for (const id of CQIDS) { wrap(cqS[id], c.w); wrap(cqN[id], c.w - 16); }
    }
    /* 대기열 칸 — 이름이 열보다 넓으면 접고 칸이 그만큼 높아진다 */
    const cqC = COLS.find((c) => c.kind === 'cq'), chipH = cqC ? Math.max(24, ...CQIDS.map((id) => most(cqN[id], TX).h + 10)) : 0;
    const chipW = Object.fromEntries(CQIDS.map((id) => [id, Math.min(cqC.w, Math.ceil(widthOf(cqN[id], esc(id))) + 18)]));
    /* 아래 글 블록 — 막대가 있으면 오른쪽 한 칸을 막대에 */
    const nTx = R.TEXTS.length + (BARS ? 1 : 0);
    let tn = Math.max(1, Math.min(3, nTx));
    while (tn > 1 && (ww - (tn - 1) * gap) / tn < 150) tn--;
    const bw = (ww - (tn - 1) * gap) / tn;
    for (const a of R.TEXTS) wrap(tx[a], BARS && tn === 1 ? ww : bw);
    const txRows = Math.ceil(nTx / tn), txH = Math.max(0, ...R.TEXTS.map((a) => most(tx[a], TX).h));
    const barLw = Math.max(0, ...barL.map((lb) => most(lb, TX).w));
    /* 네트워크 쓰기 — 이름표 폭은 가장 많은 스텝의 열 폭 */
    const ioW = Math.min(300, (ww - (IOMAX - 1) * gap) / IOMAX);
    for (const id of idsOf(R.IO)) wrap(ioLb[id], ioW);
    const ioH = R.IO ? Math.max(LH, ...idsOf(R.IO).map((id) => most(ioLb[id], TX).h)) : 0;
    for (const id of CQIDS) wrap(cqS[id], COLS.find((c) => c.kind === 'cq').w);
    const vW = VOLMODE === 'log' ? (ww - gap) / 2 : ww;
    for (const id of Object.keys(volLb)) wrap(volLb[id], VOLMODE === 'log' ? vW : ww);
    const zg = Math.max(14, ww * 0.03), zw = ZONES.length ? (ww - (ZONES.length - 1) * zg) / ZONES.length : 0;
    for (const id of Object.keys(copyLb)) wrap(copyLb[id], zw - 12);

    const colH = (c, z) => {
      if (c.kind === 'text') return HD + most(tx[c.a], TX).h;
      if (c.kind === 'inst') return LH + 4 + (c.b.grid ? bh(z) : sh(z)) + 8 + most(bd[c.b.key], TX).h;
      if (c.kind === 'cbox') return LH + 4 + bh(z);
      if (c.kind === 'cq') return HD + chipH + 6 + Math.max(0, ...CQIDS.map((id) => most(cqS[id], TX).h));
      return 0;
    };
    const bh = (z) => Math.round(Math.max(34, 56 * z)), sh = (z) => Math.round(Math.max(22, 30 * z));
    /* storage 단계 이름표 — 스텝마다 칸 가운데에, 겹치면 줄을 내린다 */
    const pw = PAGES.length ? ww * 0.76 : ww, pcw = NCELLS ? pw / NCELLS : 0;
    const snSpan = (id) => { const sg = stagesOf(id); if (sg.length) return [L.x0 + (Math.min(...sg) - 1) * pcw, L.x0 + Math.max(...sg) * pcw]; if (PAGES.includes(id)) return [L.x0 + pw + gap, L.x1]; return [L.x0, L.x0 + Math.min(ww, 200)]; };
    for (const id of SNIDS) { const [a, b] = snSpan(id); wrap(snLb[id], Math.max(120, b - a - 6)); }
    const snRowH = R.SN ? Math.max(LH, ...SNIDS.map((id) => most(snLb[id], TX).h)) + 4 : 0;
    const snLay = S.map((s) => stagger(s[R.SN] ? s[R.SN].map((it) => { const [a, b] = snSpan(it.id); return { id: it.id, cx: (a + b) / 2, w: widthOf(snLb[it.id], TX[S.indexOf(s)].get(snLb[it.id])[0]) }; }).filter((q) => q.w) : [], L.x0, L.x1));
    const snRows = R.SN ? Math.max(1, ...snLay.map((q) => q.rows)) : 0;
    /* LSN 자 이름표 — 위는 CPL, 아래는 VCL · VDL · commit. 스텝마다 재서 줄을 나눈다 */
    const axL = L.x0 + 4, axR = L.x1 - (R.LSNK ? 30 : 4);
    const lo = AXV.length ? Math.min(...AXV) : 0, hi = AXV.length ? Math.max(...AXV) : 1, pad = Math.max(1, (hi - lo) * 0.06);
    const X = (v) => axL + ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (axR - axL);
    const marks = S.map((s, kk) => {
      if (!R.LSNK) return null;
      const l = LS[kk + 1], T = TX[kk], w = (lb) => widthOf(lb, T.get(lb)[0]);
      const up = stagger(l.cpl.map((v, j) => ({ j, cx: X(v), w: w(cplLb[j]) })), L.x0, L.x1, 6);
      const dn = stagger([['vcl', l.vcl], ['vdl', l.vdl], ['cmt', l.cmt]].filter(([, v]) => v != null).map(([m, v]) => ({ m, cx: X(v), w: w(mkLb[m]) })), L.x0, L.x1, 6);
      return { up, dn };
    });
    const upRows = R.LSNK ? Math.max(1, ...marks.map((q) => q.up.rows)) : 0, dnRows = R.LSNK ? Math.max(1, ...marks.map((q) => q.dn.rows)) : 0;
    const hasLal = R.LSNK && LS.some((l) => l.lalV);
    const volH = Object.keys(volLb).length ? (VOLMODE === 'log' ? Math.max(...Object.values(volLb).map((lb) => most(lb, TX).h)) : Object.entries(volLb).filter(([id]) => id !== RANGE).reduce((t, [, lb]) => Math.max(t, most(lb, TX).h), 0)) : 0;
    const rgH = RANGE ? most(volLb[RANGE], TX).h : 0;
    const copyH = Object.keys(copyLb).length ? Math.max(...Object.values(copyLb).map((lb) => most(lb, TX).h)) : 0;

    const lay = (z) => {
      const g = (v) => Math.round(v * z);
      let y = 0;
      const out = { z };
      if (comp) y += LH + g(8);
      out.rowY = y;
      out.rowH = Math.max(0, ...COLS.map((c) => colH(c, z)));
      y += out.rowH;
      if (R.IO) { y += g(14); out.ioHdY = y; y += LH + 2; out.ioY = y; y += ioH + 6; out.stY = y; y += g(20); }
      if (R.LSNK) { y += g(14); out.upY = y; y += upRows * LH + 13; out.axY = y; y += 12 + dnRows * LH; if (hasLal) { out.lalY = y + 2; y += LH + 2; } }
      /* 경계 — 이름은 선 위 오른쪽, storage 이름은 선 아래 왼쪽 */
      y += g(10) + (R.IO ? 0 : LH); out.edgeY = y; y += Math.max(6, g(8));
      if (stor) { out.storY = y; y += LH + g(8); }
      if (VOLMODE === 'az') { out.zoneY = y; y += LH + 2; out.cw = Math.round(U.clamp(zw * 0.4, 36, 110) * z); out.chh = Math.round(out.cw * 0.62); out.boxY = y; out.boxH = g(12) + out.chh + 8 + copyH + g(10); y += out.boxH; }
      if (VOLMODE === 'slab') { out.slabY = y; out.slabH = Math.max(20, g(34)); y += out.slabH + 8; out.volY = y; y += volH; if (RANGE) { y += g(14); out.rgY = y; y += LH + 9; out.stripY = y; y += 12 + 6; out.rgLbY = y; y += rgH; } }
      if (VOLMODE === 'log') { out.slogY = y; y += 16 + 8; out.volY = y; y += volH; }
      if (R.IO && DESTMAX) { out.nodeY = y; out.nodeH = Math.max(16, g(24)); y += out.nodeH + 4; out.destLbY = y; y += LH + g(10); }
      if (R.SN) { out.snHdY = y; y += LH + 2; out.pipeY = y; out.pipeH = Math.max(12, g(18)); y += out.pipeH + 6; out.snY = y; y += snRows * snRowH; }
      if (nTx) { y += g(18); out.txY = y; y += txRows * (HD + Math.max(txH, BARS ? BMAX * (LH + 2 * (LH + 4)) : 0)); }
      out.h = y;
      return out;
    };
    let z = 1, Ly = lay(z);
    while (Ly.h > wh && z > 0.3) { z = Math.round((z - 0.1) * 100) / 100; Ly = lay(z); }
    if (Ly.h > wh + 1) console.error(`aurora ${sc.num} 세계 : 높이 ${Math.round(Ly.h)} 가 무대 ${Math.round(wh)} 를 넘는다 (${L.W}×${L.H})`);
    const y0 = L.y0 + (L.narrow ? 0 : Math.max(0, (wh - Ly.h) / 2)), Y = (v) => y0 + v;
    G = { L, ww, gap, z, pos: S.map(() => new Map()), box: {}, cols: COLS, X, axL, axR, pcw, pw, zw, zg };
    const PA = (lb, x, y, al = 'l', va = 't') => G.pos.forEach((m) => m.set(lb, [x, y, al, va]));
    const PK = (kk, lb, x, y, al = 'l', va = 't') => G.pos[kk].set(lb, [x, y, al, va]);
    if (comp) PA(compLb, L.x0, Y(0));
    /* compute 줄 */
    const rowY = Y(Ly.rowY), BH = bh(Ly.z);
    for (const c of COLS) {
      if (c.kind === 'text') { PA(hd[c.a], c.x, rowY); PA(tx[c.a], c.x, rowY + HD); G.box['t:' + c.a] = { x: c.x, y: rowY, w: c.w, h: HD + 8 }; }
      if (c.kind === 'inst') {
        const w = Math.min(c.w, c.b.grid ? 210 : 150), h = c.b.grid ? BH : sh(Ly.z);
        PA(nm[c.b.key], c.x, rowY);
        G.box[c.b.key] = { x: c.x, y: rowY + LH + 4, w, h };
        PA(bd[c.b.key], c.x, rowY + LH + 4 + h + 8);
      }
      if (c.kind === 'cbox') { PA(cbHd, c.x, rowY); G.box.cb = { x: c.x, y: rowY + LH + 4, w: Math.min(c.w, 160), h: BH }; }
      if (c.kind === 'cq') {
        PA(cqHd, c.x, rowY);
        G.cq = { x: c.x, y: rowY + HD, w: c.w, h: chipH, cw: chipW };
        S.forEach((s, kk) => {
          let x = c.x;
          for (const it of s[R.CQ]) {
            const w = chipW[it.id];
            PK(kk, cqN[it.id], x + w / 2, rowY + HD + chipH / 2, 'c', 'c');
            PK(kk, cqS[it.id], c.x, rowY + HD + chipH + 6);
            x += w + 8;
          }
        });
      }
    }
    /* 인스턴스 상자 안의 page 칸 — 4 × 2 */
    for (const b of INST) if (b.grid) { const B = G.box[b.key]; G.box['g:' + b.key] = { x: B.x + 10, y: B.y + 10, w: Math.min(B.w - 20, 120), h: B.h - 20 }; }
    if (SEP) { const B = G.box.cb; G.box['g:cb'] = { x: B.x + 10, y: B.y + 10, w: Math.min(B.w - 20, 120), h: B.h - 20 }; }
    /* 네트워크 쓰기 */
    if (R.IO) {
      PA(ioHd, L.x0, Y(Ly.ioHdY));
      G.io = { y: Y(Ly.ioY), y0: Y(Ly.stY) };
      S.forEach((s, kk) => {
        const its = real(R.IO, s).length ? real(R.IO, s) : s[R.IO], n = its.length, tot = n * ioW + (n - 1) * gap, x0 = L.x0 + Math.max(0, (ww - tot) / 2);
        its.forEach((it, j) => PK(kk, ioLb[it.id], x0 + j * (ioW + gap), Y(Ly.ioY)));
      });
      G.ioX = (s) => { const its = real(R.IO, s), n = its.length, tot = n * ioW + (n - 1) * gap, x0 = L.x0 + Math.max(0, (ww - tot) / 2); return Object.fromEntries(its.map((it, j) => [it.id, x0 + j * (ioW + gap) + 4])); };
    }
    /* LSN 자 */
    if (R.LSNK) {
      G.ax = { y: Y(Ly.axY) };
      S.forEach((s, kk) => {
        const M = marks[kk];
        for (const q of M.up.out) PK(kk, cplLb[q.j], q.l, Y(Ly.upY) + (upRows - 1 - q.row) * LH, 'l', 't');
        for (const q of M.dn.out) PK(kk, mkLb[q.m], q.l, Y(Ly.axY) + 12 + q.row * LH, 'l', 't');
      });
      if (hasLal) PA(lalLb, L.x1, Y(Ly.lalY), 'r', 't');
    }
    /* 경계 */
    G.edgeY = Y(Ly.edgeY);
    /* 경계 이름 — 쓰기 줄기가 선을 건너는 장면은 선 아래 오른쪽(줄기가 이름을 지나지 않게) */
    if (EDGE) PA(edgeLb, L.x1, R.IO ? G.edgeY + 6 : G.edgeY - 3, 'r', R.IO ? 't' : 'b');
    if (stor) PA(storLb, L.x0, Y(Ly.storY));
    /* 볼륨 */
    if (VOLMODE === 'az') {
      G.zones = ZONES.map((zn, j) => ({ x: L.x0 + j * (zw + zg), y: Y(Ly.boxY), w: zw, h: Ly.boxH }));
      G.cw = Ly.cw; G.chh = Ly.chh;
      ZONES.forEach((zn, j) => PA(zoneLb[j], G.zones[j].x, Y(Ly.zoneY)));
      for (const id of VIDS) { const P = copyAt(id, all.find((s) => s[R.VOL].some((x) => x.id === id))); PA(copyLb[id], P.x, P.y + G.chh / 2 + 8, 'c', 't'); }
    }
    if (VOLMODE === 'slab') {
      G.slab = { x: L.x0, y: Y(Ly.slabY), w: ww, h: Ly.slabH };
      if (SLABID) PA(volLb[SLABID], L.x0, Y(Ly.volY));
      if (RANGE) {
        G.strip = { x0: L.x0, x1: L.x1, y: Y(Ly.stripY), a: L.x0 + ww * 0.52, b: L.x0 + ww * 0.86 };
        PA(rgLb[0], G.strip.a, Y(Ly.rgY), 'c', 't'); PA(rgLb[1], G.strip.b, Y(Ly.rgY), 'c', 't');
        PA(volLb[RANGE], L.x0, Y(Ly.rgLbY));
      }
    }
    if (VOLMODE === 'log') {
      G.slog = { y: Y(Ly.slogY) + 8 };
      VIDS.forEach((id, j) => PA(volLb[id], L.x0 + j * (vW + gap), Y(Ly.volY)));
    }
    /* 목적지 노드 */
    if (R.IO && DESTMAX) {
      G.node = { y: Y(Ly.nodeY), h: Ly.nodeH };
      S.forEach((s, kk) => {
        const d = destOf(s, R.IO);
        if (!d) return;
        const ns = nodesOf(d);
        if (d.kind === 'chain') ns.forEach((q, j) => PK(kk, destLb[j], q.x + q.w / 2, Y(Ly.destLbY), 'c', 't'));
        else PK(kk, pgCap, L.x0 + ww / 2, Y(Ly.destLbY), 'c', 't');
      });
    }
    /* storage 단계 */
    if (R.SN) {
      PA(snHd, L.x0, Y(Ly.snHdY));
      G.pipe = { y: Y(Ly.pipeY), h: Ly.pipeH };
      G.snSpan = snSpan;
      S.forEach((s, kk) => { for (const q of snLay[kk].out) PK(kk, snLb[q.id], q.l, Y(Ly.snY) + q.row * snRowH); });
    }
    /* 아래 글 · 막대 */
    if (nTx) {
      const ty = Y(Ly.txY);
      R.TEXTS.forEach((a, i) => { const x = L.x0 + (i % tn) * (bw + gap), yy = ty + Math.floor(i / tn) * (HD + txH); PA(hd[a], x, yy); PA(tx[a], x, yy + HD); G.box['t:' + a] = { x, y: yy, w: bw, h: HD + 8 }; });
      if (BARS) {
        const i = R.TEXTS.length, x = L.x0 + (i % tn) * (bw + gap), yy = ty + Math.floor(i / tn) * (HD + txH) + HD;
        G.bars = { x, y: yy, w: tn === 1 ? ww : bw, lw: barLw };
        for (let j = 0; j < BMAX; j++) { const by = yy + j * (LH + 2 * (LH + 4)); PA(barT[j], x, by); PA(barL[j * 2], x, by + LH + 2); PA(barL[j * 2 + 1], x, by + LH + 2 + LH + 4); }
      }
    }
    for (let i = 0; i < N; i++) { dust[i * 2] = L.x0 + rnd() * ww; dust[i * 2 + 1] = L.y0 + rnd() * wh; }
    shown = -2;
  }
  /* AZ 의 복사본 — 그 AZ 에 n 개일 때 j 번째의 가운데 */
  function copyAt(id, s) {
    const zn = G.zones[ZONES.indexOf(zoneOf(id))], same = (s ? s[R.VOL] : []).filter((x) => zoneOf(x.id) === zoneOf(id)), n = Math.max(1, same.length), j = Math.max(0, same.findIndex((x) => x.id === id));
    return { x: zn.x + (j + 0.5) * (zn.w / n), y: zn.y + 12 * G.z + G.chh / 2 };
  }
  function nodesOf(d) {
    const n = d.n, slot = G.ww / n, w = Math.min(60, slot - G.gap);
    return Array.from({ length: n }, (_, j) => ({ x: G.L.x0 + (j + 0.5) * slot - w / 2, w, y: G.node.y, h: G.node.h }));
  }
  const center = (B) => [B.x + B.w / 2, B.y + B.h / 2];
  /* act 의 두 끝 — 배우의 그림에서 */
  function anchors(a, s) {
    const B = G.box;
    if (a === R.WRITER && B.w) return [center(B.w)];
    if (a === R.READERS) return INST.filter((b) => b.item).map((b) => center(B[b.key]));
    if (a === R.CACHE) return [center(cacheIn(s) ? B.db : B.cb)];
    if (a === R.LSNK && G.ax) { const l = lsnOf(s, R); return [[G.X(l.vdl ?? l.vcl ?? AXV[0]), G.ax.y]]; }
    if (B['t:' + a]) return [[B['t:' + a].x + Math.min(90, B['t:' + a].w / 2), B['t:' + a].y + 9]];
    if (a === R.VOL) {
      if (VOLMODE === 'az') return [[G.L.x0 + G.ww / 2, G.zones[0].y + G.zones[0].h / 2]];
      if (VOLMODE === 'slab') { const it = RANGE && s[R.VOL].find((x) => x.id === RANGE); return [it ? [(G.strip.a + G.strip.b) / 2, G.strip.y] : center(G.slab)]; }
      if (VOLMODE === 'log') { const l = lsnOf(s, R), x = s[R.VOL].find((q) => q.tag === 'x' && rangeOf(q)); return [[x ? G.X((rangeOf(x)[0] + rangeOf(x)[1]) / 2) : G.X(l.vcl ?? l.vdl ?? AXV[0]), G.slog.y]]; }
    }
    if (a === R.IO && G.io) { const xs = Object.values(G.ioX(s)); return [[xs.length ? xs[0] : G.L.x0 + G.ww / 2, (G.io.y0 + G.edgeY) / 2]]; }
    if (a === R.SN && G.node) return [[G.L.x0 + G.ww / 2, G.node.y + G.node.h / 2]];
    if (a === R.CQ && G.cq) return [[G.cq.x + 40, G.cq.y + G.cq.h / 2]];
    return [[G.L.x0 + G.ww / 2, G.L.y0 + 20]];
  }

  /* ── 자세 ── */
  let O = null;
  const hide = (k) => { if (!R0[k]) return; const [a, b] = R0[k]; for (let i = a; i < b; i++) put(O, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); };
  function pose(k, p, t, o) {
    if (!G) return;
    O = o;
    const end = k >= NK, kk = Math.min(k, NK - 1), s = S[kk], prev = kk > 0 ? S[kk - 1] : S0;
    const act = !end && s.step.act ? s.step.act : null, fly = act ? show(p, 0.08, 0.42) : 1;
    const form = k === 0 ? show(p, 0.1, 0.34) : 1, dim = end ? 0.12 : 1, mv = end ? 1 : show(p, 0.12, 0.42);
    for (let i = R0.DST[0]; i < R0.DST[1]; i++) put(o, i, dust[i * 2], dust[i * 2 + 1], end ? 0.02 : 0.05 * (0.4 + jit[i * 2]), 0, 3, 1, FAINT);
    const into = (i, x, y) => [U.lerp(dust[i * 2], x, form), U.lerp(dust[i * 2 + 1], y, form)];
    /* 인스턴스 — 테두리. 바뀐 배우는 또렷하게, 교체된 writer 는 빨갛게 흩어진다 */
    for (const b of INST) {
      const B = G.box[b.key], [r0] = R0['b:' + b.key];
      const it = b.item ? s[R.READERS].find((x) => x.id === b.item) : null, pit = b.item ? prev[R.READERS].find((x) => x.id === b.item) : null;
      const lit = b.item ? on(s, R.READERS) && hotIt(s, R.READERS, b.item) : on(s, b.kv) || on(s, R.IO);
      const dead = !b.item && failed(s, b), wasDead = !b.item && failed(prev, b), q = dead ? (wasDead || end ? 1 : show(p, 0.12, 0.4)) : 0;
      const tg = it ? it.tag : 'clean', col = dead ? RED : tg === 'hold' ? GOLD : tg === 'free' ? FAINT : INK;
      const fresh = it && pit && pit.tag !== it.tag && !end;
      for (let m = 0; m < BOXN; m++) {
        const i = r0 + m;
        let [x, y] = rim(B.x, B.y, B.w, B.h, BOXN, m);
        if (q) { x += jit[i * 2] * 12 * q; y += (3 + Math.abs(jit[i * 2 + 1]) * 14) * q; }
        [x, y] = into(i, x, y);
        put(o, i, x, y, (lit && !end ? 0.85 : 0.45) * dim * form * (1 - 0.55 * q) * (tg === 'free' ? 0.6 : 1), (lit && !end && (tg === 'hold' || fresh)) ? 0.5 : 0, 0.03, tg === 'hold' ? 1.3 : 1.05, col);
      }
      if (b.grid) poseGrid(o, 'g:' + b.key, b.key === 'db' ? (cacheIn(s) ? 'g:db' : 'g:cb') : 'g:' + b.key, b.key === 'db' ? (cacheIn(prev) ? 'g:db' : 'g:cb') : 'g:' + b.key, s, prev, b, into, dim, form, mv, end);
    }
    if (SEP) {
      const B = G.box.cb, [r0] = R0.cb, sep = !cacheIn(s), was = !cacheIn(prev), a0 = sep ? (was || end ? 1 : show(p, 0.1, 0.36)) : (was && !end ? 1 - show(p, 0.1, 0.3) : 0);
      for (let m = 0; m < BOXN; m++) { const i = r0 + m, [x, y] = into(i, ...rim(B.x, B.y, B.w, B.h, BOXN, m)); put(o, i, x, y, a0 * (on(s, R.CACHE) && !end ? 0.85 : 0.45) * dim * form, 0, 0.03, 1.05, INK); }
    }
    /* 볼륨 */
    if (VOLMODE === 'az') for (const id of VIDS) {
      const [s0] = R0['c:' + id], it = s[R.VOL].find((x) => x.id === id), pv = prev[R.VOL].find((x) => x.id === id);
      if (!it) { hide('c:' + id); continue; }
      const P = copyAt(id, s), PP = pv && !end ? copyAt(id, prev) : null, lit = on(s, R.VOL) && !end, hot = hotIt(s, R.VOL, id);
      for (let m = 0; m < COPY; m++) {
        const i = s0 + m, [gx, gy, ing] = grid(P.x - G.cw / 2, P.y - G.chh / 2, G.cw, G.chh, COPY, m);
        let x = gx, y = gy;
        if (PP) { const [px, py] = grid(PP.x - G.cw / 2, PP.y - G.chh / 2, G.cw, G.chh, COPY, m); x = U.lerp(px, gx, mv); y = U.lerp(py, gy, mv); }
        [x, y] = into(i, x, y);
        put(o, i, x, y, (lit ? (hot ? 0.92 : 0.5) : 0.45) * dim * form * ing, 0, 0.05, 1.1, it.tag === 'x' ? RED : INK);
      }
    }
    if (VOLMODE === 'slab') poseSlab(o, s, prev, into, dim, form, end, p);
    if (VOLMODE === 'log') poseLog(o, s, prev, into, dim, form, end, mv);
    if (R.IO) poseIO(o, s, prev, into, dim, form, end, p, act, mv);
    if (R.SN) poseSN(o, s, prev, into, dim, form, end, p);
    if (R.LSNK) poseAxis(o, s, prev, into, dim, form, end, mv, p);
    if (R.CQ) for (const id of CQIDS) {
      const [q0] = R0['q:' + id], it = s[R.CQ].find((x) => x.id === id), pv = prev[R.CQ].find((x) => x.id === id);
      if (!it && !(pv && !end)) { hide('q:' + id); continue; }
      const P = G.pos[kk].get(cqN[id]) || (kk > 0 && G.pos[kk - 1].get(cqN[id]));
      if (!P) { hide('q:' + id); continue; }
      const w = G.cq.cw[id], gone = it ? 0 : show(p, 0.1, 0.36), born = it && !pv && !end ? show(p, 0.3, 0.46) : 1, tg = (it || pv).tag;
      const lit = on(s, R.CQ) && !end && !!it && hotIt(s, R.CQ, id);
      for (let m = 0; m < CHIPN; m++) {
        const i = q0 + m, [x, y] = into(i, ...rim(P[0] - w / 2, P[1] - G.cq.h / 2, w, G.cq.h, CHIPN, m));
        put(o, i, x, y, (lit ? 0.9 : 0.45) * dim * form * (1 - gone) * born * (tg === 'free' ? 0.5 * (m % 2) : 1), lit && tg === 'ok' ? 0.5 : 0, 0.03, 1.1, TAGC[tg] ?? INK);
      }
    }
    if (BARS) {
      const ms = metricsOf(s[BARS]), fresh = !end && !metricsOf(prev[BARS]).length, g = show(p, 0.14, 0.44);
      for (let j = 0; j < BMAX * 2; j++) {
        const [b0] = R0['bar:' + j], m = ms[j >> 1];
        if (!m || !G.bars) { hide('bar:' + j); continue; }
        const v = m.v[j & 1], mx = Math.max(...m.v), x0 = G.bars.x + G.bars.lw + 10, len = Math.max(3, (G.bars.w - G.bars.lw - 10) * (v / mx)) * (fresh ? g : 1);
        const y = G.bars.y + (j >> 1) * (LH + 2 * (LH + 4)) + LH + 2 + (j & 1) * (LH + 4) + LH / 2;
        const bc = { green: GREEN, red: RED, gold: GOLD }[tone(s[BARS][m.keys[j & 1]])] ?? INK;
        for (let q = 0; q < BARN; q++) { const i = b0 + q, [xx, yy] = into(i, x0 + ((q >> 1) + 0.5) / (BARN / 2) * len, y + (q & 1 ? 2.5 : -2.5)); put(o, i, xx, yy, (on(s, BARS) && !end ? 0.92 : 0.5) * dim * form, 0, 0.02, 1.25, bc); }
      }
    }
    /* act — 덩어리가 f 에서 t 로. 끝이 여럿이면(리더 둘) 나눠 간다 */
    const [t0, t1] = R0.tok, tn = t1 - t0;
    if (act) {
      const F0 = anchors(act.f, s)[0], TT = anchors(act.t, s), e = U.smooth(fly), gone = show(p, 0.42, 0.52), col = act.gold ? GOLD : ACCENT;
      for (let m = 0; m < tn; m++) {
        const i = t0 + m, T = TT[m % TT.length], th = m * 2.399, r = Math.sqrt((m + 0.5) / tn) * 7;
        const arc = Math.sin(e * Math.PI) * Math.min(46, Math.hypot(T[0] - F0[0], T[1] - F0[1]) * 0.25);
        /* 리더가 버리는 record — 도착한 뒤 아래로 떨어지며 사라진다 */
        const rd = act.t === R.READERS ? s[R.READERS][m % TT.length] : null, drop = rd && rd.tag === 'free' ? show(p, 0.4, 0.5) : 0;
        put(o, i, U.lerp(F0[0], T[0], e) + Math.cos(th) * r, U.lerp(F0[1], T[1], e) + Math.sin(th) * r - arc + drop * 18, (fly > 0.01 ? 0.95 : 0) * (1 - gone), 1, 0.2, 1.25, drop ? RED : col);
      }
    } else hide('tok');
  }
  /* page 칸 — 4 × 2. 비면 테두리만, 따뜻하면 금빛으로 찬다. 리더가 record 를 적용한 칸(dirty)은 하나가 금빛 */
  function poseGrid(o, key, at, from, s, prev, b, into, dim, form, mv, end) {
    const [g0] = R0[key], Bn = G.box[at], Bp = G.box[from] || Bn, fill = b.key === 'db' ? cacheFill(s) : 1;
    const it = b.item ? s[R.READERS].find((x) => x.id === b.item) : null, lit = b.item ? on(s, R.READERS) && hotIt(s, R.READERS, b.item) : on(s, R.CACHE);
    for (let c = 0; c < NCELL; c++) {
      const cw = Bn.w / 4, ch = Bn.h / 2, cpw = Bp.w / 4, cph = Bp.h / 2, applied = it && it.tag === 'dirty' && c === 5;
      for (let m = 0; m < CELLN; m++) {
        const i = g0 + c * CELLN + m;
        const P = fill === 0 ? rim(Bn.x + (c % 4) * cw + 3, Bn.y + Math.floor(c / 4) * ch + 3, cw - 6, ch - 6, CELLN, m) : grid(Bn.x + (c % 4) * cw + 3, Bn.y + Math.floor(c / 4) * ch + 3, cw - 6, ch - 6, CELLN, m);
        const Q = grid(Bp.x + (c % 4) * cpw + 3, Bp.y + Math.floor(c / 4) * cph + 3, cpw - 6, cph - 6, CELLN, m);
        const [x, y] = into(i, U.lerp(Q[0], P[0], mv), U.lerp(Q[1], P[1], mv));
        put(o, i, x, y, (fill === 0 ? 0.3 : lit && !end ? 0.8 : 0.45) * dim * form, applied && !end ? 0.6 : fill === 2 && lit ? 0.3 : 0, 0.03, fill === 0 ? 0.95 : 1.15, applied ? GOLD : fill === 2 ? GOLD : fill === 0 ? FAINT : INK);
      }
    }
  }
  /* 볼륨 판 — 설명이 'N 중 M' 이면 세그먼트 N 개로 나누고 앞 M 개를 밝힌다(그 스텝이 바꿨을 때). 잘린 구간은 판 아래의 log 띠 */
  function poseSlab(o, s, prev, into, dim, form, end, p) {
    const [s0] = R0.slab, it = s[R.VOL].find((x) => x.id === SLABID), pit = prev[R.VOL].find((x) => x.id === SLABID), B = G.slab;
    const seg = it ? segOf(it) : null, pseg = pit ? segOf(pit) : null, lit = on(s, R.VOL) && !end, hot = lit && modOf(s, R.VOL).has(SLABID);
    const mv = end ? 1 : show(p, 0.12, 0.4);
    const ptOf = (sg, m) => {
      if (!sg) return grid(B.x, B.y, B.w, B.h, SLAB, m);
      const n = sg[0], per = Math.floor(SLAB / n), j = Math.min(n - 1, Math.floor(m / per)), sw = (B.w - (n - 1) * 8) / n;
      const P = grid(B.x + j * (sw + 8), B.y, sw, B.h, per, m % per);
      return [P[0], P[1], P[2] && m < per * n, j];
    };
    for (let m = 0; m < SLAB; m++) {
      const i = s0 + m, P = ptOf(seg, m), Q = ptOf(pseg, m), read = seg && P[3] < seg[1] && hot;
      const [x, y] = into(i, U.lerp(Q[0], P[0], mv), U.lerp(Q[1], P[1], mv));
      put(o, i, x, y, (lit ? 0.85 : 0.42) * dim * form * (P[2] ? 1 : 0), read ? 0.5 : 0, 0.04, read ? 1.25 : 1.05, read ? GOLD : TAGC[it ? it.tag : 'clean'] ?? INK);
    }
    if (!RANGE) return;
    /* log 띠 — 새 VDL 까지는 남고, 그 뒤 VDL + LAL 까지는 무효(빨강으로 흩어진다). 그 너머는 비어 있다 */
    const [r0] = R0.strip, rg = s[R.VOL].find((x) => x.id === RANGE), prg = prev[R.VOL].find((x) => x.id === RANGE), S2 = G.strip;
    if (!rg) { hide('strip'); return; }
    const fresh = !prg && !end, cut = fresh ? show(p, 0.3, 0.48) : 1, grow = fresh ? show(p, 0.06, 0.3) : 1, rl = on(s, R.VOL) && !end;
    for (let m = 0; m < STRIP; m++) {
      const i = r0 + m, u = (Math.floor(m / 3) + 0.5) / (STRIP / 3), x = S2.x0 + u * (S2.b - S2.x0), y = S2.y + ((m % 3) - 1) * 3.4, dead = x > S2.a;
      const [xx, yy] = into(i, x + (dead ? jit[i * 2] * 6 * cut : 0), y + (dead ? Math.abs(jit[i * 2 + 1]) * 8 * cut : 0));
      put(o, i, xx, yy, (rl ? 0.9 : 0.5) * dim * form * (u * (S2.b - S2.x0) / (S2.x1 - S2.x0) <= grow ? 1 : 0) * (dead ? 1 - 0.55 * cut : 1), dead && cut > 0.5 && rl ? 0.4 : 0, 0.03, 1.1, dead && cut > 0.5 ? RED : INK);
    }
  }
  /* storage 의 log — LSN 자와 같은 눈금. '‥ N 빠짐없이' 까지 record, '‥ M durable' 까지는 초록, 잘린 구간 'LSN a ‥ b' 는 빨강 */
  function poseLog(o, s, prev, into, dim, form, end, mv) {
    const [l0] = R0.slog, X = G.X, lo = G.axL, y = G.slog.y, lit = on(s, R.VOL) && !end;
    const info = (st2) => { const it = st2[R.VOL].find((x) => logOf(x).full != null), g = it ? logOf(it) : { full: null, dur: null }, xr = st2[R.VOL].filter((x) => x.tag === 'x' && rangeOf(x)).map(rangeOf); return { ...g, xr }; };
    const A2 = info(s), B2 = info(prev), full = A2.full != null ? X(A2.full) : lo, pfull = B2.full != null ? X(B2.full) : lo;
    for (let m = 0; m < SLOG; m++) {
      const i = l0 + m, u = (Math.floor(m / 3) + 0.5) / (SLOG / 3), xe = U.lerp(pfull, full, mv), x = lo + u * (xe - lo), yy0 = y + ((m % 3) - 1) * 3.6;
      const v = G.axL + u * (xe - lo), inX = A2.xr.some(([a, b]) => v >= X(a) - 1 && v <= X(b) + 1), dur = A2.dur != null && v <= X(A2.dur);
      const [xx, yy] = into(i, x, yy0 + (inX ? jit[i * 2 + 1] * 4 : 0));
      put(o, i, xx, yy, (lit ? 0.9 : 0.5) * dim * form, inX && lit ? 0.4 : 0, 0.03, 1.15, inX ? RED : dur ? GREEN : INK);
    }
  }
  /* 네트워크 쓰기 — 항목마다 record 줄기(묶음 여섯 알갱이가 한 record). 목적지는 사슬의 머리, PG 면 PG 의 가운데 */
  function poseIO(o, s, prev, into, dim, form, end, p, act, mv) {
    const xs = G.ioX(s), pxs = G.ioX(prev), d = destOf(s, R.IO), pd = destOf(prev, R.IO), ns = d ? nodesOf(d) : [], pns = pd ? nodesOf(pd) : [];
    const tgt = d ? true : null;
    for (const id of IOIDS) {
      const [s0] = R0['io:' + id], it = s[R.IO].find((x) => x.id === id && !isHold(x)), pv = prev[R.IO].find((x) => x.id === id && !isHold(x));
      if ((!it && !(pv && !end)) || !tgt) { hide('io:' + id); continue; }
      const x0 = it ? xs[id] : pxs[id], gone = it ? 0 : show(p, 0.08, 0.3), grow = it && !pv && !end ? show(p, 0.2, 0.46) : 1, lit = on(s, R.IO) && !end;
      for (let m = 0; m < STREAM; m++) {
        const i = s0 + m, rec = Math.floor(m / 9), nrec = Math.floor(STREAM / 9), u = (rec + 0.5) / nrec, w = m % 9;
        if (rec >= nrec) { put(o, i, dust[i * 2], dust[i * 2 + 1], 0, 0, 2, 1, FAINT); continue; }
        const x = x0 + ((w % 3) - 1) * 1.7, y = U.lerp(G.io.y0, G.edgeY, u) + (Math.floor(w / 3) - 1) * 1.7;
        const [xx, yy] = into(i, x + (gone ? jit[i * 2] * 14 * gone : 0), y + (gone ? 10 * gone : 0));
        put(o, i, xx, yy, (lit ? 0.9 : 0.5) * dim * form * (1 - gone) * (u <= grow ? 1 : 0), 0, 0.02, 1.1, TAGC[(it || pv).tag] ?? INK);
      }
    }
    /* 목적지 노드 — 사슬은 이름 붙은 상자 넷, PG 는 같은 상자 여섯. 노드가 바뀌면 그 자리로 옮겨 간다 */
    const sn = act && act.f === R.IO && act.t === R.SN ? knums(act.lb) : null, sent = sn ? sn[0] || 0 : 0, acks = sn ? Math.min(sent, sn[1] || 0) : 0;
    for (let j = 0; j < DESTMAX; j++) {
      const [n0] = R0['n:' + j], q = ns[j], pq = pns[j];
      if (!q && !(pq && !end)) { hide('n:' + j); continue; }
      const Q = q || pq, P0 = pq && q && !end ? pq : null, born = q && !pq && !end ? show(p, 0.14, 0.4) : 1, gone = q ? 0 : show(p, 0.1, 0.3);
      const acked = sn && j < acks && !end ? show(p, 0.3, 0.42) : 0, lit = (on(s, R.IO) || on(s, R.SN)) && !end;
      for (let m = 0; m < NODEN; m++) {
        const i = n0 + m, P = grid(Q.x, Q.y, Q.w, Q.h, NODEN, m), PP = P0 ? grid(P0.x, P0.y, P0.w, P0.h, NODEN, m) : P;
        const [x, y] = into(i, U.lerp(PP[0], P[0], mv), U.lerp(PP[1], P[1], mv));
        put(o, i, x, y, (lit ? 0.85 : 0.45) * dim * form * born * (1 - gone) * (P[2] ? 1 : 0), acked ? 0.6 : 0, 0.03, 1.15, acked > 0.5 ? GREEN : d && d.kind === 'chain' ? GOLD : INK);
      }
    }
    /* batch — 여섯 노드에 모두 가고(0.12 – 0.3), 넷이 응답한다(0.3 – 0.46) */
    if (R0.fan) {
      const [f0, f1] = R0.fan, n = f1 - f0;
      if (!sent || !ns.length || end) { hide('fan'); return; }
      const half = n / 2;
      for (let m = 0; m < n; m++) {
        const i = f0 + m, ack = m >= half, j = ack ? (acks ? Math.floor((m - half) / (half / acks)) : 0) : Math.floor(m / (half / Math.min(sent, ns.length)));
        const node = ns[Math.min(j, ns.length - 1)], nx = node.x + node.w / 2 + jit[i * 2] * 6, ny = node.y + node.h / 2 + jit[i * 2 + 1] * 4;
        const q = ack ? show(p, 0.3, 0.46) : show(p, 0.12, 0.3), a = ack ? q * (1 - show(p, 0.46, 0.52)) : (q > 0 && q < 1 ? 0.9 : 0);
        const sx = xs[d.from] ?? G.L.x0 + G.ww / 2, sy = G.edgeY;
        const x = ack ? U.lerp(nx, sx, q) : U.lerp(sx, nx, q), y = ack ? U.lerp(ny, sy, q) - Math.sin(q * Math.PI) * 14 : U.lerp(sy, ny, q);
        put(o, i, x, y, ack && j >= acks ? 0 : a, 0.8, 0.1, 1.2, ack ? GREEN : ACCENT);
      }
    }
  }
  /* storage 노드의 단계 칸 — 번호가 나온 칸만 채운다(그 항목의 tag 색). 번호 없는 항목은 오른쪽의 page 하나 */
  function poseSN(o, s, prev, into, dim, form, end, p) {
    const lit = on(s, R.SN) && !end, owner = (j) => s[R.SN].find((x) => stagesOf(x.id).includes(j + 1)), powner = (j) => prev[R.SN].find((x) => stagesOf(x.id).includes(j + 1));
    for (let j = 0; j < NCELLS; j++) {
      const [c0] = R0['p:' + j], it = owner(j), born = it && !powner(j) && !end ? show(p, 0.12 + j * 0.02, 0.3 + j * 0.02) : 1, x = G.L.x0 + j * G.pcw + 2, w = G.pcw - 4;
      for (let m = 0; m < PIPEN; m++) {
        const i = c0 + m, P = it ? grid(x + 2, G.pipe.y + 2, w - 4, G.pipe.h - 4, PIPEN, m) : rim(x, G.pipe.y, w, G.pipe.h, PIPEN, m), [xx, yy] = into(i, P[0], P[1]);
        const hot = it && lit && hotIt(s, R.SN, it.id);
        put(o, i, xx, yy, (it ? (hot ? 0.92 : 0.55) * born * (P[2] === false ? 0 : 1) : 0.3) * dim * form, hot && it.tag === 'hold' ? 0.5 : 0, 0.02, it ? 1.25 : 1, it ? (it.tag === 'free' ? INK : TAGC[it.tag] ?? INK) : FAINT);
      }
    }
    for (const id of PAGES) {
      const [g0] = R0['pg:' + id], it = s[R.SN].find((x) => x.id === id), pv = prev[R.SN].find((x) => x.id === id);
      if (!it) { hide('pg:' + id); continue; }
      const x0 = G.L.x0 + G.pw + G.gap, w = Math.min(G.L.x1 - x0, 80), h = G.pipe.h, q = !pv && !end ? show(p, 0.12, 0.42) : 1, hot = lit && hotIt(s, R.SN, id);
      /* page 는 log record 가 모여 만들어진다 — 왼쪽 단계 칸에서 날아와 모인다 */
      for (let m = 0; m < PAGEN; m++) {
        const i = g0 + m, P = m < 28 ? rim(x0, G.pipe.y, w, h, 28, m) : grid(x0 + 4, G.pipe.y + 3, w - 8, h - 6, PAGEN - 28, m - 28), sx = G.L.x0 + ((m % 8) + 0.5) * G.pcw;
        const [xx, yy] = into(i, U.lerp(sx, P[0], q), U.lerp(G.pipe.y + h / 2, P[1], q));
        put(o, i, xx, yy, (hot ? 0.9 : 0.5) * dim * form * (m < 28 || P[2] ? 1 : 0), 0, 0.02, 1.1, TAGC[it.tag] ?? INK);
      }
    }
  }
  /* LSN 자 — 선과 눈금. CPL 은 위의 금빛 눈금, VCL 은 아래 먹색, VDL 은 초록의 굵은 눈금, commit LSN 은 금빛 마름모 */
  function poseAxis(o, s, prev, into, dim, form, end, mv, p) {
    const kk = S.indexOf(s), l = LS[kk + 1], pl = LS[kk], X = G.X, y = G.ax.y, lit = on(s, R.LSNK) && !end;
    const [a0, a1] = R0.ax;
    for (let m = 0; m < a1 - a0; m++) { const i = a0 + m, [x, yy] = into(i, G.axL + ((m + 0.5) / (a1 - a0)) * (G.axR - G.axL), y); put(o, i, x, yy, 0.42 * dim * form, 0, 0.02, 1, FAINT); }
    const mark = (key, v, pv, shape, col, hot) => {
      const [m0] = R0[key];
      if (v == null) { hide(key); return; }
      const x = pv != null ? U.lerp(X(pv), X(v), mv) : X(v), born = pv == null && !end ? show(p, 0.12, 0.36) : 1;
      for (let m = 0; m < MARKN; m++) {
        const i = m0 + m;
        let px, py;
        if (shape === 'up') { px = x + ((m % 2) - 0.5) * 1.4; py = y - 2 - (Math.floor(m / 2) / (MARKN / 2)) * 8; }
        else if (shape === 'bar') { px = x + ((m % 2) - 0.5) * 1.8; py = y - 9 + (Math.floor(m / 2) / (MARKN / 2)) * 18; }
        else if (shape === 'dn') { const r = Math.floor(m / 3), c = (m % 3) - 1; px = x + c * (r / 6) * 4; py = y + 2 + (r / 6) * 7; }
        else { const th = (m / MARKN) * Math.PI * 2; px = x + Math.cos(th) * 4; py = y + Math.sin(th) * 4; }
        const [xx, yy] = into(i, px, py);
        put(o, i, xx, yy, (hot ? 0.95 : 0.55) * dim * form * born, hot ? 0.5 : 0, 0.02, 1.2, col);
      }
    };
    for (let j = 0; j < CPLMAX; j++) mark('mk:c' + j, l.cpl[j] ?? null, pl.cpl.includes(l.cpl[j]) ? l.cpl[j] : null, 'up', GOLD, lit);
    mark('mk:vcl', l.vcl, pl.vcl, 'dn', INK, lit);
    mark('mk:vdl', l.vdl, pl.vdl, 'bar', GREEN, lit);
    mark('mk:cmt', l.cmt, pl.cmt, 'dia', GOLD, R.OPK.some((a) => on(s, a)) && !end || on(s, R.CQ) && !end);
  }

  /* ── 글 ── */
  let shown = -2, tokO = -1, tokW = 0;
  const setO = (lb, o) => { if (Math.abs(o - lb.o) > 0.004) { lb.el.style.opacity = o.toFixed(3); lb.o = o; } };
  const samePos = (a, b) => (!a && !b) || (a && b && a.every((v, i) => v === b[i]));
  function paint(k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, ka = Math.min(k, NK - 1), kb = Math.min(next, NK - 1);
    const TA = TX[ka], TB = TX[kb], T = TX[kk];
    if (kk !== shown) {
      shown = kk;
      for (const [lb, [txt, , cls = '', , html = false]] of T) {
        setText(lb, txt, html);
        for (const c of ['gold', 'red', 'green']) lb.el.classList.toggle(c, cls === c);
        const ps = G.pos[kk].get(lb);
        if (ps) place(lb, ...ps);
      }
    }
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, dimO = (end ? 0.18 : 1) * form, fade = Math.abs(1 - 2 * b);
    for (const [lb, [txt, emph, , vis = true]] of T) {
      const a = TA.get(lb), c = TB.get(lb), same = a && c && a[0] === c[0] && (a[3] ?? true) === (c[3] ?? true) && samePos(G.pos[ka].get(lb), G.pos[kb].get(lb));
      setO(lb, vis && txt && G.pos[kk].get(lb) ? dimO * (emph ? 1 : 0.42) * (same ? 1 : fade) : 0);
    }
    const s = S[ka], act = k < NK && s.step.act ? s.step.act : null;
    const o = act ? show(p, 0.06, 0.12) * (1 - show(p, 0.44, 0.52)) * (1 - b) : 0;
    if (act) {
      const [fx, fy] = anchors(act.f, s)[0], [tx2, ty2] = anchors(act.t, s)[0], e = U.smooth(show(p, 0.08, 0.42));
      const arc = Math.sin(e * Math.PI) * Math.min(46, Math.hypot(tx2 - fx, ty2 - fy) * 0.25);
      if (tok.el.textContent !== act.lb) { tok.el.textContent = act.lb; tokW = 0; }
      tok.el.className = 'wl stn-tok' + (act.gold ? ' gold' : '');
      if (!tokW) tokW = tok.el.offsetWidth;
      const x = Math.max(G.L.x0, Math.min(G.L.x1 - tokW, U.lerp(fx, tx2, e) + 14)), y = Math.max(G.L.y0, U.lerp(fy, ty2, e) - arc - 14);
      tok.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (Math.abs(o - tokO) > 0.004) { tok.el.style.opacity = o.toFixed(3); tokO = o; }
  }

  let css = {};
  const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  function overlay(ctx, k, p, b, t, next = k + 1) {
    if (!G) return;
    const kk = Math.min(b > 0.5 ? next : k, NK - 1), end = (b > 0.5 ? next : k) >= NK, s = S[kk];
    const form = k === 0 ? show(p, 0.18, 0.36) : 1, o = (end ? 0.25 : 1) * form, { L } = G;
    ctx.save(); ctx.lineWidth = 1;
    /* compute · storage 경계 */
    ctx.globalAlpha = 0.45 * o; ctx.strokeStyle = css.faint; ctx.setLineDash([3, 4]);
    seg(ctx, L.x0, G.edgeY, L.x1, G.edgeY);
    /* AZ 칸 — 05 와 같은 점선 상자 */
    if (G.zones) {
      ctx.setLineDash([2, 4]);
      G.zones.forEach((zn, i) => {
        const its = s[R.VOL].filter((x) => zoneOf(x.id) === ZONES[i]), down = !end && its.length && its.every((x) => x.tag === 'x');
        ctx.globalAlpha = (down ? 0.75 : 0.35) * o; ctx.strokeStyle = down ? css.red : css.faint;
        ctx.beginPath(); ctx.roundRect(zn.x + 0.5, zn.y + 0.5, zn.w - 1, zn.h - 1, 8); ctx.stroke();
      });
    }
    ctx.setLineDash([]);
    /* 사슬 — 노드 사이 화살표(차례로 · 동기) */
    if (G.node) {
      const d = destOf(s, R.IO);
      if (d && d.kind === 'chain') {
        const ns = nodesOf(d);
        ctx.globalAlpha = 0.6 * o; ctx.strokeStyle = css.red;
        for (let j = 0; j + 1 < ns.length; j++) {
          const x0 = ns[j].x + ns[j].w + 3, x1 = ns[j + 1].x - 3, y = ns[j].y + ns[j].h / 2;
          seg(ctx, x0, y, x1, y); seg(ctx, x1 - 4, y - 3, x1, y); seg(ctx, x1 - 4, y + 3, x1, y);
        }
      }
      /* gossip — 단계 항목에 gossip 이 있으면 이웃 노드끼리 호 */
      if (d && d.kind === 'pg' && R.SN && s[R.SN].some((x) => /gossip/.test(x.id))) {
        const ns = nodesOf(d), lit = on(s, R.SN) && !end;
        ctx.globalAlpha = (lit ? 0.6 : 0.25) * o; ctx.strokeStyle = lit ? css.gold : css.faint; ctx.setLineDash([2, 3]);
        for (let j = 0; j + 1 < ns.length; j++) { const x0 = ns[j].x + ns[j].w / 2, x1 = ns[j + 1].x + ns[j + 1].w / 2, y = ns[j].y + ns[j].h + 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 9, x1, y); ctx.stroke(); }
        ctx.setLineDash([]);
      }
    }
    /* 잘린 구간의 두 끝 눈금 */
    if (G.strip && RANGE && s[R.VOL].some((x) => x.id === RANGE)) {
      ctx.globalAlpha = 0.85 * o; ctx.lineWidth = 1.5;
      ctx.strokeStyle = css.green; seg(ctx, G.strip.a, G.strip.y - 6, G.strip.a, G.strip.y + 6);
      ctx.strokeStyle = css.red; seg(ctx, G.strip.b, G.strip.y - 6, G.strip.b, G.strip.y + 6);
      ctx.lineWidth = 1;
    }
    /* LAL — 자 밖. 끊김 표시 뒤 화살표 */
    if (G.ax) {
      const l = LS[kk + 1];
      if (l.lalV && l.vdl != null) {
        const y = G.ax.y, x0 = G.axR + 4, x1 = L.x1;
        ctx.globalAlpha = (on(s, R.LSNK) && !end ? 0.8 : 0.4) * o; ctx.strokeStyle = css.faint;
        seg(ctx, x0, y - 4, x0 + 4, y + 4); seg(ctx, x0 + 5, y - 4, x0 + 9, y + 4);
        seg(ctx, x0 + 11, y, x1, y); seg(ctx, x1 - 5, y - 3, x1, y); seg(ctx, x1 - 5, y + 3, x1, y);
      }
    }
    ctx.restore();
  }

  return {
    build(L) { this.theme(); build(L); },
    theme() { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim(); css = { faint: v('--faint'), red: v('--red'), green: v('--green'), gold: v('--gold') }; },
    pose, paint, overlay,
    dispose() { made.forEach((lb) => lb.el.remove()); },
  };
}
