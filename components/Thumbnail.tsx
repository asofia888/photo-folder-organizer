import React from 'react';
import { Photo } from '../types';

interface ThumbnailProps {
  photo: Photo;
  onClick?: () => void;
}

const Thumbnail: React.FC<ThumbnailProps> = ({ photo, onClick }) => {
  return (
    <div className="aspect-w-1 aspect-h-1 group">
      <img
        src={photo.url}
        alt="Photo thumbnail"
        className={`object-cover w-full h-full rounded-md shadow-sm transition-all duration-300 ring-1 ring-slate-700 group-hover:ring-sky-500 group-hover:scale-105 ${
          onClick ? 'cursor-pointer hover:brightness-110' : ''
        }`}
        onClick={onClick}
      />
    </div>
  );
};

export default Thumbnail;