import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { registerAcademicSchema, registerSchema } from '@/features/auth/schemas';
import {
  departmentLabelKey,
  progressionLabelKey,
  studyTypeLabelKey,
  studyTypeOf,
} from '@/features/auth/study-type';

/**
 * Owner decision (2026-11-10): study type is DERIVED from the department, never
 * a registration field. Upstream `main` briefly re-added a GENERAL / PROGRAMS
 * picker; these tests pin the reconciled behaviour: the schemas carry no such
 * field, a payload that still sends one is stripped rather than rejected, and
 * the only study-type logic in the app describes a department after the fact.
 */
describe('study type is derived from the department', () => {
  it('registration schemas have no studyType field and strip one an old form might send', () => {
    expect(Object.keys(registerAcademicSchema.shape)).not.toContain('studyType');
    expect(Object.keys(registerSchema.shape)).not.toContain('studyType');
    const parsed = registerAcademicSchema.parse({
      universityId: 'u',
      facultyId: 'f',
      departmentId: 'd',
      academicYearId: 'y',
      gender: 'MALE',
      studyType: 'PROGRAMS',
    } as never);
    expect('studyType' in parsed).toBe(false);
  });

  it('reads the department track and names it', () => {
    expect(studyTypeOf({ studyType: 'PROGRAMS' })).toBe('PROGRAMS');
    expect(studyTypeOf({ studyType: 'GENERAL' })).toBe('GENERAL');
    expect(studyTypeOf({})).toBeNull();
    expect(studyTypeOf(null)).toBeNull();
    expect(studyTypeLabelKey({ studyType: 'PROGRAMS' })).toBe('auth.programs');
    expect(studyTypeLabelKey({ studyType: 'GENERAL' })).toBe('auth.general');
    expect(studyTypeLabelKey(undefined)).toBeNull();
  });

  it('calls a programs department a Program and a general one a Department', () => {
    expect(departmentLabelKey({ studyType: 'PROGRAMS' })).toBe('auth.program');
    expect(departmentLabelKey({ studyType: 'GENERAL' })).toBe('auth.department');
    expect(departmentLabelKey(null)).toBe('auth.department');
  });

  it('labels the progression from the ladder kind first, the study type only as a fallback', () => {
    // The ladder's own vocabulary wins: a programs department inside a
    // year-based college shows years, as the backend intends.
    expect(progressionLabelKey({ kind: 'YEAR' }, { studyType: 'PROGRAMS' })).toBe('auth.academicYear');
    expect(progressionLabelKey({ kind: 'LEVEL' }, { studyType: 'GENERAL' })).toBe('auth.level');
    expect(progressionLabelKey(null, { studyType: 'PROGRAMS' })).toBe('auth.level');
    expect(progressionLabelKey(undefined, null)).toBe('auth.academicYear');
  });

  it('the screens derive, never ask: no study-type picker, department-scoped year filter', () => {
    const src = (rel: string) => readFileSync(join(__dirname, '..', 'src', rel), 'utf8');
    const register = src('app/(auth)/register.tsx');
    expect(register).not.toMatch(/name="studyType"/);
    expect(register).not.toMatch(/setValue\('studyType'/);
    expect(register).toMatch(/studyTypeLabelKey\(chosenDepartment\)/);
    expect(register).toMatch(/departmentLabelKey\(chosenDepartment\)/);
    const courses = src('app/(tabs)/courses.tsx');
    expect(courses).toMatch(/useAcademicYears\(user\?\.department\?\.id\)/);
    const profile = src('app/(tabs)/profile.tsx');
    expect(profile).toMatch(/progressionLabelKey\(user\.academicYear, user\.department\)/);
    for (const lang of ['en', 'ar']) {
      const dict = JSON.parse(src(`i18n/locales/${lang}.json`)) as { auth: Record<string, string> };
      for (const key of ['studyType', 'general', 'programs', 'program', 'level', 'academicYear', 'department']) {
        expect(typeof dict.auth[key]).toBe('string');
      }
    }
  });
});
