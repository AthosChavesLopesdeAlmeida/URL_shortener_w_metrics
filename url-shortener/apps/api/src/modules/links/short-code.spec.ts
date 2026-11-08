import { describe, expect, it } from 'vitest';
import { RESERVED_CODES } from '@shortener/shared';
import { generateShortCode, SHORT_CODE_LENGTH } from './short-code.js';

describe('generateShortCode', () => {
  it('generates code with the configured size', () => {
    expect(generateShortCode()).toHaveLength(SHORT_CODE_LENGTH);
  });

  it('uses only Base62 characters', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateShortCode()).toMatch(/^[0-9A-Za-z]+$/);
    }
  });

  it('never generates reserved code', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateShortCode().toLowerCase();
      expect(RESERVED_CODES as readonly string[]).not.toContain(code);
    }
  });

  it('generates different codes throughout calls', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateShortCode()));
    expect(codes.size).toBe(1000);
  });
});