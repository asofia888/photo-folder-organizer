import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '../test-utils'
import { errorHandler, ErrorType, ErrorSeverity } from '../../utils/errorHandler'
import { ErrorNotificationContainer } from '../../components/ErrorNotification'
import FolderProcessor from '../../components/FolderProcessor'
import { createMockFileSystemDirectoryEntry, createMockFile } from '../test-utils'

// Mock Web Worker
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null,
}

vi.mocked(Worker).mockImplementation(() => mockWorker as any)

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

describe('Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorHandler.clearErrorHistory()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Error Handler Integration', () => {
    it('should handle errors from folder processing with notifications', async () => {
      render(
        <div>
          <ErrorNotificationContainer />
          <FolderProcessor />
        </div>
      )

      // Trigger an error in the error handler
      act(() => {
        errorHandler.handleError('Processing failed', {
          type: ErrorType.PROCESSING_FAILED,
          severity: ErrorSeverity.HIGH,
          context: { operation: 'folder-processing' }
        })
      })

      // Check that error notification appears
      await waitFor(() => {
        expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
      })

      // Check that error details are available
      const detailsButton = screen.getByRole('button', { name: /show details/i })
      fireEvent.click(detailsButton)

      expect(screen.getByText('PROCESSING_FAILED')).toBeInTheDocument()
      expect(screen.getByText(/\"operation\": \"folder-processing\"/)).toBeInTheDocument()
    })

    it('should handle worker errors and show notifications', async () => {
      render(
        <div>
          <ErrorNotificationContainer />
          <FolderProcessor />
        </div>
      )

      // Simulate worker error
      act(() => {
        if (mockWorker.onerror) {
          mockWorker.onerror(new ErrorEvent('error', {
            message: 'Worker crashed',
            filename: 'worker.js',
            lineno: 42
          }))
        }
      })

      await waitFor(() => {
        expect(screen.getByText(/Worker error occurred/)).toBeInTheDocument()
      })
    })

    it('should handle memory errors with appropriate notifications', async () => {
      render(<ErrorNotificationContainer />)

      // Trigger memory error
      act(() => {
        errorHandler.handleError('Insufficient memory', {
          type: ErrorType.MEMORY_ERROR,
          severity: ErrorSeverity.CRITICAL,
          context: { memoryUsage: '95%' }
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Insufficient memory/)).toBeInTheDocument()
      })

      // Should show critical styling
      const notification = screen.getByText(/Insufficient memory/).closest('div')
      expect(notification).toHaveClass('border-red-500', 'bg-red-50', 'text-red-900')
    })

    it('should handle file system access errors', async () => {
      render(<ErrorNotificationContainer />)

      // Trigger file system error
      act(() => {
        errorHandler.handleError('File access denied', {
          type: ErrorType.FILE_ACCESS_DENIED,
          severity: ErrorSeverity.HIGH,
          context: { path: '/restricted/folder' },
          canRetry: true
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Access denied/)).toBeInTheDocument()
      })

      // Should show retry button for recoverable errors
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  describe('Error Recovery Integration', () => {
    it('should handle successful retry operations', async () => {
      render(<ErrorNotificationContainer />)

      let retryCount = 0
      const mockRetry = vi.fn().mockImplementation(async () => {
        retryCount++
        if (retryCount === 1) {
          throw new Error('Still failing')
        }
        return 'success'
      })

      // Trigger recoverable error
      act(() => {
        errorHandler.handleError('Network timeout', {
          type: ErrorType.NETWORK_ERROR,
          severity: ErrorSeverity.MEDIUM,
          canRetry: true,
          retryCount: 0,
          maxRetries: 3
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Network connection failed/)).toBeInTheDocument()
      })

      // Mock the retry handler to be successful on second try
      const retryButton = screen.getByRole('button', { name: /retry/i })
      
      // First retry fails
      fireEvent.click(retryButton)
      
      await waitFor(() => {
        expect(screen.getByText(/recovering/i)).toBeInTheDocument()
      })

      // After retry fails, should show retry failed state
      await waitFor(() => {
        expect(screen.getByText(/recovery failed/i)).toBeInTheDocument()
      })
    })

    it('should handle maximum retry attempts', async () => {
      render(<ErrorNotificationContainer />)

      // Trigger error with max retries reached
      act(() => {
        errorHandler.handleError('Persistent failure', {
          type: ErrorType.PROCESSING_FAILED,
          severity: ErrorSeverity.HIGH,
          canRetry: true,
          retryCount: 3,
          maxRetries: 3
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
        expect(screen.getByText(/Maximum retry attempts exceeded/i)).toBeInTheDocument()
      })

      // Should not show retry button
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    })
  })

  describe('Error Notification Behavior', () => {
    it('should auto-dismiss low severity errors', async () => {
      render(<ErrorNotificationContainer />)

      // Trigger low severity error
      act(() => {
        errorHandler.handleError('File not found', {
          type: ErrorType.FILE_NOT_FOUND,
          severity: ErrorSeverity.LOW
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/File not found/)).toBeInTheDocument()
      })

      // Fast forward 5 seconds for auto-dismiss
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(screen.queryByText(/File not found/)).not.toBeInTheDocument()
      })
    })

    it('should not auto-dismiss high severity errors', async () => {
      render(<ErrorNotificationContainer />)

      // Trigger high severity error
      act(() => {
        errorHandler.handleError('Critical failure', {
          type: ErrorType.PROCESSING_FAILED,
          severity: ErrorSeverity.CRITICAL
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
      })

      // Fast forward 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // Should still be visible
      expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
    })

    it('should limit number of notifications', async () => {
      render(<ErrorNotificationContainer maxNotifications={2} />)

      // Trigger 3 errors rapidly
      act(() => {
        for (let i = 0; i < 3; i++) {
          errorHandler.handleError(`Error ${i}`, {
            type: ErrorType.PROCESSING_FAILED,
            severity: ErrorSeverity.MEDIUM
          })
        }
      })

      await waitFor(() => {
        // Should only show 2 notifications (most recent)
        const notifications = screen.getAllByText(/Failed to process/)
        expect(notifications).toHaveLength(2)
      })
    })
  })

  describe('Error Context and Details', () => {
    it('should display error context in details', async () => {
      render(<ErrorNotificationContainer />)

      const errorContext = {
        operation: 'image-processing',
        fileName: 'photo.jpg',
        fileSize: 1024 * 1024 * 5,
        timestamp: new Date().toISOString()
      }

      // Trigger error with rich context
      act(() => {
        errorHandler.handleError('Image processing failed', {
          type: ErrorType.PROCESSING_FAILED,
          severity: ErrorSeverity.HIGH,
          context: errorContext
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
      })

      // Show details
      const detailsButton = screen.getByRole('button', { name: /show details/i })
      fireEvent.click(detailsButton)

      expect(screen.getByText('Context:')).toBeInTheDocument()
      expect(screen.getByText(/\"operation\": \"image-processing\"/)).toBeInTheDocument()
      expect(screen.getByText(/\"fileName\": \"photo.jpg\"/)).toBeInTheDocument()
    })

    it('should display technical error details', async () => {
      render(<ErrorNotificationContainer />)

      const technicalError = new Error('Canvas context creation failed')
      technicalError.stack = 'Error: Canvas context creation failed\n    at createThumbnail (thumbnail.js:42:15)'

      // Trigger error with technical details
      act(() => {
        errorHandler.handleError('Thumbnail generation failed', {
          type: ErrorType.PROCESSING_FAILED,
          severity: ErrorSeverity.HIGH,
          originalError: technicalError
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
      })

      // Show details
      const detailsButton = screen.getByRole('button', { name: /show details/i })
      fireEvent.click(detailsButton)

      expect(screen.getByText('Technical Details:')).toBeInTheDocument()
      expect(screen.getByText('Canvas context creation failed')).toBeInTheDocument()
    })
  })

  describe('Error Handler State Management', () => {
    it('should maintain error history', () => {
      // Trigger multiple errors
      errorHandler.handleError('Error 1', { type: ErrorType.FILE_NOT_FOUND, severity: ErrorSeverity.LOW })
      errorHandler.handleError('Error 2', { type: ErrorType.NETWORK_ERROR, severity: ErrorSeverity.MEDIUM })
      errorHandler.handleError('Error 3', { type: ErrorType.PROCESSING_FAILED, severity: ErrorSeverity.HIGH })

      const history = errorHandler.getErrorHistory()
      expect(history).toHaveLength(3)
      expect(history[0].message).toBe('Error 1')
      expect(history[1].message).toBe('Error 2')
      expect(history[2].message).toBe('Error 3')
    })

    it('should clear error history', () => {
      // Add some errors
      errorHandler.handleError('Test error', { type: ErrorType.PROCESSING_FAILED, severity: ErrorSeverity.HIGH })
      
      expect(errorHandler.getErrorHistory()).toHaveLength(1)
      
      errorHandler.clearErrorHistory()
      
      expect(errorHandler.getErrorHistory()).toHaveLength(0)
    })

    it('should handle concurrent errors', async () => {
      render(<ErrorNotificationContainer />)

      // Trigger multiple errors concurrently
      act(() => {
        Promise.all([
          errorHandler.handleError('Concurrent Error 1', { type: ErrorType.MEMORY_ERROR, severity: ErrorSeverity.HIGH }),
          errorHandler.handleError('Concurrent Error 2', { type: ErrorType.NETWORK_ERROR, severity: ErrorSeverity.MEDIUM }),
          errorHandler.handleError('Concurrent Error 3', { type: ErrorType.FILE_ACCESS_DENIED, severity: ErrorSeverity.HIGH })
        ])
      })

      // Should handle all errors gracefully
      await waitFor(() => {
        expect(screen.getByText(/Insufficient memory/)).toBeInTheDocument()
      })

      const history = errorHandler.getErrorHistory()
      expect(history).toHaveLength(3)
    })
  })
})