import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ftc: {
          bordeaux: "#5A1430",
          viola: "#4B1D74",
          oro: "#D4AF37",
          soap: "#F7C3D7",
          bg: "#FFF7FA"
        }
      }
    }
  },
  plugins: [],
};

export default config;
