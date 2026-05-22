/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        apg: {
          bg:         '#0a0a0a',
          surface:    '#141414',
          red:        '#e32f2f',   // primary — reserved for highest-priority signals
          'red-mute': '#c0392b',   // muted red — for secondary accents (score bars, trajectory bars)
          muted:      '#555555',
          green:      '#4caf50',   // trend up
        },
      },
    },
  },
  plugins: [],
}
