// 파이썬을 돌리는 일꾼(Worker). 화면과 따로 일하니까 코드가 오래 달려도 화면이 안 멈춰요.
// 긴급 정지는 이 일꾼을 통째로 끄는(terminate) 방식이라 파이썬이 무슨 짓을 해도 확실히 멈춰요.
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';

let pyodide = null;
let shared = null;          // Int32Array: [실제연결?, IR1..IR6, CDS, BAT, CNT, 잠자기칸, ...]
let wallCm = -1;
let canWait = false;

function post(obj) { self.postMessage(obj); }

const host = {
  now: () => performance.now(),
  sleep: (ms) => {
    if (canWait) { Atomics.wait(shared, 10, 0, ms); return; }
    const end = performance.now() + ms;
    while (performance.now() < end) { /* 기다리는 중 */ }
  },
  real: () => (shared ? shared[0] : 0),
  wall: () => wallCm,
  shared: () => Array.from(shared),
  emit: (json) => post({ kind: 'py', json }),
};

async function init(sharedBuf) {
  shared = new Int32Array(sharedBuf);
  canWait = (typeof SharedArrayBuffer !== 'undefined') && (sharedBuf instanceof SharedArrayBuffer);
  post({ kind: 'status', text: '파이썬을 불러오는 중… (처음엔 10~20초 걸려요)' });
  // 내 폴더(vendor/)의 파이썬 엔진을 먼저 쓰고, 없거나 실패하면 인터넷 창고에서 가져와요
  try {
    const local = new URL('vendor/pyodide/', self.location.href).href;
    importScripts(local + 'pyodide.js');
    pyodide = await loadPyodide({ indexURL: local });
  } catch (_) {
    importScripts(PYODIDE_BASE + 'pyodide.js');
    pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });
  }
  pyodide.registerJsModule('_host', host);
  pyodide.setStdout({ batched: (s) => post({ kind: 'out', s }) });
  pyodide.setStderr({ batched: (s) => post({ kind: 'out', s }) });
  for (const f of ['AltinoLite.py', 'runner.py']) {
    const text = await (await fetch('py/' + f, { cache: 'no-cache' })).text();
    pyodide.FS.writeFile('/home/pyodide/' + f, text);
  }
  pyodide.runPython('from runner import run_user');
  post({ kind: 'ready', isolated: canWait });
}

function run(code, wall) {
  wallCm = (typeof wall === 'number') ? wall : -1;
  let result;
  try {
    const raw = pyodide.globals.get('run_user')(code);
    result = JSON.parse(raw);
  } catch (e) {
    result = { ok: false, type: 'InternalError', msg: String(e), line: null, hint: '' };
  }
  post({ kind: 'done', result });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') await init(m.shared);
    else if (m.type === 'run') run(m.code, m.wall);
  } catch (err) {
    post({ kind: 'fatal', text: String(err) });
  }
};
