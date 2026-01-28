/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // GYS Studio Renk Paleti (Senin attığın renkler)
        primary: {
          50: '#F5E6D3',
          100: '#E8CEB3',
          200: '#D4B899',
          300: '#CD853F',  // Bakır (light)
          400: '#A66D35',
          500: '#8B4513',  // Bordo (ANA RENK)
          600: '#6F3710',
          700: '#5C2D0A',
          800: '#442108',
          900: '#2D1605',
        },
        accent: {
          50: '#FFF9E6',
          100: '#FFF0CC',
          200: '#FFE799',
          300: '#F4A300',  // Açık altın
          400: '#D48E00',
          500: '#C1850A',  // Altın (ANA RENK)
          600: '#A06F08',
          700: '#8B6000',  // Koyu altın
          800: '#664700',
          900: '#442F00',
        },
        gold: {
          50: '#F7F3D9',
          100: '#EFE9BF',
          200: '#E5DD9F',
          300: '#D4C970',  // Açık zeytin
          400: '#C5BA5E',
          500: '#B5A642',  // Yeşil-Sarı (ANA RENK)
          600: '#9A8D38',
          700: '#8B7E2E',  // Koyu zeytin
          800: '#6D6224',
          900: '#4D451A',
        },
        neutral: {
          cream: '#F5F5DC',  // Bej/Krem
          sand: '#E8DCC4',   // Kum rengi
          stone: '#C8BCA8',  // Taş rengi
          warm: '#F8F6F0',   // Sıcak beyaz
        },
      },
      fontSize: {
        // KÜÇÜLTÜLMÜŞ FONTLAR
        'xs': ['0.625rem', { lineHeight: '0.875rem' }],    // 10px
        'sm': ['0.75rem', { lineHeight: '1rem' }],         // 12px
        'base': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'lg': ['1rem', { lineHeight: '1.5rem' }],          // 16px
        'xl': ['1.125rem', { lineHeight: '1.75rem' }],     // 18px
        '2xl': ['1.25rem', { lineHeight: '1.875rem' }],    // 20px
        '3xl': ['1.5rem', { lineHeight: '2rem' }],         // 24px
      },
      spacing: {
        // Daha kompakt spacing
        '13': '3.25rem',
        '15': '3.75rem',
        '17': '4.25rem',
        '18': '4.5rem',
        '19': '4.75rem',
      },
      borderRadius: {
        // Daha az yuvarlak
        'sm': '0.25rem',
        'DEFAULT': '0.5rem',
        'md': '0.5rem',
        'lg': '0.625rem',
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        // Soft gölgeler
        'sm': '0 1px 2px 0 rgba(139, 69, 19, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(139, 69, 19, 0.1)',
        'md': '0 4px 6px -1px rgba(139, 69, 19, 0.1)',
        'lg': '0 10px 15px -3px rgba(139, 69, 19, 0.1)',
      },
    },
  },
  plugins: [],
}
