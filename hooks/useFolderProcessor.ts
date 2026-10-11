import { useState, useCallback, useRef, useEffect } from 'react';
import type {
    DateLogic,
    Folder,
    FolderFileGroup,
    PhotoProcessingRequest,
    PhotoProcessorMessage,
    SkippedFile,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ErrorType, ErrorSeverity, handleError } from '../utils/errorHandler';
import { isSupportedImageFileName } from '../utils/typeGuards';
import { applyNameDraft } from '../utils/nameDrafts';

type ProcessorStatus = 'idle' | 'processing' | 'done' | 'error';
export type { DateLogic };

export interface ProcessingProgressState {
    processedFolders: number;
    totalFolders: number;
    processedFiles: number;
    totalFiles: number;
    phase: string;
}

const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
    });
};

// readEntries returns entries in batches and an empty array once exhausted.
const readAllEntries = async (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
    const allEntries: FileSystemEntry[] = [];
    let currentEntries: FileSystemEntry[];
    do {
        currentEntries = await readEntries(reader);
        allEntries.push(...currentEntries);
    } while (currentEntries.length > 0);
    return allEntries;
};

const getFile = (entry: FileSystemFileEntry): Promise<File> => {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
};

// Oldest first; folders without any date go last.
const sortFoldersByDate = (folders: Folder[]): Folder[] =>
    [...folders].sort((a, b) => {
        if (!a.representativeDate) return 1;
        if (!b.representativeDate) return -1;
        return a.representativeDate.getTime() - b.representativeDate.getTime();
    });

export const useFolderProcessor = () => {
    const { t } = useLanguage();
    // Scans and worker messages resolve asynchronously. Reading the translator
    // through a ref lets the language change mid-run without restarting work.
    const tRef = useRef(t);
    useEffect(() => {
        tRef.current = t;
    }, [t]);

    const [status, setStatus] = useState<ProcessorStatus>('idle');
    const [folders, setFolders] = useState<Folder[]>([]);
    const [skippedFiles, setSkippedFiles] = useState<SkippedFile[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [processingMessage, setProcessingMessage] = useState('');
    const [rootFolderName, setRootFolderName] = useState('');
    const [progress, setProgress] = useState<ProcessingProgressState | null>(null);
    // Number of folder names restored from an earlier session (0 = none).
    const [restoredNameCount, setRestoredNameCount] = useState(0);

    const workerRef = useRef<Worker | null>(null);
    // Bumped by every new run, cancel and reset. Scans and worker messages
    // that belong to an older run see a different id and are dropped.
    const runIdRef = useRef(0);
    const rootNameRef = useRef('');

    const stopWorker = useCallback(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
    }, []);

    useEffect(() => () => {
        runIdRef.current += 1;
        stopWorker();
    }, [stopWorker]);

    const fail = useCallback((message: string) => {
        setError(message);
        setStatus('error');
        setProgress(null);
    }, []);

    const beginRun = useCallback((rootName: string): number => {
        stopWorker();
        runIdRef.current += 1;
        setStatus('processing');
        setError(null);
        rootNameRef.current = rootName;
        setRootFolderName(rootName);
        setRestoredNameCount(0);
        setProcessingMessage(tRef.current('scanningFolder', { folderName: rootName }));
        setProgress(null);
        setFolders([]);
        setSkippedFiles([]);
        return runIdRef.current;
    }, [stopWorker]);

    const handleWorkerMessage = useCallback((message: PhotoProcessorMessage) => {
        switch (message.type) {
            case 'start':
                setProgress({
                    processedFolders: 0,
                    totalFolders: message.payload.totalFolders,
                    processedFiles: 0,
                    totalFiles: message.payload.totalFiles,
                    phase: message.payload.phase || 'processing'
                });
                break;
            case 'progress': {
                const { payload } = message;
                setProgress({
                    processedFolders: payload.processedFolders,
                    totalFolders: payload.totalFolders,
                    processedFiles: payload.processedFiles,
                    totalFiles: payload.totalFiles,
                    phase: payload.phase,
                });
                setProcessingMessage(tRef.current('processingFolderMessage', {
                    folderProgress: `${payload.processedFolders}/${payload.totalFolders}`,
                    fileProgress: `${payload.processedFiles}/${payload.totalFiles}`,
                    folderName: payload.currentFolderName
                }));
                break;
            }
            case 'file-progress':
                setProgress(prev => prev ? {
                    ...prev,
                    processedFiles: message.payload.processedFiles
                } : null);
                break;
            case 'done': {
                // Previews are Blobs (not worker-owned URLs), so the worker can go.
                stopWorker();
                setSkippedFiles(message.skippedFiles ? [...message.skippedFiles] : []);
                if (message.payload.length === 0) {
                    fail(tRef.current('errorNoImages'));
                    return;
                }

                const processedFolders: Folder[] = message.payload.map(folder => ({
                    id: folder.id,
                    originalName: folder.originalName,
                    photos: folder.photos,
                    representativeDate: folder.representativeDate,
                    dateIsEstimated: folder.dateIsEstimated,
                    newName: '',
                    isRenamed: false,
                }));

                const restored = applyNameDraft(
                    rootNameRef.current,
                    sortFoldersByDate(processedFolders),
                    tRef.current('unknownDate')
                );
                setFolders(restored.folders);
                setRestoredNameCount(restored.restoredCount);
                setStatus('done');
                setProgress(null);
                break;
            }
            case 'error': {
                stopWorker();
                const appError = handleError(
                    message.error || 'Worker error',
                    ErrorType.WORKER_ERROR,
                    ErrorSeverity.HIGH,
                    { workerError: true },
                    { notify: false }
                );
                fail(appError.userMessage);
                break;
            }
        }
    }, [fail, stopWorker]);

    const startWorker = useCallback((runId: number, request: PhotoProcessingRequest) => {
        const worker = new Worker(new URL('./photoProcessor.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<PhotoProcessorMessage>) => {
            if (runId === runIdRef.current) {
                handleWorkerMessage(event.data);
            }
        };
        // A crash inside the worker (uncaught exception, out of memory) never
        // posts an 'error' message; without this the spinner would never end.
        worker.onerror = (event: ErrorEvent) => {
            event.preventDefault();
            if (runId !== runIdRef.current) return;
            stopWorker();
            const appError = handleError(
                event.message || 'Worker crashed',
                ErrorType.WORKER_ERROR,
                ErrorSeverity.HIGH,
                { workerCrash: true },
                { notify: false }
            );
            fail(appError.userMessage);
        };

        worker.postMessage(request);
    }, [fail, handleWorkerMessage, stopWorker]);

    const processDirectory = useCallback(async (directoryEntry: FileSystemDirectoryEntry, dateLogic: DateLogic) => {
        const runId = beginRun(directoryEntry.name);
        const isCurrentRun = () => runId === runIdRef.current;

        try {
            const entries = await readAllEntries(directoryEntry.createReader());
            if (!isCurrentRun()) return;

            const subDirectories = entries.filter(entry => entry.isDirectory) as FileSystemDirectoryEntry[];
            if (subDirectories.length === 0) {
                fail(tRef.current('errorNoSubFolders'));
                return;
            }

            setProcessingMessage(tRef.current('gatheringFiles'));

            const groups = await Promise.all(subDirectories.map(async (subDir): Promise<FolderFileGroup | null> => {
                const photoEntries = (await readAllEntries(subDir.createReader())).filter(entry =>
                    entry.isFile && isSupportedImageFileName(entry.name)
                ) as FileSystemFileEntry[];
                if (photoEntries.length === 0) return null;

                return {
                    originalName: subDir.name,
                    id: subDir.fullPath,
                    files: await Promise.all(photoEntries.map(getFile)),
                };
            }));
            if (!isCurrentRun()) return;

            const folderFileGroups = groups.filter((group): group is FolderFileGroup => group !== null);
            if (folderFileGroups.length === 0) {
                fail(tRef.current('errorNoImages'));
                return;
            }

            startWorker(runId, { folderFileGroups, dateLogic });
        } catch (e) {
            if (!isCurrentRun()) return;
            const appError = handleError(
                e instanceof Error ? e : String(e),
                ErrorType.PROCESSING_FAILED,
                ErrorSeverity.HIGH,
                { operation: 'processDirectory' },
                { notify: false }
            );
            fail(appError.userMessage);
        }
    }, [beginRun, fail, startWorker]);

    // Fallback ingestion for <input webkitdirectory>. The picker returns a flat
    // FileList where webkitRelativePath is "root/subfolder/file.ext"; mirror the
    // drag & drop scan by grouping images by their immediate subfolder (one
    // level deep — files directly in the root or nested deeper are ignored).
    const processFileList = useCallback((files: File[], dateLogic: DateLogic) => {
        const rootName = files[0]?.webkitRelativePath.split('/')[0] ?? '';
        const runId = beginRun(rootName);

        let hasSubFolders = false;
        const groups = new Map<string, File[]>();
        for (const file of files) {
            const segments = file.webkitRelativePath.split('/');
            if (segments.length >= 3) hasSubFolders = true;
            if (segments.length !== 3 || !isSupportedImageFileName(file.name)) continue;
            const subFolderName = segments[1];
            const group = groups.get(subFolderName);
            if (group) {
                group.push(file);
            } else {
                groups.set(subFolderName, [file]);
            }
        }

        if (!hasSubFolders) {
            fail(tRef.current('errorNoSubFolders'));
            return;
        }
        if (groups.size === 0) {
            fail(tRef.current('errorNoImages'));
            return;
        }

        const folderFileGroups = Array.from(groups, ([name, groupFiles]) => ({
            originalName: name,
            id: `/${rootName}/${name}`,
            files: groupFiles,
        }));

        startWorker(runId, { folderFileGroups, dateLogic });
    }, [beginRun, fail, startWorker]);

    // Stops the current scan/worker and returns to the start screen.
    const cancel = useCallback(() => {
        runIdRef.current += 1;
        stopWorker();
        setStatus('idle');
        setProgress(null);
        setProcessingMessage('');
    }, [stopWorker]);

    const dismissRestoredNotice = useCallback(() => setRestoredNameCount(0), []);

    const reset = useCallback(() => {
        cancel();
        setFolders([]);
        setSkippedFiles([]);
        setError(null);
        setRootFolderName('');
        setRestoredNameCount(0);
    }, [cancel]);

    return {
        status,
        folders,
        setFolders,
        skippedFiles,
        error,
        processingMessage,
        rootFolderName,
        progress,
        restoredNameCount,
        dismissRestoredNotice,
        processDirectory,
        processFileList,
        cancel,
        reset,
        setFailure: fail,
    };
};
