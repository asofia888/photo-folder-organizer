/**
 * Unified processor hook that combines both FileSystem API and webkitdirectory fallback
 */

import { useState, useCallback, useRef } from 'react';
import { Folder, Photo } from '../types';
import exifr from 'exifr';
import { useLanguage } from '../contexts/LanguageContext';
import { MemoryManager, getEarliestDate, getLatestDate, detectBrowserSupport } from '../utils';
import { analytics } from '../utils/analytics';
import React from 'react';

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

export const useUnifiedProcessor = () => {
    const { t } = useLanguage();
    const [status, setStatus] = useState<ProcessorStatus>('idle');
    const [folders, setFolders] = useState<Folder[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [processingMessage, setProcessingMessage] = useState('');
    const [rootFolderName, setRootFolderName] = useState('');
    const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
    const [history, setHistory] = useState<Folder[][]>([]);
    const memoryManager = useRef<MemoryManager>(MemoryManager.getInstance());
    const browserSupport = useRef(detectBrowserSupport());
    
    const cleanup = useCallback(() => {
        memoryManager.current.cleanup();
    }, []);

    /**
     * Process a single photo file and return photo data
     */
    const processPhotoFile = useCallback(async (file: File) => {
        try {
            if (file.size > 20 * 1024 * 1024) return null;

            let date: Date | null = null;
            try {
                const exifData = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] });
                date = exifData?.DateTimeOriginal || exifData?.CreateDate || null;
            } catch (exifError) {
                console.warn(`Could not parse EXIF for ${file.name}, proceeding without date.`);
            }
            
            // Use memory manager to create efficient thumbnail
            let thumbnailUrl = '';
            try {
                thumbnailUrl = await memoryManager.current.createThumbnailUrl(file);
            } catch (thumbError) {
                console.warn(`Could not create thumbnail for ${file.name}`);
                return null;
            }
            
            return { 
                id: file.name + file.lastModified, 
                url: thumbnailUrl, 
                date, 
                file 
            };
        } catch (fileError) {
            console.error(`Could not read file ${file.name}`, fileError);
            return null;
        }
    }, []);

    /**
     * Process folder data into final folder structure
     */
    const processFolderData = useCallback((photoResults: any[], folderName: string, dateLogic: DateLogic): Folder | null => {
        const validPhotoResults = photoResults.filter((p): p is NonNullable<typeof p> => p !== null);
        if (validPhotoResults.length === 0) return null;

        const photoDates = validPhotoResults.map(p => p.date);
        const representativeDate = dateLogic === 'earliest' 
            ? getEarliestDate(photoDates)
            : getLatestDate(photoDates);

        const photos: Photo[] = validPhotoResults.map(p => ({
            id: p.id,
            url: p.url,
            date: p.date,
            file: p.file,
        }));

        return {
            id: folderName,
            originalName: folderName,
            photos,
            representativeDate,
            newName: '',
            isRenamed: false,
        };
    }, []);

    /**
     * Process directory using FileSystem API (Chrome/Edge)
     */
    const processDirectory = useCallback(async (directoryEntry: FileSystemDirectoryEntry, dateLogic: DateLogic) => {
        const startTime = performance.now();
        cleanup();
        setStatus('processing');
        setError(null);
        setRootFolderName(directoryEntry.name);
        setProcessingMessage(t('scanningFolder', { folderName: directoryEntry.name }));
        setProgress(null);
        setFolders([]);
        
        analytics.trackEvent('processing_start', { folderName: directoryEntry.name, dateLogic });

        try {
            const reader = directoryEntry.createReader();
            const entries = await readEntries(reader);
            const subDirectories = entries.filter(entry => entry.isDirectory) as FileSystemDirectoryEntry[];

            if (subDirectories.length === 0) {
                throw new Error(t('errorNoSubFolders'));
            }
            
            const totalFolders = subDirectories.length;
            setProgress({ processed: 0, total: totalFolders });

            let processedCount = 0;
            const allProcessedFolders: Folder[] = [];
            
            for (const subDir of subDirectories) {
                setProcessingMessage(t('processingSubFolder', { 
                    index: processedCount + 1, 
                    total: totalFolders, 
                    subDirName: subDir.name 
                }));

                const subDirReader = subDir.createReader();
                const photoEntries = (await readEntries(subDirReader))
                    .filter(entry => entry.isFile && (entry.name.match(/\.(jpg|jpeg|png|heic|webp)$/i))) as FileSystemFileEntry[];
                
                processedCount++;
                setProgress({ processed: processedCount, total: totalFolders });

                if (photoEntries.length === 0) continue;

                const photoProcessingBatch = photoEntries.map(async (photoEntry) => {
                    const file = await getFile(photoEntry);
                    return await processPhotoFile(file);
                });
                
                const photoResults = await memoryManager.current.processImageBatch(
                    photoProcessingBatch,
                    (promise) => promise,
                    5
                );
                
                const folder = processFolderData(photoResults, subDir.name, dateLogic);
                if (folder) {
                    allProcessedFolders.push(folder);
                }
            }

            const sortedFolders = allProcessedFolders.sort((a, b) => {
                if (!a.representativeDate && !b.representativeDate) return 0;
                if (!a.representativeDate) return 1;
                if (!b.representativeDate) return -1;
                return a.representativeDate.getTime() - b.representativeDate.getTime();
            });

            if (sortedFolders.length === 0) {
                throw new Error(t('errorNoImages'));
            }

            setFolders(sortedFolders);
            setStatus('done');
            
            const processingTime = performance.now() - startTime;
            analytics.trackFolderProcessingComplete(processingTime, sortedFolders.length, 0);

        } catch (e: any) {
            console.error("Processing error:", e);
            analytics.trackError('processing_failed', e.message || 'Unknown error', { dateLogic });
            setError(e.message || t('errorUnknown'));
            setStatus('error');
        }
    }, [t, cleanup, processPhotoFile, processFolderData]);

    /**
     * Process files from webkitdirectory input (Safari/Firefox fallback)
     */
    const processFilesFromInput = useCallback(async (files: FileList, dateLogic: DateLogic) => {
        const startTime = performance.now();
        cleanup();
        setStatus('processing');
        setError(null);
        setRootFolderName('Selected Photos');
        setProcessingMessage(t('processingFiles'));
        setProgress(null);
        setFolders([]);

        try {
            // Group files by directory path
            const folderMap = new Map<string, File[]>();
            
            Array.from(files).forEach(file => {
                const pathParts = file.webkitRelativePath.split('/');
                if (pathParts.length > 1) {
                    const folderName = pathParts[pathParts.length - 2];
                    if (!folderMap.has(folderName)) {
                        folderMap.set(folderName, []);
                    }
                    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|webp)$/i.test(file.name)) {
                        folderMap.get(folderName)!.push(file);
                    }
                }
            });

            if (folderMap.size === 0) {
                throw new Error(t('errorNoSubFolders'));
            }

            const totalFolders = folderMap.size;
            setProgress({ processed: 0, total: totalFolders });

            let processedCount = 0;
            const allProcessedFolders: Folder[] = [];

            for (const [folderName, folderFiles] of folderMap) {
                setProcessingMessage(t('processingSubFolder', { 
                    index: processedCount + 1, 
                    total: totalFolders, 
                    subDirName: folderName 
                }));

                processedCount++;
                setProgress({ processed: processedCount, total: totalFolders });

                if (folderFiles.length === 0) continue;

                const photoProcessingBatch = folderFiles.map(file => processPhotoFile(file));
                const photoResults = await memoryManager.current.processImageBatch(
                    photoProcessingBatch,
                    (promise) => promise,
                    5
                );
                
                const folder = processFolderData(photoResults, folderName, dateLogic);
                if (folder) {
                    allProcessedFolders.push(folder);
                }
            }

            const sortedFolders = allProcessedFolders.sort((a, b) => {
                if (!a.representativeDate && !b.representativeDate) return 0;
                if (!a.representativeDate) return 1;
                if (!b.representativeDate) return -1;
                return a.representativeDate.getTime() - b.representativeDate.getTime();
            });

            if (sortedFolders.length === 0) {
                throw new Error(t('errorNoImages'));
            }

            setFolders(sortedFolders);
            setStatus('done');
            
            const processingTime = performance.now() - startTime;
            analytics.trackFolderProcessingComplete(processingTime, sortedFolders.length, 0);

        } catch (e: any) {
            console.error("Processing error:", e);
            analytics.trackError('processing_failed', e.message || 'Unknown error', { dateLogic });
            setError(e.message || t('errorUnknown'));
            setStatus('error');
        }
    }, [t, cleanup, processPhotoFile, processFolderData]);

    // History management
    const pushHistory = useCallback((foldersSnapshot: Folder[]) => {
        setHistory(prev => [...prev, foldersSnapshot.map(f => ({ ...f, photos: [...f.photos] }))]);
    }, []);

    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const newHistory = prev.slice(0, -1);
            const prevFolders = prev[prev.length - 1];
            setFolders(prevFolders || []);
            return newHistory;
        });
    }, []);

    const setFoldersWithHistory = useCallback((updater: React.SetStateAction<Folder[]>) => {
        pushHistory(folders);
        setFolders(updater);
    }, [folders, pushHistory]);

    const reset = useCallback(() => {
        cleanup();
        setStatus('idle');
        setFolders([]);
        setError(null);
        setProcessingMessage('');
        setRootFolderName('');
        setProgress(null);
        setHistory([]);
    }, [cleanup]);

    const setFailure = useCallback((message: string) => {
        setError(message);
        setStatus('error');
    }, []);

    return {
        status,
        folders,
        setFolders: setFoldersWithHistory,
        error,
        processingMessage,
        rootFolderName,
        progress,
        processDirectory,
        processFilesFromInput,
        browserSupport: browserSupport.current,
        reset,
        cleanup,
        setFailure,
        undo,
        canUndo: history.length > 0,
    };
};