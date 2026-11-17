import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          primary: '#0A0A0A',
          secondary: '#FAFAFA',
          tertiary: '#D4D4D8',
          surface: '#FFFFFF',
          border: '#E5E5E5',
          divider: '#F4F4F5',
          muted: '#71717A',
          subtle: '#A1A1AA',
          success: '#16A34A',
          warning: '#CA8A04',
          error: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '0px',
      },
      boxShadow: {
        none: 'none',
        DEFAULT: 'none',
      },
    },
  },
  plugins: [],
};

export default config;
