/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black: '#000000',
          card: '#09090b',
          dock: '#0c0c0e'
        }
      },
      boxShadow: {
        'premium-glow': '0 0 20px rgba(99, 102, 241, 0.05)',
        'premium-dock': '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      },
      backgroundImage: {
        'ambient-glow':
          'radial-gradient(circle at top, rgba(99, 102, 241, 0.1) 0%, transparent 60%)'
      }
    }
  },
  plugins: []
};