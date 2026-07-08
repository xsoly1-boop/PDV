/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        '2xs': '0.65rem',
        '3xs': '0.55rem',
        '4xs': '0.45rem',
      },
      colors: {
        slate: {
          850: '#1e293b',
        }
      }
    },
  },
  plugins: [],
}
