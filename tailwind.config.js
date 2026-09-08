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
        brand: {
          50: '#FFF1E4',
          100: '#FFE1C7',
          200: '#FFC79B',
          300: '#FFA96C',
          400: '#FF914C', // the mark's orange plate — ink it with black
          500: '#F97316',
          600: '#E25C0B',
          650: '#C94A0A', // AA-safe with white text
          700: '#A93E08',
          800: '#823009',
          900: '#59210A',
        },
        danger: {
          50: '#FFF1F1',
          100: '#FFDCDC',
          200: '#FFBABA',
          300: '#FF8D8D',
          400: '#F65A5A',
          500: '#E0322F', // brand red
          600: '#C01F1F',
          700: '#9B1717',
          800: '#761414',
          900: '#4E0F0F',
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
