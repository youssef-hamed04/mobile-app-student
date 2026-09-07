import type { ApiErrorBody, ApiErrorCode } from '@/types/api';

/**
 * Normalized error shape. Every failure in the app — transport, HTTP, mock,
 * or thrown-in-a-hook — becomes one of these, so UI never has to inspect
 * axios internals and never renders a raw server message.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(params: {
    code: ApiErrorCode;
    status: number;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors;
    this.requestId = params.requestId;
    this.retryable = RETRYABLE.has(params.code);
  }

  /** i18n key for a student-facing message. */
  get i18nKey(): string {
    return `errors.${this.code}`;
  }
}

const RETRYABLE = new Set<ApiErrorCode>([
  'NETWORK_OFFLINE',
  'NETWORK_TIMEOUT',
  'SERVER_ERROR',
  'RATE_LIMITED',
  'PLAYBACK_TICKET_EXPIRED',
]);

/** Errors that must terminate the session and bounce to login. */
export const SESSION_ENDING = new Set<ApiErrorCode>([
  'SESSION_EXPIRED',
  'ACCOUNT_DISABLED',
]);

/** Errors that mean "this device may not view protected content". */
export const DEVICE_ERRORS = new Set<ApiErrorCode>([
  'DEVICE_NOT_AUTHORIZED',
  'DEVICE_LIMIT_REACHED',
  'DEVICE_CHANGE_PENDING',
  'DEVICE_INTEGRITY_FAILED',
]);

const STATUS_FALLBACK: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  402: 'PAYMENT_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'VALIDATION_ERROR',
  410: 'ACCESS_EXPIRED',
  422: 'VALIDATION_ERROR',
  426: 'APP_UPDATE_REQUIRED',
  429: 'RATE_LIMITED',
  503: 'MAINTENANCE',
};

const KNOWN_CODES = new Set<string>([
  'NETWORK_OFFLINE','NETWORK_TIMEOUT','SERVER_ERROR','UNKNOWN','VALIDATION_ERROR',
  'RATE_LIMITED','MAINTENANCE','APP_UPDATE_REQUIRED','INVALID_CREDENTIALS',
  'UNAUTHORIZED','SESSION_EXPIRED','ACCOUNT_DISABLED','ACCOUNT_PENDING',
  'PHONE_ALREADY_REGISTERED','DEVICE_NOT_AUTHORIZED','DEVICE_LIMIT_REACHED',
  'DEVICE_CHANGE_PENDING','DEVICE_INTEGRITY_FAILED','FORBIDDEN','NOT_FOUND',
  'COURSE_NOT_AVAILABLE','COURSE_ARCHIVED','ACCESS_EXPIRED','NOT_ENROLLED',
  'ENROLLMENT_PENDING','PAYMENT_REQUIRED','PAYMENT_FAILED','INVALID_CODE',
  'CODE_ALREADY_USED','PLAYBACK_DENIED','PLAYBACK_TICKET_EXPIRED',
  'CONCURRENT_STREAM_LIMIT','VIDEO_NOT_READY','VIDEO_UNAVAILABLE','CAPTURE_DETECTED',
]);

export function toApiError(status: number, body: unknown): ApiError {
  const parsed = (body ?? {}) as Partial<ApiErrorBody>;
  const rawCode = typeof parsed.code === 'string' ? parsed.code : undefined;

  const code: ApiErrorCode =
    rawCode && KNOWN_CODES.has(rawCode)
      ? (rawCode as ApiErrorCode)
      : (STATUS_FALLBACK[status] ?? (status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN'));

  return new ApiError({
    code,
    status,
    message: parsed.message ?? `Request failed with status ${status}`,
    fieldErrors: parsed.errors,
    requestId: parsed.requestId,
  });
}

export const networkError = (timeout: boolean) =>
  new ApiError({
    code: timeout ? 'NETWORK_TIMEOUT' : 'NETWORK_OFFLINE',
    status: 0,
    message: timeout ? 'Request timed out' : 'No network connection',
  });

export const unknownError = (e: unknown) =>
  new ApiError({
    code: 'UNKNOWN',
    status: 0,
    message: e instanceof Error ? e.message : 'Unexpected error',
  });

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function asApiError(e: unknown): ApiError {
  return isApiError(e) ? e : unknownError(e);
}
