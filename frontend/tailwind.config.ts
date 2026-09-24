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
          dark: "#1D4ED8",
          light: "#60A5FA",
        },
        brand: {
          indigo: "#6366F1",
          purple: "#8B5CF6",
          cyan: "#06B6D4",
        },
        status: {
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
        page: "#F8FAFC",
        section: "#EFF6FF",
        heading: "#172554",
        body: "#64748B",
        chart: {
          tremor: "#6366F1",
          gyroscope: "#06B6D4",
          gait: "#10B981",
          baseline: "#8B5CF6",
          warning: "#F59E0B",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2563EB 0%, #6366F1 50%, #8B5CF6 100%)",
        "soft-gradient": "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #ECFEFF 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
