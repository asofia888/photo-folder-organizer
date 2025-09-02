import React, { useState, useEffect } from 'react';
import MemoryManager from '../utils/memoryManager';

interface MemoryMonitorProps {
  isVisible?: boolean;
}

const MemoryMonitor: React.FC<MemoryMonitorProps> = ({ isVisible = false }) => {
  const [memoryStats, setMemoryStats] = useState({
    objectUrlCount: 0,
    canvasCacheSize: 0,
    estimatedMemoryUsage: '0MB'
  });

  useEffect(() => {
    if (!isVisible) return;

    const updateStats = () => {
      const manager = MemoryManager.getInstance();
      setMemoryStats(manager.getMemoryStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const handleCleanup = () => {
    const manager = MemoryManager.getInstance();
    manager.cleanup();
    setMemoryStats({
      objectUrlCount: 0,
      canvasCacheSize: 0,
      estimatedMemoryUsage: '0MB'
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-4 text-xs text-slate-300 z-50 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-200">Memory Monitor</span>
        <button
          onClick={handleCleanup}
          className="text-red-400 hover:text-red-300 text-xs underline"
        >
          Cleanup
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Object URLs:</span>
          <span className="text-sky-400">{memoryStats.objectUrlCount}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Canvas Cache:</span>
          <span className="text-green-400">{memoryStats.canvasCacheSize}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Est. Memory:</span>
          <span className="text-yellow-400">{memoryStats.estimatedMemoryUsage}</span>
        </div>
      </div>
    </div>
  );
};

export default MemoryMonitor;