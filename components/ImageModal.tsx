import React, { useEffect, useState } from 'react';
import { Photo } from '../types';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

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
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // キーボードナビゲーション
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
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
  }, [isOpen, onClose, onPrevious, onNext]);

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

  // 表示用の画像URLを解決する。サムネイルは遅延生成のため photo.url は通常 null。
  // RAW は抽出済みサムネイルJPEGを使い、通常画像は File から ObjectURL を生成して
  // 写真の切り替え・モーダルを閉じる際に解放する（リーク防止）。
  useEffect(() => {
    if (!isOpen || !photo) {
      setImageSrc(null);
      return;
    }

    if (photo.isRaw) {
      setImageSrc(photo.thumbnailUrl ?? null);
      return;
    }

    if (photo.url) {
      setImageSrc(photo.url);
      return;
    }

    if (photo.file) {
      const objectUrl = URL.createObjectURL(photo.file);
      setImageSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    setImageSrc(null);
    return;
  }, [isOpen, photo]);

  if (!isOpen || !photo) return null;

  const currentIndex = photos.findIndex(p => p.id === photo.id);
  const hasMultiple = photos.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
      {/* 背景クリックで閉じる */}
      <div 
        className="absolute inset-0 cursor-pointer" 
        onClick={onClose}
        aria-label="Close modal"
      />
      
      {/* モーダルコンテンツ */}
      <div className="relative max-w-7xl max-h-screen p-4 w-full h-full flex items-center justify-center">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          aria-label="Close image"
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
            aria-label="Previous image"
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
            aria-label="Next image"
          >
            <ChevronRightIcon className="h-8 w-8" />
          </button>
        )}

        {/* 画像 */}
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={`Photo ${currentIndex + 1} of ${photos.length}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
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