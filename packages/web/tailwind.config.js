/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#ffd9b3',
          300: '#ffb380',
          400: '#ff8c4d',
          500: '#ff6b35',
          600: '#ea580c',
          700: '#c2410c',
        },
        neo: {
          black: '#1a1a1a',
          white: '#fafaf9',
          yellow: '#facc15',
          pink: '#f472b6',
          blue: '#60a5fa',
          green: '#4ade80',
          purple: '#a78bfa',
          red: '#f87171',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        neo: '4px 4px 0px 0px #1a1a1a',
        'neo-sm': '2px 2px 0px 0px #1a1a1a',
        'neo-lg': '6px 6px 0px 0px #1a1a1a',
        'neo-hover': '6px 6px 0px 0px #1a1a1a',
      },
      borderWidth: {
        3: '3px',
      },
    },
  },
  plugins: [],
};
