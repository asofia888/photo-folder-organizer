import React, { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';
import { ThumbnailProps } from '../types/componentTypes';
import { useLazyThumbnails } from '../hooks/useLazyThumbnails';
import { ErrorType, ErrorSeverity, handleError } from '../utils/errorHandler';

const Thumbnail: React.FC<ThumbnailProps> = ({ photo, onClick, lazy = true, onLoad }) => {
  const { getThumbnailUrl } = useLazyThumbnails();
  const [isVisible, setIsVisible] = useState(!lazy);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
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

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isVisible]);

  const handleImageLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    handleError(
      `Failed to load image: ${img.src}`,
      ErrorType.FILE_NOT_FOUND,
      ErrorSeverity.LOW,
      {
        imageSrc: img.src,
        fileName: photo.file?.name || 'unknown',
        fileSize: photo.file?.size || 0
      }
    );
    setIsLoading(false);
    setHasError(true);
  };

  const getThumbnailSrc = (): string => {
    // For RAW files, prioritize extracted thumbnail URL
    if (photo.isRaw && photo.thumbnailUrl) {
      return photo.thumbnailUrl;
    }
    
    // If we already have a URL from the old system, use it
    if (photo.url && photo.url !== 'null' && !photo.url.startsWith('blob:')) {
      return photo.url;
    }
    
    // Use lazy thumbnail system for regular image files
    if (photo.file && !photo.isRaw) {
      return getThumbnailUrl(photo.file);
    }
    
    // Fallback for RAW files without thumbnails or other edge cases
    return photo.url || '';
  };

  return (
    <div ref={imgRef} className="aspect-w-1 aspect-h-1 group relative">
      {!isVisible ? (
        // Placeholder while not visible
        <div className="w-full h-full bg-slate-800 rounded-md shadow-sm ring-1 ring-slate-700 flex items-center justify-center">
          <div className="w-8 h-8 text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        </div>
      ) : hasError || (photo.isRaw && !photo.thumbnailUrl) ? (
        // Error placeholder or RAW file without thumbnail
        <div className={`w-full h-full rounded-md shadow-sm ring-1 flex items-center justify-center ${
          photo.isRaw && !photo.thumbnailUrl 
            ? 'bg-orange-900/20 ring-orange-700' 
            : 'bg-red-900/20 ring-red-700'
        }`}>
          <div className="text-center p-2">
            {photo.isRaw && !photo.thumbnailUrl ? (
              <>
                <div className="w-8 h-8 mx-auto mb-1 text-orange-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                </div>
                <div className="text-orange-400 text-xs font-medium">RAW</div>
              </>
            ) : (
              <div className="text-red-400 text-xs text-center">
                Failed to load
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 bg-slate-800 rounded-md shadow-sm ring-1 ring-slate-700 flex items-center justify-center z-10">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <img
            src={getThumbnailSrc()}
            alt="Photo thumbnail"
            className={`object-cover w-full h-full rounded-md shadow-sm transition-all duration-300 ring-1 ring-slate-700 group-hover:ring-sky-500 group-hover:scale-105 ${
              onClick ? 'cursor-pointer hover:brightness-110' : ''
            } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            onClick={onClick}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
          {/* RAW file badge */}
          {photo.isRaw && photo.thumbnailUrl && (
            <div className="absolute top-1 right-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded font-medium shadow-sm">
              RAW
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Thumbnail;