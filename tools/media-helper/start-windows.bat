@echo off
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (set "PYLAUNCH=python") else (set "PYLAUNCH=py -3")
if not exist ".venv\Scripts\python.exe" %PYLAUNCH% -m venv .venv
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -c "import yt_dlp" >nul 2>&1
if errorlevel 1 ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto failed
".venv\Scripts\python.exe" server.py
pause
exit /b
:failed
echo Khong khoi dong duoc. Can Python 3.10+ va ket noi Internet de cai yt-dlp.
pause
