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

/**
 * Which unit of the hierarchy the academic selection is being asked about.
 *
 * The API resolves a single owner, so exactly one id is sent. Most specific
 * wins, which is also how the API resolves.
 */
export type AcademicSelectionScope =
  | { departmentId: string; facultyId?: never; universityId?: never }
  | { facultyId: string; departmentId?: never; universityId?: never }
  | { universityId: string; departmentId?: never; facultyId?: never }
  | { departmentId?: never; facultyId?: never; universityId?: never };

/**
 * A college's resolved academic system plus the entries that match it.
 *
 * `academicSystem` is null when the college has no configured system. That is an
 * explicit state — the caller shows a message — rather than permission to guess.
 */
export interface AcademicSelectionResponse {
  academicSystem: {
    system: 'YEAR' | 'LEVEL';
    source: 'COLLEGE_OVERRIDE' | 'UNIVERSITY_DEFAULT';
    universityId: string | null;
    facultyId: string | null;
    universityDefault: 'YEAR' | 'LEVEL' | null;
    facultyOverride: 'YEAR' | 'LEVEL' | null;
  } | null;
  academicYears: AcademicYear[];
  /**
   * The vocabulary the returned entries are actually written in.
   *
   * Normally equal to `academicSystem.system`, but not after an administrator
   * changes a university default without also renaming its ladder — which does
   * not happen automatically and must not. The field's label is chosen from THIS
   * so it can never read "الفرقة الدراسية" above a list of levels.
   */
  ladderKind?: 'YEAR' | 'LEVEL' | null;
  /** False means the configuration and the ladder disagree; see above. */
  ladderMatchesSystem?: boolean;
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

/** The server's view of a deletion request (`POST /auth/account-deletion`). */
export interface AccountDeletionRequest {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'CANCELLED' | 'COMPLETED';
  requestedAt: string;
  scheduledFor: string;
  cancellable: boolean;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>(Endpoints.auth.login, payload, { anonymous: true }),

  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>(Endpoints.auth.register, payload, { anonymous: true }),

  /** Best-effort: a failed logout must never trap the student in the app. */
  logout: () =>
    api.post<{ ok: boolean }>(Endpoints.auth.logout, {}, { retries: 0 }),

  me: () => api.get<User>(Endpoints.auth.me),

  /**
   * Schedules deletion of the signed-in account. The server revokes every
   * session in the same call, so the caller tears the local session down next.
   */
  requestAccountDeletion: (password: string) =>
    api.post<AccountDeletionRequest>(Endpoints.auth.accountDeletion, { password }, { retries: 0 }),

  /** Phone + password, exactly like sign-in; no session exists at this point. */
  cancelAccountDeletion: (payload: LoginPayload) =>
    api.post<{ cancelled: true; requestId: string }>(
      Endpoints.auth.cancelAccountDeletion,
      payload,
      { anonymous: true, retries: 0 }
    ),
};

export const catalogApi = {
  universities: () =>
    api.get<University[]>(Endpoints.catalog.universities, undefined, {
      anonymous: true,
    }),
  faculties: (universityId: string) =>
    api.get<Faculty[]>(Endpoints.catalog.faculties(universityId), undefined, {
      anonymous: true,
    }),
  /** A college's departments; `studyType` narrows to one track (catalogue filters only). */
  departments: (facultyId: string, studyType?: 'GENERAL' | 'PROGRAMS') =>
    api.get<Department[]>(
      `${Endpoints.catalog.departments(facultyId)}${studyType ? `?studyType=${studyType}` : ''}`,
      undefined,
      { anonymous: true }
    ),
  /**
   * The platform-wide ladder, or a department's own when `departmentId` is
   * given (the course filter scopes it to the signed-in student's department).
   * Registration never calls this: it uses `academicSelection`.
   */
  academicYears: (departmentId?: string) =>
    api.get<AcademicYear[]>(
      `${Endpoints.catalog.academicYears}${departmentId ? `?departmentId=${departmentId}` : ''}`,
      undefined,
      { anonymous: true }
    ),
  /**
   * The college's resolved academic system AND its entries, in one call.
   *
   * The single request the registration wizard needs. It replaces the unscoped
   * `academicYears` call above, which returned the platform-wide ladder
   * regardless of the chosen college — so a student registering at a level-based
   * college was offered "First year … Fifth year".
   *
   * `anonymous` because registration happens before sign-in, exactly like the
   * three list calls beside it.
   */
  academicSelection: (scope: AcademicSelectionScope) =>
    api.get<AcademicSelectionResponse>(
      `${Endpoints.catalog.academicSelection}?${new URLSearchParams(
        Object.entries(scope).filter(([, value]) => Boolean(value)) as [
          string,
          string,
        ][]
      ).toString()}`,
      undefined,
      { anonymous: true }
    ),
};

export const devicesApi = {
  list: () => api.get<AuthorizedDevice[]>(Endpoints.devices.list),
  requestChange: (reason: string) =>
    api.post<{ ok: boolean; status: string }>(Endpoints.devices.requestChange, {
      reason,
    }),
};
