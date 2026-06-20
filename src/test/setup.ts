import '@testing-library/jest-dom'

// Mock window.URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-object-url')
global.URL.revokeObjectURL = vi.fn()

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as unknown as typeof IntersectionObserver

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock FileReader
global.FileReader = vi.fn(() => ({
  readAsDataURL: vi.fn(),
  readAsText: vi.fn(),
  readAsArrayBuffer: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onload: null,
  onerror: null,
  onloadend: null,
  result: null,
  error: null,
  readyState: 0,
  EMPTY: 0,
  LOADING: 1,
  DONE: 2,
})) as unknown as typeof FileReader

// Mock Worker
global.Worker = vi.fn(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null,
})) as unknown as typeof Worker

// Mock performance.memory for memory management tests
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 1024 * 1024 * 50, // 50MB
    totalJSHeapSize: 1024 * 1024 * 100, // 100MB
    jsHeapSizeLimit: 1024 * 1024 * 2000, // 2GB
  },
  writable: true,
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// jsdom does not implement PromiseRejectionEvent, which the global error
// handler relies on. Provide a minimal polyfill for tests.
if (typeof (globalThis as any).PromiseRejectionEvent === 'undefined') {
  class PromiseRejectionEventPolyfill extends Event {
    readonly promise: Promise<any>
    readonly reason: any
    constructor(type: string, init: { promise: Promise<any>; reason: any }) {
      super(type)
      this.promise = init.promise
      this.reason = init.reason
    }
  }
  ;(globalThis as any).PromiseRejectionEvent = PromiseRejectionEventPolyfill
}

// NOTE: Fake timers are intentionally NOT enabled globally. Tests that need
// them enable fake timers locally (beforeEach/afterEach), which avoids hanging
// any code that awaits a real setTimeout (e.g. error recovery, batch GC hints).