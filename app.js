// 알티노 코딩 실험실 - 화면 담당. 파이썬 실행은 worker.js, 진짜 알티노 통신은 link.js가 해요.
import { Link } from './link.js';

const $ = (id) => document.getElementById(id);
const els = {
  code: $('code'), gutter: $('gutter'), log: $('log'), cv: $('cv'),
  status: $('status'), statusText: $('statusText'),
  connectBtn: $('connectBtn'), fakeBtn: $('fakeBtn'), stopBtn: $('stopBtn'), runBtn: $('runBtn'),
  samples: $('samples'), sensorText: $('sensorText'), wallBtn: $('wallBtn'), hint: $('hint'),
  help: $('help'), moveText: $('moveText'),
};

const SAMPLES = [
  ['01_connect_test.py', '연결 테스트'],
  ['02_go_and_stop.py', '앞으로 갔다 멈추기'],
  ['03_square.py', '네모 그리며 달리기'],
  ['04_scan_sound_light.py', '소리·불빛 번호 탐험'],
  ['05_stop_at_wall.py', '벽 앞에서 멈추기'],
  ['06_parade_demo.py', '지그재그 퍼레이드'],
];
const WALL_CM = 100;
const ZERO_TX = [2, 22, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3];

/* ---------- 상태 ---------- */
const isolated = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
const sharedBuf = isolated ? new SharedArrayBuffer(64) : new ArrayBuffer(64);
const shared = new Int32Array(sharedBuf);   // [0]=진짜연결, [1..6]=IR, [7]=CDS, [8]=BAT, [9]=CNT
let worker = null;
let workerReady = false;
let running = false;
let wallOn = false;
let latestTx = ZERO_TX.slice();
let latestOpen = 0;
let path = [];
let pose = { x: 0, y: 0, h: 90 };
let lastIr = [0, 0, 0, 0, 0, 0];

/* ---------- 결과 창 ---------- */
function say(text, cls) {
  const line = document.createElement('span');
  if (cls) line.className = cls;
  line.textContent = text + '\n';
  els.log.appendChild(line);
  while (els.log.childNodes.length > 400) els.log.removeChild(els.log.firstChild);
  els.log.parentElement.scrollTop = els.log.parentElement.scrollHeight;
}
function sayTag(tag, text) {
  const t = document.createElement('span');
  t.className = 't'; t.textContent = '[' + tag + '] ';
  const rest = document.createElement('span');
  rest.textContent = text + '\n';
  els.log.append(t, rest);
  els.log.parentElement.scrollTop = els.log.parentElement.scrollHeight;
}

/* ---------- 연결 표시 ---------- */
let linkText = '';
function setStatus() {
  let text; let on = false;
  if (!workerReady) text = '파이썬 준비 중…';
  else if (link.connected) { text = '진짜 알티노 연결됨' + (linkText ? ' (' + linkText + ')' : ''); on = true; }
  else { text = '가짜 알티노 (연습 중)'; on = true; }
  els.statusText.textContent = text;
  els.status.classList.toggle('on', on);
  els.connectBtn.hidden = link.connected;
  els.fakeBtn.hidden = !link.connected;
  els.runBtn.disabled = !workerReady || running;
  els.runBtn.textContent = running ? '실행 중…' : '▶ 실행';
  $('legend').textContent = link.connected ? '· 예상 경로예요. 실제와 조금 달라요' : '· 눈금 한 칸 = 50cm (대략)';
}

/* ---------- 파이썬 일꾼 ---------- */
function startWorker() {
  workerReady = false;
  worker = new Worker('worker.js');
  worker.onmessage = onWorkerMessage;
  worker.postMessage({ type: 'init', shared: sharedBuf });
  setStatus();
}

function onWorkerMessage(e) {
  const m = e.data;
  if (m.kind === 'status') els.statusText.textContent = m.text;
  else if (m.kind === 'ready') {
    workerReady = true; setStatus();
    if (!m.isolated) say('안내: 이 주소에서는 진짜 알티노 센서 값을 읽을 수 없어요. 배포 주소(또는 serve.py)로 열어 주세요.', 'dim');
    if (pendingRun) { pendingRun = false; runCode(); }
  } else if (m.kind === 'fatal') {
    say('파이썬을 불러오지 못했어요: ' + m.text, 'err');
    els.statusText.textContent = '파이썬 불러오기 실패 (인터넷 확인)';
  } else if (m.kind === 'out') say(m.s);
  else if (m.kind === 'py') onPython(JSON.parse(m.json));
  else if (m.kind === 'done') onDone(m.result);
}

function onPython(j) {
  if (j.t === 'state') {
    latestTx = j.tx; latestOpen = j.open;
    pose = { x: j.x, y: j.y, h: j.h }; lastIr = j.ir;
    const last = path[path.length - 1];
    if (!last || Math.abs(last.x - j.x) + Math.abs(last.y - j.y) > 0.05) path.push({ x: j.x, y: j.y });
    els.sensorText.textContent = '앞 센서(IR2) ' + j.ir[1] + ' · 밝기 ' + j.cds + ' · 배터리 ' + j.bat;
    scheduleDraw();
  } else if (j.t === 'cmd') say('  ' + j.s, 'dim');
  else if (j.t === 'note') say('안내: ' + j.s, 'err');
}

function onDone(r) {
  running = false;
  latestTx = ZERO_TX.slice(); latestOpen = 0;
  link.emergencyStop();   // 코드가 끝나면 알티노도 멈춰요
  if (r.ok) sayTag('끝', '코드가 끝났어요. 알티노도 멈췄어요.');
  else {
    const where = r.line ? r.line + '번째 줄: ' : '';
    say(where + r.type + ' - ' + r.msg, 'err');
    if (r.hint) say('힌트: ' + r.hint, 'err');
  }
  setStatus();
}

let pendingRun = false;
function runCode() {
  if (running) return;
  if (!workerReady) { pendingRun = true; sayTag('안내', '파이썬이 아직 준비 중이에요. 준비되면 바로 실행할게요.'); return; }
  path = [{ x: 0, y: 0 }]; pose = { x: 0, y: 0, h: 90 };
  running = true; setStatus(); draw();
  sayTag('실행', link.connected ? '진짜 알티노로 달려요!' : '가짜 알티노로 연습해요');
  worker.postMessage({ type: 'run', code: els.code.textContent, wall: wallOn ? WALL_CM : null });
}

function emergencyStop() {
  const wasRunning = running;
  if (worker) worker.terminate();
  running = false; latestTx = ZERO_TX.slice(); latestOpen = 0; pendingRun = false;
  link.emergencyStop();
  startWorker();   // 다음 실행을 위해 새 일꾼을 미리 준비
  sayTag('정지', wasRunning ? '모든 동작을 멈췄어요.' : '알티노에게 멈춤 신호를 보냈어요.');
}

/* ---------- 진짜 알티노 연결 ---------- */
const link = new Link({
  shared,
  getTx: () => (latestOpen ? latestTx : ZERO_TX),
  onLog: (kind, text) => (kind === 'err' ? say(text, 'err') : sayTag('연결', text)),
  onChange: (name) => { linkText = name || ''; setStatus(); },
});
els.connectBtn.onclick = async () => {
  try { await link.connect(new URLSearchParams(location.search).get('serial') === 'fake' ? 'fake' : 'serial'); }
  catch (err) { say(err.message, 'err'); }
  setStatus();
};
els.fakeBtn.onclick = async () => { await link.disconnect(); setStatus(); };
els.stopBtn.onclick = emergencyStop;
els.runBtn.onclick = runCode;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.help.open) {
    emergencyStop();
    if (motionPanel.classList.contains('full')) setBig(false);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(); }
});

/* ---------- 움직임 그림 ---------- */
const g = els.cv.getContext('2d');
let drawQueued = false;
function scheduleDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(() => { drawQueued = false; draw(); }); } }
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const W = els.cv.clientWidth, H = els.cv.clientHeight;
  if (!W || !H) return;
  if (els.cv.width !== Math.round(W * dpr) || els.cv.height !== Math.round(H * dpr)) {
    els.cv.width = Math.round(W * dpr); els.cv.height = Math.round(H * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  // 보이는 범위: 지나온 길이 다 들어오게 자동으로 맞춰요 (최소 240cm x 150cm)
  let minX = -20, maxX = 20, minY = -20, maxY = 20;
  for (const p of path) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  if (wallOn) maxY = Math.max(maxY, WALL_CM + 10);
  const padCm = 25;
  const spanX = Math.max(240, maxX - minX + padCm * 2), spanY = Math.max(150, maxY - minY + padCm * 2);
  const scale = Math.min(W / spanX, H / spanY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const sx = (x) => W / 2 + (x - cx) * scale, sy = (y) => H / 2 - (y - cy) * scale;

  // 눈금 (50cm)
  g.strokeStyle = css('--line'); g.lineWidth = 1;
  const x0 = Math.floor((cx - W / 2 / scale) / 50) * 50, x1 = cx + W / 2 / scale;
  const y0 = Math.floor((cy - H / 2 / scale) / 50) * 50, y1 = cy + H / 2 / scale;
  g.beginPath();
  for (let x = x0; x <= x1; x += 50) { g.moveTo(sx(x), 0); g.lineTo(sx(x), H); }
  for (let y = y0; y <= y1; y += 50) { g.moveTo(0, sy(y)); g.lineTo(W, sy(y)); }
  g.stroke();

  if (wallOn) {
    g.strokeStyle = css('--ink'); g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, sy(WALL_CM)); g.lineTo(W, sy(WALL_CM)); g.stroke();
  }

  // 출발점
  g.fillStyle = css('--sub');
  g.beginPath(); g.arc(sx(0), sy(0), 4, 0, Math.PI * 2); g.fill();

  // 지나온 길
  if (path.length > 1) {
    g.strokeStyle = css('--accent'); g.lineWidth = 3; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(sx(path[0].x), sy(path[0].y));
    for (let i = 1; i < path.length; i++) g.lineTo(sx(path[i].x), sy(path[i].y));
    g.stroke();
  }

  // 알티노 (화살표)
  const rad = (pose.h * Math.PI) / 180, px = sx(pose.x), py = sy(pose.y);
  const fx = Math.cos(rad), fy = -Math.sin(rad);
  g.fillStyle = css('--ink');
  g.beginPath();
  g.moveTo(px + fx * 12, py + fy * 12);
  g.lineTo(px - fx * 8 - fy * 7, py - fy * 8 + fx * 7);
  g.lineTo(px - fx * 8 + fy * 7, py - fy * 8 - fx * 7);
  g.closePath(); g.fill();
}
new ResizeObserver(scheduleDraw).observe(els.cv);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', scheduleDraw);

/* ---------- 3D 화면 + 보는 방향 고르기 ---------- */
let view3d = null;
let curView = 'chase';
try { curView = localStorage.getItem('altino.view') || 'chase'; } catch (_) { /* 저장 못 해도 괜찮아요 */ }

function applyView(name) {
  if (name !== 'flat' && !view3d) name = 'flat';
  curView = name;
  $('v3d').hidden = name === 'flat';
  els.cv.hidden = name !== 'flat';
  if (name !== 'flat') view3d.setView(name);
  document.querySelectorAll('#views [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  try { localStorage.setItem('altino.view', name); } catch (_) { /* */ }
  scheduleDraw();
}
document.querySelectorAll('#views [data-view]').forEach((b) => { b.onclick = () => applyView(b.dataset.view); });

(async () => {
  try {
    const { createView3D } = await import('./view3d.js');
    view3d = createView3D($('v3d'), () => ({
      pose, path, tx: latestOpen ? latestTx : ZERO_TX, wallOn, wallCm: WALL_CM,
      ir: lastIr, real: link.connected,
    }));
  } catch (err) {
    console.warn('3D 화면을 못 열었어요', err);
    document.querySelectorAll('#views [data-view]:not([data-view=flat])').forEach((b) => { b.hidden = true; });
    say('안내: 이 컴퓨터에서는 3D 화면을 열 수 없어서 "간단히 보기"로 보여 드려요.', 'dim');
  }
  applyView(curView);
})();

/* 지금 알티노가 무엇을 하는지 한 줄로 */
function describeTx() {
  const tx = latestOpen ? latestTx : ZERO_TX;
  const wv = (hi, lo) => { const v = hi * 256 + lo; return v > 1000 ? -(v ^ 0xffff) : v; };
  const l = wv(tx[8], tx[9]), r = wv(tx[6], tx[7]), avg = (l + r) / 2;
  const st = tx[5] > 127 ? -(tx[5] ^ 0xff) : tx[5];
  const parts = [];
  if (avg > 0) parts.push('▲ 앞으로 ' + Math.round(Math.abs(avg) / 10) + '%');
  else if (avg < 0) parts.push('▼ 뒤로 ' + Math.round(Math.abs(avg) / 10) + '%');
  else if (l || r) parts.push('제자리에서 돌아요');
  else parts.push('멈춰 있어요');
  if (avg !== 0 || l !== r) parts.push(st > 6 ? '오른쪽으로 꺾는 중' : st < -6 ? '왼쪽으로 꺾는 중' : '핸들 가운데');
  if (tx[19]) parts.push('🔊 소리 ' + tx[19]);
  if (tx[20]) parts.push('💡 불빛 ' + tx[20]);
  return parts.join(' · ');
}
let lastMove = '';
setInterval(() => {
  if (document.hidden) return;
  const t = describeTx();
  if (t !== lastMove) { lastMove = t; els.moveText.textContent = t; }
}, 120);

/* ---------- 크게 보기 (화면 가득) ---------- */
const motionPanel = $('motionPanel');
function setBig(on) {
  motionPanel.classList.toggle('full', on);
  // 진짜 전체 화면을 먼저 시도하고, 안 되는 브라우저는 화면 가득 덮는 방식으로 보여요
  if (on && motionPanel.requestFullscreen) motionPanel.requestFullscreen().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  scheduleDraw();
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && motionPanel.classList.contains('full')) setBig(false);
});
$('fsBtn').onclick = () => setBig(true);
$('fsClose').onclick = () => setBig(false);
$('fsRun').onclick = runCode;
$('fsStop').onclick = emergencyStop;

els.wallBtn.onclick = () => {
  wallOn = !wallOn;
  els.wallBtn.textContent = wallOn ? '가상 벽 치우기' : '가상 벽 놓기';
  if (wallOn) sayTag('안내', '앞쪽 ' + WALL_CM + 'cm 지점에 가상 벽을 놓았어요. 연습 모드의 앞 센서가 벽을 느껴요.');
  scheduleDraw();
};

/* ---------- 코드 편집기 ---------- */
const KW = 'from|import|for|in|range|while|if|elif|else|def|return|try|except|finally|break|continue|pass|and|or|not|True|False|None|print|as|with';
const RE = new RegExp('(#[^\\n]*)|(\'[^\'\\n]*\'|"[^"\\n]*")|\\b(' + KW + ')\\b|\\b(\\d+(?:\\.\\d+)?)\\b', 'g');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlight(src) {
  return esc(src).replace(RE, (m, c, s, k, n) =>
    c ? '<span class="c">' + c + '</span>' : s ? '<span class="s">' + s + '</span>'
      : k ? '<span class="k">' + k + '</span>' : '<span class="n">' + n + '</span>');
}
function caretOffset() {
  const sel = getSelection();
  if (!sel.rangeCount || !els.code.contains(sel.anchorNode)) return null;
  const r = document.createRange();
  r.selectNodeContents(els.code); r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}
function setCaret(offset) {
  const walker = document.createTreeWalker(els.code, NodeFilter.SHOW_TEXT);
  let n; let left = offset;
  while ((n = walker.nextNode())) {
    if (left <= n.length) { const r = document.createRange(); r.setStart(n, left); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
    left -= n.length;
  }
}
function refreshGutter() {
  const n = els.code.textContent.split('\n').length;
  els.gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
}
function setCode(text) { els.code.innerHTML = highlight(text); refreshGutter(); saveCode(); }
function saveCode() { try { localStorage.setItem('altino.code', els.code.textContent); } catch (_) { /* 저장 못 해도 괜찮아요 */ } }

let hlTimer = null;
els.code.addEventListener('input', () => {
  refreshGutter();
  clearTimeout(hlTimer);
  hlTimer = setTimeout(() => {
    const off = caretOffset();
    els.code.innerHTML = highlight(els.code.textContent);
    if (off !== null && document.activeElement === els.code) setCaret(off);
    saveCode();
  }, 500);
});
els.code.addEventListener('scroll', () => { els.gutter.scrollTop = els.code.scrollTop; });
els.code.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
  else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const off = caretOffset() ?? 0;
    const before = els.code.textContent.slice(0, off);
    const line = before.slice(before.lastIndexOf('\n') + 1);
    let indent = line.match(/^ */)[0];
    if (/:\s*(#.*)?$/.test(line)) indent += '    ';
    document.execCommand('insertText', false, '\n' + indent);
  }
});

/* ---------- 샘플 ---------- */
async function loadSample(file, name, btn) {
  try {
    const text = await (await fetch('samples/' + file, { cache: 'no-cache' })).text();
    [...els.samples.querySelectorAll('button')].forEach((b) => b.removeAttribute('aria-current'));
    btn.setAttribute('aria-current', 'true');
    setCode(text.replace(/\n+$/, '') + '\n');
    sayTag('불러옴', name);
  } catch (_) { say('샘플을 불러오지 못했어요. serve.py 또는 배포 주소로 열어 주세요.', 'err'); }
}
SAMPLES.forEach(([file, name], i) => {
  const li = document.createElement('li'); const b = document.createElement('button');
  b.textContent = (i + 1) + '. ' + name;
  b.onclick = () => loadSample(file, name, b);
  li.appendChild(b); els.samples.appendChild(li);
});

/* ---------- 도움말 ---------- */
document.querySelectorAll('[data-help]').forEach((b) => {
  b.onclick = () => {
    els.help.showModal();
    const sec = document.getElementById('help-' + b.dataset.help);
    if (sec) sec.scrollIntoView({ block: 'start' });
  };
});
els.help.addEventListener('click', (e) => { if (e.target === els.help) els.help.close(); });
document.addEventListener('click', (e) => { if (e.target.matches && e.target.matches('[data-close]')) els.help.close(); });

/* ---------- 시작 ---------- */
let saved = null;
try { saved = localStorage.getItem('altino.code'); } catch (_) { /* 없어도 괜찮아요 */ }
if (saved && saved.trim()) { setCode(saved); say('지난번에 쓰던 코드를 불러왔어요. 새로 시작하려면 왼쪽 샘플을 눌러요.', 'dim'); }
else els.samples.querySelector('button').click();
startWorker();
setStatus();

// 시험용 (선생님 점검): 콘솔에서 __altino 로 상태를 볼 수 있어요
window.__altino = { get state() { return { running, workerReady, latestTx, path: path.length, pose, connected: link.connected }; }, link, runCode, setCode };
