/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#24151e',
        paper: '#fbf5f3',
        cream: '#f1e2e3',
        wine: '#702b4a',
        rose: '#c17c91',
        brass: '#b68b78',
        muted: '#907b83',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Manrope', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 22px 70px rgba(30, 21, 17, .12)',
      },
    },
  },
  plugins: [],
};
