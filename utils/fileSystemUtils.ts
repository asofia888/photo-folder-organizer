// "Organize to computer" via the File System Access API: for every named
// folder, creates a folder under a directory the user picks and copies the
// photos into it. Originals are never modified and existing files in the
// destination are never overwritten.

import type { Result } from '../types';
import {
  createValidFileName,
  createValidFolderName,
  createSuccessResult,
  createErrorResult
} from './typeGuards';

export interface OrganizeSummary {
  // Copied under their own name.
  copied: number;
  // Skipped: a file with the same name and size was already there (for
  // example from an earlier run into the same destination).
  alreadyPresent: number;
  // Copied with a " (2)" style suffix because a different file had the name.
  renamed: number;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  status: 'preparing' | 'copying' | 'completed' | 'cancelled' | 'error';
  currentFile?: string;
  error?: string;
  summary?: OrganizeSummary;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

export interface OrganizationFolder {
  readonly name: string;
  readonly photos: readonly File[];
}

export type FileSystemErrorCode = 'CANCELLED' | 'PERMISSION_DENIED' | 'INVALID_NAME' | 'WRITE_FAILED';

export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly code: FileSystemErrorCode,
    // The folder or "folder/file" the error is about, for the user message.
    public readonly target?: string,
    // What had been done before the operation stopped.
    public readonly summary?: OrganizeSummary
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
};

export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

const hasErrorName = (error: unknown, name: string): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === name;

/** Asks the user for the destination. Returns null if they close the picker. */
export const pickTargetDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    return await (window as unknown as DirectoryPickerWindow).showDirectoryPicker({ mode: 'readwrite' });
  } catch (error) {
    if (hasErrorName(error, 'AbortError')) return null;
    throw error;
  }
};

export const toFileSystemError = (
  error: unknown,
  target?: string,
  summary?: OrganizeSummary
): FileSystemError => {
  const permissionDenied = hasErrorName(error, 'NotAllowedError') || hasErrorName(error, 'SecurityError');
  return new FileSystemError(
    error instanceof Error ? error.message : String(error),
    permissionDenied ? 'PERMISSION_DENIED' : 'WRITE_FAILED',
    target,
    summary
  );
};

// What already exists under `name`: its File, 'directory', or null if free.
const lookupEntry = async (
  directory: FileSystemDirectoryHandle,
  name: string
): Promise<File | 'directory' | null> => {
  try {
    const handle = await directory.getFileHandle(name);
    return await handle.getFile();
  } catch (error) {
    if (hasErrorName(error, 'NotFoundError')) return null;
    if (hasErrorName(error, 'TypeMismatchError')) return 'directory';
    throw error;
  }
};

const splitExtension = (name: string): [string, string] => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
};

// "IMG_0001.jpg" -> "IMG_0001 (2).jpg", "IMG_0001 (3).jpg", ...
const findFreeName = async (directory: FileSystemDirectoryHandle, name: string): Promise<string> => {
  const [base, extension] = splitExtension(name);
  for (let n = 2; n < 10000; n++) {
    const candidate = `${base} (${n})${extension}`;
    if ((await lookupEntry(directory, candidate)) === null) return candidate;
  }
  throw new Error(`No free file name for "${name}"`);
};

const copyFile = async (
  directory: FileSystemDirectoryHandle,
  file: File
): Promise<keyof OrganizeSummary> => {
  const existing = await lookupEntry(directory, file.name);
  if (existing instanceof File && existing.size === file.size) {
    return 'alreadyPresent';
  }

  const targetName = existing === null ? file.name : await findFreeName(directory, file.name);
  const handle = await directory.getFileHandle(targetName, { create: true });
  try {
    const writable = await handle.createWritable();
    try {
      await writable.write(file);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    // getFileHandle({ create: true }) already created an empty file.
    await directory.removeEntry(targetName).catch(() => undefined);
    throw error;
  }

  return targetName === file.name ? 'copied' : 'renamed';
};

/**
 * Copies each folder's photos into `targetDirectory/<folder name>/`. Stops at
 * the first failure, or before the next file once `signal` is aborted; the
 * error then carries a summary of what was copied so far.
 */
export const organizePhotosToFolders = async (
  targetDirectory: FileSystemDirectoryHandle,
  folders: readonly OrganizationFolder[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<Result<OrganizeSummary, FileSystemError>> => {
  // Validate every name before writing anything.
  for (const folder of folders) {
    if (!createValidFolderName(folder.name)) {
      return createErrorResult(new FileSystemError(`Invalid folder name "${folder.name}"`, 'INVALID_NAME', folder.name));
    }
    for (const photo of folder.photos) {
      if (!createValidFileName(photo.name)) {
        return createErrorResult(new FileSystemError(`Invalid file name "${photo.name}"`, 'INVALID_NAME', photo.name));
      }
    }
  }

  const total = folders.reduce((sum, folder) => sum + folder.photos.length, 0);
  const summary: OrganizeSummary = { copied: 0, alreadyPresent: 0, renamed: 0 };
  let current = 0;

  onProgress?.({ current, total, status: 'preparing' });

  for (const folder of folders) {
    let folderHandle: FileSystemDirectoryHandle;
    try {
      // Reuses an existing folder of that name; copyFile never overwrites.
      folderHandle = await targetDirectory.getDirectoryHandle(folder.name, { create: true });
    } catch (error) {
      return createErrorResult(toFileSystemError(error, folder.name, { ...summary }));
    }

    for (const photo of folder.photos) {
      if (signal?.aborted) {
        return createErrorResult(new FileSystemError('Cancelled by the user', 'CANCELLED', undefined, { ...summary }));
      }

      const target = `${folder.name}/${photo.name}`;
      onProgress?.({ current, total, status: 'copying', currentFile: target });

      try {
        summary[await copyFile(folderHandle, photo)]++;
      } catch (error) {
        return createErrorResult(toFileSystemError(error, target, { ...summary }));
      }
      current++;
    }
  }

  onProgress?.({ current: total, total, status: 'completed', summary: { ...summary } });
  return createSuccessResult({ ...summary });
};
