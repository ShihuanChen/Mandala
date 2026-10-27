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

if not exist ".venv\Scripts\python.exe" goto nogui
if not exist "data\deap\data_preprocessed_python\s01.dat" goto nogui
start "BCI state server (ws://127.0.0.1:8765)" cmd /k ".venv\Scripts\python.exe server\eeg-deap-server.py --subject 1 --trial 0 --loop"
goto serve

:nogui
echo [i] No .venv or DEAP data found. Simulation mode only.

:serve
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8000/index.html"
echo.
echo   http://127.0.0.1:8000/index.html     workbench
echo   http://127.0.0.1:8000/compare.html   A / B compare
echo.
echo   Do NOT double-click index.html directly: ES modules need http.
echo   Close this window to stop the server.
echo.
%PYEXE% -m http.server 8000
