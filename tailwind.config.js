/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  safelist: [
    { pattern: /^(bg|border|text|fill|from|to)-.+\/(5|10|15|20|25|30|40|50|60|70|75|80|90|95|100)$/ },
    'kpi-blue','kpi-green','kpi-amber','kpi-rose','kpi-violet','kpi-cyan',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        navy: {
          950: '#03060f',
          900: '#040916',
          800: '#060d1f',
          700: '#091428',
        },
      },
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':       'fadeIn 0.25s ease-out',
        'slide-up':      'slideUp 0.3s ease-out',
        'slide-right':   'slideRight 0.25s ease-out',
        'spin-slow':     'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:      { '0%': { opacity:'0' }, '100%': { opacity:'1' } },
        slideUp:     { '0%': { opacity:'0', transform:'translateY(12px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        slideRight:  { '0%': { opacity:'0', transform:'translateX(-10px)' }, '100%': { opacity:'1', transform:'translateX(0)' } },
      },
      boxShadow: {
        'glow-blue':    '0 0 30px rgba(37,99,235,0.4)',
        'glow-green':   '0 0 30px rgba(16,185,129,0.3)',
        'glow-violet':  '0 0 30px rgba(124,58,237,0.35)',
        'card':         '0 1px 3px rgba(0,0,0,0.4)',
        'card-hover':   '0 8px 32px rgba(0,0,0,0.4)',
        'modal':        '0 32px 80px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
