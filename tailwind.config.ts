import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        vara: {
          red: '#E8402F',
          'red-bright': '#FF5A47',
          'red-deep': '#C42E20',
          ink: '#04060F',
          panel: '#121218',
          'panel-2': '#1A1A22',
          line: '#26262F',
          mist: '#8A8A99',
          cream: '#F5F5F7',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Poppins', 'Segoe UI', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', 'Segoe UI', 'sans-serif'],
        thai: ['var(--font-thai)', 'Noto Sans Thai', 'Leelawadee UI', 'sans-serif'],
      },
      keyframes: {
        'orb-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.08)', opacity: '0.9' },
        },
        'ring-out': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'orb-pulse': 'orb-pulse 3.2s ease-in-out infinite',
        'ring-out': 'ring-out 2.4s ease-out infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
