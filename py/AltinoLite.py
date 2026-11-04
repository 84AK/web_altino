# 웹앱용 AltinoLite - 진짜 AltinoLite.py 와 같은 이름·같은 명령 (브라우저 안에서 돌아가요)
#
# 진짜 라이브러리와 다른 점 (내 코드는 한 글자도 바꾸지 않아도 돼요)
#  - Open(포트이름): 포트 이름은 무시해요. 연결은 화면 위의 [알티노 연결하기]로 해요.
#  - 명령은 tx_d 쪽지에 적기만 하고, 80ms마다 실제 전송은 웹앱(자바스크립트)이 해요.
#  - 코드가 끝나면 웹앱이 알아서 알티노를 멈춰 줘요 (진짜는 마지막 명령을 계속해요).
#
# 움직임 그림은 "대략의 흉내"예요. [확인 필요] 표시 숫자는 진짜 알티노로 재서 고쳐 주세요.

import json
import math
import time

import _host   # 웹앱(자바스크립트)과 이야기하는 통로

# ---- 진짜 알티노로 재서 바꿔야 하는 값 (지금은 짐작값) ----
FAKE_CM_PER_SEC_AT_1000 = 60.0   # Go(1000,1000) 일 때 1초에 가는 거리 (cm)  [확인 필요]
FAKE_WHEELBASE_CM = 10.0         # 앞바퀴-뒷바퀴 사이 거리 (cm)             [확인 필요]
FAKE_MAX_STEER_DEG = 25.0        # Steering(127) 일 때 앞바퀴가 꺾이는 각도   [확인 필요]

# ---- 진짜 AltinoLite.py 와 같은 이름의 변수 ----
tx_d = [2, 22, 35, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]
connectstate = 0


class SensorData:
    IR = [0, 0, 0, 0, 0, 0, 0, 0]
    CDS = 0
    BAT = 0
    CNT = 0


sensor = SensorData

# ---- 가짜 세상의 상태 (그림용) ----
_x = 0.0         # cm, 오른쪽이 +
_y = 0.0         # cm, 앞쪽이 +
_heading = 90.0  # 도, 90 = 위쪽(앞)
_warned_closed = False
_last_emit = 0.0


def _emit(kind='state', **extra):
    msg = {'t': kind}
    if kind == 'state':
        msg.update({
            'tx': tx_d,
            'open': connectstate,
            'x': round(_x, 2), 'y': round(_y, 2), 'h': round(_heading, 2),
            'ir': SensorData.IR[1:7], 'cds': SensorData.CDS, 'bat': SensorData.BAT,
        })
    msg.update(extra)
    _host.emit(json.dumps(msg))


def _cmd(text):
    _emit('cmd', s=text)


def _need_open():
    global _warned_closed
    if connectstate == 0 and not _warned_closed:
        _warned_closed = True
        _emit('note', s='Open()을 먼저 불러야 알티노가 움직여요. 코드 맨 위에 Open(...)이 있는지 보세요.')


def _signed(hi, lo):
    return hi * 256 + lo


def _speeds():
    """쪽지(tx_d)에 적힌 값에서 왼쪽·오른쪽 바퀴 속도를 거꾸로 읽어요."""
    right = _signed(tx_d[6], tx_d[7])
    left = _signed(tx_d[8], tx_d[9])
    if right > 1000:
        right = -(right ^ 0xffff)
    if left > 1000:
        left = -(left ^ 0xffff)
    return left, right


def _steer_value():
    st = tx_d[5]
    if st > 127:
        st = -(st ^ 0xff)
    return st


def _step(dt):
    """dt 초 동안 알티노가 쪽지대로 움직인 만큼 위치를 갱신해요."""
    global _x, _y, _heading
    left, right = _speeds()
    v = (left + right) / 2.0 / 1000.0 * FAKE_CM_PER_SEC_AT_1000  # cm/초
    steer = _steer_value() / 127.0 * FAKE_MAX_STEER_DEG
    if steer != 0 and v != 0:
        turn_rate = v / FAKE_WHEELBASE_CM * math.tan(math.radians(steer))  # 라디안/초
        _heading -= math.degrees(turn_rate * dt)  # 오른쪽(+)으로 꺾으면 시계 방향
    rad = math.radians(_heading)
    _x += v * dt * math.cos(rad)
    _y += v * dt * math.sin(rad)


def _fake_sensors():
    wall = _host.wall()   # 가상 벽의 위치(cm). 없으면 -1
    near = 0
    if wall >= 0:
        d = max(0.0, wall - _y)
        # 설명서(PDF): 적외선 센서는 0~800, 약 30cm 안에서 가까울수록 커져요
        near = 0 if d > 30 else int((30 - d) / 30 * 800)
    SensorData.IR[1] = near // 2
    SensorData.IR[2] = near
    SensorData.IR[3] = near // 2
    SensorData.IR[4] = 0
    SensorData.IR[5] = 0
    SensorData.IR[6] = 0
    shadow = _host.shadow()   # 그늘이 시작되는 위치(cm). 없으면 -1
    # 설명서(PDF): 밝기 센서는 0~900, 밝을수록 커요. 그늘 안에서는 어두워져요
    SensorData.CDS = 150 if (shadow >= 0 and _y >= shadow) else 600
    SensorData.BAT = 4000
    SensorData.CNT += 1


def _real_sensors():
    s = _host.shared().to_py()   # [real, IR1..IR6, CDS, BAT, CNT, ...]
    for i in range(1, 7):
        SensorData.IR[i] = s[i]
    SensorData.CDS = s[7]
    SensorData.BAT = s[8]
    SensorData.CNT = s[9]


def _tick(dt):
    global _last_emit
    if connectstate == 1:
        _step(dt)
    if _host.real() == 1:
        _real_sensors()
    else:
        _fake_sensors()
    _emit()


def Open(portName='com43'):
    global connectstate
    connectstate = 1
    delay(1000)
    print("Bluetooth connect")


def BT(portName='com43'): Open(portName)
def Bt(portName='com43'): Open(portName)
def bt(portName='com43'): Open(portName)


def Close():
    global connectstate
    delay(1000)
    connectstate = 0
    _emit()
    print("Bluetooth disconnect")


def close(): Close()


def delay(ms):
    """ms 밀리초 기다려요. 기다리는 동안 알티노는 쪽지대로 계속 움직여요."""
    end = _host.now() + ms
    last = _host.now()
    while True:
        now = _host.now()
        remaining = end - now
        if remaining <= 0:
            break
        _host.sleep(min(40.0, remaining))
        now2 = _host.now()
        _tick((now2 - last) / 1000.0)
        last = now2


def Delay(ms): delay(ms)


def _sleep_hook(seconds):
    delay(seconds * 1000.0)


time.sleep = _sleep_hook   # AI가 time.sleep(1)을 써도 알티노가 계속 움직이도록


def Go(left, right):
    _need_open()
    left = max(-1000, min(1000, left))
    right = max(-1000, min(1000, right))
    for idx, v in ((6, right), (8, left)):
        raw = (-v) ^ 0xffff if v < 0 else v
        tx_d[idx] = int(raw / 256)
        tx_d[idx + 1] = int(raw % 256)
    _cmd("Go(%d, %d)" % (left, right))
    _emit()


def go(left, right): Go(left, right)


def Steering(st):
    _need_open()
    st = max(-127, min(127, st))
    tx_d[5] = st if st >= 0 else (-st) ^ 0xff
    _cmd("Steering(%d)" % st)
    _emit()


def steering(value): Steering(value)


def Sound(buzzer):
    _need_open()
    buzzer = max(0, min(255, buzzer))
    tx_d[19] = buzzer
    _cmd("Sound(%d)" % buzzer if buzzer else "Sound(0)  소리 끔")
    _emit()


def sound(buzzer): Sound(buzzer)


def Display(dot):
    _need_open()
    tx_d[10] = int(dot) if type(dot) == int else ord(dot)
    for i in range(11, 19):
        tx_d[i] = 0
    _cmd("Display(%r)" % (dot,) if tx_d[10] else "Display(0)  화면 끔")
    _emit()


def display(dot): Display(dot)


def DisplayLine(dot1, dot2, dot3, dot4, dot5, dot6, dot7, dot8):
    tx_d[10] = 0xff
    for idx, v in zip(range(11, 19), (dot8, dot7, dot6, dot5, dot4, dot3, dot2, dot1)):
        tx_d[idx] = v
    _cmd("DisplayLine(...)")
    _emit()


def displayline(*a): DisplayLine(*a)


def Displayon(x, y):
    tx_d[10] = 0xff
    tx_d[19 - x] = tx_d[19 - x] | pow(2, (y - 1))
    _emit()


def displayon(x, y): Displayon(x, y)
def DisplayOn(x, y): Displayon(x, y)


def Displayoff(x, y):
    tx_d[10] = 0xff
    tx_d[19 - x] = tx_d[19 - x] & (255 - pow(2, (y - 1)))
    _emit()


def displayoff(x, y): Displayoff(x, y)
def DisplayOff(x, y): Displayoff(x, y)


def Light(led):
    _need_open()
    tx_d[20] = led
    _cmd("Light(%d)" % led if led else "Light(0)  불빛 끔")
    _emit()


def light(led): Light(led)
def Led(led): Light(led)
def led(led): Light(led)


def Stop():
    Go(0, 0)
    Steering(0)
    Sound(0)
    Display(0)
    Led(0)


def stop(): Stop()


def SensorFun(command):
    if _host.real() == 1:
        _real_sensors()
    else:
        _fake_sensors()
    return sensor


def check():
    pass   # 실제 전송은 웹앱이 80ms마다 해요
