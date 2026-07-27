/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        jh: {
          primary: '#0d3393',
          primaryDark: '#0b2670',
          accent: '#ef0606',
          accentDark: '#c70505',
          slateBg: '#f8fafc',
          plum: '#743c6c',
          crimson: '#941c44',
          navyPurple: '#3c448c',
        }
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        fa: ['"Font Awesome 6 Free"', 'sans-serif']
      }
    }
  },
  plugins: []
};
