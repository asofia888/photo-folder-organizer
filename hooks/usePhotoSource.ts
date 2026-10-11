import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Photo } from '../types';

/**
 * Resolves what an <img> should show for a photo. Candidates are tried in
 * order — the original file (unless it is RAW), then the embedded preview the
 * worker extracted — and the next one is used when the browser can't decode
 * the current one (e.g. HEIC outside Safari). Object URLs are created only
 * while `enabled` and revoked when the source changes or the caller unmounts.
 */
export const usePhotoSource = (photo: Photo | null, enabled = true) => {
  const candidates = useMemo<Blob[]>(() => {
    if (!photo) return [];
    const list: Blob[] = [];
    if (photo.file && !photo.isRaw) list.push(photo.file);
    if (photo.thumbnail) list.push(photo.thumbnail);
    return list;
  }, [photo]);

  // Which candidate is in use; starts over whenever the photo changes.
  const [attempt, setAttempt] = useState({ candidates, index: 0 });
  if (attempt.candidates !== candidates) {
    setAttempt({ candidates, index: 0 });
  }
  const index = attempt.candidates === candidates ? attempt.index : 0;
  const current = enabled ? candidates[index] : undefined;

  const [resolved, setResolved] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!current) {
      setResolved(null);
      return;
    }
    const url = URL.createObjectURL(current);
    setResolved({ blob: current, url });
    return () => URL.revokeObjectURL(url);
  }, [current]);

  const tryNextSource = useCallback(() => {
    setAttempt(prev => ({ ...prev, index: prev.index + 1 }));
  }, []);

  return {
    src: current && resolved?.blob === current ? resolved.url : null,
    tryNextSource,
    // Nothing (left) to show: no candidates, or every candidate failed.
    exhausted: enabled && index >= candidates.length,
  };
};
