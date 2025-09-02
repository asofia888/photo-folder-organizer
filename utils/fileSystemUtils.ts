// File System Access API utilities for folder operations

export interface ProcessingProgress {
  current: number;
  total: number;
  status: 'preparing' | 'creating' | 'moving' | 'completed' | 'error';
  currentFile?: string;
  error?: string;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

// Check if File System Access API is supported
export const isFileSystemAccessSupported = (): boolean => {
  return 'showDirectoryPicker' in window;
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

// Create a new folder in the target directory
export const createFolder = async (
  directoryHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<FileSystemDirectoryHandle> => {
  try {
    const folderHandle = await directoryHandle.getDirectoryHandle(folderName, {
      create: true
    });
    return folderHandle;
  } catch (error) {
    throw new Error(`Failed to create folder "${folderName}": ${error}`);
  }
};

// Copy a file to a new location
const copyFile = async (
  sourceFile: File,
  targetHandle: FileSystemFileHandle
): Promise<void> => {
  const writable = await targetHandle.createWritable();
  await writable.write(sourceFile);
  await writable.close();
};

// Move files to target folder
export const moveFilesToFolder = async (
  files: File[],
  targetDirectoryHandle: FileSystemDirectoryHandle,
  onProgress?: ProgressCallback
): Promise<void> => {
  const total = files.length;
  let completed = 0;

  onProgress?.({
    current: 0,
    total,
    status: 'preparing'
  });

  for (const file of files) {
    try {
      onProgress?.({
        current: completed,
        total,
        status: 'moving',
        currentFile: file.name
      });

      // Create file handle in target directory
      const fileHandle = await targetDirectoryHandle.getFileHandle(file.name, {
        create: true
      });

      // Copy file content
      await copyFile(file, fileHandle);
      
      completed++;
      
      onProgress?.({
        current: completed,
        total,
        status: completed === total ? 'completed' : 'moving'
      });
    } catch (error) {
      onProgress?.({
        current: completed,
        total,
        status: 'error',
        currentFile: file.name,
        error: `Failed to move ${file.name}: ${error}`
      });
      throw error;
    }
  }
};

// Main function to create folder structure and organize photos
export const organizePhotosToFolders = async (
  folders: Array<{
    name: string;
    photos: File[];
  }>,
  onProgress?: ProgressCallback
): Promise<void> => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser');
  }

  try {
    // Let user select target directory
    const targetDirHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });

    const totalFiles = folders.reduce((sum, folder) => sum + folder.photos.length, 0);
    let processedFiles = 0;

    onProgress?.({
      current: 0,
      total: totalFiles,
      status: 'preparing'
    });

    // Process each folder
    for (const folder of folders) {
      onProgress?.({
        current: processedFiles,
        total: totalFiles,
        status: 'creating',
        currentFile: `Creating folder: ${folder.name}`
      });

      // Create folder
      const folderHandle = await createFolder(targetDirHandle, folder.name);

      // Move files to folder
      for (const file of folder.photos) {
        onProgress?.({
          current: processedFiles,
          total: totalFiles,
          status: 'moving',
          currentFile: file.name
        });

        const fileHandle = await folderHandle.getFileHandle(file.name, {
          create: true
        });

        await copyFile(file, fileHandle);
        processedFiles++;
      }
    }

    onProgress?.({
      current: totalFiles,
      total: totalFiles,
      status: 'completed'
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('操作がキャンセルされました');
    }
    throw new Error(`フォルダの作成中にエラーが発生しました: ${error}`);
  }
};

// Helper function to validate folder names
export const validateFolderName = (name: string): boolean => {
  // Windows/macOS/Linux compatible folder name validation
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  
  if (!name || name.trim().length === 0) return false;
  if (invalidChars.test(name)) return false;
  if (reservedNames.includes(name.toUpperCase())) return false;
  if (name.endsWith('.') || name.endsWith(' ')) return false;
  if (name.length > 255) return false;
  
  return true;
};