import { z } from 'zod';

import { MIN_NAME_PARTS, MIN_PASSWORD_LENGTH } from '@/constants';

/**
 * Validation schemas.
 *
 * Messages are i18n *keys*, not text. The form layer resolves them with
 * `t(message, params)` so a single schema serves both languages and the
 * server's own field errors can be merged into the same display path.
 */

const nameParts = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

/** Arabic + Latin letters, spaces, and the Arabic tatweel. Nothing else. */
const NAME_CHARS = /^[\p{Script=Arabic}\p{Script=Latin}\s'’.ـ-]+$/u;

/**
 * Egyptian mobile numbers, tolerant of the shapes students actually type:
 *   01012345678 · +201012345678 · 00201012345678
 * Normalisation to the canonical 01XXXXXXXXX form happens in `normalizePhone`.
 */
const PHONE = /^(?:\+?20|0020|0)?1[0125]\d{8}$/;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s()-]/g, '');
  const stripped = digits.replace(/^(?:\+?20|0020)/, '');
  return stripped.startsWith('0') ? stripped : `0${stripped}`;
}

export const phoneSchema = z
  .string()
  .min(1, 'validation.required')
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => PHONE.test(v), 'validation.phoneInvalid')
  .transform(normalizePhone);

/**
 * The new-password policy, mirrored from the backend
 * (`edu-backend/src/modules/auth/password-policy.ts`), which is the authority.
 * Used at registration only. An Arabic *letter* counts as both cases — Arabic
 * digits and punctuation do not; Arabic-Indic digits count as digits.
 */
const LATIN_LOWER = /[a-z]/;
const LATIN_UPPER = /[A-Z]/;
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/u;
const DIGIT = /[0-9٠-٩۰-۹]/;
const LETTER = /\p{L}/u;

const COMMON_PASSWORDS = new Set([
  'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd',
  'p@ssword1', 'qwerty123', 'qwerty1234', 'qwertyuiop1', 'welcome1', 'welcome123',
  'admin123', 'admin1234', 'admin@123', 'abc12345', 'abc123456', 'abcd1234', 'abcde123',
  'iloveyou1', 'letmein1', 'student1', 'student123', 'teacher1', 'teacher123',
]);

/** Not a well-known password, ≥5 different characters, not "Aa123456". */
function isGuessable(value: string): boolean {
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return true;
  const chars = Array.from(value);
  if (new Set(chars).size < 5) return true;
  const letters = chars.filter((c) => LETTER.test(c)).length;
  const digits = chars.filter((c) => DIGIT.test(c)).length;
  return letters <= 2 && digits >= 6;
}

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'validation.passwordMin')
  .refine((v) => LATIN_LOWER.test(v) || ARABIC_LETTER.test(v), 'validation.passwordLower')
  .refine((v) => LATIN_UPPER.test(v) || ARABIC_LETTER.test(v), 'validation.passwordUpper')
  .refine((v) => DIGIT.test(v), 'validation.passwordDigit')
  .refine((v) => !isGuessable(v), 'validation.passwordCommon');

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine((v) => NAME_CHARS.test(v), 'validation.fullNameChars')
  .refine((v) => nameParts(v) >= MIN_NAME_PARTS, 'validation.fullNameParts');

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  phone: phoneSchema,
  // Login does not re-apply complexity rules: an existing account may predate
  // the current policy, and rejecting it client-side would lock the student
  // out of a password the server still accepts.
  password: z.string().min(1, 'validation.required'),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Registration — split per wizard step so each step validates independently
// ---------------------------------------------------------------------------

export const registerAccountSchema = z
  .object({
    fullName: fullNameSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'validation.required'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'validation.passwordMatch',
    path: ['confirmPassword'],
  });

/**
 * The academic half of registration.
 *
 * No study type and no academic system: the student names a university, a
 * college, a department and the rung they are on, and whether that rung is
 * "First Year" or "Level 100" is the college's configuration resolved by the
 * server. The web app used to require a study type that this app never sent, so
 * against the same backend one client registered and the other was rejected.
 */
export const registerAcademicSchema = z.object({
  universityId: z.string().min(1, 'validation.selectOption'),
  facultyId: z.string().min(1, 'validation.selectOption'),
  departmentId: z.string().min(1, 'validation.selectOption'),
  academicYearId: z.string().min(1, 'validation.selectOption'),
  gender: z.enum(['MALE', 'FEMALE'], { message: 'validation.selectOption' }),
});

export const registerSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  universityId: z.string().min(1, 'validation.selectOption'),
  facultyId: z.string().min(1, 'validation.selectOption'),
  departmentId: z.string().min(1, 'validation.selectOption'),
  academicYearId: z.string().min(1, 'validation.selectOption'),
  gender: z.enum(['MALE', 'FEMALE']),
});

export type RegisterAccountValues = z.output<typeof registerAccountSchema>;
export type RegisterAcademicValues = z.output<typeof registerAcademicSchema>;
export type RegisterValues = z.output<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

// No change-password schema: students cannot change their own password (the
// administration resets it), so there is no form for one to validate.

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
});

export const accessCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'validation.codeFormat')
    .transform((v) => v.toUpperCase()),
});

// ---------------------------------------------------------------------------
// Password strength meter (UI only — the server enforces the real policy)
// ---------------------------------------------------------------------------

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export function passwordStrength(value: string): {
  score: number;
  level: PasswordStrength;
} {
  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  const level: PasswordStrength =
    score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';

  return { score: Math.min(score, 5), level };
}
