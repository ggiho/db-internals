/* playwright 찾기 — sweep.js 의 것을 그대로 옮겼다(그쪽 머리말의 경위 참고). storysweep.js 가 쓴다.
   playwright 는 이 프로젝트에 설치하지 않는다(브라우저까지 수백 MB). PLAYWRIGHT_PATH 를 먼저 보고,
   없으면 npx 캐시와 ~/src · ~/30_Projects 아래 node_modules 를 훑어, 요구하는 브라우저가 실제로
   내려와 있는 설치를 고른다. 디렉터리는 package.json 의 main 을 붙여 file:// URL 로 바꾼다
   (ESM 의 import() 는 디렉터리를 해석하지 못한다). */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

function spec() {
  const home = os.homedir();
  const cands = [process.env.PLAYWRIGHT_PATH];
  const npx = path.join(home, '.npm', '_npx');
  try { for (const d of fs.readdirSync(npx)) cands.push(path.join(npx, d, 'node_modules', 'playwright')); } catch { /* 없으면 넘어간다 */ }
  const walk = (dir, depth) => {
    if (depth < 0) return;
    let names;
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      if (e.name === 'node_modules') { cands.push(path.join(dir, 'node_modules', 'playwright')); continue; }
      walk(path.join(dir, e.name), depth - 1);
    }
  };
  for (const base of [path.join(home, 'src'), path.join(home, '30_Projects')]) walk(base, 3);
  const resolve1 = (c) => {
    let t = path.resolve(c);
    if (!fs.existsSync(t)) return null;
    if (fs.statSync(t).isDirectory()) {
      let main = 'index.js';
      const pj = path.join(t, 'package.json');
      if (fs.existsSync(pj)) main = JSON.parse(fs.readFileSync(pj, 'utf8')).main || main;
      t = path.join(t, main);
    }
    return fs.existsSync(t) ? t : null;
  };
  const browserReady = (c) => {
    try {
      const bj = path.join(path.dirname(path.resolve(c)), 'playwright-core', 'browsers.json');
      const want = JSON.parse(fs.readFileSync(bj, 'utf8')).browsers.find((b) => b.name === 'chromium-headless-shell');
      return !!want && fs.existsSync(path.join(home, 'Library', 'Caches', 'ms-playwright', 'chromium_headless_shell-' + want.revision));
    } catch { return false; }
  };
  const found = [];
  for (const c of cands) {
    if (!c) continue;
    try {
      const t = resolve1(c);
      if (!t) continue;
      if (process.env.PLAYWRIGHT_PATH && c === process.env.PLAYWRIGHT_PATH) return pathToFileURL(t).href;
      found.push([t, browserReady(c)]);
    } catch { /* 다음 후보 */ }
  }
  const pick = found.find(([, ok]) => ok) || found[0];
  if (pick && !pick[1]) console.error('  주의 : 고른 playwright 의 브라우저가 안 보인다 — npx playwright install chromium-headless-shell 이 필요할 수 있다');
  return pick ? pathToFileURL(pick[0]).href : 'playwright';
}

export async function loadChromium() {
  const s = spec();
  const mod = await import(s).catch((e) => { console.error('playwright 를 찾을 수 없다 (' + s + ') — ' + e.message); process.exit(2); });
  const chromium = mod.chromium || (mod.default && mod.default.chromium);
  if (!chromium) { console.error('playwright 를 불렀지만 chromium 이 없다 : ' + s); process.exit(2); }
  return chromium;
}
