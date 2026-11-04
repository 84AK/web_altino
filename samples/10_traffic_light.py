# 10. 신호등 놀이 - 초록불엔 가고, 빨간불엔 서요
# 불빛 번호: 켜고 싶은 불의 번호를 Light() 에 넣어요. 0 은 모두 끄기. (번호의 뜻은 04번에서 확인!)
from AltinoLite import *

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300
GO_LIGHT = 1         # 갈 때 켤 불 번호    <- 바꿔 보세요!
STOP_LIGHT = 4       # 설 때 켤 불 번호    <- 바꿔 보세요!
GO_MS = 2000         # 가는 시간
STOP_MS = 2000       # 서 있는 시간

Open(PORT)
try:
    for i in range(3):             # 3번 반복
        Light(GO_LIGHT)            # 초록불: 출발!
        Go(SPEED, SPEED)
        delay(GO_MS)

        Stop()
        Light(STOP_LIGHT)          # 빨간불: 정지!
        delay(STOP_MS)
finally:
    Stop()
    Light(0)                       # 불 끄기 (안 끄면 계속 켜져 있어요)
    Close()
