
import { useState, useCallback, useRef, useEffect } from 'react';
import { Folder, Photo } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import MemoryManager from '../utils/memoryManager';
import { ErrorType, ErrorSeverity, handleError } from '../utils/errorHandler';

type ProcessorStatus = 'idle' | 'processing' | 'done' | 'error';
export type DateLogic = 'earliest' | 'latest';

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
        
        workerRef.current = new Worker(new URL('./photoProcessor.worker.ts', import.meta.url), { type: 'module' });

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

        let folderFileGroups: { originalName: string; id: string; files: File[] }[] = [];

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

                const photoEntries = photoEntriesRaw.filter(entry => 
                    entry.isFile && 
                    entry.name.match(/\.(jpg|jpeg|png|heic|webp|gif|bmp|tiff|cr2|cr3|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|pef|srw|x3f|kdc|dcr|mrw|3fr|fff|iiq|rwl)$/i)
                ) as FileSystemFileEntry[];
                if (photoEntries.length === 0) return null;

                const files = await Promise.all(photoEntries.map(getFile));

                return {
                    originalName: subDir.name,
                    id: subDir.fullPath,
                    files,
                };
            });

            const folderFileGroupsWithNulls = await Promise.all(folderFileGroupsPromises);
            folderFileGroups = folderFileGroupsWithNulls.filter((g): g is NonNullable<typeof g> => g !== null);


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
                folderCount: folderFileGroups.length,
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