#!/bin/bash
cd /Users/mithurnjeromme/Desktop/xeno-grow/frontend
pkill -9 -f "next dev"
rm -rf .next
echo "Starting frontend..."
npm run dev
