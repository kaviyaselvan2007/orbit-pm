/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: { 950: '#0B1420', 900: '#101B2D', 800: '#16233A', 700: '#1E2E4A' },
        teal: { DEFAULT: '#0F6E7C', light: '#12889A' },
        amber: { DEFAULT: '#E2A33D', soft: '#FBF0DC' },
        green: { DEFAULT: '#2E9E5B', soft: '#E4F5EA' },
        red: { DEFAULT: '#D5514C', soft: '#FCE7E6' },
        blue: { DEFAULT: '#3E6FD9' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
