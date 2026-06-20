import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { LanguageProvider } from '../../contexts/LanguageContext'

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <LanguageProvider>
      {children}
    </LanguageProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Helper functions for tests
export const createMockFile = (
  name: string = 'test.jpg',
  size: number = 1024,
  type: string = 'image/jpeg'
): File => {
  const file = new File(['test content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// A real FileSystemDirectoryReader returns its entries in batches and then an
// empty array once exhausted. Mocks MUST honour that: useFolderProcessor reads
// in a `do { ... } while (entries.length > 0)` loop, so a reader that always
// returns the same non-empty batch would loop forever (and exhaust the heap).
const readerReturning = (entries: FileSystemEntry[]) => () => {
  let read = false
  return {
    readEntries: (successCallback: (entries: FileSystemEntry[]) => void) => {
      successCallback(read ? [] : entries)
      read = true
    }
  }
}

export const createMockFileSystemDirectoryEntry = (
  name: string = 'test-folder',
  files: File[] = []
): FileSystemDirectoryEntry => {
  // processDirectory scans the dropped folder for sub-directories and reads the
  // photos inside each one, so nest the files under a single sub-directory.
  const fileEntries = files.map(file => createMockFileSystemFileEntry(file.name, file))
  const subDirectory = {
    name: 'subfolder',
    fullPath: `/${name}/subfolder`,
    isFile: false,
    isDirectory: true,
    filesystem: {} as any,
    createReader: readerReturning(fileEntries),
  } as unknown as FileSystemDirectoryEntry

  return {
    name,
    fullPath: `/${name}`,
    isFile: false,
    isDirectory: true,
    filesystem: {} as any,
    createReader: readerReturning([subDirectory]),
  } as FileSystemDirectoryEntry
}

export const createMockFileSystemFileEntry = (
  name: string,
  file: File
): FileSystemFileEntry => {
  return {
    name,
    fullPath: `/${name}`,
    isFile: true,
    isDirectory: false,
    filesystem: {} as any,
    file: (successCallback: (file: File) => void) => {
      successCallback(file)
    },
  } as FileSystemFileEntry
}

export const waitForWorkerMessage = () => {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// Deliver a worker message synchronously. Tests wrap this in `act(...)`, so the
// resulting state update is applied and flushed in order before assertions run.
// (A setTimeout-based version raced with `await act()` and could leave an
// earlier message applied last.)
export const mockWorkerResponse = (worker: any, response: any) => {
  if (worker.onmessage) {
    worker.onmessage({ data: response })
  }
}