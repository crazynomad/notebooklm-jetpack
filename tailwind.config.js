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
          light: '#E8F0FE',
        },
      },
    },
  },
  plugins: [],
};
