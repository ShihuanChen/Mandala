@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [!] 缺少 .venv，先运行：
  echo     py -3.11 -m venv .venv
  echo     .venv\Scripts\python.exe -m pip install -r server\requirements.txt
  pause
  exit /b 1
)
echo 启动 DEAP 回放服务：ws://127.0.0.1:8765
echo 网页左侧切到「实时」即可接收真实脑电驱动的状态。
.venv\Scripts\python.exe server\eeg-deap-server.py --subject 1 --trial 0 --loop
pause
