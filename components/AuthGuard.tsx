import React, { useState, useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 開発者用パスワードを環境変数から取得
  const DEVELOPER_PASSWORD = process.env.NEXT_PUBLIC_DEVELOPER_PASSWORD;

  useEffect(() => {
    // ローカルストレージから認証状態を確認
    const savedAuth = localStorage.getItem('dev_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!DEVELOPER_PASSWORD) {
      alert('開発者パスワードが設定されていません。環境変数を確認してください。');
      return;
    }
    if (password === DEVELOPER_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('dev_authenticated', 'true');
      // 使用開始をログ
      console.log('Developer session started:', new Date().toISOString());
    } else {
      alert('パスワードが正しくありません');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('dev_authenticated');
    setPassword('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-slate-300">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-100 text-center mb-6">
            🔒 開発者専用アクセス
          </h1>
          <p className="text-slate-400 text-center mb-6">
            このアプリは現在開発・テスト段階です。<br />
            開発者のみアクセス可能です。
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="開発者パスワードを入力"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              ログイン
            </button>
          </form>
          <div className="mt-6 text-xs text-slate-500 text-center">
            Photo Folder Organizer v1.0-beta<br />
            開発者テスト版
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 開発者用ヘッダー */}
      <div className="bg-yellow-900/30 border-b border-yellow-700/50 px-4 py-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-yellow-300">
            🧪 開発者モード | セッション開始: {new Date().toLocaleString('ja-JP')}
          </span>
          <button
            onClick={handleLogout}
            className="text-yellow-300 hover:text-yellow-100 underline"
          >
            ログアウト
          </button>
        </div>
      </div>
      {children}
    </div>
  );
};

export default AuthGuard;