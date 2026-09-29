/**
 * Password-encrypted storage for the plan on this device.
 * AES-GCM with a key derived from the password by PBKDF2 (SHA-256).
 * Nothing leaves the device; a wrong password simply fails to decrypt.
 */
export interface Sealed {
  v: 1;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

const ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (u: Uint8Array) => {
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface VaultKey {
  key: CryptoKey;
  salt: Uint8Array;
  iterations: number;
}

export async function deriveKey(password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<VaultKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, salt, iterations };
}

export async function newKey(password: string): Promise<VaultKey> {
  return deriveKey(password, crypto.getRandomValues(new Uint8Array(16)));
}

export async function seal(k: VaultKey, text: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k.key, enc.encode(text)));
  return { v: 1, iterations: k.iterations, salt: toB64(k.salt), iv: toB64(iv), data: toB64(data) };
}

/** Decrypt with a password. Throws WrongPassword when it does not match. */
export async function unseal(sealed: Sealed, password: string): Promise<{ key: VaultKey; text: string }> {
  const key = await deriveKey(password, fromB64(sealed.salt), sealed.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) as BufferSource }, key.key, fromB64(sealed.data) as BufferSource);
    return { key, text: dec.decode(plain) };
  } catch {
    throw new WrongPassword();
  }
}

export class WrongPassword extends Error {
  constructor() {
    super('That password is not right.');
  }
}

export function isSealed(x: unknown): x is Sealed {
  return !!x && typeof x === 'object' && (x as Sealed).v === 1 && typeof (x as Sealed).data === 'string';
}
