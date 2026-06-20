import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MemoryManager from '../../../utils/memoryManager'

describe('MemoryManager', () => {
  let memoryManager: MemoryManager

  beforeEach(() => {
    memoryManager = MemoryManager.getInstance()
    memoryManager.stopMonitoring()
    vi.clearAllMocks()
  })

  afterEach(() => {
    memoryManager.stopMonitoring()
    vi.restoreAllMocks()
  })

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      expect(MemoryManager.getInstance()).toBe(MemoryManager.getInstance())
    })
  })

  describe('Memory statistics', () => {
    it('should expose system memory from performance.memory', () => {
      const stats = memoryManager.getMemoryStats()

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
      memoryManager.startMonitoring(100)
      expect(memoryManager['isMonitoring']).toBe(true)

      memoryManager.stopMonitoring()
      expect(memoryManager['isMonitoring']).toBe(false)
    })

    it('should not start a second interval while already monitoring', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      memoryManager.startMonitoring(100)
      memoryManager.startMonitoring(100)

      expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup', () => {
    it('should invoke gc when the runtime exposes it', () => {
      const gc = vi.fn()
      ;(window as any).gc = gc

      memoryManager.cleanup()

      expect(gc).toHaveBeenCalledTimes(1)
      delete (window as any).gc
    })

    it('should not throw when gc is unavailable', () => {
      delete (window as any).gc
      expect(() => memoryManager.cleanup()).not.toThrow()
    })
  })
})
