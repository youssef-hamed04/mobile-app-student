import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { assertFeatureEnabled } from '@/api/feature-guard';
import { releaseFeatures } from '@/config/release-features';
import type { Paginated } from '@/types/api';
import type {
  CourseDetail,
  CourseSection,
  CourseSummary,
  EnrollmentMethod,
  EnrollmentResult,
  HomeFeed,
} from '@/types/domain';

export interface CourseFilters {
  q?: string;
  universityId?: string;
  facultyId?: string;
  academicYearId?: string;
  teacherId?: string;
  free?: boolean;
  sort?: 'newest' | 'popular' | 'priceLow' | 'priceHigh';
}

export const coursesApi = {
  list: (filters: CourseFilters, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Paginated<CourseSummary>>(
      Endpoints.courses.list,
      { ...filters, page, pageSize },
      { signal }
    ),

  mine: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Paginated<CourseSummary>>(
      Endpoints.courses.myCourses,
      { page, pageSize },
      { signal }
    ),

  detail: (id: string, signal?: AbortSignal) =>
    api.get<CourseDetail>(Endpoints.courses.detail(id), undefined, { signal }),

  sections: (id: string, signal?: AbortSignal) =>
    api.get<CourseSection[]>(Endpoints.courses.sections(id), undefined, { signal }),

  enroll: async (id: string, method: EnrollmentMethod) => {
    if (method === 'PAYMENT') assertFeatureEnabled(releaseFeatures.digitalPurchases, 'purchases');
    if (method === 'CODE') assertFeatureEnabled(releaseFeatures.courseActivation, 'course activation');
    return api.post<EnrollmentResult>(Endpoints.courses.enroll(id), { method });
  },

  redeemCode: async (id: string, code: string) => {
    assertFeatureEnabled(releaseFeatures.courseActivation, 'course activation');
    return api.post<EnrollmentResult>(Endpoints.courses.redeemCode(id), { code });
  },

  homeFeed: (signal?: AbortSignal) =>
    api.get<HomeFeed>(Endpoints.home.feed, undefined, { signal }),
};
