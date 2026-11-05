# 14. 배달 로봇 - 출발 -> 배달 장소 도착 -> 소리로 알리기 -> 돌아오기
# 앞에서 배운 것들(달리기, 돌기, 소리, 불빛)을 이어 붙여 하나의 이야기로 만든 예예요.
# 우리 조 미션도 이렇게 "순서대로 할 일"을 적어 보면 쉬워요.
from AltinoLite import *

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300
GO_MS = 2500         # 배달 장소까지 가는 시간   <- 바꿔 보세요!
TURN_MS = 5000       # 뒤돌아서 방향 바꾸는 시간 (반 바퀴, 180도)  <- 실험해서 고치세요!


def forward(ms):
    Steering(0)
    Go(SPEED, SPEED)
    delay(ms)
    Stop()


def u_turn(ms):
    Steering(127)
    Go(SPEED, SPEED)
    delay(ms)
    Steering(0)
    Stop()


Open(PORT)
try:
    Light(1)                 # 출발 불
    forward(GO_MS)           # 배달 장소로 가기
    Light(0)

    Sound(1)                 # 도착! 소리로 알리기
    delay(800)
    Sound(0)
    delay(1000)              # 물건 내려놓는 시간

    u_turn(TURN_MS)          # 뒤돌기
    forward(GO_MS)           # 출발 지점으로 돌아오기
finally:
    Steering(0)
    Stop()
    Sound(0)
    Light(0)
    Close()
