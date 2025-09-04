
import { useState, useCallback, useRef, useEffect } from 'react';
import { Folder, Photo } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import MemoryManager from '../utils/memoryManager';
import { ErrorType, ErrorSeverity, handleError } from '../utils/errorHandler';

type ProcessorStatus = 'idle' | 'processing' | 'done' | 'error';
export type DateLogic = 'earliest' | 'latest';

const workerScript = `
// In-memory worker for processing photo data without blocking the main thread.
import exifr from 'https://esm.sh/exifr@^7.1.3';

const FILE_SIZE_LIMITS = {
    SKIP: 100 * 1024 * 1024,     // 100MB - Skip completely
    WARNING: 50 * 1024 * 1024,   // 50MB - Process but warn
    OPTIMAL: 20 * 1024 * 1024    // 20MB - Optimal processing
};

const BATCH_SIZE = 8; // Process files in batches to reduce memory pressure

self.onmessage = async (e) => {
    try {
        const { folderFileGroups, dateLogic } = e.data;
        const allProcessedFolders = [];
        const totalFolders = folderFileGroups.length;
        let totalFiles = folderFileGroups.reduce((sum, group) => sum + group.files.length, 0);
        let processedFiles = 0;

        self.postMessage({ 
            type: 'start', 
            payload: { 
                totalFolders, 
                totalFiles,
                phase: 'processing'
            } 
        });

        for (let i = 0; i < folderFileGroups.length; i++) {
            const group = folderFileGroups[i];
            
            if (group.files.length === 0) continue;

            // Filter files by size before processing
            const validFiles = group.files.filter(file => {
                if (file.size > FILE_SIZE_LIMITS.SKIP) {
                    console.warn('Skipping large file:', file.name, 'Size:', Math.round(file.size / 1024 / 1024) + 'MB');
                    return false;
                }
                return true;
            });

            if (validFiles.length === 0) {
                processedFiles += group.files.length;
                continue;
            }

            self.postMessage({ 
                type: 'progress', 
                payload: { 
                    processedFolders: i + 1, 
                    totalFolders, 
                    processedFiles,
                    totalFiles,
                    currentFolderName: group.originalName,
                    phase: 'processing',
                    memoryUsage: self.performance?.memory?.usedJSHeapSize || 0
                }
            });

            // Process files in batches to reduce memory pressure
            const photoResults = [];
            
            for (let batchStart = 0; batchStart < validFiles.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, validFiles.length);
                const batch = validFiles.slice(batchStart, batchEnd);
                
                const batchPromises = batch.map(async (file) => {
                    try {
                        let date = null;
                        try {
                            const exifData = await exifr.parse(file, { 
                                pick: ['DateTimeOriginal', 'CreateDate'],
                                translateKeys: false,
                                reviveValues: false // Reduce memory usage
                            });
                            date = exifData?.DateTimeOriginal || exifData?.CreateDate || null;
                        } catch (exifError) {
                            // Expected for non-image files or files without EXIF
                        }
                        
                        return { id: file.name + file.lastModified, date, file };
                    } catch (fileError) {
                        console.error('Error processing file in worker:', file.name, fileError);
                        return null;
                    }
                });
                
                const batchResults = (await Promise.all(batchPromises)).filter(p => p !== null);
                photoResults.push(...batchResults);
                processedFiles += batch.length;
                
                // Send progress update for file-level progress
                self.postMessage({ 
                    type: 'file-progress', 
                    payload: { 
                        processedFiles,
                        totalFiles,
                        currentFolder: group.originalName,
                        batchProgress: batchEnd / validFiles.length
                    }
                });
                
                // Small delay to prevent blocking
                if (batchStart % (BATCH_SIZE * 3) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }

            if (photoResults.length === 0) continue;
            
            const validDates = photoResults.map(p => p.date).filter(d => d instanceof Date);
            
            let representativeDate = null;
            if (validDates.length > 0) {
                representativeDate = new Date(Math[dateLogic === 'earliest' ? 'min' : 'max'](...validDates.map(d => d.getTime())));
            }

            const photos = photoResults.map(p => ({
                id: p.id,
                date: p.date?.toISOString() ?? '',
                file: p.file,
            }));

            allProcessedFolders.push({
                id: group.id,
                originalName: group.originalName,
                photos,
                representativeDate,
                newName: '',
                isRenamed: false,
            });
        }

        self.postMessage({ type: 'done', payload: allProcessedFolders });
    } catch (workerError) {
        console.error('Unhandled error in worker:', workerError);
        self.postMessage({ type: 'error', error: workerError.message || 'An unknown error occurred in the background processor.' });
    }
};
`;

const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
    });
};

const getFile = (entry: FileSystemFileEntry): Promise<File> => {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
};

export const useFolderProcessor = () => {
    const { t } = useLanguage();
    const [status, setStatus] = useState<ProcessorStatus>('idle');
    const [folders, setFolders] = useState<Folder[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [processingMessage, setProcessingMessage] = useState('');
    const [rootFolderName, setRootFolderName] = useState('');
    const [progress, setProgress] = useState<{ 
        processedFolders: number; 
        totalFolders: number;
        processedFiles: number;
        totalFiles: number;
        phase: string;
        memoryUsage?: number;
    } | null>(null);
    const objectUrls = useRef<string[]>([]);
    const workerRef = useRef<Worker | null>(null);
    const memoryManager = useRef(MemoryManager.getInstance());
    
    const cleanup = useCallback(() => {
        objectUrls.current.forEach(URL.revokeObjectURL);
        objectUrls.current = [];
        // Also cleanup any memory references
        if (typeof global !== 'undefined' && global.gc) {
            global.gc();
        }
    }, []);

    useEffect(() => {
        // Start memory monitoring
        memoryManager.current.startMonitoring(5000);
        
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        workerRef.current = new Worker(workerUrl, { type: 'module' });

        const handleMessage = (event: MessageEvent) => {
            const { type, payload, error } = event.data;

            switch(type) {
                case 'start':
                    setProgress({ 
                        processedFolders: 0, 
                        totalFolders: payload.totalFolders,
                        processedFiles: 0,
                        totalFiles: payload.totalFiles,
                        phase: payload.phase || 'processing'
                    });
                    break;
                case 'progress':
                    setProgress(payload);
                    const folderProgress = `${payload.processedFolders}/${payload.totalFolders}`;
                    const fileProgress = `${payload.processedFiles}/${payload.totalFiles}`;
                    setProcessingMessage(`Processing folder ${folderProgress} (${fileProgress} files) - ${payload.currentFolderName}`);
                    break;
                case 'file-progress':
                    // Update file-level progress without changing folder message
                    setProgress(prev => prev ? {
                        ...prev,
                        processedFiles: payload.processedFiles
                    } : null);
                    break;
                case 'done':
                    if (payload.length === 0) {
                        setError(t('errorNoImages'));
                        setStatus('error');
                        return;
                    }

                    setProcessingMessage('Creating thumbnails...');
                    setProgress(prev => prev ? { ...prev, phase: 'rendering' } : null);
                    
                    // Don't create object URLs immediately - do it lazily when needed
                    const foldersWithoutUrls = payload.map((folder: any) => ({
                        ...folder,
                        photos: folder.photos.map((photo: any) => ({
                            ...photo,
                            url: null // Will be created lazily
                        }))
                    }));

                    const sortedFolders = foldersWithoutUrls.sort((a: Folder, b: Folder) => {
                        if (!a.representativeDate) return 1;
                        if (!b.representativeDate) return -1;
                        return new Date(a.representativeDate).getTime() - new Date(b.representativeDate).getTime();
                    });

                    setFolders(sortedFolders);
                    setStatus('done');
                    setProgress(null);
                    break;
                case 'error':
                    const appError = handleError(error || 'Worker error', ErrorType.WORKER_ERROR, ErrorSeverity.HIGH, {
                        workerError: true
                    });
                    setError(appError.userMessage);
                    setStatus('error');
                    setProgress(null);
                    break;
            }
        };

        workerRef.current.onmessage = handleMessage;
        
        return () => {
            workerRef.current?.terminate();
            URL.revokeObjectURL(workerUrl);
            memoryManager.current.stopMonitoring();
            cleanup();
        };
    }, [t, cleanup]);

    const processDirectory = useCallback(async (directoryEntry: FileSystemDirectoryEntry, dateLogic: DateLogic) => {
        cleanup();
        setStatus('processing');
        setError(null);
        setRootFolderName(directoryEntry.name);
        setProcessingMessage(t('scanningFolder', { folderName: directoryEntry.name }));
        setProgress(null);
        setFolders([]);

        try {
            const readAllEntries = async (dirReader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
                let allEntries: FileSystemEntry[] = [];
                let currentEntries: FileSystemEntry[];
                do {
                    currentEntries = await readEntries(dirReader);
                    allEntries.push(...currentEntries);
                } while (currentEntries.length > 0);
                return allEntries;
            };

            const reader = directoryEntry.createReader();
            const entries = await readAllEntries(reader);
            const subDirectories = entries.filter(entry => entry.isDirectory) as FileSystemDirectoryEntry[];

            if (subDirectories.length === 0) {
                const error = new Error(t('errorNoSubFolders'));
                handleError(error, ErrorType.DIRECTORY_NOT_FOUND, ErrorSeverity.MEDIUM, {
                    directoryName: directoryEntry.name,
                    entriesFound: entries.length
                });
                throw error;
            }
            
            setProcessingMessage('Gathering files to process...');
            
            const folderFileGroupsPromises = subDirectories.map(async (subDir) => {
                const subDirReader = subDir.createReader();
                const photoEntriesRaw = await readAllEntries(subDirReader);

                const photoEntries = photoEntriesRaw.filter(entry => entry.isFile && (entry.name.match(/\.(jpg|jpeg|png|heic|webp)$/i))) as FileSystemFileEntry[];
                if (photoEntries.length === 0) return null;

                const files = await Promise.all(photoEntries.map(getFile));

                return {
                    originalName: subDir.name,
                    id: subDir.fullPath,
                    files,
                };
            });

            const folderFileGroupsWithNulls = await Promise.all(folderFileGroupsPromises);
            const folderFileGroups = folderFileGroupsWithNulls.filter((g): g is NonNullable<typeof g> => g !== null);


            if (folderFileGroups.length === 0) {
                const error = new Error(t('errorNoImages'));
                handleError(error, ErrorType.INVALID_FILE_FORMAT, ErrorSeverity.MEDIUM, {
                    subDirectories: subDirectories.length,
                    validGroups: folderFileGroups.length
                });
                throw error;
            }

            workerRef.current?.postMessage({ folderFileGroups, dateLogic });

        } catch (e: any) {
            const appError = handleError(e, ErrorType.PROCESSING_FAILED, ErrorSeverity.HIGH, {
                folderCount: folderFileGroups?.length || 0,
                operation: 'processDirectory'
            });
            setError(appError.userMessage);
            setStatus('error');
        }
    }, [t, cleanup]);
    
    const reset = useCallback(() => {
        cleanup();
        setStatus('idle');
        setFolders([]);
        setError(null);
        setProcessingMessage('');
        setRootFolderName('');
        setProgress(null);
    }, [cleanup]);

    const setFailure = useCallback((message: string) => {
        setError(message);
        setStatus('error');
    }, []);

    return {
        status,
        folders,
        setFolders,
        error,
        processingMessage,
        rootFolderName,
        progress,
        processDirectory,
        reset,
        cleanup,
        setFailure,
    };
};