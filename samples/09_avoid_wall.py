# 09. 벽 피하기 - 앞이 막히면 뒤로 빠졌다가 핸들을 꺾어 방향을 바꿔요
# 센서 값을 읽어서 스스로 판단해요. 05번에서 LIMIT 를 찾은 값을 그대로 쓰세요.
from AltinoLite import *
import AltinoLite

PORT = 'COM4'     # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300       # 달리는 속도
LIMIT = 300       # 이 값보다 커지면 "벽이 가깝다"  <- 05번에서 찾은 값으로!
BACK_MS = 800     # 뒤로 빠지는 시간
TURN_MS = 1600    # 방향을 바꾸는 시간 (뒤로 가며 핸들 꺾기)

Open(PORT)
try:
    for i in range(150):                   # 최대 약 15초만 달려요 (안전장치)
        front = AltinoLite.sensor.IR[2]    # 앞쪽 가운데 센서
        if front > LIMIT:
            print("벽 발견! 피합니다. 센서값:", front)
            Stop()
            delay(300)
            Steering(0)
            Go(-SPEED, -SPEED)             # 뒤로
            delay(BACK_MS)
            Steering(127)                  # 핸들 꺾고 뒤로 더 가서 방향 바꾸기
            delay(TURN_MS)
            Stop()
            Steering(0)
            delay(300)
        else:
            Steering(0)
            Go(SPEED, SPEED)               # 앞이 비었으면 앞으로
        delay(100)
finally:
    Steering(0)
    Stop()
    Close()
