#!/usr/bin/env bash
# safeL を起動し、ブラウザで開く（Raycast などから呼び出す用）

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR" || exit 1

URL="${SAFEL_URL:-http://localhost:3000}"
PORT="${PORT:-3000}"

# 既に起動していればブラウザだけ開く
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/health" 2>/dev/null | grep -q 200; then
  open "$URL"
  exit 0
fi

# バックグラウンドでサーバー起動
npm start &
PID=$!
sleep 2
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Failed to start server" >&2
  exit 1
fi
open "$URL"
