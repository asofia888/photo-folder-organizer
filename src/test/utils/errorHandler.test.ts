import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  errorHandler, 
  ErrorType, 
  ErrorSeverity, 
  handleError, 
  createError, 
  attemptRecovery 
} from '../../utils/errorHandler'

describe('ErrorHandler', () => {
  beforeEach(() => {
    errorHandler.clearErrorHistory()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createError', () => {
    it('should create error with correct properties', () => {
      const originalError = new Error('Test error message')
      const error = createError(
        originalError,
        ErrorType.PROCESSING_FAILED,
        ErrorSeverity.HIGH,
        { testContext: 'value' }
      )

      expect(error.message).toBe('Test error message')
      expect(error.type).toBe(ErrorType.PROCESSING_FAILED)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context).toEqual({ testContext: 'value' })
      expect(error.originalError).toBe(originalError)
      expect(error.canRetry).toBe(true) // PROCESSING_FAILED is retryable
      expect(error.retryCount).toBe(0)
      expect(error.id).toMatch(/^err_\d+_\w+$/)
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    it('should create error from string message', () => {
      const error = createError(
        'String error message',
        ErrorType.VALIDATION_ERROR,
        ErrorSeverity.MEDIUM
      )

      expect(error.message).toBe('String error message')
      expect(error.originalError).toBeUndefined()
      expect(error.canRetry).toBe(false) // VALIDATION_ERROR is not retryable
    })

    it('should set correct retry properties for different error types', () => {
      const memoryError = createError('Memory error', ErrorType.MEMORY_ERROR, ErrorSeverity.HIGH)
      const validationError = createError('Validation error', ErrorType.VALIDATION_ERROR, ErrorSeverity.MEDIUM)
      const fileError = createError('File error', ErrorType.FILE_NOT_FOUND, ErrorSeverity.LOW)

      expect(memoryError.canRetry).toBe(true)
      expect(memoryError.maxRetries).toBe(2)

      expect(validationError.canRetry).toBe(false)
      expect(validationError.maxRetries).toBe(1)

      expect(fileError.canRetry).toBe(false)
      expect(fileError.maxRetries).toBe(1)
    })
  })

  describe('handleError', () => {
    it('should handle error and add to history', () => {
      const mockListener = vi.fn()
      errorHandler.onError(mockListener)

      const error = handleError(
        'Test error',
        ErrorType.WORKER_ERROR,
        ErrorSeverity.HIGH,
        { operation: 'test' }
      )

      expect(error.message).toBe('Test error')
      expect(mockListener).toHaveBeenCalledWith(error)

      const history = errorHandler.getErrorHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toBe(error)
    })

    it('should limit error history to 100 items', () => {
      // Add more than 100 errors
      for (let i = 0; i < 150; i++) {
        handleError(`Error ${i}`, ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW)
      }

      const history = errorHandler.getErrorHistory()
      expect(history).toHaveLength(50) // Should keep last 50 when exceeding 100
    })
  })

  describe('attemptRecovery', () => {
    it('should successfully recover from memory error', async () => {
      const error = createError('Memory error', ErrorType.MEMORY_ERROR, ErrorSeverity.HIGH)
      
      const recovered = await attemptRecovery(error)
      
      expect(recovered).toBe(true)
      expect(error.retryCount).toBe(1)
    })

    it('should fail recovery for non-retryable errors', async () => {
      const error = createError('Validation error', ErrorType.VALIDATION_ERROR, ErrorSeverity.MEDIUM)
      
      const recovered = await attemptRecovery(error)
      
      expect(recovered).toBe(false)
      expect(error.retryCount).toBe(0)
    })

    it('should fail recovery when max retries exceeded', async () => {
      const error = createError('Memory error', ErrorType.MEMORY_ERROR, ErrorSeverity.HIGH)
      error.retryCount = 2 // Already at max retries
      
      const recovered = await attemptRecovery(error)
      
      expect(recovered).toBe(false)
      expect(error.retryCount).toBe(2) // Should not increment
    })

    it('should handle recovery action failure', async () => {
      const error = createError('Worker error', ErrorType.WORKER_ERROR, ErrorSeverity.HIGH)
      
      // Mock recovery action to fail
      const mockRecovery = vi.fn().mockRejectedValue(new Error('Recovery failed'))
      const originalStrategy = errorHandler['recoveryStrategies'].get(ErrorType.WORKER_ERROR)
      errorHandler['recoveryStrategies'].set(ErrorType.WORKER_ERROR, {
        canRecover: true,
        recoveryAction: mockRecovery
      })
      
      const recovered = await attemptRecovery(error)
      
      expect(recovered).toBe(false)
      expect(mockRecovery).toHaveBeenCalled()
      
      // Restore original strategy
      if (originalStrategy) {
        errorHandler['recoveryStrategies'].set(ErrorType.WORKER_ERROR, originalStrategy)
      }
    })
  })

  describe('error listeners', () => {
    it('should add and remove error listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      const unsubscribe1 = errorHandler.onError(listener1)
      const unsubscribe2 = errorHandler.onError(listener2)

      handleError('Test error', ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW)

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)

      unsubscribe1()
      handleError('Test error 2', ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW)

      expect(listener1).toHaveBeenCalledTimes(1) // Not called again
      expect(listener2).toHaveBeenCalledTimes(2)

      unsubscribe2()
      handleError('Test error 3', ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW)

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(2)
    })

    it('should handle listener errors gracefully', () => {
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })
      const goodListener = vi.fn()

      errorHandler.onError(faultyListener)
      errorHandler.onError(goodListener)

      expect(() => {
        handleError('Test error', ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW)
      }).not.toThrow()

      expect(faultyListener).toHaveBeenCalled()
      expect(goodListener).toHaveBeenCalled()
    })
  })

  describe('error statistics', () => {
    it('should generate correct error stats', () => {
      // Add various types of errors
      handleError('Error 1', ErrorType.MEMORY_ERROR, ErrorSeverity.HIGH)
      handleError('Error 2', ErrorType.MEMORY_ERROR, ErrorSeverity.MEDIUM)
      handleError('Error 3', ErrorType.FILE_ACCESS_DENIED, ErrorSeverity.LOW)
      handleError('Error 4', ErrorType.VALIDATION_ERROR, ErrorSeverity.CRITICAL)

      const stats = errorHandler.getErrorStats()

      expect(stats.total).toBe(4)
      expect(stats.byType[ErrorType.MEMORY_ERROR]).toBe(2)
      expect(stats.byType[ErrorType.FILE_ACCESS_DENIED]).toBe(1)
      expect(stats.byType[ErrorType.VALIDATION_ERROR]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.LOW]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.CRITICAL]).toBe(1)
      expect(stats.recentErrors).toHaveLength(4)
    })

    it('should generate error report with recommendations', () => {
      // Add errors that should trigger recommendations
      handleError('Memory error 1', ErrorType.MEMORY_ERROR, ErrorSeverity.HIGH)
      handleError('Memory error 2', ErrorType.MEMORY_ERROR, ErrorSeverity.HIGH)
      handleError('Memory error 3', ErrorType.MEMORY_ERROR, ErrorSeverity.HIGH)
      handleError('File access error 1', ErrorType.FILE_ACCESS_DENIED, ErrorSeverity.MEDIUM)
      handleError('File access error 2', ErrorType.FILE_ACCESS_DENIED, ErrorSeverity.MEDIUM)

      const report = errorHandler.generateErrorReport()

      expect(report.summary.total).toBe(5)
      expect(report.systemInfo.userAgent).toBeDefined()
      expect(report.systemInfo.timestamp).toBeDefined()
      expect(report.recommendations).toContain('Consider processing fewer files at once or using smaller images')
      expect(report.recommendations).toContain('Check file permissions and browser security settings')
    })
  })

  describe('global error handling', () => {
    it('should handle uncaught errors', () => {
      const mockListener = vi.fn()
      errorHandler.onError(mockListener)

      // Simulate uncaught error
      const errorEvent = new ErrorEvent('error', {
        error: new Error('Uncaught error'),
        filename: 'test.js',
        lineno: 10,
        colno: 5
      })

      window.dispatchEvent(errorEvent)

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.UNKNOWN_ERROR,
          severity: ErrorSeverity.HIGH,
          message: 'Uncaught error'
        })
      )
    })

    it('should handle unhandled promise rejections', () => {
      const mockListener = vi.fn()
      errorHandler.onError(mockListener)

      // Simulate unhandled promise rejection
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('Unhandled rejection')),
        reason: new Error('Unhandled rejection')
      })

      window.dispatchEvent(rejectionEvent)

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.UNKNOWN_ERROR,
          severity: ErrorSeverity.HIGH,
          message: 'Unhandled rejection'
        })
      )
    })
  })

  describe('user-friendly messages', () => {
    it('should provide localized error messages', () => {
      const error = createError('Technical error', ErrorType.FILE_ACCESS_DENIED, ErrorSeverity.HIGH)
      
      expect(error.userMessage).toBe('Unable to access file. Please check permissions.')
      expect(error.userMessage).not.toBe(error.message) // Should be different from technical message
    })

    it('should handle all error types with user-friendly messages', () => {
      const errorTypes = Object.values(ErrorType)
      
      errorTypes.forEach(errorType => {
        const error = createError('Technical error', errorType, ErrorSeverity.MEDIUM)
        expect(error.userMessage).toBeTruthy()
        expect(error.userMessage.length).toBeGreaterThan(0)
      })
    })
  })
})