#!/bin/bash
# 더블클릭하면 알티노 코딩 실험실이 켜져요. (수업이 끝나면 이 터미널 창을 닫으면 꺼져요)
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[!] 파이썬(python3)이 이 컴퓨터에 없어요. 선생님께 알려 주세요."
  read -r -p "엔터를 누르면 닫혀요" _
  exit 1
fi

echo "알티노 코딩 실험실을 켜는 중이에요... (이 창은 닫지 마세요)"
( sleep 1; open "http://localhost:8792" ) &
python3 serve.py 8792
