# 手術件数しらべ

病院ごとの手術件数・入院患者数・平均在院日数を、厚生労働省が公開しているDPC（診断群分類）のデータから、病院・病気・都道府県ごとのページにして無料で公開する静的サイトです。

公開先：https://micoficial.github.io/shujutsu/

## データ

| データ | 提供 | 使い方 |
|---|---|---|
| [DPCの評価・検証等に係る調査「退院患者調査」の結果報告](https://www.mhlw.go.jp/stf/shingi/shingi-chuo.html?tid=128164)（毎年度。いま使っているのは令和6年度＝2024年6月〜2025年5月退院） | 厚生労働省 | 施設概要表、疾患別手術別集計（MDC01〜18）、MDC別医療機関別件数、在院日数の状況、救急車搬送・救急医療入院・紹介・退院先、手術・化学療法・放射線療法・全身麻酔、施設類型別、診断群分類毎の集計 |
| [診断群分類（DPC）電子点数表](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000198757_00008.html) | 厚生労働省 | 病気の名前、手術の区分（診断群分類番号の9・10桁目）に含まれる術式の名前 |
| [全国地方公共団体コード](https://www.soumu.go.jp/denshijiti/code.html) | 総務省 | 市区町村の名前 |

厚労省のサイトの情報は「公共データ利用規約（第1.0版）」準拠。出典と「加工して作成」の記載が必要で、国が作成したように見せてはいけない（全ページのフッターに入れている）。

## 動かし方

```bash
bash scripts/fetch.sh      # データを data/raw/src/ に取得（約8,000万バイト、日本の回線で1〜2分）
node scripts/build.mjs     # dist/ に約1.25万ページを生成（40秒ほど）
node scripts/serve.mjs     # http://localhost:4174/shujutsu/ で確認
```

`LIMIT=300 node scripts/build.mjs` で病院ページを300件だけ作れる（試すとき用）。

## 仕組み

- `scripts/fetch.mjs`：中医協のページから**いちばん新しい年度**の「退院患者調査」の報告を探し、リンク名で必要なExcelを選んで取る。年度に合う電子点数表のページは `TREES` に書いてある（2年ごとの診療報酬改定で足す）。`--if-changed` を付けると、前回とファイルのURLが同じなら取らずに終了コード3で終わる
- `scripts/lib/xlsx.mjs`：依存なしの xlsx 読み取り（ZIPを開いて sharedStrings とシートのXMLを読む）
- `scripts/lib/load.mjs`：Excelを読む。見出しの文字が想定と違ったら止まる（黙って変な数字を出さない）
- `scripts/lib/model.mjs`：病院×病気×手術の区分の件数を足し、トピック・病気・都道府県のランキングを作る。10件未満の「－」は0件として足し、伏せられた区分の数も持つ（表示は「120〜138」の幅）
- `scripts/lib/topics.mjs`：「胃がん」「人工膝関節」などのランキングの定義（どの病気のどの区分を数えるか）。区分の中身は電子点数表で決まっている
- `scripts/lib/ops.mjs`：手術の区分の名前を電子点数表の術式名から作る（全国で件数の多い術式の順）
- `scripts/pages/`：病院（`hospital.mjs`）、ランキング・病気（`ranking.mjs`）、トップ・都道府県・説明（`hubs.mjs`）
- `.github/workflows/deploy.yml`：push と毎週月曜4:30（日本時間）に作り直して GitHub Pages に出す。`data/summary.json` を毎回コミットするので、定期実行が60日で止まることもない
- **国のサイトが海外からのアクセスを断るとき**は、リリース `data-latest` の控え（`raw-data.tar.gz`）を使う。控えは日本の回線で `GH_TOKEN=... bash scripts/refresh-data.sh` を実行すると差し替わり、作り直しも始まる。このPCではタスク スケジューラ（mico-shujutsu-data-refresh）が毎週月曜9:30に `scripts/scheduled-refresh.sh` 経由で実行する（国のデータが変わっていなければ何もしない）

## 注意

- 件数の多さは治療の質を示さない。全ページに注意書きを出し、「名医」「おすすめ」などの言葉は使わない
- 件数は「その区分の手術を受けて退院した患者数」。入院1日以内（日帰り）や24時間以内の死亡などは国の集計の対象外
- 病院名の短い呼び名（`scripts/lib/format.mjs` の `shortName`）は機械的に作っている。正式名は各病院ページに載せている
