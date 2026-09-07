type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

/**
 * Tiny className joiner. Deliberately not `tailwind-merge`: NativeWind
 * resolves conflicting utilities itself, and pulling in tw-merge costs
 * bundle size for behaviour we don't need on native.
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [k, on] of Object.entries(v)) if (on) out.push(k);
  };

  inputs.forEach(walk);
  return out.join(' ');
}
