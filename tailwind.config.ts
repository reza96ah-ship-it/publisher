import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "Arial", "sans-serif"]
      },
      colors: {
        app: {
          background: "#F7F8FA",
          surface: "#FFFFFF",
          border: "#E5E7EB",
          primary: "#7B68EE",
          primaryHover: "#6C5CE7",
          text: "#1F2937",
          muted: "#6B7280"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
