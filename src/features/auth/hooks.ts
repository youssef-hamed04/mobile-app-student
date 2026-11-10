import { useMutation, useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { qk } from '@/api/query-keys';
import { useTranslation } from '@/hooks/use-translation';
import { localizedName } from '@/utils/format';

import { catalogApi, devicesApi, type AcademicSelectionScope } from './api';

/**
 * Catalog hooks for the registration wizard.
 *
 * The levels are dependent: faculties need a university, departments need a
 * faculty. `enabled` keeps each query idle until its parent is chosen, which is
 * what makes the Select show a proper empty state instead of an error.
 *
 * The year/level picker additionally depends on the college, because a college's
 * academic system is its own configuration — a level-based college inside a
 * year-based university, or the reverse. The student chooses nothing about it.
 */

export function useUniversities() {
  const { language } = useTranslation();

  return useQuery({
    queryKey: qk.catalog.universities(),
    queryFn: catalogApi.universities,
    staleTime: 30 * 60_000,
    select: (list) =>
      list.map((u) => ({ value: u.id, label: localizedName(u, language) })),
  });
}

export function useFaculties(universityId: string | null) {
  const { language } = useTranslation();

  return useQuery({
    queryKey: qk.catalog.faculties(universityId ?? 'none'),
    queryFn: () => catalogApi.faculties(universityId!),
    enabled: !!universityId,
    staleTime: 30 * 60_000,
    select: (list) =>
      list.map((f) => ({ value: f.id, label: localizedName(f, language) })),
  });
}

export function useDepartments(facultyId: string | null, studyType?: 'GENERAL' | 'PROGRAMS') {
  const { language } = useTranslation();

  return useQuery({
    queryKey: [...qk.catalog.departments(facultyId ?? 'none'), studyType ?? 'all'],
    queryFn: () => catalogApi.departments(facultyId!, studyType),
    enabled: !!facultyId,
    staleTime: 30 * 60_000,
    // `studyType` rides along so a screen can DESCRIBE the chosen department
    // (General / Programs) without a second request; nothing selects by it.
    select: (list) =>
      list.map((d) => ({ value: d.id, label: localizedName(d, language), studyType: d.studyType })),
  });
}

/**
 * Every rung that exists on the platform, as label options.
 *
 * For FILTERS, not for choosing. A catalogue filter legitimately wants the union
 * of every rung — "show me all third years and all Level 300s" is a sensible
 * thing to ask. Registration must NOT use this: a student picking their own rung
 * must be offered their own college's list, which is `useAcademicSelectionOptions`.
 *
 * The filter label stays generic for the same reason: a mixed list has no single
 * vocabulary.
 */
export function useAcademicYears(departmentId?: string) {
  const { language } = useTranslation();

  return useQuery({
    queryKey: [...qk.catalog.academicYears(), departmentId ?? 'all'],
    queryFn: () => catalogApi.academicYears(departmentId),
    staleTime: 60 * 60_000,
    select: (list) =>
      [...list]
        .sort((a, b) => a.order - b.order)
        .map((y) => ({ value: y.id, label: localizedName(y, language), kind: y.kind })),
  });
}

/**
 * The picker options plus the label the field should use, for one unit.
 *
 * Two facts that have to arrive together: whether this college counts in years
 * or in levels (its own configuration, resolved server-side) and the matching
 * entries. Returning them separately is how a levels student ended up reading
 * "الفرقة الدراسية" above a list of levels — the mobile app hardcoded the
 * year label because it had no way to know the college used levels.
 *
 * `scope` is null until a college is chosen, which keeps the query idle rather
 * than fetching the platform-wide list and then having to discard it.
 *
 * `system` is null when the college has no configured system, which the caller
 * renders as a message rather than as an empty dropdown.
 */
export function useAcademicSelectionOptions(scope: AcademicSelectionScope | null) {
  const { language } = useTranslation();

  const query = useQuery({
    queryKey: qk.catalog.academicSelection(scope ?? 'none'),
    queryFn: () => catalogApi.academicSelection(scope ?? {}),
    enabled: scope !== null,
    staleTime: 30 * 60_000,
  });

  const data = query.data;

  const options = React.useMemo(
    () =>
      [...(data?.academicYears ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((y) => ({ value: y.id, label: localizedName(y, language) })),
    // `language` is a dependency because the labels are built here: a language
    // change must rebuild them, and the memo would otherwise hand back the
    // previous language's labels from a cache hit.
    [data, language]
  );

  return {
    ...query,
    system: data?.academicSystem?.system ?? null,
    /**
     * The vocabulary the entries are written in. Normally `system`; they diverge
     * only when an administrator has changed a university default without
     * renaming its ladder, which is deliberate and never automatic.
     *
     * The label is chosen from this so it can never contradict the options — the
     * exact bug this app had before, where "الفرقة الدراسية" was shown above a
     * list of levels because the year label was hardcoded.
     */
    labelKind: data?.ladderKind ?? data?.academicSystem?.system ?? null,
    /** Whether an administrator has configured this college's system at all. */
    configured: data?.academicSystem != null,
    options,
  };
}

export function useAuthorizedDevices() {
  return useQuery({
    queryKey: qk.devices.list(),
    queryFn: devicesApi.list,
    staleTime: 5 * 60_000,
  });
}

export function useRequestDeviceChange() {
  return useMutation({
    mutationFn: (reason: string) => devicesApi.requestChange(reason),
  });
}
