
# Threads OAuth トークン取得・保存ツール

## ✅ 概要

Threads OAuth 認証を通じて得たアクセストークンを、Netlify Functions 経由で Google スプレッドシートに保存します。

---

## 📁 構成

- `exchange_token.js`: Meta API経由でアクセストークン取得
- `log_token.js`: Sheets API経由でトークンを保存
- `callback.html`: 認証コード受取・自動POST処理
- `.env`: 環境変数（Netlifyに設定）
- `package.json`: 依存パッケージ（`node-fetch`, `googleapis`）

---

## 🚀 導入手順（GitHub + Netlify 連携前提）

### 1. Google Cloud の設定

- サービスアカウントを作成し、Sheets API を有効化
- Googleスプレッドシートに編集権限付与（例：`sheets-writer@xxx.iam.gserviceaccount.com`）

### 2. GitHub に本プロジェクトをPush

```
git init
git remote add origin https://github.com/yourname/yourrepo.git
git add .
git commit -m "initial"
git push -u origin master
```

### 3. NetlifyとGitHubを連携

- Netlifyで新規サイト → GitHubリポジトリを選択

### 4. Netlify環境変数の設定

- `.env.example` を参考にすべて設定（PRIVATE_KEY は `\n` エスケープ）

---

## ✅ 完了後の動作

1. 認証が完了すると `/callback.html` に `code` が返却
2. `exchange_token.js` → アクセストークン取得
3. `log_token.js` → Google Sheets に自動保存

---

## 📝 Googleスプレッドシート構成（1行目）

| A列     | B列         | C列         | D列        | E列       |
|---------|-------------|-------------|------------|-----------|
| code    | short_token | long_token  | expires_in | timestamp |

