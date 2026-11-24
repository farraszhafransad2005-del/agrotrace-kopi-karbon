/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        espresso: {
          950: "#0C0A09",
          900: "#14100E",
          850: "#1C1613",
          800: "#241B17",
          700: "#3B2D25",
        },
        amber: {
          400: "#FBBF24",
          500: "#F59E0B",
        },
        emerald: {
          400: "#34D399",
          500: "#10B981",
        },
        terracotta: {
          400: "#F87171",
          500: "#E05A47",
        },
        crema: "#D4A373",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -12px rgba(245, 158, 11, 0.22)",
        emeraldGlow: "0 0 40px -12px rgba(16, 185, 129, 0.22)",
      },
    },
  },
  plugins: [],
};
