import type { Config } from "tailwindcss";

// Design tokens ported from the prototype (frame-prototype.html / Frame kernel).
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F6F7F9",
        surface: { DEFAULT: "#FFFFFF", "2": "#FBFBFC", "3": "#F3F4F6" },
        ink: { DEFAULT: "#1B1D22", "2": "#3B3F47" },
        muted: "#6B7280",
        faint: "#9AA1AC",
        line: { DEFAULT: "#ECEDF0", "2": "#E2E4E9" },
        primary: "#18181B",
        accent: { DEFAULT: "#6D5EFA", "2": "#5546E6", weak: "#F0EEFE" },
        green: "#159C56",
        amber: "#C4790B",
        red: "#DC4B47",
      },
      borderRadius: {
        xl: "16px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,22,28,.06), 0 1px 1px rgba(20,22,28,.04)",
        pop: "0 6px 18px -8px rgba(20,22,28,.18), 0 2px 6px -3px rgba(20,22,28,.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
