/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        urban: {
          green: '#197c63',
          'green-light': '#1e9470',
          'green-medium': '#1a8a6e',
          'green-dark': '#197c63',
          petrol: '#0d394f',
          'blue-deep': '#134D5F',
          'blue-dark': '#0D394F',
          bg: '#F0F5F6',
          'gray-light': '#D0D0D0',
          'gray-data': '#6B8F86',
        },
        sidebar: {
          DEFAULT: '#1C1C1C',
        },
      },
      borderRadius: {
        card: '12px',
      },
      keyframes: {
        'login-fade-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'login-fade-in': 'login-fade-in 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
};
