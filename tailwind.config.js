import { heroui } from "@heroui/theme"

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
            // Money-first palette: golden primary, teal secondary
            primary: {
              100: "#FEF7D9",
              200: "#FDEDB3",
              300: "#FBDF8C",
              400: "#F8D06F",
              500: "#F4BA41",
              600: "#D1972F",
              700: "#AF7720",
              800: "#AF7720",
              900: "#8D5A14",
              1000: "#6B3E0A",
              DEFAULT: "#F4BA41",
              foreground: "#1a1a1a",
            },
            secondary: {
              100: "#DEFBFB",
              200: "#BEF4F8",
              300: "#98DFEA",
              400: "#77C2D5",
              500: "#4D9CB9",
              600: "#387C9F",
              700: "#265E85",
              800: "#18436B",
              900: "#0E3058",
              1000: "#061E47",
              DEFAULT: "#4D9CB9",
              foreground: "#ffffff",
            },
          },
        },
        dark: {
          colors: {
            primary: {
              100: "#FEF7D9",
              200: "#FDEDB3",
              300: "#FBDF8C",
              400: "#F8D06F",
              500: "#F4BA41",
              600: "#D1972F",
              700: "#AF7720",
              800: "#AF7720",
              900: "#8D5A14",
              1000: "#6B3E0A",
              DEFAULT: "#F4BA41",
              foreground: "#1a1a1a",
            },
            secondary: {
              100: "#DEFBFB",
              200: "#BEF4F8",
              300: "#98DFEA",
              400: "#77C2D5",
              500: "#4D9CB9",
              600: "#387C9F",
              700: "#265E85",
              800: "#18436B",
              900: "#0E3058",
              1000: "#061E47",
              DEFAULT: "#4D9CB9",
              foreground: "#ffffff",
            },
          },
        },
      },
    }),
  ],
}

module.exports = config;