/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,tsx,ts}',
    './components/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Noto Sans SC', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
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
        // Refined neutral palette
        surface: {
          DEFAULT: '#FAFBFC',
          raised: '#FFFFFF',
          sunken: '#F4F5F7',
          overlay: 'rgba(255, 255, 255, 0.82)',
        },
        border: {
          DEFAULT: 'rgba(0, 0, 0, 0.06)',
          subtle: 'rgba(0, 0, 0, 0.04)',
          strong: 'rgba(0, 0, 0, 0.1)',
        },
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card': '0 1px 4px 0 rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03)',
        'btn': '0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        'btn-hover': '0 3px 8px 0 rgba(0, 0, 0, 0.1), 0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        'ring': '0 0 0 3px rgba(26, 115, 232, 0.12)',
        'glow': '0 0 20px -4px rgba(26, 115, 232, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
