/**
 * Memory management utilities for handling large numbers of images
 */

export class MemoryManager {
  private static instance: MemoryManager;
  private objectUrls: Set<string> = new Set();
  private canvasCache: Map<string, HTMLCanvasElement> = new Map();
  private cleanupCallbacks: Array<() => void> = [];
  private memoryCheckInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private readonly MAX_CACHE_SIZE = 50;
  private readonly THUMBNAIL_SIZE = 200;
  private readonly MEMORY_THRESHOLD = 80; // Percentage

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Creates a memory-efficient thumbnail URL
   */
  async createThumbnailUrl(file: File): Promise<string> {
    const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
    
    // Check if we already have a cached canvas
    const cachedCanvas = this.canvasCache.get(cacheKey);
    if (cachedCanvas) {
      return this.canvasToObjectUrl(cachedCanvas);
    }

    // Create thumbnail
    const canvas = await this.createThumbnail(file);
    
    // Cache management - remove oldest if cache is full
    if (this.canvasCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.canvasCache.keys().next().value;
      if (firstKey) {
        this.canvasCache.delete(firstKey);
      }
    }
    
    this.canvasCache.set(cacheKey, canvas);
    return this.canvasToObjectUrl(canvas);
  }

  /**
   * Creates a thumbnail canvas from a file
   */
  private async createThumbnail(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      img.onload = () => {
        // Calculate thumbnail dimensions while maintaining aspect ratio
        const { width, height } = this.calculateThumbnailSize(img.width, img.height);
        
        canvas.width = width;
        canvas.height = height;

        // Draw the image on canvas with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Clean up the image element
        img.src = '';
        img.onload = null;
        img.onerror = null;
        
        resolve(canvas);
      };

      img.onerror = () => {
        img.src = '';
        img.onload = null;
        img.onerror = null;
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate thumbnail size maintaining aspect ratio
   */
  private calculateThumbnailSize(originalWidth: number, originalHeight: number): { width: number; height: number } {
    const maxSize = this.THUMBNAIL_SIZE;
    
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    
    if (originalWidth > originalHeight) {
      return {
        width: maxSize,
        height: Math.round(maxSize / aspectRatio)
      };
    } else {
      return {
        width: Math.round(maxSize * aspectRatio),
        height: maxSize
      };
    }
  }

  /**
   * Convert canvas to object URL and track it
   */
  private canvasToObjectUrl(canvas: HTMLCanvasElement): string {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Convert data URL to blob and create object URL
    const byteCharacters = atob(dataUrl.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    const url = URL.createObjectURL(blob);
    this.objectUrls.add(url);
    return url;
  }

  /**
   * Process images in batches to control memory usage
   */
  async processImageBatch<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    batchSize: number = 5
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
      
      // Force garbage collection hint between batches
      if (i + batchSize < items.length) {
        await this.forceGarbageCollection();
      }
    }
    
    return results;
  }

  /**
   * Force garbage collection (hint to browser)
   */
  private async forceGarbageCollection(): Promise<void> {
    // Create a small delay to allow garbage collection
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Force garbage collection if available (Chrome DevTools)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  /**
   * Clean up a specific object URL
   */
  revokeObjectUrl(url: string): void {
    if (this.objectUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(url);
    }
  }

  /**
   * Clean up all tracked object URLs
   */
  cleanup(): void {
    this.objectUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.objectUrls.clear();
    this.canvasCache.clear();
    
    // Run all cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    });
    
    this.stopMonitoring();
    console.log('MemoryManager: Full cleanup completed');
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    objectUrlCount: number;
    canvasCacheSize: number;
    estimatedMemoryUsage: string;
    systemMemory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
      utilization: number;
    };
  } {
    const estimatedMemory = (
      this.objectUrls.size * 0.5 + // ~0.5MB per thumbnail URL
      this.canvasCache.size * 0.2   // ~0.2MB per cached canvas
    ).toFixed(1);

    let systemMemory;
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window as any).performance) {
      const memory = (window as any).performance.memory;
      systemMemory = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        utilization: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }

    return {
      objectUrlCount: this.objectUrls.size,
      canvasCacheSize: this.canvasCache.size,
      estimatedMemoryUsage: `${estimatedMemory}MB`,
      systemMemory
    };
  }

  /**
   * Register cleanup callback
   */
  registerCleanupCallback(callback: () => void): () => void {
    this.cleanupCallbacks.push(callback);
    return () => {
      const index = this.cleanupCallbacks.indexOf(callback);
      if (index > -1) {
        this.cleanupCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 10000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.memoryCheckInterval = setInterval(() => {
      const stats = this.getMemoryStats();
      
      if (stats.systemMemory) {
        const utilization = stats.systemMemory.utilization;
        console.log(`Memory: ${Math.round(stats.systemMemory.usedJSHeapSize / 1024 / 1024)}MB (${utilization.toFixed(1)}%), URLs: ${stats.objectUrlCount}, Cache: ${stats.canvasCacheSize}`);
        
        if (utilization > this.MEMORY_THRESHOLD) {
          console.warn('High memory usage detected, performing cleanup...');
          this.performEmergencyCleanup();
        }
      }
    }, intervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Emergency cleanup for high memory situations
   */
  private performEmergencyCleanup(): void {
    // Clear half of the canvas cache
    const cacheEntries = Array.from(this.canvasCache.entries());
    const toRemove = cacheEntries.slice(0, Math.floor(cacheEntries.length / 2));
    toRemove.forEach(([key]) => this.canvasCache.delete(key));

    // Clear older object URLs
    const urls = Array.from(this.objectUrls);
    if (urls.length > 20) {
      const toRemove = urls.slice(0, urls.length - 20);
      toRemove.forEach(url => {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(url);
      });
    }

    // Run cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    });

    this.forceGarbageCollection();
    console.log('Emergency cleanup completed');
  }

  /**
   * Check if memory usage is high
   */
  isMemoryUsageHigh(): boolean {
    const stats = this.getMemoryStats();
    return stats.systemMemory ? stats.systemMemory.utilization > this.MEMORY_THRESHOLD : false;
  }
}

export default MemoryManager;