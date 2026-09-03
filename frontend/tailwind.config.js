/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        library: {
          navy: "#1A365D",
          blue: "#2C5282",
          slate: "#4A5568",
        },
      },
    },
  },
  plugins: [],
}
