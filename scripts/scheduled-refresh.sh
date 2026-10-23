#!/usr/bin/env bash
# Windows のタスク スケジューラから週1回呼ぶ：日本の回線で国のデータを確かめ、変わっていれば控えを差し替えて作り直す
# 動作確認だけするとき: bash scripts/scheduled-refresh.sh --check
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p data
LOG=data/refresh.log

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 $*"
  if ! GH_TOKEN=$(gh auth token --user mico95official-create); then
    echo "=== 失敗：gh のトークン（mico95official-create）を取れません"
    exit 1
  fi
  export GH_TOKEN
  if [ "${1:-}" = "--check" ]; then
    command -v node tar gh
    code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 30 "https://www.mhlw.go.jp/stf/shingi/shingi-chuo.html?tid=128164")
    echo "厚労省の応答: $code"
    gh release view data-latest -R micoficial/shujutsu --json assets --jq '.assets[] | "控え: \(.name) \(.size) \(.updatedAt)"'
    echo "=== 確認だけ（データは更新していません）"
    exit 0
  fi
  if bash scripts/refresh-data.sh; then echo "=== 完了"; else echo "=== 失敗（終了コード $?）"; fi
} >> "$LOG" 2>&1
