/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // ── Creative Computers Brand Palette ──────────────────────
        cc: {
          blue: {
            50:  "#eef1fb",
            100: "#d5dcf5",
            200: "#aab9eb",
            300: "#7f96e1",
            400: "#5473d7",
            500: "#2950cd",
            600: "#1F3C8A",   // logo navy — PRIMARY
            700: "#192f6e",
            800: "#132253",
            900: "#0d1638",
            950: "#080e24",
          },
          green: {
            50:  "#e9f7ef",
            100: "#c6edd9",
            200: "#8ddbb3",
            300: "#54c98d",
            400: "#2db870",
            500: "#27AE60",   // logo green — PRIMARY
            600: "#1e904e",
            700: "#16723d",
            800: "#0f542c",
            900: "#07361b",
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "cc": "0 4px 24px 0 rgba(31,60,138,0.10)",
        "cc-sm": "0 2px 10px 0 rgba(31,60,138,0.08)",
      },
    },
  },
  plugins: [],
}
