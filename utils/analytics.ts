// 開発者向けアナリティクス（localStorage にのみ保存し、外部送信は行わない）
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
}

// シングルトンインスタンス
export const analytics = new DevAnalytics();
