import type { Config } from 'tailwindcss'

function rgbVar(name: string) {
  return `rgb(var(--color-${name}) / <alpha-value>)`
}

export default <Partial<Config>>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:          rgbVar('bg'),
        surface:     rgbVar('surface'),
        elevated:    rgbVar('elevated'),
        border:      rgbVar('border'),
        'border-soft': rgbVar('border-soft'),
        text:        rgbVar('text'),
        'text-soft': rgbVar('text-soft'),
        'text-muted': rgbVar('text-muted'),
        accent:      rgbVar('accent'),
        'accent-soft': rgbVar('accent-soft'),
        olive:       rgbVar('olive'),
        'olive-soft': rgbVar('olive-soft'),
        success:     rgbVar('success'),
        'success-bg': rgbVar('success-bg'),
        danger:      rgbVar('danger'),
        'danger-bg': rgbVar('danger-bg'),
        warning:     rgbVar('warning'),
        'warning-bg': rgbVar('warning-bg'),
      },
      fontFamily: {
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
      },
    },
  },
  plugins: [],
}
