import type { Language } from '@/store/language-store';
import type { Money } from '@/types/domain';

const LOCALE: Record<Language, string> = { en: 'en-US', ar: 'ar-EG' };

/**
 * Arabic-Indic digits are the norm in Egyptian academic contexts, but they
 * hurt scannability inside a video timeline. `numeric: 'latn'` is therefore
 * forced for durations and timecodes and left to the locale everywhere else.
 */
function nf(lang: Language, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(LOCALE[lang], opts);
}

export function formatNumber(value: number, lang: Language): string {
  return nf(lang).format(value);
}

export function formatCompact(value: number, lang: Language): string {
  return nf(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number, lang: Language): string {
  return nf(lang, { maximumFractionDigits: 0 }).format(Math.round(value)) + '%';
}

export function formatMoney(money: Money | null, lang: Language): string | null {
  if (!money) return null;
  try {
    return new Intl.NumberFormat(LOCALE[lang], {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: money.amount % 1 === 0 ? 0 : 2,
    }).format(money.amount);
  } catch {
    return `${money.amount} ${money.currency}`;
  }
}

/** hh:mm:ss / mm:ss — always latin digits so the timeline stays scannable. */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "1h 24m" / "٥٤ د" — human duration for cards and lists. */
export function formatDuration(totalSeconds: number, lang: Language): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  const n = (v: number) => nf(lang).format(v);

  if (h > 0 && m > 0) return lang === 'ar' ? `${n(h)} س ${n(m)} د` : `${n(h)}h ${n(m)}m`;
  if (h > 0) return lang === 'ar' ? `${n(h)} س` : `${n(h)}h`;
  return lang === 'ar' ? `${n(m)} د` : `${n(m)}m`;
}

export function formatBytes(bytes: number | null, lang: Language): string | null {
  if (bytes == null) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${nf(lang, { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v)} ${units[i]}`;
}

export function formatDate(iso: string | null, lang: Language): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE[lang], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(iso: string | null, lang: Language): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE[lang], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnitSingular, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.34524],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/**
 * Manual fallback for engines without `Intl.RelativeTimeFormat` — notably
 * Hermes on Android, which supports `NumberFormat`/`DateTimeFormat` but not
 * this API. Not grammatically exhaustive, just readable.
 */
const RELATIVE_UNIT_LABEL: Record<
  Language,
  Record<Intl.RelativeTimeFormatUnitSingular, string>
> = {
  en: {
    second: 'second',
    minute: 'minute',
    hour: 'hour',
    day: 'day',
    week: 'week',
    month: 'month',
    quarter: 'quarter',
    year: 'year',
  },
  ar: {
    second: 'ثانية',
    minute: 'دقيقة',
    hour: 'ساعة',
    day: 'يوم',
    week: 'أسبوع',
    month: 'شهر',
    quarter: 'ربع سنة',
    year: 'سنة',
  },
};

function formatRelativeManual(
  value: number,
  unit: Intl.RelativeTimeFormatUnitSingular,
  lang: Language
): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return lang === 'ar' ? 'الآن' : 'just now';

  const label = RELATIVE_UNIT_LABEL[lang][unit] + (lang === 'en' && n !== 1 ? 's' : '');
  if (lang === 'ar') return value < 0 ? `منذ ${n} ${label}` : `خلال ${n} ${label}`;
  return value < 0 ? `${n} ${label} ago` : `in ${n} ${label}`;
}

const supportsRelativeTimeFormat = typeof Intl.RelativeTimeFormat === 'function';

export function formatRelative(iso: string | null, lang: Language): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '—';

  let delta = (d - Date.now()) / 1000;
  const rtf = supportsRelativeTimeFormat
    ? new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' })
    : null;

  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) {
      const rounded = Math.round(delta);
      return rtf ? rtf.format(rounded, unit) : formatRelativeManual(rounded, unit, lang);
    }
    delta /= size;
  }
  const rounded = Math.round(delta);
  return rtf ? rtf.format(rounded, 'year') : formatRelativeManual(rounded, 'year', lang);
}

/** Localized entity name with graceful fallback (Arabic names are optional). */
export function localizedName(
  entity: { name: string; nameAr?: string | null } | null | undefined,
  lang: Language
): string {
  if (!entity) return '—';
  if (lang === 'ar' && entity.nameAr) return entity.nameAr;
  return entity.name;
}

/** "Ahmed Mohamed Ali Hassan" -> "AM" for avatar fallbacks. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

/** Masks a phone for display: 0100****789 */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 4)}${'*'.repeat(Math.max(0, phone.length - 7))}${phone.slice(-3)}`;
}
