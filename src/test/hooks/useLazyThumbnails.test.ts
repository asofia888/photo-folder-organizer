import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLazyThumbnails } from '../../hooks/useLazyThumbnails'
import { createMockFile } from '../test-utils'

// Mock MemoryManager
vi.mock('../../utils/memoryManager', () => ({
  default: {
    getInstance: () => ({
      registerCleanupCallback: vi.fn(() => vi.fn()),
      isMemoryUsageHigh: vi.fn(() => false),
      createThumbnailUrl: vi.fn().mockResolvedValue('mock-efficient-thumbnail-url'),
      getMemoryStats: vi.fn(() => ({
        objectUrlCount: 5,
        canvasCacheSize: 3,
        estimatedMemoryUsage: '2.5MB',
        systemMemory: {
          usedJSHeapSize: 50 * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 2000 * 1024 * 1024,
          utilization: 2.5
        }
      }))
    })
  }
}))

describe('useLazyThumbnails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Mock URL.createObjectURL
    vi.mocked(URL.createObjectURL).mockReturnValue('mock-object-url')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('getThumbnailUrl', () => {
    it('should create URL for new file', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      const url = result.current.getThumbnailUrl(file)
      
      expect(url).toBe('mock-object-url')
      expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    })

    it('should return cached URL for same file', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      const url1 = result.current.getThumbnailUrl(file)
      const url2 = result.current.getThumbnailUrl(file)
      
      expect(url1).toBe(url2)
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('should update last used time for cached files', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      // First call
      result.current.getThumbnailUrl(file)
      
      // Advance time
      vi.advanceTimersByTime(1000)
      
      // Second call should update last used time
      result.current.getThumbnailUrl(file)
      
      const stats = result.current.getCacheStats()
      expect(stats.size).toBe(1)
    })

    it('should handle different files', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file1 = createMockFile('test1.jpg')
      const file2 = createMockFile('test2.jpg')
      
      vi.mocked(URL.createObjectURL)
        .mockReturnValueOnce('url-1')
        .mockReturnValueOnce('url-2')
      
      const url1 = result.current.getThumbnailUrl(file1)
      const url2 = result.current.getThumbnailUrl(file2)
      
      expect(url1).toBe('url-1')
      expect(url2).toBe('url-2')
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    })
  })

  describe('preloadThumbnails', () => {
    it('should preload specified number of files', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const files = [
        createMockFile('test1.jpg'),
        createMockFile('test2.jpg'),
        createMockFile('test3.jpg'),
        createMockFile('test4.jpg'),
        createMockFile('test5.jpg')
      ]
      
      act(() => {
        result.current.preloadThumbnails(files, 3)
      })
      
      expect(URL.createObjectURL).toHaveBeenCalledTimes(3)
      expect(URL.createObjectURL).toHaveBeenCalledWith(files[0])
      expect(URL.createObjectURL).toHaveBeenCalledWith(files[1])
      expect(URL.createObjectURL).toHaveBeenCalledWith(files[2])
    })

    it('should not preload already cached files', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const files = [
        createMockFile('test1.jpg'),
        createMockFile('test2.jpg')
      ]
      
      // Pre-cache first file
      result.current.getThumbnailUrl(files[0])
      
      vi.clearAllMocks()
      
      act(() => {
        result.current.preloadThumbnails(files, 2)
      })
      
      // Should only create URL for second file
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(URL.createObjectURL).toHaveBeenCalledWith(files[1])
    })

    it('should default to 10 files if no maxCount specified', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const files = Array.from({ length: 15 }, (_, i) => 
        createMockFile(`test${i}.jpg`)
      )
      
      act(() => {
        result.current.preloadThumbnails(files)
      })
      
      expect(URL.createObjectURL).toHaveBeenCalledTimes(10)
    })
  })

  describe('revokeThumbnail', () => {
    it('should revoke specific thumbnail URL', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      const url = result.current.getThumbnailUrl(file)
      
      act(() => {
        result.current.revokeThumbnail(file)
      })
      
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    })

    it('should handle revoking non-existent file', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('nonexistent.jpg')
      
      act(() => {
        result.current.revokeThumbnail(file)
      })
      
      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('revokeAllThumbnails', () => {
    it('should revoke all cached thumbnails', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const files = [
        createMockFile('test1.jpg'),
        createMockFile('test2.jpg'),
        createMockFile('test3.jpg')
      ]
      
      vi.mocked(URL.createObjectURL)
        .mockReturnValueOnce('url-1')
        .mockReturnValueOnce('url-2')
        .mockReturnValueOnce('url-3')
      
      // Create thumbnails
      files.forEach(file => result.current.getThumbnailUrl(file))
      
      act(() => {
        result.current.revokeAllThumbnails()
      })
      
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('url-1')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('url-2')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('url-3')
    })

    it('should clear cache stats after revoking all', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      result.current.getThumbnailUrl(file)
      expect(result.current.getCacheStats().size).toBe(1)
      
      act(() => {
        result.current.revokeAllThumbnails()
      })
      
      expect(result.current.getCacheStats().size).toBe(0)
    })
  })

  describe('getCacheStats', () => {
    it('should provide cache statistics', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const files = [
        createMockFile('test1.jpg'),
        createMockFile('test2.jpg')
      ]
      
      files.forEach(file => result.current.getThumbnailUrl(file))
      
      const stats = result.current.getCacheStats()
      
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(50)
      expect(stats.memoryUsage).toBe(1.0) // 2 * 0.5MB
      expect(stats.systemMemory).toBeDefined()
      expect(stats.isHighMemory).toBe(false)
    })

    it('should include system memory stats', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      
      const stats = result.current.getCacheStats()
      
      expect(stats.systemMemory).toEqual({
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2000 * 1024 * 1024,
        utilization: 2.5
      })
    })
  })

  describe('automatic cleanup', () => {
    it('should schedule cleanup after creating thumbnails', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      result.current.getThumbnailUrl(file)
      
      // Fast forward time to trigger cleanup
      act(() => {
        vi.advanceTimersByTime(30000) // 30 seconds
      })
      
      // Cleanup should have been scheduled
      expect(setTimeout).toHaveBeenCalled()
    })

    it('should clean up old entries based on maxSize', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      
      // Create more than max cache size (50) files
      const files = Array.from({ length: 55 }, (_, i) => 
        createMockFile(`test${i}.jpg`)
      )
      
      files.forEach(file => result.current.getThumbnailUrl(file))
      
      // Trigger cleanup
      act(() => {
        vi.advanceTimersByTime(30000)
      })
      
      // Should have cleaned up excess entries
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('should clean up entries older than 5 minutes', () => {
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('old-file.jpg')
      
      result.current.getThumbnailUrl(file)
      
      // Fast forward more than 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000 + 1000) // 5 minutes + 1 second
      })
      
      // Trigger cleanup
      act(() => {
        vi.advanceTimersByTime(30000) // Cleanup interval
      })
      
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('cleanup on unmount', () => {
    it('should cleanup all thumbnails on unmount', () => {
      const { result, unmount } = renderHook(() => useLazyThumbnails())
      const files = [
        createMockFile('test1.jpg'),
        createMockFile('test2.jpg')
      ]
      
      vi.mocked(URL.createObjectURL)
        .mockReturnValueOnce('url-1')
        .mockReturnValueOnce('url-2')
      
      files.forEach(file => result.current.getThumbnailUrl(file))
      
      unmount()
      
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('url-1')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('url-2')
    })

    it('should clear cleanup timers on unmount', () => {
      const { result, unmount } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      result.current.getThumbnailUrl(file)
      
      unmount()
      
      expect(clearTimeout).toHaveBeenCalled()
    })
  })

  describe('memory manager integration', () => {
    it('should register cleanup callback with memory manager', () => {
      const mockMemoryManager = require('../../utils/memoryManager').default.getInstance()
      
      renderHook(() => useLazyThumbnails())
      
      expect(mockMemoryManager.registerCleanupCallback).toHaveBeenCalled()
    })

    it('should use efficient thumbnails when memory is high', () => {
      const mockMemoryManager = require('../../utils/memoryManager').default.getInstance()
      mockMemoryManager.isMemoryUsageHigh.mockReturnValue(true)
      
      const { result } = renderHook(() => useLazyThumbnails())
      const file = createMockFile('test.jpg')
      
      const url = result.current.getThumbnailUrl(file)
      
      expect(mockMemoryManager.createThumbnailUrl).toHaveBeenCalledWith(file)
      expect(url).toBe('mock-object-url') // Falls back to regular URL while async processing
    })
  })
})