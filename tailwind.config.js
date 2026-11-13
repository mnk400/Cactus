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
      colors: {
        "black-shades": {
          100: "#e6e6e6",
          200: "#cccccc",
          300: "#b3b3b3",
          400: "#999999",
          500: "#404040",
          600: "#303030",
          700: "#202020",
          800: "#101010",
          900: "#1a1a1a",
          1000: "#0f0f0f",
        },
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
    },
  },
  plugins: [],
};
