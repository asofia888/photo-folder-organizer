
import React, { useState } from 'react';
import { Folder } from '../types';
import Thumbnail from './Thumbnail';
import { FolderIcon, CheckCircleIcon, ClipboardIcon, SparklesIcon, PencilSquareIcon, ExclamationTriangleIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface FolderCardProps {
    folder: Folder;
    onNameChange: (folderId: string, newName: string) => void;
    onSuggestName: (folderId: string, photos: File[]) => Promise<string>;
    onEdit: (folderId: string) => void;
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, onNameChange, onSuggestName, onEdit }) => {
    const { t } = useLanguage();
    const [copied, setCopied] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const MAX_THUMBNAILS = 4;

    const formatDate = (date: Date | null): string => {
        if (!date) return t('unknownDate');
        return date.toISOString().split('T')[0];
    };
    
    const handleSuggestion = async () => {
        setIsSuggesting(true);
        setSuggestionError(null);
        try {
            const photoFiles = folder.photos.slice(0, MAX_THUMBNAILS).map(p => p.file).filter((f): f is File => !!f);
            if (photoFiles.length > 0) {
                const suggestedName = await onSuggestName(folder.id, photoFiles);
                onNameChange(folder.id, suggestedName);
            }
        } catch (error) {
            console.error("Failed to get suggestion:", error);
            setSuggestionError(t('aiSuggestionError'));
            setTimeout(() => setSuggestionError(null), 5000);
        } finally {
            setIsSuggesting(false);
        }
    };

    const formattedDate = formatDate(folder.representativeDate);
    const finalName = `${formattedDate}_${folder.newName}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(finalName).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden transition-all duration-300 flex flex-col hover:border-sky-500/50 hover:shadow-sky-500/10 animate-scale-in">
            <div className="p-5 flex-grow">
                <div className="flex items-start mb-4">
                    {folder.isRenamed ? (
                        <CheckCircleIcon className="h-7 w-7 text-green-400 mr-3 flex-shrink-0 mt-1" />
                    ) : (
                        <FolderIcon className="h-7 w-7 text-sky-400 mr-3 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-400 truncate" title={folder.originalName}>{t('original')} {folder.originalName}</p>
                        {folder.isRenamed ? (
                            <button
                                onClick={() => onEdit(folder.id)}
                                className="group w-full flex items-center justify-between text-left rounded-md -ml-2 -my-1 py-1 pl-2 pr-1 transition-colors hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                aria-label={t('editNameAriaLabel')}
                            >
                                <span className="font-bold text-lg text-slate-100 truncate" title={finalName}>{finalName}</span>
                                <PencilSquareIcon className="h-5 w-5 text-slate-400 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </button>
                        ) : (
                           <p className="font-semibold text-lg text-slate-100">{formattedDate}</p>
                        )}
                    </div>
                </div>

                {!folder.isRenamed && (
                    <>
                        <div className="mb-4">
                            <p className="text-sm text-slate-400 mb-2">{t('photoPreview')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {folder.photos.slice(0, MAX_THUMBNAILS).map(photo => (
                                    <Thumbnail key={photo.id} photo={photo} />
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor={`folder-name-${folder.id}`} className="block text-sm font-medium text-slate-300">
                                    {t('newFolderNameLabel')}
                                </label>
                                <button
                                    onClick={handleSuggestion}
                                    disabled={isSuggesting}
                                    className="flex items-center text-xs text-sky-400 font-semibold hover:text-sky-300 disabled:text-slate-500 disabled:cursor-wait transition-colors"
                                >
                                    <SparklesIcon className={`h-4 w-4 mr-1 ${isSuggesting ? 'animate-pulse' : ''}`} />
                                    {isSuggesting ? t('aiSuggesting') : t('aiSuggestion')}
                                </button>
                            </div>
                            <div className="flex items-center space-x-0">
                                <span className="text-slate-300 bg-slate-700 px-3 py-2 rounded-l-md border border-r-0 border-slate-600 whitespace-nowrap">{formattedDate}_</span>
                                <input
                                    id={`folder-name-${folder.id}`}
                                    type="text"
                                    value={folder.newName}
                                    onChange={(e) => onNameChange(folder.id, e.target.value)}
                                    placeholder={t('newFolderNamePlaceholder')}
                                    className="block w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-r-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-slate-200 placeholder-slate-400"
                                />
                            </div>
                             {suggestionError && (
                                <div className="mt-2 flex items-center text-sm text-red-400">
                                    <ExclamationTriangleIcon className="h-4 w-4 mr-2" aria-label={t('errorIconAriaLabel')} />
                                    {suggestionError}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            {folder.isRenamed && (
                 <div className="bg-green-500/10 py-3 px-5 flex items-center justify-center space-x-3 border-t border-green-500/20">
                    <p className="text-sm font-semibold text-green-300">{t('readyToRename')}</p>
                    <button
                        onClick={handleCopy}
                        className="flex items-center text-sm bg-slate-700 text-green-300 font-semibold py-1 px-3 rounded-md border border-green-400/30 hover:bg-slate-600 transition-colors duration-200 shadow-sm"
                    >
                       <ClipboardIcon className="h-4 w-4 mr-2" />
                       {copied ? t('copied') : t('copyName')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default React.memo(FolderCard);
