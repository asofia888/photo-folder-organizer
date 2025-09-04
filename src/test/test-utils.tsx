import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { LanguageProvider } from '../contexts/LanguageContext'

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

export const createMockFileSystemDirectoryEntry = (
  name: string = 'test-folder',
  files: File[] = []
): FileSystemDirectoryEntry => {
  return {
    name,
    fullPath: `/${name}`,
    isFile: false,
    isDirectory: true,
    filesystem: {} as any,
    createReader: () => ({
      readEntries: (successCallback: (entries: FileSystemEntry[]) => void) => {
        const entries = files.map(file => createMockFileSystemFileEntry(file.name, file))
        successCallback(entries)
      }
    }),
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

export const mockWorkerResponse = (worker: any, response: any) => {
  setTimeout(() => {
    if (worker.onmessage) {
      worker.onmessage({ data: response })
    }
  }, 0)
}