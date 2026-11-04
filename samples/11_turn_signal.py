# 11. 방향지시등 - 오른쪽으로 돌기 전에 깜빡깜빡 알려 줘요
# Light() 로 불을 켰다 껐다 하면 깜빡이가 돼요. 실제 자동차처럼 먼저 알리고 돌아요.
from AltinoLite import *

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300
SIGNAL_LIGHT = 16    # 깜빡일 불 번호 (16 = 앞 오른쪽 깜빡이, 64 = 뒤 오른쪽)  <- 바꿔 보세요!
BLINK_MS = 300       # 켜져 있는 시간, 꺼져 있는 시간
BLINK_COUNT = 5      # 깜빡이는 횟수


def blink(times):
    for i in range(times):
        Light(SIGNAL_LIGHT)
        delay(BLINK_MS)
        Light(0)
        delay(BLINK_MS)


Open(PORT)
try:
    Go(SPEED, SPEED)               # 앞으로 달리다가
    delay(1500)
    Stop()

    blink(BLINK_COUNT)             # 깜빡깜빡: "오른쪽으로 돌 거예요!"

    Steering(127)                  # 오른쪽으로 돌기
    Go(SPEED, SPEED)
    delay(1900)
    Steering(0)

    Go(SPEED, SPEED)               # 다시 앞으로
    delay(1500)
finally:
    Steering(0)
    Stop()
    Light(0)
    Close()
