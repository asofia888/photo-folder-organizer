import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test-utils'
import ErrorNotification, { ErrorNotificationContainer } from '../../components/ErrorNotification'
import { AppError, ErrorType, ErrorSeverity, errorHandler } from '../../utils/errorHandler'

describe('ErrorNotification', () => {
  const mockError: AppError = {
    id: 'test-error-1',
    type: ErrorType.PROCESSING_FAILED,
    severity: ErrorSeverity.HIGH,
    message: 'Processing failed',
    userMessage: 'Failed to process images. Please try again.',
    timestamp: new Date('2023-01-01T00:00:00.000Z'),
    context: { operation: 'test' },
    canRetry: true,
    retryCount: 0,
    maxRetries: 3
  }

  const mockOnDismiss = vi.fn()
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render error message', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByText('Failed to process images. Please try again.')).toBeInTheDocument()
    })

    it('should display timestamp', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
        />
      )

      // Should show formatted timestamp
      expect(screen.getByText(/00:00:00/)).toBeInTheDocument()
    })

    it('should show retry count when > 0', () => {
      const errorWithRetries = { ...mockError, retryCount: 2 }
      
      render(
        <ErrorNotification
          error={errorWithRetries}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText(/Attempt 3/)).toBeInTheDocument()
    })

    it('should display appropriate severity styling', () => {
      const { container } = render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
        />
      )

      const notification = container.firstChild as HTMLElement
      expect(notification).toHaveClass('border-orange-500', 'bg-orange-50', 'text-orange-900')
    })

    it('should show different styling for different severities', () => {
      const criticalError = { ...mockError, severity: ErrorSeverity.CRITICAL }
      const { container: criticalContainer } = render(
        <ErrorNotification
          error={criticalError}
          onDismiss={mockOnDismiss}
        />
      )

      const criticalNotification = criticalContainer.firstChild as HTMLElement
      expect(criticalNotification).toHaveClass('border-red-500', 'bg-red-50', 'text-red-900')
    })
  })

  describe('retry functionality', () => {
    it('should show retry button when error can be retried', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should not show retry button when error cannot be retried', () => {
      const nonRetryableError = { ...mockError, canRetry: false }
      
      render(
        <ErrorNotification
          error={nonRetryableError}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    })

    it('should not show retry button when max retries exceeded', () => {
      const maxRetriesError = { ...mockError, retryCount: 3, maxRetries: 3 }
      
      render(
        <ErrorNotification
          error={maxRetriesError}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Maximum retry attempts exceeded/i)).toBeInTheDocument()
    })

    it('should call onRetry when retry button clicked', async () => {
      mockOnRetry.mockResolvedValue(undefined)
      
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
          onRetry={mockOnRetry}
        />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalledTimes(1)
    })

    it('should show recovering state during retry', async () => {
      let resolveRetry: () => void
      const retryPromise = new Promise<void>((resolve) => {
        resolveRetry = resolve
      })
      mockOnRetry.mockReturnValue(retryPromise)
      
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
          onRetry={mockOnRetry}
        />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(screen.getByText(/recovering/i)).toBeInTheDocument()
      expect(retryButton).toBeDisabled()

      resolveRetry!()
      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalled()
      })
    })

    it('should show recovery failed state on retry failure', async () => {
      mockOnRetry.mockRejectedValue(new Error('Retry failed'))
      
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
          onRetry={mockOnRetry}
        />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText(/recovery failed/i)).toBeInTheDocument()
      })
    })

    it('should disable retry button during recovery', async () => {
      let resolveRetry: () => void
      const retryPromise = new Promise<void>((resolve) => {
        resolveRetry = resolve
      })
      mockOnRetry.mockReturnValue(retryPromise)
      
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
          onRetry={mockOnRetry}
        />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(retryButton).toBeDisabled()

      resolveRetry!()
      await waitFor(() => {
        expect(retryButton).not.toBeDisabled()
      })
    })
  })

  describe('details functionality', () => {
    it('should show/hide details button', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument()
    })

    it('should toggle details visibility', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
        />
      )

      const detailsButton = screen.getByRole('button', { name: /show details/i })
      
      // Initially hidden
      expect(screen.queryByText('Type:')).not.toBeInTheDocument()
      
      // Show details
      fireEvent.click(detailsButton)
      expect(screen.getByText('Type:')).toBeInTheDocument()
      expect(screen.getByText('PROCESSING_FAILED')).toBeInTheDocument()
      
      // Hide details
      const hideButton = screen.getByRole('button', { name: /hide details/i })
      fireEvent.click(hideButton)
      expect(screen.queryByText('Type:')).not.toBeInTheDocument()
    })

    it('should show error context in details', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
        />
      )

      const detailsButton = screen.getByRole('button', { name: /show details/i })
      fireEvent.click(detailsButton)

      expect(screen.getByText('Context:')).toBeInTheDocument()
      expect(screen.getByText(/"operation": "test"/)).toBeInTheDocument()
    })

    it('should show technical details when available', () => {
      const errorWithTechnical = {
        ...mockError,
        originalError: new Error('Technical error message')
      }
      
      render(
        <ErrorNotification
          error={errorWithTechnical}
          onDismiss={mockOnDismiss}
        />
      )

      const detailsButton = screen.getByRole('button', { name: /show details/i })
      fireEvent.click(detailsButton)

      expect(screen.getByText('Technical Details:')).toBeInTheDocument()
      expect(screen.getByText('Technical error message')).toBeInTheDocument()
    })
  })

  describe('dismiss functionality', () => {
    it('should call onDismiss when dismiss button clicked', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
        />
      )

      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      fireEvent.click(dismissButton)

      expect(mockOnDismiss).toHaveBeenCalledTimes(1)
    })

    it('should show X mark icon in dismiss button', () => {
      render(
        <ErrorNotification
          error={mockError}
          onDismiss={mockOnDismiss}
        />
      )

      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      const icon = dismissButton.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('severity icons', () => {
    it('should show appropriate icon for each severity', () => {
      const severities = [
        ErrorSeverity.LOW,
        ErrorSeverity.MEDIUM,
        ErrorSeverity.HIGH,
        ErrorSeverity.CRITICAL
      ]

      severities.forEach(severity => {
        const errorWithSeverity = { ...mockError, severity }
        const { container } = render(
          <ErrorNotification
            error={errorWithSeverity}
            onDismiss={mockOnDismiss}
          />
        )

        // Should have an icon
        const icon = container.querySelector('svg')
        expect(icon).toBeInTheDocument()
      })
    })
  })
})

describe('ErrorNotificationContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorHandler.clearErrorHistory()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render nothing when no errors', () => {
    const { container } = render(<ErrorNotificationContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('should show notifications for new errors', async () => {
    render(<ErrorNotificationContainer />)

    // Trigger an error
    errorHandler.handleError('Test error', {
      type: ErrorType.PROCESSING_FAILED,
      severity: ErrorSeverity.HIGH
    })

    await waitFor(() => {
      expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
    })
  })

  it('should limit number of notifications', async () => {
    render(<ErrorNotificationContainer maxNotifications={2} />)

    // Trigger 3 errors
    for (let i = 0; i < 3; i++) {
      errorHandler.handleError(`Error ${i}`, {
        type: ErrorType.PROCESSING_FAILED,
        severity: ErrorSeverity.HIGH
      })
    }

    await waitFor(() => {
      // Should only show 2 notifications (most recent)
      const notifications = screen.getAllByText(/Failed to process/)
      expect(notifications).toHaveLength(2)
    })
  })

  it('should auto-dismiss low severity errors', async () => {
    vi.useFakeTimers()
    
    render(<ErrorNotificationContainer />)

    // Trigger low severity error
    errorHandler.handleError('Low severity error', {
      type: ErrorType.FILE_NOT_FOUND,
      severity: ErrorSeverity.LOW
    })

    await waitFor(() => {
      expect(screen.getByText(/File not found/)).toBeInTheDocument()
    })

    // Fast forward 5 seconds
    vi.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(screen.queryByText(/File not found/)).not.toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('should not auto-dismiss high severity errors', async () => {
    vi.useFakeTimers()
    
    render(<ErrorNotificationContainer />)

    // Trigger high severity error
    errorHandler.handleError('High severity error', {
      type: ErrorType.PROCESSING_FAILED,
      severity: ErrorSeverity.HIGH
    })

    await waitFor(() => {
      expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
    })

    // Fast forward 10 seconds
    vi.advanceTimersByTime(10000)

    // Should still be there
    expect(screen.getByText(/Failed to process/)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('should handle notification dismissal', async () => {
    render(<ErrorNotificationContainer />)

    // Trigger an error
    errorHandler.handleError('Test error', {
      type: ErrorType.PROCESSING_FAILED,
      severity: ErrorSeverity.HIGH
    })

    await waitFor(() => {
      expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
    })

    // Dismiss notification
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    await waitFor(() => {
      expect(screen.queryByText(/Failed to process/)).not.toBeInTheDocument()
    })
  })

  it('should position notifications correctly', () => {
    render(<ErrorNotificationContainer />)

    // The container should have fixed positioning
    const container = document.querySelector('.fixed.top-4.right-4')
    expect(container).toBeInTheDocument()
  })

  it('should stack multiple notifications', async () => {
    render(<ErrorNotificationContainer />)

    // Trigger multiple errors
    errorHandler.handleError('Error 1', {
      type: ErrorType.PROCESSING_FAILED,
      severity: ErrorSeverity.HIGH
    })
    
    errorHandler.handleError('Error 2', {
      type: ErrorType.MEMORY_ERROR,
      severity: ErrorSeverity.MEDIUM
    })

    await waitFor(() => {
      expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
      expect(screen.getByText(/Insufficient memory/)).toBeInTheDocument()
    })

    // Should have proper spacing
    const container = document.querySelector('.space-y-2')
    expect(container).toBeInTheDocument()
  })
})