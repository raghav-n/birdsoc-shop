#!/bin/bash
# Quickstart script for running the frontend/backend split development setup.
# Starts the Django backend and React frontend in parallel.

set -e

ssh -L 5432:localhost:5432 birdsociety -Nf

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)/.."
FRONTEND_DIR="$PROJECT_DIR/frontend"

cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
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
