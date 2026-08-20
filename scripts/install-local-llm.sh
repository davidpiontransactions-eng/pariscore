#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  Installation d'un serveur LLM local (MAX serve / Ollama) sur le VPS PariScore
# ══════════════════════════════════════════════════════════════════════════════
#  Usage :
#    bash scripts/install-local-llm.sh                # Ollama (défaut, zéro auth)
#    bash scripts/install-local-llm.sh --engine max    # MAX serve (nécessite modular auth)
#    bash scripts/install-local-llm.sh --engine ollama --model mistral:7b
#
#  Le serveur expose une API OpenAI-compatible sur 127.0.0.1:8000/v1.
#  Ajouter ensuite dans .env du VPS :
#    LLM_PROVIDER=auto
#    LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1
#    LOCAL_LLM_MODEL=llama3.1:8b          # (Ollama) ou llama-3.1-8b-instruct (MAX)
#    LLM_FALLBACK_ENABLED=true
#
#  Vérifier : curl http://127.0.0.1:8000/v1/models
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

ENGINE="${1:-ollama}"
MODEL=""
PORT=8000

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine) ENGINE="$2"; shift 2 ;;
    --model)  MODEL="$2";  shift 2 ;;
    --port)   PORT="$2";   shift 2 ;;
    *)        shift ;;
  esac
done

echo "═══ Installation LLM local : engine=$ENGINE, port=$PORT ═══"

# ── Ollama (défaut) ──────────────────────────────────────────────────────────
install_ollama() {
  MODEL="${MODEL:-llama3.1:8b}"

  if command -v ollama &>/dev/null; then
    echo "✓ Ollama déjà installé : $(ollama --version 2>/dev/null || echo 'ok')"
  else
    echo "→ Installation Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
  fi

  # Configurer le port (défaut Ollama = 11434 → on force 8000 pour unifier)
  if ! grep -q "OLLAMA_HOST" /etc/systemd/system/ollama.service 2>/dev/null; then
    echo "→ Configuration OLLAMA_HOST=127.0.0.1:$PORT..."
    sudo mkdir -p /etc/systemd/system/ollama.service.d
    cat <<EOF | sudo tee /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=127.0.0.1:$PORT"
EOF
    sudo systemctl daemon-reload
  fi

  sudo systemctl enable ollama
  sudo systemctl restart ollama
  sleep 2

  echo "→ Téléchargement du modèle $MODEL (peut prendre plusieurs minutes)..."
  ollama pull "$MODEL"

  echo ""
  echo "═══ Ollama installé ═══"
  echo "  Endpoint : http://127.0.0.1:$PORT/v1"
  echo "  Modèle   : $MODEL"
  echo "  Test     : curl http://127.0.0.1:$PORT/v1/models"
  echo ""
  echo "  Variables .env à ajouter :"
  echo "    LLM_PROVIDER=auto"
  echo "    LOCAL_LLM_BASE_URL=http://127.0.0.1:$PORT/v1"
  echo "    LOCAL_LLM_MODEL=$MODEL"
  echo "    LLM_FALLBACK_ENABLED=true"
}

# ── MAX serve ────────────────────────────────────────────────────────────────
install_max() {
  MODEL="${MODEL:-llama-3.1-8b-instruct}"

  if ! command -v modular &>/dev/null; then
    echo "→ Installation du CLI Modular..."
    pip install modular --break-system-packages 2>/dev/null || pip install modular
  fi

  echo "→ Vérification de l'authentification Modular..."
  if ! modular auth status &>/dev/null; then
    echo ""
    echo "  ⚠ MAX serve nécessite une authentification Modular."
    echo "  Exécutez : modular auth login"
    echo "  (Compte gratuit sur https://auth.modular.com)"
    echo ""
    modular auth login
  fi

  echo "→ Installation de MAX serve..."
  pip install "max[serve]" --extra-index-url https://whl.modular.com/nightly/simple/ --break-system-packages 2>/dev/null || \
    pip install "max[serve]" --extra-index-url https://whl.modular.com/nightly/simple/

  # Service systemd
  cat <<EOF | sudo tee /etc/systemd/system/pariscore-llm.service
[Unit]
Description=PariScore Local LLM (MAX serve)
After=network.target

[Service]
Type=simple
User=$(whoami)
ExecStart=$(which max) serve --model "$MODEL" --port $PORT
Restart=on-failure
RestartSec=5
Environment="HOME=$HOME"

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable pariscore-llm
  sudo systemctl start pariscore-llm
  sleep 3

  echo ""
  echo "═══ MAX serve installé ═══"
  echo "  Endpoint : http://127.0.0.1:$PORT/v1"
  echo "  Modèle   : $MODEL"
  echo "  Test     : curl http://127.0.0.1:$PORT/v1/models"
  echo ""
  echo "  Variables .env à ajouter :"
  echo "    LLM_PROVIDER=auto"
  echo "    LOCAL_LLM_BASE_URL=http://127.0.0.1:$PORT/v1"
  echo "    LOCAL_LLM_MODEL=$MODEL"
  echo "    LLM_FALLBACK_ENABLED=true"
}

# ── Dispatch ─────────────────────────────────────────────────────────────────
case "$ENGINE" in
  ollama) install_ollama ;;
  max)    install_max ;;
  *)      echo "Engine inconnu: $ENGINE (utiliser ollama ou max)"; exit 1 ;;
esac

echo ""
echo "→ Vérification finale..."
sleep 2
if curl -sf "http://127.0.0.1:$PORT/v1/models" >/dev/null 2>&1; then
  echo "✓ Serveur LLM local opérationnel sur 127.0.0.1:$PORT"
else
  echo "⚠ Le serveur ne répond pas encore — vérifiez les logs :"
  echo "  journalctl -u ollama -n 20        # (Ollama)"
  echo "  journalctl -u pariscore-llm -n 20  # (MAX)"
fi