import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FAF7F2",
          50: "#FDFCFA",
          100: "#FAF7F2",
          200: "#F3EEE6",
        },
        ink: {
          DEFAULT: "#2B2A28",
          soft: "#6B6862",
          faint: "#9A968D",
        },
        border: {
          DEFAULT: "#E8E3D9",
        },
        lavender: {
          50: "#F3F1FB",
          100: "#E7E2F7",
          400: "#A79AE0",
          500: "#8C7CD6",
          600: "#6E5FC7",
        },
        blossom: {
          50: "#FCEEF2",
          100: "#F9DDE5",
          400: "#EE9FB6",
          500: "#E87FA0",
          600: "#D4638A",
        },
        sky: {
          50: "#EEF5FB",
          100: "#DCEBF7",
          400: "#7FB2DD",
          500: "#5C9BD1",
        },
        sage: {
          50: "#EEF6EE",
          100: "#DCEDDC",
          400: "#8FC48F",
          500: "#6FAF6F",
        },
        amber: {
          50: "#FCF3E4",
          100: "#F8E6C6",
          400: "#E8B85C",
          500: "#DDA53E",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(43, 42, 40, 0.04), 0 2px 8px rgba(43, 42, 40, 0.04)",
        softer: "0 1px 3px rgba(43, 42, 40, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
