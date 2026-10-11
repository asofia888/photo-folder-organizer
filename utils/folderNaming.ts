// Final folder names ("<date>_<name>") and their validation. Shared by the
// folder cards, the rename script and organize-to-computer so all three agree
// on what a folder will be called on disk.

import type { Folder } from '../types';
import { formatScriptDate } from './dateUtils';
import { createValidFolderName } from './typeGuards';

export type FolderNameIssue = 'invalid' | 'duplicate';

export const formatFolderDate = (date: Date | null, unknownDateLabel: string): string =>
  date ? formatScriptDate(date) : unknownDateLabel;

export const buildFinalFolderName = (
  folder: Pick<Folder, 'representativeDate' | 'newName'>,
  unknownDateLabel: string
): string => `${formatFolderDate(folder.representativeDate, unknownDateLabel)}_${folder.newName.trim()}`;

// Windows and macOS file systems are case-insensitive, and macOS may store
// names decomposed (NFD), so "Trip"/"trip" or composed/decomposed "が" would
// land on the same folder.
const collisionKey = (name: string): string => name.normalize('NFC').toLowerCase();

/**
 * Checks every folder that has a name entered. Returns the problem per folder
 * id: 'invalid' when the final name can't be used as a folder name, and
 * 'duplicate' when two folders would end up with the same final name.
 */
export const findFolderNameIssues = (
  folders: readonly Folder[],
  unknownDateLabel: string
): Map<string, FolderNameIssue> => {
  const issues = new Map<string, FolderNameIssue>();
  const idsByName = new Map<string, string[]>();

  for (const folder of folders) {
    if (!folder.newName.trim()) continue;

    const finalName = buildFinalFolderName(folder, unknownDateLabel);
    if (!createValidFolderName(finalName)) {
      issues.set(folder.id, 'invalid');
      continue;
    }

    const key = collisionKey(finalName);
    const ids = idsByName.get(key);
    if (ids) {
      ids.push(folder.id);
    } else {
      idsByName.set(key, [folder.id]);
    }
  }

  for (const ids of idsByName.values()) {
    if (ids.length > 1) {
      ids.forEach(id => issues.set(id, 'duplicate'));
    }
  }

  return issues;
};
