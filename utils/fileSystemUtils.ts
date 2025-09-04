// File System Access API utilities for folder operations

import {
  ValidFolderName,
  ValidFileName,
  ProcessingProgress,
  Result,
  AsyncResult,
  SupportedImageMimeType
} from '../types';
import {
  createValidFolderName,
  createValidFileName,
  isValidFolderName,
  isValidFileName,
  createSuccessResult,
  createErrorResult,
  isImageFile,
  validateArray
} from './typeGuards';

export type ProgressCallback = (progress: ProcessingProgress) => void;

// Strictly typed folder organization structure
export interface OrganizationFolder {
  readonly name: ValidFolderName;
  readonly photos: readonly File[];
}

// File system operation results
export type FileSystemResult<T> = AsyncResult<T, FileSystemError>;

// Custom error types for file system operations
export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_SUPPORTED' | 'PERMISSION_DENIED' | 'INVALID_NAME' | 'CREATE_FAILED' | 'COPY_FAILED' | 'VALIDATION_FAILED',
    public readonly details?: string
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

// Check if File System Access API is supported
export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

// Type-safe validation of folder organization input
export const validateOrganizationFolders = (
  folders: unknown[]
): Result<OrganizationFolder[]> => {
  const validatedFolders: OrganizationFolder[] = [];
  
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    
    if (!folder || typeof folder !== 'object') {
      return createErrorResult(
        new FileSystemError(
          `Invalid folder at index ${i}`,
          'VALIDATION_FAILED',
          'Expected object with name and photos properties'
        )
      );
    }
    
    const obj = folder as Record<string, unknown>;
    
    // Validate folder name
    if (typeof obj.name !== 'string') {
      return createErrorResult(
        new FileSystemError(
          `Invalid folder name at index ${i}`,
          'VALIDATION_FAILED',
          'Expected string folder name'
        )
      );
    }
    
    const validFolderName = createValidFolderName(obj.name);
    if (!validFolderName) {
      return createErrorResult(
        new FileSystemError(
          `Invalid folder name "${obj.name}" at index ${i}`,
          'INVALID_NAME',
          'Folder name contains invalid characters or is reserved'
        )
      );
    }
    
    // Validate photos array
    if (!Array.isArray(obj.photos)) {
      return createErrorResult(
        new FileSystemError(
          `Invalid photos array at index ${i}`,
          'VALIDATION_FAILED',
          'Expected array of File objects'
        )
      );
    }
    
    const photos: File[] = [];
    for (let j = 0; j < obj.photos.length; j++) {
      const photo = obj.photos[j];
      if (!(photo instanceof File)) {
        return createErrorResult(
          new FileSystemError(
            `Invalid photo at folder ${i}, photo ${j}`,
            'VALIDATION_FAILED',
            'Expected File object'
          )
        );
      }
      
      if (!isImageFile(photo)) {
        return createErrorResult(
          new FileSystemError(
            `Unsupported file type "${photo.type}" for ${photo.name}`,
            'VALIDATION_FAILED',
            'Only supported image types are allowed'
          )
        );
      }
      
      photos.push(photo);
    }
    
    validatedFolders.push({
      name: validFolderName,
      photos: Object.freeze(photos)
    });
  }
  
  return createSuccessResult(validatedFolders);
};

// Check if a file handle supports writing (to ensure we can move files)
const canWriteFile = async (fileHandle: FileSystemFileHandle): Promise<boolean> => {
  try {
    const writable = await fileHandle.createWritable();
    await writable.close();
    return true;
  } catch {
    return false;
  }
};

// Create a new folder in the target directory with type safety
export const createFolder = async (
  directoryHandle: FileSystemDirectoryHandle,
  folderName: ValidFolderName
): FileSystemResult<FileSystemDirectoryHandle> => {
  try {
    const folderHandle = await directoryHandle.getDirectoryHandle(folderName, {
      create: true
    });
    return createSuccessResult(folderHandle);
  } catch (error) {
    return createErrorResult(
      new FileSystemError(
        `Failed to create folder "${folderName}"`,
        'CREATE_FAILED',
        error instanceof Error ? error.message : String(error)
      )
    );
  }
};

// Copy a file to a new location with type safety
const copyFile = async (
  sourceFile: File & { type: SupportedImageMimeType },
  targetHandle: FileSystemFileHandle
): FileSystemResult<void> => {
  try {
    const writable = await targetHandle.createWritable();
    await writable.write(sourceFile);
    await writable.close();
    return createSuccessResult(undefined);
  } catch (error) {
    return createErrorResult(
      new FileSystemError(
        `Failed to copy file "${sourceFile.name}"`,
        'COPY_FAILED',
        error instanceof Error ? error.message : String(error)
      )
    );
  }
};

// Type-safe file validation
const validateImageFiles = (files: File[]): Result<Array<File & { type: SupportedImageMimeType }>> => {
  const validFiles: Array<File & { type: SupportedImageMimeType }> = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!isImageFile(file)) {
      return createErrorResult(
        new FileSystemError(
          `Unsupported file type "${file.type}" for ${file.name}`,
          'VALIDATION_FAILED',
          'Only supported image types are allowed'
        )
      );
    }
    validFiles.push(file);
  }
  
  return createSuccessResult(validFiles);
};

// Move files to target folder with comprehensive type safety
export const moveFilesToFolder = async (
  files: File[],
  targetDirectoryHandle: FileSystemDirectoryHandle,
  onProgress?: ProgressCallback
): FileSystemResult<void> => {
  // Validate input files
  const validationResult = validateImageFiles(files);
  if (!validationResult.success) {
    return validationResult;
  }
  
  const validFiles = validationResult.data;
  const total = validFiles.length;
  let completed = 0;

  onProgress?.({
    current: 0,
    total,
    status: 'preparing'
  });

  for (const file of validFiles) {
    try {
      onProgress?.({
        current: completed,
        total,
        status: 'moving',
        currentFile: file.name
      });

      // Validate file name
      const validFileName = createValidFileName(file.name);
      if (!validFileName) {
        return createErrorResult(
          new FileSystemError(
            `Invalid file name "${file.name}"`,
            'INVALID_NAME',
            'File name contains invalid characters'
          )
        );
      }

      // Create file handle in target directory
      const fileHandle = await targetDirectoryHandle.getFileHandle(validFileName, {
        create: true
      });

      // Copy file content
      const copyResult = await copyFile(file, fileHandle);
      if (!copyResult.success) {
        return copyResult;
      }
      
      completed++;
      
      onProgress?.({
        current: completed,
        total,
        status: completed === total ? 'completed' : 'moving'
      });
    } catch (error) {
      const errorMessage = `Failed to move ${file.name}: ${error}`;
      
      onProgress?.({
        current: completed,
        total,
        status: 'error',
        currentFile: file.name,
        error: errorMessage
      });
      
      return createErrorResult(
        new FileSystemError(
          errorMessage,
          'COPY_FAILED',
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }
  
  return createSuccessResult(undefined);
};

// Main function to create folder structure and organize photos with complete type safety
export const organizePhotosToFolders = async (
  folders: unknown[],
  onProgress?: ProgressCallback
): FileSystemResult<void> => {
  // Check API support
  if (!isFileSystemAccessSupported()) {
    return createErrorResult(
      new FileSystemError(
        'File System Access API is not supported in this browser',
        'NOT_SUPPORTED'
      )
    );
  }

  // Validate input folders
  const validationResult = validateOrganizationFolders(folders);
  if (!validationResult.success) {
    return validationResult;
  }

  const validatedFolders = validationResult.data;

  try {
    // Let user select target directory
    const targetDirHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });

    const totalFiles = validatedFolders.reduce((sum, folder) => sum + folder.photos.length, 0);
    let processedFiles = 0;

    onProgress?.({
      current: 0,
      total: totalFiles,
      status: 'preparing'
    });

    // Process each folder
    for (const folder of validatedFolders) {
      onProgress?.({
        current: processedFiles,
        total: totalFiles,
        status: 'creating',
        currentFile: `Creating folder: ${folder.name}`
      });

      // Create folder
      const folderResult = await createFolder(targetDirHandle, folder.name);
      if (!folderResult.success) {
        return folderResult;
      }

      const folderHandle = folderResult.data;

      // Move files to folder
      const moveResult = await moveFilesToFolder(
        Array.from(folder.photos), // Convert readonly array to regular array
        folderHandle,
        (progress) => {
          onProgress?.({
            current: processedFiles + progress.current,
            total: totalFiles,
            status: progress.status,
            currentFile: progress.currentFile
          });
        }
      );

      if (!moveResult.success) {
        return moveResult;
      }

      processedFiles += folder.photos.length;
    }

    onProgress?.({
      current: totalFiles,
      total: totalFiles,
      status: 'completed'
    });

    return createSuccessResult(undefined);

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return createErrorResult(
        new FileSystemError(
          '操作がキャンセルされました',
          'PERMISSION_DENIED',
          'User cancelled the operation'
        )
      );
    }
    
    return createErrorResult(
      new FileSystemError(
        'フォルダの作成中にエラーが発生しました',
        'CREATE_FAILED',
        error instanceof Error ? error.message : String(error)
      )
    );
  }
};

// Type-safe folder name validation that returns a branded type
export const validateFolderName = (name: string): ValidFolderName | null => {
  return createValidFolderName(name);
};

// Legacy boolean validation for backward compatibility
export const isValidFolderNameBoolean = (name: string): boolean => {
  return createValidFolderName(name) !== null;
};