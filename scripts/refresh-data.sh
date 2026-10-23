#!/usr/bin/env bash
# 日本の回線で最新データを取り、リリース「data-latest」の控え（raw-data.tar.gz）を差し替えて、サイトを作り直す
# 使い方: GH_TOKEN=<micoficial に書き込めるトークン> bash scripts/refresh-data.sh [--force]
#   国のデータが前回から変わっていなければ何もしない（--force で必ず差し替える）
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="micoficial/shujutsu"
mkdir -p data/raw
if [ "${1:-}" = "--force" ]; then
  node scripts/fetch.mjs
else
  set +e
  node scripts/fetch.mjs --if-changed
  code=$?
  set -e
  if [ "$code" = "3" ]; then echo "控えはそのままです"; exit 0; fi
  if [ "$code" != "0" ]; then echo "国のサイトから取得できませんでした（終了コード $code）" >&2; exit "$code"; fi
fi
rm -f data/raw/raw-data.tar.gz
tar -czf data/raw/raw-data.tar.gz -C data/raw src
ls -la data/raw/raw-data.tar.gz
if ! gh release view data-latest -R "$REPO" > /dev/null 2>&1; then
  gh release create data-latest -R "$REPO" --title "最新の公開データ（控え）" --notes-file scripts/release-notes.md
fi
gh release upload data-latest data/raw/raw-data.tar.gz -R "$REPO" --clobber
rm -f data/raw/raw-data.tar.gz
gh workflow run deploy.yml -R "$REPO" --ref main
echo "控えを更新し、作り直しを始めました"
