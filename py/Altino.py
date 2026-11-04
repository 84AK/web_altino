# 웹앱용 Altino (일반 알티노) - 진짜 Altino.py 와 같은 이름·같은 명령 (브라우저 안에서 돌아가요)
#
# 알티노 라이트(AltinoLite.py)와 쪽지(통신) 모양이 달라요. 이 파일은 일반 알티노의 쪽지 모양을 따라요.
#  - 보내는 쪽지 28칸, 받는 쪽지 56칸 (라이트는 22칸)
#  - 센서 이름은 sensor.Bat (라이트는 sensor.BAT)
#
# 진짜 라이브러리와 다른 점 (내 코드는 한 글자도 바꾸지 않아도 돼요)
#  - Open(포트이름): 포트 이름은 무시해요. 연결은 화면 위의 [알티노 연결하기]로 해요.
#  - 명령은 tx_d 쪽지에 적기만 하고, 80ms마다 실제 전송은 웹앱(자바스크립트)이 해요.
#  - 코드가 끝나면 웹앱이 알아서 알티노를 멈춰 줘요 (진짜는 마지막 명령을 계속해요).
#  - 가속도·자이로 같은 센서 값은 아직 읽어 오지 않아요 (적외선 6개, 밝기, 배터리만).
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

# ---- 진짜 Altino.py 와 같은 이름의 변수 ----
tx_d = [2, 28, 35, 1, 10, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]
connectstate = 0


class SensorData:
    CDS = 0
    IR = [0, 0, 0, 0, 0, 0, 0, 0]
    Bat = 0
    Acc = [0, 0, 0, 0]
    Mag = [0, 0, 0, 0]
    Gyro = [0, 0, 0, 0]
    MCur = [0, 0, 0]
    Temp = 0
    StVar = 0
    StCur = 0
    Remote = 0
    MTemp = 0
    CNT = 0


sensor = SensorData

# ---- 가짜 세상의 상태 (그림용) ----
_x = 0.0         # cm, 오른쪽이 +
_y = 0.0         # cm, 앞쪽이 +
_heading = 90.0  # 도, 90 = 위쪽(앞)
_warned_closed = False


def _wheel(hi, lo):
    v = hi * 256 + lo
    return -(v - 32768) if v > 1000 else v


def _speeds():
    """쪽지(tx_d)에 적힌 값에서 왼쪽·오른쪽 바퀴 속도를 거꾸로 읽어요."""
    return _wheel(tx_d[10], tx_d[11]), _wheel(tx_d[7], tx_d[8])


def _steer_value():
    st = tx_d[5]
    return -(st - 128) if st > 127 else st


def _view_tx():
    """그림·3D가 읽는 22칸 모양으로 바꿔 줘요 (알티노 라이트와 같은 칸 번호)."""
    left, right = _speeds()
    v = [2, 22, 0, 1, 1] + [0] * 17
    v[21] = 3
    for idx, val in ((6, right), (8, left)):
        raw = (-val) ^ 0xffff if val < 0 else val
        v[idx] = int(raw / 256)
        v[idx + 1] = int(raw % 256)
    st = _steer_value()
    v[5] = st if st >= 0 else (-st) ^ 0xff
    v[10] = 0xff if any(tx_d[13:21]) else tx_d[12]
    v[19] = tx_d[22]
    v[20] = tx_d[21] * 256 + tx_d[23]
    return v


def _emit(kind='state', **extra):
    msg = {'t': kind}
    if kind == 'state':
        msg.update({
            'tx': _view_tx(), 'raw': tx_d,
            'open': connectstate,
            'x': round(_x, 2), 'y': round(_y, 2), 'h': round(_heading, 2),
            'ir': SensorData.IR[1:7], 'cds': SensorData.CDS, 'bat': SensorData.Bat,
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
        # 가까울수록 값이 커진다고 가정한 흉내 값이에요  [확인 필요: 진짜 범위]
        near = 0 if d > 30 else int((30 - d) / 30 * 2000)
    SensorData.IR[1] = near // 2
    SensorData.IR[2] = near
    SensorData.IR[3] = near // 2
    SensorData.IR[4] = 0
    SensorData.IR[5] = 0
    SensorData.IR[6] = 0
    SensorData.CDS = 500
    SensorData.Bat = 4000
    SensorData.CNT += 1


def _real_sensors():
    s = _host.shared().to_py()   # [real, IR1..IR6, CDS, BAT, CNT, ...]
    for i in range(1, 7):
        SensorData.IR[i] = s[i]
    SensorData.CDS = s[7]
    SensorData.Bat = s[8]
    SensorData.CNT = s[9]


def _tick(dt):
    if connectstate == 1:
        _step(dt)
    if _host.real() == 1:
        _real_sensors()
    else:
        _fake_sensors()
    _emit()


def Open(portName='com3'):
    global connectstate
    connectstate = 1
    delay(1000)
    print("Bluetooth connect")


def BT(portName='com3'): Open(portName)
def Bt(portName='com3'): Open(portName)
def bt(portName='com3'): Open(portName)


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
    l, r = left, right
    if l < 0:
        l = 32768 - l
    if r < 0:
        r = 32768 - r
    tx_d[7] = int(r // 256)
    tx_d[8] = int(r % 256)
    tx_d[10] = int(l // 256)
    tx_d[11] = int(l % 256)
    _cmd("Go(%d, %d)" % (left, right))
    _emit()


def go(left, right): Go(left, right)
def GO(left, right): Go(left, right)


def Steering(value):
    _need_open()
    value = max(-127, min(127, value))
    tx_d[24] = 1
    tx_d[5] = 128 - value if value < 0 else value
    _cmd("Steering(%d)" % value)
    _emit()


def steering(value): Steering(value)
def STEERING(value): Steering(value)


def Sound(buzzer):
    _need_open()
    tx_d[22] = buzzer
    _cmd("Sound(%d)" % buzzer if buzzer else "Sound(0)  소리 끔")
    _emit()


def sound(buzzer): Sound(buzzer)
def SOUND(buzzer): Sound(buzzer)


def Display(dot):
    _need_open()
    if type(dot) == int:
        if dot > 128:
            dot = dot - 128
        elif dot > 0:
            dot = 128 + dot
        tx_d[12] = dot
    else:
        tx_d[12] = 128 + ord(dot)
    for i in range(13, 21):
        tx_d[i] = 0
    _cmd("Display(%r)" % (dot,) if tx_d[12] else "Display(0)  화면 끔")
    _emit()


def display(dot): Display(dot)
def DISPLAY(dot): Display(dot)


def DisplayLine(dot1, dot2, dot3, dot4, dot5, dot6, dot7, dot8):
    tx_d[12] = 0
    for idx, v in zip(range(13, 21), (dot8, dot7, dot6, dot5, dot4, dot3, dot2, dot1)):
        tx_d[idx] = v
    _cmd("DisplayLine(...)")
    _emit()


def displayline(*a): DisplayLine(*a)
def displayLine(*a): DisplayLine(*a)
def DISPLAYLINE(*a): DisplayLine(*a)


def Displayon(x, y):
    tx_d[12] = 0
    tx_d[21 - x] = tx_d[21 - x] | pow(2, (y - 1))
    _emit()


def displayon(x, y): Displayon(x, y)
def DisplayOn(x, y): Displayon(x, y)
def DisplayON(x, y): Displayon(x, y)
def DISPLAYON(x, y): Displayon(x, y)


def Displayoff(x, y):
    tx_d[12] = 0
    tx_d[21 - x] = tx_d[21 - x] & (255 - pow(2, (y - 1)))
    _emit()


def displayoff(x, y): Displayoff(x, y)
def DisplayOff(x, y): Displayoff(x, y)
def DisplayOFF(x, y): Displayoff(x, y)
def DISPLAYOFF(x, y): Displayoff(x, y)


def Light(led):
    _need_open()
    tx_d[21] = int(led // 256)
    tx_d[23] = int(led % 256)
    _cmd("Light(%d)" % led if led else "Light(0)  불빛 끔")
    _emit()


def light(led): Light(led)
def LIGHT(led): Light(led)
def Led(led): Light(led)
def led(led): Light(led)
def LED(led): Light(led)


def Stop():
    Go(0, 0)
    Steering(0)
    Sound(0)
    Display(0)
    Led(0)


def stop(): Stop()


def SensorFun(command):
    # 진짜 Altino.py 는 command 를 쪽지에 적지만, 80ms마다 센서 요청(10)을 계속 보내므로 같은 결과예요
    if _host.real() == 1:
        _real_sensors()
    else:
        _fake_sensors()
    return sensor


def check():
    pass   # 실제 전송은 웹앱이 80ms마다 해요
