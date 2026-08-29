/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '600px',
      'md': '768px',
      'tablet-sm': '880px',
      'tablet': '900px',
      'lg': '992px',
      'ipad': '1024px',
      'xl': '1200px',
      '2xl': '1360px',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0b4d24',
          hover: '#083719',
          glow: 'rgba(11, 77, 36, 0.08)',
        },
        accent: {
          DEFAULT: '#c5a059',
          hover: '#b08d47',
        },
        foreground: '#111c14',
        muted: '#5c675e',
        border: 'rgba(11, 77, 36, 0.08)',
        success: '#0b6623',
        error: '#9f1c1c',
        warning: '#b45309',
        card: '#ffffff',
        glass: {
          bg: '#ffffff',
          'bg-hover': '#ffffff',
          border: 'rgba(11, 77, 36, 0.09)',
          highlight: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 12px 48px -12px rgba(11, 77, 36, 0.12), 0 1px 3px 0 rgba(0, 0, 0, 0.01)',
        'card-hover': '0 24px 64px -10px rgba(11, 77, 36, 0.18), 0 8px 16px -8px rgba(0, 0, 0, 0.02)',
        'glow': '0 4px 16px rgba(11, 77, 36, 0.18)',
        'danger': '0 4px 14px rgba(159, 28, 28, 0.2)',
        'danger-hover': '0 6px 18px rgba(159, 28, 28, 0.3)',
        'dropdown': '0 20px 60px -10px rgba(11, 77, 36, 0.18), 0 4px 16px rgba(0,0,0,0.06)',
        'mobile-bar': '0 -4px 24px rgba(11, 77, 36, 0.07)',
        'fab': '0 8px 24px rgba(11, 77, 36, 0.35)',
      },
      borderRadius: {
        'card': '20px',
        'modal': '24px',
      },
      backgroundImage: {
        'liturgical-radial': 'radial-gradient(circle at 50% 0%, #fefdfa 0%, #f6f3e8 60%, #e8e2cf 100%)',
        'primary-gradient': 'linear-gradient(135deg, #0b4d24, #083719)',
        'primary-hover-gradient': 'linear-gradient(135deg, #c5a059, #0b4d24)',
      },
      animation: {
        'float-card': 'floatCard 6s ease-in-out infinite',
        'skeleton': 'skeletonShimmer 1.8s ease-in-out infinite',
        'dropdown': 'dropdownIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'modal-scale': 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'sheet-slide': 'sheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.2s ease',
      },
      keyframes: {
        floatCard: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        skeletonShimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        dropdownIn: {
          'from': { opacity: '0', transform: 'translateY(-8px) scale(0.97)' },
          'to': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideUpModal: {
          'from': { opacity: '0', transform: 'translateY(24px) scale(0.96)' },
          'to': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        sheetSlideUp: {
          'from': { transform: 'translateY(100%)' },
          'to': { transform: 'translateY(0)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
