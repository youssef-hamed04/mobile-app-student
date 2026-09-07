/** Shared REST envelope contract with the NestJS backend. */

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  statusCode: number;
  /** Machine-readable code — the ONLY thing the UI branches on. */
  code: ApiErrorCode;
  /** Developer-facing message. Never rendered to students verbatim. */
  message: string;
  /** Field -> messages, for form-level errors. */
  errors?: Record<string, string[]>;
  requestId?: string;
}

export type ApiErrorCode =
  // transport / generic
  | 'NETWORK_OFFLINE'
  | 'NETWORK_TIMEOUT'
  | 'SERVER_ERROR'
  | 'UNKNOWN'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'MAINTENANCE'
  | 'APP_UPDATE_REQUIRED'
  // auth
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_PENDING'
  | 'PHONE_ALREADY_REGISTERED'
  // device binding
  | 'DEVICE_NOT_AUTHORIZED'
  | 'DEVICE_LIMIT_REACHED'
  | 'DEVICE_CHANGE_PENDING'
  | 'DEVICE_INTEGRITY_FAILED'
  // access
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'COURSE_NOT_AVAILABLE'
  | 'COURSE_ARCHIVED'
  | 'ACCESS_EXPIRED'
  | 'NOT_ENROLLED'
  | 'ENROLLMENT_PENDING'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_FAILED'
  | 'INVALID_CODE'
  | 'CODE_ALREADY_USED'
  // playback
  | 'PLAYBACK_DENIED'
  | 'PLAYBACK_TICKET_EXPIRED'
  | 'CONCURRENT_STREAM_LIMIT'
  | 'VIDEO_NOT_READY'
  | 'VIDEO_UNAVAILABLE'
  | 'CAPTURE_DETECTED';

export interface RequestOptions {
  signal?: AbortSignal;
  /** Skip the Authorization header (login/register/refresh). */
  anonymous?: boolean;
  /** Do not attempt a silent refresh on 401 (used by the refresh call itself). */
  skipRefresh?: boolean;
  /** Override the default retry policy for this call. */
  retries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}
