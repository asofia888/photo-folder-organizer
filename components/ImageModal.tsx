import React, { useEffect, useRef } from 'react';
import { Photo } from '../types';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { usePhotoSource } from '../hooks/usePhotoSource';
import { useModalFocus } from '../hooks/useModalFocus';

interface ImageModalProps {
  photo: Photo | null;
  photos: readonly Photo[];
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  photo,
  photos,
  isOpen,
  onClose,
  onPrevious,
  onNext
}) => {
  const { t } = useLanguage();
  // Falls back from the original file to the embedded preview when the
  // browser can't decode the file (RAW, HEIC outside Safari).
  const { src: imageSrc, tryNextSource, exhausted } = usePhotoSource(photo, isOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Escape, focus trap and focus return; arrow keys are handled below.
  useModalFocus(isOpen, dialogRef, onClose);

  // キーボードナビゲーション（前後の写真）
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          if (onPrevious) {
            e.preventDefault();
            onPrevious();
          }
          break;
        case 'ArrowRight':
          if (onNext) {
            e.preventDefault();
            onNext();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrevious, onNext]);

  // スクロールを防止
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !photo) return null;

  const currentIndex = photos.findIndex(p => p.id === photo.id);
  const hasMultiple = photos.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
      {/* 背景クリックで閉じる */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* モーダルコンテンツ */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={photo.file?.name ?? t('photoThumbnailAlt')}
        tabIndex={-1}
        // This layer covers the backdrop, so empty space around the photo
        // closes the viewer here.
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="relative max-w-7xl max-h-screen p-4 w-full h-full flex items-center justify-center focus:outline-none"
      >
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          aria-label={t('close')}
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        {/* 前の画像ボタン */}
        {hasMultiple && onPrevious && currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            className="absolute left-4 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            aria-label={t('previousPhoto')}
          >
            <ChevronLeftIcon className="h-8 w-8" />
          </button>
        )}

        {/* 次の画像ボタン */}
        {hasMultiple && onNext && currentIndex < photos.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            aria-label={t('nextPhoto')}
          >
            <ChevronRightIcon className="h-8 w-8" />
          </button>
        )}

        {/* 画像 */}
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={photo.file?.name ?? ''}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onError={tryNextSource}
          />
        ) : exhausted && (
          <div
            className="flex items-center justify-center text-slate-400 bg-slate-800/80 rounded-lg p-12 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {t('previewUnavailable')}
          </div>
        )}

        {/* 画像インジケーター */}
        {hasMultiple && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
            {currentIndex + 1} / {photos.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageModal;