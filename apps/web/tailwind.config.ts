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
        // Core Palette
        obsidian: "#0B0C10",
        "dark-grey": "#1A1A24",
        "neon-cyan": "#14F195",
        "electric-purple": "#9945FF",
        "ghost-white": "#F8F8F8",
        "muted-silver": "#A0AAB2",

        // Semantic / Legacy Mappings
        surface: "#1A1A24",
        muted: "#A0AAB2",
        "muted-light": "#71717A",
        "incognito-bg": "#0B0C10",
        "incognito-surface": "#1A1A24",
        "incognito-border": "#14F195",
        "incognito-text": "#F8F8F8",
        "incognito-muted": "#A0AAB2",
        "incognito-btn": "#14F195",
        "incognito-btn-border": "#14F195",
        "status-pending-bg": "#1A1A24",
        "status-pending-text": "#9945FF",
        "status-success-bg": "#1A1A24",
        "status-success-text": "#14F195",
        "status-error-bg": "#1A1A24",
        "status-error-text": "#EF4444",
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
