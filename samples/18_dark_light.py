# 18. 어두우면 불 켜기 - 밝기 센서(CDS)로 스스로 불을 켜고 꺼요
# 읽는 법: AltinoLite.sensor.CDS (0~900, 밝을수록 큰 값)
# 시뮬레이션: 위쪽 '가상 그늘 만들기'를 누르고 실행하면 앞쪽 50cm 지점부터 어두워져요.
# 바꿔 보기: DARK 값을 바꾸면 "얼마나 어두울 때" 켤지 정할 수 있어요.
from AltinoLite import *
import AltinoLite

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
DARK = 300           # 이 값보다 작으면 "어둡다"  <- 바꿔 보세요

Open(PORT)
try:
    Go(300, 300)
    for i in range(80):                       # 약 8초
        if AltinoLite.sensor.CDS < DARK:
            Light(3)                          # 앞 불 켜기 (1+2)
        else:
            Light(0)                          # 밝으면 끄기
        delay(100)
finally:
    Light(0)
    Stop()
    Close()
