#!/usr/bin/env bash
# 厚生労働省の DPC 公開データ（退院患者調査の結果報告）などを data/raw/src/ に取ってくる。
# 国のサイトは海外（GitHub Actions など）からのアクセスを断ることがあるため、
# 取れないときはリポジトリのリリース「data-latest」に置いた控え（raw-data.tar.gz）を使う。
# 控えの更新は日本の回線で scripts/refresh-data.sh を実行する。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
if node scripts/fetch.mjs; then
  echo "国のサイトから取得しました"
else
  echo "リリース data-latest の控えを使います" >&2
  rm -f data/raw/raw-data.tar.gz
  gh release download data-latest --pattern raw-data.tar.gz --dir data/raw --clobber
  rm -rf data/raw/src
  tar -xzf data/raw/raw-data.tar.gz -C data/raw
  rm -f data/raw/raw-data.tar.gz
fi
ls -la data/raw/src
