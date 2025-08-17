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
      defaultTheme: "dark",
      themes: {
        light: {
          colors: {
            // Money-first palette: emerald primary, teal secondary
            primary: {
              DEFAULT: "#F4BA41",
              foreground: "#1a1a1a",
            },
            secondary: {
              DEFAULT: "#4D9CB9",
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
              DEFAULT: "#F4BA41",
              foreground: "#1a1a1a",
            },
            secondary: {
              DEFAULT: "#4D9CB9",
              foreground: "#ffffff",
            },
            success: {
              DEFAULT: "#16a34a", // unified to light success
              foreground: "#06240f",
            },
            warning: {
              DEFAULT: "#f59e0b", // unified to light warning
              foreground: "#281a02",
            },
            danger: {
              DEFAULT: "#ef4444", // unified to light danger
              foreground: "#2a0606",
            },
          },
        },
      },
    }),
  ],
}

module.exports = config;