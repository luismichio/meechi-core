
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
        colors: {
            background: "var(--background)",
            foreground: "var(--foreground)",
        }
    },
  },
  plugins: [],
  darkMode: 'class'
};
export default config;
