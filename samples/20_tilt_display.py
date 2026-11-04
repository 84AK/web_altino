# 20. 기울이면 글자 보여 주기 (일반 알티노 전용) - 가속도 센서(Acc)로 기울기를 읽어요
# 읽는 법: sensor.Acc[0] (좌우 기울기), sensor.Acc[1] (앞뒤 기울기), sensor.Acc[2] (위아래)
# 알티노를 손으로 들어 기울여 보세요. 시뮬레이션에서는 값이 항상 0이라 로봇에서만 반응해요.
# 바꿔 보기: LIMIT 을 바꾸거나, 'A' 대신 다른 글자를 넣어 보세요.
from Altino import *
import Altino

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
LIMIT = 500          # 이 값보다 크게 기울면 반응  <- 바꿔 보세요

Open(PORT)
try:
    for i in range(100):                      # 약 10초
        tilt = Altino.sensor.Acc[0]
        if tilt > LIMIT:
            Display('A')
        else:
            Display(0)
        delay(100)
finally:
    Display(0)
    Stop()
    Close()
