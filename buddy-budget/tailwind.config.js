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
      colors: {
        brand: {
          gold: {
            50: '#fef9ec',
            100: '#fdf2d3',
            200: '#fbe5a8',
            300: '#f9d272',
            400: '#f6be4c',
            500: '#f4ba41', // Main gold color
            600: '#d89d1f',
            700: '#b47d17',
            8: '#925f19',
            900: '#784f1a',
            950: '#45290c',
          },
          blue: {
            50: '#f0f9fc',
            100: '#e0f2f8',
            200: '#c1e5f1',
            300: '#8dcfe5',
            400: '#52b3d3',
            500: '#4d9cba', // Main blue color
            600: '#3a7c9a',
            700: '#31647d',
            800: '#2c5468',
            900: '#284758',
            950: '#1a2e3b',
          },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: '#4d9cba',
              foreground: '#ffffff',
              50: '#f0f9fc',
              100: '#e0f2f8',
              200: '#c1e5f1',
              300: '#8dcfe5',
              400: '#52b3d3',
              500: '#4d9cba',
              600: '#3a7c9a',
              700: '#31647d',
              800: '#2c5468',
              900: '#284758',
            },
            secondary: {
              DEFAULT: '#f4ba41',
              foreground: '#1a1a1a',
              50: '#fef9ec',
              100: '#fdf2d3',
              200: '#fbe5a8',
              300: '#f9d272',
              400: '#f6be4c',
              500: '#f4ba41',
              600: '#d89d1f',
              700: '#b47d17',
              800: '#925f19',
              900: '#784f1a',
            },
            focus: '#4d9cba',
          },
        },
        dark: {
          colors: {
            primary: {
              DEFAULT: '#52b3d3',
              foreground: '#ffffff',
              50: '#f0f9fc',
              100: '#e0f2f8',
              200: '#c1e5f1',
              300: '#8dcfe5',
              400: '#52b3d3',
              500: '#4d9cba',
              600: '#3a7c9a',
              700: '#31647d',
              800: '#2c5468',
              900: '#284758',
            },
            secondary: {
              DEFAULT: '#f6be4c',
              foreground: '#1a1a1a',
              50: '#fef9ec',
              100: '#fdf2d3',
              200: '#fbe5a8',
              300: '#f9d272',
              400: '#f6be4c',
              500: '#f4ba41',
              600: '#d89d1f',
              700: '#b47d17',
              800: '#925f19',
              900: '#784f1a',
            },
            focus: '#52b3d3',
          },
        },
      },
    }),
  ],
}

module.exports = config;