/** @type {import('tailwindcss').Config} */
module.exports = {
  // Hover styles only where hovering exists, so they don't stick after a tap.
  future: { hoverOnlyWhenSupported: true },
  content: ["./src/**/*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Figtree Variable"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
