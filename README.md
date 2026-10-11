<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Photo Folder Organizer

公開URL: https://photo-folder-organizer.vercel.app

写真フォルダを簡単に整理できるアプリです。親フォルダをドラッグ＆ドロップすると、中のフォルダを撮影日順に並べ、`2024-06-15_夏休み` のような「日付_名前」形式の名前を付けられます。

## 機能

- 写真の撮影日（EXIF）から各フォルダの日付を決め、日付順に一覧表示（撮影日がない場合はファイルの更新日時から推定）
- 「日付_名前」形式でのフォルダ名の一括設定（使えない文字・重複名は入力時にチェック）
- Chrome・Edge: 新しい名前のフォルダへ写真をコピー（元の写真は変更せず、上書きもしない）
- Windows（.bat）・Mac/Linux（.sh）用のリネームスクリプトを生成
- RAW（埋め込みプレビュー表示）・HEIC 対応、日本語・英語対応
- すべてブラウザ内で処理（写真はアップロードされません）

## ローカル開発

**Prerequisites:** Node.js 18+

1. 依存関係をインストール:
   ```bash
   npm install
   ```

2. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

3. チェック（CI と同じ内容）:
   ```bash
   npm run type-check && npm run lint && npm run test:run && npm run build
   ```

## Vercel デプロイ

### 前提条件
- GitHub アカウント
- [Vercel](https://vercel.com) アカウント

### デプロイ手順

1. **GitHubリポジトリの準備**
   ```bash
   git clone https://github.com/asofia888/photo-folder-organizer.git
   cd photo-folder-organizer
   ```

2. **Vercelでのインポート**
   - [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
   - "Add New..." → "Project" を選択
   - GitHub リポジトリ `asofia888/photo-folder-organizer` をインポート

3. **デプロイ完了**
   - 自動でビルド・デプロイが開始されます
   - 数分で `https://your-project-name.vercel.app` でアクセス可能になります

## トラブルシューティング

- **ビルドエラー**: Node.js 18+ が使用されていることを確認
- **ブラウザ対応**: モダンブラウザ（Chrome、Firefox、Safari、Edge）での使用を推奨
