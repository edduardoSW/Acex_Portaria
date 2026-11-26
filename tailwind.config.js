/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'acex-navy': '#1c1815',
        'acex-panel': '#28221e',
        'acex-teal': '#e87532',
        'acex-mint': '#f5e5d9',
        'acex-lime': '#f18a4b',
        'acex-cream': '#f4efe8',
        'acex-taupe': '#b6aa9e',
        'acex-ink': '#241e1a',
      },
      boxShadow: {
        'acex': '0 18px 45px -28px rgba(28, 24, 21, 0.5)',
      },
    },
  },
  plugins: [],
}
