/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'acex-navy': '#0a0a0a',
        'acex-panel': '#111111',
        'acex-teal': '#e87532',
        'acex-mint': '#fff0e6',
        'acex-lime': '#e87532',
        'acex-cream': '#f7f7f5',
        'acex-taupe': '#a3a3a3',
        'acex-ink': '#171717',
      },
      boxShadow: {
        'acex': '0 18px 45px -28px rgba(0, 0, 0, 0.42)',
      },
    },
  },
  plugins: [],
}
