# 13. 주차하기 - 앞으로 가서 핸들을 꺾어 들어가고, 뒤로 빼서 바로 세워요
# 알티노는 자동차처럼 앞바퀴(핸들)로 방향을 바꿔서 제자리 회전이 안 돼요.
# 그래서 "앞으로 가며 꺾기 -> 뒤로 가며 반대로 꺾기" 순서로 주차해요.
from AltinoLite import *

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요
SPEED = 300
APPROACH_MS = 2000   # 주차 칸 앞까지 가는 시간
SWING_MS = 1300      # 핸들 꺾고 앞으로 가는 시간
BACK_MS = 1600       # 뒤로 들어가는 시간      <- 실험해서 고치세요!


def drive(steer, speed, ms):
    Steering(steer)
    Go(speed, speed)
    delay(ms)
    Stop()
    delay(300)


Open(PORT)
try:
    drive(0, SPEED, APPROACH_MS)        # 1) 앞으로 곧게 가기
    drive(127, SPEED, SWING_MS)         # 2) 핸들 오른쪽 끝, 앞으로
    drive(-127, -SPEED, BACK_MS)        # 3) 핸들 반대쪽 끝, 뒤로 들어가기
    drive(0, -SPEED, 500)               # 4) 곧게 펴고 조금 더 뒤로
finally:
    Steering(0)
    Stop()
    Close()
