import { describe, expect, it } from 'vitest';
import { parseDevice } from './device';
import { parseReferrer } from './referrer';

describe('parseDevice', () => {
  it('classifica por categoria', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    expect(parseDevice(iphone)).toBe('mobile');
    expect(parseDevice(chrome)).toBe('desktop');
    expect(parseDevice('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe('bot');
    expect(parseDevice('WhatsApp/2.23.20')).toBe('bot');
    expect(parseDevice(null)).toBe('other');
    expect(parseDevice('trash')).toBe('other');
  });
});

describe('parseReferrer', () => {
  it('reduces URL to the domain', () => {
    expect(parseReferrer('https://www.Google.com/search?q=x')).toBe('google.com');
  });
  it('returns null for direct access, trash and invalid schemas', () => {
    expect(parseReferrer(null)).toBeNull();
    expect(parseReferrer('is not url')).toBeNull();
    expect(parseReferrer('android-app://com.google.android.gm')).toBeNull();
  });
  it('ignores its own domain', () => {
    expect(parseReferrer('http://localhost:8080/links', ['localhost'])).toBeNull();
  });
});