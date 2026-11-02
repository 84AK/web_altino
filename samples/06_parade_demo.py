# 06. 퍼레이드 예시 - 소리 + 불빛 + 지그재그 이동을 합친 "미션 예시 작품"
# 이런 식으로 여러 명령을 섞어서 우리 조만의 동작을 만들어요.
from AltinoLite import *

PORT = 'COM4'   # 내 알티노의 COM 번호로 바꾸세요


def zigzag(times):
    for i in range(times):
        Steering(-100)
        Go(300, 300)
        delay(800)
        Steering(100)
        delay(800)
    Steering(0)


Open(PORT)
try:
    Display('A')        # 알티노 화면에 글자 띄우기
    Light(1)
    Sound(2)
    delay(500)
    Sound(0)            # 소리는 꼭 직접 끄기

    zigzag(3)

    Go(0, 0)
    Light(0)
    Display(0)
finally:
    Stop()
    Close()
