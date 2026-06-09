@echo off
echo =========================================
echo   WMS Outbound DC Report - GR3-008
echo   Starting local web server...
echo =========================================
echo.
echo กรุณาเปิด Browser แล้วไปที่:
echo   http://localhost:8080
echo.
echo กด Ctrl+C เพื่อหยุด server
echo.
python -m http.server 8080 --directory "%~dp0"
pause
