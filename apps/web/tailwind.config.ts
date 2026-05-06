import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "serif"],
      },
      colors: {
        surface: "#f5f4f2",
        muted: "#888784",
        "muted-light": "#b8b6b3",
        "incognito-bg": "#111111",
        "incognito-surface": "#1c1c1c",
        "incognito-border": "#2e2e2e",
        "incognito-text": "#e2e0dc",
        "incognito-muted": "#555553",
        "incognito-btn": "#222222",
        "incognito-btn-border": "#333333",
        "status-pending-bg": "#fef8ec",
        "status-pending-text": "#92600a",
        "status-success-bg": "#edf6ee",
        "status-success-text": "#1e6b26",
        "status-error-bg": "#fdf0ef",
        "status-error-text": "#9e2b25",
        "warn-dark-bg": "#242010",
        "warn-dark-text": "#7a6a3a",
      },
      borderWidth: {
        px: "0.5px",
      },
      fontSize: {
        10: ["10px", { lineHeight: "1.4" }],
        11: ["11px", { lineHeight: "1.5" }],
        12: ["12px", { lineHeight: "1.5" }],
        13: ["13px", { lineHeight: "1.6" }],
        14: ["14px", { lineHeight: "1.75" }],
        20: ["20px", { lineHeight: "1.2" }],
        28: ["28px", { lineHeight: "1.1" }],
        32: ["32px", { lineHeight: "1.1" }],
      },
      animation: {
        "pulse-dot": "pulseDot 1.5s ease-in-out infinite",
        "slide-down": "slideDown 180ms ease-out forwards",
        "fade-in": "fadeIn 150ms ease-out forwards",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "0.9", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.7)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
