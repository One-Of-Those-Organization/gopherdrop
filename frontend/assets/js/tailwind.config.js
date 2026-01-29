tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                "primary": "#00d0ff",
            },
            fontFamily: {
                sans: ['Space Grotesk', 'sans-serif'],
            },
            animation: {
                'fade-up': 'fadeUp 0.5s forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        }
    }
}