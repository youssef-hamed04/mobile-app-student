/**
 * Tailwind / NativeWind configuration.
 *
 * All colors resolve to CSS variables that are re-bound per theme in
 * src/theme/global.css. This is what lets Light and Dark Mode be two
 * *intentionally designed* palettes rather than an inversion.
 */
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ---- Brand (fixed, identical in both themes) --------------------
        // Both ramps hold a single hue and walk lightness, so a step is always
        // "same colour, more or less of it". The hues are sampled straight off
        // the logo artwork: the plate at H34, the ink at H358.
        brand: {
          50: '#FFF5E8',
          100: '#FFE9CC',
          200: '#FED39A',
          300: '#FCC173',
          400: '#FBB150', // the mark's orange plate — ink it dark, never white
          500: '#F99B1F',
          600: '#DD8108',
          650: '#A85F06', // AA-safe with white text
          700: '#935606',
          800: '#734407',
          900: '#4E3009',
        },
        danger: {
          50: '#FFEDEE',
          100: '#FFD6D8',
          200: '#FFB8BB',
          300: '#FD9095',
          400: '#F44E54',
          500: '#D52027', // the mark's ink
          600: '#AF1D22',
          700: '#92161B',
          800: '#700F13',
          900: '#4D0A0C',
        },
        ink: {
          0: '#FFFFFF',
          50: '#F7F7F8',
          100: '#EFEFF1',
          200: '#E1E1E5',
          300: '#C8C8CF',
          400: '#9A9AA5',
          500: '#6E6E7A',
          600: '#4A4A55',
          700: '#2E2E37',
          800: '#1A1A20',
          900: '#101014',
          950: '#0B0B0D',
        },

        // ---- Semantic (theme-aware via CSS variables) -------------------
        background: withOpacity('--color-background'),
        surface: withOpacity('--color-surface'),
        'surface-alt': withOpacity('--color-surface-alt'),
        'surface-raised': withOpacity('--color-surface-raised'),
        border: withOpacity('--color-border'),
        'border-strong': withOpacity('--color-border-strong'),
        outline: withOpacity('--color-outline'),
        foreground: withOpacity('--color-foreground'),
        muted: withOpacity('--color-muted'),
        subtle: withOpacity('--color-subtle'),
        primary: withOpacity('--color-primary'),
        'primary-fg': withOpacity('--color-primary-fg'),
        'primary-soft': withOpacity('--color-primary-soft'),
        highlight: withOpacity('--color-highlight'),
        'highlight-fg': withOpacity('--color-highlight-fg'),
        accent: withOpacity('--color-accent'),
        'accent-fg': withOpacity('--color-accent-fg'),
        'accent-soft': withOpacity('--color-accent-soft'),
        success: withOpacity('--color-success'),
        warning: withOpacity('--color-warning'),
        info: withOpacity('--color-info'),
        disabled: withOpacity('--color-disabled'),
        'disabled-fg': withOpacity('--color-disabled-fg'),
        overlay: withOpacity('--color-overlay'),
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        heading: ['Inter-SemiBold', 'System'],
        arabic: ['Cairo', 'System'],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '22px',
        '2xl': '28px',
      },
      borderWidth: {
        3: '3px',
      },
      spacing: {
        4.5: '18px',
        13: '52px',
        18: '72px',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
    },
  },
  plugins: [],
};
