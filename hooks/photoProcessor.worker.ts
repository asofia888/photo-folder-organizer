/// <reference lib="webworker" />
// Web Worker for processing photo data without blocking the main thread.
// exifr is bundled by Vite (no CDN dependency).
import exifr from 'exifr';
import { isRawFileName } from '../utils/typeGuards';
import { isValidDate, pickRepresentativeDate } from '../utils/dateUtils';
import type {
    Photo,
    PhotoProcessingRequest,
    PhotoProcessorMessage,
    ProcessedFolder,
    SkippedFile,
} from '../types';

const FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB
const RAW_FILE_SIZE_LIMIT = 200 * 1024 * 1024; // 200MB

const BATCH_SIZE = 8; // Process files in batches to reduce memory pressure

const post = (message: PhotoProcessorMessage) => self.postMessage(message);

interface ReadPhoto {
    readonly photo: Photo;
    readonly exifDate: Date | null;
    readonly fileDate: Date | null;
}

const readExifDate = async (file: File): Promise<Date | null> => {
    try {
        const exifData = await exifr.parse(file, {
            pick: ['DateTimeOriginal', 'CreateDate'],
            translateKeys: true,
            reviveValues: true
        });
        const date: unknown = exifData?.DateTimeOriginal ?? exifData?.CreateDate;
        return isValidDate(date) ? date : null;
    } catch {
        return null; // Expected for files without EXIF
    }
};

// RAW files can't be shown by the browser; use the JPEG preview they embed.
// It is posted back as a Blob: an object URL created here would be revoked as
// soon as this worker is terminated.
const readRawPreview = async (file: File): Promise<Blob | undefined> => {
    try {
        const bytes = await exifr.thumbnail(file);
        return bytes && bytes.byteLength > 0 ? new Blob([bytes], { type: 'image/jpeg' }) : undefined;
    } catch {
        return undefined;
    }
};

const readPhoto = async (file: File): Promise<ReadPhoto> => {
    const isRaw = isRawFileName(file.name);
    const [exifDate, thumbnail] = await Promise.all([
        readExifDate(file),
        isRaw ? readRawPreview(file) : Promise.resolve(undefined),
    ]);
    const fileDate = file.lastModified > 0 ? new Date(file.lastModified) : null;

    return {
        photo: {
            id: file.name + file.lastModified,
            date: (exifDate ?? fileDate)?.toISOString() ?? '',
            file,
            isRaw,
            thumbnail,
        },
        exifDate,
        fileDate,
    };
};

self.onmessage = async (e: MessageEvent<PhotoProcessingRequest>) => {
    try {
        const { folderFileGroups, dateLogic } = e.data;
        const processedFolders: ProcessedFolder[] = [];
        const skippedFiles: SkippedFile[] = [];
        const totalFolders = folderFileGroups.length;
        const totalFiles = folderFileGroups.reduce((sum, group) => sum + group.files.length, 0);
        let processedFiles = 0;

        post({ type: 'start', payload: { totalFolders, totalFiles, phase: 'processing' } });

        for (let i = 0; i < folderFileGroups.length; i++) {
            const group = folderFileGroups[i];

            if (group.files.length === 0) continue;

            const validFiles = group.files.filter(file => {
                const sizeLimit = isRawFileName(file.name) ? RAW_FILE_SIZE_LIMIT : FILE_SIZE_LIMIT;
                if (file.size > sizeLimit) {
                    skippedFiles.push({ folderName: group.originalName, fileName: file.name, reason: 'tooLarge' });
                    return false;
                }
                return true;
            });

            if (validFiles.length === 0) {
                processedFiles += group.files.length;
                continue;
            }

            post({
                type: 'progress',
                payload: {
                    processedFolders: i + 1,
                    totalFolders,
                    processedFiles,
                    totalFiles,
                    currentFolderName: group.originalName,
                    phase: 'processing',
                }
            });

            const photoResults: ReadPhoto[] = [];

            for (let batchStart = 0; batchStart < validFiles.length; batchStart += BATCH_SIZE) {
                const batch = validFiles.slice(batchStart, batchStart + BATCH_SIZE);

                const batchResults = await Promise.all(batch.map(async file => {
                    try {
                        return await readPhoto(file);
                    } catch (fileError) {
                        console.error('Error processing file in worker:', file.name, fileError);
                        skippedFiles.push({ folderName: group.originalName, fileName: file.name, reason: 'unreadable' });
                        return null;
                    }
                }));
                photoResults.push(...batchResults.filter((p): p is ReadPhoto => p !== null));
                processedFiles += batch.length;

                post({ type: 'file-progress', payload: { processedFiles, totalFiles } });

                // Yield between batches so progress messages get delivered.
                if (batchStart % (BATCH_SIZE * 3) === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                }
            }

            if (photoResults.length === 0) continue;

            const { date, isEstimated } = pickRepresentativeDate(photoResults, dateLogic);

            processedFolders.push({
                id: group.id,
                originalName: group.originalName,
                photos: photoResults.map(p => p.photo),
                representativeDate: date,
                dateIsEstimated: isEstimated,
            });
        }

        post({ type: 'done', payload: processedFolders, skippedFiles });
    } catch (workerError) {
        console.error('Unhandled error in worker:', workerError);
        post({
            type: 'error',
            error: workerError instanceof Error && workerError.message
                ? workerError.message
                : 'An unknown error occurred in the background processor.'
        });
    }
};
