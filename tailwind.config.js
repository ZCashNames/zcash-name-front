/** @type {import('tailwindcss').Config} */
module.exports = {
  // IMPORTANT: js/app.js must be scanned as well as index.html. Many utility classes exist
  // only inside JS template literals (marketplace cards, my-names cards, transaction rows,
  // pagination buttons, toasts); omitting it would purge those classes and silently break
  // the styling of every dynamically rendered view.
  content: [
    // app.html, not index.html: index.html is the landing page (which uses landing.css and
    // no Tailwind at all), so scanning it purges every class the app needs.
    './app.html',
    './js/app.js',
    // Translated strings carry markup with utility classes on it (price highlight, status
    // countdown). They live only in these files, so they must be scanned too.
    './lang/*.json',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
