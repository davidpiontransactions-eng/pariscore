#!/usr/bin/env bash
# PariScore EDA — VPS Ubuntu install script
# Run from project root: bash tools/install-eda-vps.sh
# Requires: python3.11 or python3.11-venv available

set -euo pipefail

VENV_DIR=".venv-data"
PYTHON_BIN=""

echo "[EDA] Looking for Python 3.11..."
for candidate in python3.11 python3.10 python3; do
    if command -v "$candidate" &>/dev/null; then
        ver=$("$candidate" -c "import sys; print(sys.version_info[:2])")
        if [[ "$ver" == "(3, 11)" || "$ver" == "(3, 10)" ]]; then
            PYTHON_BIN=$(command -v "$candidate")
            break
        fi
    fi
done

if [[ -z "$PYTHON_BIN" ]]; then
    echo "[EDA] Installing python3.11..."
    sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
    PYTHON_BIN=$(command -v python3.11)
fi

echo "[EDA] Using $PYTHON_BIN ($(${PYTHON_BIN} --version))"

echo "[EDA] Creating venv at $VENV_DIR..."
"$PYTHON_BIN" -m venv "$VENV_DIR"

PIP="$VENV_DIR/bin/pip"

echo "[EDA] Upgrading pip + setuptools..."
"$PIP" install --upgrade "pip>=23" "setuptools<71" wheel

echo "[EDA] Installing pandas + numpy (pinned for compat)..."
"$PIP" install "numpy>=1.26,<2.5" "pandas>=2.0"

echo "[EDA] Installing fg-data-profiling (ydata-profiling fork, no numba)..."
"$PIP" install "fg-data-profiling>=4.19"

echo "[EDA] Installing D-Tale..."
"$PIP" install "dtale>=3.20"

echo "[EDA] Installing PandasAI..."
"$PIP" install "pandasai>=2.3"

VENV_PY="$(pwd)/$VENV_DIR/bin/python"
echo ""
echo "[EDA] Install complete."
echo "[EDA] Add to .env on VPS:"
echo "  EDA_PYTHON_BIN=$VENV_PY"
echo ""

# Smoke test
echo "[EDA] Smoke test imports..."
"$VENV_PY" - <<'PYEOF'
import data_profiling; print(f"  fg-data-profiling {data_profiling.__version__} OK")
import dtale; print(f"  dtale {dtale.__version__} OK")
import pandasai; print(f"  pandasai {pandasai.__version__} OK")
PYEOF

echo "[EDA] All OK. Run: pm2 restart pariscore (after updating .env)"
