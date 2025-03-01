const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        silkscreen: ["Silkscreen", ...defaultTheme.fontFamily.sans],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "slide-down": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        marquee2: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0%)" },
        },
        marquee3: {
          "0%": { transform: "translateX(10px)" },
          "100%": { transform: "translateX(-10px)" },
        },
        rotate3d: {
          "0%": { transform: "rotateY(0deg)" },
          "25%": { transform: "rotateY(90deg)" },
          "50%": { transform: "rotateY(180deg)" },
          "75%": { transform: "rotateY(270deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
        shimmer: {
          "100%": {
            transform: "translateX(100%)",
          },
        },
        shine: {
          "0%": { 
            opacity: "0",
            backgroundPosition: "200% 0" 
          },
          "20%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { 
            opacity: "0",
            backgroundPosition: "-200% 0" 
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.3s ease-out",
        "accordion-up": "accordion-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        wiggle: "wiggle 0.3s ease-in-out",
        marquee: "marquee var(--marquee-duration, 10s) linear infinite",
        marquee2: "marquee2 var(--marquee-duration, 10s) linear infinite",
        rotate3d: "rotate3d 3s linear infinite",
        "rotate3d-slow": "rotate3d 5s linear infinite",
        "rotate3d-fast": "rotate3d 1.5s linear infinite",
        shine: "shine 3s ease-in-out infinite",
      },
      boxShadow: {
        brutalist: "3px 3px 0px 0 rgba(0,0,0,1)",
        "brutalist-sm": "1.5px 1.5px 0px 0 rgba(0, 0, 0, .2)",
      },
      colors: {
        "privy-navy": "#160B45",
        "privy-light-blue": "#EFF1FD",
        "privy-blueish": "#D4D9FC",
        "privy-pink": "#FF8271",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("tailwindcss-animate")],
};
