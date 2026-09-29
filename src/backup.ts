/**
 * Encrypted copies of the plan for moving it between devices
 * (for example through iCloud Drive). A copy is only the scrambled plan:
 * it opens with the password it was saved under and nothing else.
 */
import { isSealed, type Sealed } from './vault.ts';

export interface BackupFile {
  app: 'financial-planning';
  kind: 'encrypted-plan';
  v: 1;
  savedAt: string;
  sealed: Sealed;
}

export function makeBackup(sealed: Sealed, now = new Date()): BackupFile {
  return { app: 'financial-planning', kind: 'encrypted-plan', v: 1, savedAt: now.toISOString(), sealed };
}

export function backupFileName(now = new Date()): string {
  return `financial-plan-${now.toISOString().slice(0, 10)}.json`;
}

export type ParsedCopy = { kind: 'encrypted'; file: BackupFile } | { kind: 'plain'; plan: unknown };

/** Accept an encrypted copy, or a plain plan exported by an older version. */
export function parseCopy(text: string): ParsedCopy {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not a plan copy.');
  }
  const d = data as Partial<BackupFile>;
  if (d && d.app === 'financial-planning' && d.kind === 'encrypted-plan') {
    if (!isSealed(d.sealed)) throw new Error('That copy is damaged.');
    return { kind: 'encrypted', file: d as BackupFile };
  }
  if (d && typeof d === 'object' && ('meta' in d || 'income' in d || 'savings' in d)) return { kind: 'plain', plan: data };
  throw new Error('That file is not a plan copy.');
}
