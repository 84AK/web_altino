# 01. 연결 테스트 - 알티노가 "도" 소리를 1초 내면 성공!
# 사용법: 아래 PORT 의 COM 번호를 내 번호로 바꾸고 ▶ 실행을 누르세요.
from AltinoLite import *

PORT = 'COM4'   # 내 알티노의 COM 번호로 바꾸세요

Open(PORT)
Sound(1)        # 소리 켜기 (소리 번호의 뜻은 직접 들어 보고 확인해요)
delay(1000)     # 1초 기다리기 = 그동안 소리가 계속 나요
Sound(0)        # 소리 끄기 (안 끄면 계속 울려요!)
Stop()
Close()
