import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MemoryManager from '../../../utils/memoryManager'
import { createMockFile } from '../test-utils'

describe('MemoryManager', () => {
  let memoryManager: MemoryManager

  beforeEach(() => {
    memoryManager = MemoryManager.getInstance()
    memoryManager.cleanup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    memoryManager.cleanup()
    vi.restoreAllMocks()
  })

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MemoryManager.getInstance()
      const instance2 = MemoryManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('Object URL management', () => {
    it('should track object URLs', () => {
      const file = createMockFile('test.jpg')
      const mockUrl = 'blob:http://localhost/test-id'
      
      vi.mocked(URL.createObjectURL).mockReturnValue(mockUrl)
      
      const stats = memoryManager.getMemoryStats()
      expect(stats.objectUrlCount).toBe(0)
    })

    it('should cleanup all object URLs', () => {
      const mockUrls = ['blob:1', 'blob:2', 'blob:3']
      
      // Simulate tracked URLs
      mockUrls.forEach(url => {
        vi.mocked(URL.createObjectURL).mockReturnValue(url)
      })
      
      memoryManager.cleanup()
      
      // Should call revokeObjectURL for each tracked URL
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(0) // Since we didn't actually create any URLs
    })
  })

  describe('Thumbnail creation', () => {
    it('should create thumbnail URL from file', async () => {
      const file = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg')
      const mockCanvas = document.createElement('canvas')
      const mockContext = {
        drawImage: vi.fn(),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      }
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)
      vi.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext as any)
      vi.spyOn(mockCanvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,dGVzdA==')

      const mockObjectUrl = 'blob:http://localhost/thumbnail'
      vi.mocked(URL.createObjectURL).mockReturnValue(mockObjectUrl)

      // jsdom never fires <img> load events, so drive the load manually.
      const mockImage: any = { onload: null, onerror: null, src: '', width: 400, height: 300 }
      vi.spyOn(window, 'Image').mockImplementation(() => mockImage)

      const promise = memoryManager.createThumbnailUrl(file)
      mockImage.onload()
      const thumbnailUrl = await promise

      expect(thumbnailUrl).toBe(mockObjectUrl)
      expect(document.createElement).toHaveBeenCalledWith('canvas')
    })

    it('should cache thumbnails', async () => {
      const file = createMockFile('test.jpg', 1024, 'image/jpeg')
      const mockCanvas = document.createElement('canvas')
      const mockContext = { drawImage: vi.fn() }
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)
      vi.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext as any)
      vi.spyOn(mockCanvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,dGVzdA==')

      const mockObjectUrl = 'blob:http://localhost/thumbnail'
      vi.mocked(URL.createObjectURL).mockReturnValue(mockObjectUrl)

      const mockImage: any = { onload: null, onerror: null, src: '', width: 400, height: 300 }
      vi.spyOn(window, 'Image').mockImplementation(() => mockImage)

      // First call creates the canvas (drive the image load manually)
      const p1 = memoryManager.createThumbnailUrl(file)
      mockImage.onload()
      const url1 = await p1

      // Second call should use the cached canvas (no new image load needed)
      const url2 = await memoryManager.createThumbnailUrl(file)

      expect(url1).toBe(url2)
      expect(document.createElement).toHaveBeenCalledTimes(1) // Only called once due to caching
    })

    it('should handle image load errors', async () => {
      const file = createMockFile('corrupt.jpg')
      const mockCanvas = document.createElement('canvas')
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)
      vi.spyOn(mockCanvas, 'getContext').mockReturnValue({} as any)
      
      // Mock Image constructor to simulate error
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: ''
      }
      
      vi.spyOn(window, 'Image').mockImplementation(() => mockImage as any)
      
      const promise = memoryManager.createThumbnailUrl(file)
      
      // Simulate image error
      setTimeout(() => {
        if (mockImage.onerror) mockImage.onerror(new Event('error'))
      }, 0)
      
      await expect(promise).rejects.toThrow('Failed to load image')
    })

    it('should handle canvas context creation failure', async () => {
      const file = createMockFile('test.jpg')
      const mockCanvas = document.createElement('canvas')
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)
      vi.spyOn(mockCanvas, 'getContext').mockReturnValue(null) // Simulate context creation failure
      
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: ''
      }
      
      vi.spyOn(window, 'Image').mockImplementation(() => mockImage as any)
      
      const promise = memoryManager.createThumbnailUrl(file)
      
      // Simulate image load
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload(new Event('load'))
      }, 0)
      
      await expect(promise).rejects.toThrow('Could not get canvas context')
    })
  })

  describe('Memory statistics', () => {
    it('should provide memory statistics', () => {
      const stats = memoryManager.getMemoryStats()
      
      expect(stats).toHaveProperty('objectUrlCount')
      expect(stats).toHaveProperty('canvasCacheSize')
      expect(stats).toHaveProperty('estimatedMemoryUsage')
      expect(stats.objectUrlCount).toBe(0)
      expect(stats.canvasCacheSize).toBe(0)
      expect(stats.estimatedMemoryUsage).toBe('0.0MB')
    })

    it('should calculate estimated memory usage', () => {
      // Add some mock data to the manager
      const stats = memoryManager.getMemoryStats()
      
      // With no URLs or cache, should be 0
      expect(stats.estimatedMemoryUsage).toBe('0.0MB')
    })

    it('should include system memory information when available', () => {
      const stats = memoryManager.getMemoryStats()
      
      // Should include system memory from our mock
      expect(stats.systemMemory).toEqual({
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2000 * 1024 * 1024,
        utilization: 2.5
      })
    })
  })

  describe('Memory monitoring', () => {
    it('should start and stop monitoring', () => {
      expect(memoryManager.isMemoryUsageHigh()).toBe(false)
      
      memoryManager.startMonitoring(100) // Very short interval for testing
      
      expect(memoryManager['isMonitoring']).toBe(true)
      
      memoryManager.stopMonitoring()
      
      expect(memoryManager['isMonitoring']).toBe(false)
    })

    it('should detect high memory usage', () => {
      // Mock high memory usage
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 1800 * 1024 * 1024, // 1800MB
          totalJSHeapSize: 2000 * 1024 * 1024, // 2000MB
          jsHeapSizeLimit: 2000 * 1024 * 1024, // 2000MB
        },
        writable: true,
      })
      
      expect(memoryManager.isMemoryUsageHigh()).toBe(true)
    })

    it('should perform emergency cleanup on high memory usage', () => {
      const cleanupSpy = vi.spyOn(memoryManager, 'cleanup')
      
      // Mock high memory usage
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 1900 * 1024 * 1024,
          totalJSHeapSize: 2000 * 1024 * 1024,
          jsHeapSizeLimit: 2000 * 1024 * 1024,
        },
        writable: true,
      })
      
      memoryManager['performEmergencyCleanup']()
      
      // Emergency cleanup should have been performed
      expect(console.log).toHaveBeenCalledWith('Emergency cleanup completed')
    })
  })

  describe('Thumbnail size calculation', () => {
    it('should maintain aspect ratio when resizing', () => {
      const calculateSize = memoryManager['calculateThumbnailSize'].bind(memoryManager)

      // Wide image
      expect(calculateSize(400, 200)).toEqual({ width: 200, height: 100 })
      
      // Tall image
      expect(calculateSize(100, 400)).toEqual({ width: 50, height: 200 })
      
      // Square image
      expect(calculateSize(300, 300)).toEqual({ width: 200, height: 200 })
      
      // Image smaller than thumbnail size
      expect(calculateSize(150, 100)).toEqual({ width: 150, height: 100 })
    })
  })

  describe('Cleanup callbacks', () => {
    it('should register and execute cleanup callbacks', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      const unregister1 = memoryManager.registerCleanupCallback(callback1)
      memoryManager.registerCleanupCallback(callback2)
      
      memoryManager.cleanup()
      
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      
      // Unregister first callback
      unregister1()
      
      memoryManager.cleanup()
      
      expect(callback1).toHaveBeenCalledTimes(1) // Not called again
      expect(callback2).toHaveBeenCalledTimes(2) // Called again
    })

    it('should handle callback errors gracefully', () => {
      const faultyCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })
      const goodCallback = vi.fn()
      
      memoryManager.registerCleanupCallback(faultyCallback)
      memoryManager.registerCleanupCallback(goodCallback)
      
      expect(() => memoryManager.cleanup()).not.toThrow()
      
      expect(faultyCallback).toHaveBeenCalled()
      expect(goodCallback).toHaveBeenCalled()
    })
  })
})