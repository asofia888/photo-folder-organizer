
import { useState, useCallback, useRef, useEffect } from 'react';
import { Folder, Photo } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

type ProcessorStatus = 'idle' | 'processing' | 'done' | 'error';
export type DateLogic = 'earliest' | 'latest';

const workerScript = `
// In-memory worker for processing photo data without blocking the main thread.
import exifr from 'https://esm.sh/exifr@^7.1.3';

self.onmessage = async (e) => {
    try {
        const { folderFileGroups, dateLogic } = e.data;
        const allProcessedFolders = [];
        const totalFolders = folderFileGroups.length;

        self.postMessage({ type: 'start', payload: { total: totalFolders } });

        for (let i = 0; i < folderFileGroups.length; i++) {
            const group = folderFileGroups[i];
            
            self.postMessage({ 
                type: 'progress', 
                payload: { 
                    processed: i + 1, 
                    total: totalFolders, 
                    currentFolderName: group.originalName 
                }
            });
            
            if (group.files.length === 0) continue;

            const photoProcessingPromises = group.files.map(async (file) => {
                try {
                    if (file.size > 20 * 1024 * 1024) return null; // Skip large files that might hang parser

                    let date = null;
                    try {
                        const exifData = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] });
                        date = exifData?.DateTimeOriginal || exifData?.CreateDate || null;
                    } catch (exifError) {
                        // This is expected for non-image files or images without EXIF data
                    }
                    
                    return { id: file.name + file.lastModified, date, file };
                } catch (fileError) {
                    console.error('Error processing file in worker:', file.name, fileError);
                    return null;
                }
            });
            
            const photoResults = (await Promise.all(photoProcessingPromises)).filter(p => p !== null);

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
    const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
    const objectUrls = useRef<string[]>([]);
    const workerRef = useRef<Worker | null>(null);
    
    const cleanup = useCallback(() => {
        objectUrls.current.forEach(URL.revokeObjectURL);
        objectUrls.current = [];
    }, []);

    useEffect(() => {
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        workerRef.current = new Worker(workerUrl, { type: 'module' });

        const handleMessage = (event: MessageEvent) => {
            const { type, payload, error } = event.data;

            switch(type) {
                case 'start':
                    setProgress({ processed: 0, total: payload.total });
                    break;
                case 'progress':
                    setProgress(payload);
                    setProcessingMessage(t('processingSubFolder', { index: payload.processed, total: payload.total, subDirName: payload.currentFolderName }));
                    break;
                case 'done':
                    if (payload.length === 0) {
                        setError(t('errorNoImages'));
                        setStatus('error');
                        return;
                    }

                    // Create object URLs on the main thread
                    const foldersWithUrls = payload.map((folder: any) => ({
                        ...folder,
                        photos: folder.photos.map((photo: any) => {
                            const objectUrl = URL.createObjectURL(photo.file);
                            objectUrls.current.push(objectUrl);
                            return { ...photo, url: objectUrl };
                        })
                    }));

                    const sortedFolders = foldersWithUrls.sort((a: Folder, b: Folder) => {
                        if (!a.representativeDate) return 1;
                        if (!b.representativeDate) return -1;
                        return new Date(a.representativeDate).getTime() - new Date(b.representativeDate).getTime();
                    });

                    setFolders(sortedFolders);
                    setStatus('done');
                    break;
                case 'error':
                    setError(error || t('errorUnknown'));
                    setStatus('error');
                    break;
            }
        };

        workerRef.current.onmessage = handleMessage;
        
        return () => {
            workerRef.current?.terminate();
            URL.revokeObjectURL(workerUrl);
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
                throw new Error(t('errorNoSubFolders'));
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
                throw new Error(t('errorNoImages'));
            }

            workerRef.current?.postMessage({ folderFileGroups, dateLogic });

        } catch (e: any) {
            console.error("Processing error:", e);
            setError(e.message || t('errorUnknown'));
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