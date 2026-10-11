import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook as renderHookBase, act } from '@testing-library/react'
import { useFolderProcessor } from '../../../hooks/useFolderProcessor'
import { createMockFileSystemDirectoryEntry, createMockFile, mockWorkerResponse } from '../test-utils'
import { LanguageProvider, useLanguage } from '../../../contexts/LanguageContext'
import { setCurrentLocale, translations } from '../../../i18n'

// useFolderProcessor calls useLanguage(), so the hook must render inside the
// LanguageProvider context.
const renderHook = <T,>(callback: () => T) =>
  renderHookBase(callback, { wrapper: LanguageProvider })

const doneMessage = (folders: Array<{ id: string; date: Date | null; isEstimated?: boolean }>) => ({
  type: 'done',
  payload: folders.map(({ id, date, isEstimated = false }) => ({
    id,
    originalName: id,
    photos: [{ id: `${id}-photo`, date: date?.toISOString() ?? '', file: createMockFile(`${id}.jpg`) }],
    representativeDate: date,
    dateIsEstimated: isEstimated,
  })),
  skippedFiles: [],
})

const fileInFolder = (relativePath: string) => {
  const file = createMockFile(relativePath.split('/').pop())
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

describe('useFolderProcessor', () => {
  let mockWorker: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Error messages are translated outside React; undo any language switch.
    setCurrentLocale('en')

    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    }

    vi.mocked(Worker).mockImplementation(() => mockWorker)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const startRun = async (result: { current: ReturnType<typeof useFolderProcessor> }) => {
    const directory = createMockFileSystemDirectoryEntry('test-folder', [createMockFile('photo1.jpg')])
    await act(async () => {
      await result.current.processDirectory(directory, 'earliest')
    })
  }

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useFolderProcessor())

    expect(result.current.status).toBe('idle')
    expect(result.current.folders).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.processingMessage).toBe('')
    expect(result.current.rootFolderName).toBe('')
    expect(result.current.progress).toBeNull()
  })

  it('does not start a worker until there is something to process', () => {
    renderHook(() => useFolderProcessor())
    expect(Worker).not.toHaveBeenCalled()
  })

  describe('processDirectory', () => {
    it('sends the images of each sub-folder to the worker', async () => {
      const { result } = renderHook(() => useFolderProcessor())

      const mockFiles = [
        createMockFile('photo1.jpg', 1024, 'image/jpeg'),
        createMockFile('photo2.png', 2048, 'image/png'),
        createMockFile('notes.txt', 10, 'text/plain'),
      ]
      await act(async () => {
        await result.current.processDirectory(createMockFileSystemDirectoryEntry('test-folder', mockFiles), 'latest')
      })

      expect(result.current.status).toBe('processing')
      expect(result.current.rootFolderName).toBe('test-folder')
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
      const request = mockWorker.postMessage.mock.calls[0][0]
      expect(request.dateLogic).toBe('latest')
      expect(request.folderFileGroups).toHaveLength(1)
      expect(request.folderFileGroups[0].files.map((f: File) => f.name)).toEqual(['photo1.jpg', 'photo2.png'])

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

    it('shows the results sorted by date and releases the worker', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      await startRun(result)

      await act(async () => {
        mockWorkerResponse(mockWorker, doneMessage([
          { id: 'undated', date: null },
          { id: 'newer', date: new Date(2024, 5, 2) },
          { id: 'older', date: new Date(2024, 5, 1), isEstimated: true },
        ]))
      })

      expect(result.current.status).toBe('done')
      expect(result.current.folders.map(f => f.id)).toEqual(['older', 'newer', 'undated'])
      expect(result.current.folders[0].dateIsEstimated).toBe(true)
      expect(result.current.folders[0].newName).toBe('')
      expect(result.current.folders[0].isRenamed).toBe(false)
      expect(mockWorker.terminate).toHaveBeenCalled()
    })

    it('should handle worker error response', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      await startRun(result)

      await act(async () => {
        mockWorkerResponse(mockWorker, { type: 'error', error: 'Processing failed' })
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe(translations.en.errorWorkerError)
    })

    it('fails instead of spinning forever when the worker crashes', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      await startRun(result)

      await act(async () => {
        mockWorker.onerror({ message: 'out of memory', preventDefault: vi.fn() })
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe(translations.en.errorWorkerError)
      expect(mockWorker.terminate).toHaveBeenCalled()
    })

    it('tells the user the folder has no sub-folders', async () => {
      const { result } = renderHook(() => useFolderProcessor())

      const mockDirectory = {
        name: 'empty-folder',
        createReader: () => ({
          readEntries: (callback: (entries: FileSystemEntry[]) => void) => {
            callback([])
          }
        })
      } as unknown as FileSystemDirectoryEntry

      await act(async () => {
        await result.current.processDirectory(mockDirectory, 'earliest')
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe(translations.en.errorNoSubFolders)
    })

    it('tells the user no images were found', async () => {
      const { result } = renderHook(() => useFolderProcessor())

      const directory = createMockFileSystemDirectoryEntry('no-images', [createMockFile('notes.txt', 10, 'text/plain')])
      await act(async () => {
        await result.current.processDirectory(directory, 'earliest')
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe(translations.en.errorNoImages)
      expect(Worker).not.toHaveBeenCalled()
    })

    it('should handle processing exceptions', async () => {
      const { result } = renderHook(() => useFolderProcessor())

      const mockDirectory = {
        name: 'error-folder',
        createReader: () => {
          throw new Error('Reader creation failed')
        }
      } as unknown as FileSystemDirectoryEntry

      await act(async () => {
        await result.current.processDirectory(mockDirectory, 'earliest')
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe(translations.en.errorProcessingFailed)
    })
  })

  describe('processFileList', () => {
    it('groups picked files by their immediate sub-folder', () => {
      const { result } = renderHook(() => useFolderProcessor())

      act(() => {
        result.current.processFileList([
          fileInFolder('root/a/1.jpg'),
          fileInFolder('root/a/2.heic'),
          fileInFolder('root/b/3.jpg'),
          fileInFolder('root/top-level.jpg'),
          fileInFolder('root/a/nested/4.jpg'),
        ], 'earliest')
      })

      expect(result.current.rootFolderName).toBe('root')
      const { folderFileGroups } = mockWorker.postMessage.mock.calls[0][0]
      expect(folderFileGroups.map((g: any) => [g.id, g.files.map((f: File) => f.name)])).toEqual([
        ['/root/a', ['1.jpg', '2.heic']],
        ['/root/b', ['3.jpg']],
      ])
    })
  })

  describe('run lifecycle', () => {
    it('keeps processing when the language is switched mid-run', async () => {
      const { result } = renderHook(() => ({ processor: useFolderProcessor(), language: useLanguage() }))
      const processorResult = { get current() { return result.current.processor } }
      await startRun(processorResult)

      act(() => {
        result.current.language.setLocale('ja')
      })

      expect(mockWorker.terminate).not.toHaveBeenCalled()
      expect(result.current.processor.status).toBe('processing')

      await act(async () => {
        mockWorkerResponse(mockWorker, doneMessage([{ id: 'a', date: new Date(2024, 0, 1) }]))
      })
      expect(result.current.processor.status).toBe('done')
    })

    it('cancel stops the worker and ignores its late messages', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      await startRun(result)
      const staleOnMessage = mockWorker.onmessage

      act(() => {
        result.current.cancel()
      })

      expect(result.current.status).toBe('idle')
      expect(mockWorker.terminate).toHaveBeenCalled()

      await act(async () => {
        staleOnMessage({ data: doneMessage([{ id: 'a', date: null }]) })
      })
      expect(result.current.status).toBe('idle')
      expect(result.current.folders).toEqual([])
    })

    it('terminates a running worker on unmount', async () => {
      const { result, unmount } = renderHook(() => useFolderProcessor())
      await startRun(result)

      unmount()

      expect(mockWorker.terminate).toHaveBeenCalled()
    })
  })

  describe('progress tracking', () => {
    it('should update progress during processing', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      await startRun(result)

      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'start',
          payload: { totalFolders: 3, totalFiles: 10, phase: 'processing' }
        })
      })

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
          }
        })
      })

      expect(result.current.progress!.processedFolders).toBe(1)
      expect(result.current.progress!.processedFiles).toBe(3)
      expect(result.current.processingMessage).toContain('folder1')

      await act(async () => {
        mockWorkerResponse(mockWorker, {
          type: 'file-progress',
          payload: { processedFiles: 5, totalFiles: 10 }
        })
      })

      expect(result.current.progress!.processedFiles).toBe(5)
    })
  })

  describe('reset functionality', () => {
    it('should reset to initial state', async () => {
      const { result } = renderHook(() => useFolderProcessor())
      await startRun(result)
      await act(async () => {
        mockWorkerResponse(mockWorker, doneMessage([{ id: 'a', date: null }]))
      })

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
  })
})
