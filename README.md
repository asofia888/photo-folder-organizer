<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Photo Folder Organizer

写真フォルダを簡単に整理できるアプリです。ドラッグ＆ドロップで散らかったフォルダを日付・イベントごとに整理し、手動で適切なフォルダ名を付けることができます。

## 機能

- 複数の画像フォルダの一括整理
- 日付・イベント別の自動グルーピング
- 手動でのフォルダ名編集機能
- 日本語・英語対応
- ブラウザ内でのプライベート処理

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
