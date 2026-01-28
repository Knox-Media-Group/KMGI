/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // These will be overridden by CSS variables for tenant branding
        primary: 'var(--color-primary, #2563EB)',
        'primary-dark': 'var(--color-primary-dark, #1D4ED8)',
      },
    },
  },
  plugins: [],
};
