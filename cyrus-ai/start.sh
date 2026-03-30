#!/usr/bin/env bash
# cyrus-ai/start.sh — start the CYRUS AI microservice for local development.
# Run from the repository root: bash cyrus-ai/start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if present
if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
  set +a
fi

PORT="${CYRUS_AI_PORT:-8001}"
CHROMA_DIR="${CHROMA_PERSIST_DIR:-${REPO_ROOT}/chroma_data}"
WORKERS="${CYRUS_AI_WORKERS:-1}"

# Prefer a virtual environment if one exists
VENV_PYTHON="${REPO_ROOT}/.venv/bin/python"
if [[ -x "${VENV_PYTHON}" ]]; then
  PYTHON="${VENV_PYTHON}"
else
  PYTHON="python3"
fi

# Install dependencies if needed
if ! "${PYTHON}" -c "import chromadb" 2>/dev/null; then
  echo "[cyrus-ai] Installing Python dependencies…"
  "${PYTHON}" -m pip install -q -r "${SCRIPT_DIR}/requirements.txt"
fi

echo "[cyrus-ai] Starting on port ${PORT} (chroma_dir=${CHROMA_DIR})"

cd "${SCRIPT_DIR}"

export CHROMA_PERSIST_DIR="${CHROMA_DIR}"

exec "${PYTHON}" -m uvicorn api:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --workers "${WORKERS}" \
  --log-level info
