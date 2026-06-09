@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: Usage:
::   update-data.bat          — interactive (pause at end)
::   update-data.bat auto     — silent/scheduler mode (no pause)

set "AUTO=%~1"
set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

set "LOG_DIR=%DIR%\logs"
set "LOG_FILE=%LOG_DIR%\update.log"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: ---- Find Git ----
set "GIT="
if exist "C:\Program Files\Git\cmd\git.exe"     set "GIT=C:\Program Files\Git\cmd\git.exe"
if exist "C:\Program Files (x86)\Git\cmd\git.exe" set "GIT=C:\Program Files (x86)\Git\cmd\git.exe"

:: ถ้าหาไม่เจอ ลองหาจาก PATH
if "%GIT%"=="" (
  for /f "tokens=*" %%G in ('where git 2^>nul') do (
    if "!GIT!"=="" set "GIT=%%G"
  )
)

if "%GIT%"=="" (
  call :LOG "ERROR: ไม่พบ git — ติดตั้งที่ https://git-scm.com"
  if /i not "%AUTO%"=="auto" pause
  exit /b 1
)

call :LOG "=== update-data.bat start (git: %GIT%) ==="

cd /d "%DIR%"

:: ---- Step 1: Convert Excel to JSON ----
call :LOG "running convert.js..."
node convert.js >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  call :LOG "ERROR: convert.js failed"
  call :NOTIFY "GR3-008 Error" "convert.js failed. ดู logs\update.log"
  goto :END_FAIL
)
call :LOG "convert สำเร็จ"

:: ---- Step 2: Git add ----
"%GIT%" add data/data.json 2>> "%LOG_FILE%"

:: ---- Step 3: Check staged diff ----
"%GIT%" diff --cached --quiet
if not errorlevel 1 (
  call :LOG "data.json ไม่เปลี่ยนแปลง — ไม่ push"
  goto :END_OK
)

:: ---- Step 4: Commit ----
for /f "tokens=*" %%T in ('powershell -NoProfile -Command "Get-Date -Format \"yyyy-MM-dd HH:mm\""') do set "NOW=%%T"
"%GIT%" commit -m "auto-update: data.json [%NOW%]" 2>> "%LOG_FILE%"
if errorlevel 1 (
  call :LOG "ERROR: git commit failed"
  goto :END_FAIL
)

:: ---- Step 5: Push ----
"%GIT%" push 2>> "%LOG_FILE%"
if errorlevel 1 (
  call :LOG "ERROR: git push failed — ดู logs\update.log"
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
set "_TS=%date% %time:~0,8%"
set "_MSG=[%_TS%] %~1"
echo %_MSG%
>> "%LOG_FILE%" echo %_MSG%
goto :EOF

:NOTIFY
powershell -NoProfile -NonInteractive -Command ^
  "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('%~2','%~1')" >nul 2>&1
goto :EOF
