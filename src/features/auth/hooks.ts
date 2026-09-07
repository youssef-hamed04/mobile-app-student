import { useMutation, useQuery } from '@tanstack/react-query';

import { qk } from '@/api/query-keys';
import { useTranslation } from '@/hooks/use-translation';
import { localizedName } from '@/utils/format';

import { catalogApi, devicesApi } from './api';

/**
 * Catalog hooks for the registration wizard.
 *
 * The three levels are dependent: faculties need a university, departments
 * need a faculty. `enabled` keeps the query idle until its parent is chosen,
 * which is what makes the Select show a proper empty state instead of an
 * error.
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

export function useDepartments(facultyId: string | null) {
  const { language } = useTranslation();

  return useQuery({
    queryKey: qk.catalog.departments(facultyId ?? 'none'),
    queryFn: () => catalogApi.departments(facultyId!),
    enabled: !!facultyId,
    staleTime: 30 * 60_000,
    select: (list) =>
      list.map((d) => ({ value: d.id, label: localizedName(d, language) })),
  });
}

export function useAcademicYears() {
  const { language } = useTranslation();

  return useQuery({
    queryKey: qk.catalog.academicYears(),
    queryFn: catalogApi.academicYears,
    staleTime: 60 * 60_000,
    select: (list) =>
      [...list]
        .sort((a, b) => a.order - b.order)
        .map((y) => ({ value: y.id, label: localizedName(y, language) })),
  });
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
