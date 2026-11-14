import { describe, expect, it } from 'vitest';
import { authErrorKey, MIN_PASSWORD, validateCredentials } from './auth';
import { hasText } from './texter';

describe('validateCredentials', () => {
  it('godkänner giltig e-post och lösenord på minst 8 tecken', () => {
    expect(validateCredentials('a@b.se', '12345678')).toBeNull();
    expect(validateCredentials('  a@b.se ', 'x'.repeat(40))).toBeNull();
  });

  it('underkänner felaktig e-post före lösenordet', () => {
    expect(validateCredentials('', '')).toBe('login.fel-epost');
    expect(validateCredentials('a@b', '12345678')).toBe('login.fel-epost');
    expect(validateCredentials('ab.se', '12345678')).toBe('login.fel-epost');
  });

  it('underkänner lösenord kortare än 8 tecken', () => {
    expect(MIN_PASSWORD).toBe(8);
    expect(validateCredentials('a@b.se', '')).toBe('login.kort-losenord');
    expect(validateCredentials('a@b.se', '1234567')).toBe('login.kort-losenord');
  });
});

describe('authErrorKey', () => {
  it('fel uppgifter', () => {
    expect(authErrorKey({ code: 'invalid_credentials', status: 400 })).toBe('login.fel-uppgifter');
  });

  it('konto finns redan', () => {
    expect(authErrorKey({ code: 'user_already_exists', status: 422 })).toBe('login.finns-redan');
    expect(authErrorKey({ code: 'email_exists', status: 422 })).toBe('login.finns-redan');
  });

  it('för kort lösenord från servern', () => {
    expect(authErrorKey({ code: 'weak_password', status: 422 })).toBe('login.kort-losenord');
  });

  it('avstängd nyregistrering', () => {
    expect(authErrorKey({ code: 'signup_disabled', status: 422 })).toBe('allmant.registrering-stangd');
  });

  it('status 429 och gränser för antal försök', () => {
    expect(authErrorKey({ status: 429 })).toBe('login.for-manga');
    expect(authErrorKey({ code: 'over_request_rate_limit' })).toBe('login.for-manga');
  });

  it('allt annat blir allmant.fel', () => {
    expect(authErrorKey({ code: 'unexpected_failure', status: 500 })).toBe('allmant.fel');
    expect(authErrorKey(new Error('Failed to fetch'))).toBe('allmant.fel');
    expect(authErrorKey(null)).toBe('allmant.fel');
    expect(authErrorKey('text')).toBe('allmant.fel');
  });

  it('alla nycklar finns i texterna', () => {
    const keys = ['login.fel-epost', 'login.kort-losenord', 'login.fel-uppgifter', 'login.finns-redan', 'login.for-manga', 'allmant.fel', 'allmant.registrering-stangd'];
    for (const k of keys) expect(hasText(k)).toBe(true);
  });
});
