@echo off
chcp 65001 >nul
title TimeTracker Development Server

echo ========================================
echo   TimeTracker Development Environment
echo ========================================
echo.

:: Detect Python command (try python, python3, py in order)
set "PYTHON_CMD="
python --version >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
    goto :python_found
)
python3 --version >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python3"
    goto :python_found
)
py --version >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=py"
    goto :python_found
)

:: Try Anaconda default path
if exist "D:\Anaconda\python.exe" (
    set "PYTHON_CMD=D:\Anaconda\python.exe"
    goto :python_found
)

echo [ERROR] Python is not installed or not in PATH
echo         Please install Python 3.10+ from https://python.org
pause
exit /b 1

:python_found
echo [OK] Python found: %PYTHON_CMD%

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo         Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found
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
start "Backend - TimeTracker" cmd /k "cd /d "%SCRIPT_DIR%backend" && %PYTHON_CMD% run.py"

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
echo   API Docs: http://localhost:8000/api/v1/docs
echo.
echo   Press any key to open in browser...
echo   Close this window to stop info display.
echo ========================================
echo.

pause >nul
start http://localhost:3000
