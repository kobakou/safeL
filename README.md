# safeL

日本語 ⇔ 英語 の翻訳 Web アプリ（DeepL 風）。バックエンドに **cursor-agent** を利用。動作環境は macOS。

## 必要なもの

- Node.js 18+
- **cursor-agent** が利用可能であること（プロンプトは標準入力で渡し、訳文を標準出力に出す）

## セットアップ

```bash
npm install
```

## 起動

```bash
npm start
```

ブラウザで http://localhost:3000 を開く。

開発時は `npm run dev` でファイル変更の自動再起動。

### Raycast から起動する

- **URL だけ開く**: Raycast の「Open URL」で `http://localhost:3000` を登録（サーバーは別途起動しておく）。
- **サーバー起動＋ブラウザをまとめて**: 次のいずれか。
  - **Script フォルダからリンクで使う**: Raycast の「Script Commands」で「Add Script Directory」しているフォルダ（例: `~/RaycastScripts`）に、safeL のスクリプトへのシンボリックリンクを作る。
    ```bash
    # 例: Raycast の Script フォルダが ~/RaycastScripts の場合
    ln -s /Users/Kou.Kobayashi/Workspace/src/github.com/kobakou/safeL/scripts/start-and-open.sh ~/RaycastScripts/start-safel.sh
    ```
    作成後、Raycast で「Script Commands」を開くと `start-safel.sh` が一覧に出る。
  - **Run Script で直接指定**: 「Run Script」の Script に `bash /Users/Kou.Kobayashi/Workspace/src/github.com/kobakou/safeL/scripts/start-and-open.sh` を指定する。
- 既にサーバーが動いていればブラウザだけ開き、未起動なら `npm start` してから開く。開く URL は `http://localhost:3000`（`SAFEL_URL` で変更可能）。

## 環境変数

| 変数 | 説明 | 既定値 |
|------|------|--------|
| `PORT` | サーバーポート | `3000` |
| `CURSOR_CLI_CMD` | コマンド（スペース区切りで引数も指定可） | `cursor-agent` |

翻訳プロンプトを標準入力で渡し、訳文を標準出力から取得します。

## API

- `POST /api/translate`  
  Body: `{ "text": "原文", "sourceLang": "ja"|"en", "targetLang": "ja"|"en" }`  
  Response: `{ "translatedText": "訳文" }`

- `GET /api/health`  
  死活確認用。`{ "ok": true }` を返す。
