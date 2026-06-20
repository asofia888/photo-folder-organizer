/**
 * Lightweight memory monitor. Periodically logs JS heap usage as a development
 * aid and exposes a snapshot for the in-app PerformanceMonitor overlay.
 *
 * Thumbnail object URLs are owned by the components that create them
 * (Thumbnail / ImageModal create one from a File and revoke it on cleanup),
 * so this class intentionally holds no URL or canvas caches.
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private memoryCheckInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private readonly MEMORY_THRESHOLD = 80; // percent of the heap limit

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Snapshot of the JS heap, when the browser exposes performance.memory.
   */
  getMemoryStats(): {
    systemMemory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
      utilization: number;
    };
  } {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window as any).performance) {
      const memory = (window as any).performance.memory;
      return {
        systemMemory: {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          utilization: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        }
      };
    }
    return {};
  }

  /**
   * Start logging heap usage at the given interval (development aid).
   */
  startMonitoring(intervalMs: number = 10000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.memoryCheckInterval = setInterval(() => {
      const { systemMemory } = this.getMemoryStats();
      if (systemMemory) {
        const usedMb = Math.round(systemMemory.usedJSHeapSize / 1024 / 1024);
        console.log(`Memory: ${usedMb}MB (${systemMemory.utilization.toFixed(1)}%)`);
        if (systemMemory.utilization > this.MEMORY_THRESHOLD) {
          console.warn('High memory usage detected.');
        }
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Hint the browser to run garbage collection. Only effective when the
   * runtime exposes `gc` (Chrome with --expose-gc / DevTools); a no-op
   * otherwise.
   */
  cleanup(): void {
    if (typeof window !== 'undefined' && 'gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }
}

export default MemoryManager;
