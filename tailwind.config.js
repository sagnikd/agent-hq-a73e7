const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "index.html"),
    path.join(__dirname, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F8FAFC",
        primary: "#2563EB",
        accent: "#F59E0B",
        success: "#16A34A",
        purple: "#7C3AED",
        amber: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        display: ['"Inter"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(37,99,235,0.18)",
        "glow-accent": "0 0 24px rgba(245,158,11,0.25)",
        "glow-success": "0 0 24px rgba(22,163,74,0.25)",
        "inset-glass": "inset 0 1px 0 0 rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};
