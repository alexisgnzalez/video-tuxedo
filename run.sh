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

echo "🚀 Opening server at http://127.0.0.1:8000"
./.venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000 --reload
