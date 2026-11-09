import * as fs from 'fs';
import * as path from 'path';

/**
 * Course discovery scope, mobile side.
 *
 * The backend scopes every student query to the student's own university,
 * faculty and department (CourseAccessService.studentCourseWhere) and adds no
 * academic-year term, so a search spans every year of the student's own
 * faculty. The app must not undo that by sending the student's own year with
 * a search.
 */
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

describe('search scope', () => {
  it('sends only the query and the entity, never an academic scope', () => {
    const hooks = read('src/features/search/hooks.ts');
    expect(hooks).toMatch(/Endpoints\.search\.query,\s*\{ q: debouncedTerm, entity \}/);
    expect(hooks).not.toMatch(/academicYearId|facultyId|universityId|departmentId/);
  });
});

describe('teacher search result', () => {
  it('the Courses tab applies the teacherId the result route carries', () => {
    const screen = read('src/app/(tabs)/courses.tsx');
    expect(screen).toMatch(/useLocalSearchParams<\{ teacherId\?: string \}>/);
    expect(screen).toMatch(/teacherId: teacherId \?\? undefined/);
  });
});
