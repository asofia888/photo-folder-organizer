// Branded strings returned by the validators in utils/typeGuards.ts.
export type ValidFileName = string & { readonly __brand: unique symbol };
export type ValidFolderName = string & { readonly __brand: unique symbol };

// Which photo date represents a folder.
export type DateLogic = 'earliest' | 'latest';

// Supported RAW file extensions
export const RAW_EXTENSIONS = [
  'cr2', 'cr3',        // Canon
  'nef', 'nrw',        // Nikon
  'arw', 'srf', 'sr2', // Sony
  'dng',               // Adobe
  'raf',               // Fujifilm
  'orf',               // Olympus
  'rw2',               // Panasonic
  'pef',               // Pentax
  'srw',               // Samsung
  'x3f',               // Sigma
  'kdc',               // Kodak
  'dcr',               // Kodak
  'mrw',               // Minolta
  '3fr',               // Hasselblad
  'fff',               // Imacon
  'iiq',               // Phase One
  'rwl'                // Leica
] as const;

// Standard (non-RAW) image extensions. Single source of truth for the folder
// scanners (drag & drop and the folder picker).
export const STANDARD_IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'bmp', 'tif', 'tiff'
] as const;

export interface Photo {
  readonly id: string;
  // ISO timestamp of the date used for this photo ('' when it has none).
  readonly date: string;
  readonly file?: File;
  readonly isRaw?: boolean;
  // Embedded JPEG preview extracted by the worker (RAW files). Kept as a Blob
  // so it outlives the worker; components turn it into an object URL.
  readonly thumbnail?: Blob;
}

export interface Folder {
  readonly id: string;
  readonly originalName: string;
  readonly photos: readonly Photo[];
  readonly representativeDate: Date | null;
  // True when no photo had an EXIF date and the date comes from file
  // modification times instead.
  readonly dateIsEstimated?: boolean;
  newName: string;
  isRenamed: boolean;
}

// Messages between useFolderProcessor and photoProcessor.worker.
export interface FolderFileGroup {
  readonly originalName: string;
  readonly id: string;
  readonly files: readonly File[];
}

export interface PhotoProcessingRequest {
  readonly folderFileGroups: readonly FolderFileGroup[];
  readonly dateLogic: DateLogic;
}

export interface ProcessedFolder {
  readonly id: string;
  readonly originalName: string;
  readonly photos: readonly Photo[];
  readonly representativeDate: Date | null;
  readonly dateIsEstimated: boolean;
}

export type PhotoProcessorMessage =
  | {
      readonly type: 'start';
      readonly payload: { totalFolders: number; totalFiles: number; phase: 'processing' };
    }
  | {
      readonly type: 'progress';
      readonly payload: {
        processedFolders: number;
        totalFolders: number;
        processedFiles: number;
        totalFiles: number;
        currentFolderName: string;
        phase: 'processing';
      };
    }
  | { readonly type: 'file-progress'; readonly payload: { processedFiles: number; totalFiles: number } }
  | { readonly type: 'done'; readonly payload: readonly ProcessedFolder[]; readonly skippedFiles?: readonly SkippedFile[] }
  | { readonly type: 'error'; readonly error: string };

// A file the worker dropped from the results, reported to the user on completion
export interface SkippedFile {
  readonly folderName: string;
  readonly fileName: string;
  readonly reason: 'tooLarge' | 'unreadable';
}

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
