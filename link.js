// 진짜 알티노와의 연결 담당 (Web Serial). 80ms마다 쪽지를 주고받아요.
// 알티노 라이트와 일반 알티노는 쪽지 모양이 달라서, 고른 기종(model)에 맞춰 만들고 읽어요.
//
//  [lite]   보내는 쪽지 22바이트: [2, 22, 검사값, 1, 1, 핸들, 오른쪽바퀴(2), 왼쪽바퀴(2), 화면(9), 소리, 불빛, 3]
//           검사값 = 3~20번째 바이트를 다 더한 값을 256으로 나눈 나머지
//           받는 쪽지 22바이트: 5~16 = 적외선 6개(2바이트씩), 17~18 = 밝기, 19~20 = 배터리
//  [altino] 보내는 쪽지 28바이트: [2, 28, 검사값, 1, 10, 핸들, 0, 오른쪽바퀴(2), 0, 왼쪽바퀴(2), 글자 1칸 + 점 8줄, 불빛 앞쪽, 소리, 불빛 뒤쪽, 1, 0, 255, 3]
//           검사값 = 1번째 + 3~27번째 바이트를 다 더한 값을 256으로 나눈 나머지 (21번째 바이트 맨 끝 비트는 1로 켜요)
//           받는 쪽지 56바이트: 7~18 = 적외선 6개, 43~44 = 밝기, 47~48 = 배터리

const BAUD = 115200;
const TICK_MS = 80;

// 다른 탭(AI 채팅 등)을 보는 동안 브라우저가 setInterval을 1초에 한 번으로 늦춰서 알티노가 멈칫해요.
// 작은 일꾼(Worker)이 박자를 대신 세어 주면 늦춰지지 않아요. 일꾼을 못 만들면 예전 방식으로 돌아가요.
function startTicker(fn, ms) {
  try {
    const url = URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),' + ms + ')'], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = fn;
    return { stop: () => w.terminate() };
  } catch (_) {
    const id = setInterval(fn, ms);
    return { stop: () => clearInterval(id) };
  }
}

export const MODELS = {
  lite: { id: 'lite', label: '알티노 라이트', txLen: 22, rxLen: 22, module: 'AltinoLite' },
  altino: { id: 'altino', label: '알티노', txLen: 28, rxLen: 56, module: 'Altino' },
};

export function zeroTx(model) {
  const z = new Array(MODELS[model].txLen).fill(0);
  if (model === 'altino') {
    z[0] = 2; z[1] = 28; z[3] = 1; z[4] = 10; z[24] = 1; z[27] = 3;
  } else {
    z[0] = 2; z[1] = 22; z[3] = 1; z[4] = 1; z[21] = 3;
  }
  return z;
}

export function buildPacket(tx, model = 'lite') {
  const p = Uint8Array.from(tx);
  if (model === 'altino') {
    p[0] = 2; p[1] = 28; p[3] = 1; p[4] = 10; p[26] = 255; p[27] = 3;
    p[21] |= 1;
    let sum = p[1];
    for (let i = 3; i <= 27; i++) sum += p[i];
    p[2] = sum % 256;
    return p;
  }
  p[0] = 2; p[1] = 22; p[3] = 1; p[4] = 1; p[21] = 3;
  let sum = 0;
  for (let i = 3; i <= 20; i++) sum += p[i];
  p[2] = sum % 256;
  return p;
}

/** 받은 바이트 더미에서 올바른 쪽지를 찾아요. 쪽지를 찾으면 센서 값을, 없으면 null */
export function parseFrames(buf, model = 'lite') {
  let found = null;
  let i = 0;
  if (model === 'altino') {
    while (i + 56 <= buf.length) {
      if (buf[i] === 2 && buf[i + 1] === 56 && buf[i + 55] === 3) {
        let sum = buf[i] + buf[i + 1];
        for (let k = 3; k <= 55; k++) sum += buf[i + k];
        if (sum % 256 === buf[i + 2]) {
          const d = buf.slice(i, i + 56);
          found = {
            ir: [0, 1, 2, 3, 4, 5].map((n) => d[7 + 2 * n] * 256 + d[8 + 2 * n]),
            cds: d[43] * 256 + d[44],
            bat: d[47] * 256 + d[48],
          };
          i += 56;
          continue;
        }
      }
      i++;
    }
    return { found, rest: buf.slice(i) };
  }
  while (i + 22 <= buf.length) {
    if (buf[i] === 2 && buf[i + 1] === 22 && buf[i + 21] === 3) {
      let sum = 0;
      for (let k = 3; k <= 20; k++) sum += buf[i + k];
      if (sum % 256 === buf[i + 2]) {
        const d = buf.slice(i, i + 22);
        found = {
          ir: [0, 1, 2, 3, 4, 5].map((n) => d[5 + 2 * n] * 256 + d[6 + 2 * n]),
          cds: d[17] * 256 + d[18],
          bat: d[19] * 256 + d[20],
        };
        i += 22;
        continue;
      }
    }
    i++;
  }
  return { found, rest: buf.slice(i) };
}

/* ---------- 진짜 연결 (블루투스가 만든 COM 포트) ---------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class SerialTransport {
  constructor() { this.name = ''; this.gen = 0; this.isOpen = false; }
  async open(onBytes, onLost, phase = () => {}) {
    this.onBytes = onBytes; this.onLost = onLost; this.phase = phase;
    this.port = await navigator.serial.requestPort();
    phase('알티노에 연결하는 중…');
    await this.openPort();
  }
  // 포트 열기. 맥/윈도우 블루투스는 가끔 첫 시도에 실패하거나 지난 연결이 덜 닫혀 있어서,
  // 이미 열려 있으면 먼저 닫고, 실패하면 잠깐 쉬었다 최대 3번 다시 해 봐요
  async openPort() {
    let lastErr = null;
    for (let n = 0; n < 3; n++) {
      if (n > 0 && this.phase) this.phase('포트를 다시 여는 중 (' + (n + 1) + '/3)…');
      try {
        await this.port.open({ baudRate: BAUD });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (err && err.name === 'InvalidStateError') await this.closePort();
        await wait(600);
      }
    }
    if (lastErr) throw lastErr;
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
    this.isOpen = true;
    const gen = ++this.gen, reader = this.reader;
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) this.onBytes(value);
        }
      } catch (_) { /* 연결이 끊김 */ }
      if (gen === this.gen && this.isOpen) this.onLost();   // 일부러 닫은 게 아닐 때만
    })();
  }
  // 열려 있는 길을 깨끗이 닫아요 (두 번 불러도 괜찮아요)
  async closePort() {
    this.isOpen = false; this.gen++;
    try { if (this.reader) await this.reader.cancel(); } catch (_) { /* 이미 닫힘 */ }
    try { if (this.reader) this.reader.releaseLock(); } catch (_) { /* */ }
    try { if (this.writer) this.writer.releaseLock(); } catch (_) { /* */ }
    this.reader = null; this.writer = null;
    try { await this.port.close(); } catch (_) { /* */ }
  }
  // 알티노가 답이 없을 때: 같은 포트를 한 번 닫았다 다시 열어요 (목록을 다시 고를 필요 없어요)
  async reopen() {
    await this.closePort();
    await wait(800);
    await this.openPort();
  }
  async write(bytes) {
    if (!this.writer) throw new Error('not open');
    // 블루투스가 멈추면 write가 끝나지 않을 때가 있어서, 2초 안에 안 끝나면 끊김으로 봐요
    await Promise.race([
      this.writer.write(bytes),
      wait(2000).then(() => { throw new Error('write timeout'); }),
    ]);
  }
  async close() { await this.closePort(); }
}

/* ---------- 연습용 가짜 장치: 알티노 없이 통신 규칙을 시험해 봐요 (?serial=fake) ---------- */
export class FakeDevice {
  constructor(model = 'lite') {
    this.model = model;
    this.len = MODELS[model].txLen;
    this.name = '연습 장치';
    this.received = [];                  // 받은 쪽지 기록 (최근 200개)
    this.bad = 0;                        // 규칙에 어긋난 쪽지 수
    this.state = { left: 0, right: 0, steering: 0, sound: 0, light: 0, display: 0 };
    this.ir = [111, 222, 333, 444, 555, 666];
    this.cds = 777; this.bat = 888;
    this.pending = [];
  }
  async open(onBytes) { this.onBytes = onBytes; }
  async write(bytes) {
    this.pending.push(...bytes);
    while (this.pending.length >= this.len) {
      const f = this.pending.splice(0, this.len);
      if (!this.check(f)) { this.bad++; continue; }
      this.decode(f);
      this.reply();
    }
  }
  check(f) {
    let sum = 0;
    if (this.model === 'altino') {
      if (f[0] !== 2 || f[1] !== 28 || f[3] !== 1 || f[4] !== 10 || f[26] !== 255 || f[27] !== 3) return false;
      sum = f[1];
      for (let i = 3; i <= 27; i++) sum += f[i];
      return sum % 256 === f[2];
    }
    if (f[0] !== 2 || f[1] !== 22 || f[3] !== 1 || f[4] !== 1 || f[21] !== 3) return false;
    for (let i = 3; i <= 20; i++) sum += f[i];
    return sum % 256 === f[2];
  }
  decode(f) {
    if (this.model === 'altino') {
      // 일반 알티노: 음수 바퀴는 32768 - 값, 음수 핸들은 128 - 값
      const wheel = (hi, lo) => { const v = hi * 256 + lo; return v > 1000 ? -(v - 32768) : v; };
      this.state = {
        steering: f[5] > 127 ? -(f[5] - 128) : f[5],
        right: wheel(f[7], f[8]), left: wheel(f[10], f[11]),
        display: f[12], sound: f[22], light: ((f[21] & 0xfe) << 8) | f[23],
      };
    } else {
      // 알티노 라이트: 음수는 (-값)^0xffff / (-값)^0xff 로 담겨 있어요
      const wheel = (hi, lo) => { const v = hi * 256 + lo; return v > 1000 ? -(v ^ 0xffff) : v; };
      this.state = {
        steering: f[5] > 127 ? -(f[5] ^ 0xff) : f[5],
        right: wheel(f[6], f[7]), left: wheel(f[8], f[9]),
        display: f[10], sound: f[19], light: f[20],
      };
    }
    this.received.push({ t: Date.now(), ...this.state });
    if (this.received.length > 200) this.received.shift();
  }
  reply() {
    let p;
    if (this.model === 'altino') {
      p = new Uint8Array(56);
      p[0] = 2; p[1] = 56; p[55] = 3;
      this.ir.forEach((v, n) => { p[7 + 2 * n] = v >> 8; p[8 + 2 * n] = v & 255; });
      p[43] = this.cds >> 8; p[44] = this.cds & 255; p[47] = this.bat >> 8; p[48] = this.bat & 255;
      let sum = p[0] + p[1];
      for (let i = 3; i <= 55; i++) sum += p[i];
      p[2] = sum % 256;
    } else {
      p = new Uint8Array(22);
      p[0] = 2; p[1] = 22; p[3] = 1; p[4] = 1; p[21] = 3;
      this.ir.forEach((v, n) => { p[5 + 2 * n] = v >> 8; p[6 + 2 * n] = v & 255; });
      p[17] = this.cds >> 8; p[18] = this.cds & 255; p[19] = this.bat >> 8; p[20] = this.bat & 255;
      let sum = 0;
      for (let i = 3; i <= 20; i++) sum += p[i];
      p[2] = sum % 256;
    }
    // 일부러 두 토막으로 나눠 보내서, 받는 쪽이 이어 붙이는지 시험해요
    setTimeout(() => this.onBytes(p.slice(0, 9)), 2);
    setTimeout(() => this.onBytes(p.slice(9)), 6);
  }
  async close() {}
}

/* ---------- 연결 관리 ---------- */
export class Link {
  constructor({ shared, getTx, onLog, onChange, onPhase = () => {}, model = 'lite' }) {
    this.shared = shared; this.getTx = getTx; this.onLog = onLog; this.onChange = onChange; this.onPhase = onPhase;
    this.model = model;
    this.on = false; this.rx = []; this.transport = null; this.timer = null; this.busy = false;
    this.gotFrame = false; this.watch = null;
  }
  get connected() { return this.on; }

  async connect(kind) {
    if (this.on) return;
    if (kind === 'serial' && !('serial' in navigator)) {
      throw new Error('이 브라우저는 알티노 연결을 지원하지 않아요. 크롬(Chrome) 또는 엣지(Edge)로 열어 주세요. (코드 연습은 어느 브라우저에서나 돼요)');
    }
    const t = kind === 'fake' ? new FakeDevice(this.model) : new SerialTransport();
    try {
      await t.open((bytes) => this.onBytes(bytes), () => this.lost(), (m) => this.onPhase(m));
    } catch (err) {
      this.onPhase('');
      if (err && err.name === 'NotFoundError') throw new Error('연결할 장치를 고르지 않았어요. 다시 [알티노 연결하기]를 눌러 보세요.');
      throw new Error('포트를 열지 못했어요 (자동으로 3번 시도했어요). ① 알티노 전원을 껐다가 다시 켜기 ② 컴퓨터 블루투스에 짝지어졌는지 (맥은 목록에서 cu. 로 시작하는 이름, 윈도우는 포트가 둘이면 다른 쪽도 눌러 보기) ③ IDLE 같은 다른 프로그램이나 다른 탭이 같은 포트를 쓰고 있지 않은지 ④ 그래도 안 되면 페이지 새로고침(F5). 계속 안 되면 [도움말 → 연결이 안 될 때]의 "블루투스 처음부터 다시"를 따라 해요. (' + (err && err.name) + ')');
    }
    this.transport = t; this.on = true; this.rx = []; this.gotFrame = false;
    this.shared.fill(0, 1, 10); this.shared[0] = 1;
    this.retries = 0; this.reopening = false;
    this.timer = startTicker(() => this.tick(), TICK_MS);
    if (kind === 'serial' && !this.onUsbGone) {
      // 블루투스가 통째로 사라지면(알티노 전원 꺼짐 등) 바로 알아차려요
      this.onUsbGone = (e) => { if (this.on && this.transport && e.target === this.transport.port) this.lost(); };
      navigator.serial.addEventListener('disconnect', this.onUsbGone);
    }
    if (kind === 'serial') this.onPhase('알티노 응답을 확인하는 중…');   // 첫 답이 올 때까지 깜빡여요
    this.armWatch();
    this.onLog('ok', '알티노와 연결했어요. 이제 ▶ 실행을 누르면 진짜 알티노가 움직여요!');
    this.onChange(t.name);
  }

  // 3초 동안 알티노에게서 올바른 답이 하나도 없으면: 먼저 같은 포트를 다시 열어 보고(최대 2번),
  // 그래도 안 되면 기종·전원·재시작 순서를 알려 줘요 (연결은 그대로 두어서, 답만 못 읽는 경우도 쓸 수 있어요)
  armWatch() {
    clearTimeout(this.watch);
    this.watch = setTimeout(async () => {
      if (!this.on || this.gotFrame) return;
      const t = this.transport;
      if (this.retries < 2 && t && typeof t.reopen === 'function') {
        this.retries++;
        this.reopening = true;
        this.onPhase('답이 없어서 다시 시도하는 중 (' + this.retries + '/2)…');
        this.onLog('ok', '알티노가 답이 없어서 연결을 다시 시도해요 (' + this.retries + '/2)…');
        try { await t.reopen(); }
        catch (_) { this.reopening = false; this.lost(); return; }
        this.reopening = false; this.rx = [];
        this.onPhase('알티노 응답을 확인하는 중…');
        this.armWatch();
        return;
      }
      this.onPhase('');
      this.onLog('err', '알티노에게서 답이 없어요. 이렇게 해 보세요. ① 위에서 고른 기종(' + MODELS[this.model].label + ')이 지금 로봇과 같은지 ② 알티노 전원을 껐다가 켜기 ③ [가짜 알티노로 연습]을 눌러 연결 끊기 ④ 페이지 새로고침(F5) 후 다시 [알티노 연결하기]. 다른 컴퓨터가 먼저 연결해 둔 로봇은 전원을 껐다 켜야 풀려요. 그래도 안 되면 [도움말 → 연결이 안 될 때]의 "블루투스 처음부터 다시"를 따라 해요.');
    }, 3000);
  }

  async tick() {
    if (!this.on || this.busy || this.reopening) return;
    this.busy = true;
    try { await this.transport.write(buildPacket(this.getTx(), this.model)); }
    catch (_) { this.busy = false; this.lost(); return; }
    this.busy = false;
  }

  onBytes(bytes) {
    this.rx.push(...bytes);
    if (this.rx.length > 800) this.rx = this.rx.slice(-400);
    const { found, rest } = parseFrames(this.rx, this.model);
    this.rx = rest;
    if (found) {
      const s = this.shared;
      found.ir.forEach((v, n) => { s[1 + n] = v; });
      s[7] = found.cds; s[8] = found.bat; s[9] = (s[9] + 1) | 0;
      this.last = found;
      if (!this.gotFrame) this.onPhase('');
      this.gotFrame = true;
    }
  }

  /** 긴급 정지: 기다리지 않고 바로 "멈춰" 쪽지를 보내요 */
  async emergencyStop() {
    if (!this.on) return;
    const zero = buildPacket(zeroTx(this.model), this.model);
    for (let n = 0; n < 3; n++) { try { await this.transport.write(zero); } catch (_) { break; } }
  }

  lost() {
    if (!this.on) return;
    const t = this.transport;
    this.cleanup();
    // 끊긴 포트를 그냥 두면 다음 연결 때 "포트를 열지 못했어요"가 나와서, 깨끗이 닫아 둬요
    if (t) Promise.resolve(t.close()).catch(() => {});
    this.onLog('err', '알티노와 연결이 끊겼어요. 알티노 전원을 껐다 켠 뒤 다시 [알티노 연결하기]를 눌러 주세요.');
    this.onChange('');
  }

  async disconnect() {
    if (!this.on) return;
    await this.emergencyStop();
    const t = this.transport;
    this.cleanup();
    await t.close();
    this.onLog('ok', '알티노 연결을 끊었어요. 지금은 가짜 알티노로 연습해요.');
    this.onChange('');
  }

  cleanup() {
    this.on = false; if (this.timer) this.timer.stop(); this.timer = null;
    clearTimeout(this.watch); this.watch = null;
    this.shared[0] = 0;
    this.onPhase('');
  }
}
