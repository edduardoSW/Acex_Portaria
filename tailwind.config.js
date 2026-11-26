/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'acex-navy': '#092b3d',
        'acex-teal': '#0f766e',
        'acex-mint': '#dff5ef',
        'acex-lime': '#b8d83d',
        'acex-ink': '#13252f',
      },
      boxShadow: {
        'acex': '0 18px 45px -28px rgba(9, 43, 61, 0.45)',
      },
    },
  },
  plugins: [],
}
