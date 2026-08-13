#!/usr/bin/env bash
# ── Phase-3: 下载 ONNX embedding 模型与 tokenizer ──
#
# 用法：
#   bash scripts/download-embed-model.sh          # 下载到 ~/.ccgui/models/embedding/
#   bash scripts/download-embed-model.sh --dev    # 下载到 src-tauri/resources/models/embedding/
#
# 下载 all-MiniLM-L6-v2（384 维 · ~90MB ONNX + 0.5MB tokenizer · 中英文可用）
#
# 注意：模型文件大，不可提交 git；.gitignore 已覆盖 *.onnx。

set -euo pipefail

DEV_MODE=false
if [ "${1:-}" = "--dev" ]; then
  DEV_MODE=true
fi

if $DEV_MODE; then
  MODEL_DIR="src-tauri/resources/models/embedding"
else
  MODEL_DIR="${HOME}/.ccgui/models/embedding"
fi

ONNX_FILE="${MODEL_DIR}/memory-embed-v1.onnx"
TOKENIZER_FILE="${MODEL_DIR}/tokenizer.json"

HF_BASE="https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main"

echo "=== Phase-3 Embedding Model Download ==="
echo ""
echo "Target directory: ${MODEL_DIR}"
echo "Mode: $(if $DEV_MODE; then echo "dev (repo resources)"; else echo "app data (~/.ccgui)"; fi)"
echo ""

# 确保目录存在
mkdir -p "${MODEL_DIR}"

# 检查是否已存在
if [ -f "${ONNX_FILE}" ]; then
  echo "✓ ONNX model already exists: ${ONNX_FILE}"
  echo "  (delete it first to re-download)"
else
  echo "→ Downloading ONNX model (~90MB)..."
  curl -fSL --progress-bar -o "${ONNX_FILE}" "${HF_BASE}/onnx/model.onnx"
  echo "✓ ONNX model saved: ${ONNX_FILE}"
fi

if [ -f "${TOKENIZER_FILE}" ]; then
  echo "✓ Tokenizer already exists: ${TOKENIZER_FILE}"
else
  echo "→ Downloading tokenizer.json (~0.5MB)..."
  curl -fSL --progress-bar -o "${TOKENIZER_FILE}" "${HF_BASE}/tokenizer.json"
  echo "✓ Tokenizer saved: ${TOKENIZER_FILE}"
fi

echo ""
echo "=== Done ==="
echo ""
echo "Files:"
ls -lh "${ONNX_FILE}" "${TOKENIZER_FILE}" 2>/dev/null || echo "  (some files missing — check logs above)"
echo ""
if $DEV_MODE; then
  echo "Model is in repo resources/ (dev use only; not bundled in installer)."
else
  echo "Model is in ~/.ccgui/models/embedding/ — the app will auto-detect it."
fi
echo "Without the model, the app falls back to lexical search — that's normal."
