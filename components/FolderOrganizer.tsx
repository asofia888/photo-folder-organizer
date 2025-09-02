
import React, { useState, useCallback, useEffect } from 'react';
import FolderCard from './FolderCard';
import Spinner from './Spinner';
import ProgressModal from './ProgressModal';
import { FolderArrowDownIcon, ArrowPathIcon, CodeBracketIcon, SaveIcon, ComputerDesktopIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useFolderProcessor, DateLogic } from '../hooks/useFolderProcessor';
import { organizePhotosToFolders, isFileSystemAccessSupported, validateFolderName, ProcessingProgress } from '../utils/fileSystemUtils';
import { Folder } from '../types';

// --- Utility Functions ---

type FormatDateFn = (date: Date | null) => string;

const createRenameScriptBlob = (
    folders: Folder[],
    formatDate: FormatDateFn
): { blob: Blob; filename: string } => {
    const isWindows = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win');
    const renamedFolders = folders.filter(f => f.isRenamed && f.newName.trim());

    let scriptContent = '';
    if (isWindows) {
        scriptContent = '@echo off\r\nchcp 65001 > nul\r\n';
        renamedFolders.forEach(folder => {
            const finalName = `${formatDate(folder.representativeDate)}_${folder.newName}`;
            scriptContent += `ren "${folder.originalName}" "${finalName}"\r\n`;
        });
    } else {
        scriptContent = '#!/bin/bash\n\n';
        renamedFolders.forEach(folder => {
            const finalName = `${formatDate(folder.representativeDate)}_${folder.newName}`;
            scriptContent += `mv -v -- "${folder.originalName}" "${finalName}"\n`;
        });
    }

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const filename = isWindows ? 'rename_folders.bat' : 'rename_folders.sh';
    
    return { blob, filename };
};

// --- Component ---

const FolderOrganizer: React.FC = () => {
    const { t, locale } = useLanguage();
    const { 
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
        setFailure
    } = useFolderProcessor();

    const [isDragging, setIsDragging] = useState(false);
    const [dateLogic, setDateLogic] = useState<DateLogic>('earliest');
    
    // File System Access states
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [organizingProgress, setOrganizingProgress] = useState<ProcessingProgress>({
        current: 0,
        total: 0,
        status: 'preparing'
    });

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);
    
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

    const handleNameChange = useCallback((folderId: string, newName: string) => {
        setFolders(prevFolders =>
            prevFolders.map(folder =>
                folder.id === folderId ? { ...folder, newName } : folder
            )
        );
    }, [setFolders]);

    const handleSaveAll = useCallback(() => {
        setFolders(prevFolders =>
            prevFolders.map(folder =>
                folder.newName.trim() && !folder.isRenamed
                    ? { ...folder, isRenamed: true }
                    : folder
            )
        );
    }, [setFolders]);
    
     const handleEditFolder = useCallback((folderId: string) => {
        setFolders(prevFolders =>
            prevFolders.map(folder =>
                folder.id === folderId
                    ? { ...folder, isRenamed: false }
                    : folder
            )
        );
    }, [setFolders]);

    const handleSuggestName = useCallback(async (folderId: string, photos: File[]): Promise<string> => {
        const fileToBase64 = (file: File): Promise<{ mimeType: string, data: string }> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve({
                        mimeType: file.type,
                        data: result.split(',')[1]
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        };

        const imagePayloads = await Promise.all(photos.map(fileToBase64));

        try {
            // This now points to our secure Cloud Function endpoint via Firebase Hosting rewrites
            const response = await fetch('/api/generateFolderName', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: imagePayloads, locale }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            if (!data.suggestion) {
                throw new Error("API response did not contain a suggestion.");
            }
            return data.suggestion;

        } catch (e) {
            console.error("AI suggestion failed", e);
            throw new Error("Failed to get suggestion from AI.");
        }
    }, [locale]);
    
    const formatDateForScript = (date: Date | null): string => {
        if (!date) return t('unknownDate');
        return date.toISOString().split('T')[0];
    };

    // File System Access functionality
    const handleOrganizeToComputer = useCallback(async () => {
        if (!isFileSystemAccessSupported()) {
            alert(t('fileSystemNotSupported'));
            return;
        }

        // Check if all folders have valid names
        const validationErrors: string[] = [];
        const foldersToOrganize = folders.filter(f => f.isRenamed).map(folder => {
            const finalName = `${formatDateForScript(folder.representativeDate)}_${folder.newName}`;
            if (!validateFolderName(finalName)) {
                validationErrors.push(`Invalid folder name: ${finalName}`);
            }
            return {
                name: finalName,
                photos: folder.photos.map(p => p.file).filter((f): f is File => !!f)
            };
        });

        if (validationErrors.length > 0) {
            alert(`Please fix these folder names:\n${validationErrors.join('\n')}`);
            return;
        }

        if (foldersToOrganize.length === 0) {
            alert('No folders are ready to organize. Please rename at least one folder.');
            return;
        }

        setIsOrganizing(true);
        setOrganizingProgress({ current: 0, total: 0, status: 'preparing' });

        try {
            await organizePhotosToFolders(foldersToOrganize, (progress) => {
                setOrganizingProgress(progress);
            });
        } catch (error) {
            console.error('Organization failed:', error);
            setOrganizingProgress(prev => ({
                ...prev,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }));
        }
    }, [folders, t]);

    const handleCloseProgressModal = useCallback(() => {
        setIsOrganizing(false);
        setOrganizingProgress({ current: 0, total: 0, status: 'preparing' });
    }, []);

    const handleGenerateScript = () => {
        const { blob, filename } = createRenameScriptBlob(folders, formatDateForScript);

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
                </div>

                <div className="p-8 sm:p-10 bg-slate-800/50 rounded-2xl border border-slate-700/80">
                     {status === 'error' && error && (
                        <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-left">
                            <h2 className="text-lg font-semibold text-red-300">{t('errorOccurred')}</h2>
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`p-10 border-2 border-dashed rounded-xl transition-all duration-300 ${isDragging ? 'border-sky-500 bg-sky-500/10 shadow-2xl shadow-sky-500/10' : 'border-slate-600 bg-slate-800'}`}
                    >
                        <div className="flex flex-col items-center pointer-events-none">
                            <FolderArrowDownIcon className="h-16 w-16 text-slate-500 mb-4" />
                            <h3 className="text-2xl font-bold text-slate-200">{t('dropZoneTitle')}</h3>
                            <p className="text-slate-300 mt-2 max-w-md">{t('dropZoneDescription')}</p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h4 className="text-base font-semibold text-slate-200 mb-3">{t('dateRuleTitle')}</h4>
                        <div className="flex justify-center">
                            <div className="flex items-center space-x-1 p-1 bg-slate-700/50 rounded-lg">
                                <button
                                    onClick={() => setDateLogic('earliest')}
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
                <p className="mt-4 text-lg text-slate-300 font-semibold text-center px-4">{processingMessage}</p>
                {progress && progress.total > 0 && (
                    <div className="w-full max-w-md mt-4">
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div
                                className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-linear"
                                style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-slate-400 text-center mt-2 font-mono">
                            {progress.processed} / {progress.total}
                        </p>
                    </div>
                )}
            </div>
        );
    }
    
    if (status === 'done') {
        const anyRenamed = folders.some(f => f.isRenamed);
        const unsavedChangesCount = folders.filter(f => f.newName.trim() && !f.isRenamed).length;

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
                                disabled={folders.filter(f => f.isRenamed).length === 0}
                                className="flex items-center bg-green-600 text-white font-semibold py-2 px-4 rounded-lg border border-green-500 hover:bg-green-700 disabled:bg-slate-600 disabled:text-slate-400 disabled:border-slate-500 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm"
                            >
                                <ComputerDesktopIcon className="h-5 w-5 mr-2" />
                                {t('organizeToComputer')}
                            </button>
                        )}
                        
                        {/* Fallback message for browsers without File System Access API */}
                        {!isFileSystemAccessSupported() && folders.filter(f => f.isRenamed).length > 0 && (
                            <div className="flex items-center bg-blue-500/10 border border-blue-400/30 rounded-lg px-4 py-3 text-sm">
                                <div className="text-blue-300">
                                    <strong>{t('browserCompatibilityTitle')}</strong> {t('fileSystemNotSupported')}
                                    <br />
                                    <span className="text-blue-200 text-xs">
                                        {locale === 'ja' 
                                            ? 'Chrome・Edgeなら「コンピューターに整理」ボタンで直接整理できます。' 
                                            : 'Use Chrome or Edge for direct "Organize to Computer" functionality.'}
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {folders.map(folder => (
                        <FolderCard
                            key={folder.id}
                            folder={folder}
                            onNameChange={handleNameChange}
                            onSuggestName={handleSuggestName}
                            onEdit={handleEditFolder}
                        />
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
                />
            </div>
        );
    }

    return null;
};

export default FolderOrganizer;