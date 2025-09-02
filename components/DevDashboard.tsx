import React, { useState, useEffect } from 'react';
import { analytics } from '../utils/analytics';

const DevDashboard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [report, setReport] = useState('');
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setReport(analytics.generateReport());
      setEvents(analytics.getAllEvents().slice(-20)); // 最新20件
    }
  }, [isOpen]);

  const clearData = () => {
    analytics.clearEvents();
    setReport('');
    setEvents([]);
    alert('データがクリアされました');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg z-50"
        title="開発者ダッシュボード"
      >
        📊
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="bg-purple-900/50 p-4 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">📊 開発者ダッシュボード</h2>
            <div className="flex gap-2">
              <button
                onClick={clearData}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                データクリア
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* レポート */}
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-3">📈 統計レポート</h3>
              <pre className="bg-slate-900 p-4 rounded text-green-400 text-sm whitespace-pre-wrap overflow-x-auto">
                {report}
              </pre>
            </div>

            {/* 最新イベント */}
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-3">🔄 最新イベント (20件)</h3>
              <div className="bg-slate-900 p-4 rounded max-h-96 overflow-y-auto">
                {events.map((event, index) => (
                  <div key={index} className="mb-2 p-2 bg-slate-800 rounded text-sm">
                    <div className="flex justify-between items-start">
                      <span className="text-blue-400 font-mono">{event.event}</span>
                      <span className="text-slate-500 text-xs">
                        {new Date(event.timestamp).toLocaleTimeString('ja-JP')}
                      </span>
                    </div>
                    {event.data && (
                      <pre className="text-slate-300 text-xs mt-1 overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* セッション情報 */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">🔍 現在のセッション</h3>
            <div className="bg-slate-900 p-4 rounded">
              <pre className="text-slate-300 text-sm">
                {JSON.stringify(analytics.getSessionStats(), null, 2)}
              </pre>
            </div>
          </div>

          {/* パフォーマンス指標 */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">⚡ パフォーマンス指標</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-blue-900/50 to-blue-800/50 p-4 rounded">
                <div className="text-blue-400 text-sm font-medium">メモリ使用量</div>
                <div className="text-white text-2xl font-bold">
                  {(performance as any).memory ? 
                    `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB` : 
                    'N/A'
                  }
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-900/50 to-green-800/50 p-4 rounded">
                <div className="text-green-400 text-sm font-medium">ページロード時間</div>
                <div className="text-white text-2xl font-bold">
                  {Math.round(performance.now())}ms
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-900/50 to-purple-800/50 p-4 rounded">
                <div className="text-purple-400 text-sm font-medium">接続タイプ</div>
                <div className="text-white text-lg font-bold">
                  {(navigator as any).connection?.effectiveType || 'unknown'}
                </div>
              </div>
            </div>
          </div>

          {/* 開発者向けアクション */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">🛠️ 開発者アクション</h3>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => analytics.trackEvent('manual_test_event', { source: 'dashboard' })}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
              >
                テストイベント送信
              </button>
              <button
                onClick={() => console.log('All Events:', analytics.getAllEvents())}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
              >
                コンソールに出力
              </button>
              <button
                onClick={() => {
                  const data = {
                    report: analytics.generateReport(),
                    events: analytics.getAllEvents(),
                    sessionStats: analytics.getSessionStats()
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analytics-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm"
              >
                データエクスポート
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevDashboard;