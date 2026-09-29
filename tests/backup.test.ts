import { describe, expect, it } from 'vitest';
import { backupFileName, makeBackup, parseCopy } from '../src/backup.ts';
import { newKey, seal, unseal } from '../src/vault.ts';

describe('encrypted copies', () => {
  it('round-trips through a file and opens only with the password', async () => {
    const sealed = await seal(await newKey('four random words here'), '{"savings":{"current":42}}');
    const text = JSON.stringify(makeBackup(sealed, new Date('2026-09-29T00:00:00Z')));
    expect(text).not.toContain('42}');
    const parsed = parseCopy(text);
    expect(parsed.kind).toBe('encrypted');
    if (parsed.kind !== 'encrypted') return;
    expect(parsed.file.savedAt).toBe('2026-09-29T00:00:00.000Z');
    expect((await unseal(parsed.file.sealed, 'four random words here')).text).toBe('{"savings":{"current":42}}');
    await expect(unseal(parsed.file.sealed, 'wrong words')).rejects.toThrow();
  });

  it('still accepts a plain plan from an older export', () => {
    expect(parseCopy('{"meta":{"name":"x"}}').kind).toBe('plain');
  });

  it('rejects anything else', () => {
    expect(() => parseCopy('not json')).toThrow('not a plan copy');
    expect(() => parseCopy('{"hello":1}')).toThrow('not a plan copy');
    expect(() => parseCopy('{"app":"financial-planning","kind":"encrypted-plan","sealed":{}}')).toThrow('damaged');
  });

  it('names files by date', () => {
    expect(backupFileName(new Date('2026-09-29T12:00:00Z'))).toBe('financial-plan-2026-09-29.json');
  });
});
