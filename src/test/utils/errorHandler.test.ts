import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  errorHandler,
  ErrorType,
  ErrorSeverity,
  handleError,
  createError,
} from '../../../utils/errorHandler'
import { setCurrentLocale, translations } from '../../../i18n'

describe('ErrorHandler', () => {
  beforeEach(() => {
    errorHandler.clearErrorHistory()
    setCurrentLocale('en')
    vi.clearAllMocks()
  })

  describe('createError', () => {
    it('should create error with correct properties', () => {
      const originalError = new Error('Test error message')
      const error = createError(originalError, ErrorType.PROCESSING_FAILED, ErrorSeverity.HIGH, { testContext: 'value' })

      expect(error.message).toBe('Test error message')
      expect(error.type).toBe(ErrorType.PROCESSING_FAILED)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context).toEqual({ testContext: 'value' })
      expect(error.originalError).toBe(originalError)
      expect(error.id).toMatch(/^err_\d+_\w+$/)
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    it('should create error from string message', () => {
      const error = createError('String error message', ErrorType.UNKNOWN_ERROR, ErrorSeverity.MEDIUM)

      expect(error.message).toBe('String error message')
      expect(error.originalError).toBeUndefined()
    })

    it('describes non-Error values instead of printing [object Object]', () => {
      expect(createError({ code: 42 }, ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW).message).toBe('{"code":42}')
      expect(createError(undefined, ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW).message).toBe('undefined')
    })
  })

  describe('handleError', () => {
    it('records the error and notifies listeners', () => {
      const listener = vi.fn()
      const unsubscribe = errorHandler.onError(listener)

      const error = handleError('Test error', ErrorType.WORKER_ERROR, ErrorSeverity.HIGH, { operation: 'test' })

      expect(listener).toHaveBeenCalledWith(error)
      expect(errorHandler.getErrorHistory()).toEqual([error])
      unsubscribe()
    })

    it('records but does not notify when notify is false', () => {
      const listener = vi.fn()
      const unsubscribe = errorHandler.onError(listener)

      handleError('Shown inline', ErrorType.PROCESSING_FAILED, ErrorSeverity.HIGH, undefined, { notify: false })

      expect(listener).not.toHaveBeenCalled()
      expect(errorHandler.getErrorHistory()).toHaveLength(1)
      unsubscribe()
    })

    it('keeps only the most recent errors', () => {
      for (let i = 0; i < 80; i++) {
        handleError(`Error ${i}`, ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW)
      }

      const history = errorHandler.getErrorHistory()
      expect(history).toHaveLength(50)
      expect(history[history.length - 1].message).toBe('Error 79')
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
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(2)

      unsubscribe2()
    })

    it('should handle listener errors gracefully', () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Listener error')
      })
      const goodListener = vi.fn()
      const unsubscribe1 = errorHandler.onError(faultyListener)
      const unsubscribe2 = errorHandler.onError(goodListener)

      expect(() => handleError('Test error', ErrorType.UNKNOWN_ERROR, ErrorSeverity.LOW)).not.toThrow()
      expect(goodListener).toHaveBeenCalled()

      unsubscribe1()
      unsubscribe2()
    })
  })

  describe('global error handling', () => {
    it('should handle uncaught errors', () => {
      const listener = vi.fn()
      const unsubscribe = errorHandler.onError(listener)

      window.dispatchEvent(new ErrorEvent('error', {
        error: new Error('Uncaught error'),
        filename: 'test.js',
        lineno: 10,
        colno: 5
      }))

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.HIGH,
        message: 'Uncaught error'
      }))
      unsubscribe()
    })

    it('uses the event message when a cross-origin error hides the error object', () => {
      const listener = vi.fn()
      const unsubscribe = errorHandler.onError(listener)

      window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: 'Script error.' }))
      unsubscribe()
    })

    it('should handle unhandled promise rejections', () => {
      const listener = vi.fn()
      const unsubscribe = errorHandler.onError(listener)

      // A resolved promise: the handler only reads `reason`, and a real rejected
      // promise would surface as an unhandled rejection in the test run.
      window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.resolve(),
        reason: new Error('Unhandled rejection')
      }))

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: ErrorType.UNKNOWN_ERROR,
        message: 'Unhandled rejection'
      }))
      unsubscribe()
    })
  })

  describe('user-friendly messages', () => {
    it('gives every error type a translated message', () => {
      for (const type of Object.values(ErrorType)) {
        const error = createError('Technical error', type, ErrorSeverity.MEDIUM)
        expect(error.userMessage).toBeTruthy()
        expect(error.userMessage).not.toBe(error.message)
      }
    })

    it('follows the current UI language', () => {
      setCurrentLocale('ja')
      const error = createError('x', ErrorType.PROCESSING_FAILED, ErrorSeverity.HIGH)
      expect(error.userMessage).toBe(translations.ja.errorProcessingFailed)
    })
  })
})
