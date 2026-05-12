import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const { fontFamily } = defaultTheme;

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Adrena foundation surface scale (elevate via tone, not shadow)
        main:        '#060d16',
        secondary:   '#061018',
        third:       '#151e29',
        bcolor:      '#15202c',
        inputcolor:  '#1e2c3c',
        dark:        '#080a0d',
        light:       '#f5f5f5',
        txtfade:     '#858789',

        // Adrena semantic colors (NOT for CTAs — see gradient classes)
        redbright:   '#ff344e',
        red: {
          500: '#c9243a',
        },
        green: {
          500: '#07956b',
        },
        blue: {
          500: '#3b82f6',
        },
        orange: {
          500: '#f0892b',
        },

        // Extended grey scale (Adrena ships only gray-200)
        gray: {
          200: '#1a2431',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
        mono: ['var(--font-roboto-mono)', ...fontFamily.mono],
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.2, 0.8, 0.4, 1)',
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
};

export default config;
