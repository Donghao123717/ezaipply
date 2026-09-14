import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Marketing-page entrance: a longer, slower rise than the in-app one,
        // which stays snappy because it fires on every interaction.
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'portrait-pop': {
          from: { opacity: '0', transform: 'scale(0.78)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'route-flow': {
          to: { strokeDashoffset: '-60' },
        },
        // The scale story's own motion. Percentages are held deliberately:
        // each one idles, fires, then idles again so a loop reads as a
        // repeating event rather than a continuous wobble.
        'scroll-arrow': {
          '0%': { opacity: '0', transform: 'translateX(-50%)' },
          '18%, 68%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateX(-50%) translateY(42px)' },
        },
        'core-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'core-breathe': {
          '0%, 100%': { transform: 'scale(0.94)', opacity: '0.45' },
          '50%': { transform: 'scale(1.05)', opacity: '0.95' },
        },
        'tile-charge': {
          '0%, 12%': { transform: 'translateX(-120%)' },
          '32%, 100%': { transform: 'translateX(130%)' },
        },
        'node-receive': {
          '0%, 16%, 100%': { borderColor: 'hsl(var(--border))', transform: 'scale(1)' },
          '21%, 33%': { borderColor: 'hsl(var(--accent) / 0.55)', transform: 'scale(1.045)' },
          '42%': { transform: 'scale(1)' },
        },
        'check-receive': {
          '0%, 18%, 100%': { opacity: '0.2', transform: 'scale(0.4)' },
          '24%, 72%': { opacity: '1', transform: 'scale(1)' },
        },
        'row-slide': {
          from: { opacity: '0', transform: 'translateY(5px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Stands in for their drone footage: a slow drift across the still,
        // so the hero is never completely static.
        'ken-burns': {
          '0%, 100%': { transform: 'scale(1.08) translate3d(0, 0, 0)' },
          '50%': { transform: 'scale(1.16) translate3d(-1.5%, -1.5%, 0)' },
        },
        'fade-out-right': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(24px)' },
        },
        'slide-up-in': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1000' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'rise-in': 'rise-in 0.7s ease-out both',
        'portrait-pop': 'portrait-pop 0.5s cubic-bezier(0.23, 1, 0.32, 1) both',
        float: 'float 6s ease-in-out infinite',
        'route-flow': 'route-flow 0.9s linear infinite',
        'scroll-arrow': 'scroll-arrow 2.4s ease-in-out infinite',
        'core-spin': 'core-spin 9s linear infinite',
        'core-breathe': 'core-breathe 3.2s ease-in-out infinite',
        'tile-charge': 'tile-charge 2.6s ease-in-out infinite',
        'node-receive': 'node-receive 2.6s ease-in-out infinite',
        'check-receive': 'check-receive 2.6s ease-in-out infinite',
        'row-slide': 'row-slide 0.45s ease-out both',
        'ken-burns': 'ken-burns 26s ease-in-out infinite',
        'fade-out-right': 'fade-out-right 0.25s ease-in both',
        'slide-up-in': 'slide-up-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        marquee: 'marquee 40s linear infinite',
        'draw-line': 'draw-line 1.8s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
