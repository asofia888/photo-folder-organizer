import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../test-utils'
import Thumbnail from '../../../components/Thumbnail'
import { Photo } from '../../../types'
import { createMockFile } from '../test-utils'

describe('Thumbnail', () => {
  const mockPhoto: Photo = {
    id: 'test-photo-1',
    date: '2023-01-01T00:00:00.000Z',
    url: 'original-photo-url',
    file: createMockFile('test.jpg', 1024, 'image/jpeg')
  }

  const mockIntersectionObserver = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock IntersectionObserver
    mockIntersectionObserver.mockImplementation((callback) => ({
      disconnect: vi.fn(),
      observe: vi.fn((element) => {
        // Simulate intersection immediately for testing
        setTimeout(() => {
          callback([{ isIntersecting: true, target: element }])
        }, 0)
      }),
      unobserve: vi.fn(),
    }))

    global.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render placeholder when not visible (lazy=true)', () => {
      const { container } = render(<Thumbnail photo={mockPhoto} lazy={true} />)

      // No actual <img> yet; a skeleton placeholder (svg icon) is shown instead
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should render image immediately when lazy=false', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('alt', 'Photo thumbnail')
    })

    it('should render image with correct attributes', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('loading', 'lazy')
      expect(image).toHaveClass('object-cover', 'w-full', 'h-full', 'rounded-md')
    })

    it('should apply cursor-pointer class when onClick provided', () => {
      const handleClick = vi.fn()
      render(<Thumbnail photo={mockPhoto} onClick={handleClick} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveClass('cursor-pointer')
    })
  })

  describe('lazy loading', () => {
    it('should observe element for intersection when lazy=true', async () => {
      render(<Thumbnail photo={mockPhoto} lazy={true} />)

      await waitFor(() => {
        expect(mockIntersectionObserver).toHaveBeenCalled()
      })

      const observerInstance = mockIntersectionObserver.mock.results[0].value
      expect(observerInstance.observe).toHaveBeenCalled()
    })

    it('should show image after intersection', async () => {
      render(<Thumbnail photo={mockPhoto} lazy={true} />)

      // Wait for intersection observer to trigger
      await waitFor(() => {
        const image = screen.queryByAltText('Photo thumbnail')
        expect(image).toBeInTheDocument()
      })
    })

    it('should not use intersection observer when lazy=false', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      expect(mockIntersectionObserver).not.toHaveBeenCalled()
    })

    it('should disconnect observer on unmount', async () => {
      const { unmount } = render(<Thumbnail photo={mockPhoto} lazy={true} />)

      await waitFor(() => {
        expect(mockIntersectionObserver).toHaveBeenCalled()
      })

      const observerInstance = mockIntersectionObserver.mock.results[0].value

      unmount()

      expect(observerInstance.disconnect).toHaveBeenCalled()
    })
  })

  describe('image loading states', () => {
    it('should show loading spinner initially', async () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      // Loading spinner should be present initially
      const spinner = screen.getByRole('status', { hidden: true })
      expect(spinner).toBeInTheDocument()
    })

    it('should call onLoad callback when image loads', async () => {
      const handleLoad = vi.fn()
      render(<Thumbnail photo={mockPhoto} onLoad={handleLoad} lazy={false} />)

      const image = screen.getByRole('img')
      fireEvent.load(image)

      expect(handleLoad).toHaveBeenCalledTimes(1)
    })

    it('should hide loading spinner after image loads', async () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      fireEvent.load(image)

      // Loading spinner should be hidden
      await waitFor(() => {
        const spinner = screen.queryByRole('status')
        expect(spinner).not.toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('should show error placeholder on image load error', async () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      fireEvent.error(image)

      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument()
      })
    })

    it('should hide loading spinner on error', async () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      fireEvent.error(image)

      await waitFor(() => {
        const spinner = screen.queryByRole('status')
        expect(spinner).not.toBeInTheDocument()
      })
    })

    it('should use error styling for error state', async () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      fireEvent.error(image)

      await waitFor(() => {
        // The error styling lives on the outer container, not the text node's
        // immediate parent.
        const errorContainer = screen.getByText('Failed to load').closest('div[class*="bg-red-900"]')
        expect(errorContainer).toHaveClass('bg-red-900/20', 'ring-red-700')
      })
    })
  })

  describe('click handling', () => {
    it('should call onClick when image is clicked', () => {
      const handleClick = vi.fn()
      render(<Thumbnail photo={mockPhoto} onClick={handleClick} lazy={false} />)

      const image = screen.getByRole('img')
      fireEvent.click(image)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when no handler provided', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(() => fireEvent.click(image)).not.toThrow()
    })
  })

  describe('thumbnail URL resolution', () => {
    it('should use an existing url when available', () => {
      const photoWithUrl = { ...mockPhoto, url: 'existing-url' }
      render(<Thumbnail photo={photoWithUrl} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('src', 'existing-url')
    })

    it('should create an object URL from the File when no url is set', () => {
      const photoWithoutUrl = { ...mockPhoto, url: null }
      render(<Thumbnail photo={photoWithoutUrl} lazy={false} />)

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockPhoto.file)
      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('src', 'mocked-object-url')
    })

    it('should prefer the extracted thumbnail URL for RAW files', () => {
      const rawPhoto: Photo = {
        id: 'raw-1',
        date: '2023-01-01T00:00:00.000Z',
        url: null,
        file: createMockFile('test.cr2', 1024),
        isRaw: true,
        thumbnailUrl: 'raw-thumb-url'
      }
      render(<Thumbnail photo={rawPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('src', 'raw-thumb-url')
      // A File-based object URL must NOT be created for RAW previews.
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('should show the RAW placeholder when a RAW file has no thumbnail', () => {
      const rawPhoto: Photo = {
        id: 'raw-2',
        date: '2023-01-01T00:00:00.000Z',
        url: null,
        file: createMockFile('test.cr2', 1024),
        isRaw: true
      }
      render(<Thumbnail photo={rawPhoto} lazy={false} />)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByText('RAW')).toBeInTheDocument()
    })

    it('should handle a missing file gracefully', () => {
      const photoWithoutFile = { ...mockPhoto, file: undefined, url: null }

      expect(() => {
        render(<Thumbnail photo={photoWithoutFile} lazy={false} />)
      }).not.toThrow()
    })
  })

  describe('accessibility', () => {
    it('should have appropriate alt text', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('alt', 'Photo thumbnail')
    })
  })

  describe('responsive behavior', () => {
    it('should have responsive aspect ratio classes', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const container = screen.getByRole('img').closest('div')
      expect(container).toHaveClass('aspect-w-1', 'aspect-h-1')
    })

    it('should have hover effects', () => {
      const handleClick = vi.fn()
      render(<Thumbnail photo={mockPhoto} onClick={handleClick} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveClass('hover:brightness-110')
    })

    it('should have group hover effects on container', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const container = screen.getByRole('img').closest('div')
      expect(container).toHaveClass('group')

      const image = screen.getByRole('img')
      expect(image).toHaveClass('group-hover:ring-sky-500', 'group-hover:scale-105')
    })
  })

  describe('performance considerations', () => {
    it('should use loading="lazy" attribute', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('loading', 'lazy')
    })

    it('should have smooth transitions', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveClass('transition-all', 'duration-300')
    })

    it('should handle intersection observer cleanup properly', async () => {
      const { unmount } = render(<Thumbnail photo={mockPhoto} lazy={true} />)

      await waitFor(() => {
        expect(mockIntersectionObserver).toHaveBeenCalled()
      })

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow()
    })
  })
})
