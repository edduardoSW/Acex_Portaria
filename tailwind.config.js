/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'acex-navy': '#0a3142',
        'acex-teal': '#008b82',
        'acex-mint': '#ddf5f0',
        'acex-lime': '#c4e62f',
        'acex-ink': '#102b38',
      },
      boxShadow: {
        'acex': '0 18px 45px -28px rgba(9, 43, 61, 0.45)',
      },
    },
  },
  plugins: [],
}
