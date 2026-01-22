@echo off
chcp 65001 >nul
echo ========================================
echo   TimeT - 停止所有服务
echo ========================================
echo.

:: 停止 Node.js (前端)
echo 停止前端服务...
taskkill /f /im node.exe 2>nul
if %errorlevel%==0 (
    echo   前端服务已停止
) else (
    echo   前端服务未运行
)

:: 停止 Python (后端)
echo 停止后端服务...
taskkill /f /im python.exe 2>nul
if %errorlevel%==0 (
    echo   后端服务已停止
) else (
    echo   后端服务未运行
)

echo.
echo ========================================
echo   所有服务已停止
echo ========================================
echo.
pause
