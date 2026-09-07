import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError, asApiError } from '@/api/errors';

import { useTranslation } from './use-translation';

/**
 * Bridges three error sources into one display path:
 *   1. Zod messages, which are i18n keys ("validation.passwordMin")
 *   2. server field errors (`ApiError.fieldErrors`)
 *   3. a server-level error with no field, shown as a form-wide banner
 *
 * Zod's `message` doubles as the i18n key, and any interpolation params the
 * key needs are read from the schema's own error params — which is why the
 * schemas never contain user-visible text.
 */
export function useFormErrors<T extends FieldValues>() {
  const { t } = useTranslation();

  /** Turns a Zod/RHF message into displayable text. */
  const translate = (message?: string, params?: Record<string, unknown>) => {
    if (!message) return undefined;
    // Anything that isn't a dotted key is already human text (rare).
    if (!message.includes('.')) return message;
    return t(message, { defaultValue: message, ...params });
  };

  /**
   * Applies a failed mutation's field errors onto the form.
   * Returns the error if it was NOT field-scoped, so the caller can render a
   * banner for it.
   */
  const applyServerErrors = (
    error: unknown,
    setError: UseFormSetError<T>
  ): ApiError | null => {
    const apiError = asApiError(error);
    const fields = apiError.fieldErrors;

    if (!fields || Object.keys(fields).length === 0) return apiError;

    let applied = false;
    for (const [field, messages] of Object.entries(fields)) {
      const message = messages?.[0];
      if (!message) continue;
      setError(field as Path<T>, { type: 'server', message });
      applied = true;
    }

    return applied ? null : apiError;
  };

  return { translate, applyServerErrors };
}

/** Zod messages carry interpolation params through `params`; surface them. */
export function messageParams(message: string): Record<string, unknown> {
  // Keys we interpolate are known and few; keeping the map here avoids
  // threading params through every schema definition.
  const KNOWN: Record<string, Record<string, unknown>> = {
    'validation.passwordMin': { count: 8 },
    'validation.fullNameParts': { count: 3 },
  };
  return KNOWN[message] ?? {};
}
