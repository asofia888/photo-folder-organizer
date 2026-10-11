import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../test-utils'
import Thumbnail from '../../../components/Thumbnail'
import { Photo } from '../../../types'
import { createMockFile } from '../test-utils'

describe('Thumbnail', () => {
  const mockPhoto: Photo = {
    id: 'test-photo-1',
    date: '2023-01-01T00:00:00.000Z',
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
      expect(image).toHaveAttribute('alt', 'test.jpg')
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
        const image = screen.queryByAltText('test.jpg')
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

  describe('source resolution', () => {
    it('should create an object URL from the File', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockPhoto.file)
      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('src', 'mocked-object-url')
    })

    it('should use the embedded preview for RAW files, never the RAW file itself', () => {
      const preview = new Blob(['jpeg'], { type: 'image/jpeg' })
      const rawPhoto: Photo = {
        id: 'raw-1',
        date: '2023-01-01T00:00:00.000Z',
        file: createMockFile('test.cr2', 1024),
        isRaw: true,
        thumbnail: preview
      }
      render(<Thumbnail photo={rawPhoto} lazy={false} />)

      expect(screen.getByRole('img')).toBeInTheDocument()
      expect(URL.createObjectURL).toHaveBeenCalledWith(preview)
      expect(URL.createObjectURL).not.toHaveBeenCalledWith(rawPhoto.file)
    })

    it('should show the RAW placeholder when a RAW file has no preview', () => {
      const rawPhoto: Photo = {
        id: 'raw-2',
        date: '2023-01-01T00:00:00.000Z',
        file: createMockFile('test.cr2', 1024),
        isRaw: true
      }
      render(<Thumbnail photo={rawPhoto} lazy={false} />)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByText('RAW')).toBeInTheDocument()
    })

    it('falls back to the embedded preview when the browser cannot decode the file', async () => {
      const preview = new Blob(['jpeg'], { type: 'image/jpeg' })
      vi.mocked(URL.createObjectURL).mockImplementation((blob) => (blob === preview ? 'preview-url' : 'file-url'))
      const photo: Photo = { ...mockPhoto, thumbnail: preview }
      render(<Thumbnail photo={photo} lazy={false} />)

      expect(screen.getByRole('img')).toHaveAttribute('src', 'file-url')
      fireEvent.error(screen.getByRole('img'))

      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute('src', 'preview-url')
      })
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('file-url')
    })

    it('shows a format tile, not an error, for HEIC the browser cannot display', async () => {
      const heic: Photo = { ...mockPhoto, file: createMockFile('IMG_0001.HEIC', 1024, 'image/heic') }
      render(<Thumbnail photo={heic} lazy={false} />)

      fireEvent.error(screen.getByRole('img'))

      await waitFor(() => {
        expect(screen.getByText('HEIC')).toBeInTheDocument()
      })
      expect(screen.queryByText('Failed to load')).not.toBeInTheDocument()
    })

    it('should handle a missing file gracefully', () => {
      const photoWithoutFile = { ...mockPhoto, file: undefined }

      expect(() => {
        render(<Thumbnail photo={photoWithoutFile} lazy={false} />)
      }).not.toThrow()
    })
  })

  describe('accessibility', () => {
    it('should use the file name as alt text', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('alt', 'test.jpg')
    })

    it('should be a keyboard-operable button when clickable', () => {
      const handleClick = vi.fn()
      render(<Thumbnail photo={mockPhoto} onClick={handleClick} lazy={false} />)

      const button = screen.getByRole('button', { name: 'View photo test.jpg' })
      fireEvent.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('responsive behavior', () => {
    it('should have responsive aspect ratio classes', () => {
      render(<Thumbnail photo={mockPhoto} lazy={false} />)

      const container = screen.getByRole('img').closest('div')
      expect(container).toHaveClass('aspect-square')
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
