#!/usr/bin/env bash
# Serve Sarvam-30B with vLLM's OpenAI-compatible API on port 8000.
#
# vLLM doesn't support Sarvam's architecture out of the box yet (vllm-project/vllm#33942), so
# this uses Sarvam's official hot-patch from the model repo, which pins vllm==0.15.0.
# Run it in its own virtualenv: vLLM and Parler-TTS need different torch/transformers versions.
#
# Memory: the bf16 weights are ~64 GB. On one 80 GB GPU shared with Whisper + Parler, keep
# GPU_MEMORY_UTILIZATION around 0.85. With two GPUs, set TENSOR_PARALLEL=2. QUANTIZATION=fp8
# roughly halves the weights if your GPU supports it; check answer quality if you use it.
set -euo pipefail

: "${LLM_API_KEY:?Set LLM_API_KEY (the same value goes in voice-server/.env and the web app)}"
VENV="${VENV:-.venv-llm}"
PORT="${PORT:-8000}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-8192}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.85}"
TENSOR_PARALLEL="${TENSOR_PARALLEL:-1}"
QUANTIZATION="${QUANTIZATION:-}"

if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip
  curl -fsSL -o /tmp/hotpatch_vllm.py https://huggingface.co/sarvamai/sarvam-30b/resolve/main/hotpatch_vllm.py
  "$VENV/bin/python" /tmp/hotpatch_vllm.py
fi

extra=()
[ -n "$QUANTIZATION" ] && extra+=(--quantization "$QUANTIZATION")

exec "$VENV/bin/vllm" serve sarvamai/sarvam-30b \
  --trust-remote-code \
  --dtype bfloat16 \
  --host 0.0.0.0 --port "$PORT" \
  --api-key "$LLM_API_KEY" \
  --max-model-len "$MAX_MODEL_LEN" \
  --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
  --tensor-parallel-size "$TENSOR_PARALLEL" \
  "${extra[@]}"
