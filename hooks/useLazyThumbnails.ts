import { useState, useCallback, useRef, useEffect } from 'react';
import MemoryManager from '../utils/memoryManager';

interface ThumbnailCache {
    url: string;
    lastUsed: number;
}

const MAX_CACHE_SIZE = 50; // Maximum number of URLs to keep in memory
const CLEANUP_INTERVAL = 30000; // 30 seconds

export const useLazyThumbnails = () => {
    const [thumbnailUrls] = useState(() => new Map<File, ThumbnailCache>());
    const cleanupTimer = useRef<NodeJS.Timeout>();
    const memoryManager = useRef(MemoryManager.getInstance());

    // Cleanup old URLs periodically to prevent memory leaks
    const scheduleCleanup = useCallback(() => {
        if (cleanupTimer.current) {
            clearTimeout(cleanupTimer.current);
        }

        cleanupTimer.current = setTimeout(() => {
            const now = Date.now();
            const entries = Array.from(thumbnailUrls.entries());
            
            // Sort by last used time and keep only the most recent ones
            const sortedEntries = entries.sort(([, a], [, b]) => b.lastUsed - a.lastUsed);
            
            // Remove old entries
            if (sortedEntries.length > MAX_CACHE_SIZE) {
                const toRemove = sortedEntries.slice(MAX_CACHE_SIZE);
                toRemove.forEach(([file, cache]) => {
                    URL.revokeObjectURL(cache.url);
                    thumbnailUrls.delete(file);
                });
            }
            
            // Remove entries older than 5 minutes
            const fiveMinutesAgo = now - 5 * 60 * 1000;
            entries.forEach(([file, cache]) => {
                if (cache.lastUsed < fiveMinutesAgo) {
                    URL.revokeObjectURL(cache.url);
                    thumbnailUrls.delete(file);
                }
            });
            
            scheduleCleanup(); // Schedule next cleanup
        }, CLEANUP_INTERVAL);
    }, [thumbnailUrls]);

    const getThumbnailUrl = useCallback((file: File): string => {
        const existing = thumbnailUrls.get(file);
        
        if (existing) {
            // Update last used time
            existing.lastUsed = Date.now();
            return existing.url;
        }

        // Check if memory usage is high, use memory manager's efficient thumbnails
        if (memoryManager.current.isMemoryUsageHigh()) {
            // For high memory situations, create efficient thumbnails
            memoryManager.current.createThumbnailUrl(file).then(url => {
                thumbnailUrls.set(file, {
                    url,
                    lastUsed: Date.now()
                });
            });
            
            // Return a temporary placeholder URL while processing
            const tempUrl = URL.createObjectURL(file);
            thumbnailUrls.set(file, {
                url: tempUrl,
                lastUsed: Date.now()
            });
            scheduleCleanup();
            return tempUrl;
        }

        // Create new URL normally
        const url = URL.createObjectURL(file);
        thumbnailUrls.set(file, {
            url,
            lastUsed: Date.now()
        });

        scheduleCleanup();
        return url;
    }, [thumbnailUrls, scheduleCleanup]);

    const preloadThumbnails = useCallback((files: File[], maxCount: number = 10) => {
        // Preload a limited number of thumbnails for better UX
        files.slice(0, maxCount).forEach(file => {
            if (!thumbnailUrls.has(file)) {
                getThumbnailUrl(file);
            }
        });
    }, [getThumbnailUrl, thumbnailUrls]);

    const revokeThumbnail = useCallback((file: File) => {
        const cache = thumbnailUrls.get(file);
        if (cache) {
            URL.revokeObjectURL(cache.url);
            thumbnailUrls.delete(file);
        }
    }, [thumbnailUrls]);

    const revokeAllThumbnails = useCallback(() => {
        thumbnailUrls.forEach(cache => {
            URL.revokeObjectURL(cache.url);
        });
        thumbnailUrls.clear();
        
        if (cleanupTimer.current) {
            clearTimeout(cleanupTimer.current);
        }
    }, [thumbnailUrls]);

    const getCacheStats = useCallback(() => {
        const systemStats = memoryManager.current.getMemoryStats();
        return {
            size: thumbnailUrls.size,
            maxSize: MAX_CACHE_SIZE,
            memoryUsage: thumbnailUrls.size * 0.5, // Rough estimate in MB
            systemMemory: systemStats.systemMemory,
            isHighMemory: memoryManager.current.isMemoryUsageHigh()
        };
    }, [thumbnailUrls]);

    // Register with memory manager and cleanup on unmount
    useEffect(() => {
        const cleanup = memoryManager.current.registerCleanupCallback(() => {
            // Emergency cleanup - remove half of the thumbnails
            const entries = Array.from(thumbnailUrls.entries());
            const toRemove = entries
                .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)
                .slice(0, Math.floor(entries.length / 2));
            
            toRemove.forEach(([file, cache]) => {
                URL.revokeObjectURL(cache.url);
                thumbnailUrls.delete(file);
            });
        });

        return () => {
            cleanup();
            revokeAllThumbnails();
        };
    }, [revokeAllThumbnails, thumbnailUrls]);

    // Start cleanup schedule
    useEffect(() => {
        scheduleCleanup();
        return () => {
            if (cleanupTimer.current) {
                clearTimeout(cleanupTimer.current);
            }
        };
    }, [scheduleCleanup]);

    return {
        getThumbnailUrl,
        preloadThumbnails,
        revokeThumbnail,
        revokeAllThumbnails,
        getCacheStats
    };
};