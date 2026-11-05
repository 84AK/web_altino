# 07. 삼각형 그리며 달리기 - 03번 네모 코드에서 숫자만 바꾼 버전
# 삼각형은 모서리가 3개이고, 한 번에 120도씩 돌아야 해요. (네모는 90도)
# 더 많이 돌아야 하니 TURN_MS 를 네모보다 길게 잡아요.  <- 실험해서 고치세요!
from AltinoLite import *

PORT = 'COM4'          # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300            # 속도 (-1000 ~ 1000)
STRAIGHT_MS = 2000     # 한 변 달리는 시간 (밀리초)
TURN_MS = 3300         # 모서리 도는 시간  <- 덜 돌면 늘리고, 더 돌면 줄이세요!


def forward(ms):
    Steering(0)
    Go(SPEED, SPEED)
    delay(ms)


def turn_right(ms):
    Steering(127)      # 핸들 오른쪽 끝
    Go(SPEED, SPEED)
    delay(ms)


Open(PORT)
try:
    for i in range(3):         # 변이 3개
        forward(STRAIGHT_MS)
        turn_right(TURN_MS)
finally:
    Steering(0)
    Stop()
    Close()
