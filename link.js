// 진짜 알티노와의 연결 담당 (Web Serial). 진짜 AltinoLite.py 와 같은 22바이트 쪽지를 80ms마다 주고받아요.
//
//  보내는 쪽지(22바이트): [2, 22, 검사값, 1, 1, 핸들, 오른쪽바퀴(2), 왼쪽바퀴(2), 화면(9), 소리, 불빛, 3]
//  검사값 = 3~20번째 바이트를 다 더한 값을 256으로 나눈 나머지
//  받는 쪽지(22바이트): 같은 모양. 5~16번째 = 적외선 센서 6개(2바이트씩), 17~18 = 밝기, 19~20 = 배터리

const BAUD = 115200;
const TICK_MS = 80;

export function buildPacket(tx) {
  const p = Uint8Array.from(tx);
  p[0] = 2; p[1] = 22; p[3] = 1; p[4] = 1; p[21] = 3;
  let sum = 0;
  for (let i = 3; i <= 20; i++) sum += p[i];
  p[2] = sum % 256;
  return p;
}

/** 받은 바이트 더미에서 올바른 쪽지를 찾아요. 쪽지를 찾으면 센서 값을, 없으면 null */
export function parseFrames(buf) {
  let found = null;
  let i = 0;
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
class SerialTransport {
  constructor() { this.name = ''; }
  async open(onBytes, onLost) {
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: BAUD });
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
    this.closing = false;
    (async () => {
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) onBytes(value);
        }
      } catch (_) { /* 연결이 끊김 */ }
      if (!this.closing) onLost();
    })();
  }
  async write(bytes) { await this.writer.write(bytes); }
  async close() {
    this.closing = true;
    try { await this.reader.cancel(); } catch (_) { /* 이미 닫힘 */ }
    try { this.reader.releaseLock(); } catch (_) { /* */ }
    try { this.writer.releaseLock(); } catch (_) { /* */ }
    try { await this.port.close(); } catch (_) { /* */ }
  }
}

/* ---------- 연습용 가짜 장치: 알티노 없이 통신 규칙을 시험해 봐요 (?serial=fake) ---------- */
export class FakeDevice {
  constructor() {
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
    while (this.pending.length >= 22) {
      const f = this.pending.splice(0, 22);
      if (!this.check(f)) { this.bad++; continue; }
      this.decode(f);
      this.reply();
    }
  }
  check(f) {
    if (f[0] !== 2 || f[1] !== 22 || f[3] !== 1 || f[4] !== 1 || f[21] !== 3) return false;
    let sum = 0;
    for (let i = 3; i <= 20; i++) sum += f[i];
    return sum % 256 === f[2];
  }
  decode(f) {
    // 진짜 알티노가 쪽지를 읽는 방식 (음수는 (-값)^0xffff / (-값)^0xff 로 담겨 있어요)
    const wheel = (hi, lo) => { const v = hi * 256 + lo; return v > 1000 ? -(v ^ 0xffff) : v; };
    this.state = {
      steering: f[5] > 127 ? -(f[5] ^ 0xff) : f[5],
      right: wheel(f[6], f[7]), left: wheel(f[8], f[9]),
      display: f[10], sound: f[19], light: f[20],
    };
    this.received.push({ t: Date.now(), ...this.state });
    if (this.received.length > 200) this.received.shift();
  }
  reply() {
    const p = new Uint8Array(22);
    p[0] = 2; p[1] = 22; p[3] = 1; p[4] = 1; p[21] = 3;
    this.ir.forEach((v, n) => { p[5 + 2 * n] = v >> 8; p[6 + 2 * n] = v & 255; });
    p[17] = this.cds >> 8; p[18] = this.cds & 255; p[19] = this.bat >> 8; p[20] = this.bat & 255;
    let sum = 0;
    for (let i = 3; i <= 20; i++) sum += p[i];
    p[2] = sum % 256;
    // 일부러 두 토막으로 나눠 보내서, 받는 쪽이 이어 붙이는지 시험해요
    setTimeout(() => this.onBytes(p.slice(0, 9)), 2);
    setTimeout(() => this.onBytes(p.slice(9)), 6);
  }
  async close() {}
}

/* ---------- 연결 관리 ---------- */
export class Link {
  constructor({ shared, getTx, onLog, onChange }) {
    this.shared = shared; this.getTx = getTx; this.onLog = onLog; this.onChange = onChange;
    this.on = false; this.rx = []; this.transport = null; this.timer = null; this.busy = false;
  }
  get connected() { return this.on; }

  async connect(kind) {
    if (this.on) return;
    if (kind === 'serial' && !('serial' in navigator)) {
      throw new Error('이 브라우저는 알티노 연결을 지원하지 않아요. 크롬(Chrome) 또는 엣지(Edge)로 열어 주세요. (코드 연습은 어느 브라우저에서나 돼요)');
    }
    const t = kind === 'fake' ? new FakeDevice() : new SerialTransport();
    try {
      await t.open((bytes) => this.onBytes(bytes), () => this.lost());
    } catch (err) {
      if (err && err.name === 'NotFoundError') throw new Error('연결할 장치를 고르지 않았어요. 다시 [알티노 연결하기]를 눌러 보세요.');
      throw new Error('포트를 열지 못했어요. ① 알티노 전원이 켜져 있는지 ② 윈도우 블루투스에 짝지어졌는지 ③ IDLE 같은 다른 프로그램이 같은 포트를 쓰고 있지 않은지 확인해 보세요. (' + (err && err.name) + ')');
    }
    this.transport = t; this.on = true; this.rx = [];
    this.shared.fill(0, 1, 10); this.shared[0] = 1;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.onLog('ok', '알티노와 연결했어요. 이제 ▶ 실행을 누르면 진짜 알티노가 움직여요!');
    this.onChange(t.name);
  }

  async tick() {
    if (!this.on || this.busy) return;
    this.busy = true;
    try { await this.transport.write(buildPacket(this.getTx())); }
    catch (_) { this.lost(); }
    this.busy = false;
  }

  onBytes(bytes) {
    this.rx.push(...bytes);
    if (this.rx.length > 400) this.rx = this.rx.slice(-200);
    const { found, rest } = parseFrames(this.rx);
    this.rx = rest;
    if (found) {
      const s = this.shared;
      found.ir.forEach((v, n) => { s[1 + n] = v; });
      s[7] = found.cds; s[8] = found.bat; s[9] = (s[9] + 1) | 0;
      this.last = found;
    }
  }

  /** 긴급 정지: 기다리지 않고 바로 "멈춰" 쪽지를 보내요 */
  async emergencyStop() {
    if (!this.on) return;
    const zero = buildPacket([2, 22, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]);
    for (let n = 0; n < 3; n++) { try { await this.transport.write(zero); } catch (_) { break; } }
  }

  lost() {
    if (!this.on) return;
    this.cleanup();
    this.onLog('err', '알티노와 연결이 끊겼어요. 알티노 전원과 블루투스를 확인하고 다시 연결해 주세요.');
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
    this.on = false; clearInterval(this.timer); this.timer = null;
    this.shared[0] = 0;
  }
}
