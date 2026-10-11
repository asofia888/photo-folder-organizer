// Remembers the names typed for a dropped folder, so a reload, a closed tab or
// "Organize another folder" doesn't throw the work away. Stored only in this
// browser's localStorage; nothing is sent anywhere.

import type { Folder } from '../types';
import { findFolderNameIssues } from './folderNaming';

const STORAGE_KEY = 'photoFolderOrganizer.nameDrafts';
const MAX_DRAFTS = 10;

interface DraftEntry {
  newName: string;
  isRenamed: boolean;
}

interface StoredDraft {
  root: string;
  updatedAt: number;
  // Keyed by folder id ("/<root>/<sub-folder>").
  folders: Record<string, DraftEntry>;
}

const isStoredDraft = (value: unknown): value is StoredDraft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<StoredDraft>;
  return typeof draft.root === 'string' && typeof draft.folders === 'object' && draft.folders !== null;
};

// Storage can be unavailable (private mode, blocked site data) or full;
// drafts are a convenience, so failures are ignored.
const readDrafts = (): StoredDraft[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isStoredDraft) : [];
  } catch {
    return [];
  }
};

const writeDrafts = (drafts: StoredDraft[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // ignore
  }
};

export const saveNameDraft = (root: string, folders: readonly Folder[]): void => {
  const others = readDrafts().filter(draft => draft.root !== root);
  const named = folders.filter(folder => folder.newName.trim());
  if (named.length === 0) {
    writeDrafts(others);
    return;
  }

  const draft: StoredDraft = {
    root,
    updatedAt: Date.now(),
    folders: Object.fromEntries(
      named.map(folder => [folder.id, { newName: folder.newName, isRenamed: folder.isRenamed }])
    ),
  };
  writeDrafts([draft, ...others].slice(0, MAX_DRAFTS));
};

/**
 * Puts saved names back onto freshly processed folders. A confirmed name that
 * no longer validates (dates can differ between runs, e.g. with the other date
 * rule) is made editable again so the user sees why.
 */
export const applyNameDraft = (
  root: string,
  folders: readonly Folder[],
  unknownDateLabel: string
): { folders: Folder[]; restoredCount: number } => {
  const draft = readDrafts().find(d => d.root === root);
  if (!draft) return { folders: [...folders], restoredCount: 0 };

  let restoredCount = 0;
  const restored = folders.map(folder => {
    const entry = draft.folders[folder.id];
    if (!entry || typeof entry.newName !== 'string') return folder;
    restoredCount++;
    return { ...folder, newName: entry.newName, isRenamed: entry.isRenamed === true };
  });

  const issues = findFolderNameIssues(restored, unknownDateLabel);
  return {
    folders: restored.map(folder =>
      folder.isRenamed && issues.has(folder.id) ? { ...folder, isRenamed: false } : folder
    ),
    restoredCount,
  };
};

export const clearNameDraft = (root: string): void => {
  writeDrafts(readDrafts().filter(draft => draft.root !== root));
};
