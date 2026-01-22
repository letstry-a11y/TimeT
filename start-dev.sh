#!/bin/bash

echo "========================================"
echo "  TimeTracker Development Environment"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERROR] Python3 is not installed${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Python and Node.js found${NC}"
echo ""

# Check backend .env
echo "[1/4] Checking backend configuration..."
cd backend
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[INFO] Creating .env file...${NC}"
    cat > .env << 'EOF'
APP_NAME=TimeTracker
DEBUG=True
API_V1_PREFIX=/api/v1
DATABASE_URL=sqlite+aiosqlite:///./timetracker.db
SECRET_KEY=dev-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
EOF
fi
cd ..

# Check frontend dependencies
echo "[2/4] Checking frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[INFO] Installing frontend dependencies...${NC}"
    npm install
fi
cd ..

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo ""
echo "[3/4] Starting Backend Server (Port 8000)..."
cd backend
python3 run.py &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Start frontend
echo "[4/4] Starting Frontend Server (Port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "  Servers Running"
echo "========================================"
echo ""
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo "========================================"
echo ""

# Wait for both processes
wait
