/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs'],
  safelist: [
    { pattern: /bg-(indigo|emerald|amber|sky|gray|rose|violet|orange|teal)-(50|100|200|400)/ },
    { pattern: /text-(indigo|emerald|amber|sky|gray|rose|violet|orange|teal)-(700|800)/ },
  ],
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography')],
};
