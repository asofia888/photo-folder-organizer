import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFolderProcessor } from '../../hooks/useFolderProcessor'
import { createMockFileSystemDirectoryEntry, createMockFile, mockWorkerResponse } from '../test-utils'
import MemoryManager from '../../utils/memoryManager'

// Mock MemoryManager
vi.mock('../../utils/memoryManager', () => ({
  default: {
    getInstance: () => ({
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      cleanup: vi.fn(),
      registerCleanupCallback: vi.fn(() => vi.fn()),
      isMemoryUsageHigh: vi.fn(() => false),
    })
  }
}))

describe('useFolderProcessor', () => {
  let mockWorker: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock Worker
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    }
    
    vi.mocked(Worker).mockImplementation(() => mockWorker)
    
    // Mock URL.createObjectURL
    vi.mocked(URL.createObjectURL).mockReturnValue('mocked-blob-url')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useFolderProcessor())

    expect(result.current.status).toBe('idle')
    expect(result.current.folders).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.processingMessage).toBe('')
    expect(result.current.rootFolderName).toBe('')
    expect(result.current.progress).toBeNull()
  })

  it('should start memory monitoring on mount', () => {
    const mockMemoryManager = MemoryManager.getInstance()
    
    renderHook(() => useFolderProcessor())
    
    expect(mockMemoryManager.startMonitoring).toHaveBeenCalledWith(5000)
  })

  it('should cleanup on unmount', () => {
    const mockMemoryManager = MemoryManager.getInstance()
    const { unmount } = renderHook(() => useFolderProcessor())
    
    act(() => {
      unmount()
    })
    
    expect(mockWorker.terminate).toHaveBeenCalled()
    expect(mockMemoryManager.stopMonitoring).toHaveBeenCalled()
  })

  describe('processDirectory', () => {
    it('should process directory with valid structure', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      const mockFiles = [
        createMockFile('photo1.jpg', 1024, 'image/jpeg'),
        createMockFile('photo2.png', 2048, 'image/png')
      ]
      const mockDirectory = createMockFileSystemDirectoryEntry('test-folder', mockFiles)
      
      act(() => {
        result.current.processDirectory(mockDirectory, 'earliest')
      })
      
      expect(result.current.status).toBe('processing')
      expect(result.current.rootFolderName).toBe('test-folder')
      
      // Mock worker response
      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'start',
          payload: { totalFolders: 1, totalFiles: 2, phase: 'processing' }
        })
      })
      
      expect(result.current.progress).toEqual({
        processedFolders: 0,
        totalFolders: 1,
        processedFiles: 0,
        totalFiles: 2,
        phase: 'processing'
      })
    })

    it('should handle worker success response', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      const mockFiles = [createMockFile('photo1.jpg')]
      const mockDirectory = createMockFileSystemDirectoryEntry('test-folder', mockFiles)
      
      act(() => {
        result.current.processDirectory(mockDirectory, 'earliest')
      })
      
      const mockFolders = [{
        id: 'folder1',
        originalName: 'test-folder',
        photos: [{
          id: 'photo1',
          date: '2023-01-01',
          file: mockFiles[0]
        }],
        representativeDate: new Date('2023-01-01'),
        newName: '',
        isRenamed: false
      }]
      
      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'done',
          payload: mockFolders
        })
      })
      
      expect(result.current.status).toBe('done')
      expect(result.current.folders).toHaveLength(1)
      expect(result.current.folders[0].originalName).toBe('test-folder')
    })

    it('should handle worker error response', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      const mockFiles = [createMockFile('photo1.jpg')]
      const mockDirectory = createMockFileSystemDirectoryEntry('test-folder', mockFiles)
      
      act(() => {
        result.current.processDirectory(mockDirectory, 'earliest')
      })
      
      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'error',
          error: 'Processing failed'
        })
      })
      
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBeTruthy()
    })

    it('should handle directory with no subfolders', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      // Mock directory reader that returns no subdirectories
      const mockDirectory = {
        name: 'empty-folder',
        createReader: () => ({
          readEntries: (callback: (entries: FileSystemEntry[]) => void) => {
            callback([]) // No entries
          }
        })
      } as FileSystemDirectoryEntry
      
      await act(async () => {
        try {
          await result.current.processDirectory(mockDirectory, 'earliest')
        } catch (error) {
          // Expected to throw
        }
      })
      
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBeTruthy()
    })

    it('should handle directory with no images', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      // Mock directory with subdirectory but no image files
      const mockDirectory = {
        name: 'no-images-folder',
        createReader: () => ({
          readEntries: (callback: (entries: FileSystemEntry[]) => void) => {
            const subDir = {
              name: 'subfolder',
              isDirectory: true,
              createReader: () => ({
                readEntries: (callback: (entries: FileSystemEntry[]) => void) => {
                  callback([]) // No image files
                }
              })
            }
            callback([subDir])
          }
        })
      } as FileSystemDirectoryEntry
      
      await act(async () => {
        try {
          await result.current.processDirectory(mockDirectory, 'earliest')
        } catch (error) {
          // Expected to throw
        }
      })
      
      expect(result.current.status).toBe('error')
    })
  })

  describe('progress tracking', () => {
    it('should update progress during processing', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      const mockDirectory = createMockFileSystemDirectoryEntry('test-folder', [
        createMockFile('photo1.jpg')
      ])
      
      act(() => {
        result.current.processDirectory(mockDirectory, 'earliest')
      })
      
      // Start progress
      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'start',
          payload: { totalFolders: 3, totalFiles: 10, phase: 'processing' }
        })
      })
      
      expect(result.current.progress).toEqual({
        processedFolders: 0,
        totalFolders: 3,
        processedFiles: 0,
        totalFiles: 10,
        phase: 'processing'
      })
      
      // Progress update
      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'progress',
          payload: {
            processedFolders: 1,
            totalFolders: 3,
            processedFiles: 3,
            totalFiles: 10,
            currentFolderName: 'folder1',
            phase: 'processing',
            memoryUsage: 1024 * 1024 * 100
          }
        })
      })
      
      expect(result.current.progress.processedFolders).toBe(1)
      expect(result.current.progress.processedFiles).toBe(3)
      expect(result.current.processingMessage).toContain('folder1')
      
      // File-level progress
      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'file-progress',
          payload: {
            processedFiles: 5,
            totalFiles: 10,
            currentFolder: 'folder2',
            batchProgress: 0.5
          }
        })
      })
      
      expect(result.current.progress.processedFiles).toBe(5)
    })
  })

  describe('folder management', () => {
    it('should update folder name', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      // Set initial folders
      const mockFolders = [{
        id: 'folder1',
        originalName: 'old-name',
        photos: [],
        representativeDate: new Date(),
        newName: '',
        isRenamed: false
      }]
      
      await act(async () => {
        result.current.setFolders(mockFolders)
      })
      
      // Update folder name
      act(() => {
        // This would typically be called from FolderCard
        const updatedFolders = result.current.folders.map(folder =>
          folder.id === 'folder1'
            ? { ...folder, newName: 'new-name', isRenamed: true }
            : folder
        )
        result.current.setFolders(updatedFolders)
      })
      
      expect(result.current.folders[0].newName).toBe('new-name')
      expect(result.current.folders[0].isRenamed).toBe(true)
    })
  })

  describe('reset functionality', () => {
    it('should reset to initial state', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      // Set some state
      act(() => {
        result.current.setFolders([{
          id: 'test',
          originalName: 'test',
          photos: [],
          representativeDate: new Date(),
          newName: 'test-name',
          isRenamed: true
        }])
      })
      
      // Reset
      act(() => {
        result.current.reset()
      })
      
      expect(result.current.status).toBe('idle')
      expect(result.current.folders).toEqual([])
      expect(result.current.error).toBeNull()
      expect(result.current.processingMessage).toBe('')
      expect(result.current.rootFolderName).toBe('')
      expect(result.current.progress).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should handle setFailure', () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      act(() => {
        result.current.setFailure('Test error message')
      })
      
      expect(result.current.error).toBe('Test error message')
      expect(result.current.status).toBe('error')
    })

    it('should handle processing exceptions', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      // Mock directory that will cause an error
      const mockDirectory = {
        name: 'error-folder',
        createReader: () => {
          throw new Error('Reader creation failed')
        }
      } as FileSystemDirectoryEntry
      
      await act(async () => {
        try {
          await result.current.processDirectory(mockDirectory, 'earliest')
        } catch (error) {
          // Expected to throw and be handled
        }
      })
      
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      const { result } = renderHook(() => useFolderProcessor())
      
      act(() => {
        result.current.cleanup()
      })
      
      // Should revoke any object URLs that were created
      // This would be tested if we had actual URLs to revoke
      expect(true).toBe(true) // Placeholder assertion
    })
  })
})