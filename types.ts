export interface Photo {
  id: string;
  url: string;
  // Simulating EXIF date
  date: string; 
  file?: File;
}

export interface Folder {
  id: string;
  originalName: string;
  photos: Photo[];
  representativeDate: Date | null;
  newName: string;
  isRenamed: boolean;
}