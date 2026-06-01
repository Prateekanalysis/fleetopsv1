/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  safelist: [
    { pattern: /^(bg|border|text|fill)-.+\/(3|4|6|7|8|12|14|15|25)$/ }
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      opacity: {
        '3': '0.03',
        '4': '0.04',
        '6': '0.06',
        '7': '0.07',
        '8': '0.08',
        '12': '0.12',
        '14': '0.14',
        '15': '0.15',
      },
      colors: {
        navy: {
          950: '#020409',
          900: '#050c17',
          850: '#071020',
          800: '#0a1628',
          750: '#0d1e35',
          700: '#112440',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(16px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40M0 40h40M0 0v40M40 0v40' stroke='%23ffffff' stroke-opacity='0.025' stroke-width='0.5'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow-blue': '0 0 30px rgba(59,130,246,0.3)',
        'glow-emerald': '0 0 30px rgba(16,185,129,0.25)',
        'card': '0 1px 3px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.4)',
        'modal': '0 25px 80px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
}
