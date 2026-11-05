# 03. 네모 그리며 달리기 - 함수로 "앞으로 가기", "오른쪽으로 돌기"를 만들어 쓰는 예
# 핵심: Steering(핸들)을 꺾은 채로 Go 하면 커브를 돌아요. 직각으로 도는 시간은 직접 맞춰야 해요.
from AltinoLite import *

PORT = 'COM4'          # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300            # 속도 (-1000 ~ 1000)
STRAIGHT_MS = 2000     # 한 변 달리는 시간 (밀리초)
TURN_MS = 2500         # 모서리 도는 시간  <- 실험해서 직각이 되게 고치세요!


def forward(ms):
    Steering(0)
    Go(SPEED, SPEED)
    delay(ms)


def turn_right(ms):
    Steering(127)      # 핸들 오른쪽 끝
    Go(SPEED, SPEED)
    delay(ms)
    Steering(0)


Open(PORT)
try:
    for i in range(4):
        forward(STRAIGHT_MS)
        turn_right(TURN_MS)
finally:
    Stop()
    Close()
