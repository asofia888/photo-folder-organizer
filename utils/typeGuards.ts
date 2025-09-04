import {
  NonEmptyString,
  ValidFileName,
  ValidFolderName,
  ISODateString,
  PhotoId,
  FolderId,
  SupportedImageMimeType,
  Photo,
  Folder,
  ProcessingStatus,
  DateLogic,
  WorkerResponseMessage,
  WorkerProgressMessage,
  WorkerStartMessage,
  WorkerDoneMessage,
  WorkerErrorMessage,
  SupportedLanguage,
  Result,
  AsyncResult
} from '../types';

// Brand type creators for safer string handling
export const createNonEmptyString = (value: string): NonEmptyString | null => {
  return value.length > 0 ? value as NonEmptyString : null;
};

export const createValidFileName = (value: string): ValidFileName | null => {
  // Check for valid filename characters (no path separators, null bytes, etc.)
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  
  if (value.length === 0 || value.length > 255 || invalidChars.test(value) || reserved.test(value) || value.trim() !== value) {
    return null;
  }
  
  return value as ValidFileName;
};

export const createValidFolderName = (value: string): ValidFolderName | null => {
  // Same validation as filename for now, but could be extended
  const validFileName = createValidFileName(value);
  return validFileName ? value as ValidFolderName : null;
};

export const createISODateString = (value: string): ISODateString | null => {
  // Validate ISO 8601 date format
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  
  if (!isoDateRegex.test(value)) {
    return null;
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return value as ISODateString;
};

export const createPhotoId = (value: string): PhotoId => {
  return value as PhotoId;
};

export const createFolderId = (value: string): FolderId => {
  return value as FolderId;
};

// Type guards for primitive types
export const isNonEmptyString = (value: unknown): value is NonEmptyString => {
  return typeof value === 'string' && value.length > 0;
};

export const isValidFileName = (value: unknown): value is ValidFileName => {
  return typeof value === 'string' && createValidFileName(value) !== null;
};

export const isValidFolderName = (value: unknown): value is ValidFolderName => {
  return typeof value === 'string' && createValidFolderName(value) !== null;
};

export const isISODateString = (value: unknown): value is ISODateString => {
  return typeof value === 'string' && createISODateString(value) !== null;
};

export const isPhotoId = (value: unknown): value is PhotoId => {
  return typeof value === 'string' && value.length > 0;
};

export const isFolderId = (value: unknown): value is FolderId => {
  return typeof value === 'string' && value.length > 0;
};

// Type guards for enum-like types
export const isProcessingStatus = (value: unknown): value is ProcessingStatus => {
  return typeof value === 'string' && ['idle', 'processing', 'done', 'error'].includes(value);
};

export const isDateLogic = (value: unknown): value is DateLogic => {
  return typeof value === 'string' && ['earliest', 'latest'].includes(value);
};

export const isSupportedImageMimeType = (value: unknown): value is SupportedImageMimeType => {
  return typeof value === 'string' && [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff'
  ].includes(value);
};

export const isSupportedLanguage = (value: unknown): value is SupportedLanguage => {
  return typeof value === 'string' && ['en', 'ja'].includes(value);
};

// Type guards for File objects
export const isImageFile = (file: File): file is File & { type: SupportedImageMimeType } => {
  return isSupportedImageMimeType(file.type);
};

export const isValidImageSize = (file: File, maxSizeBytes: number = 50 * 1024 * 1024): boolean => {
  return file.size > 0 && file.size <= maxSizeBytes;
};

// Type guards for complex types
export const isPhoto = (value: unknown): value is Photo => {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isPhotoId(obj.id) &&
    (typeof obj.url === 'string' || obj.url === null) &&
    isISODateString(obj.date) &&
    obj.file instanceof File &&
    isImageFile(obj.file)
  );
};

export const isFolder = (value: unknown): value is Folder => {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isFolderId(obj.id) &&
    isNonEmptyString(obj.originalName) &&
    Array.isArray(obj.photos) &&
    obj.photos.every(isPhoto) &&
    obj.representativeDate instanceof Date &&
    !isNaN(obj.representativeDate.getTime()) &&
    typeof obj.newName === 'string' &&
    typeof obj.isRenamed === 'boolean'
  );
};

// Type guards for Worker messages
export const isWorkerMessage = (value: unknown): value is WorkerResponseMessage => {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  return typeof obj.type === 'string';
};

export const isWorkerProgressMessage = (value: unknown): value is WorkerProgressMessage => {
  if (!isWorkerMessage(value) || value.type !== 'progress') return false;
  
  const payload = value.payload;
  if (!payload || typeof payload !== 'object') return false;
  
  const p = payload as Record<string, unknown>;
  return (
    typeof p.processedFolders === 'number' &&
    typeof p.totalFolders === 'number' &&
    typeof p.processedFiles === 'number' &&
    typeof p.totalFiles === 'number' &&
    (p.phase === 'processing' || p.phase === 'organizing')
  );
};

export const isWorkerStartMessage = (value: unknown): value is WorkerStartMessage => {
  if (!isWorkerMessage(value) || value.type !== 'start') return false;
  
  const payload = value.payload;
  if (!payload || typeof payload !== 'object') return false;
  
  const p = payload as Record<string, unknown>;
  return (
    typeof p.totalFolders === 'number' &&
    typeof p.totalFiles === 'number' &&
    p.phase === 'processing'
  );
};

export const isWorkerDoneMessage = (value: unknown): value is WorkerDoneMessage => {
  if (!isWorkerMessage(value) || value.type !== 'done') return false;
  
  const payload = value.payload;
  return Array.isArray(payload) && payload.every(isFolder);
};

export const isWorkerErrorMessage = (value: unknown): value is WorkerErrorMessage => {
  if (!isWorkerMessage(value) || value.type !== 'error') return false;
  
  return typeof value.error === 'string';
};

// Result type helpers with validation
export const createSuccessResult = <T>(data: T): Result<T> => ({
  success: true as const,
  data
});

export const createErrorResult = <E extends Error>(error: E): Result<never, E> => ({
  success: false as const,
  error
});

export const createAsyncSuccessResult = async <T>(data: T): AsyncResult<T> => 
  createSuccessResult(data);

export const createAsyncErrorResult = async <E extends Error>(error: E): AsyncResult<never, E> => 
  createErrorResult(error);

// Result type guards
export const isSuccessResult = <T, E>(result: Result<T, E>): result is { success: true; data: T } => {
  return result.success === true;
};

export const isErrorResult = <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
  return result.success === false;
};

// Safe array operations with type checking
export const safeMap = <T, U>(
  array: readonly T[],
  mapper: (item: T, index: number) => U,
  validator?: (item: T) => boolean
): U[] => {
  return array
    .filter((item): item is T => validator ? validator(item) : true)
    .map(mapper);
};

export const safeFilter = <T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean
): T[] => {
  return array.filter(predicate);
};

export const safeFind = <T>(
  array: readonly T[],
  predicate: (item: T, index: number) => boolean
): T | undefined => {
  return array.find(predicate);
};

// Validation helpers
export const validateAndTransform = <T, U>(
  value: T,
  validator: (value: T) => value is U,
  errorMessage: string = 'Validation failed'
): Result<U> => {
  if (validator(value)) {
    return createSuccessResult(value);
  }
  return createErrorResult(new Error(errorMessage));
};

export const validateArray = <T>(
  values: unknown[],
  validator: (value: unknown) => value is T,
  errorMessage: string = 'Array validation failed'
): Result<T[]> => {
  const validItems: T[] = [];
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (validator(value)) {
      validItems.push(value);
    } else {
      return createErrorResult(new Error(`${errorMessage} at index ${i}`));
    }
  }
  
  return createSuccessResult(validItems);
};

// Object validation helpers
export const hasRequiredProperties = <T extends Record<string, unknown>>(
  obj: unknown,
  requiredKeys: (keyof T)[]
): obj is T => {
  if (!obj || typeof obj !== 'object') return false;
  
  const record = obj as Record<string, unknown>;
  return requiredKeys.every(key => key in record);
};

export const validateObject = <T>(
  obj: unknown,
  validator: (obj: unknown) => obj is T,
  errorMessage: string = 'Object validation failed'
): Result<T> => {
  if (validator(obj)) {
    return createSuccessResult(obj);
  }
  return createErrorResult(new Error(errorMessage));
};

// Safe JSON parsing with type validation
export const safeJsonParse = <T>(
  jsonString: string,
  validator: (obj: unknown) => obj is T
): Result<T> => {
  try {
    const parsed = JSON.parse(jsonString);
    return validateObject(parsed, validator, 'Invalid JSON structure');
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error('JSON parse failed')
    );
  }
};

// Type assertion helpers for migration from existing code
export const assertPhoto = (value: unknown): Photo => {
  if (!isPhoto(value)) {
    throw new Error('Invalid Photo object');
  }
  return value;
};

export const assertFolder = (value: unknown): Folder => {
  if (!isFolder(value)) {
    throw new Error('Invalid Folder object');
  }
  return value;
};

export const assertNonEmptyString = (value: unknown): NonEmptyString => {
  if (!isNonEmptyString(value)) {
    throw new Error('Expected non-empty string');
  }
  return value;
};

// Type narrowing helpers
export const narrowToPhotos = (items: unknown[]): Photo[] => {
  return items.filter(isPhoto);
};

export const narrowToFolders = (items: unknown[]): Folder[] => {
  return items.filter(isFolder);
};

export const narrowToImageFiles = (files: File[]): Array<File & { type: SupportedImageMimeType }> => {
  return files.filter(isImageFile);
};