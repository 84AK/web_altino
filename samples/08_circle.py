# 08. 동그라미 그리며 달리기 - 핸들을 한쪽으로 꺾은 채 계속 달리기
# 핸들을 끝까지 꺾고 한 바퀴 돌 만큼만 달리면 동그라미가 돼요.
from AltinoLite import *

PORT = 'COM4'          # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300            # 속도 (-1000 ~ 1000)
STEER = 127            # 핸들 (-127 ~ 127, 마이너스는 반대쪽)  <- 바꿔 보세요!
CIRCLE_MS = 10000      # 한 바퀴 도는 시간  <- 덜 돌면 늘리고, 더 돌면 줄이세요!

Open(PORT)
try:
    Steering(STEER)
    Go(SPEED, SPEED)
    delay(CIRCLE_MS)
finally:
    Steering(0)
    Stop()
    Close()
