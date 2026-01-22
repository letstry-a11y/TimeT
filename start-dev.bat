@echo off
chcp 65001 >nul
title TimeTracker Development Server

echo ========================================
echo   TimeTracker Development Environment
echo ========================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    pause
    exit /b 1
)

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo [OK] Python and Node.js found
echo.

:: Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Check backend dependencies
echo [1/4] Checking backend dependencies...
cd backend
if not exist ".env" (
    echo [INFO] Creating .env from example...
    copy .env.example .env >nul 2>&1
    if not exist ".env" (
        echo [INFO] Creating default .env...
        (
            echo APP_NAME=TimeTracker
            echo DEBUG=True
            echo API_V1_PREFIX=/api/v1
            echo DATABASE_URL=sqlite+aiosqlite:///./timetracker.db
            echo SECRET_KEY=dev-secret-key-change-in-production
            echo ALGORITHM=HS256
            echo ACCESS_TOKEN_EXPIRE_MINUTES=30
            echo REFRESH_TOKEN_EXPIRE_DAYS=7
            echo CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
        ) > .env
    )
)
cd ..

:: Check frontend dependencies
echo [2/4] Checking frontend dependencies...
cd frontend
if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install
)
cd ..

echo.
echo [3/4] Starting Backend Server (Port 8000)...
start "Backend - TimeTracker" cmd /k "cd /d "%SCRIPT_DIR%backend" && python run.py"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

echo [4/4] Starting Frontend Server (Port 3000)...
start "Frontend - TimeTracker" cmd /k "cd /d "%SCRIPT_DIR%frontend" && npm run dev"

echo.
echo ========================================
echo   Servers Starting...
echo ========================================
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Press any key to open in browser...
echo   Close this window to stop info display.
echo ========================================
echo.

pause >nul
start http://localhost:3000
