/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/views/**/*.{html,js}",
  ],
  theme: {
    extend: {
      colors: {
        'black-shades': {
          100: '#e6e6e6',
          200: '#cccccc',
          300: '#b3b3b3',
          400: '#999999',
          500: '#808080',
          600: '#666666',
          700: '#4d4d4d',
          800: '#333333',
          900: '#1a1a1a',
        },
      },
    },
  },
  plugins: [],
}

