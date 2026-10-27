@echo off
setlocal
cd /d "%~dp0"
title BCI new-chinese visual - local server

set "PYEXE="
if exist ".venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if not defined PYEXE (
  py -3.11 --version >nul 2>nul
  if not errorlevel 1 set "PYEXE=py -3.11"
)
if not defined PYEXE (
  python --version >nul 2>nul
  if not errorlevel 1 set "PYEXE=python"
)
if not defined PYEXE (
  echo [X] Python not found. Install Python 3.11 first.
  pause
  exit /b 1
)

rem ---- port 8765: EEG state server ----
netstat -ano | findstr /c:"127.0.0.1:8765" | findstr /i "LISTENING" >nul
if not errorlevel 1 goto ws_busy
if not exist ".venv\Scripts\python.exe" goto ws_skip
if not exist "data\deap\data_preprocessed_python\s01.dat" goto ws_skip
echo [i] starting EEG state server on ws://127.0.0.1:8765
start "BCI state server (ws://127.0.0.1:8765)" cmd /k ".venv\Scripts\python.exe server\eeg-deap-server.py --subject 1 --trial 0 --loop"
goto serve
:ws_busy
echo [i] 8765 already running, reuse it
goto serve
:ws_skip
echo [i] no .venv or DEAP data, simulation mode only

:serve
netstat -ano | findstr /c:"127.0.0.1:8000" | findstr /i "LISTENING" >nul
if not errorlevel 1 goto http_busy
start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:8000/index.html"
echo.
echo   http://127.0.0.1:8000/index.html     workbench
echo   http://127.0.0.1:8000/compare.html   three-way compare
echo.
echo   Never double-click index.html: ES modules need http.
echo   Close this window to stop the server.
echo.
%PYEXE% -m http.server 8000 --bind 127.0.0.1
goto end

:http_busy
echo [i] 8000 already running, opening browser only
start http://127.0.0.1:8000/compare.html
timeout /t 3 >nul

:end
