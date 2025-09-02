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

### 前提条件
- GitHub アカウント
- [Vercel](https://vercel.com) アカウント
- [Google AI Studio](https://aistudio.google.com/app/apikey) からの Gemini API キー

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

3. **環境変数の設定**
   - Vercel プロジェクト設定の "Environment Variables" で追加：
     ```
     GEMINI_API_KEY = your_actual_gemini_api_key_here
     ```

4. **デプロイ完了**
   - 自動でビルド・デプロイが開始されます
   - 数分で `https://your-project-name.vercel.app` でアクセス可能になります

## API エンドポイント

- `POST /api/generateFolderName` - 画像からフォルダ名を生成
  - Body: `{ images: [{ data: string, mimeType: string }], locale: 'ja'|'en' }`
  - Response: `{ suggestion: string }`

## トラブルシューティング

- **API が 503 エラーを返す**: Vercel の環境変数で `GEMINI_API_KEY` が正しく設定されているか確認
- **ビルドエラー**: Node.js 18+ が使用されていることを確認
