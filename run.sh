#!/usr/bin/env bash
# Video Tuxedo — Dev Server Launcher

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "🐧 Starting Video Tuxedo..."

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    ./.venv/bin/pip install --upgrade pip
    ./.venv/bin/pip install -r requirements.txt
fi

# Ensure motion-studio dependencies & player bundle are ready
if [ ! -d "motion-studio/node_modules" ]; then
    echo "📦 Installing Motion Studio npm dependencies..."
    cd motion-studio && npm install && npm run build:player && cd ..
elif [ ! -f "static/motion/player.bundle.js" ]; then
    echo "⚡ Building Remotion Player bundle..."
    cd motion-studio && npm run build:player && cd ..
fi

# Ensure SFX library is generated
if [ ! -f "motion-studio/public/sfx/sfx_paper_snap_v1.wav" ]; then
    echo "🎵 Generating procedural SFX library..."
    ./.venv/bin/python server/sfx_synth.py
fi

echo "🚀 Opening server at http://127.0.0.1:8000"
./.venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000 --reload
