import { z } from 'zod';

import { MIN_NAME_PARTS, MIN_PASSWORD_LENGTH } from '@/constants';

/**
 * Validation schemas.
 *
 * Messages are i18n *keys*, not text. The form layer resolves them with
 * `t(message, params)` so a single schema serves both languages and the
 * server's own field errors can be merged into the same display path.
 */

const nameParts = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

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

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'validation.passwordMin')
  .refine((v) => /[a-z؀-ۿ]/.test(v), 'validation.passwordLower')
  .refine((v) => /[A-Z]/.test(v) || /[؀-ۿ]/.test(v), 'validation.passwordUpper')
  .refine((v) => /\d/.test(v), 'validation.passwordDigit');

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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'validation.required'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'validation.passwordMatch',
    path: ['confirmPassword'],
  });

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
