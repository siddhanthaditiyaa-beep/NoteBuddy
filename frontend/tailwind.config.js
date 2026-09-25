/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151429",
        cloud: "#F7F6FB",
        primary: {
          50: "#F1EEFF",
          100: "#E3DEFF",
          300: "#B8A9FF",
          500: "#7C5CFC",
          600: "#6540F5",
          700: "#5230D6",
        },
        mint: {
          400: "#3FE0B0",
          500: "#22C99A",
        },
        sun: {
          300: "#FFD873",
          500: "#FFB020",
        },
        coral: {
          400: "#FF7B7B",
          500: "#FF5C5C",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
        body: ["'Nunito'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 30px -8px rgba(101, 64, 245, 0.25)",
        card: "0 4px 20px -4px rgba(21, 20, 41, 0.08)",
        pop: "0 12px 40px -12px rgba(101, 64, 245, 0.45)",
      },
      borderRadius: {
        xl2: "1.5rem",
        xl3: "2rem",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        popIn: {
          "0%": { transform: "scale(0.9)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        popIn: "popIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
