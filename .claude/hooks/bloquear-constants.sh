#!/usr/bin/env bash
# Hook PreToolUse: impide leer el archivo CONSTANTS.js (con Read, Grep o Bash).
# Sale con código 2 para bloquear la llamada y devolver el motivo a Claude.

entrada=$(cat)
objetivo=$(printf '%s' "$entrada" | jq -r '[.tool_input.file_path, .tool_input.path, .tool_input.command] | map(select(. != null)) | join(" ")')

if printf '%s' "$objetivo" | grep -qi 'CONSTANTS\.js'; then
  echo "Bloqueado: no está permitido leer CONSTANTS.js." >&2
  exit 2
fi
exit 0
