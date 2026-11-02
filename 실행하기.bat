@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 알티노 코딩 실험실 (이 창을 닫으면 꺼져요)
echo.
echo  알티노 코딩 실험실을 켜는 중이에요...
echo  (이 검은 창은 닫지 마세요. 수업이 끝나면 닫으면 돼요.)
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "" msedge "http://localhost:8792" 2>nul || start "" "http://localhost:8792"
  py -3 serve.py 8792
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" msedge "http://localhost:8792" 2>nul || start "" "http://localhost:8792"
  python serve.py 8792
  goto :end
)

echo  [!] 파이썬이 이 컴퓨터에 없어요.
echo      IDLE을 쓰는 컴퓨터라면 파이썬이 있어야 하는데, 찾지 못했어요.
echo      선생님께 알려 주세요. (python.org 에서 설치할 수 있어요)
echo.

:end
pause
