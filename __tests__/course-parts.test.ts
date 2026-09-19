import { hasSellableParts, unownedParts } from '@/features/course-parts/hooks';
import type { CoursePart, CoursePartsResponse } from '@/types/domain';

/**
 * Course-part ownership.
 *
 * Two mistakes this pins down, both of which would show a student the wrong
 * thing about what they have paid for:
 *
 *  - Offering a part for purchase to someone who already holds it through a
 *    whole-course grant. The backend reports that as `ownedVia: 'FULL_COURSE'`
 *    with `owned: true`, and treating it as unowned would invite them to buy
 *    what they already have.
 *  - Rendering a "Parts" heading for a course that is sold whole. `hasParts:
 *    false` is a legitimate answer and must be distinguishable from a load
 *    failure.
 */

const part = (over: Partial<CoursePart> = {}): CoursePart => ({
  id: 'p1',
  title: 'Part 1',
  titleAr: null,
  description: null,
  sortOrder: 1,
  price: 150,
  pricePercent: 60,
  currency: 'EGP',
  owned: false,
  ownedSince: null,
  ownedVia: null,
  purchasable: true,
  sectionCount: 2,
  sections: [],
  ...over,
});

const response = (over: Partial<CoursePartsResponse> = {}): CoursePartsResponse => ({
  courseId: 'c1',
  hasParts: true,
  coursePrice: 250,
  ownsAllParts: false,
  parts: [part()],
  ...over,
});

describe('unownedParts', () => {
  it('lists the parts the student does not hold', () => {
    const data = response({
      parts: [part({ id: 'p1', owned: true }), part({ id: 'p2', owned: false })],
    });

    expect(unownedParts(data).map((p) => p.id)).toEqual(['p2']);
  });

  it('treats a part owned through the whole course as owned', () => {
    const data = response({
      parts: [part({ id: 'p1', owned: true, ownedVia: 'FULL_COURSE' })],
    });

    expect(unownedParts(data)).toEqual([]);
  });

  it('is empty when every part is held', () => {
    expect(unownedParts(response({ ownsAllParts: true }))).toEqual([]);
  });

  it('is empty for a course sold whole', () => {
    expect(unownedParts(response({ hasParts: false, parts: [] }))).toEqual([]);
  });

  it('is empty while the data is still loading', () => {
    expect(unownedParts(undefined)).toEqual([]);
  });
});

describe('hasSellableParts', () => {
  it('is true only when the course really has parts', () => {
    expect(hasSellableParts(response())).toBe(true);
  });

  it.each([
    ['sold whole', response({ hasParts: false, parts: [] })],
    ['flagged as parted but empty', response({ parts: [] })],
    ['not loaded', undefined],
  ])('is false when %s', (_label, data) => {
    expect(hasSellableParts(data as CoursePartsResponse | undefined)).toBe(false);
  });
});
