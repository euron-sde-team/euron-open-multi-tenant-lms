import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/core/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/course-templates/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/book-templates/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/lms-templates/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/webinar-templates/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/certificate-templates/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
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
        // Slow, looping gradient drift, used as a backdrop for hero
        // sections and the "your academy is being built" screen.
        "gradient-shift": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
        },
        // Sweep highlight across an active milestone row while work is
        // in-flight; conveys "we are doing something right now".
        shimmer: {
          "0%": { "background-position": "-200% 0" },
          "100%": { "background-position": "200% 0" },
        },
        // Subtle vertical bob for celebration / success ornaments.
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        // Soft pulsing ring around the live URL on the reveal screen so
        // it reads as "this is alive right now, click it".
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        "gradient-shift": "gradient-shift 8s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        float: "float 3s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
