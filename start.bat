@echo off
chcp 65001 >nul
echo ========================================
echo   TimeT - 启动前后端服务
echo ========================================
echo.

:: 获取当前目录
set "ROOT_DIR=%~dp0"

:: 启动后端服务 (新窗口)
echo [1/2] 启动后端服务 (FastAPI)...
start "TimeT Backend" cmd /k "cd /d %ROOT_DIR%backend && python run.py"

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 启动前端服务 (新窗口)
echo [2/2] 启动前端服务 (Next.js)...
start "TimeT Frontend" cmd /k "cd /d %ROOT_DIR%frontend && npm run dev"

echo.
echo ========================================
echo   服务启动完成!
echo   - 后端: http://localhost:8000
echo   - 前端: http://localhost:3000
echo   - API文档: http://localhost:8000/docs
echo ========================================
echo.
echo 按任意键关闭此窗口...
pause >nul
