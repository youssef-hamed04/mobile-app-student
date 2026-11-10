import { registerAcademicSchema, registerSchema } from '@/features/auth/schemas';

/**
 * Owner decision D1: the registration wizard does not ask the student to pick
 * GENERAL / PROGRAMS. The academic system is the college's configuration,
 * resolved by the API from the chosen department (`/catalog/academic-selection`).
 *
 * Upstream commits on origin/main (c30964d, 2d6a890, d31f51e) add a required
 * `studyType` to these schemas. This test is what fails if that is merged in
 * without a new product decision.
 */
describe('registration has no student-chosen study type', () => {
  it('is absent from both the academic step and the full payload schema', () => {
    expect(Object.keys(registerAcademicSchema.shape)).not.toContain('studyType');
    expect(Object.keys(registerSchema.shape)).not.toContain('studyType');
  });

  it('accepts a complete academic step without one', () => {
    const parsed = registerAcademicSchema.safeParse({
      universityId: 'uni_1',
      facultyId: 'fac_1',
      departmentId: 'dep_1',
      academicYearId: 'yr_1',
      gender: 'FEMALE',
    });
    expect(parsed.success).toBe(true);
  });

  it('still requires every unit the server uses to resolve the system', () => {
    const parsed = registerAcademicSchema.safeParse({ gender: 'MALE' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path[0]);
      expect(paths).toEqual(
        expect.arrayContaining(['universityId', 'facultyId', 'departmentId', 'academicYearId']),
      );
    }
  });
});
