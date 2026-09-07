import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import type {
  AcademicYear,
  AuthorizedDevice,
  Department,
  Faculty,
  University,
  User,
} from '@/types/domain';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  phone: string;
  password: string;
  universityId: string;
  facultyId: string;
  departmentId: string;
  academicYearId: string;
  gender: 'MALE' | 'FEMALE';
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>(Endpoints.auth.login, payload, { anonymous: true }),

  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>(Endpoints.auth.register, payload, { anonymous: true }),

  /** Best-effort: a failed logout must never trap the student in the app. */
  logout: () => api.post<{ ok: boolean }>(Endpoints.auth.logout, {}, { retries: 0 }),

  me: () => api.get<User>(Endpoints.auth.me),
};

export const catalogApi = {
  universities: () => api.get<University[]>(Endpoints.catalog.universities, undefined, {
    anonymous: true,
  }),
  faculties: (universityId: string) =>
    api.get<Faculty[]>(Endpoints.catalog.faculties(universityId), undefined, {
      anonymous: true,
    }),
  departments: (facultyId: string) =>
    api.get<Department[]>(Endpoints.catalog.departments(facultyId), undefined, {
      anonymous: true,
    }),
  academicYears: () =>
    api.get<AcademicYear[]>(Endpoints.catalog.academicYears, undefined, {
      anonymous: true,
    }),
};

export const devicesApi = {
  list: () => api.get<AuthorizedDevice[]>(Endpoints.devices.list),
  requestChange: (reason: string) =>
    api.post<{ ok: boolean; status: string }>(Endpoints.devices.requestChange, {
      reason,
    }),
};
