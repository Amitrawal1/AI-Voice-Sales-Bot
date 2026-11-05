#!/usr/bin/env bash
# Convert Oriserve/Whisper-Hindi2Hinglish-Apex (Transformers format) to CTranslate2 for faster-whisper.
# Run inside the voice server's virtualenv (it has ctranslate2, transformers and torch).
set -euo pipefail

OUT="${1:-models/whisper-hindi2hinglish-apex-ct2}"
QUANTIZATION="${QUANTIZATION:-float16}"

ct2-transformers-converter \
  --model Oriserve/Whisper-Hindi2Hinglish-Apex \
  --output_dir "$OUT" \
  --copy_files tokenizer.json preprocessor_config.json \
  --quantization "$QUANTIZATION"

echo "Converted to $OUT. Set WHISPER_MODEL_DIR=$OUT in .env."
