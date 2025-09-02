<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Photo Folder Organizer

写真を自動的に分析してフォルダ名を提案するAIアプリです。Google Gemini AIを使用して画像の内容を理解し、適切なフォルダ名を生成します。

## 機能

- 複数の画像をアップロード
- AI による画像分析とフォルダ名の自動生成
- 日本語・英語対応
- ブラウザ内でのプライベート処理

## ローカル開発

**Prerequisites:** Node.js 18+

1. 依存関係をインストール:
   ```bash
   npm install
   ```

2. 環境変数を設定:
   `.env.local` ファイルに Gemini API キーを設定
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

## Vercel デプロイ

1. GitHub リポジトリを作成してコードをプッシュ
2. [Vercel](https://vercel.com) アカウントでGitHub リポジトリを接続
3. 環境変数 `GEMINI_API_KEY` を Vercel の設定で追加
4. デプロイ完了

## API エンドポイント

- `POST /api/generateFolderName` - 画像からフォルダ名を生成
