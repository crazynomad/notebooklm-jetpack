/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,tsx,ts}',
    './components/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        youtube: {
          red: '#FF0000',
          dark: '#282828',
        },
        notebooklm: {
          blue: '#1A73E8',
          'blue-dark': '#1557B0',
          light: '#E8F0FE',
          surface: '#F8FAFF',
        },
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card': '0 1px 4px 0 rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03)',
        'btn': '0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        'btn-hover': '0 2px 4px 0 rgba(0, 0, 0, 0.08), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
