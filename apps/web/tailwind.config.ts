import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#352b3d',
          plum: '#795b83',
          rose: '#efb9c5',
          cream: '#fffaf6',
          mint: '#cce8dc',
        },
      },
      boxShadow: {
        soft: '0 20px 60px rgb(77 53 73 / 10%)',
      },
    },
  },
  plugins: [],
};

export default config;
