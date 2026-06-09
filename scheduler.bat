@echo off
chcp 65001 >nul
setlocal

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

set "TASK1=GR3-008 Auto Update 10:00"
set "TASK2=GR3-008 Auto Update 16:00"
set "CMD=%DIR%\update-data.bat"

echo ===================================================
echo  ตั้ง Windows Task Scheduler — GR3-008
echo  Script: %CMD%
echo ===================================================
echo.

:: ลบ task เดิม (ถ้ามี)
schtasks /delete /tn "%TASK1%" /f >nul 2>&1
schtasks /delete /tn "%TASK2%" /f >nul 2>&1

:: สร้าง task 10:00
schtasks /create ^
  /tn "%TASK1%" ^
  /tr "cmd /c \"%CMD%\" auto" ^
  /sc daily /st 10:00 ^
  /rl highest /f
if errorlevel 1 (
  echo [ERROR] สร้าง task 10:00 ไม่สำเร็จ — ลองรัน scheduler.bat ในฐานะ Administrator
) else (
  echo [OK] task 10:00 — สร้างแล้ว
)

:: สร้าง task 16:00
schtasks /create ^
  /tn "%TASK2%" ^
  /tr "cmd /c \"%CMD%\" auto" ^
  /sc daily /st 16:00 ^
  /rl highest /f
if errorlevel 1 (
  echo [ERROR] สร้าง task 16:00 ไม่สำเร็จ
) else (
  echo [OK] task 16:00 — สร้างแล้ว
)

echo.
echo ===================================================
echo  Tasks ที่ลงทะเบียนไว้:
echo ===================================================
schtasks /query /tn "%TASK1%" /fo list 2>nul | findstr /i "Task Name Next Run Status"
schtasks /query /tn "%TASK2%" /fo list 2>nul | findstr /i "Task Name Next Run Status"

echo.
echo ===================================================
echo  สำหรับ real-time watch (file watcher) ให้รัน:
echo    node watch.js
echo.
echo  ติดตั้ง dependencies ก่อนใช้งาน:
echo    npm install
echo ===================================================
echo.
pause
