import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          blue: "#2563EB",
        },
        indigo: {
          accent: "#6366F1",
          DEFAULT: "#6366F1",
        },
        purple: {
          accent: "#8B5CF6",
          DEFAULT: "#8B5CF6",
        },
        cyan: {
          teal: "#06B6D4",
          DEFAULT: "#06B6D4",
        },
        success: {
          green: "#10B981",
          DEFAULT: "#10B981",
        },
        warning: {
          amber: "#F59E0B",
          DEFAULT: "#F59E0B",
        },
        error: {
          red: "#EF4444",
          DEFAULT: "#EF4444",
        },
        background: "#F8FAFC",
        section: "#EFF6FF",
        white: "#FFFFFF",
        border: "#E2E8F0",
        divider: "#E2E8F0",
        navy: "#172554",
        slate: "#64748B",
        chart: {
          tremor: "#6366F1",
          gyroscope: "#06B6D4",
          gait: "#10B981",
          ecg: "#EF4444",
          baseline: "#8B5CF6",
          warning: "#F59E0B",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2563EB 0%, #6366F1 50%, #8B5CF6 100%)",
        "background-gradient": "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #ECFEFF 100%)",
        "soft-gradient": "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #ECFEFF 100%)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
