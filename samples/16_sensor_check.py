# 16. 센서 값 찍어 보기 - 알티노의 눈(적외선)과 밝기 센서가 보는 숫자를 화면에 써 봐요
# 센서 읽는 법:  AltinoLite.sensor.IR[2] (앞쪽 가운데 눈, 0~800: 가까울수록 커져요)
#               AltinoLite.sensor.CDS    (밝기, 0~900: 밝을수록 커져요)
# 바꿔 보기: 손이나 책을 앞에 가까이/멀리 해 보며 숫자가 어떻게 변하는지 보세요.
from AltinoLite import *
import AltinoLite

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요

Open(PORT)
try:
    for i in range(20):                       # 2초 동안 20번 읽기  <- 횟수를 바꿔 보세요
        eye = AltinoLite.sensor.IR[2]         # 앞쪽 가운데 눈
        light = AltinoLite.sensor.CDS         # 밝기
        print("눈:", eye, " 밝기:", light)
        delay(100)
finally:
    Stop()
    Close()
