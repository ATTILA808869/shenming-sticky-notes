import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        temple: {
          red: "#E84235",
          gold: "#F4B63F",
          ink: "#2E2A27",
          cream: "#FFF8ED",
          peach: "#FFE2CF",
          jade: "#2FB59B"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(90, 44, 24, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
