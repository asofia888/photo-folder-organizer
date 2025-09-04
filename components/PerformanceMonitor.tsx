import React, { useState, useEffect, useCallback } from 'react';
import { useLazyThumbnails } from '../hooks/useLazyThumbnails';
import MemoryManager from '../utils/memoryManager';

interface PerformanceMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ isVisible, onToggle }) => {
  const [stats, setStats] = useState({
    memory: null as any,
    thumbnails: null as any,
    processing: {
      startTime: 0,
      endTime: 0,
      duration: 0,
      filesProcessed: 0,
      avgTimePerFile: 0
    }
  });
  
  const { getCacheStats } = useLazyThumbnails();
  const memoryManager = MemoryManager.getInstance();

  const updateStats = useCallback(() => {
    const memoryStats = memoryManager.getMemoryStats();
    const thumbnailStats = getCacheStats();
    
    setStats(prev => ({
      ...prev,
      memory: memoryStats,
      thumbnails: thumbnailStats
    }));
  }, [getCacheStats]);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(updateStats, 2000);
    updateStats(); // Initial update
    
    return () => clearInterval(interval);
  }, [isVisible, updateStats]);

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
      {stats.memory?.systemMemory && (
        <div className="mb-3">
          <h4 className="font-medium text-slate-300 mb-1">System Memory</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Used:</span>
              <span className={getMemoryColor(stats.memory.systemMemory.utilization)}>
                {formatBytes(stats.memory.systemMemory.usedJSHeapSize)} ({stats.memory.systemMemory.utilization.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Limit:</span>
              <span>{formatBytes(stats.memory.systemMemory.jsHeapSizeLimit)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  stats.memory.systemMemory.utilization < 50 
                    ? 'bg-green-500' 
                    : stats.memory.systemMemory.utilization < 75 
                      ? 'bg-yellow-500' 
                      : stats.memory.systemMemory.utilization < 90 
                        ? 'bg-orange-500' 
                        : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(stats.memory.systemMemory.utilization, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cache Stats */}
      <div className="mb-3">
        <h4 className="font-medium text-slate-300 mb-1">Cache</h4>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>Object URLs:</span>
            <span>{stats.memory?.objectUrlCount || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Canvas Cache:</span>
            <span>{stats.memory?.canvasCacheSize || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Thumbnails:</span>
            <span>{stats.thumbnails?.size || 0} / {stats.thumbnails?.maxSize || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Estimated:</span>
            <span>{stats.memory?.estimatedMemoryUsage || '0MB'}</span>
          </div>
        </div>
      </div>

      {/* Processing Stats */}
      {stats.processing.filesProcessed > 0 && (
        <div className="mb-3">
          <h4 className="font-medium text-slate-300 mb-1">Processing</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Files:</span>
              <span>{stats.processing.filesProcessed}</span>
            </div>
            <div className="flex justify-between">
              <span>Duration:</span>
              <span>{(stats.processing.duration / 1000).toFixed(1)}s</span>
            </div>
            <div className="flex justify-between">
              <span>Avg/file:</span>
              <span>{stats.processing.avgTimePerFile.toFixed(0)}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tips */}
      {stats.memory?.systemMemory && stats.memory.systemMemory.utilization > 80 && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-700/30 rounded text-xs text-red-200">
          <div className="font-medium mb-1">⚠️ High Memory Usage</div>
          <div>Consider processing fewer files at once or reducing image sizes.</div>
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 pt-2 border-t border-slate-700">
        <button
          onClick={() => memoryManager.cleanup()}
          className="text-xs bg-slate-600 hover:bg-slate-500 px-2 py-1 rounded transition-colors"
        >
          Force Cleanup
        </button>
      </div>
    </div>
  );
};

export default PerformanceMonitor;