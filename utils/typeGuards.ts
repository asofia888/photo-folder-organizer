import {
  ValidFileName,
  ValidFolderName,
  Result,
  RAW_EXTENSIONS,
  STANDARD_IMAGE_EXTENSIONS
} from '../types';

export const createValidFileName = (value: string): ValidFileName | null => {
  // Reject path separators, characters Windows forbids, control characters,
  // reserved device names, surrounding whitespace, and a trailing dot
  // (invalid on Windows).
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;

  if (
    value.length === 0 ||
    value.length > 255 ||
    invalidChars.test(value) ||
    reserved.test(value) ||
    value.trim() !== value ||
    value.endsWith('.')
  ) {
    return null;
  }

  return value as ValidFileName;
};

export const createValidFolderName = (value: string): ValidFolderName | null => {
  // Folder names follow the same rules as file names.
  return createValidFileName(value) ? value as ValidFolderName : null;
};

// Extension-based checks used by the folder scanners and the worker
const getFileExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1).toLowerCase();
};

export const isRawFileName = (fileName: string): boolean => {
  return (RAW_EXTENSIONS as readonly string[]).includes(getFileExtension(fileName));
};

export const isSupportedImageFileName = (fileName: string): boolean => {
  const extension = getFileExtension(fileName);
  return (
    (STANDARD_IMAGE_EXTENSIONS as readonly string[]).includes(extension) ||
    (RAW_EXTENSIONS as readonly string[]).includes(extension)
  );
};

export const createSuccessResult = <T, E = Error>(data: T): Result<T, E> => ({
  success: true as const,
  data
});

export const createErrorResult = <E extends Error>(error: E): Result<never, E> => ({
  success: false as const,
  error
});
