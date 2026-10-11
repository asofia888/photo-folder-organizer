import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '../test-utils'
import ErrorNotification, { ErrorNotificationContainer } from '../../../components/ErrorNotification'
import { AppError, ErrorType, ErrorSeverity, errorHandler } from '../../../utils/errorHandler'

describe('ErrorNotification', () => {
  const mockError: AppError = {
    id: 'test-error-1',
    type: ErrorType.PROCESSING_FAILED,
    severity: ErrorSeverity.HIGH,
    message: 'Processing failed',
    userMessage: 'Failed to process images. Please try again.',
    timestamp: new Date('2023-01-01T00:00:00.000Z'),
    context: { operation: 'test' },
  }

  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render the user message as an alert', () => {
      render(<ErrorNotification error={mockError} onDismiss={mockOnDismiss} />)

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to process images. Please try again.')
    })

    it('should display timestamp', () => {
      render(<ErrorNotification error={mockError} onDismiss={mockOnDismiss} />)

      // Exact value is locale/TZ dependent, so match the time pattern.
      expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument()
    })

    it('uses the dark surface with a severity accent', () => {
      const { container } = render(<ErrorNotification error={mockError} onDismiss={mockOnDismiss} />)

      expect(container.firstChild).toHaveClass('bg-slate-800', 'border-orange-500')
    })

    it('shows a different accent per severity', () => {
      const { container } = render(
        <ErrorNotification error={{ ...mockError, severity: ErrorSeverity.CRITICAL }} onDismiss={mockOnDismiss} />
      )

      expect(container.firstChild).toHaveClass('border-red-500')
    })

    it('offers no retry button, since no error can be retried from a toast', () => {
      render(<ErrorNotification error={mockError} onDismiss={mockOnDismiss} />)

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    })
  })

  describe('details functionality', () => {
    it('should toggle details visibility', () => {
      render(<ErrorNotification error={mockError} onDismiss={mockOnDismiss} />)

      expect(screen.queryByText('Type:')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /show details/i }))
      expect(screen.getByText('Type:')).toBeInTheDocument()
      expect(screen.getByText('PROCESSING_FAILED')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /hide details/i }))
      expect(screen.queryByText('Type:')).not.toBeInTheDocument()
    })

    it('should show error context in details', () => {
      render(<ErrorNotification error={mockError} onDismiss={mockOnDismiss} />)

      fireEvent.click(screen.getByRole('button', { name: /show details/i }))

      expect(screen.getByText('Context:')).toBeInTheDocument()
      expect(screen.getByText(/"operation": "test"/)).toBeInTheDocument()
    })

    it('should show technical details when available', () => {
      render(
        <ErrorNotification
          error={{ ...mockError, originalError: new Error('Technical error message') }}
          onDismiss={mockOnDismiss}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /show details/i }))

      expect(screen.getByText('Technical Details:')).toBeInTheDocument()
      expect(screen.getByText('Technical error message')).toBeInTheDocument()
    })
  })

  describe('dismiss functionality', () => {
    it('should call onDismiss when dismiss button clicked', () => {
      render(<ErrorNotification error={mockError} onDismiss={mockOnDismiss} />)

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

      expect(mockOnDismiss).toHaveBeenCalledTimes(1)
    })
  })
})

describe('ErrorNotificationContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorHandler.clearErrorHistory()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const raise = (severity: ErrorSeverity, type = ErrorType.PROCESSING_FAILED, notify?: boolean) =>
    act(() => {
      errorHandler.handleError(`${type} error`, { type, severity, notify })
    })

  it('should render nothing when no errors', () => {
    const { container } = render(<ErrorNotificationContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('should show notifications for new errors', () => {
    render(<ErrorNotificationContainer />)

    raise(ErrorSeverity.HIGH)

    expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
  })

  it('does not show errors the caller reports with notify: false', () => {
    render(<ErrorNotificationContainer />)

    raise(ErrorSeverity.HIGH, ErrorType.PROCESSING_FAILED, false)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should limit number of notifications', () => {
    render(<ErrorNotificationContainer maxNotifications={2} />)

    raise(ErrorSeverity.HIGH)
    raise(ErrorSeverity.HIGH)
    raise(ErrorSeverity.HIGH)

    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('should auto-dismiss low severity errors', () => {
    vi.useFakeTimers()
    render(<ErrorNotificationContainer />)

    raise(ErrorSeverity.LOW, ErrorType.UNKNOWN_ERROR)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should not auto-dismiss high severity errors', () => {
    vi.useFakeTimers()
    render(<ErrorNotificationContainer />)

    raise(ErrorSeverity.HIGH)

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(screen.getByText(/Failed to process/)).toBeInTheDocument()
  })

  it('should handle notification dismissal', () => {
    render(<ErrorNotificationContainer />)

    raise(ErrorSeverity.HIGH)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByText(/Failed to process/)).not.toBeInTheDocument()
  })

  it('fits the screen width on small viewports', () => {
    render(<ErrorNotificationContainer />)

    raise(ErrorSeverity.HIGH)

    const container = screen.getByRole('alert').parentElement
    expect(container).toHaveClass('fixed', 'top-4', 'right-4', 'left-4', 'sm:w-96')
  })
})
