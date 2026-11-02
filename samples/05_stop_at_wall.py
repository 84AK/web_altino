# 05. 벽이 가까워지면 멈추기 - 센서 값을 읽어서 스스로 판단하는 코드
# 먼저 sensor_check.py 로 "앞쪽 센서 값이 벽에 가까우면 얼마가 되는지" 확인하고 LIMIT 를 고치세요.
from AltinoLite import *
import AltinoLite

PORT = 'COM4'     # 내 알티노의 COM 번호로 바꾸세요
LIMIT = 300       # 이 값보다 커지면 "벽이 가깝다"고 판단  <- 실험해서 고치세요!

Open(PORT)
try:
    Go(300, 300)
    for i in range(100):                 # 최대 약 10초만 달려요 (안전장치)
        front = AltinoLite.sensor.IR[2]  # 앞쪽 가운데 센서
        if front > LIMIT:
            print("벽 발견! 멈춥니다. 센서값:", front)
            break
        delay(100)
finally:
    Stop()
    Close()
