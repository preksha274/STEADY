import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  fullWidth = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary:
      "bg-[#2563EB] text-white hover:bg-[#1D4ED8] focus:ring-blue-500 shadow-sm hover:shadow active:scale-[0.99]",
    secondary:
      "bg-[#6366F1] text-white hover:bg-[#4F46E5] focus:ring-indigo-500 shadow-sm hover:shadow active:scale-[0.99]",
    outline:
      "bg-white text-[#2563EB] border border-[#E2E8F0] hover:bg-slate-50 hover:border-blue-300 focus:ring-blue-500 active:scale-[0.99]",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs sm:text-sm gap-1.5",
    md: "px-4 py-2.5 text-sm sm:text-base gap-2",
    lg: "px-6 py-3.5 text-base sm:text-lg gap-2.5 rounded-2xl",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
