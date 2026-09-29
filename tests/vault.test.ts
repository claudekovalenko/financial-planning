import { describe, expect, it } from 'vitest';
import { isSealed, newKey, seal, unseal, WrongPassword } from '../src/vault.ts';

describe('vault', () => {
  it('round-trips with the right password and hides the plaintext', async () => {
    const key = await newKey('correct horse');
    const sealed = await seal(key, '{"savings":{"current":123456}}');
    expect(isSealed(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain('123456');
    const opened = await unseal(sealed, 'correct horse');
    expect(opened.text).toBe('{"savings":{"current":123456}}');
    // Re-sealing with the recovered key opens with the same password.
    const again = await seal(opened.key, 'second');
    expect((await unseal(again, 'correct horse')).text).toBe('second');
  });

  it('rejects a wrong password', async () => {
    const sealed = await seal(await newKey('right-one'), 'secret');
    await expect(unseal(sealed, 'wrong-one')).rejects.toBeInstanceOf(WrongPassword);
  });

  it('uses a fresh IV each time', async () => {
    const key = await newKey('abcdef');
    const a = await seal(key, 'same');
    const b = await seal(key, 'same');
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });
});
