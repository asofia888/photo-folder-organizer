/// <reference lib="webworker" />
// Web Worker for processing photo data without blocking the main thread.
// exifr is bundled by Vite (no CDN dependency).
import exifr from 'exifr';

const FILE_SIZE_LIMITS = {
    SKIP: 100 * 1024 * 1024,     // 100MB - Skip completely
    WARNING: 50 * 1024 * 1024,   // 50MB - Process but warn
    OPTIMAL: 20 * 1024 * 1024    // 20MB - Optimal processing
};

const BATCH_SIZE = 8; // Process files in batches to reduce memory pressure

// RAW file detection
const isRawFile = (fileName: string): boolean => {
    return /\.(cr2|cr3|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|pef|srw|x3f|kdc|dcr|mrw|3fr|fff|iiq|rwl)$/i.test(fileName);
};

// RAW file size limits
const RAW_FILE_SIZE_LIMITS = {
    SKIP: 200 * 1024 * 1024,    // 200MB - Skip completely
    WARNING: 100 * 1024 * 1024, // 100MB - Process but warn
    OPTIMAL: 50 * 1024 * 1024   // 50MB - Optimal processing
};

self.onmessage = async (e: MessageEvent) => {
    try {
        const { folderFileGroups, dateLogic } = e.data;
        const allProcessedFolders: any[] = [];
        const totalFolders = folderFileGroups.length;
        const totalFiles = folderFileGroups.reduce((sum: number, group: any) => sum + group.files.length, 0);
        let processedFiles = 0;

        self.postMessage({
            type: 'start',
            payload: {
                totalFolders,
                totalFiles,
                phase: 'processing'
            }
        });

        for (let i = 0; i < folderFileGroups.length; i++) {
            const group = folderFileGroups[i];

            if (group.files.length === 0) continue;

            // Filter files by size before processing (different limits for RAW vs regular files)
            const validFiles = group.files.filter((file: File) => {
                const sizeLimit = isRawFile(file.name) ? RAW_FILE_SIZE_LIMITS.SKIP : FILE_SIZE_LIMITS.SKIP;
                if (file.size > sizeLimit) {
                    console.warn('Skipping large file:', file.name, 'Size:', Math.round(file.size / 1024 / 1024) + 'MB');
                    return false;
                }

                // Warn for large RAW files
                if (isRawFile(file.name) && file.size > RAW_FILE_SIZE_LIMITS.WARNING) {
                    console.warn('Large RAW file detected:', file.name, 'Size:', Math.round(file.size / 1024 / 1024) + 'MB');
                }

                return true;
            });

            if (validFiles.length === 0) {
                processedFiles += group.files.length;
                continue;
            }

            self.postMessage({
                type: 'progress',
                payload: {
                    processedFolders: i + 1,
                    totalFolders,
                    processedFiles,
                    totalFiles,
                    currentFolderName: group.originalName,
                    phase: 'processing',
                    memoryUsage: (self.performance as any)?.memory?.usedJSHeapSize || 0
                }
            });

            // Process files in batches to reduce memory pressure
            const photoResults: any[] = [];

            for (let batchStart = 0; batchStart < validFiles.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, validFiles.length);
                const batch = validFiles.slice(batchStart, batchEnd);

                const batchPromises = batch.map(async (file: File) => {
                    try {
                        let date: Date | null = null;
                        let thumbnailUrl: string | null = null;
                        let isRaw = false;

                        if (isRawFile(file.name)) {
                            isRaw = true;

                            // Process RAW file
                            try {
                                // Extract EXIF data
                                const exifData = await exifr.parse(file, {
                                    pick: ['DateTimeOriginal', 'CreateDate'],
                                    translateKeys: true,
                                    reviveValues: true
                                });
                                date = exifData?.DateTimeOriginal || exifData?.CreateDate || null;

                                // Try to extract thumbnail
                                try {
                                    const thumbnailBuffer = await (exifr as any).extractThumbnail(file);
                                    if (thumbnailBuffer && thumbnailBuffer.byteLength > 0) {
                                        const thumbnailBlob = new Blob([thumbnailBuffer], {
                                            type: 'image/jpeg'
                                        });
                                        thumbnailUrl = URL.createObjectURL(thumbnailBlob);
                                        console.log('RAW thumbnail extracted:', file.name, thumbnailBuffer.byteLength + ' bytes');
                                    } else {
                                        console.warn('No thumbnail found in RAW file:', file.name);
                                    }
                                } catch (thumbnailError: any) {
                                    console.warn('Thumbnail extraction failed for', file.name, ':', thumbnailError.message);
                                }
                            } catch (rawError: any) {
                                console.warn('RAW file processing failed for', file.name, ':', rawError.message);
                            }
                        } else {
                            // Process regular image file
                            try {
                                const exifData = await exifr.parse(file, {
                                    pick: ['DateTimeOriginal', 'CreateDate'],
                                    translateKeys: true,
                                    reviveValues: true
                                });
                                date = exifData?.DateTimeOriginal || exifData?.CreateDate || null;
                            } catch (exifError) {
                                // Expected for files without EXIF
                            }
                        }

                        return {
                            id: file.name + file.lastModified,
                            date,
                            file,
                            thumbnailUrl,
                            isRaw
                        };
                    } catch (fileError) {
                        console.error('Error processing file in worker:', file.name, fileError);
                        return null;
                    }
                });

                const batchResults = (await Promise.all(batchPromises)).filter((p) => p !== null);
                photoResults.push(...batchResults);
                processedFiles += batch.length;

                // Send progress update for file-level progress
                self.postMessage({
                    type: 'file-progress',
                    payload: {
                        processedFiles,
                        totalFiles,
                        currentFolder: group.originalName,
                        batchProgress: batchEnd / validFiles.length
                    }
                });

                // Small delay to prevent blocking
                if (batchStart % (BATCH_SIZE * 3) === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                }
            }

            if (photoResults.length === 0) continue;

            const validDates = photoResults.map((p) => p.date).filter((d) => d instanceof Date);

            let representativeDate: Date | null = null;
            if (validDates.length > 0) {
                representativeDate = new Date(Math[dateLogic === 'earliest' ? 'min' : 'max'](...validDates.map((d: Date) => d.getTime())));
            }

            const photos = photoResults.map((p) => ({
                id: p.id,
                date: p.date?.toISOString() ?? '',
                file: p.file,
                isRaw: p.isRaw,
                thumbnailUrl: p.thumbnailUrl,
            }));

            allProcessedFolders.push({
                id: group.id,
                originalName: group.originalName,
                photos,
                representativeDate,
                newName: '',
                isRenamed: false,
            });
        }

        self.postMessage({ type: 'done', payload: allProcessedFolders });
    } catch (workerError: any) {
        console.error('Unhandled error in worker:', workerError);
        self.postMessage({ type: 'error', error: workerError.message || 'An unknown error occurred in the background processor.' });
    }
};
