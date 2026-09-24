import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * Environment configuration.
 *
 * Everything here comes from EXPO_PUBLIC_* variables which are inlined into
 * the bundle at build time. That means NOTHING in this file may ever be a
 * secret: signing keys, R2 credentials, DRM certificates and license-server
 * secrets all live on the NestJS backend, never in the app.
 */

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

const schema = z.object({
  env: z.enum(['development', 'staging', 'production']),
  apiUrl: z.string().url('EXPO_PUBLIC_API_URL must be a valid absolute URL'),
  useMocks: boolish,
  apiTimeout: z.coerce.number().int().positive().max(120_000),
  support: z.object({
    phone: z.string().min(1),
    whatsapp: z.string().min(1),
    email: z.string().email(),
  }),
  features: z.object({
    drm: boolish,
    rootDetection: boolish,
    queryPersistence: boolish,
  }),
  playbackTicketTtlSeconds: z.coerce.number().int().positive(),
  /**
   * Public web pages the stores require to be reachable from inside the app.
   * Optional so development builds work without them; when absent the About
   * screen falls back to contacting support.
   */
  legal: z.object({
    privacyPolicyUrl: z.string().url().optional(),
    termsUrl: z.string().url().optional(),
    accountDeletionUrl: z.string().url().optional(),
  }),
  appVariant: z.string(),
  appVersion: z.string(),
});

export type Env = z.infer<typeof schema>;

function read(): Env {
  const raw = {
    env: process.env.EXPO_PUBLIC_ENV ?? 'development',
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1',
    // Defaults to FALSE. The safe direction is to fail toward the real API:
    // a missing .env should surface as a connection error the developer
    // notices immediately, not as a screen full of convincing fake courses.
    useMocks: process.env.EXPO_PUBLIC_USE_MOCKS ?? 'false',
    apiTimeout: process.env.EXPO_PUBLIC_API_TIMEOUT ?? 20_000,
    support: {
      phone: process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '+201000000000',
      whatsapp: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '+201000000000',
      email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com',
    },
    features: {
      drm: process.env.EXPO_PUBLIC_ENABLE_DRM ?? 'false',
      rootDetection: process.env.EXPO_PUBLIC_ENABLE_ROOT_DETECTION ?? 'true',
      queryPersistence: process.env.EXPO_PUBLIC_ENABLE_QUERY_PERSISTENCE ?? 'true',
    },
    playbackTicketTtlSeconds: process.env.EXPO_PUBLIC_PLAYBACK_TICKET_TTL ?? 300,
    legal: {
      privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || undefined,
      termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || undefined,
      accountDeletionUrl: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL || undefined,
    },
    appVariant: (Constants.expoConfig?.extra?.variant as string) ?? 'development',
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
  };

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    // Fail loudly at startup rather than shipping a half-configured build.
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration.\n${issues}\n\n` +
        'Check your .env.<variant> file or the EAS build profile in eas.json.'
    );
  }

  return parsed.data;
}

export const env = read();

export const isDev = env.env === 'development';
export const isProd = env.env === 'production';

/**
 * Mocks are only ever allowed outside production, no matter what the env
 * variable says — this prevents a misconfigured store build from silently
 * serving fake courses.
 */
export const useMocks = env.useMocks && !isProd;
