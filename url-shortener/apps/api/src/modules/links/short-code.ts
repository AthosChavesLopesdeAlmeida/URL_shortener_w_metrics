import { randomInt } from 'node:crypto';
import { RESERVED_CODES } from '@shortener/shared';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const SHORT_CODE_LENGTH = 7;

export function generateShortCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < SHORT_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    if (!(RESERVED_CODES as readonly string[]).includes(code.toLowerCase())) return code;
  }
}