import React, { useState, useCallback, useEffect, useRef } from 'react';
import FolderCard from './FolderCard';
import Spinner from './Spinner';
import { FolderArrowDownIcon, ArrowPathIcon, CodeBracketIcon, DocumentArrowUpIcon, ExclamationTriangleIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useUnifiedProcessor, DateLogic } from '../hooks/useUnifiedProcessor';
import { formatScriptDate, getBrowserCompatibilityMessage } from '../utils';
import { Folder } from '../types';
import { analytics } from '../utils/analytics';

const fileToBase64 = async (file: File): Promise<{data: string, mimeType: string}> => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      data: await base64EncodedDataPromise,
      mimeType: file.type
    };
};

const CrossBrowserFolderOrganizer: React.FC = () => {
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
        processFilesFromInput,
        browserSupport,
        reset,
        cleanup,
        setFailure,
        undo,
        canUndo
    } = useUnifiedProcessor();

    const [isDragging, setIsDragging] = useState(false);
    const [dateLogic, setDateLogic] = useState<DateLogic>('earliest');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get browser compatibility info
    const compatibilityInfo = getBrowserCompatibilityMessage(browserSupport, locale);
    const usingDragDrop = browserSupport.supportsFileSystemAccess;

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);
    
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        
        if (!usingDragDrop) {
            setFailure(t('dragDropNotSupported'));
            return;
        }
        
        const items = event.dataTransfer.items;
        if (items && items.length > 0) {
            const entry = items[0].webkitGetAsEntry();
            if (entry && entry.isDirectory) {
                processDirectory(entry as FileSystemDirectoryEntry, dateLogic);
            } else {
                setFailure(t('errorDropFile'));
            }
        }
    }, [t, dateLogic, usingDragDrop, processDirectory, setFailure]);

    const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            if (!browserSupport.supportsWebkitDirectory) {
                setFailure(t('fileInputNotSupported'));
                return;
            }
            processFilesFromInput(files, dateLogic);
        }
    }, [dateLogic, processFilesFromInput, browserSupport, setFailure, t]);

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (usingDragDrop) {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(true);
        }
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const handleRenameFolder = useCallback((folderId: string, newName: string) => {
        setFolders((prevFolders: Folder[]) =>
            prevFolders.map((folder: Folder) =>
                folder.id === folderId
                    ? { ...folder, newName: newName, isRenamed: true }
                    : folder
            )
        );
    }, [setFolders]);
    
    const handleSuggestName = useCallback(async (_folderId: string, photos: File[]): Promise<string> => {
        const startTime = performance.now();
        try {
            analytics.trackEvent('ai_suggestion_start', { photoCount: photos.length });
            
            // Convert files to base64 for API transmission
            const images = await Promise.all(photos.map(fileToBase64));
            
            const apiUrl = process.env.NODE_ENV === 'production' 
                ? 'https://photo-organizer-backend-1024772378605.asia-northeast1.run.app/api/suggest-folder-name'
                : '/api/suggest-folder-name';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    images,
                    locale
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t('aiSuggestError'));
            }

            const data = await response.json();
            const responseTime = performance.now() - startTime;
            analytics.trackAISuggestionUsed(photos.length, responseTime, true);
            return data.suggestion;
        } catch (e) {
            const responseTime = performance.now() - startTime;
            analytics.trackAISuggestionUsed(photos.length, responseTime, false);
            analytics.trackError('ai_suggestion_failed', e instanceof Error ? e.message : String(e), { photoCount: photos.length });
            console.error("AI suggestion failed", e);
            setFailure(t('aiSuggestError'));
            return '';
        }
    }, [locale, setFailure, t]);
    
    const formatDateForScript = (date: Date | null): string => {
        if (!date) return t('unknownDate');
        return formatScriptDate(date);
    };

    const handleGenerateScript = () => {
        const isWindows = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win');
        const renamedFolders = folders.filter(f => f.isRenamed);
        
        analytics.trackScriptGenerated(renamedFolders.length, isWindows ? 'windows' : 'unix');

        let scriptContent = '';
        if (isWindows) {
            scriptContent = '@echo off\r\nchcp 65001 > nul\r\n';
            renamedFolders.forEach(folder => {
                const finalName = `${formatDateForScript(folder.representativeDate)}_${folder.newName}`;
                scriptContent += `ren "${folder.originalName}" "${finalName}"\r\n`;
            });
        } else {
            scriptContent = '#!/bin/bash\n\n';
            renamedFolders.forEach(folder => {
                const finalName = `${formatDateForScript(folder.representativeDate)}_${folder.newName}`;
                scriptContent += `mv -v -- "${folder.originalName}" "${finalName}"\n`;
            });
        }

        const blob = new Blob([scriptContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isWindows ? 'rename_folders.bat' : 'rename_folders.sh';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    if (status === 'idle' || status === 'error') {
        return (
            <div className="text-center p-4 sm:p-8">
                <div className="mb-10 max-w-3xl mx-auto">
                    <h2 className="text-4xl sm:text-6xl font-bold text-gradient tracking-tight">{t('catchphraseMain')}</h2>
                    <p className="mt-4 text-lg text-slate-300">{t('catchphraseSub')}</p>
                </div>

                <div className="p-8 sm:p-10 bg-slate-800/50 rounded-2xl border border-slate-700/80">
                     {status === 'error' && error && (
                        <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-left">
                            <h2 className="text-lg font-semibold text-red-300">{t('errorOccurred')}</h2>
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Browser Compatibility Notice */}
                    <div className={`mb-6 p-4 border rounded-lg text-left ${
                        compatibilityInfo.severity === 'error' ? 'bg-red-900/50 border-red-500/50' :
                        compatibilityInfo.severity === 'warning' ? 'bg-yellow-900/50 border-yellow-500/50' :
                        'bg-blue-900/50 border-blue-500/50'
                    }`}>
                        <div className="flex items-center">
                            {compatibilityInfo.severity === 'error' && 
                                <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-400" />
                            }
                            {compatibilityInfo.severity === 'warning' && 
                                <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-yellow-400" />
                            }
                            <h2 className={`text-lg font-semibold ${
                                compatibilityInfo.severity === 'error' ? 'text-red-300' :
                                compatibilityInfo.severity === 'warning' ? 'text-yellow-300' :
                                'text-blue-300'
                            }`}>
                                {compatibilityInfo.title}
                            </h2>
                        </div>
                        <p className={`mt-1 ${
                            compatibilityInfo.severity === 'error' ? 'text-red-400' :
                            compatibilityInfo.severity === 'warning' ? 'text-yellow-400' :
                            'text-blue-400'
                        }`}>
                            {compatibilityInfo.message}
                        </p>
                    </div>

                    {/* Input Methods */}
                    {usingDragDrop ? (
                        // Drag & Drop Interface (Chrome/Edge)
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
                    ) : browserSupport.supportsWebkitDirectory ? (
                        // File Input Interface (Safari/Firefox)
                        <div className="space-y-4">
                            <div className="p-10 border-2 border-dashed border-slate-600 bg-slate-800 rounded-xl">
                                <div className="flex flex-col items-center">
                                    <DocumentArrowUpIcon className="h-16 w-16 text-slate-500 mb-4" />
                                    <h3 className="text-2xl font-bold text-slate-200">{t('selectFolderTitle')}</h3>
                                    <p className="text-slate-300 mt-2 max-w-md text-center">{t('selectFolderDescription')}</p>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="mt-4 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
                                    >
                                        {t('selectFolderButton')}
                                    </button>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                {...({ webkitdirectory: "" } as any)}
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                        </div>
                    ) : (
                        // Unsupported Browser
                        <div className="p-10 border-2 border-dashed border-red-600 bg-red-900/20 rounded-xl">
                            <div className="flex flex-col items-center">
                                <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mb-4" />
                                <h3 className="text-2xl font-bold text-red-300">{t('browserNotSupported')}</h3>
                                <p className="text-red-400 mt-2 max-w-md text-center">
                                    {t('browserNotSupportedDescription')}
                                </p>
                            </div>
                        </div>
                    )}

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
        const allRenamed = folders.length > 0 && folders.every(f => f.isRenamed);

        return (
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 p-4 bg-slate-800/50 border border-slate-700/80 rounded-lg">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-100">{t('resultsTitle')}</h2>
                        <p className="text-slate-400">{t('resultsDescription')}</p>
                    </div>
                   <div className="flex gap-2 mt-3 sm:mt-0">
                       <button
                           onClick={undo}
                           disabled={!canUndo}
                           className="flex items-center bg-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                           ⬅️ {t('undo')}
                       </button>
                       <button
                           onClick={reset}
                           className="flex items-center bg-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors duration-200 shadow-sm"
                       >
                           <ArrowPathIcon className="h-5 w-5 mr-2" />
                           {t('organizeAnother')}
                       </button>
                   </div>
                </div>

                 {allRenamed && (
                    <div className="mb-6 p-4 bg-green-900/50 border-l-4 border-green-500 rounded-r-lg">
                        <h2 className="text-xl font-semibold text-green-300">{t('allFoldersRenamedTitle')}</h2>
                        <p className="text-green-400">{t('allFoldersRenamedDescription')}</p>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {folders.map(folder => (
                        <FolderCard
                            key={folder.id}
                            folder={folder}
                            onRename={handleRenameFolder}
                            onSuggestName={handleSuggestName}
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
            </div>
        );
    }

    return null;
};

export default CrossBrowserFolderOrganizer;