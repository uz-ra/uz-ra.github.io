# Penelope Caption Studio

写真展用の作品情報をCSVから読み込み、A4横・1ページ6作品のキャプションを編集、印刷できるツールです。

## Web UI

<https://uz-ra.github.io/penelope/>

### 使い方

1. UTF-8のCSVを「CSVを選ぶ」から選択するか、画面へドロップします。
2. 左側の作品一覧から作品を選び、右側のフォームで内容を確認・編集します。
3. 「文字設定」を開くと、選択中の作品だけ、タイトル・所属／作者・キャプション・撮影情報の文字サイズを個別に変更できます。
4. SNSリンクから作るQRコードで `?` 以降を省きたい場合は、「QRリンクのクエリを削除」をオンにします。
5. 矢印ボタンで作品の順番を変更できます。
6. 「CSVを書き出す」で編集結果を保存し、「PDF / 印刷」で印刷またはPDF保存します。

CSVの内容はサーバーへ送信されず、ブラウザ内だけで処理されます。読み込み元にあった未使用の列も、CSV書き出し時にそのまま保持されます。

列名を照合するときは半角・全角を含む空白を無視します。たとえば `作品タイトル / Title` と `作品タイトル/Title` は同じ列として認識します。CSVを書き出す際の列名は、読み込み元の表記を保持します。

## 対応するCSV列名

### 必須

| 列名 | 内容 |
| --- | --- |
| `作品タイトル / Title` | 作品タイトル。列自体は必須ですが、値が空の行も読み込み、「タイトル未入力」として要確認に数えます。 |

### 任意

| 列名 | 内容 |
| --- | --- |
| `表記する名前 / Written name` | キャプションに表示する作者名。 |
| `表示する名前 / Written name` | 上記の作者名列として同様に認識します。 |
| `表示する名前` | 上記の作者名列として同様に認識します。 |
| `本名 / Full name` | 表示する作者名が空の場合の代替名。 |
| `所属大学 / University` | 所属大学。` / ` 区切りの後半は表示時に省略されます。 |
| `学年/Grade` | 学年。` / ` 区切りの後半は表示時に省略されます。 |
| `キャプション / Caption` | 作品説明。`キャプション無し`、`キャプションなし`、`なし`、`無し`、`-` は空欄として扱います。 |
| `SNSアカウントのリンク / Link of social media account *optional` | QRコードにするURL。 |
| `撮影場所 / Location` | 撮影場所。 |
| `使用機材 / Camera` | カメラ名。 |
| `使用レンズ / Lens` | レンズ名。 |
| `シャッタースピード / Shutter Speed` | シャッタースピード。必要に応じて末尾に `s` を付けて表示します。 |
| `絞り値 / Aperture` | 絞り値。 |
| `ISO感度（使用フィルム） / ISO(Film name)` | ISO感度またはフィルム名。 |

作者名の列が複数ある場合は、表の上にある列名から優先して使用します。編集済みCSVを書き出す際は、読み込み時に使われていた作者名の列へ値を戻します。

## ローカル版（Python）

Web UIとは別に、画像とPDFを一括生成する従来のPythonスクリプトも利用できます。

### 必須環境

- macOS
- Python 3.10以上
- `HannariMincho-Regular.otf`（`~/Library/Fonts/`）
- `Avenir Next.ttc`（macOS標準）
- `ヒラギノ角ゴシック W1.ttc`（macOS標準）

### セットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pillow qrcode pilmoji
```

### 実行

```bash
python penelope2.py --csv input.csv --out build/photo_exhibition_pages
```

- `--csv`: 読み込むCSV（既定値: `input.csv`）
- `--out`: PNGの出力先（既定値: `build/photo_exhibition_pages`）

出力されるファイル:

- `build/exhibition_captions.pdf`: 全ページをまとめた印刷用PDF
- `build/photo_exhibition_pages/page_*.png`: 各ページのPNG画像
