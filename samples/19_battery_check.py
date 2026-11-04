# 19. 배터리 확인 - 달리기 전에 배터리 값을 먼저 읽어서 알려 줘요
# 읽는 법: AltinoLite.sensor.BAT  (일반 알티노는 sensor.Bat)
# 바꿔 보기: LOW 값을 바꿔서 "얼마 이하면 충전하라고 알릴지" 정해 보세요. (실제 값은 로봇에서 확인)
from AltinoLite import *
import AltinoLite

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
LOW = 100            # 이 값보다 작으면 배터리 부족  <- 실제 로봇의 값을 보고 고치세요

Open(PORT)
try:
    bat = AltinoLite.sensor.BAT
    print("배터리 값:", bat)
    if bat < LOW:
        print("배터리가 부족해요. 충전해 주세요!")
        Light(0x00F0)                         # 깜빡이 불로 알리기
        delay(1000)
    else:
        print("배터리 충분! 출발해도 좋아요.")
        Go(300, 300)
        delay(1000)
finally:
    Light(0)
    Stop()
    Close()
