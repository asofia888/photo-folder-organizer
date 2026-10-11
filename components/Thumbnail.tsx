import React, { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { usePhotoSource } from '../hooks/usePhotoSource';

interface ThumbnailProps {
  readonly photo: Photo;
  readonly lazy?: boolean;
  readonly onClick?: () => void;
  readonly onLoad?: () => void;
}

// Formats browsers commonly can't decode in <img> (HEIC/TIFF outside Safari).
// When no preview is available they get a neutral format tile, not an error.
const UNPREVIEWABLE_FORMATS = ['heic', 'heif', 'tif', 'tiff'];

const getFormatLabel = (photo: Photo): string | null => {
  if (photo.isRaw) return 'RAW';
  const extension = photo.file?.name.split('.').pop()?.toLowerCase() ?? '';
  return UNPREVIEWABLE_FORMATS.includes(extension) ? extension.toUpperCase() : null;
};

const Thumbnail: React.FC<ThumbnailProps> = ({ photo, onClick, lazy = true, onLoad }) => {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(!lazy);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { src, tryNextSource, exhausted } = usePhotoSource(photo, isVisible);
  const fileName = photo.file?.name ?? '';

  // Lazy loading: mark visible once the card scrolls near the viewport.
  useEffect(() => {
    if (!lazy || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Load images 100px before they come into view
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isVisible]);

  const handleImageLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const formatLabel = getFormatLabel(photo);

  const renderContent = () => {
    if (!isVisible) {
      return (
        <div className="w-full h-full bg-slate-800 rounded-md shadow-sm ring-1 ring-slate-700 flex items-center justify-center">
          <div className="w-8 h-8 text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        </div>
      );
    }

    if (exhausted) {
      // A known format without a preview (RAW without an embedded JPEG, HEIC
      // in Chrome/Firefox) is expected; only other failures are errors.
      return formatLabel ? (
        <div
          className="w-full h-full rounded-md shadow-sm ring-1 bg-orange-900/20 ring-orange-700 flex items-center justify-center"
          title={t('previewNotSupported')}
        >
          <div className="text-center p-2">
            <div className="w-8 h-8 mx-auto mb-1 text-orange-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            </div>
            <div className="text-orange-400 text-xs font-medium">{formatLabel}</div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full rounded-md shadow-sm ring-1 bg-red-900/20 ring-red-700 flex items-center justify-center">
          <div className="text-red-400 text-xs text-center p-2">
            {t('thumbnailLoadFailed')}
          </div>
        </div>
      );
    }

    return (
      <>
        {isLoading && (
          <div role="status" aria-label={t('loadingImage')} className="absolute inset-0 bg-slate-800 rounded-md shadow-sm ring-1 ring-slate-700 flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {src && (
          <img
            src={src}
            alt={fileName || t('photoThumbnailAlt')}
            className={`object-cover w-full h-full rounded-md shadow-sm transition-all duration-300 ring-1 ring-slate-700 group-hover:ring-sky-500 group-hover:scale-105 ${
              onClick ? 'cursor-pointer hover:brightness-110' : ''
            } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={handleImageLoad}
            onError={tryNextSource}
            loading="lazy"
            decoding="async"
          />
        )}
        {/* RAW file badge */}
        {photo.isRaw && (
          <div className="absolute top-1 right-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded font-medium shadow-sm">
            RAW
          </div>
        )}
      </>
    );
  };

  return (
    <div ref={containerRef} className="aspect-square group relative">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={t('viewPhotoAriaLabel', { name: fileName })}
          className="block w-full h-full rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {renderContent()}
        </button>
      ) : (
        renderContent()
      )}
    </div>
  );
};

export default Thumbnail;
