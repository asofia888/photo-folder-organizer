
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import FolderCard from './FolderCard';
import Spinner from './Spinner';
import ProgressModal from './ProgressModal';
import PerformanceMonitor from './PerformanceMonitor';
import { FolderArrowDownIcon, ArrowPathIcon, CodeBracketIcon, SaveIcon, ComputerDesktopIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useFolderProcessor, DateLogic } from '../hooks/useFolderProcessor';
import {
    organizePhotosToFolders,
    isFileSystemAccessSupported,
    pickTargetDirectory,
    toFileSystemError,
    FileSystemError,
    ProcessingProgress
} from '../utils/fileSystemUtils';
import { ErrorType, ErrorSeverity, handleError } from '../utils/errorHandler';
import { buildFinalFolderName, findFolderNameIssues } from '../utils/folderNaming';
import { createRenameScript, detectScriptPlatform } from '../utils/renameScript';
import { saveNameDraft, clearNameDraft } from '../utils/nameDrafts';

// --- Component ---

const FolderOrganizer: React.FC = () => {
    const { t } = useLanguage();
    const { 
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
        setFailure
    } = useFolderProcessor();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dateLogic, setDateLogic] = useState<DateLogic>('earliest');
    const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(import.meta.env.DEV);
    
    // File System Access states
    const [isOrganizing, setIsOrganizing] = useState(false);
    const organizeAbortRef = useRef<AbortController | null>(null);
    const [organizingProgress, setOrganizingProgress] = useState<ProcessingProgress>({
        current: 0,
        total: 0,
        status: 'preparing'
    });

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        
        const items = event.dataTransfer.items;
        if (items && items.length > 0) {
            const entry = items[0].webkitGetAsEntry();
            if (entry && entry.isDirectory) {
                processDirectory(entry as FileSystemDirectoryEntry, dateLogic);
            } else {
                setFailure(t('errorDropFile'));
            }
        }
    }, [t, dateLogic, processDirectory, setFailure]);

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const openFolderPicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFolderSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            processFileList(Array.from(files), dateLogic);
        }
        // Allow re-selecting the same folder to trigger another run.
        event.target.value = '';
    }, [processFileList, dateLogic]);

    const handleNameChange = useCallback((folderId: string, newName: string) => {
        setFolders(prevFolders =>
            prevFolders.map(folder =>
                folder.id === folderId ? { ...folder, newName } : folder
            )
        );
    }, [setFolders]);

    // Keep typed names in this browser so a reload doesn't lose them.
    useEffect(() => {
        if (status === 'done' && rootFolderName) {
            saveNameDraft(rootFolderName, folders);
        }
    }, [status, rootFolderName, folders]);

    const handleDiscardRestoredNames = useCallback(() => {
        clearNameDraft(rootFolderName);
        setFolders(prevFolders => prevFolders.map(folder => ({ ...folder, newName: '', isRenamed: false })));
        dismissRestoredNotice();
    }, [rootFolderName, setFolders, dismissRestoredNotice]);

    // Leaving mid-copy would leave a half-filled destination behind.
    const isCopying = isOrganizing && (organizingProgress.status === 'preparing' || organizingProgress.status === 'copying');
    useEffect(() => {
        if (!isCopying) return;
        const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [isCopying]);

    const unknownDateLabel = t('unknownDate');
    const nameIssues = useMemo(
        () => findFolderNameIssues(folders, unknownDateLabel),
        [folders, unknownDateLabel]
    );

    // Confirms every entered name that is usable; folders whose name is
    // invalid or collides with another folder stay editable with their error.
    const handleSaveAll = useCallback(() => {
        setFolders(prevFolders => {
            const issues = findFolderNameIssues(prevFolders, unknownDateLabel);
            return prevFolders.map(folder =>
                folder.newName.trim() && !folder.isRenamed && !issues.has(folder.id)
                    ? { ...folder, isRenamed: true }
                    : folder
            );
        });
    }, [setFolders, unknownDateLabel]);
    
     const handleEditFolder = useCallback((folderId: string) => {
        setFolders(prevFolders =>
            prevFolders.map(folder =>
                folder.id === folderId
                    ? { ...folder, isRenamed: false }
                    : folder
            )
        );
    }, [setFolders]);

    const describeOrganizeError = useCallback((error: FileSystemError): string => {
        switch (error.code) {
            case 'PERMISSION_DENIED':
                return t('organizeErrorPermission');
            case 'INVALID_NAME':
                return t('organizeErrorInvalidName', { name: error.target ?? '' });
            default:
                return t('organizeErrorWrite', { name: error.target ?? '' });
        }
    }, [t]);

    const showOrganizeError = useCallback((error: FileSystemError) => {
        handleError(
            error,
            ErrorType.FILE_ACCESS_DENIED,
            ErrorSeverity.HIGH,
            { operation: 'organizePhotosToFolders', code: error.code, target: error.target },
            { notify: false }
        );
        setIsOrganizing(true);
        setOrganizingProgress(prev => ({
            ...prev,
            status: 'error',
            error: describeOrganizeError(error),
            summary: error.summary
        }));
    }, [describeOrganizeError]);

    // Copies the confirmed folders into a destination the user picks. Names
    // were validated when they were confirmed (see handleSaveAll).
    const handleOrganizeToComputer = useCallback(async () => {
        const foldersToOrganize = folders.filter(f => f.isRenamed).map(folder => ({
            name: buildFinalFolderName(folder, unknownDateLabel),
            photos: folder.photos.map(p => p.file).filter((f): f is File => !!f)
        }));
        if (foldersToOrganize.length === 0) return;

        let targetDirectory: FileSystemDirectoryHandle | null;
        try {
            targetDirectory = await pickTargetDirectory();
        } catch (error) {
            showOrganizeError(toFileSystemError(error));
            return;
        }
        // The user closed the picker: nothing happened, nothing to report.
        if (!targetDirectory) return;

        const controller = new AbortController();
        organizeAbortRef.current = controller;
        setOrganizingProgress({ current: 0, total: 0, status: 'preparing' });
        setIsOrganizing(true);

        try {
            const result = await organizePhotosToFolders(
                targetDirectory,
                foldersToOrganize,
                setOrganizingProgress,
                controller.signal
            );
            if (result.success) return; // completion was reported via progress

            if (result.error.code === 'CANCELLED') {
                setOrganizingProgress(prev => ({ ...prev, status: 'cancelled', summary: result.error.summary }));
            } else {
                showOrganizeError(result.error);
            }
        } catch (error) {
            showOrganizeError(toFileSystemError(error));
        } finally {
            organizeAbortRef.current = null;
        }
    }, [folders, unknownDateLabel, showOrganizeError]);

    const handleCancelOrganize = useCallback(() => {
        organizeAbortRef.current?.abort();
    }, []);

    const handleCloseProgressModal = useCallback(() => {
        setIsOrganizing(false);
        setOrganizingProgress({ current: 0, total: 0, status: 'preparing' });
    }, []);

    const handleGenerateScript = () => {
        const operations = folders
            .filter(folder => folder.isRenamed && folder.newName.trim())
            .map(folder => ({
                from: folder.originalName,
                to: buildFinalFolderName(folder, unknownDateLabel),
            }))
            .filter(operation => operation.from !== operation.to);
        const { content, filename } = createRenameScript(operations, detectScriptPlatform());
        const blob = new Blob([content], { type: 'text/plain' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    if (status === 'idle' || status === 'error') {
        return (
            <div className="text-center p-4 sm:p-8">
                <div className="mb-10 max-w-3xl lg:max-w-5xl mx-auto">
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gradient tracking-tight lg:whitespace-nowrap">{t('catchphraseMain')}</h2>
                    <p className="mt-4 text-lg text-slate-300">{t('catchphraseSub')}</p>
                    <p className="mt-2 text-sm text-green-400 font-medium">{t('privacyDescription')}</p>
                </div>

                <div className="p-8 sm:p-10 bg-slate-800/50 rounded-2xl border border-slate-700/80">
                     {status === 'error' && error && (
                        <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-left">
                            <h2 className="text-lg font-semibold text-red-300">{t('errorOccurred')}</h2>
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}
                    {/* Kept outside the drop zone: a programmatic click() on a child
                        input would bubble back to the zone's onClick and reopen the
                        picker. webkitdirectory is not in React's TS prop types, so
                        it is passed via spread. */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        aria-hidden="true"
                        tabIndex={-1}
                        onChange={handleFolderSelect}
                        {...{ webkitdirectory: '' }}
                    />
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={openFolderPicker}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openFolderPicker();
                            }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={t('dropZoneTitle')}
                        className={`p-10 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 ${isDragging ? 'border-sky-500 bg-sky-500/10 shadow-2xl shadow-sky-500/10' : 'border-slate-600 bg-slate-800 hover:border-slate-500'}`}
                    >
                        <div className="flex flex-col items-center pointer-events-none">
                            <FolderArrowDownIcon className="h-16 w-16 text-slate-500 mb-4" />
                            <h3 className="text-2xl font-bold text-slate-200">{t('dropZoneTitle')}</h3>
                            <p className="text-slate-300 mt-2 max-w-md">{t('dropZoneDescription')}</p>
                            <p className="text-slate-400 mt-2 text-sm">{t('dropZoneClickHint')}</p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h4 id="date-rule-title" className="text-base font-semibold text-slate-200 mb-3">{t('dateRuleTitle')}</h4>
                        <div className="flex justify-center">
                            <div role="group" aria-labelledby="date-rule-title" className="flex items-center space-x-1 p-1 bg-slate-700/50 rounded-lg">
                                <button
                                    onClick={() => setDateLogic('earliest')}
                                    aria-pressed={dateLogic === 'earliest'}
                                    className={`px-4 py-1 text-sm font-semibold rounded-md transition-all duration-300 ${
                                        dateLogic === 'earliest'
                                            ? 'bg-sky-500 text-white shadow'
                                            : 'text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {t('dateRuleOldest')}
                                </button>
                                <button
                                    onClick={() => setDateLogic('latest')}
                                    aria-pressed={dateLogic === 'latest'}
                                    className={`px-4 py-1 text-sm font-semibold rounded-md transition-all duration-300 ${
                                        dateLogic === 'latest'
                                            ? 'bg-sky-500 text-white shadow'
                                            : 'text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {t('dateRuleNewest')}
                                </button>
                            </div>
                        </div>
                    </div>

                     <div className="mt-8 space-y-3 text-sm text-slate-400 max-w-2xl mx-auto">
                        <p>
                            <strong className="font-medium text-slate-300">{t('browserCompatibilityTitle')}</strong>
                            {' '}
                            {t('browserCompatibilityNotice')}
                        </p>
                        <p>
                            <strong className="font-medium text-slate-300">{t('privacyTitle')}</strong>
                            {' '}
                            {t('privacyDescription')}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (status === 'processing') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Spinner />
                <p role="status" aria-live="polite" className="mt-4 text-lg text-slate-300 font-semibold text-center px-4">{processingMessage}</p>
                {progress && progress.totalFiles > 0 && (
                    <div className="w-full max-w-md mt-4">
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div
                                className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-linear"
                                style={{ width: `${(progress.processedFiles / progress.totalFiles) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-slate-400 text-center mt-2 font-mono">
                            {progress.processedFiles} / {progress.totalFiles}
                        </p>
                    </div>
                )}
                <button
                    onClick={cancel}
                    className="mt-8 px-4 py-2 bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                    {t('cancel')}
                </button>
            </div>
        );
    }
    
    if (status === 'done') {
        const anyRenamed = folders.some(f => f.isRenamed);
        const unsavedChangesCount = folders.filter(
            f => f.newName.trim() && !f.isRenamed && !nameIssues.has(f.id)
        ).length;

        return (
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 p-4 bg-slate-800/50 border border-slate-700/80 rounded-lg">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-100">{t('resultsTitle')}</h2>
                        <p className="text-slate-400">{t('resultsDescription')}</p>
                    </div>
                    <div className="flex items-center gap-x-4 mt-3 sm:mt-0 flex-shrink-0">
                         <button
                            onClick={handleSaveAll}
                            disabled={unsavedChangesCount === 0}
                            className="relative flex items-center bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                        >
                            <SaveIcon className="h-5 w-5 mr-2" />
                            {t('saveAllChanges')}
                             {unsavedChangesCount > 0 && (
                                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-xs font-bold text-white">
                                    {unsavedChangesCount}
                                </span>
                            )}
                        </button>
                        
                        {/* Organize to Computer Button */}
                        {isFileSystemAccessSupported() && (
                            <button
                                onClick={handleOrganizeToComputer}
                                disabled={!anyRenamed}
                                title={t('organizeToComputerHint')}
                                className="flex items-center bg-green-600 text-white font-semibold py-2 px-4 rounded-lg border border-green-500 hover:bg-green-700 disabled:bg-slate-600 disabled:text-slate-400 disabled:border-slate-500 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                            >
                                <ComputerDesktopIcon className="h-5 w-5 mr-2" />
                                {t('organizeToComputer')}
                            </button>
                        )}
                        
                        {/* Fallback message for browsers without File System Access API */}
                        {!isFileSystemAccessSupported() && anyRenamed && (
                            <div className="flex items-center bg-blue-500/10 border border-blue-400/30 rounded-lg px-4 py-3 text-sm">
                                <div className="text-blue-300">
                                    <strong>{t('browserCompatibilityTitle')}</strong> {t('fileSystemNotSupported')}
                                    <br />
                                    <span className="text-blue-200 text-xs">
                                        {t('organizeHintChromeEdge')}
                                    </span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={reset}
                            className="flex items-center bg-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors duration-200 shadow-sm"
                        >
                            <ArrowPathIcon className="h-5 w-5 mr-2" />
                            {t('organizeAnother')}
                        </button>
                    </div>
                </div>

                {restoredNameCount > 0 && (
                    <div className="mb-8 p-4 bg-sky-900/30 border border-sky-500/40 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-sky-200">
                            {t('restoredNamesNotice', { count: restoredNameCount })}
                        </p>
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                onClick={handleDiscardRestoredNames}
                                className="px-3 py-1 text-sm font-semibold rounded-md border border-sky-400/40 text-sky-200 hover:bg-sky-800/40 transition-colors"
                            >
                                {t('restoredNamesDiscard')}
                            </button>
                            <button
                                onClick={dismissRestoredNotice}
                                className="px-3 py-1 text-sm font-semibold rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                            >
                                {t('restoredNamesKeep')}
                            </button>
                        </div>
                    </div>
                )}

                {skippedFiles.length > 0 && (
                    <div className="mb-8 p-4 bg-amber-900/30 border border-amber-500/40 rounded-lg">
                        <p className="text-sm font-semibold text-amber-200">
                            {t('skippedFilesNotice', { count: skippedFiles.length })}
                        </p>
                        <details className="mt-2 text-sm text-amber-200/90">
                            <summary className="cursor-pointer text-amber-300 hover:text-amber-200">
                                {t('skippedFilesShowDetails')}
                            </summary>
                            <ul className="mt-2 list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
                                {skippedFiles.map((file, index) => (
                                    <li key={`${file.folderName}/${file.fileName}-${index}`}>
                                        {file.folderName}/{file.fileName}
                                        {' — '}
                                        {t(file.reason === 'tooLarge' ? 'skipReasonTooLarge' : 'skipReasonUnreadable')}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </div>
                )}

                {/* Cards have variable heights, so fixed-row virtualization
                    clipped and overlapped them. Thumbnails already lazy-load
                    via IntersectionObserver; content-visibility lets the
                    browser skip rendering offscreen cards, so one grid scales
                    to large folder counts. */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {folders.map(folder => (
                        <div
                            key={folder.id}
                            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 420px' }}
                        >
                            <FolderCard
                                folder={folder}
                                onNameChange={handleNameChange}
                                onEdit={handleEditFolder}
                                nameIssue={folder.isRenamed ? undefined : nameIssues.get(folder.id)}
                            />
                        </div>
                    ))}
                </div>

                 <div className="mt-12 p-6 bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700/80">
                    <h3 className="text-xl font-bold text-slate-100">{t('renameScriptInstructionsTitle')}</h3>
                    <p className="mt-2 text-slate-400">
                        {t('renameScriptInstructions', { folderName: rootFolderName })}
                    </p>
                    <div className="mt-6">
                        <button
                            onClick={handleGenerateScript}
                            disabled={!anyRenamed}
                            className="w-full sm:w-auto flex items-center justify-center bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold py-3 px-6 rounded-lg hover:from-sky-600 hover:to-indigo-600 disabled:from-slate-600 disabled:to-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-sky-500/30 disabled:shadow-none"
                        >
                            <CodeBracketIcon className="h-6 w-6 mr-3" />
                            {t('generateRenameScript')}
                        </button>
                    </div>
                </div>
                
                {/* Progress Modal for File System Operations */}
                <ProgressModal
                    isOpen={isOrganizing}
                    progress={organizingProgress}
                    onClose={handleCloseProgressModal}
                    onCancel={handleCancelOrganize}
                />
                
                {/* Development-only heap monitor */}
                {import.meta.env.DEV && (
                    <PerformanceMonitor
                        isVisible={showPerformanceMonitor}
                        onToggle={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
                    />
                )}
            </div>
        );
    }

    return null;
};

export default FolderOrganizer;