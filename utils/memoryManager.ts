/**
 * Memory management utilities for handling large numbers of images
 */

export class MemoryManager {
  private static instance: MemoryManager;
  private objectUrls: Set<string> = new Set();
  private canvasCache: Map<string, HTMLCanvasElement> = new Map();
  private readonly MAX_CACHE_SIZE = 50;
  private readonly THUMBNAIL_SIZE = 200;

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
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    objectUrlCount: number;
    canvasCacheSize: number;
    estimatedMemoryUsage: string;
  } {
    const estimatedMemory = (
      this.objectUrls.size * 0.5 + // ~0.5MB per thumbnail URL
      this.canvasCache.size * 0.2   // ~0.2MB per cached canvas
    ).toFixed(1);

    return {
      objectUrlCount: this.objectUrls.size,
      canvasCacheSize: this.canvasCache.size,
      estimatedMemoryUsage: `${estimatedMemory}MB`
    };
  }
}

export default MemoryManager;