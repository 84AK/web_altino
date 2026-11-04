# 04. 소리·불빛 번호 탐험 - 어떤 번호가 어떤 소리/불빛인지 우리 조가 직접 알아내요
# 사용법: 실행하고 귀·눈으로 확인한 뒤, 가이드의 "탐험 기록표"에 적으세요.
# 중간에 멈추려면 위쪽의 긴급 정지를 누르세요
from AltinoLite import *

PORT = 'COM4'   # 내 알티노의 COM 번호로 바꾸세요

Open(PORT)
try:
    print("== 소리 탐험: 번호를 하나씩 들려줘요 ==")
    for n in range(1, 13):           # 1~12 번까지 (더 보고 싶으면 숫자를 늘려요)
        print("Sound(%d)" % n)
        Sound(n)
        delay(700)
        Sound(0)                     # 한 번 끄고
        delay(300)                   # 잠깐 쉬어요

    print("== 불빛 탐험 ==")
    for n in [1, 2, 4, 8, 16, 32, 64, 128, 0x4000, 0x8000]:   # 2배씩 늘려 보면 편해요 (0x4000, 0x8000 은 브레이크등)
        print("Light(%d)" % n)
        Light(n)
        delay(900)
        Light(0)
        delay(300)
finally:
    Stop()
    Close()
