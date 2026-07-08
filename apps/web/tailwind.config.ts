import type { Config } from "tailwindcss";

// Design tokens ported from the prototype (frame-prototype.html).
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F6F7F9",
        surface: "#FFFFFF",
        ink: "#1B1D22",
        muted: "#6B7280",
        line: "#ECEDF0",
        primary: "#18181B",
        accent: {
          DEFAULT: "#6D5EFA",
          2: "#5546E6",
          weak: "#F0EEFE",
        },
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
