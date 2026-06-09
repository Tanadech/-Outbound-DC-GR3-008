@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: Usage:
::   update-data.bat          — interactive (shows pause at end)
::   update-data.bat auto     — silent/scheduler mode (no pause)

set "AUTO=%~1"
set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

set "LOG_DIR=%DIR%\logs"
set "LOG_FILE=%LOG_DIR%\update.log"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :LOG "=== update-data.bat start (mode=%AUTO%) ==="

cd /d "%DIR%"

:: ---- Step 1: Convert Excel → JSON ----
call :LOG "running convert.js..."
node convert.js >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  call :LOG "ERROR: convert.js failed — ดูรายละเอียดใน logs\update.log"
  call :NOTIFY "GR3-008 Error" "convert.js failed. ดู logs\update.log"
  goto :END_FAIL
)
call :LOG "convert สำเร็จ"

:: ---- Step 2: Git add ----
git add data/data.json 2>> "%LOG_FILE%"

:: ---- Step 3: Check staged diff ----
git diff --cached --quiet
if not errorlevel 1 (
  call :LOG "data.json ไม่เปลี่ยนแปลง — ไม่ push"
  goto :END_OK
)

:: ---- Step 4: Commit ----
for /f "tokens=*" %%T in ('powershell -NoProfile -Command "Get-Date -Format \"yyyy-MM-dd HH:mm\""') do set "NOW=%%T"
git commit -m "auto-update: data.json [%NOW%]" 2>> "%LOG_FILE%"
if errorlevel 1 (
  call :LOG "ERROR: git commit failed"
  goto :END_FAIL
)

:: ---- Step 5: Push ----
git push 2>> "%LOG_FILE%"
if errorlevel 1 (
  call :LOG "ERROR: git push failed"
  call :NOTIFY "GR3-008 Push Error" "git push failed. ดู logs\update.log"
  goto :END_FAIL
)

call :LOG "push สำเร็จ ✓"

:END_OK
if /i not "%AUTO%"=="auto" pause
exit /b 0

:END_FAIL
if /i not "%AUTO%"=="auto" pause
exit /b 1

:: ---- Subroutines ----

:LOG
set "TS=%date% %time:~0,8%"
set "MSG=[%TS%] %~1"
echo %MSG%
echo %MSG% >> "%LOG_FILE%"
goto :EOF

:NOTIFY
powershell -NoProfile -NonInteractive -Command ^
  "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('%~2','%~1')" >nul 2>&1
goto :EOF
