// Development aid: shows JS heap usage where the browser exposes
// performance.memory (Chromium). Rendered only in dev builds.
import React, { useState, useEffect } from 'react';

interface PerformanceMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

interface SystemMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  utilization: number;
}

const readHeapStats = (): SystemMemory | null => {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  if (!memory) return null;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    utilization: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
  };
};

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ isVisible, onToggle }) => {
  const [systemMemory, setSystemMemory] = useState<SystemMemory | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const updateStats = () => setSystemMemory(readHeapStats());
    const interval = setInterval(updateStats, 2000);
    updateStats(); // Initial update

    return () => clearInterval(interval);
  }, [isVisible]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMemoryColor = (utilization: number) => {
    if (utilization < 50) return 'text-green-400';
    if (utilization < 75) return 'text-yellow-400';
    if (utilization < 90) return 'text-orange-400';
    return 'text-red-400';
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-sm border border-slate-600 transition-colors"
        title="Show performance monitor"
      >
        📊 Performance
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-4 text-sm text-slate-200 max-w-sm shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-slate-100">Performance Monitor</h3>
        <button
          onClick={onToggle}
          className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          title="Hide performance monitor"
        >
          ×
        </button>
      </div>

      {/* Memory Stats */}
      {systemMemory ? (
        <div className="mb-3">
          <h4 className="font-medium text-slate-300 mb-1">System Memory</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Used:</span>
              <span className={getMemoryColor(systemMemory.utilization)}>
                {formatBytes(systemMemory.usedJSHeapSize)} ({systemMemory.utilization.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Limit:</span>
              <span>{formatBytes(systemMemory.jsHeapSizeLimit)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  systemMemory.utilization < 50
                    ? 'bg-green-500'
                    : systemMemory.utilization < 75
                      ? 'bg-yellow-500'
                      : systemMemory.utilization < 90
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(systemMemory.utilization, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 mb-3">Heap stats are unavailable in this browser.</p>
      )}

      {/* Performance Tips */}
      {systemMemory && systemMemory.utilization > 80 && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-700/30 rounded text-xs text-red-200">
          <div className="font-medium mb-1">⚠️ High Memory Usage</div>
          <div>Consider processing fewer files at once or reducing image sizes.</div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
