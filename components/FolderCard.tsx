
import React, { useState, useCallback, useMemo } from 'react';
import { Folder, Photo } from '../types';
import { FolderCardProps } from '../types/componentTypes';
import Thumbnail from './Thumbnail';
import ImageModal from './ImageModal';
import { FolderIcon, CheckCircleIcon, ClipboardIcon, PencilSquareIcon, ExclamationTriangleIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { isNonEmptyString, createNonEmptyString } from '../utils/typeGuards';

const FolderCard: React.FC<FolderCardProps> = ({ 
  folder, 
  onNameChange, 
  onEdit,
  maxThumbnails = 4,
  showMetadata = false,
  isCompact = false,
  className
}) => {
    const { t } = useLanguage();
    const [copied, setCopied] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const formatDate = (date: Date | null): string => {
        if (!date) return t('unknownDate');
        return date.toISOString().split('T')[0];
    };
    

    const formattedDate = formatDate(folder.representativeDate);
    const finalName = `${formattedDate}_${folder.newName}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(finalName).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleThumbnailClick = (photo: Photo) => {
        setSelectedPhoto(photo);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedPhoto(null);
    };

    const handlePreviousPhoto = () => {
        if (!selectedPhoto) return;
        const currentIndex = folder.photos.findIndex(p => p.id === selectedPhoto.id);
        const previousIndex = currentIndex > 0 ? currentIndex - 1 : folder.photos.length - 1;
        setSelectedPhoto(folder.photos[previousIndex]);
    };

    const handleNextPhoto = () => {
        if (!selectedPhoto) return;
        const currentIndex = folder.photos.findIndex(p => p.id === selectedPhoto.id);
        const nextIndex = currentIndex < folder.photos.length - 1 ? currentIndex + 1 : 0;
        setSelectedPhoto(folder.photos[nextIndex]);
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
                                {folder.photos.slice(0, maxThumbnails).map(photo => (
                                    <Thumbnail 
                                        key={photo.id} 
                                        photo={photo} 
                                        onClick={() => handleThumbnailClick(photo)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor={`folder-name-${folder.id}`} className="block text-sm font-medium text-slate-300">
                                    {t('newFolderNameLabel')}
                                </label>
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
            
            {/* Image Modal */}
            <ImageModal
                photo={selectedPhoto}
                photos={folder.photos}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onPrevious={handlePreviousPhoto}
                onNext={handleNextPhoto}
            />
        </div>
    );
};

export default React.memo(FolderCard);
