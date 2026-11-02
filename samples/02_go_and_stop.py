# 02. 앞으로 갔다가 멈추기 - 가장 기본 동작
from AltinoLite import *

PORT = 'COM4'   # 내 알티노의 COM 번호로 바꾸세요

Open(PORT)
try:
    Go(300, 300)     # 왼쪽 바퀴 300, 오른쪽 바퀴 300 -> 앞으로 (처음엔 느리게!)
    delay(2000)      # 2초 동안 그대로 달려요
    Stop()           # 멈춤
    delay(1000)

    Go(-300, -300)   # 마이너스 = 뒤로
    delay(2000)
    Stop()
finally:
    Stop()           # 오류가 나도 반드시 멈추기
    Close()
