#!/bin/bash
# Quickstart script for running the frontend/backend split development setup.
# Starts the Django backend and React frontend in parallel.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)/.."

# Keep the SSH tunnel alive in the background, restarting on failure
keep_tunnel_alive() {
    while true; do
        ssh -L 5432:localhost:5432 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes birdsociety -N
        echo "SSH tunnel dropped, restarting in 3s..."
        sleep 3
    done
}
keep_tunnel_alive &
TUNNEL_PID=$!
echo "SSH tunnel watcher started (PID $TUNNEL_PID)"

echo "Waiting for port 5432 to be ready..."
for i in $(seq 1 30); do
    if nc -z 127.0.0.1 5432 2>/dev/null; then
        echo "Port 5432 is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Port 5432 not available after 30s. Check SSH tunnel."
        exit 1
    fi
    sleep 1
done

FRONTEND_DIR="$PROJECT_DIR/frontend"

cleanup() {
    echo ""
    echo "Shutting down..."
    kill $TUNNEL_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $TUNNEL_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

# --- Backend setup ---
echo "=== Backend ==="

if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "ERROR: .env file not found. Copy .env.example and fill in your values."
    exit 1
fi

if [ -d "$PROJECT_DIR/venv" ]; then
    echo "Activating virtual environment..."
    source "$PROJECT_DIR/venv/bin/activate"
fi

echo "Installing Python dependencies..."
pip install -q -r "$PROJECT_DIR/requirements.txt"

echo "Running migrations..."
python "$PROJECT_DIR/manage.py" migrate --run-syncdb

echo "Creating superuser (admin/admin)..."
DJANGO_SUPERUSER_PASSWORD=admin123 python "$PROJECT_DIR/manage.py" createsuperuser \
    --noinput --username admin --email admin@birdsoc.com 2>/dev/null || true

echo "Starting Django server on http://localhost:8000 ..."
python "$PROJECT_DIR/manage.py" runserver 8000 &
BACKEND_PID=$!

# --- Frontend setup ---
echo ""
echo "=== Frontend ==="

echo "Installing Node dependencies..."
npm install --prefix "$FRONTEND_DIR"

echo "Starting Vite dev server on http://localhost:3000 ..."
npm run dev --prefix "$FRONTEND_DIR" &
FRONTEND_PID=$!

echo ""
echo "=== Both servers running ==="
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both."

wait
