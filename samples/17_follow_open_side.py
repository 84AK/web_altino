# 17. 열린 쪽으로 핸들 꺾기 - 왼쪽 눈과 오른쪽 눈 숫자를 비교해서 스스로 방향을 정해요
# 알티노의 눈(IR)은 6개예요. 어느 번호가 왼쪽/오른쪽 눈인지는 로봇마다 직접 확인해요!
#   1단계: 먼저 이 코드를 실행 -> 손을 알티노 앞 왼쪽, 오른쪽에 번갈아 대고 올라가는 번호를 찾아요.
#   2단계: 찾은 번호를 LEFT_EYE, RIGHT_EYE 에 넣고, 아래 TEST = False 로 바꿔 달려 봐요.
from AltinoLite import *
import AltinoLite

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
TEST = True          # True: 숫자만 찍어 보기 / False: 달리기
LEFT_EYE = 1         # 왼쪽 눈 번호   <- 1단계에서 찾은 번호로!
RIGHT_EYE = 3        # 오른쪽 눈 번호 <- 1단계에서 찾은 번호로!
GAP = 80             # 두 눈 차이가 이만큼 넘으면 꺾기  <- 바꿔 보세요

Open(PORT)
try:
    if not TEST:
        Go(250, 250)
    for i in range(50 if TEST else 100):
        s = AltinoLite.sensor.IR
        if TEST:
            print("눈 1~6:", s[1], s[2], s[3], s[4], s[5], s[6])
        else:
            left = s[LEFT_EYE]
            right = s[RIGHT_EYE]
            if left > right + GAP:
                Steering(127)                 # 왼쪽 벽이 가까우면 오른쪽으로
            elif right > left + GAP:
                Steering(-127)                # 오른쪽 벽이 가까우면 왼쪽으로
            else:
                Steering(0)
        delay(100)
finally:
    Steering(0)
    Stop()
    Close()
