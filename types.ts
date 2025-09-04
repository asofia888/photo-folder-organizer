// Base types for better type safety
export type NonEmptyString = string & { readonly __brand: unique symbol };
export type ValidFileName = string & { readonly __brand: unique symbol };
export type ValidFolderName = string & { readonly __brand: unique symbol };
export type ISODateString = string & { readonly __brand: unique symbol };
export type PhotoId = string & { readonly __brand: unique symbol };
export type FolderId = string & { readonly __brand: unique symbol };

// Utility types for better type inference
export type RequiredNonNull<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// File processing states
export const ProcessingStatus = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error'
} as const;

export type ProcessingStatus = typeof ProcessingStatus[keyof typeof ProcessingStatus];

// Date logic options
export const DateLogic = {
  EARLIEST: 'earliest',
  LATEST: 'latest'
} as const;

export type DateLogic = typeof DateLogic[keyof typeof DateLogic];

// Supported image MIME types
export const SupportedImageMimeType = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  GIF: 'image/gif',
  BMP: 'image/bmp',
  TIFF: 'image/tiff'
} as const;

export type SupportedImageMimeType = typeof SupportedImageMimeType[keyof typeof SupportedImageMimeType];

// Photo interface with stricter typing - keeping compatible with existing code
export interface Photo {
  readonly id: string; // PhotoId for strict typing, but string for compatibility
  url: string | null; // Can be null before URL creation
  readonly date: string; // ISODateString for strict typing, but string for compatibility
  readonly file?: File; // Optional for compatibility
  readonly metadata?: Readonly<{
    width?: number;
    height?: number;
    size: number;
    mimeType: SupportedImageMimeType;
    lastModified: number;
    exifData?: Record<string, unknown>;
  }>;
}

// Folder interface with stricter typing - keeping compatible with existing code
export interface Folder {
  readonly id: string; // FolderId for strict typing, but string for compatibility
  readonly originalName: string; // NonEmptyString for strict typing, but string for compatibility
  readonly photos: readonly Photo[];
  readonly representativeDate: Date | null; // Allow null for backward compatibility
  newName: string;
  isRenamed: boolean;
  readonly metadata?: Readonly<{
    totalSize: number;
    photoCount: number;
    dateRange: {
      earliest: Date;
      latest: Date;
    };
  }>;
}

// Processing progress interface
export interface ProcessingProgress {
  readonly current: number;
  readonly total: number;
  readonly status: 'preparing' | 'processing' | 'complete' | 'error';
  readonly message?: string;
  readonly error?: string;
  readonly phase?: 'scanning' | 'processing' | 'organizing' | 'finalizing';
}

// Worker message types for type-safe communication
export interface WorkerMessage<T = unknown> {
  readonly type: string;
  readonly payload?: T;
  readonly error?: string;
  readonly id?: string;
}

export interface WorkerProgressMessage extends WorkerMessage<{
  readonly processedFolders: number;
  readonly totalFolders: number;
  readonly processedFiles: number;
  readonly totalFiles: number;
  readonly currentFolderName?: string;
  readonly phase: 'processing' | 'organizing';
  readonly memoryUsage?: number;
}> {
  readonly type: 'progress';
}

export interface WorkerStartMessage extends WorkerMessage<{
  readonly totalFolders: number;
  readonly totalFiles: number;
  readonly phase: 'processing';
}> {
  readonly type: 'start';
}

export interface WorkerDoneMessage extends WorkerMessage<readonly Folder[]> {
  readonly type: 'done';
}

export interface WorkerErrorMessage extends WorkerMessage {
  readonly type: 'error';
  readonly error: string;
}

export type WorkerResponseMessage = 
  | WorkerProgressMessage 
  | WorkerStartMessage 
  | WorkerDoneMessage 
  | WorkerErrorMessage;

// File system entry types for better type safety
export interface FileSystemEntryTyped extends FileSystemEntry {
  readonly name: ValidFileName;
}

export interface FileSystemDirectoryEntryTyped extends FileSystemDirectoryEntry {
  readonly name: ValidFolderName;
  createReader(): FileSystemDirectoryReader;
}

// Language support
export const SupportedLanguage = {
  EN: 'en',
  JA: 'ja'
} as const;

export type SupportedLanguage = typeof SupportedLanguage[keyof typeof SupportedLanguage];

// Component prop types with strict generics
export interface ComponentWithChildren<P = {}> {
  children?: React.ReactNode;
  props?: P;
}

export interface ComponentWithClassName {
  className?: string;
}

// Event handler types
export type EventHandler<T = Event> = (event: T) => void;
export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

// Utility function return types
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Memory management types
export interface MemoryStats {
  readonly objectUrlCount: number;
  readonly canvasCacheSize: number;
  readonly estimatedMemoryUsage: string;
  readonly isHighMemory: boolean;
  readonly systemMemory?: Readonly<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    utilization: number;
  }>;
}

// Error handling types (referencing errorHandler types)
export interface ErrorContext {
  readonly [key: string]: unknown;
}

export interface AppError {
  readonly id: string;
  readonly type: string;
  readonly severity: string;
  readonly message: string;
  readonly userMessage: string;
  readonly timestamp: Date;
  readonly context?: ErrorContext;
  readonly originalError?: Error;
  canRetry: boolean;
  retryCount: number;
  readonly maxRetries: number;
}