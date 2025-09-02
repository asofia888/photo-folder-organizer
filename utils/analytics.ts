// 開発者向けアナリティクス
interface AnalyticsEvent {
  event: string;
  timestamp: string;
  sessionId: string;
  data?: any;
}

class DevAnalytics {
  private sessionId: string;
  private events: AnalyticsEvent[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadStoredEvents();
    this.trackEvent('session_start');
  }

  private generateSessionId(): string {
    return `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadStoredEvents(): void {
    try {
      const stored = localStorage.getItem('dev_analytics_events');
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored analytics events:', error);
    }
  }

  private saveEvents(): void {
    try {
      // 最新の100イベントのみ保持
      const eventsToStore = this.events.slice(-100);
      localStorage.setItem('dev_analytics_events', JSON.stringify(eventsToStore));
    } catch (error) {
      console.warn('Failed to save analytics events:', error);
    }
  }

  trackEvent(event: string, data?: any): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      data
    };

    this.events.push(analyticsEvent);
    this.saveEvents();

    // 開発モードでコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Event:', analyticsEvent);
    }
  }

  // フォルダ処理開始
  trackFolderProcessingStart(folderCount: number, fileCount: number): void {
    this.trackEvent('folder_processing_start', {
      folderCount,
      fileCount,
      startTime: performance.now()
    });
  }

  // フォルダ処理完了
  trackFolderProcessingComplete(processingTime: number, successCount: number, errorCount: number): void {
    this.trackEvent('folder_processing_complete', {
      processingTime,
      successCount,
      errorCount,
      avgTimePerFolder: successCount > 0 ? processingTime / successCount : 0
    });
  }

  // AI提案使用
  trackAISuggestionUsed(photoCount: number, responseTime: number, successful: boolean): void {
    this.trackEvent('ai_suggestion_used', {
      photoCount,
      responseTime,
      successful,
      timestamp: Date.now()
    });
  }

  // スクリプト生成
  trackScriptGenerated(folderCount: number, platform: string): void {
    this.trackEvent('script_generated', {
      folderCount,
      platform,
      timestamp: Date.now()
    });
  }

  // エラートラッキング
  trackError(errorType: string, errorMessage: string, context?: any): void {
    this.trackEvent('error_occurred', {
      errorType,
      errorMessage,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }

  // パフォーマンスメトリクス
  trackPerformance(metric: string, value: number, unit: string = 'ms'): void {
    this.trackEvent('performance_metric', {
      metric,
      value,
      unit,
      timestamp: Date.now()
    });
  }

  // セッション統計を取得
  getSessionStats(): any {
    const sessionEvents = this.events.filter(e => e.sessionId === this.sessionId);
    const eventCounts = sessionEvents.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      sessionId: this.sessionId,
      totalEvents: sessionEvents.length,
      eventCounts,
      sessionDuration: Date.now() - parseInt(this.sessionId.split('_')[1]),
      startTime: new Date(parseInt(this.sessionId.split('_')[1])).toISOString()
    };
  }

  // 全イベントを取得（開発者用）
  getAllEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  // イベントをクリア
  clearEvents(): void {
    this.events = [];
    localStorage.removeItem('dev_analytics_events');
  }

  // 統計サマリーを生成
  generateReport(): string {
    const stats = this.getSessionStats();
    const allEvents = this.getAllEvents();
    
    const totalSessions = new Set(allEvents.map(e => e.sessionId)).size;
    const avgEventsPerSession = allEvents.length / totalSessions;
    
    const aiUsageEvents = allEvents.filter(e => e.event === 'ai_suggestion_used');
    const avgAIResponseTime = aiUsageEvents.length > 0 
      ? aiUsageEvents.reduce((sum, e) => sum + (e.data?.responseTime || 0), 0) / aiUsageEvents.length
      : 0;

    const processingEvents = allEvents.filter(e => e.event === 'folder_processing_complete');
    const avgProcessingTime = processingEvents.length > 0
      ? processingEvents.reduce((sum, e) => sum + (e.data?.processingTime || 0), 0) / processingEvents.length
      : 0;

    return `
🔍 Photo Folder Organizer - 開発者レポート
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 基本統計:
- 総セッション数: ${totalSessions}
- 総イベント数: ${allEvents.length}
- セッションあたり平均イベント数: ${avgEventsPerSession.toFixed(1)}

⚡ パフォーマンス:
- AI提案平均レスポンス時間: ${avgAIResponseTime.toFixed(0)}ms
- フォルダ処理平均時間: ${avgProcessingTime.toFixed(0)}ms

🎯 機能使用状況:
- AI提案使用回数: ${aiUsageEvents.length}
- フォルダ処理完了回数: ${processingEvents.length}
- スクリプト生成回数: ${allEvents.filter(e => e.event === 'script_generated').length}

❌ エラー:
- エラー発生回数: ${allEvents.filter(e => e.event === 'error_occurred').length}

🕒 現在のセッション:
- セッション時間: ${(stats.sessionDuration / 1000 / 60).toFixed(1)}分
- セッション内イベント数: ${stats.totalEvents}
`;
  }
}

// シングルトンインスタンス
export const analytics = new DevAnalytics();

// 便利な関数をエクスポート
export const trackEvent = (event: string, data?: any) => analytics.trackEvent(event, data);
export const trackError = (errorType: string, errorMessage: string, context?: any) => 
  analytics.trackError(errorType, errorMessage, context);
export const trackPerformance = (metric: string, value: number, unit?: string) => 
  analytics.trackPerformance(metric, value, unit);

export default analytics;