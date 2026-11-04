# 12. 멜로디 연주 - 소리 번호를 차례로 울려서 노래 만들기
# Sound(번호) 로 소리를 켜고, delay 로 길이를 정하고, Sound(0) 으로 꺼요.
# 소리 번호 = 피아노 건반 번호예요:  40 도 · 42 레 · 44 미 · 45 파 · 47 솔 · 49 라 · 51 시 · 52 높은 도
from AltinoLite import *

PORT = 'COM4'        # 내 알티노의 COM 번호로 바꾸세요

# (소리 번호, 길이 ms) 짝을 순서대로 적어요.  <- 번호와 길이를 바꿔서 나만의 노래를!
# 지금은 '반짝반짝 작은 별'  도 도 솔 솔 라 라 솔
SONG = [
    (40, 400),
    (40, 400),
    (47, 400),
    (47, 400),
    (49, 400),
    (49, 400),
    (47, 800),
]

Open(PORT)
try:
    for note, ms in SONG:
        Sound(note)
        delay(ms)
        Sound(0)           # 한 음이 끝나면 꼭 끄기
        delay(100)         # 음 사이의 짧은 쉼
finally:
    Sound(0)
    Stop()
    Close()
