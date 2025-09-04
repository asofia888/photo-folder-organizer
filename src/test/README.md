# Testing Documentation

## Overview

This project uses a comprehensive testing strategy with Vitest and React Testing Library to ensure code quality and reliability.

## Test Structure

```
src/test/
├── components/           # Component tests
│   ├── ErrorNotification.test.tsx
│   └── Thumbnail.test.tsx
├── hooks/               # Hook tests
│   ├── useFolderProcessor.test.ts
│   └── useLazyThumbnails.test.ts
├── utils/               # Utility function tests
│   ├── errorHandler.test.ts
│   └── memoryManager.test.ts
├── integration/         # Integration tests
│   └── errorHandling.test.tsx
├── setup.ts            # Test setup and mocks
├── test-utils.tsx      # Custom testing utilities
└── README.md           # This file
```

## Test Categories

### Unit Tests
- **Utility Functions**: Test individual utility functions in isolation
- **Error Handler**: Comprehensive testing of error handling system
- **Memory Manager**: Testing memory management and cleanup

### Hook Tests
- **useFolderProcessor**: Testing folder processing logic and state management
- **useLazyThumbnails**: Testing lazy thumbnail loading and caching

### Component Tests
- **Thumbnail**: Testing image display, lazy loading, and interactions
- **ErrorNotification**: Testing error display, retry functionality, and user interactions

### Integration Tests
- **Error Handling**: End-to-end testing of error flows across components

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests once
npm run test:run

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

## Test Configuration

Tests are configured in `vitest.config.ts` with:
- JSdom environment for DOM testing
- TypeScript support
- Path mapping for imports
- Coverage reporting
- Global test setup

## Test Utilities

### Mock Utilities
- `createMockFile()`: Creates mock File objects
- `createMockFileSystemDirectoryEntry()`: Creates mock directory structures
- `mockWorkerResponse()`: Simulates Web Worker responses

### Custom Render
- Uses React Testing Library with custom providers
- Includes error boundary and context providers
- Pre-configured for application testing

## Best Practices

### Test Structure
- Use descriptive test names
- Group related tests with `describe` blocks
- Use `beforeEach` and `afterEach` for setup/cleanup

### Mocking
- Mock external dependencies (APIs, Workers, etc.)
- Use `vi.mock()` for module-level mocks
- Clean up mocks in `afterEach`

### Assertions
- Use specific assertions (toBeInTheDocument, toHaveClass, etc.)
- Test user interactions, not implementation details
- Verify accessibility attributes

### Async Testing
- Use `waitFor()` for asynchronous operations
- Use `act()` for state updates
- Handle promise resolution/rejection properly

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75% 
- **Functions**: > 80%
- **Lines**: > 80%

## Mock Strategy

### Browser APIs
- IntersectionObserver
- URL.createObjectURL/revokeObjectURL
- performance.memory
- File System Access API

### External Dependencies
- Web Workers
- EXIF data extraction
- Memory monitoring

### Component Dependencies
- Custom hooks
- Utility functions
- Error handling system

## CI/CD Integration

Tests should be run:
- On every commit (pre-commit hook)
- On pull requests
- Before deployment
- With coverage reporting

## Debugging Tests

### Common Issues
1. **Mock not working**: Ensure mock is called before component render
2. **Async failures**: Use proper async/await and waitFor
3. **DOM not updating**: Wrap state changes in `act()`
4. **Memory leaks**: Clean up timers and event listeners

### Debug Tools
- `screen.debug()` to see current DOM
- `--reporter=verbose` for detailed output
- Vitest UI for interactive debugging

## Example Test Pattern

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render correctly', () => {
    render(<ComponentName />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    const handleClick = vi.fn()
    render(<ComponentName onClick={handleClick} />)
    
    fireEvent.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})