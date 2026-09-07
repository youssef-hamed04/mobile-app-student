import { isProd } from '@/config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN: Level = isProd ? 'warn' : 'debug';

/** Keys whose values must never reach a log sink. */
const REDACT = [
  'password',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'playbackToken',
  'ticket',
  'licenseUrl',
  'signature',
  'key',
  'secret',
  'phone',
];

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.some((r) => k.toLowerCase().includes(r))
      ? '«redacted»'
      : redact(v, depth + 1);
  }
  return out;
}

type Sink = (level: Level, scope: string, msg: string, meta?: unknown) => void;

const sinks: Sink[] = [];

/** Register a remote sink (Sentry, Datadog…) from the app entry point. */
export function addLogSink(sink: Sink) {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

function emit(level: Level, scope: string, msg: string, meta?: unknown) {
  if (ORDER[level] < ORDER[MIN]) return;
  const safeMeta = meta === undefined ? undefined : redact(meta);

  if (!isProd) {
    const fn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.info;
    fn(`[${scope}] ${msg}`, safeMeta ?? '');
  }

  for (const sink of sinks) {
    try {
      sink(level, scope, msg, safeMeta);
    } catch {
      /* a broken sink must never break the app */
    }
  }
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: unknown) => emit('debug', scope, msg, meta),
    info: (msg: string, meta?: unknown) => emit('info', scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit('warn', scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit('error', scope, msg, meta),
  };
}

export const logger = createLogger('app');
