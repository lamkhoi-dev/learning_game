import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'void': 'var(--bg-void)',
        'cyan-titan': 'var(--cyan-titan)',
        'crimson-xenon': 'var(--crimson-xenon)',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
