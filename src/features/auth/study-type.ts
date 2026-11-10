import type { AcademicYear, Department } from '@/types/domain';

/**
 * Study type is a property of the DEPARTMENT, never a choice the student makes.
 *
 * Owner decision (2026-11-10): registration asks for university, college and
 * department; whether a student is in the General or the Programs track follows
 * from the department they chose (Mansoura Engineering keeps its two tracks as
 * two colleges, each with its own departments), and whether their progression
 * is counted in years or levels follows from the college's configured ladder,
 * which the server resolves and labels (`academicSelection.ladderKind`).
 *
 * These helpers only DESCRIBE a chosen department for the review step, the
 * profile and the course filter; they decide nothing.
 */
export type StudyType = NonNullable<Department['studyType']>;

export function studyTypeOf(department: Pick<Department, 'studyType'> | null | undefined): StudyType | null {
  const value = department?.studyType;
  return value === 'GENERAL' || value === 'PROGRAMS' ? value : null;
}

/** i18n key for the study type's display name, or null when unknown. */
export function studyTypeLabelKey(department: Pick<Department, 'studyType'> | null | undefined): string | null {
  const type = studyTypeOf(department);
  if (type === 'PROGRAMS') return 'auth.programs';
  if (type === 'GENERAL') return 'auth.general';
  return null;
}

/** "Department" for a general-track department, "Program" for a programs-track one. */
export function departmentLabelKey(department: Pick<Department, 'studyType'> | null | undefined): string {
  return studyTypeOf(department) === 'PROGRAMS' ? 'auth.program' : 'auth.department';
}

/**
 * "Level" or "Academic year" for a progression rung.
 *
 * The ladder's own vocabulary wins when the server supplied it (`kind`); the
 * study type is only a fallback for payloads that predate it, because the
 * backend deliberately lets a programs department live in a year-based college.
 */
export function progressionLabelKey(
  rung: Pick<AcademicYear, 'kind'> | null | undefined,
  department: Pick<Department, 'studyType'> | null | undefined
): string {
  if (rung?.kind === 'LEVEL') return 'auth.level';
  if (rung?.kind === 'YEAR') return 'auth.academicYear';
  return studyTypeOf(department) === 'PROGRAMS' ? 'auth.level' : 'auth.academicYear';
}
