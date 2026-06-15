#!/bin/bash

echo "🚀 Starting Xeno Growth OS (All Services)..."

# 1. Start Channel Service (Port 5001)
echo "📦 Starting Channel Service on port 5001..."
cd channel-service
npm run dev > ../channel-service.log 2>&1 &
CHANNEL_PID=$!
cd ..

# 2. Start CRM Backend (Port 3001)
echo "🧠 Starting CRM Backend on port 3001..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 3. Start Next.js Frontend (Port 3000)
echo "💻 Starting Frontend on port 3000..."
cd frontend
npm run dev
FRONTEND_PID=$!

# Trap SIGINT (Ctrl+C) to kill all background processes when the user stops the script
trap "echo '🛑 Stopping all services...'; kill $CHANNEL_PID $BACKEND_PID $FRONTEND_PID; exit 0" SIGINT SIGTERM

wait
