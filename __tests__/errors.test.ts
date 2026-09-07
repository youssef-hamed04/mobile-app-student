import { ApiError, isApiError, toApiError } from '@/api/errors';
import en from '@/i18n/locales/en.json';
import ar from '@/i18n/locales/ar.json';

/**
 * The error `code` is a contract between the backend and the UI: every screen
 * branches on it, and every student-facing message is looked up by it. Two
 * things must hold — the mapping is right, and *every* code has a message in
 * both languages. A missing key ships as an English string in an Arabic UI.
 */
describe('toApiError', () => {
  it('prefers the server code over the status fallback', () => {
    const e = toApiError(403, { code: 'DEVICE_NOT_AUTHORIZED', message: 'nope' });
    expect(e.code).toBe('DEVICE_NOT_AUTHORIZED');
    expect(e.status).toBe(403);
  });

  it('falls back to a status-derived code when the server sends none', () => {
    expect(toApiError(404, {}).code).toBe('NOT_FOUND');
    expect(toApiError(402, {}).code).toBe('PAYMENT_REQUIRED');
    expect(toApiError(429, {}).code).toBe('RATE_LIMITED');
    expect(toApiError(503, {}).code).toBe('MAINTENANCE');
  });

  it('rejects an unrecognised code rather than trusting it', () => {
    // A typo'd or malicious code must not reach the i18n lookup as-is.
    expect(toApiError(400, { code: 'TOTALLY_MADE_UP' }).code).toBe(
      'VALIDATION_ERROR'
    );
  });

  it('treats unknown 5xx as a server error', () => {
    expect(toApiError(511, {}).code).toBe('SERVER_ERROR');
  });

  it('marks only transient failures retryable', () => {
    expect(toApiError(503, { code: 'SERVER_ERROR' }).retryable).toBe(true);
    expect(toApiError(0, { code: 'NETWORK_OFFLINE' }).retryable).toBe(true);
    // A denial is a decision, not a fault — retrying it is wrong.
    expect(toApiError(403, { code: 'DEVICE_NOT_AUTHORIZED' }).retryable).toBe(false);
    expect(toApiError(402, { code: 'PAYMENT_REQUIRED' }).retryable).toBe(false);
  });

  it('carries field errors through for forms', () => {
    const e = toApiError(422, {
      code: 'VALIDATION_ERROR',
      errors: { phone: ['taken'] },
    });
    expect(e.fieldErrors?.phone).toEqual(['taken']);
  });

  it('is identifiable across module boundaries', () => {
    expect(isApiError(toApiError(500, {}))).toBe(true);
    expect(isApiError(new Error('plain'))).toBe(false);
  });
});

describe('error message coverage', () => {
  const codes = Object.keys(en.errors).filter(
    (k) => k === k.toUpperCase() && k !== 'TITLE'
  );

  it('has at least one code to check', () => {
    expect(codes.length).toBeGreaterThan(20);
  });

  it.each(codes)('%s has an Arabic translation', (code) => {
    expect((ar.errors as Record<string, unknown>)[code]).toBeTruthy();
  });

  it.each(codes)('%s has a non-technical English message', (code) => {
    const message = (en.errors as any)[code]!;
    expect(message.length).toBeGreaterThan(10);
    // Student-facing copy must not leak jargon.
    expect(message).not.toMatch(/\b(null|undefined|stack|exception|HTTP \d)\b/i);
  });
});
