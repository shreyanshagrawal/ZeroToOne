/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0d0d0f',
          sidebar: '#111115',
          surface: '#111118',
          elevated: '#14141a',
          card: '#16162a',
        },
        border: {
          DEFAULT: '#1e1e24',
          subtle: '#252530',
          focus: '#4a3a90',
        },
        accent: {
          DEFAULT: '#6b4fd8',
          hover: '#7c60e8',
          muted: '#8b6cf0',
        },
        text: {
          primary: '#e8e8ea',
          secondary: '#c8c8d4',
          muted: '#9090a8',
          faint: '#5a5a6e',
          purple: '#b0a8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
