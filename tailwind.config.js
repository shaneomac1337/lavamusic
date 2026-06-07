/**
 * Tailwind CSS configuration for the Lavamusic web dashboard.
 *
 * The dashboard pages (src/web/public/*.html) and the extracted page scripts
 * (src/web/public/js/*.js) are scanned for class names. Many controls assign
 * full class strings from JavaScript at runtime — those are picked up because
 * the JS files are part of `content`. A small `safelist` covers the few
 * semantic colors that are interpolated dynamically (e.g. success/error toasts).
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/web/public/**/*.html', './src/web/public/**/*.js'],
  safelist: [
    // Defensive insurance for semantic colors that JS may compose at runtime
    // (toasts, toggle states). Anchored (^…$) so opacity variants aren't expanded.
    {
      pattern: /^(bg|text)-(green|red|blue|gray|emerald|indigo)-(200|300|400|500|600|700)$/,
      variants: ['hover'],
    },
  ],
  theme: {
    extend: {
      colors: {
        // Ported from the (previously orphaned) kompg-theme palette — now the dashboard's design tokens.
        primary: '#6e4ff6',
        'primary-dark': '#5a3fd6',
        accent: '#00d2ff',
        discord: '#5865f2',
        'dark-bg': '#1f2937',
        'darker-bg': '#111827',
        'card-bg': '#374151',
        'border-soft': '#4b5563',
      },
      fontFamily: {
        display: ["'Exo 2'", 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.28)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.40)',
        'neon-primary': '0 0 0 1px rgba(110, 79, 246, 0.35), 0 8px 24px rgba(110, 79, 246, 0.25)',
        'neon-accent': '0 0 0 1px rgba(0, 210, 255, 0.30), 0 8px 24px rgba(0, 210, 255, 0.20)',
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        'glass-sheen': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        'brand-gradient': 'linear-gradient(135deg, #6e4ff6 0%, #00d2ff 100%)',
      },
    },
  },
  plugins: [],
};
