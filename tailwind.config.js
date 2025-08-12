import {heroui} from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      // See: https://www.heroui.com/docs/customization/theme
      defaultTheme: "light",
      themes: {
        light: {
          colors: {
            // Money-first palette: emerald primary, teal secondary
            primary: {
              DEFAULT: "#059669", // emerald-600
              foreground: "#ffffff",
            },
            secondary: {
              DEFAULT: "#14b8a6", // teal-500
              foreground: "#ffffff",
            },
            success: {
              DEFAULT: "#16a34a", // green-600
              foreground: "#06240f",
            },
            warning: {
              DEFAULT: "#f59e0b", // amber-500
              foreground: "#281a02",
            },
            danger: {
              DEFAULT: "#ef4444", // red-500
              foreground: "#2a0606",
            },
          },
        },
        dark: {
          colors: {
            primary: {
              DEFAULT: "#34d399", // emerald-400
              foreground: "#041a12",
            },
            secondary: {
              DEFAULT: "#2dd4bf", // teal-400
              foreground: "#06201d",
            },
            success: {
              DEFAULT: "#22c55e", // green-500
              foreground: "#041a12",
            },
            warning: {
              DEFAULT: "#fbbf24", // amber-400
              foreground: "#281a02",
            },
            danger: {
              DEFAULT: "#f87171", // red-400
              foreground: "#2a0606",
            },
          },
        },
      },
    }),
  ],
}

module.exports = config;